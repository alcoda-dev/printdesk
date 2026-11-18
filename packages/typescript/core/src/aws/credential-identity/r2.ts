import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Jwk from "effect/jose/Jwk";
import * as Jwt from "effect/jose/Jwt";
import * as Layer from "effect/Layer";
import * as LayerMap from "effect/LayerMap";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as String from "effect/String";

import { AwsCredentialIdentityProvider, AwsCredentialIdentityProviderError } from ".";
import { Actor, ActorLayerMap } from "../../actors";
import { Cloudflare } from "../../cloudflare";
import { Constants } from "../../utils/constants";
import { S3Bucket } from "../s3/bucket";
import { S3Credentials } from "../s3/credentials";

export const makeR2CredentialIdentityProvider = Effect.gen(function* () {
  const { account } = yield* Cloudflare;
  const digest = yield* Digest.Digest;

  const s3Bucket = yield* S3Bucket;
  const r2S3Credentials = yield* S3Credentials;

  const textEncoder = new globalThis.TextEncoder();

  const jwt = yield* Jwt.sign(
    Jwt.RegisteredClaims.pipe(
      Schema.fieldsAssign({
        actions: Schema.String.pipe(Schema.Array),
        bucket: Schema.String,
        scope: Schema.String,
      }),
    ),
    {
      actions: ["PutObject", "GetObject"],
      bucket: yield* s3Bucket.name,
      scope: "object-read-write",
      sub: account.id,
      iss: r2S3Credentials.accessKeyId.pipe(Redacted.value),
      aud: yield* s3Bucket.endpoint,
      iat: yield* DateTime.now.pipe(Effect.map(DateTime.toEpochSeconds)),
      exp: Duration.hours(1).pipe(Duration.toSeconds),
    },
    yield* Jwk.importSecret(
      Redacted.make({ kty: "oct", k: r2S3Credentials.secretAccessKey.pipe(Redacted.value) }),
      "HS256",
    ),
    { typ: "JWT" },
  ).pipe(Effect.map(Redacted.value));

  const secretAccessKey = yield* digest.digestHex(Digest.sha256, textEncoder.encode(jwt));

  const sessionToken = yield* Effect.succeed("jwt/").pipe(
    Effect.map(String.concat(jwt)),
    Effect.flatMap(Schema.encodeEffect(Schema.StringFromBase64)),
  );

  return yield* AwsCredentialIdentityProvider.make({
    accessKeyId: r2S3Credentials.accessKeyId.pipe(Redacted.value),
    secretAccessKey,
    sessionToken,
  });
});

export const r2CredentialIdentityProviderLayer = makeR2CredentialIdentityProvider.pipe(
  Effect.mapBoth({
    onFailure: (error) =>
      Schema.is(AwsCredentialIdentityProviderError)(error)
        ? error
        : new AwsCredentialIdentityProviderError({ cause: error }),
    onSuccess: AwsCredentialIdentityProvider.layerFromSelf,
  }),
  Layer.unwrap,
);

export class R2CredentialIdentityProviderLayerMap extends LayerMap.Service<R2CredentialIdentityProviderLayerMap>()(
  "@printdesk/core/aws/credential-identity/R2ProviderLayerMap",
  {
    dependencies: [ActorLayerMap.layer],
    lookup: (actor: typeof Actor.Service) =>
      r2CredentialIdentityProviderLayer.pipe(Layer.provide(ActorLayerMap.get(actor))),
    idleTimeToLive: Constants.DEFAULT_LAYER_MAP_IDLE_TTL,
  },
) {
  public static readonly provide = this.pipe(
    Effect.map((layerMap) =>
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(
        Actor.pipe(
          Effect.map((actor) => layerMap.get(actor)),
          Layer.unwrap,
        ),
      ),
    ),
  );
}

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as LayerMap from "effect/LayerMap";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as String from "effect/String";

import { AwsCredentialIdentityProvider, AwsCredentialIdentityProviderError } from ".";
import { Actor, ActorLayerMap } from "../../actors";
import { Cloudflare } from "../../cloudflare";
import { Crypto } from "../../crypto";
import { Constants } from "../../utils/constants";
import { S3Bucket } from "../s3/bucket";
import { S3Credentials } from "../s3/credentials";

export const makeR2CredentialIdentityProvider = Effect.gen(function* () {
  const { account } = yield* Cloudflare;
  const crypto = yield* Crypto;
  const s3Bucket = yield* S3Bucket;
  const r2S3Credentials = yield* S3Credentials;

  const textEncoder = new globalThis.TextEncoder();

  const claims: Record<string, unknown> = {
    actions: ["PutObject", "GetObject"],
    bucket: yield* s3Bucket.name,
    scope: "object-read-write",
  };

  const jwt = yield* crypto.signJwt({
    claims,
    subject: account.id,
    issuer: r2S3Credentials.accessKeyId.pipe(Redacted.value),
    audience: yield* s3Bucket.endpoint,
    ttl: Duration.hours(1),
    key: textEncoder.encode(r2S3Credentials.secretAccessKey.pipe(Redacted.value)),
  });

  const secretAccessKey = yield* crypto
    .digest("SHA-256", textEncoder.encode(jwt))
    .pipe(Effect.flatMap(Schema.encodeEffect(Schema.Uint8ArrayFromHex)));

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

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import type {
  AwsCredentialIdentity as AwsSdkCredentialIdentity,
  AwsCredentialIdentityProvider as AwsSdkCredentialIdentityProvider,
} from "@aws-sdk/types";

export class AwsCredentialIdentityProviderError
  extends Schema.TaggedError<
    AwsCredentialIdentityProviderError,
    { readonly brand: unique symbol }
  >()("AwsCredentialIdentityProviderError", { cause: Schema.Defect() }, { httpApiStatus: 500 })
  implements HttpServerRespondable.Respondable
{
  // oxlint-disable-next-line class-methods-use-this
  public [HttpServerRespondable.symbol] = () =>
    HttpServerResponse.empty({ status: 500 }).pipe(Effect.succeed);
}

export class AwsCredentialIdentity extends Schema.Class<
  AwsCredentialIdentity,
  { readonly brand: unique symbol }
>("AwsCredentialIdentity")({
  accessKeyId: Schema.String.pipe(Schema.RedactedFromValue),
  secretAccessKey: Schema.String.pipe(Schema.RedactedFromValue),
  sessionToken: Schema.String.pipe(Schema.RedactedFromValue, Schema.optional),
  credentialScope: Schema.String.pipe(Schema.RedactedFromValue, Schema.optional),
  accountId: Schema.String.pipe(Schema.RedactedFromValue, Schema.optional),
  expiration: Schema.DateTimeUtcFromDate.pipe(Schema.RedactedFromValue, Schema.optional),
}) {
  public readonly encode = Effect.succeed(this).pipe(
    Effect.flatMap(Schema.encodeEffect(AwsCredentialIdentity)),
    Effect.orDie,
  );
}

// @effect-leakable-service
export class AwsCredentialIdentityProvider extends Context.Service<AwsCredentialIdentityProvider>()(
  "@printdesk/core/aws/CredentialIdentityProvider",
  {
    make: Effect.fn(function* (smithy: AwsSdkCredentialIdentity) {
      const credentials = yield* Effect.succeed(smithy).pipe(
        Effect.flatMap(Schema.decodeEffect(AwsCredentialIdentity)),
        Effect.mapError((cause) => new AwsCredentialIdentityProviderError({ cause })),
      );

      return { credentials } as const;
    }),
  },
) {
  public static readonly provide = this.useSync(Struct.get("credentials"));

  public static readonly fromProvider = (provider: () => AwsSdkCredentialIdentityProvider) =>
    Effect.tryPromise({
      try: () => provider()(),
      catch: (cause) => new AwsCredentialIdentityProviderError({ cause }),
    }).pipe(Effect.flatMap(this.make));

  public static readonly layer = (identity: AwsSdkCredentialIdentity) =>
    this.make(identity).pipe(Layer.effect(this), Layer.fresh);

  public static readonly layerFromSelf = (self: AwsCredentialIdentityProvider["Service"]) =>
    Layer.succeed(this, self);

  public static readonly layerFromProvider = (provider: () => AwsSdkCredentialIdentityProvider) =>
    this.fromProvider(provider).pipe(Layer.effect(this), Layer.fresh);
}

import { createClient } from "@openauthjs/openauth/client";
import {
  InvalidAuthorizationCodeError,
  InvalidAccessTokenError,
  InvalidRefreshTokenError,
} from "@openauthjs/openauth/error";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as String from "effect/String";
import * as Struct from "effect/Struct";

import { Aws } from "../../aws";
import { AwsCredentialIdentityProvider } from "../../aws/credential-identity";
import { LambdaWebFunctionClient } from "../../aws/sigv4-signers/lambda";
import { Constants } from "../../utils/constants";
import { OauthContract } from "../contract";
import { OpenauthExternalIssuer, OpenauthInternalIssuer } from "./issuer";

import type { ClientInput, RefreshOptions, VerifyOptions } from "@openauthjs/openauth/client";

export interface OpenauthClientInput extends Omit<ClientInput, "fetch" | "issuer"> {
  issuer: NonNullable<ClientInput["issuer"]>;
  fetch?: (...args: Parameters<typeof globalThis.fetch>) => Promise<Response>;
}

export interface OpenauthRefreshOptions extends Omit<RefreshOptions, "access"> {
  access?: Redacted.Redacted;
}

export interface OpenauthVerifyOptions extends Omit<VerifyOptions, "refresh"> {
  refresh?: Redacted.Redacted;
}

const removeTrailingSlash = String.replace(/\/$/, "");

export class Openauth extends Context.Service<Openauth>()("@printdesk/core/oauth/Openauth", {
  make: Effect.fn(function* (input: OpenauthClientInput) {
    const issuer = yield* OpenauthExternalIssuer.useSync(Struct.get("href")).pipe(
      Effect.map(removeTrailingSlash),
    );

    const openauth = yield* Effect.try({
      try: () => createClient(input),
      catch: (cause) => new OauthContract.OpenauthError({ cause }),
    });

    const authorize = (...args: Parameters<typeof openauth.authorize>) =>
      Effect.tryPromise({
        try: () => openauth.authorize(...args),
        catch: (cause) => new OauthContract.AuthorizeError({ cause }),
      }).pipe(
        Effect.flatMap(Schema.decodeEffect(OauthContract.AuthorizeSuccess)),
        Effect.catchTag("SchemaError", Effect.die),
      );

    const exchange = Effect.fn(function* (...args: Parameters<typeof openauth.exchange>) {
      const result = yield* Effect.tryPromise({
        try: () => openauth.exchange(...args),
        catch: (cause) => new OauthContract.ExchangeError({ cause }),
      });

      if (result.err !== false)
        return yield* Match.value(result.err).pipe(
          Match.when(
            Match.instanceOf(InvalidAuthorizationCodeError),
            (cause) => new OauthContract.InvalidAuthorizationCodeError({ cause }),
          ),
          Match.orElse((cause) => new OauthContract.ExchangeError({ cause })),
        );

      const decode = Schema.decodeEffect(OauthContract.ExchangeSuccess);

      return yield* decode(result).pipe(Effect.orDie);
    });

    const refresh = Effect.fn(function* (
      refresh: Redacted.Redacted,
      opts?: OpenauthRefreshOptions,
    ) {
      const result = yield* Effect.tryPromise({
        try: () =>
          openauth.refresh(refresh.pipe(Redacted.value), {
            ...opts,
            access: opts?.access?.pipe(Redacted.value),
          }),
        catch: (cause) => new OauthContract.RefreshError({ cause }),
      });

      if (result.err !== false)
        return yield* Match.value(result.err).pipe(
          Match.when(
            Match.instanceOf(InvalidAccessTokenError),
            (cause) => new OauthContract.InvalidAccessTokenError({ cause }),
          ),
          Match.when(
            Match.instanceOf(InvalidRefreshTokenError),
            (cause) => new OauthContract.InvalidRefreshTokenError({ cause }),
          ),
          Match.orElse((cause) => new OauthContract.RefreshError({ cause })),
        );

      const decode = Schema.decodeEffect(OauthContract.RefreshSuccess);

      return yield* decode(result).pipe(Effect.orDie);
    });

    const verify = Effect.fn(function* (token: Redacted.Redacted, opts?: OpenauthVerifyOptions) {
      const result = yield* Effect.tryPromise({
        try: () =>
          openauth.verify(OauthContract.subjects, token.pipe(Redacted.value), {
            issuer,
            ...opts,
            refresh: opts?.refresh?.pipe(Redacted.value),
          }),
        catch: (cause) => new OauthContract.VerifyError({ cause }),
      });

      if (result.err)
        return yield* Match.value(result.err).pipe(
          Match.when(
            Match.instanceOf(InvalidRefreshTokenError),
            (cause) => new OauthContract.InvalidRefreshTokenError({ cause }),
          ),
          Match.when(
            Match.instanceOf(InvalidAccessTokenError),
            (cause) => new OauthContract.InvalidAccessTokenError({ cause }),
          ),
          Match.orElse((cause) => new OauthContract.VerifyError({ cause })),
        );

      const decode = Schema.decodeEffect(OauthContract.VerifySuccess);

      return yield* decode(result).pipe(Effect.orDie);
    });

    const clientCredentials = Effect.fn(
      function* (credentials: OauthContract.ClientCredentials) {
        const request = yield* HttpClientRequest.post(new URL("/token", input.issuer)).pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: Constants.CLIENT_CREDENTIALS,
            provider: Constants.CLIENT_CREDENTIALS,
            client_id: credentials.id,
            client_secret: credentials.secret.pipe(Redacted.value),
          }),
          HttpClientRequest.toWeb,
        );

        const response = yield* Effect.promise((signal) =>
          (input.fetch || globalThis.fetch)(request, { signal }),
        );

        const tokens = yield* HttpClientResponse.fromWeb(
          HttpClientRequest.fromWeb(request),
          response,
        ).pipe(HttpClientResponse.schemaBodyJson(OauthContract.Tokens));

        return { tokens } as const;
      },
      (effect) =>
        effect.pipe(
          Effect.mapError((error) => new OauthContract.ClientCredentialsError({ cause: error })),
        ),
    );

    return {
      issuer: input.issuer,
      clientId: input.clientID,
      authorize,
      exchange,
      refresh,
      verify,
      clientCredentials,
    } as const;
  }),
}) {
  public static readonly layer = (...args: Parameters<typeof this.make>) =>
    this.make(...args).pipe(Layer.effect(this));

  public static readonly layerFromInternalClientId = Effect.fn(function* (
    clientId: Exclude<
      Constants.OpenauthClientId,
      typeof Constants.OPENAUTH_CLIENT_IDS.API_GATEWAY | typeof Constants.OPENAUTH_CLIENT_IDS.WEB
    >,
  ) {
    const { accessKeyId, secretAccessKey, sessionToken } =
      yield* AwsCredentialIdentityProvider.provide;

    const aws = yield* Aws;
    const issuer = yield* OpenauthInternalIssuer.useSync(Struct.get("href")).pipe(
      Effect.map(removeTrailingSlash),
    );

    const lambda = new LambdaWebFunctionClient({
      accessKeyId: accessKeyId.pipe(Redacted.value),
      secretAccessKey: secretAccessKey.pipe(Redacted.value),
      sessionToken: sessionToken?.pipe(Redacted.value),
      region: aws.pipe(Redacted.value).region,
      retries: 0,
    });

    return Openauth.layer({
      clientID: clientId,
      fetch: (...args) => lambda.fetch(...args),
      issuer,
    });
  }, Layer.unwrap);

  public static readonly verify = (...args: Parameters<(typeof this)["Service"]["verify"]>) =>
    this.use((openauth) => openauth.verify(...args));

  public static readonly clientCredentials = (
    ...args: Parameters<(typeof this)["Service"]["clientCredentials"]>
  ) => this.use((openauth) => openauth.clientCredentials(...args));
}

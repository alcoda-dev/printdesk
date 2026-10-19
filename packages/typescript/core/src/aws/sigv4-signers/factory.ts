import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import * as Cache from "effect/Cache";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as String from "effect/String";
import * as Struct from "effect/Struct";

import { SstResource } from "../../sst/resource";
import { NonEmptyString } from "../../utils";
import { Constants } from "../../utils/constants";
import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from "../credential-identity";

import type {
  RequestPresigningArguments as AwsSdkRequestPresigningArguments,
  RequestSigningArguments as AwsSdkRequestSigningArguments,
} from "@aws-sdk/types";
import type * as HttpBody from "effect/http/HttpBody";

export class SignatureV4Error extends Schema.TaggedError<
  SignatureV4Error,
  { readonly brand: unique symbol }
>()("SignatureV4Error", { cause: Schema.Defect() }) {}

export class SigningError extends Schema.TaggedError<
  SigningError,
  { readonly brand: unique symbol }
>()("SigningError", { service: NonEmptyString, cause: Schema.Defect() }) {}

export interface RequestPresigningArguments extends Omit<
  AwsSdkRequestPresigningArguments,
  "expiresIn" | "signingDate"
> {
  expiresIn?: Duration.Duration;
  signingDate?: DateTime.Utc;
  host?: string;
}

export interface RequestSigningArguments extends Omit<
  AwsSdkRequestSigningArguments,
  "signingDate"
> {
  signingDate?: DateTime.Utc;
  host?: string;
}

export const makeSigV4Signer = Effect.fn(function* (service: NonEmptyString) {
  const region = yield* SstResource.useSync((resource) =>
    resource.Aws.pipe(Redacted.value, Struct.get("region")),
  );

  const sigv4Cache = yield* Cache.make({
    capacity: Constants.DEFAULT_CACHE_CAPACITY,
    lookup: (credentials: AwsCredentialIdentity) =>
      credentials.encode.pipe(
        Effect.flatMap((credentials) =>
          Effect.try({
            try: () => new SignatureV4({ credentials, sha256: Sha256, region, service }),
            catch: (cause) => new SignatureV4Error({ cause }),
          }),
        ),
      ),
  });

  const useSigv4 = <TSuccess, TError, TServices>(
    callback: (sigv4: SignatureV4) => Effect.Effect<TSuccess, TError, TServices>,
  ) =>
    AwsCredentialIdentityProvider.provide.pipe(
      Effect.flatMap((credentials) => sigv4Cache.pipe(Cache.get(credentials))),
      Effect.flatMap(callback),
    );

  const presign = (...args: Parameters<SignatureV4["presign"]>) =>
    useSigv4((sigv4) =>
      Effect.tryPromise({
        try: () => sigv4.presign(...args),
        catch: (cause) => new SigningError({ service, cause }),
      }),
    );

  const sign = (...args: Parameters<SignatureV4["sign"]>) =>
    useSigv4((sigv4) =>
      Effect.tryPromise({
        try: () => sigv4.sign(...args),
        catch: (cause) => new SigningError({ service, cause }),
      }),
    );

  const matchBody = Match.typeTags<HttpBody.HttpBody>()({
    Empty: () => undefined,
    Raw: (body) => body.body,
    Uint8Array: (body) => body.body,
    FormData: (body) => body.formData,
    Stream: (body) => body.stream,
  });

  const presignRequest = Effect.fn(`${String.capitalize(service)}.presignRequest`)(function* (
    request: HttpClientRequest.HttpClientRequest,
    { host, ...args }: RequestPresigningArguments = {},
  ) {
    const { protocol, hostname, pathname: path } = new URL(request.url);

    const { headers, query } = yield* presign(
      new HttpRequest({
        method: request.method,
        protocol,
        hostname,
        path,
        headers: { ...request.headers, host: host ?? hostname },
        body: matchBody(request.body),
      }),
      {
        ...args,
        expiresIn: args.expiresIn?.pipe(Duration.toSeconds),
        signingDate: args.signingDate?.pipe(DateTime.toDateUtc),
      },
    ).pipe(Effect.mapError((cause) => new HttpClientError.EncodeError({ request, cause })));

    return request.pipe(
      HttpClientRequest.setHeaders(headers),
      HttpClientRequest.setUrlParams(query ?? {}),
    );
  });

  const signRequest = Effect.fn(`${String.capitalize(service)}.signRequest`)(function* (
    request: HttpClientRequest.HttpClientRequest,
    { host, ...args }: RequestSigningArguments = {},
  ) {
    const { protocol, hostname, pathname: path } = new URL(request.url);

    const { headers } = yield* sign(
      new HttpRequest({
        method: request.method,
        protocol,
        hostname,
        path,
        headers: { ...request.headers, host: host ?? hostname },
        body: matchBody(request.body),
      }),
      { ...args, signingDate: args.signingDate?.pipe(DateTime.toDateUtc) },
    ).pipe(Effect.mapError((cause) => new HttpClientError.EncodeError({ request, cause })));

    return request.pipe(HttpClientRequest.setHeaders(headers));
  });

  return {
    useSigv4,
    presign,
    sign,
    presignRequest,
    signRequest,
  } as const;
});

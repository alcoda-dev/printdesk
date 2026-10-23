import { Actor } from "@printdesk/core/actors";
import { ActorsContract } from "@printdesk/core/actors/contract";
import { AssetsContract } from "@printdesk/core/assets/contract";
import { AwsCredentialIdentityProvider } from "@printdesk/core/aws/credential-identity";
import { makeR2CredentialIdentityProvider } from "@printdesk/core/aws/credential-identity/r2";
import { S3Bucket } from "@printdesk/core/aws/s3/bucket";
import { S3Credentials } from "@printdesk/core/aws/s3/credentials";
import { Graph } from "@printdesk/core/graph";
import { IdentityProvidersContract } from "@printdesk/core/identity/contract";
import { EntraId } from "@printdesk/core/identity/entra-id";
import { ImagesPresigner } from "@printdesk/core/images/presigner";
import { Constants } from "@printdesk/core/utils/constants";
import * as ByteSize from "effect/ByteSize";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { makeAssetsS3Bucket } from "./lib/assets";
import { makeR2S3Credentials } from "./lib/cloudflare";
import { runtime } from "./runtime";

export class CacheInvalidationError extends Schema.TaggedError<
  CacheInvalidationError,
  { readonly brand: unique symbol }
>()("CacheInvalidationError", { cause: Schema.Defect() }) {}

export const queue = ((batch, _env, ctx) =>
  Effect.forEach(
    batch.messages,
    Effect.fn((message) =>
      Effect.succeed(message.body).pipe(
        Effect.flatMap(Schema.decodeEffect(AssetsContract.QueueMessage)),
        Effect.flatMap(
          Match.valueTags({
            InvalidationNotificationQueueMessage: ({ object }) =>
              Effect.tryPromise({
                try: () => ctx.exports.CachedAssets.invalidate([object.key]),
                catch: (error) => new CacheInvalidationError({ cause: error }),
              }).pipe(
                Effect.filterOrFail(
                  Struct.get("success"),
                  (result) => new CacheInvalidationError({ cause: result.errors }),
                ),
              ),
            UserAvatarQueueMessage: Effect.fn(function* ({ identityProvider, user, tenantId }) {
              const presigner = yield* ImagesPresigner;
              const httpClient = yield* HttpClient.HttpClient.pipe(
                Effect.map(HttpClient.filterStatusOk),
              );

              // yield* Effect.logInfo({ user, tenantId, identityProvider });

              const { contentType, data } = yield* Match.value(identityProvider).pipe(
                Match.when({ kind: Match.is(Constants.ENTRA_ID) }, (entraId) =>
                  Graph.use((graph) => graph.userPhoto(user.externalId)).pipe(
                    Effect.provideServiceEffect(
                      EntraId.AuthProvider,
                      EntraId.AuthProvider.fromClientCredentials(entraId.externalId),
                    ),
                  ),
                ),
                Match.when({ kind: Match.is(Constants.GOOGLE) }, (google) =>
                  Effect.fail(new IdentityProvidersContract.NotImplementedError(google)),
                ),
                Match.exhaustive,
              );
              const contentLength = data.byteLength;

              yield* presigner
                .presignPutUrl(`avatars/users/${user.id}`, {
                  type: contentType,
                  length: ByteSize.fromInputUnsafe(contentLength),
                  expiresIn: Duration.minutes(1),
                })
                .pipe(
                  Effect.map(Struct.get("url")),
                  Effect.map(HttpClientRequest.put),
                  Effect.map(
                    HttpClientRequest.setBody(HttpBody.raw(data, { contentLength, contentType })),
                  ),
                  Effect.flatMap(httpClient.execute),
                  Effect.provideServiceEffect(
                    AwsCredentialIdentityProvider,
                    makeR2CredentialIdentityProvider,
                  ),
                  Effect.provideServiceEffect(S3Bucket, makeAssetsS3Bucket),
                  Effect.provideServiceEffect(S3Credentials, makeR2S3Credentials),
                  Effect.provideService(
                    Actor,
                    new ActorsContract.TenantActor({ id: tenantId }).wrap,
                  ),
                );
            }),
          }),
        ),
        Effect.andThen(Effect.sync(() => message.ack())),
        Effect.catchTag(["NoSuchElementError", "IdentityProviderNotImplementedError"], () =>
          Effect.sync(() => message.ack()),
        ),
        Effect.catchCause(
          Effect.fn((cause) =>
            Effect.logError(
              `Message "${message.id}" processing attempt #${message.attempts} failed:`,
              cause,
            ).pipe(Effect.andThen(Effect.sync(() => message.retry()))),
          ),
        ),
      ),
    ),
    { concurrency: "unbounded", discard: true },
  ).pipe(
    Effect.andThen(Effect.sync(() => batch.ackAll())),
    Effect.catchCause((cause) =>
      Effect.logError("Batch processing failed:", cause).pipe(
        Effect.andThen(Effect.sync(() => batch.retryAll())),
      ),
    ),
    runtime.runPromise,
  )) satisfies ExportedHandlerQueueHandler<Env, typeof AssetsContract.QueueMessage.Encoded>;

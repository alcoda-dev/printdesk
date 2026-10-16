import * as Array from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Function from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Request from "effect/Request";
import * as RequestResolver from "effect/RequestResolver";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { Actor } from "../actors";
import { AppsyncSigner } from "../aws/sigv4-signers/appsync";
import { SstResource } from "../sst/resource";
import { prefix, suffix } from "../utils";
import { RealtimeContract } from "./contract";

import type * as Duration from "effect/Duration";
import type { AwsCredentialIdentityProvider } from "../aws/credential-identity";
import type { TenantId } from "../utils";

export class PublishRequest extends Request.Class<
  { eventHandler: RealtimeContract.EventHandler; tenantId: TenantId },
  void,
  PublishError,
  AwsCredentialIdentityProvider
> {}

export class PublishError extends Schema.TaggedError<PublishError>()("PublishError", {
  cause: Schema.Defect(),
}) {}

export class Realtime extends Context.Service<Realtime>()("@printdesk/core/realtime/Realtime", {
  make: Effect.gen(function* () {
    const baseUrl = yield* SstResource.useSync((resource) =>
      resource.Hostnames.pipe(
        Redacted.value,
        Struct.get("realtime"),
        (hostname) => `https://${hostname}`,
      ),
    );
    const signer = yield* AppsyncSigner;
    const httpClient = yield* HttpClient.HttpClient;

    const getAuthorization = Effect.fn("Realtime.getAuthorization")(
      (payload: RealtimeContract.AuthorizationPayload, expiresIn?: Duration.Duration) =>
        HttpClientRequest.post(baseUrl).pipe(
          HttpClientRequest.appendUrl("/event"),
          HttpClientRequest.setHeaders({
            accept: "application/json, text/javascript",
            "content-encoding": "amz-1.0",
          }),
          HttpClientRequest.schemaBodyJson(RealtimeContract.AuthorizationPayload)(payload),
          Effect.flatMap((request) =>
            expiresIn ? signer.presignRequest(request, { expiresIn }) : signer.signRequest(request),
          ),
          Effect.map(Struct.get("headers")),
        ),
    );

    const publishResolver = Effect.context<AwsCredentialIdentityProvider>().pipe(
      Effect.map((context) =>
        RequestResolver.makeGrouped<PublishRequest, RealtimeContract.Channel>({
          key: (entry) =>
            Function.pipe(
              entry.request.tenantId,
              prefix("/"),
              suffix(entry.request.eventHandler.name),
            ),
          resolver: (entries, channel) =>
            HttpClientRequest.post(baseUrl).pipe(
              HttpClientRequest.appendUrl("/event"),
              HttpClientRequest.schemaBodyJson(RealtimeContract.PublishPayload)({
                channel,
                events: Array.map(entries, (entry) => entry.request.eventHandler.input),
              }),
              Effect.flatMap(signer.signRequest),
              Effect.flatMap(httpClient.execute),
              Effect.asVoid,
              Effect.provideContext(context),
              Effect.andThen((success) => Effect.forEach(entries, Request.succeed(success))),
              Effect.catchCause((cause) =>
                Effect.forEach(entries, Request.fail(new PublishError({ cause }))),
              ),
            ),
        }),
      ),
      Effect.map(RequestResolver.batchN(5)),
      Effect.map(RequestResolver.withSpan("Realtime.publishResolver")),
    );

    const publish = Effect.fn("Realtime.publish")((eventHandler: RealtimeContract.EventHandler) =>
      Actor.tenantId.pipe(
        Effect.flatMap((tenantId) =>
          Effect.request(new PublishRequest({ eventHandler, tenantId }), publishResolver),
        ),
      ),
    );

    return { getAuthorization, publish } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

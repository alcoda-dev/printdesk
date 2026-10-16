import { AuthMiddleware } from "@printdesk/core/api/middleware/auth";
import { AssetsContract } from "@printdesk/core/assets/contract";
import { Openauth } from "@printdesk/core/oauth/openauth";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { orErrorResponse } from "./lib/error";
import { runtime } from "./runtime";

export const fetch = Effect.fn(
  function* (request, _env, ctx) {
    const parsed = yield* AuthMiddleware.parse.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(request),
      ),
    );

    const verified = yield* Openauth.verify(parsed.accessToken, {
      refresh: parsed._tag === "AuthCookies" ? parsed.refreshToken : undefined,
    });

    const user = yield* verified.subject.properties.actor.wrap.assertUser;

    const url = new URL(request.url);
    const cacheKey = url.pathname;
    yield* Schema.encodeEffect(AssetsContract.UserParams)(user).pipe(
      Effect.map(Record.toEntries),
      Effect.flatMap(
        Effect.forEach(([key, value]) => Effect.sync(() => url.searchParams.append(key, value)), {
          discard: true,
        }),
      ),
    );
    const forwarded = new Request(url, request);
    if (parsed._tag === "AuthHeaders")
      forwarded.headers.delete(Constants.FORWARDED_AUTHORIZATION_HEADER_NAME);

    const response = yield* Effect.tryPromise((signal) =>
      ctx.exports
        .CachedAssets({ props: { tenantId: user.tenantId } })
        .fetch(forwarded, { cf: { cacheKey }, signal }),
    ).pipe(Effect.map(HttpServerResponse.fromWeb));

    if (Option.isNone(verified.tokens) || parsed._tag !== "AuthCookies") return response;

    return yield* response.pipe(
      HttpServerResponse.setCookies([
        [
          Constants.COOKIE_NAMES.ACCESS_TOKEN,
          verified.tokens.value.access.pipe(Redacted.value),
          Constants.COOKIE_OPTIONS,
        ],
        [
          Constants.COOKIE_NAMES.REFRESH_TOKEN,
          verified.tokens.value.refresh.pipe(Redacted.value),
          Constants.COOKIE_OPTIONS,
        ],
      ]),
    );
  },
  (effect) => effect.pipe(orErrorResponse, runtime.runPromise),
) satisfies ExportedHandlerFetchHandler<Env>;

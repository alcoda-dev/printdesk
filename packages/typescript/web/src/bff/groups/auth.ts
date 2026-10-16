import { OauthContract } from "@printdesk/core/oauth/contract";
import { Openauth } from "@printdesk/core/oauth/openauth";
import { TenantSlug } from "@printdesk/core/tenants/slug";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { Bff } from "../contract";
import { openauthLayer } from "../lib/auth";
import { errorMiddlewareLayer } from "../middleware/error";
import { tenantSlugValidatorMiddlewareLayer } from "../middleware/tenant-slug-validator";

const redirectUri = (request: HttpServerRequest.HttpServerRequest) =>
  HttpServerRequest.toClientRequest(request).pipe(
    HttpClientRequest.updateUrl((url) => {
      const redirectUrl = new URL(url);
      redirectUrl.pathname = Constants.WEB_BFF_PATHS.oauthCallback;

      return redirectUrl.href;
    }),
    HttpClientRequest.toUrl,
    Effect.fromOption,
    Effect.orDie,
    Effect.map(Struct.get("href")),
  );

export const baseAuthGroupLayer = HttpApiBuilder.group(
  Bff,
  "Auth",
  Effect.fn(function* (handlers) {
    const openauth = yield* Openauth;

    return handlers
      .handle("me", () =>
        OauthContract.AuthCookies.pipe(
          HttpServerRequest.schemaCookies,
          Effect.mapError((error) => new OauthContract.InvalidCookiesError({ cause: error })),
          Effect.flatMap((tokens) => openauth.verify(tokens.accessToken)),
          Effect.flatMap((result) => result.subject.properties.actor.wrap.assertUser),
        ),
      )
      .handle("login", ({ request }) =>
        redirectUri(request).pipe(
          Effect.flatMap((redirectUri) => openauth.authorize(redirectUri, "code")),
          Effect.flatMap(
            Effect.fn(function* ({ url }) {
              url.searchParams.set(Constants.URL_PARAM_NAMES.TENANT_SLUG, yield* TenantSlug);
              return HttpServerResponse.redirect(url);
            }),
          ),
        ),
      )
      .handle("oauthCallback", ({ request, query }) =>
        redirectUri(request).pipe(
          Effect.flatMap((redirectUri) => openauth.exchange(query.code, redirectUri)),
          Effect.flatMap(({ tokens }) =>
            HttpServerResponse.redirect(query.redirectUri).pipe(
              HttpServerResponse.setCookies([
                [
                  Constants.COOKIE_NAMES.ACCESS_TOKEN,
                  tokens.access.pipe(Redacted.value),
                  Constants.COOKIE_OPTIONS,
                ],
                [
                  Constants.COOKIE_NAMES.REFRESH_TOKEN,
                  tokens.refresh.pipe(Redacted.value),
                  Constants.COOKIE_OPTIONS,
                ],
              ]),
            ),
          ),
          orDieWhenUnrespondable,
        ),
      );
  }),
);

export const authGroupLayer = baseAuthGroupLayer.pipe(
  Layer.provide([errorMiddlewareLayer, openauthLayer, tenantSlugValidatorMiddlewareLayer]),
);

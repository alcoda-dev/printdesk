import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { ActorLayerMap } from "../../actors";
import { Oauth } from "../../oauth";
import { OauthContract } from "../../oauth/contract";
import { Openauth } from "../../oauth/openauth";
import { Constants } from "../../utils/constants";

import type { Actor } from "../../actors";

export class AuthMiddleware extends HttpApiMiddleware.Service<
  AuthMiddleware,
  { provides: Actor | Oauth.AccessToken }
>()("@printdesk/core/api/AuthMiddleware", {
  error: [
    OauthContract.MultipleAuthenticationMethodsError,
    OauthContract.InvalidCookiesError,
    OauthContract.InvalidHeadersError,
    OauthContract.InvalidAccessTokenError,
    OauthContract.InvalidRefreshTokenError,
    OauthContract.VerifyError,
    HttpApiError.Unauthorized,
  ],
}) {
  public static get Headers() {
    return OauthContract.AuthHeaders.to.pipe(
      Schema.encodeKeys({ accessToken: Constants.FORWARDED_AUTHORIZATION_HEADER_NAME }),
    );
  }

  public static readonly parse = Effect.all([
    HttpServerRequest.HttpServerRequest.pipe(
      Effect.map(Struct.get("cookies")),
      Effect.map(
        Option.liftPredicate((cookies) =>
          Schema.toEncoded(OauthContract.AuthCookies)
            .schema.from.mapFields(Struct.omit(["_tag"]))
            .pipe(
              Struct.get("fields"),
              Struct.keys,
              Array.every((key) => key in cookies),
            ),
        ),
      ),
    ),
    HttpServerRequest.HttpServerRequest.pipe(
      Effect.map(Struct.get("headers")),
      Effect.map(
        Option.liftPredicate((headers) =>
          Schema.toEncoded(AuthMiddleware.Headers)
            .schema.from.mapFields(Struct.omit(["_tag"]))
            .pipe(
              Struct.get("fields"),
              Struct.keys,
              Array.every((key) => key in headers),
            ),
        ),
      ),
    ),
  ]).pipe(
    Effect.flatMap(
      Effect.fn(function* ([cookies, headers]) {
        if (Option.product(cookies, headers).pipe(Option.isSome))
          return yield* new OauthContract.MultipleAuthenticationMethodsError();

        if (Option.isSome(cookies))
          return yield* cookies.pipe(
            Option.getOrThrow,
            Schema.decodeUnknownEffect(OauthContract.AuthCookies),
            Effect.mapError((error) => new OauthContract.InvalidCookiesError({ cause: error })),
          );

        if (Option.isSome(headers))
          return yield* headers.pipe(
            Option.getOrThrow,
            Schema.decodeUnknownEffect(AuthMiddleware.Headers),
            Effect.mapError((error) => new OauthContract.InvalidHeadersError({ cause: error })),
          );

        return yield* new HttpApiError.Unauthorized();
      }),
    ),
  );

  public static readonly make = Effect.gen({ self: this }, function* () {
    const actorLayerMap = yield* ActorLayerMap;
    const accessTokenLayerMap = yield* Oauth.AccessTokenLayerMap;
    const openauth = yield* Openauth;

    return this.of(
      Effect.fn(function* (httpEffect) {
        const parsed = yield* AuthMiddleware.parse;

        const verified = yield* openauth.verify(parsed.accessToken, {
          refresh: parsed._tag === "AuthCookies" ? parsed.refreshToken : undefined,
        });

        const providedHttpEffect = httpEffect.pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide
          Effect.provide(
            Layer.mergeAll(
              actorLayerMap.get(verified.subject.properties.actor.wrap),
              accessTokenLayerMap.get(
                verified.tokens.pipe(
                  Option.map(Struct.get("access")),
                  Option.getOrElse(() => parsed.accessToken),
                ),
              ),
            ),
          ),
        );

        if (Option.isNone(verified.tokens) || parsed._tag !== "AuthCookies")
          return yield* providedHttpEffect;

        return yield* providedHttpEffect.pipe(
          Effect.flatMap(
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
          ),
          Effect.orDie,
        );
      }),
    );
  });

  public static readonly layer = this.make.pipe(Layer.effect(this));
}

import { ActorsContract } from "@printdesk/core/actors/contract";
import { OauthContract } from "@printdesk/core/oauth/contract";
import { TenantSlug } from "@printdesk/core/tenants/slug";
import { Constants } from "@printdesk/core/utils/constants";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import * as Schema from "effect/Schema";

export namespace Auth {
  export class TenantSlugValidatorMiddleware extends HttpApiMiddleware.Service<
    TenantSlugValidatorMiddleware,
    { provides: TenantSlug }
  >()("@printdesk/web/bff/TenantSlugValidatorMiddleware", { error: HttpApiError.BadRequest }) {}

  export class Group extends HttpApiGroup.make("Auth")
    .add(
      HttpApiEndpoint.get("me", "/me", {
        success: ActorsContract.UserActor,
        error: [
          OauthContract.InvalidCookiesError,
          OauthContract.InvalidAccessTokenError,
          OauthContract.InvalidRefreshTokenError,
          OauthContract.VerifyError,
          ActorsContract.ForbiddenActorError,
        ],
      }),
    )
    .add(
      HttpApiEndpoint.get("login", "/login", {
        query: Schema.Struct({ redirectUri: Schema.URLFromString.pipe(Schema.optional) }).pipe(
          Schema.encodeKeys({ redirectUri: Constants.URL_PARAM_NAMES.REDIRECT_URI }),
        ),
        error: OauthContract.AuthorizeError,
      }).middleware(TenantSlugValidatorMiddleware),
    )
    .add(
      HttpApiEndpoint.get("oauthCallback", Constants.WEB_BFF_PATHS.oauthCallback, {
        query: Schema.Struct({
          code: Schema.NonEmptyString,
          redirectUri: Schema.URLFromString,
        }).pipe(Schema.encodeKeys({ redirectUri: Constants.URL_PARAM_NAMES.REDIRECT_URI })),
        error: [OauthContract.ExchangeError, OauthContract.InvalidAuthorizationCodeError],
      }),
    ) {}

  export class Api extends HttpApi.make("AuthApi").add(Group) {}
}

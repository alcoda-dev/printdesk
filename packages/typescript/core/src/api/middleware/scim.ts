// oxlint-disable effecttsgo/strict-effect-provide
import * as Cause from "effect/Cause";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as HttpApiSecurity from "effect/http-api/HttpApiSecurity";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as String from "effect/String";

import { ActorLayerMap, type Actor } from "../../actors";
import { Oauth } from "../../oauth";
import { OauthContract } from "../../oauth/contract";
import { Openauth } from "../../oauth/openauth";
import { ScimBulkIdMap } from "../../scim/bulk-id-map";
import { ScimContract } from "../../scim/contract";
import { ScimLocator } from "../../scim/locator";
import { Constants } from "../../utils/constants";

export class ScimAuthMiddleware extends HttpApiMiddleware.Service<
  ScimAuthMiddleware,
  { provides: Actor | Oauth.AccessToken }
>()("@printdesk/core/api/ScimAuthMiddleware", {
  security: {
    bearer: HttpApiSecurity.apiKey({
      in: "header",
      key: Constants.FORWARDED_AUTHORIZATION_HEADER_NAME,
    }),
  },
  error: ScimContract.V2UnauthorizedError.pipe(
    HttpApiSchema.asJson({ contentType: "application/scim+json" }),
  ),
}) {
  public static readonly make = Effect.gen({ self: this }, function* () {
    const actorLayerMap = yield* ActorLayerMap;
    const accessTokenLayerMap = yield* Oauth.AccessTokenLayerMap;
    const openauth = yield* Openauth;

    return this.of({
      bearer: Effect.fn(function* (httpEffect, opts) {
        const accessToken = yield* opts.credential.pipe(
          Redacted.value,
          Schema.decodeUnknownEffect(OauthContract.BearerToken),
          Effect.mapError(() => new ScimContract.V2UnauthorizedError()),
        );

        const { subject } = yield* openauth
          .verify(accessToken)
          .pipe(Effect.mapError(() => new ScimContract.V2UnauthorizedError()));

        return yield* httpEffect.pipe(
          Effect.provide(
            Layer.mergeAll(
              actorLayerMap.get(subject.properties.actor.wrap),
              accessTokenLayerMap.get(accessToken),
            ),
          ),
        );
      }),
    });
  });

  public static readonly layer = this.make.pipe(Layer.effect(this));
}

export class ScimBulkIdMapMiddleware extends HttpApiMiddleware.Service<
  ScimBulkIdMapMiddleware,
  { provides: ScimBulkIdMap }
>()("@printdesk/core/api/ScimBulkIdMapMiddleware") {
  public static readonly make = Effect.succeed(this.of(Effect.provide(ScimBulkIdMap.layer)));

  public static readonly layer = this.make.pipe(Layer.effect(this));
}

export class ScimLocatorMiddleware extends HttpApiMiddleware.Service<
  ScimLocatorMiddleware,
  { provides: ScimLocator }
>()("@printdesk/core/api/ScimLocatorMiddleware") {
  public static readonly make = ScimLocator.pipe(
    Effect.map((locator) => this.of(Effect.provideService(ScimLocator, locator))),
  );

  public static readonly layer = this.make.pipe(Layer.effect(this));
}

export class ScimErrorMiddleware extends HttpApiMiddleware.Service<ScimErrorMiddleware>()(
  "@printdesk/core/api/ScimErrorMiddleware",
  { error: ScimContract.V2InternalServerError },
) {
  public static readonly make = Crypto.Crypto.pipe(
    Effect.map((crypto) =>
      this.of((httpEffect) =>
        httpEffect.pipe(
          Effect.tapCauseIf(Cause.hasFails, Effect.logError),
          Effect.catchDefect((defect) =>
            crypto.randomUUIDv4().pipe(
              Effect.orDie,
              Effect.map(String.slice(0, 8)),
              Effect.map((id) => `err_${id}` as const),
              Effect.tap((ref) => Effect.logError(Cause.die(defect), ref)),
              Effect.flatMap((ref) =>
                Effect.fail(
                  new ScimContract.V2InternalServerError({
                    detail: `unexpected server error: ${ref}`,
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  public static readonly layer = this.make.pipe(Layer.effect(this));
}

export class ScimHttpApiSchemaErrorHandlerMiddleware extends HttpApiMiddleware.Service<ScimHttpApiSchemaErrorHandlerMiddleware>()(
  "@printdesk/core/api/ScimHttpApiSchemaErrorHandlerMiddleware",
  { error: [ScimContract.V2BadRequestError, ScimContract.V2InternalServerError] },
) {
  public static readonly layer = HttpApiMiddleware.layerSchemaErrorTransform(
    this,
    (httpApiSchemaError) =>
      Match.value(httpApiSchemaError).pipe(
        Match.when(
          { kind: Match.is("Payload") },
          () =>
            new ScimContract.V2BadRequestError({
              scimType: "invalidSyntax",
              detail: httpApiSchemaError.cause.message,
            }),
        ),
        Match.when(
          { kind: Match.is("Body") },
          () =>
            new ScimContract.V2InternalServerError({ detail: httpApiSchemaError.cause.message }),
        ),
        Match.orElse(
          () => new ScimContract.V2BadRequestError({ detail: httpApiSchemaError.cause.message }),
        ),
      ),
  );
}

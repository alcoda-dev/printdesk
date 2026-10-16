import { TenantsContract } from "@printdesk/core/tenants/contract";
import { TenantSlug } from "@printdesk/core/tenants/slug";
import { Constants } from "@printdesk/core/utils/constants";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Struct from "effect/Struct";

import { Auth } from "../contract/auth";
import { ViteResource } from "../lib/sst";

const FromHostname = Schema.TemplateLiteralParser([
  TenantsContract.Slug,
  ".",
  Schema.NonEmptyString,
]).pipe(
  Schema.decodeTo(TenantsContract.Slug, {
    decode: SchemaGetter.transformEffect(
      Effect.fn(function* ([slug, , apexDomain], options) {
        const resource = yield* ViteResource;

        if (apexDomain !== resource.ApexDomain.pipe(Redacted.value).value)
          return yield* Effect.fail(
            new SchemaIssue.InvalidValue({ message: "Invalid hostname" }, apexDomain, options),
          );

        return slug;
      }),
    ),
    encode: SchemaGetter.forbidden(() => "Not implemented"),
  }),
);

const FromQuery = Schema.Struct({ slug: TenantsContract.Slug }).pipe(
  Schema.encodeKeys({ slug: Constants.URL_PARAM_NAMES.TENANT_SLUG }),
  Schema.decodeTo(TenantsContract.Slug, {
    decode: SchemaGetter.transform(Struct.get("slug")),
    encode: SchemaGetter.forbidden(() => "Not implemented"),
  }),
);

export const tenantSlugValidatorMiddlewareLayer = Effect.gen(function* () {
  const resourceContext = yield* Effect.context<ViteResource>();

  const fromHostname = resourceContext.pipe(
    Context.get(ViteResource),
    Struct.get("Environment"),
    Redacted.value,
    (env) => !env.isDevMode && env.isProdStage,
  );

  return Auth.TenantSlugValidatorMiddleware.of(
    Effect.fn(
      function* (httpEffect) {
        if (fromHostname)
          return yield* httpEffect.pipe(
            Effect.provideServiceEffect(
              TenantSlug,
              HttpServerRequest.HttpServerRequest.pipe(
                Effect.map((request) => new URL(request.originalUrl).hostname),
                Effect.flatMap(Schema.decodeUnknownEffect(FromHostname)),
                Effect.provideContext(resourceContext),
              ),
            ),
          );

        return yield* httpEffect.pipe(
          Effect.provideServiceEffect(
            TenantSlug,
            FromQuery.pipe(HttpServerRequest.schemaSearchParams),
          ),
        );
      },
      (effect) => effect.pipe(Effect.catchTag("SchemaError", () => new HttpApiError.BadRequest())),
    ),
  );
}).pipe(Layer.effect(Auth.TenantSlugValidatorMiddleware), Layer.provide(ViteResource.layer));

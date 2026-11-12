import { issuer } from "@openauthjs/openauth";
import { Layout } from "@openauthjs/openauth/ui/base";
import { hostPort } from "@printdesk/core/aws/lambda/web-function";
import { IdentityProvidersContract } from "@printdesk/core/identity/contract";
import { IdentityProvidersRepository } from "@printdesk/core/identity/repository";
import { Oauth } from "@printdesk/core/oauth";
import { ClientCredentialsProvider } from "@printdesk/core/oauth/client-credentials";
import { OauthContract } from "@printdesk/core/oauth/contract";
import { EntraIdProvider } from "@printdesk/core/oauth/entra-id";
import { GoogleProvider } from "@printdesk/core/oauth/google";
import { SstResource } from "@printdesk/core/sst/resource";
import { TenantsContract } from "@printdesk/core/tenants/contract";
import { Constants } from "@printdesk/core/utils/constants";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpApiError from "effect/http-api/HttpAPiError";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Match from "effect/Match";
import * as Predicate from "effect/Predicate";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { providerMetadata } from "./lib/metadata";
import { runPromise } from "./lib/runtime";

export const { host, port } = await hostPort.pipe(runPromise);

export class IssuerError extends Schema.Error<IssuerError, { readonly brand: unique symbol }>(
  "IssuerError",
)({ cause: Schema.Defect() }) {}

export const { fetch } = issuer({
  subjects: OauthContract.subjects,
  providers: await SstResource.useSync(Struct.get("IdentityProviders")).pipe(
    Effect.map(Redacted.value),
    Effect.map((providers) => ({
      [Constants.CLIENT_CREDENTIALS]: ClientCredentialsProvider({
        verify: (...args) => Oauth.Oauth.verifyClient(...args).pipe(runPromise),
      }),
      [Constants.ENTRA_ID]: EntraIdProvider({
        tenant: "organizations",
        clientID: providers[Constants.ENTRA_ID].clientId,
        clientSecret: providers[Constants.ENTRA_ID].clientSecret,
        scopes: [...Constants.ENTRA_ID_OAUTH_SCOPES],
      }),
      [Constants.GOOGLE]: GoogleProvider(),
    })),
    runPromise,
  ),
  select: Effect.fn(
    function* (providers, request) {
      const kinds = yield* Effect.succeed(
        new URL(request.url).searchParams.get(Constants.URL_PARAM_NAMES.TENANT_SLUG),
      ).pipe(
        Effect.filterOrFail(Predicate.isNotNull),
        Effect.flatMap(Schema.decodeEffect(TenantsContract.Slug)),
        Effect.flatMap((tenantSlug) =>
          IdentityProvidersRepository.use((repository) => repository.findByTenantSlug(tenantSlug)),
        ),
        Effect.flatMap(
          Effect.filterMap((provider) =>
            Record.keys(providers).includes(provider.kind) && !provider.deletedAt
              ? Result.succeed(provider.kind)
              : Result.failVoid,
          ),
        ),
        Effect.catchTag(["NoSuchElementError", "SchemaError"], () => new HttpApiError.BadRequest()),
      );

      if (kinds.length === 0) return yield* new HttpApiError.NotFound();
      // oxlint-disable-next-line typescript/no-non-null-assertion
      if (kinds.length === 1) return HttpServerResponse.redirect(`/${kinds[0]!}/authorize`);

      const jsx = (
        <Layout>
          <div data-component="form">
            {Array.map(kinds, (kind) => {
              const { name, icon } = providerMetadata[kind];

              return (
                <a href={`/${kind}/authorize`} data-component="button" data-color="ghost">
                  <i data-slot="icon">{icon}</i>
                  {`Continue with ${name}`}
                </a>
              );
            })}
          </div>
        </Layout>
      );

      return HttpServerResponse.empty().pipe(
        // oxlint-disable-next-line typescript/no-base-to-string
        HttpServerResponse.setBody(HttpBody.raw(jsx.toString(), { contentType: "text/html" })),
      );
    },
    Effect.map(HttpServerResponse.toWeb),
    runPromise,
  ),
  success: function (response, result) {
    const subject = (
      ...[properties, opts]: Parameters<typeof response.subject> extends [string, ...infer TArgs]
        ? TArgs
        : never
    ) =>
      Effect.tryPromise({
        try: () => response.subject(properties._tag, properties, opts),
        catch: (cause) => new IssuerError({ cause }),
      });

    return Match.value(result).pipe(
      Match.when({ provider: Match.is(Constants.CLIENT_CREDENTIALS) }, (client) =>
        subject(new OauthContract.ClientSubject(client)),
      ),
      Match.when({ provider: Match.is(Constants.ENTRA_ID) }, (entraId) =>
        Effect.succeed(entraId.tokenset.id).pipe(
          Effect.filterOrElse(Predicate.isNotUndefined, () =>
            Effect.die(new globalThis.Error("missing id_token")),
          ),
          Effect.flatMap(Schema.decodeUnknownEffect(IdentityProvidersContract.EntraIdIdToken)),
          Effect.flatMap(Oauth.Oauth.verifyUser),
          Effect.flatMap(subject),
        ),
      ),
      Match.when({ provider: Match.is(Constants.GOOGLE) }, (google) =>
        Effect.fail(new IdentityProvidersContract.NotImplementedError({ kind: google.provider })),
      ),
      Match.exhaustive,
      runPromise,
    );
  },
}).onError((e, c) =>
  "getResponse" in e
    ? e.getResponse()
    : c.json({ error: "server_error", error_description: e.message }, 500),
);

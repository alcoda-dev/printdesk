import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as Struct from "effect/Struct";

import { Oauth } from ".";
import { ClientsContract } from "../clients/contract";
import { ClientsRepository } from "../clients/repository";
import { Hmac } from "../crypto/hmac";
import { IdentityProvidersContract } from "../identity/contract";
import { IdentityProvidersRepository } from "../identity/repository";
import { TenantsContract } from "../tenants/contract";
import { UsersContract } from "../users/contract";
import { OauthContract } from "./contract";

import type {
  ClientCredentialsProviderConfig,
  ClientCredentialsProviderVerifyResult,
} from "./client-credentials";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const clientsRepository = yield* ClientsRepository;
  const hmac = yield* Hmac;
  const identityProvidersRepository = yield* IdentityProvidersRepository;

  const verifyClient = Effect.fn("Oauth.verifyClient")(function* (
    ...[credentials, requestedScopes]: Parameters<ClientCredentialsProviderConfig["verify"]>
  ) {
    const client = yield* clientsRepository.findWithTenantById(credentials.id).pipe(
      Effect.filterOrFail(
        ({ client, tenant }) => client.deletedAt === null && tenant.deletedAt === null,
      ),
      Effect.catchTag(
        "NoSuchElementError",
        () =>
          new OauthContract.InvalidClientError({
            id: credentials.id,
            reason: new ClientsContract.NotFoundError({ id: credentials.id }),
          }),
      ),
      Effect.filterOrFail(
        ({ client, tenant }) =>
          client.role === "bootstrap" ? tenant.status === "setup" : tenant.status === "active",
        ({ tenant }) =>
          new OauthContract.AccessDeniedError({
            reason: new TenantsContract.InvalidStatusError({
              id: tenant.id,
              status: tenant.status,
            }),
          }),
      ),
      Effect.map(Struct.get("client")),
      Effect.filterOrFail(
        (client) => client.status === "active",
        (client) =>
          new OauthContract.AccessDeniedError({
            reason: new ClientsContract.InvalidStatusError({
              id: client.id,
              status: client.status,
            }),
          }),
      ),
    );

    yield* hmac
      .verify(credentials.secret, client.secretHash)
      .pipe(
        Effect.catchTag(
          "InvalidSecretError",
          (reason) => new OauthContract.InvalidClientError({ id: client.id, reason }),
        ),
      );

    if (requestedScopes && requestedScopes.length > 0) {
      const invalidScopes = Array.filter(
        requestedScopes,
        (scope) => !client.scopes.includes(scope),
      );

      if (invalidScopes.length > 0)
        return yield* new OauthContract.InvalidScopeError({ scopes: invalidScopes });

      return Struct.assign(Struct.pick(client, ["role", "tenantId", "identityProviderId"]), {
        scopes: requestedScopes,
      }) satisfies ClientCredentialsProviderVerifyResult;
    }

    return Struct.pick(client, [
      "role",
      "scopes",
      "tenantId",
      "identityProviderId",
    ]) satisfies ClientCredentialsProviderVerifyResult;
  });

  const verifyUser = Effect.fn("Oauth.verifyUser")((idToken: IdentityProvidersContract.IdToken) =>
    identityProvidersRepository
      .findWithTenantAndUserByExternalIds(idToken.kind, idToken.externalId, idToken.userExternalId)
      .pipe(
        Effect.filterOrFail(
          ({ identityProvider, tenant }) =>
            identityProvider.deletedAt === null && tenant.deletedAt === null,
        ),
        Effect.catchTag(
          "NoSuchElementError",
          () =>
            new OauthContract.AccessDeniedError({
              reason: new IdentityProvidersContract.NotFoundError({
                kind: idToken.kind,
                externalId: idToken.externalId,
              }),
            }),
        ),
        Effect.filterOrFail(
          ({ tenant }) => tenant.status === "active",
          ({ tenant }) =>
            new OauthContract.AccessDeniedError({
              reason: new TenantsContract.InvalidStatusError({
                id: tenant.id,
                status: tenant.status,
              }),
            }),
        ),
        Effect.map(Struct.get("user")),
        Effect.filterOrFail(
          Predicate.isNotNull,
          () =>
            new OauthContract.AccessDeniedError({
              reason: new UsersContract.NotFoundError({
                id: { _tag: "external", value: idToken.userExternalId },
              }),
            }),
        ),
        Effect.filterOrFail(
          (user) => user.deletedAt === null,
          (user) =>
            new OauthContract.AccessDeniedError({
              reason: new UsersContract.NotFoundError({ id: { _tag: "internal", value: user.id } }),
            }),
        ),
        Effect.filterOrFail(
          (user) => user.status === "active",
          (user) =>
            new OauthContract.AccessDeniedError({
              reason: new UsersContract.InvalidStatusError({ id: user.id, status: user.status }),
            }),
        ),
        Effect.map(
          (user) => new OauthContract.UserSubject(Struct.pick(user, ["id", "tenantId", "role"])),
        ),
      ),
  );

  return {
    verifyClient,
    verifyUser,
  } as const;
});

export const layer = makeService.pipe(Layer.effect(Oauth.Oauth));

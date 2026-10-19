// oxlint-disable effecttsgo/strict-effect-provide
import { DynamoDBDocument } from "@effect-aws/dynamodb";
import { ActorLayerMap } from "@printdesk/core/actors";
import { ActorsContract } from "@printdesk/core/actors/contract";
import { AttributesContract } from "@printdesk/core/attributes/contract";
import { AppconfigCredentialIdentityProviderLayerMap } from "@printdesk/core/aws/credential-identity/appconfig";
import { AppsyncPublisherCredentialIdentityProviderLayerMap } from "@printdesk/core/aws/credential-identity/appsync";
import { BootstrapContract } from "@printdesk/core/bootstrap/contract";
import { ClientsRepository } from "@printdesk/core/clients/repository";
import { Config } from "@printdesk/core/config";
import { Crypto } from "@printdesk/core/crypto";
import { RealtimeEventHandlers } from "@printdesk/core/handlers/realtime-events";
import { IdentityProvidersRepository } from "@printdesk/core/identity/repository";
import { InfraContract } from "@printdesk/core/infra/contract";
import { LicensesManager } from "@printdesk/core/licenses/manager";
import { OauthContract } from "@printdesk/core/oauth/contract";
import { PapercutMfContract } from "@printdesk/core/papercut-mf/contract";
import { PapercutMfSynchronizer } from "@printdesk/core/papercut-mf/synchronizer";
import { Realtime } from "@printdesk/core/realtime";
import { ReplicacheNotifier } from "@printdesk/core/replicache/notifier";
import { SstResource } from "@printdesk/core/sst/resource";
import { TenantsContract } from "@printdesk/core/tenants/contract";
import { TenantsRepository } from "@printdesk/core/tenants/repositories";
import { tenantsTable } from "@printdesk/core/tenants/sql";
import { CallbackId, generateEntityId, TenantId } from "@printdesk/core/utils";
import { Constants } from "@printdesk/core/utils/constants";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SqlError from "effect/sql/SqlError";
import * as Struct from "effect/Struct";

import { papercutSyncClientAccessTokenLayer } from "../lib/auth";
import { runtime } from "./runtime";

import type { DurableContext } from "@aws/durable-execution-sdk-js";

// TODO: Rollbacks

export async function handler(
  event: typeof BootstrapContract.Payload.Encoded,
  context: DurableContext,
) {
  // oxlint-disable-next-line effecttsgo/schema-sync
  const payload = Schema.decodeSync(BootstrapContract.Payload)(event);

  await context.step("set-license-expiration", () =>
    LicensesManager.use((manager) =>
      manager
        .verifyKeyPairForUpdate(payload.licenseKeyPair)
        .pipe(Effect.map(Struct.get("id")), Effect.flatMap(manager.setExpiration), Effect.asVoid),
    ).pipe(runtime.runPromise),
  );

  const tenantId = await context.step("create-tenant", () =>
    generateEntityId.pipe(
      Effect.map((id) => TenantId.make(id)),
      Effect.tap((tenantId) =>
        TenantsRepository.use((repository) =>
          repository.create({
            ...payload.tenant,
            id: tenantId,
            tenantId,
            licenseId: payload.licenseKeyPair.id,
          }),
        ),
      ),
      Effect.catchReason("SqlError", "UniqueViolation", (reason) =>
        Effect.fail(
          reason.constraint === tenantsTable.slug.name
            ? new TenantsContract.TenantSlugConflictError({ slug: payload.tenant.slug })
            : new SqlError.SqlError({ reason }),
        ),
      ),
      runtime.runPromise,
    ),
  );

  const actor = new ActorsContract.TenantActor({ id: tenantId }).wrap;

  await context.step("create-identity-providers", () =>
    IdentityProvidersRepository.use((repository) =>
      repository.createMany(Array.map(payload.identityProviders, Struct.assign({ tenantId }))),
    ).pipe(Effect.asVoid, runtime.runPromise),
  );

  const { papercutMfApiTunnelId } = await context.waitForCallback<InfraContract.OutputItem>(
    "wait-for-deployment",
    Effect.fn(
      function* (callbackId) {
        const deploymentId = yield* generateEntityId;

        const TableName = yield* SstResource.useSync(Struct.get("Dynamo")).pipe(
          Effect.map(Redacted.value),
          Effect.map(Struct.get("name")),
        );

        const papercutMfConfig = yield* Effect.gen(function* () {
          if (Option.isSome(payload.papercutMf))
            return yield* PapercutMfContract.EnabledConfig.makeEffect(
              payload.papercutMf.value.config,
            );

          return yield* PapercutMfContract.DisabledConfig.makeEffect();
        });

        const Item = yield* InfraContract.InputItem.makeEffect({
          [Constants.DYNAMO_KEYS.PK]: tenantId,
          [Constants.DYNAMO_KEYS.GSI1_PK]: new AttributesContract.TenantDeploymentId({
            tenantId,
            deploymentId,
          }),
          callbackId: Option.some(CallbackId.make(callbackId)),
          papercutMfConfig,
        });

        yield* DynamoDBDocument.use((ddb) => ddb.put({ TableName, Item }));
      },
      (effect) => effect.pipe(runtime.runPromise),
    ),
    {
      heartbeatTimeout: { minutes: 2 },
      serdes: {
        deserialize: async (data) =>
          Option.fromUndefinedOr(data).pipe(
            // oxlint-disable-next-line effecttsgo/schema-sync
            Option.map(Schema.decodeSync(InfraContract.OutputItem.pipe(Schema.fromJsonString))),
            Option.getOrUndefined,
          ),
      },
    },
  );

  await context.step(
    "configure-clients",
    Effect.fn(
      function* () {
        const clientsRepository = yield* ClientsRepository;
        const config = yield* Config;
        const crypto = yield* Crypto;

        const invoicesProcessorClientSecret = yield* crypto.generateToken();
        const invoicesProcessorClientSecretHash = yield* invoicesProcessorClientSecret.pipe(
          crypto.hashSecret,
        );
        yield* clientsRepository
          .create({
            name: "Invoices Processor Client",
            secretHash: invoicesProcessorClientSecretHash,
            role: "invoicesProcessor",
            scopes: ["invoices-processor"],
            tenantId,
          })
          .pipe(
            Effect.andThen(({ id }) =>
              config.setInvoicesProcessorClientCredentials(
                new OauthContract.ClientCredentials({ id, secret: invoicesProcessorClientSecret }),
                "fast",
              ),
            ),
          );

        const scimClientSecret = yield* crypto.generateToken();
        const scimClientSecretHash = yield* scimClientSecret.pipe(crypto.hashSecret);
        yield* clientsRepository.create({
          name: "SCIM Client",
          secretHash: scimClientSecretHash,
          role: "scim",
          scopes: ["scim"],
          tenantId,
        });

        if (Option.isSome(payload.papercutMf)) {
          const papercutMfSyncClientSecret = yield* crypto.generateToken();
          const papercutMfSyncClientSecretHash = yield* papercutMfSyncClientSecret.pipe(
            crypto.hashSecret,
          );
          yield* clientsRepository
            .create({
              name: "Papercut MF Sync Client",
              secretHash: papercutMfSyncClientSecretHash,
              role: "papercutMfSync",
              scopes: ["papercut-mf-sync"],
              tenantId,
            })
            .pipe(
              Effect.andThen(({ id }) =>
                config.setPapercutMfSyncClientCredentials(
                  new OauthContract.ClientCredentials({ id, secret: papercutMfSyncClientSecret }),
                  "fast",
                ),
              ),
            );

          yield* config.setPapercutMfApiAuthToken(payload.papercutMf.value.apiAuthToken);
        }
      },
      (effect) =>
        effect.pipe(
          Effect.provide(
            Layer.mergeAll(
              ActorLayerMap.get(actor),
              AppconfigCredentialIdentityProviderLayerMap.get(actor),
            ),
          ),
          runtime.runPromise,
        ),
    ),
  );

  // await context.waitForCallback("wait-for-bootstrap-client", (callbackId) =>
  //   CallbackId.makeEffect(callbackId).pipe(
  //     Effect.map((callbackId) =>
  //       ClientsRepository.use((repository) =>
  //         repository.updateById(payload.clientId, { callbackId }, tenantId),
  //       ),
  //     ),
  //     Effect.asVoid,
  //     runtime.runPromise,
  //   ),
  // );

  if (Option.isSome(papercutMfApiTunnelId))
    await context.step("publish-papercut-mf-api-tunnel", () =>
      RealtimeEventHandlers.registry.resolve("/papercut/mf/api-tunnel").pipe(
        Effect.map((handler) => handler.make({ id: papercutMfApiTunnelId.value })),
        Effect.flatMap((handler) => Realtime.use((realtime) => realtime.publish(handler))),
        Effect.provide(
          Layer.mergeAll(
            ActorLayerMap.get(actor),
            AppsyncPublisherCredentialIdentityProviderLayerMap.get(actor),
          ),
        ),
        runtime.runPromise,
      ),
    );

  if (Option.isSome(payload.papercutMf)) {
    await context.waitForCallback(
      "wait-for-papercut-mf-api",
      Effect.fn(
        function* (callbackId) {
          const TableName = yield* SstResource.useSync(Struct.get("Dynamo")).pipe(
            Effect.map(Redacted.value),
            Effect.map(Struct.get("name")),
          );

          const Item = yield* PapercutMfContract.ApiCallback.makeEffect({
            [Constants.DYNAMO_KEYS.PK]: tenantId,
            id: CallbackId.make(callbackId),
          }).pipe(Effect.flatMap(Schema.encodeEffect(PapercutMfContract.ApiCallback)));

          yield* DynamoDBDocument.use((ddb) => ddb.put({ TableName, Item }));
        },
        (effect) => effect.pipe(runtime.runPromise),
      ),
    );

    await context.step("papercut-mf-sync", () =>
      PapercutMfSynchronizer.use(Struct.get("syncAll")).pipe(
        Effect.map(Array.flatten),
        Effect.filterOrElse(Array.isArrayEmpty, () => ReplicacheNotifier.use(Struct.get("poke"))),
        Effect.asVoid,
        Effect.provide(
          Layer.mergeAll(
            AppsyncPublisherCredentialIdentityProviderLayerMap.get(actor),
            papercutSyncClientAccessTokenLayer,
          ).pipe(Layer.provideMerge(ActorLayerMap.get(actor))),
        ),
        runtime.runPromise,
      ),
    );
  }
}

import { AccessControl } from "@printdesk/core/access-control";
import { Api } from "@printdesk/core/api";
import { PapercutMfApi } from "@printdesk/core/papercut-mf/api";
import { PapercutMfContract } from "@printdesk/core/papercut-mf/contract";
import { PapercutMfSynchronizer } from "@printdesk/core/papercut-mf/synchronizer";
import { ReplicacheNotifier } from "@printdesk/core/replicache/notifier";
import { layer as replicacheNotifierLayer } from "@printdesk/core/replicache/notifier/layer";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";

import { databaseLayer } from "../lib/database";
import { papercutMfApiLayer, papercutMfSynchronizerLayer } from "../lib/papercut";
import { realtimeLayer } from "../lib/realtime";
import { authMiddlewareLayer } from "../middleware/auth";
import { appsyncPublisherCredentialIdentityProviderMiddlewareLayer } from "../middleware/aws";
import { errorMiddlewareLayer } from "../middleware/error";

export const basePapercutMfGroupLayer = HttpApiBuilder.group(
  Api,
  "PapercutMf",
  Effect.fn(function* (handlers) {
    const api = yield* PapercutMfApi;

    return handlers
      .handle(
        "health",
        Effect.fn("Api.PapercutMf.health")(() =>
          api.getTotalUsers.pipe(
            Effect.map(() => true),
            Effect.catchTags({
              HttpClientError: () => Effect.succeed(false),
              FaultError: () => Effect.succeed(false),
            }),
            Effect.map((healthy) => new PapercutMfContract.HealthSuccess({ healthy })),
            AccessControl.enforce(AccessControl.permissionPolicy("papercut_mf_api_gateway:read")),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "taskStatus",
        Effect.fn("Api.PapercutMf.taskStatus")(() =>
          api.getTaskStatus.pipe(
            Effect.map(
              (taskStatus) =>
                new PapercutMfContract.TaskStatusSuccess({
                  completed: taskStatus[0].value.boolean,
                  message: taskStatus[1].value,
                }),
            ),
            AccessControl.enforce(AccessControl.permissionPolicy("papercut_mf_api_gateway:read")),
            orDieWhenUnrespondable,
          ),
        ),
      );
  }),
);

export const papercutMfGroupLayer = basePapercutMfGroupLayer.pipe(
  Layer.provide([authMiddlewareLayer, errorMiddlewareLayer, papercutMfApiLayer]),
);

export const basePapercutMfSyncGroupLayer = HttpApiBuilder.group(
  Api,
  "PapercutMfSync",
  Effect.fn(function* (handlers) {
    const syncer = yield* PapercutMfSynchronizer;
    const replicacheNotifier = yield* ReplicacheNotifier;

    return handlers
      .handle(
        "all",
        Effect.fn("Api.PapercutMfSync.all")(() =>
          syncer.syncAll.pipe(
            Effect.map(Array.flatten),
            Effect.filterOrElse(Array.isArrayEmpty, () => replicacheNotifier.poke),
            Effect.asVoid,
            AccessControl.enforce(AccessControl.permissionPolicy("papercut_mf_sync:create")),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "sharedAccounts",
        Effect.fn("Api.PapercutMfSync.sharedAccounts")(() =>
          syncer.syncSharedAccounts.pipe(
            Effect.filterOrElse(Array.isArrayEmpty, () => replicacheNotifier.poke),
            Effect.asVoid,
            AccessControl.enforce(AccessControl.permissionPolicy("papercut_mf_sync:create")),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "sharedAccountCustomerAccess",
        Effect.fn("Api.PapercutMfSync.sharedAccountCustomerAccess")(() =>
          syncer.syncSharedAccountCustomerAccess.pipe(
            Effect.filterOrElse(Array.isArrayEmpty, () => replicacheNotifier.poke),
            Effect.asVoid,
            AccessControl.enforce(AccessControl.permissionPolicy("papercut_mf_sync:create")),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "sharedAccountGroupCustomerAccess",
        Effect.fn("Api.PapercutMfSync.sharedAccountGroupCustomerAccess")(() =>
          syncer.syncSharedAccountCustomerGroupAccess.pipe(
            Effect.filterOrElse(Array.isArrayEmpty, () => replicacheNotifier.poke),
            Effect.asVoid,
            AccessControl.enforce(AccessControl.permissionPolicy("papercut_mf_sync:create")),
            orDieWhenUnrespondable,
          ),
        ),
      );
  }),
);

export const papercutMfSyncGroupLayer = basePapercutMfSyncGroupLayer.pipe(
  Layer.provide([
    authMiddlewareLayer,
    appsyncPublisherCredentialIdentityProviderMiddlewareLayer,
    errorMiddlewareLayer,
    papercutMfSynchronizerLayer,
    replicacheNotifierLayer,
  ]),
  Layer.provide([databaseLayer, realtimeLayer]),
);

export const papercutMfGroupsLayer = Layer.mergeAll(papercutMfGroupLayer, papercutMfSyncGroupLayer);

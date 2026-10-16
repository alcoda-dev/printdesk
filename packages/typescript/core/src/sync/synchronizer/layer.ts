import * as Cause from "effect/Cause";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Number from "effect/Number";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as Struct from "effect/Struct";

import { Synchronizer } from ".";
import { Sync } from "..";
import { AnnouncementsSync } from "../../announcements/sync";
import { CommentsSync } from "../../comments/sync";
import { DeliveryOptionsSync } from "../../delivery-options/sync";
import { GroupMembershipsSync } from "../../groups/memberships/sync";
import { GroupsSync } from "../../groups/sync";
import { InvoicesSync } from "../../invoices/sync";
import { OrderObjectMetadataSync } from "../../orders/objects/sync";
import { OrdersSync } from "../../orders/sync";
import { ProductsSync } from "../../products/sync";
import { ReplicachePullerContract } from "../../replicache/contracts";
import {
  ReplicacheClientViewEntriesModel,
  type ReplicacheClientViewsModel,
} from "../../replicache/models";
import { RoomsSync } from "../../rooms/sync";
import { SharedAccountCustomerAccessSync } from "../../shared-accounts/customer-access/sync";
import { SharedAccountGroupCustomerAccessSync } from "../../shared-accounts/group-customer-access/sync";
import { SharedAccountManagerAccessSync } from "../../shared-accounts/manager-access/sync";
import { SharedAccountsSync } from "../../shared-accounts/sync";
import { TenantsSync } from "../../tenants/sync";
import { UsersSync } from "../../users/sync";
import { Constants } from "../../utils/constants";
import { RoomWorkflowsSync } from "../../workflows/room/sync";
import { SharedAccountWorkflowsSync } from "../../workflows/shared-account/sync";
import { WorkflowStatusesSync } from "../../workflows/status/sync";

import type { ActorsContract } from "../../actors/contract";
import type { Version } from "../../utils";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const announcements = yield* AnnouncementsSync.useSync(Struct.get("streamer"));
  const comments = yield* CommentsSync.useSync(Struct.get("streamer"));
  const deliveryOptions = yield* DeliveryOptionsSync.useSync(Struct.get("streamer"));
  const groups = yield* GroupsSync.useSync(Struct.get("streamer"));
  const groupMemberships = yield* GroupMembershipsSync.useSync(Struct.get("streamer"));
  const invoices = yield* InvoicesSync.useSync(Struct.get("streamer"));
  const orders = yield* OrdersSync.useSync(Struct.get("streamer"));
  const orderObjectMetadata = yield* OrderObjectMetadataSync.useSync(Struct.get("streamer"));
  const products = yield* ProductsSync.useSync(Struct.get("streamer"));
  const rooms = yield* RoomsSync.useSync(Struct.get("streamer"));
  const sharedAccounts = yield* SharedAccountsSync.useSync(Struct.get("streamer"));
  const sharedAccountCustomerAccess = yield* SharedAccountCustomerAccessSync.useSync(
    Struct.get("streamer"),
  );
  const sharedAccountGroupCustomerAccess = yield* SharedAccountGroupCustomerAccessSync.useSync(
    Struct.get("streamer"),
  );
  const sharedAccountManagerAccess = yield* SharedAccountManagerAccessSync.useSync(
    Struct.get("streamer"),
  );
  const tenants = yield* TenantsSync.useSync(Struct.get("streamer"));
  const users = yield* UsersSync.useSync(Struct.get("streamer"));
  const roomWorkflows = yield* RoomWorkflowsSync.useSync(Struct.get("streamer"));
  const sharedAccountWorkflows = yield* SharedAccountWorkflowsSync.useSync(Struct.get("streamer"));
  const workflowStatuses = yield* WorkflowStatusesSync.useSync(Struct.get("streamer"));

  const streamer = new Sync.Streamer()
    .entity(announcements)
    .entity(comments)
    .entity(deliveryOptions)
    .entity(groups)
    .entity(groupMemberships)
    .entity(invoices)
    .entity(orders)
    .entity(orderObjectMetadata)
    .entity(products)
    .entity(rooms)
    .entity(sharedAccounts)
    .entity(sharedAccountCustomerAccess)
    .entity(sharedAccountGroupCustomerAccess)
    .entity(sharedAccountManagerAccess)
    .entity(tenants)
    .entity(users)
    .entity(roomWorkflows)
    .entity(sharedAccountWorkflows)
    .entity(workflowStatuses)
    .final();

  const sync = Effect.fn("Synchronizer.sync")(function* (
    clientView: typeof ReplicacheClientViewsModel.Table.Model.Type,
    userId: ActorsContract.UserActor["id"],
    limitOffset: number,
    clientViewVersion: { next: Version; max: Version },
  ) {
    const stream: Stream.Stream<
      | Struct.Assign<Stream.Success<ReturnType<typeof streamer.streamUpdates>>, { _tag: "update" }>
      | Struct.Assign<
          Stream.Success<ReturnType<typeof streamer.streamDeletes>>,
          { _tag: "delete" }
        >,
      Stream.Error<ReturnType<typeof streamer.streamUpdates | typeof streamer.streamDeletes>>,
      Stream.Services<ReturnType<typeof streamer.streamUpdates | typeof streamer.streamDeletes>>
    > = Stream.mergeAll(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      [
        streamer
          .streamUpdates(clientView, userId)
          .pipe(Stream.map((update) => Object.assign(update, { _tag: "update" }))),
        streamer
          .streamDeletes(clientView, userId)
          .pipe(Stream.map((delete_) => Object.assign(delete_, { _tag: "delete" }))),
        // oxlint-disable-next-line typescript/no-explicit-any
      ] as any,
      { concurrency: "unbounded" },
    );

    const { clientViewEntries, patch, limit, excludes } = yield* stream.pipe(
      Stream.share({ capacity: 128, strategy: "suspend" }),
      Effect.flatMap((stream) =>
        Effect.all(
          {
            clientViewEntries: stream.pipe(
              Stream.map((diff) =>
                Match.valueTags(diff, {
                  update: ({ entity, data }) =>
                    ReplicacheClientViewEntriesModel.Table.Model.make({
                      clientGroupId: clientView.clientGroupId,
                      clientViewVersion: clientViewVersion.next,
                      entity,
                      entityId: data.id,
                      entityVersion: data.version,
                      tenantId: clientView.tenantId,
                    }),
                  delete: ({ entity, id: entityId }) =>
                    ReplicacheClientViewEntriesModel.Table.Model.make({
                      clientGroupId: clientView.clientGroupId,
                      clientViewVersion: clientViewVersion.next,
                      entity,
                      entityId,
                      tenantId: clientView.tenantId,
                    }),
                }),
              ),
              Stream.runCollect,
              Effect.map(Chunk.fromIterable),
            ),
            patch: stream.pipe(
              Stream.map((diff) =>
                Match.valueTags(diff, {
                  update: ({ entity, data }) =>
                    ReplicachePullerContract.makePutTableOperation(entity, data),
                  delete: ({ entity, id }) =>
                    ReplicachePullerContract.makeDeleteTableOperation(entity, id),
                }),
              ),
              Stream.runCollect,
              Effect.map(Chunk.fromIterable),
            ),
            limit: stream.pipe(
              Stream.runFold(
                () => Constants.DB_TRANSACTION_ROW_MODIFICATION_LIMIT - Math.abs(limitOffset),
                Number.decrement,
              ),
            ),
            excludes: stream.pipe(
              Stream.map((diff) =>
                Match.valueTags(diff, {
                  update: ({ entity, data }) => ({ entity, id: data.id }),
                  delete: ({ entity, id }) => ({ entity, id }),
                }),
              ),
              Stream.runCollect,
              Effect.map(Chunk.fromIterable),
            ),
          },
          { concurrency: "unbounded" },
        ),
      ),
      Effect.scoped,
    );

    if (limit < 0) return yield* new Cause.ExceededCapacityError();

    // Fast-forward
    if (clientView.version < clientViewVersion.max)
      return yield* streamer.streamFastForward(clientView, excludes, userId).pipe(
        Stream.runFold(
          () => patch,
          (patch, { entity, data }) =>
            patch.pipe(Chunk.append(ReplicachePullerContract.makePutTableOperation(entity, data))),
        ),
        Effect.map((patch) => ({ clientViewEntries, patch })),
      );

    return yield* streamer.streamCreates(clientView, userId).pipe(
      Stream.share({ capacity: 128, strategy: "suspend" }),
      Effect.flatMap((stream) =>
        Effect.all(
          {
            result: stream.pipe(
              Stream.take(limit),
              Stream.runFold(
                () => ({ clientViewEntries, patch }),
                (result, { entity, data }) => ({
                  clientViewEntries: result.clientViewEntries.pipe(
                    Chunk.append(
                      ReplicacheClientViewEntriesModel.Table.Model.make({
                        clientGroupId: clientView.clientGroupId,
                        clientViewVersion: clientViewVersion.next,
                        entity,
                        entityId: data.id,
                        entityVersion: data.version,
                        tenantId: clientView.tenantId,
                      }),
                    ),
                  ),
                  patch: result.patch.pipe(
                    Chunk.append(ReplicachePullerContract.makePutTableOperation(entity, data)),
                  ),
                }),
              ),
            ),
            isPartial: stream.pipe(Stream.drop(limit), Stream.runHead, Effect.map(Option.isSome)),
          },
          { concurrency: "unbounded" },
        ),
      ),
      Effect.scoped,
      Effect.map(({ result, isPartial }) => ({
        ...result,
        patch: result.patch.pipe(
          Chunk.append(
            new ReplicachePullerContract.PutSyncStateOperation({
              value: isPartial ? "PARTIAL" : "COMPLETE",
            }),
          ),
        ),
      })),
    );
  });

  return { sync } as const;
});

export const layer = makeService.pipe(Layer.effect(Synchronizer));

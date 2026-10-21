import { and, eq, getColumns, isNull, ne } from "drizzle-orm";
import {
  boolean,
  check,
  snakeCase,
  smallint,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { activePublishedRoomsView } from "../rooms/sql";
import {
  activeSharedAccountCustomerAccessView,
  activeSharedAccountManagerAccessView,
} from "../shared-accounts/sql";
import { Tables } from "../tables";
import { Constants } from "../utils/constants";
import { WorkflowStatusesContract } from "./contracts";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";
import type { EntityId } from "../utils";

export const roomWorkflows = new Tables.Sync(
  "room_workflows",
  { roomId: Columns.entityId().notNull() },
  (table) => [uniqueIndex().on(table.roomId, table.tenantId)],
);
export const roomWorkflowsTable = roomWorkflows.table;
export type RoomWorkflowsTable = typeof roomWorkflowsTable;
export type RoomWorkflow = InferSelectModel<RoomWorkflowsTable>;

export const activeRoomWorkflowsView = snakeCase
  .view(`active_${roomWorkflows.name}`)
  .as((qb) => qb.select().from(roomWorkflowsTable).where(isNull(roomWorkflowsTable.deletedAt)));
export type ActiveRoomWorkflowsView = typeof activeRoomWorkflowsView;
export type ActiveRoomWorkflow = InferViewSelectModel<ActiveRoomWorkflowsView>;

export const activePublishedRoomRoomWorkflowsView = snakeCase
  .view(`active_published_room_${roomWorkflows.name}`)
  .as((qb) =>
    qb
      .select(getColumns(activeRoomWorkflowsView))
      .from(activeRoomWorkflowsView)
      .innerJoin(
        activePublishedRoomsView,
        and(
          eq(activeRoomWorkflowsView.roomId, activePublishedRoomsView.id),
          eq(activeRoomWorkflowsView.tenantId, activePublishedRoomsView.tenantId),
        ),
      ),
  );
export type ActivePublishedRoomRoomWorkflowsView = typeof activePublishedRoomRoomWorkflowsView;
export type ActivePublishedRoomRoomWorkflow =
  InferViewSelectModel<ActivePublishedRoomRoomWorkflowsView>;

export const sharedAccountWorkflows = new Tables.Sync(
  "shared_account_workflows",
  { sharedAccountId: Columns.entityId().notNull() },
  (table) => [uniqueIndex().on(table.sharedAccountId, table.tenantId)],
);
export const sharedAccountWorkflowsTable = sharedAccountWorkflows.table;
export type SharedAccountWorkflowsTable = typeof sharedAccountWorkflowsTable;
export type SharedAccountWorkflow = InferSelectModel<SharedAccountWorkflowsTable>;

export const activeSharedAccountWorkflowsView = snakeCase
  .view(`active_${sharedAccountWorkflows.name}`)
  .as((qb) =>
    qb
      .select()
      .from(sharedAccountWorkflowsTable)
      .where(isNull(sharedAccountWorkflowsTable.deletedAt)),
  );
export type ActiveSharedAccountWorkflowsView = typeof activeSharedAccountWorkflowsView;
export type ActiveSharedAccountWorkflow = InferViewSelectModel<ActiveSharedAccountWorkflowsView>;

export const activeCustomerAuthorizedSharedAccountWorkflowsView = snakeCase
  .view(`active_customer_authorized_${sharedAccountWorkflows.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeSharedAccountWorkflowsView),
        customerId: activeSharedAccountCustomerAccessView.customerId,
      })
      .from(activeSharedAccountWorkflowsView)
      .innerJoin(
        activeSharedAccountCustomerAccessView,
        and(
          eq(
            activeSharedAccountWorkflowsView.sharedAccountId,
            activeSharedAccountCustomerAccessView.sharedAccountId,
          ),
          eq(
            activeSharedAccountWorkflowsView.tenantId,
            activeSharedAccountCustomerAccessView.tenantId,
          ),
        ),
      ),
  );
export type ActiveCustomerAuthorizedSharedAccountWorkflowsView =
  typeof activeCustomerAuthorizedSharedAccountWorkflowsView;
export type ActiveCustomerAuthorizedSharedAccountWorkflow =
  InferViewSelectModel<ActiveCustomerAuthorizedSharedAccountWorkflowsView>;

export const activeManagerAuthorizedSharedAccountWorkflowsView = snakeCase
  .view(`active_manager_authorized_${sharedAccountWorkflows.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeSharedAccountWorkflowsView),
        managerId: activeSharedAccountManagerAccessView.managerId,
      })
      .from(activeSharedAccountWorkflowsView)
      .innerJoin(
        activeSharedAccountManagerAccessView,
        and(
          eq(
            activeSharedAccountWorkflowsView.sharedAccountId,
            activeSharedAccountManagerAccessView.sharedAccountId,
          ),
          eq(
            activeSharedAccountWorkflowsView.tenantId,
            activeSharedAccountManagerAccessView.tenantId,
          ),
        ),
      ),
  );
export type ActiveManagerAuthorizedSharedAccountWorkflowsView =
  typeof activeManagerAuthorizedSharedAccountWorkflowsView;
export type ActiveManagerAuthorizedSharedAccountWorkflow =
  InferViewSelectModel<ActiveManagerAuthorizedSharedAccountWorkflowsView>;

export const workflowStatuses = new Tables.Sync(
  "workflow_statuses",
  {
    name: Columns.varchar({
      length: Constants.VARCHAR_LENGTH,
    }).notNull(),
    type: Columns.union(WorkflowStatusesContract.types).notNull(),
    charging: boolean().notNull(),
    color: Columns.varchar({ length: 9 }),
    index: smallint().notNull(),
    sharedAccountWorkflowId: Columns.entityId(),
    roomWorkflowId: Columns.entityId(),
  },
  (table) => [
    check("workflow_xor", ne(isNull(table.sharedAccountWorkflowId), isNull(table.roomWorkflowId))),
    index().on(table.roomWorkflowId),
    index().on(table.sharedAccountWorkflowId),
    unique().on(table.roomWorkflowId, table.index),
    unique().on(table.sharedAccountWorkflowId, table.index),
  ],
);
export const workflowStatusesTable = workflowStatuses.table;
export type WorkflowStatusesTable = typeof workflowStatusesTable;
export type WorkflowStatus = WorkflowStatusRow<InferSelectModel<WorkflowStatusesTable>>;

export const activeWorkflowStatusesView = snakeCase
  .view(`active_${workflowStatuses.name}`)
  .as((qb) =>
    qb
      .select(getColumns(workflowStatusesTable))
      .from(workflowStatusesTable)
      .where(isNull(workflowStatusesTable.deletedAt)),
  );
export type ActiveWorkflowStatusesView = typeof activeWorkflowStatusesView;
export type ActiveWorkflowStatus = WorkflowStatusRow<
  InferViewSelectModel<ActiveWorkflowStatusesView>
>;

export const activeCustomerAuthorizedSharedAccountWorkflowStatusesView = snakeCase
  .view(`active_customer_authorized_shared_account_${workflowStatuses.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeWorkflowStatusesView),
        customerId: activeCustomerAuthorizedSharedAccountWorkflowsView.customerId,
      })
      .from(activeWorkflowStatusesView)
      .innerJoin(
        activeCustomerAuthorizedSharedAccountWorkflowsView,
        and(
          eq(
            activeWorkflowStatusesView.sharedAccountWorkflowId,
            activeCustomerAuthorizedSharedAccountWorkflowsView.id,
          ),
          eq(
            activeWorkflowStatusesView.tenantId,
            activeCustomerAuthorizedSharedAccountWorkflowsView.tenantId,
          ),
        ),
      ),
  );
export type ActiveCustomerAuthorizedSharedAccountWorkflowStatusesView =
  typeof activeCustomerAuthorizedSharedAccountWorkflowStatusesView;
export type ActiveCustomerAuthorizedSharedAccountWorkflowStatus = SharedAccountWorkflowStatusRow<
  InferViewSelectModel<ActiveCustomerAuthorizedSharedAccountWorkflowStatusesView>
>;

export const activeManagerAuthorizedSharedAccountWorkflowStatusesView = snakeCase
  .view(`active_manager_authorized_shared_account_${workflowStatuses.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeWorkflowStatusesView),
        managerId: activeManagerAuthorizedSharedAccountWorkflowsView.managerId,
      })
      .from(activeWorkflowStatusesView)
      .innerJoin(
        activeManagerAuthorizedSharedAccountWorkflowsView,
        and(
          eq(
            activeWorkflowStatusesView.sharedAccountWorkflowId,
            activeManagerAuthorizedSharedAccountWorkflowsView.id,
          ),
          eq(
            activeWorkflowStatusesView.tenantId,
            activeManagerAuthorizedSharedAccountWorkflowsView.tenantId,
          ),
        ),
      ),
  );
export type ActiveManagerAuthorizedSharedAccountWorkflowStatusesView =
  typeof activeManagerAuthorizedSharedAccountWorkflowStatusesView;
export type ActiveManagerAuthorizedSharedAccountWorkflowStatus = SharedAccountWorkflowStatusRow<
  InferViewSelectModel<ActiveManagerAuthorizedSharedAccountWorkflowStatusesView>
>;

export const activePublishedRoomWorkflowStatusesView = snakeCase
  .view(`active_published_room_${workflowStatuses.name}`)
  .as((qb) =>
    qb
      .select(getColumns(activeWorkflowStatusesView))
      .from(activeWorkflowStatusesView)
      .innerJoin(
        activePublishedRoomRoomWorkflowsView,
        and(
          eq(activeWorkflowStatusesView.roomWorkflowId, activePublishedRoomRoomWorkflowsView.id),
          eq(activeWorkflowStatusesView.tenantId, activePublishedRoomRoomWorkflowsView.tenantId),
        ),
      ),
  );
export type ActivePublishedRoomWorkflowStatusesView =
  typeof activePublishedRoomWorkflowStatusesView;
export type ActivePublishedRoomWorkflowStatus = RoomWorkflowStatusRow<
  InferViewSelectModel<ActivePublishedRoomWorkflowStatusesView>
>;

type WorkflowStatusRow<TRow> = Omit<TRow, "roomWorkflowId" | "sharedAccountWorkflowId"> &
  (
    | {
        roomWorkflowId: EntityId;
        sharedAccountWorkflowId: null;
      }
    | {
        roomWorkflowId: null;
        sharedAccountWorkflowId: EntityId;
      }
  );

type RoomWorkflowStatusRow<TRow> = Omit<TRow, "roomWorkflowId" | "sharedAccountWorkflowId"> & {
  sharedAccountWorkflowId: null;
  roomWorkflowId: EntityId;
};

type SharedAccountWorkflowStatusRow<TRow> = Omit<
  TRow,
  "roomWorkflowId" | "sharedAccountWorkflowId"
> & {
  sharedAccountWorkflowId: EntityId;
  roomWorkflowId: null;
};

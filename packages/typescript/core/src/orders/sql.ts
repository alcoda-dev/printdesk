import { and, eq, getColumns, isNotNull, isNull, ne, or } from "drizzle-orm";
import { check, index, snakeCase, text, unique } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { activeSharedAccountManagerAccessView } from "../shared-accounts/sql";
import { Tables } from "../tables";
import { OrderObjectMetadataContract, OrdersContract } from "./contracts";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";
import type { EntityId } from "../utils";

type OrderRow<TRow> = Omit<
  TRow,
  | "status"
  | "deliveryOptionId"
  | "attributes"
  | "roomWorkflowStatusId"
  | "sharedAccountWorkflowStatusId"
> &
  (
    | {
        status: typeof OrdersContract.draftStatus;
        deliveryOptionId: EntityId | null;
        attributes: typeof OrdersContract.Attributes.Type | null;
        roomWorkflowStatusId: EntityId;
        sharedAccountWorkflowStatusId: null;
      }
    | {
        status: typeof OrdersContract.draftStatus;
        deliveryOptionId: EntityId | null;
        attributes: typeof OrdersContract.Attributes.Type | null;
        roomWorkflowStatusId: null;
        sharedAccountWorkflowStatusId: EntityId;
      }
    | {
        status: typeof OrdersContract.submittedStatus;
        deliveryOptionId: EntityId;
        attributes: typeof OrdersContract.Attributes.Type;
        roomWorkflowStatusId: null;
        sharedAccountWorkflowStatusId: EntityId;
      }
    | {
        status: typeof OrdersContract.submittedStatus;
        deliveryOptionId: EntityId;
        attributes: typeof OrdersContract.Attributes.Type;
        roomWorkflowStatusId: EntityId;
        sharedAccountWorkflowStatusId: null;
      }
  );
export const orders = new Tables.Sync(
  "orders",
  {
    status: Columns.union(OrdersContract.Status.literals)
      .default(OrdersContract.draftStatus)
      .notNull(),
    shortId: Columns.shortId(),
    customerId: Columns.entityId().notNull(),
    managerId: Columns.entityId(),
    operatorId: Columns.entityId(),
    productId: Columns.entityId().notNull(),
    sharedAccountId: Columns.entityId(), // null when charging to customer's personal account
    roomWorkflowStatusId: Columns.entityId(),
    sharedAccountWorkflowStatusId: Columns.entityId(),
    deliveryOptionId: Columns.entityId(),
    attributes: Columns.jsonb(OrdersContract.Attributes),
    approvedAt: Columns.dateTime(),
  },
  (table) => [
    index().on(table.customerId),
    index().on(table.sharedAccountId),
    index().on(table.roomWorkflowStatusId),
    index().on(table.sharedAccountWorkflowStatusId),
    check(
      "status_validity",
      // oxlint-disable-next-line typescript/no-non-null-assertion
      or(
        eq(table.status, OrdersContract.draftStatus),
        and(
          eq(table.status, OrdersContract.submittedStatus),
          isNotNull(table.attributes),
          isNotNull(table.deliveryOptionId),
        ),
      )!,
    ),
    check(
      "workflow_status_id_xor",
      ne(isNull(table.roomWorkflowStatusId), isNull(table.sharedAccountWorkflowStatusId)),
    ),
  ],
);
export const ordersTable = orders.table;
export type OrdersTable = typeof orders.table;
export type Order = OrderRow<InferSelectModel<OrdersTable>>;
export const activeOrdersView = snakeCase
  .view(`active_${orders.name}`)
  .as((qb) => qb.select().from(orders.table).where(isNull(orders.table.deletedAt)));
export type ActiveOrdersView = typeof activeOrdersView;
export type ActiveOrder = OrderRow<InferViewSelectModel<ActiveOrdersView>>;
export type ActiveCustomerOrdersView = ActiveOrdersView;
export type ActiveCustomerOrder = ActiveOrder;
export const activeManagerAuthorizedSharedAccountOrdersView = snakeCase
  .view(`active_manager_authorized_shared_account_${orders.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeOrdersView),
        authorizedManagerId:
          activeSharedAccountManagerAccessView.managerId.as("authorized_manager_id"),
      })
      .from(activeOrdersView)
      .innerJoin(
        activeSharedAccountManagerAccessView,
        and(
          eq(
            activeOrdersView.sharedAccountId,
            activeSharedAccountManagerAccessView.sharedAccountId,
          ),
          eq(activeOrdersView.tenantId, activeSharedAccountManagerAccessView.tenantId),
        ),
      ),
  );
export type ActiveManagerAuthorizedSharedAccountOrdersView =
  typeof activeManagerAuthorizedSharedAccountOrdersView;
export type ActiveManagerAuthorizedSharedAccountOrder = OrderRow<
  InferViewSelectModel<ActiveManagerAuthorizedSharedAccountOrdersView>
>;

export const orderObjectMetadata = new Tables.Sync(
  "order_object_metadata",
  {
    orderId: Columns.entityId().notNull(),
    filename: text().notNull(),
    mimeType: text().notNull(),
    byteSize: Columns.byteSize().notNull(),
    status: Columns.union(OrderObjectMetadataContract.Status.literals).notNull(),
  },
  (table) => [unique().on(table.orderId, table.filename, table.tenantId)],
);
export const orderObjectMetadataTable = orderObjectMetadata.table;
export type OrderObjectMetadataTable = typeof orderObjectMetadata.table;
export type OrderObjectMetadata = InferSelectModel<OrderObjectMetadataTable>;
export const activeOrderObjectMetadataView = snakeCase
  .view(`active_${orderObjectMetadata.name}`)
  .as((qb) =>
    qb.select().from(orderObjectMetadata.table).where(isNull(orderObjectMetadata.table.deletedAt)),
  );
export type ActiveOrderObjectMetadataView = typeof activeOrderObjectMetadataView;
export type ActiveOrderObjectMetadata = InferViewSelectModel<ActiveOrderObjectMetadataView>;
export const activeCustomerOrderObjectMetadataView = snakeCase
  .view(`active_customer_${orderObjectMetadata.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeOrderObjectMetadataView),
        customerId: activeOrdersView.customerId,
      })
      .from(activeOrderObjectMetadataView)
      .innerJoin(
        activeOrdersView,
        and(
          eq(activeOrderObjectMetadataView.orderId, activeOrdersView.id),
          eq(activeOrderObjectMetadataView.tenantId, activeOrdersView.tenantId),
        ),
      ),
  );
export type ActiveCustomerOrderObjectMetadataView = typeof activeCustomerOrderObjectMetadataView;
export type ActiveCustomerOrderObjectMetadata =
  InferViewSelectModel<ActiveCustomerOrderObjectMetadataView>;
export const activeManagerAuthorizedSharedAccountOrderObjectMetadataView = snakeCase
  .view(`active_manager_authorized_shared_account_${orderObjectMetadata.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeOrderObjectMetadataView),
        authorizedManagerId: activeSharedAccountManagerAccessView.managerId,
      })
      .from(activeOrderObjectMetadataView)
      .innerJoin(
        activeOrdersView,
        and(
          eq(activeOrderObjectMetadataView.orderId, activeOrdersView.id),
          eq(activeOrderObjectMetadataView.tenantId, activeOrdersView.tenantId),
        ),
      )
      .innerJoin(
        activeSharedAccountManagerAccessView,
        and(
          eq(
            activeOrdersView.sharedAccountId,
            activeSharedAccountManagerAccessView.sharedAccountId,
          ),
          eq(activeOrdersView.tenantId, activeSharedAccountManagerAccessView.tenantId),
        ),
      ),
  );
export type ActiveManagerAuthorizedSharedAccountOrderObjectMetadataView =
  typeof activeManagerAuthorizedSharedAccountOrderObjectMetadataView;
export type ActiveManagerAuthorizedSharedAccountOrderObjectMetadata =
  InferViewSelectModel<ActiveManagerAuthorizedSharedAccountOrderObjectMetadataView>;

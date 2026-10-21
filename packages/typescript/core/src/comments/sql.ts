import { and, eq, getColumns, isNull } from "drizzle-orm";
import { boolean, index, snakeCase, text } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { activeOrdersView } from "../orders/sql";
import { activeSharedAccountManagerAccessView } from "../shared-accounts/sql";
import { Tables } from "../tables";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const comments = new Tables.Sync(
  "comments",
  {
    orderId: Columns.entityId().notNull(),
    authorId: Columns.entityId().notNull(),
    content: text().notNull(),
    internal: boolean().notNull().default(false),
  },
  (table) => [index().on(table.orderId)],
);
export const commentsTable = comments.table;
export type CommentsTable = typeof commentsTable;
export type Comment = InferSelectModel<CommentsTable>;

export const activeCommentsView = snakeCase
  .view(`active_${comments.name}`)
  .as((qb) => qb.select().from(commentsTable).where(isNull(commentsTable.deletedAt)));
export type ActiveCommentsView = typeof activeCommentsView;
export type ActiveComment = InferViewSelectModel<ActiveCommentsView>;

export const activeCustomerOrderCommentsView = snakeCase
  .view(`active_customer_order_${comments.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeCommentsView),
        customerId: activeOrdersView.customerId,
      })
      .from(activeCommentsView)
      .innerJoin(
        activeOrdersView,
        and(
          eq(activeCommentsView.orderId, activeOrdersView.id),
          eq(activeCommentsView.tenantId, activeOrdersView.tenantId),
        ),
      ),
  );
export type ActiveCustomerOrderCommentsView = typeof activeCustomerOrderCommentsView;
export type ActiveCustomerOrderComment = InferViewSelectModel<ActiveCustomerOrderCommentsView>;

export const activeManagerAuthorizedSharedAccountOrderCommentsView = snakeCase
  .view(`active_manager_authorized_shared_account_order_${comments.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeCommentsView),
        authorizedManagerId: activeSharedAccountManagerAccessView.managerId,
      })
      .from(activeCommentsView)
      .innerJoin(
        activeOrdersView,
        and(
          eq(activeCommentsView.orderId, activeOrdersView.id),
          eq(activeCommentsView.tenantId, activeOrdersView.tenantId),
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
export type ActiveManagerAuthorizedSharedAccountOrderCommentsView =
  typeof activeManagerAuthorizedSharedAccountOrderCommentsView;
export type ActiveManagerAuthorizedSharedAccountOrderComment =
  InferViewSelectModel<ActiveManagerAuthorizedSharedAccountOrderCommentsView>;

import { and, eq, getColumns, isNotNull, isNull, ne, or } from "drizzle-orm";
import { check, index, snakeCase } from "drizzle-orm/pg-core";
import * as Schema from "effect/Schema";

import { Columns } from "../columns";
import { activeOrdersView } from "../orders/sql";
import { activeSharedAccountManagerAccessView } from "../shared-accounts/sql";
import { Tables } from "../tables";
import { InvoicesContract } from "./contract";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const invoices = new Tables.Sync(
  "invoices",
  {
    lineItems: Columns.jsonb(InvoicesContract.LineItem.pipe(Schema.Array)).notNull(),
    status: Columns.union(InvoicesContract.Status.literals).default("processing").notNull(),
    chargedAt: Columns.dateTime(),
    orderId: Columns.entityId().notNull(),
  },
  (table) => [
    index().on(table.orderId),
    check(
      "charged_status",
      // oxlint-disable-next-line typescript/no-non-null-assertion
      or(
        and(
          eq(table.status, "charged" satisfies InvoicesContract.Status),
          isNotNull(table.chargedAt),
        ),
        and(ne(table.status, "charged" satisfies InvoicesContract.Status), isNull(table.chargedAt)),
      )!,
    ),
  ],
);
export const invoicesTable = invoices.table;
export type InvoicesTable = typeof invoicesTable;
export type Invoice = InferSelectModel<InvoicesTable>;

export const activeInvoicesView = snakeCase
  .view(`active_${invoices.name}`)
  .as((qb) => qb.select().from(invoicesTable).where(isNull(invoicesTable.deletedAt)));
export type ActiveInvoicesView = typeof activeInvoicesView;
export type ActiveInvoice = InferViewSelectModel<ActiveInvoicesView>;

export const activeCustomerOrderInvoicesView = snakeCase
  .view(`active_customer_order_${invoices.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeInvoicesView),
        customerId: activeOrdersView.customerId,
      })
      .from(activeInvoicesView)
      .innerJoin(
        activeOrdersView,
        and(
          eq(activeInvoicesView.orderId, activeOrdersView.id),
          eq(activeInvoicesView.tenantId, activeOrdersView.tenantId),
        ),
      ),
  );
export type ActiveCustomerOrderInvoicesView = typeof activeCustomerOrderInvoicesView;
export type ActiveCustomerOrderInvoice = InferViewSelectModel<ActiveCustomerOrderInvoicesView>;

export const activeManagerAuthorizedSharedAccountOrderInvoicesView = snakeCase
  .view(`active_manager_authorized_shared_account_order_${invoices.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeInvoicesView),
        authorizedManagerId: activeSharedAccountManagerAccessView.managerId,
      })
      .from(activeInvoicesView)
      .innerJoin(
        activeOrdersView,
        and(
          eq(activeInvoicesView.orderId, activeOrdersView.id),
          eq(activeInvoicesView.tenantId, activeOrdersView.tenantId),
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
export type ActiveManagerAuthorizedSharedAccountOrderInvoicesView =
  typeof activeManagerAuthorizedSharedAccountOrderInvoicesView;
export type ActiveManagerAuthorizedSharedAccountOrderInvoice =
  InferViewSelectModel<ActiveManagerAuthorizedSharedAccountOrderInvoicesView>;

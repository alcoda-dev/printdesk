import { and, eq, getColumns, isNotNull, isNull, or } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  numeric,
  snakeCase,
  text,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { activeGroupMembershipsView } from "../groups/sql";
import { Tables } from "../tables";
import { SharedAccountsContract } from "./contracts";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";
import type { Discriminate, Prettify } from "../utils";

export const sharedAccountCustomerAccess = new Tables.Sync(
  `shared_account_customer_access`,
  {
    customerId: Columns.entityId().notNull(),
    sharedAccountId: Columns.entityId().notNull(),
  },
  (table) => [
    uniqueIndex().on(table.customerId, table.sharedAccountId, table.tenantId),
    index().on(table.customerId),
  ],
);
export const sharedAccountCustomerAccessTable = sharedAccountCustomerAccess.table;
export type SharedAccountCustomerAccessTable = typeof sharedAccountCustomerAccessTable;
export type SharedAccountCustomerAccess = InferSelectModel<SharedAccountCustomerAccessTable>;

export const activeSharedAccountCustomerAccessView = snakeCase
  .view(`active_${sharedAccountCustomerAccess.name}`)
  .as((qb) =>
    qb
      .select()
      .from(sharedAccountCustomerAccessTable)
      .where(isNull(sharedAccountCustomerAccessTable.deletedAt)),
  );
export type ActiveSharedAccountCustomerAccessView = typeof activeSharedAccountCustomerAccessView;
export type ActiveSharedAccountCustomerAccess =
  InferViewSelectModel<ActiveSharedAccountCustomerAccessView>;

export type ActiveAuthorizedSharedAccountCustomerAccessView = ActiveSharedAccountCustomerAccessView;
export type ActiveAuthorizedSharedAccountCustomerAccess = ActiveSharedAccountCustomerAccess;

export const sharedAccountManagerAccess = new Tables.Sync(
  "shared_account_manager_access",
  {
    managerId: Columns.entityId().notNull(),
    sharedAccountId: Columns.entityId().notNull(),
  },
  (table) => [
    uniqueIndex().on(table.sharedAccountId, table.managerId, table.tenantId),
    index().on(table.managerId),
  ],
);
export const sharedAccountManagerAccessTable = sharedAccountManagerAccess.table;
export type SharedAccountManagerAccessTable = typeof sharedAccountManagerAccessTable;
export type SharedAccountManagerAccess = InferSelectModel<SharedAccountManagerAccessTable>;

export const activeSharedAccountManagerAccessView = snakeCase
  .view(`active_${sharedAccountManagerAccess.name}`)
  .as((qb) =>
    qb
      .select()
      .from(sharedAccountManagerAccessTable)
      .where(isNull(sharedAccountManagerAccessTable.deletedAt)),
  );
export type ActiveSharedAccountManagerAccessView = typeof activeSharedAccountManagerAccessView;
export type ActiveSharedAccountManagerAccess =
  InferViewSelectModel<ActiveSharedAccountManagerAccessView>;

export type ActiveAuthorizedSharedAccountManagerAccessView = ActiveSharedAccountManagerAccessView;
export type ActiveAuthorizedSharedAccountManagerAccess = ActiveSharedAccountManagerAccess;

export const activeCustomerAuthorizedSharedAccountManagerAccessView = snakeCase
  .view(`active_customer_authorized_${sharedAccountManagerAccess.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeSharedAccountManagerAccessView),
        customerId: activeSharedAccountCustomerAccessView.customerId,
      })
      .from(activeSharedAccountManagerAccessView)
      .innerJoin(
        activeSharedAccountCustomerAccessView,
        and(
          eq(
            activeSharedAccountManagerAccessView.sharedAccountId,
            activeSharedAccountCustomerAccessView.sharedAccountId,
          ),
          eq(
            activeSharedAccountManagerAccessView.tenantId,
            activeSharedAccountCustomerAccessView.tenantId,
          ),
        ),
      ),
  );
export type ActiveCustomerAuthorizedSharedAccountManagerAccessView =
  typeof activeCustomerAuthorizedSharedAccountManagerAccessView;
export type ActiveCustomerAuthorizedSharedAccountManagerAccess =
  InferViewSelectModel<ActiveCustomerAuthorizedSharedAccountManagerAccessView>;

export const sharedAccounts = new Tables.Sync(
  "shared_accounts",
  {
    origin: Columns.union(SharedAccountsContract.Origin.literals).default("internal").notNull(),
    name: text().$type<SharedAccountsContract.Name>().notNull(),
    reviewThreshold: numeric(),
    papercutMfId: bigint({ mode: "number" }).$type<SharedAccountsContract.PapercutMfId>(),
  },
  (table) => [
    unique().on(table.name, table.papercutMfId, table.tenantId),
    check(
      "origin_papercut_mf_id",
      // oxlint-disable-next-line typescript/no-non-null-assertion
      or(
        and(
          eq(table.origin, "papercut" satisfies SharedAccountsContract.Origin),
          isNotNull(table.papercutMfId),
        ),
        and(
          eq(table.origin, "internal" satisfies SharedAccountsContract.Origin),
          isNull(table.papercutMfId),
        ),
      )!,
    ),
    index().on(table.origin, table.tenantId),
  ],
);
export const sharedAccountsTable = sharedAccounts.table;
export type SharedAccountsTable = typeof sharedAccountsTable;
export type SharedAccount = InferSelectModel<SharedAccountsTable>;
export type SharedAccountByOrigin<TSharedAccountOrigin extends SharedAccount["origin"]> = Prettify<
  Omit<Discriminate<SharedAccount, "origin", TSharedAccountOrigin>, "papercutMfId"> &
    (TSharedAccountOrigin extends "papercut"
      ? { papercutMfId: NonNullable<SharedAccount["papercutMfId"]> }
      : { papercutMfId: null })
>;

export const activeSharedAccountsView = snakeCase
  .view(`active_${sharedAccounts.name}`)
  .as((qb) => qb.select().from(sharedAccountsTable).where(isNull(sharedAccountsTable.deletedAt)));
export type ActiveSharedAccountsView = typeof activeSharedAccountsView;
export type ActiveSharedAccount = InferViewSelectModel<ActiveSharedAccountsView>;

export const activeCustomerAuthorizedSharedAccountsView = snakeCase
  .view(`active_customer_authorized_${sharedAccounts.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeSharedAccountsView),
        customerId: activeSharedAccountCustomerAccessView.customerId,
      })
      .from(activeSharedAccountsView)
      .innerJoin(
        activeSharedAccountCustomerAccessView,
        and(
          eq(activeSharedAccountsView.id, activeSharedAccountCustomerAccessView.sharedAccountId),
          eq(activeSharedAccountsView.tenantId, activeSharedAccountCustomerAccessView.tenantId),
        ),
      ),
  );
export type ActiveCustomerAuthorizedSharedAccountsView =
  typeof activeCustomerAuthorizedSharedAccountsView;
export type ActiveCustomerAuthorizedSharedAccount =
  InferViewSelectModel<ActiveCustomerAuthorizedSharedAccountsView>;

export const activeManagerAuthorizedSharedAccountsView = snakeCase
  .view(`active_manager_authorized_${sharedAccounts.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeSharedAccountsView),
        managerId: activeSharedAccountManagerAccessView.managerId,
      })
      .from(activeSharedAccountsView)
      .innerJoin(
        activeSharedAccountManagerAccessView,
        and(
          eq(activeSharedAccountsView.id, activeSharedAccountManagerAccessView.sharedAccountId),
          eq(activeSharedAccountsView.tenantId, activeSharedAccountManagerAccessView.tenantId),
        ),
      ),
  );
export type ActiveManagerAuthorizedSharedAccountsView =
  typeof activeManagerAuthorizedSharedAccountsView;
export type ActiveManagerAuthorizedSharedAccount =
  InferViewSelectModel<ActiveManagerAuthorizedSharedAccountsView>;

export const sharedAccountGroupCustomerAccess = new Tables.Sync(
  `shared_account_group_customer_access`,
  {
    groupId: Columns.entityId().notNull(),
    sharedAccountId: Columns.entityId().notNull(),
  },
  (table) => [
    uniqueIndex().on(table.groupId, table.sharedAccountId, table.tenantId),
    index().on(table.groupId),
  ],
);
export const sharedAccountGroupCustomerAccessTable = sharedAccountGroupCustomerAccess.table;
export type SharedAccountGroupCustomerAccessTable = typeof sharedAccountGroupCustomerAccessTable;
export type SharedAccountGroupCustomerAccess =
  InferSelectModel<SharedAccountGroupCustomerAccessTable>;

export const activeSharedAccountGroupCustomerAccessView = snakeCase
  .view(`active_${sharedAccountGroupCustomerAccess.name}`)
  .as((qb) =>
    qb
      .select()
      .from(sharedAccountGroupCustomerAccessTable)
      .where(isNull(sharedAccountGroupCustomerAccessTable.deletedAt)),
  );
export type ActiveSharedAccountGroupCustomerAccessView =
  typeof activeSharedAccountGroupCustomerAccessView;
export type ActiveSharedAccountGroupCustomerAccess =
  InferViewSelectModel<ActiveSharedAccountGroupCustomerAccessView>;

export const activeAuthorizedSharedAccountGroupCustomerAccessView = snakeCase
  .view(`active_authorized_${sharedAccountGroupCustomerAccess.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeSharedAccountGroupCustomerAccessView),
        memberId: activeGroupMembershipsView.userId,
      })
      .from(activeSharedAccountGroupCustomerAccessView)
      .innerJoin(
        activeGroupMembershipsView,
        and(
          eq(
            activeSharedAccountGroupCustomerAccessView.groupId,
            activeGroupMembershipsView.groupId,
          ),
          eq(
            activeSharedAccountGroupCustomerAccessView.tenantId,
            activeGroupMembershipsView.tenantId,
          ),
        ),
      ),
  );
export type ActiveAuthorizedSharedAccountGroupCustomerAccessView =
  typeof activeAuthorizedSharedAccountGroupCustomerAccessView;
export type ActiveAuthorizedSharedAccountGroupCustomerAccess =
  InferViewSelectModel<ActiveAuthorizedSharedAccountGroupCustomerAccessView>;

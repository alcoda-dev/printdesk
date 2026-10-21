import { isNull } from "drizzle-orm";
import { index, snakeCase, text, unique } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { Tables } from "../tables";
import { UsersContract } from "./contract";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const users = new Tables.Sync(
  "users",
  {
    username: text().$type<UsersContract.Username>().notNull(),
    externalId: text().$type<UsersContract.ExternalId>().notNull(),
    displayName: text().$type<UsersContract.DisplayName>().notNull(),
    email: text().$type<UsersContract.Email>().notNull(),
    identityProviderId: Columns.entityId().notNull(),
    status: Columns.union(UsersContract.Status.literals).notNull().default("active"),
    role: Columns.union(UsersContract.Role.literals).notNull().default("customer"),
  },
  (table) => [
    unique().on(table.username, table.identityProviderId, table.tenantId),
    unique().on(table.externalId, table.identityProviderId, table.tenantId),
    unique().on(table.email, table.identityProviderId, table.tenantId),
    index().on(table.externalId),
    index().on(table.identityProviderId),
  ],
);
export const usersTable = users.table;
export type UsersTable = typeof usersTable;
export type User = InferSelectModel<UsersTable>;

export const activeUsersView = snakeCase
  .view(`active_${users.name}`)
  .as((qb) => qb.select().from(usersTable).where(isNull(usersTable.deletedAt)));
export type ActiveUsersView = typeof activeUsersView;
export type ActiveUser = InferViewSelectModel<ActiveUsersView>;

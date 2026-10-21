import { and, eq, getColumns, isNull } from "drizzle-orm";
import { index, snakeCase, text, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { Tables } from "../tables";
import { GroupsContract } from "./contracts";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const groupMemberships = new Tables.Sync(
  "group_memberships",
  {
    groupId: Columns.entityId().notNull(),
    userId: Columns.entityId().notNull(),
  },
  (table) => [
    uniqueIndex().on(table.groupId, table.userId, table.tenantId),
    index().on(table.groupId, table.tenantId),
  ],
);
export const groupMembershipsTable = groupMemberships.table;
export type GroupMembershipsTable = typeof groupMembershipsTable;
export type GroupMembership = InferSelectModel<GroupMembershipsTable>;

export const activeGroupMembershipsView = snakeCase
  .view(`active_${groupMemberships.name}`)
  .as((qb) =>
    qb.select().from(groupMembershipsTable).where(isNull(groupMembershipsTable.deletedAt)),
  );
export type ActiveGroupMembershipsView = typeof activeGroupMembershipsView;
export type ActiveGroupMembership = InferViewSelectModel<ActiveGroupMembershipsView>;

export const groups = new Tables.Sync(
  "groups",
  {
    name: text().$type<GroupsContract.Name>().notNull(),
    externalId: text().$type<GroupsContract.ExternalId>().notNull(),
    identityProviderId: Columns.entityId().notNull(),
  },
  (table) => [
    unique().on(table.name, table.tenantId),
    uniqueIndex().on(table.externalId, table.tenantId),
  ],
);
export const groupsTable = groups.table;
export type GroupsTable = typeof groupsTable;
export type Group = InferSelectModel<GroupsTable>;

export const activeGroupsView = snakeCase
  .view(`active_${groups.name}`)
  .as((qb) => qb.select().from(groupsTable).where(isNull(groupsTable.deletedAt)));
export type ActiveGroupsView = typeof activeGroupsView;
export type ActiveGroup = InferViewSelectModel<ActiveGroupsView>;

export const activeMembershipGroupsView = snakeCase
  .view(`active_membership_${groups.name}`)
  .as((qb) =>
    qb
      .select({
        ...getColumns(activeGroupsView),
        userId: activeGroupMembershipsView.userId,
      })
      .from(activeGroupsView)
      .innerJoin(
        activeGroupMembershipsView,
        and(
          eq(activeGroupsView.id, activeGroupMembershipsView.groupId),
          eq(activeGroupsView.tenantId, activeGroupMembershipsView.tenantId),
        ),
      ),
  );
export type ActiveMembershipGroupsView = typeof activeMembershipGroupsView;
export type ActiveMembershipGroup = InferViewSelectModel<ActiveMembershipGroupsView>;

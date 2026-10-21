import { eq, isNull } from "drizzle-orm";
import { index, text, unique, snakeCase } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { Tables } from "../tables";
import { RoomsContract } from "./contract";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const rooms = new Tables.Sync(
  "rooms",
  {
    name: Columns.varchar().notNull(),
    status: Columns.union(RoomsContract.Status.literals).default("draft").notNull(),
    details: text(),
  },
  (table) => [unique().on(table.name, table.tenantId), index().on(table.status)],
);
export const roomsTable = rooms.table;
export type RoomsTable = typeof roomsTable;
export type Room = InferSelectModel<RoomsTable>;

export const activeRoomsView = snakeCase
  .view(`active_${rooms.name}`)
  .as((qb) => qb.select().from(roomsTable).where(isNull(roomsTable.deletedAt)));
export type ActiveRoomsView = typeof activeRoomsView;
export type ActiveRoom = InferViewSelectModel<ActiveRoomsView>;

export const activePublishedRoomsView = snakeCase
  .view(`active_published_${rooms.name}`)
  .as((qb) => qb.select().from(activeRoomsView).where(eq(activeRoomsView.status, "published")));
export type ActivePublishedRoomsView = typeof activePublishedRoomsView;
export type ActivePublishedRoom = InferViewSelectModel<ActivePublishedRoomsView>;

import { and, eq, getColumns, isNull } from "drizzle-orm";
import { snakeCase, text } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { activePublishedRoomsView } from "../rooms/sql";
import { Tables } from "../tables";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const announcements = new Tables.Sync("announcements", {
  content: text().notNull(),
  roomId: Columns.entityId().notNull(),
  authorId: Columns.entityId().notNull(),
});
export const announcementsTable = announcements.table;
export type AnnouncementsTable = typeof announcementsTable;
export type Announcement = InferSelectModel<AnnouncementsTable>;

export const activeAnnouncementsView = snakeCase
  .view(`active_${announcements.name}`)
  .as((qb) => qb.select().from(announcements.table).where(isNull(announcements.table.deletedAt)));
export type ActiveAnnouncementsView = typeof activeAnnouncementsView;
export type ActiveAnnouncement = InferViewSelectModel<ActiveAnnouncementsView>;

export const activePublishedRoomAnnouncementsView = snakeCase
  .view(`active_published_room_${announcements.name}`)
  .as((qb) =>
    qb
      .select(getColumns(activeAnnouncementsView))
      .from(activeAnnouncementsView)
      .innerJoin(
        activePublishedRoomsView,
        and(
          eq(activeAnnouncementsView.roomId, activePublishedRoomsView.id),
          eq(activeAnnouncementsView.tenantId, activePublishedRoomsView.tenantId),
        ),
      ),
  );
export type ActivePublishedRoomAnnouncementsView = typeof activePublishedRoomAnnouncementsView;
export type ActivePublishedRoomAnnouncement =
  InferViewSelectModel<ActivePublishedRoomAnnouncementsView>;

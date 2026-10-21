import { and, eq, getColumns, isNull } from "drizzle-orm";
import { numeric, snakeCase } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { activePublishedRoomsView } from "../rooms/sql";
import { Tables } from "../tables";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const deliveryOptions = new Tables.Sync("delivery_options", {
  name: Columns.varchar().notNull(),
  description: Columns.varchar().notNull(),
  detailsLabel: Columns.varchar(),
  cost: numeric(),
  roomId: Columns.entityId().notNull(),
});
export const deliveryOptionsTable = deliveryOptions.table;
export type DeliveryOptionsTable = typeof deliveryOptionsTable;
export type DeliveryOption = InferSelectModel<DeliveryOptionsTable>;

export const activeDeliveryOptionsView = snakeCase
  .view(`active_${deliveryOptions.name}`)
  .as((qb) => qb.select().from(deliveryOptionsTable).where(isNull(deliveryOptionsTable.deletedAt)));
export type ActiveDeliveryOptionsView = typeof activeDeliveryOptionsView;
export type ActiveDeliveryOption = InferViewSelectModel<ActiveDeliveryOptionsView>;

export const activePublishedRoomDeliveryOptionsView = snakeCase
  .view(`active_published_room_${deliveryOptions.name}`)
  .as((qb) =>
    qb
      .select(getColumns(activeDeliveryOptionsView))
      .from(activeDeliveryOptionsView)
      .innerJoin(
        activePublishedRoomsView,
        and(
          eq(activeDeliveryOptionsView.roomId, activePublishedRoomsView.id),
          eq(activeDeliveryOptionsView.tenantId, activePublishedRoomsView.tenantId),
        ),
      ),
  );
export type ActivePublishedRoomDeliveryOptionsView = typeof activePublishedRoomDeliveryOptionsView;
export type ActivePublishedRoomDeliveryOption =
  InferViewSelectModel<ActivePublishedRoomDeliveryOptionsView>;

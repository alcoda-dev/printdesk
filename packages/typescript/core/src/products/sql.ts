import { and, eq, getColumns, isNull } from "drizzle-orm";
import { index, snakeCase } from "drizzle-orm/pg-core";

import { Columns } from "../columns";
import { activePublishedRoomsView } from "../rooms/sql";
import { Tables } from "../tables";
import { ProductsContract } from "./contract";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";

export const products = new Tables.Sync(
  "products",
  {
    name: Columns.varchar().notNull(),
    status: Columns.union(ProductsContract.Status.literals).default("draft").notNull(),
    roomId: Columns.entityId().notNull(),
    config: Columns.jsonb(ProductsContract.Configuration).notNull(),
  },
  (table) => [index().on(table.status), index().on(table.roomId)],
);
export const productsTable = products.table;
export type ProductsTable = typeof productsTable;
export type Product = InferSelectModel<ProductsTable>;

export const activeProductsView = snakeCase
  .view(`active_${products.name}`)
  .as((qb) => qb.select().from(productsTable).where(isNull(productsTable.deletedAt)));
export type ActiveProductsView = typeof activeProductsView;
export type ActiveProduct = InferViewSelectModel<ActiveProductsView>;

export const activePublishedProductsView = snakeCase
  .view(`active_published_${products.name}`)
  .as((qb) =>
    qb
      .select(getColumns(activeProductsView))
      .from(activeProductsView)
      .innerJoin(
        activePublishedRoomsView,
        and(
          eq(activeProductsView.roomId, activePublishedRoomsView.id),
          eq(activeProductsView.tenantId, activePublishedRoomsView.tenantId),
        ),
      )
      .where(eq(activeProductsView.status, "published")),
  );
export type ActivePublishedProductsView = typeof activePublishedProductsView;
export type ActivePublishedProduct = InferViewSelectModel<ActivePublishedProductsView>;

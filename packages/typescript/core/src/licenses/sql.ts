import { uniqueIndex } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";

import { Columns } from "../columns";
import { Tables } from "../tables";
import { generateEntityId } from "../utils";

import type { InferSelectModel } from "drizzle-orm";

export const licenses = new Tables.Table(
  "licenses",
  {
    id: Columns.entityId()
      .primaryKey()
      .$defaultFn(() => generateEntityId.pipe(Effect.runSync)),
    keyHash: Columns.base64Secret().notNull(),
    expiresAt: Columns.dateTime(),
    ...Columns.timestamps,
  },
  (table) => [uniqueIndex().on(table.keyHash)],
);
export const licensesTable = licenses.table;
export type LicensesTable = typeof licensesTable;
export type License = InferSelectModel<LicensesTable>;

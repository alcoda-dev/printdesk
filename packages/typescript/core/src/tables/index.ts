// oxlint-disable typescript/no-explicit-any typescript/no-unsafe-type-assertion
import { getTableColumns, getTableName, sql } from "drizzle-orm";
import { snakeCase, primaryKey } from "drizzle-orm/pg-core";
import * as Array from "effect/Array";
import * as Match from "effect/Match";
import * as Record from "effect/Record";

import { Columns } from "../columns";

import type { SQL } from "drizzle-orm";
import type {
  AnyPgColumnBuilder,
  PgBuildColumns,
  PgBuildExtraConfigColumns,
  PgTableExtraConfigValue,
  PgTableWithColumns,
} from "drizzle-orm/pg-core";

export namespace Tables {
  export class Table<TName extends string, TColumns extends Record<string, AnyPgColumnBuilder>> {
    public readonly table: PgTableWithColumns<{
      name: TName;
      schema: undefined;
      columns: PgBuildColumns<TName, TColumns>;
      dialect: "pg";
      isAlias: false;
    }>;

    public constructor(
      name: TName,
      columns: TColumns,
      extraConfig?: (self: PgBuildExtraConfigColumns<TColumns>) => Array<PgTableExtraConfigValue>,
    ) {
      this.table = snakeCase.table(name, columns, (table) => extraConfig?.(table) ?? []);
    }

    public get name() {
      return getTableName(this.table);
    }

    public get conflictSet() {
      return Array.reduce(
        Record.values(getTableColumns(this.table)),
        Record.empty<string, SQL>(),
        (set, { name }) => {
          set[name] = sql.raw(`COALESCE(EXCLUDED."${name}", "${this.name}"."${name}")`);

          return set;
        },
      );
    }
  }

  /**
   * Wrapper for tenant-owned tables with ids, timestamps, and sync version columns.
   */
  export class Sync<TName extends string, TColumns extends Record<string, AnyPgColumnBuilder>> {
    public readonly table: PgTableWithColumns<{
      name: TName;
      schema: undefined;
      columns: PgBuildColumns<TName, Columns.Sync & TColumns>;
      dialect: "pg";
      isAlias: false;
    }>;

    public constructor(
      name: TName,
      columns: TColumns,
      extraConfig?: (
        self: PgBuildExtraConfigColumns<Columns.Sync & TColumns>,
      ) => Array<PgTableExtraConfigValue>,
    ) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      this.table = snakeCase.table(
        name,
        {
          ...Columns.tenant,
          ...Columns.timestamps,
          ...Columns.syncVersion,
          ...columns,
        },
        (table) => [
          primaryKey({ columns: [table.id, table.tenantId] }),
          ...(extraConfig?.(table) ?? []),
        ],
      ) as any;
    }

    public get name() {
      return getTableName(this.table);
    }

    public get conflictSet() {
      return Array.reduce(
        Record.values(getTableColumns(this.table)),
        Record.empty<string, SQL>(),
        (set, { name }) =>
          Record.set(
            name,
            sql.raw(
              Match.value(name).pipe(
                Match.whenOr(
                  this.table.id.name,
                  this.table.tenantId.name,
                  (name) => `"${this.name}"."${name}"`,
                ),
                Match.when(
                  this.table.updatedAt.name,
                  (name) => `COALESCE(EXCLUDED."${name}", NOW())`,
                ),
                Match.when(this.table.version.name, (name) => `"${this.name}"."${name}" + 1`),
                Match.orElse((name) => `COALESCE(EXCLUDED."${name}", "${this.name}"."${name}")`),
              ),
            ),
          )(set),
      );
    }
  }

  export class NonSync<TName extends string, TColumns extends Record<string, AnyPgColumnBuilder>> {
    public readonly table: PgTableWithColumns<{
      name: TName;
      schema: undefined;
      columns: PgBuildColumns<TName, Columns.NonSync & TColumns>;
      dialect: "pg";
      isAlias: false;
    }>;

    public constructor(
      name: TName,
      columns: TColumns,
      extraConfig?: (
        self: PgBuildExtraConfigColumns<Columns.NonSync & TColumns>,
      ) => Array<PgTableExtraConfigValue>,
    ) {
      this.table = snakeCase.table(
        name,
        { ...Columns.tenant, ...Columns.timestamps, ...columns },
        (table) => [
          primaryKey({ columns: [table.id, table.tenantId] }),
          ...(extraConfig?.(table) ?? []),
        ],
      ) as any;
    }

    public get name() {
      return getTableName(this.table);
    }

    public get conflictSet() {
      return Array.reduce(
        Record.values(getTableColumns(this.table)),
        Record.empty<string, SQL>(),
        (set, { name }) => {
          set[name] = sql.raw(
            Match.value(name).pipe(
              Match.whenOr(
                this.table.id.name,
                this.table.tenantId.name,
                (name) => `"${this.name}"."${name}"`,
              ),
              Match.when(
                this.table.updatedAt.name,
                (name) => `COALESCE(EXCLUDED."${name}", NOW())`,
              ),
              Match.orElse((name) => `COALESCE(EXCLUDED."${name}", "${this.name}"."${name}")`),
            ),
          );

          return set;
        },
      );
    }
  }
}

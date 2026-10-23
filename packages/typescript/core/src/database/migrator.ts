// Non-effect reference implementation: https://github.com/Benjscho/drizzle-orm/blob/f1f5a604a4678ea277f741a6ed6ffc8e218d6c94/drizzle-orm/src/aws-dsql/migrator.ts#L108

import { getTableName } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { snakeCase, bigint, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";
import * as Array from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SqlError from "effect/sql/SqlError";
import * as String from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";

import { Drizzle } from "./drizzle";

import type { MigrationConfig } from "drizzle-orm/migrator";

const defaultSchema = "drizzle";
const defaultTable = "__drizzle_migrations";

export const MigratorConfig = Context.Reference<MigrationConfig>(
  "@printdesk/core/database/MigratorConfig",
  {
    defaultValue: () => ({
      migrationsFolder: "migrations",
      migrationsSchema: defaultSchema,
      migrationsTable: defaultTable,
    }),
  },
);

export class ReadMigrationsError extends Schema.TaggedError<
  ReadMigrationsError,
  { readonly brand: unique symbol }
>()("ReadMigrationsError", { cause: Schema.Defect() }) {}

export class MigrationKey extends Data.Class<{ migrationHash: string; statementIndex: number }> {}

export const DsqlStatement = Schema.Trim.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((statement) => {
      const createIndexRegex = /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?!ASYNC\s+)/i;

      if (createIndexRegex.test(statement))
        return statement.replace(createIndexRegex, (_, unique?: string) =>
          unique ? "CREATE UNIQUE INDEX ASYNC " : "CREATE INDEX ASYNC",
        );

      return statement;
    }),
    encode: SchemaGetter.forbidden(() => "Not implemented"),
  }),
);

export class Migrator extends Context.Service<Migrator>()("@printdesk/core/database/Migrator", {
  make: Effect.gen(function* () {
    const db = yield* Drizzle;
    const config = yield* MigratorConfig;
    const crypto = yield* Crypto.Crypto;

    const textEncoder = new globalThis.TextEncoder();

    const schema = snakeCase.schema(config.migrationsSchema ?? defaultSchema);
    const schemaDdl = sql`CREATE SCHEMA IF NOT EXISTS ${schema};`;

    const table = schema.table(
      config.migrationsTable ?? defaultTable,
      {
        id: bigint({ mode: "number" }).generatedAlwaysAsIdentity({ cache: 1 }).primaryKey(),
        migrationHash: text().notNull(),
        migrationFolderMillis: bigint({ mode: "number" }).notNull(),
        statementIndex: integer().notNull(),
        statementHash: text().notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
      },
      (table) => [unique().on(table.migrationHash, table.statementIndex)],
    );
    const tableDdl =
      sql.raw(`CREATE TABLE IF NOT EXISTS "${schema.schemaName}"."${getTableName(table)}" (
  "${table.id.name}" BIGINT GENERATED ALWAYS AS IDENTITY (CACHE 1) PRIMARY KEY,
  "${table.migrationHash.name}" TEXT NOT NULL,
  "${table.migrationFolderMillis.name}" BIGINT NOT NULL,
  "${table.statementIndex.name}" INTEGER NOT NULL,
  "${table.statementHash.name}" TEXT NOT NULL,
  "${table.createdAt.name}" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("${table.migrationHash.name}", "${table.statementIndex.name}")
)`);

    const migrate = Effect.gen(function* () {
      const migrations = yield* Effect.try({
        try: () => readMigrationFiles(config),
        catch: (cause) => new ReadMigrationsError({ cause }),
      });

      yield* db.execute(schemaDdl);
      yield* db.execute(tableDdl);

      const statements = yield* db
        .select({
          migrationHash: table.migrationHash,
          statementIndex: table.statementIndex,
          statementHash: table.statementHash,
        })
        .from(table)
        .orderBy(table.migrationFolderMillis, table.statementIndex)
        .pipe(
          Effect.map(
            Array.map((migration) =>
              Tuple.make(
                new MigrationKey(Struct.pick(migration, ["migrationHash", "statementIndex"])),
                migration.statementHash,
              ),
            ),
          ),
          Effect.map(HashMap.fromIterable),
        );

      yield* Effect.forEach(
        migrations,
        (migration) =>
          Effect.forEach(
            migration.sql,
            Effect.fn(function* (statement, index) {
              const hash = yield* crypto
                .digest("SHA-256", textEncoder.encode(statement.trim()))
                .pipe(Effect.flatMap(Schema.encodeEffect(Schema.Uint8ArrayFromHex)));

              const storedHash = statements.pipe(
                HashMap.get(
                  new MigrationKey({ migrationHash: migration.hash, statementIndex: index }),
                ),
              );

              if (Option.isSome(storedHash)) {
                if (storedHash.value !== hash)
                  yield* Effect.log(
                    `Warning: Migration statement ${index} in migration ${
                      migration.folderMillis
                    } has been modified since it was applied.` +
                      `The stored hash (${storedHash.value.slice(
                        0,
                        8,
                      )}) differs from the current hash (${hash.slice(0, 8)}).` +
                      `This statement will be skipped, but the change may indicate a problem.\n` +
                      `Action: If this change is intentional, create a new migration. If not, investigate why this migration file changed.`,
                  );

                return;
              }

              yield* Effect.succeed(statement).pipe(
                Effect.flatMap(Schema.decodeEffect(DsqlStatement)),
                Effect.filterOrElse(String.isEmpty, (dsqlStatement) =>
                  db.execute(sql.raw(dsqlStatement)).pipe(
                    Effect.retry(($) =>
                      $(
                        Schedule.max([
                          Schedule.exponential(Duration.seconds(1)),
                          Schedule.recurs(3),
                        ]),
                      ).pipe(
                        Schedule.jittered,
                        Schedule.while(
                          Effect.fn(function* (metadata) {
                            const isRetryable =
                              Cause.isCause(metadata.input.cause) &&
                              metadata.input.cause.pipe(
                                Cause.findErrorOption,
                                Option.filter(SqlError.isSqlError),
                                Option.map(Struct.get("isRetryable")),
                                Option.getOrElse(() => false),
                              );

                            yield* Effect.log(
                              `[Migrator]: Migration statement ${index} in migration ${
                                migration.folderMillis
                              } attempt #${metadata.attempt} failed, ${
                                isRetryable
                                  ? `retrying again in ${metadata.duration.pipe(Duration.format)}`
                                  : "not retryable"
                              }:`,
                              metadata.input.pipe(Cause.fail),
                            );

                            return isRetryable;
                          }),
                        ),
                      ),
                    ),
                  ),
                ),
                Effect.asVoid,
              );

              yield* db.insert(table).values({
                migrationHash: migration.hash,
                migrationFolderMillis: migration.folderMillis,
                statementIndex: index,
                statementHash: hash,
              });
            }),
            { discard: true },
          ),
        { discard: true },
      );
    });

    return {
      schema,
      table,
      migrate,
    } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

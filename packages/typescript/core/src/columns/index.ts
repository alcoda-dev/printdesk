import { sql } from "drizzle-orm";
import { char, customType, integer, varchar as pgVarchar } from "drizzle-orm/pg-core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { CryptoContract } from "../crypto/contract";
import { EntityId, generateEntityId, ShortId, TenantId, Version } from "../utils";
import { Constants } from "../utils/constants";

import type { Writable } from "drizzle-orm";
import type { PgVarcharConfig } from "drizzle-orm/pg-core";

export namespace Columns {
  export const varchar = <
    TMember extends string,
    TEnum extends Readonly<[TMember, ...Array<TMember>]>,
  >(
    config: PgVarcharConfig<TEnum | Writable<TEnum>> = { length: Constants.VARCHAR_LENGTH },
  ) => pgVarchar(config);

  export const byteSize = customType<{
    driverData: typeof Schema.ByteSizeFromBigInt.Encoded;
    data: typeof Schema.ByteSizeFromBigInt.Type;
  }>({
    dataType: () => "bigint",
    fromDriver: Schema.ByteSizeFromBigInt.pipe(Schema.decodeSync),
    toDriver: Schema.ByteSizeFromBigInt.pipe(Schema.encodeSync),
  });

  export const dateTime = customType<{
    driverData: typeof Schema.DateTimeUtcFromDate.Encoded;
    data: typeof Schema.DateTimeUtcFromDate.Type;
  }>({
    dataType: () => "timestamp",
    fromDriver: Schema.DateTimeUtcFromDate.pipe(Schema.decodeSync),
    toDriver: Schema.DateTimeUtcFromDate.pipe(Schema.encodeSync),
  });

  export const hash = customType<{
    driverData: typeof CryptoContract.HashFromString.Encoded;
    data: typeof CryptoContract.HashFromString.Type;
  }>({
    // 24 (salt, 16B) + 1 (separator) + 88 (derived key, 32B) = 113 characters. Base64 encoded.
    dataType: () => "varchar(113)",
    fromDriver: CryptoContract.HashFromString.pipe(Schema.decodeSync),
    toDriver: CryptoContract.HashFromString.pipe(Schema.encodeSync),
  });

  export const jsonb = <TType, TEncoded extends object>(schema: Schema.Codec<TType, TEncoded>) =>
    customType<{ driverData: TEncoded; data: TType }>({
      dataType: () => "jsonb",
      fromDriver: schema.pipe(Schema.decodeSync),
      toDriver: schema.pipe(Schema.encodeSync),
    })();

  export function union<const TMember extends string>(
    members: ReadonlyArray<TMember>,
    length = Constants.VARCHAR_LENGTH,
  ) {
    const Union = Schema.Literals(members).pipe(Schema.check(Schema.isMaxLength(length)));

    const make = customType<{ driverData: typeof Union.Encoded; data: typeof Union.Type }>({
      dataType: () => `varchar(${length})`,
      fromDriver: Union.pipe(Schema.decodeSync),
      toDriver: Union.pipe(Schema.encodeSync),
    });

    return make();
  }

  /**
   * NanoID column
   */
  export const id = <T>() => char({ length: Constants.NANOID_LENGTH }).$type<T>();

  /**
   * Primary key nanoID column
   */
  export const primaryId = id()
    .$default(() => generateEntityId.pipe(Effect.runSync))
    .primaryKey();

  /**
   * Entity ID column
   */
  export const entityId = () => id<EntityId>();

  /**
   * Short ID column
   */
  export const shortId = () => integer().$type<ShortId>();

  /**
   * Non-nullable Tenant ID column
   */
  export const tenantId = () => id<TenantId>().notNull();

  /**
   * IDs for tenant owned tables (used as composite primary key)
   */
  export const tenant = {
    get id() {
      return entityId()
        .notNull()
        .$defaultFn(() => generateEntityId.pipe(Effect.runSync));
    },
    get tenantId() {
      return tenantId();
    },
  };

  /**
   * Timestamps columns
   */
  export const timestamps = {
    get createdAt() {
      return dateTime()
        .notNull()
        .default(sql`now()`);
    },
    get updatedAt() {
      return dateTime()
        .notNull()
        .default(sql`now()`)
        .$onUpdateFn(DateTime.nowUnsafe);
    },
    get deletedAt() {
      return dateTime();
    },
  };
  export type Timestamp = keyof typeof timestamps;

  /**
   * Version column
   */
  export const version = () => integer().$type<Version>();

  /**
   * Sync version column
   */
  export const syncVersion = {
    get version() {
      return version()
        .notNull()
        .default(Version.make(1))
        .$onUpdateFn(() => sql`version + 1`);
    },
  };

  export type Sync = typeof tenant & typeof timestamps & typeof syncVersion;
  export type NonSync = typeof tenant & typeof timestamps;
  export type Internal = typeof tenant;
}

// oxlint-disable typescript/no-explicit-any typescript/no-unsafe-type-assertion typescript/no-extraneous-class
import * as Array from "effect/Array";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { ColumnsContract } from "../columns/contract";
import { EntityId, generateEntityId, TenantId, Version } from "../utils";

import type { InferSelectModel, InferViewSelectModel } from "drizzle-orm";
import type { PgTable, PgView } from "drizzle-orm/pg-core";
import type { Permissions } from "../permissions";

export namespace TablesContract {
  export class BaseModel extends ColumnsContract.Timestamps.extend<BaseModel>("BaseModel")({
    id: EntityId.pipe(Schema.withDecodingDefaultType(generateEntityId)),
    tenantId: TenantId,
  }) {}

  export class BaseSyncModel extends BaseModel.extend<BaseSyncModel>("BaseSyncModel")({
    version: Version,
  }) {}

  export type InferPermissions<
    TTable extends PgTable,
    TActions extends ReadonlyArray<Permissions.Action>,
  > = {
    [TKey in keyof TActions]: TActions[TKey] extends Permissions.Action
      ? `${TTable["_"]["name"]}:${TActions[TKey]}`
      : never;
  }[number];

  const defaultDtoOmitKeys = ["version"] as const;
  type DefaultDtoOmitKey = (typeof defaultDtoOmitKeys)[number];

  export const Table =
    <TTable extends PgTable = never>(name: TTable["_"]["name"]) =>
    <
      TFields extends Schema.Struct.Fields,
      const TAction extends Permissions.Action,
      const TDtoOmitKey extends keyof TFields = DefaultDtoOmitKey,
    >(
      fields: Schema.Schema.Type<Schema.Struct<TFields>> extends InferSelectModel<TTable>
        ? TFields
        : never,
      actions: ReadonlyArray<TAction>,
      dtoOmitKeys: ReadonlyArray<TDtoOmitKey> = defaultDtoOmitKeys as any,
    ) =>
      class {
        public static readonly name = name;
        public static readonly dtoOmitKeys = dtoOmitKeys;

        public static get Model() {
          return Schema.Struct(fields);
        }

        public static get Dto() {
          return this.Model.mapFields(Struct.omit(this.dtoOmitKeys));
        }

        public static get permissions() {
          return Array.map(
            actions,
            (action) => `${name}:${action}` as InferPermissions<TTable, ReadonlyArray<TAction>>,
          );
        }
      };

  export const UnionTable =
    <TTable extends PgTable = never>(name: TTable["_"]["name"]) =>
    <
      const TMembersFields extends ReadonlyArray<Schema.Struct.Fields>,
      const TAction extends Permissions.Action,
      const TDtoOmitKey extends keyof TMembersFields[number] = DefaultDtoOmitKey,
    >(
      membersFields: Schema.Schema.Type<
        Schema.Union<{ [TKey in keyof TMembersFields]: Schema.Struct<TMembersFields[TKey]> }>
      > extends InferSelectModel<TTable>
        ? TMembersFields
        : never,
      actions: ReadonlyArray<TAction>,
      dtoOmitKeys: ReadonlyArray<TDtoOmitKey> = defaultDtoOmitKeys as any,
    ) =>
      class {
        public static readonly name = name;
        public static readonly dtoOmitKeys = dtoOmitKeys;

        public static get members() {
          return Array.map(membersFields, Schema.Struct) as {
            [TKey in keyof TMembersFields]: Schema.Struct<TMembersFields[TKey]>;
          };
        }

        public static get Model() {
          return Schema.Union(this.members);
        }

        public static get Dto() {
          return Schema.Union(
            Array.map(membersFields, (memberFields) =>
              Schema.Struct(memberFields).mapFields(Struct.omit(dtoOmitKeys)),
            ) as {
              [TKey in keyof TMembersFields]: Schema.Struct<
                Omit<TMembersFields[TKey], TDtoOmitKey>
              >;
            },
          );
        }

        public static get permissions() {
          return Array.map(
            actions,
            (action) => `${name}:${action}` as InferPermissions<TTable, ReadonlyArray<TAction>>,
          );
        }
      };

  export const View =
    <TView extends PgView>(name: TView["_"]["name"]) =>
    <
      TFields extends Schema.Struct.Fields,
      const TDtoOmitKey extends keyof TFields = DefaultDtoOmitKey,
    >(
      fields: Schema.Schema.Type<Schema.Struct<TFields>> extends InferViewSelectModel<TView>
        ? TFields
        : never,
      dtoOmitKeys: ReadonlyArray<TDtoOmitKey> = defaultDtoOmitKeys as any,
    ) =>
      class {
        public static readonly name = name;
        public static readonly dtoOmitKeys = dtoOmitKeys;

        public static get Model() {
          return Schema.Struct(fields);
        }

        public static get Dto() {
          return this.Model.mapFields(Struct.omit(this.dtoOmitKeys));
        }

        public static get permission() {
          return `${name}:read` as const;
        }
      };

  export const UnionView =
    <TView extends PgView>(name: TView["_"]["name"]) =>
    <
      const TMembersFields extends ReadonlyArray<Schema.Struct.Fields>,
      const TDtoOmitKey extends keyof TMembersFields[number] = DefaultDtoOmitKey,
    >(
      membersFields: Schema.Schema.Type<
        Schema.Union<{ [TKey in keyof TMembersFields]: Schema.Struct<TMembersFields[TKey]> }>
      > extends InferViewSelectModel<TView>
        ? TMembersFields
        : never,
      dtoOmitKeys: ReadonlyArray<TDtoOmitKey> = defaultDtoOmitKeys as any,
    ) =>
      class {
        public static readonly name = name;
        public static readonly membersFields = membersFields;
        public static readonly dtoOmitKeys = dtoOmitKeys;

        public static get members() {
          return Array.map(this.membersFields, Schema.Struct) as {
            [TKey in keyof TMembersFields]: Schema.Struct<TMembersFields[TKey]>;
          };
        }

        public static get Model() {
          return Schema.Union(this.members);
        }

        public static get Dto() {
          return Schema.Union(
            Array.map(this.membersFields, (fields) =>
              Schema.Struct(fields).mapFields(Struct.omit(this.dtoOmitKeys)),
            ) as {
              [TKey in keyof TMembersFields]: Schema.Struct<
                Omit<TMembersFields[TKey], TDtoOmitKey>
              >;
            },
          );
        }

        public static get permission() {
          return `${name}:read` as const;
        }
      };

  export const VirtualView =
    <TView extends PgView>() =>
    <
      TName extends string,
      TFields extends Schema.Struct.Fields,
      const TDtoOmitKey extends keyof TFields = DefaultDtoOmitKey,
    >(
      name: TName,
      fields: Schema.Schema.Type<Schema.Struct<TFields>> extends InferViewSelectModel<TView>
        ? TFields
        : never,
      dtoOmitKeys: ReadonlyArray<TDtoOmitKey> = defaultDtoOmitKeys as any,
    ) =>
      class {
        public static readonly name = name;
        public static readonly dtoOmitKeys = dtoOmitKeys;

        public static get Model() {
          return Schema.Struct(fields);
        }

        public static get Dto() {
          return this.Model.mapFields(Struct.omit(this.dtoOmitKeys));
        }

        public static get permission() {
          return `${name}:read` as const;
        }
      };

  export const UnionVirtualView =
    <TView extends PgView>() =>
    <
      TName extends string,
      const TMembersFields extends ReadonlyArray<Schema.Struct.Fields>,
      const TDtoOmitKey extends keyof TMembersFields[number] = DefaultDtoOmitKey,
    >(
      name: TName,
      membersFields: Schema.Schema.Type<
        Schema.Union<{ [TKey in keyof TMembersFields]: Schema.Struct<TMembersFields[TKey]> }>
      > extends InferViewSelectModel<TView>
        ? TMembersFields
        : never,
      dtoOmitKeys: ReadonlyArray<TDtoOmitKey> = defaultDtoOmitKeys as any,
    ) =>
      class {
        public static readonly name = name;
        public static readonly membersFields = membersFields;
        public static readonly dtoOmitKeys = dtoOmitKeys;

        public static get members() {
          return Array.map(membersFields, Schema.Struct) as {
            [TKey in keyof TMembersFields]: Schema.Struct<TMembersFields[TKey]>;
          };
        }

        public static get Model() {
          return Schema.Union(this.members);
        }

        public static get Dto() {
          return Schema.Union(
            Array.map(this.membersFields, (fields) =>
              Schema.Struct(fields).mapFields(Struct.omit(this.dtoOmitKeys)),
            ) as {
              [TKey in keyof TMembersFields]: Schema.Struct<
                Omit<TMembersFields[TKey], TDtoOmitKey>
              >;
            },
          );
        }

        public static get permission() {
          return `${name}:read` as const;
        }
      };

  export const InternalTable =
    <TTable extends PgTable = never>(name: TTable["_"]["name"]) =>
    <TFields extends Schema.Struct.Fields>(
      fields: Schema.Schema.Type<Schema.Struct<TFields>> extends InferSelectModel<TTable>
        ? TFields
        : never,
    ) =>
      class {
        public static readonly name = name;

        public static get Model() {
          return Schema.Struct(fields);
        }
      };
}

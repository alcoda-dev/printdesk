import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { ColumnsContract } from "../columns/contract";
import { Models } from "../models";
import { TablesContract } from "../tables/contract";
import { EntityId, TenantId, Version } from "../utils";
import { ReplicacheContract } from "./contracts";

import type {
  ReplicacheClientGroupsTable,
  ReplicacheClientsTable,
  ReplicacheClientViewEntriesTable,
  ReplicacheClientViewsTable,
  ReplicacheMetaTable,
} from "./sql";

export namespace ReplicacheMetaModel {
  export class Table extends TablesContract.InternalTable<ReplicacheMetaTable>("replicache_meta")({
    key: Schema.String,
    value: Schema.Any,
  }) {}
}

export namespace ReplicacheClientGroupsModel {
  export class Table extends TablesContract.InternalTable<ReplicacheClientGroupsTable>(
    "replicache_client_groups",
  )({
    id: ReplicacheContract.ClientGroupId,
    tenantId: TenantId,
    userId: EntityId,
    clientVersion: Version,
    clientViewVersion: ColumnsContract.NullableVersion,
    ...ColumnsContract.Timestamps.fields,
  }) {}
}

export namespace ReplicacheClientsModel {
  export class Table extends TablesContract.InternalTable<ReplicacheClientsTable>(
    "replicache_clients",
  )({
    id: Schema.String.check(Schema.isUUID()),
    tenantId: TenantId,
    clientGroupId: ReplicacheContract.ClientGroupId,
    lastMutationId: Schema.Int.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      Schema.withDecodingDefaultType(Effect.succeed(0)),
      Schema.withConstructorDefault(Effect.succeed(0)),
    ),
    version: Version,
    ...ColumnsContract.Timestamps.fields,
  }) {}
}

export namespace ReplicacheClientViewsModel {
  export class Table extends TablesContract.InternalTable<ReplicacheClientViewsTable>(
    "replicache_client_views",
  )({
    clientGroupId: ReplicacheContract.ClientGroupId,
    version: Version,
    clientVersion: Version,
    tenantId: TenantId,
  }) {}
}

export namespace ReplicacheClientViewEntriesModel {
  export const entities = Array.map(Models.syncTables, Struct.get("name"));
  export type Entity = (typeof entities)[number];

  export class Table extends TablesContract.InternalTable<ReplicacheClientViewEntriesTable>(
    "replicache_client_view_entries",
  )({
    clientGroupId: ReplicacheContract.ClientGroupId,
    clientViewVersion: Version,
    entity: Schema.Literals(entities),
    entityId: EntityId,
    entityVersion: ColumnsContract.NullableVersion,
    tenantId: TenantId,
  }) {}
}

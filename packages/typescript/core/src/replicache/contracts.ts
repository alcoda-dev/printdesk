// oxlint-disable typescript/no-unsafe-type-assertion
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";
import * as Tuple from "effect/Tuple";

import { Handler } from "../handlers";
import { MutationHandlers } from "../handlers/mutations";
import { PolicyHandlers } from "../handlers/policies";
import { Models } from "../models";
import { Permissions } from "../permissions";
import { ChunkFromArray, EntityId, Version } from "../utils";
import { Constants } from "../utils/constants";

export namespace ReplicacheContract {
  export const ClientGroupId = Schema.String.pipe(
    Schema.check(Schema.isUUID()),
    Schema.brand("ClientGroupId"),
  );
  export type ClientGroupId = typeof ClientGroupId.Type;

  export class ClientStateNotFoundResponse extends Schema.Class<ClientStateNotFoundResponse>(
    "ClientStateNotFoundResponse",
  )({ error: Schema.tag("ClientStateNotFound") }) {}

  export class ClientStateNotFoundError extends Schema.TaggedError<ClientStateNotFoundError>()(
    "ClientStateNotFoundError",
    {
      response: ClientStateNotFoundResponse.pipe(
        Schema.withConstructorDefault(Effect.succeed(new ClientStateNotFoundResponse())),
      ),
    },
  ) {}

  export class VersionNotSupportedResponse extends Schema.Class<VersionNotSupportedResponse>(
    "VersionNotSupportedResponse",
  )({
    error: Schema.tag("VersionNotSupported"),
    versionType: Schema.Literals(["push", "pull", "schema"]).pipe(Schema.optional),
  }) {}

  export class VersionNotSupportedError extends Schema.TaggedError<VersionNotSupportedError>()(
    "VersionNotSupportedError",
    { response: VersionNotSupportedResponse },
  ) {
    public static readonly new = (
      versionType: NonNullable<typeof this.Type.response.versionType>,
    ) => new this({ response: new VersionNotSupportedResponse({ versionType }) });
  }

  export class PullPermission extends Schema.TaggedClass<PullPermission>()(
    "ReplicachePullPermission",
    { permission: Schema.Literals(Permissions.syncReadPermissions) },
  ) {}

  export const PullPolicy = PolicyHandlers.registry.ReplicachePullPolicySchema;
  export type PullPolicy = typeof PullPolicy.Type;

  export class Notification extends Schema.TaggedClass<Notification>()("ReplicacheNotification", {
    clientGroupId: ClientGroupId,
    data: Schema.Union([PullPermission, PullPolicy]).pipe(Schema.Array),
  }) {}

  export const notification = new Handler.Handler({
    name: "/replicache/notification",
    Input: Notification,
    Output: Schema.Void,
  });

  export const poke = new Handler.Handler({
    name: "/replicache/poke",
    Input: Schema.Undefined,
    Output: Schema.Void,
  });
}

export namespace ReplicachePullerContract {
  export class Headers extends Schema.Class<Headers>("Headers")({
    "X-Replicache-RequestID": Schema.String,
  }) {}

  export const Cookie = Schema.Struct({ order: Version }).pipe(Schema.NullOr);

  export const RequestV0 = Schema.Struct({
    pullVersion: Schema.tag(0),
    schemaVersion: Schema.String,
    profileId: Schema.String,
    cookie: Cookie,
    clientId: Schema.String.pipe(Schema.check(Schema.isUUID())),
    lastMutationId: Schema.Int,
  }).pipe(
    Schema.encodeKeys({
      profileId: "profileID",
      clientId: "clientID",
      lastMutationId: "lastMutationID",
    }),
  );
  export type RequestV0 = typeof RequestV0.Type;

  export const RequestV1 = Schema.Struct({
    pullVersion: Schema.tag(1),
    schemaVersion: Schema.String,
    profileId: Schema.String,
    cookie: Cookie,
    clientGroupId: ReplicacheContract.ClientGroupId,
  }).pipe(
    Schema.encodeKeys({
      profileId: "profileID",
      clientGroupId: "clientGroupID",
    }),
  );
  export type RequestV1 = typeof RequestV1.Type;

  export const Request = Schema.Union([RequestV0, RequestV1]);
  export type Request = typeof Request.Type;

  export const isRequestV1 = (request: Request): request is RequestV1 => request.pullVersion === 1;

  export const Payload = Request;
  export type Payload = typeof Payload.Type;

  export const tableKey = <TName extends Models.SyncTableName>(name: TName) =>
    Schema.TemplateLiteralParser([Schema.Literal(name), Schema.Literal("/"), EntityId]);
  export type TableKey<TName extends Models.SyncTableName> = ReturnType<
    typeof tableKey<TName>
  >["Type"];

  export class PutSyncStateOperation extends Schema.Class<PutSyncStateOperation>(
    "PutSyncStateOperation",
  )({
    op: Schema.tag("put"),
    key: Schema.tag(Constants.REPLICACHE_SYNC_STATE_KEY),
    value: Schema.Literals(["PARTIAL", "COMPLETE"]),
  }) {}

  export type PutTableOperationSchemas = {
    readonly [TName in Models.SyncTableName]: Schema.Struct<{
      op: Schema.tag<"put">;
      key: Schema.TemplateLiteralParser<
        readonly [Schema.Literal<TName>, Schema.Literal<"/">, typeof EntityId]
      >;
      value: Models.SyncTableByName<TName>["Dto"];
    }>;
  };

  export const putTableOperationSchemas = Record.fromEntries(
    Array.map(Models.syncTables, (table) =>
      Tuple.make(
        table.name,
        Schema.Struct({ op: Schema.tag("put"), key: tableKey(table.name), value: table.Dto }),
      ),
    ),
  ) as PutTableOperationSchemas;

  export const PutTableOperation = Schema.Union(Record.values(putTableOperationSchemas));
  export type PutTableOperation = typeof PutTableOperation.Type;

  export const makePutTableOperation = <TTableName extends Models.SyncTableName>(
    tableName: TTableName,
    value: Models.SyncTableByName<TTableName>["Dto"]["Type"],
  ) =>
    ({
      op: "put",
      key: [tableName, "/", value.id] as const,
      value,
    }) as Extract<PutTableOperation, { key: TableKey<TTableName> }>;

  export const PutOperation = Schema.Union([PutTableOperation, PutSyncStateOperation]);
  export type PutOperation = typeof PutOperation.Type;

  export type DeleteTableOperationSchemas = {
    readonly [TName in Models.SyncTableName]: Schema.Struct<{
      op: Schema.tag<"del">;
      key: Schema.TemplateLiteralParser<
        [Schema.Literal<TName>, Schema.Literal<"/">, typeof EntityId]
      >;
    }>;
  };

  export const deleteTableOperationSchemas = Record.fromEntries(
    Array.map(Models.syncTables, (table) =>
      Tuple.make(table.name, Schema.Struct({ op: Schema.tag("del"), key: tableKey(table.name) })),
    ),
  ) as DeleteTableOperationSchemas;

  export const DeleteTableOperation = Schema.Union(Record.values(deleteTableOperationSchemas));
  export type DeleteTableOperation = typeof DeleteTableOperation.Type;

  export const makeDeleteTableOperation = <TTableName extends Models.SyncTableName>(
    tableName: TTableName,
    id: Models.SyncTableByName<TTableName>["Dto"]["Type"]["id"],
  ) =>
    ({ op: "del", key: [tableName, "/", id] as const }) as Extract<
      DeleteTableOperation,
      { key: TableKey<TTableName> }
    >;

  export const DeleteOperation = DeleteTableOperation;
  export type DeleteOperation = typeof DeleteOperation.Type;

  export class ClearOperation extends Schema.Class<ClearOperation>("Clear")({
    op: Schema.tag("clear"),
  }) {}

  export const PatchOperation = Schema.Union([PutOperation, DeleteOperation, ClearOperation]);
  export type PatchOperation = typeof PatchOperation.Type;

  export class ResponseOkV0 extends Schema.Class<ResponseOkV0>("ResponseOkV0")({
    cookie: Cookie,
    lastMutationID: Schema.Int,
    patch: PatchOperation.pipe(ChunkFromArray),
  }) {}

  export const ResponseV0 = Schema.Union([
    ResponseOkV0,
    ReplicacheContract.ClientStateNotFoundResponse,
    ReplicacheContract.VersionNotSupportedResponse,
  ]);
  export type ResponseV0 = typeof ResponseV0.Type;

  export const ResponseOkV1 = Schema.Struct({
    cookie: Cookie,
    lastMutationIdChanges: Schema.Record(
      Schema.String.pipe(Schema.check(Schema.isUUID())),
      Version.pipe(Schema.toType),
    ),
    patch: PatchOperation.pipe(ChunkFromArray),
  });
  export type ResponseOkV1 = typeof ResponseOkV1.Type;

  export const ResponseV1 = Schema.Union([
    ResponseOkV1,
    ReplicacheContract.ClientStateNotFoundResponse,
    ReplicacheContract.VersionNotSupportedResponse,
  ]);
  export type ResponseV1 = typeof ResponseV1.Type;

  export const Response = Schema.Union([ResponseV0, ResponseV1]);
  export type Response = typeof Response.Type;

  export const Success = Response.pipe(Schema.toEncoded, HttpApiSchema.status(200));
  export type Success = typeof Success.Type;
}

export namespace ReplicachePusherContract {
  export class Headers extends Schema.Class<Headers>("Headers")({
    "X-Replicache-RequestID": Schema.String,
  }) {}

  export const MutationV0 = MutationHandlers.registry.ReplicacheMutationV0Schema;
  export type MutationV0 = typeof MutationV0.Type;

  export const MutationV1 = MutationHandlers.registry.ReplicacheMutationV1Schema;
  export type MutationV1 = typeof MutationV1.Type;

  export const Mutation = Schema.Union([MutationV0, MutationV1]);
  export type Mutation = typeof Mutation.Type;

  export class FutureMutationError
    extends Schema.TaggedError<FutureMutationError>()(
      "FutureMutationError",
      { mutationId: Schema.Int },
      { httpApiStatus: 400 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(FutureMutationError)(this, { status: 400 });
  }

  export const RequestV0 = Schema.Struct({
    pushVersion: Schema.tag(0),
    clientID: Schema.String.pipe(Schema.check(Schema.isUUID())),
    mutations: MutationV0.pipe(Schema.Array),
    profileID: Schema.String,
    schemaVersion: Schema.String,
  });
  export type RequestV0 = typeof RequestV0.Type;

  export const RequestV1 = Schema.Struct({
    pushVersion: Schema.tag(1),
    clientGroupId: ReplicacheContract.ClientGroupId,
    mutations: MutationV1.pipe(Schema.Array),
    profileId: Schema.String.pipe(Schema.check(Schema.isUUID())),
    schemaVersion: Schema.String,
  }).pipe(Schema.encodeKeys({ clientGroupId: "clientGroupID", profileId: "profileID" }));
  export type RequestV1 = typeof RequestV1.Type;

  export const Request = Schema.Union([RequestV0, RequestV1]);
  export type Request = typeof Request.Type;

  export const isRequestV1 = (request: Request): request is RequestV1 => request.pushVersion === 1;

  export const Payload = Request;
  export type Payload = typeof Payload.Type;

  export const Response = Schema.Union([
    ReplicacheContract.ClientStateNotFoundResponse,
    ReplicacheContract.VersionNotSupportedResponse,
  ]).pipe(Schema.UndefinedOr);
  export type Response = typeof Response.Type;

  export const Success = Response.pipe(Schema.toEncoded, HttpApiSchema.status(200));
  export type Success = typeof Success.Type;
}

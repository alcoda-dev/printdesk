import { AccessControl } from "@printdesk/core/access-control";
import { ActorLayerMap } from "@printdesk/core/actors";
import { Api } from "@printdesk/core/api";
import { Oauth } from "@printdesk/core/oauth";
import { Scim } from "@printdesk/core/scim";
import { ScimContract } from "@printdesk/core/scim/contract";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Struct from "effect/Struct";

import { openauthLayer } from "../lib/auth";
import { scimLayer, scimLocatorLayer } from "../lib/scim";
import {
  scimAuthMiddlewareLayer,
  scimBulkIdMapMiddlewareLayer,
  scimErrorMiddlewareLayer,
  scimHttpApiSchemaErrorHandlerMiddlewareLayer,
  scimLocatorMiddlewareLayer,
} from "../middleware/scim";

export const scimV2RootGroupLayer = HttpApiBuilder.group(Api, "ScimV2Root", (handlers) =>
  handlers.handle(
    "root",
    Effect.fn("Api.ScimV2Root.root")(() => new ScimContract.V2NotFoundError()),
  ),
);

export const baseScimV2ServiceProviderConfigGroupLayer = HttpApiBuilder.group(
  Api,
  "ScimV2ServiceProviderConfig",
  Effect.fn(function* (handlers) {
    const scim = yield* Scim;

    return handlers.handle(
      "discover",
      Effect.fn("Api.ScimV2ServiceProviderConfig.discover")(
        () => scim.discoverServiceProviderConfig,
      ),
    );
  }),
);

export const scimV2ServiceProviderConfigGroupLayer = baseScimV2ServiceProviderConfigGroupLayer.pipe(
  Layer.provide([scimHttpApiSchemaErrorHandlerMiddlewareLayer, scimLayer]),
);

export const baseScimV2ResourceTypesGroupLayer = HttpApiBuilder.group(
  Api,
  "ScimV2ResourceTypes",
  Effect.fn(function* (handlers) {
    const scim = yield* Scim;

    return handlers
      .handle(
        "discover",
        Effect.fn("Api.ScimV2ResourceTypes.discover")(() =>
          scim.discoverResourceTypes.pipe(Effect.flatMap(Struct.get("list"))),
        ),
      )
      .handle(
        "retrieve",
        Effect.fn("Api.ScimV2ResourceTypes.retrieve")(({ params }) =>
          scim.retrieveResourceType(params.name),
        ),
      );
  }),
);

export const scimV2ResourceTypesGroupLayer = baseScimV2ResourceTypesGroupLayer.pipe(
  Layer.provide([scimHttpApiSchemaErrorHandlerMiddlewareLayer, scimLayer]),
);

export const baseScimV2SchemasGroupLayer = HttpApiBuilder.group(
  Api,
  "ScimV2Schemas",
  Effect.fn(function* (handlers) {
    const scim = yield* Scim;

    return handlers
      .handle(
        "discover",
        Effect.fn("Api.ScimV2Schemas.discover")(() =>
          scim.discoverSchemas.pipe(Effect.flatMap(Struct.get("list"))),
        ),
      )
      .handle(
        "retrieve",
        Effect.fn("Api.ScimV2Schemas.retrieve")(({ params }) => scim.retrieveSchema(params.id)),
      );
  }),
);

export const scimV2SchemasGroupLayer = baseScimV2SchemasGroupLayer.pipe(
  Layer.provide([scimHttpApiSchemaErrorHandlerMiddlewareLayer, scimLayer]),
);

export const baseScimV2GroupsGroupLayer = HttpApiBuilder.group(
  Api,
  "ScimV2Groups",
  Effect.fn(function* (handlers) {
    const scim = yield* Scim;

    return handlers
      .handle(
        "query",
        Effect.fn("Api.ScimV2Groups.query")(({ query }) =>
          scim.queryGroups(query.filter).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("groups:read"),
                AccessControl.permissionPolicy("group_memberships:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      )
      .handle(
        "retrieve",
        Effect.fn("Api.ScimV2Groups.retrieve")(({ params }) =>
          scim.retrieveGroup(params.id).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("groups:read"),
                AccessControl.permissionPolicy("group_memberships:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      )
      .handle(
        "create",
        Effect.fn("Api.ScimV2Groups.create")(({ payload }) =>
          scim.createGroup(payload).pipe(
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("groups:create"),
                AccessControl.permissionPolicy("group_memberships:create"),
                AccessControl.permissionPolicy("groups:read"),
                AccessControl.permissionPolicy("group_memberships:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "replace",
        Effect.fn("Api.ScimV2Groups.replace")(({ params, payload }) =>
          Effect.succeed(payload).pipe(
            Effect.filterOrFail(
              (payload) => payload.group.id === params.id,
              () =>
                new ScimContract.V2BadRequestError({
                  scimType: "mutability",
                  detail: "Attribute 'id' is readOnly`",
                }),
            ),
            Effect.flatMap(scim.replaceGroup),
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("groups:update"),
                AccessControl.permissionPolicy("group_memberships:update"),
                AccessControl.permissionPolicy("groups:read"),
                AccessControl.permissionPolicy("group_memberships:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "modify",
        Effect.fn("Api.ScimV2Groups.modify")(({ params, payload }) =>
          scim.modifyGroup(params.id, payload.Operations).pipe(
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("groups:update"),
                AccessControl.permissionPolicy("group_memberships:update"),
                AccessControl.permissionPolicy("groups:read"),
                AccessControl.permissionPolicy("group_memberships:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "delete",
        Effect.fn("Api.ScimV2Groups.delete")(({ params }) =>
          scim.deleteGroup(params.id).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(AccessControl.permissionPolicy("groups:delete")),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      );
  }),
);

export const scimV2GroupsGroupLayer = baseScimV2GroupsGroupLayer.pipe(
  Layer.provide([
    scimAuthMiddlewareLayer,
    scimLocatorMiddlewareLayer,
    scimHttpApiSchemaErrorHandlerMiddlewareLayer,
    scimLayer,
  ]),
  Layer.provide([
    ActorLayerMap.layer,
    openauthLayer,
    Oauth.AccessTokenLayerMap.layer,
    scimLocatorLayer,
  ]),
);

export const baseScimV2UsersGroupLayer = HttpApiBuilder.group(
  Api,
  "ScimV2Users",
  Effect.fn(function* (handlers) {
    const scim = yield* Scim;

    return handlers
      .handle(
        "query",
        Effect.fn("Api.ScimV2Users.query")(({ query }) =>
          scim.queryUsers(query.filter).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(AccessControl.permissionPolicy("users:read")),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      )
      .handle(
        "retrieve",
        Effect.fn("Api.ScimV2Users.retrieve")(({ params }) =>
          scim.retrieveUser(params.id).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(AccessControl.permissionPolicy("users:read")),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      )
      .handle(
        "create",
        Effect.fn("Api.ScimV2Users.create")(({ payload }) =>
          scim.createUser(payload).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("users:create"),
                AccessControl.permissionPolicy("users:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      )
      .handle(
        "replace",
        Effect.fn("Api.ScimV2Users.replace")(({ params, payload }) =>
          Effect.succeed(payload).pipe(
            Effect.filterOrFail(
              (payload) => payload.id === params.id,
              () =>
                new ScimContract.V2BadRequestError({
                  scimType: "mutability",
                  detail: "Attribute 'id' is readOnly`",
                }),
            ),
            Effect.flatMap(scim.replaceUser),
            orDieWhenUnrespondable,
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("users:update"),
                AccessControl.permissionPolicy("users:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      )
      .handle(
        "modify",
        Effect.fn("Api.ScimV2Users.modify")(({ params, payload }) =>
          scim.modifyUser(params.id, payload.Operations).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.permissionPolicy("users:update"),
                AccessControl.permissionPolicy("users:read"),
              ),
            ),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      )
      .handle(
        "delete",
        Effect.fn("Api.ScimV2Users.delete")(({ params }) =>
          scim.deleteUser(params.id).pipe(
            orDieWhenUnrespondable,
            AccessControl.enforce(AccessControl.permissionPolicy("users:delete")),
            Effect.catchTag(
              ["ForbiddenActorError", "AccessDeniedError"],
              (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
            ),
          ),
        ),
      );
  }),
);

export const scimV2UsersGroupLayer = baseScimV2UsersGroupLayer.pipe(
  Layer.provide([
    scimAuthMiddlewareLayer,
    scimLocatorMiddlewareLayer,
    scimHttpApiSchemaErrorHandlerMiddlewareLayer,
    scimLayer,
  ]),
  Layer.provide([
    ActorLayerMap.layer,
    openauthLayer,
    Oauth.AccessTokenLayerMap.layer,
    scimLocatorLayer,
  ]),
);

export const baseScimV2BulkGroupLayer = HttpApiBuilder.group(
  Api,
  "ScimV2Bulk",
  Effect.fn(function* (handlers) {
    const scim = yield* Scim;

    return handlers.handle(
      "create",
      Effect.fn("Api.ScimV2Bulk.create")(function* ({ payload, request }) {
        const maxPayloadSize = yield* HttpIncomingMessage.MaxBodySize.pipe(
          Effect.map(Option.fromUndefinedOr),
        );
        if (
          Option.isSome(maxPayloadSize) &&
          (yield* request.arrayBuffer.pipe(
            Effect.orDie,
            Effect.map(Struct.get("byteLength")),
            Effect.map(ByteSize.fromInputUnsafe),
            Effect.map(ByteSize.isGreaterThan(maxPayloadSize.value)),
          ))
        )
          return yield* new ScimContract.V2ContentTooLargeError({
            detail: `The size of the bulk operation exceeds the maxPayloadSize (${ByteSize.format(maxPayloadSize.value)}).`,
          });

        return yield* scim.bulkCreate(payload).pipe(
          orDieWhenUnrespondable,
          AccessControl.enforce(
            AccessControl.every(
              AccessControl.permissionPolicy("groups:create"),
              AccessControl.permissionPolicy("group_memberships:create"),
              AccessControl.permissionPolicy("users:create"),
            ),
          ),
          Effect.catchTag(
            ["ForbiddenActorError", "AccessDeniedError"],
            (e) => new ScimContract.V2ForbiddenError({ detail: e.message }),
          ),
        );
      }),
    );
  }),
);

export const scimV2BulkGroupLayer = baseScimV2BulkGroupLayer.pipe(
  Layer.provideMerge(
    Layer.succeed(
      HttpIncomingMessage.MaxBodySize,
      ScimContract.V2ServiceProviderConfig.maxBulkPayloadSize,
    ),
  ),
  Layer.provide([
    scimAuthMiddlewareLayer,
    scimBulkIdMapMiddlewareLayer,
    scimHttpApiSchemaErrorHandlerMiddlewareLayer,
    scimLocatorMiddlewareLayer,
    scimLayer,
  ]),
  Layer.provide([
    ActorLayerMap.layer,
    openauthLayer,
    Oauth.AccessTokenLayerMap.layer,
    scimLocatorLayer,
  ]),
);

export const scimGroupsLayer = Layer.mergeAll(
  scimV2RootGroupLayer,
  scimV2ServiceProviderConfigGroupLayer,
  scimV2ResourceTypesGroupLayer,
  scimV2SchemasGroupLayer,
  scimV2GroupsGroupLayer,
  scimV2UsersGroupLayer,
  scimV2BulkGroupLayer,
).pipe(Layer.provide(scimErrorMiddlewareLayer));

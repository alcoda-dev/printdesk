import * as Array from "effect/Array";
import * as Cause from "effect/Cause";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Function from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Number from "effect/Number";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Predicate from "effect/Predicate";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as String from "effect/String";
import * as Struct from "effect/Struct";
import * as SynchronizedRef from "effect/SynchronizedRef";
import * as Tuple from "effect/Tuple";
import {
  InvalidScimPatchOp,
  InvalidScimPatchRequest,
  NoPathInScimPatchOp,
  NoTarget,
  RemoveValueNestedArrayNotSupported,
  RemoveValueNotArray,
  scimPatch,
} from "scim-patch";

import { Scim } from ".";
import { Actor } from "../actors";
import { AssetsContract } from "../assets/contract";
import { CloudflareClient } from "../cloudflare/client";
import { Database } from "../database";
import { GroupMembershipsContract, GroupsContract } from "../groups/contracts";
import { GroupMembershipsRepository } from "../groups/memberships/repositories";
import { GroupsRepository } from "../groups/repositories";
import { SstResource } from "../sst/resource";
import { UsersContract } from "../users/contract";
import { UsersRepository } from "../users/repositories";
import { ScimBulkIdMap } from "./bulk-id-map";
import { ScimContract } from "./contract";
import { ScimLocator } from "./locator";

import type { ScimPatchOperation, ScimResource } from "scim-patch";
import type { Group, GroupMembership } from "../groups/sql";
import type { User } from "../users/sql";

export type ServiceShape = Effect.Success<typeof makeService>;

interface GroupMembershipRelation {
  group: Group;
  groupMembership: GroupMembership | null;
}

export const makeService = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const locator = yield* ScimLocator;

  const db = yield* Database;
  const groupsRepository = yield* GroupsRepository;
  const groupMembershipsRepository = yield* GroupMembershipsRepository;
  const usersRepository = yield* UsersRepository;

  const cloudflare = yield* CloudflareClient;
  const userAvatarsQueue = yield* SstResource.useSync(
    Struct.get("UserAvatarsQueueProperties"),
  ).pipe(Effect.map(Redacted.value));

  const tenantIdEffect = Effect.suspend(() =>
    Actor.tenantId.pipe(
      Effect.mapError((error) => new ScimContract.V2ForbiddenError({ detail: error.message })),
    ),
  );

  const groupMembershipRelations = Effect.fn((relations: Array<GroupMembershipRelation>) =>
    Stream.fromArray(relations).pipe(
      Stream.groupBy(({ group, groupMembership }) =>
        Effect.succeed(Tuple.make(group, groupMembership)),
      ),
      Stream.mapEffect(([group, groupMembershipsStream]) =>
        groupMembershipsStream.pipe(
          Stream.filter(Predicate.isNotNull),
          Stream.filter((membership) => membership.deletedAt === null),
          Stream.runCollect,
          Effect.map((groupMemberships) => GroupsContract.Dtos.make({ group, groupMemberships })),
        ),
      ),
      Stream.filter(({ group }) => group.deletedAt === null),
      Stream.runCollect,
    ),
  );

  const patch = Function.dual<
    <TScimResource extends ScimResource>(
      patchOperations: Array<ScimPatchOperation>,
    ) => (
      scimResource: TScimResource,
    ) => Effect.Effect<
      TScimResource,
      ScimContract.V2BadRequestError | ScimContract.V2InternalServerError
    >,
    <TScimResource extends ScimResource>(
      scimResource: TScimResource,
      patchOperations: Array<ScimPatchOperation>,
    ) => Effect.Effect<
      TScimResource,
      ScimContract.V2BadRequestError | ScimContract.V2InternalServerError
    >
  >(
    2,
    Effect.fn("Scim.patch")((...args) =>
      Effect.try({
        try: () => scimPatch(...args),
        catch: (error) =>
          Match.value(error).pipe(
            Match.whenOr(
              Match.instanceOf(InvalidScimPatchOp),
              Match.instanceOf(InvalidScimPatchRequest),
              Match.instanceOf(RemoveValueNestedArrayNotSupported),
              Match.instanceOf(RemoveValueNotArray),
              (invalidSyntax) =>
                new ScimContract.V2BadRequestError({
                  scimType: "invalidSyntax",
                  detail: invalidSyntax.message,
                }),
            ),
            Match.whenOr(
              Match.instanceOf(NoPathInScimPatchOp),
              Match.instanceOf(NoTarget),
              (noTarget) =>
                new ScimContract.V2BadRequestError({
                  scimType: "noTarget",
                  detail: noTarget.message,
                }),
            ),
            Match.orElse(() => new ScimContract.V2InternalServerError()),
          ),
      }),
    ),
  );

  const discoverServiceProviderConfig = Effect.gen(function* () {
    const created = DateTime.makeUnsafe({ year: 2026, month: 7, day: 7 }).pipe(DateTime.toDate);
    const lastModified = created;
    const location = yield* locator.serviceProviderConfig.pipe(Effect.map(Struct.get("href")));

    return new ScimContract.V2ServiceProviderConfig({
      patch: { supported: true },
      bulk: {
        supported: true,
        maxOperations: ScimContract.V2ServiceProviderConfig.maxBulkOperations,
        maxPayloadSize: ScimContract.V2ServiceProviderConfig.maxBulkPayloadSize,
      },
      filter: {
        supported: true,
        maxResults: ScimContract.V2ServiceProviderConfig.maxFilterResults,
      },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description:
            "Authentication scheme using the authorization header with a bearer token associated with a identity provider and it's tenant.",
        },
      ],
      meta: {
        resourceType: "ServiceProviderConfig",
        created,
        lastModified,
        location,
      },
    });
  }).pipe(Effect.withSpan("Scim.discoverServiceProviderConfig"));

  const discoverResourceTypes = Effect.sync(function () {
    const record = Effect.all({
      User: locator.resourceType("User").pipe(
        Effect.map(Struct.get("href")),
        Effect.map(
          (location) =>
            new ScimContract.V2ResourceType({
              id: "User",
              name: "User",
              endpoint: "/Users",
              description: "User account",
              schema: ScimContract.v2UserUri,
              meta: { resourceType: "ResourceType", location },
            }),
        ),
      ),
      Group: locator.resourceType("Group").pipe(
        Effect.map(Struct.get("href")),
        Effect.map(
          (location) =>
            new ScimContract.V2ResourceType({
              id: "Group",
              name: "Group",
              endpoint: "/Groups",
              description: "Group account",
              schema: ScimContract.v2GroupUri,
              meta: { resourceType: "ResourceType", location },
            }),
        ),
      ),
    });

    const list = record.pipe(
      Effect.map(
        (record) =>
          new ScimContract.V2ListResponse({
            itemsPerPage: Record.size(record),
            totalResults: Record.size(record),
            startIndex: 1,
            Resources: Record.values(record),
          }),
      ),
    );

    return { record, list } as const;
  }).pipe(Effect.withSpan("Scim.discoverResourceTypes"));

  const retrieveResourceType = Effect.fn("Scim.retrieveResourceType")(
    (name: keyof Effect.Success<Effect.Success<typeof discoverResourceTypes>["record"]>) =>
      discoverResourceTypes.pipe(
        Effect.flatMap(Struct.get("record")),
        Effect.map(Struct.get(name)),
      ),
  );

  const userAttributes = yield* ScimContract.v2UserSchemaAttributes;
  const groupAttributes = yield* ScimContract.v2GroupSchemaAttributes;

  const discoverSchemas = Effect.sync(function () {
    const record = Effect.all({
      [ScimContract.v2UserUri]: locator.schema(ScimContract.v2UserUri).pipe(
        Effect.map(Struct.get("href")),
        Effect.map(
          (location) =>
            new ScimContract.V2Schema({
              id: ScimContract.v2UserUri,
              name: "User",
              description: "User account",
              attributes: userAttributes,
              meta: { resourceType: "Schema", location },
            }),
        ),
      ),
      [ScimContract.v2GroupUri]: locator.schema(ScimContract.v2GroupUri).pipe(
        Effect.map(Struct.get("href")),
        Effect.map(
          (location) =>
            new ScimContract.V2Schema({
              id: ScimContract.v2GroupUri,
              name: "Group",
              description: "Group account",
              attributes: groupAttributes,
              meta: { resourceType: "Schema", location },
            }),
        ),
      ),
    });

    const list = record.pipe(
      Effect.map(
        (record) =>
          new ScimContract.V2ListResponse({
            itemsPerPage: Record.size(record),
            totalResults: Record.size(record),
            startIndex: 1,
            Resources: Record.values(record),
          }),
      ),
    );

    return { record, list } as const;
  }).pipe(Effect.withSpan("Scim.discoverSchemas"));

  const retrieveSchema = Effect.fn("Scim.retrieveSchema")(
    (id: keyof Effect.Success<Effect.Success<typeof discoverSchemas>["record"]>) =>
      discoverSchemas.pipe(Effect.flatMap(Struct.get("record")), Effect.map(Struct.get(id))),
  );

  const queryGroups = Effect.fn("Scim.queryGroups")(function* (filter?: ScimContract.V2Filter) {
    const tenantId = yield* tenantIdEffect;

    if (!filter)
      return yield* groupsRepository
        .findWithMembershipsByTenantId(tenantId)
        .pipe(
          Effect.catchNoSuchElement,
          Effect.map(Option.getOrElse(Array.empty<GroupMembershipRelation>)),
          Effect.flatMap(groupMembershipRelations),
        );

    if (filter.op !== "eq")
      return yield* new ScimContract.V2BadRequestError({
        scimType: "invalidFilter",
        detail: `"${filter.op}" operator is not supported`,
      });

    const attributePath = yield* Effect.succeed(filter.attrPath).pipe(
      Effect.flatMap(Schema.decodeEffect(ScimContract.V2Group.SupportedFilterAttributePath)),
      Effect.mapError(
        (error) =>
          new ScimContract.V2BadRequestError({
            scimType: "invalidFilter",
            detail: error.message,
          }),
      ),
    );

    return yield* Match.value(attributePath).pipe(
      Match.when(Match.is("externalid"), () =>
        Effect.succeed(filter.compValue).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(GroupsContract.ExternalId)),
          Effect.catchTag(
            "SchemaError",
            (error) =>
              new ScimContract.V2BadRequestError({
                scimType: "invalidValue",
                detail: error.message,
              }),
          ),
          Effect.flatMap((externalId) =>
            groupsRepository.findWithMembershipsByExternalId(externalId, tenantId),
          ),
          Effect.catchNoSuchElement,
          Effect.map(Option.getOrElse(Array.empty<GroupMembershipRelation>)),
        ),
      ),
      Match.exhaustive,
      Effect.flatMap(groupMembershipRelations),
    );
  });

  const retrieveGroup = Effect.fn("Scim.retrieveGroup")((id: Group["id"]) =>
    tenantIdEffect.pipe(
      Effect.flatMap((tenantId) => groupsRepository.findWithMembershipsById(id, tenantId)),
      Effect.flatMap(groupMembershipRelations),
      Effect.map(Array.head),
      Effect.flatMap(Effect.fromOption),
      Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
    ),
  );

  const createGroup = Effect.fn("Scim.createGroup")(
    (provisional: GroupsContract.ProvisionalDtos) =>
      db.useTransaction(
        Effect.fn(function* () {
          const group = yield* groupsRepository.create(provisional.group);

          const groupMembershipsRef = yield* Ref.make(
            Array.empty<typeof GroupMembershipsContract.Table.Model.Type>(),
          );

          if (Array.isReadonlyArrayNonEmpty(provisional.groupMemberships))
            yield* groupMembershipsRepository
              .createMany(
                Array.map(provisional.groupMemberships, Struct.assign({ groupId: group.id })),
              )
              .pipe(
                Effect.flatMap((memberships) => groupMembershipsRef.pipe(Ref.set(memberships))),
              );

          return yield* groupMembershipsRef.pipe(
            Ref.get,
            Effect.map((groupMemberships) => GroupsContract.Dtos.make({ group, groupMemberships })),
          );
        }),
      ),
    (effect) =>
      effect.pipe(
        Effect.catchReason(
          "SqlError",
          "UniqueViolation",
          (reason) =>
            new ScimContract.V2ConflictError({ scimType: "uniqueness", detail: reason.message }),
        ),
      ),
  );

  const replaceGroup = Effect.fn("Scim.replaceGroup")(
    (dtos: GroupsContract.Dtos) =>
      db.useTransaction(
        Effect.fn(function* () {
          const group = yield* groupsRepository.updateById(
            dtos.group.id,
            dtos.group,
            dtos.group.tenantId,
          );

          yield* DateTime.now.pipe(
            Effect.flatMap((deletedAt) =>
              groupMembershipsRepository.updateByGroupId(group.id, { deletedAt }, group.tenantId),
            ),
          );

          const groupMembershipsRef = yield* Ref.make(
            Array.empty<typeof GroupMembershipsContract.Table.Model.Type>(),
          );

          if (Array.isReadonlyArrayNonEmpty(dtos.groupMemberships))
            yield* groupMembershipsRepository
              .createMany(Array.map(dtos.groupMemberships, Struct.assign({ groupId: group.id })))
              .pipe(
                Effect.flatMap((memberships) => groupMembershipsRef.pipe(Ref.set(memberships))),
              );

          return yield* groupMembershipsRef.pipe(
            Ref.get,
            Effect.map((groupMemberships) => GroupsContract.Dtos.make({ group, groupMemberships })),
          );
        }),
      ),
    (effect) =>
      effect.pipe(
        Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
        Effect.catchReason(
          "SqlError",
          "UniqueViolation",
          (reason) =>
            new ScimContract.V2ConflictError({ scimType: "uniqueness", detail: reason.message }),
        ),
      ),
  );

  const modifyGroup = Effect.fn("Scim.modifyGroup")(
    (id: Group["id"], operations: typeof ScimContract.V2Patch.Type.Operations) =>
      tenantIdEffect.pipe(
        Effect.flatMap((tenantId) =>
          db.useTransaction(() =>
            groupsRepository
              .findWithMembershipsByIdForUpdate(id, tenantId)
              .pipe(
                Effect.flatMap(groupMembershipRelations),
                Effect.map(Array.head),
                Effect.flatMap(Effect.fromOption),
                Effect.flatMap(Schema.encodeEffect(ScimContract.V2Group.ToDtos)),
                Effect.flatMap(Schema.decodeEffect(ScimContract.V2Group)),
                Effect.flatMap(patch(operations)),
                Effect.flatMap(Schema.encodeEffect(ScimContract.V2Group)),
                Effect.flatMap(Schema.decodeEffect(ScimContract.V2Group.ToDtos)),
                Effect.flatMap(replaceGroup),
              ),
          ),
        ),
        Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
        Effect.catchReason(
          "SqlError",
          "UniqueViolation",
          (reason) =>
            new ScimContract.V2ConflictError({ scimType: "uniqueness", detail: reason.message }),
        ),
      ),
  );

  const deleteGroup = Effect.fn("Scim.deleteGroup")((id: Group["id"]) =>
    Effect.all([DateTime.now, tenantIdEffect]).pipe(
      Effect.flatMap(([deletedAt, tenantId]) =>
        Effect.all(
          [
            groupsRepository.updateById(id, { deletedAt }, tenantId),
            groupMembershipsRepository.updateByGroupId(id, { deletedAt }, tenantId),
          ],
          { concurrency: "unbounded", discard: true },
        ),
      ),
      Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
    ),
  );

  const queryUsers = Effect.fn("Scim.queryUsers")(function* (filter?: ScimContract.V2Filter) {
    const tenantId = yield* tenantIdEffect;

    if (!filter) return yield* usersRepository.findByTenantId(tenantId);

    if (filter.op !== "eq")
      return yield* new ScimContract.V2BadRequestError({
        scimType: "invalidFilter",
        detail: `"${filter.op}" operator is not supported`,
      });

    const attributePath = yield* Effect.succeed(filter.attrPath).pipe(
      Effect.flatMap(Schema.decodeEffect(ScimContract.V2User.SupportedFilterAttributePath)),
      Effect.mapError(
        (error) =>
          new ScimContract.V2BadRequestError({ scimType: "invalidFilter", detail: error.message }),
      ),
    );

    return yield* Match.value(attributePath).pipe(
      Match.when(Match.is("externalid"), () =>
        Effect.succeed(filter.compValue).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(UsersContract.ExternalId)),
          Effect.flatMap((externalId) => usersRepository.findByExternalId(externalId, tenantId)),
        ),
      ),
      Match.when(Match.is("username"), () =>
        Effect.succeed(filter.compValue).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(UsersContract.Username)),
          Effect.flatMap((username) => usersRepository.findByUsername(username, tenantId)),
        ),
      ),
      Match.exhaustive,
      Effect.catchTag(
        "SchemaError",
        (error) =>
          new ScimContract.V2BadRequestError({
            scimType: "invalidValue",
            detail: error.message,
          }),
      ),
      Effect.map(Array.make),
      Effect.catchNoSuchElement,
      Effect.map(Option.getOrElse(Array.empty<User>)),
      Effect.flatMap(Effect.filter((user) => user.deletedAt === null)),
    );
  });

  const retrieveUser = Effect.fn("Scim.retrieveUser")((id: User["id"]) =>
    tenantIdEffect.pipe(
      Effect.flatMap((tenantId) => usersRepository.findById(id, tenantId)),
      Effect.filterOrFail((user) => user.deletedAt === null),
      Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
    ),
  );

  const createUser = Effect.fn("Scim.createUser")(
    (provisional: UsersContract.ProvisionalDto) =>
      usersRepository.createWithIdentityProvider(provisional),
    Effect.catchReason(
      "SqlError",
      "UniqueViolation",
      (reason) =>
        new ScimContract.V2ConflictError({ scimType: "uniqueness", detail: reason.message }),
    ),
    Effect.tap(({ user, identityProvider }) =>
      AssetsContract.UserAvatarQueueMessage.makeEffect({
        tenantId: user.tenantId,
        user,
        identityProvider,
      }).pipe(
        Effect.flatMap(Schema.encodeEffect(AssetsContract.UserAvatarQueueMessage)),
        Effect.flatMap((body) =>
          cloudflare.pushQueueMessage(userAvatarsQueue.id, { content_type: "json", body }),
        ),
        Effect.ignoreCause({
          log: true,
          message: `Tenant "${user.tenantId}" user "${user.id}" avatar queue message push failed.`,
        }),
      ),
    ),
    Effect.map(Struct.get("user")),
  );

  const replaceUser = Effect.fn("Scim.replaceUser")((user: typeof UsersContract.Table.Dto.Type) =>
    usersRepository.updateById(user.id, user, user.tenantId).pipe(
      Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
      Effect.catchReason(
        "SqlError",
        "UniqueViolation",
        (reason) =>
          new ScimContract.V2ConflictError({ scimType: "uniqueness", detail: reason.message }),
      ),
    ),
  );

  const modifyUser = Effect.fn("Scim.modifyUser")(
    (id: User["id"], operations: typeof ScimContract.V2Patch.Type.Operations) =>
      tenantIdEffect.pipe(
        Effect.flatMap((tenantId) =>
          db.useTransaction(() =>
            usersRepository.findByIdForUpdate(id, tenantId).pipe(
              Effect.filterOrFail((user) => user.deletedAt === null),
              Effect.flatMap(Schema.encodeEffect(ScimContract.V2User.ToDto)),
              Effect.flatMap(Schema.decodeEffect(ScimContract.V2User)),
              Effect.flatMap(patch(operations)),
              Effect.flatMap(Schema.encodeEffect(ScimContract.V2User)),
              Effect.flatMap(Schema.decodeEffect(ScimContract.V2User.ToDto)),
              Effect.flatMap(replaceUser),
            ),
          ),
        ),
        Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
        Effect.catchReason(
          "SqlError",
          "UniqueViolation",
          (reason) =>
            new ScimContract.V2ConflictError({
              scimType: "uniqueness",
              detail: reason.message,
            }),
        ),
      ),
  );

  const deleteUser = Effect.fn("Scim.deleteUser")((id: User["id"]) =>
    Effect.all([DateTime.now, tenantIdEffect]).pipe(
      Effect.flatMap(([deletedAt, tenantId]) =>
        Effect.all(
          [
            groupMembershipsRepository.updateByUserId(id, { deletedAt }, tenantId),
            usersRepository.updateById(id, { deletedAt, status: "suspended" }, tenantId),
          ],
          { concurrency: "unbounded", discard: true },
        ),
      ),
      Effect.catchTag("NoSuchElementError", () => new ScimContract.V2NotFoundError()),
    ),
  );

  const bulkCreate = Effect.fn("Scim.bulkCreate")(function* (request: ScimContract.V2BulkRequest) {
    const bulkIdMap = yield* ScimBulkIdMap;
    const errorCountRef = yield* SynchronizedRef.make(0);

    return yield* Effect.succeed(request.Operations).pipe(
      Effect.map(
        Array.sortWith(
          Struct.get("_tag"),
          Order.make<ScimContract.V2BulkRequestOperation["_tag"]>((self, that) =>
            Match.value({ self, that }).pipe(
              Match.whenAnd(
                {
                  self: Match.is(
                    ScimContract.V2CreateUserBulkRequestOperation.fields._tag.to.schema.literal,
                  ),
                },
                {
                  that: Match.is(
                    ScimContract.V2CreateGroupBulkRequestOperation.fields._tag.to.schema.literal,
                  ),
                },
                () => -1 as const,
              ),
              Match.whenAnd(
                {
                  self: Match.is(
                    ScimContract.V2CreateGroupBulkRequestOperation.fields._tag.to.schema.literal,
                  ),
                },
                {
                  that: Match.is(
                    ScimContract.V2CreateUserBulkRequestOperation.fields._tag.to.schema.literal,
                  ),
                },
                () => 1 as const,
              ),
              Match.orElse(() => 0 as const),
            ),
          ),
        ),
      ),
      Stream.fromArrayEffect,
      Stream.mapEffect((operation) =>
        Match.valueTags(operation, {
          ScimV2CreateUserBulkRequestOperation: ({ bulkId, data }) =>
            createUser(data).pipe(
              Effect.map(Struct.get("id")),
              Effect.tap((userId) => bulkIdMap.set(bulkId, userId)),
              Effect.flatMap(locator.user),
            ),
          ScimV2CreateGroupBulkRequestOperation: ({ data }) =>
            Effect.succeed(data).pipe(
              Effect.flatMap(Schema.decodeEffect(GroupsContract.BulkProvisionalDtos.ToNonBulk)),
              Effect.mapError((error) =>
                error.issue._tag === "MissingKey"
                  ? new ScimContract.V2BadRequestError({
                      scimType: "noTarget",
                      detail: error.message,
                    })
                  : error,
              ),
              Effect.flatMap(createGroup),
              Effect.map(({ group }) => group.id),
              Effect.flatMap(locator.group),
            ),
        }).pipe(
          Effect.map(Struct.get("href")),
          Effect.map((location) =>
            ScimContract.V2BulkResponseOperation.make({
              location,
              bulkId: operation.bulkId,
              status: { code: 201 },
            }),
          ),
          Effect.tapCause(() => errorCountRef.pipe(SynchronizedRef.update(Number.increment))),
          Effect.catchCause((cause) =>
            Cause.findError(cause).pipe(
              Result.filterOrFail((error) => ScimContract.V2Error.guard(error), Cause.fail),
              Result.match({
                onSuccess: (response) =>
                  Effect.succeed(
                    ScimContract.V2BulkResponseOperation.make({
                      bulkId: operation.bulkId,
                      status: { code: response.status },
                      response,
                    }),
                  ),
                onFailure: (cause) =>
                  crypto.randomUUIDv4().pipe(
                    Effect.orDie,
                    Effect.map(String.slice(0, 8)),
                    Effect.map((id) => `err_${id}` as const),
                    Effect.tap((ref) => Effect.logError(cause, ref)),
                    Effect.map((ref) =>
                      ScimContract.V2BulkResponseOperation.make({
                        bulkId: operation.bulkId,
                        status: { code: 500 },
                        response: new ScimContract.V2InternalServerError({
                          detail: `unexpected server error: ${ref}`,
                        }),
                      }),
                    ),
                  ),
              }),
            ),
          ),
        ),
      ),
      Stream.takeUntilEffect(() =>
        errorCountRef.pipe(SynchronizedRef.get, Effect.map(Equal.equals(request.failOnErrors))),
      ),
      Stream.runCollect,
      Effect.map((Operations) => ScimContract.V2BulkResponse.make({ Operations })),
    );
  });

  return {
    discoverServiceProviderConfig,
    discoverResourceTypes,
    retrieveResourceType,
    discoverSchemas,
    retrieveSchema,
    queryGroups,
    retrieveGroup,
    createGroup,
    replaceGroup,
    modifyGroup,
    deleteGroup,
    queryUsers,
    retrieveUser,
    createUser,
    replaceUser,
    modifyUser,
    deleteUser,
    bulkCreate,
  } as const;
});

export const layer = makeService.pipe(Layer.effect(Scim));

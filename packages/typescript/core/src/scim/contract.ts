import * as Array from "effect/Array";
import * as Boolean from "effect/Boolean";
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as String from "effect/String";
import * as Struct from "effect/Struct";
import { parse, stringify } from "scim2-parse-filter";

import { Actor } from "../actors";
import { GroupsContract } from "../groups/contracts";
import { UsersContract } from "../users/contract";
import { BooleanFromString, BulkId, EntityId, IntFromString, NonEmptyString } from "../utils";
import { ScimLocator } from "./locator";

export namespace ScimContract {
  export const V2ResourceTypeName = Schema.Literals([
    "Schema",
    "ResourceType",
    "ServiceProviderConfig",
    "User",
    "Group",
  ]);
  export type V2ResourceTypeName = typeof V2ResourceTypeName.Type;

  export class V2SchemaAttribute extends Schema.Class<V2SchemaAttribute>("V2SchemaAttribute")({
    name: Schema.NonEmptyString,
    type: Schema.Literals([
      "string",
      "boolean",
      "decimal",
      "integer",
      "dateTime",
      "reference",
      "complex",
    ]),
    subAttributes: Schema.suspend((): Schema.Codec<V2SchemaAttribute> => V2SchemaAttribute).pipe(
      Schema.Array,
      Schema.optionalKey,
    ),
    multiValued: Schema.Boolean,
    description: Schema.NonEmptyString,
    required: Schema.Boolean,
    canonicalValues: Schema.String.pipe(Schema.Array, Schema.optionalKey),
    caseExact: Schema.Boolean.pipe(Schema.optionalKey),
    mutability: Schema.Literals(["readOnly", "readWrite", "immutable", "writeOnly"]),
    returned: Schema.Literals(["always", "never", "default", "request"]),
    uniqueness: Schema.Literals(["none", "server", "global"]).pipe(Schema.optionalKey),
    referenceTypes: Schema.String.pipe(Schema.Array, Schema.optionalKey),
  }) {
    public static get userAttributes() {
      return [
        new this({
          name: "id",
          type: "string",
          multiValued: false,
          description: "Unique identifier for the user.",
          required: true,
          caseExact: true,
          mutability: "readOnly",
          returned: "default",
          uniqueness: "server",
        }),
        new this({
          name: "externalId",
          type: "string",
          multiValued: false,
          description: "Unique external identifier for the user.",
          required: false,
          caseExact: true,
          mutability: "readWrite",
          returned: "default",
          uniqueness: "server",
        }),
        new this({
          name: "userName",
          type: "string",
          multiValued: false,
          description: "Unique identifier for the user to use when logging in.",
          required: true,
          caseExact: true,
          mutability: "readWrite",
          returned: "default",
          uniqueness: "server",
        }),
        new this({
          name: "displayName",
          type: "string",
          multiValued: false,
          description: "The name of the user suitable for displaying to end-users.",
          required: true,
          caseExact: true,
          mutability: "readWrite",
          returned: "default",
          uniqueness: "none",
        }),
        new this({
          name: "active",
          type: "boolean",
          multiValued: false,
          description: "A boolean value to indicate whether the user status is active.",
          required: false,
          mutability: "readWrite",
          returned: "default",
        }),
        new this({
          name: "emails",
          type: "complex",
          subAttributes: [
            new this({
              name: "primary",
              type: "boolean",
              multiValued: false,
              description:
                "A boolean value indicating the 'primary' or preferred attribute value for this attribute, e.g., the preferred mailing address or primary email address. The primary attribute value 'true' MUST appear no more than once.",
              required: true,
              mutability: "readWrite",
              returned: "default",
            }),
            new this({
              name: "value",
              type: "string",
              multiValued: false,
              description: "The user's email address.",
              required: true,
              caseExact: false,
              mutability: "readWrite",
              returned: "default",
              uniqueness: "server",
            }),
          ],
          multiValued: true,
          description: "Email addresses for the user.",
          required: true,
          mutability: "readWrite",
          returned: "default",
        }),
        new this({
          name: "roles",
          type: "complex",
          subAttributes: [
            new this({
              name: "value",
              type: "string",
              multiValued: false,
              description: "The value of a role.",
              required: true,
              caseExact: false,
              mutability: "readOnly",
              returned: "default",
              uniqueness: "none",
              canonicalValues: UsersContract.Role.literals,
            }),
            new this({
              name: "display",
              type: "string",
              multiValued: false,
              description: "A human-readable name, primarily used for display purposes.",
              required: false,
              caseExact: false,
              mutability: "readOnly",
              returned: "default",
              uniqueness: "none",
            }),
            new this({
              name: "type",
              type: "string",
              multiValued: false,
              description: "A label indicating the attribute's function.",
              required: false,
              caseExact: false,
              mutability: "readOnly",
              returned: "default",
              uniqueness: "none",
            }),
            new this({
              name: "primary",
              type: "boolean",
              multiValued: false,
              description:
                "A boolean value indicating the 'primary' or preferred attribute value for this attribute. The primary attribute value 'true' MUST appear no more than once.",
              required: true,
              mutability: "readOnly",
              returned: "default",
            }),
          ],
          multiValued: true,
          description: "Roles for the user.",
          required: false,
          mutability: "readOnly",
          returned: "default",
        }),
      ] as const;
    }

    public static get groupAttributes() {
      return [
        new this({
          name: "id",
          type: "string",
          multiValued: false,
          description: "Unique identifier for the group.",
          required: true,
          caseExact: true,
          mutability: "readOnly",
          returned: "default",
          uniqueness: "server",
        }),
        new this({
          name: "displayName",
          type: "string",
          multiValued: false,
          description: "The name of the group suitable to display to end-users.",
          required: true,
          caseExact: true,
          mutability: "readWrite",
          returned: "default",
          uniqueness: "none",
        }),
        new this({
          name: "members",
          type: "complex",
          subAttributes: [
            new this({
              name: "value",
              type: "string",
              multiValued: false,
              description: "Identifier of the member of the group.",
              required: true,
              caseExact: false,
              mutability: "immutable",
              returned: "default",
              uniqueness: "none",
            }),
            new this({
              name: "$ref",
              type: "reference",
              referenceTypes: ["User", "Group"],
              multiValued: false,
              description:
                "The URI corresponding to a SCIM resource that is a member of this group.",
              required: true,
              caseExact: false,
              mutability: "immutable",
              returned: "default",
              uniqueness: "none",
            }),
          ],
          multiValued: true,
          description: "A list of members of the group.",
          required: true,
          mutability: "readWrite",
          returned: "default",
        }),
      ] as const;
    }
  }

  export const v2UserUri = "urn:ietf:params:scim:schemas:core:2.0:User";
  export const v2GroupUri = "urn:ietf:params:scim:schemas:core:2.0:Group";
  export const V2ResourceUri = Schema.Literals([v2UserUri, v2GroupUri]);
  export type V2ResourceUri = typeof V2ResourceUri.Type;

  export const v2SchemaUri = "urn:ietf:params:scim:schemas:core:2.0:Schema";
  export class V2Schema extends Schema.Class<V2Schema>("V2Schema")(
    {
      _tag: Schema.tagDefaultOmit("ScimV2Schema"),
      schemas: Schema.Tuple([Schema.Literals([v2SchemaUri])]).pipe(
        Schema.mutable,
        Schema.withConstructorDefault(Effect.succeed([v2SchemaUri])),
      ),
      id: V2ResourceUri,
      name: Schema.NonEmptyString.pipe(Schema.optionalKey),
      description: Schema.NonEmptyString.pipe(Schema.optionalKey),
      attributes: V2SchemaAttribute.pipe(Schema.Array),
      meta: Schema.Struct({
        resourceType: V2ResourceTypeName.pick(["Schema"]),
        location: Schema.String,
      }),
    },
    { httpApiStatus: 200 },
  ) {}

  export const v2ResourceTypeUri = "urn:ietf:params:scim:schemas:core:2.0:ResourceType";
  export class V2ResourceType extends Schema.Class<V2ResourceType>("V2ResourceType")(
    {
      _tag: Schema.tagDefaultOmit("ScimV2ResourceType"),
      schemas: Schema.Tuple([Schema.Literal(v2ResourceTypeUri)]).pipe(
        Schema.mutable,
        Schema.withConstructorDefault(Effect.succeed([v2ResourceTypeUri])),
      ),
      id: V2ResourceTypeName,
      name: V2ResourceTypeName,
      endpoint: Schema.TemplateLiteral([
        Schema.Literal("/"),
        V2ResourceTypeName.pick(["User", "Group"]),
        Schema.Literal("s"),
      ]),
      description: Schema.NonEmptyString,
      schema: Schema.NonEmptyString,
      meta: Schema.Struct({
        resourceType: V2ResourceTypeName.pick(["ResourceType"]),
        location: Schema.String,
      }),
    },
    { httpApiStatus: 200 },
  ) {}

  export class CommonAttributes extends Schema.Class<CommonAttributes>("CommonAttributes")({
    id: Schema.NonEmptyString,
    externalId: Schema.NonEmptyString.pipe(Schema.optionalKey),
    meta: Schema.Struct({
      resourceType: V2ResourceTypeName,
      created: Schema.DateFromString,
      lastModified: Schema.DateFromString,
      location: Schema.String,
      version: Schema.String.pipe(Schema.optionalKey),
    }),
  }) {}

  export const v2ServiceProviderConfigUri =
    "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";
  export const baseV2ServiceProviderConfigOption = Schema.Struct({ supported: Schema.Boolean });
  export class V2ServiceProviderConfig extends Schema.Class<V2ServiceProviderConfig>(
    "V2ServiceProviderConfig",
  )(
    {
      _tag: Schema.tagDefaultOmit("ScimV2ServiceProviderConfig"),
      ...CommonAttributes.mapFields(Struct.evolve({ id: (id) => id.pipe(Schema.optionalKey) }))
        .fields,
      schemas: Schema.Tuple([Schema.Literal(v2ServiceProviderConfigUri)]).pipe(
        Schema.mutable,
        Schema.withConstructorDefault(Effect.succeed([v2ServiceProviderConfigUri])),
      ),
      documentationUri: Schema.URL.pipe(Schema.optionalKey),
      patch: baseV2ServiceProviderConfigOption,
      bulk: Schema.Union([
        baseV2ServiceProviderConfigOption.mapFields(
          Struct.evolve({ supported: () => Schema.Literal(false) }),
        ),
        baseV2ServiceProviderConfigOption
          .mapFields(Struct.evolve({ supported: () => Schema.Literal(true) }))
          .mapFields(
            Struct.assign({ maxOperations: Schema.Int, maxPayloadSize: Schema.ByteSizeFromNumber }),
          ),
      ]),
      filter: Schema.Union([
        baseV2ServiceProviderConfigOption.mapFields(
          Struct.evolve({ supported: () => Schema.Literal(false) }),
        ),
        baseV2ServiceProviderConfigOption
          .mapFields(Struct.evolve({ supported: () => Schema.Literal(true) }))
          .mapFields(Struct.assign({ maxResults: Schema.Int })),
      ]),
      changePassword: baseV2ServiceProviderConfigOption,
      sort: baseV2ServiceProviderConfigOption,
      etag: baseV2ServiceProviderConfigOption,
      authenticationSchemes: Schema.Struct({
        type: Schema.Literals(["oauth", "oauth2", "oauthbearertoken", "httpbasic", "httpdigest"]),
        name: Schema.NonEmptyString,
        description: Schema.NonEmptyString,
        specUri: Schema.String.pipe(Schema.optionalKey),
        documentationUri: Schema.String.pipe(Schema.optionalKey),
      }).pipe(Schema.Array),
    },
    { httpApiStatus: 200 },
  ) {
    /**
     * An integer value specifying the maximum number of bulk operations.
     */
    public static get maxBulkOperations() {
      return 1_000;
    }

    /**
     * An integer value specifying the maximum bulk payload size in bytes.
     */
    public static get maxBulkPayloadSize() {
      return ByteSize.mebibytes(1);
    }

    /**
     * An integer value specifying the maximum number of filter resources returned in a response.
     */
    public static get maxFilterResults() {
      return 1_000;
    }
  }

  export class V2Group extends CommonAttributes.extend<V2Group>("V2Group")(
    {
      _tag: Schema.tagDefaultOmit("ScimV2Group"),
      id: EntityId,
      externalId: GroupsContract.ExternalId,
      schemas: Schema.Tuple([Schema.Literal(v2GroupUri)]).pipe(
        Schema.mutable,
        Schema.withDecodingDefaultType(Effect.succeed([v2GroupUri] as const)),
        Schema.withConstructorDefault(Effect.succeed([v2GroupUri] as const)),
      ),
      displayName: GroupsContract.Name,
      members: Schema.Struct({ value: EntityId, $ref: Schema.NonEmptyString }).pipe(Schema.Array),
    },
    { httpApiStatus: 200 },
  ) {
    public static get Provisional() {
      return this.mapFields(Struct.omit(["_tag", "id", "meta"]));
    }

    public static get ProvisionalToDtos() {
      return this.Provisional.pipe(
        Schema.decodeTo(GroupsContract.ProvisionalDtos, {
          decode: SchemaGetter.transformEffect(
            Effect.fn(function* (scimGroup) {
              const actor = yield* Actor;
              const locator = yield* ScimLocator;

              const tenantId = yield* actor.tenantId.pipe(
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing tenantId" }),
                ),
              );
              const identityProviderId = yield* actor.identityProviderId.pipe(
                Effect.mapError(
                  () =>
                    new SchemaIssue.MissingKey({ messageMissingKey: "missing identityProviderId" }),
                ),
              );
              const groupMemberships = yield* Effect.succeed(scimGroup.members).pipe(
                Effect.flatMap(
                  Effect.filterMapEffect((member) =>
                    Effect.succeed(member.value).pipe(
                      Effect.flatMap(locator.user),
                      Effect.map(Struct.get("href")),
                      Effect.map(Equal.equals(member.$ref)),
                      Effect.map(
                        Boolean.match({
                          onTrue: () => Result.succeed({ userId: member.value, tenantId }),
                          onFalse: () => Result.failVoid,
                        }),
                      ),
                    ),
                  ),
                ),
              );

              return yield* Schema.encodeEffect(GroupsContract.ProvisionalDtos)({
                group: {
                  externalId: scimGroup.externalId,
                  name: scimGroup.displayName,
                  identityProviderId,
                  tenantId,
                },
                groupMemberships,
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
          encode: SchemaGetter.transformEffect(
            Effect.fn({ self: this }, function* ({ group, groupMemberships }) {
              const locator = yield* ScimLocator;

              const members = yield* Effect.all(
                Array.map(groupMemberships, (membership) =>
                  EntityId.makeEffect(membership.userId).pipe(
                    Effect.flatMap(locator.user),
                    Effect.map(Struct.get("href")),
                    Effect.map(($ref) => ({ value: membership.userId, $ref })),
                  ),
                ),
              );

              return yield* Schema.decodeEffect(this.Provisional)({
                externalId: group.externalId,
                displayName: group.name,
                members,
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
        }),
      );
    }

    public static get BulkProvisional() {
      return this.Provisional.mapFields(
        Struct.evolve({
          members: (members) =>
            members.value.mapFields(Struct.evolve({ value: () => BulkId })).pipe(Schema.Array),
        }),
      );
    }

    public static get BulkProvisionalToDtos() {
      return this.BulkProvisional.pipe(
        Schema.decodeTo(GroupsContract.BulkProvisionalDtos, {
          decode: SchemaGetter.transformEffect(
            Effect.fn(function* (scimGroup) {
              const actor = yield* Actor;
              const locator = yield* ScimLocator;
              const tenantId = yield* actor.tenantId.pipe(
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing tenantId" }),
                ),
              );
              const identityProviderId = yield* actor.identityProviderId.pipe(
                Effect.mapError(
                  () =>
                    new SchemaIssue.MissingKey({ messageMissingKey: "missing identityProviderId" }),
                ),
              );
              const groupMemberships = yield* Effect.succeed(scimGroup.members).pipe(
                Effect.flatMap(
                  Effect.filterMapEffect((member) =>
                    locator.users.pipe(
                      Effect.map(Struct.get("href")),
                      Effect.map((location) => String.startsWith(location)(member.$ref)),
                      Effect.map(
                        Boolean.match({
                          onTrue: () => Result.succeed({ userId: member.value, tenantId }),
                          onFalse: () => Result.failVoid,
                        }),
                      ),
                    ),
                  ),
                ),
              );

              return yield* Schema.encodeEffect(GroupsContract.BulkProvisionalDtos)({
                group: {
                  externalId: scimGroup.externalId,
                  name: scimGroup.displayName,
                  identityProviderId,
                  tenantId,
                },
                groupMemberships,
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
          encode: SchemaGetter.transformEffect(
            Effect.fn({ self: this }, function* ({ group, groupMemberships }) {
              const locator = yield* ScimLocator;

              const members = yield* Effect.all(
                Array.map(groupMemberships, (membership) =>
                  EntityId.makeEffect(membership.userId).pipe(
                    Effect.flatMap(locator.user),
                    Effect.map(Struct.get("href")),
                    Effect.map(($ref) => ({ value: membership.userId, $ref })),
                  ),
                ),
              );

              return yield* Schema.decodeEffect(this.BulkProvisional)({
                externalId: group.externalId,
                displayName: group.name,
                members,
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
        }),
      );
    }

    public static get SupportedFilterAttributePath() {
      return Schema.NonEmptyString.pipe(
        Schema.decode(SchemaTransformation.toLowerCase()),
        Schema.decodeTo(
          Schema.Literals(
            Array.map(Struct.keys(Struct.pick(this.fields, ["externalId"])), String.toLowerCase),
          ),
        ),
        Schema.annotate({ message: "unsupported filter attribute path" }),
      );
    }

    public static get ToDtos() {
      return this.pipe(
        Schema.decodeTo(GroupsContract.Dtos, {
          decode: SchemaGetter.transformEffect(
            Effect.fn(function* (scimGroup, options) {
              const actor = yield* Actor;
              const locator = yield* ScimLocator;

              const tenantId = yield* actor.tenantId.pipe(
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing tenantId" }),
                ),
              );
              const identityProviderId = yield* actor.identityProviderId.pipe(
                Effect.mapError(
                  () =>
                    new SchemaIssue.MissingKey({ messageMissingKey: "missing identityProviderId" }),
                ),
              );
              const createdAt = DateTime.fromDateUnsafe(scimGroup.meta.created);
              const updatedAt = DateTime.fromDateUnsafe(scimGroup.meta.lastModified);
              const deletedAt = null;
              const groupMemberships = yield* Effect.filterMapEffect(scimGroup.members, (member) =>
                Effect.succeed(member.value).pipe(
                  Effect.filterOrFail(
                    (userId): userId is EntityId => !("bulkId" in userId),
                    (userId) =>
                      new SchemaIssue.InvalidValue(
                        { message: "bulkId is not supported in non-provisional groups" },
                        userId,
                        options,
                      ),
                  ),
                  Effect.flatMap((userId) =>
                    locator.user(userId).pipe(
                      Effect.map(Struct.get("href")),
                      Effect.map(Equal.equals(member.$ref)),
                      Effect.map(
                        Boolean.match({
                          onTrue: () =>
                            Result.succeed({
                              groupId: scimGroup.id,
                              userId,
                              tenantId,
                              createdAt: createdAt.pipe(DateTime.formatIso),
                              updatedAt: updatedAt.pipe(DateTime.formatIso),
                            }),
                          onFalse: () => Result.failVoid,
                        }),
                      ),
                    ),
                  ),
                ),
              );

              return yield* Schema.encodeEffect(GroupsContract.Table.Dto)({
                id: scimGroup.id,
                externalId: scimGroup.externalId,
                name: scimGroup.displayName,
                identityProviderId,
                tenantId,
                createdAt,
                updatedAt,
                deletedAt,
              }).pipe(
                Effect.mapError(Struct.get("issue")),
                Effect.map((group) => ({ group, groupMemberships })),
              );
            }),
          ),
          encode: SchemaGetter.transformEffect(
            Effect.fn({ self: this }, function* ({ group, groupMemberships }) {
              const locator = yield* ScimLocator;

              const id = yield* Effect.succeed(group.id).pipe(
                Effect.filterOrFail(
                  Predicate.isNotUndefined,
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing group id" }),
                ),
                Effect.flatMap((id) => EntityId.makeEffect(id)),
              );
              const members = yield* Effect.all(
                Array.map(groupMemberships, (membership) =>
                  EntityId.makeEffect(membership.userId).pipe(
                    Effect.flatMap(locator.user),
                    Effect.map(Struct.get("href")),
                    Effect.map(($ref) => ({ value: membership.userId, $ref })),
                  ),
                ),
              );
              const created = yield* Effect.succeed(group.createdAt).pipe(
                Effect.filterOrFail(
                  Predicate.isNotUndefined,
                  () =>
                    new SchemaIssue.MissingKey({
                      messageMissingKey: "missing created at timestamp",
                    }),
                ),
              );
              const lastModified = yield* Effect.succeed(group.updatedAt).pipe(
                Effect.filterOrFail(
                  Predicate.isNotUndefined,
                  () =>
                    new SchemaIssue.MissingKey({
                      messageMissingKey: "missing updated at timestamp",
                    }),
                ),
              );
              const { href: location } = yield* locator.group(id);

              return yield* Schema.decodeEffect(this)({
                id,
                externalId: group.externalId,
                displayName: group.name,
                members,
                meta: { created, lastModified, location, resourceType: "Group" },
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
        }),
      );
    }
  }

  export class V2User extends CommonAttributes.extend<V2User>("V2User")({
    _tag: Schema.tagDefaultOmit("ScimV2User"),
    id: EntityId,
    externalId: UsersContract.ExternalId,
    schemas: Schema.Tuple([Schema.Literal(v2UserUri)]).pipe(
      Schema.mutable,
      Schema.withDecodingDefaultType(Effect.succeed([v2UserUri] as const)),
      Schema.withConstructorDefault(Effect.succeed([v2UserUri] as const)),
    ),
    userName: UsersContract.Username,
    displayName: UsersContract.DisplayName,
    active: Schema.Boolean,
    emails: Schema.Struct({
      primary: Schema.Union([Schema.Boolean, BooleanFromString]),
      value: UsersContract.Email,
    }).pipe(Schema.Array),
    roles: Schema.Tuple([
      Schema.Struct({
        primary: Schema.Union([Schema.Boolean, BooleanFromString]),
        value: UsersContract.Role,
      }),
    ]),
  }) {
    public static get Provisional() {
      return this.mapFields(Struct.omit(["_tag", "id", "meta", "roles"]));
    }

    public static get ProvisionalToDto() {
      return this.Provisional.pipe(
        Schema.decodeTo(UsersContract.ProvisionalDto, {
          decode: SchemaGetter.transformEffect(
            Effect.fn(function* (scimUser) {
              const actor = yield* Actor;

              const tenantId = yield* actor.tenantId.pipe(
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing tenantId" }),
                ),
              );
              const identityProviderId = yield* actor.identityProviderId.pipe(
                Effect.mapError(
                  () =>
                    new SchemaIssue.MissingKey({ messageMissingKey: "missing identityProviderId" }),
                ),
              );
              const email = yield* Array.findFirst(scimUser.emails, Struct.get("primary")).pipe(
                Effect.fromOption,
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing email" }),
                ),
              );

              return yield* Schema.encodeEffect(UsersContract.ProvisionalDto)({
                externalId: scimUser.externalId,
                displayName: scimUser.displayName,
                username: scimUser.userName,
                email: email.value,
                status: scimUser.active ? "active" : "suspended",
                identityProviderId,
                tenantId,
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
          encode: SchemaGetter.transformEffect((user) =>
            Schema.decodeEffect(this.Provisional)({
              externalId: user.externalId,
              displayName: user.displayName,
              userName: user.username,
              emails: [{ primary: true, value: user.email }],
              active: user.status === "active",
            }).pipe(Effect.mapError(Struct.get("issue"))),
          ),
        }),
      );
    }

    public static get SupportedFilterAttributePath() {
      return Schema.NonEmptyString.pipe(
        Schema.decode(SchemaTransformation.toLowerCase()),
        Schema.decodeTo(
          Schema.Literals(
            Array.map(
              Struct.keys(Struct.pick(this.fields, ["externalId", "userName"])),
              String.toLowerCase,
            ),
          ),
        ),
        Schema.annotate({ message: "unsupported filter attribute path" }),
      );
    }

    public static get ToDto() {
      return this.pipe(
        Schema.decodeTo(UsersContract.Table.Dto, {
          decode: SchemaGetter.transformEffect(
            Effect.fn(function* (scimUser) {
              const actor = yield* Actor;

              const tenantId = yield* actor.tenantId.pipe(
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing tenantId" }),
                ),
              );
              const identityProviderId = yield* actor.identityProviderId.pipe(
                Effect.mapError(
                  () =>
                    new SchemaIssue.MissingKey({ messageMissingKey: "missing identityProviderId" }),
                ),
              );
              const email = yield* Array.findFirst(scimUser.emails, Struct.get("primary")).pipe(
                Effect.fromOption,
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing email" }),
                ),
              );
              const role = yield* Array.findFirst(scimUser.roles, Struct.get("primary")).pipe(
                Effect.fromOption,
                Effect.mapError(
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing role" }),
                ),
              );
              const createdAt = DateTime.fromDateUnsafe(scimUser.meta.created);
              const updatedAt = DateTime.fromDateUnsafe(scimUser.meta.lastModified);
              const deletedAt = null;

              return yield* Schema.encodeEffect(UsersContract.Table.Dto)({
                id: scimUser.id,
                externalId: scimUser.externalId,
                displayName: scimUser.displayName,
                username: scimUser.userName,
                email: email.value,
                role: role.value,
                status: scimUser.active ? "active" : "suspended",
                identityProviderId,
                tenantId,
                createdAt,
                updatedAt,
                deletedAt,
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
          encode: SchemaGetter.transformEffect(
            Effect.fn({ self: this }, function* (user) {
              const id = yield* Effect.succeed(user.id).pipe(
                Effect.filterOrFail(
                  Predicate.isNotUndefined,
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing user id" }),
                ),
                Effect.flatMap((id) => EntityId.makeEffect(id)),
              );
              const role = yield* Effect.succeed(user.role).pipe(
                Effect.filterOrFail(
                  Predicate.isNotUndefined,
                  () => new SchemaIssue.MissingKey({ messageMissingKey: "missing role" }),
                ),
              );
              const created = yield* Effect.succeed(user.createdAt).pipe(
                Effect.filterOrFail(
                  Predicate.isNotUndefined,
                  () =>
                    new SchemaIssue.MissingKey({
                      messageMissingKey: "missing created at timestamp",
                    }),
                ),
              );
              const lastModified = yield* Effect.succeed(user.updatedAt).pipe(
                Effect.filterOrFail(
                  Predicate.isNotUndefined,
                  () =>
                    new SchemaIssue.MissingKey({
                      messageMissingKey: "missing updated at timestamp",
                    }),
                ),
              );
              const { href: location } = yield* ScimLocator.use((locator) => locator.user(id));

              return yield* Schema.decodeEffect(this)({
                id,
                externalId: user.externalId,
                displayName: user.displayName,
                userName: user.username,
                active: user.status === "active",
                emails: [{ primary: true, value: user.email }],
                roles: [{ primary: true, value: role }],
                meta: { created, lastModified, location, resourceType: "User" },
              }).pipe(Effect.mapError(Struct.get("issue")));
            }),
          ),
        }),
      );
    }
  }

  export const V2FilterAttributePath = Schema.NonEmptyString;

  export class V2FilterCompareExpression extends Schema.Class<V2FilterCompareExpression>(
    "V2FilterCompareExpression",
  )({
    op: Schema.Literals(["eq", "ne", "co", "sw", "ew", "gt", "lt", "ge", "le"]),
    attrPath: V2FilterAttributePath,
    compValue: Schema.Union([Schema.Boolean, Schema.Null, Schema.Finite, Schema.String]),
  }) {}

  export class V2FilterSuffixExpression extends Schema.Class<V2FilterSuffixExpression>(
    "V2FilterSuffixExpression",
  )({ op: Schema.Literal("pr"), attrPath: V2FilterAttributePath }) {}

  export const V2Filter = Schema.Union([
    V2FilterCompareExpression,
    V2FilterSuffixExpression,
    Schema.suspend((): Schema.Codec<V2FilterAndExpression> => V2FilterAndExpression),
    Schema.suspend((): Schema.Codec<V2FilterOrExpression> => V2FilterOrExpression),
    Schema.suspend((): Schema.Codec<V2FilterValuePath> => V2FilterValuePath),
    Schema.suspend((): Schema.Codec<V2FilterNotExpression> => V2FilterNotExpression),
  ]);
  export type V2Filter = typeof V2Filter.Type;

  export const V2FilterFromString = Schema.NonEmptyString.pipe(
    Schema.decodeTo(V2Filter, {
      decode: SchemaGetter.transform(parse),
      encode: SchemaGetter.transform(stringify),
    }),
  );

  export class V2QueryParams extends Schema.Class<V2QueryParams>("V2QueryParams")({
    filter: V2FilterFromString.pipe(Schema.optionalKey),
  }) {}

  export class V2FilterAndExpression extends Schema.Class<V2FilterAndExpression>(
    "V2FilterAndExpression",
  )({ op: Schema.Literal("and"), filters: V2Filter.pipe(Schema.Array, Schema.mutable) }) {}

  export class V2FilterOrExpression extends Schema.Class<V2FilterOrExpression>(
    "V2FilterOrExpression",
  )({ op: Schema.Literal("or"), filters: V2Filter.pipe(Schema.Array, Schema.mutable) }) {}

  export class V2FilterValuePath extends Schema.Class<V2FilterValuePath>("FilterValuePath")({
    op: Schema.Literal("[]"),
    attrPath: V2FilterAttributePath,
    valFilter: V2Filter,
  }) {}

  export class V2FilterNotExpression extends Schema.Class<V2FilterNotExpression>(
    "V2FilterNotExpression",
  )({ op: Schema.Literal("not"), filter: V2Filter }) {}

  export class V2PatchRemoveOperation extends Schema.Class<V2PatchRemoveOperation>(
    "V2PatchRemoveOperation",
  )({ op: Schema.Literal("remove"), path: Schema.NonEmptyString, value: Schema.Any }) {}

  export class V2PatchAddReplaceOperation extends Schema.Class<V2PatchAddReplaceOperation>(
    "V2PatchAddReplaceOperation",
  )({
    op: Schema.Literals(["add", "replace"]),
    path: Schema.NonEmptyString.pipe(Schema.optional),
    value: Schema.Any.pipe(Schema.optional),
  }) {}

  export const V2PatchOperation = Schema.Union([
    V2PatchRemoveOperation,
    V2PatchAddReplaceOperation,
  ]);

  export const v2PatchUri = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
  export const V2Patch = Schema.Struct({
    schemas: Schema.Tuple([Schema.Literal(v2PatchUri)]).pipe(
      Schema.mutable,
      Schema.withConstructorDefault(Effect.succeed([v2PatchUri])),
    ),
    Operations: V2PatchOperation.pipe(Schema.Array, Schema.mutable),
  });

  export const v2ErrorUri = "urn:ietf:params:scim:api:messages:2.0:Error";
  export class V2Error
    extends Schema.Error<V2Error>("V2Error")({
      _tag: Schema.tagDefaultOmit("ScimV2Error"),
      schemas: Schema.Tuple([Schema.Literal(v2ErrorUri)]).pipe(
        Schema.mutable,
        Schema.withConstructorDefault(Effect.succeed([v2ErrorUri])),
      ),
      status: IntFromString,
      scimType: Schema.Literals([
        "invalidFilter",
        "tooMany",
        "uniqueness",
        "mutability",
        "invalidSyntax",
        "invalidPath",
        "noTarget",
        "invalidValue",
        "sensitive",
      ]).pipe(Schema.optionalKey),
      detail: Schema.String.pipe(Schema.optionalKey),
    })
    implements HttpServerRespondable.Respondable
  {
    public readonly [v2ErrorUri] = v2ErrorUri;

    public static guard(value: unknown): value is V2Error {
      return Predicate.hasProperty(value, v2ErrorUri);
    }

    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(V2Error)(this, {
        status: this.status,
        contentType: "application/scim+json",
      });
  }

  const StatusFromString = <TStatus extends number>(status: TStatus) =>
    Schema.Literal(status).pipe(
      Schema.encodeTo(Schema.Literal(`${status}`), {
        decode: SchemaGetter.transform(() => status),
        encode: SchemaGetter.transform(() => `${status}` as const),
      }),
      Schema.withConstructorDefault(Effect.succeed(status)),
    );

  export class V2BadRequestError extends V2Error.extend<V2BadRequestError>("V2BadRequestError")(
    { status: StatusFromString(400) },
    { httpApiStatus: 400 },
  ) {}

  export class V2UnauthorizedError extends V2Error.extend<V2UnauthorizedError>(
    "V2UnauthorizedError",
  )({ status: StatusFromString(401) }, { httpApiStatus: 401 }) {}

  export class V2ForbiddenError extends V2Error.extend<V2ForbiddenError>("V2ForbiddenError")(
    { status: StatusFromString(403) },
    { httpApiStatus: 403 },
  ) {}

  export class V2NotFoundError extends V2Error.extend<V2NotFoundError>("V2NotFoundError")(
    { status: StatusFromString(404) },
    { httpApiStatus: 404 },
  ) {}

  export class V2ConflictError extends V2Error.extend<V2ConflictError>("V2ConflictError")(
    { status: StatusFromString(409) },
    { httpApiStatus: 409 },
  ) {}

  export class V2ContentTooLargeError extends V2Error.extend<V2ContentTooLargeError>(
    "V2ContentTooLargeError",
  )({ status: StatusFromString(413) }, { httpApiStatus: 413 }) {}

  export class V2InternalServerError extends V2Error.extend<V2InternalServerError>(
    "V2InternalServerError",
  )({ status: StatusFromString(500) }, { httpApiStatus: 500 }) {}

  export const v2ListResponseUri = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
  export class V2ListResponse extends Schema.Class<V2ListResponse>("V2ListResponse")(
    {
      _tag: Schema.tagDefaultOmit("ScimV2ListResponse"),
      schemas: Schema.Tuple([Schema.Literal(v2ListResponseUri)]).pipe(
        Schema.mutable,
        Schema.withDecodingDefaultType(Effect.succeed([v2ListResponseUri] as const)),
        Schema.withConstructorDefault(Effect.succeed([v2ListResponseUri] as const)),
      ),
      totalResults: Schema.Int,
      Resources: Schema.Union([
        V2ResourceType.pipe(Schema.Array),
        V2Schema.pipe(Schema.Array),
        V2User.pipe(Schema.Array),
        V2Group.pipe(Schema.Array),
      ]),
      startIndex: Schema.Int,
      itemsPerPage: Schema.Int,
    },
    { httpApiStatus: 200 },
  ) {
    public static get ResourceTypes() {
      return this.mapFields(Struct.evolve({ Resources: (union) => union.members[0] }));
    }

    public static get Schemas() {
      return this.mapFields(Struct.evolve({ Resources: (union) => union.members[1] }));
    }

    public static get Users() {
      return this.mapFields(Struct.evolve({ Resources: (union) => union.members[2] }));
    }

    public static get Groups() {
      return this.mapFields(Struct.evolve({ Resources: (union) => union.members[3] }));
    }

    public static get UsersToDtos() {
      return this.Users.pipe(
        Schema.decodeTo(V2User.ToDto.pipe(Schema.Array), {
          decode: SchemaGetter.transformEffect((list) =>
            Effect.all(
              Array.map(list.Resources, (v2User) =>
                Effect.succeed(v2User).pipe(Effect.flatMap(Schema.encodeEffect(V2User))),
              ),
            ).pipe(Effect.mapError(Struct.get("issue"))),
          ),
          encode: SchemaGetter.transformEffect((users) =>
            Schema.decodeEffect(this.Users)({
              totalResults: users.length,
              Resources: users,
              startIndex: 1,
              itemsPerPage: users.length,
            }).pipe(Effect.mapError(Struct.get("issue"))),
          ),
        }),
      );
    }

    public static get GroupsToDtos() {
      return this.Groups.pipe(
        Schema.decodeTo(V2Group.ToDtos.pipe(Schema.Array), {
          decode: SchemaGetter.transformEffect((list) =>
            Effect.all(
              Array.map(list.Resources, (v2Group) =>
                Effect.succeed(v2Group).pipe(Effect.flatMap(Schema.encodeEffect(V2Group))),
              ),
            ).pipe(Effect.mapError(Struct.get("issue"))),
          ),
          encode: SchemaGetter.transformEffect((groups) =>
            Schema.decodeEffect(this.Groups)({
              totalResults: groups.length,
              Resources: groups,
              startIndex: 1,
              itemsPerPage: groups.length,
            }).pipe(Effect.mapError(Struct.get("issue"))),
          ),
        }),
      );
    }
  }

  export class V2CreateGroupBulkRequestOperation extends Schema.Class<V2CreateGroupBulkRequestOperation>(
    "V2CreateGroupBulkRequestOperation",
  )({
    _tag: Schema.tagDefaultOmit("ScimV2CreateGroupBulkRequestOperation"),
    method: Schema.Literal("POST").pipe(Schema.withConstructorDefault(Effect.succeed("POST"))),
    path: Schema.Literal("/Groups").pipe(Schema.withConstructorDefault(Effect.succeed("/Groups"))),
    bulkId: NonEmptyString,
    data: V2Group.BulkProvisionalToDtos,
  }) {}

  export class V2CreateUserBulkRequestOperation extends Schema.Class<V2CreateUserBulkRequestOperation>(
    "V2CreateUserBulkRequestOperation",
  )({
    _tag: Schema.tagDefaultOmit("ScimV2CreateUserBulkRequestOperation"),
    method: Schema.Literal("POST").pipe(Schema.withConstructorDefault(Effect.succeed("POST"))),
    path: Schema.Literal("/Users").pipe(Schema.withConstructorDefault(Effect.succeed("/Users"))),
    bulkId: NonEmptyString,
    data: V2User.ProvisionalToDto,
  }) {}

  export const V2BulkRequestOperation = Schema.Union([
    V2CreateUserBulkRequestOperation,
    V2CreateGroupBulkRequestOperation,
  ]).pipe(Schema.toTaggedUnion("_tag"));
  export type V2BulkRequestOperation = typeof V2BulkRequestOperation.Type;

  export const v2BulkRequestUri = "urn:ietf:params:scim:api:messages:2.0:BulkRequest";
  export class V2BulkRequest extends Schema.Class<V2BulkRequest>("V2BulkRequest")({
    schemas: Schema.Tuple([Schema.Literal(v2BulkRequestUri)]).pipe(
      Schema.withConstructorDefault(Effect.succeed([v2BulkRequestUri])),
    ),
    failOnErrors: Schema.Int.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(1)),
      Schema.withDecodingDefaultTypeKey(Effect.succeed(1)),
    ),
    Operations: V2BulkRequestOperation.pipe(Schema.Array),
  }) {}

  export class V2BulkResponseOperation extends Schema.Opaque<V2BulkResponseOperation>()(
    Schema.Struct({
      location: Schema.NonEmptyString.pipe(Schema.optionalKey),
      method: Schema.Literal("POST").pipe(Schema.withConstructorDefault(Effect.succeed("POST"))),
      bulkId: Schema.NonEmptyString,
      status: Schema.Struct({ code: IntFromString }),
      response: V2Error.pipe(Schema.optionalKey),
    }).pipe(
      Schema.check(
        Schema.makeFilter((operation) =>
          operation.response && operation.response.status !== operation.status.code
            ? ["response operation error status mismatch"]
            : [],
        ),
      ),
    ),
  ) {}

  export const v2BulkResponseUri = "urn:ietf:params:scim:api:messages:2.0:BulkResponse";
  export class V2BulkResponse extends Schema.Class<V2BulkResponse>("V2BulkResponse")({
    schemas: Schema.Tuple([Schema.Literal(v2BulkResponseUri)]).pipe(
      Schema.withConstructorDefault(Effect.succeed([v2BulkResponseUri])),
    ),
    Operations: V2BulkResponseOperation.pipe(Schema.Array),
  }) {}
}

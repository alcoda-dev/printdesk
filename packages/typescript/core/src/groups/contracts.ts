import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Struct from "effect/Struct";

import { Handler } from "../handlers";
import { ScimBulkIdMap } from "../scim/bulk-id-map";
import { TablesContract } from "../tables/contract";
import { BulkId, EntityId } from "../utils";

import type {
  ActiveGroupMembershipsView,
  ActiveGroupsView,
  ActiveMembershipGroupsView,
  GroupMembershipsTable,
  GroupsTable,
} from "./sql";

export namespace GroupMembershipsContract {
  export class Table extends TablesContract.Table<GroupMembershipsTable>("group_memberships")(
    {
      ...TablesContract.BaseSyncModel.fields,
      groupId: EntityId,
      userId: EntityId,
    },
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveGroupMembershipsView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}
}

export namespace GroupsContract {
  export const Name = Schema.String.pipe(Schema.brand("GroupName"));
  export type Name = typeof Name.Type;

  export const ExternalId = Schema.NonEmptyString.pipe(Schema.brand("GroupExternalId"));
  export type ExternalId = typeof ExternalId.Type;

  export class Table extends TablesContract.Table<GroupsTable>("groups")(
    {
      ...TablesContract.BaseSyncModel.fields,
      name: Name,
      externalId: ExternalId,
      identityProviderId: EntityId,
    },
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveGroupsView>(`active_${Table.name}`)(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveMembershipView extends TablesContract.View<ActiveMembershipGroupsView>(
    `active_membership_${Table.name}`,
  )({ ...ActiveView.Model.fields, userId: EntityId }) {}

  export const isMemberOf = new Handler.Handler({
    name: "isMemberOfGroup",
    Input: Schema.Struct({
      ...Struct.evolve(Struct.pick(Table.Model.fields, ["id"]), {
        id: (id) => id.from.schema.members[0],
      }),
      userId: EntityId.pipe(Schema.OptionFromUndefinedOr),
    }),
    Output: Schema.Void,
  });

  export class Dtos extends Schema.Opaque<Dtos, { readonly brand: unique symbol }>()(
    Schema.Struct({
      group: Table.Dto,
      groupMemberships: GroupMembershipsContract.Table.Dto.pipe(Schema.Array),
    }),
  ) {}

  export class ProvisionalDtos extends Schema.Opaque<
    ProvisionalDtos,
    { readonly brand: unique symbol }
  >()(
    Schema.Struct({
      group: Table.Dto.mapFields(
        Struct.pick(["name", "externalId", "identityProviderId", "tenantId"]),
      ),
      groupMemberships: GroupMembershipsContract.Table.Dto.mapFields(
        Struct.pick(["userId", "tenantId"]),
      ).pipe(Schema.Array),
    }),
  ) {}

  export class BulkProvisionalDtos extends Schema.Opaque<
    BulkProvisionalDtos,
    { readonly brand: unique symbol }
  >()(
    Schema.Struct({
      group: ProvisionalDtos.fields.group,
      groupMemberships: ProvisionalDtos.fields.groupMemberships.value
        .mapFields(Struct.evolve({ userId: () => BulkId }))
        .pipe(Schema.Array),
    }),
  ) {
    public static get ToNonBulk() {
      return this.pipe(
        Schema.toType,
        Schema.decodeTo(ProvisionalDtos, {
          decode: SchemaGetter.transformEffect(
            Effect.fn(function* ({ group, groupMemberships }) {
              const bulkIdMap = yield* ScimBulkIdMap;

              return {
                group,
                groupMemberships: yield* Effect.all(
                  Array.map(groupMemberships, (membership) =>
                    bulkIdMap.get(membership.userId.bulkId).pipe(
                      Effect.flatMap(Effect.fromOption),
                      Effect.mapBoth({
                        onSuccess: (userId) => Struct.evolve(membership, { userId: () => userId }),
                        onFailure: () =>
                          new SchemaIssue.MissingKey({
                            messageMissingKey: `referenced bulkId "${membership.userId.bulkId}" does not exist in this bulk request.`,
                          }),
                      }),
                    ),
                  ),
                ),
              };
            }),
          ),
          encode: SchemaGetter.forbidden(() => "Not implemented"),
        }),
      );
    }
  }
}

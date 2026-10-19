import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { Handler } from "../handlers";
import { TablesContract } from "../tables/contract";
import { EntityId } from "../utils";

import type { ActiveUsersView, UsersTable } from "./sql";

export namespace UsersContract {
  export const Status = Schema.Literals(["active", "suspended"]);
  export type Status = typeof Status.Type;

  export const Role = Schema.Literals(["administrator", "operator", "manager", "customer"]);
  export type Role = (typeof Role)["Type"];

  export const Username = Schema.String.pipe(Schema.brand("UserUsername"));
  export type Username = typeof Username.Type;

  export const ExternalId = Schema.String.pipe(Schema.brand("UserExternalId"));
  export type ExternalId = typeof ExternalId.Type;

  export const DisplayName = Schema.String.pipe(Schema.brand("UserDisplayName"));
  export type DisplayName = typeof DisplayName.Type;

  export const Email = Schema.String.pipe(Schema.brand("UserEmail"));
  export type Email = typeof Email.Type;

  export class Table extends TablesContract.Table<UsersTable>("users")(
    {
      ...TablesContract.BaseSyncModel.fields,
      username: Username,
      externalId: ExternalId,
      displayName: DisplayName,
      email: Email,
      identityProviderId: EntityId,
      status: Status.pipe(Schema.withDecodingDefaultType(Effect.succeed("active"))),
      role: Role.pipe(Schema.withDecodingDefaultType(Effect.succeed("customer"))),
    },
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveUsersView>(`active_${Table.name}`)(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  const IdOnly = Table.Model.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  export const isSelf = new Handler.Handler({
    name: "isUserSelf",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canEdit = new Handler.Handler({
    name: "canEditUser",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canDelete = new Handler.Handler({
    name: "canDeleteUser",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canRestore = new Handler.Handler({
    name: "canRestoreUser",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const edit = new Handler.Handler({
    name: "editUser",
    Input: Table.Dto.mapFields(
      Struct.omit([
        ...Struct.keys(TablesContract.BaseModel.fields),
        "username",
        "externalId",
        "identityProviderId",
        "displayName",
        "email",
        "role",
      ]),
    )
      .mapFields(Struct.map(Schema.optional))
      .mapFields(
        Struct.assign(
          Struct.evolve(Struct.pick(Table.Model.fields, ["id", "updatedAt", "role"]), {
            id: (id) => id.from.schema.members[0],
            role: (role) => role.from.schema.members[0].pipe(Schema.optional),
          }),
        ),
      ),
    Output: Table.Dto,
  });

  export const delete_ = new Handler.Handler({
    name: "deleteUser",
    Input: IdOnly.mapFields(
      Struct.assign(
        Struct.evolve(Struct.pick(Table.Model.fields, ["deletedAt"]), {
          deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[0],
        }),
      ),
    ),
    Output: Table.Dto,
  });

  export const restore = new Handler.Handler({
    name: "restoreUser",
    Input: IdOnly,
    Output: Table.Dto,
  });

  export class NotFoundError extends Schema.TaggedError<
    NotFoundError,
    { readonly brand: unique symbol }
  >()("NotFoundError", {
    id: Schema.TaggedUnion({
      external: { value: Table.Model.fields.externalId },
      internal: { value: Table.Model.fields.id },
    }),
  }) {}

  export class InvalidStatusError extends Schema.TaggedError<
    InvalidStatusError,
    { readonly brand: unique symbol }
  >()("InvalidUserStatusError", Table.Model.mapFields(Struct.pick(["id", "status"]))) {}

  export const ProvisionalDto = UsersContract.Table.Dto.mapFields(
    Struct.pick([
      "username",
      "externalId",
      "displayName",
      "email",
      "status",
      "identityProviderId",
      "tenantId",
    ]),
  );
  export type ProvisionalDto = typeof ProvisionalDto.Type;
}

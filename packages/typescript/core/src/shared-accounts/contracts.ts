import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Struct from "effect/Struct";

import { Handler } from "../handlers";
import { TablesContract } from "../tables/contract";
import { Cost, EntityId } from "../utils";

import type {
  ActiveAuthorizedSharedAccountCustomerAccessView,
  ActiveAuthorizedSharedAccountGroupCustomerAccessView,
  ActiveAuthorizedSharedAccountManagerAccessView,
  ActiveCustomerAuthorizedSharedAccountManagerAccessView,
  ActiveCustomerAuthorizedSharedAccountsView,
  ActiveManagerAuthorizedSharedAccountsView,
  ActiveSharedAccountCustomerAccessView,
  ActiveSharedAccountGroupCustomerAccessView,
  ActiveSharedAccountManagerAccessView,
  ActiveSharedAccountsView,
  SharedAccountCustomerAccessTable,
  SharedAccountGroupCustomerAccessTable,
  SharedAccountManagerAccessTable,
  SharedAccountsTable,
} from "./sql";

export namespace SharedAccountsContract {
  export const Origin = Schema.Literals(["papercut", "internal"]);
  export type Origin = typeof Origin.Type;

  export const Name = Schema.String.pipe(Schema.brand("SharedAccountName"));
  export type Name = typeof Name.Type;

  export const PapercutMfId = Schema.Int.pipe(Schema.brand("SharedAccountPapercutMfId"));
  export type PapercutMfId = typeof PapercutMfId.Type;

  export class Table extends TablesContract.Table<SharedAccountsTable>("shared_accounts")(
    Schema.Struct({
      ...TablesContract.BaseSyncModel.fields,
      origin: Origin.pipe(Schema.withDecodingDefaultType(Effect.succeed("internal"))),
      name: Name,
      reviewThreshold: Cost.pipe(
        Schema.decodeTo(Schema.String, {
          decode: SchemaGetter.transform(String),
          encode: SchemaGetter.transform(Number),
        }),
        Schema.NullOr,
      ),
      papercutMfId: PapercutMfId.pipe(
        Schema.NullOr,
        Schema.withDecodingDefaultType(Effect.succeed(null)),
      ),
    }).check(
      Schema.makeFilter((sharedAccount) => {
        if (sharedAccount.origin === "papercut" && sharedAccount.papercutMfId === null)
          return ["papercutMfId must be non-null."];

        if (sharedAccount.origin === "internal" && sharedAccount.papercutMfId !== null)
          return ["papercutMfId must be null."];

        return [];
      }),
    ).fields,
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveSharedAccountsView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveCustomerAuthorizedView extends TablesContract.View<ActiveCustomerAuthorizedSharedAccountsView>(
    `active_customer_authorized_${Table.name}`,
  )({ ...ActiveView.Model.fields, customerId: EntityId }) {}

  export class ActiveManagerAuthorizedView extends TablesContract.View<ActiveManagerAuthorizedSharedAccountsView>(
    `active_manager_authorized_${Table.name}`,
  )({ ...ActiveView.Model.fields, managerId: EntityId }) {}

  const IdOnly = Table.Model.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  export const isCustomerAuthorized = new Handler.Handler({
    name: "isCustomerAuthorizedSharedAccount",
    Input: IdOnly.mapFields(
      Struct.assign({ customerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const isManagerAuthorized = new Handler.Handler({
    name: "isManagerAuthorizedSharedAccount",
    Input: IdOnly.mapFields(
      Struct.assign({ managerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const canEdit = new Handler.Handler({
    name: "canEditSharedAccount",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canDelete = new Handler.Handler({
    name: "canDeleteSharedAccount",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canRestore = new Handler.Handler({
    name: "canRestoreSharedAccount",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const edit = new Handler.Handler({
    name: "editSharedAccount",
    Input: Table.Dto.mapFields(
      Struct.omit([
        ...Struct.keys(TablesContract.BaseModel.fields),
        "name",
        "origin",
        "papercutMfId",
      ]),
    )
      .mapFields(Struct.map(Schema.optional))
      .mapFields(
        Struct.assign(
          Struct.evolve(Struct.pick(Table.Model.fields, ["id", "updatedAt"]), {
            id: (id) => id.from.schema.members[0],
          }),
        ),
      ),
    Output: Table.Dto,
  });

  export const delete_ = new Handler.Handler({
    name: "deleteSharedAccount",
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
    name: "restoreSharedAccount",
    Input: IdOnly,
    Output: Table.Dto,
  });
}

export namespace SharedAccountCustomerAccessContract {
  export class Table extends TablesContract.Table<SharedAccountCustomerAccessTable>(
    "shared_account_customer_access",
  )({ ...TablesContract.BaseSyncModel.fields, customerId: EntityId, sharedAccountId: EntityId }, [
    "read",
  ]) {}

  export class ActiveView extends TablesContract.View<ActiveSharedAccountCustomerAccessView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveAuthorizedView extends TablesContract.VirtualView<ActiveAuthorizedSharedAccountCustomerAccessView>()(
    `active_authorized_${Table.name}`,
    ActiveView.Model.fields,
  ) {}
}

export namespace SharedAccountManagerAccessContract {
  export class Table extends TablesContract.Table<SharedAccountManagerAccessTable>(
    "shared_account_manager_access",
  )({ ...TablesContract.BaseSyncModel.fields, managerId: EntityId, sharedAccountId: EntityId }, [
    "create",
    "read",
    "delete",
  ]) {}

  export class ActiveView extends TablesContract.View<ActiveSharedAccountManagerAccessView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveAuthorizedView extends TablesContract.VirtualView<ActiveAuthorizedSharedAccountManagerAccessView>()(
    `active_authorized_${Table.name}`,
    Table.Model.fields,
  ) {}

  export class ActiveCustomerAuthorizedView extends TablesContract.View<ActiveCustomerAuthorizedSharedAccountManagerAccessView>(
    `active_customer_authorized_${Table.name}`,
  )({ ...ActiveView.Model.fields, customerId: EntityId }) {}

  const IdOnly = Table.Model.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  export const canDelete = new Handler.Handler({
    name: "canDeleteSharedAccountManagerAccess",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canRestore = new Handler.Handler({
    name: "canRestoreSharedAccountManagerAccess",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const create = new Handler.Handler({
    name: "createSharedAccountManagerAccess",
    Input: Table.Dto.mapFields(Struct.omit(["deletedAt", "tenantId"])),
    Output: Table.Dto,
  });

  export const delete_ = new Handler.Handler({
    name: "deleteSharedAccountManagerAccess",
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
    name: "restoreSharedAccountManagerAccess",
    Input: IdOnly,
    Output: Table.Dto,
  });
}

export namespace SharedAccountGroupCustomerAccessContract {
  export class Table extends TablesContract.Table<SharedAccountGroupCustomerAccessTable>(
    "shared_account_group_customer_access",
  )(
    {
      ...TablesContract.BaseSyncModel.fields,
      groupId: EntityId,
      sharedAccountId: EntityId,
    },
    ["read"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveSharedAccountGroupCustomerAccessView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveAuthorizedView extends TablesContract.View<ActiveAuthorizedSharedAccountGroupCustomerAccessView>(
    `active_authorized_${Table.name}`,
  )({ ...ActiveView.Model.fields, memberId: EntityId }) {}
}

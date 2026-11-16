import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { Handler } from "../handlers";
import { TablesContract } from "../tables/contract";
import { EntityId, HexColor } from "../utils";
import { Constants } from "../utils/constants";

import type {
  ActiveCustomerAuthorizedSharedAccountWorkflowStatusesView,
  ActiveCustomerAuthorizedSharedAccountWorkflowsView,
  ActiveManagerAuthorizedSharedAccountWorkflowStatusesView,
  ActiveManagerAuthorizedSharedAccountWorkflowsView,
  ActivePublishedRoomRoomWorkflowsView,
  ActivePublishedRoomWorkflowStatusesView,
  ActiveRoomWorkflowsView,
  ActiveSharedAccountWorkflowsView,
  ActiveWorkflowStatusesView,
  RoomWorkflowsTable,
  SharedAccountWorkflowsTable,
  WorkflowStatusesTable,
} from "./sql";

export namespace RoomWorkflowsContract {
  export class Table extends TablesContract.Table<RoomWorkflowsTable>("room_workflows")(
    { ...TablesContract.BaseSyncModel.fields, roomId: EntityId },
    ["read"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveRoomWorkflowsView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActivePublishedRoomView extends TablesContract.View<ActivePublishedRoomRoomWorkflowsView>(
    `active_published_room_${Table.name}`,
  )(ActiveView.Model.fields) {}
}

export namespace SharedAccountWorkflowsContract {
  export class Table extends TablesContract.Table<SharedAccountWorkflowsTable>(
    "shared_account_workflows",
  )({ ...TablesContract.BaseSyncModel.fields, sharedAccountId: EntityId }, ["read"]) {}

  export class ActiveView extends TablesContract.View<ActiveSharedAccountWorkflowsView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveCustomerAuthorizedView extends TablesContract.View<ActiveCustomerAuthorizedSharedAccountWorkflowsView>(
    `active_customer_authorized_${Table.name}`,
  )({ ...ActiveView.Model.fields, customerId: EntityId }) {}

  export class ActiveManagerAuthorizedView extends TablesContract.View<ActiveManagerAuthorizedSharedAccountWorkflowsView>(
    `active_manager_authorized_${Table.name}`,
  )({ ...ActiveView.Model.fields, managerId: EntityId }) {}

  const IdOnly = Table.Model.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  export const isCustomerAuthorized = new Handler.Handler({
    name: "isCustomerAuthorizedSharedAccountWorkflow",
    Input: IdOnly.mapFields(
      Struct.assign({ customerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const isManagerAuthorized = new Handler.Handler({
    name: "isManagerAuthorizedSharedAccountWorkflow",
    Input: IdOnly.mapFields(
      Struct.assign({ managerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });
}

export namespace WorkflowStatusesContract {
  export const types = ["New", "Pending", "InProgress", "Completed"] as const;
  export type Type = (typeof types)[number];

  class BaseModel extends TablesContract.BaseSyncModel.extend<BaseModel>("BaseModel")({
    name: Schema.Trim.check(Schema.isMaxLength(Constants.VARCHAR_LENGTH)),
    type: Schema.Literals(types),
    charging: Schema.Boolean,
    color: HexColor.pipe(Schema.NullOr),
    index: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }) {}

  export class RoomWorkflowModel extends BaseModel.extend<RoomWorkflowModel>("RoomWorkflow")({
    roomWorkflowId: EntityId,
    sharedAccountWorkflowId: Schema.Null,
  }) {}

  export class SharedAccountWorkflowModel extends BaseModel.extend<SharedAccountWorkflowModel>(
    "SharedAccountWorkflow",
  )({ roomWorkflowId: Schema.Null, sharedAccountWorkflowId: EntityId }) {}

  export class Table extends TablesContract.UnionTable<WorkflowStatusesTable>("workflow_statuses")(
    [RoomWorkflowModel.fields, SharedAccountWorkflowModel.fields],
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveRoomWorkflowModel extends BaseModel.extend<ActiveRoomWorkflowModel>(
    "ActiveRoomWorkflow",
  )(
    Struct.evolve(RoomWorkflowModel.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveSharedAccountWorkflowModel extends BaseModel.extend<ActiveSharedAccountWorkflowModel>(
    "ActiveSharedAccountWorkflow",
  )(
    Struct.evolve(SharedAccountWorkflowModel.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveView extends TablesContract.UnionView<ActiveWorkflowStatusesView>(
    `active_${Table.name}`,
  )([ActiveRoomWorkflowModel.fields, ActiveSharedAccountWorkflowModel.fields]) {}

  export class ActiveCustomerAuthorizedSharedAccountView extends TablesContract.View<ActiveCustomerAuthorizedSharedAccountWorkflowStatusesView>(
    `active_customer_authorized_shared_account_${Table.name}`,
  )({ ...ActiveSharedAccountWorkflowModel.fields, customerId: EntityId }) {}

  export class ActiveManagerAuthorizedSharedAccountView extends TablesContract.View<ActiveManagerAuthorizedSharedAccountWorkflowStatusesView>(
    `active_manager_authorized_shared_account_${Table.name}`,
  )({ ...ActiveSharedAccountWorkflowModel.fields, managerId: EntityId }) {}

  export class ActivePublishedRoomView extends TablesContract.View<ActivePublishedRoomWorkflowStatusesView>(
    `active_published_room_${Table.name}`,
  )(ActiveRoomWorkflowModel.fields) {}

  const IdOnly = BaseModel.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  export const canEdit = new Handler.Handler({
    name: "canEditWorkflowStatus",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canDelete = new Handler.Handler({
    name: "canDeleteWorkflowStatus",
    Input: IdOnly,
    Output: Schema.Void,
  });

  const omittedOnAppend = [...Table.dtoOmitKeys, "index", "deletedAt", "tenantId"] as const;
  export const append = new Handler.Handler({
    name: "appendWorkflowStatus",
    Input: Schema.Union([
      SharedAccountWorkflowModel.mapFields(Struct.omit(omittedOnAppend)),
      RoomWorkflowModel.mapFields(Struct.omit(omittedOnAppend)),
    ]),
    Output: Table.Dto,
  });

  export const edit = new Handler.Handler({
    name: "editWorkflowStatus",
    Input: BaseModel.mapFields(
      Struct.omit([...Struct.keys(TablesContract.BaseSyncModel.fields), "index"]),
    )
      .mapFields(Struct.map(Schema.optional))
      .mapFields(
        Struct.assign(
          Struct.evolve(Struct.pick(BaseModel.fields, ["id", "updatedAt"]), {
            id: (id) => id.from.schema.members[0],
          }),
        ),
      ),
    Output: Table.Dto,
  });

  export const reorder = new Handler.Handler({
    name: "reorderWorkflowStatus",
    Input: Schema.Struct(
      Struct.evolve(Struct.pick(BaseModel.fields, ["id", "index", "updatedAt"]), {
        id: (id) => id.from.schema.members[0],
      }),
    ),
    Output: Table.Dto.pipe(Schema.Array),
  });

  export const delete_ = new Handler.Handler({
    name: "deleteWorkflowStatus",
    Input: IdOnly.mapFields(
      Struct.assign(
        Struct.evolve(Struct.pick(BaseModel.fields, ["deletedAt"]), {
          deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[0],
        }),
      ),
    ),
    Output: Table.Dto,
  });
}

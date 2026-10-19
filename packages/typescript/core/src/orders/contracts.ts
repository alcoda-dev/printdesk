import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";

import { AssetsContract } from "../assets/contract";
import { AttributesContract } from "../attributes/contract";
import { ColumnsContract } from "../columns/contract";
import { Handler } from "../handlers";
import { TablesContract } from "../tables/contract";
import { EntityId, IsoDate, IsoTimestamp, omitStructFields, optionalStructFields } from "../utils";
import { Constants } from "../utils/constants";

import type {
  ActiveCustomerOrderObjectMetadataView,
  ActiveCustomerOrdersView,
  ActiveManagerAuthorizedSharedAccountOrderObjectMetadataView,
  ActiveManagerAuthorizedSharedAccountOrdersView,
  ActiveOrderObjectMetadataView,
  ActiveOrdersView,
  OrderObjectMetadataTable,
  OrdersTable,
} from "./sql";

export namespace OrdersContract {
  export const draftStatus = "draft";
  export const submittedStatus = "submitted";
  export const Status = Schema.Literals([draftStatus, submittedStatus]);

  export class AttributesV1 extends Schema.TaggedClass<
    AttributesV1,
    { readonly brand: unique symbol }
  >()("OrderAttributesV1", {
    // Product name
    productName: Schema.String,

    // Delivery options
    deliveryOption: Schema.Struct({
      cost: Schema.String,
      name: Schema.String,
      detailsLabel: Schema.String,
    }),

    // Order dates
    created: IsoTimestamp,
    due: IsoDate.pipe(Schema.optional),

    // Copies
    copies: Schema.Struct({
      quantity: Schema.Finite,
    }).pipe(Schema.optional),

    // Color mode
    color: Schema.Struct({
      enabled: Schema.Boolean,
    }).pipe(Schema.optional),

    // Pages
    pages: Schema.Struct({
      grayscalePages: Schema.Int,
      colorPages: Schema.Int,
    }).pipe(Schema.optional),

    // Single or double sided
    printOnBothSides: Schema.Struct({
      enabled: Schema.Boolean,
    }).pipe(Schema.optional),

    // Paper stock
    paperStock: Schema.Struct({
      cost: Schema.Finite,
      size: Schema.String,
      color: Schema.String,
      type: Schema.String,
    }).pipe(Schema.optional),

    // Collating
    collating: Schema.Struct({
      name: Schema.String,
    }).pipe(Schema.optional),

    // Front Cover
    frontCover: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,
    }).pipe(Schema.optional),

    // Binding
    binding: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,

      // Binding option sub-attributes
      attributes: Schema.Struct({
        name: Schema.String,

        // Binding option sub-attribute options
        option: Schema.Struct({
          cost: Schema.Finite,
          name: Schema.String,
        }),
      }).pipe(Schema.Array),
    }).pipe(Schema.optional),

    // Cutting
    cutting: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,
    }).pipe(Schema.optional),

    // Hole punching
    holePunching: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,
    }).pipe(Schema.optional),

    // Folding
    folding: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,
    }).pipe(Schema.optional),

    // Packaging
    packaging: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,
      itemsPerSet: Schema.Finite,
    }).pipe(Schema.optional),

    // Laminating
    laminating: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,
    }).pipe(Schema.optional),

    // Proof Required
    proofRequired: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,
    }).pipe(Schema.optional),

    // Material
    material: Schema.Struct({
      cost: Schema.Finite,
      name: Schema.String,

      // Material color options
      color: Schema.Struct({
        cost: Schema.Finite,
        name: Schema.String,
        value: Schema.String,
      }),
    }).pipe(Schema.optional),

    // Custom text fields
    custom: Schema.Struct({
      fields: Schema.Struct({
        name: Schema.String,
        value: Schema.String,

        // Custom drop-down list options
        option: Schema.Struct({
          cost: Schema.Finite,
          name: Schema.String,
        }),
      }).pipe(Schema.Array),
    }).pipe(Schema.optional),
  }) {}
  export const Attributes = Schema.Union([AttributesV1]);

  class BaseModel extends TablesContract.BaseSyncModel.extend<BaseModel>("BaseModel")({
    shortId: ColumnsContract.NullableShortId,
    customerId: EntityId,
    managerId: ColumnsContract.NullableEntityId,
    operatorId: ColumnsContract.NullableEntityId,
    productId: EntityId,
    sharedAccountId: EntityId.pipe(Schema.NullOr),
    approvedAt: ColumnsContract.NullableTimestamp,
  }) {}

  export class DraftRoomWorkflowStatusModel extends BaseModel.extend<DraftRoomWorkflowStatusModel>(
    "DraftRoomWorkflowStatusModel",
  )({
    status: Status.members[0],
    deliveryOptionId: EntityId.pipe(Schema.NullOr),
    attributes: Attributes.pipe(Schema.NullOr),
    roomWorkflowStatusId: EntityId.pipe(Schema.NullOr),
    sharedAccountWorkflowStatusId: Schema.Null,
  }) {}

  export class DraftSharedAccountWorkflowStatusModel extends BaseModel.extend<DraftSharedAccountWorkflowStatusModel>(
    "DraftSharedAccountWorkflowStatusModel",
  )({
    status: Status.members[0],
    deliveryOptionId: EntityId.pipe(Schema.NullOr),
    attributes: Attributes.pipe(Schema.NullOr),
    roomWorkflowStatusId: Schema.Null,
    sharedAccountWorkflowStatusId: EntityId.pipe(Schema.NullOr),
  }) {}

  export class SubmittedRoomWorkflowStatusModel extends BaseModel.extend<SubmittedRoomWorkflowStatusModel>(
    "SubmittedRoomWorkflowStatusModel",
  )({
    status: Status.members[1],
    deliveryOptionId: EntityId,
    attributes: Attributes,
    roomWorkflowStatusId: EntityId,
    sharedAccountWorkflowStatusId: Schema.Null,
  }) {}

  export class SubmittedSharedAccountWorkflowStatusModel extends BaseModel.extend<SubmittedSharedAccountWorkflowStatusModel>(
    "SubmittedSharedAccountWorkflowStatusModel",
  )({
    status: Status.members[1],
    deliveryOptionId: EntityId,
    attributes: Attributes,
    roomWorkflowStatusId: Schema.Null,
    sharedAccountWorkflowStatusId: EntityId,
  }) {}

  export class Table extends TablesContract.UnionTable<OrdersTable>("orders")(
    [
      DraftRoomWorkflowStatusModel.fields,
      DraftSharedAccountWorkflowStatusModel.fields,
      SubmittedRoomWorkflowStatusModel.fields,
      SubmittedSharedAccountWorkflowStatusModel.fields,
    ],
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveDraftRoomWorkflowStatusModel extends Schema.Class<
    ActiveDraftRoomWorkflowStatusModel,
    { readonly brand: unique symbol }
  >("ActiveDraftRoomWorkflowStatusModel")(
    Struct.evolve(DraftRoomWorkflowStatusModel.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveDraftSharedAccountWorkflowStatusModel extends Schema.Class<
    ActiveDraftSharedAccountWorkflowStatusModel,
    { readonly brand: unique symbol }
  >("ActiveDraftSharedAccountWorkflowStatusModel")(
    Struct.evolve(DraftSharedAccountWorkflowStatusModel.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveSubmittedRoomWorkflowStatusModel extends Schema.Class<
    ActiveSubmittedRoomWorkflowStatusModel,
    { readonly brand: unique symbol }
  >("ActiveSubmittedRoomWorkflowStatusModel")(
    Struct.evolve(SubmittedRoomWorkflowStatusModel.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveSubmittedSharedAccountWorkflowStatusModel extends Schema.Class<
    ActiveSubmittedSharedAccountWorkflowStatusModel,
    { readonly brand: unique symbol }
  >("ActiveSubmittedSharedAccountWorkflowStatusModel")(
    Struct.evolve(SubmittedSharedAccountWorkflowStatusModel.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveView extends TablesContract.UnionView<ActiveOrdersView>(
    `active_${Table.name}`,
  )([
    ActiveDraftSharedAccountWorkflowStatusModel.fields,
    ActiveDraftRoomWorkflowStatusModel.fields,
    ActiveSubmittedSharedAccountWorkflowStatusModel.fields,
    ActiveSubmittedRoomWorkflowStatusModel.fields,
  ]) {}

  export class ActiveCustomerView extends TablesContract.UnionVirtualView<ActiveCustomerOrdersView>()(
    `active_customer_${Table.name}`,
    ActiveView.membersFields,
  ) {}

  export class ActiveDraftManagerAuthorizedRoomWorkflowStatusModel extends ActiveDraftRoomWorkflowStatusModel.extend<ActiveDraftManagerAuthorizedRoomWorkflowStatusModel>(
    "ActiveDraftManagerAuthorizedSharedAccountRoomWorkflowStatusModel",
  )({ authorizedManagerId: EntityId }) {}

  export class ActiveDraftManagerAuthorizedSharedAccountWorkflowStatusModel extends ActiveDraftSharedAccountWorkflowStatusModel.extend<ActiveDraftManagerAuthorizedSharedAccountWorkflowStatusModel>(
    "ActiveDraftManagerAuthorizedSharedAccountWorkflowStatusModel",
  )({ authorizedManagerId: EntityId }) {}

  export class ActiveSubmittedManagerAuthorizedRoomWorkflowStatusModel extends ActiveSubmittedRoomWorkflowStatusModel.extend<ActiveSubmittedManagerAuthorizedRoomWorkflowStatusModel>(
    "ActiveSubmittedManagerAuthorizedSharedAccountRoomWorkflowStatusModel",
  )({ authorizedManagerId: EntityId }) {}

  export class ActiveSubmittedManagerAuthorizedSharedAccountWorkflowStatusModel extends ActiveSubmittedSharedAccountWorkflowStatusModel.extend<ActiveSubmittedManagerAuthorizedSharedAccountWorkflowStatusModel>(
    "ActiveSubmittedManagerAuthorizedSharedAccountWorkflowStatusModel",
  )({ authorizedManagerId: EntityId }) {}

  export class ActiveManagerAuthorizedSharedAccountView extends TablesContract.UnionView<ActiveManagerAuthorizedSharedAccountOrdersView>(
    `active_manager_authorized_shared_account_${Table.name}`,
  )([
    ActiveDraftManagerAuthorizedSharedAccountWorkflowStatusModel.fields,
    ActiveDraftManagerAuthorizedRoomWorkflowStatusModel.fields,
    ActiveSubmittedManagerAuthorizedSharedAccountWorkflowStatusModel.fields,
    ActiveSubmittedManagerAuthorizedRoomWorkflowStatusModel.fields,
  ]) {}

  export class Item extends Schema.Class<Item, { readonly brand: unique symbol }>("Item")({
    [Constants.DYNAMO_KEYS.PK]: AttributesContract.TenantRoomIdFromString,
    [Constants.DYNAMO_KEYS.SK]: AttributesContract.OrderShortIdFromString,
  }) {}

  const IdOnly = BaseModel.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  export const isCustomer = new Handler.Handler({
    name: "isOrderCustomer",
    Input: IdOnly.mapFields(
      Struct.assign({ customerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const isManager = new Handler.Handler({
    name: "isOrderManager",
    Input: IdOnly.mapFields(
      Struct.assign({ managerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const isCustomerOrManager = new Handler.Handler({
    name: "isOrderCustomerOrManager",
    Input: IdOnly.mapFields(Struct.assign({ userId: EntityId.pipe(Schema.OptionFromUndefinedOr) })),
    Output: Schema.Void,
  });

  export const isManagerAuthorized = new Handler.Handler({
    name: "isOrderManagerAuthorized",
    Input: IdOnly.mapFields(
      Struct.assign({ managerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const canEdit = new Handler.Handler({
    name: "canEditOrder",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canApprove = new Handler.Handler({
    name: "canApproveOrder",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canTransition = new Handler.Handler({
    name: "canTransitionOrder",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canDelete = new Handler.Handler({
    name: "canDeleteOrder",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canRestore = new Handler.Handler({
    name: "canRestoreOrder",
    Input: IdOnly,
    Output: Schema.Void,
  });

  const omittedOnDraft = [
    ...Table.dtoOmitKeys,
    "shortId",
    "status",
    "managerId",
    "operatorId",
    "approvedAt",
    "deletedAt",
    "tenantId",
  ] as const;
  export const draft = new Handler.Handler({
    name: "draftOrder",
    Input: Schema.Union([
      DraftSharedAccountWorkflowStatusModel.mapFields(Struct.omit(omittedOnDraft)),
      DraftRoomWorkflowStatusModel.mapFields(Struct.omit(omittedOnDraft)),
    ]),
    Output: Table.Dto,
  });

  export const submit = new Handler.Handler({
    name: "submitOrder",
    Input: Schema.Union([
      IdOnly.pipe(
        Schema.fieldsAssign(
          Struct.pick(SubmittedRoomWorkflowStatusModel.fields, [
            "roomWorkflowStatusId",
            "sharedAccountWorkflowStatusId",
          ]),
        ),
      ),
      IdOnly.pipe(
        Schema.fieldsAssign(
          Struct.pick(SubmittedSharedAccountWorkflowStatusModel.fields, [
            "roomWorkflowStatusId",
            "sharedAccountWorkflowStatusId",
          ]),
        ),
      ),
    ]),
    Output: Table.Dto,
  });

  export const edit = new Handler.Handler({
    name: "editOrder",
    Input: Table.Model.mapMembers(
      Tuple.map(
        omitStructFields([
          ...Struct.keys(TablesContract.BaseSyncModel.fields),
          "shortId",
          "status",
          "customerId",
          "managerId",
          "operatorId",
          "roomWorkflowStatusId",
          "sharedAccountWorkflowStatusId",
          "approvedAt",
        ]),
      ),
    )
      .mapMembers(Tuple.map(optionalStructFields))
      .mapMembers(
        Tuple.map(
          Schema.fieldsAssign(
            Struct.evolve(Struct.pick(BaseModel.fields, ["id", "updatedAt"]), {
              id: (id) => id.from.schema.members[0],
            }),
          ),
        ),
      ),
    Output: Table.Dto,
  });

  export const approve = new Handler.Handler({
    name: "approveOrder",
    Input: IdOnly.mapFields(
      Struct.assign(
        Struct.evolve(
          Struct.pick(DraftRoomWorkflowStatusModel.fields, ["approvedAt", "roomWorkflowStatusId"]),
          { approvedAt: (approvedAt) => approvedAt.schema.from.schema.members[0].members[0] },
        ),
      ),
    ),
    Output: Table.Dto,
  });

  export const transitionRoomWorkflowStatus = new Handler.Handler({
    name: "transitionOrderRoomWorkflowStatus",
    Input: IdOnly.mapFields(
      Struct.assign(
        Struct.pick(DraftRoomWorkflowStatusModel.fields, ["updatedAt", "roomWorkflowStatusId"]),
      ),
    ),
    Output: Table.Dto,
  });

  export const transitionSharedAccountWorkflowStatus = new Handler.Handler({
    name: "transitionOrderSharedAccountWorkflowStatus",
    Input: IdOnly.mapFields(
      Struct.assign(
        Struct.pick(DraftSharedAccountWorkflowStatusModel.fields, [
          "updatedAt",
          "sharedAccountWorkflowStatusId",
        ]),
      ),
    ),
    Output: Table.Dto,
  });

  export const delete_ = new Handler.Handler({
    name: "deleteOrder",
    Input: IdOnly.mapFields(
      Struct.assign(
        Struct.evolve(Struct.pick(BaseModel.fields, ["deletedAt"]), {
          deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[0],
        }),
      ),
    ),
    Output: Table.Dto,
  });

  export const restore = new Handler.Handler({
    name: "restoreOrder",
    Input: IdOnly,
    Output: Table.Dto,
  });

  export class NotFoundError
    extends Schema.TaggedError<NotFoundError, { readonly brand: unique symbol }>()(
      "OrderNotFoundError",
      { id: EntityId },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(NotFoundError)(this, { status: 404 });
  }
}

export namespace OrderObjectMetadataContract {
  export const Status = Schema.Literals(["pending", "uploading", "success", "failure"]);
  export type Status = typeof Status.Type;

  export class Table extends TablesContract.Table<OrderObjectMetadataTable>(
    "order_object_metadata",
  )(
    {
      ...TablesContract.BaseSyncModel.fields,
      orderId: EntityId,
      filename: Schema.NonEmptyString,
      mimeType: Schema.NonEmptyString,
      byteSize: Schema.ByteSizeFromNumber,
      status: Status,
    },
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveOrderObjectMetadataView>(
    `active_${Table.name}`,
  )(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActiveCustomerView extends TablesContract.VirtualView<ActiveCustomerOrderObjectMetadataView>()(
    `active_customer_${Table.name}`,
    { ...ActiveView.Model.fields, customerId: EntityId },
  ) {}

  export class ActiveManagerAuthorizedSharedAccountView extends TablesContract.View<ActiveManagerAuthorizedSharedAccountOrderObjectMetadataView>(
    `active_manager_authorized_shared_account_${Table.name}`,
  )({ ...ActiveView.Model.fields, authorizedManagerId: EntityId }) {}

  export const Key = Schema.TemplateLiteralParser([
    OrdersContract.Table.name,
    "/",
    EntityId, // orderId
    "/",
    EntityId, // objectId
  ]).pipe(
    Schema.decodeTo(Schema.Struct({ orderId: EntityId, objectId: EntityId }), {
      decode: SchemaGetter.transform(([, , orderId, , objectId]) => ({ orderId, objectId })),
      encode: SchemaGetter.transform(({ orderId, objectId }) => [
        OrdersContract.Table.name,
        "/",
        EntityId.make(orderId),
        "/",
        EntityId.make(objectId),
      ]),
    }),
  );
  export type Key = typeof Key.Type;
  export type EncodedKey = typeof Key.Encoded;

  const IdOnly = Table.Model.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  export const isCustomer = new Handler.Handler({
    name: "isOrderObjectMetadataCustomer",
    Input: IdOnly.mapFields(
      Struct.assign({ customerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const isManager = new Handler.Handler({
    name: "isOrderObjectMetadataManager",
    Input: IdOnly.mapFields(
      Struct.assign({ managerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const isCustomerOrManager = new Handler.Handler({
    name: "isOrderObjectMetadataCustomerOrManager",
    Input: IdOnly.mapFields(Struct.assign({ userId: EntityId.pipe(Schema.OptionFromUndefinedOr) })),
    Output: Schema.Void,
  });

  export const isManagerAuthorized = new Handler.Handler({
    name: "isOrderObjectMetadataManagerAuthorized",
    Input: IdOnly.mapFields(
      Struct.assign({ managerId: EntityId.pipe(Schema.OptionFromUndefinedOr) }),
    ),
    Output: Schema.Void,
  });

  export const canEdit = new Handler.Handler({
    name: "canEditOrderObjectMetadata",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canDelete = new Handler.Handler({
    name: "canDeleteOrderObjectMetadata",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const create = new Handler.Handler({
    name: "createOrderObjectMetadata",
    Input: Table.Dto.mapFields(Struct.omit(["deletedAt", "tenantId"])),
    Output: Table.Dto,
  });

  export const transitionStatus = new Handler.Handler({
    name: "transitionOrderObjectMetadataStatus",
    Input: IdOnly.mapFields(Struct.assign(Struct.pick(Table.Model.fields, ["status"]))),
    Output: Table.Dto,
  });

  export const delete_ = new Handler.Handler({
    name: "deleteOrderObjectMetadata",
    Input: IdOnly.mapFields(
      Struct.assign(
        Struct.evolve(Struct.pick(Table.Model.fields, ["deletedAt"]), {
          deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[0],
        }),
      ),
    ),
    Output: Table.Dto,
  });

  export const PresignedUrlsSuccess = Schema.Record(
    EntityId,
    AssetsContract.PresignedUrlSuccess,
  ).pipe(HttpApiSchema.status(200));

  export class NotFoundError
    extends Schema.TaggedError<NotFoundError, { readonly brand: unique symbol }>()(
      "OrderObjectNotFoundError",
      { id: EntityId },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(NotFoundError)(this, { status: 404 });
  }
}

import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { ColumnsContract } from "../columns/contract";
import { Handler } from "../handlers";
import { TablesContract } from "../tables/contract";
import { Cost, EntityId, HexColor, NonEmptyString } from "../utils";
import { Constants } from "../utils/constants";

import type { ActiveProductsView, ActivePublishedProductsView, ProductsTable } from "./sql";

export namespace ProductsContract {
  export const Status = Schema.Literals(["draft", "published"]);
  export type Status = typeof Status.Type;

  export class Option extends Schema.Class<Option, { readonly brand: unique symbol }>("Option")({
    name: Schema.Trim,
    image: Schema.String,
    description: Schema.Trim.pipe(Schema.optional),
    cost: Cost,
  }) {}
  export class Field extends Schema.Class<Field, { readonly brand: unique symbol }>("Field")({
    name: Schema.Trim,
    required: Schema.Boolean,
    options: Option.pipe(Schema.Array),
  }) {}
  const fallbackBoolean = (fallback = true) =>
    Schema.Boolean.pipe(Schema.catchDecoding(() => Effect.succeedSome(fallback)));
  export class AttributesV1 extends Schema.TaggedClass<
    AttributesV1,
    { readonly brand: unique symbol }
  >()("ProductAttributesV1", {
    copies: Schema.Struct({ visible: fallbackBoolean() }),
    printColor: Schema.Struct({ visible: fallbackBoolean() }),
    singleOrDoubleSided: Schema.Struct({ visible: fallbackBoolean() }),
    due: Schema.Struct({
      visible: fallbackBoolean(),
      leadTimeDays: Schema.Int.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
        Schema.catchDecoding(() => Effect.succeedSome(0)),
      ),
      workingDays: Schema.Literals(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
      paperStock: Schema.Struct({ options: Option.pipe(Schema.Array) }).pipe(Schema.optional),
      custom: Schema.Struct({ name: Schema.String, fields: Field.pipe(Schema.Array) }).pipe(
        Schema.optional,
      ),
      customOperatorOnly: Schema.Struct({
        name: Schema.String,
        fields: Field.pipe(Schema.Array),
      }).pipe(Schema.optional),
      backCover: Schema.Struct({ options: Option.pipe(Schema.Array) }).pipe(Schema.optional),
      cutting: Schema.Struct({ options: Option.pipe(Schema.Array) }).pipe(Schema.optional),
      binding: Schema.Struct({
        options: Schema.Struct({
          ...Option.fields,
          subAttributes: Schema.Struct({
            name: Schema.Trim,
            description: Schema.Trim.pipe(Schema.optional),
            options: Option.pipe(Schema.Array),
          }).pipe(Schema.Array),
        }).pipe(Schema.Array),
      }).pipe(Schema.optional),
      holePunching: Option.pipe(Schema.Array, Schema.optional),
      folding: Option.pipe(Schema.Array, Schema.optional),
      laminating: Option.pipe(Schema.Array, Schema.optional),
      packaging: Schema.Struct({
        name: Schema.Trim,
        image: Schema.String,
        cost: Cost,
        showItemsPerSet: Schema.Boolean,
      }).pipe(Schema.optional),
      material: Schema.Struct({
        name: Schema.Trim,
        color: Schema.Struct({ name: Schema.Trim, value: HexColor.pipe(Schema.optional) }),
        cost: Cost,
      }).pipe(Schema.optional),
      proofRequired: Schema.Struct({
        options: Schema.Struct({
          name: Schema.Trim,
          description: Schema.String.pipe(Schema.optional),
        }).pipe(Schema.Array),
      }).pipe(Schema.optional),
    }),
  }) {}
  export class ConfigurationV1 extends Schema.TaggedClass<
    ConfigurationV1,
    { readonly brand: unique symbol }
  >()("ProductConfigurationV1", {
    image: Schema.String,
    status: Status.pipe(Schema.withDecodingDefaultType(Effect.succeed("draft"))),
    orderAttachments: Schema.Struct({
      fileUploadEnabled: Schema.Boolean,
      physicalCopyEnabled: Schema.Boolean,
      byteSizeLimit: Schema.ByteSizeFromString.pipe(
        Schema.withConstructorDefault(
          Effect.succeed(ByteSize.fromInputUnsafe(Constants.DEFAULT_ORDER_OBJECT_BYTE_SIZE_LIMIT)),
        ),
        Schema.check(
          Schema.makeFilter((byteSize) => {
            if (
              byteSize &&
              ByteSize.isGreaterThan(
                byteSize,
                ByteSize.fromInputUnsafe(Constants.DEFAULT_ORDER_OBJECT_BYTE_SIZE_LIMIT),
              )
            )
              return "Order attachment byte size limit exceeded";
          }),
        ),
      ),
      mimeTypeAllowlist: NonEmptyString.pipe(Schema.Array, Schema.optional),
    }).pipe(Schema.optional),
    attributes: AttributesV1,
  }) {
    public static readonly statusLens = this.pipe(Schema.toIso).key("status");

    public isValidOrderAttachment(metadata: { mimeType: string; byteSize: ByteSize.ByteSize }) {
      if (!this.orderAttachments) return false;

      return (
        (this.orderAttachments.mimeTypeAllowlist?.includes(metadata.mimeType) ?? true) &&
        ByteSize.isLessThanOrEqualTo(metadata.byteSize, this.orderAttachments.byteSizeLimit)
      );
    }
  }
  export const Configuration = Schema.Union([ConfigurationV1]);
  export type Configuration = typeof Configuration.Type;

  export class Table extends TablesContract.Table<ProductsTable>("products")(
    {
      ...TablesContract.BaseSyncModel.fields,
      name: ColumnsContract.VarChar,
      status: Status.pipe(Schema.withDecodingDefaultType(Effect.succeed("draft"))),
      roomId: EntityId,
      config: Configuration,
    },
    ["create", "read", "update", "delete"],
  ) {}

  export class ActiveView extends TablesContract.View<ActiveProductsView>(`active_${Table.name}`)(
    Struct.evolve(Table.Model.fields, {
      deletedAt: (deletedAt) => deletedAt.schema.from.schema.members[0].members[1],
    }),
  ) {}

  export class ActivePublishedView extends TablesContract.View<ActivePublishedProductsView>(
    `active_published_${Table.name}`,
  )(
    Struct.evolve(ActiveView.Model.fields, {
      status: (status) => Schema.Literal(status.from.schema.members[0].literals[1]),
    }),
  ) {}

  const IdOnly = Table.Model.mapFields(Struct.pick(["id"])).mapFields(
    Struct.evolve({ id: (id) => id.from.schema.members[0] }),
  );

  const IdAndUpdatedAt = IdOnly.mapFields(
    Struct.assign(Struct.pick(Table.Model.fields, ["updatedAt"])),
  );

  export const canEdit = new Handler.Handler({
    name: "canEditProduct",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canDelete = new Handler.Handler({
    name: "canDeleteProduct",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const canRestore = new Handler.Handler({
    name: "canRestoreProduct",
    Input: IdOnly,
    Output: Schema.Void,
  });

  export const create = new Handler.Handler({
    name: "createProduct",
    Input: Table.Dto.mapFields(Struct.omit(["deletedAt", "tenantId"])),
    Output: Table.Dto,
  });

  export const edit = new Handler.Handler({
    name: "editProduct",
    Input: Table.Dto.mapFields(
      Struct.omit([...Struct.keys(TablesContract.BaseModel.fields), "status", "roomId"]),
    )
      .mapFields(Struct.map(Schema.optional))
      .mapFields(Struct.assign(IdAndUpdatedAt.fields)),
    Output: Table.Dto,
  });

  export const publish = new Handler.Handler({
    name: "publishProduct",
    Input: IdAndUpdatedAt,
    Output: Table.Dto,
  });

  export const draft = new Handler.Handler({
    name: "draftProduct",
    Input: IdAndUpdatedAt,
    Output: Table.Dto,
  });

  export const delete_ = new Handler.Handler({
    name: "deleteProduct",
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
    name: "restoreProduct",
    Input: IdOnly,
    Output: Table.Dto,
  });
}

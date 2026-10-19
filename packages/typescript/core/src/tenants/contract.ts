import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { ColumnsContract } from "../columns/contract";
import { Handler } from "../handlers";
import { TablesContract } from "../tables/contract";
import { EntityId } from "../utils";
import { Constants } from "../utils/constants";

import type { TenantsTable } from "./sql";

export namespace TenantsContract {
  export const Status = Schema.Literals(["setup", "active", "suspended"]);
  export type Status = typeof Status.Type;

  export const Slug = Schema.String.pipe(
    Schema.check(Schema.isPattern(Constants.TENANT_SLUG_REGEX)),
    Schema.brand("TenantSlug"),
  );
  export type Slug = typeof Slug.Type;

  export class Table extends TablesContract.Table<TenantsTable>("tenants")(
    {
      ...TablesContract.BaseSyncModel.fields,
      slug: Slug,
      name: Schema.String,
      status: Status.pipe(Schema.withDecodingDefaultType(Effect.succeed("setup"))),
      lastPapercutSyncAt: ColumnsContract.NullableTimestamp,
      licenseId: EntityId,
    },
    ["read", "update", "delete"],
    ["lastPapercutSyncAt", "licenseId", "version"],
  ) {}

  export class TenantSlugConflictError
    extends Schema.TaggedError<TenantSlugConflictError, { readonly brand: unique symbol }>()(
      "TenantSlugConflictError",
      { slug: Slug },
      { httpApiStatus: 409 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(TenantSlugConflictError)(this, { status: 409 });
  }

  export class InvalidStatusError extends Schema.TaggedError<
    InvalidStatusError,
    { readonly brand: unique symbol }
  >()("InvalidTenantStatusError", Table.Model.mapFields(Struct.pick(["id", "status"]))) {}

  export const edit = new Handler.Handler({
    name: "editTenant",
    Input: Table.Dto.mapFields(
      Struct.omit([...Struct.keys(TablesContract.BaseModel.fields), "status"]),
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
}

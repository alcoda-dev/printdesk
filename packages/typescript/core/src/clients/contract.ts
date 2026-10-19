import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { CryptoContract } from "../crypto/contract";
import { TablesContract } from "../tables/contract";
import { CallbackId, EntityId } from "../utils";

import type { ClientsTable } from "./sql";

export namespace ClientsContract {
  export const Status = Schema.Literals(["active", "suspended"]);
  export type Status = typeof Status.Type;

  export const Role = Schema.Literals([
    "api",
    "bootstrap",
    "invoicesProcessor",
    "papercutMfSync",
    "scim",
  ]);
  export type Role = typeof Role.Type;

  export const Scopes = Schema.NonEmptyString.pipe(Schema.Array);
  export type Scopes = typeof Scopes.Type;

  export class Table extends TablesContract.Table<ClientsTable>("clients")(
    {
      ...TablesContract.BaseModel.fields,
      name: Schema.NonEmptyString,
      secretHash: CryptoContract.HashFromString,
      status: Status.pipe(Schema.withDecodingDefaultType(Effect.succeed("active"))),
      role: Role,
      scopes: Scopes,
      callbackId: CallbackId.pipe(
        Schema.NullOr,
        Schema.withDecodingDefaultType(Effect.succeed(null)),
        Schema.withConstructorDefault(Effect.succeed(null)),
      ),
      identityProviderId: EntityId.pipe(Schema.NullOr),
    },
    ["create", "read", "delete"],
    ["secretHash", "callbackId"],
  ) {}

  export class NotFoundError extends Schema.TaggedError<
    NotFoundError,
    { readonly brand: unique symbol }
  >()("ClientNotFoundError", { id: Table.Model.fields.id }) {}

  export class InvalidStatusError extends Schema.TaggedError<
    InvalidStatusError,
    { readonly brand: unique symbol }
  >()("InvalidClientStatusError", Table.Model.mapFields(Struct.pick(["id", "status"]))) {}
}

import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Struct from "effect/Struct";

import { ColumnsContract } from "../columns/contract";
import { CryptoContract } from "../crypto/contract";
import { TablesContract } from "../tables/contract";
import { EntityId, Separator } from "../utils";

import type { LicensesTable } from "./sql";

export namespace LicensesContract {
  export const Key = CryptoContract.Secret;
  export type Key = typeof Key.Type;

  export class KeyPair extends Schema.Class<KeyPair>("KeyPair")({
    id: EntityId,
    key: Key,
  }) {}

  export const KeyPairFromString = Schema.TemplateLiteralParser([EntityId, Separator, Key]).pipe(
    Schema.decodeTo(KeyPair, {
      decode: SchemaGetter.transformEffect(([id, , key]) =>
        Schema.encodeEffect(KeyPair)({ id, key }).pipe(Effect.mapError(Struct.get("issue"))),
      ),
      encode: SchemaGetter.transformEffect(({ id, key }) =>
        Schema.decodeEffect(KeyPair)({ id, key }).pipe(
          Effect.mapBoth({
            onSuccess: ({ id, key }) => [id, Separator.literal, key],
            onFailure: Struct.get("issue"),
          }),
        ),
      ),
    }),
  );

  export class Table extends TablesContract.Table<LicensesTable>("licenses")(
    {
      id: EntityId,
      keyHash: CryptoContract.HashFromString,
      expiresAt: ColumnsContract.NullableTimestamp,
      ...ColumnsContract.Timestamps.fields,
    },
    ["read"],
    [],
  ) {}

  export class InvalidLicenseKeyError
    extends Schema.TaggedError<InvalidLicenseKeyError>()(
      "InvalidLicenseKeyError",
      { id: EntityId },
      { httpApiStatus: 400 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(InvalidLicenseKeyError)(this, { status: 400 });
  }

  export class ExpiredLicenseError
    extends Schema.TaggedError<ExpiredLicenseError>()(
      "ExpiredLicenseError",
      { expiredAt: Schema.DateTimeUtc },
      { httpApiStatus: 403 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(ExpiredLicenseError)(this, { status: 403 });
  }

  export class LicenseConflictError
    extends Schema.TaggedError<LicenseConflictError>()(
      "LicenseConflictError",
      { id: EntityId },
      { httpApiStatus: 409 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(LicenseConflictError)(this, { status: 409 });
  }

  export class NoSuchLicenseError
    extends Schema.TaggedError<NoSuchLicenseError>()(
      "NoSuchLicenseError",
      { id: EntityId },
      { httpApiStatus: 422 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(NoSuchLicenseError)(this, { status: 422 });
  }
}

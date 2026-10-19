import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { EntityId, ShortId, Version } from "../utils";
import { Constants } from "../utils/constants";

export namespace ColumnsContract {
  export const VarChar = Schema.Trim.pipe(
    Schema.check(Schema.isMaxLength(Constants.VARCHAR_LENGTH)),
  );
  export type VarChar = typeof VarChar.Type;

  export const Timestamp = Schema.DateTimeUtcFromString.pipe(
    Schema.withDecodingDefaultType(DateTime.now),
    Schema.withConstructorDefault(DateTime.now),
  );
  export const NullableTimestamp = Schema.DateTimeUtcFromString.pipe(
    Schema.NullOr,
    Schema.withDecodingDefaultType(Effect.succeed(null)),
    Schema.withConstructorDefault(Effect.succeed(null)),
  );

  export class Timestamps extends Schema.Class<Timestamps, { readonly brand: unique symbol }>(
    "Timestamps",
  )({
    createdAt: Timestamp,
    updatedAt: Timestamp,
    deletedAt: NullableTimestamp,
  }) {}

  export const NullableEntityId = EntityId.pipe(
    Schema.NullOr,
    Schema.withDecodingDefaultType(Effect.succeed(null)),
    Schema.withConstructorDefault(Effect.succeed(null)),
  );

  export const NullableShortId = ShortId.pipe(
    Schema.NullOr,
    Schema.withDecodingDefaultType(Effect.succeed(null)),
    Schema.withConstructorDefault(Effect.succeed(null)),
  );

  export const NullableVersion = Version.pipe(
    Schema.NullOr,
    Schema.withDecodingDefaultType(Effect.succeed(null)),
    Schema.withConstructorDefault(Effect.succeed(null)),
  );
}

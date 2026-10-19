import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

import { Base64 } from "../utils";
import { Constants } from "../utils/constants";

export namespace CryptoContract {
  export const Secret = Schema.NonEmptyString.pipe(
    Schema.RedactedFromValue,
    Schema.brand("Secret"),
  );
  export type Secret = typeof Secret.Type;

  export class InvalidSecretError extends Schema.TaggedError<
    InvalidSecretError,
    { readonly brand: unique symbol }
  >()("InvalidSecretError", {}) {}

  export class Hash extends Schema.Class<Hash, { readonly brand: unique symbol }>("Hash")({
    salt: Base64.pipe(Schema.decodeTo(Secret)),
    derivedKey: Base64.pipe(Schema.decodeTo(Secret)),
  }) {}

  export const HashFromString = Schema.TemplateLiteralParser([
    Base64, // salt
    Schema.Literal(Constants.SEPARATOR),
    Base64, // derived key
  ]).pipe(
    Schema.decodeTo(Hash, {
      decode: SchemaGetter.transform(([salt, , derivedKey]) => ({ salt, derivedKey })),
      encode: SchemaGetter.transform(({ salt, derivedKey }) => [
        salt,
        Constants.SEPARATOR,
        derivedKey,
      ]),
    }),
  );
}

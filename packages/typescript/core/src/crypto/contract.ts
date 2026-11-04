import * as Schema from "effect/Schema";

import { Base64 } from "../utils";

export namespace CryptoContract {
  export class InvalidSecretError extends Schema.TaggedError<
    InvalidSecretError,
    { readonly brand: unique symbol }
  >()("InvalidSecretError", {}) {}

  export const Base64Secret = Base64.pipe(
    Schema.brand("CryptoBase64Secret"),
    Schema.RedactedFromValue,
  );
  export type Base64Secret = typeof Base64Secret.Type;
}

import * as Context from "effect/Context";
import * as Mac from "effect/crypto/Mac";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { CryptoContract } from "../contract";

export class HmacSigningSecret extends Context.Service<HmacSigningSecret, Mac.Key>()(
  "@printdesk/core/crypto/HmacSigningSecret",
) {}

export class Hmac extends Context.Service<Hmac>()("@printdesk/core/crypto/Hmac", {
  make: Effect.gen(function* () {
    const random = yield* SecureRandom.SecureRandom;
    const mac = yield* Mac.Mac;

    const secret = yield* HmacSigningSecret;

    const issue = Effect.fn("Hmac.issue")(function* (size: number = 32) {
      const keyBytes = yield* random.randomBytes(size);
      const tagBytes = yield* mac.sign(secret, keyBytes);

      return {
        key: yield* Schema.decodeEffect(CryptoContract.Base64Secret)(Base64.encode(keyBytes)),
        hash: yield* Schema.decodeEffect(CryptoContract.Base64Secret)(Base64.encode(tagBytes)),
      };
    });

    const verify = Effect.fn("Hmac.verify")(function* (
      key: CryptoContract.Base64Secret,
      hash: CryptoContract.Base64Secret,
    ) {
      const keyBytes = yield* key.pipe(Redacted.value, Base64.decode, Effect.fromResult);
      const tagBytes = yield* hash.pipe(Redacted.value, Base64.decode, Effect.fromResult);

      return yield* mac
        .verify(secret, tagBytes, keyBytes)
        .pipe(
          Effect.filterOrFail(Predicate.isTruthy, () => new CryptoContract.InvalidSecretError()),
        );
    });

    return {
      issue,
      verify,
    } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

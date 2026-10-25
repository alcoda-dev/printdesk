// oxlint-disable-next-line effecttsgo/node-builtin-import
import { scrypt, timingSafeEqual } from "node:crypto";

import * as EffectCrypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as String from "effect/String";
import { SignJWT } from "jose";

import { Crypto } from ".";
import { CryptoContract } from "./contract";

import type { JWTHeaderParameters, KeyInput } from "jose";

export type ServiceShape = Effect.Success<typeof makeService>;

export class JwtSignError extends Schema.TaggedError<
  JwtSignError,
  { readonly brand: unique symbol }
>()("JwtSignError", { cause: Schema.Defect() }) {}

export interface SignJwtOptions {
  audience: string;
  subject: string;
  issuer: string;
  key: KeyInput;
  claims?: Record<string, unknown>;
  ttl?: Duration.Duration;
  protectedHeader?: JWTHeaderParameters;
}

export const makeService = Effect.gen(function* () {
  const crypto = yield* EffectCrypto.Crypto;

  const generateToken = Effect.fn("Crypto.generateToken")((size: number = 32) =>
    crypto.randomBytes(size).pipe(
      Effect.flatMap(Schema.encodeEffect(Schema.Uint8ArrayFromBase64)),
      Effect.map(Redacted.make),
      Effect.map((secret) => CryptoContract.Secret.make(secret)),
    ),
  );

  const deriveKeyFromSecret = Effect.fn("Crypto.deriveKeyFromSecret")(
    (secret: CryptoContract.Secret, salt: CryptoContract.Secret) =>
      Effect.tryPromise({
        try: () =>
          // oxlint-disable-next-line effecttsgo/new-promise
          new Promise<CryptoContract.Secret>((resolve, reject) =>
            scrypt(
              secret.pipe(Redacted.value, String.normalize()),
              salt.pipe(Redacted.value),
              64,
              (error, derivedKey) =>
                error
                  ? reject(error)
                  : resolve(
                      CryptoContract.Secret.make(Redacted.make(derivedKey.toString("base64"))),
                    ),
            ),
          ),
        catch: (cause) =>
          PlatformError.systemError({
            module: "Crypto",
            method: "deriveKeyFromSecret",
            _tag: "Unknown",
            description: "Could not derive key from secret",
            cause,
          }),
      }),
  );

  const hashSecret = Effect.fn("Crypto.hashSecret")(function* (secret: CryptoContract.Secret) {
    const salt = yield* generateToken(16);
    const derivedKey = yield* deriveKeyFromSecret(secret, salt);

    return new CryptoContract.Hash({ salt, derivedKey });
  });

  const verifySecret = Effect.fn("Crypto.verifySecret")(function* (
    secret: CryptoContract.Secret,
    { salt, derivedKey: storedKey }: CryptoContract.Hash,
  ) {
    const storedKeyBytes = yield* storedKey.pipe(
      Redacted.value,
      Schema.decodeEffect(Schema.Uint8ArrayFromBase64),
    );

    const derivedKeyBytes = yield* deriveKeyFromSecret(secret, salt).pipe(
      Effect.map(Redacted.value),
      Effect.flatMap(Schema.decodeEffect(Schema.Uint8ArrayFromBase64)),
    );

    yield* Effect.try({
      try: () => timingSafeEqual(storedKeyBytes, derivedKeyBytes),
      catch: (cause) =>
        PlatformError.badArgument({
          module: "Crypto",
          method: "verifySecret",
          description: "Could not verify secret",
          cause,
        }),
    }).pipe(Effect.filterOrFail(Predicate.isTruthy, () => new CryptoContract.InvalidSecretError()));
  });

  const signJwt = Effect.fn("Crypto.signJwt")((opts: SignJwtOptions) =>
    Effect.succeed(
      new SignJWT(opts.claims)
        .setProtectedHeader(opts.protectedHeader ?? { alg: "HS256", typ: "JWT" })
        .setSubject(opts.subject)
        .setIssuer(opts.issuer)
        .setAudience(opts.audience)
        .setIssuedAt()
        .setExpirationTime((opts.ttl ?? Duration.minutes(15)).pipe(Duration.toSeconds)),
    ).pipe(
      Effect.flatMap((jwt) =>
        Effect.tryPromise({
          try: () => jwt.sign(opts.key),
          catch: (error) => new JwtSignError({ cause: error }),
        }),
      ),
    ),
  );

  return {
    ...crypto,
    generateToken,
    deriveKeyFromSecret,
    hashSecret,
    verifySecret,
    signJwt,
  } as const;
});

export const layer = makeService.pipe(Layer.effect(Crypto));

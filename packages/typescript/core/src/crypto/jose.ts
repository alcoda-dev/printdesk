import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { SignJWT } from "jose";

import type { JWTHeaderParameters, KeyInput } from "jose";

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

export class Jose extends Context.Service<Jose>()("@printdesk/core/crypto/jose", {
  make: Effect.sync(function () {
    const signJwt = Effect.fn("Jose.signJwt")((opts: SignJwtOptions) =>
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
      signJwt,
    } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

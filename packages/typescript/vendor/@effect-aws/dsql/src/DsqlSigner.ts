import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Instance from "./DsqlSignerInstance.js";

/**
 * @since 0.1.0
 */
import type { DsqlSignerConfig } from "@aws-sdk/dsql-signer";

interface DsqlSigner$ {
  getDbConnectAdminAuthToken(): Effect.Effect<string>;
  getDbConnectAuthToken(): Effect.Effect<string>;
}

/**
 * @since 0.1.0
 * @category constructors
 */
export const makeDsqlSigner = Effect.gen(function* () {
  const client = yield* Instance.DsqlSignerInstance;

  return {
    getDbConnectAuthToken: () => Effect.promise(() => client.getDbConnectAuthToken()),
    getDbConnectAdminAuthToken: () => Effect.promise(() => client.getDbConnectAdminAuthToken()),
  };
});

/**
 * @since 0.1.0
 * @category models
 */
// oxlint-disable-next-line effecttsgo/lazy-effect
export class DsqlSigner extends Context.Service<DsqlSigner, DsqlSigner$>()(
  "@effect-aws/dsql/DsqlSigner",
) {
  /**
   * @since 0.1.0
   *
   * @example
   * import { Effect, Exit, Layer } from "effect";
   * import { pipe } from "effect/Function";
   * import { DsqlSigner } from "@effect-aws/dsql";
   *
   * const adminToken = DsqlSigner.getDbConnectAdminAuthToken().pipe(
   *   Effect.provide(DsqlSigner.layer({
   *     hostname: "<identifier>.dsql.<region>.on.aws",
   *   }))
   * );
   */
  public static readonly layer = (config: DsqlSigner.Config) =>
    Layer.effect(this, makeDsqlSigner).pipe(Layer.provide(Instance.layer(config)));
}

/**
 * @since 0.1.0
 */
export declare namespace DsqlSigner {
  /**
   * @since 0.1.0
   */
  export type Config = DsqlSignerConfig;

  /**
   * @since 0.1.0
   */
  export type Type = DsqlSigner$;
}

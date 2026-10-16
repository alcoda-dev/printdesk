import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Resource } from "sst/resource";

export class SstResource extends Context.Service<SstResource>()("@printdesk/core/sst/Resource", {
  make: Effect.succeed(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    new Proxy(
      {},
      {
        get: (_, key: keyof Resource) => Redacted.make(Resource[key]),
        getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
        ownKeys: () => Object.keys(Resource),
      },
    ) as { readonly [TKey in keyof Resource]: Redacted.Redacted<Resource[TKey]> },
  ),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

import { useAtomSuspense } from "@effect/atom-react";
import { makeResource } from "@printdesk/core/sst/client/resource";
import { Constants } from "@printdesk/core/utils/constants";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";

export class ViteResource extends Context.Service<ViteResource>()(
  "@printdesk/web/sst/ViteResource",
  {
    make: Effect.sync(() =>
      makeResource({
        env: import.meta.env,
        prefix: Constants.VITE_RESOURCE_PREFIX,
        prefixedOnly: true,
      }),
    ),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));

  public static readonly atom = this.layer.pipe(Atom.runtime).atom(this);

  public static readonly useAtom = <TKey extends keyof typeof ViteResource.Service>(key: TKey) =>
    this.atom.pipe(useAtomSuspense).value[key];
}

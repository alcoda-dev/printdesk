import { ActorLayerMap } from "@printdesk/core/actors";
import { ReadTransaction } from "@printdesk/core/database/client";
import { Replicache } from "@printdesk/core/replicache/client";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";
import * as Redacted from "effect/Redacted";

import { actorAtom } from "./actor";
import { ViteResource } from "./sst";

import type { MutationHandlers } from "@printdesk/core/handlers/mutations";
import type { SubscribeOptions } from "replicache";

export const replicacheAtomRuntime = FetchHttpClient.layer.pipe(
  Layer.merge(ActorLayerMap.layer),
  Atom.runtime,
);

export const replicacheAtom = replicacheAtomRuntime.atom((get) =>
  get.resultOnce(ViteResource.atom).pipe(
    Effect.flatMap(({ ApiGatewayProperties, Environment }) =>
      Effect.acquireRelease(
        Replicache.make({
          baseUrl: new URL(ApiGatewayProperties.pipe(Redacted.value).urls.api),
          logLevel: Environment.pipe(Redacted.value).isDevMode ? "info" : "error",
        }),
        (replicache) =>
          replicache.close.pipe(
            Effect.catchTag("ReplicacheCloseError", (error) =>
              Effect.logError("Error closing replicache instance:", error.cause),
            ),
          ),
      ),
    ),
    // oxlint-disable-next-line effecttsgo/strict-effect-provide
    Effect.provide(get.resultOnce(actorAtom).pipe(Effect.map(ActorLayerMap.get), Layer.unwrap)),
  ),
);

export const queryAtomRuntime = Replicache.repositoriesLayer.pipe(Atom.runtime);

export const makeQueryAtom = <
  TSuccess,
  TError,
  TServices extends Layer.Success<typeof Replicache.repositoriesLayer>,
>(
  query: Effect.Effect<TSuccess, TError, TServices | ReadTransaction>,
  opts?: Omit<SubscribeOptions<TSuccess>, "isEqual">,
) =>
  queryAtomRuntime.atom((get) =>
    get.resultOnce(replicacheAtom).pipe(
      Effect.flatMap((replicache) =>
        replicache.query(query).pipe(
          Effect.tap(() =>
            replicache
              .subscribe(query, {
                ...opts,
                onData: (data) => {
                  opts?.onData(data);
                  get.setSelf(data);
                },
              })
              .pipe(Effect.map((finalizer) => get.addFinalizer(finalizer))),
          ),
        ),
      ),
    ),
  );

export const makeMutationAtom = Atom.family(
  <TName extends keyof MutationHandlers.Record>(name: TName) =>
    Atom.fn(
      (args: MutationHandlers.Record[TName]["Input"]["Type"], get) =>
        get
          .result(replicacheAtom)
          .pipe(Effect.flatMap((replicache) => replicache.mutate(name, args))),
      { concurrent: true },
    ),
);

import { AccessControl } from "@printdesk/core/access-control";
import { ActorLayerMap } from "@printdesk/core/actors";
import { NetworkMonitor } from "@printdesk/core/network/client/monitor";
import { PolicyDispatcher } from "@printdesk/core/policies/client/dispatcher";
import { layer as policyDispatcherLayer } from "@printdesk/core/policies/client/dispatcher/layer";
import { Realtime } from "@printdesk/core/realtime/client";
import { Replicache } from "@printdesk/core/replicache/client";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Iterable from "effect/Iterable";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Atom from "effect/reactivity/Atom";

import { realtimeEventAtomLayer } from ".";
import { realtimeAtom } from "..";
import { actorAtom } from "../../actor";
import { replicacheAtom } from "../../replicache";

export const replicacheNotificationAtom = Realtime.makeEventAtom("/replicache/notification", {
  runtime: realtimeEventAtomLayer.pipe(
    Layer.merge([ActorLayerMap.layer, policyDispatcherLayer]),
    Layer.provide(Replicache.policiesLayer),
    Atom.runtime,
  ),
  atoms: {
    actor: actorAtom,
    realtime: realtimeAtom,
    networkMonitor: NetworkMonitor.atom,
  },
  handler: Effect.fn(function* (get, notification) {
    const replicache = yield* get.resultOnce(replicacheAtom);

    if (yield* replicache.clientGroupId.pipe(Effect.map(Equal.equals(notification.clientGroupId))))
      return;

    const policyDispatcher = yield* PolicyDispatcher;

    return yield* Effect.firstSuccessOf(
      Iterable.map(notification.data, (data) =>
        Match.valueTags(data, {
          ReplicachePullPermission: ({ permission }) =>
            AccessControl.userPermissionPolicy(permission),
          ReplicachePullPolicy: (policy) =>
            policyDispatcher.dispatch(policy.name, policy.input).pipe(replicache.query),
        }).pipe(
          Effect.tapCauseIf(
            (cause) =>
              cause.pipe(
                Cause.findErrorOption,
                Option.map(Predicate.not(Predicate.isTagged("AccessDeniedError"))),
                Option.getOrElse(() => true),
              ),
            Effect.logError,
          ),
        ),
      ),
    ).pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(get.resultOnce(actorAtom).pipe(Effect.map(ActorLayerMap.get), Layer.unwrap)),
      Effect.andThen(replicache.pull),
    );
  }),
});

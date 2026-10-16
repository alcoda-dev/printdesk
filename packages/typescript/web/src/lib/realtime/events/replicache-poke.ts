import { NetworkMonitor } from "@printdesk/core/network/client/monitor";
import { Realtime } from "@printdesk/core/realtime/client";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as Struct from "effect/Struct";

import { realtimeEventAtomLayer } from ".";
import { realtimeAtom } from "..";
import { actorAtom } from "../../actor";
import { replicacheAtom } from "../../replicache";

export const replicachePokeAtom = Realtime.makeEventAtom("/replicache/poke", {
  runtime: realtimeEventAtomLayer.pipe(Atom.runtime),
  atoms: {
    actor: actorAtom,
    realtime: realtimeAtom,
    networkMonitor: NetworkMonitor.atom,
  },
  handler: (get) => get.resultOnce(replicacheAtom).pipe(Effect.flatMap(Struct.get("pull"))),
});

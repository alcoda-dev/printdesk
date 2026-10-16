import { NetworkMonitor } from "@printdesk/core/network/client/monitor";
import { Realtime } from "@printdesk/core/realtime/client";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";
import * as Redacted from "effect/Redacted";
import * as Socket from "effect/socket/Socket";
import * as Struct from "effect/Struct";

import { ViteResource } from "../sst";

export const realtimeRuntime = Layer.mergeAll(
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
).pipe(Atom.runtime);

export const realtimeAtom = realtimeRuntime
  .atom(
    Effect.fn(function* (get) {
      const hostnames = yield* get
        .resultOnce(ViteResource.atom)
        .pipe(Effect.map(Struct.get("Hostnames")), Effect.map(Redacted.value));
      const networkMonitor = yield* get.resultOnce(NetworkMonitor.atom);

      return yield* Realtime.make({
        baseUrls: {
          api: new URL(`https://${hostnames.api}`),
          realtime: new URL(`wss://${hostnames.realtime}`),
        },
        networkMonitor,
      });
    }),
  )
  .pipe(Atom.keepAlive);

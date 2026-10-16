import * as Effect from "effect/Effect";
import * as Latch from "effect/Latch";
import * as Queue from "effect/Queue";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";
import * as Struct from "effect/Struct";
import * as SubscriptionRef from "effect/SubscriptionRef";

export namespace NetworkMonitor {
  export const make = Effect.gen(function* () {
    const onlineRef = yield* SubscriptionRef.make(globalThis.window.navigator.onLine);
    const onlineLatch = yield* Latch.make(onlineRef.value);

    yield* Stream.callback<boolean>(
      Effect.fn(function* (queue) {
        const onlineListener = () => Queue.offerUnsafe(queue, true);
        const offlineListener = () => Queue.offerUnsafe(queue, false);

        globalThis.window.addEventListener("online", onlineListener);
        globalThis.window.addEventListener("offline", offlineListener);

        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            globalThis.window.removeEventListener("online", onlineListener);
            globalThis.window.removeEventListener("offline", offlineListener);
          }),
        );
      }),
    ).pipe(
      Stream.tap((online) => (online ? onlineLatch.open : onlineLatch.close)),
      Stream.tap((online) => onlineRef.pipe(SubscriptionRef.set(online))),
      Stream.runDrain,
      Effect.forkDetach,
    );

    const onlineChanges = yield* onlineRef.pipe(
      SubscriptionRef.changes,
      Stream.share({ capacity: 16, strategy: "suspend" }),
    );

    return { onlineLatch, onlineChanges };
  });

  export type NetworkMonitor = Effect.Success<typeof make>;

  export const atom = Atom.make(make).pipe(Atom.keepAlive);
  export const onlineAtom = Atom.make((get) =>
    get.resultOnce(atom).pipe(Effect.map(Struct.get("onlineChanges")), Stream.unwrap),
  );
}

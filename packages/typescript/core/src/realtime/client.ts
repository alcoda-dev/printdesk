import * as Array from "effect/Array";
import * as Cause from "effect/Cause";
import * as Channel from "effect/Channel";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Function from "effect/Function";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Option from "effect/Option";
import * as Pull from "effect/Pull";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Scheduler from "effect/Scheduler";
import * as Schema from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Socket from "effect/socket/Socket";
import * as Stream from "effect/Stream";
import * as Struct from "effect/Struct";

import { Api } from "../api";
import { RealtimeEventHandlers } from "../handlers/realtime-events";
import { prefix, suffix } from "../utils";
import { RealtimeContract } from "./contract";

import type { ActorsContract } from "../actors/contract";
import type { NetworkMonitor } from "../network/client/monitor";

export namespace Realtime {
  const timeoutDuration = Duration.seconds(5);

  export const defaultRetrySchedule = Schedule.min([
    Schedule.exponential(Duration.millis(300), 1.1),
    Schedule.fixed(Duration.seconds(5)),
  ]).pipe(Schedule.jittered);

  export interface Options {
    readonly baseUrls: { readonly api: URL; readonly realtime: URL };
    readonly networkMonitor: NetworkMonitor.NetworkMonitor;
    // oxlint-disable-next-line typescript/no-explicit-any
    readonly retrySchedule?: Schedule.Schedule<any>;
  }

  export type RealtimeError = Socket.SocketError | Schema.SchemaError | Cause.TimeoutError;

  export const make = Effect.fn(
    function* (opts: Options) {
      const api = yield* HttpClient.HttpClient.pipe(
        Effect.flatMap((httpClient) =>
          HttpApiClient.group(Api, { baseUrl: opts.baseUrls.api, httpClient, group: "Realtime" }),
        ),
      );

      const authProtocol = yield* api
        .getAuthorization({ payload: undefined })
        .pipe(Effect.flatMap(Schema.encodeEffect(RealtimeContract.WebSocketAuthorizationProtocol)));

      const socket = yield* Socket.makeWebSocket(
        new URL("/event/realtime", opts.baseUrls.realtime).href,
        { protocols: ["aws-appsync-event-ws", authProtocol] },
      );
      const { write } = yield* socket.writer;

      const stream = yield* Socket.readerString(socket).pipe(
        Stream.fromPull,
        Stream.mapEffect((string) => Schema.decodeEffect(RealtimeContract.Message)(string)),
        Stream.share({ capacity: 32, strategy: "suspend" }),
      );

      const connection = yield* Deferred.make<RealtimeContract.ConnectionAck, RealtimeError>();
      const disconnection = yield* Deferred.make<never, RealtimeError>();

      yield* stream.pipe(
        Stream.filter(
          (message) =>
            message.type === RealtimeContract.ConnectionAck.to.fields.type.schema.literal,
        ),
        Stream.take(1),
        Stream.timeoutOrElse({
          duration: timeoutDuration,
          orElse: () => Stream.fail(new Cause.TimeoutError("Connection timed out")),
        }),
        Stream.tapBoth({
          onElement: (ack) => connection.pipe(Deferred.succeed(ack)),
          onError: (error) => connection.pipe(Deferred.fail(error)),
        }),
        Stream.tap((ack) =>
          stream.pipe(
            Stream.filter(
              (message) => message.type === RealtimeContract.KeepAlive.fields.type.schema.literal,
            ),
            Stream.timeoutOrElse({
              duration: ack.connectionTimeout,
              orElse: () => Stream.fail(new Cause.TimeoutError("Keep-alive timed out")),
            }),
            Stream.runDrain,
          ),
        ),
        Stream.run(
          Sink.fromTransform<RealtimeContract.Message, void, RealtimeError, never>((upstream) =>
            RealtimeContract.ConnectionInit.makeEffect().pipe(
              Effect.mapError((issue) => new Schema.SchemaError(issue)),
              Effect.flatMap(
                Schema.encodeEffect(RealtimeContract.ConnectionInit.pipe(Schema.fromJsonString)),
              ),
              Effect.flatMap(write),
              Effect.andThen(upstream.pipe(Effect.forever({ disableYield: true }), Effect.orDie)),
            ),
          ),
        ),
        Effect.tapError((error) => disconnection.pipe(Deferred.fail(error))),
        Effect.forkScoped({ startImmediately: true }),
      );

      return {
        api,
        socket,
        stream,
        connection,
        disconnection,
      } as const;
    },
    (effect, opts) =>
      opts.networkMonitor.onlineLatch
        .whenOpen(effect)
        .pipe(Effect.retry(opts.retrySchedule ?? defaultRetrySchedule)),
  );

  export type Realtime = Effect.Success<ReturnType<typeof make>>;

  export interface EventAtomOptions<
    TName extends RealtimeContract.EventHandler["name"],
    TRuntimeError,
    TActorError,
    TRealtimeError,
    TNetworkMonitorError,
    THandlerError,
    THandlerServices,
  > {
    readonly runtime: Atom.AtomRuntime<
      | RealtimeEventHandlers.Record[TName]["Input"]["DecodingServices"]
      | RealtimeEventHandlers.Record[TName]["Output"]["DecodingServices"]
      | THandlerServices
      | Crypto.Crypto,
      TRuntimeError
    >;
    readonly atoms: {
      readonly actor: Atom.Atom<AsyncResult.AsyncResult<ActorsContract.Actor, TActorError>>;
      readonly realtime: Atom.Atom<AsyncResult.AsyncResult<Realtime.Realtime, TRealtimeError>>;
      readonly networkMonitor: Atom.Atom<
        AsyncResult.AsyncResult<NetworkMonitor.NetworkMonitor, TNetworkMonitorError>
      >;
    };
    readonly handler: (
      get: Atom.AtomContext,
      input: RealtimeEventHandlers.Record[TName]["Input"]["Type"],
    ) => Effect.Effect<
      RealtimeEventHandlers.Record[TName]["Output"]["Type"],
      THandlerError,
      THandlerServices
    >;
    // oxlint-disable-next-line typescript/no-explicit-any
    readonly retrySchedule?: Schedule.Schedule<any>;
  }

  export const makeEventAtom = <
    TName extends RealtimeContract.EventHandler["name"],
    TRuntimeError,
    TActorError,
    TRealtimeError,
    TNetworkMonitorError,
    THandlerError,
    THandlerServices,
  >(
    name: TName,
    opts: EventAtomOptions<
      TName,
      TRuntimeError,
      TActorError,
      TRealtimeError,
      TNetworkMonitorError,
      THandlerError,
      THandlerServices
    >,
  ) =>
    Atom.readable((get) => {
      const streamEffect = Effect.gen(function* () {
        const crypto = yield* Crypto.Crypto;
        const realtime = yield* get.resultOnce(opts.atoms.realtime);
        const { write } = yield* realtime.socket.writer;

        yield* realtime.connection.pipe(Deferred.await);

        const id = yield* crypto
          .randomUUIDv4()
          .pipe(Effect.flatMap((id) => RealtimeContract.SubscriptionId.makeEffect(id)));

        const handler = yield* RealtimeEventHandlers.registry.resolve(name);

        const channel = yield* get
          .resultOnce(opts.atoms.actor)
          .pipe(
            Effect.flatMap(Struct.get("tenantId")),
            Effect.map(prefix("/")),
            Effect.map(suffix(name)),
            Effect.flatMap(Schema.decodeEffect(RealtimeContract.Channel)),
          );

        const authorization = yield* realtime.api.getAuthorization({ payload: { channel } });

        yield* RealtimeContract.Subscribe.makeEffect({ id, channel, authorization }).pipe(
          Effect.flatMap(
            Schema.encodeEffect(RealtimeContract.Subscribe.pipe(Schema.fromJsonString)),
          ),
          Effect.flatMap(write),
        );

        yield* realtime.stream.pipe(
          Stream.filter(
            (message) =>
              message.type === RealtimeContract.SubscribeSuccess.fields.type.schema.literal &&
              message.id === id,
          ),
          Stream.take(1),
          Stream.timeoutOrElse({
            duration: timeoutDuration,
            orElse: () => Stream.fail(new Cause.TimeoutError("Subscribe timed out")),
          }),
          Stream.runDrain,
        );

        yield* Effect.addFinalizer(() =>
          RealtimeContract.Unsubscribe.makeEffect({ id }).pipe(
            Effect.flatMap(
              Schema.encodeEffect(RealtimeContract.Unsubscribe.pipe(Schema.fromJsonString)),
            ),
            Effect.flatMap(write),
            Effect.flatMap(() =>
              realtime.stream.pipe(
                Stream.filter(
                  (message) =>
                    message.type ===
                      RealtimeContract.UnsubscribeSuccess.fields.type.schema.literal &&
                    message.id === id,
                ),
                Stream.take(1),
                Stream.timeoutOrElse({
                  duration: timeoutDuration,
                  orElse: () => Stream.fail(new Cause.TimeoutError("Unsubscribe timed out")),
                }),
                Stream.runDrain,
              ),
            ),
            Effect.catchCause(Effect.log),
          ),
        );

        return realtime.stream.pipe(
          Stream.filterMapEffect((message) =>
            message.type === RealtimeContract.Data.fields.type.schema.literal && message.id === id
              ? Effect.succeed(message.event).pipe(
                  Effect.flatMap(
                    Schema.decodeUnknownEffect<RealtimeEventHandlers.Record[TName]["Input"]>(
                      handler.Input,
                    ),
                  ),
                  Effect.map(Result.succeed),
                )
              : Result.failVoid.pipe(Effect.succeed),
          ),
          Stream.mapEffect((input) => opts.handler(get, input)),
          Stream.mapEffect((output) => Schema.decodeEffect(handler.Output)(output)),
        );
      }).pipe((effect) =>
        get
          .resultOnce(opts.atoms.networkMonitor)
          .pipe(Effect.flatMap((monitor) => monitor.onlineLatch.whenOpen(effect))),
      );

      const disconnection = get
        .resultOnce(opts.atoms.realtime)
        .pipe(Effect.map(Struct.get("disconnection")), Effect.flatMap(Deferred.await));

      const getSelf = () =>
        get.self<
          AsyncResult.AsyncResult<
            Stream.Success<Effect.Success<typeof streamEffect>>,
            Stream.Error<Effect.Success<typeof streamEffect>> | Cause.NoSuchElementError
          >
        >();

      const previous = getSelf();

      const runtime = opts.runtime.pipe(get);
      if (!AsyncResult.isSuccess(runtime)) return AsyncResult.replacePrevious(runtime, previous);

      const runFork = runtime.value.pipe(
        Context.add(AtomRegistry.AtomRegistry, get.registry),
        Context.add(Scheduler.Scheduler, get.registry.scheduler),
        Effect.runForkWith,
      );

      const fiber = streamEffect.pipe(
        Effect.map(Stream.toChannel),
        Effect.flatMap(Channel.toPull),
        Effect.flatMap((pull) =>
          Effect.whileLoop({
            while: Function.constTrue,
            body: () => pull,
            step: (events) =>
              get.setSelf(AsyncResult.success(Array.lastNonEmpty(events), { waiting: true })),
          }),
        ),
        Effect.scoped,
        Effect.retry(opts.retrySchedule ?? defaultRetrySchedule),
        Effect.raceFirst(disconnection),
        Effect.catchCause((cause) =>
          Effect.sync(() =>
            cause.pipe(Pull.isDoneCause)
              ? getSelf().pipe(
                  Option.flatMap(AsyncResult.value),
                  Option.match({
                    onNone: () =>
                      get.setSelf(
                        AsyncResult.failWithPrevious(new Cause.NoSuchElementError(), {
                          previous: getSelf(),
                        }),
                      ),
                    onSome: (output) => get.setSelf(AsyncResult.success(output)),
                  }),
                )
              : get.setSelf(AsyncResult.failureWithPrevious(cause, { previous: getSelf() })),
          ),
        ),
        runFork,
      );
      fiber.currentDispatcher?.flush();

      get.addFinalizer(fiber.interruptUnsafe);

      return previous.pipe(
        Option.match({
          onSome: (previous) => previous.pipe(Option.some, AsyncResult.waitingFrom),
          onNone: () =>
            AsyncResult.initial<
              Stream.Success<Effect.Success<typeof streamEffect>>,
              Stream.Error<Effect.Success<typeof streamEffect>>
            >().pipe(AsyncResult.waiting),
        }),
      );
    });
}

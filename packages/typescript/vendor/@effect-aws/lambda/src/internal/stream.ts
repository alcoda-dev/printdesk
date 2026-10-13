// oxlint-disable typescript/no-explicit-any typescript/no-unsafe-type-assertion effecttsgo/node-builtin-import
import * as NS from "node:stream/promises";

import * as NodeStream from "@effect/platform-node-shared/NodeStream";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Error from "effect/PlatformError";
import * as Stream from "effect/Stream";

import type { PipelineDestination, PipelineSource, PipelineOptions } from "node:stream";

const handleErrnoException =
  (module: Error.SystemError["module"], method: string) =>
  (err: unknown): Error.PlatformError => {
    const reason: Error.SystemErrorTag = "Unknown";

    return new Error.PlatformError(
      new Error.SystemError({
        _tag: reason,
        module,
        method,
        pathOrDescriptor: "",
        syscall: (err as NodeJS.ErrnoException).syscall,
        description: (err as NodeJS.ErrnoException).message,
        cause: err,
      }),
    );
  };

/** @internal */
export const pipeline: {
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  <A extends PipelineSource<any>, B extends PipelineDestination<A, any>>(
    source: A,
    destination: B,
    options?: Omit<PipelineOptions, "signal">,
  ): Effect.Effect<void, Error.PlatformError>;
} = (source, destination, options) =>
  Effect.tryPromise({
    try: (signal) => NS.pipeline(source, destination, { ...options, signal }),
    catch: handleErrnoException("Stream", "pipeline"),
  });

/** @internal */
export const pipeTo: {
  (
    that: NodeJS.WritableStream,
    options?: Omit<PipelineOptions, "signal">,
  ): <E, R>(
    self: Stream.Stream<string | Uint8Array, E, R>,
  ) => Effect.Effect<void, Error.PlatformError>;
  <E, R>(
    self: Stream.Stream<string | Uint8Array, E, R>,
    that: NodeJS.WritableStream,
    options?: Omit<PipelineOptions, "signal">,
  ): Effect.Effect<void, Error.PlatformError>;
} = dual(
  (args) => Stream.isStream(args[0]),
  <E, R>(
    stream: Stream.Stream<string | Uint8Array, E, R>,
    writable: NodeJS.WritableStream,
    options?: Omit<PipelineOptions, "signal">,
  ) =>
    stream.pipe(
      NodeStream.toReadable,
      Effect.flatMap((readable) => pipeline(readable, writable, options)),
    ),
);

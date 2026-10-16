import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { Bff } from "../contract";
import { ViteResource } from "../lib/sst";
import { errorMiddlewareLayer } from "../middleware/error";

export const baseSpaGroupLayer = HttpApiBuilder.group(
  Bff,
  "Spa",
  Effect.fn(function* (handlers) {
    const assets = yield* ViteResource.useSync(Struct.get("ASSETS")).pipe(
      Effect.map(Redacted.value),
    );

    return handlers.handle("assets", ({ request }) =>
      HttpServerRequest.toWeb(request).pipe(
        Effect.flatMap((request) => Effect.tryPromise(() => assets.fetch(request))),
        Effect.map(HttpServerResponse.fromWeb),
        Effect.orDie,
      ),
    );
  }),
);

export const spaGroupLayer = baseSpaGroupLayer.pipe(
  Layer.provide([errorMiddlewareLayer, ViteResource.layer]),
);

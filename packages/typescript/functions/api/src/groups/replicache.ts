import { Api } from "@printdesk/core/api";
import { ReplicachePullerContract } from "@printdesk/core/replicache/contracts";
import { ReplicachePuller } from "@printdesk/core/replicache/puller";
import { ReplicachePusher } from "@printdesk/core/replicache/pusher";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { replicacheLayer } from "../lib/replicache";
import { authMiddlewareLayer } from "../middleware/auth";
import { appsyncPublisherCredentialIdentityProviderMiddlewareLayer } from "../middleware/aws";
import { errorMiddlewareLayer } from "../middleware/error";

export const baseReplicacheGroupLayer = HttpApiBuilder.group(
  Api,
  "Replicache",
  Effect.fn(function* (handlers) {
    const puller = yield* ReplicachePuller;
    const pusher = yield* ReplicachePusher;

    return handlers
      .handle(
        "pull",
        Effect.fn("Api.Replicache.pull")(({ payload }) =>
          puller.pull(payload).pipe(
            Effect.catchTag(["ClientStateNotFoundError", "VersionNotSupportedError"], (e) =>
              Effect.succeed(e.response),
            ),
            Effect.flatMap(Schema.encodeEffect(ReplicachePullerContract.Response)),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "push",
        Effect.fn("Api.Replicache.push")(({ payload }) =>
          pusher.push(payload).pipe(
            Effect.catchTag(["ClientStateNotFoundError", "VersionNotSupportedError"], (e) =>
              Effect.succeed(e.response),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      );
  }),
);

export const replicacheGroupLayer = baseReplicacheGroupLayer.pipe(
  Layer.provide([
    authMiddlewareLayer,
    appsyncPublisherCredentialIdentityProviderMiddlewareLayer,
    errorMiddlewareLayer,
    replicacheLayer,
  ]),
);

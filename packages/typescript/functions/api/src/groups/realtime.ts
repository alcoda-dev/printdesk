import { Api } from "@printdesk/core/api";
import { Realtime } from "@printdesk/core/realtime";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";

import { realtimeLayer } from "../lib/realtime";
import { authMiddlewareLayer } from "../middleware/auth";
import { appsyncSubscriberCredentialIdentityProviderMiddlewareLayer } from "../middleware/aws";
import { errorMiddlewareLayer } from "../middleware/error";

export const baseRealtimeGroupLayer = HttpApiBuilder.group(
  Api,
  "Realtime",
  Effect.fn(function* (handlers) {
    const realtime = yield* Realtime;

    return handlers.handle(
      "getAuthorization",
      Effect.fn("Api.Realtime.getAuthorization")(({ payload }) =>
        realtime.getAuthorization(payload).pipe(orDieWhenUnrespondable),
      ),
    );
  }),
);

export const realtimeGroupLayer = baseRealtimeGroupLayer.pipe(
  Layer.provide([
    authMiddlewareLayer,
    appsyncSubscriberCredentialIdentityProviderMiddlewareLayer,
    errorMiddlewareLayer,
    realtimeLayer,
  ]),
);

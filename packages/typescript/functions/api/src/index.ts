import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Api } from "@printdesk/core/api";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";

import { bootstrapGroupLayer } from "./groups/bootstrap";
import { configGroupsLayer } from "./groups/config";
import { ordersGroupLayer } from "./groups/orders";
import { papercutMfGroupsLayer } from "./groups/papercut";
import { realtimeGroupLayer } from "./groups/realtime";
import { replicacheGroupLayer } from "./groups/replicache";
import { scimGroupsLayer } from "./groups/scim";
import { httpServerLayer } from "./lib/server";

Api.pipe(
  HttpApiBuilder.layer,
  HttpRouter.serve,
  Layer.provide([
    bootstrapGroupLayer,
    configGroupsLayer,
    httpServerLayer,
    ordersGroupLayer,
    papercutMfGroupsLayer,
    realtimeGroupLayer,
    replicacheGroupLayer,
    scimGroupsLayer,
  ]),
  Layer.tapCause(Effect.logError),
  Layer.launch,
  NodeRuntime.runMain,
);

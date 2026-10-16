import { LambdaHandler } from "@effect-aws/lambda";
import { Api } from "@printdesk/core/api";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";

import { bootstrapGroupLayer } from "./groups/bootstrap";
import { configGroupsLayer } from "./groups/config";
import { ordersGroupLayer } from "./groups/orders";
import { papercutMfGroupsLayer } from "./groups/papercut";
import { realtimeGroupLayer } from "./groups/realtime";
import { replicacheGroupLayer } from "./groups/replicache";
import { scimGroupsLayer } from "./groups/scim";

export default Api.pipe(
  HttpApiBuilder.layer,
  Layer.provide([
    HttpServer.layerServices,
    bootstrapGroupLayer,
    configGroupsLayer,
    ordersGroupLayer,
    papercutMfGroupsLayer,
    realtimeGroupLayer,
    replicacheGroupLayer,
    scimGroupsLayer,
  ]),
  Layer.tapCause(Effect.logError),
  LambdaHandler.fromHttpApi,
);

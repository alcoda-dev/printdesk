import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";

import { Bff } from "./contract";
import { authGroupLayer } from "./groups/auth";
import { spaGroupLayer } from "./groups/spa";

export default {
  fetch: Bff.pipe(
    HttpApiBuilder.layer,
    Layer.provide([authGroupLayer, spaGroupLayer, HttpRouter.layer, HttpServer.layerServices]),
    Layer.tapCause(Effect.logError),
    HttpRouter.toWebHandler,
  ).handler,
};

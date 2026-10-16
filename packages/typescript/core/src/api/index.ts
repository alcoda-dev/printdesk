import * as HttpApi from "effect/http-api/HttpApi";

import { Assets } from "./assets";
import { Bootstrap } from "./bootstrap";
import { Config } from "./config";
import { AuthMiddleware } from "./middleware/auth";
import { ErrorMiddleware } from "./middleware/error";
import { Orders } from "./orders";
import { Papercut } from "./papercut";
import { Realtime } from "./realtime";
import { Replicache } from "./replicache";
import { Scim } from "./scim";

export class Api extends HttpApi.make("Api")
  .addHttpApi(Config.Api.prefix("/config"))
  .addHttpApi(Orders.Api.prefix("/orders"))
  .addHttpApi(Papercut.MfApi.prefix("/papercut/mf"))
  .addHttpApi(Realtime.Api.prefix("/realtime"))
  .addHttpApi(Replicache.Api.prefix("/replicache"))
  .middleware(AuthMiddleware)
  .addHttpApi(Bootstrap.Api.prefix("/bootstrap"))
  .middleware(ErrorMiddleware)
  .addHttpApi(Scim.Api.prefix("/scim")) {}

export class CachedAssetsApi extends HttpApi.make("CachedAssetsApi")
  .addHttpApi(Assets.Api)
  .middleware(ErrorMiddleware) {}

import { ErrorMiddleware } from "@printdesk/core/api/middleware/error";
import * as HttpApi from "effect/http-api/HttpApi";

import { Auth } from "./auth";
import { Spa } from "./spa";

export class Bff extends HttpApi.make("Bff")
  .addHttpApi(Auth.Api)
  .addHttpApi(Spa.Api)
  .middleware(ErrorMiddleware) {}

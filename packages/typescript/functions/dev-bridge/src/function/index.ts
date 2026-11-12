import { serve } from "@hono/node-server";
import { Constants } from "@printdesk/core/src/utils/constants";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Host from "effect/net/Host";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { proxy } from "./middleware/proxy";

const { host, port } = Config.NonEmptyString(Constants.WEB_FUNCTION_ENV.HTTP_ENDPOINT).pipe(
  Effect.map(Host.hostPortFromString),
  Effect.flatMap(Effect.fromResult),
  Effect.runSync,
);

const { fetch } = new Hono()
  .use(logger())
  .all("/:path{.+}", proxy)
  .onError((e, c) => {
    if ("getResponse" in e) return e.getResponse();
    return c.newResponse(e.message, 500);
  });

serve({ fetch, hostname: host.toString(), port });

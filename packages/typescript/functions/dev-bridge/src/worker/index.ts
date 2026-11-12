import { Hono } from "hono";
import { logger } from "hono/logger";

import { proxy } from "./middleware/proxy";

export default new Hono()
  .use(logger())
  .all("/:path{.+}", proxy)
  .onError((e, c) => {
    if ("getResponse" in e) return e.getResponse();
    return c.newResponse(e.message, 500);
  });

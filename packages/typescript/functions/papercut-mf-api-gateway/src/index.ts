import { Hono } from "hono";
import { logger } from "hono/logger";

import { auth } from "./middleware/auth";
import { proxy } from "./middleware/proxy";

export default new Hono()
  .use(logger())
  .use(auth)
  .use(proxy)
  .onError((e, c) => {
    if ("getResponse" in e) return e.getResponse();
    return c.newResponse(e.message, 500);
  });

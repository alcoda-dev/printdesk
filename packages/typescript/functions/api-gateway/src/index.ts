import * as Redacted from "effect/Redacted";
import * as String from "effect/String";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { resource } from "./lib/sst";
import { actor } from "./middleware/actor";
import { proxy } from "./middleware/proxy";

const hostnames = resource.Hostnames.pipe(Redacted.value);

export default new Hono({ getPath: (req) => String.replace(/^https?:\/([^?]+).*$/, "$1")(req.url) })
  .use(logger())
  .use(actor)
  .all(`/${hostnames.api}/:path{.+}`, proxy("api"))
  .all(`/${hostnames.auth}/:path{.+}`, proxy("auth"))
  .all(`/${hostnames.assets}/:path{.+}`, proxy("assets"))
  .onError((e, c) => {
    if ("getResponse" in e) return e.getResponse();
    return c.newResponse(e.message, 500);
  });

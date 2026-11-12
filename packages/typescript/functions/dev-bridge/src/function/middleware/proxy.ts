import { Constants } from "@printdesk/core/utils/constants";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { proxy as honoProxy } from "hono/proxy";

import { devServerPortHeaderName, ProxyHeaders } from "../../shared";

import type { BlankInput } from "hono/types";

export const proxy = createMiddleware<BlankInput, `/:path{.+}`>((c) =>
  Config.all({
    devBridgeClientId: Config.String(Constants.WEB_FUNCTION_ENV.DEV_BRIDGE_CLIENT_ID),
    devBridgeClientSecret: Config.Redacted(Constants.WEB_FUNCTION_ENV.DEV_BRIDGE_CLIENT_SECRET),
    devServerPort: Config.Port(Constants.WEB_FUNCTION_ENV.DEV_SERVER_PORT),
    url: Config.URL(Constants.WEB_FUNCTION_ENV.DEV_BRIDGE_WORKER_URL).pipe(
      Config.map((url) => new URL(c.req.param("path"), url)),
    ),
  })
    .pipe(
      Effect.flatMap((config) =>
        ProxyHeaders.makeEffect({
          ...c.req.header(),
          "CF-Access-Client-Id": config.devBridgeClientId,
          "CF-Access-Client-Secret": config.devBridgeClientSecret.pipe(Redacted.value),
          [devServerPortHeaderName]: config.devServerPort,
        }).pipe(
          Effect.mapError((issue) => new Schema.SchemaError(issue)),
          Effect.flatMap(Schema.encodeEffect(ProxyHeaders)),
          Effect.flatMap((headers) =>
            Effect.promise((signal) => honoProxy(config.url, { raw: c.req.raw, headers, signal })),
          ),
        ),
      ),
      Effect.tapCause(Effect.logError),
      Effect.runPromiseExit,
    )
    .then(
      Exit.match({
        onSuccess: (response) => response,
        onFailure: function (cause) {
          throw cause.pipe(
            Cause.findError,
            Result.match({
              onSuccess: (error) => new HTTPException(500, { cause: error.cause }),
              onFailure: (cause) => new HTTPException(500, { cause }),
            }),
          );
        },
      }),
    ),
);

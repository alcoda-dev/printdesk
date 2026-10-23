import { Constants } from "@printdesk/core/utils/constants";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { proxy as honoProxy } from "hono/proxy";

import { resource } from "../lib/sst";

const url =
  resource.PROTOCOL.pipe(Redacted.value) +
  "://" +
  resource.HOSTNAME.pipe(Redacted.value) +
  ":" +
  resource.PORT.pipe(Redacted.value) +
  Constants.PAPERCUT_MF_API_PATH;

const papercutApi = resource.PAPERCUT_MF_API.pipe(Redacted.value);

export const proxy = createMiddleware((c) =>
  Effect.tryPromise((signal) =>
    honoProxy(url, { raw: c.req.raw, signal, customFetch: (req) => papercutApi.fetch(req) }),
  )
    .pipe(
      Effect.timeout(Duration.seconds(10)),
      Effect.tapCause(Effect.logError),
      Effect.runPromiseExit,
    )
    .then(
      Exit.match({
        onSuccess: (response) => response,
        onFailure: (cause) => {
          throw cause.pipe(
            Cause.findError,
            Result.match({
              onSuccess: Match.valueTags({
                TimeoutError: (error) => new HTTPException(504, { cause: error.cause }),
                UnknownError: (error) => new HTTPException(500, { cause: error.cause }),
              }),
              onFailure: (cause) => new HTTPException(500, { cause }),
            }),
          );
        },
      }),
    ),
);

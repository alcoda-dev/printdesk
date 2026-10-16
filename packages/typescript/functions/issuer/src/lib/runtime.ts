import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Result from "effect/Result";
import { HTTPException } from "hono/http-exception";

import type { ContentfulStatusCode } from "hono/utils/http-status";

export const runPromise =
  <TSuccess, TError, TServices>(
    runner: (
      effect: Effect.Effect<TSuccess, TError, TServices>,
    ) => Promise<Exit.Exit<TSuccess, TError>>,
  ) =>
  (self: Effect.Effect<TSuccess, TError, TServices>) =>
    self.pipe(Effect.tapCause(Effect.logError), runner).then(
      Exit.match({
        onSuccess: (success) => success,
        onFailure(cause) {
          throw cause.pipe(
            Cause.findError,
            Result.flatMap((error) =>
              HttpServerRespondable.isRespondable(error)
                ? Result.succeed(error)
                : Result.fail(error),
            ),
            Result.match({
              onSuccess: (respondable) =>
                HttpServerRespondable.toResponse(respondable).pipe(
                  Effect.map(HttpServerResponse.toWeb),
                  Effect.map(
                    (res) =>
                      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
                      new HTTPException(res.status as ContentfulStatusCode, {
                        res,
                        cause: respondable,
                      }),
                  ),
                  Effect.runSync,
                ),
              onFailure: (cause) =>
                new HTTPException(500, {
                  res: new Response(JSON.stringify({ error: "server_error" })),
                  cause,
                }),
            }),
          );
        },
      }),
    );

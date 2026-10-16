import { UnexpectedServerError } from "@printdesk/core/api/middleware/error";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import * as Cause from "effect/Cause";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as String from "effect/String";

export const orErrorResponse = <TError, TServices>(
  self: Effect.Effect<HttpServerResponse.HttpServerResponse | Response, TError, TServices>,
) =>
  self.pipe(
    Effect.filterOrElse(
      (res) => HttpServerResponse.isHttpServerResponse(res),
      (res) => HttpServerResponse.fromWeb(res).pipe(Effect.succeed),
    ),
    orDieWhenUnrespondable,
    Effect.tapCauseIf(Cause.hasFails, Effect.logError),
    Effect.catchDefect((defect) =>
      Crypto.Crypto.use((crypto) => crypto.randomUUIDv4()).pipe(
        Effect.orDie,
        Effect.map(String.slice(0, 8)),
        Effect.map((id) => `err_${id}` as const),
        Effect.tap((ref) => Effect.logError(Cause.die(defect), ref)),
        Effect.flatMap((ref) =>
          HttpServerRespondable.toResponse(new UnexpectedServerError({ ref })),
        ),
      ),
    ),
    Effect.catch(HttpServerRespondable.toResponse),
    Effect.map(HttpServerResponse.toWeb),
  );

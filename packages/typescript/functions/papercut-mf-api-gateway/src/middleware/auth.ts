import { AccessControl } from "@printdesk/core/access-control";
import { Actor, ActorLayerMap } from "@printdesk/core/actors";
import { Openauth } from "@printdesk/core/oauth/openauth";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Struct from "effect/Struct";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { AuthHeaders, authRuntime } from "../lib/auth";
import { resource } from "../lib/sst";

import type { ContentfulStatusCode } from "hono/utils/http-status";

export const auth = createMiddleware((c, next) =>
  HttpApiError.HttpApiSchemaError.wrap("Headers", HttpServerRequest.schemaHeaders(AuthHeaders))
    .pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(c.req.raw),
      ),
      Effect.map(Struct.get("accessToken")),
      Effect.flatMap(Openauth.verify),
      Effect.flatMap(({ subject }) =>
        AccessControl.every(
          Actor.tenantId.pipe(
            Effect.map(Equal.equals(resource.TENANT_ID.pipe(Redacted.value))),
            AccessControl.policy("papercut_mf_api_gateway", "read"),
          ),
          AccessControl.permissionPolicy("papercut_mf_api_gateway:read"),
          // oxlint-disable-next-line effecttsgo/strict-effect-provide
        ).pipe(Effect.provide(ActorLayerMap.get(subject.properties.actor.wrap))),
      ),
      authRuntime.runPromiseExit,
    )
    .then(
      Exit.match({
        onSuccess: next,
        onFailure: (cause) =>
          cause.pipe(
            Cause.findError,
            Result.flatMap((error) =>
              HttpServerRespondable.isRespondable(error)
                ? Result.succeed(error)
                : Result.fail(error),
            ),
            Result.match({
              onSuccess: (respondable) => {
                throw respondable.pipe(
                  HttpServerRespondable.toResponse,
                  Effect.map(HttpServerResponse.toWeb),
                  Effect.map(
                    (res) =>
                      new HTTPException(
                        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
                        Match.value(res.status).pipe(
                          Match.when(Match.is(401), () => 407),
                          Match.orElse((status) => status),
                        ) as ContentfulStatusCode,
                        { res, cause: respondable },
                      ),
                  ),
                  Effect.runSync,
                );
              },
              onFailure: (cause) => {
                throw new HTTPException(500, { cause });
              },
            }),
          ),
      }),
    ),
);

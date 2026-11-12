import * as Boolean from "effect/Boolean";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as String from "effect/String";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { proxy as honoProxy } from "hono/proxy";

import { devServerPortHeaderName, ProxyHeaders } from "../../shared";
import { resource } from "../lib/sst";

import type { BlankInput } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const vpc = resource.DEV_BRIDGE_VPC.pipe(Redacted.value);

const headerRemovalFilterSet =
  HashSet.make<ReadonlyArray<Lowercase<string>>>(devServerPortHeaderName);

export const proxy = createMiddleware<BlankInput, `/:path{.+}`>((c) =>
  HttpApiError.HttpApiSchemaError.wrap("Headers", HttpServerRequest.schemaHeaders(ProxyHeaders))
    .pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(c.req.raw),
      ),
      Effect.map(function (headers) {
        const url = new URL(
          c.req.param("path"),
          `http://host.docker.internal:${headers[devServerPortHeaderName]}`,
        );
        url.search = new URL(c.req.url).search;
        return url;
      }),
      Effect.flatMap((url) =>
        Effect.promise((signal) =>
          honoProxy(url, {
            raw: c.req.raw,
            headers: Record.filter(c.req.header(), (_, name) =>
              headerRemovalFilterSet.pipe(HashSet.has(String.toLowerCase(name)), Boolean.not),
            ),
            signal,
            customFetch: (req) => vpc.fetch(req),
          }),
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
            Result.flatMap((error) =>
              HttpServerRespondable.isRespondable(error)
                ? Result.succeed(error)
                : Result.fail(error),
            ),
            Result.match({
              onSuccess: (respondable) =>
                respondable.pipe(
                  HttpServerRespondable.toResponse,
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
              onFailure: (cause) => new HTTPException(500, { cause }),
            }),
          );
        },
      }),
    ),
);

import { Api } from "@printdesk/core/api";
import { Bootstrap } from "@printdesk/core/bootstrap";
import { Openauth } from "@printdesk/core/oauth/openauth";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { openauthLayer } from "../lib/auth";
import { bootstrapLayer } from "../lib/bootstrap";
import { errorMiddlewareLayer } from "../middleware/error";

export const baseBootstrapGroupLayer = HttpApiBuilder.group(
  Api,
  "Bootstrap",
  Effect.fn(function* (handlers) {
    const bootstrap = yield* Bootstrap;
    const openauth = yield* Openauth;

    return handlers.handle(
      "bootstrap",
      Effect.fn("Api.Bootstrap.bootstrap")(({ payload }) =>
        bootstrap.createClient(payload.licenseKeyPair, payload.tenant.id).pipe(
          Effect.flatMap(openauth.clientCredentials),
          Effect.tap(({ tokens }) =>
            HttpEffect.appendPreResponseHandler((_, response) =>
              response.pipe(
                HttpServerResponse.setCookie(
                  Constants.COOKIE_NAMES.ACCESS_TOKEN,
                  tokens.access.pipe(Redacted.value),
                  Constants.COOKIE_OPTIONS,
                ),
                Effect.orDie,
              ),
            ),
          ),
          Effect.andThen(bootstrap.invokeWorkflow(payload)),
          Effect.asVoid,
          orDieWhenUnrespondable,
        ),
      ),
    );
  }),
);

export const bootstrapGroupLayer = baseBootstrapGroupLayer.pipe(
  Layer.provide([bootstrapLayer, errorMiddlewareLayer, openauthLayer]),
);

import { ActorsContract } from "@printdesk/core/actors/contract";
import { OauthContract } from "@printdesk/core/oauth/contract";
import { Openauth } from "@printdesk/core/oauth/openauth";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import { createMiddleware } from "hono/factory";

import { openauthRuntime } from "../lib/auth";

declare module "hono" {
  interface ContextVariableMap {
    actor: ActorsContract.Actor;
  }
}

export const actor = createMiddleware((c, next) =>
  Effect.all([
    HttpServerRequest.HttpServerRequest.pipe(
      Effect.map(Struct.get("cookies")),
      Effect.map(
        Option.liftPredicate((cookies) =>
          Schema.toEncoded(OauthContract.AuthCookies)
            .schema.from.mapFields(Struct.omit(["_tag"]))
            .pipe(
              Struct.get("fields"),
              Struct.keys,
              Array.every((key) => key in cookies),
            ),
        ),
      ),
    ),
    HttpServerRequest.HttpServerRequest.pipe(
      Effect.map(Struct.get("headers")),
      Effect.map(
        Option.liftPredicate((headers) =>
          Schema.toEncoded(OauthContract.AuthHeaders)
            .schema.from.mapFields(Struct.omit(["_tag"]))
            .pipe(
              Struct.get("fields"),
              Struct.keys,
              Array.every((key) => key in headers),
            ),
        ),
      ),
    ),
  ])
    .pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(c.req.raw),
      ),
      Effect.flatMap(
        Effect.fn(function* ([cookies, headers]) {
          if (Option.product(cookies, headers).pipe(Option.isSome))
            return yield* new OauthContract.MultipleAuthenticationMethodsError();

          if (Option.isSome(cookies))
            return cookies.pipe(Option.map(Schema.decodeUnknownEffect(OauthContract.AuthCookies)));

          if (Option.isSome(headers))
            return headers.pipe(Option.map(Schema.decodeUnknownEffect(OauthContract.AuthHeaders)));

          return Option.none<
            Effect.Effect<
              typeof OauthContract.AuthCookies.Type | typeof OauthContract.AuthHeaders.Type
            >
          >();
        }),
      ),
      Effect.flatMap(Effect.transposeOption),
      Effect.map(Option.map(({ accessToken }) => Openauth.verify(accessToken))),
      Effect.flatMap(Effect.transposeOption),
      Effect.tapCause(Effect.logError),
      Effect.flatMap(Effect.fromOption),
      openauthRuntime.runPromiseExit,
    )
    .then(
      Exit.match({
        onSuccess: ({ subject }) => c.set("actor", subject.properties.actor.wrap),
        onFailure: () => c.set("actor", ActorsContract.PublicActor.singleton.wrap),
      }),
    )
    .then(next),
);

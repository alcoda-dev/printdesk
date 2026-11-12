import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { nodeCredentialIdentityProviderLayer } from "@printdesk/core/aws/credential-identity/node";
import * as DsqlSigner from "@printdesk/core/aws/dsql-signer/layer";
import * as ClientsRepository from "@printdesk/core/clients/repository/layer";
import { Database } from "@printdesk/core/database";
import { Drizzle } from "@printdesk/core/database/drizzle";
import * as PgClient from "@printdesk/core/database/pg-client";
import * as IdentityRepository from "@printdesk/core/identity/repository/layer";
import * as Oauth from "@printdesk/core/oauth/layer";
import { Hmac } from "@printdesk/core/src/crypto/hmac/index";
import { hmacSigningSecretLayer } from "@printdesk/core/src/crypto/hmac/layer";
import { SstResource } from "@printdesk/core/sst/resource";
import * as SyncQueryBuilder from "@printdesk/core/sync/query-builder/layer";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Result from "effect/Result";
import { HTTPException } from "hono/http-exception";

import type { ContentfulStatusCode } from "hono/utils/http-status";

export const runtime = Oauth.layer.pipe(
  Layer.provide([ClientsRepository.layer, Hmac.layer, SyncQueryBuilder.layer]),
  Layer.provideMerge(IdentityRepository.providersRepositoryLayer),
  Layer.provide([
    Database.layer,
    hmacSigningSecretLayer,
    NodeCrypto.layerMac,
    NodeCrypto.layerSecureRandom,
  ]),
  Layer.provide(Drizzle.layerWithDrizzleServices),
  Layer.provide(PgClient.layer),
  Layer.provide(DsqlSigner.layer({ expiresIn: Duration.minutes(15) })),
  Layer.provide(nodeCredentialIdentityProviderLayer),
  Layer.provideMerge(SstResource.layer),
  Layer.tapCause(Effect.logError),
  ManagedRuntime.make,
);

export const runPromise = <
  TSuccess,
  TError,
  TServices extends ManagedRuntime.ManagedRuntime.Services<typeof runtime>,
>(
  self: Effect.Effect<TSuccess, TError, TServices>,
) =>
  self.pipe(Effect.tapCause(Effect.logError), runtime.runPromiseExit).then(
    Exit.match({
      onSuccess: (success) => success,
      onFailure(cause) {
        throw cause.pipe(
          Cause.findError,
          Result.flatMap((error) =>
            HttpServerRespondable.isRespondable(error) ? Result.succeed(error) : Result.fail(error),
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
                // oxlint-disable-next-line effecttsgo/global-json
                res: new Response(JSON.stringify({ error: "server_error" })),
                cause,
              }),
          }),
        );
      },
    }),
  );

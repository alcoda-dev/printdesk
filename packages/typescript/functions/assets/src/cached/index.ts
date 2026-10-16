import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { ActorLayerMap } from "@printdesk/core/actors";
import { ActorsContract } from "@printdesk/core/actors/contract";
import { CachedAssetsApi } from "@printdesk/core/api";
import { AssetsContract } from "@printdesk/core/assets/contract";
import { R2CredentialIdentityProviderLayerMap } from "@printdesk/core/aws/credential-identity/r2";
import { CloudflareClient } from "@printdesk/core/cloudflare/client";
import * as Crypto from "@printdesk/core/crypto/layer";
import { WorkerEntrypoint } from "cloudflare:workers";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { assetsS3BucketLayer } from "../lib/assets";
import { cloudflareLayer, r2S3CredentialsLayer } from "../lib/cloudflare";
import { orErrorResponse } from "../lib/error";
import { memoMap, runtime } from "../runtime";
import { imagesGroupLayer } from "./groups/images";

export const handler = CachedAssetsApi.pipe(
  HttpApiBuilder.layer,
  Layer.provide([imagesGroupLayer, HttpRouter.layer, HttpServer.layerServices]),
  Layer.tapCause(Effect.logError),
  HttpRouter.toWebHandler,
).handler;

export class CachedAssets extends WorkerEntrypoint<Env, typeof AssetsContract.Props.Encoded> {
  public override async fetch(request: Request) {
    return Effect.all([
      HttpApiError.HttpApiSchemaError.wrap(
        "Query",
        AssetsContract.UserParams.pipe(
          HttpServerRequest.schemaSearchParams,
          Effect.provideService(
            HttpServerRequest.ParsedSearchParams,
            HttpServerRequest.searchParamsFromURL(new URL(request.url)),
          ),
        ),
      ),
      Schema.decodeEffect(AssetsContract.Props)(this.ctx.props).pipe(
        Effect.mapError((error) => new AssetsContract.InvalidPropsError({ cause: error })),
      ),
    ]).pipe(
      Effect.map(
        ([user, { tenantId }]) => new ActorsContract.UserActor({ ...user, tenantId }).wrap,
      ),
      Effect.map((actor) =>
        ActorLayerMap.get(actor).pipe(
          Layer.merge(R2CredentialIdentityProviderLayerMap.get(actor)),
          Layer.provide(R2CredentialIdentityProviderLayerMap.layerNoDeps),
          Layer.provide([ActorLayerMap.layerNoDeps, assetsS3BucketLayer, CloudflareClient.layer]),
          Layer.provide([cloudflareLayer, Crypto.layer, r2S3CredentialsLayer]),
          Layer.provide(NodeCrypto.layer),
        ),
      ),
      Layer.unwrap,
      (layer) =>
        Effect.scope.pipe(Effect.flatMap((scope) => Layer.buildWithMemoMap(layer, memoMap, scope))),
      Effect.flatMap((context) => Effect.tryPromise(() => handler(request, context))),
      Effect.scoped,
      orErrorResponse,
      runtime.runPromise,
    );
  }

  public async invalidate(tags: Array<string>) {
    // oxlint-disable-next-line typescript/no-non-null-assertion
    return this.ctx.cache!.purge({ tags });
  }
}

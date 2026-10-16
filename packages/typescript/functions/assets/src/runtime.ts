import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { AssetsPresigner } from "@printdesk/core/assets/presigner";
import * as Crypto from "@printdesk/core/crypto/layer";
import { Graph } from "@printdesk/core/graph";
import { ImagesPresigner } from "@printdesk/core/images/presigner";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import { assetsS3BucketLayer } from "./lib/assets";
import { entraIdClientCredentials, openauthLayer } from "./lib/auth";
import { s3ServiceCacheLayer } from "./lib/aws";
import { cloudflareLayer } from "./lib/cloudflare";
import { SstResource } from "./lib/sst";

export const memoMap = Layer.makeMemoMapUnsafe();

export const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    cloudflareLayer,
    Crypto.layer,
    entraIdClientCredentials,
    Graph.layer,
    ImagesPresigner.layer,
    openauthLayer,
    SstResource.layer,
  ).pipe(
    Layer.provideMerge([FetchHttpClient.layer, NodeCrypto.layer]),
    Layer.provide(AssetsPresigner.layer),
    Layer.provide([assetsS3BucketLayer, s3ServiceCacheLayer]),
    Layer.tapCause(Effect.logError),
  ),
  { memoMap },
);

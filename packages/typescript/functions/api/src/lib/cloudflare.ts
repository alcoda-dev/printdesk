import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { CloudflareClient } from "@printdesk/core/cloudflare/client";
import * as Cloudflare from "@printdesk/core/cloudflare/layer";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Layer from "effect/Layer";

export const cloudflareClientLayer = CloudflareClient.layer.pipe(
  Layer.provide([Cloudflare.layer, NodeCrypto.layerSecureRandom]),
  Layer.provide(SstResource.layer),
);

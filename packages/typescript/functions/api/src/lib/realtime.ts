import { AppsyncSigner } from "@printdesk/core/aws/sigv4-signers/appsync";
import { Realtime } from "@printdesk/core/realtime";
import { SstResource } from "@printdesk/core/sst/resource";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";

export const realtimeLayer = Realtime.layer.pipe(
  Layer.provide([AppsyncSigner.layer, FetchHttpClient.layer]),
  Layer.provide(SstResource.layer),
);

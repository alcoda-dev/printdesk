import { S3ServiceCache } from "@printdesk/core/aws/s3/service-cache";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { SstResource } from "./sst";

export const s3ServiceCacheLayer = SstResource.useSync(Struct.get("AssetsBucketTemplate")).pipe(
  Effect.map(Redacted.value),
  Effect.map((bucketTemplate) => S3ServiceCache.layer(bucketTemplate.endpoint)),
  Layer.unwrap,
  Layer.provide(SstResource.layer),
);

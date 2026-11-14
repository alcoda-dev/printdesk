import { assetsS3BucketLayer } from "@printdesk/core/assets/bucket";
import { Aws } from "@printdesk/core/aws";
import { S3Bucket } from "@printdesk/core/aws/s3/bucket";
import { S3ServiceCache } from "@printdesk/core/aws/s3/service-cache";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Struct from "effect/Struct";

export const awsLayer = SstResource.useSync(Struct.get("Aws")).pipe(
  Layer.effect(Aws),
  Layer.provide(SstResource.layer),
);

export const s3ServiceCacheLayer = S3Bucket.endpoint.pipe(
  Effect.map(S3ServiceCache.layer),
  Layer.unwrap,
  Layer.provide(assetsS3BucketLayer),
  Layer.provide(SstResource.layer),
);

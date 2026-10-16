import { assetsS3BucketLayer } from "@printdesk/core/assets/bucket";
import { S3Bucket } from "@printdesk/core/aws/s3/bucket";
import { S3ServiceCache } from "@printdesk/core/aws/s3/service-cache";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const s3ServiceCacheLayer = S3Bucket.endpoint.pipe(
  Effect.map(S3ServiceCache.layer),
  Layer.unwrap,
  Layer.provide(assetsS3BucketLayer),
  Layer.provide(SstResource.layer),
);

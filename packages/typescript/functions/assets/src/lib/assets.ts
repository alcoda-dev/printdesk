import { Actor } from "@printdesk/core/actors";
import { AssetsFetcher } from "@printdesk/core/assets/fetcher";
import { AssetsPresigner } from "@printdesk/core/assets/presigner";
import { S3Bucket } from "@printdesk/core/aws/s3/bucket";
import { ImagesFetcher } from "@printdesk/core/images/fetcher";
import { ImagesPresigner } from "@printdesk/core/images/presigner";
import { tenantTemplate } from "@printdesk/core/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { s3ServiceCacheLayer } from "./aws";
import { SstResource } from "./sst";

export const makeAssetsS3Bucket = Effect.gen(function* () {
  const bucketTemplate = yield* SstResource.useSync(Struct.get("AssetsBucketTemplate")).pipe(
    Effect.map(Redacted.value),
  );

  const endpoint = Effect.succeed(bucketTemplate.endpoint);
  const name = Actor.tenantId.pipe(Effect.map(tenantTemplate(bucketTemplate.name)));

  return {
    endpoint,
    name,
  } as const;
});

export const assetsS3BucketLayer = makeAssetsS3Bucket.pipe(
  Layer.effect(S3Bucket),
  Layer.provide(SstResource.layer),
);

export const imagesLayer = ImagesFetcher.layer.pipe(
  Layer.merge(ImagesPresigner.layer),
  Layer.provide([AssetsFetcher.layer, AssetsPresigner.layer]),
  Layer.provide([assetsS3BucketLayer, s3ServiceCacheLayer]),
);

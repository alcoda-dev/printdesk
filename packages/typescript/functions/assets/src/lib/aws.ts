import { AwsCredentialIdentityProvider } from "@printdesk/core/aws/credential-identity";
import { S3ServiceCache } from "@printdesk/core/aws/s3/service-cache";
import { Aws } from "@printdesk/core/src/aws";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { SstResource } from "./sst";

export const awsLayer = SstResource.useSync(Struct.get("Aws")).pipe(
  Layer.effect(Aws),
  Layer.provide(SstResource.layer),
);

export const awsCredentialIdentityProviderLayer = SstResource.useSync((resource) =>
  AwsCredentialIdentityProvider.layer({
    accessKeyId: resource.AWS_ACCESS_KEY_ID.pipe(Redacted.value),
    secretAccessKey: resource.AWS_SECRET_ACCESS_KEY.pipe(Redacted.value),
  }),
).pipe(Layer.unwrap, Layer.provide(SstResource.layer));

export const s3ServiceCacheLayer = SstResource.useSync(Struct.get("AssetsBucketTemplate")).pipe(
  Effect.map(Redacted.value),
  Effect.map((bucketTemplate) => S3ServiceCache.layer(bucketTemplate.endpoint)),
  Layer.unwrap,
  Layer.provide(SstResource.layer),
);

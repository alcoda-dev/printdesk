import { assetsS3BucketLayer } from "@printdesk/core/assets/bucket";
import { AssetsPresigner } from "@printdesk/core/assets/presigner";
import * as OrderObjectMetadataPolicies from "@printdesk/core/orders/objects/policies/layer";
import * as OrderObjectsPresigner from "@printdesk/core/orders/objects/presigner/layer";
import * as OrderObjectMetadataRepositories from "@printdesk/core/orders/objects/repositories/layers";
import * as OrdersPolicies from "@printdesk/core/orders/policies/layer";
import * as OrdersRepositories from "@printdesk/core/orders/repositories/layers";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Layer from "effect/Layer";

import { s3ServiceCacheLayer } from "./aws";
import { databaseLayer } from "./database";

export const orderObjectsPresignerLayer = OrderObjectsPresigner.layer.pipe(
  Layer.provide([AssetsPresigner.layer, OrderObjectMetadataRepositories.repositoryLayer]),
  Layer.provide([assetsS3BucketLayer, databaseLayer, s3ServiceCacheLayer]),
  Layer.provide(SstResource.layer),
);

export const orderPoliciesLayer = OrderObjectMetadataPolicies.layer.pipe(
  Layer.provideMerge(OrdersPolicies.layer),
  Layer.provide([
    OrderObjectMetadataRepositories.repositoryLayer,
    OrdersRepositories.repositoryLayer,
  ]),
  Layer.provide(databaseLayer),
);

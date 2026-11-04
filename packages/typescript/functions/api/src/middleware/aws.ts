import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { AwsCredentialIdentityProviderMiddleware } from "@printdesk/core/api/middleware/aws";
import { assetsS3BucketLayer } from "@printdesk/core/assets/bucket";
import { AppconfigCredentialIdentityProviderLayerMap } from "@printdesk/core/aws/credential-identity/appconfig";
import {
  AppsyncPublisherCredentialIdentityProviderLayerMap,
  AppsyncSubscriberCredentialIdentityProviderLayerMap,
} from "@printdesk/core/aws/credential-identity/appsync";
import { R2CredentialIdentityProviderLayerMap } from "@printdesk/core/aws/credential-identity/r2";
import * as Cloudflare from "@printdesk/core/cloudflare/layer";
import { r2S3CredentialsLayer } from "@printdesk/core/cloudflare/r2";
import { appconfigRoleLayer } from "@printdesk/core/config/role";
import { Jose } from "@printdesk/core/crypto/jose";
import {
  appsyncPublisherRoleLayer,
  appsyncSubscriberRoleLayer,
} from "@printdesk/core/realtime/roles";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Layer from "effect/Layer";

export const appconfigCredentialIdentityProviderMiddlewareLayer =
  AwsCredentialIdentityProviderMiddleware.appconfigLayer.pipe(
    Layer.provide(AppconfigCredentialIdentityProviderLayerMap.layer),
    Layer.provide(appconfigRoleLayer),
    Layer.provide(SstResource.layer),
  );

export const appsyncPublisherCredentialIdentityProviderMiddlewareLayer =
  AwsCredentialIdentityProviderMiddleware.appsyncPublisherLayer.pipe(
    Layer.provide(AppsyncPublisherCredentialIdentityProviderLayerMap.layer),
    Layer.provide(appsyncPublisherRoleLayer),
    Layer.provide(SstResource.layer),
  );

export const appsyncSubscriberCredentialIdentityProviderMiddlewareLayer =
  AwsCredentialIdentityProviderMiddleware.appsyncSubscriberLayer.pipe(
    Layer.provide(AppsyncSubscriberCredentialIdentityProviderLayerMap.layer),
    Layer.provide(appsyncSubscriberRoleLayer),
    Layer.provide(SstResource.layer),
  );

export const r2CredentialIdentityProviderMiddlewareLayer =
  AwsCredentialIdentityProviderMiddleware.r2Layer.pipe(
    Layer.provide(R2CredentialIdentityProviderLayerMap.layer),
    Layer.provide([assetsS3BucketLayer, Cloudflare.layer, Jose.layer, r2S3CredentialsLayer]),
    Layer.provide([NodeCrypto.layerDigest, NodeCrypto.layerSecureRandom, SstResource.layer]),
  );

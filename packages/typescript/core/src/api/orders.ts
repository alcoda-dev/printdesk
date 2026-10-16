import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AccessControl } from "../access-control";
import { ActorsContract } from "../actors/contract";
import { AssetsContract } from "../assets/contract";
import { OrderObjectMetadataContract, OrdersContract } from "../orders/contracts";
import { EntityId } from "../utils";
import { AwsCredentialIdentityProviderMiddleware } from "./middleware/aws";

export namespace Orders {
  export class Group extends HttpApiGroup.make("Orders")
    .add(
      HttpApiEndpoint.post("objectsUploadUrls", "/:orderId/objects/upload-urls", {
        params: { orderId: EntityId },
        payload: AssetsContract.PresignedUrlPayload,
        success: OrderObjectMetadataContract.PresignedUrlsSuccess,
        error: [
          AccessControl.AccessDeniedError,
          ActorsContract.ForbiddenActorError,
          OrdersContract.NotFoundError,
        ],
      }),
    )
    .add(
      HttpApiEndpoint.post("objectsDownloadUrls", "/:orderId/objects/download-urls", {
        params: { orderId: EntityId },
        payload: AssetsContract.PresignedUrlPayload,
        success: OrderObjectMetadataContract.PresignedUrlsSuccess,
        error: [
          AccessControl.AccessDeniedError,
          ActorsContract.ForbiddenActorError,
          OrdersContract.NotFoundError,
        ],
      }),
    )
    .middleware(AwsCredentialIdentityProviderMiddleware) {}

  export class Objects extends HttpApiGroup.make("OrderObjects")
    .add(
      HttpApiEndpoint.post("uploadUrl", "/:objectId/upload-url", {
        params: { objectId: EntityId },
        payload: AssetsContract.PresignedUrlPayload,
        success: AssetsContract.PresignedUrlSuccess,
        error: [
          AccessControl.AccessDeniedError,
          ActorsContract.ForbiddenActorError,
          OrderObjectMetadataContract.NotFoundError,
        ],
      }),
    )
    .add(
      HttpApiEndpoint.get("object", "/:objectId", {
        params: { objectId: EntityId },
        error: [
          AccessControl.AccessDeniedError,
          ActorsContract.ForbiddenActorError,
          OrderObjectMetadataContract.NotFoundError,
        ],
      }),
    )
    .middleware(AwsCredentialIdentityProviderMiddleware)
    .prefix("/objects") {}

  export class Api extends HttpApi.make("OrdersApi").add(Group).add(Objects) {}
}

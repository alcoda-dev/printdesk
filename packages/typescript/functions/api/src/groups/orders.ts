import { AccessControl } from "@printdesk/core/access-control";
import { Api } from "@printdesk/core/api";
import { OrderObjectMetadataContract, OrdersContract } from "@printdesk/core/orders/contracts";
import { OrderObjectMetadataPolicies } from "@printdesk/core/orders/objects/policies";
import { OrderObjectsPresigner } from "@printdesk/core/orders/objects/presigner";
import { OrdersPolicies } from "@printdesk/core/orders/policies";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { orderPoliciesLayer, orderObjectsPresignerLayer } from "../lib/orders";
import { authMiddlewareLayer } from "../middleware/auth";
import { r2CredentialIdentityProviderMiddlewareLayer } from "../middleware/aws";
import { errorMiddlewareLayer } from "../middleware/error";

export const baseOrdersGroupLayer = HttpApiBuilder.group(
  Api,
  "Orders",
  Effect.fn(function* (handlers) {
    const presigner = yield* OrderObjectsPresigner;
    const policies = yield* OrdersPolicies;

    return handlers
      .handle(
        "objectsUploadUrls",
        Effect.fn("Api.Orders.objectsUploadUrls")(({ params, payload }) =>
          presigner.presignPutUrls(params.orderId, payload.expiresIn).pipe(
            Effect.catchTag(
              "NoSuchElementError",
              () => new OrdersContract.NotFoundError({ id: params.orderId }),
            ),
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.some(
                  AccessControl.permissionPolicy("order_objects:create"),
                  policies.isCustomerOrManager.make({ id: params.orderId, userId: Option.none() }),
                  policies.isManagerAuthorized.make({
                    id: params.orderId,
                    managerId: Option.none(),
                  }),
                ),
                policies.canEdit.make({ id: params.orderId }),
              ),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "objectsDownloadUrls",
        Effect.fn("Api.Orders.objectsDownloadUrls")(({ params, payload }) =>
          presigner.presignGetUrls(params.orderId, payload.expiresIn).pipe(
            Effect.catchTag(
              "NoSuchElementError",
              () => new OrdersContract.NotFoundError({ id: params.orderId }),
            ),
            AccessControl.enforce(
              AccessControl.some(
                AccessControl.permissionPolicy("order_objects:read"),
                policies.isCustomerOrManager.make({ id: params.orderId, userId: Option.none() }),
                policies.isManagerAuthorized.make({ id: params.orderId, managerId: Option.none() }),
              ),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      );
  }),
);

export const baseOrderObjectsGroupLayer = HttpApiBuilder.group(
  Api,
  "OrderObjects",
  Effect.fn(function* (handlers) {
    const presigner = yield* OrderObjectsPresigner;
    const policies = yield* OrderObjectMetadataPolicies;

    return handlers
      .handle(
        "uploadUrl",
        Effect.fn("Api.OrderObjects.uploadUrl")(({ params, payload }) =>
          presigner.presignPutUrl(params.objectId, payload.expiresIn).pipe(
            Effect.catchTag(
              "NoSuchElementError",
              () => new OrderObjectMetadataContract.NotFoundError({ id: params.objectId }),
            ),
            AccessControl.enforce(
              AccessControl.every(
                AccessControl.some(
                  AccessControl.permissionPolicy("order_objects:create"),
                  policies.isCustomerOrManager.make({ id: params.objectId, userId: Option.none() }),
                  policies.isManagerAuthorized.make({
                    id: params.objectId,
                    managerId: Option.none(),
                  }),
                ),
                policies.canEdit.make({ id: params.objectId }),
              ),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      )
      .handle(
        "object",
        Effect.fn("Api.OrderObjects.object")(({ params }) =>
          presigner.presignGetUrl(params.objectId, Duration.minutes(1)).pipe(
            Effect.map(({ url }) => HttpServerResponse.redirect(url)),
            Effect.catchTag(
              "NoSuchElementError",
              () => new OrderObjectMetadataContract.NotFoundError({ id: params.objectId }),
            ),
            AccessControl.enforce(
              AccessControl.some(
                AccessControl.permissionPolicy("order_objects:read"),
                policies.isCustomerOrManager.make({ id: params.objectId, userId: Option.none() }),
                policies.isManagerAuthorized.make({
                  id: params.objectId,
                  managerId: Option.none(),
                }),
              ),
            ),
            orDieWhenUnrespondable,
          ),
        ),
      );
  }),
);

export const ordersGroupLayer = Layer.merge(baseOrdersGroupLayer, baseOrderObjectsGroupLayer).pipe(
  Layer.provide([
    authMiddlewareLayer,
    errorMiddlewareLayer,
    orderObjectsPresignerLayer,
    orderPoliciesLayer,
    r2CredentialIdentityProviderMiddlewareLayer,
  ]),
);

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { ActorLayerMap } from "@printdesk/core/actors";
import {
  ScimErrorMiddleware,
  ScimAuthMiddleware,
  ScimLocatorMiddleware,
  ScimBulkIdMapMiddleware,
  ScimHttpApiSchemaErrorHandlerMiddleware,
} from "@printdesk/core/api/middleware/scim";
import { Oauth } from "@printdesk/core/oauth";
import * as Layer from "effect/Layer";

import { openauthLayer } from "../lib/auth";
import { scimLocatorLayer } from "../lib/scim";

export const scimAuthMiddlewareLayer = ScimAuthMiddleware.layer.pipe(
  Layer.provide([ActorLayerMap.layer, Oauth.AccessTokenLayerMap.layer, openauthLayer]),
);

export const scimBulkIdMapMiddlewareLayer = ScimBulkIdMapMiddleware.layer;

export const scimErrorMiddlewareLayer = ScimErrorMiddleware.layer.pipe(
  Layer.provide(NodeCrypto.layerSecureRandom),
);

export const scimHttpApiSchemaErrorHandlerMiddlewareLayer =
  ScimHttpApiSchemaErrorHandlerMiddleware.layer;

export const scimLocatorMiddlewareLayer = ScimLocatorMiddleware.layer.pipe(
  Layer.provide(scimLocatorLayer),
);

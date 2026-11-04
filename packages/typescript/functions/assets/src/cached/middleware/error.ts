import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { ErrorMiddleware } from "@printdesk/core/api/middleware/error";
import * as Layer from "effect/Layer";

export const errorMiddlewareLayer = ErrorMiddleware.layer.pipe(
  Layer.provide(NodeCrypto.layerSecureRandom),
);

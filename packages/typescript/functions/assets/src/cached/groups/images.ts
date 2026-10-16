import { AccessControl } from "@printdesk/core/access-control";
import { CachedAssetsApi } from "@printdesk/core/api";
import { ImagesFetcher } from "@printdesk/core/images/fetcher";
import { ImagesPresigner } from "@printdesk/core/images/presigner";
import { orDieWhenUnrespondable } from "@printdesk/core/utils";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as Layer from "effect/Layer";

import { imagesLayer } from "../../lib/assets";
import { errorMiddlewareLayer } from "../middleware/error";

export const baseImagesGroupLayer = HttpApiBuilder.group(
  CachedAssetsApi,
  "Images",
  Effect.fn(function* (handlers) {
    const fetcher = yield* ImagesFetcher;
    const presigner = yield* ImagesPresigner;

    return handlers
      .handle("image", ({ params }) =>
        fetcher.fetchResponse(params.image).pipe(
          Effect.catchTag("NoSuchElementError", () => new HttpApiError.NotFound()),
          AccessControl.enforce(AccessControl.permissionPolicy("images:read")),
          orDieWhenUnrespondable,
        ),
      )
      .handle("uploadUrl", ({ params, payload }) =>
        presigner
          .presignPutUrl(params.image, {
            type: payload.mimeType,
            length: payload.byteSize,
            expiresIn: payload.expiresIn,
          })
          .pipe(
            AccessControl.enforce(AccessControl.permissionPolicy("images:create")),
            orDieWhenUnrespondable,
          ),
      );
  }),
);

export const imagesGroupLayer = baseImagesGroupLayer.pipe(
  Layer.provide([imagesLayer, errorMiddlewareLayer]),
);

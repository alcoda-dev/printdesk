import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AccessControl } from "../access-control";
import { ActorsContract } from "../actors/contract";
import { AssetsContract } from "../assets/contract";
import { ImagesContract } from "../images/contract";
import { NonEmptyString } from "../utils";

export namespace Assets {
  export class Images extends HttpApiGroup.make("Images")
    .add(
      HttpApiEndpoint.get("image", "/:image", {
        params: { image: NonEmptyString },
        error: [
          AccessControl.AccessDeniedError,
          ActorsContract.ForbiddenActorError,
          HttpApiError.NotFound,
        ],
      }),
    )
    .add(
      HttpApiEndpoint.post("uploadUrl", "/:image/upload-url", {
        params: { image: NonEmptyString },
        payload: ImagesContract.PresignedUrlPayload,
        success: AssetsContract.PresignedUrlSuccess,
        error: [AccessControl.AccessDeniedError, ActorsContract.ForbiddenActorError],
      }),
    )
    .prefix("/images") {}

  export class Api extends HttpApi.make("AssetsApi").add(Images) {}
}

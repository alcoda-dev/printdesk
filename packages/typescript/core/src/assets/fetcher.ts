import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";

import { S3Bucket } from "../aws/s3/bucket";
import { S3ServiceCache } from "../aws/s3/service-cache";

import type { NonEmptyString } from "../utils";

export class AssetsFetcher extends Context.Service<AssetsFetcher>()(
  "@printdesk/core/assets/Fetcher",
  {
    make: Effect.gen(function* () {
      const { useS3 } = yield* S3ServiceCache;
      const bucket = yield* S3Bucket;

      const fetchResponse = Effect.fn("Assets.Fetcher.fetchResponse")(
        (Key: NonEmptyString, maxAge: Duration.Duration) =>
          bucket.name.pipe(
            Effect.flatMap((Bucket) => useS3((s3) => s3.getObject({ Bucket, Key }))),
            Effect.catchTag("NoSuchKey", () => new Cause.NoSuchElementError()),
            Effect.map((output) =>
              HttpServerResponse.raw(output.Body, {
                status: 200,
                contentType: output.ContentType,
                contentLength: output.ContentLength,
              }),
            ),
            Effect.map(
              HttpServerResponse.setHeaders({
                "Cache-Control": `max-age=${maxAge.pipe(Duration.toSeconds)}`,
                "Cache-Tag": Key,
              }),
            ),
          ),
      );

      return {
        fetchResponse,
      } as const;
    }),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

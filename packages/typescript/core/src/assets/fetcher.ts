import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";

import { S3Bucket } from "../aws/s3/bucket";
import { S3ClientCache } from "../aws/s3/client-cache";

import type { NonEmptyString } from "../utils";

export class AssetsFetcher extends Context.Service<AssetsFetcher>()(
  "@printdesk/core/assets/Fetcher",
  {
    make: Effect.gen(function* () {
      const S3 = yield* S3ClientCache.get;
      const bucket = yield* S3Bucket;

      const fetchResponse = Effect.fn("Assets.Fetcher.fetchResponse")(function* (
        Key: NonEmptyString,
        maxAge: Duration.Duration,
      ) {
        const s3 = yield* S3;
        const Bucket = yield* bucket.name;

        return yield* s3.getObject({ Bucket, Key }).pipe(
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
        );
      });

      return {
        fetchResponse,
      } as const;
    }),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

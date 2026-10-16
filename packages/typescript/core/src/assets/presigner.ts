import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { S3Bucket } from "../aws/s3/bucket";
import { S3ServiceCache } from "../aws/s3/service-cache";

import type { S3Service$ } from "@effect-aws/client-s3";

export class AssetsPresigner extends Context.Service<AssetsPresigner>()(
  "@printdesk/core/assets/Presigner",
  {
    make: Effect.gen(function* () {
      const { useS3 } = yield* S3ServiceCache;
      const bucket = yield* S3Bucket;

      const presignPutUrl = Effect.fn("AssetsPresigner.presignPutUrl")(
        (input: Omit<Parameters<S3Service$["putObject"]>[0], "Bucket">) =>
          bucket.name.pipe(
            Effect.flatMap((Bucket) =>
              useS3((s3) => s3.putObject({ ...input, Bucket }, { presigned: true })),
            ),
          ),
      );

      const presignGetUrl = Effect.fn("AssetsPresigner.presignGetUrl")(
        (input: Omit<Parameters<S3Service$["getObject"]>[0], "Bucket">) =>
          bucket.name.pipe(
            Effect.flatMap((Bucket) =>
              useS3((s3) => s3.getObject({ ...input, Bucket }, { presigned: true })),
            ),
          ),
      );

      return {
        presignPutUrl,
        presignGetUrl,
      } as const;
    }),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

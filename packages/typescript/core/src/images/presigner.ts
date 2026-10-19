import * as ByteSize from "effect/ByteSize";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { AssetsContract } from "../assets/contract";
import { AssetsPresigner } from "../assets/presigner";
import { ImagesContract } from "./contract";

import type { NonEmptyString } from "../utils";

export class ImagesPresigner extends Context.Service<ImagesPresigner>()(
  "@printdesk/core/images/Presigner",
  {
    make: Effect.gen(function* () {
      const presigner = yield* AssetsPresigner;

      const presignPutUrl = Effect.fn("ImagesPresigner.presignPutUrl")(function* (
        image: NonEmptyString,
        content: {
          type: string;
          length: ByteSize.ByteSize;
          expiresIn: Duration.Duration;
        },
      ) {
        const Key = yield* Schema.encodeEffect(ImagesContract.Key)(["images/", image]);
        const expiresAt = yield* DateTime.now.pipe(
          Effect.map(DateTime.addDuration(content.expiresIn)),
        );

        return yield* presigner
          .presignPutUrl({
            Key,
            ContentType: content.type,
            ContentLength: ByteSize.toNumberUnsafe(content.length),
            Expires: expiresAt.pipe(DateTime.toDateUtc),
          })
          .pipe(
            Effect.map((url) =>
              AssetsContract.PresignedUrlSuccess.make({ url: new URL(url), expiresAt }),
            ),
          );
      });

      return {
        presignPutUrl,
      } as const;
    }),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

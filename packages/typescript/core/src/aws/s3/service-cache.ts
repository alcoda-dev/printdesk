import { makeS3Service, S3ClientInstance, S3ServiceConfig } from "@effect-aws/client-s3";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Constants } from "../../utils/constants";
import { AwsCredentialIdentityProvider } from "../credential-identity";

import type { S3Service$ } from "@effect-aws/client-s3";
import type { AwsCredentialIdentity } from "../credential-identity";

export class S3ServiceCache extends Context.Service<S3ServiceCache>()(
  "@printdesk/core/aws/S3ServiceCache",
  {
    make: Effect.fn(function* (endpoint: string) {
      const serviceCache = yield* Cache.make({
        capacity: Constants.DEFAULT_CACHE_CAPACITY,
        lookup: Effect.fn(function* (credentials: AwsCredentialIdentity) {
          return yield* makeS3Service.pipe(
            Effect.provideServiceEffect(S3ClientInstance.S3ClientInstance, S3ClientInstance.make),
            S3ServiceConfig.withS3ServiceConfig({
              credentials: yield* credentials.encode,
              endpoint,
              region: "auto",
            }),
          );
        }),
      });

      const useS3 = Effect.fn("S3ClientCache.useS3")(
        <TSuccess, TError, TServices>(
          callback: (client: S3Service$) => Effect.Effect<TSuccess, TError, TServices>,
        ) =>
          AwsCredentialIdentityProvider.provide.pipe(
            Effect.flatMap((credentials) => serviceCache.pipe(Cache.get(credentials))),
            Effect.flatMap(callback),
          ),
      );

      return {
        useS3,
      } as const;
    }),
  },
) {
  public static readonly layer = (...args: Parameters<typeof this.make>) =>
    this.make(...args).pipe(Layer.effect(this));
}

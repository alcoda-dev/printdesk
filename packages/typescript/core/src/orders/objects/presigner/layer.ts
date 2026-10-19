import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

import { OrderObjectsPresigner } from ".";
import { Actor } from "../../../actors";
import { AssetsContract } from "../../../assets/contract";
import { AssetsPresigner } from "../../../assets/presigner";
import { OrderObjectMetadataContract } from "../../contracts";
import { OrderObjectMetadataRepository } from "../repositories";

import type { OrderObjectMetadata } from "../../sql";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const repository = yield* OrderObjectMetadataRepository;

  const presigner = yield* AssetsPresigner;

  const presignPutUrl = Effect.fn("OrderObjectsPresigner.presignPutUrl")(function* (
    objectId: OrderObjectMetadata["id"],
    expiresIn: Duration.Duration,
  ) {
    const {
      orderId,
      mimeType: ContentType,
      byteSize,
      filename,
    } = yield* repository.findById(objectId, yield* Actor.tenantId);
    const expiresAt = yield* DateTime.now.pipe(Effect.map(DateTime.addDuration(expiresIn)));

    return yield* Effect.succeed({ orderId, objectId }).pipe(
      Effect.flatMap(Schema.encodeEffect(OrderObjectMetadataContract.Key)),
      Effect.flatMap((Key) =>
        presigner.presignPutUrl({
          Key,
          ContentType,
          ContentLength: ByteSize.toNumberUnsafe(byteSize),
          ContentDisposition: `inline; filename="${filename}"`,
          Expires: expiresAt.pipe(DateTime.toDateUtc),
        }),
      ),
      Effect.map((url) =>
        AssetsContract.PresignedUrlSuccess.make({ url: new URL(url), expiresAt }),
      ),
    );
  });

  const presignGetUrl = Effect.fn("OrderObjectsPresigner.presignGetUrl")(function* (
    objectId: OrderObjectMetadata["id"],
    expiresIn: Duration.Duration,
  ) {
    const { order, metadata } = yield* repository.findWithOrderById(
      objectId,
      yield* Actor.tenantId,
    );
    const filename = `${order.shortId ?? order.id}_${metadata.filename}`;
    const expiresAt = yield* DateTime.now.pipe(Effect.map(DateTime.addDuration(expiresIn)));

    return yield* Schema.encodeEffect(OrderObjectMetadataContract.Key)({
      orderId: order.id,
      objectId,
    }).pipe(
      Effect.flatMap((Key) =>
        presigner
          .presignGetUrl({
            Key,
            ResponseContentDisposition: `inline; filename="${filename}"`,
            ResponseExpires: expiresAt.pipe(DateTime.toDateUtc),
          })
          .pipe(Effect.map((url) => ({ url: new URL(url), expiresAt }))),
      ),
    );
  });

  const presignPutUrls = Effect.fn("OrderObjectsPresigner.presignPutUrls")(function* (
    orderId: OrderObjectMetadata["orderId"],
    expiresIn: Duration.Duration,
  ) {
    const objectsMetadata = yield* repository.findByOrderId(orderId, yield* Actor.tenantId);
    const expiresAt = yield* DateTime.now.pipe(Effect.map(DateTime.addDuration(expiresIn)));

    return yield* Effect.reduce(
      objectsMetadata,
      Record.empty<OrderObjectMetadata["id"], AssetsContract.PresignedUrlSuccess>,
      (record, metadata) =>
        Effect.succeed({ orderId, objectId: metadata.id }).pipe(
          Effect.flatMap(Schema.encodeEffect(OrderObjectMetadataContract.Key)),
          Effect.flatMap((Key) =>
            presigner.presignPutUrl({
              Key,
              ContentType: metadata.mimeType,
              ContentLength: ByteSize.toNumberUnsafe(metadata.byteSize),
              ContentDisposition: `inline; filename="${metadata.filename}"`,
              Expires: expiresAt.pipe(DateTime.toDateUtc),
            }),
          ),
          Effect.map((url) =>
            Record.set(
              record,
              metadata.id,
              AssetsContract.PresignedUrlSuccess.make({ url: new URL(url), expiresAt }),
            ),
          ),
        ),
    ).pipe(Effect.map((record) => OrderObjectMetadataContract.PresignedUrlsSuccess.make(record)));
  });

  const presignGetUrls = Effect.fn("OrderObjectsPresigner.presignGetUrls")(function* (
    orderId: OrderObjectMetadata["orderId"],
    expiresIn: Duration.Duration,
  ) {
    const objectsMetadataWithOrders = yield* repository.findByOrderIdWithOrder(
      orderId,
      yield* Actor.tenantId,
    );
    const expiresAt = yield* DateTime.now.pipe(Effect.map(DateTime.addDuration(expiresIn)));

    return yield* Effect.reduce(
      objectsMetadataWithOrders,
      Record.empty<OrderObjectMetadata["id"], AssetsContract.PresignedUrlSuccess>,
      (record, { order, metadata }) =>
        Effect.succeed({ orderId, objectId: metadata.id }).pipe(
          Effect.flatMap(Schema.encodeEffect(OrderObjectMetadataContract.Key)),
          Effect.flatMap((Key) =>
            presigner.presignGetUrl({
              Key,
              ResponseContentDisposition: `inline; filename="${order.shortId ?? order.id}_${metadata.filename}"`,
              ResponseExpires: expiresAt.pipe(DateTime.toDateUtc),
            }),
          ),
          Effect.map((url) =>
            Record.set(
              record,
              metadata.id,
              AssetsContract.PresignedUrlSuccess.make({ url: new URL(url), expiresAt }),
            ),
          ),
        ),
    ).pipe(Effect.map((record) => OrderObjectMetadataContract.PresignedUrlsSuccess.make(record)));
  });

  return {
    presignPutUrl,
    presignPutUrls,
    presignGetUrl,
    presignGetUrls,
  } as const;
});

export const layer = makeService.pipe(Layer.effect(OrderObjectsPresigner));

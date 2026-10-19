import { DynamoDBDocument } from "@effect-aws/dynamodb";
import * as Array from "effect/Array";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { OrdersShortIdGenerator } from ".";
import { SstResource } from "../../sst/resource";
import { ShortId } from "../../utils";
import { Constants } from "../../utils/constants";
import { OrdersContract } from "../contracts";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const ddb = yield* DynamoDBDocument;
  const table = yield* SstResource.useSync((resource) => resource.Dynamo.pipe(Redacted.value));

  const generate = Effect.fn("Orders.ShortIdGenerator.generate")(
    (pk: typeof OrdersContract.Item.fields.pk.Type) =>
      Schema.encodeEffect(OrdersContract.Item.fields.pk)(pk).pipe(
        Effect.flatMap((pk) =>
          ddb.query({
            TableName: table.name,
            KeyConditionExpression: "#pk = :pk",
            ExpressionAttributeNames: { "#pk": Constants.DYNAMO_KEYS.PK },
            ExpressionAttributeValues: { ":pk": pk },
            ScanIndexForward: false,
            Limit: 1,
          }),
        ),
        Effect.map(Struct.get("Items")),
        Effect.filterOrElse(Predicate.isNotUndefined, () => Effect.succeed([])),
        Effect.map(Array.head),
        Effect.map(Option.map(Schema.decodeUnknownEffect(OrdersContract.Item))),
        Effect.flatMap(
          Option.match({
            onSome: Effect.map(Struct.get(Constants.DYNAMO_KEYS.SK)),
            onNone: () => Effect.succeed(ShortId.make(0, { disableChecks: true })),
          }),
        ),
        Effect.flatMap(Ref.make),
        Effect.flatMap((lastId) =>
          lastId.pipe(
            Ref.updateAndGet((id) => ShortId.make(id + 1)),
            Effect.map((sk) => new OrdersContract.Item({ pk, sk })),
            Effect.flatMap(Schema.encodeEffect(OrdersContract.Item)),
            Effect.flatMap((Item) =>
              ddb.put({
                TableName: table.name,
                Item,
                ConditionExpression: `attribute_not_exists(${Constants.DYNAMO_KEYS.PK})`,
              }),
            ),
            Effect.map(Struct.get("Attributes")),
            Effect.filterOrFail(Predicate.isNotUndefined),
            Effect.flatMap(Schema.decodeUnknownEffect(OrdersContract.Item)),
            Effect.map(Struct.get(Constants.DYNAMO_KEYS.SK)),
            Effect.retry(($) =>
              $(
                Schedule.max([
                  Schedule.exponential(Duration.millis(10)),
                  Schedule.recurs(Constants.DB_TRANSACTION_MAX_RETRIES),
                ]),
              ).pipe(
                Schedule.jittered,
                Schedule.while(
                  Effect.fn(function* (metadata) {
                    const isRetryable = metadata.input._tag === "ConditionalCheckFailedException";

                    yield* Effect.log(
                      `[Orders.ShortIdGenerator]: Generation attempt #${metadata.attempt} failed, ${isRetryable ? `retrying again in ${metadata.duration.pipe(Duration.format)}` : "not retryable"}:`,
                      Cause.fail(metadata.input),
                    );

                    return isRetryable;
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
  );

  return { generate } as const;
});

export const layer = makeService.pipe(Layer.effect(OrdersShortIdGenerator));

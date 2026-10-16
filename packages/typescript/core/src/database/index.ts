import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { is } from "drizzle-orm/entity";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as SqlError from "effect/sql/SqlError";
import * as Struct from "effect/Struct";

import { Constants } from "../utils/constants";
import { Drizzle } from "./drizzle";
import { Transaction } from "./transaction";

import type { AnyPgSelectQueryBuilder, PgSelectDynamic } from "drizzle-orm/pg-core";

export class QueryBuilderError extends Schema.TaggedError<QueryBuilderError>()(
  "QueryBuilderError",
  { cause: Schema.Defect() },
) {}

export class Database extends Context.Service<Database>()("@printdesk/core/database/Database", {
  make: Effect.gen(function* () {
    const db = yield* Drizzle;

    const withTransaction = Effect.fn("Database.withTransaction")(
      <TSuccess, TError, TServices>(
        execute: (tx: typeof Transaction.Service.tx) => Effect.Effect<TSuccess, TError, TServices>,
        { disableRetries = false }: { disableRetries?: boolean } = {},
      ) =>
        db
          .transaction((tx) =>
            execute(tx).pipe(Effect.provideServiceEffect(Transaction, Transaction.make(tx))),
          )
          .pipe(
            Effect.scoped,
            Effect.mapError((error) =>
              Option.some(error).pipe(
                Option.filter((e) => is(e, EffectDrizzleQueryError)),
                Option.map(Struct.get("cause")),
                Option.filter(Cause.isCause),
                Option.flatMap(Cause.findErrorOption),
                Option.filter(SqlError.isSqlError),
                Option.getOrElse(() => error),
              ),
            ),
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
                    const shouldRetry =
                      !disableRetries &&
                      SqlError.isSqlError(metadata.input) &&
                      metadata.input.isRetryable;

                    yield* Effect.log(
                      `[Database]: Transaction attempt #${metadata.attempt} failed, ${
                        shouldRetry
                          ? `retrying again in ${metadata.duration.pipe(Duration.format)}`
                          : "not retrying"
                      }:`,
                      Cause.fail(metadata.input),
                    );

                    return shouldRetry;
                  }),
                ),
              ),
            ),
          ),
    );

    const useTransaction = Effect.fn("Database.useTransaction")(
      <TSuccess, TError, TServices>(
        execute: (tx: typeof Transaction.Service.tx) => Effect.Effect<TSuccess, TError, TServices>,
      ) =>
        Transaction.pipe(
          Effect.serviceOption,
          Effect.flatMap(
            Option.match({
              onSome: ({ tx }) => execute(tx),
              onNone: () => withTransaction(execute),
            }),
          ),
        ),
    );

    const useQueryBuilder = Effect.fn("Database.useQueryBuilder")(function* <
      TQueryBuilder extends AnyPgSelectQueryBuilder,
      TDynamic extends PgSelectDynamic<TQueryBuilder>,
    >(callback: (tx: typeof Transaction.Service.tx) => TDynamic) {
      const execute = (tx: typeof Transaction.Service.tx) =>
        Effect.try({
          try: () => callback(tx),
          catch: (cause) => new QueryBuilderError({ cause }),
        });

      return yield* Transaction.pipe(
        Effect.serviceOption,
        Effect.flatMap(
          Option.match({
            onSome: ({ tx }) => execute(tx),
            onNone: () => withTransaction(execute),
          }),
        ),
      );
    });

    return {
      useTransaction,
      useQueryBuilder,
    } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

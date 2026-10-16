// oxlint-disable typescript/no-explicit-any
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { AccessControl } from "../access-control";
import { Actor } from "../actors";

import type { ActorsContract } from "../actors/contract";
import type { Handler } from "../handlers";

export namespace Mutation {
  export type Mutator<TArgs extends Schema.Top, TSuccess, TError, TServices> = (
    args: TArgs["Type"],
    user: ActorsContract.UserActor,
  ) => Effect.Effect<TSuccess, TError, TServices>;

  export type Mutation<
    TName extends string,
    TArgs extends Schema.Top,
    TMutatorSuccess,
    TMutatorError,
    TMutatorServices,
    TPolicyError,
    TPolicyServices,
  > = {
    readonly name: TName;
    readonly makePolicy: AccessControl.MakePolicy<TArgs, TPolicyError, TPolicyServices>;
    readonly mutator: Mutator<TArgs, TMutatorSuccess, TMutatorError, TMutatorServices>;
  };

  export const make = <
    THandler extends Handler.Handler,
    TMutatorSuccess extends Schema.Schema.Type<THandler["Output"]>,
    TMutatorError,
    TMutatorServices,
    TPolicyError,
    TPolicyServices,
  >(
    handler: THandler,
    properties: Omit<
      Mutation<
        THandler["name"],
        THandler["Input"],
        TMutatorSuccess,
        TMutatorError,
        TMutatorServices,
        TPolicyError,
        TPolicyServices
      >,
      "name"
    >,
  ): Mutation<
    THandler["name"],
    THandler["Input"],
    TMutatorSuccess,
    TMutatorError,
    TMutatorServices,
    TPolicyError,
    TPolicyServices
  > => Object.assign(properties, { name: handler.name });

  type MutationRecord<
    TName extends string = string,
    TMutatorSuccess = any,
    TMutatorError = any,
    TMutatorServices = any,
    TPolicyError = any,
    TPolicyServices = any,
  > = Record<
    TName,
    {
      readonly MutatorSuccess: TMutatorSuccess;
      readonly MutatorError: TMutatorError;
      readonly MutatorServices: TMutatorServices;
      readonly PolicyError: TPolicyError;
      readonly PolicyServices: TPolicyServices;
    }
  >;

  export class Dispatcher<
    THandlerRecord extends Handler.HandlerRecord,
    // oxlint-disable-next-line typescript/no-empty-object-type
    TRecord extends MutationRecord = {},
    TIsFinal extends boolean = false,
  > extends Data.Class<{
    readonly handlerRegistry: Handler.Registry<THandlerRecord, true>;
  }> {
    #isFinal = false;
    #map = HashMap.empty<
      keyof THandlerRecord & string,
      Mutation<
        keyof THandlerRecord & string,
        THandlerRecord[keyof THandlerRecord]["Input"],
        THandlerRecord[keyof THandlerRecord]["Output"]["Type"],
        TRecord[keyof TRecord]["MutatorError"],
        TRecord[keyof TRecord]["MutatorServices"],
        TRecord[keyof TRecord]["PolicyError"],
        TRecord[keyof TRecord]["PolicyServices"]
      >
    >();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    public readonly Record = {} as TRecord;

    public mutation<
      TName extends keyof THandlerRecord & string,
      TMutatorSuccess extends Schema.Schema.Type<THandlerRecord[TName]["Output"]>,
      TMutatorError,
      TMutatorServices,
      TPolicyError,
      TPolicyServices,
    >(
      this: TIsFinal extends false ? Dispatcher<THandlerRecord, TRecord, TIsFinal> : never,
      mutation: Mutation<
        TName,
        THandlerRecord[TName]["Input"],
        TMutatorSuccess,
        TMutatorError,
        TMutatorServices,
        TPolicyError,
        TPolicyServices
      >,
    ) {
      if (!this.#isFinal) this.#map = HashMap.set(this.#map, mutation.name, mutation);

      return this as Dispatcher<
        THandlerRecord,
        TRecord &
          MutationRecord<
            TName,
            TMutatorSuccess,
            TMutatorError,
            TMutatorServices,
            TPolicyError,
            TPolicyServices
          >,
        TIsFinal
      >;
    }

    public final(
      this: keyof THandlerRecord extends keyof TRecord
        ? Dispatcher<THandlerRecord, TRecord, TIsFinal>
        : never,
    ) {
      this.#isFinal = true;

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return this as Dispatcher<THandlerRecord, TRecord, true>;
    }

    public dispatch<TName extends keyof TRecord & string>(
      this: TIsFinal extends true ? Dispatcher<THandlerRecord, TRecord, TIsFinal> : never,
      name: TName,
      args: Schema.Schema.Type<THandlerRecord[TName]["Input"]>,
    ) {
      return Effect.gen({ self: this }, function* () {
        const user = yield* Actor.pipe(Effect.flatMap(Struct.get("assertUser")));

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const mutation = (yield* this.#map.pipe(
          HashMap.get(name),
          Effect.fromOption,
          Effect.orDie,
        )) as Mutation<
          TName,
          THandlerRecord[TName]["Input"],
          TRecord[TName]["MutatorSuccess"],
          TRecord[TName]["MutatorError"],
          TRecord[TName]["MutatorServices"],
          TRecord[TName]["PolicyError"],
          TRecord[TName]["PolicyServices"]
        >;

        const { Input: Args, Output: Returns } = yield* this.handlerRegistry.resolve(mutation.name);

        const safeArgs = yield* Effect.succeed(args).pipe(Schema.decodeEffect(Args));

        return yield* mutation
          .mutator(safeArgs, user)
          .pipe(
            Effect.flatMap(Schema.decodeEffect(Returns)),
            AccessControl.enforce(mutation.makePolicy(safeArgs)),
          );
      });
    }
  }
}

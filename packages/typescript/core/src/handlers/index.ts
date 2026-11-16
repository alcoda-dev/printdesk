// oxlint-disable typescript/no-unsafe-type-assertion
import * as Array from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Iterable from "effect/Iterable";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

export namespace Handler {
  export class Handler<
    TName extends string = string,
    TInput extends Schema.Top = Schema.Top,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
    TOutput extends Schema.Top = Schema.Top,
  > extends Data.Class<{
    readonly name: TName;
    readonly Input: TInput;
    readonly Output: TOutput;
  }> {
    public readonly make = (input: Schema.Schema.Type<TInput>) => ({ name: this.name, input });
  }

  export type HandlerRecord<THandler extends Handler = Handler> = Record<
    THandler["name"],
    THandler
  >;

  export class Registry<
    // oxlint-disable-next-line typescript/no-empty-object-type
    TRecord extends HandlerRecord = {},
    TIsFinal extends boolean = false,
  > {
    #isFinal = false;
    #map = HashMap.empty<Handler["name"], Handler>();

    public handle<THandler extends Handler>(
      this: TIsFinal extends false ? Registry<TRecord, TIsFinal> : never,
      handler: THandler,
    ) {
      if (!this.#isFinal) this.#map = HashMap.set(this.#map, handler.name, handler);

      return this as Registry<TRecord & HandlerRecord<THandler>, TIsFinal>;
    }

    public final(this: TIsFinal extends false ? Registry<TRecord, TIsFinal> : never) {
      this.#isFinal = true;

      return this as Registry<TRecord, true>;
    }

    public resolve<TName extends keyof TRecord & string>(name: TName) {
      return this.#map.pipe(
        HashMap.get(name),
        Effect.fromOption,
        Effect.map(
          (handler) => handler as Handler<TName, TRecord[TName]["Input"], TRecord[TName]["Output"]>,
        ),
      );
    }

    public get record() {
      return this.#map.pipe(HashMap.entries, Record.fromEntries) as {
        readonly [TName in keyof TRecord]: TName extends string
          ? Handler<TName, TRecord[TName]["Input"], TRecord[TName]["Output"]>
          : never;
      };
    }

    public get Schema() {
      return this.#map.pipe(
        HashMap.values,
        Iterable.map(
          (handler) =>
            Schema.Struct({
              name: Schema.tag(handler.name),
              input: handler.Input,
            }) as {
              readonly [TName in keyof TRecord]: TName extends string
                ? Schema.Struct<{
                    name: Schema.tag<TName>;
                    input: TRecord[TName]["Input"];
                  }>
                : never;
            }[keyof TRecord],
        ),
        (members) => Schema.Union(Array.fromIterable(members)),
      );
    }

    public get ReplicacheMutationV0Schema() {
      return this.#map.pipe(
        HashMap.values,
        Iterable.map(
          (handler) =>
            Schema.Struct({
              id: Schema.Int,
              name: Schema.tag(handler.name),
              args: handler.Input,
              timestamp: Schema.Finite,
            }) as {
              readonly [TName in keyof TRecord]: TName extends string
                ? Schema.Struct<{
                    id: Schema.Int;
                    name: Schema.tag<TName>;
                    args: TRecord[TName]["Input"];
                    timestamp: Schema.Finite;
                  }>
                : never;
            }[keyof TRecord],
        ),
        (members) => Schema.Union(Array.fromIterable(members)),
      );
    }

    public get ReplicacheMutationV1Schema() {
      return this.#map.pipe(
        HashMap.values,
        Iterable.map(
          (handler) =>
            Schema.Struct({
              id: Schema.Int,
              name: Schema.tag(handler.name),
              args: handler.Input,
              timestamp: Schema.Finite,
              clientId: Schema.String.check(Schema.isUUID()),
            }).pipe(Schema.encodeKeys({ clientId: "clientID" })) as {
              readonly [TName in keyof TRecord]: TName extends string
                ? Schema.encodeKeys<
                    Schema.Struct<{
                      id: Schema.Int;
                      name: Schema.tag<TName>;
                      args: TRecord[TName]["Input"];
                      timestamp: Schema.Finite;
                      clientId: Schema.String;
                    }>,
                    { clientId: "clientID" }
                  >
                : never;
            }[keyof TRecord],
        ),
        (members) => Schema.Union(Array.fromIterable(members)),
      );
    }

    public get ReplicachePullPolicySchema() {
      return this.#map.pipe(
        HashMap.values,
        Iterable.map(
          (handler) =>
            Schema.Struct({
              _tag: Schema.tag("ReplicachePullPolicy"),
              name: Schema.tag(handler.name),
              input: handler.Input,
            }) as {
              readonly [TName in keyof TRecord]: TName extends string
                ? Schema.Struct<{
                    _tag: Schema.tag<"ReplicachePullPolicy">;
                    name: Schema.tag<TName>;
                    input: TRecord[TName]["Input"];
                  }>
                : never;
            }[keyof TRecord],
        ),
        (members) => Schema.Union(Array.fromIterable(members)),
      );
    }
  }
}

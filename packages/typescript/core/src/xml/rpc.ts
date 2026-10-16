import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Struct from "effect/Struct";

import { Xml } from ".";
import { XmlRpcContract } from "./contracts";

import type { HttpClientResponse } from "effect/http/HttpClientResponse";
import type { ParseOptions } from "effect/SchemaAST";
import type { SchemaAndValue } from "../utils";

export namespace XmlRpc {
  export const boolean = (boolean: boolean): SchemaAndValue<typeof XmlRpcContract.Boolean> => ({
    schema: XmlRpcContract.Boolean,
    value: XmlRpcContract.Boolean.make({ value: { boolean } }),
  });

  export const double = (double: number): SchemaAndValue<typeof XmlRpcContract.Double> => ({
    schema: XmlRpcContract.Double,
    value: XmlRpcContract.Double.make({ value: { double } }),
  });

  export const int = (int: number): SchemaAndValue<typeof XmlRpcContract.Int> => ({
    schema: XmlRpcContract.Int,
    value: XmlRpcContract.Int.make({ value: { int } }),
  });

  export const string = (string: string): SchemaAndValue<typeof XmlRpcContract.String> => ({
    schema: XmlRpcContract.String,
    value: XmlRpcContract.String.make({ value: { string } }),
  });

  export const stringArray = (
    strings: Array<string>,
  ): SchemaAndValue<typeof XmlRpcContract.StringArray> => ({
    schema: XmlRpcContract.StringArray,
    value: XmlRpcContract.StringArray.make({
      // oxlint-disable-next-line effecttsgo/prefer-effect-array
      value: { array: { data: { value: strings.map((string) => ({ string })) } } },
    }),
  });

  export const XmlRpcRequestPath = Context.Reference<string>("@printdesk/core/xml/RpcRequestPath", {
    defaultValue: () => "/",
  });

  export class XmlRpc extends Context.Service<XmlRpc>()("@printdesk/core/xml/Rpc", {
    make: Effect.gen(function* () {
      const { build } = yield* Xml.Builder;
      const { parse } = yield* Xml.Parser;

      const request = Effect.fn("XmlRpc.request")(function* <
        // oxlint-disable-next-line typescript/no-explicit-any
        TCodecs extends Array<Schema.Codec<any>>,
      >(
        methodName: string,
        schemas: { [TKey in keyof TCodecs]: SchemaAndValue<TCodecs[TKey]> },
        parseOptions?: ParseOptions,
      ) {
        const path = yield* XmlRpcRequestPath;

        const encode = Schema.String.pipe(
          Schema.decodeTo(
            Schema.Struct({
              methodCall: Schema.Struct({ methodName: Schema.Literal(methodName) }),
              params: Schema.Struct({ param: Schema.Tuple(schemas.map(Struct.get("schema"))) }),
            }),
            {
              decode: SchemaGetter.forbidden(() => "Not implemented"),
              encode: SchemaGetter.transformEffect((input, options) =>
                build(input).pipe(
                  Effect.mapError(
                    (e) => new SchemaIssue.InvalidValue({ message: e.message }, input, options),
                  ),
                ),
              ),
            },
          ),
          Schema.encodeUnknownEffect,
        );

        return yield* encode(
          { methodCall: { methodName, params: { param: schemas.map(Struct.get("value")) } } },
          parseOptions,
        ).pipe(
          Effect.mapError((error) => new HttpBody.HttpBodyError({ reason: error, cause: error })),
          Effect.map((body) =>
            HttpClientRequest.post(path).pipe(HttpClientRequest.bodyText(body, "application/xml")),
          ),
        );
      });

      function response<TType, TEncoded, TServices>(
        SuccessResponse: Schema.Codec<TType, TEncoded, TServices>,
        parseOptions?: ParseOptions,
      ) {
        const decode = Schema.String.pipe(
          Schema.decodeTo(Schema.Union([SuccessResponse, XmlRpcContract.FaultResponse]), {
            decode: SchemaGetter.transformEffect((text, options) =>
              parse<TEncoded | typeof XmlRpcContract.FaultResponse.Encoded>(text).pipe(
                Effect.mapError(
                  (e) => new SchemaIssue.InvalidValue({ message: e.message }, text, options),
                ),
              ),
            ),
            encode: SchemaGetter.forbidden(() => "Not implemented"),
          }),
          Schema.decodeEffect,
        );

        return Effect.fn("XmlRpc.response")((response: HttpClientResponse) =>
          response.text.pipe(
            Effect.flatMap((text) => decode(text, parseOptions)),
            // oxlint-disable-next-line effecttsgo/flat-map-conditional-to-filter-or-fail
            Effect.flatMap((output) =>
              Schema.is(XmlRpcContract.FaultError)(output)
                ? // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
                  Effect.fail(output as XmlRpcContract.FaultError)
                : Effect.succeed(output),
            ),
          ),
        );
      }

      return { request, response } as const;
    }),
  }) {
    public static layer = this.make.pipe(Layer.effect(this));
  }
}

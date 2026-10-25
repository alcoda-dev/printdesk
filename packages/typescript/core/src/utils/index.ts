import * as Array from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as Filter from "effect/Filter";
import * as Function from "effect/Function";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as String from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { customAlphabet } from "nanoid";

import { Constants } from "./constants";

import type * as SchemaAST from "effect/SchemaAST";

export const NanoId = Schema.String.pipe(Schema.check(Schema.isPattern(Constants.NANOID_REGEX)));

export const EntityId = NanoId.pipe(Schema.brand("EntityId"));
export type EntityId = typeof EntityId.Type;

export const generateEntityId = Effect.sync(
  customAlphabet<EntityId>(Constants.NANOID_ALPHABET, Constants.NANOID_LENGTH),
);

export const ShortId = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThan(0)),
  Schema.brand("ShortId"),
);
export type ShortId = typeof ShortId.Type;

export const TenantId = EntityId.pipe(Schema.brand("TenantId"));
export type TenantId = typeof TenantId.Type;

export const Version = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.withDecodingDefaultType(Effect.succeed(0)),
  Schema.withConstructorDefault(Effect.succeed(0)),
  Schema.brand("Version"),
);
export type Version = typeof Version.Type;

interface _NonEmptyString extends Schema.Bottom<
  `${string & {}}${string}`,
  string,
  never,
  never,
  SchemaAST.String,
  _NonEmptyString
  // oxlint-disable-next-line typescript/no-empty-object-type
> {}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const NonEmptyString = Schema.NonEmptyString as _NonEmptyString;
export type NonEmptyString = typeof NonEmptyString.Type;

export const Base64 = Schema.NonEmptyString.pipe(Schema.check(Schema.isBase64()));

export const Separator = Schema.Literal(Constants.SEPARATOR);

export const separatedString = (separator = Constants.SEPARATOR) =>
  Object.assign(
    Schema.String.annotate({ description: `a string separated by ${separator}` }).pipe(
      Schema.check(
        Schema.isPattern(new RegExp(`^(?:[^${separator}]+(?:${separator}[^${separator}]+)*)?$`)),
      ),
      Schema.decodeTo(Schema.Trim.pipe(Schema.Array), {
        decode: SchemaGetter.transform(String.split(separator)),
        encode: SchemaGetter.transform(Array.join(separator)),
      }),
    ),
    { separator },
  );

export const Cost = Schema.Union([Schema.Finite, Schema.FiniteFromString]);

export const IsoTimestamp = Schema.String.pipe(
  Schema.check(Schema.isPattern(Constants.ISO_TIMESTAMP_REGEX)),
);

export const IsoDate = Schema.String.pipe(Schema.check(Schema.isPattern(Constants.ISO_DATE_REGEX)));

export const HexColor = Schema.String.pipe(
  Schema.check(Schema.isPattern(Constants.HEX_COLOR_REGEX)),
);

export const StringFromUnknown = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform(globalThis.String),
    encode: SchemaGetter.passthrough(),
  }),
);

export const Ipv4 = Schema.String.pipe(Schema.check(Schema.isPattern(Constants.IPV4_REGEX)));

export const ChunkFromArray = <TValue extends Schema.Top>(value: TValue) =>
  value.pipe(
    Schema.Chunk,
    Schema.encodeTo(value.pipe(Schema.Array), {
      decode: SchemaGetter.transform(Chunk.fromIterable),
      encode: SchemaGetter.transform(Chunk.toArray),
    }),
  );

export const CallbackId = Schema.String.pipe(Schema.brand("CallbackId"));
export type CallbackId = typeof CallbackId.Type;

export const BooleanFromString = Schema.String.pipe(
  Schema.decode(SchemaTransformation.toLowerCase()),
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transformEffect((string) =>
      string === "true"
        ? Effect.succeed(true)
        : string === "false"
          ? Effect.succeed(false)
          : Effect.fail(new SchemaIssue.InvalidValue({ message: "not a boolean" })),
    ),
    encode: SchemaGetter.String(),
  }),
);

export const IntFromString = Schema.FiniteFromString.pipe(Schema.check(Schema.isInt()));

export const BulkId = Schema.TemplateLiteralParser([
  Schema.Literal("bulkId:"),
  NonEmptyString,
]).pipe(
  Schema.decodeTo(Schema.Struct({ bulkId: NonEmptyString }), {
    decode: SchemaGetter.transform(([, bulkId]) => ({ bulkId })),
    encode: SchemaGetter.transformEffect(({ bulkId }) =>
      Schema.decodeEffect(NonEmptyString)(bulkId).pipe(
        Effect.mapBoth({
          onSuccess: (bulkId) => ["bulkId:", bulkId],
          onFailure: Struct.get("issue"),
        }),
      ),
    ),
  }),
);
export type BulkId = typeof BulkId.Type;

export const tenantTemplate = Function.dual<
  (template: string) => (tenantId: TenantId) => string,
  (tenantId: TenantId, template: string) => string
>(2, (tenantId, template) =>
  String.replace(new RegExp(Constants.TENANT_ID_PLACEHOLDER, "g"), tenantId)(template),
);

export const TenantIdFromTemplate = Schema.TemplateLiteralParser([
  Schema.String,
  TenantId,
  Schema.String,
]).pipe(
  Schema.decodeTo(TenantId, {
    decode: SchemaGetter.transform(Tuple.get(1)),
    encode: SchemaGetter.forbidden(() => "Not implemented"),
  }),
);

export const getUserInitials = Effect.fn(function* (name: string) {
  if (!name) return "";

  const splitName = String.split(name, " ");

  const firstInitial = yield* Array.head(splitName).pipe(
    Option.flatMap((firstName) => String.charAt(firstName, 0)),
    Effect.fromOption,
    Effect.map(String.toUpperCase),
  );

  if (splitName.length === 1) return firstInitial;

  const lastInitial = yield* Array.last(splitName).pipe(
    Option.flatMap((lastName) => String.charAt(lastName, 0)),
    Effect.fromOption,
    Effect.map(String.toUpperCase),
  );

  return `${firstInitial}${lastInitial}`;
});

export const prefix = Function.dual<
  <TPrefix extends string, TSuffix extends string>(
    prefix: TPrefix,
  ) => (suffix: TSuffix) => `${TPrefix}${TSuffix}`,
  <TPrefix extends string, TSuffix extends string>(
    prefix: TPrefix,
    suffix: TSuffix,
  ) => `${TPrefix}${TSuffix}`
>(2, (prefix, suffix) => `${prefix}${suffix}`);

export const suffix = Function.dual<
  <TPrefix extends string, TSuffix extends string>(
    suffix: TSuffix,
  ) => (prefix: TPrefix) => `${TPrefix}${TSuffix}`,
  <TPrefix extends string, TSuffix extends string>(
    prefix: TPrefix,
    suffix: TSuffix,
  ) => `${TPrefix}${TSuffix}`
>(2, (prefix, suffix) => `${prefix}${suffix}`);

export const pluck =
  <TPropertyKey extends PropertyKey>(propertyKey: TPropertyKey) =>
  <TSchema extends Schema.Top>(
    schema: Schema.Struct<{ [TKey in TPropertyKey]: TSchema }>,
  ): Schema.decodeTo<Schema.toType<TSchema>, Schema.Struct<{ [K in TPropertyKey]: TSchema }>> =>
    schema.mapFields(Struct.pick([propertyKey])).pipe(
      Schema.decodeTo(Schema.toType(schema.fields[propertyKey]), {
        // oxlint-disable-next-line typescript/no-explicit-any
        decode: SchemaGetter.transform((whole: any) => whole[propertyKey]),
        // oxlint-disable-next-line typescript/no-explicit-any typescript/no-unsafe-type-assertion
        encode: SchemaGetter.transform((value) => ({ [propertyKey]: value }) as any),
      }),
    );

export interface OmitStructFields<
  TFields extends Schema.Struct.Fields,
  TKeys extends ReadonlyArray<keyof TFields>,
>
  extends Struct.Lambda {
  <TFields extends Schema.Struct.Fields>(
    struct: Schema.Struct<TFields>,
  ): Schema.Struct<Struct.Simplify<Omit<TFields, TKeys[number]>>>;
  readonly "~lambda.out": this["~lambda.in"] extends Schema.Struct<Schema.Struct.Fields>
    ? Schema.Struct<Struct.Simplify<Omit<this["~lambda.in"]["fields"], TKeys[number]>>>
    : never;
}

export const omitStructFields = <
  const TFields extends Schema.Struct.Fields,
  const TKeys extends ReadonlyArray<keyof TFields>,
>(
  keys: TKeys,
) =>
  Struct.lambda<OmitStructFields<TFields, TKeys>>((struct) => struct.mapFields(Struct.omit(keys)));

export interface OptionalStructFields extends Struct.Lambda {
  <TFields extends Schema.Struct.Fields>(
    struct: Schema.Struct<TFields>,
  ): Schema.Struct<
    Struct.Simplify<{
      [TKey in keyof TFields]: Schema.optional<TFields[TKey]>;
    }>
  >;
  readonly "~lambda.out": this["~lambda.in"] extends Schema.Struct<Schema.Struct.Fields>
    ? Schema.Struct<
        Struct.Simplify<{
          [TKey in keyof this["~lambda.in"]["fields"]]: Schema.optional<
            this["~lambda.in"]["fields"][TKey]
          >;
        }>
      >
    : never;
}

export const optionalStructFields = Struct.lambda<OptionalStructFields>((struct) =>
  struct.mapFields(Struct.map(Schema.optional)),
);

export const orDieWhenUnrespondable = <TSuccess, TError, TServices>(
  self: Effect.Effect<TSuccess, TError, TServices>,
) =>
  self.pipe(
    Effect.catchFilter(
      Filter.make((error) =>
        HttpServerRespondable.isRespondable(error)
          ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            Result.fail(error as TError extends HttpServerRespondable.Respondable ? TError : never)
          : Result.succeed(error),
      ),
      Effect.die,
    ),
  );

export type Prettify<TObject extends object> = {
  [TKey in keyof TObject]: TObject[TKey];
} & {};

export type StartsWith<
  TPrefix extends string,
  TValue extends string,
> = TValue extends `${TPrefix}${string}` ? TValue : never;

export type EndsWith<
  TSuffix extends string,
  TValue extends string,
> = TValue extends `${string}${TSuffix}` ? TValue : never;

export type Discriminate<
  TEntity,
  TKey extends keyof TEntity,
  TValue extends TEntity[TKey],
> = Prettify<Omit<TEntity, TKey> & Record<TKey, TValue>>;

export interface SchemaAndValue<TSchema extends Schema.Top> {
  schema: TSchema;
  value: TSchema["Type"];
}

// oxlint-disable-next-line typescript/no-explicit-any
export type DistributivePick<T, K extends keyof T> = T extends any ? Pick<T, K> : never;

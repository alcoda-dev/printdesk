import * as Array from "effect/Array";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as String from "effect/String";

import { RealtimeEventHandlers } from "../handlers/realtime-events";
import { TenantId } from "../utils";

export namespace RealtimeContract {
  export const EventHandler = RealtimeEventHandlers.registry.Schema;
  export type EventHandler = typeof EventHandler.Type;

  export const Channel = EventHandler.mapMembers(
    Array.map((member) =>
      Schema.TemplateLiteral([Schema.Literal("/"), TenantId, member.fields.name]),
    ),
  );
  export type Channel = typeof Channel.Type;

  export const Authorization = Schema.Record(Schema.String, Schema.String);
  export type Authorization = typeof Authorization.Type;

  export const SubscriptionId = Schema.String.pipe(
    Schema.check(Schema.isUUID()),
    Schema.brand("SubscriptionId"),
  );
  export type SubscriptionId = typeof SubscriptionId.Type;

  const success = <TKind extends string>(kind: TKind) =>
    Schema.Struct({ type: Schema.tag(`${kind}_success`), id: SubscriptionId });

  const error = <TKind extends string>(kind: TKind) =>
    Schema.Struct({
      type: Schema.tag(`${kind}_error`),
      id: SubscriptionId,
      errors: Schema.Struct({
        errorType: Schema.String,
        message: Schema.String,
      }).pipe(Schema.Array),
    });

  export class ConnectionInit extends Schema.Class<
    ConnectionInit,
    { readonly brand: unique symbol }
  >("ConnectionInit")({ type: Schema.tag("connection_init") }) {}

  export const ConnectionAck = Schema.Struct({
    type: Schema.tag("connection_ack"),
    connectionTimeout: Schema.DurationFromMillis,
  }).pipe(Schema.encodeKeys({ connectionTimeout: "connectionTimeoutMs" }));
  export type ConnectionAck = typeof ConnectionAck.Type;

  export class Subscribe extends Schema.Class<Subscribe, { readonly brand: unique symbol }>(
    "Subscribe",
  )({
    type: Schema.tag("subscribe"),
    id: SubscriptionId,
    channel: Channel,
    authorization: Authorization,
  }) {}

  export const SubscribeSuccess = success("subscribe");
  export type SubscribeSuccess = typeof SubscribeSuccess.Type;

  export const SubscribeError = error("subscribe");
  export type SubscribeError = typeof SubscribeError.Type;

  export class Data extends Schema.Class<Data, { readonly brand: unique symbol }>("Data")({
    type: Schema.tag("data"),
    id: SubscriptionId,
    event: Schema.Unknown.pipe(Schema.fromJsonString),
  }) {}

  export const BroadcastError = error("broadcast");
  export type BroadcastError = typeof BroadcastError.Type;

  export class KeepAlive extends Schema.Class<KeepAlive, { readonly brand: unique symbol }>(
    "KeepAlive",
  )({ type: Schema.tag("ka") }) {}

  export class Unsubscribe extends Schema.Class<Unsubscribe, { readonly brand: unique symbol }>(
    "Unsubscribe",
  )({ type: Schema.tag("unsubscribe"), id: SubscriptionId }) {}

  export const UnsubscribeSuccess = success("unsubscribe");
  export type UnsubscribeSuccess = typeof UnsubscribeSuccess.Type;

  export const UnsubscribeError = error("unsubscribe");
  export type UnsubscribeError = typeof UnsubscribeError.Type;

  export const Message = Schema.Union([
    ConnectionAck,
    SubscribeSuccess,
    SubscribeError,
    Data,
    BroadcastError,
    KeepAlive,
    UnsubscribeSuccess,
    UnsubscribeError,
  ]).pipe(Schema.fromJsonString);
  export type Message = typeof Message.Type;

  export const AuthorizationPayload = Schema.Struct({ channel: Channel }).pipe(Schema.optional);
  export type AuthorizationPayload = typeof AuthorizationPayload.Type;

  export const AuthorizationSuccess = Authorization.pipe(HttpApiSchema.status(200));

  const headerPrefix = "header-";
  export const WebSocketAuthorizationProtocol = Authorization.pipe(
    Schema.fromJsonString,
    Schema.encode(SchemaTransformation.stringFromBase64UrlString),
    Schema.encodeTo(Schema.TemplateLiteral([headerPrefix, Schema.NonEmptyString]), {
      encode: SchemaGetter.transform((base64Url) => `${headerPrefix}${base64Url}` as const),
      decode: SchemaGetter.transform(String.replace(headerPrefix, "")),
    }),
  );

  export class PublishPayload extends Schema.Class<
    PublishPayload,
    { readonly brand: unique symbol }
  >("PublishPayload")({
    channel: Channel,
    events: EventHandler.mapMembers(Array.map((member) => member.fields.input)).pipe(Schema.Array),
  }) {}
}

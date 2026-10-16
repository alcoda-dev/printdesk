import * as Effect from "effect/Effect";
import * as NetAddress from "effect/net/NetAddress";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";

import { EntityId, Separator, ShortId, TenantId } from "../utils";
import { Constants } from "../utils/constants";

export namespace AttributesContract {
  export const Callback = Schema.Literal(Constants.KEY_LITERALS.CALLBACK);
  export const Client = Schema.Literal(Constants.KEY_LITERALS.CLIENT);
  export const Deployment = Schema.Literal(Constants.KEY_LITERALS.DEPLOYMENT);
  export const Infra = Schema.Literal(Constants.KEY_LITERALS.INFRA);
  export const Input = Schema.Literal(Constants.KEY_LITERALS.INPUT);
  export const Ip = Schema.Literal(Constants.KEY_LITERALS.IP);
  export const Order = Schema.Literal(Constants.KEY_LITERALS.ORDER);
  export const Output = Schema.Literal(Constants.KEY_LITERALS.OUTPUT);
  export const PapercutMfApi = Schema.Literal(Constants.KEY_LITERALS.PAPERCUT_MF_API);
  export const Room = Schema.Literal(Constants.KEY_LITERALS.ROOM);
  export const Service = Schema.Literal(Constants.KEY_LITERALS.SERVICE);
  export const Tenant = Schema.Literal(Constants.KEY_LITERALS.TENANT);
  export const User = Schema.Literal(Constants.KEY_LITERALS.USER);

  export const InfraInput = Schema.TemplateLiteralParser([Infra, Separator, Input]).pipe(
    Schema.withConstructorDefault(
      Effect.succeed([Infra.literal, Separator.literal, Input.literal]),
    ),
  );
  export const InfraOutput = Schema.TemplateLiteralParser([Infra, Separator, Output]).pipe(
    Schema.withConstructorDefault(
      Effect.succeed([Infra.literal, Separator.literal, Output.literal]),
    ),
  );

  export class ServiceIp extends Schema.Class<ServiceIp>("ServiceIp")({
    service: Schema.String,
    ip: Schema.IpAddress,
  }) {}
  export const ServiceIpFromString = Schema.TemplateLiteralParser([
    Service,
    Separator,
    Schema.String,
    Separator,
    Ip,
    Separator,
    Schema.String,
  ]).pipe(
    Schema.decodeTo(ServiceIp, {
      decode: SchemaGetter.transformEffect(([, , service, , , , ip]) =>
        NetAddress.ipFromString(ip).pipe(
          Effect.fromResult,
          Effect.mapError((e) => new SchemaIssue.InvalidValue({ message: e.message })),
          Effect.map((ip) => ({ service, ip })),
        ),
      ),
      encode: SchemaGetter.transform(({ service, ip }) => [
        Service.literal,
        Separator.literal,
        service,
        Separator.literal,
        Ip.literal,
        Separator.literal,
        NetAddress.formatIp(ip),
      ]),
    }),
  );

  export const OrderShortIdFromString = Schema.TemplateLiteralParser([
    Order,
    Separator,
    ShortId,
  ]).pipe(
    Schema.decodeTo(ShortId, {
      decode: SchemaGetter.transform(([, , shortId]) => Number(shortId)),
      encode: SchemaGetter.transform((shortId) => [
        Order.literal,
        Separator.literal,
        ShortId.make(shortId),
      ]),
    }),
  );

  export const PapercutMfApiCallback = Schema.TemplateLiteralParser([
    PapercutMfApi,
    Separator,
    Callback,
  ]).pipe(
    Schema.withConstructorDefault(
      Effect.succeed([PapercutMfApi.literal, Separator.literal, Callback.literal]),
    ),
  );

  export const TenantIdFromString = Schema.TemplateLiteralParser([
    Tenant,
    Separator,
    TenantId,
  ]).pipe(
    Schema.decodeTo(TenantId, {
      decode: SchemaGetter.transform(([, , tenantId]) => String(tenantId)),
      encode: SchemaGetter.transform((tenantId) => [
        Tenant.literal,
        Separator.literal,
        TenantId.make(tenantId),
      ]),
    }),
  );

  export class ServiceTenantClientId extends Schema.Class<ServiceTenantClientId>("TenantClientId")({
    service: Schema.String,
    tenantId: TenantId,
    clientId: EntityId,
  }) {}
  export const ServiceTenantClientIdFromString = Schema.TemplateLiteralParser([
    Service,
    Separator,
    Schema.String,
    Separator,
    Tenant,
    Separator,
    TenantId,
    Separator,
    Client,
    Separator,
    EntityId,
  ]).pipe(
    Schema.decodeTo(ServiceTenantClientId, {
      decode: SchemaGetter.transform(([, , service, , , , tenantId, , , , clientId]) => ({
        service,
        tenantId,
        clientId,
      })),
      encode: SchemaGetter.transform(({ service, tenantId, clientId }) => [
        Service.literal,
        Separator.literal,
        service,
        Separator.literal,
        Tenant.literal,
        Separator.literal,
        TenantId.make(tenantId),
        Separator.literal,
        Client.literal,
        Separator.literal,
        EntityId.make(clientId),
      ]),
    }),
  );

  export class TenantDeploymentId extends Schema.Class<TenantDeploymentId>("TenantDeploymentId")({
    tenantId: TenantId,
    deploymentId: EntityId,
  }) {}
  export const TenantDeploymentIdFromString = Schema.TemplateLiteralParser([
    Tenant,
    Separator,
    TenantId,
    Separator,
    Deployment,
    Separator,
    EntityId,
  ]).pipe(
    Schema.decodeTo(TenantDeploymentId, {
      decode: SchemaGetter.transform(([, , tenantId, , , , deploymentId]) => ({
        tenantId,
        deploymentId,
      })),
      encode: SchemaGetter.transform(({ tenantId, deploymentId }) => [
        Tenant.literal,
        Separator.literal,
        TenantId.make(tenantId),
        Separator.literal,
        Deployment.literal,
        Separator.literal,
        EntityId.make(deploymentId),
      ]),
    }),
  );

  export class TenantRoomId extends Schema.Class<TenantRoomId>("TenantIdRoomId")({
    tenantId: TenantId,
    roomId: EntityId,
  }) {}
  export const TenantRoomIdFromString = Schema.TemplateLiteralParser([
    Tenant,
    Separator,
    TenantId,
    Separator,
    Room,
    Separator,
    EntityId,
  ]).pipe(
    Schema.decodeTo(TenantRoomId, {
      decode: SchemaGetter.transform(([, , tenantId, , , , roomId]) => ({ tenantId, roomId })),
      encode: SchemaGetter.transform(({ tenantId, roomId }) => [
        Tenant.literal,
        Separator.literal,
        TenantId.make(tenantId),
        Separator.literal,
        Room.literal,
        Separator.literal,
        EntityId.make(roomId),
      ]),
    }),
  );

  export class ServiceTenantUserId extends Schema.Class<ServiceTenantUserId>("TenantUserId")({
    service: Schema.String,
    tenantId: TenantId,
    userId: EntityId,
  }) {}
  export const ServiceTenantUserIdFromString = Schema.TemplateLiteralParser([
    Service,
    Separator,
    Schema.String,
    Separator,
    Tenant,
    Separator,
    TenantId,
    Separator,
    User,
    Separator,
    EntityId,
  ]).pipe(
    Schema.decodeTo(ServiceTenantUserId, {
      decode: SchemaGetter.transform(([, , service, , , , tenantId, , , , userId]) => ({
        service,
        tenantId,
        userId,
      })),
      encode: SchemaGetter.transform(({ service, tenantId, userId }) => [
        Service.literal,
        Separator.literal,
        service,
        Separator.literal,
        Tenant.literal,
        Separator.literal,
        TenantId.make(tenantId),
        Separator.literal,
        User.literal,
        Separator.literal,
        EntityId.make(userId),
      ]),
    }),
  );
}

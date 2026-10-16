import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";

import { AttributesContract } from "../attributes/contract";
import { AwsCron } from "../aws/cron";
import { CloudflareContract } from "../cloudflare/contract";
import { Handler } from "../handlers";
import { CallbackId, Ipv4, NonEmptyString } from "../utils";
import { Constants } from "../utils/constants";

export namespace PapercutMfContract {
  export class ApiHostNameConfig extends Schema.TaggedClass<ApiHostNameConfig>()(
    "PapercutMfApiHostNameConfig",
    {
      name: NonEmptyString,
      resolverIps: Ipv4.pipe(
        Schema.Array,
        Schema.withDecodingDefaultType(Effect.sync(Array.empty<Schema.Schema.Type<typeof Ipv4>>)),
      ),
    },
  ) {}

  export class ApiHostIpv4Config extends Schema.TaggedClass<ApiHostIpv4Config>()(
    "PapercutMfApiHostIpv4Config",
    { ipv4: Ipv4 },
  ) {}

  export class ApiConfig extends Schema.Class<ApiConfig>("ApiConfig")({
    protocol: Schema.Literals(["http", "https"]),
    host: Schema.Union([ApiHostNameConfig, ApiHostIpv4Config]).pipe(Schema.toTaggedUnion("_tag")),
    port: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0), Schema.isLessThan(2 ** 16))),
  }) {}

  export class SyncConfig extends Schema.Class<SyncConfig>("SyncConfig")({
    cronExpression: AwsCron.Expression.pipe(
      Schema.withConstructorDefault(
        Effect.succeed(Constants.DEFAULT_PAPERCUT_MF_SYNC_CRON_EXPRESSION),
      ),
    ),
    timezone: Schema.TimeZoneNamedFromString,
  }) {}

  export class EnabledConfig extends Schema.Class<EnabledConfig>("EnabledConfig")({
    enabled: Schema.Literal(true).pipe(Schema.withConstructorDefault(Effect.succeed(true))),
    api: ApiConfig,
    sync: SyncConfig,
  }) {}

  export class DisabledConfig extends Schema.Class<DisabledConfig>("DisabledConfig")({
    enabled: Schema.Literal(false).pipe(Schema.withConstructorDefault(Effect.succeed(false))),
  }) {}

  export const Config = Schema.Union([EnabledConfig, DisabledConfig]);
  export type Config = typeof Config.Type;

  export const ApiAuthToken = NonEmptyString.pipe(
    Schema.brand("PapercutMfApiAuthToken"),
    Schema.Redacted,
  );
  export type ApiAuthToken = typeof ApiAuthToken.Type;

  export class ApiCallback extends Schema.Class<ApiCallback>("ApiCallback")({
    [Constants.DYNAMO_KEYS.PK]: AttributesContract.TenantIdFromString,
    [Constants.DYNAMO_KEYS.SK]: AttributesContract.PapercutMfApiCallback,
    id: CallbackId,
  }) {}

  export const apiTunnel = new Handler.Handler({
    name: "/papercut/mf/api-tunnel",
    Input: Schema.Struct({ id: CloudflareContract.TunnelId }),
    Output: Schema.Void,
  });

  export class SharedAccountBalanceAdjustmentFailure
    extends Schema.TaggedError<SharedAccountBalanceAdjustmentFailure>()(
      "SharedAccountBalanceAdjustmentFailure",
      {},
      { httpApiStatus: 502 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(SharedAccountBalanceAdjustmentFailure)(this, { status: 502 });
  }

  export class UserAndGroupSyncFailure
    extends Schema.TaggedError<UserAndGroupSyncFailure>()(
      "UserAndGroupSyncFailure",
      {},
      { httpApiStatus: 502 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(UserAndGroupSyncFailure)(this, { status: 502 });
  }

  export class HealthSuccess extends Schema.Class<HealthSuccess>("HealthSuccess")({
    healthy: Schema.Boolean,
  }) {}

  export class TaskStatusSuccess extends Schema.Class<TaskStatusSuccess>("TaskStatusSuccess")({
    completed: Schema.Boolean,
    message: Schema.String,
  }) {}
}

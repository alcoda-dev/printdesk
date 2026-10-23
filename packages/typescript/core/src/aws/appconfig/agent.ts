import * as Cache from "effect/Cache";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FiberMap from "effect/FiberMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Struct from "effect/Struct";
import * as SynchronizedRef from "effect/SynchronizedRef";

import { Appconfig } from ".";
import { Actor } from "../../actors";
import { TenantId } from "../../utils";
import { Constants } from "../../utils/constants";

class SessionKey extends Schema.Class<SessionKey, { readonly brand: unique symbol }>("SessionKey")({
  tenantId: TenantId,
  profileId: Schema.String,
}) {}

const Session = Schema.Struct({
  configuration: Schema.Uint8Array,
  token: Schema.String.pipe(Schema.RedactedFromValue),
  interval: Schema.Finite.pipe(
    Schema.decodeTo(
      Schema.Duration,
      SchemaTransformation.transform({ decode: Duration.seconds, encode: Duration.toSeconds }),
    ),
    Schema.check(
      Schema.makeFilter(
        Duration.isGreaterThanOrEqualTo(
          Duration.fromInputUnsafe(Constants.APPCONFIG_MINIMUM_POLL_INTERVAL_DURATION),
        ),
      ),
    ),
  ),
}).pipe(
  Schema.encodeKeys({
    configuration: "Configuration",
    token: "NextPollConfigurationToken",
    interval: "NextPollIntervalInSeconds",
  }),
);

export class AppconfigAgent extends Context.Service<AppconfigAgent>()(
  "@printdesk/core/aws/AppconfigAgent",
  {
    make: Effect.gen(function* () {
      const appconfig = yield* Appconfig;

      const sessions = yield* Cache.make({
        capacity: 128,
        lookup: (key: SessionKey) =>
          appconfig.startSession(key.profileId).pipe(
            Effect.map(Struct.get("InitialConfigurationToken")),
            Effect.map(Redacted.make),
            Effect.flatMap(appconfig.getLatest),
            Effect.flatMap(Schema.decodeEffect(Session)),
            Effect.flatMap(SynchronizedRef.make),
            Effect.catchTag("ResourceNotFoundException", () => new Cause.NoSuchElementError()),
          ),
        requireServicesAt: "lookup",
        timeToLive: Duration.infinity,
      });

      const pollers = yield* FiberMap.make<SessionKey, void, never>();

      const textDecoder = new globalThis.TextDecoder();

      const getConfiguration = Effect.fn("AppconfigAgent.getConfiguration")(function* <
        TType,
        TServices,
      >(profileId: string, Decoder: Schema.ConstraintDecoder<TType, TServices>) {
        const key = yield* Actor.tenantId.pipe(
          Effect.map((tenantId) => new SessionKey({ tenantId, profileId })),
        );

        const ref = yield* sessions.pipe(
          Cache.get(key),
          Effect.tapCause(() =>
            sessions.pipe(
              Cache.invalidate(key),
              Effect.andThen(pollers.pipe(FiberMap.remove(key))),
            ),
          ),
        );

        return yield* ref.pipe(
          SynchronizedRef.get,
          Effect.tap((session) =>
            session.interval.pipe(
              Effect.sleep,
              Effect.tap(() =>
                sessions.pipe(
                  Cache.getSuccess(key),
                  Effect.map(Option.filter((current) => current === ref)),
                  Effect.map(Option.map(() => ref.pipe(SynchronizedRef.get))),
                  Effect.flatMap(Option.getOrElse(() => Effect.interrupt)),
                  Effect.map(Struct.get("token")),
                  Effect.flatMap(appconfig.getLatest),
                  Effect.flatMap(Schema.decodeEffect(Session)),
                  Effect.flatMap((session) =>
                    ref.pipe(
                      SynchronizedRef.update((prev) =>
                        Struct.evolve(session, {
                          configuration: (configuration) =>
                            configuration.byteLength > 0 ? configuration : prev.configuration,
                        }),
                      ),
                    ),
                  ),
                  Effect.tapErrorTag(["BadRequestException", "ResourceNotFoundException"], () =>
                    sessions.pipe(Cache.invalidate(key)),
                  ),
                  Effect.repeat(
                    Schedule.forever.pipe(
                      Schedule.modifyDelay(() =>
                        ref.pipe(SynchronizedRef.get, Effect.map(Struct.get("interval"))),
                      ),
                    ),
                  ),
                ),
              ),
              Effect.ignore({ log: true }),
              FiberMap.run(pollers, key, { onlyIfMissing: true }),
            ),
          ),
          Effect.map(Struct.get("configuration")),
          Effect.flatMap((configuration) => Effect.sync(() => textDecoder.decode(configuration))),
          Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Decoder))),
        );
      });

      return {
        getConfiguration,
      } as const;
    }),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

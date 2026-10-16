import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { ActorsContract } from "../actors/contract";
import { IdentityProvidersContract } from "../identity/contract";
import { UsersContract } from "../users/contract";
import { NonEmptyString, TenantId } from "../utils";

export namespace AssetsContract {
  export class PresignedUrlPayload extends Schema.Class<PresignedUrlPayload>("PresignedUrlPayload")(
    {
      expiresIn: Schema.DurationFromMillis.pipe(
        Schema.withConstructorDefault(Effect.succeed(Duration.hours(1))),
      ),
    },
  ) {}

  export class PresignedUrlSuccess extends Schema.Class<PresignedUrlSuccess>("PresignedUrlSuccess")(
    { url: Schema.URL, expiresAt: Schema.DateTimeUtc },
    { httpApiStatus: 200 },
  ) {}

  export const UserParams = ActorsContract.UserActor.mapFields(
    Struct.omit(["_tag", "tenantId"]),
  ).pipe(Schema.encodeKeys({ id: "__user_id", role: "__user_role" }));

  export const Props = ActorsContract.UserActor.mapFields(Struct.pick(["tenantId"]));

  export class InvalidPropsError
    extends Schema.TaggedError<InvalidPropsError>()("InvalidPropsError", { cause: Schema.Defect() })
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(InvalidPropsError)(this, { status: 400 });
  }

  export const InvalidationNotificationQueueMessage = Schema.Struct({
    _tag: Schema.tagDefaultOmit("InvalidationNotificationQueueMessage"),
    account: NonEmptyString,
    action: Schema.Literal("PutObject"),
    bucket: NonEmptyString,
    object: Schema.Struct({
      key: NonEmptyString,
      size: Schema.ByteSizeFromNumber,
      eTag: Schema.String,
    }),
    eventTime: Schema.DateTimeUtcFromString,
  });

  export class UserAvatarQueueMessage extends Schema.TaggedClass<UserAvatarQueueMessage>()(
    "UserAvatarQueueMessage",
    {
      tenantId: TenantId,
      identityProvider: IdentityProvidersContract.Table.Model.mapFields(
        Struct.pick(["externalId", "kind"]),
      ),
      user: UsersContract.Table.Model.mapFields(Struct.pick(["id", "externalId"])).mapFields(
        Struct.evolve({ id: (id) => id.from.schema.members[0] }),
      ),
    },
  ) {}

  export const QueueMessage = Schema.Union([
    InvalidationNotificationQueueMessage,
    UserAvatarQueueMessage,
  ]);
}

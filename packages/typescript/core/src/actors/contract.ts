import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Match from "effect/Match";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { ClientsContract } from "../clients/contract";
import { UsersContract } from "../users/contract";
import { EntityId, TenantId } from "../utils";

export namespace ActorsContract {
  export interface Wrappable {
    get wrap(): Actor;
  }

  export class PublicActor
    extends Schema.TaggedClass<PublicActor>()("PublicActor", {})
    implements Wrappable
  {
    public static readonly tag = this.fields._tag.schema.literal;

    public static readonly singleton = new this();

    public get wrap(): Actor {
      return new Actor({ properties: this });
    }
  }

  export class ClientActor
    extends Schema.TaggedClass<ClientActor>()("ClientActor", {
      id: EntityId,
      tenantId: TenantId,
      role: ClientsContract.Role,
      identityProviderId: EntityId.pipe(Schema.NullOr),
    })
    implements Wrappable
  {
    public static readonly tag = this.fields._tag.schema.literal;

    public get wrap(): Actor {
      return new Actor({ properties: this });
    }
  }

  export class UserActor
    extends Schema.TaggedClass<UserActor>()("UserActor", {
      id: EntityId,
      tenantId: TenantId,
      role: UsersContract.Role,
    })
    implements Wrappable
  {
    public static readonly tag = this.fields._tag.schema.literal;

    public get wrap(): Actor {
      return new Actor({ properties: this });
    }
  }

  export class TenantActor
    extends Schema.TaggedClass<TenantActor>()("TenantActor", { id: TenantId })
    implements Wrappable
  {
    public static readonly tag = this.fields._tag.schema.literal;

    public get wrap(): Actor {
      return new Actor({ properties: this });
    }
  }

  export class Actor extends Schema.TaggedClass<Actor>()("Actor", {
    properties: Schema.Union([PublicActor, ClientActor, UserActor, TenantActor]),
  }) {
    #assert = <TActorTag extends Actor["properties"]["_tag"]>(actorTag: TActorTag) =>
      Effect.suspend(() => {
        if (this.properties._tag !== actorTag)
          return Effect.fail(new ForbiddenActorError({ actor: this.properties._tag }));

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return Effect.succeed(this.properties as Extract<Actor["properties"], { _tag: TActorTag }>);
      });

    public get assertPublic() {
      return this.#assert(PublicActor.tag);
    }
    public get assertClient() {
      return this.#assert(ClientActor.tag);
    }
    public get assertUser() {
      return this.#assert(UserActor.tag);
    }
    public get assertTenant() {
      return this.#assert(TenantActor.tag);
    }

    public get assertPrivate() {
      return Match.value(this.properties).pipe(
        Match.tag(PublicActor.tag, (actor) =>
          Effect.fail(new ForbiddenActorError({ actor: actor._tag })),
        ),
        Match.orElse((actor) => Effect.succeed(actor)),
      );
    }

    public get tenantId() {
      return this.assertPrivate.pipe(
        Effect.map(Match.value),
        Effect.map(Match.tag(TenantActor.tag, (tenant) => tenant.id)),
        Effect.map(Match.orElse((actor) => actor.tenantId)),
      );
    }

    public get identityProviderId() {
      return this.assertClient.pipe(
        Effect.map(Struct.get("identityProviderId")),
        Effect.filterOrFail(Predicate.isNotNull),
      );
    }
  }

  export class ForbiddenActorError
    extends Schema.TaggedError<ForbiddenActorError>()(
      "ForbiddenActorError",
      {
        actor: Schema.Literals(
          Array.map(Actor.fields.properties.members, (member) => member.fields._tag.schema.literal),
        ),
      },
      { httpApiStatus: 403 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(ForbiddenActorError)(this, { status: 403 });
  }
}

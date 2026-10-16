import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Struct from "effect/Struct";

import { Actor } from "../actors";
import { ActorsContract } from "../actors/contract";
import { Permissions } from "../permissions";

import type { NonEmptyReadonlyArray } from "effect/Array";
import type { ReadonlyRecord } from "effect/Record";
import type { ClientsContract } from "../clients/contract";
import type { UsersContract } from "../users/contract";

export namespace AccessControl {
  export type UserRoleAcl = ReadonlyRecord<
    UsersContract.Role,
    HashSet.HashSet<Permissions.Permission>
  >;

  export const userRoleAcls = Effect.sync(
    () =>
      ({
        administrator: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "announcements:create",
          "announcements:read",
          "announcements:update",
          "announcements:delete",
          "cloudflare_tunnel_tokens:read",
          "comments:create",
          "comments:read",
          "comments:update",
          "comments:delete",
          "config:update",
          "delivery_options:create",
          "delivery_options:read",
          "delivery_options:update",
          "delivery_options:delete",
          "groups:read",
          "group_memberships:read",
          "identity_providers:create",
          "identity_providers:read",
          "identity_providers:delete",
          "invoices:create",
          "invoices:read",
          "images:create",
          "images:read",
          "images:delete",
          "licenses:read",
          "orders:create",
          "orders:read",
          "orders:update",
          "orders:delete",
          "order_object_metadata:create",
          "order_object_metadata:read",
          "order_object_metadata:update",
          "order_object_metadata:delete",
          "order_objects:create",
          "order_objects:read",
          "papercut_mf_api_gateway:read",
          "papercut_mf_sync:create",
          "products:create",
          "products:read",
          "products:update",
          "products:delete",
          "rooms:create",
          "rooms:update",
          "rooms:read",
          "rooms:delete",
          "shared_accounts:read",
          "shared_accounts:update",
          "shared_accounts:delete",
          "shared_account_customer_access:read",
          "shared_account_manager_access:create",
          "shared_account_manager_access:read",
          "shared_account_group_customer_access:read",
          "shared_account_manager_access:delete",
          "tenants:read",
          "tenants:update",
          "users:read",
          "users:update",
          "room_workflows:read",
          "shared_account_workflows:read",
          "workflow_statuses:create",
          "workflow_statuses:read",
          "workflow_statuses:update",
          "workflow_statuses:delete",
        ),
        operator: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "announcements:create",
          "active_announcements:read",
          "announcements:update",
          "announcements:delete",
          "comments:create",
          "active_comments:read",
          "delivery_options:create",
          "active_delivery_options:read",
          "delivery_options:update",
          "delivery_options:delete",
          "active_groups:read",
          "active_group_memberships:read",
          "active_invoices:read",
          "images:create",
          "images:read",
          "images:delete",
          "orders:create",
          "active_orders:read",
          "orders:update",
          "orders:delete",
          "order_object_metadata:create",
          "active_order_object_metadata:read",
          "order_object_metadata:update",
          "order_object_metadata:delete",
          "order_objects:create",
          "order_objects:read",
          "products:create",
          "active_products:read",
          "products:update",
          "products:delete",
          "active_rooms:read",
          "rooms:update",
          "active_shared_accounts:read",
          "shared_accounts:update",
          "active_shared_account_customer_access:read",
          "active_shared_account_group_customer_access:read",
          "active_shared_account_manager_access:read",
          "tenants:read",
          "active_users:read",
          "active_room_workflows:read",
          "active_shared_account_workflows:read",
          "active_workflow_statuses:read",
        ),
        manager: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "active_published_room_announcements:read",
          "active_customer_order_comments:read",
          "active_manager_authorized_shared_account_order_comments:read",
          "active_published_room_delivery_options:read",
          "active_groups:read",
          "active_customer_order_invoices:read",
          "active_manager_authorized_shared_account_order_invoices:read",
          "images:read",
          "active_customer_orders:read",
          "active_manager_authorized_shared_account_orders:read",
          "active_customer_order_object_metadata:read",
          "active_manager_authorized_shared_account_order_object_metadata:read",
          "active_published_products:read",
          "active_published_rooms:read",
          "active_manager_authorized_shared_accounts:read",
          "active_customer_authorized_shared_accounts:read",
          "active_authorized_shared_account_customer_access:read",
          "active_authorized_shared_account_group_customer_access:read",
          "active_authorized_shared_account_manager_access:read",
          "active_customer_authorized_shared_account_manager_access:read",
          "tenants:read",
          "active_users:read",
          "active_published_room_room_workflows:read",
          "active_customer_authorized_shared_account_workflows:read",
          "active_manager_authorized_shared_account_workflows:read",
          "active_published_room_workflow_statuses:read",
          "active_customer_authorized_shared_account_workflow_statuses:read",
          "active_manager_authorized_shared_account_workflow_statuses:read",
        ),
        customer: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "active_published_room_announcements:read",
          "active_customer_order_comments:read",
          "active_published_room_delivery_options:read",
          "active_membership_groups:read",
          "active_customer_order_invoices:read",
          "images:read",
          "active_customer_orders:read",
          "active_customer_order_object_metadata:read",
          "active_published_products:read",
          "active_published_rooms:read",
          "active_customer_authorized_shared_accounts:read",
          "active_authorized_shared_account_customer_access:read",
          "active_authorized_shared_account_group_customer_access:read",
          "active_customer_authorized_shared_account_manager_access:read",
          "tenants:read",
          "active_users:read",
          "active_published_room_room_workflows:read",
          "active_customer_authorized_shared_account_workflows:read",
          "active_published_room_workflow_statuses:read",
          "active_customer_authorized_shared_account_workflow_statuses:read",
        ),
      }) satisfies UserRoleAcl,
  );

  export type ClientRoleAcl = ReadonlyRecord<
    ClientsContract.Role,
    HashSet.HashSet<Permissions.Permission>
  >;

  export const clientRoleAcls = Effect.sync(
    () =>
      ({
        api: HashSet.make<ReadonlyArray<Permissions.Permission>>("papercut_mf_api_gateway:read"),
        bootstrap: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "groups:create",
          "groups:read",
          "groups:update",
          "groups:delete",
          "group_memberships:create",
          "group_memberships:read",
          "group_memberships:update",
          "group_memberships:delete",
          "users:create",
          "users:read",
          "users:update",
          "users:delete",
        ),
        invoicesProcessor: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "papercut_mf_api_gateway:read",
        ),
        papercutMfSync: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "papercut_mf_api_gateway:read",
          "papercut_mf_sync:create",
        ),
        scim: HashSet.make<ReadonlyArray<Permissions.Permission>>(
          "groups:create",
          "groups:read",
          "groups:update",
          "groups:delete",
          "group_memberships:create",
          "group_memberships:read",
          "group_memberships:update",
          "group_memberships:delete",
          "users:create",
          "users:read",
          "users:update",
          "users:delete",
        ),
      }) satisfies ClientRoleAcl,
  );

  interface ResourceString extends Schema.Bottom<
    Permissions.Resource | (string & {}),
    string,
    never,
    never,
    SchemaAST.String,
    ResourceString
    // oxlint-disable-next-line typescript/no-empty-object-type
  > {}

  export const ResourceString: ResourceString = Schema.String;

  export const Resource = Schema.Union([
    ResourceString,
    Schema.Struct({ name: ResourceString, id: Schema.String }),
  ]);
  export type Resource = typeof Resource.Type;

  export class AccessDeniedError
    extends Schema.TaggedError<AccessDeniedError>()(
      "AccessDeniedError",
      {
        actor: ActorsContract.Actor.fields.properties,
        resource: Resource,
        action: Permissions.Action.pipe(Schema.optional),
      },
      { httpApiStatus: 403 },
    )
    implements HttpServerRespondable.Respondable
  {
    public override get message() {
      const matchAction = Match.type<Permissions.Action | undefined>().pipe(
        Match.when(Match.undefined, () => "access"),
        Match.orElse((action) => `perform action "${action}" on`),
      );

      const matchResource = Match.type<Resource>().pipe(
        Match.when(Match.string, (resource) => `"${resource}"`),
        Match.orElse(({ name, id }) => `"${name}" (${id})`),
      );

      const matchActor = Match.typeTags<ActorsContract.Actor["properties"]>()({
        ClientActor: (client) =>
          `Client actor (${client.id}) is not authorized to ${matchAction(this.action)} resource ${matchResource(this.resource)}.`,
        PublicActor: () =>
          `Public actor is not authorized to ${matchAction(this.action)} resource ${matchResource(this.resource)}.`,
        UserActor: (user) =>
          `User actor (${user.id}) is not authorized to ${matchAction(this.action)} resource ${matchResource(this.resource)}.`,
        TenantActor: (tenant) =>
          `Tenant actor (${tenant.id}) is not authorized to ${matchAction(this.action)} resource ${matchResource(this.resource)}.`,
      });

      return matchActor(this.actor);
    }

    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(AccessDeniedError)(this, { status: 403 });
  }

  export type Policy<TError = never, TServices = never> = Effect.Effect<
    void,
    AccessDeniedError | ActorsContract.ForbiddenActorError | TError,
    TServices | Actor
  >;

  export type MakePolicy<TArgs extends Schema.Top, TError, TServices> = (
    args: TArgs["Type"],
  ) => Policy<
    Exclude<TError, AccessDeniedError | ActorsContract.ForbiddenActorError>,
    Exclude<TServices, Actor>
  >;

  export const enforce =
    <TPolicyError, TPolicyContext>(policy: Policy<TPolicyError, TPolicyContext>) =>
    <TSuccess, TError, TServices>(self: Effect.Effect<TSuccess, TError, TServices>) =>
      policy.pipe(Effect.andThen(self));

  export const some = <TError, TServices>(
    ...policies: NonEmptyReadonlyArray<Policy<TError, TServices>>
  ): Policy<TError, TServices> =>
    Effect.findFirstFilter(policies, (policy, index) =>
      policy.pipe(
        Effect.map(Result.succeed),
        Effect.catchTag("AccessDeniedError", (error) =>
          index < policies.length - 1 ? Effect.succeed(Result.fail(error)) : Effect.fail(error),
        ),
      ),
    ).pipe(Effect.map(Option.getOrThrow));

  export const every = <TError, TServices>(
    ...policies: NonEmptyReadonlyArray<Policy<TError, TServices>>
  ): Policy<TError, TServices> => Effect.all(policies, { concurrency: 1, discard: true });

  export const policy =
    (resource: Resource, action?: Permissions.Action) =>
    <TError, TServices>(
      predicate: Effect.Effect<boolean, TError, TServices>,
    ): Policy<TError, TServices> =>
      Actor.pipe(
        Effect.map(Struct.get("properties")),
        Effect.flatMap((actor) =>
          predicate.pipe(
            Effect.filterOrFail(
              Predicate.isTruthy,
              () => new AccessDeniedError({ actor, resource, action }),
            ),
          ),
        ),
        Effect.asVoid,
      );

  export const clientPolicy = <TError, TServices>(
    predicate: (client: ActorsContract.ClientActor) => Effect.Effect<boolean, TError, TServices>,
    resource: Resource,
    action?: Permissions.Action,
  ): Policy<TError, TServices> =>
    Actor.pipe(
      Effect.flatMap(Struct.get("assertClient")),
      Effect.flatMap((client) =>
        predicate(client).pipe(
          Effect.filterOrFail(
            Predicate.isTruthy,
            () => new AccessDeniedError({ actor: client, resource, action }),
          ),
        ),
      ),
      Effect.asVoid,
    );

  export const userPolicy = <TError, TServices>(
    predicate: (user: ActorsContract.UserActor) => Effect.Effect<boolean, TError, TServices>,
    resource: Resource,
    action?: Permissions.Action,
  ): Policy<TError, TServices> =>
    Actor.pipe(
      Effect.flatMap(Struct.get("assertUser")),
      Effect.flatMap((user) =>
        predicate(user).pipe(
          Effect.filterOrFail(
            Predicate.isTruthy,
            () => new AccessDeniedError({ actor: user, resource, action }),
          ),
        ),
      ),
      Effect.asVoid,
    );

  export const privateActorPolicy = <TError, TServices>(
    predicate: (
      privateActor: Exclude<
        ActorsContract.Actor["properties"],
        { _tag: typeof ActorsContract.PublicActor.tag }
      >,
    ) => Effect.Effect<boolean, TError, TServices>,
    resource: Resource,
    action?: Permissions.Action,
  ): Policy<TError, TServices> =>
    Actor.pipe(
      Effect.flatMap(Struct.get("assertPrivate")),
      Effect.flatMap((privateActor) =>
        predicate(privateActor).pipe(
          Effect.filterOrFail(
            Predicate.isTruthy,
            () => new AccessDeniedError({ actor: privateActor, resource, action }),
          ),
        ),
      ),
      Effect.asVoid,
    );

  export const userPermissionPolicy = (permission: Permissions.Permission) =>
    Effect.succeed(permission).pipe(
      Effect.flatMap(Schema.decodeEffect(Permissions.Permission)),
      Effect.orDie,
      Effect.flatMap(({ resource, action }) =>
        userPolicy(
          (user) =>
            userRoleAcls.pipe(
              Effect.map(Struct.get(user.role)),
              Effect.map(HashSet.has(permission)),
            ),
          resource,
          action,
        ),
      ),
    );

  export const clientPermissionPolicy = (permission: Permissions.Permission) =>
    Effect.succeed(permission).pipe(
      Effect.flatMap(Schema.decodeEffect(Permissions.Permission)),
      Effect.orDie,
      Effect.flatMap(({ resource, action }) =>
        clientPolicy(
          (client) =>
            clientRoleAcls.pipe(
              Effect.map(Struct.get(client.role)),
              Effect.map(HashSet.has(permission)),
            ),
          resource,
          action,
        ),
      ),
    );

  export const permissionPolicy = (permission: Permissions.Permission) =>
    Effect.succeed(permission).pipe(
      Effect.flatMap(Schema.decodeEffect(Permissions.Permission)),
      Effect.orDie,
      Effect.flatMap(({ resource, action }) =>
        privateActorPolicy(
          (privateActor) =>
            Match.valueTags(privateActor, {
              ClientActor: (client) => clientRoleAcls.pipe(Effect.map(Struct.get(client.role))),
              UserActor: (user) => userRoleAcls.pipe(Effect.map(Struct.get(user.role))),
              TenantActor: () => Effect.sync(HashSet.empty),
            }).pipe(Effect.map(HashSet.has(permission))),
          resource,
          action,
        ),
      ),
    );
}

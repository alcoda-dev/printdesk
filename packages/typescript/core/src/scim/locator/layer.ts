import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ScimLocator } from ".";
import { ApiUrlBuilder } from "../../api/url-builder";
import { ScimContract } from "../contract";

import type { EntityId } from "../../utils";

export interface ServiceShape {
  readonly root: Effect.Effect<URL>;
  readonly serviceProviderConfig: Effect.Effect<URL>;
  readonly resourceTypes: Effect.Effect<URL>;
  readonly resourceType: (
    name: Extract<ScimContract.V2ResourceTypeName, "User" | "Group">,
  ) => Effect.Effect<URL>;
  readonly schemas: Effect.Effect<URL>;
  readonly schema: (id: ScimContract.V2ResourceUri) => Effect.Effect<URL>;
  readonly groups: Effect.Effect<URL>;
  readonly group: (id: EntityId) => Effect.Effect<URL>;
  readonly users: Effect.Effect<URL>;
  readonly user: (id: EntityId) => Effect.Effect<URL>;
}

export const makeService = Effect.gen(function* () {
  const apiUrlBuilder = yield* ApiUrlBuilder;

  const root = Effect.sync(() => new URL(apiUrlBuilder.ScimV2Root.root())).pipe(
    Effect.withSpan("ScimLocator.root"),
  );

  const serviceProviderConfig = Effect.sync(
    () => new URL(apiUrlBuilder.ScimV2ServiceProviderConfig.discover()),
  ).pipe(Effect.withSpan("ScimLocator.serviceProviderConfig"));

  const resourceTypes = Effect.sync(
    () => new URL(apiUrlBuilder.ScimV2ResourceTypes.discover()),
  ).pipe(Effect.withSpan("ScimLocator.resourceTypes"));

  const resourceType = Effect.fn("ScimLocator.resourceType")(
    (name: Extract<ScimContract.V2ResourceTypeName, "User" | "Group">) =>
      Effect.succeed(new URL(apiUrlBuilder.ScimV2ResourceTypes.retrieve({ params: { name } }))),
  );

  const schemas = Effect.sync(() => new URL(apiUrlBuilder.ScimV2Schemas.discover())).pipe(
    Effect.withSpan("ScimLocator.schemas"),
  );

  const schema = Effect.fn("ScimLocator.schema")((id: ScimContract.V2ResourceUri) =>
    Effect.succeed(new URL(apiUrlBuilder.ScimV2Schemas.retrieve({ params: { id } }))),
  );

  const groups = Effect.sync(
    () => new URL(apiUrlBuilder.ScimV2Groups.query({ query: new ScimContract.V2QueryParams() })),
  ).pipe(Effect.withSpan("ScimLocator.groups"));

  const group = Effect.fn("ScimLocator.group")((id: EntityId) =>
    Effect.succeed(new URL(apiUrlBuilder.ScimV2Groups.retrieve({ params: { id } }))),
  );

  const users = Effect.sync(
    () => new URL(apiUrlBuilder.ScimV2Users.query({ query: new ScimContract.V2QueryParams() })),
  ).pipe(Effect.withSpan("ScimLocator.users"));

  const user = Effect.fn("ScimLocator.user")((id: EntityId) =>
    Effect.succeed(new URL(apiUrlBuilder.ScimV2Users.retrieve({ params: { id } }))),
  );

  return {
    root,
    serviceProviderConfig,
    resourceTypes,
    resourceType,
    schemas,
    schema,
    groups,
    group,
    users,
    user,
  } as const;
});

export const layer = makeService.pipe(Layer.effect(ScimLocator));

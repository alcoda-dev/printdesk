import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as ApiUrlBuilder from "@printdesk/core/api/url-builder/layer";
import * as GroupMembershipsRepositories from "@printdesk/core/groups/memberships/repositories/layers";
import * as GroupsRepositories from "@printdesk/core/groups/repositories/layers";
import * as Scim from "@printdesk/core/scim/layer";
import * as ScimLocator from "@printdesk/core/scim/locator/layer";
import { SstResource } from "@printdesk/core/sst/resource";
import * as UsersRepositories from "@printdesk/core/users/repositories/layers";
import * as Layer from "effect/Layer";

import { cloudflareClientLayer } from "./cloudflare";
import { databaseLayer } from "./database";

export const scimLocatorLayer = ScimLocator.layer.pipe(
  Layer.provide(ApiUrlBuilder.layer),
  Layer.provide(SstResource.layer),
);

export const scimLayer = Scim.layer.pipe(
  Layer.provide([
    cloudflareClientLayer,
    NodeCrypto.layerSecureRandom,
    scimLocatorLayer,
    GroupMembershipsRepositories.repositoryLayer,
    GroupsRepositories.repositoryLayer,
    UsersRepositories.repositoryLayer,
  ]),
  Layer.provide([databaseLayer, SstResource.layer]),
);

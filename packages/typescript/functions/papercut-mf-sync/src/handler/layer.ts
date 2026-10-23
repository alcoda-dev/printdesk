import { ActorLayerMap } from "@printdesk/core/actors";
import { Appconfig } from "@printdesk/core/aws/appconfig";
import { AppconfigAgent } from "@printdesk/core/aws/appconfig/agent";
import { AppconfigCredentialIdentityProviderLayerMap } from "@printdesk/core/aws/credential-identity/appconfig";
import { AppsyncPublisherCredentialIdentityProviderLayerMap } from "@printdesk/core/aws/credential-identity/appsync";
import { nodeCredentialIdentityProviderLayer } from "@printdesk/core/aws/credential-identity/node";
import * as DsqlSigner from "@printdesk/core/aws/dsql-signer/layer";
import { AppsyncSigner } from "@printdesk/core/aws/sigv4-signers/appsync";
import * as ClientsRepository from "@printdesk/core/clients/repository/layer";
import * as Config from "@printdesk/core/config/layer";
import { appconfigRoleLayer } from "@printdesk/core/config/role";
import { Database } from "@printdesk/core/database";
import { Drizzle } from "@printdesk/core/database/drizzle";
import * as PgClient from "@printdesk/core/database/pg-client";
import * as GroupMembershipsRepositories from "@printdesk/core/groups/memberships/repositories/layers";
import * as GroupsRepositories from "@printdesk/core/groups/repositories/layers";
import * as IdentityRepository from "@printdesk/core/identity/repository/layer";
import { Oauth } from "@printdesk/core/oauth";
import * as PapercutMfApi from "@printdesk/core/papercut-mf/api/layer";
import * as PapercutMfSynchronizer from "@printdesk/core/papercut-mf/synchronizer/layer";
import { Realtime } from "@printdesk/core/realtime";
import { appsyncPublisherRoleLayer } from "@printdesk/core/realtime/roles";
import * as ReplicacheNotifier from "@printdesk/core/replicache/notifier/layer";
import * as SharedAccountCustomerAccessRepositories from "@printdesk/core/shared-accounts/customer-access/repositories/layers";
import * as SharedAccountGroupCustomerAccessRepositories from "@printdesk/core/shared-accounts/group-customer-access/repositories/layers";
import * as SharedAccountsRepositories from "@printdesk/core/shared-accounts/repositories/layers";
import { SstResource } from "@printdesk/core/sst/resource";
import * as TenantsRepositories from "@printdesk/core/tenants/repositories/layers";
import * as UsersRepositories from "@printdesk/core/users/repositories/layers";
import { Xml } from "@printdesk/core/xml";
import { XmlRpc } from "@printdesk/core/xml/rpc";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";

import { openauthLayer } from "../lib/auth";

export const layer = Layer.mergeAll(
  Oauth.AccessTokenLayerMap.layer,
  ActorLayerMap.layer,
  AppconfigCredentialIdentityProviderLayerMap.layer,
  AppsyncPublisherCredentialIdentityProviderLayerMap.layer,
  ClientsRepository.layer,
  openauthLayer,
  PapercutMfSynchronizer.layer,
  ReplicacheNotifier.layer,
  TenantsRepositories.repositoryLayer,
).pipe(
  Layer.provide([
    appconfigRoleLayer,
    appsyncPublisherRoleLayer,
    GroupMembershipsRepositories.repositoryLayer,
    GroupsRepositories.repositoryLayer,
    IdentityRepository.providersRepositoryLayer,
    PapercutMfApi.layer,
    Realtime.layer,
    SharedAccountCustomerAccessRepositories.repositoryLayer,
    SharedAccountGroupCustomerAccessRepositories.repositoryLayer,
    SharedAccountsRepositories.repositoryLayer,
    UsersRepositories.repositoryLayer,
  ]),
  Layer.provideMerge(Config.layer),
  Layer.provide([AppconfigAgent.layer, AppsyncSigner.layer, XmlRpc.XmlRpc.layer]),
  Layer.provide([Appconfig.layer, Database.layer, Xml.layer]),
  Layer.provide([Drizzle.layerWithDrizzleServices, FetchHttpClient.layer]),
  Layer.provide(PgClient.layer),
  Layer.provide(DsqlSigner.layer({ expiresIn: Duration.minutes(15) })),
  Layer.provide(nodeCredentialIdentityProviderLayer),
  Layer.provideMerge(SstResource.layer),
  Layer.tapCause(Effect.logError),
);

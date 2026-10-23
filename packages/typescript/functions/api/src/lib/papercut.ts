import { Appconfig } from "@printdesk/core/aws/appconfig";
import { AppconfigAgent } from "@printdesk/core/aws/appconfig/agent";
import * as Config from "@printdesk/core/config/layer";
import * as GroupMembershipsRepositories from "@printdesk/core/groups/memberships/repositories/layers";
import * as GroupsRepositories from "@printdesk/core/groups/repositories/layers";
import * as IdentityRepository from "@printdesk/core/identity/repository/layer";
import * as PapercutMfApi from "@printdesk/core/papercut-mf/api/layer";
import * as PapercutMfSynchronizer from "@printdesk/core/papercut-mf/synchronizer/layer";
import * as SharedAccountCustomerAccessRepositories from "@printdesk/core/shared-accounts/customer-access/repositories/layers";
import * as SharedAccountCustomerGroupAccessRepositories from "@printdesk/core/shared-accounts/group-customer-access/repositories/layers";
import * as SharedAccountsRepositories from "@printdesk/core/shared-accounts/repositories/layers";
import { SstResource } from "@printdesk/core/sst/resource";
import * as SyncQueryBuilder from "@printdesk/core/sync/query-builder/layer";
import * as UsersRepositories from "@printdesk/core/users/repositories/layers";
import { Xml } from "@printdesk/core/xml";
import { XmlRpc } from "@printdesk/core/xml/rpc";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";

import { databaseLayer } from "./database";

export const papercutMfApiLayer = PapercutMfApi.layer.pipe(
  Layer.provide([Config.layer, XmlRpc.XmlRpc.layer]),
  Layer.provide([AppconfigAgent.layer, Xml.Builder.layer, Xml.Parser.layer]),
  Layer.provide([Appconfig.layer, FetchHttpClient.layer]),
  Layer.provide(SstResource.layer),
);

export const papercutMfSynchronizerLayer = PapercutMfSynchronizer.layer.pipe(
  Layer.provide([
    GroupMembershipsRepositories.repositoryLayer,
    GroupsRepositories.repositoryLayer,
    IdentityRepository.providersRepositoryLayer,
    SharedAccountCustomerAccessRepositories.repositoryLayer,
    SharedAccountCustomerGroupAccessRepositories.repositoryLayer,
    SharedAccountsRepositories.repositoryLayer,
    UsersRepositories.repositoryLayer,
    papercutMfApiLayer,
  ]),
  Layer.provide(SyncQueryBuilder.layer),
  Layer.provide(databaseLayer),
);

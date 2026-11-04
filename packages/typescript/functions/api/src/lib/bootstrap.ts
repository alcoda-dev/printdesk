import { Lambda } from "@effect-aws/client-lambda";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Bootstrap } from "@printdesk/core/bootstrap";
import * as ClientsRepository from "@printdesk/core/clients/repository/layer";
import { Hmac } from "@printdesk/core/crypto/hmac";
import * as LicensesManager from "@printdesk/core/licenses/manager/layer";
import * as LicensesRepository from "@printdesk/core/licenses/repository/layer";
import { SstResource } from "@printdesk/core/sst/resource";
import * as TenantsRepositories from "@printdesk/core/tenants/repositories/layers";
import * as Layer from "effect/Layer";

import { hmacSigningSecretLayer } from "./auth";
import { databaseLayer } from "./database";

export const bootstrapLayer = Bootstrap.layer.pipe(
  Layer.provide([Lambda.defaultLayer, LicensesManager.layer, SstResource.layer]),
  Layer.provide([ClientsRepository.layer, Hmac.layer]),
  Layer.provide([
    hmacSigningSecretLayer,
    LicensesRepository.layer,
    NodeCrypto.layerMac,
    NodeCrypto.layerSecureRandom,
    TenantsRepositories.repositoryLayer,
  ]),
  Layer.provide([databaseLayer, SstResource.layer]),
);

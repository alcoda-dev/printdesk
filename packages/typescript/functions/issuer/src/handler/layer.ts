import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { nodeCredentialIdentityProviderLayer } from "@printdesk/core/aws/credential-identity/node";
import * as DsqlSigner from "@printdesk/core/aws/dsql-signer/layer";
import * as ClientsRepository from "@printdesk/core/clients/repository/layer";
import { Database } from "@printdesk/core/database";
import { Drizzle } from "@printdesk/core/database/drizzle";
import * as PgClient from "@printdesk/core/database/pg-client";
import * as IdentityRepository from "@printdesk/core/identity/repository/layer";
import * as Oauth from "@printdesk/core/oauth/layer";
import { Hmac } from "@printdesk/core/src/crypto/hmac/index";
import { hmacSigningSecretLayer } from "@printdesk/core/src/crypto/hmac/layer";
import { SstResource } from "@printdesk/core/sst/resource";
import * as SyncQueryBuilder from "@printdesk/core/sync/query-builder/layer";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const layer = Oauth.layer.pipe(
  Layer.provide([ClientsRepository.layer, Hmac.layer, SyncQueryBuilder.layer]),
  Layer.provideMerge(IdentityRepository.providersRepositoryLayer),
  Layer.provide([
    Database.layer,
    hmacSigningSecretLayer,
    NodeCrypto.layerMac,
    NodeCrypto.layerSecureRandom,
  ]),
  Layer.provide(Drizzle.layerWithDrizzleServices),
  Layer.provide(PgClient.layer),
  Layer.provide(DsqlSigner.layer({ expiresIn: Duration.minutes(15) })),
  Layer.provide(nodeCredentialIdentityProviderLayer),
  Layer.provideMerge(SstResource.layer),
  Layer.tapCause(Effect.logError),
);

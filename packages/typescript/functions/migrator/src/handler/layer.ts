import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { nodeCredentialIdentityProviderLayer } from "@printdesk/core/aws/credential-identity/node";
import * as DsqlSigner from "@printdesk/core/aws/dsql-signer/layer";
import { Drizzle } from "@printdesk/core/database/drizzle";
import { Migrator } from "@printdesk/core/database/migrator";
import * as PgClient from "@printdesk/core/database/pg-client";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const layer = Migrator.layer.pipe(
  Layer.provide(Drizzle.layerWithDrizzleServices),
  Layer.provide(PgClient.layer),
  Layer.provide(DsqlSigner.layer({ expiresIn: Duration.minutes(15) })),
  Layer.provide(nodeCredentialIdentityProviderLayer),
  Layer.provide([NodeCrypto.layerDigest, SstResource.layer]),
  Layer.tapCause(Effect.logError),
);

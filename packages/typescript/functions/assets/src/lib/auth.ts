import { IdentityProvidersContract } from "@printdesk/core/identity/contract";
import { EntraId } from "@printdesk/core/identity/entra-id";
import { Openauth } from "@printdesk/core/oauth/openauth";
import {
  OpenauthExternalIssuer,
  OpenauthInternalIssuer,
} from "@printdesk/core/src/oauth/openauth/issuer";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { awsCredentialIdentityProviderLayer, awsLayer } from "./aws";
import { SstResource } from "./sst";

export const openauthExternalIssuerLayer = SstResource.useSync(Struct.get("Hostnames")).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("auth")),
  Effect.map(OpenauthExternalIssuer.layerFromHost),
  Layer.unwrap,
  Layer.provide(SstResource.layer),
);

export const openauthInternalIssuerLayer = SstResource.useSync(Struct.get("Issuer")).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("url")),
  Effect.map(OpenauthInternalIssuer.layerFromString),
  Layer.unwrap,
  Layer.provide(SstResource.layer),
);

export const openauthLayer = Openauth.layerFromInternalClientId(
  Constants.OPENAUTH_CLIENT_IDS.ASSETS,
).pipe(
  Layer.provide([
    awsLayer,
    awsCredentialIdentityProviderLayer,
    openauthExternalIssuerLayer,
    openauthInternalIssuerLayer,
  ]),
);

export const entraIdClientCredentials = SstResource.useSync(Struct.get("IdentityProviders")).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get(Constants.ENTRA_ID)),
  Effect.map(Struct.renameKeys({ clientId: "id", clientSecret: "secret" })),
  Effect.flatMap(Schema.decodeEffect(IdentityProvidersContract.ClientCredentials)),
  Effect.orDie,
  Layer.effect(EntraId.ClientCredentials),
  Layer.provide(SstResource.layer),
);

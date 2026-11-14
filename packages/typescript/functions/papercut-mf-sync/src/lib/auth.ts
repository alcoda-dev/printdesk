import { nodeCredentialIdentityProviderLayer } from "@printdesk/core/aws/credential-identity/node";
import { Openauth } from "@printdesk/core/oauth/openauth";
import {
  OpenauthExternalIssuer,
  OpenauthInternalIssuer,
} from "@printdesk/core/src/oauth/openauth/issuer";
import { SstResource } from "@printdesk/core/src/sst/resource";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { awsLayer } from "./aws";

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
  Constants.OPENAUTH_CLIENT_IDS.PAPERCUT_MF_SYNC,
).pipe(
  Layer.provide([
    awsLayer,
    nodeCredentialIdentityProviderLayer,
    openauthExternalIssuerLayer,
    openauthInternalIssuerLayer,
  ]),
);

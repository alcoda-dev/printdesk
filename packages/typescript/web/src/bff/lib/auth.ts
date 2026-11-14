import { Openauth } from "@printdesk/core/oauth/openauth";
import { OpenauthExternalIssuer } from "@printdesk/core/src/oauth/openauth/issuer";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { ViteResource } from "./sst";

export const openauthExternalIssuerLayer = ViteResource.useSync(Struct.get("Hostnames")).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("auth")),
  Effect.map(OpenauthExternalIssuer.layerFromHost),
  Layer.unwrap,
  Layer.provide(ViteResource.layer),
);

export const openauthLayer = ViteResource.useSync(
  (resource) => resource.ApiGatewayProperties.pipe(Redacted.value).urls.auth,
).pipe(
  Effect.map((issuer) => Openauth.layer({ clientID: Constants.OPENAUTH_CLIENT_IDS.WEB, issuer })),
  Layer.unwrap,
  Layer.provide([openauthExternalIssuerLayer, ViteResource.layer]),
);

import { nodeCredentialIdentityProviderLayer } from "@printdesk/core/aws/credential-identity/node";
import { HmacSigningSecret } from "@printdesk/core/crypto/hmac";
import { Openauth } from "@printdesk/core/oauth/openauth";
import {
  OpenauthExternalIssuer,
  OpenauthInternalIssuer,
} from "@printdesk/core/oauth/openauth/issuer";
import { SstResource } from "@printdesk/core/sst/resource";
import { Constants } from "@printdesk/core/utils/constants";
import * as Mac from "effect/crypto/Mac";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
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
  Constants.OPENAUTH_CLIENT_IDS.API,
).pipe(
  Layer.provide([
    awsLayer,
    nodeCredentialIdentityProviderLayer,
    openauthExternalIssuerLayer,
    openauthInternalIssuerLayer,
  ]),
);

export const hmacSigningSecretLayer = SstResource.useSync(Struct.get("HmacSigningSecret")).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("base64")),
  Effect.map(Base64.decode),
  Effect.flatMap(Effect.fromResult),
  Effect.flatMap((bytes) => Mac.key(Mac.hmacSha256, bytes)),
  Layer.effect(HmacSigningSecret),
  Layer.provide(SstResource.layer),
);

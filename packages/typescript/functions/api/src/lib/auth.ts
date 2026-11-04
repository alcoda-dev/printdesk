import { nodeCredentialIdentityProviderLayer } from "@printdesk/core/aws/credential-identity/node";
import { HmacSigningSecret } from "@printdesk/core/crypto/hmac";
import * as Openauth from "@printdesk/core/oauth/openauth/issuer";
import { SstResource } from "@printdesk/core/sst/resource";
import { Constants } from "@printdesk/core/utils/constants";
import * as Mac from "effect/crypto/Mac";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

export const openauthLayer = Openauth.issuerLayer(Constants.OPENAUTH_CLIENT_IDS.API).pipe(
  Layer.provide([nodeCredentialIdentityProviderLayer, SstResource.layer]),
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

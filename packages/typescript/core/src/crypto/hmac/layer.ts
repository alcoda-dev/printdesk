import * as Mac from "effect/crypto/Mac";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { HmacSigningSecret } from ".";
import { SstResource } from "../../sst/resource";

export const hmacSigningSecretLayer = SstResource.useSync(Struct.get("HmacSigningSecret")).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("base64")),
  Effect.map(Base64.decode),
  Effect.flatMap(Effect.fromResult),
  Effect.flatMap((bytes) => Mac.key(Mac.hmacSha256, bytes)),
  Layer.effect(HmacSigningSecret),
  Layer.provide(SstResource.layer),
);

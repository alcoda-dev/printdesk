import { Openauth } from "@printdesk/core/oauth/openauth";
import { OpenauthExternalIssuer } from "@printdesk/core/oauth/openauth/issuer";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Redacted from "effect/Redacted";
import * as String from "effect/String";
import * as Struct from "effect/Struct";

import { lambda } from "./aws";
import { resource } from "./sst";

export const openauthExternalIssuerLayer = Effect.sync(() => resource.Hostnames).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("auth")),
  Effect.map(OpenauthExternalIssuer.layerFromHost),
  Layer.unwrap,
);

export const openauthLayer = Openauth.layer({
  clientID: Constants.OPENAUTH_CLIENT_IDS.API_GATEWAY,
  fetch: (...args) => lambda.fetch(...args),
  issuer: resource.Issuer.pipe(Redacted.value, Struct.get("url"), String.replace(/\/$/, "")),
}).pipe(Layer.provide(openauthExternalIssuerLayer));

export const openauthRuntime = openauthLayer.pipe(ManagedRuntime.make);

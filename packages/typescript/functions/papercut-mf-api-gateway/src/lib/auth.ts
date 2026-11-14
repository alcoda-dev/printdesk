import { ActorLayerMap } from "@printdesk/core/actors";
import { OauthContract } from "@printdesk/core/oauth/contract";
import { Openauth } from "@printdesk/core/oauth/openauth";
import {
  OpenauthExternalIssuer,
  OpenauthInternalIssuer,
} from "@printdesk/core/src/oauth/openauth/issuer";
import { Constants } from "@printdesk/core/utils/constants";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { awsCredentialIdentityProviderLayer, awsLayer } from "./aws";
import { resource } from "./sst";

export const openauthExternalIssuerLayer = Effect.sync(() => resource.Hostnames).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("auth")),
  Effect.map(OpenauthExternalIssuer.layerFromHost),
  Layer.unwrap,
);

export const openauthInternalIssuerLayer = Effect.sync(() => resource.Issuer).pipe(
  Effect.map(Redacted.value),
  Effect.map(Struct.get("url")),
  Effect.map(OpenauthInternalIssuer.layerFromString),
  Layer.unwrap,
);

export const openauthLayer = Openauth.layerFromInternalClientId(
  Constants.OPENAUTH_CLIENT_IDS.PAPERCUT_MF_API_GATEWAY,
).pipe(
  Layer.provide([
    awsLayer,
    awsCredentialIdentityProviderLayer,
    openauthExternalIssuerLayer,
    openauthInternalIssuerLayer,
  ]),
);

export const authRuntime = openauthLayer.pipe(
  Layer.merge(ActorLayerMap.layer),
  Layer.tapCause(Effect.logError),
  ManagedRuntime.make,
);

export const AuthHeaders = OauthContract.AuthHeaders.to.pipe(
  Schema.encodeKeys({ accessToken: "proxy-authorization" }),
);

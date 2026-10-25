import * as Openauth from "@printdesk/core/oauth/openauth/runtime";
import { Constants } from "@printdesk/core/utils/constants";
import * as Redacted from "effect/Redacted";
import * as String from "effect/String";
import * as Struct from "effect/Struct";

import { lambda } from "./aws";
import { resource } from "./sst";

export const openauthRuntime = Openauth.runtime({
  clientID: Constants.OPENAUTH_CLIENT_IDS.API_GATEWAY,
  fetch: (input) => lambda.fetch(input, { redirect: "manual" }),
  issuer: resource.Issuer.pipe(Redacted.value, Struct.get("url"), String.replace(/\/$/, "")),
});

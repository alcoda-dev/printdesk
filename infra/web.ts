import { Constants } from "@printdesk/core/utils/constants";

import { apiGateway } from "./api-gateway";
import { apexDomain, hostnames } from "./dns";
import * as lib from "./lib";
import { environment, injectLinkables, isProdStage } from "./utils";

export const web = new lib.cloudflare.StaticSite("Web", {
  path: "packages/typescript/web",
  build: { command: "vpr build", output: "dist" },
  environment: injectLinkables(
    Constants.VITE_RESOURCE_PREFIX,
    apexDomain,
    apiGateway.properties,
    environment,
    hostnames,
  ),
  domain: hostnames.properties.web,
  server: {
    handler: "./src/bff/index.ts",
    routes: Object.values(Constants.WEB_BFF_PATHS),
  },
});

export const www = new sst.cloudflare.TanStackStart("Www", {
  path: "packages/typescript/www",
  buildCommand: "vpr build",
  environment: injectLinkables(
    Constants.VITE_RESOURCE_PREFIX,
    apexDomain,
    apiGateway.properties,
    environment,
    hostnames,
  ),
  domain: hostnames.properties.www,
});

if (isProdStage)
  new sst.cloudflare.Worker("WwwRedirect", {
    handler: "packages/typescript/functions/www-redirect/src/index.ts",
    link: [apexDomain],
    domain: $interpolate`www.${apexDomain.value}`,
  });

export const outputs = {
  web: web.url,
  www: www.url,
};

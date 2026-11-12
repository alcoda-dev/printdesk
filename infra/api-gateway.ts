import { api } from "./api";
import { assets } from "./assets";
import { issuer } from "./auth";
import { hostnames } from "./dns";
import * as lib from "./lib";
import { aws_ } from "./utils";

export const rateLimit = new sst.cloudflare.RateLimit("RateLimit", {
  namespaceId: 1001,
  limit: 100,
  period: "1 minute",
});

export const apiGateway = new lib.cloudflare.Worker("ApiGateway", {
  handler: "packages/typescript/functions/api-gateway/src/index.ts",
  domains: {
    api: hostnames.properties.api,
    auth: hostnames.properties.auth,
    assets: hostnames.properties.assets,
  },
  placement: { region: `aws:${aws_.properties.region}` },
  link: [api, assets, aws_, hostnames, issuer, rateLimit],
});

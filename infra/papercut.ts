import Path from "node:path";

import { codeBucket } from "./assets";
import { issuer } from "./auth";
import {
  appconfigAgent,
  invoicesProcessorClientCredentialsConfigurationProfileTemplate,
  papercutMfApiAuthTokenConfigurationProfileTemplate,
  papercutMfSyncClientCredentialsConfigurationProfileTemplate,
} from "./config";
import { dsql } from "./db";
import { hostnames } from "./dns";
import * as lib from "./lib";

import { siteBuilder } from "~/sst/aws/helpers/site-builder";
import { VisibleError } from "~/sst/error";

export const invoicesProcessorQueueSenderRoleTemplate = new lib.templates.aws.iam.Role(
  "InvoicesProcessorQueueSenderRoleTemplate",
  { identifier: "InvoicesSenderRole" },
);

const papercutMfApiGatewayPackagePath = Path.resolve(
  Path.join($cli.paths.root, "packages/typescript/functions/papercut-mf-api-gateway"),
);
const papercutMfApiGatewayScriptOutDir = "dist";
const papercutMfApiGatewayScriptAssetPath = `${papercutMfApiGatewayScriptOutDir}/index.js`;
export const papercutMfApiGatewayScriptBuilder = siteBuilder("PapercutMfApiGatewayScriptBuilder", {
  create: `vpx wrangler deploy --dry-run --outdir ${papercutMfApiGatewayScriptOutDir} --minify`,
  dir: papercutMfApiGatewayPackagePath,
  triggers: [Date.now()],
  assetPaths: [papercutMfApiGatewayScriptAssetPath],
});

export const papercutMfApiGatewayScriptSource = papercutMfApiGatewayScriptBuilder.assets.apply(
  (assets) => {
    const asset = assets?.[papercutMfApiGatewayScriptAssetPath];
    if (!asset || asset instanceof $util.asset.Archive)
      throw new VisibleError(`Missing asset at ${papercutMfApiGatewayScriptAssetPath}`);

    return asset;
  },
);

export const papercutMfApiGatewayScriptObject = new aws.s3.BucketObjectv2(
  "PapercutMfApiGatewayScriptObject",
  {
    bucket: codeBucket.name,
    key: "papercut-mf-api-gateway.js",
    source: papercutMfApiGatewayScriptSource,
    contentType: "text/javascript",
  },
);

export const papercutMfApiGatewayAwsAccessKey = new lib.aws.iam.AccessKey(
  "PapercutMfApiGatewayAwsAccessKey",
  { permissions: [issuer.permission] },
);

export const papercutMfSync = new lib.aws.lambda.EventFunction("PapercutMfSync", {
  handler: "packages/typescript/functions/papercut-mf-sync/src/index.default",
  link: [
    appconfigAgent,
    dsql,
    hostnames,
    papercutMfApiAuthTokenConfigurationProfileTemplate,
    papercutMfSyncClientCredentialsConfigurationProfileTemplate,
  ],
});

export const invoicesProcessor = new lib.aws.lambda.EventFunction("InvoicesProcessor", {
  handler: "packages/typescript/functions/invoices-processor/src/index.default",
  link: [
    appconfigAgent,
    dsql,
    hostnames,
    papercutMfApiAuthTokenConfigurationProfileTemplate,
    invoicesProcessorClientCredentialsConfigurationProfileTemplate,
  ],
});

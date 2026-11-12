import { assetsBucketTemplate, r2S3Credentials, userAvatarsQueueProperties } from "./assets";
import { hmacSigningSecret, identityProviders, issuer } from "./auth";
import {
  appconfigAllAtOnceDeploymentStrategy,
  appconfigApplication,
  appconfigEnvironment,
  appconfigLinear20PercentEvery6MinutesDeploymentStrategy,
  appconfigRoleTemplate,
  papercutMfApiAuthTokenConfigurationProfileTemplate,
} from "./config";
import { dsql, dynamo } from "./db";
import { hostnames } from "./dns";
import * as lib from "./lib";
import { invoicesProcessorQueueSenderRoleTemplate } from "./papercut";
import {
  appsyncApi,
  appsyncChannelNamespacePublisherRoleTemplate,
  appsyncChannelNamespaceSubscriberRoleTemplate,
} from "./realtime";
import { aws_, cloudflare_, environment } from "./utils";
import { bootstrapper } from "./workflows";

export const api = new lib.aws.lambda.WebFunction("Api", {
  entrypoint: "packages/typescript/functions/api/src/index.ts",
  dev: { port: 3001 },
  url: { authorization: "iam" },
  link: [
    appconfigAllAtOnceDeploymentStrategy,
    appconfigApplication,
    appconfigEnvironment,
    appconfigLinear20PercentEvery6MinutesDeploymentStrategy,
    appconfigRoleTemplate,
    appsyncApi,
    appsyncChannelNamespacePublisherRoleTemplate,
    appsyncChannelNamespaceSubscriberRoleTemplate,
    assetsBucketTemplate,
    aws_,
    bootstrapper,
    cloudflare_,
    dsql,
    dynamo,
    environment,
    hmacSigningSecret,
    hostnames,
    papercutMfApiAuthTokenConfigurationProfileTemplate,
    identityProviders,
    invoicesProcessorQueueSenderRoleTemplate,
    issuer,
    r2S3Credentials,
    userAvatarsQueueProperties,
  ],
});

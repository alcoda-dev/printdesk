import { hmacSigningSecret, issuer } from "./auth";
import {
  appconfigAgent,
  appconfigAgentDevContainer,
  appconfigAllAtOnceDeploymentStrategy,
  appconfigApplication,
  appconfigEnvironment,
  appconfigAgentExtensionTransform,
  appconfigLinear20PercentEvery6MinutesDeploymentStrategy,
  appconfigRoleTemplate,
  invoicesProcessorClientCredentialsConfigurationProfileTemplate,
  papercutMfSyncClientCredentialsConfigurationProfileTemplate,
} from "./config";
import { dsql, dynamo } from "./db";
import { hostnames } from "./dns";
import { appsyncApi, appsyncChannelNamespacePublisherRoleTemplate } from "./realtime";
import { aws_ } from "./utils";

export const bootstrapper = new sst.aws.Workflow(
  "Bootstrapper",
  {
    handler: "packages/typescript/functions/bootstrapper/src/index.default",
    link: [
      appconfigAgent,
      appconfigAllAtOnceDeploymentStrategy,
      appconfigApplication,
      appconfigEnvironment,
      appconfigLinear20PercentEvery6MinutesDeploymentStrategy,
      appconfigRoleTemplate,
      appsyncApi,
      appsyncChannelNamespacePublisherRoleTemplate,
      aws_,
      dsql,
      dynamo,
      hmacSigningSecret,
      hostnames,
      papercutMfSyncClientCredentialsConfigurationProfileTemplate,
      invoicesProcessorClientCredentialsConfigurationProfileTemplate,
      issuer,
    ],
    transform: { function: { function: appconfigAgentExtensionTransform } },
  },
  { dependsOn: appconfigAgentDevContainer ? [appconfigAgentDevContainer] : [] },
);

import * as R from "remeda";

import * as lib from "./lib";
import { aws_ } from "./utils";

import type { Transform } from "~/sst/component";
import { VisibleError } from "~/sst/error";

const applicationName = new lib.PhysicalName("AppconfigApplication", {
  max: 64,
});
export const appconfigApplication = new aws.appconfig.Application(applicationName.logical, {
  name: applicationName.result,
});

export const appconfigEnvironment = new aws.appconfig.Environment("AppconfigEnvironment", {
  applicationId: appconfigApplication.id,
  name: $app.stage,
});

export const appconfigAgent = new sst.Linkable("AppconfigAgent", {
  properties: { port: $output(2772) },
  include: [
    sst.aws.permission({
      actions: ["appconfig:StartConfigurationSession", "appconfig:GetLatestConfiguration"],
      resources: ["*"],
    }),
  ],
});

export let appconfigAgentDevContainer: docker.Container | undefined;
if ($dev) {
  const appconfigAgentDevImage = new docker.RemoteImage("AppconfigAgentDevImage", {
    name: "public.ecr.aws/aws-appconfig/aws-appconfig-agent:latest",
  });

  const appconfigAgentDevRole = new lib.aws.iam.ExternalRole("AppconfigAgentDevRole", {
    transform: {
      role: {
        inlinePolicies: [
          {
            policy: aws.iam.getPolicyDocumentOutput({
              statements: appconfigAgent
                .getSSTLink()
                .include?.map(({ effect = "allow", ...statement }) => ({
                  effect: effect.charAt(0).toUpperCase() + effect.slice(1),
                  ...R.omit(statement, ["type"]),
                })),
            }).json,
          },
        ],
      },
    },
  });

  appconfigAgentDevContainer = new docker.Container("AppconfigAgentDevContainer", {
    image: appconfigAgentDevImage.imageId,
    ports: [{ internal: appconfigAgent.properties.port, external: appconfigAgent.properties.port }],
    envs: [
      // oxlint-disable typescript/no-non-null-assertion
      `AWS_REGION=${$app.providers!.aws.region}`,
      $interpolate`ROLE_ARN=${appconfigAgentDevRole.arn}`,
      $interpolate`ROLE_EXTERNAL_ID=${appconfigAgentDevRole.externalId}`,
      $interpolate`HTTP_PORT=${appconfigAgent.properties.port}`,
      "LOG_LEVEL=error",
    ],
    healthcheck: {
      tests: [
        "CMD-SHELL",
        $interpolate`curl -fSs http://localhost:${appconfigAgent.properties.port}/ping || exit 1`,
      ],
      interval: "1s",
      timeout: "5s",
      retries: 10,
    },
    wait: true,
  });
}

export const appconfigRoleTemplate = new lib.templates.aws.iam.Role("AppconfigRoleTemplate", {
  identifier: "AppconfigRole",
});

export const appconfigAllAtOnceDeploymentStrategy = new aws.appconfig.DeploymentStrategy(
  "AppconfigAllAtOnceDeploymentStrategy",
  {
    growthType: "LINEAR",
    deploymentDurationInMinutes: 0,
    growthFactor: 100,
    finalBakeTimeInMinutes: 10,
    replicateTo: "NONE",
  },
);

export const appconfigLinear20PercentEvery6MinutesDeploymentStrategy =
  new aws.appconfig.DeploymentStrategy("AppconfigLinear20PercentEvery6MinutesDeploymentStrategy", {
    growthType: "LINEAR",
    deploymentDurationInMinutes: 30,
    growthFactor: 20,
    finalBakeTimeInMinutes: 30,
    replicateTo: "NONE",
  });

export const appconfigAgentExtensionTransform: Transform<aws.lambda.FunctionArgs> = (args) => {
  if (!$dev)
    args.layers = [
      $resolve({ architectures: $output(args.architectures), region: $output(args.region) }).apply(
        ({ architectures = ["x86_64"], region = aws_.properties.region }) => {
          // https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions-versions.html
          // version 2.0.27899
          const appconfigLayerArn =
            architectures[0] === "arm64"
              ? [
                  "arn:aws:lambda:us-east-1:027255383542:layer:AWS-AppConfig-Extension-Arm64:289",
                  "arn:aws:lambda:us-east-2:728743619870:layer:AWS-AppConfig-Extension-Arm64:262",
                  "arn:aws:lambda:us-west-1:958113053741:layer:AWS-AppConfig-Extension-Arm64:325",
                  "arn:aws:lambda:us-west-2:359756378197:layer:AWS-AppConfig-Extension-Arm64:307",
                  "arn:aws:lambda:ca-central-1:039592058896:layer:AWS-AppConfig-Extension-Arm64:209",
                  "arn:aws:lambda:ca-west-1:436199621743:layer:AWS-AppConfig-Extension-Arm64:193",
                  "arn:aws:lambda:eu-central-1:066940009817:layer:AWS-AppConfig-Extension-Arm64:264",
                  "arn:aws:lambda:eu-central-2:758369105281:layer:AWS-AppConfig-Extension-Arm64:208",
                  "arn:aws:lambda:eu-west-1:434848589818:layer:AWS-AppConfig-Extension-Arm64:269",
                  "arn:aws:lambda:eu-west-2:282860088358:layer:AWS-AppConfig-Extension-Arm64:227",
                  "arn:aws:lambda:eu-west-3:493207061005:layer:AWS-AppConfig-Extension-Arm64:225",
                  "arn:aws:lambda:eu-north-1:646970417810:layer:AWS-AppConfig-Extension-Arm64:253",
                  "arn:aws:lambda:eu-south-1:203683718741:layer:AWS-AppConfig-Extension-Arm64:209",
                  "arn:aws:lambda:eu-south-2:586093569114:layer:AWS-AppConfig-Extension-Arm64:204",
                  "arn:aws-cn:lambda:cn-north-1:615057806174:layer:AWS-AppConfig-Extension-Arm64:191",
                  "arn:aws-cn:lambda:cn-northwest-1:615084187847:layer:AWS-AppConfig-Extension-Arm64:193",
                  "arn:aws:lambda:ap-east-1:630222743974:layer:AWS-AppConfig-Extension-Arm64:218",
                  "arn:aws:lambda:ap-east-2:730335625313:layer:AWS-AppConfig-Extension-Arm64:153",
                  "arn:aws:lambda:ap-northeast-1:980059726660:layer:AWS-AppConfig-Extension-Arm64:252",
                  "arn:aws:lambda:ap-northeast-2:826293736237:layer:AWS-AppConfig-Extension-Arm64:213",
                  "arn:aws:lambda:ap-northeast-3:706869817123:layer:AWS-AppConfig-Extension-Arm64:220",
                  "arn:aws:lambda:ap-southeast-1:421114256042:layer:AWS-AppConfig-Extension-Arm64:237",
                  "arn:aws:lambda:ap-southeast-2:080788657173:layer:AWS-AppConfig-Extension-Arm64:284",
                  "arn:aws:lambda:ap-southeast-3:418787028745:layer:AWS-AppConfig-Extension-Arm64:222",
                  "arn:aws:lambda:ap-southeast-4:307021474294:layer:AWS-AppConfig-Extension-Arm64:204",
                  "arn:aws:lambda:ap-southeast-5:631746059939:layer:AWS-AppConfig-Extension-Arm64:170",
                  "arn:aws:lambda:ap-southeast-6:381491832265:layer:AWS-AppConfig-Extension-Arm64:114",
                  "arn:aws:lambda:ap-southeast-7:851725616657:layer:AWS-AppConfig-Extension-Arm64:163",
                  "arn:aws:lambda:ap-south-1:554480029851:layer:AWS-AppConfig-Extension-Arm64:264",
                  "arn:aws:lambda:ap-south-2:489524808438:layer:AWS-AppConfig-Extension-Arm64:206",
                  "arn:aws:lambda:sa-east-1:000010852771:layer:AWS-AppConfig-Extension-Arm64:246",
                  "arn:aws:lambda:mx-central-1:891376990304:layer:AWS-AppConfig-Extension-Arm64:168",
                  "arn:aws:lambda:af-south-1:574348263942:layer:AWS-AppConfig-Extension-Arm64:218",
                  "arn:aws:lambda:il-central-1:895787185223:layer:AWS-AppConfig-Extension-Arm64:199",
                  "arn:aws-us-gov:lambda:us-gov-east-1:946561847325:layer:AWS-AppConfig-Extension-Arm64:195",
                  "arn:aws-us-gov:lambda:us-gov-west-1:946746059096:layer:AWS-AppConfig-Extension-Arm64:194",
                  "arn:aws-eusc:lambda:eusc-de-east-1:426221636601:layer:AWS-AppConfig-Extension-Arm64:48",
                ].find((arn) => arn.includes(region))
              : [
                  "arn:aws:lambda:us-east-1:027255383542:layer:AWS-AppConfig-Extension:356",
                  "arn:aws:lambda:us-east-2:728743619870:layer:AWS-AppConfig-Extension:310",
                  "arn:aws:lambda:us-west-1:958113053741:layer:AWS-AppConfig-Extension:448",
                  "arn:aws:lambda:us-west-2:359756378197:layer:AWS-AppConfig-Extension:405",
                  "arn:aws:lambda:ca-central-1:039592058896:layer:AWS-AppConfig-Extension:289",
                  "arn:aws:lambda:ca-west-1:436199621743:layer:AWS-AppConfig-Extension:203",
                  "arn:aws:lambda:eu-central-1:066940009817:layer:AWS-AppConfig-Extension:321",
                  "arn:aws:lambda:eu-central-2:758369105281:layer:AWS-AppConfig-Extension:250",
                  "arn:aws:lambda:eu-west-1:434848589818:layer:AWS-AppConfig-Extension:331",
                  "arn:aws:lambda:eu-west-2:282860088358:layer:AWS-AppConfig-Extension:275",
                  "arn:aws:lambda:eu-west-3:493207061005:layer:AWS-AppConfig-Extension:306",
                  "arn:aws:lambda:eu-north-1:646970417810:layer:AWS-AppConfig-Extension:394",
                  "arn:aws:lambda:eu-south-1:203683718741:layer:AWS-AppConfig-Extension:281",
                  "arn:aws:lambda:eu-south-2:586093569114:layer:AWS-AppConfig-Extension:243",
                  "arn:aws-cn:lambda:cn-north-1:615057806174:layer:AWS-AppConfig-Extension:269",
                  "arn:aws-cn:lambda:cn-northwest-1:615084187847:layer:AWS-AppConfig-Extension:271",
                  "arn:aws:lambda:ap-east-1:630222743974:layer:AWS-AppConfig-Extension:290",
                  "arn:aws:lambda:ap-east-2:730335625313:layer:AWS-AppConfig-Extension:179",
                  "arn:aws:lambda:ap-northeast-1:980059726660:layer:AWS-AppConfig-Extension:299",
                  "arn:aws:lambda:ap-northeast-2:826293736237:layer:AWS-AppConfig-Extension:305",
                  "arn:aws:lambda:ap-northeast-3:706869817123:layer:AWS-AppConfig-Extension:305",
                  "arn:aws:lambda:ap-southeast-1:421114256042:layer:AWS-AppConfig-Extension:285",
                  "arn:aws:lambda:ap-southeast-2:080788657173:layer:AWS-AppConfig-Extension:341",
                  "arn:aws:lambda:ap-southeast-3:418787028745:layer:AWS-AppConfig-Extension:285",
                  "arn:aws:lambda:ap-southeast-4:307021474294:layer:AWS-AppConfig-Extension:219",
                  "arn:aws:lambda:ap-southeast-5:631746059939:layer:AWS-AppConfig-Extension:195",
                  "arn:aws:lambda:ap-southeast-6:381491832265:layer:AWS-AppConfig-Extension:124",
                  "arn:aws:lambda:ap-southeast-7:851725616657:layer:AWS-AppConfig-Extension:164",
                  "arn:aws:lambda:ap-south-1:554480029851:layer:AWS-AppConfig-Extension:322",
                  "arn:aws:lambda:ap-south-2:489524808438:layer:AWS-AppConfig-Extension:248",
                  "arn:aws:lambda:sa-east-1:000010852771:layer:AWS-AppConfig-Extension:358",
                  "arn:aws:lambda:mx-central-1:891376990304:layer:AWS-AppConfig-Extension:169",
                  "arn:aws:lambda:af-south-1:574348263942:layer:AWS-AppConfig-Extension:290",
                  "arn:aws:lambda:il-central-1:895787185223:layer:AWS-AppConfig-Extension:216",
                  "arn:aws-us-gov:lambda:us-gov-east-1:946561847325:layer:AWS-AppConfig-Extension:249",
                  "arn:aws-us-gov:lambda:us-gov-west-1:946746059096:layer:AWS-AppConfig-Extension:248",
                  "arn:aws-eusc:lambda:eusc-de-east-1:426221636601:layer:AWS-AppConfig-Extension:73",
                ].find((arn) => arn.includes(region));

          if (!appconfigLayerArn)
            throw new VisibleError(
              `Could not find appconfig layer corresponding to the function's region "${region}".`,
            );

          return appconfigLayerArn;
        },
      ),
    ];
};

export const papercutMfApiAuthTokenConfigurationProfileTemplate =
  new lib.templates.aws.appconfig.ConfigurationProfile(
    "PapercutMfApiAuthTokenConfigurationProfileTemplate",
    { identifier: "PapercutMfApiAuthToken" },
  );

export const papercutMfSyncClientCredentialsConfigurationProfileTemplate =
  new lib.templates.aws.appconfig.ConfigurationProfile(
    "PapercutMfSyncClientCredentialsConfigurationProfileTemplate",
    { identifier: "PapercutMfSyncClientCredentials" },
  );

export const invoicesProcessorClientCredentialsConfigurationProfileTemplate =
  new lib.templates.aws.appconfig.ConfigurationProfile(
    "InvoicesProcessorClientCredentialsConfigurationProfileTemplate",
    { identifier: "InvoicesProcessorClientCredentials" },
  );

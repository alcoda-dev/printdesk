import { Constants } from "@printdesk/core/utils/constants";

import { dsql, dynamo } from "./db";
import { hostnames } from "./dns";
import * as lib from "./lib";
import { aws_, environment } from "./utils";

import type { DynamoStorageOptions } from "@openauthjs/openauth/storage/dynamo";

export const hmacSigningSecret = new random.RandomBytes("HmacSigningSecret", { length: 32 });

const oauthAppName =
  {
    prod: $output($app.name.charAt(0).toUpperCase() + $app.name.slice(1)),
    dev: $interpolate`${$app.name}-${$app.stage}`,
  }[$app.stage] ?? $interpolate`${$app.name}-dev-${$app.stage}`;

export const entraIdApplication = new azuread.ApplicationRegistration(
  "EntraIdApplicationRegistration",
  {
    displayName: oauthAppName,
    signInAudience: "AzureADMultipleOrgs",
    implicitAccessTokenIssuanceEnabled: true,
    implicitIdTokenIssuanceEnabled: true,
    homepageUrl: $interpolate`https://${hostnames.properties.www}`,
  },
);

export const entraIdApplicationRedirectUris = new azuread.ApplicationRedirectUris(
  "EntraIdApplicationRedirectUris",
  {
    applicationId: entraIdApplication.id,
    type: "Web",
    redirectUris: [
      $interpolate`https://${hostnames.properties.auth}/${Constants.ENTRA_ID}/callback`,
    ],
  },
);

const graphAppId = azuread
  .getApplicationPublishedAppIdsOutput()
  // oxlint-disable-next-line typescript/no-non-null-assertion
  .result.apply((result) => result.MicrosoftGraph!);

const graphServicePrincipal = new azuread.ServicePrincipal("GraphServicePrincipal", {
  clientId: graphAppId,
  useExisting: true,
});

export const entraIdApplicationApiAccess = new azuread.ApplicationApiAccess(
  "EntraIdApplicationApiAccess",
  {
    applicationId: entraIdApplication.id,
    apiClientId: graphAppId,
    scopeIds: Constants.ENTRA_ID_OAUTH_SCOPES.map(
      (scope) => graphServicePrincipal.oauth2PermissionScopeIds[scope],
    ).filter(Boolean),
    roleIds: Constants.ENTRA_ID_APP_ROLES.map(
      (role) => graphServicePrincipal.appRoleIds[role],
    ).filter(Boolean),
  },
);

export const entraIdClientSecretRotation = new time.Rotating("EntraIdClientSecretRotation", {
  rotationMonths: 6,
});

export const entraIdClientSecretRotationOffset = new time.Offset(
  "EntraIdClientSecretRotationOffset",
  { baseRfc3339: entraIdClientSecretRotation.rotationRfc3339, offsetDays: 30 },
);

export const entraIdClientSecret = new azuread.ApplicationPassword("EntraIdClientSecret", {
  applicationId: entraIdApplication.id,
  rotateWhenChanged: { rotation: entraIdClientSecretRotation.id },
  endDate: entraIdClientSecretRotationOffset.rfc3339,
});

export const identityProviders = new sst.Linkable("IdentityProviders", {
  properties: {
    [Constants.ENTRA_ID]: {
      clientId: entraIdApplication.clientId,
      clientSecret: $util.secret(entraIdClientSecret.value),
    },
    [Constants.GOOGLE]: {
      clientId: "TODO",
      clientSecret: $util.secret("TODO"),
    },
  },
});

export const issuer = new lib.aws.lambda.WebFunction("Issuer", {
  entrypoint: "packages/typescript/functions/issuer/src/index.ts",
  dev: { port: 3000 },
  url: { authorization: "iam" },
  link: [aws_, dsql, dynamo, environment, hmacSigningSecret, identityProviders],
  environment: {
    OPENAUTH_STORAGE: $jsonStringify({
      type: "dynamo",
      options: {
        table: dynamo.name,
        pk: dynamo.nodes.table.hashKey,
        sk: dynamo.nodes.table.rangeKey,
        ttl: dynamo.nodes.table.ttl.attributeName,
      } satisfies { [TKey in keyof DynamoStorageOptions]: $util.Input<DynamoStorageOptions[TKey]> },
    }),
  },
});

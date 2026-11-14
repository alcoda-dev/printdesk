import { Aws } from "@printdesk/core/aws";
import { AwsCredentialIdentityProvider } from "@printdesk/core/aws/credential-identity";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { resource } from "./sst";

export const awsLayer = Layer.succeed(Aws, resource.Aws);

export const awsCredentialIdentityProviderLayer = AwsCredentialIdentityProvider.layer({
  accessKeyId: resource.AWS_ACCESS_KEY_ID.pipe(Redacted.value),
  secretAccessKey: resource.AWS_SECRET_ACCESS_KEY.pipe(Redacted.value),
});

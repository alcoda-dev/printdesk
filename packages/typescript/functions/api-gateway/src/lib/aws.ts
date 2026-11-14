import { LambdaWebFunctionClient } from "@printdesk/core/aws/sigv4-signers/lambda";
import * as Redacted from "effect/Redacted";

import { resource } from "./sst";

export const lambda = new LambdaWebFunctionClient({
  accessKeyId: resource.AWS_ACCESS_KEY_ID.pipe(Redacted.value),
  secretAccessKey: resource.AWS_SECRET_ACCESS_KEY.pipe(Redacted.value),
  region: resource.Aws.pipe(Redacted.value).region,
  retries: 0,
});

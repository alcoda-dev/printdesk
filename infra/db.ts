// oxlint-disable typescript/no-non-null-assertion
import { Constants } from "@printdesk/core/utils/constants";

import * as lib from "./lib";
import { aws_, hashFiles, isProdStage } from "./utils";

import { VisibleError } from "~/sst/error";

const name = new lib.PhysicalName("Dsql", { max: 256 });
export const dsql = new sst.aws.Dsql(name.logical, {
  transform: {
    cluster(args) {
      args.deletionProtectionEnabled = isProdStage;
      args.tags = $output(args.tags).apply((tags) => ({ ...tags, Name: name.result }));
    },
  },
});

const migrationsPath = "packages/typescript/core/migrations";

export const migrator = new sst.aws.Function("Migrator", {
  handler: "packages/typescript/functions/migrator/src/index.default",
  link: [aws_, dsql],
  copyFiles: [{ from: migrationsPath, to: "migrations" }],
});

export const migratorInvocation = new aws.lambda.Invocation("MigratorInvocation", {
  functionName: migrator.name,
  input: JSON.stringify({}),
  triggers: { migrations: hashFiles(migrationsPath) },
});

export const migratorInvocationSuccess = $jsonParse(migratorInvocation.result).apply((result) => {
  const success =
    typeof result === "object" &&
    result !== null &&
    "success" in result &&
    typeof result.success === "boolean";

  if (!success) throw new VisibleError("Migration failed, see function logs.");
  return success;
});

new sst.x.DevCommand("Studio", {
  link: [aws_, dsql],
  dev: {
    command: "vpr drizzle:studio",
    directory: "packages/typescript/core",
    autostart: true,
  },
  environment: {
    AWS_REGION: process.env.SST_AWS_REGION!,
    AWS_ACCESS_KEY_ID: process.env.SST_AWS_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: process.env.SST_AWS_SECRET_ACCESS_KEY!,
    AWS_SESSION_TOKEN: process.env.SST_AWS_SESSION_TOKEN!,
  },
});

export const dynamo = new sst.aws.Dynamo(
  "Dynamo",
  {
    fields: {
      [Constants.DYNAMO_KEYS.PK]: "string",
      [Constants.DYNAMO_KEYS.SK]: "string",
      [Constants.DYNAMO_KEYS.GSI1_PK]: "string",
      [Constants.DYNAMO_KEYS.GSI1_SK]: "string",
    },
    primaryIndex: {
      hashKey: Constants.DYNAMO_KEYS.PK,
      rangeKey: Constants.DYNAMO_KEYS.SK,
    },
    globalIndexes: {
      [Constants.DYNAMO_SECONDARY_INDEXES.GSI1]: {
        hashKey: Constants.DYNAMO_KEYS.GSI1_PK,
        rangeKey: Constants.DYNAMO_KEYS.GSI1_SK,
      },
    },
    ttl: "expiry",
    stream: "new-and-old-images",
    deletionProtection: isProdStage,
  },
  { retainOnDelete: isProdStage },
);

export const outputs = {
  dsql: dsql.endpoint,
};

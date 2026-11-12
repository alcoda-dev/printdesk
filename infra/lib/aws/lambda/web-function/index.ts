// oxlint-disable no-await-in-loop
import Crypto from "node:crypto";
import Fs from "node:fs";
import Path from "node:path";

import { Constants } from "@printdesk/core/utils/constants";
import archiver from "archiver";

import { PhysicalName } from "../../..";
import { findPackagePath } from "../../../utils";
import { webFunctionDevBridgeToken, webFunctionDevBridgeWorker } from "./dev-bridge";

import { functionEncryptionKey } from "~/sst/aws/function-encryption-key";
import { parseRoleArn } from "~/sst/aws/helpers/arn";
import { RETENTION } from "~/sst/aws/logging";
import { permission } from "~/sst/aws/permission";
import type { Permission } from "~/sst/aws/permission";
import { transform } from "~/sst/component";
import type { Transform } from "~/sst/component";
import { toSeconds } from "~/sst/duration";
import { VisibleError } from "~/sst/error";
import { Link } from "~/sst/link";
import { rpc } from "~/sst/rpc/rpc";

const MIN_ENVIRONMENTS = 2;
const MAX_ENVIRONMENTS = 10_000;

const MIN_CONCURRENCY_PER_ENVIRONMENT = 1;
const DEFAULT_CONCURRENCY_PER_ENVIRONMENT = 64;
const MAX_CONCURRENCY_PER_ENVIRONMENT = 128;

const MIN_RATELIMIT = 0;
const MIN_RATELIMIT_MULTIPLE = 100;
const MAX_RATELIMIT_MULTIPLE = 1_000;
const MAX_RATELIMIT = 10_000;

export interface WebFunctionArgs extends Pick<
  sst.aws.FunctionArgs,
  "role" | "environment" | "link" | "permissions" | "policies" | "nodejs" | "copyFiles" | "timeout"
> {
  entrypoint: $util.Input<string>;
  dev: NonNullable<sst.x.DevCommandArgs["dev"]> & {
    port: $util.Input<number>;
    enabled?: $util.Input<boolean>;
  };
  url?: $util.Input<{ authorization?: $util.Input<"none" | "iam"> }>;
  logging?: $util.Input<
    | false
    | {
        retention?: $util.Input<keyof typeof RETENTION>;
        applicationLogLevel?: $util.Input<"TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL">;
        systemLogLevel?: $util.Input<"DEBUG" | "INFO" | "WARN">;
      }
  >;
  scaling?: $util.Input<{
    maxEnvironments?: $util.Input<number>;
    maxConcurrencyPerEnvironment?: $util.Input<number>;
  }>;
  throttle?: $util.Input<{
    rateLimit?: $util.Input<number>;
  }>;
  transform?: {
    webFunction?: Transform<aws.lambdaweb.FunctionArgs>;
    bucket?: Transform<sst.aws.BucketArgs>;
    assetObject?: Transform<aws.s3.BucketObjectv2Args>;
    role?: Transform<aws.iam.RoleArgs>;
    localLogGroup?: Transform<aws.cloudwatch.LogGroupArgs>;
    homeLogGroup?: Transform<aws.cloudwatch.LogGroupArgs>;
    revision?: Transform<aws.lambdaweb.FunctionRevisionArgs>;
    endpoint?: Transform<aws.lambdaweb.FunctionEndpointArgs>;
    devCommand?: Transform<sst.x.DevCommandArgs>;
  };
}

export class WebFunction extends $util.ComponentResource implements Link.Linkable {
  public static readonly __pulumiType = "pd:awscf:LambdaWebFunction";

  #webFunction: aws.lambdaweb.Function;
  #bucket: sst.aws.Bucket;
  #assetObject: $util.Output<aws.s3.BucketObjectv2>;
  #role: () => aws.iam.Role;
  #homeLogGroup: $util.Output<aws.cloudwatch.LogGroup | undefined>;
  #localLogGroup: $util.Output<aws.cloudwatch.LogGroup | undefined>;
  #revision: aws.lambdaweb.FunctionRevision;
  #endpoint: aws.lambdaweb.FunctionEndpoint;
  #devCommand: $util.Output<sst.x.DevCommand | undefined>;

  public constructor(name: string, args: WebFunctionArgs, opts?: $util.ComponentResourceOptions) {
    super(WebFunction.__pulumiType, name, {}, opts);

    // oxlint-disable-next-line typescript/no-this-alias
    const self = this;

    const accountId = aws.getCallerIdentityOutput({}, { parent: self }).accountId;
    const partition = aws.getPartitionOutput({}, { parent: self }).partition;

    const dev = normalizeDev();
    const url = normalizeUrl();
    const scaling = normalizeScaling();
    const throttle = normalizeThrottle();
    const logging = normalizeLogging();
    const timeout = normalizeTimeout();
    const copyFiles = normalizeCopyFiles();
    const policies = $output(args.policies ?? []);
    const nodejs = normalizeNodejs();
    const runtime = "nodejs24.x";

    const linkProperties = buildLinkProperties();
    const linkPermissions = buildLinkPermissions();
    const asset = buildAsset();
    const environments = buildEnvironments();

    const webFunction = createWebFunction();
    const bucket = createBucket();
    const assetObject = createAssetObject();
    const role = createRole();
    const logGroups = createLogGroups();
    const revision = createRevision();
    const endpoint = createEndpoint();
    const devCommand = createDevCommand();

    this.#webFunction = webFunction;
    this.#bucket = bucket;
    this.#assetObject = assetObject;
    this.#role = role;
    this.#homeLogGroup = logGroups.apply((groups) => groups?.home);
    this.#localLogGroup = logGroups.apply((groups) => groups?.local);
    this.#revision = revision;
    this.#endpoint = endpoint;
    this.#devCommand = devCommand;

    this.registerOutputs({ _hint: this.url });

    function normalizeDev() {
      return {
        enabled: $output(args.dev.enabled).apply((enabled) => $dev && enabled !== false),
        port: $output(args.dev.port).apply(function (port) {
          if (!Number.isInteger(port) || port < 1 || port > 2 ** 16 - 1)
            throw new VisibleError("Invalid dev server port");
          return port;
        }),
        bridge: {
          clientId: webFunctionDevBridgeToken.clientId,
          clientSecret: webFunctionDevBridgeToken.clientSecret,
          workerUrl: webFunctionDevBridgeWorker.url.apply((url) => {
            if (!url) throw new VisibleError("Missing web function dev bridge worker URL");
            return url;
          }),
        },
        outputs: {
          title: $output(args.dev.title ?? name),
          command: $output(args.dev.command ?? "vpr dev"),
          directory: $resolve({ directory: args.dev.directory, entrypoint: args.entrypoint }).apply(
            ({ directory, entrypoint }) =>
              directory ??
              Path.relative(
                $cli.paths.root,
                findPackagePath(name, Path.resolve(Path.join($cli.paths.root, entrypoint))),
              ),
          ),
          autostart: $output(args.dev.autostart ?? true),
        },
      };
    }

    function normalizeUrl() {
      return $output(args.url).apply((url) => ({
        authorization: url?.authorization === "iam" ? "IamAuth" : "ApplicationManaged",
      }));
    }

    function normalizeScaling() {
      return $output(args.scaling).apply(function (scaling) {
        if (
          typeof scaling?.maxEnvironments === "number" &&
          (scaling.maxEnvironments < MIN_ENVIRONMENTS || scaling.maxEnvironments > MAX_ENVIRONMENTS)
        )
          throw new VisibleError(
            `"scaling.maxEnvironments" must be between ${MIN_ENVIRONMENTS} and ${MAX_ENVIRONMENTS}`,
          );

        if (
          typeof scaling?.maxConcurrencyPerEnvironment === "number" &&
          (scaling.maxConcurrencyPerEnvironment < MIN_CONCURRENCY_PER_ENVIRONMENT ||
            scaling.maxConcurrencyPerEnvironment > MAX_CONCURRENCY_PER_ENVIRONMENT)
        )
          throw new VisibleError(
            `"scaling.maxConcurrencyPerEnvironment" must be between ${MIN_CONCURRENCY_PER_ENVIRONMENT} and ${MAX_CONCURRENCY_PER_ENVIRONMENT}`,
          );

        return {
          ...scaling,
          maxConcurrencyPerEnvironment:
            scaling?.maxConcurrencyPerEnvironment ?? DEFAULT_CONCURRENCY_PER_ENVIRONMENT,
        };
      });
    }

    function normalizeThrottle() {
      return $output(args.throttle).apply(function (throttle) {
        if (typeof throttle?.rateLimit === "number") {
          if (throttle.rateLimit < MIN_RATELIMIT_MULTIPLE && throttle.rateLimit !== MIN_RATELIMIT)
            throw new VisibleError(
              `"throttle.rateLimit" cannot be less than ${MIN_RATELIMIT_MULTIPLE} unless it is ${MIN_RATELIMIT}`,
            );

          if (
            throttle.rateLimit >= MIN_RATELIMIT_MULTIPLE &&
            throttle.rateLimit <= MAX_RATELIMIT_MULTIPLE &&
            throttle.rateLimit % MIN_RATELIMIT_MULTIPLE !== 0
          )
            throw new VisibleError(
              `"throttle.rateLimit" between ${MIN_RATELIMIT_MULTIPLE} and ${MAX_RATELIMIT_MULTIPLE} must be a multiple of ${MIN_RATELIMIT_MULTIPLE}`,
            );

          if (
            throttle.rateLimit >= MAX_RATELIMIT_MULTIPLE &&
            throttle.rateLimit <= MAX_RATELIMIT &&
            throttle.rateLimit % MAX_RATELIMIT_MULTIPLE !== 0
          )
            throw new VisibleError(
              `"throttle.rateLimit" between ${MAX_RATELIMIT_MULTIPLE} and ${MAX_RATELIMIT} must be a multiple of ${MAX_RATELIMIT_MULTIPLE}`,
            );

          if (throttle.rateLimit > MAX_RATELIMIT)
            throw new VisibleError(`"throttle.rateLimit" cannot be greater than ${MAX_RATELIMIT}`);
        }

        return {
          rateLimit: throttle?.rateLimit,
        };
      });
    }

    function normalizeLogging() {
      return $output(args.logging).apply(function (logging) {
        if (logging === false) return;

        return {
          retention: logging?.retention ?? "1 month",
          applicationLogLevel: logging?.applicationLogLevel ?? "INFO",
          systemLogLevel: logging?.systemLogLevel ?? "INFO",
        };
      });
    }

    function normalizeTimeout() {
      return $output(args.timeout).apply((timeout) => timeout ?? "20 seconds");
    }

    function normalizeCopyFiles() {
      return $output(args.copyFiles ?? []).apply((copyFiles) =>
        Promise.all(
          copyFiles.map(async function (copyFile) {
            const source = Path.join($cli.paths.root, copyFile.from);
            const destination = copyFile.to || copyFile.from;
            if (Path.isAbsolute(destination))
              throw new VisibleError(`Copy destination path "${destination}" must be relative`);

            const isDirectory = (await Fs.promises.stat(source)).isDirectory();

            return { source, destination, isDirectory };
          }),
        ),
      );
    }

    function normalizeNodejs() {
      return $output(args.nodejs).apply(function (nodejs = {}) {
        nodejs.minify ??= true;
        nodejs.format ??= "esm";

        return nodejs?.install && Array.isArray(nodejs.install)
          ? { ...nodejs, install: Object.fromEntries(nodejs.install.map((dep) => [dep, "*"])) }
          : nodejs;
      });
    }

    function buildLinkProperties() {
      return Link.getProperties(args.link);
    }

    function buildLinkPermissions() {
      return Link.getInclude<Permission>("aws.permission", args.link).apply((permissions) =>
        permissions.map(({ type: _type, ...permission }) => permission),
      );
    }

    function buildAsset() {
      return $resolve({
        dev,
        realEntrypoint: args.entrypoint,
        copyFiles,
        nodejs,
        encryptionKey: dev.enabled.apply((dev) =>
          dev ? $output("") : functionEncryptionKey().base64,
        ),
        links: dev.enabled.apply((dev) => (dev ? $output({}) : linkProperties)),
      }).apply(async function ({ dev, realEntrypoint, copyFiles, nodejs, encryptionKey, links }) {
        const entrypoint = Path.resolve(
          $cli.paths.root,
          dev.enabled
            ? "packages/typescript/functions/dev-bridge/src/function/index.ts"
            : realEntrypoint,
        );

        const result = await rpc.call<{
          out: string;
          handler: string;
          errors: Array<string>;
          sourcemaps: Array<string>;
        }>("Runtime.Build", {
          functionID: name,
          handler:
            entrypoint.slice(0, entrypoint.length - Path.extname(entrypoint).length) + ".main",
          bundle: undefined,
          runtime,
          encryptionKey,
          links,
          copyFiles,
          dev: false,
          properties: { ...nodejs, architecture: "arm64" },
        });
        if (result.errors.length) throw new VisibleError(result.errors.join("\n"));

        return {
          directory: result.out,
          entrypoint:
            result.handler.slice(0, -Path.extname(result.handler).length) +
            (nodejs?.format === "cjs" ? ".cjs" : ".mjs"),
          sourcemaps: nodejs?.sourcemap ? [] : result.sourcemaps,
        };
      });
    }

    function buildEnvironments() {
      return $resolve({
        dev,
        environment: args.environment,
        encryptionKey: functionEncryptionKey().base64,
        linkEnv: Link.propertiesToEnv(linkProperties),
        linkIncludes: Link.getInclude<{
          type: "environment";
          env: Record<string, $util.Input<string>>;
        }>("environment", args.link),
        asset,
      }).apply(function ({ dev, environment, encryptionKey, linkEnv, linkIncludes, asset }) {
        const aws: Record<string, string> = dev.enabled
          ? {
              [Constants.WEB_FUNCTION_ENV.DEV_BRIDGE_CLIENT_ID]: dev.bridge.clientId,
              [Constants.WEB_FUNCTION_ENV.DEV_BRIDGE_CLIENT_SECRET]: dev.bridge.clientSecret,
              [Constants.WEB_FUNCTION_ENV.DEV_BRIDGE_WORKER_URL]: dev.bridge.workerUrl,
              [Constants.WEB_FUNCTION_ENV.DEV_SERVER_PORT]: dev.port.toString(),
            }
          : {
              ...environment,
              SST_RESOURCE_App: JSON.stringify({ name: $app.name, stage: $app.stage }),
              SST_KEY: encryptionKey,
              SST_KEY_FILE: "resource.enc",
            };

        if (!dev.enabled) for (const { env } of linkIncludes) Object.assign(aws, env);

        aws.AWS_LAMBDA_NODEJS_ENTRYPOINT = asset.entrypoint;

        const local: Record<string, string> = {
          ...environment,
          ...linkEnv,
          [Constants.WEB_FUNCTION_ENV.DEV_SERVER_PORT]: dev.port.toString(),
        };

        return { aws, local };
      });
    }

    function createWebFunction() {
      const physicalName = new PhysicalName(`${name}WebFunction`, { max: 64 }, { parent: self });

      return new aws.lambdaweb.Function(
        ...transform(
          args.transform?.webFunction,
          physicalName.logical,
          { functionName: physicalName.result },
          { parent: self },
        ),
      );
    }

    function createBucket() {
      return new sst.aws.Bucket(
        ...transform(
          args.transform?.bucket,
          `${name}Bucket`,
          {
            versioning: true,
            policy: [
              {
                principals: [{ type: "service", identifiers: ["lambda.amazonaws.com"] }],
                actions: ["s3:GetObject", "s3:GetObjectVersion"],
                paths: ["assets/*"],
                conditions: [
                  {
                    test: "StringEquals",
                    variable: "aws:SourceAccount",
                    values: [accountId],
                  },
                  {
                    test: "ArnLike",
                    variable: "aws:SourceArn",
                    values: [$interpolate`${webFunction.arn}/revision/*`],
                  },
                ],
              },
            ],
          },
          { parent: self },
        ),
      );
    }

    function createAssetObject() {
      // oxlint-disable-next-line complexity
      return $resolve({ dev, asset, copyFiles }).apply(async function ({ dev, asset, copyFiles }) {
        if (!Fs.existsSync(Path.join(asset.directory, asset.entrypoint)))
          throw new VisibleError(
            `The "${name}" WebFunction's build did not produce "${asset.entrypoint}".`,
          );

        const zipPath = Path.join(
          $cli.paths.work,
          "artifacts",
          `${name}-web-function`,
          `${dev.enabled ? "dev-bridge-" : ""}asset.zip`,
        );

        await Fs.promises.mkdir(Path.dirname(zipPath), { recursive: true });
        const files = new globalThis.Map<string, string>();

        for await (const destination of Fs.promises.glob("**", {
          cwd: asset.directory,
          followSymlinks: false,
          exclude: [
            ".git/**",
            ".sst/**",
            "**/sst-env.d.ts",
            ...asset.sourcemaps.map((file) =>
              Path.relative(asset.directory, file).split(Path.sep).join("/"),
            ),
          ],
        })) {
          const source = Path.join(asset.directory, destination);
          if (!(await Fs.promises.lstat(source)).isDirectory()) files.set(destination, source);
        }

        for (const copyFile of copyFiles) {
          if (copyFile.isDirectory) {
            for await (const relative of Fs.promises.glob("**", {
              cwd: copyFile.source,
              followSymlinks: false,
            })) {
              const source = Path.join(copyFile.source, relative);

              if ((await Fs.promises.lstat(source)).isDirectory()) continue;

              const destination = Path.join(copyFile.destination, relative)
                .split(Path.sep)
                .join("/");

              if (
                destination === "resource.enc" ||
                destination === "sst-env.d.ts" ||
                destination.endsWith("/sst-env.d.ts") ||
                destination.startsWith(".git/") ||
                destination.startsWith(".sst/")
              )
                continue;

              files.set(destination, source);
            }
          }
        }

        for (const [destination, source] of files) {
          if (!(await Fs.promises.lstat(source)).isSymbolicLink()) continue;

          const target = await Fs.promises.readlink(source);

          const resolved = Path.posix.normalize(
            Path.posix.join(Path.posix.dirname(destination), target),
          );

          if (
            Path.isAbsolute(target) ||
            resolved === ".." ||
            resolved.startsWith("../") ||
            (!files.has(resolved) &&
              ![...files.keys()].some((entry) => entry.startsWith(`${resolved}/`)))
          )
            throw new VisibleError(
              `The "${name}" WebFunction's symlink "${destination}" must point to an existing relative target inside the deployment package.`,
            );
        }

        if (!files.has(asset.entrypoint))
          throw new VisibleError(
            `The "${name}" WebFunction's entrypoint is excluded from its deployment package.`,
          );

        await new Promise<void>(function (resolve, reject) {
          const stream = Fs.createWriteStream(zipPath);
          const archive = archiver("zip", { statConcurrency: 1 });

          archive.on("warning", reject);
          archive.on("error", reject);
          stream.on("error", reject);
          stream.once("close", resolve);

          archive.pipe(stream);

          files
            .entries()
            .toArray()
            .toSorted(([a], [b]) => a.localeCompare(b))
            .forEach(([destination, source]) =>
              archive.file(source, { name: destination, date: new Date(0) }),
            );

          archive.finalize().catch(reject);
        });

        const hash = Crypto.createHash("sha256")
          .update(new Uint8Array(await Fs.promises.readFile(zipPath)))
          .digest("hex");

        return new aws.s3.BucketObjectv2(
          ...transform(
            args.transform?.assetObject,
            `${name}${dev.enabled ? "DevBridge" : ""}Asset`,
            {
              bucket: bucket.name,
              key: `assets/${name}-${dev.enabled ? "dev-bridge-" : ""}code-${hash}.zip`,
              source: $asset(zipPath),
              sourceHash: hash,
            },
            { parent: self },
          ),
        );
      });
    }

    function createRole() {
      if (args.role) {
        const roleArn = args.role;
        let existing: { role: aws.iam.Role } | { error: unknown } | undefined;

        return () => {
          if (!existing) {
            try {
              existing = {
                role: aws.iam.Role.get(
                  `${name}Role`,
                  $output(roleArn).apply(parseRoleArn).roleName,
                  {},
                  { parent: self },
                ),
              };
            } catch (error) {
              existing = { error };
            }
          }

          if ("error" in existing) throw existing.error;

          return existing.role;
        };
      }

      const policy = $util
        .all([args.permissions || [], linkPermissions])
        .apply(([argsPermissions, linkPermissions]) =>
          aws.iam.getPolicyDocumentOutput({
            statements: [...argsPermissions, ...linkPermissions].map(
              ({ effect = "allow", ...statement }) => ({
                effect: effect.charAt(0).toUpperCase() + effect.slice(1),
                ...statement,
              }),
            ),
          }),
        );

      const role = new aws.iam.Role(
        ...transform(
          args.transform?.role,
          `${name}Role`,
          {
            assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
              statements: [
                {
                  actions: ["sts:AssumeRole"],
                  principals: [
                    { type: "Service", identifiers: ["lambda.amazonaws.com"] },
                    ...($dev
                      ? [
                          {
                            type: "AWS",
                            identifiers: [$interpolate`arn:${partition}:iam::${accountId}:root`],
                          },
                        ]
                      : []),
                  ],
                },
              ],
            }).json,
            inlinePolicies: policy.apply(({ statements }) =>
              statements ? [{ name: "inline", policy: policy.json }] : [],
            ),
            managedPolicyArns: $resolve({ logging, policies }).apply(({ logging, policies }) => [
              ...policies,
              ...(logging ? [aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole] : []),
            ]),
          },
          { parent: self },
        ),
      );

      return () => role;
    }

    function createLogGroups() {
      return logging.apply(function (logging) {
        if (!logging) return;

        const home = new aws.cloudwatch.LogGroup(
          ...transform(
            args.transform?.homeLogGroup,
            `${name}HomeLogGroup`,
            {
              name: $interpolate`/aws/lambda/web/${webFunction.functionName}`,
              retentionInDays: RETENTION[logging.retention],
            },
            { parent: self },
          ),
        );

        const local = new aws.cloudwatch.LogGroup(
          ...transform(
            args.transform?.localLogGroup,
            `${name}LocalLogGroup`,
            {
              name: $interpolate`${home.name}.local`,
              retentionInDays: home.retentionInDays,
            },
            { parent: self },
          ),
        );

        return { home, local };
      });
    }

    function createRevision() {
      return new aws.lambdaweb.FunctionRevision(
        ...transform(
          args.transform?.revision,
          `${name}WebFunctionRevision`,
          {
            functionName: webFunction.functionName,
            buildConfig: {
              codeConfig: {
                s3Object: {
                  bucket: assetObject.bucket,
                  key: assetObject.key,
                  versionId: assetObject.versionId,
                },
              },
              runtimeConfig: { runtime },
            },
            serviceConfig: {
              executionRoleArn: role().arn,
              environmentVariables: environments.aws,
              maxConcurrencyPerEnvironment: scaling.maxConcurrencyPerEnvironment,
              timeoutSeconds: timeout.apply(toSeconds),
              telemetryConfig: logging.apply((logging) =>
                logging
                  ? {
                      loggingConfig: {
                        logGroup: logGroups.apply((groups) => $output(groups?.home.name)),
                        applicationLogLevel: logging.applicationLogLevel,
                        systemLogLevel: logging.systemLogLevel,
                      } satisfies aws.types.input.lambdaweb.FunctionRevisionServiceConfigTelemetryConfigLoggingConfig,
                    }
                  : undefined,
              ),
            },
          },
          { parent: self },
        ),
      );
    }

    function createEndpoint() {
      return new aws.lambdaweb.FunctionEndpoint(
        ...transform(
          args.transform?.endpoint,
          `${name}WebFunctionEndpoint`,
          {
            functionName: webFunction.functionName,
            endpointName: "default",
            endpointType: "HomeRegion",
            authType: url.authorization,
            autoDeploymentMode: "Disabled",
            revisionWeights: [{ revisionId: revision.revisionId, weight: 100 }],
            scalingConfig: scaling.apply(({ maxEnvironments }) =>
              maxEnvironments === undefined ? undefined : { maxEnvironments },
            ),
            throttleConfig: throttle.apply(({ rateLimit }) =>
              rateLimit === undefined ? undefined : { rateLimit },
            ),
          },
          { parent: self },
        ),
      );
    }

    function createDevCommand() {
      return $output(dev).apply(function (dev) {
        if (!dev.enabled) return;

        return new sst.x.DevCommand(
          ...transform(
            args.transform?.devCommand,
            `${name}Dev`,
            {
              dev: dev.outputs,
              link: args.link,
              environment: environments.local,
              aws: { role: role().arn },
            },
            { parent: self },
          ),
        );
      });
    }
  }

  public get url() {
    return this.#endpoint.domainName.apply((domainName) => `https://${domainName}`);
  }

  public get arn() {
    return this.#webFunction.arn;
  }

  public get roleArn() {
    return this.#role().arn;
  }

  public get endpointArn() {
    return this.#endpoint.arn;
  }

  public get revisionArn() {
    return this.#revision.arn;
  }

  public get permission() {
    return permission({
      actions: ["lambda:InvokeWebFunctionEndpoint"],
      resources: [this.endpointArn],
    });
  }

  public get nodes() {
    return {
      webFunction: this.#webFunction,
      bucket: this.#bucket,
      assetObject: this.#assetObject,
      role: this.#role(),
      homeLogGroup: this.#homeLogGroup,
      localLogGroup: this.#localLogGroup,
      revision: this.#revision,
      endpoint: this.#endpoint,
      devCommand: this.#devCommand,
    };
  }

  public getSSTLink() {
    return {
      properties: {
        url: this.url,
        arn: this.arn,
        roleArn: this.roleArn,
        endpointArn: this.endpointArn,
      },
      include: [this.permission],
    };
  }
}

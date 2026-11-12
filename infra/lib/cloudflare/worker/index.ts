import { mkdirSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import Path from "node:path";

import * as R from "remeda";

import { findPackagePath } from "../../utils";
import { WorkerDomain } from "./domain";

import { siteBuilder } from "~/sst/aws/helpers/site-builder";
import { binding, DEFAULT_ACCOUNT_ID } from "~/sst/cloudflare";
import { toMilliseconds } from "~/sst/duration";
import type { DurationMinutes, DurationSeconds } from "~/sst/duration";
import { VisibleError } from "~/sst/error";
import { Link } from "~/sst/link";

export interface WorkerArgs extends Omit<sst.cloudflare.WorkerArgs, "domain"> {
  domains?: $util.Input<Record<string, $util.Input<string>>>;
  consumers?: $util.Input<
    Record<
      string,
      $util.Input<{
        queueId: $util.Input<string>;
        dlq?: {
          queue: $util.Input<string>;
          maxRetries?: $util.Input<number>;
          retryDelay?: $util.Input<DurationSeconds>;
        };
        batch?: {
          size?: $util.Input<number>;
          window?: $util.Input<DurationMinutes>;
        };
        maxConcurrency?: $util.Input<number>;
      }>
    >
  >;
}

// TODO: Modify as needed
type Configuration = {
  $schema: string;
  name: string;
  main: string;
  compatibility_date: string;
  compatibility_flags: Array<string>;
  vars?: Record<string, string>;
  ratelimits?: Array<{
    name: string;
    namespace_id: string;
    simple: {
      limit: number;
      period: number;
    };
  }>;
  services?: Array<{
    binding: string;
    service: string;
    entrypoint?: string;
  }>;
  cache?: {
    enabled: boolean;
    cross_version_cache?: boolean;
  };
  exports?: Record<
    string,
    {
      type: string;
      cache?: { enabled: boolean };
    }
  >;
};

export class Worker extends $util.ComponentResource implements Link.Linkable {
  public static readonly __pulumiType = "pd:cloudflare:Worker";

  #worker: sst.cloudflare.Worker;
  #domains: $util.Output<Record<string, WorkerDomain> | undefined>;
  #consumers: $util.Output<Record<string, cloudflare.QueueConsumer> | undefined>;
  #properties: sst.Linkable<{
    urls: $util.Output<Record<string, $util.Output<string>> | undefined>;
  }>;

  public constructor(
    name: string,
    { domains, ...args }: WorkerArgs,
    opts?: $util.ComponentResourceOptions,
  ) {
    super(Worker.__pulumiType, name, {}, opts);

    this.#worker = new sst.cloudflare.Worker(`${name}Worker`, args, { parent: this });

    this.#domains = $output(domains).apply((domains) =>
      domains
        ? R.mapValues(
            domains,
            (value, key) =>
              new WorkerDomain(
                `${name}${key.charAt(0).toUpperCase() + key.slice(1)}Domain`,
                { service: this.#worker.nodes.worker.scriptName, hostname: value },
                { parent: this },
              ),
          )
        : undefined,
    );

    this.#consumers = $output(args.consumers).apply((consumers) =>
      consumers
        ? R.mapValues(
            consumers,
            (args, key) =>
              new cloudflare.QueueConsumer(
                `${name}${key.charAt(0).toUpperCase() + key.slice(1)}QueueConsumer`,
                {
                  accountId: this.#worker.nodes.worker.accountId.apply(
                    (id) => id ?? DEFAULT_ACCOUNT_ID,
                  ),
                  deadLetterQueue: args.dlq?.queue,
                  queueId: args.queueId,
                  scriptName: this.#worker.nodes.worker.scriptName,
                  settings: {
                    batchSize: $output(args.batch?.size ?? 10),
                    maxConcurrency: args.maxConcurrency,
                    maxRetries: args.dlq?.maxRetries,
                    retryDelay: $output(args.dlq?.retryDelay ?? "0 seconds").apply(toMilliseconds),
                    maxWaitTimeMs: $output(args.batch?.window ?? "5 seconds").apply(toMilliseconds),
                  },
                  type: "worker",
                },
                { parent: this },
              ),
          )
        : undefined,
    );

    const bindings = this.#worker.nodes.worker.bindings.apply(
      // @ts-ignore Pulumi type is incorrect
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      (bindings) => bindings.value as Array<cloudflare.types.output.WorkersScriptBinding>,
    );

    const { packagePath, mainPath } = $output(args.handler).apply(function (handler) {
      const handlerPath = Path.resolve(Path.join($cli.paths.root, handler));

      const packagePath = findPackagePath(name, handlerPath);
      const mainPath = Path.relative(packagePath, handlerPath);

      return { packagePath, mainPath };
    });

    $resolve({
      config: $jsonStringify(
        $resolve({
          name: this.#worker.nodes.worker.scriptName,
          main: mainPath,
          bindings,
          compatibility_date: this.#worker.nodes.worker.compatibilityDate,
          compatibility_flags: this.#worker.nodes.worker.compatibilityFlags,
          cacheOptions: this.#worker.nodes.worker.cacheOptions,
          exports: this.#worker.nodes.worker.exports,
        }).apply(
          ({
            name,
            main,
            compatibility_date,
            compatibility_flags,
            cacheOptions,
            bindings,
            exports,
          }) =>
            bindings.reduce(
              (cfg, binding) => {
                // TODO: Add other bindings as needed
                switch (binding.type) {
                  case "plain_text":
                    cfg.vars ??= {};
                    cfg.vars[binding.name] = binding.text || "";
                    break;
                  case "ratelimit":
                    cfg.ratelimits ??= [];
                    cfg.ratelimits.push({
                      name: binding.name,
                      namespace_id: binding.namespaceId,
                      // oxlint-disable-next-line typescript/no-non-null-assertion
                      simple: binding.simple!,
                    });
                    break;
                  case "service":
                    cfg.services ??= [];
                    cfg.services.push({
                      binding: binding.name,
                      // oxlint-disable-next-line typescript/no-non-null-assertion
                      service: binding.service!,
                      ...(binding.entrypoint ? { entrypoint: binding.entrypoint } : undefined),
                    });
                    break;
                  default:
                    break;
                }

                return cfg;
              },
              {
                $schema: "node_modules/wrangler/config-schema.json",
                name,
                main,
                compatibility_date,
                compatibility_flags,
                ...(cacheOptions
                  ? {
                      cache: {
                        enabled: cacheOptions.enabled,
                        cross_version_cache: cacheOptions.crossVersionCache,
                      },
                    }
                  : undefined),
                ...(exports ? { exports } : undefined),
              } as Configuration,
            ),
        ),
        undefined,
        2,
      ),
      packagePath,
      secrets: bindings.apply((bindings) =>
        bindings
          .filter((binding) => binding.type === "secret_text")
          .map((binding) => `${binding.name}='${binding.text || ""}'`)
          .join("\n"),
      ),
    }).apply(({ packagePath, config, secrets }) => {
      const configPath = Path.resolve(Path.join(packagePath, "wrangler.jsonc"));
      mkdirSync(Path.dirname(configPath), { recursive: true });
      writeFileSync(configPath, config);

      const secretsPath = Path.resolve(Path.join(packagePath, ".dev.vars"));
      mkdirSync(Path.dirname(secretsPath), { recursive: true });
      writeFileSync(secretsPath, secrets);

      siteBuilder(
        `${name}Typegen`,
        {
          create: "vpx wrangler types",
          dir: packagePath,
          triggers: [config, $util.secret(secrets)],
        },
        { parent: this },
      );
    });

    this.#properties = new sst.Linkable(`${name}Properties`, {
      properties: {
        urls: this.urls,
      },
    });
  }

  public get urls() {
    return this.#domains.apply((domains) =>
      domains ? R.mapValues(domains, R.prop("url")) : undefined,
    );
  }

  public get nodes() {
    return {
      worker: this.#worker,
      domains: this.#domains,
      consumers: this.#consumers,
      properties: this.#properties,
    };
  }

  public get binding() {
    return binding({
      type: "serviceBindings",
      properties: {
        service: this.#worker.nodes.worker.id,
      },
    });
  }

  public getSSTLink() {
    return {
      properties: {},
      include: [this.binding],
    };
  }

  public get properties() {
    return this.#properties;
  }
}

import {
  AppConfigClient,
  CreateHostedConfigurationVersionCommand,
  StartDeploymentCommand,
} from "@aws-sdk/client-appconfig";
import {
  AppConfigDataClient,
  GetLatestConfigurationCommand,
  StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { SstResource } from "../../sst/resource";
import { Constants } from "../../utils/constants";
import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from "../credential-identity";
import { catchServiceExceptions } from "../sdk";

export interface VersionArgs<TType extends object, TEncoded, TServices> {
  profileId: string;
  Codec: Schema.Codec<TType, TEncoded, never, TServices>;
  value: TType;
}

export interface DeployArgs {
  profileId: string;
  version: number;
  deploymentStrategyId: string;
}

export interface PublishArgs<TType extends object, TEncoded, TServices> {
  profileId: string;
  Codec: Schema.Codec<TType, TEncoded, never, TServices>;
  value: TType;
  deploymentStrategyId: string;
}

export class Appconfig extends Context.Service<Appconfig>()("@printdesk/core/aws/Appconfig", {
  make: Effect.gen(function* () {
    const resource = yield* SstResource;

    const application = resource.AppconfigApplication.pipe(Redacted.value);
    const environment = resource.AppconfigEnvironment.pipe(Redacted.value);

    const clientCache = yield* Cache.make({
      capacity: Constants.DEFAULT_CACHE_CAPACITY,
      lookup: (credentials: AwsCredentialIdentity) =>
        credentials.encode.pipe(
          Effect.flatMap((credentials) =>
            Effect.acquireRelease(
              Effect.try({
                try: () =>
                  new AppConfigClient({
                    credentials,
                    region: resource.Aws.pipe(Redacted.value).region,
                  }),
                catch: catchServiceExceptions(),
              }),
              (client) => Effect.sync(() => client.destroy()),
            ),
          ),
        ),
    });

    const dataClientCache = yield* Cache.make({
      capacity: Constants.DEFAULT_CACHE_CAPACITY,
      lookup: (credentials: AwsCredentialIdentity) =>
        credentials.encode.pipe(
          Effect.flatMap((credentials) =>
            Effect.acquireRelease(
              Effect.try({
                try: () =>
                  new AppConfigDataClient({
                    credentials,
                    region: resource.Aws.pipe(Redacted.value).region,
                  }),
                catch: catchServiceExceptions(),
              }),
              (client) => Effect.sync(() => client.destroy()),
            ),
          ),
        ),
    });

    const useClient = Effect.fn("Appconfig.useClient")(
      <TSuccess, TError, TServices>(
        callback: (client: AppConfigClient) => Effect.Effect<TSuccess, TError, TServices>,
      ) =>
        AwsCredentialIdentityProvider.provide.pipe(
          Effect.flatMap((credentials) => clientCache.pipe(Cache.get(credentials))),
          Effect.flatMap(callback),
        ),
    );

    const useDataClient = Effect.fn("AppconfigAgent.useDataClient")(
      <TSuccess, TError, TServices>(
        callback: (client: AppConfigDataClient) => Effect.Effect<TSuccess, TError, TServices>,
      ) =>
        AwsCredentialIdentityProvider.provide.pipe(
          Effect.flatMap((credentials) => dataClientCache.pipe(Cache.get(credentials))),
          Effect.flatMap(callback),
        ),
    );

    const version = Effect.fn("Appconfig.version")(function* <
      TType extends object,
      TEncoded,
      TServices,
    >(args: VersionArgs<TType, TEncoded, TServices>) {
      const encode = args.Codec.pipe(Schema.fromJsonString, Schema.encodeEffect);
      const Content = yield* encode(args.value);

      return yield* useClient((client) =>
        Effect.tryPromise({
          try: (abortSignal) =>
            client.send(
              new CreateHostedConfigurationVersionCommand({
                ApplicationId: application.id,
                ConfigurationProfileId: args.profileId,
                Content,
                ContentType: "application/json",
              }),
              { abortSignal },
            ),
          catch: catchServiceExceptions(
            "BadRequestException",
            "ConflictException",
            "InternalServerException",
            "PayloadTooLargeException",
            "ResourceNotFoundException",
            "ServiceQuotaExceededException",
            "AppConfigServiceException",
          ),
        }),
      ).pipe(
        Effect.map(Struct.get("VersionNumber")),
        Effect.filterOrFail(Predicate.isNotUndefined),
      );
    });

    const deploy = Effect.fn("Appconfig.deploy")((args: DeployArgs) =>
      useClient((client) =>
        Effect.tryPromise({
          try: (abortSignal) =>
            client.send(
              new StartDeploymentCommand({
                ApplicationId: application.id,
                EnvironmentId: environment.id,
                ConfigurationProfileId: args.profileId,
                ConfigurationVersion: String(args.version),
                DeploymentStrategyId: args.deploymentStrategyId,
              }),
              { abortSignal },
            ),
          catch: catchServiceExceptions(
            "BadRequestException",
            "ConflictException",
            "InternalServerException",
            "ResourceNotFoundException",
            "AppConfigServiceException",
          ),
        }),
      ),
    );

    const publish = Effect.fn("Appconfig.publish")(
      <TType extends object, TEncoded, TServices>(args: PublishArgs<TType, TEncoded, TServices>) =>
        version({ profileId: args.profileId, Codec: args.Codec, value: args.value }).pipe(
          Effect.andThen((version) =>
            deploy({
              profileId: args.profileId,
              version,
              deploymentStrategyId: args.deploymentStrategyId,
            }),
          ),
        ),
    );

    const startSession = Effect.fn("Appconfig.startSession")((profileId: string) =>
      useDataClient((client) =>
        Effect.tryPromise({
          try: (abortSignal) =>
            client.send(
              new StartConfigurationSessionCommand({
                ApplicationIdentifier: application.id,
                EnvironmentIdentifier: environment.id,
                ConfigurationProfileIdentifier: profileId,
              }),
              { abortSignal },
            ),
          catch: catchServiceExceptions(
            "BadRequestException",
            "InternalServerException",
            "ResourceNotFoundException",
            "ThrottlingException",
            "AppConfigDataServiceException",
          ),
        }),
      ),
    );

    const getLatest = Effect.fn("Appconfig.getLatest")((token: Redacted.Redacted) =>
      useDataClient((client) =>
        Effect.tryPromise({
          try: (abortSignal) =>
            client.send(
              new GetLatestConfigurationCommand({ ConfigurationToken: token.pipe(Redacted.value) }),
              { abortSignal },
            ),
          catch: catchServiceExceptions(
            "BadRequestException",
            "InternalServerException",
            "ResourceNotFoundException",
            "ThrottlingException",
            "AppConfigDataServiceException",
          ),
        }),
      ),
    );

    return {
      useClient,
      useDataClient,
      version,
      deploy,
      publish,
      startSession,
      getLatest,
    } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

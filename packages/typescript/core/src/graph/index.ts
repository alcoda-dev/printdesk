// oxlint-disable typescript/no-explicit-any
import { createGraphServiceClient, GraphRequestAdapter } from "@microsoft/msgraph-sdk";
import { createGraphClientFactory, getDefaultMiddlewares } from "@microsoft/msgraph-sdk-core";
import { version } from "@microsoft/msgraph-sdk/version";
import "@microsoft/msgraph-sdk-applicationtemplates";
import "@microsoft/msgraph-sdk-groups";
import "@microsoft/msgraph-sdk-serviceprincipals";
import "@microsoft/msgraph-sdk-users";
import * as Array from "effect/Array";
import * as Cache from "effect/Cache";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Optic from "effect/Optic";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Request from "effect/Request";
import * as RequestResolver from "effect/RequestResolver";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { EntraId } from "../identity/entra-id";
import { Constants } from "../utils/constants";

import type {
  RequestOption,
  BaseRequestBuilder,
  RequestConfiguration,
} from "@microsoft/kiota-abstractions";
import type { Middleware } from "@microsoft/kiota-http-fetchlibrary";
import type { GraphServiceClient } from "@microsoft/msgraph-sdk";
import type { HttpClientError } from "effect/http/HttpClientError";
import type { GroupsContract } from "../groups/contracts";
import type { OauthContract } from "../oauth/contract";
import type { UsersContract } from "../users/contract";

export class GraphError extends Schema.TaggedError<GraphError>()("GraphError", {
  cause: Schema.Defect(),
}) {}

type AnyRequestBuilder = BaseRequestBuilder<any>;

type RequestBuilderMethod<TBuilder extends AnyRequestBuilder> = Extract<
  keyof TBuilder,
  "get" | "post" | "put" | "patch" | "delete"
>;

type RequestBuilderMethodMetadata<
  TBuilder extends AnyRequestBuilder,
  TMethod extends RequestBuilderMethod<TBuilder>,
> = TBuilder[TMethod] extends (...args: infer TArgs) => Promise<infer TOutput>
  ? TArgs extends [infer TBody, ...Array<unknown>]
    ? {
        config: Exclude<TArgs[number], TBody | undefined>;
        input: [TBody];
        output: TOutput;
      }
    : {
        config: Exclude<TArgs[number], undefined>;
        input: [];
        output: TOutput;
      }
  : never;

export class GraphRequest<
  TBuilder extends AnyRequestBuilder = any,
  TMethod extends RequestBuilderMethod<TBuilder> = any,
  TMetadata extends RequestBuilderMethodMetadata<TBuilder, TMethod> = any,
> extends Request.Class<
  {
    builder: TBuilder;
    method: TMethod;
    config: TMetadata["config"];
    input: TMetadata["input"];
  },
  NonNullable<TMetadata["output"]>,
  GraphError | Cause.NoSuchElementError
> {}

export class GraphUserPhotoRequest extends Request.Class<
  { id: UsersContract.ExternalId },
  { contentType: string; data: ArrayBuffer },
  EntraId.AuthProviderError | HttpClientError | Cause.NoSuchElementError | Schema.SchemaError,
  EntraId.AuthProvider
> {}

export class AbortSignalOption implements RequestOption {
  public static readonly key = "AbortSignalOption";
  public constructor(public signal: AbortSignal) {}
  // oxlint-disable-next-line class-methods-use-this
  public readonly getKey = () => AbortSignalOption.key;
}

export class AbortSignalMiddleware implements Middleware {
  public next: Middleware | undefined;

  public execute(
    url: string,
    requestInit: RequestInit,
    requestOptions?: Record<string, RequestOption>,
  ) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const option = requestOptions?.[AbortSignalOption.key] as AbortSignalOption | undefined;
    if (option) requestInit.signal = option.signal;

    return (
      this.next?.execute(url, requestInit, requestOptions) ??
      Promise.reject(new Error("Next middleware not set"))
    );
  }
}

export class Graph extends Context.Service<Graph>()("@printdesk/core/graph/Graph", {
  make: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient.pipe(
      Effect.map(
        HttpClient.mapRequest(HttpClientRequest.prependUrl("https://graph.microsoft.com/v1.0")),
      ),
      Effect.map(
        HttpClient.mapRequestEffect((request) =>
          EntraId.AuthProvider.accessToken.pipe(
            Effect.map((accessToken) => request.pipe(HttpClientRequest.bearerToken(accessToken))),
          ),
        ),
      ),
      Effect.map(HttpClient.filterStatusOk),
    );

    const clientCache = yield* Cache.make({
      capacity: Constants.DEFAULT_CACHE_CAPACITY,
      requireServicesAt: "lookup",
      lookup: (_accessToken: Redacted.Redacted) =>
        EntraId.AuthProvider.use((authProvider) =>
          Effect.try({
            try: () =>
              new GraphRequestAdapter(
                authProvider,
                undefined,
                undefined,
                createGraphClientFactory(
                  { graphServiceLibraryClientVersion: version },
                  undefined,
                  undefined,
                  [...getDefaultMiddlewares(), new AbortSignalMiddleware()],
                ),
              ),
            catch: (cause) => new GraphError({ cause }),
          }),
        ).pipe(
          Effect.andThen((requestAdapter) =>
            Effect.try({
              try: () => createGraphServiceClient(requestAdapter),
              catch: (cause) => new GraphError({ cause }),
            }),
          ),
        ),
    });

    const resolver = RequestResolver.make<GraphRequest>(
      Effect.forEach((entry) =>
        Effect.tryPromise({
          try: (signal) =>
            entry.request.builder[entry.request.method](
              ...entry.request.input,
              Option.fromUndefinedOr(entry.request.config).pipe(
                Option.match({
                  onSome: Optic.id<RequestConfiguration<any>>()
                    .key("options")
                    .modify((options = []) => Array.append(options, new AbortSignalOption(signal))),
                  onNone: () => ({ options: [new AbortSignalOption(signal)] }),
                }),
              ),
            ),
          catch: (cause) => new GraphError({ cause }),
        }).pipe(
          Effect.filterOrFail(Predicate.isNotUndefined),
          Effect.exit,
          Effect.map((exit) => entry.completeUnsafe(exit)),
        ),
      ),
    ).pipe(
      RequestResolver.setDelay(Constants.GRAPH_REQUEST_BATCH_DELAY),
      RequestResolver.batchN(Constants.GRAPH_REQUEST_BATCH_SIZE),
      RequestResolver.withSpan("Graph.resolver"),
    );

    const batchRequest =
      <TBuilder extends AnyRequestBuilder>(getBuilder: (client: GraphServiceClient) => TBuilder) =>
      <TMethod extends RequestBuilderMethod<TBuilder>>(
        {
          method,
          config,
        }: {
          method: TMethod;
          config?: NoInfer<RequestBuilderMethodMetadata<TBuilder, TMethod>["config"]>;
        },
        ...input: NoInfer<RequestBuilderMethodMetadata<TBuilder, TMethod>["input"]>
      ) =>
        EntraId.AuthProvider.accessToken.pipe(
          Effect.flatMap((accessToken) => clientCache.pipe(Cache.get(accessToken))),
          Effect.map((client) => ({ builder: getBuilder(client), method, config, input })),
          Effect.flatMap((args) => Effect.request(new GraphRequest(args), resolver)),
          Effect.withSpan("Graph.batchRequest"),
        );

    const me = batchRequest(Struct.get("me"))({ method: "get" }).pipe(Effect.withSpan("Graph.me"));

    const groups = batchRequest(Struct.get("groups"))({ method: "get" }).pipe(
      Effect.map(Struct.get("value")),
      Effect.filterOrFail(Predicate.isNotNullish),
      Effect.withSpan("Graph.groups"),
    );

    const groupMembers = Effect.fn("Graph.groupMembers")(
      (id: GroupsContract.ExternalId, transitive: boolean = true) =>
        batchRequest(
          (client) => client.groups.byGroupId(id)[transitive ? "transitiveMembers" : "members"],
        )({ method: "get" }).pipe(
          Effect.map(Struct.get("value")),
          Effect.filterOrFail(Predicate.isNotNullish),
        ),
    );

    const users = batchRequest((client) => client.users)({ method: "get" }).pipe(
      Effect.map(Struct.get("value")),
      Effect.filterOrFail(Predicate.isNotNullish),
      Effect.withSpan("Graph.users"),
    );

    const user = Effect.fn("Graph.user")((id: UsersContract.ExternalId) =>
      batchRequest((client) => client.users.byUserId(id))({ method: "get" }),
    );

    const createNonGalleryApplication = Effect.fn("Graph.createNonGalleryApplication")(
      (displayName: string) =>
        batchRequest(
          (client) =>
            client.applicationTemplates.byApplicationTemplateId(
              Constants.ENTRA_ID_NON_GALLERY_APPLICATION_TEMPLATE_ID,
            ).instantiate,
        )({ method: "post" }, { displayName }),
    );

    const createSynchronizationJob = Effect.fn("Graph.createSynchronizationJob")(
      (servicePrincipalId: string, templateId: string) =>
        batchRequest(
          (client) =>
            client.servicePrincipals.byServicePrincipalId(servicePrincipalId).synchronization.jobs,
        )({ method: "post" }, { templateId }),
    );

    const provideSynchronizationJobClientCredentials = Effect.fn(
      "Graph.provideSynchronizationJobClientCredentials",
    )(
      (
        servicePrincipalId: string,
        baseAddress: string,
        oauth2TokenExchangeUri: string,
        credentials: OauthContract.ClientCredentials,
      ) =>
        batchRequest(
          (client) =>
            client.servicePrincipals.byServicePrincipalId(servicePrincipalId).synchronization
              .secrets,
        )(
          { method: "put" },
          {
            value: [
              { key: "BaseAddress", value: baseAddress },
              { key: "Oauth2TokenExchangeUri", value: oauth2TokenExchangeUri },
              { key: "Oauth2ClientId", value: credentials.id },
              { key: "Oauth2ClientSecret", value: credentials.secret.pipe(Redacted.value) },
            ],
          },
        ),
    );

    const validateSynchronizationJobCredentials = Effect.fn(
      "Graph.validateSynchronizationJobCredentials",
    )((servicePrincipalId: string) =>
      batchRequest(
        (client) =>
          client.servicePrincipals.byServicePrincipalId(servicePrincipalId).synchronization.jobs
            .validateCredentials,
      )({ method: "post" }, { useSavedCredentials: true }),
    );

    const userPhotoResolver = RequestResolver.make<GraphUserPhotoRequest>(
      Effect.forEach(
        Effect.fn(
          function* (entry) {
            const response = yield* httpClient.get(`/users/${entry.request.id}/photo`).pipe(
              Effect.catchReason("HttpClientError", "StatusCodeError", (reason, error) =>
                Effect.fail(
                  reason.response.status === 404 ? new Cause.NoSuchElementError() : error,
                ),
              ),
              Effect.provideContext(entry.context),
            );

            const { contentType } = yield* response.pipe(
              HttpClientResponse.schemaHeaders(
                Schema.Struct({ contentType: Schema.NonEmptyString }).pipe(
                  Schema.encodeKeys({ contentType: "content-type" }),
                ),
              ),
            );
            const data = yield* response.arrayBuffer;

            return { contentType, data };
          },
          (effect, entry) =>
            effect.pipe(
              Effect.exit,
              Effect.map((exit) => entry.completeUnsafe(exit)),
            ),
        ),
      ),
    ).pipe(
      RequestResolver.setDelay(Constants.GRAPH_REQUEST_BATCH_DELAY),
      RequestResolver.batchN(Constants.GRAPH_REQUEST_BATCH_SIZE),
      RequestResolver.withSpan("Graph.userPhotoResolver"),
    );

    const userPhoto = Effect.fn("Graph.userPhoto")((id: UsersContract.ExternalId) =>
      Effect.request(new GraphUserPhotoRequest({ id }), userPhotoResolver),
    );

    return {
      me,
      groups,
      groupMembers,
      users,
      user,
      userPhoto,
      createNonGalleryApplication,
      createSynchronizationJob,
      provideSynchronizationJobClientCredentials,
      validateSynchronizationJobCredentials,
    } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

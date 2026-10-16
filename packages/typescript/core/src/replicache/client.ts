// oxlint-disable typescript/no-unsafe-type-assertion
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import { Replicache as ReplicacheClient } from "replicache";

import { Actor } from "../actors";
import * as AnnouncementsMutations from "../announcements/client/mutations/layer";
import * as AnnouncementsPolicies from "../announcements/client/policies/layer";
import * as AnnouncementsRepository from "../announcements/client/repository/layer";
import { Api } from "../api";
import * as CommentsMutations from "../comments/client/mutations/layer";
import * as CommentsPolicies from "../comments/client/policies/layer";
import * as CommentsRepository from "../comments/client/repository/layer";
import { ReadTransaction, Database, WriteTransaction } from "../database/client";
import * as DeliveryOptionsMutations from "../delivery-options/client/mutations/layer";
import * as DeliveryOptionsPolicies from "../delivery-options/client/policies/layer";
import * as DeliveryOptionsRepository from "../delivery-options/client/repository/layer";
import * as GroupMembershipsRepository from "../groups/client/memberships/repository/layer";
import * as GroupsPolicies from "../groups/client/policies/layer";
import { MutationHandlers } from "../handlers/mutations";
import * as InvoicesMutations from "../invoices/client/mutations/layer";
import * as InvoicesRepository from "../invoices/client/repository/layer";
import { MutationDispatcher } from "../mutations/client/dispatcher";
import { layer as baseMutationDispatcherLayer } from "../mutations/client/dispatcher/layer";
import * as OrdersMutations from "../orders/client/mutations/layer";
import * as OrderObjectMetadataMutations from "../orders/client/objects/mutations/layer";
import * as OrderObjectMetadataPolicies from "../orders/client/objects/policies/layer";
import * as OrderObjectMetadataRepository from "../orders/client/objects/repository/layer";
import * as OrdersPolicies from "../orders/client/policies/layer";
import * as OrdersRepository from "../orders/client/repository/layer";
import * as ProductsMutations from "../products/client/mutations/layer";
import * as ProductsPolicies from "../products/client/policies/layer";
import * as ProductsRepository from "../products/client/repository/layer";
import * as RoomsMutations from "../rooms/client/mutations/layer";
import * as RoomsPolicies from "../rooms/client/policies/layer";
import * as RoomsRepository from "../rooms/client/repository/layer";
import * as SharedAccountCustomerAccessRepository from "../shared-accounts/client/customer-access/repository/layer";
import * as SharedAccountCustomerGroupAccessRepository from "../shared-accounts/client/group-customer-access/repository/layer";
import * as SharedAccountManagerAccessMutations from "../shared-accounts/client/manager-access/mutations/layer";
import * as SharedAccountManagerAccessPolicies from "../shared-accounts/client/manager-access/policies/layer";
import * as SharedAccountManagerAccessRepository from "../shared-accounts/client/manager-access/repository/layer";
import * as SharedAccountsMutations from "../shared-accounts/client/mutations/layer";
import * as SharedAccountsPolicies from "../shared-accounts/client/policies/layer";
import * as SharedAccountsRepository from "../shared-accounts/client/repository/layer";
import * as TenantsMutations from "../tenants/client/mutations/layer";
import * as TenantsRepository from "../tenants/client/repository/layer";
import * as UsersMutations from "../users/client/mutations/layer";
import * as UsersPolicies from "../users/client/policies/layer";
import * as UsersRepository from "../users/client/repository/layer";
import { separatedString } from "../utils";
import * as RoomWorkflowsRepository from "../workflows/client/room/repository/layer";
import * as SharedAccountWorkflowsPolicies from "../workflows/client/shared-account/policies/layer";
import * as SharedAccountWorkflowsRepository from "../workflows/client/shared-account/repository/layer";
import * as WorkflowStatusesMutations from "../workflows/client/status/mutations/layer";
import * as WorkflowStatusesPolicies from "../workflows/client/status/policies/layer";
import * as WorkflowStatusesRepository from "../workflows/client/status/repository/layer";
import {
  ReplicacheContract,
  ReplicachePullerContract,
  ReplicachePusherContract,
} from "./contracts";

import type {
  Puller,
  PullerResult,
  Pusher,
  PusherResult,
  LogLevel,
  SubscribeOptions,
  WriteTransaction as ReplicacheWriteTransaction,
  ReplicacheOptions as ReplicacheClientOptions,
} from "replicache";

export namespace Replicache {
  type Mutators = Record<
    string,
    // oxlint-disable-next-line typescript/no-explicit-any
    (tx: ReplicacheWriteTransaction, args?: any) => any
  >;

  type InferMutator<
    // oxlint-disable-next-line typescript/no-explicit-any
    TMutator extends (tx: ReplicacheWriteTransaction, ...args: Array<any>) => any,
  > = TMutator extends (tx: ReplicacheWriteTransaction, ...args: infer TArgs) => infer TReturn
    ? (...args: TArgs) => TReturn extends Promise<Awaited<TReturn>> ? TReturn : Promise<TReturn>
    : never;

  type InferMutate<TMutators extends Mutators> = {
    readonly [TKey in keyof TMutators]: InferMutator<TMutators[TKey]>;
  };

  export interface ClientOptions<
    TMutators extends Mutators,
    // oxlint-disable-next-line typescript/no-empty-object-type
  > extends ReplicacheClientOptions<{}> {
    mutators: TMutators;
  }

  export class Client<TMutators extends Mutators> extends ReplicacheClient {
    // oxlint-disable-next-line no-useless-constructor
    public constructor(opts: ClientOptions<TMutators>) {
      super(opts);
    }

    public override get mutate() {
      return super.mutate as InferMutate<TMutators>;
    }
  }

  export class ClientError extends Schema.TaggedError<ClientError>()("ReplicacheClientError", {
    cause: Schema.Defect(),
  }) {}

  export class QueryError extends Schema.TaggedError<QueryError>()("ReplicacheQueryError", {
    cause: Schema.Defect(),
  }) {}

  export class SubscribeError extends Schema.TaggedError<SubscribeError>()(
    "ReplicacheSubscribeError",
    { cause: Schema.Defect() },
  ) {}

  export class MutateError extends Schema.TaggedError<MutateError>()("ReplicacheMutateError", {
    cause: Schema.Defect(),
  }) {}

  export class PullError extends Schema.TaggedError<PullError>()("ReplicachePullError", {
    cause: Schema.Defect(),
  }) {}

  export class CloseError extends Schema.TaggedError<CloseError>()("ReplicacheCloseError", {
    cause: Schema.Defect(),
  }) {}

  export const repositoriesLayer = Layer.mergeAll(
    AnnouncementsRepository.layer,
    CommentsRepository.layer,
    DeliveryOptionsRepository.layer,
    GroupMembershipsRepository.layer,
    InvoicesRepository.layer,
    OrderObjectMetadataRepository.layer,
    ProductsRepository.layer,
    RoomsRepository.layer,
    SharedAccountsRepository.layer,
    TenantsRepository.layer,
    UsersRepository.layer,
    RoomWorkflowsRepository.layer,
    SharedAccountWorkflowsRepository.layer,
  ).pipe(
    Layer.provideMerge(OrdersRepository.layer),
    Layer.provideMerge([
      WorkflowStatusesRepository.layer,
      SharedAccountManagerAccessRepository.layer,
      SharedAccountCustomerAccessRepository.layer,
      SharedAccountManagerAccessRepository.layer,
      SharedAccountCustomerGroupAccessRepository.layer,
    ]),
    Layer.provide(Database.layer),
  );

  export const policiesLayer = Layer.mergeAll(
    AnnouncementsPolicies.layer,
    CommentsPolicies.layer,
    DeliveryOptionsPolicies.layer,
    GroupsPolicies.layer,
    OrderObjectMetadataPolicies.layer,
    ProductsPolicies.layer,
    RoomsPolicies.layer,
    SharedAccountsPolicies.layer,
    SharedAccountManagerAccessPolicies.layer,
    UsersPolicies.layer,
    WorkflowStatusesPolicies.layer,
  ).pipe(
    Layer.provideMerge([OrdersPolicies.layer, SharedAccountWorkflowsPolicies.layer]),
    Layer.provide(repositoriesLayer),
  );

  export const mutationDispatcherLayer = baseMutationDispatcherLayer.pipe(
    Layer.provide([
      AnnouncementsMutations.layer,
      CommentsMutations.layer,
      DeliveryOptionsMutations.layer,
      InvoicesMutations.layer,
      OrdersMutations.layer,
      OrderObjectMetadataMutations.layer,
      ProductsMutations.layer,
      RoomsMutations.layer,
      SharedAccountsMutations.layer,
      SharedAccountManagerAccessMutations.layer,
      TenantsMutations.layer,
      UsersMutations.layer,
      WorkflowStatusesMutations.layer,
    ]),
    Layer.provide([policiesLayer, repositoriesLayer]),
  );

  export interface Options {
    baseUrl: URL;
    logLevel: LogLevel;
  }

  export const make = Effect.fn(function* (opts: Options) {
    const { baseUrl, logLevel } = opts;

    const user = yield* Actor.pipe(Effect.flatMap(Struct.get("assertUser")));

    const name = yield* Schema.encodeEffect(separatedString())([user.tenantId, user.id]);

    const mutatorRuntime = Actor.layer(user.wrap).pipe(
      Layer.merge(mutationDispatcherLayer),
      ManagedRuntime.make,
    );

    const mutators = Record.map(
      MutationHandlers.registry.record,
      (mutation) => (tx: ReplicacheWriteTransaction, args: typeof mutation.Input.Type) =>
        MutationDispatcher.use((dispatcher) => dispatcher.dispatch(mutation.name, args)).pipe(
          Effect.provideService(ReadTransaction, tx),
          Effect.provideService(WriteTransaction, tx),
          mutatorRuntime.runPromiseExit,
        ),
    ) as {
      readonly [TKey in keyof MutationHandlers.Record]: (
        tx: ReplicacheWriteTransaction,
        args: MutationHandlers.Record[TKey]["Input"]["Type"],
      ) => Promise<
        Exit.Exit<
          MutationHandlers.Record[TKey]["Output"]["Type"],
          Effect.Error<ReturnType<typeof MutationDispatcher.Service.dispatch<TKey>>>
        >
      >;
    };

    const server = yield* HttpClient.HttpClient.pipe(
      Effect.map(HttpClient.filterStatusOk),
      Effect.flatMap((httpClient) =>
        HttpApiClient.group(Api, { baseUrl, httpClient, group: "Replicache" }),
      ),
    );

    const decodeCookie = ReplicachePullerContract.Cookie.pipe(Schema.decodeUnknownEffect);

    const puller = (...[request, id]: Parameters<Puller>) =>
      decodeCookie(request.cookie).pipe(
        Effect.map((cookie) => ({ ...request, cookie })),
        Effect.flatMap(Schema.decodeEffect(ReplicachePullerContract.Request)),
        Effect.filterOrElse(ReplicachePullerContract.isRequestV1, () =>
          Effect.die(ReplicacheContract.VersionNotSupportedError.new("pull")),
        ),
        Effect.flatMap((payload) =>
          server.pull({
            payload,
            headers: { "X-Replicache-RequestID": id },
            responseMode: "decoded-and-response",
          }),
        ),
        Effect.map(([response, { status: httpStatusCode }]) => ({
          response,
          httpRequestInfo: { httpStatusCode, errorMessage: "" },
        })),
        Effect.catchReason("HttpClientError", "StatusCodeError", (error) =>
          Effect.succeed({
            httpRequestInfo: {
              httpStatusCode: error.response.status,
              errorMessage: error.message,
            },
          }),
        ),
        Effect.catch((error) =>
          Effect.succeed({
            httpRequestInfo: {
              httpStatusCode: "response" in error ? (error.response?.status ?? 500) : 500,
              errorMessage: "message" in error ? error.message : "An unknown error occurred",
            },
          }),
        ),
        Effect.runPromise,
      ) as Promise<PullerResult>;

    const pusher = (...[request, id]: Parameters<Pusher>) =>
      Effect.succeed(request).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(ReplicachePusherContract.Request)),
        Effect.filterOrElse(ReplicachePusherContract.isRequestV1, () =>
          Effect.die(ReplicacheContract.VersionNotSupportedError.new("push")),
        ),
        Effect.flatMap((payload) =>
          server.push({
            payload,
            headers: { "X-Replicache-RequestID": id },
            responseMode: "decoded-and-response",
          }),
        ),
        Effect.map(([response, { status: httpStatusCode }]) => ({
          response,
          httpRequestInfo: { httpStatusCode, errorMessage: "" },
        })),
        Effect.catchReason("HttpClientError", "StatusCodeError", (error) =>
          Effect.succeed({
            httpRequestInfo: {
              httpStatusCode: error.response.status,
              errorMessage: error.message,
            },
          }),
        ),
        Effect.catch((error) =>
          Effect.succeed({
            httpRequestInfo: {
              httpStatusCode: "response" in error ? (error.response?.status ?? 500) : 500,
              errorMessage: "message" in error ? error.message : "An unknown error occurred",
            },
          }),
        ),
        Effect.runPromise,
      ) as Promise<PusherResult>;

    const client = yield* Effect.try({
      try: () => new Client({ name, mutators, puller, pusher, logLevel }),
      catch: (cause) => new ClientError({ cause }),
    });

    const clientGroupId = Effect.tryPromise({
      try: () => client.clientGroupID,
      catch: (cause) => new ClientError({ cause }),
    }).pipe(Effect.flatMap((id) => ReplicacheContract.ClientGroupId.makeEffect(id)));

    const query = <TSuccess, TError, TServices>(
      query: Effect.Effect<TSuccess, TError, TServices | ReadTransaction>,
    ) =>
      Effect.context<TServices>().pipe(
        Effect.flatMap((context) =>
          Effect.tryPromise({
            try: (signal) =>
              client.query((tx) =>
                query.pipe(Effect.provideService(ReadTransaction, tx), (query) =>
                  Effect.runPromiseExitWith(context)(query, { signal }),
                ),
              ),
            catch: (cause) => new QueryError({ cause }),
          }),
        ),
        Effect.flatMap(
          Exit.match({
            onSuccess: Effect.succeed<TSuccess>,
            // Propagate errors back into effect
            onFailure: (cause) =>
              cause.pipe(
                Cause.findError,
                Result.match({ onSuccess: Effect.fail<TError>, onFailure: Effect.die }),
              ),
          }),
        ),
      );

    const subscribe = <TSuccess, TError, TServices>(
      query: Effect.Effect<TSuccess, TError, TServices | ReadTransaction>,
      opts: Omit<SubscribeOptions<TSuccess>, "isEqual">,
    ) =>
      Effect.context<TServices>().pipe(
        Effect.flatMap((context) =>
          Effect.try({
            try: () =>
              client.subscribe(
                (tx) =>
                  query.pipe(
                    Effect.provideService(ReadTransaction, tx),
                    Effect.runPromiseWith(context),
                  ),
                { ...opts, isEqual: Equal.equals },
              ),
            catch: (cause) => new SubscribeError({ cause }),
          }),
        ),
      );

    const mutate = <TName extends keyof MutationHandlers.Record>(
      name: TName,
      args: MutationHandlers.Record[TName]["Input"]["Type"],
    ) =>
      Effect.tryPromise({
        try: () => client.mutate[name](args),
        catch: (cause) => new MutateError({ cause }),
      }).pipe(
        Effect.flatMap(
          Exit.match({
            onSuccess: Effect.succeed,
            // Propagate errors back into effect
            onFailure: (cause) =>
              cause.pipe(
                Cause.findError,
                Result.match({ onSuccess: Effect.fail, onFailure: Effect.die }),
              ),
          }),
        ),
      );

    const pull = Effect.tryPromise({
      try: () => client.pull(),
      catch: (cause) => new PullError({ cause }),
    });

    const close = Effect.tryPromise({
      try: () => client.close(),
      catch: (cause) => new CloseError({ cause }),
    });

    return {
      clientGroupId,
      query,
      subscribe,
      mutate,
      pull,
      close,
    } as const;
  });

  export type Replicache = Effect.Success<ReturnType<typeof make>>;
}

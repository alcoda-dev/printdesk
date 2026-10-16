import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as RequestResolver from "effect/RequestResolver";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Stream from "effect/Stream";
import * as Tuple from "effect/Tuple";

import { PapercutMfApi, PapercutMfApiRequest, sharedAccountPropertySchemas } from ".";
import { Actor } from "../../actors";
import { Config } from "../../config";
import { GroupsContract } from "../../groups/contracts";
import { Oauth } from "../../oauth";
import { SharedAccountsContract } from "../../shared-accounts/contracts";
import { SstResource } from "../../sst/resource";
import { UsersContract } from "../../users/contract";
import { Constants } from "../../utils/constants";
import { XmlRpcContract } from "../../xml/contracts";
import { XmlRpc } from "../../xml/rpc";
import { PapercutMfContract } from "../contract";

import type { ActorsContract } from "../../actors/contract";
import type { OauthContract } from "../../oauth/contract";
import type { SharedAccountPropertySchemas } from ".";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const config = yield* Config;
  const resource = yield* SstResource;
  const xmlRpc = yield* XmlRpc.XmlRpc;

  const baseHttpClient = yield* HttpClient.HttpClient;
  const httpClientCache = yield* Cache.make({
    capacity: Constants.DEFAULT_CACHE_CAPACITY,
    lookup: Effect.fn(function* (key: {
      actor: ActorsContract.Actor;
      accessToken: OauthContract.Tokens["access"];
    }) {
      const baseUrl = yield* key.actor.tenantId.pipe(
        Effect.map(
          (tenantId) =>
            `https://${resource.Hostnames.pipe(Redacted.value).api}/${tenantId}/papercut/mf`,
        ),
      );

      return baseHttpClient.pipe(
        HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
        HttpClient.mapRequest(
          HttpClientRequest.setHeader(
            "Proxy-Authorization",
            `Bearer ${key.accessToken.pipe(Redacted.value)}`,
          ),
        ),
        HttpClient.filterStatusOk,
      );
    }),
  });

  const resolver = RequestResolver.make<PapercutMfApiRequest>(
    Effect.forEach((entry) =>
      httpClientCache.pipe(
        Cache.get({
          actor: entry.context.pipe(Context.get(Actor)),
          accessToken: entry.context.pipe(Context.get(Oauth.AccessToken)),
        }),
        Effect.flatMap((client) => client.execute(entry.request)),
        Effect.exit,
        Effect.map((exit) => entry.completeUnsafe(exit)),
      ),
    ),
  ).pipe(
    RequestResolver.setDelay(Constants.PAPERCUT_MF_API_REQUEST_BATCH_DELAY),
    RequestResolver.batchN(Constants.PAPERCUT_MF_API_REQUEST_BATCH_SIZE),
    RequestResolver.withSpan("PapercutMf.Api.resolver"),
  );

  const batchRequest = Effect.fn("PapercutMf.Api.batchRequest")(
    (request: HttpClientRequest.HttpClientRequest) =>
      Effect.request(new PapercutMfApiRequest(request), resolver),
  );

  const adjustSharedAccountAccountBalance = Effect.fn(
    "PapercutMf.Api.adjustSharedAccountAccountBalance",
  )((sharedAccountName: string, amount: number, comment: string) =>
    config.getPapercutMfApiAuthToken.pipe(
      Effect.flatMap((authToken) =>
        xmlRpc.request("api.adjustSharedAccountAccountBalance", [
          XmlRpc.string(authToken.pipe(Redacted.value)),
          XmlRpc.string(sharedAccountName),
          XmlRpc.double(amount),
          XmlRpc.string(comment),
        ]),
      ),
      Effect.flatMap(batchRequest),
      Effect.flatMap(xmlRpc.response(XmlRpcContract.BooleanResponse)),
      Effect.filterOrFail(
        Predicate.isTruthy,
        () => new PapercutMfContract.SharedAccountBalanceAdjustmentFailure(),
      ),
      Effect.asVoid,
    ),
  );

  const getGroupMembers = Effect.fn("PapercutMf.Api.getGroupMembers")(
    (groupName: string, offset: number, limit: number) =>
      config.getPapercutMfApiAuthToken.pipe(
        Effect.flatMap((authToken) =>
          xmlRpc.request("api.getGroupMembers", [
            XmlRpc.string(authToken.pipe(Redacted.value)),
            XmlRpc.string(groupName),
            XmlRpc.int(offset),
            XmlRpc.int(limit),
          ]),
        ),
        Effect.flatMap(batchRequest),
        Effect.flatMap(
          xmlRpc.response(
            XmlRpcContract.arrayResponse(
              XmlRpcContract.Value.fields.value.pipe(
                Schema.decodeTo(UsersContract.Username, SchemaTransformation.passthrough()),
              ),
            ),
          ),
        ),
      ),
  );

  const getGroupMembersStream = (groupName: string) =>
    Stream.paginate(0, (offset) =>
      getGroupMembers(groupName, offset, Constants.PAPERCUT_MF_API_PAGINATION_LIMIT).pipe(
        Effect.map((page) =>
          Tuple.make(
            page,
            page.length >= Constants.PAPERCUT_MF_API_PAGINATION_LIMIT
              ? Option.some(offset + page.length)
              : Option.none(),
          ),
        ),
      ),
    ).pipe(Stream.withSpan("PapercutMf.Api.getGroupMembersStream"));

  const getSharedAccountProperties = <
    const TPropertyKeys extends Array<keyof SharedAccountPropertySchemas>,
  >(
    sharedAccountName: string,
    ...propertyKeys: TPropertyKeys
  ) =>
    config.getPapercutMfApiAuthToken.pipe(
      Effect.flatMap((authToken) =>
        xmlRpc.request("api.getSharedAccountProperties", [
          XmlRpc.string(authToken.pipe(Redacted.value)),
          XmlRpc.string(sharedAccountName),
          XmlRpc.stringArray(propertyKeys),
        ]),
      ),
      Effect.flatMap(batchRequest),
      Effect.flatMap(
        xmlRpc.response(
          XmlRpcContract.tupleResponse(
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion effecttsgo/prefer-effect-array
            ...(propertyKeys.map((key) => sharedAccountPropertySchemas[key]) as {
              [TKey in keyof TPropertyKeys]: SharedAccountPropertySchemas[TPropertyKeys[TKey]];
            }),
          ),
        ),
      ),
      Effect.withSpan("PapercutMf.Api.getSharedAccountProperties"),
    );

  const getTaskStatus = xmlRpc
    .request("api.getTaskStatus", [])
    .pipe(
      Effect.flatMap(batchRequest),
      Effect.flatMap(
        xmlRpc.response(
          XmlRpcContract.structResponse(
            XmlRpcContract.member("completed", XmlRpcContract.Boolean.fields.value),
            XmlRpcContract.member("message", XmlRpcContract.Value.fields.value),
          ),
        ),
      ),
      Effect.withSpan("PapercutMf.Api.getTaskStatus"),
    );

  const getTotalUsers = config.getPapercutMfApiAuthToken.pipe(
    Effect.flatMap((authToken) =>
      xmlRpc.request("api.getTotalUsers", [XmlRpc.string(authToken.pipe(Redacted.value))]),
    ),
    Effect.flatMap(batchRequest),
    Effect.flatMap(xmlRpc.response(XmlRpcContract.IntResponse)),
    Effect.withSpan("PapercutMf.Api.getTotalUsers"),
  );

  const listSharedAccounts = Effect.fn("PapercutMf.Api.listSharedAccounts")(
    (offset: number, limit: number) =>
      config.getPapercutMfApiAuthToken.pipe(
        Effect.flatMap((authToken) =>
          xmlRpc.request("api.listSharedAccounts", [
            XmlRpc.string(authToken.pipe(Redacted.value)),
            XmlRpc.int(offset),
            XmlRpc.int(limit),
          ]),
        ),
        Effect.flatMap(batchRequest),
        Effect.flatMap(
          xmlRpc.response(
            XmlRpcContract.arrayResponse(
              XmlRpcContract.Value.fields.value.pipe(
                Schema.decodeTo(SharedAccountsContract.Name, SchemaTransformation.passthrough()),
              ),
            ),
          ),
        ),
      ),
  );

  const listSharedAccountsStream = Stream.paginate(0, (offset) =>
    listSharedAccounts(offset, Constants.PAPERCUT_MF_API_PAGINATION_LIMIT).pipe(
      Effect.map((page) =>
        Tuple.make(
          page,
          page.length >= Constants.PAPERCUT_MF_API_PAGINATION_LIMIT
            ? Option.some(offset + page.length)
            : Option.none(),
        ),
      ),
    ),
  ).pipe(Stream.withSpan("PapercutMf.Api.listSharedAccountsStream"));

  const listUserAccounts = Effect.fn("PapercutMf.Api.listUserAccounts")(
    (offset: number, limit: number) =>
      config.getPapercutMfApiAuthToken.pipe(
        Effect.flatMap((authToken) =>
          xmlRpc.request("api.listUserAccounts", [
            XmlRpc.string(authToken.pipe(Redacted.value)),
            XmlRpc.int(offset),
            XmlRpc.int(limit),
          ]),
        ),
        Effect.flatMap(batchRequest),
        Effect.flatMap(
          xmlRpc.response(
            XmlRpcContract.arrayResponse(
              XmlRpcContract.Value.fields.value.pipe(
                Schema.decodeTo(UsersContract.Username, SchemaTransformation.passthrough()),
              ),
            ),
          ),
        ),
      ),
  );

  const listUserAccountsStream = Stream.paginate(0, (offset) =>
    listUserAccounts(offset, Constants.PAPERCUT_MF_API_PAGINATION_LIMIT).pipe(
      Effect.map((page) =>
        Tuple.make(
          page,
          page.length >= Constants.PAPERCUT_MF_API_PAGINATION_LIMIT
            ? Option.some(offset + page.length)
            : Option.none(),
        ),
      ),
    ),
  ).pipe(Stream.withSpan("PapercutMf.Api.listUserAccountsStream"));

  const listUserGroups = Effect.fn("PapercutMf.Api.listUserGroups")(
    (offset: number, limit: number) =>
      config.getPapercutMfApiAuthToken.pipe(
        Effect.flatMap((authToken) =>
          xmlRpc.request("api.listUserGroups", [
            XmlRpc.string(authToken.pipe(Redacted.value)),
            XmlRpc.int(offset),
            XmlRpc.int(limit),
          ]),
        ),
        Effect.flatMap(batchRequest),
        Effect.flatMap(
          xmlRpc.response(
            XmlRpcContract.arrayResponse(
              XmlRpcContract.Value.fields.value.pipe(
                Schema.decodeTo(GroupsContract.Name, SchemaTransformation.passthrough()),
              ),
            ),
          ),
        ),
      ),
  );

  const listUserGroupsStream = Stream.paginate(0, (offset) =>
    listUserGroups(offset, Constants.PAPERCUT_MF_API_PAGINATION_LIMIT).pipe(
      Effect.map((page) =>
        Tuple.make(
          page,
          page.length >= Constants.PAPERCUT_MF_API_PAGINATION_LIMIT
            ? Option.some(offset + page.length)
            : Option.none(),
        ),
      ),
    ),
  ).pipe(Stream.withSpan("PapercutMf.Api.listUserGroupsStream"));

  const performUserAndGroupSync = config.getPapercutMfApiAuthToken.pipe(
    Effect.flatMap((authToken) =>
      xmlRpc.request("api.performUserAndGroupSync", [
        XmlRpc.string(authToken.pipe(Redacted.value)),
      ]),
    ),
    Effect.flatMap(batchRequest),
    Effect.flatMap(xmlRpc.response(XmlRpcContract.BooleanResponse)),
    Effect.filterOrFail(Predicate.isTruthy, () => new PapercutMfContract.UserAndGroupSyncFailure()),
    Effect.asVoid,
    Effect.withSpan("PapercutMf.Api.performUserAndGroupSync"),
  );

  return {
    adjustSharedAccountAccountBalance,
    getGroupMembers,
    getGroupMembersStream,
    getSharedAccountProperties,
    getTaskStatus,
    getTotalUsers,
    listSharedAccounts,
    listSharedAccountsStream,
    listUserAccounts,
    listUserAccountsStream,
    listUserGroups,
    listUserGroupsStream,
    performUserAndGroupSync,
  } as const;
});

export const layer = makeService.pipe(Layer.effect(PapercutMfApi));

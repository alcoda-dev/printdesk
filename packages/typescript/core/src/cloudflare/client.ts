import _CloudflareClient from "cloudflare";
import * as Array from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { Cloudflare } from ".";
import { Crypto } from "../crypto";
import { CloudflareContract } from "./contract";

import type { MessagePushParams } from "cloudflare/resources/queues";
import type { DistributivePick } from "../utils";

export class CloudflareClientError extends Schema.TaggedError<
  CloudflareClientError,
  { readonly brand: unique symbol }
>()("CloudflareClientError", { cause: Schema.Defect() }) {}

export interface CloudflareR2TemporaryCredentialsOptions {
  bucket: string;
  endpoint: string;
  scope: "admin-read-only" | "admin-read-write" | "object-read-only" | "object-read-write";
  actions?: Array.NonEmptyArray<string>;
  ttl?: Duration.Duration;
  paths?: {
    prefix?: Array.NonEmptyArray<string>;
    object?: Array.NonEmptyArray<string>;
  };
}

export class CloudflareClient extends Context.Service<CloudflareClient>()(
  "@printdesk/core/cloudflare/Client",
  {
    make: Effect.gen(function* () {
      const { account, apiToken } = yield* Cloudflare;
      const crypto = yield* Crypto;

      const client = yield* Effect.try({
        try: () => new _CloudflareClient({ apiToken: apiToken.pipe(Redacted.value) }),
        catch: (cause) => new CloudflareClientError({ cause }),
      });

      const getTunnelToken = Effect.fn("CloudflareClient.getTunnelToken")(
        (tunnelId: CloudflareContract.TunnelId) =>
          Effect.tryPromise({
            try: (signal) =>
              client.zeroTrust.tunnels.cloudflared.token.get(
                tunnelId,
                { account_id: account.id },
                { signal },
              ),
            catch: (cause) => new CloudflareClientError({ cause }),
          }).pipe(Effect.flatMap(Schema.decodeEffect(CloudflareContract.TunnelToken))),
      );

      const refreshTunnelToken = Effect.fn("CloudflareClient.refreshTunnelToken")(
        (tunnelId: CloudflareContract.TunnelId) =>
          crypto.generateToken().pipe(
            Effect.map(Redacted.value),
            Effect.flatMap((tunnel_secret) =>
              Effect.tryPromise({
                try: (signal) =>
                  client.zeroTrust.tunnels.cloudflared.edit(
                    tunnelId,
                    { account_id: account.id, tunnel_secret },
                    { signal },
                  ),
                catch: (cause) => new CloudflareClientError({ cause }),
              }),
            ),
            Effect.andThen(getTunnelToken(tunnelId)),
          ),
      );

      const pushQueueMessage = Effect.fn("CloudflareClient.pushQueueMessage")(
        (queueId: string, params: DistributivePick<MessagePushParams, "body" | "content_type">) =>
          Effect.tryPromise({
            try: (signal) =>
              client.queues.messages.push(
                queueId,
                { ...params, account_id: account.id },
                { signal },
              ),
            catch: (cause) => new CloudflareClientError({ cause }),
          }),
      );

      return {
        getTunnelToken,
        refreshTunnelToken,
        pushQueueMessage,
      } as const;
    }),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

import { getConnInfo } from "@hono/cloudflare-workers";
import { AttributesContract } from "@printdesk/core/attributes/contract";
import * as Match from "effect/Match";
import * as NetAddress from "effect/net/NetAddress";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { createMiddleware } from "hono/factory";

import { resource } from "../lib/sst";

export const ratelimit = (service: string) =>
  createMiddleware((c, next) =>
    Match.value(c.get("actor").properties).pipe(
      Match.tag(
        "ClientActor",
        (client) =>
          new AttributesContract.ServiceTenantClientId({
            service,
            tenantId: client.tenantId,
            clientId: client.id,
          }),
      ),
      Match.tag(
        "UserActor",
        (user) =>
          new AttributesContract.ServiceTenantUserId({
            service,
            tenantId: user.tenantId,
            userId: user.id,
          }),
      ),
      Match.tag(
        "PublicActor",
        () =>
          new AttributesContract.ServiceIp({
            service,
            ip: Option.fromUndefinedOr(getConnInfo(c).remote.address).pipe(
              Option.getOrThrow,
              NetAddress.ipFromStringUnsafe,
            ),
          }),
      ),
      Match.orElseAbsurd,
      // oxlint-disable-next-line effecttsgo/schema-sync
      Schema.encodeSync(
        Schema.Union([
          AttributesContract.ServiceTenantClientIdFromString,
          AttributesContract.ServiceTenantUserIdFromString,
          AttributesContract.ServiceIpFromString,
        ]),
      ),

      (key) => resource.RateLimit.pipe(Redacted.value).limit({ key }).then(next),
    ),
  );

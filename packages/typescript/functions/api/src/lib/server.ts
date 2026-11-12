// oxlint-disable-next-line effecttsgo/node-builtin-import
import { createServer } from "node:http";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { hostPort } from "@printdesk/core/src/aws/lambda/web-function";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Effect from "effect/Effect";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";

export const httpServerLayer = hostPort.pipe(
  Effect.map(({ host, port }) =>
    NodeHttpServer.layer(createServer, { host: host.toString(), port }),
  ),
  Layer.unwrap,
  Layer.provide(SstResource.layer),
  Layer.merge(HttpServer.layerServices),
);

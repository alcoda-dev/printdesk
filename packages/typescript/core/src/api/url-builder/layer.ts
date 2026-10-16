import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { ApiUrlBuilder } from ".";
import { Api } from "..";
import { SstResource } from "../../sst/resource";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = SstResource.useSync(Struct.get("Hostnames")).pipe(
  Effect.map(Redacted.value),
  Effect.map((hostnames) =>
    HttpApiClient.urlBuilder(Api, { baseUrl: new URL(`https://${hostnames.api}`) }),
  ),
);

export const layer = makeService.pipe(Layer.effect(ApiUrlBuilder));

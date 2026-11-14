import { Aws } from "@printdesk/core/src/aws";
import { SstResource } from "@printdesk/core/sst/resource";
import * as Layer from "effect/Layer";
import * as Struct from "effect/Struct";

export const awsLayer = SstResource.useSync(Struct.get("Aws")).pipe(
  Layer.effect(Aws),
  Layer.provide(SstResource.layer),
);

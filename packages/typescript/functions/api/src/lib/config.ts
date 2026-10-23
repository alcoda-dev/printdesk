import { Appconfig } from "@printdesk/core/aws/appconfig";
import { AppconfigAgent } from "@printdesk/core/aws/appconfig/agent";
import * as Config from "@printdesk/core/config/layer";
import { SstResource } from "@printdesk/core/sst/resource";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";

export const configLayer = Config.layer.pipe(
  Layer.provide(AppconfigAgent.layer),
  Layer.provide([Appconfig.layer, FetchHttpClient.layer]),
  Layer.provide(SstResource.layer),
);

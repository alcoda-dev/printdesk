import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { SstResource } from "../../sst/resource";

export class AppconfigAgent extends Context.Service<AppconfigAgent>()(
  "@printdesk/core/aws/AppconfigAgent",
  {
    make: Effect.gen(function* () {
      const resource = yield* SstResource;

      const port = resource.AppconfigAgent.pipe(Redacted.value).port;
      const application = resource.AppconfigApplication.pipe(Redacted.value).name;
      const environment = resource.AppconfigEnvironment.pipe(Redacted.value).name;

      const httpClient = yield* HttpClient.HttpClient.pipe(
        Effect.map(HttpClient.mapRequest(HttpClientRequest.prependUrl(`http://localhost:${port}`))),
        Effect.map(HttpClient.filterStatusOk),
      );

      const getConfiguration = Effect.fn("AppconfigAgent.getConfiguration")(
        <TType, TServices>(name: string, Decoder: Schema.ConstraintDecoder<TType, TServices>) =>
          HttpClientRequest.get(
            `/applications/${application}/environments/${environment}/configurations/${name}`,
          ).pipe(httpClient.execute, Effect.flatMap(HttpClientResponse.schemaBodyJson(Decoder))),
      );

      return { getConfiguration } as const;
    }),
  },
) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}

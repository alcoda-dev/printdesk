import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Host from "effect/net/Host";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";

import { SstResource } from "../../sst/resource";
import { Constants } from "../../utils/constants";

export const hostPort = Effect.gen(function* () {
  if (
    yield* SstResource.useSync(Struct.get("Environment")).pipe(
      Effect.map(Redacted.value),
      Effect.map(Struct.get("isDevMode")),
    )
  )
    return yield* Config.Port(Constants.WEB_FUNCTION_ENV.DEV_SERVER_PORT).pipe(
      Effect.map((port) => ({ host: "localhost", port })),
    );

  return yield* Config.NonEmptyString(Constants.WEB_FUNCTION_ENV.HTTP_ENDPOINT);
}).pipe(Effect.map(Host.hostPortFromInput), Effect.flatMap(Effect.fromResult));

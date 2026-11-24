import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Host from "effect/net/Host";

export const hostPort = Config.NonEmptyString("AWS_LAMBDA_HTTP_ENDPOINT").pipe(
  Effect.map(Host.hostPortFromInput),
  Effect.flatMap(Effect.fromResult),
);

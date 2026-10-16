import * as Effect from "effect/Effect";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { IdentityProvidersContract } from "../identity/contract";
import { Constants } from "../utils/constants";

import type { Provider } from "@openauthjs/openauth/provider/provider";

const notImplementedResponse = () =>
  new IdentityProvidersContract.NotImplementedError({ kind: Constants.GOOGLE }).pipe(
    HttpServerRespondable.toResponse,
    Effect.map(HttpServerResponse.toWeb),
    Effect.runPromise,
  );

export const GoogleProvider = () =>
  ({
    type: Constants.GOOGLE,
    init(routes) {
      routes.get("/authorize", notImplementedResponse);
      routes.get("/callback", notImplementedResponse);
    },
  }) satisfies Provider;

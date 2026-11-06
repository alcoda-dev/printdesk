import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as LayerMap from "effect/LayerMap";

import { Constants } from "../utils/constants";

import type { OauthContract } from "./contract";
import type { ServiceShape } from "./layer";

export namespace Oauth {
  export class Oauth extends Context.Service<Oauth, ServiceShape>()("@printdesk/core/oauth/Oauth") {
    public static readonly verifyClient = (
      ...args: Parameters<(typeof this)["Service"]["verifyClient"]>
    ) => this.use((oauth) => oauth.verifyClient(...args));

    public static readonly verifyUser = (
      ...args: Parameters<(typeof this)["Service"]["verifyUser"]>
    ) => this.use((oauth) => oauth.verifyUser(...args));
  }

  // @effect-leakable-service
  export class AccessToken extends Context.Service<AccessToken, OauthContract.Tokens["access"]>()(
    "@printdesk/core/oauth/AccessToken",
  ) {
    public static readonly layer = (token: typeof AccessToken.Service) =>
      Layer.succeed(this, this.of(token)).pipe(Layer.fresh);
  }

  export class AccessTokenLayerMap extends LayerMap.Service<AccessTokenLayerMap>()(
    "@printdesk/core/oauth/AccessTokenLayerMap",
    { lookup: AccessToken.layer, idleTimeToLive: Constants.DEFAULT_LAYER_MAP_IDLE_TTL },
  ) {}
}

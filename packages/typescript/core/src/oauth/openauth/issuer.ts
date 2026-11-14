import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

export class OpenauthExternalIssuer extends Context.Service<OpenauthExternalIssuer, URL>()(
  "@printdesk/core/oauth/OpenauthExternalIssuer",
) {
  public static readonly layerFromHost = (host: string) =>
    Layer.succeed(this, new URL(`https://${host}`));
}

export class OpenauthInternalIssuer extends Context.Service<OpenauthInternalIssuer, URL>()(
  "@printdesk/core/oauth/OpenauthInternalIssuer",
) {
  public static readonly layerFromString = (url: string) => Layer.succeed(this, new URL(url));
}

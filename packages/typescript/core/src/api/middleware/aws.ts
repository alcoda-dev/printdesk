// oxlint-disable effecttsgo/strict-effect-provide
import * as Effect from "effect/Effect";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import * as Layer from "effect/Layer";

import { Actor } from "../../actors";
import { ActorsContract } from "../../actors/contract";
import { AwsCredentialIdentityProviderError } from "../../aws/credential-identity";
import { AppconfigCredentialIdentityProviderLayerMap } from "../../aws/credential-identity/appconfig";
import {
  AppsyncPublisherCredentialIdentityProviderLayerMap,
  AppsyncSubscriberCredentialIdentityProviderLayerMap,
} from "../../aws/credential-identity/appsync";
import { R2CredentialIdentityProviderLayerMap } from "../../aws/credential-identity/r2";

import type { AwsCredentialIdentityProvider } from "../../aws/credential-identity";

export class AwsCredentialIdentityProviderMiddleware extends HttpApiMiddleware.Service<
  AwsCredentialIdentityProviderMiddleware,
  { requires: Actor; provides: AwsCredentialIdentityProvider }
>()("@printdesk/core/api/AwsCredentialIdentityProviderMiddleware", {
  error: [ActorsContract.ForbiddenActorError, AwsCredentialIdentityProviderError],
}) {
  public static readonly makeAppconfig = AppconfigCredentialIdentityProviderLayerMap.provide.pipe(
    Effect.map(this.of),
  );
  public static readonly appconfigLayer = this.makeAppconfig.pipe(
    Layer.effect(AwsCredentialIdentityProviderMiddleware),
  );

  public static readonly makeAppsyncPublisher =
    AppsyncPublisherCredentialIdentityProviderLayerMap.provide.pipe(Effect.map(this.of));
  public static readonly appsyncPublisherLayer = this.makeAppsyncPublisher.pipe(
    Layer.effect(AwsCredentialIdentityProviderMiddleware),
  );

  public static readonly makeAppsyncSubscriber =
    AppsyncSubscriberCredentialIdentityProviderLayerMap.provide.pipe(Effect.map(this.of));
  public static readonly appsyncSubscriberLayer = this.makeAppsyncSubscriber.pipe(
    Layer.effect(AwsCredentialIdentityProviderMiddleware),
  );

  public static readonly makeR2 = R2CredentialIdentityProviderLayerMap.provide.pipe(
    Effect.map(this.of),
  );
  public static readonly r2Layer = this.makeR2.pipe(
    Layer.effect(AwsCredentialIdentityProviderMiddleware),
  );
}

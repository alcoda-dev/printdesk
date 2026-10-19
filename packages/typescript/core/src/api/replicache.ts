import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AccessControl } from "../access-control";
import { ActorsContract } from "../actors/contract";
import {
  ReplicacheContract,
  ReplicachePullerContract,
  ReplicachePusherContract,
} from "../replicache/contracts";
import { AwsCredentialIdentityProviderMiddleware } from "./middleware/aws";

export namespace Replicache {
  export class Group extends HttpApiGroup.make("Replicache")
    .add(
      HttpApiEndpoint.post("pull", "/pull", {
        headers: ReplicacheContract.Headers,
        payload: ReplicachePullerContract.Payload,
        success: ReplicachePullerContract.Success,
        error: [AccessControl.AccessDeniedError, ActorsContract.ForbiddenActorError],
      }),
    )
    .add(
      HttpApiEndpoint.post("push", "/push", {
        headers: ReplicacheContract.Headers,
        payload: ReplicachePusherContract.Payload,
        success: ReplicachePusherContract.Success,
        error: [
          AccessControl.AccessDeniedError,
          ActorsContract.ForbiddenActorError,
          ReplicachePusherContract.FutureMutationError,
        ],
      }).middleware(AwsCredentialIdentityProviderMiddleware),
    ) {}

  export class Api extends HttpApi.make("ReplicacheApi").add(Group) {}
}

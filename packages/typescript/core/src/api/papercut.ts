import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AccessControl } from "../access-control";
import { ActorsContract } from "../actors/contract";
import { PapercutMfContract } from "../papercut-mf/contract";
import { AwsCredentialIdentityProviderMiddleware } from "./middleware/aws";

export namespace Papercut {
  export class Mf extends HttpApiGroup.make("PapercutMf")
    .add(
      HttpApiEndpoint.get("health", "/health", {
        success: PapercutMfContract.HealthSuccess,
        error: [ActorsContract.ForbiddenActorError, AccessControl.AccessDeniedError],
      }).middleware(AwsCredentialIdentityProviderMiddleware),
    )
    .add(
      HttpApiEndpoint.get("taskStatus", "/task-status", {
        success: PapercutMfContract.TaskStatusSuccess,
        error: [ActorsContract.ForbiddenActorError, AccessControl.AccessDeniedError],
      }),
    ) {}

  export class MfSync extends HttpApiGroup.make("PapercutMfSync")
    .add(
      HttpApiEndpoint.post("all", "/", {
        error: [ActorsContract.ForbiddenActorError, AccessControl.AccessDeniedError],
      }),
    )
    .add(
      HttpApiEndpoint.post("sharedAccounts", "/shared-accounts", {
        error: [ActorsContract.ForbiddenActorError, AccessControl.AccessDeniedError],
      }),
    )
    .add(
      HttpApiEndpoint.post("sharedAccountCustomerAccess", "/shared-account-customer-access", {
        error: [ActorsContract.ForbiddenActorError, AccessControl.AccessDeniedError],
      }),
    )
    .add(
      HttpApiEndpoint.post(
        "sharedAccountGroupCustomerAccess",
        "/shared-account-group-customer-access",
        { error: [ActorsContract.ForbiddenActorError, AccessControl.AccessDeniedError] },
      ),
    )
    .middleware(AwsCredentialIdentityProviderMiddleware)
    .prefix("/sync") {}

  export class MfApi extends HttpApi.make("PapercutMfApi").add(Mf).add(MfSync) {}
}

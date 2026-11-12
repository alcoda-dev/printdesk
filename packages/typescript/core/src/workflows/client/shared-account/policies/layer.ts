import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { SharedAccountWorkflowsPolicies } from ".";
import { AccessControl } from "../../../../access-control";
import { Policy } from "../../../../policies";
import { SharedAccountWorkflowsContract } from "../../../contracts";
import { SharedAccountWorkflowsRepository } from "../repository";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const repository = yield* SharedAccountWorkflowsRepository;

  const isCustomerAuthorized = Policy.make(SharedAccountWorkflowsContract.isCustomerAuthorized, {
    make: ({ id, customerId }) =>
      AccessControl.userPolicy(
        (user) =>
          repository
            .findActiveCustomerAuthorized(customerId.pipe(Option.getOrElse(() => user.id)), id)
            .pipe(
              Effect.as(true),
              Effect.catchTag("NoSuchElementError", () => Effect.succeed(false)),
            ),
        { name: SharedAccountWorkflowsContract.Table.name, id },
      ),
  });

  const isManagerAuthorized = Policy.make(SharedAccountWorkflowsContract.isManagerAuthorized, {
    make: ({ id, managerId }) =>
      AccessControl.userPolicy(
        (user) =>
          repository
            .findActiveManagerAuthorized(managerId.pipe(Option.getOrElse(() => user.id)), id)
            .pipe(
              Effect.as(true),
              Effect.catchTag("NoSuchElementError", () => Effect.succeed(false)),
            ),
        { name: SharedAccountWorkflowsContract.Table.name, id },
      ),
  });

  return { isCustomerAuthorized, isManagerAuthorized } as const;
});

export const layer = makeService.pipe(Layer.effect(SharedAccountWorkflowsPolicies));

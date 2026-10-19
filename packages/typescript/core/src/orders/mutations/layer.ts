import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";

import { OrdersMutations } from ".";
import { AccessControl } from "../../access-control";
import { AttributesContract } from "../../attributes/contract";
import { Transaction } from "../../database/transaction";
import { Mutation } from "../../mutations";
import { ReplicacheContract } from "../../replicache/contracts";
import { ReplicacheNotifier } from "../../replicache/notifier";
import { SharedAccountsPolicies } from "../../shared-accounts/policies";
import { UsersPolicies } from "../../users/policies";
import { OrdersContract } from "../contracts";
import { OrdersPolicies } from "../policies";
import { OrdersRepository } from "../repositories";
import { OrdersShortIdGenerator } from "../short-id-generator";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const repository = yield* OrdersRepository;

  const shortIdGenerator = yield* OrdersShortIdGenerator;

  const userPolicies = yield* UsersPolicies;
  const sharedAccountPolicies = yield* SharedAccountsPolicies;
  const policies = yield* OrdersPolicies;

  const notifier = yield* ReplicacheNotifier;

  const notify = (order: typeof OrdersContract.Table.Model.Type) =>
    notifier.notifyAfterTransaction(
      Array.make(
        ReplicacheContract.PullPermission.make({ permission: "orders:read" }),
        ReplicacheContract.PullPermission.make({ permission: "active_orders:read" }),
        ReplicacheContract.PullPolicy.make(
          OrdersContract.isCustomerOrManager.make({ id: order.id, userId: Option.none() }),
        ),
        ReplicacheContract.PullPolicy.make(
          OrdersContract.isManagerAuthorized.make({ id: order.id, managerId: Option.none() }),
        ),
      ),
    );

  const draft = Mutation.make(OrdersContract.draft, {
    makePolicy: Effect.fn("Orders.Mutations.draft.makePolicy")((order) =>
      AccessControl.some(
        AccessControl.userPermissionPolicy("orders:create"),
        Match.value(order).pipe(
          Match.when({ sharedAccountId: Match.string }, (order) =>
            AccessControl.every(
              AccessControl.some(
                userPolicies.isSelf.make({ id: order.customerId }),
                sharedAccountPolicies.isManagerAuthorized.make({
                  id: order.sharedAccountId,
                  managerId: Option.none(),
                }),
              ),
              sharedAccountPolicies.isCustomerAuthorized.make({
                id: order.sharedAccountId,
                customerId: Option.some(order.customerId),
              }),
            ),
          ),
          Match.orElse((order) => userPolicies.isSelf.make({ id: order.customerId })),
        ),
      ),
    ),
    mutator: Effect.fn("Orders.Mutations.draft.mutator")((order, { tenantId }) =>
      // TODO: Verify workflow status is correct
      repository.createWithRoomId({ ...order, status: OrdersContract.draftStatus, tenantId }).pipe(
        Effect.tap((order) =>
          shortIdGenerator
            .generate(
              new AttributesContract.TenantRoomId({
                tenantId: order.tenantId,
                roomId: order.roomId,
              }),
            )
            .pipe(
              Effect.flatMap((shortId) =>
                repository.updateById(order.id, { shortId }, order.tenantId),
              ),
              Effect.catch((error) =>
                Effect.logError(
                  `[Orders.Mutations]: Failed to save short ID for order "${order.id}":`,
                  error,
                ),
              ),
              Transaction.after(),
            ),
        ),
        Effect.tap(notify),
      ),
    ),
  });

  const submit = Mutation.make(OrdersContract.submit, {
    makePolicy: Effect.fn("Orders.Mutations.submit.makePolicy")(({ id }) =>
      AccessControl.some(
        AccessControl.userPermissionPolicy("orders:update"),
        policies.isCustomerOrManager.make({ id, userId: Option.none() }),
        policies.isManagerAuthorized.make({ id, managerId: Option.none() }),
      ),
    ),
    mutator: Effect.fn("Orders.Mutations.submit.mutator")((order, user) =>
      // TODO: Verify workflow status is correct
      repository
        .updateById(order.id, { ...order, status: OrdersContract.submittedStatus }, user.tenantId)
        .pipe(Effect.tap(notify)),
    ),
  });

  const edit = Mutation.make(OrdersContract.edit, {
    makePolicy: Effect.fn("Orders.Mutations.edit.makePolicy")(({ id }) =>
      AccessControl.every(
        AccessControl.some(
          AccessControl.userPermissionPolicy("orders:update"),
          AccessControl.some(
            policies.isCustomerOrManager.make({ id, userId: Option.none() }),
            policies.isManagerAuthorized.make({ id, managerId: Option.none() }),
          ),
        ),
        policies.canEdit.make({ id }),
      ),
    ),
    mutator: Effect.fn("Orders.Mutations.edit.mutator")((order, user) =>
      repository.updateById(order.id, order, user.tenantId).pipe(Effect.tap(notify)),
    ),
  });

  const approve = Mutation.make(OrdersContract.approve, {
    makePolicy: Effect.fn("Orders.Mutations.approve.makePolicy")(({ id }) =>
      AccessControl.every(
        AccessControl.some(
          AccessControl.userPermissionPolicy("orders:update"),
          policies.isManagerAuthorized.make({ id, managerId: Option.none() }),
        ),
        policies.canApprove.make({ id }),
      ),
    ),
    mutator: Effect.fn("Orders.Mutations.approve.makePolicy")(({ id, ...order }, user) =>
      repository
        .updateById(
          id,
          { ...order, sharedAccountWorkflowStatusId: null, managerId: user.id },
          user.tenantId,
        )
        .pipe(Effect.tap(notify)),
    ),
  });

  const transitionRoomWorkflowStatus = Mutation.make(OrdersContract.transitionRoomWorkflowStatus, {
    makePolicy: Effect.fn("Orders.Mutations.transitionRoomWorkflowStatus.makePolicy")(({ id }) =>
      AccessControl.every(
        AccessControl.userPermissionPolicy("orders:update"),
        policies.canTransition.make({ id }),
      ),
    ),
    mutator: Effect.fn("Orders.Mutations.transitionRoomWorkflowStatus.mutator")(
      ({ id, ...order }, user) =>
        repository
          .updateById(id, { ...order, sharedAccountWorkflowStatusId: null }, user.tenantId)
          .pipe(Effect.tap(notify)),
    ),
  });

  const transitionSharedAccountWorkflowStatus = Mutation.make(
    OrdersContract.transitionSharedAccountWorkflowStatus,
    {
      makePolicy: Effect.fn("Orders.Mutations.transitionSharedAccountWorkflowStatus.makePolicy")(
        ({ id }) =>
          AccessControl.every(
            AccessControl.some(
              AccessControl.userPermissionPolicy("orders:update"),
              policies.isManagerAuthorized.make({ id, managerId: Option.none() }),
            ),
            policies.canTransition.make({ id }),
          ),
      ),
      mutator: Effect.fn("Orders.Mutations.transitionSharedAccountWorkflowStatus.mutator")(
        ({ id, ...order }, user) =>
          repository
            .updateById(id, { ...order, roomWorkflowStatusId: null }, user.tenantId)
            .pipe(Effect.tap(notify)),
      ),
    },
  );

  const delete_ = Mutation.make(OrdersContract.delete_, {
    makePolicy: Effect.fn("Orders.Mutations.delete.makePolicy")(({ id }) =>
      AccessControl.every(
        AccessControl.some(
          AccessControl.userPermissionPolicy("orders:delete"),
          AccessControl.some(
            policies.isCustomerOrManager.make({ id, userId: Option.none() }),
            policies.isManagerAuthorized.make({ id, managerId: Option.none() }),
          ),
        ),
        policies.canDelete.make({ id }),
      ),
    ),
    mutator: Effect.fn("Orders.Mutations.delete.mutator")(({ id, deletedAt }, user) =>
      repository.updateById(id, { deletedAt }, user.tenantId).pipe(Effect.tap(notify)),
    ),
  });

  const restore = Mutation.make(OrdersContract.restore, {
    makePolicy: Effect.fn("Orders.Mutations.restore.makePolicy")(({ id }) =>
      AccessControl.every(
        AccessControl.userPermissionPolicy("orders:delete"),
        policies.canRestore.make({ id }),
      ),
    ),
    mutator: Effect.fn("Orders.Mutations.restore.mutator")(({ id }, user) =>
      repository.updateById(id, { deletedAt: null }, user.tenantId).pipe(Effect.tap(notify)),
    ),
  });

  return {
    draft,
    submit,
    edit,
    approve,
    transitionRoomWorkflowStatus,
    transitionSharedAccountWorkflowStatus,
    delete: delete_,
    restore,
  } as const;
});

export const layer = makeService.pipe(Layer.effect(OrdersMutations));

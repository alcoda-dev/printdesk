import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlError from "effect/sql/SqlError";

import { TenantsMutations } from ".";
import { AccessControl } from "../../access-control";
import { Mutation } from "../../mutations";
import { ReplicacheContract } from "../../replicache/contracts";
import { ReplicacheNotifier } from "../../replicache/notifier";
import { TenantsContract } from "../contract";
import { TenantsRepository } from "../repositories";
import { tenantsTable } from "../sql";

export type ServiceShape = Effect.Success<typeof makeService>;

export const makeService = Effect.gen(function* () {
  const repository = yield* TenantsRepository;

  const notifier = yield* ReplicacheNotifier;

  const notify = () =>
    notifier.notifyAfterTransaction(
      Array.make(ReplicacheContract.PullPermission.make({ permission: "tenants:read" })),
    );

  const edit = Mutation.make(TenantsContract.edit, {
    makePolicy: Effect.fn("Tenants.Mutations.edit.makePolicy")(() =>
      AccessControl.userPermissionPolicy("tenants:update"),
    ),
    mutator: Effect.fn("Tenants.Mutations.edit.mutator")((tenant, user) =>
      repository.updateById(user.tenantId, tenant).pipe(
        Effect.catchReason("SqlError", "UniqueViolation", (reason) =>
          Effect.fail(
            reason.constraint === tenantsTable.slug.name && tenant.slug
              ? new TenantsContract.TenantSlugConflictError({ slug: tenant.slug })
              : new SqlError.SqlError({ reason }),
          ),
        ),
        Effect.tap(notify),
      ),
    ),
  });

  return { edit } as const;
});

export const layer = makeService.pipe(Layer.effect(TenantsMutations));

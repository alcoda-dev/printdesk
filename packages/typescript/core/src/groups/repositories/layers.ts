import { and, eq, getViewName, getColumns, inArray, not, notInArray } from "drizzle-orm";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Struct from "effect/Struct";

import { GroupsRepository, GroupsSyncRepository } from ".";
import { Database } from "../../database";
import { replicacheClientViewEntries } from "../../replicache/sql";
import { SyncQueryBuilder } from "../../sync/query-builder";
import { activeGroupsView, activeMembershipGroupsView, groupMemberships, groups } from "../sql";

import type { InferInsertModel } from "drizzle-orm";
import type { ReplicacheClientView } from "../../replicache/sql";
import type { ActiveGroup, ActiveMembershipGroup, Group, GroupsTable } from "../sql";

export type Repository = Effect.Success<typeof makeRepository>;
export const makeRepository = Effect.gen(function* () {
  const db = yield* Database;
  const table = groups.table;
  const membershipsTable = groupMemberships.table;

  const withMembershipSelection = {
    group: getColumns(table),
    groupMembership: getColumns(membershipsTable),
  };

  const create = Effect.fn("Groups.Repository.create")((value: InferInsertModel<GroupsTable>) =>
    db
      .useTransaction((tx) => tx.insert(table).values(value).returning())
      .pipe(
        Effect.map(Array.head),
        Effect.flatMap(Effect.fromOption),
        Effect.catchTag("NoSuchElementError", Effect.die),
      ),
  );

  const findByTenantId = Effect.fn("Groups.Repository.findByTenantId")(
    (tenantId: Group["tenantId"]) =>
      db.useTransaction((tx) => tx.select().from(table).where(eq(table.tenantId, tenantId))),
  );

  const findWithMembershipsById = Effect.fn("Groups.Repository.findWithMembershipsById")(
    (id: Group["id"], tenantId: Group["tenantId"]) =>
      db
        .useTransaction((tx) =>
          tx
            .select(withMembershipSelection)
            .from(table)
            .leftJoin(
              membershipsTable,
              and(
                eq(table.id, membershipsTable.groupId),
                eq(table.tenantId, membershipsTable.tenantId),
              ),
            )
            .where(and(eq(table.id, id), eq(table.tenantId, tenantId))),
        )
        .pipe(Effect.filterOrFail(Array.isArrayNonEmpty)),
  );

  const findWithMembershipsByIdForUpdate = Effect.fn(
    "Groups.Repository.findWithMembershipsByIdForUpdate",
  )((id: Group["id"], tenantId: Group["tenantId"]) =>
    db
      .useTransaction((tx) =>
        tx
          .select(withMembershipSelection)
          .from(table)
          .leftJoin(
            membershipsTable,
            and(
              eq(table.id, membershipsTable.groupId),
              eq(table.tenantId, membershipsTable.tenantId),
            ),
          )
          .where(and(eq(table.id, id), eq(table.tenantId, tenantId)))
          .for("update", { of: table }),
      )
      .pipe(Effect.filterOrFail(Array.isArrayNonEmpty)),
  );

  const findWithMembershipsByExternalId = Effect.fn(
    "Groups.Repository.findWithMembershipsByExternalId",
  )((externalId: Group["externalId"], tenantId: Group["tenantId"]) =>
    db
      .useTransaction((tx) =>
        tx
          .select(withMembershipSelection)
          .from(table)
          .leftJoin(
            membershipsTable,
            and(
              eq(table.id, membershipsTable.groupId),
              eq(table.tenantId, membershipsTable.tenantId),
            ),
          )
          .where(and(eq(table.externalId, externalId), eq(table.tenantId, tenantId))),
      )
      .pipe(Effect.filterOrFail(Array.isArrayNonEmpty)),
  );

  const findWithMembershipsByTenantId = Effect.fn(
    "Groups.Repository.findWithMembershipsByTenantId",
  )((tenantId: Group["tenantId"]) =>
    db
      .useTransaction((tx) =>
        tx
          .select(withMembershipSelection)
          .from(table)
          .leftJoin(
            membershipsTable,
            and(
              eq(table.id, membershipsTable.groupId),
              eq(table.tenantId, membershipsTable.tenantId),
            ),
          )
          .where(eq(table.tenantId, tenantId)),
      )
      .pipe(Effect.filterOrFail(Array.isArrayNonEmpty)),
  );

  const updateById = Effect.fn("Groups.Repository.updateById")(
    (
      id: Group["id"],
      group: Partial<Omit<Group, "id" | "tenantId">>,
      tenantId: Group["tenantId"],
    ) =>
      db
        .useTransaction((tx) =>
          tx
            .update(table)
            .set(group)
            .where(and(eq(table.id, id), eq(table.tenantId, tenantId)))
            .returning(),
        )
        .pipe(Effect.map(Array.head), Effect.flatMap(Effect.fromOption)),
  );

  return {
    create,
    findByTenantId,
    findWithMembershipsById,
    findWithMembershipsByIdForUpdate,
    findWithMembershipsByExternalId,
    findWithMembershipsByTenantId,
    updateById,
  } as const;
});
export const repositoryLayer = makeRepository.pipe(Layer.effect(GroupsRepository));

export type SyncRepository = Effect.Success<typeof makeSyncRepository>;
export const makeSyncRepository = Effect.gen(function* () {
  const db = yield* Database;
  const table = groups.table;
  const activeView = activeGroupsView;
  const activeMembershipView = activeMembershipGroupsView;

  const entriesQueryBuilder = yield* SyncQueryBuilder;
  const entriesTable = replicacheClientViewEntries.table;

  const findCreates = Effect.fn("Groups.SyncRepository.findCreates")(
    (clientView: ReplicacheClientView) =>
      entriesQueryBuilder.creates(groups.name, clientView).pipe(
        Effect.flatMap((qb) =>
          db.useTransaction((tx) => {
            const cte = tx
              .$with(`${groups.name}_creates`)
              .as(tx.select().from(table).where(eq(table.tenantId, clientView.tenantId)));

            return tx
              .with(cte)
              .select()
              .from(cte)
              .where(inArray(cte.id, tx.select({ id: cte.id }).from(cte).except(qb)));
          }),
        ),
      ),
  );

  const findActiveCreates = Effect.fn("Groups.SyncRepository.findActiveCreates")(
    (clientView: ReplicacheClientView) =>
      entriesQueryBuilder.creates(groups.name, clientView).pipe(
        Effect.flatMap((qb) =>
          db.useTransaction((tx) => {
            const cte = tx
              .$with(`${getViewName(activeView)}_creates`)
              .as(tx.select().from(activeView).where(eq(activeView.tenantId, clientView.tenantId)));

            return tx
              .with(cte)
              .select()
              .from(cte)
              .where(inArray(cte.id, tx.select({ id: cte.id }).from(cte).except(qb)));
          }),
        ),
      ),
  );

  const findActiveMembershipCreates = Effect.fn(
    "Groups.SyncRepository.findActiveMembershipCreates",
  )((clientView: ReplicacheClientView, userId: ActiveMembershipGroup["userId"]) =>
    entriesQueryBuilder.creates(groups.name, clientView).pipe(
      Effect.flatMap((qb) =>
        db.useTransaction((tx) => {
          const cte = tx.$with(`${getViewName(activeMembershipView)}_creates`).as(
            tx
              .selectDistinctOn(
                [activeMembershipView.id, activeMembershipView.tenantId],
                Struct.omit(getColumns(activeMembershipView), ["userId"]),
              )
              .from(activeMembershipView)
              .where(
                and(
                  eq(activeMembershipView.userId, userId),
                  eq(activeMembershipView.tenantId, clientView.tenantId),
                ),
              ),
          );

          return tx
            .with(cte)
            .select()
            .from(cte)
            .where(inArray(cte.id, tx.select({ id: cte.id }).from(cte).except(qb)));
        }),
      ),
    ),
  );

  const findUpdates = Effect.fn("Groups.SyncRepository.findUpdates")(
    (clientView: ReplicacheClientView) =>
      entriesQueryBuilder.updates(groups.name, clientView).pipe(
        Effect.flatMap((qb) =>
          db.useTransaction((tx) => {
            const cte = tx
              .$with(`${groups.name}_updates`)
              .as(
                qb
                  .innerJoin(
                    table,
                    and(
                      eq(entriesTable.entityId, table.id),
                      not(eq(entriesTable.entityVersion, table.version)),
                      eq(entriesTable.tenantId, table.tenantId),
                    ),
                  )
                  .where(eq(table.tenantId, clientView.tenantId)),
              );

            return tx.with(cte).select(cte[groups.name]).from(cte);
          }),
        ),
      ),
  );

  const findActiveUpdates = Effect.fn("Groups.SyncRepository.findActiveUpdates")(
    (clientView: ReplicacheClientView) =>
      entriesQueryBuilder.updates(groups.name, clientView).pipe(
        Effect.flatMap((qb) =>
          db.useTransaction((tx) => {
            const cte = tx
              .$with(`${getViewName(activeView)}_updates`)
              .as(
                qb
                  .innerJoin(
                    activeView,
                    and(
                      eq(entriesTable.entityId, activeView.id),
                      not(eq(entriesTable.entityVersion, activeView.version)),
                      eq(entriesTable.tenantId, activeView.tenantId),
                    ),
                  )
                  .where(eq(activeView.tenantId, clientView.tenantId)),
              );

            return tx.with(cte).select(cte[getViewName(activeView)]).from(cte);
          }),
        ),
      ),
  );

  const findActiveMembershipUpdates = Effect.fn(
    "Groups.SyncRepository.findActiveMembershipUpdates",
  )((clientView: ReplicacheClientView, userId: ActiveMembershipGroup["userId"]) =>
    entriesQueryBuilder.updates(groups.name, clientView).pipe(
      Effect.flatMap((qb) =>
        db.useTransaction((tx) => {
          const cte = tx
            .$with(`${getViewName(activeMembershipView)}_updates`)
            .as(
              qb
                .innerJoin(
                  activeMembershipView,
                  and(
                    eq(entriesTable.entityId, activeMembershipView.id),
                    not(eq(entriesTable.entityVersion, activeMembershipView.version)),
                    eq(entriesTable.tenantId, activeMembershipView.tenantId),
                  ),
                )
                .where(
                  and(
                    eq(activeMembershipView.userId, userId),
                    eq(activeMembershipView.tenantId, clientView.tenantId),
                  ),
                ),
            );

          return tx
            .with(cte)
            .selectDistinctOn(
              [
                cte[getViewName(activeMembershipView)].id,
                cte[getViewName(activeMembershipView)].tenantId,
              ],
              Struct.omit(cte[getViewName(activeMembershipView)], ["userId"]),
            )
            .from(cte);
        }),
      ),
    ),
  );

  const findDeletes = Effect.fn("Groups.SyncRepository.findDeletes")(
    (clientView: ReplicacheClientView) =>
      entriesQueryBuilder
        .deletes(groups.name, clientView)
        .pipe(
          Effect.flatMap((qb) =>
            db.useTransaction((tx) =>
              qb.except(
                tx
                  .select({ id: table.id })
                  .from(table)
                  .where(eq(table.tenantId, clientView.tenantId)),
              ),
            ),
          ),
        ),
  );

  const findActiveDeletes = Effect.fn("Groups.SyncRepository.findActiveDeletes")(
    (clientView: ReplicacheClientView) =>
      entriesQueryBuilder
        .deletes(groups.name, clientView)
        .pipe(
          Effect.flatMap((qb) =>
            db.useTransaction((tx) =>
              qb.except(
                tx
                  .select({ id: activeView.id })
                  .from(activeView)
                  .where(eq(activeView.tenantId, clientView.tenantId)),
              ),
            ),
          ),
        ),
  );

  const findActiveMembershipDeletes = Effect.fn(
    "Groups.SyncRepository.findActiveMembershipDeletes",
  )((clientView: ReplicacheClientView, userId: ActiveMembershipGroup["userId"]) =>
    entriesQueryBuilder.deletes(groups.name, clientView).pipe(
      Effect.flatMap((qb) =>
        db.useTransaction((tx) =>
          qb.except(
            tx
              .selectDistinctOn([activeMembershipView.id, activeMembershipView.tenantId], {
                id: activeMembershipView.id,
              })
              .from(activeMembershipView)
              .where(
                and(
                  eq(activeMembershipView.userId, userId),
                  eq(activeMembershipView.tenantId, clientView.tenantId),
                ),
              ),
          ),
        ),
      ),
    ),
  );

  const findFastForward = Effect.fn("Groups.SyncRepository.findFastForward")(
    (clientView: ReplicacheClientView, excludeIds: Array<Group["id"]>) =>
      entriesQueryBuilder.fastForward(groups.name, clientView).pipe(
        Effect.flatMap((qb) =>
          db.useTransaction((tx) => {
            const cte = tx
              .$with(`${groups.name}_fast_forward`)
              .as(
                qb
                  .innerJoin(
                    table,
                    and(eq(entriesTable.entityId, table.id), notInArray(table.id, excludeIds)),
                  )
                  .where(eq(table.tenantId, clientView.tenantId)),
              );

            return tx.with(cte).select(cte[groups.name]).from(cte);
          }),
        ),
      ),
  );

  const findActiveFastForward = Effect.fn("Groups.SyncRepository.findActiveFastForward")(
    (clientView: ReplicacheClientView, excludeIds: Array<ActiveGroup["id"]>) =>
      entriesQueryBuilder.fastForward(groups.name, clientView).pipe(
        Effect.flatMap((qb) =>
          db.useTransaction((tx) => {
            const cte = tx
              .$with(`${getViewName(activeView)}_fast_forward`)
              .as(
                qb
                  .innerJoin(
                    activeView,
                    and(
                      eq(entriesTable.entityId, activeView.id),
                      notInArray(activeView.id, excludeIds),
                    ),
                  )
                  .where(eq(activeView.tenantId, clientView.tenantId)),
              );

            return tx.with(cte).select(cte[getViewName(activeView)]).from(cte);
          }),
        ),
      ),
  );

  const findActiveMembershipFastForward = Effect.fn(
    "Groups.SyncRepository.findActiveMembershipFastForward",
  )(
    (
      clientView: ReplicacheClientView,
      excludeIds: Array<ActiveMembershipGroup["id"]>,
      userId: ActiveMembershipGroup["userId"],
    ) =>
      entriesQueryBuilder.fastForward(groups.name, clientView).pipe(
        Effect.flatMap((qb) =>
          db.useTransaction((tx) => {
            const cte = tx
              .$with(`${getViewName(activeMembershipView)}_fast_forward`)
              .as(
                qb
                  .innerJoin(
                    activeMembershipView,
                    and(
                      eq(entriesTable.entityId, activeMembershipView.id),
                      notInArray(activeMembershipView.id, excludeIds),
                    ),
                  )
                  .where(
                    and(
                      eq(activeMembershipView.userId, userId),
                      eq(activeMembershipView.tenantId, clientView.tenantId),
                    ),
                  ),
              );

            return tx
              .with(cte)
              .selectDistinctOn(
                [
                  cte[getViewName(activeMembershipView)].id,
                  cte[getViewName(activeMembershipView)].tenantId,
                ],
                Struct.omit(cte[getViewName(activeMembershipView)], ["userId"]),
              )
              .from(cte);
          }),
        ),
      ),
  );

  return {
    findCreates,
    findActiveCreates,
    findActiveMembershipCreates,
    findUpdates,
    findActiveUpdates,
    findActiveMembershipUpdates,
    findDeletes,
    findActiveDeletes,
    findActiveMembershipDeletes,
    findFastForward,
    findActiveFastForward,
    findActiveMembershipFastForward,
  } as const;
});
export const syncRepositoryLayer = makeSyncRepository.pipe(Layer.effect(GroupsSyncRepository));

export const layer = Layer.merge(repositoryLayer, syncRepositoryLayer);

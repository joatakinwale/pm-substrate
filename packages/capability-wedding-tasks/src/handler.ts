/**
 * TaskCreationHandler — the load-bearing logic of the wedding.tasks capability.
 *
 * Triggered by the wedding.contract.signed event. Creates a PlannerTask
 * graph node, a Contract → PlannerTask edge, and emits wedding.task.created
 * in a single Postgres transaction (so partial state cannot be observed
 * by downstream subscribers).
 *
 * Idempotency: each contract spawns at most one task per "kind" of follow-up.
 * The handler keys idempotency on (tenantId, contractId, taskKind) via a
 * tenant-scoped uniqueness constraint enforced at write time. If the same
 * wedding.contract.signed event is delivered twice (network retry, redrive),
 * the second attempt detects the existing task and exits clean.
 *
 * Architecture: the handler writes through the Graph + EventStore APIs.
 * It does NOT touch the registry, does NOT call any other capability,
 * and does NOT inspect downstream consumers. Whoever subscribes to
 * wedding.task.created is the substrate's problem.
 */

import type { EventPublisher, PublishInput } from "@pm/events";
import type { Graph } from "@pm/graph";
import type { ProfileValidator } from "@pm/profile-registry";
import type { EntityId, TenantId } from "@pm/types";
import pg from "pg";

export interface ContractSignedPayload {
  /** EntityId of the Contract that was signed. */
  readonly contractId: EntityId;
  /** ISO-8601 timestamp the signing was recorded. */
  readonly signedAt: string;
}

export interface TaskRuntimeDeps {
  readonly pool: pg.Pool;
  readonly graph: Graph;
  readonly events: EventPublisher;
  readonly validator: ProfileValidator;
  readonly emittedBy?: string;
}

type TransactionalEvents = EventPublisher & {
  publishWith(
    client: pg.ClientBase,
    input: PublishInput,
  ): Promise<ReturnType<EventPublisher["publish"]>>;
};

/**
 * Determines what kind of follow-up task to create for a given contract.
 *
 * Pluggable so a tenant could in principle override the policy. For G5 we
 * ship one default: every signed contract spawns one "vendor_walkthrough"
 * task with reasonable defaults. The exact policy is intentionally simple
 * here \u2014 the architectural point is that capability boundaries hold,
 * not that the policy is sophisticated.
 */
export interface TaskPolicy {
  taskKindFor(contractId: EntityId): string;
  taskTitleFor(contractId: EntityId): string;
  taskCategoryFor(contractId: EntityId): string;
  taskPriorityFor(contractId: EntityId): "low" | "medium" | "high" | "urgent";
}

export const DEFAULT_TASK_POLICY: TaskPolicy = {
  taskKindFor: () => "vendor_walkthrough",
  taskTitleFor: (contractId) =>
    `Vendor walkthrough for contract ${String(contractId).slice(0, 12)}`,
  taskCategoryFor: () => "venue",
  taskPriorityFor: () => "medium",
};

export class TaskCreationHandler {
  readonly #pool: pg.Pool;
  readonly #graph: Graph;
  readonly #events: TransactionalEvents;
  readonly #emittedBy: string;
  readonly #policy: TaskPolicy;

  constructor(deps: TaskRuntimeDeps & { policy?: TaskPolicy }) {
    this.#pool = deps.pool;
    this.#graph = deps.graph;
    this.#events = deps.events as TransactionalEvents;
    this.#emittedBy = deps.emittedBy ?? "wedding.tasks";
    this.#policy = deps.policy ?? DEFAULT_TASK_POLICY;
  }

  async handle(
    tenantId: TenantId,
    payload: ContractSignedPayload,
  ): Promise<EntityId | null> {
    const { contractId } = payload;
    const taskKind = this.#policy.taskKindFor(contractId);

    // Idempotency check: does a task already exist for this (contract, kind)?
    // We look at outgoing contract_task edges and check the externalRef
    // marker we stamp at create time.
    const existingEdges = await this.#graph.outgoingEdges(
      tenantId,
      contractId,
      "wedding/contract_task",
    );
    for (const edge of existingEdges) {
      const existing = await this.#graph.getNode(tenantId, edge.toId as EntityId);
      if (existing?.identity["externalRef"] === `${contractId}:${taskKind}`) {
        return null; // Already created \u2014 idempotent no-op.
      }
    }

    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");

      // Create the PlannerTask node within the transaction.
      const { node: taskNode } = await (this.#graph as Graph & {
        createNode: (
          input: Parameters<Graph["createNode"]>[0],
          tx?: pg.ClientBase,
        ) => ReturnType<Graph["createNode"]>;
      }).createNode(
        {
          tenantId,
          profile: {
            tier1: "Engagement",
            profile: "wedding",
            concrete: "PlannerTask",
          },
          identity: {
            title: this.#policy.taskTitleFor(contractId),
            state: "pending",
            priority: this.#policy.taskPriorityFor(contractId),
            category: this.#policy.taskCategoryFor(contractId),
            sourceType: "wedding.tasks",
            externalRef: `${contractId}:${taskKind}`,
          },
          schemaVersion: 1,
        },
        c,
      );

      // Link Contract \u2192 PlannerTask in the same transaction.
      await (this.#graph as Graph & {
        createEdge: (
          input: Parameters<Graph["createEdge"]>[0],
          tx?: pg.ClientBase,
        ) => ReturnType<Graph["createEdge"]>;
      }).createEdge(
        {
          tenantId,
          type: "wedding/contract_task",
          fromId: contractId,
          toId: taskNode.id,
          attrs: { taskKind },
        },
        c,
      );

      // Emit the outbound event in the same transaction \u2014 atomicity.
      await this.#events.publishWith(c, {
        tenantId,
        type: "wedding.task.created",
        entityId: taskNode.id as EntityId,
        emittedBy: this.#emittedBy,
        payloadSchema: "wedding.task.created/v1",
        payload: {
          taskId: taskNode.id,
          contractId,
          taskKind,
          title: this.#policy.taskTitleFor(contractId),
          category: this.#policy.taskCategoryFor(contractId),
          priority: this.#policy.taskPriorityFor(contractId),
        },
      });

      await c.query("COMMIT");
      return taskNode.id as EntityId;
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }
}

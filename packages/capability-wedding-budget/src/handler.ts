/**
 * BudgetRollupHandler — the load-bearing logic of the wedding.budget capability.
 *
 * Graph walk (reads, outside tx):
 *   contractId
 *     → outgoingEdges("wedding/contract_vendor") → vendorId
 *     → outgoingEdges("wedding/vendor_budget_category") → budgetCategoryId
 *
 * If either edge is missing, log a warning and return — this is valid for raw
 * Tier-1 tenants or vendors not yet assigned to a budget category.
 *
 * Transaction (all-or-nothing):
 *   1. INSERT budget.applied_payments (idempotency guard). If conflicted,
 *      this payment was already processed — exit clean.
 *   2. SELECT graph.nodes FOR UPDATE (lock the BudgetCategory row so
 *      concurrent payments serialize and don't lose increments).
 *   3. UPDATE graph.nodes — increment actualSpentMinor by `amount`.
 *   4. events.publishWith(client) — emit wedding.budget.actual_spent_updated.
 *   COMMIT (or ROLLBACK on any error — atomicity guaranteed by Postgres).
 *
 * See ADR-0010 for the idempotency mechanism choice.
 */

import type { EventPublisher, PublishInput } from "@pm/events";
import type { Graph } from "@pm/graph";
import type { EntityId, TenantId } from "@pm/types";
import pg from "pg";

export interface PaymentRecordedPayload {
  /** EntityId of the Contract that recorded the payment. */
  readonly contractId: EntityId;
  /** Payment amount in integer minor units (cents). */
  readonly amount: number;
  /** ISO-8601 timestamp of when the payment was recorded. */
  readonly recordedAt: string;
  /**
   * Stable, caller-assigned payment identifier.
   * Used as the idempotency key — re-delivering the same paymentId a second
   * time is a no-op: the rollup runs exactly once per paymentId per tenant.
   */
  readonly paymentId: string;
}

export interface BudgetRuntimeDeps {
  readonly pool: pg.Pool;
  readonly graph: Graph;
  readonly events: EventPublisher;
  readonly emittedBy?: string;
}

/**
 * Extended EventPublisher shape that includes the transactional helper.
 * PostgresEventStore implements this; the interface does not expose it to
 * avoid coupling the public API to pg internals.
 */
type TransactionalEvents = EventPublisher & {
  publishWith(
    client: pg.ClientBase,
    input: PublishInput,
  ): Promise<ReturnType<EventPublisher["publish"]>>;
};

interface NodeRow {
  id: string;
  identity: Record<string, unknown>;
  schema_version: number;
}

export class BudgetRollupHandler {
  readonly #pool: pg.Pool;
  readonly #graph: Graph;
  readonly #events: TransactionalEvents;
  readonly #emittedBy: string;

  constructor(deps: BudgetRuntimeDeps) {
    this.#pool = deps.pool;
    this.#graph = deps.graph;
    this.#events = deps.events as TransactionalEvents;
    this.#emittedBy = deps.emittedBy ?? "wedding.budget";
  }

  async handle(
    tenantId: TenantId,
    payload: PaymentRecordedPayload,
  ): Promise<void> {
    const { contractId, amount, paymentId } = payload;

    // ---- Graph walk (read-only, outside tx) ----
    // Edge topology is stable at the time of payment recording; reading
    // outside the transaction is safe and avoids holding locks during the
    // walk. IF topology could change concurrently (edge deleted mid-payment),
    // a locked read inside the tx would be safer — not a day-1 concern.

    const contractVendorEdges = await this.#graph.outgoingEdges(
      tenantId,
      contractId,
      "wedding/contract_vendor",
    );
    if (contractVendorEdges.length === 0) {
      console.warn(
        `[wedding.budget] contract ${contractId} has no vendor edge (tenant=${tenantId}). ` +
          `Skipping rollup — raw Tier-1 tenant or vendor not linked.`,
      );
      return;
    }
    const vendorId = contractVendorEdges[0]!.toId;

    const vendorBudgetEdges = await this.#graph.outgoingEdges(
      tenantId,
      vendorId,
      "wedding/vendor_budget_category",
    );
    if (vendorBudgetEdges.length === 0) {
      console.warn(
        `[wedding.budget] vendor ${vendorId} has no budget category edge (tenant=${tenantId}). ` +
          `Skipping rollup — vendor not assigned to a budget category.`,
      );
      return;
    }
    const budgetCategoryId = vendorBudgetEdges[0]!.toId;

    // ---- Transaction: idempotency + rollup + event ----
    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");

      // Step 1: idempotency guard.
      // INSERT ON CONFLICT DO NOTHING returns rowCount=0 on duplicate.
      // ON CONFLICT path means this payment was already applied → clean exit.
      const ins = await c.query(
        `INSERT INTO budget.applied_payments (tenant_id, payment_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [tenantId, paymentId],
      );
      if ((ins.rowCount ?? 0) === 0) {
        await c.query("ROLLBACK");
        return; // Already processed — idempotent no-op.
      }

      // Step 2: lock the BudgetCategory row so concurrent payments on the
      // same category serialize. Without FOR UPDATE, two concurrent payments
      // would both read the same actualSpentMinor, compute different totals,
      // and one increment would be silently lost.
      const sel = await c.query<NodeRow>(
        `SELECT id, identity, schema_version
           FROM graph.nodes
          WHERE tenant_id = $1 AND id = $2
          FOR UPDATE`,
        [tenantId, budgetCategoryId],
      );
      const row = sel.rows[0];
      if (!row) {
        throw new Error(
          `BudgetCategory node not found: ${budgetCategoryId} (tenant=${tenantId})`,
        );
      }

      // Step 3: compute new total and write.
      const currentSpent = (row.identity["actualSpentMinor"] as number | undefined) ?? 0;
      const newSpent = currentSpent + amount;
      const newIdentity = { ...row.identity, actualSpentMinor: newSpent };

      await c.query(
        `UPDATE graph.nodes
            SET identity       = $3::jsonb,
                schema_version = schema_version + 1,
                updated_at     = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, budgetCategoryId, JSON.stringify(newIdentity)],
      );

      // Step 4: emit event in the same transaction.
      // If this throws, the UPDATE and the applied_payments INSERT both roll
      // back — atomicity is preserved. See ADR-0004, ADR-0010.
      await this.#events.publishWith(c, {
        tenantId,
        type: "wedding.budget.actual_spent_updated",
        entityId: budgetCategoryId as EntityId,
        emittedBy: this.#emittedBy,
        payloadSchema: "wedding.budget.actual_spent_updated/v1",
        payload: {
          budgetCategoryId,
          delta: amount,
          newTotal: newSpent,
          sourcePaymentId: paymentId,
        },
      });

      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }
}

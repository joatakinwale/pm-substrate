/**
 * BudgetRollupHandlerV2 — alternate implementation of wedding.budget.
 *
 * Same Capability descriptor (WEDDING_BUDGET_CAPABILITY). Same input event
 * type (wedding.contract.payment_recorded). Same output event type
 * (wedding.budget.actual_spent_updated). Same observable graph state.
 *
 * Different mechanism:
 *   - V1 uses `SELECT ... FOR UPDATE` row-level locking on the BudgetCategory
 *     node to serialize concurrent payments.
 *   - V2 uses a Postgres advisory lock keyed on the BudgetCategory id, then
 *     reads the row without FOR UPDATE.
 *
 * Why this V2 exists: it is the load-bearing artifact of the G5 drop-in
 * provider diff test. If swapping V1 → V2 (with no other changes anywhere
 * in the substrate, registry, or event log) produces identical graph state
 * for an identical scenario, the substrate is genuinely pluggable along the
 * capability boundary. If V2 leaks any implementation detail back through
 * the substrate (lock strategy showing up in events, schema_version drift,
 * different ordering observed by downstream subscribers), the substrate is
 * lying about its decoupling.
 *
 * V2 is intentionally NOT exported from the package's public index.ts —
 * it is a test fixture, not a production alternate. Importing from
 * "./handler-v2.js" directly is fine for tests; never wire it into
 * production code.
 */

import type { EventPublisher, PublishInput } from "@pm/events";
import type { Graph } from "@pm/graph";
import type { EntityId, TenantId } from "@pm/types";
import { createHash } from "node:crypto";
import pg from "pg";
import type { BudgetRuntimeDeps, PaymentRecordedPayload } from "./handler.js";

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

/**
 * Hash a string into a signed bigint suitable for pg_advisory_xact_lock.
 * Postgres advisory locks take a single bigint or two ints; we use the
 * single-bigint form. Collision risk on a 63-bit truncated SHA-256 is
 * negligible for the size of any single tenant's BudgetCategory population.
 */
function advisoryKey(s: string): string {
  const h = createHash("sha256").update(s).digest();
  // Take 8 bytes as a signed bigint. Mask the sign bit to keep it positive
  // (advisory locks accept negative bigints, but a positive value is easier
  // to read in pg_locks during debugging).
  let v = 0n;
  for (let i = 0; i < 8; i++) {
    v = (v << 8n) | BigInt(h[i]!);
  }
  return (v & 0x7fffffffffffffffn).toString();
}

export class BudgetRollupHandlerV2 {
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

    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");

      // Idempotency guard — same as V1, identical row in budget.applied_payments.
      const ins = await c.query(
        `INSERT INTO budget.applied_payments (tenant_id, payment_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [tenantId, paymentId],
      );
      if ((ins.rowCount ?? 0) === 0) {
        await c.query("ROLLBACK");
        return;
      }

      // Graph walk — same shape as V1. The Graph interface is the substrate
      // boundary; both V1 and V2 use it identically.
      const contractVendorEdges = await this.#graph.outgoingEdges(
        tenantId,
        contractId,
        "wedding/contract_vendor",
      );
      if (contractVendorEdges.length === 0) {
        console.warn(
          `[wedding.budget.v2] contract ${contractId} has no vendor edge ` +
            `(tenant=${tenantId}). Skipping rollup.`,
        );
        await c.query("COMMIT");
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
          `[wedding.budget.v2] vendor ${vendorId} has no budget category edge ` +
            `(tenant=${tenantId}). Skipping rollup.`,
        );
        await c.query("COMMIT");
        return;
      }
      const budgetCategoryId = vendorBudgetEdges[0]!.toId;

      // V2-specific: serialize via advisory lock instead of FOR UPDATE.
      // Key includes tenantId so different tenants' identical BudgetCategory
      // ids don't contend.
      const key = advisoryKey(`${tenantId}|${budgetCategoryId}`);
      await c.query("SELECT pg_advisory_xact_lock($1::bigint)", [key]);

      // Now read without FOR UPDATE — the advisory lock provides mutual
      // exclusion. This is the lock-strategy diff vs V1.
      const sel = await c.query<NodeRow>(
        `SELECT id, identity, schema_version
           FROM graph.nodes
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, budgetCategoryId],
      );
      const row = sel.rows[0];
      if (!row) {
        throw new Error(
          `BudgetCategory node not found: ${budgetCategoryId} (tenant=${tenantId})`,
        );
      }

      const currentSpent =
        (row.identity["actualSpentMinor"] as number | undefined) ?? 0;
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

      // Emit the same event V1 does — substrate doesn't see the lock-strategy
      // diff. If V2 emitted a different event type or shape, downstream
      // subscribers would observe the swap, and the "drop-in" claim would
      // be a lie.
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

/**
 * LeadScoringHandler — the load-bearing logic of the agency.lead-scoring capability.
 *
 * Graph walk (reads, outside tx):
 *   leadId
 *     → outgoingEdges("agency/lead_scored_by") → configId               (preferred)
 *     ↘ outgoingEdges("agency/lead_assigned_to_user") → userId
 *           → outgoingEdges("agency/user_default_scoring") → configId   (fallback)
 *
 * If neither path resolves, log a warning and return — valid for raw Tier-1
 * tenants and for leads with no scoring config assigned. Same shape as
 * the wedding.budget handler when the contract→vendor→budget walk doesn't
 * resolve.
 *
 * Transaction (all-or-nothing):
 *   1. INSERT lead_scoring.applied_scoring_events (idempotency guard).
 *      If conflicted, this scoring event was already processed — exit clean.
 *   2. SELECT graph.nodes FOR UPDATE (lock the LeadScoringConfig row so
 *      concurrent scoring events serialize and don't lose increments).
 *   3. UPDATE graph.nodes — increment currentTotalLeadsScored by 1.
 *   4. events.publishWith(client) — emit agency.lead.scored.
 *   COMMIT (or ROLLBACK on any error — atomicity guaranteed by Postgres).
 *
 * This handler is intentionally a near-clone of BudgetRollupHandler. The
 * point of G4 is not to invent a new pattern — it's to prove the SAME
 * pattern works in a non-wedding domain without substrate changes.
 */

import type { EventPublisher, PublishInput } from "@pm/events";
import type { Graph } from "@pm/graph";
import type { EntityId, TenantId } from "@pm/types";
import pg from "pg";

export interface LeadScoringEventPayload {
  /** EntityId of the Lead whose progression triggered the scoring update. */
  readonly leadId: EntityId;
  /**
   * Score delta to apply, in arbitrary scoring units (positive or negative).
   * For now the rollup field counts leads scored, not the cumulative score
   * total. The delta is recorded in the emitted event for consumers that
   * project per-lead score state. Keep it integer for simplicity; the
   * substrate has no opinion on the unit.
   */
  readonly scoreDelta: number;
  /** ISO-8601 timestamp of when the scoring event happened. */
  readonly recordedAt: string;
  /**
   * Stable, caller-assigned scoring-event identifier.
   * Used as the idempotency key — re-delivering the same scoringEventId
   * a second time is a no-op: the rollup runs exactly once per id per tenant.
   */
  readonly scoringEventId: string;
  /** Optional human-readable reason for the score change (logged in the emitted event). */
  readonly reason?: string;
}

export interface LeadScoringRuntimeDeps {
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

export class LeadScoringHandler {
  readonly #pool: pg.Pool;
  readonly #graph: Graph;
  readonly #events: TransactionalEvents;
  readonly #emittedBy: string;

  constructor(deps: LeadScoringRuntimeDeps) {
    this.#pool = deps.pool;
    this.#graph = deps.graph;
    this.#events = deps.events as TransactionalEvents;
    this.#emittedBy = deps.emittedBy ?? "agency.lead-scoring";
  }

  async handle(
    tenantId: TenantId,
    payload: LeadScoringEventPayload,
  ): Promise<void> {
    const { leadId, scoreDelta, scoringEventId, reason } = payload;

    // ---- Transaction: idempotency + optional rollup + event ----
    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");

      // Step 1: idempotency guard. Recording the scoring event before topology
      // resolution makes a no-link case exactly-once-effective: the event was
      // seen and intentionally skipped, not left replayable as an accidental
      // future rollup after topology changes. Same rule as wedding.budget.
      const ins = await c.query(
        `INSERT INTO lead_scoring.applied_scoring_events (tenant_id, scoring_event_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [tenantId, scoringEventId],
      );
      if ((ins.rowCount ?? 0) === 0) {
        await c.query("ROLLBACK");
        return; // Already processed — idempotent no-op.
      }

      // ---- Graph walk (read-only): resolve scoring config ----
      // Path 1: lead-bound override (agency/lead_scored_by).
      let configId: string | null = null;
      const leadScoredEdges = await this.#graph.outgoingEdges(
        tenantId,
        leadId,
        "agency/lead_scored_by",
      );
      if (leadScoredEdges.length > 0) {
        configId = leadScoredEdges[0]!.toId;
      } else {
        // Path 2: fallback via assigned user's default scoring config.
        const assignedEdges = await this.#graph.outgoingEdges(
          tenantId,
          leadId,
          "agency/lead_assigned_to_user",
        );
        if (assignedEdges.length > 0) {
          const userId = assignedEdges[0]!.toId;
          const userDefaultEdges = await this.#graph.outgoingEdges(
            tenantId,
            userId as EntityId,
            "agency/user_default_scoring",
          );
          if (userDefaultEdges.length > 0) {
            configId = userDefaultEdges[0]!.toId;
          }
        }
      }

      if (!configId) {
        console.warn(
          `[agency.lead-scoring] lead ${leadId} has no scoring config (tenant=${tenantId}). ` +
            `Skipping rollup — raw Tier-1 tenant, lead unassigned, or user has no default scoring config.`,
        );
        await c.query("COMMIT");
        return;
      }

      // Step 2: lock the LeadScoringConfig row so concurrent scoring events
      // on the same config serialize. Without FOR UPDATE, two concurrent
      // scoring updates would both read the same currentTotalLeadsScored,
      // compute different totals, and one increment would be silently lost.
      const sel = await c.query<NodeRow>(
        `SELECT id, identity, schema_version
           FROM graph.nodes
          WHERE tenant_id = $1 AND id = $2
          FOR UPDATE`,
        [tenantId, configId],
      );
      const row = sel.rows[0];
      if (!row) {
        throw new Error(
          `LeadScoringConfig node not found: ${configId} (tenant=${tenantId})`,
        );
      }

      // Step 3: increment the rollup counter.
      const currentCount =
        (row.identity["currentTotalLeadsScored"] as number | undefined) ?? 0;
      const newCount = currentCount + 1;
      const newIdentity = {
        ...row.identity,
        currentTotalLeadsScored: newCount,
      };

      await c.query(
        `UPDATE graph.nodes
            SET identity       = $3::jsonb,
                schema_version = schema_version + 1,
                updated_at     = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, configId, JSON.stringify(newIdentity)],
      );

      // Step 4: emit event in the same transaction.
      // If this throws, the UPDATE and the applied_scoring_events INSERT both
      // roll back — atomicity is preserved.
      await this.#events.publishWith(c, {
        tenantId,
        type: "agency.lead.scored",
        entityId: configId as EntityId,
        emittedBy: this.#emittedBy,
        payloadSchema: "agency.lead.scored/v1",
        payload: {
          leadScoringConfigId: configId,
          leadId,
          scoreDelta,
          newTotalLeadsScored: newCount,
          sourceScoringEventId: scoringEventId,
          ...(reason !== undefined ? { reason } : {}),
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

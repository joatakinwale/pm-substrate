/**
 * @pm/capability-kit — Authoring helpers for substrate capabilities.
 *
 * Background (G10):
 *   Pre-kit, every Tier-2 capability re-implemented the same shape:
 *
 *     1.  BEGIN
 *     2.  INSERT into <capability>.applied_<events> (idempotency)
 *     3.  ROLLBACK + return if conflict (already processed)
 *     4.  Optional graph walk to find a rollup target (returns nullable)
 *     5.  COMMIT + return if no target (raw Tier-1, missing edges, etc.)
 *     6.  SELECT FOR UPDATE on the target row (lock for serialization)
 *     7.  Compute new identity, UPDATE graph.nodes
 *     8.  events.publishWith(client) inside the same tx
 *     9.  COMMIT (or ROLLBACK on any throw)
 *    10.  Connection released in finally
 *
 *   `capability-agency-lead-scoring/handler.ts` and
 *   `capability-agency-lead-scoring/handler.ts` were near-clones of each
 *   other. The differences were entirely in step 4 (which edges to walk)
 *   and step 7 (which field to bump). Everything else was ceremony.
 *
 * What this kit gives you:
 *   - {@link defineCapability} — build a handler from a small spec object.
 *     The kit owns the transaction shape; you own the topology/policy.
 *   - {@link CapabilitySpec} — typed shape of that spec.
 *   - {@link IdempotencyTable} — a 2-column convention every Tier-2
 *     capability follows. The kit drops a parameterized INSERT into it
 *     so capabilities don't repeat the boilerplate.
 *
 * What this kit deliberately does NOT do:
 *   - Pick your idempotency table name. You own your capability-private
 *     schema (ADR-0010). The kit takes table + key-column names as params.
 *   - Run migrations. You ship your own `0009_<thing>_applied.sql`
 *     migration the same way you did before.
 *   - Hide pg.ClientBase. The walk and apply functions still receive a
 *     transactional client when they need one. Power users and weird
 *     capabilities aren't penalized.
 *
 * Compatibility note:
 *   The existing `BudgetRollupHandler` and `LeadScoringHandler` are NOT
 *   refactored to use this kit by G10. That's a follow-up (G10 phase 2).
 *   G10 phase 1 ships the kit + a substrate-side reference test that
 *   builds a synthetic capability the same way a real one would.
 */

export type {
  CapabilitySpec,
  CapabilityRuntimeDeps,
  CapabilityHandler,
  GraphWalkContext,
  GraphWriteAuthorityContext,
  ApplyContext,
  EmitContext,
  IdempotencyTable,
} from "./define.js";

export { defineCapability, NoopOnConflict } from "./define.js";

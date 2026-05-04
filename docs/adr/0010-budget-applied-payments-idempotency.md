# ADR-0010: Budget capability idempotency via `applied_payments` table

**Status:** Accepted  
**Date:** 2026-05-04  
**Context:** P2.1b — `@pm/capability-wedding-budget`

---

## Context

The `wedding.budget` capability handles `wedding.contract.payment_recorded` events
and increments `BudgetCategory.actualSpentMinor` by the payment amount. Event
delivery is at-least-once (pg_notify + catch-up replay). Without a deduplication
mechanism, re-delivering the same payment event would double-count the amount.

The payload carries a stable `paymentId` provided by the caller. This is the
natural idempotency key.

Two mechanisms were considered:

### Option A: Unique constraint on the graph node

Store `appliedPaymentIds` as a JSONB array on the BudgetCategory node and add a
DB-level unique constraint on the identity bag. Rejected because:

- JSONB arrays do not support efficient `CONTAINS` queries without a GIN index,
  and unbounded arrays grow forever with the entity.
- Adding an array to the node identity blurs the boundary between entity state
  ("what is this budget category?") and operational bookkeeping ("which payments
  have been applied?"). These are different concerns.
- The graph layer enforces profile schemas. An ever-growing array of payment IDs
  is not a semantic property of the entity.

### Option B: Separate `applied_payments` table (chosen)

A capability-private table `budget.applied_payments(tenant_id, payment_id)`
with `PRIMARY KEY (tenant_id, payment_id)` serves as the guard. The handler
inserts into this table at the start of its transaction before any rollup writes:

```sql
INSERT INTO budget.applied_payments (tenant_id, payment_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING
```

`rowCount = 0` on conflict → already applied → exit without rollup.  
`rowCount = 1` → first application → proceed with rollup + event publish.

**Atomicity:** the INSERT, the `graph.nodes` UPDATE, and the `events.events`
INSERT all run in the same Postgres transaction. If `publishWith` throws, all
three writes roll back. The `applied_payments` record disappears with the rest,
so a retry of the same `paymentId` is correctly re-processed. This is safe
because the retry re-attempts the entire idempotent operation.

**Postgres reference:** `ON CONFLICT DO NOTHING` on a multi-column PK is
guaranteed by PG17 to be atomic within the transaction (no phantom insert
between the conflict check and the skip). PG17 docs §15.4 "Explicit Locking"
and the INSERT documentation confirm this.

## Decision

Use a separate `budget.applied_payments` table (Option B).

## Consequences

- `db/migrations/0009_budget_applied_payments.sql` creates `budget.applied_payments`.
- The table is capability-private. No other package should read or write it.
  If a second capability needs similar deduplication, it gets its own table
  (or this pattern is promoted to a substrate primitive in a later phase).
- The table grows monotonically. For long-lived tenants, old rows can be
  archived after the associated BudgetCategory is finalized (closed wedding).
  No truncation policy is defined in P2; deferred to P4 operational work.
- The idempotency mechanism is tested in `budget.test.ts` test #2 (replay
  same paymentId twice, verify single increment) and test #4 (atomicity:
  verify applied_payments row is absent after a publish failure + rollback).

## Profile additions (P2.1b)

This capability required extending `@pm/profile-wedding` with:

1. **`BudgetCategory` entity** (tier1: `Resource`): stores `name`, `kind`,
   `allocatedMinor`, `currency`, and `actualSpentMinor`. The `kind` field
   satisfies the `Resource` Tier-1 interface's required discriminator field.
   `actualSpentMinor` starts at 0 and is owned exclusively by this capability.

2. **`vendor_budget_category` edge** (Vendor → BudgetCategory, `at-most:1`
   from a vendor, `unbounded` to a category): this is the structural fact that
   eliminates the WeddingWebApp production bug. The budget capability walks
   this edge to find the rollup target — no `budget_category_id` field needed
   on the Contract payload.

Profile version bumped from 1 to 2 to record the schema addition.

The profile change is additive (new entity type + new edge type). No existing
entity types or edge types were modified. Existing tests are unaffected.

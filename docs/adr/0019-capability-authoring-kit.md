# ADR-0019 — Capability authoring kit (`@pm/capability-kit`)

**Status:** Accepted (2026-05-10)
**Closes:** G10 phase 1 (capability authoring ergonomics).

## Context

Pre-G10, every Tier-2 capability re-implemented the same transactional shape:

1. `BEGIN`
2. `INSERT INTO <capability>.applied_<events> ON CONFLICT DO NOTHING` (idempotency)
3. `ROLLBACK` + return on conflict (already processed)
4. Optional graph walk to find the rollup target (returns nullable `EntityId`)
5. `COMMIT` + return if no target (raw Tier-1 tenant, missing edges, unassigned lead, etc.)
6. `SELECT … FOR UPDATE` on the target row to serialize concurrent writers
7. Compute new identity, `UPDATE graph.nodes`
8. `events.publishWith(client, …)` inside the same transaction
9. `COMMIT` (or `ROLLBACK` on any throw; connection released in `finally`)

`packages/capability-wedding-budget/src/handler.ts` (196 lines) and `packages/capability-agency-lead-scoring/src/handler.ts` (223 lines) were near-clones. The differences were entirely in step 4 (which edges to walk) and step 7 (which field to bump). Everything else was ceremony.

The substrate's plug-in story said "register a capability." In practice, the cost was 200 lines of transactional Postgres-aware TypeScript, every time.

This is the friction Emmanuel flagged: *"the substrate shouldn't always have to require any platform to redo a lot before being able to be plugged to the substrate."* The first redo target is capability authoring itself.

## Decision

Ship `@pm/capability-kit`, a substrate-side authoring helper. The kit's only public surface is `defineCapability(spec, deps)`:

```ts
defineCapability<TPayload, TApplyResult>(spec, { pool, graph, events })
  : CapabilityHandler<TPayload>
```

`spec` is a small declarative object:

| Field | Required | What you provide |
|---|---|---|
| `name` | yes | Capability identity for logs and `emittedBy` |
| `idempotency` | yes | `{ table, keyColumn }` of your capability-private idempotency table (ADR-0010 convention) |
| `extractIdempotencyKey` | yes | `payload → string` (or `NoopOnConflict` to skip the whole tx) |
| `walk` | no | `payload → graph topology → EntityId \| null` |
| `apply` | no | `(currentIdentity, …) → { nextIdentity, applyResult } \| null` |
| `emit` | no | `(targetId, applyResult, …) → PublishInput \| null` |

The kit owns:
- The transaction lifecycle (`BEGIN`/`COMMIT`/`ROLLBACK`).
- The idempotency `INSERT … ON CONFLICT DO NOTHING` and the conflict short-circuit.
- The walk-returns-null short-circuit (commit idempotency, return — "seen and intentionally skipped").
- The `SELECT … FOR UPDATE`.
- The `UPDATE graph.nodes` with `schema_version + 1` and `updated_at = now()`.
- Calling `events.publishWith(client, …)` inside the same transaction.
- `ROLLBACK` on throw + connection release in `finally`.

The capability author owns:
- What edges to walk (`spec.walk`).
- What to compute (`spec.apply`).
- What event to emit (`spec.emit`).
- The capability-private migration that creates the idempotency table.

### What we deliberately did NOT do

- **No reflection-based "infer the spec from your handler."** Magic that loses one programmer-day of debugging is not worth the line-count savings.
- **No hidden `pool`.** `apply`/`walk`/`emit` receive the live `pg.ClientBase` — power users and oddball capabilities aren't penalized.
- **No idempotency-table generator.** Capability-private schemas stay capability-owned (ADR-0010). The kit takes table + column names as constants. SQL identifiers are validated against a conservative regex *at define time* so a fat-fingered constant fails fast, not at handle time.
- **No rewrite of existing capabilities.** `BudgetRollupHandler` and `LeadScoringHandler` keep working unchanged. A future PR (G10 phase 2) ports them onto the kit; phase 1 is just the kit + tests.

## Consequences

- **New package: `packages/capability-kit/`.** Registered in root `tsconfig.json`. No production runtime dependency on existing capability packages — the kit imports only `@pm/types`, `@pm/graph`, `@pm/events`, `pg`.
- **6 new tests** (all DB-backed; describe-skipped without `PM_DATABASE_URL`):
  - Idempotency (same key twice → one rollup, one event)
  - Walk-returns-null path (idempotency committed, no UPDATE, no event, replay is no-op)
  - Apply + emit atomicity (multiple bumps fold correctly; events ordered)
  - Throw-in-apply rolls back everything (idempotency row, event, node update all absent after the throw)
  - `NoopOnConflict` from `extractIdempotencyKey` skips the whole transaction
  - SQL identifier validation rejects bad table/column names at `defineCapability` call time
- **Test count:** 201 → 207.
- **Anti-fixation diff vs substrate-owned non-test code is non-empty by construction** — this PR adds a new substrate package. The anti-fixation rule applies to *profile- and capability-driven* substrate edits; ergonomics packages that the substrate provides to capability authors are substrate work, not capability work. Same precedent that allowed `capability-audit` to live in substrate.

## Migration plan (G10 phase 2, follow-up PR)

Port the existing handlers to the kit:
1. `BudgetRollupHandler` → `defineCapability` spec.
2. `LeadScoringHandler` → `defineCapability` spec.

Each port keeps the existing payload type, idempotency table, and event surface. The expected diff is `~150 → ~50` lines per handler, with the difference moving entirely into the kit's covered code.

Phase 2 also produces a "capability author's quickstart" doc (likely a new section in `architecture.md` or its own `docs/capability-authoring.md`) showing the minimal bumper-style capability end-to-end.

## Out of scope (deliberately deferred)

- **Schema-mapping helpers.** The next ergonomics gap is "how does an app declare its existing entities → Tier-1?" That's G11.
- **App-side adapter SDK.** "How does an app *call* a capability without writing substrate-aware code?" That's G12. Probably the FastAPI / Next.js side.
- **Code generation from `Capability` registry entries.** Tempting (typed payloads inferred from `EmitContract`/`SubscribeContract`) but it requires the capability-contracts pipeline to settle first. Not now.

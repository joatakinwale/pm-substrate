# Roadmap

Five phases. Each ends with a demonstrable artifact, not a promise.

## Phase 0 — Substrate (this repo)

**Goal:** the Tier-1 substrate as a working, type-checked, migration-applied skeleton with stable interfaces. No business logic. No profile.

**Deliverables:**

- pnpm monorepo, six packages.
- Postgres-only stack via `docker compose`.
- Five DB schemas: `graph`, `events`, `projections`, `registry`, `workflow`.
- Seven Tier-1 entity-interface contracts in `@pm/types`.
- `@pm/graph` Postgres adapter — read/write API behind a stable interface.
- `@pm/events` append-only log + `LISTEN/NOTIFY` publisher/subscriber.
- `@pm/registry` capability-registration API.
- `@pm/workflow` workflow runtime stub (executes a hand-written workflow).
- `@pm/projections` single projection-worker process.
- ADRs for every decision worth remembering.
- Typecheck + test in CI.

**Effort:** 2–3 weeks.

## Phase 1 — Wedding profile (Tier 2)

**Goal:** prove the substrate by writing one profile against it.

**Deliverables:**

- `@pm/profile-wedding` package.
- Specializations: `Engagement → Wedding` (with `event_date`, `venue`, `couple_ids[2]` exact-cardinality constraint), `Counterparty → Couple/Guest/Vendor`, `Transaction → Contract/Payment/Invoice` (with the SaaS-style lifecycle), `Document → WeddingDocument` (with retention rules).
- Identity primacy declared at profile level: **`Wedding` is the spine** (every record hangs off the wedding entity, the way every Epic record hangs off the patient).
- Profile is consumed by the substrate at tenant configuration time. Substrate code unchanged.

**Effort:** 1 week.

## Phase 2 — Three composing capability providers

**Goal:** refactor three WeddingWebApp subsystems to register as capability providers against the substrate.

**Deliverables:**

- `planner-task` provider — reads `Engagement (Wedding)`; writes `Engagement.scheduled_items[]`; emits `task.created`, `task.updated`, `task.completed`.
- `gcal-projection` provider — subscribes to `task.*`; reads tenant's GCal connection; projects internal tasks to the external calendar. **The source-of-truth rule from WeddingWebApp's `AGENTS.md` is now structural** — gcal can never be the source because it's a downstream subscriber.
- `vendor-milestone` provider — reads `Counterparty (Vendor)`; writes `Transaction (Contract).milestones[]`; subscribes to `task.completed` where task is linked to a milestone; emits `milestone.due` and `payment.requested`.
- WeddingWebApp keeps running. It just routes through the substrate for these three flows. Other subsystems unchanged.

**Effort:** 2–3 weeks.

## Phase 3 — The demo moment

**Goal:** add a fourth capability provider with **zero coordination** with the first three.

**Deliverables:**

- A fourth provider — likely `budget-tracker` (subscribes to `payment.requested` → updates budget projections) or `rsvp-reminder` (subscribes to `wedding.date_changed` → schedules reminder cascades).
- Tests prove: no source code in providers A/B/C was touched.
- Recorded walkthrough showing the new capability composing cleanly with the existing three.

**Effort:** 3–5 days.

## Phase 4 — Second profile (architecture proven)

**Goal:** write a second Tier-2 profile (legal services or agency project) without touching the substrate.

**Deliverables:**

- `@pm/profile-{legal,agency}` package.
- Specializations declared; identity primacy declared (legal = `Matter`; agency = `Project`); lifecycle state machines declared.
- A ported subset of one or two capability providers from Phase 2 — proves they work against either profile *if* the providers were written against Tier-1 interfaces correctly.
- If the substrate needed any change to support the second profile, **that's a substrate bug** — not a feature request. Fix it before declaring Phase 4 done.

**Effort:** 1–2 weeks.

## Out of scope (deliberately)

- No multi-region. Single-Postgres, single-region until scale demands otherwise.
- No managed-service abstractions. Direct Postgres until we hit the migration trigger.
- No GraphQL. The graph is internal to the substrate; tools talk to it through typed APIs, not a query language.
- No multi-tenant *isolation* hardening beyond `tenant_id` partitioning. Schema-per-tenant comes later if and only if a real tenant requires it.

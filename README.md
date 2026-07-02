# pm-substrate

**The project-manager layer for agentic workspaces: a tenant-scoped, governed operational state plane.**

A JOATLABS.dev primitive. Canonical thesis: [`artifacts/pm_substrate_rewrite.md`](./artifacts/pm_substrate_rewrite.md) — *State Coherence Under Partial Observation* (2026-05-26). Refactor charter: [`refactor-plan.md`](./refactor-plan.md) (executed 2026-07-02).

---

## The problem

Work moves through many specialized tools, teams, and AI agents that each hold a partial model of the same changing reality. The hard problem is **state coherence**: bounded actors must act safely when every actor sees only part of the system, every observation can be stale, and every action may change state other actors depend on. LLM agents make this failure visible because they act quickly across many systems without owning institutional memory — but humans, departments, and SaaS tools fail the same way.

pm-substrate does not solve reality. It solves **governed operational state**: what the workspace accepts as actionable, where that claim came from, how fresh it is, which actor may change it, which workflow it belongs to, and how agents resume from it after context loss.

## Two coupled claims

1. **Plug-in claim** — a platform onboards through new mapping/profile/capability files with **zero substrate-package edits and zero changes to existing providers**. AI proposes the semantic mapping; deterministic validators, profiles, write gates, and provenance decide admissibility. *AI is the semantic mapper. The substrate is the type system, compiler, runtime, event ledger, and audit trail.* Executable form: `pnpm validate:zero-edit` (CI).
2. **Agent-state claim** — agents behave better resuming from substrate state than from chat history: current-state review before action, source authority, evidence-backed proposals, replay, amnesiac continuity. Executable form: `pnpm evals:amnesia` (CI) — baseline recall after context loss is 0%; substrate-ledger recall is 100% with a verified hash chain.

## Architecture (layers)

1. **Entity graph** — identity-only nodes, typed edges, profile-validated writes, optimistic concurrency, staleness/freshness gates. (`packages/graph`)
2. **Event log** — append-only, tenant-partitioned, hash-chained provenance, `LISTEN/NOTIFY` bus. (`packages/events`)
3. **Capability registry** — capabilities declare reads/writes/emits/subscriptions as typed contracts; isolation and the "substrate names no profile" rule are enforced by tests and CI gates. (`packages/registry`, authoring kit in `packages/capability-kit` — transactions, idempotency, graph walks, freshness gate, transactional publish)
4. **Workflow runtime** — per-tenant DAGs of capability invocations conditioned on events; retries, dead-letter, version pinning, evidence-binding for writes. (`packages/workflow`)
5. **Agent operational state** — `CurrentStateView`, `ObservationContract`, warn-first `ActionProposalReview`, durable `StateReviewArtifact` with hash replay, `ActionOutcomeEnvelope` terminal outcomes, role projections, amnesiac recovery, and **external evidence admission** (MCP handles, memory, approvals, provider policy, traces, PM handoffs — evidence, never authority). (`packages/agent-state-core` — 97 pinned runtime exports; the witness/authority/quorum/seal tower is quarantined in `packages/agent-state-provenance`, no runtime importers, SQL gated by `PM_ENABLE_AGENT_STATE_PROVENANCE=1`)
6. **Procedure admission** — deterministic scripts, Pi Harness runs, browser QA runs, and other repeated procedures execute through runner ports but become operational only after authority-scoped admission and replay. (`packages/procedure-admission`; HTTP routes in `packages/substrate-http`)
7. **Continuity** — hash-chained agent checkpoints; prior conclusions become queryable state, not chat recall. (`packages/continuity`)
8. **Evals** — paired baseline/substrate scenarios, fixture corpora, artifact-derived metrics, the measured amnesia-resume number, and the live two-arm agent lab (real local LLM, hermetic worlds, oracle reads the admitted log). (`packages/evals`, `packages/local-agent-lab`, `packages/substrate-dashboard`)

Supporting: `entity-mapping` (declarative source→substrate mappings + profile-aware semantic validation), `tenants`, `projections`, `profile-registry`, `substrate-http` (+ demo).

## Layered ontology

- **Tier 1 — universal primitives** (`packages/types`): `Counterparty`, `Engagement`, `Transaction`, `Resource`, `Communication`, `Document`, `Event`.
- **Tier 2 — profiles as libraries**, installed per tenant at runtime:
  - `profile-pmgovernance` — **the objective**: PM methodology as multi-agent governance. RACI as typed edges (single accountability enforced by the substrate's `exactly:1` edge cardinality at write time), stage-gate lifecycles (`WorkItem`, `Milestone`, `ApprovalRequest`, `Initiative`), identity primacy on `Initiative`. Paired with `capability-pmgovernance-stage-gate`: approval-gated, freshness-gated, idempotent lifecycle advancement plus a status-rollup projection, exercised live by the `pm-governance-approval-gate` lab scenario.
  - `profile-agency` — marketing-agency specialization; onboarding artifact for the (external) PluggedInSocial platform.
  - `profile-finance-research` — ArrowHedge research/backtest specialization (validation artifact).
- **Tier 3 — tenant customizations.**

The substrate names no profile in its own code; the anti-fixation rule is CI-enforced.

## Governance mechanics (PM methodology → substrate primitives)

| PM / governance concept | Substrate primitive |
|---|---|
| Single accountable owner (RACI "A") | `accountable_to` edge, `fromCardinality: "exactly:1"` — a second "A" is refused at write time |
| Approval gate before advancement | `ApprovalRequest` lifecycle + `capability-pmgovernance-stage-gate` (walks `pmgovernance/requests`, validates legality via the installed profile) |
| "Review current state before acting" | `CurrentStateView` + `ObservationContract` + the capability-kit freshness gate (`StaleReadError`, non-retryable) |
| Stage-gate advancement | lifecycle transitions the substrate checks and the capability decides |
| Standup / status / reporting | `continuity` checkpoints + `projections` read-models over the event log |
| Audit trail | the event log's hash chain — not the quarantined tower |

## Day-1 stack (deliberate)

Postgres-only: core schemas (`graph`, `events`, `registry`, `workflow`, `projections`, `substrate`, `profiles`, `continuity`, `evals`, `procedure_admission`) plus capability-private schemas (`lead_scoring`, `pm_governance`, …), `LISTEN/NOTIFY` as the bus, FTS for search, one projection worker. Heartbeats are **reconciliation events** (Kubernetes-controller style), never truth. Each piece swaps under a stable contract when scale demands (see `docs/adr/0001-day-1-stack.md`).

Migrations are two-tier: `db/migrations/` (26 files — the required core) applies by default; `db/migrations-provenance/` (123 files — the quarantined agent-state tower) applies only with `PM_ENABLE_AGENT_STATE_PROVENANCE=1`. The full test suite passes against a core-only database.

## Getting started

```bash
pnpm install
pnpm db:up
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:migrate
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:seed
pnpm build
pnpm typecheck
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test
```

To apply the quarantined provenance tower for compatibility testing:

```bash
PM_DATABASE_URL=... PM_ENABLE_AGENT_STATE_PROVENANCE=1 pnpm db:migrate
```

Environment knobs: `PM_DATABASE_URL` (unset ⇒ DB-gated tests skip), `PM_DEV_TENANT_ID` (default `tenant_dev`), `PM_ENABLE_AGENT_STATE_PROVENANCE`, `PM_PLUGGED_IN_SOCIAL_DIR` (path to the external PluggedInSocial checkout; unset ⇒ live-tree conformance tests skip).

## CI gates (all must be green)

| Gate | Command | Enforces |
|---|---|---|
| Typed contracts | `pnpm validate-contracts --strict` | every capability declares typed, schema-backed contracts |
| Guardrails | `pnpm validate:budgets` | file budgets (src 2k / test 4k) with a frozen may-shrink-never-grow ratchet, 63-char exported-name lint (the executable v229 recursion-stop rule), provenance isolation, explicit core surface |
| Anti-fixation | `pnpm validate:zero-edit` | runtime core imports no profile/capability; no cross-package `src/` deep imports; plug-ins never import the HTTP surface |
| Primitive back-map | `pnpm validate:arrowsmith-primitives` | new proof layers must declare the primitive family they strengthen |
| Amnesia headline | `pnpm evals:amnesia` | baseline 0% vs substrate 100% recall, hash chain verified |

Verification baseline (2026-07-02): build + typecheck clean; **873 tests passed / 7 env-gated skips**, identical on core-only and tower-enabled databases. See [`docs/state-validation/verification-baseline-2026-07-02.md`](./docs/state-validation/verification-baseline-2026-07-02.md).

## Repository layout

```
packages/
  types                      Tier-1 entity contracts (types only)
  graph, events, registry,   the substrate runtime core
  workflow, projections,
  profile-registry, tenants,
  continuity, capability-kit,
  procedure-admission,
  substrate-http (+ demo)
  agent-state-core           lean agent-state surface (97 pinned exports)
  agent-state-provenance     quarantined proof tower (frozen ratchet, opt-in SQL)
  profile-pmgovernance       PM methodology as governance (the objective)
  profile-agency,            other Tier-2 profiles
  profile-finance-research
  capability-pmgovernance-stage-gate, capability-agency-lead-scoring,
  capability-audit, capability-finance-research-ingest
  entity-mapping             declarative app→substrate onboarding
  evals, local-agent-lab,    measurement: paired evals + live two-arm agent lab
  substrate-dashboard
db/migrations/               required core migrations (default)
db/migrations-provenance/    quarantined tower migrations (flag-gated)
scripts/                     migrate, seed, CI gates, measurements
```

External testbeds (separate checkouts, onboarded as substrate consumers — no app code lives in this repo): **PluggedInSocial** (agency platform; conformance via `PM_PLUGGED_IN_SOCIAL_DIR`) and **ArrowHedgeLabs** (multi-agent financial-research sandbox — the *agents* are the subject, not finance). See [`docs/validation.md`](./docs/validation.md) for tests T1–T8 and the 12 behavior metrics.

## Research

`research/index.md` is the claim ledger (C001+, run protocol, implementation frontier). Daily chains: `research/daily-arrowsmith-agent-state/`, `research/daily-ai-competitive-intelligence/`. Research claims must map to executable substrate checks — *architecture without falsification criteria is theology* ([`docs/validation.md`](./docs/validation.md)).

## License

Proprietary. JOATLABS.dev.

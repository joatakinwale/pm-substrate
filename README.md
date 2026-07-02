# pm-substrate

**The project-manager layer for agentic workspaces: a tenant-scoped, governed operational state plane.**

A JOATLABS.dev primitive. Canonical thesis: [`artifacts/pm_substrate_rewrite.md`](./artifacts/pm_substrate_rewrite.md) — *State Coherence Under Partial Observation* (2026-05-26).

---

## The problem

Work moves through many specialized tools, teams, and AI agents that each hold a partial model of the same changing reality. The hard problem is **state coherence**: bounded actors must act safely when every actor sees only part of the system, every observation can be stale, and every action may change state other actors depend on. LLM agents make this failure visible because they act quickly across many systems without owning institutional memory — but humans, departments, and SaaS tools fail the same way.

pm-substrate does not solve reality. It solves **governed operational state**: what the workspace accepts as actionable, where that claim came from, how fresh it is, which actor may change it, which workflow it belongs to, and how agents resume from it after context loss.

## Two coupled claims

1. **Plug-in claim** — a platform onboards through new mapping/profile/capability files with **zero substrate-package edits and zero changes to existing providers**. AI proposes the semantic mapping; deterministic validators, profiles, write gates, and provenance decide admissibility. *AI is the semantic mapper. The substrate is the type system, compiler, runtime, event ledger, and audit trail.*
2. **Agent-state claim** — agents behave better resuming from substrate state than from chat history: current-state review before action, source authority, evidence-backed proposals, replay, amnesiac continuity.

Validation surface: the **ArrowHedgeLabs sandbox** (a multi-agent financial-research project used strictly as a research/education testbed — the *agents* are the subject, not finance). See [`docs/validation.md`](./docs/validation.md) for tests T1–T8 and the 12 behavior metrics.

## Architecture (layers)

1. **Entity graph** — identity-only nodes, typed edges, profile-validated writes. (`packages/graph`)
2. **Event log** — append-only, tenant-partitioned, hash-chained provenance, `LISTEN/NOTIFY` bus. (`packages/events`)
3. **Capability registry** — tools declare reads/emits/permissions; isolation enforced by test. (`packages/registry`, `packages/capability-kit`)
4. **Workflow runtime** — per-tenant processes conditioned on events. (`packages/workflow`)
5. **Agent operational state** — `CurrentStateView`, `ObservationContract` (v2: integrity hash, holder binding, allowed use), `ActionProposalReview` (warn-first), durable `StateReviewArtifact` with hash replay, observed read-set comparison, invariant-class policy, `ActionOutcomeEnvelope`, and **external evidence admission** (MCP handles, memory, approvals, provider policy, traces, PM handoffs — evidence, never authority). (`packages/agent-state-core`; the witness/authority/quorum/seal tower is quarantined in `packages/agent-state-provenance` and gated by `PM_ENABLE_AGENT_STATE_PROVENANCE=1`)
6. **Procedure admission** — deterministic scripts, Pi Harness runs, browser QA runs, and other repeated procedures become operational only after authority-scoped admission and replay. (`packages/procedure-admission`)
7. **Evals** — paired baseline/substrate scenarios, ArrowHedge fixture corpus, artifact-derived metrics, admission fixtures, run groups, role projections. (`packages/evals`)

Supporting: `entity-mapping` (declarative source→substrate mappings + profile-aware semantic validation), `continuity` (agent checkpoints), `tenants`, `projections`, `profile-registry`, `substrate-http` (+ demo).

## Layered ontology

- **Tier 1 — universal primitives** (`packages/types`): `Counterparty`, `Engagement`, `Transaction`, `Resource`, `Communication`, `Document`, `Event`.
- **Tier 2 — profiles** as libraries: `profile-finance-research` (ArrowHedge validation artifact), `profile-agency` (second-profile proof that the substrate is profile-agnostic — enforced by `substrate-profile-agnostic.test.ts`).
- **Tier 3 — tenant customizations.**

The substrate names no profile in its own code; profiles install per tenant at runtime.

## Day-1 stack (deliberate)

Postgres-only: five schemas, `LISTEN/NOTIFY` as the bus, FTS for search, one projection worker. Heartbeats are **reconciliation events** (Kubernetes-controller style), never truth. Each piece swaps under a stable contract when scale demands (see `docs/adr/0001-day-1-stack.md`).

## Getting started

```bash
pnpm install
pnpm db:up
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:migrate
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:seed
pnpm build
pnpm typecheck
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test
pnpm validate:budgets
pnpm validate:zero-edit
pnpm validate:arrowsmith-primitives
```

The default migration path applies the lean core only. To apply the quarantined
provenance tower for compatibility testing:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate \
PM_ENABLE_AGENT_STATE_PROVENANCE=1 \
pnpm db:migrate
```

## Research

`research/index.md` is the claim ledger (C001+, run protocol, implementation frontier). Daily chains: `research/daily-arrowsmith-agent-state/`, `research/daily-ai-competitive-intelligence/`. Research claims must map to executable substrate checks — *architecture without falsification criteria is theology* ([`docs/validation.md`](./docs/validation.md)).

## License

Proprietary. JOATLABS.dev.

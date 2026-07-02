# pm-substrate — Code Analysis

*Grounded in the implementation (source, migrations, manifests, tests, scripts) — not the research writeups or thesis PDF. Reviewed July 2026.*

---

## 1. What pm-substrate is

pm-substrate is a **tenant-scoped operational-state backend ("substrate") for agentic workspaces** — infrastructure that sits underneath specialized tools, teams, and AI agents and holds the *governed, auditable version of "what the workspace currently believes is true and actionable."* It is a TypeScript monorepo (`"PM-layer Tier-1 substrate. Universal entity graph + event log + capability registry + workflow runtime."`) whose central bet is that many actors — human and AI — each carry a partial, stale model of the same changing reality, and that the missing piece is not smarter agents but a shared substrate that records *what a claim is, where it came from, how fresh it is, who may change it, which workflow it belongs to, and how an agent resumes from it after losing context.*

Concretely, the code implements a **universal entity graph + append-only hash-chained event log + capability registry + per-tenant workflow runtime + CQRS projections**, plus an unusually large **agent operational-state / provenance layer**. It is a **library/platform, not an end-user app**: two external applications in the same tree — `arrowhedgelab` (a Python multi-agent finance-research system) and `plugged_in_social` (a full-stack marketing-agency platform) — serve as validation sandboxes. The core design discipline is that the substrate is **domain-agnostic**: it names no industry in its own code, and business meaning is added by *profiles* (libraries) installed per tenant at runtime.

Who/what it's for: platform builders who want to onboard a new product's data model onto a common governed graph "with zero substrate edits" (a stated goal, enforced by a test), and AI agents that are expected to behave more safely when resuming from substrate state than from chat history.

---

## 2. Core concepts / domain model (as the code declares them)

### The three-tier ontology
- **Tier 1 — seven universal primitives** (`packages/types`, pure interfaces, no runtime): `Counterparty`, `Engagement`, `Transaction`, `Resource`, `Communication`, `Document`, `BusinessEvent`. Each extends a common `NodeBase` and carries only an `identity` bag of stable attributes.
- **Tier 2 — profiles as shippable libraries**: `profile-finance-research` (entities like `ResearchRun`, `BacktestRun`, `AnalystSignal`, `RiskState`, `PortfolioState`, `PortfolioDecision`; spine = `ResearchRun`) and `profile-agency` (entities like `ClientOrg`, `Lead`, `Project`, `Proposal`, `Campaign`; spine = `Project`, explicitly modeled on the real PluggedInSocial SQLAlchemy schema).
- **Tier 3 — per-tenant customizations** (installed at runtime).

### Foundational shapes
- **NodeBase**: `id`, `tenantId`, `profile` (a `ProfileBinding` of `{tier1, profile, concrete}`), `createdAt/updatedAt`, `schemaVersion`, `revision` (optimistic concurrency), and an opaque `identity` record. Discipline rule baked into comments: *identity + stable attributes live on nodes; everything contextual is an edge.*
- **Edge**: typed, directional, tenant-scoped, small `attrs`, tombstoned (`deleted_at`) not hard-deleted. Edge-type catalog and cardinality are profile-declared, not substrate-known.
- **PMEvent**: append-only event-log row with `type`, `entityId`, `emittedBy`, versioned `payloadSchema`/`payload`, plus **provenance/chain-of-custody** fields — `authority`, `contentHash`, `priorEventHash`, `causedBy` (causation chain). This is a hash-chained ledger, not just a message bus.
- **ProfileDefinition**: declares `entityTypes` (required/optional identity fields per concrete type), an `edgeTypes` catalog with `CardinalityConstraint` (`exactly:N` / `at-most:N` / `at-least:N` / `unbounded`), `lifecycles` (state machines with legal transitions the substrate *enforces but does not choose*), and `identityPrimacy` — the single "spine" entity every record must reach.
- **Typed capability contracts** (`capability-contract.ts`): `EmitContract` / `SubscribeContract` / `ReadContract` / `WriteContract` carry `SchemaVersion` triples, accepted version ranges, field-level read/write declarations, `ownership` (`owner`/`contributor`/`delegated`), and discoverable *terminal-admission providers*. A v1 (string arrays) → v2 (typed) migration is modeled explicitly.

### Cross-cutting concepts the code centers on
- **Tenant partitioning from commit one** — every table and ID carries `tenantId`; there is no global entity.
- **Capabilities instead of "integrations"** — tools register what they read/write/emit/subscribe/permit; the substrate routes.
- **Workflows as data** — a workflow is a DAG of capability invocations conditioned on events, per tenant; no workflow ships in the substrate.
- **CQRS** — the graph is source of truth; projections are deterministic read-models whose only state is a cursor into the event log (with replay).
- **Freshness/staleness gating** — reads can be tagged with staleness and gated (`freshnessGate`, `requireFresh`, `StaleReadError`).
- **Agent operational state** — `CurrentStateView`, `ObservationContract`, warn-first `ActionProposalReview`, durable `StateReviewArtifact` with hash replay, and **external-evidence admission** (MCP handles, memory, approvals, traces treated as *evidence, never authority*).
- **Continuity checkpoints** — a per-agent, hash-chained "work memory" ledger (`continuity.checkpoints`).
- **Evals** — paired *baseline vs substrate* runs with a failure-class taxonomy, recorded to an evidence ledger (`evals.eval_events`).

---

## 3. Architecture overview

### Layered package structure
The monorepo is a pnpm workspace (`packages/*`) using TypeScript project references. Dependencies flow strictly upward from `@pm/types`.

| Layer | Packages | Role |
|---|---|---|
| Contracts | `types` | Seven Tier-1 interfaces + branded IDs; **no runtime**. |
| L1 Graph | `graph`, `profile-registry` | Postgres nodes/edges; profile-validated writes; optimistic concurrency; write-authority checks. |
| L2 Events | `events`, `projections` | Append-only partitioned log, `LISTEN/NOTIFY` router, hash-chain verification; CQRS projection runner + replay frontier. |
| L3 Registry | `registry`, `capability-kit` | Capability catalog + typed-contract normalization + terminal-admission-provider certificates; `defineCapability()` authoring kit. |
| L4 Workflow | `workflow` | DAG runtime: cycle detection, soundness analysis, input validation, permission authorizer, retry + dead-letter, evidence binding. |
| Agent state | `agent-state`, `continuity` | Current-state views, review artifacts, evidence admission, and a very large provenance/authority apparatus. |
| Onboarding | `entity-mapping`, `tenants` | Declarative source→substrate mappings (structural validator today); tenant directory/lifecycle. |
| Capabilities | `capability-audit`, `capability-agency-lead-scoring`, `capability-finance-research-ingest` | Example Tier-1/Tier-2 capabilities. |
| Profiles | `profile-finance-research`, `profile-agency` | The two Tier-2 domain libraries. |
| Edge / delivery | `substrate-http`, `substrate-http-demo`, `substrate-dashboard` | Hono HTTP surface (1:1 with package methods); demo bootstrap; operational visualization dashboard. |
| Validation | `evals`, `local-agent-lab` | Eval schema/metrics; a live Ollama-agent testbed running "no-substrate vs substrate" arms. |

### How it fits together at runtime
The demo server (`substrate-http-demo/src/server.ts`) shows the wiring: a Postgres `Pool` → `Postgres*` adapters (`PostgresEventStore`, `PostgresGraph` with a profile-validator factory, `PostgresRegistry`, `PostgresProjectionRunner`, `PostgresTenantDirectory`, `PostgresProfileRegistry`) → `createSubstrateApp` (Hono) → Node HTTP server. Adapters accept a caller-supplied transaction so a **graph mutation and its event publish commit atomically**. HTTP routes (`graph`, `events`, `capabilities`, `profiles`, `projections`, `tenants`) map 1:1 onto existing substrate methods by design — the stated rule is that if a second business model needs a new endpoint, the abstraction has failed. Profiles/capabilities are HTTP *clients* of this layer, not server extensions.

### The "plug-in" model
Onboarding a platform is meant to be additive: new mapping + profile + capability files, "zero substrate-package edits." AI proposes the semantic mapping; deterministic validators, profile catalogs, write gates, and provenance decide admissibility. This profile-agnosticism is **test-enforced** (`registry/src/substrate-profile-agnostic.test.ts`), and the agency profile's own header codifies the "G4 anti-fixation rule" (building it must not force edits to `types`/`graph`/`events`/`workflow`/etc.).

### Tech stack
- **Language/build**: TypeScript 5.9 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ES2023 / ESNext modules, project references (`composite`), Node ≥ 22, pnpm 10.
- **Persistence**: PostgreSQL only, via the raw `pg` driver (no ORM). Twelve schemas (`substrate`, `graph`, `events`, `registry`, `workflow`, `projections`, `profiles`, `continuity`, `evals`, `budget`, `lead_scoring`, `agent_state`). Events table is **range-partitioned by month**; the bus is `LISTEN/NOTIFY`; search via FTS. Docker Compose runs Postgres.
- **HTTP**: Hono. **Tests**: Vitest (DB-gated integration tests via `PM_DATABASE_URL`). **Scripts**: `tsx` (`migrate`, `seed`, `seed-arrowhedge`, `validate-contracts`, `run-local-agent-lab-live-evals`, `authority-recovery`, …).
- **Agents**: a local **Ollama** client for the live agent lab. The dashboard is a small server+browser TS app for replay artifacts and evidence-admission metrics.
- **Deliberate "day-1 stack"**: Postgres-as-everything, each piece swappable under a stable contract when scale demands (recorded in `docs/adr/0001`).

---

## 4. Current state / maturity

**Broadly: the core substrate is genuinely built, compiled, and heavily tested; one layer (agent-state) has grown to a size and complexity that dominates the codebase and stands out as the primary risk.**

### Implemented and solid
- **Real, not scaffolded.** Build artifacts (`dist/index.js`) exist for all core packages; there are **829 test cases across ~79K lines of test code, zero skipped tests**, and essentially no stubs/TODOs (a scan surfaced 14 matches, all SQL/HTML `placeholder` false positives). The engineering is substantive: optimistic concurrency + edge tombstones, monthly partitioning, hash-chain provenance *with verification*, workflow **cycle detection and soundness analysis**, typed-contract validation, permission authorizer, retry/dead-letter, projection replay frontier, and staleness gating.
- **Profile-agnosticism is demonstrated**, not just asserted — two working Tier-2 profiles (finance-research, agency) plus a test that fails if the substrate leaks profile knowledge.
- **Clean contracts core.** `@pm/types` is disciplined (interfaces only, heavily documented invariants), and adapters implement narrow interfaces, so the swap-under-contract story is credible.

### The dominant finding: agent-state hypertrophy
The `agent-state` layer is wildly out of proportion to everything else and reads like mechanical, iterative "gap-closing" accretion (the codebase is peppered with G-numbered gaps, "daily research chains," and a 387 KB `Changelog.md`):
- `agent-state/src/index.ts` is a single **~85,000-line, 4 MB file with 1,611 exports** (546 functions, 704 interfaces, 78 classes) — about **71% of all non-test source in the repo**.
- **123 of 147 SQL migrations** live in the `agent_state` schema, forming a deeply *recursive* tower: every concept acquires an `admission_record`, then an `admission_witness_record`, then an `authority_transition`, then an `authority_transition_admission`, then a *witness of that*, and so on 5–7 levels deep — plus quorum certificates, signature-verifier proofs, separation-of-duty proofs, privacy-preserving-policy proofs, authority-epoch seals, and compaction/pruning tombstones. Table names grow so long they had to be hand-abbreviated (e.g. `sig_verifier_proof_adm_wit_auth_trans_adm_wit_auth_trans_adms`).
- Functionally this is a **distributed-consensus / Byzantine-grade provenance-and-authority apparatus** bolted onto operational-state recovery. It is internally consistent, append-only-enforced (rewrite-blocking triggers, `REVOKE` grants), and tested — but the *marginal value of each additional nesting level is not evident from the code*, and the volume is a real comprehensibility and maintainability liability. If one area needs pruning or a design reset, it is this one.

### Notable gaps / rough edges
- **Onboarding is partway.** `entity-mapping` ships the declarative format + structural validator only; profile-aware semantic validation, ingestion adapters, and TS codegen are explicitly deferred ("phase 2").
- **Authoring-kit not retrofitted.** `capability-kit`'s `defineCapability()` exists, but existing handlers (budget rollup, lead scoring) are noted as not yet migrated to it.
- **Operational TODOs in comments.** Workflow cycle-*prevention-at-install* is marked TODO; event partition automation is manual (a few months bootstrapped, `pg_partman` "later").
- **Testing needs infra.** The full suite is DB-gated (`PM_DATABASE_URL`), so a bare `vitest run` exercises only the non-DB portion.

### Direction the code suggests
Git shows a focused **two-month sprint (May 1 – Jul 1 2026, 172 commits)**. The arc: build the core substrate → invest heavily in the agent-state proof/authority machinery → and, in the **most recent ~30 commits, pivot toward a concrete "autonomous marketing agency"** on top of the substrate (PluggedInSocial integration API, agency command center, autonomous run kickoff, approval decisions, run monitor, live "axis-b" adapter, access-request flows). In other words, the project is moving from *substrate primitives* toward *an autonomous-agent application that exercises them* — using `arrowhedgelab` (finance research) and `plugged_in_social` (agency) as the two real-world proving grounds. License is proprietary (JOATLABS.dev).

### One-line assessment
A thoughtfully designed, well-tested, genuinely profile-agnostic operational-state substrate with a clean primitive core — carrying one enormously overgrown provenance/authority subsystem that is the codebase's defining feature and its biggest open question.

# Architecture

Canonical thesis: [`artifacts/pm_substrate_rewrite.md`](../artifacts/pm_substrate_rewrite.md) — *State Coherence Under Partial Observation*. This document is the engineering view of that thesis. The earlier wedding-era framing is retired; historical ADRs record it.

## Thesis

An agent — human, department, SaaS tool, or LLM — is a bounded perception-action system: it observes a partial world, encodes observations into an internal model, chooses actions, and receives delayed feedback. Work fails when bounded actors act from divergent local state. pm-substrate is the **project-manager layer**: the tenant-scoped governed state plane that keeps those actors aligned.

The substrate distinguishes state kinds explicitly: reality state, observed state, belief state, **operational state** (what the workspace accepts as actionable), authoritative state, historical state, and projection state. It never claims to know reality; it makes observation, evidence, freshness, authority, and invalidation explicit.

**AI is semantic I/O, never authority.** Models propose mappings and actions; deterministic validators, profiles, permissions, write gates, and provenance decide admissibility.

## The layers

### 1 — Entity graph (`@pm/graph`)

Identity-only nodes; everything contextual on typed edges. Tools query the edges they care about, not the whole node — this avoids the fat-node failure mode (every tool writing to one record; reads pulling data tools don't need; writes contending on one row). Profile validators are wired into the graph: profile-illegal writes are rejected at the graph layer, not opt-in.

### 2 — Event log (`@pm/events`)

Append-only, partitioned by tenant, topic-scoped subscriptions. Every event carries `authority`, a `contentHash`, and a `priorEventHash` forming a per-tenant hash chain; `verifyChain()` replays it. Ordering is by a monotonic sequence (`seq`), not timestamps — `now()` freezes per transaction, so multi-event transactions would otherwise tie and fork the chain (found by the ArrowHedge DB proof; fixed in migration 0019). Topic scoping avoids the everyone-subscribes-to-everything thundering herd.

### 3 — Capability registry (`@pm/registry`, `@pm/capability-kit`)

Tools register as capability providers declaring reads, emitted events, and required permissions. Capabilities are siblings, not friends: no capability may import another capability or a foreign profile — enforced statically by `capability-isolation.test.ts`. "Integration" stops existing as a concept; the substrate routes.

### 4 — Workflow runtime (`@pm/workflow`)

Processes expressed as per-tenant graphs of capability invocations conditioned on events, with contract validation. Lifecycle state machines are declared by profiles (e.g. a research run blocks on `workflow.blocked.stale_state`).

### 5 — Agent operational state (`@pm/agent-state`)

The layer that makes the agent-state claim concrete, as pure primitives:

- `CurrentStateView` — sourceRefs, observedAt, validUntil, authorityRule, projectionVersion, workflowPosition, missingSources, conflicts, allowedActions.
- `ObservationContract` (v2) — issuer, integrity hash, holder binding (DPoP-style), allowed use, redaction policy, revocation ref.
- `ActionProposalReview` — warn-first review of a proposed action against current state: read-set validation, observation re-evaluation, contract-binding checks, multi-object role preconditions. Advisory vs blocking is explicit. The selected workflow runtime gate can now block write-capable dispatch when an evidence binding is missing, incomplete, explicitly policy-blocked, or unverifiable by an opt-in catalog verifier; broad external mutation governance remains unclaimed until all write transports consume that gate.
- `StateReviewArtifact` — durable, canonical-JSON, hash-replayable record of every review; JSONL export/import; continuity payload linkage; run-group metadata for trajectory-level analysis.
- Observed read-set comparison — declared reads vs what tools actually read (undeclared/unobserved/stale/authority drift).
- Invariant-class policy matrix — subject identity, tenant boundary, required evidence, freshness, source authority, projection version, workflow position, state conflict, capability contract × low/medium/high consequence → advisory/`wouldBlock`.
- **External evidence admission** — MCP handles/tasks/annotations, memory retrieval (retention/deletion-residue metadata), monitoring, lineage, audit, attestations, workflow traces, approvals (currentness vs revision/hash/scope), provider policy (retention/ZDR/data classes), custom stores, subagent outputs, OBO identity (provenance-vs-authorization alignment), PM handoffs (typed owners). Admission validates source, subject, tenant, freshness, integrity, and policy; `authorityStatus` is always `evidence_only`. Evidence informs review; it never becomes authority.

### 6 — Evals (`@pm/evals`)

Paired baseline/substrate scenarios (local-lab), the ArrowHedge fixture corpus (temporal misalignment phases, clean-current baseline), artifact-derived metrics, evidence-admission fixture corpus across all lanes, write-binding replay corpus for allowed/unverified/missing/incomplete/policy-blocked write attempts, run groups (error-propagation detection), and role projections (risk officer / project manager / auditor) over a stable artifact invariant core.

## The plug-in pipeline (how a platform onboards)

1. Discover the source (DB schema, API schema, CSV headers, event payloads).
2. AI proposes the mapping (entities, field aliases, edges, source refs, event types).
3. Validate structurally against the mapping format (`@pm/entity-mapping`).
4. Validate semantically against the installed profile (concrete types, tier-1 bindings, identity fields, edge types/cardinalities).
5. Dry-run sample data into graph-ready inputs without mutating production state.
6. Write-capable paths that opt into the runtime evidence-binding gate validate their state-review artifact ids, artifact hashes, evidence-admission review ids, and policy disposition before dispatch. The verifier hook can reject unverifiable bindings against a trusted catalog; broad mutation governance is a frontier item until durable verification stores and every external write transport consume the same gate.
7. Version and approve the mapping (fixtures, expected outputs, rollback path).
8. Operate through adapters; the source platform remains itself.

**Acceptance criterion:** onboarding requires new mapping files, fixtures, tests, and possibly a thin adapter — and **zero changes to substrate packages or existing providers**. A substrate edit during onboarding is a falsified claim, not a feature request.

## Heartbeats are reconciliation, not truth

A cron tick emits a **state census**: which sources were checked, which facts were fresh, which projections were invalidated, which workflows blocked, which agent plans depend on changed state, which conflicts need resolution. Borrowed disciplines: Kubernetes controllers (desired vs current state), OpenTelemetry (traces/metrics/logs as separate signals), Lamport (ordering without a shared clock).

## Layered ontology

Tier 1: seven universal primitives, identical across tenants. Tier 2: profiles as libraries — currently `finance-research` (the ArrowHedge validation artifact) and `agency` (second-profile proof). Tier 3: tenant customizations. The substrate names no profile in its own source — enforced by `substrate-profile-agnostic.test.ts`, which scans substrate packages for any profile identifier and fails on leak.

## Where this pattern dies — and the guards

- **Schema governance** → tools bind to declared interfaces, not concrete tenant types.
- **God-object registry** → capability isolation test; capabilities communicate only via events.
- **Profile leakage** → profile-agnostic scan; raw Tier-1 writes stay legal with profiles installed.
- **Two-state problem** (agent memory vs project state) → agent memory is subordinate: claims cite evidence and rebase against substrate state before action; admission gates external evidence.
- **Performance modes** — fat node (layer-1 design), thundering herd (topic scoping), schema-flex tax (hot fields typed, custom fields JSONB + partial indexes), cross-tenant analytics (CQRS projections), audit firehose (tiered storage when scale demands).

## Day-1 stack and day-365 swaps

PostgreSQL only: `graph`, `events`, `projections`, `registry`, `workflow` schemas; `LISTEN/NOTIFY` bus; FTS; single projection worker. Discipline over infrastructure: emit events for every mutation, build read models even with one consumer, partition by tenant from commit one. Swap-behind-interface when triggered: Kafka/Redpanda past ~10k events/sec sustained, OpenSearch when FTS slows, ClickHouse for analytics, read replicas on primary saturation.

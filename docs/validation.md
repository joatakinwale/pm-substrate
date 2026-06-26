# Validation Framework

> Read this before the architecture doc. Architecture without falsification criteria is theology.

## The objective

The substrate is validated when **two claims hold simultaneously** on the ArrowHedgeLabs sandbox (a multi-agent research project used strictly for research/education — the *agents and their operational state* are the subject, not finance):

1. **Plug-in claim** — ArrowHedgeLabs onboards through mapping/profile/capability files with **zero substrate-package edits and zero changes to existing providers**.
2. **Agent-state claim** — agents resuming from substrate state outperform chat-history baselines on staleness, authority, evidence, replay, and continuity.

The agent-state work is not a pivot from the PM-layer thesis; it is the harder validation surface for it (see `artifacts/pm_substrate_rewrite.md`).

---

## Test plan T1–T8 (from the rewrite thesis)

| Test | Pass condition | Status / executable proof |
|---|---|---|
| T1 Source mapping | ArrowHedge tickers/signals/risk/decisions map into substrate entities/events; mapping validates structurally + semantically; no substrate edits | **Implemented** — `ARROWHEDGE_ENTITY_MAPPING`, `@pm/entity-mapping` structural + semantic validators, ingestion-plan tests |
| T2 Event provenance | Every decision traces to contributing signals + risk state via causation chain | **Implemented** — typed events with `authority`/`causedBy`, hash-chained log, `verifyChain` DB proof (chain-fork bug under same-transaction bursts found and fixed via monotonic `seq`, migration 0019) |
| T3 Deterministic risk gate | LLM can choose only actions/quantities the deterministic gate permits | **Partial** — `RiskState` recorded as operational state; `allowedActions` gate proposals at review; runtime write-path enforcement still unclaimed |
| T4 Amnesiac resume | Delete chat context; agent resumes open work from tenant/agent/scope, avoids contradicted claims, cites substrate evidence | **Open** — `@pm/continuity` checkpoints + evidence-linked payloads exist; the full delete-context resume eval has not run |
| T5 Staleness failure | Workflow blocks or requests refresh before producing a stale decision | **Implemented (eval level)** — stale-observation paired evals, ArrowHedge temporal fixtures, `workflow.blocked.stale_state` lifecycle |
| T6 Plug-in file formats | JSON/CSV/SQL-row exports produce equivalent canonical entities/events | **Partial** — corpus-equivalence helpers (fixture vs projected); CSV/SQL lanes not yet exercised |
| T7 Replay audit | Historical run replays from event history; differences explained deterministically | **Implemented (eval level)** — artifact hash replay, JSONL import validity, COP fold determinism |
| T8 Conflict handling | Conflicting claims + stale risk recorded; no silent promotion; routed to rule/human review | **Implemented (eval level)** — state disagreements, authority gates, conflict warnings in review artifacts |

## The 12 behavior metrics

Time-to-plugin · substrate edit count (target: zero) · mapping coverage · validator rejection rate · evidence coverage · state disagreement rate · stale action rate · agent resume success · replay fidelity · unauthorized action block rate · cross-tool outcome success · mean time to reconcile.

Instrumentation today: artifact-derived metrics (`analyzeStateReviewArtifacts`, evidence-admission metrics, run groups) plus write-binding replay metrics cover the staleness/evidence/replay/policy lanes, catalog-verification failures, and selected write-gate outcomes. The plug-in lane (time-to-plugin, substrate edit count, mapping coverage) is **not yet instrumented** — tracked in `research/index.md` → remaining frontier.

---

## Falsification — what kills the architecture

1. **Onboarding requires a substrate edit.** The plug-in claim is the sharpest falsifiable claim; an edit is a falsification, not a feature request.
2. **A profile name appears in substrate code.** Enforced continuously by `packages/registry/src/substrate-profile-agnostic.test.ts`.
3. **A capability imports another capability or a foreign profile.** Enforced by `packages/registry/src/capability-isolation.test.ts`.
4. **Tier-1 leaks domain fields** to make a tool work — the layered ontology has failed.
5. **AI output becomes authority.** Any path where a model-proposed mapping/action mutates state without deterministic validation, or where admitted external evidence overrides current-state review. `authorityStatus` must remain `evidence_only`.
6. **Hash-chain or replay failure** — an event chain or artifact that cannot replay to the same hashes without a deterministic explanation.
7. **Two-state divergence** — agent memory acted on without rebase against substrate state. The review layer makes this visible (warn-first); once runtime wiring lands, blockable by invariant-class policy.
8. **The second profile stops being free.** If `profile-agency` (or any future profile) requires substrate diffs to coexist with `finance-research`, the universality claim is dead.

---

## Hard checkpoints

Each milestone ends with a written **go / no-go decision**, logged and referenced from this doc's changelog.

If a milestone ends with any falsification mode active, options are:

- **(a) Fix the architecture.** Identify the specific design flaw, update ADR, retry.
- **(b) Descope.** Reduce the validation claim. Document what we're no longer claiming.
- **(c) Kill it.** Document the negative result and stop.

No "we'll address it later." That's how this kind of project rots.

---

## Out of scope (deliberately)

No multi-region; no managed-service abstraction before the migration triggers; no GraphQL; tenant isolation = `tenant_id` partitioning until a real tenant demands more. ArrowHedgeLabs remains historical/research simulation — no real-trading path, no financial advice.

---

## Changelog

- **2026-05-03** — initial framework written (wedding-era P3/P4 plan; superseded).
- **2026-06-10** — re-anchored to the rewrite thesis: ArrowHedge T1–T8 + 12 metrics replace the P3/P4 wedding plan; falsification modes updated to the live enforcement tests; wedding-era packages removed from the workspace (history preserved in git and ADRs).

# Validation Framework

> Read this before the architecture doc. Architecture without falsification criteria is theology.

## The objective

The substrate is validated when **two claims hold simultaneously** on the ArrowHedgeLabs sandbox (a multi-agent research project used strictly for research/education — the *agents and their operational state* are the subject, not finance):

1. **Plug-in claim** — ArrowHedgeLabs onboards through mapping/profile/capability files with **zero substrate-package edits and zero changes to existing providers**.
2. **Agent-state claim** — agents resuming from substrate state outperform chat-history baselines on staleness, authority, evidence, replay, and continuity.

The agent-state work is not a pivot from the PM-layer thesis; it is the harder validation surface for it (see `artifacts/pm_substrate_rewrite.md`).

---

## Axis B - PluggedInSocial marketing-engine validation

PluggedInSocial is the marketing-operations validation lane. Its test is whether
the substrate can observe and govern a complete agency loop without prompt-memory
shortcuts:

`intake/lead signal -> strategy -> content -> approval -> scheduling -> publishing -> metrics -> report -> next action`

The executable integration surface is
`buildPluggedInSocialIntegrationAudit` from `@pm/profile-agency`. It reads the
live PluggedInSocial source tree, derives agents, queues, APIs, data models, and
configuration, runs the Axis B next-action adapter, builds paired "without
substrate" vs "with substrate" marketing scenarios, and emits a proof-packet
summary. A ready audit means the marketing axis is verified; it does not imply
the finance or local-lab axes are verified.

To produce a durable JSON audit artifact from a saved PluggedInSocial
`ClientReport` row snapshot:

```bash
pnpm audit:plugged-in-social \
  --report artifacts/plugged-in-social/client-report.json \
  --out artifacts/plugged-in-social/axis-b-audit.json \
  --tenant tnt_plugged_in_social \
  --observed-at 2026-07-01T19:15:00.000Z \
  --state-review-artifact-hash <64-char-sha256>
```

The command writes the full manifest, next-action adapter result, Axis B eval
events, proof packet, and "without substrate" vs "with substrate" summary. It
exits nonzero when any required source, gate, stage, adapter admission, or
marketing proof coverage is missing.

Focused checks:

```bash
pnpm vitest run \
  packages/profile-agency/src/plugged-in-social-audit-script.test.ts \
  packages/profile-agency/src/plugged-in-social-integration-audit.test.ts \
  packages/profile-agency/src/plugged-in-social-manifest.test.ts \
  packages/profile-agency/src/plugged-in-social-axis-b-proof-packet.test.ts \
  packages/profile-agency/src/plugged-in-social-axis-b-adapter.test.ts \
  packages/profile-agency/src/next-action-proposal.test.ts \
  packages/evals/src/marketing.test.ts
```

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

Market-win claims require a saved paired run with:

- identical tickers, dates, model config, and source data in off and blocking modes;
- false-positive blocks = 0 on fresh in-limit actions;
- false-negative stale actions = 0 on stale or source-conflicted actions;
- replayable event ids for every substrate-blocked decision;
- backtest/PnL deltas reported separately from governance deltas.

Current ArrowHedgeLab status after the 2026-07-01 upstream reset:

- `arrowhedgelab` is now a submodule-style external repo reference to
  `https://github.com/virattt/ai-hedge-fund.git` at commit `65a0349`.
- The previous local Python bridge under `arrowhedgelab/src/substrate/*` and the
  sample request under `arrowhedgelab/examples/substrate/*` are no longer
  present in the fresh upstream tree.
- ArrowHedgeLab now exposes the first neutral external adapter slice:
  `/integration/v1/capabilities`, `/integration/v1/agents`,
  `/integration/v1/graphs/effective`, and
  `/integration/v1/data/cache/summary`.
- The adapter now also exposes saved flow/run state and redacted config through
  `/integration/v1/flows`, `/integration/v1/flows/{id}`,
  `/integration/v1/flows/{id}/runs`, `/integration/v1/runs/{id}`,
  `/integration/v1/config/models`, and `/integration/v1/config/api-keys`.
- The adapter now exposes run-state and backtest evidence through
  `/integration/v1/runs/{id}/events`, `/integration/v1/backtests`,
  `/integration/v1/backtests/{id}`, and `/integration/v1/backtests/{id}/days`.
- The adapter now exposes source-data evidence through
  `/integration/v1/data/source-artifacts` and
  `/integration/v1/runs/{id}/source-artifacts`, including provider, kind,
  ticker, parsed request metadata, observed windows, row counts, and hashes
  without raw rows.
- pm-substrate now has a finance-ingest HTTP client,
  `fetchArrowHedgeIntegrationSnapshot`, that validates those external surfaces,
  optional flow/run details, run events, source artifacts, run-specific source
  artifacts, backtest inventory/details/days, model inventory, redacted API-key
  summaries, emits source-record refs, and builds canonical
  `arrowhedge.run-envelope.v1` payloads without importing ArrowHedgeLab
  internals. Connector-built envelopes attach source-artifact/backtest-day
  evidence IDs to signal, risk, and decision records, and those IDs survive
  expansion into analyst-signal typed events.
- The TypeScript substrate side still supports `arrowhedge.run-envelope.v1`
  through `packages/capability-finance-research-ingest` and
  `packages/substrate-http-demo`, and the connector now builds canonical
  envelopes from external adapter snapshots. ArrowHedgeLab should still add
  deeper per-agent/per-tool provenance at generation time, and paired experiment
  automation is still required before live/backtest experiments can make strong
  market-win claims.

The next valid historical experiment path is:

1. Add deeper per-agent/per-tool provenance in ArrowHedge saved results at
   generation time so the connector does not have to infer source refs from
   ticker/date/source-artifact windows.
2. Reintroduce paired experiment commands only after the adapter can prove that
   baseline and substrate arms share identical request, graph, model, portfolio,
   and source-data hashes.

See `docs/arrowhedgelab-upstream-integration-review-2026-07-01.md` for the
current adapter contract and integration review.

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
- **2026-07-01** — upstream ArrowHedgeLab reset preserved as an external repo and neutral `/integration/v1/*` adapter slices for discovery, cache, source artifacts, saved flows/runs, run events, backtests, backtest days, redacted config, connector-side `arrowhedge.run-envelope.v1` generation, and per-record evidence IDs in expanded connector envelopes plus pm-substrate finance-ingest client landed.

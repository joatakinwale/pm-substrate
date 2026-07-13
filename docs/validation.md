# Validation Framework

> Read this before the architecture doc. Architecture without falsification criteria is theology.

## The objective

The substrate is validated only when **three claims hold together** across the
PluggedInSocial and ArrowHedge testbeds:

1. **Plug-in claim** — each lab onboards through mapping/profile/capability
   files with zero substrate-package edits and no app rewrite.
2. **Agent-state/PM-governance claim** — agents using admitted state and gates
   outperform or protect matched no-substrate workflows on staleness,
   authority, evidence, replay, continuity, and expected allow/block behavior.
3. **Business-operability claim** — those protections survive end-to-end work:
   correct outcomes do not regress, owner effort does not rise, and cash cost
   stays within the declared premium on held-out and production-like runs.

The first two claims can make the technical substrate worth keeping. They do
not, alone, prove that either business is worth operating. The executable
scorecard, non-claims, and verdict ceilings are in
[`objective-falsification.md`](./objective-falsification.md). The agent-state
work remains an extension and proof of the PM-layer thesis, not a pivot from it
(see `artifacts/pm_substrate_rewrite.md`). ArrowHedge is used strictly for
historical research/education; the agents and operating state are the subject,
not financial performance.

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
| T4 Amnesiac resume | Delete chat context; agent resumes open work from tenant/agent/scope, avoids contradicted claims, cites substrate evidence | **Measured (ledger level)** — `pnpm evals:amnesia` records session-1 facts through the continuity ledger, resumes from substrate state only, verifies the hash chain, and reports baseline `0/5` vs substrate `5/5` on the 2026-07-02 core DB baseline. Live model/Ollama delete-context behavior remains a separate claim. |
| T5 Staleness failure | Workflow blocks or requests refresh before producing a stale decision | **Implemented (eval level)** — stale-observation paired evals, ArrowHedge temporal fixtures, `workflow.blocked.stale_state` lifecycle |
| T6 Plug-in file formats | JSON/CSV/SQL-row exports produce equivalent canonical entities/events | **Partial** — corpus-equivalence helpers (fixture vs projected); CSV/SQL lanes not yet exercised |
| T7 Replay audit | Historical run replays from event history; differences explained deterministically | **Implemented (eval level)** — artifact hash replay, JSONL import validity, COP fold determinism |
| T8 Conflict handling | Conflicting claims + stale risk recorded; no silent promotion; routed to rule/human review | **Implemented (eval level)** — state disagreements, authority gates, conflict warnings in review artifacts |

## The 12 behavior metrics

Time-to-plugin · substrate edit count (target: zero) · mapping coverage · validator rejection rate · evidence coverage · state disagreement rate · stale action rate · agent resume success · replay fidelity · unauthorized action block rate · cross-tool outcome success · mean time to reconcile.

Instrumentation today: artifact-derived metrics (`analyzeStateReviewArtifacts`, evidence-admission metrics, run groups) plus write-binding replay metrics cover the staleness/evidence/replay/policy lanes, catalog-verification failures, and selected write-gate outcomes. `pm.objective.lab-measured.v2` now instruments time-to-first-value, substrate edit count, app rewrite, mapping coverage, correct outcomes, write-path coverage, false positives/negatives, cost, owner minutes, holdouts, and acceptance. The v2 measurement binds those claims to a run manifest, boundary-conformance artifact, app revision, and substrate revision; read/action receipts must match all four coordinates. D6 still has to collect and admit those measurements from the two real labs; a schema with no evidence is a gap, not a pass.

## Business-operability gate

Generate a template, replace every placeholder with source-cited observations,
and admit it:

```bash
pnpm pm:objective -- template plugged_in_social --out /tmp/pis-objective.json
pnpm pm:objective -- record /tmp/pis-objective.json
pnpm pm:objective -- list
pnpm pm:memo -- --stdout
```

The evaluator requires both labs to pass six dimensions: technical baseline,
adoption, operational outcomes, governance quality, economic value, and
external validity. A full `keep` requires at least five matched attempts per
arm per lab, at least 80% correct substrate outcomes without regression, a
holdout, full in-scope write governance with zero pilot false positives and
false negatives, no increase in owner minutes per correct outcome, no more than
a 1.25x cash-cost premium, a production-like shadow run, and owner acceptance.
See [`objective-falsification.md`](./objective-falsification.md) for exact
definitions and the research basis.

Market-win claims require a saved paired run with:

- identical tickers, dates, effective graph, model config, starting portfolio, and source data in off and blocking modes;
- false-positive blocks = 0 on fresh in-limit actions;
- false-negative stale actions = 0 on stale or source-conflicted actions;
- replayable event ids for every substrate-blocked decision;
- backtest/PnL deltas reported separately from governance deltas.

Current ArrowHedgeLab status after the 2026-07-01 upstream reset:

> **Revision warning (2026-07-13):** the detailed adapter evidence below was
> produced against the revision rehearsed on 2026-07-07. Current ArrowHedge
> `main@6713139` does not mount an `/integration/v1` router. The admitted
> historical rehearsal remains evidence for that revision, but current D6
> readiness is blocked until the neutral boundary is restored and revalidated.
> Every new objective measurement must bind its app revision and run manifest.

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
  expansion into analyst-signal typed events. The connector also exposes
  `compareArrowHedgeIntegrationRunEnvelopePair`, which rejects paired
  baseline/substrate envelopes when request scope, graph, model config,
  portfolio, or source-data hashes differ.
- ArrowHedgeLab saved results now carry generated
  `arrowhedgelab.runtime-provenance.v1` blocks with source artifacts, tool
  refs, agent-output refs, and decision refs. The connector preserves those
  runtime provenance refs on canonical envelope signal/decision records, and
  line-item searches now enter the shared cache with request-specific keys.
- The TypeScript substrate side still supports `arrowhedge.run-envelope.v1`
  through `packages/capability-finance-research-ingest` and
  `packages/substrate-http-demo`, and the connector now builds canonical
  envelopes from external adapter snapshots. The HTTP demo now exposes
  `/tenants/:tenantId/arrowhedge/experiments/paired-readiness`, which validates
  baseline/substrate run envelopes and returns `409` when request scope, graph,
  model config, portfolio, or source-data hashes differ. It also exposes
  `/tenants/:tenantId/arrowhedge/experiments/paired-bundles`, which returns a
  replayable paired bundle with baseline/substrate envelope hashes, report hash,
  market/PnL deltas, governance/protection deltas, and claim gates that deny
  market-win claims unless readiness plus false-positive and false-negative
  evidence gates pass. The `pnpm arrowhedge:paired-bundle` script now writes
  and verifies replayable local bundle directories either from saved envelope
  and metrics files or directly from ArrowHedgeLab `/integration/v1/*` run IDs.
  It also supports conservative `discover-plan-from-integration` plan discovery
  from saved adapter runs, which only admits explicit baseline/substrate mode
  labels with readiness-equal envelopes and valid pm-substrate offline review,
  and records unlabeled, invalid-review, or non-comparable runs in
  `plan-discovery-report.json`. The same tool now supports
  `run-paired-from-integration`, an external runner that creates labeled saved
  ArrowHedge flow runs, streams `/hedge-fund/backtest`, persists collected
  backtest days/final metrics into those runs, and emits scoped discovery for
  the created run IDs without importing ArrowHedge code. It also writes a
  `governance-evidence-template.json` keyed to the created run IDs. Discovery
  carries review-derived event and block counts into arm metrics, but it does
  not invent false-positive or false-negative counts from substrate labels.
  Those counts are merged only from a `arrowhedge.governance-evidence.v1`
  manifest whose run IDs match the discovery scope and whose cases include at
  least one expected-allow and one expected-block review. `batch-from-integration`
  then writes one verified bundle directory per admitted historical pair plus a
  `batch-report.json` summarizing market aggregates, governance aggregates,
  claim-denial issues, and verification issues. Historical corpus collection
  plus explicit false-positive/false-negative governance evidence is still
  required before live or backtest experiments can make strong market-win
  claims.

The next valid historical experiment path is:

1. Run the external paired runner against ArrowHedgeLab with small historical
   windows and inspect the scoped `paired-run-report.json` plus
   `plan-discovery-report.json`.
2. Collect enough saved historical windows to estimate market/PnL deltas
   separately from governance/protection deltas without claiming improvement
   from governance-only wins.

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
9. **Technical success substitutes for useful outcomes.** If the project claims “worth operating” from event counts, fixture passes, or blocks without matched correct outcomes, cost, owner effort, and acceptance, the objective claim is falsified even when the substrate remains salvageable.
10. **Governance is bypassable or unusably conservative.** Any in-scope direct write path, false-negative allow, or gate that avoids errors by blocking valid pilot actions fails the operational claim.

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

- **2026-07-13** — separated technical substrate viability from business operability; added the admitted `pm.objective.lab-measured.v2` scorecard, matched outcome/cost/owner-effort thresholds, held-out/production-like requirements, exact revision/run-bound integration receipts, and D7 verdict ceilings.

- **2026-05-03** — initial framework written (wedding-era P3/P4 plan; superseded).
- **2026-06-10** — re-anchored to the rewrite thesis: ArrowHedge T1–T8 + 12 metrics replace the P3/P4 wedding plan; falsification modes updated to the live enforcement tests; wedding-era packages removed from the workspace (history preserved in git and ADRs).
- **2026-07-01** — upstream ArrowHedgeLab reset preserved as an external repo and neutral `/integration/v1/*` adapter slices for discovery, cache, source artifacts, saved flows/runs, run events, backtests, backtest days, redacted config, ArrowHedge-generated runtime provenance, connector-side `arrowhedge.run-envelope.v1` generation, per-record evidence IDs/runtime provenance in expanded connector envelopes, paired baseline/substrate envelope readiness gates, paired experiment bundle/report claim gates, local replayable bundle writer/verifier, conservative plan discovery with offline substrate review counts, explicit governance-evidence manifests, external paired-run execution/persistence tooling, batch-from-integration collector reports, and pm-substrate finance-ingest client plus HTTP readiness/bundle endpoints landed.

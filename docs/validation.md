# Validation Framework

> Read this before the architecture doc. Architecture without falsification criteria is theology.

## The objective

Validation now proceeds through three claims in order; evidence cannot skip a
layer:

1. **Mechanism conformance** — deterministic runtime tests show that the PM
   state boundary, recovery, replay, and admission rules behave as specified.
2. **Public causal efficacy** — on pinned independent tasks, the same agent with
   real substrate state beats both native and equal-overhead sham controls on
   the benchmark's unchanged strict outcome while reliability, collateral
   state, false-block, cost, and latency guardrails hold.
3. **Deferred transfer/business operability** — only after public efficacy is
   kept, external apps onboard with zero substrate edits and demonstrate useful
   operating outcomes at acceptable owner effort and cost.

The local suite currently supports claim 1, not claim 2. The existing app and
business scorecard supports a future claim 3 but is frozen during D6/D7. A
passing lower layer never proves the next one. The executable scorecards,
non-claims, and verdict ceilings are in
[`objective-falsification.md`](./objective-falsification.md). Agent state is an
extension and proof of the PM-layer thesis, not a pivot: the hypothesis is that
explicit current state, provenance, decisions, recovery cuts, and admission at
the tool boundary improve project execution.

---

## Axis P — public agent-state validation (active)

### P0: evidence integrity

- Existing local agent-lab and synthetic paired evals are **conformance-only**.
  Their oracles may diagnose whether the intended gate fired, but may not be
  cited as independent outcome evidence.
- Every attempt has a unique identity. Pairing requires exact benchmark,
  revision, task content and eligible-universe membership, split, model,
  prompt/tool/runner configuration, provider sampling seed when supported (or
  an explicit no-seed declaration plus stochastic repeat identity), initial
  environment, typed arm intervention, deterministic randomized order, and
  fault-injection coordinates.
- Benchmark oracles cannot import the substrate's admission predicate. A block
  counts only through the unchanged external task oracle.
- Expected-allow/no-op and expected-block cases are both mandatory. `block-all`
  and `allow-all` mutants must fail qualification.

### P1: ToolSandbox vertical slice

Pin the public multi-turn scenario in which the agent must clarify a message,
look up a contact, encounter disabled cellular service, enable it, and retry.
The original milestone DAG and minefields remain the primary oracle. Compare
native, sham, and substrate arms with identical model and tool affordances. A
separate derivative loses a tool response and restarts the agent process; pass
requires exactly one intended message and no unrelated state mutation. The
adapter may translate public tool calls at the periphery, but the substrate path
must consume the real HTTP/MCP sidecar protocol. The final deterministic
qualification uses an authenticated HTTP sidecar, real process-group kill/reap,
and a fresh provider-process retry while retaining the pinned Apple oracle,
starting context, scripted-provider frames, trajectories, and state effects.
It remains mechanism evidence: the probe is scripted, provider
usage/cost/latency and independently anchored runtime/oracle trust are absent,
and the unchanged headline score did not distinguish duplicate control effects.
Conversion to `PublicEvalAttemptArtifact` therefore remains closed.

### P2: STATE-Bench held-out headline

Use the Agent Learning Track with its official training/held-out separation,
domain tools, simulator, judge, prompt hashes, and score. Substrate learnings are
exposed only through the track's permitted read-only
`retrieve_learnings(query, top_k=3)` seam; test definitions never enter the
learning store. A deterministic 20-task/domain train qualification is disjoint
from the remaining 80-task/domain extraction inventory. The decision bridge
then freezes all 150 test tasks, five stochastic repeat identities, three arms,
a randomized per-cell schedule, and a distinct-model replication. Because
upstream accepts exact `--tasks` selection only with `--split all`, the hashed
command contract treats that value as a parser sentinel while the verified test
inventory remains selection authority. The confirmatory manifest is sealed and
externally preregistered before held-out results are inspected.
Official simulator/judge credentials are an execution prerequisite, not a
reason to substitute a local self-judge or claim success from adapter tests.
Output that merely matches the expected score-file shape is conformance only.
The package emits and verifies an exact command plan and a strict raw schema,
but not the instrumented executor or transport capture. It must refuse D7
conversion without command-bound raw runner, agent-provider, simulator, and
judge bytes; every hidden retry and terminal failure; actual model/request IDs;
usage, cost, and latency; treatment uptake; independently replayed state; an
externally pinned trust policy; and official scores derived from those records.

### P3: independent corner battery

Use separately owned public tasks to cover:

- contradiction and supersession (including value-reversion/ABA);
- restart between dependent writes, lost responses, idempotency, and collateral
  state preservation;
- changing-world state, relative queries, and correct no-op behavior.

Original benchmark results remain separate from derivative fault injection.
Where a benchmark contains UI or perception variance, use its deterministic DB
or task-state oracle for the state claim and report perception failures as a
separate confound.

Behavioral trials use one shared runner, non-treatment configuration, model,
and supporting-file identity; each arm supplies only a registered typed
treatment delta. The oracle executes from a fresh neutral view containing only
the task output and receives no arm/treatment metadata. This reduces accidental
leakage but is not an OS sandbox: independent review and execution receipts must
still rule out host inspection, order inference, covert output channels, and a
runner that did not invoke the pinned oracle.

### P4: analysis and decision

Primary analysis is task-level paired strict completion with simultaneous
inference against the maximum of native and sham inside each bootstrap draw.
Repeats are clustered within task. Reliable lift and economics pass separately
against both controls; missing comparisons fail. Report paired uncertainty,
false blocks, collateral changes, absolute and relative cost per strict
success, and absolute and relative latency per strict success. Preserve every
failure and exclusion. Qualification, confirmatory, and replication artifacts
use different IDs and may not be pooled. The exact manifest is signed before
execution, and one signed receipt binds each attempt's timestamps and raw root.
A clean verifier recomputes every metric from content-resolved raw artifacts.
Its Ed25519 key and source revision must be selected in an out-of-bundle trust
policy, the verifier owner must differ from the experiment producer, and the
owner/CI-pinned policy hash must be supplied outside the result bundle. A
second benchmark or model must preserve the direction. Even then, automation
reports only conditional evidence eligibility; a separately authenticated
owner must sign the exact report hash before D7 can decide or unfreeze apps.
Analysis files, unsigned/hash-only receipts, and caller-selected trust alone are
diagnostic/non-authoritative.

### P5: Arrowsmith repair

Research begins only after a public failure is captured. Map the trace to the
existing state-identity, replay, recovery, evidence, settlement, or procedure
primitive; document the missing behavior and falsifier; implement the smallest
general change with a non-test runtime consumer; ablate it; rerun the exact task
and clean controls. A non-causal or non-improving change is reverted or narrows
the claim.

The first real dogfood failure in this program was a concurrent continuity
append fork. Its preserved trace, cause, advisory-lock repair, append-only merge,
and ablation are documented in
[`state-validation/continuity-concurrency-failure-2026-07-13.md`](./state-validation/continuity-concurrency-failure-2026-07-13.md).
It validates a repair loop, not public task benefit.

Adversarial review then found a false-KEEP authority gap: valid signatures under
a caller-supplied policy could be mistaken for a decision. Arrowsmith
[v231](../research/daily-arrowsmith-agent-state/v231-externally-anchored-evaluation-authority-2026-07-13.md)
separates preregistered evidence eligibility from owner decision authority. It
is evaluation-integrity hardening, not a public behavioral repair or benefit.

---

## Axis B — PluggedInSocial marketing-engine validation (deferred)

This axis is frozen until a D7 public-proof keep decision. Historical evidence
remains revision-bound and auditable but cannot score Axis P. When reopened,
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

These tests remain mechanism-conformance history. “Implemented” or “measured”
in this table does not mean independently validated public efficacy.

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

Instrumentation today: artifact-derived metrics (`analyzeStateReviewArtifacts`, evidence-admission metrics, run groups) plus write-binding replay metrics cover staleness/evidence/replay/policy mechanisms, catalog-verification failures, and selected write-gate outcomes. They are diagnostic drivers, not Axis P endpoints. `pm.objective.lab-measured.v2` instruments the deferred transfer gate and remains revision-bound; a schema or local fixture with no independent outcome evidence is a gap, not a pass.

## Business-operability gate (deferred)

Do not execute new app-bound work under this section until D7 keeps the public
claim. These commands and criteria remain documented for historical
reproducibility and later transfer.

Generate a template, replace every placeholder with source-cited observations,
and admit it:

```bash
pnpm pm:boundary -- --app <lab-id> --app-dir <checkout> \
  --out <boundary-artifact.json> \
  --check 'contract::your-existing-conformance-command'
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

The measurement command opens and recomputes its content-addressed boundary
artifact before admission. A failed/tampered artifact, hash mismatch, different
lab ID, or different app/substrate revision is a hard refusal.

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
11. **The public oracle is not independent.** If gate logic supplies the task verdict, or a block is counted as success without the upstream oracle, the efficacy result is invalid.
12. **Placebo explains the lift.** If the real substrate does not beat an equal-overhead sham, the state-specific causal claim is not supported.
13. **The result depends on tuned or leaked test tasks.** Split leakage, post-result exclusions, reuse of qualification tasks, or silent task mutation invalidates confirmatory evidence.
14. **The result cannot replicate.** If a clean verifier cannot recompute it or the direction disappears on the declared second benchmark/model, D7 cannot keep the general claim.

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

- **2026-07-13** — superseded the app-first execution order with Axis P: independent public oracles, native/sham/substrate controls, ToolSandbox first slice, STATE-Bench held-out headline, public corner battery, failure-driven Arrowsmith repair, and clean replication. Lab apps are frozen until D7.
- **2026-07-13** — separated technical substrate viability from business operability; added the admitted `pm.objective.lab-measured.v2` scorecard, matched outcome/cost/owner-effort thresholds, held-out/production-like requirements, exact revision/run-bound integration receipts, and D7 verdict ceilings.

- **2026-05-03** — initial framework written (wedding-era P3/P4 plan; superseded).
- **2026-06-10** — re-anchored to the rewrite thesis: ArrowHedge T1–T8 + 12 metrics replace the P3/P4 wedding plan; falsification modes updated to the live enforcement tests; wedding-era packages removed from the workspace (history preserved in git and ADRs).
- **2026-07-01** — upstream ArrowHedgeLab reset preserved as an external repo and neutral `/integration/v1/*` adapter slices for discovery, cache, source artifacts, saved flows/runs, run events, backtests, backtest days, redacted config, ArrowHedge-generated runtime provenance, connector-side `arrowhedge.run-envelope.v1` generation, per-record evidence IDs/runtime provenance in expanded connector envelopes, paired baseline/substrate envelope readiness gates, paired experiment bundle/report claim gates, local replayable bundle writer/verifier, conservative plan discovery with offline substrate review counts, explicit governance-evidence manifests, external paired-run execution/persistence tooling, batch-from-integration collector reports, and pm-substrate finance-ingest client plus HTTP readiness/bundle endpoints landed.

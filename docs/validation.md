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

The preferred historical experiment path is a paired backtest run from one
locked `BacktestRequest` JSON. A starter request lives at
`arrowhedgelab/examples/substrate/backtest-request.axis-a.sample.json`; copy or
edit it for the target tickers/window. It intentionally leaves `api_keys` empty
so keys come from environment variables or the app key store rather than from a
checked-in file.

After Postgres and the substrate tables are available, seed the ArrowHedge
tenant/profile from the pm-substrate root:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate \
PM_ARROWHEDGE_TENANT_ID=tnt_arrowhedge \
pnpm arrowhedge:seed
```

Then start the substrate HTTP demo. Use another `PORT` if `4000` is already
serving a different local app:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate \
PORT=4000 \
pnpm --filter @pm/substrate-http-demo dev
```

Start by checking the local environment from `arrowhedgelab/`:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment check-env \
  --request examples/substrate/backtest-request.axis-a.sample.json \
  --substrate-url http://127.0.0.1:4000 \
  --substrate-tenant tnt_arrowhedge \
  --out artifacts/arrowhedge/exp_arrowhedge_axis_a_001/readiness.json
```

`check-env` runs the redacted request preflight and probes all required
substrate readiness gates: `/healthz`, `/tenants/{tenant}`,
`/tenants/{tenant}/profiles/finance-research`, and
`/tenants/{tenant}/arrowhedge/cop`. It returns non-zero if the substrate service
is not reachable, the tenant/profile is not ready, the ArrowHedge route is not
mounted, or required key names are missing.

Then run a dry-run preflight:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment \
  --request examples/substrate/backtest-request.axis-a.sample.json \
  --experiment-id exp_arrowhedge_axis_a_001 \
  --substrate-url http://127.0.0.1:4000 \
  --substrate-tenant tnt_arrowhedge \
  --out-dir artifacts/arrowhedge/exp_arrowhedge_axis_a_001 \
  --dry-run
```

The dry run writes `preflight.json` without executing models or data calls. It
fails the request if required fields are missing: tickers, valid dates, graph
nodes, at least one analyst connected to a portfolio manager, substrate URL and
tenant, and required API key names. API key values are redacted in the artifact.

After preflight passes, run the paired experiment:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment \
  --request examples/substrate/backtest-request.axis-a.sample.json \
  --experiment-id exp_arrowhedge_axis_a_001 \
  --substrate-url http://127.0.0.1:4000 \
  --substrate-tenant tnt_arrowhedge \
  --out-dir artifacts/arrowhedge/exp_arrowhedge_axis_a_001
```

This writes raw off/blocking backtest outputs, normalized off/blocking
artifacts, `paired-report.json`, and `manifest.json`. Each backtest day now
stores the canonical `substrate_envelope` even when `substrate_mode=off`, so
staleness, source data, graph/config, and raw-decision hashes can be checked
independently of the blocking COP.

Verify the completed bundle before reading the claim status:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment verify-bundle \
  --bundle-dir artifacts/arrowhedge/exp_arrowhedge_axis_a_001 \
  --out artifacts/arrowhedge/exp_arrowhedge_axis_a_001/verification.json
```

`verify-bundle` recomputes artifact hashes and the paired report, checks raw
off/blocking runs for day-level `substrate_envelope` records, checks manifest
claim status against `paired-report.json`, and returns non-zero unless the
bundle is both untampered and claim-ready.

When starting from a single saved ArrowHedge run envelope, first produce normalized
off/blocking artifacts. A substrate response can be generated by a live
`/arrowhedge/run-envelopes` call or by the deterministic offline reviewer:

```bash
pnpm tsx scripts/review-arrowhedge-envelope-offline.ts \
  --envelope artifacts/arrowhedge/run-envelope.json \
  --tenant tnt_arrowhedge \
  --adapter-started-at 2026-06-03T13:59:58.500Z \
  --out artifacts/arrowhedge/substrate-response.json
```

Then build a locked paired-run bundle from the same envelope and response:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.compare_modes bundle-from-envelope \
  --experiment-id exp_arrowhedge_axis_a_001 \
  --envelope artifacts/arrowhedge/run-envelope.json \
  --substrate-result artifacts/arrowhedge/substrate-response.json \
  --out-dir artifacts/arrowhedge/exp_arrowhedge_axis_a_001
```

The single-envelope bundle writes `off-run.json`, `blocking-run.json`, `paired-report.json`,
and `manifest.json`. The manifest hashes the source envelope, substrate
response, and generated artifacts so mismatched manual comparisons cannot
quietly pass.

Staleness is derived from the envelope risk freshness window, while blocking
and replay ids come from the substrate response. Market-win claims are
deliberately denied unless the paired artifacts have historical run provenance,
matching raw-decision hashes, replayable blocked event ids, zero false
positives, zero false negatives, and positive market/PnL delta:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.compare_modes artifact-from-envelope \
  --envelope artifacts/arrowhedge/run-envelope.json \
  --mode off \
  --out artifacts/arrowhedge/off-run.json

PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.compare_modes artifact-from-envelope \
  --envelope artifacts/arrowhedge/run-envelope.json \
  --mode blocking \
  --substrate-result artifacts/arrowhedge/substrate-response.json \
  --out artifacts/arrowhedge/blocking-run.json
```

Then build the saved paired-run report from archived JSON outputs with:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.compare_modes \
  --experiment-id exp_arrowhedge_axis_a_001 \
  --off artifacts/arrowhedge/off-run.json \
  --blocking artifacts/arrowhedge/blocking-run.json \
  --out artifacts/arrowhedge/paired-report.json
```

The report builder accepts envelope-derived artifacts, already-normalized
comparison rows, or raw ArrowHedge web/backtest result JSON containing
`results`, `raw_decisions`, `decisions`, `substrate`, and `executed_trades`.

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

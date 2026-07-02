# ArrowHedgeLab pm-substrate Integration Audit

Date: 2026-07-01

Scope: `arrowhedgelab` after cleanup. The active tree now contains the upstream-style ArrowHedgeLab app, CLI, tests, v2 research modules, and the local `src/substrate` bridge. The separate `ArrowDexter-main` repo was moved to `trash/arrowhedgelab-cleanup-20260701-092540` because it is not part of the latest upstream `virattt/ai-hedge-fund` tree and ArrowHedgeLab source/app/tests/v2 do not reference it.

## Executive Evaluation

pm-substrate is credible as the governance layer for ArrowHedgeLab. The current integration is now broad enough for a controlled off/shadow/blocking pilot across run envelopes, web final output, backtest execution, and the HTTP ingress path, but it is still not enough to claim market-win improvement.

The current code proves a narrower claim:

> Given an ArrowHedge run envelope or a legacy single-ticker ArrowHedge snapshot with explicit freshness and source ids, pm-substrate can expand ticker snapshots, preserve graph/model evidence, validate mapping, publish typed events, fold a common operating picture, and block stale/source-conflicted or over-limit decisions.

It does not yet prove the stronger hypothesis:

> pm-substrate governs the full ArrowHedgeLab multi-agent project state and improves market outcomes without false positives.

That stronger claim still requires saved paired off vs blocking runs over the same real historical windows, with replayable blocked event ids and source-data evidence strong enough to audit false positives.

## Current Multi-Agent Orchestration

ArrowHedgeLab has a real multi-agent graph. The agent graph is still executed by LangGraph and app state, while pm-substrate now wraps the pilot governance boundary for run evidence, final web decisions, and backtest paper-trade execution when substrate mode is enabled.

- CLI orchestration builds a workflow from selected analysts, then routes all selected analysts into risk management and portfolio management. Evidence: `arrowhedgelab/src/main.py:60-89`, `arrowhedgelab/src/main.py:100-130`.
- The analyst inventory is centralized in `ANALYST_CONFIG` and exposes 19 analyst/persona/signal agents. Evidence: `arrowhedgelab/src/utils/analysts.py:24-200`.
- The portfolio manager computes deterministic allowed actions, and the substrate adapter now enforces those limits when `decision.allowedActions` is present. The base LLM output is still produced by the ArrowHedge prompt path before substrate review. Evidence: `arrowhedgelab/src/agents/portfolio_manager.py:96-157`, `arrowhedgelab/src/agents/portfolio_manager.py:177-262`, `packages/capability-finance-research-ingest/src/arrowhedge.ts`.
- The web app has its own graph, request, flow, and run state surfaces. Evidence: `arrowhedgelab/app/backend/models/schemas.py:60-140`, `arrowhedgelab/app/backend/database/models.py:6-95`.
- The backtester executes graph decisions and paper trades inside its own service, and now applies the substrate gate before `execute_trade` when shadow/blocking mode is configured. Evidence: `arrowhedgelab/app/backend/services/backtest_service.py`, `arrowhedgelab/tests/test_substrate_backtest_gate.py`.

## Current pm-substrate Integration

The substrate bridge is real and now covers the main pilot surfaces, but the market hypothesis is still unproven.

- Python bridge: `arrowhedgelab/src/substrate/run_with_substrate.py` calls `run_hedge_fund`, builds one full `arrowhedge.run-envelope.v1`, posts it to `/arrowhedge/run-envelopes`, and uses the returned COP/ingest response. Evidence: `arrowhedgelab/src/substrate/run_with_substrate.py`, `arrowhedgelab/tests/test_substrate_live_runner_signals.py`.
- Python emitter: `arrowhedgelab/src/substrate/emitter.py` can post full run envelopes to `/run-envelopes` and still preserves the legacy single-ticker snapshot route for compatibility. The snapshot mapper keeps plural `signals` while retaining legacy `signal`. Evidence: `arrowhedgelab/src/substrate/emitter.py`, `arrowhedgelab/tests/test_substrate_emitter.py`.
- Runtime mode config: API request schemas and CLI parsing now accept shared `off`, `shadow`, and `blocking` substrate modes plus substrate URL/tenant fields. The dedicated substrate runner defaults to `shadow` and can run `off` without requiring a tenant. Evidence: `arrowhedgelab/app/backend/models/schemas.py`, `arrowhedgelab/src/cli/input.py`, `arrowhedgelab/src/substrate/modes.py`, `arrowhedgelab/src/substrate/run_with_substrate.py`.
- Web run gating: `/hedge-fund/run` now posts a full run envelope in `shadow`/`blocking`, attaches substrate COP/ingest metadata to the final SSE completion payload, and rewrites blocked blocking-mode decisions to `hold` before final output. Blocking mode fails closed when substrate config or emission is unavailable. Evidence: `arrowhedgelab/app/backend/routes/hedge_fund.py`, `arrowhedgelab/src/substrate/envelope.py`, `arrowhedgelab/tests/test_substrate_web_run_contract.py`.
- Backtest gating: `BacktestService.run_backtest_async` now builds and stores a canonical `substrate_envelope` for every backtest day, including `off` mode, posts the same full daily envelope before `execute_trade` when substrate is enabled, stores `raw_decisions`, `decisions`, `substrate`, graph/config provenance, and uses gated decisions for paper-trade execution. Evidence: `arrowhedgelab/app/backend/services/backtest_service.py`, `arrowhedgelab/app/backend/models/schemas.py`, `arrowhedgelab/tests/test_substrate_backtest_gate.py`.
- Hypothesis controls: `check_paired_backtest_environment`, `validate_paired_backtest_request`, `run_paired_backtest_experiment`, `verify_paired_backtest_bundle`, `reviewArrowHedgeRunEnvelopeOffline`, `build_run_artifact_from_backtest_output`, `build_run_artifact_from_envelope`, `write_paired_run_bundle_from_envelope_file`, `normalize_run_artifact`, `summarize_mode_comparison`, `build_paired_run_report`, and their JSON writers convert saved envelopes, substrate responses, and raw web/backtest outputs into comparable rows. They check substrate reachability and tenant readiness, preflight the request before model/data calls, derive staleness from envelope freshness windows, generate deterministic offline substrate responses when live HTTP/Postgres is unnecessary, lock raw backtest/envelope/response/report hashes into a manifest, verify completed bundles against manifest hashes and recomputed reports, then separate false-positive blocks, false-negative stale actions, protection delta, replayable blocked event IDs, raw-decision equality, and market/PnL delta for paired off vs blocking runs. The report and verifier now deny market-win claims unless historical provenance, matching raw decisions, replayable blocked decisions, clean governance controls, untampered artifacts, and positive market delta all hold. Evidence: `arrowhedgelab/src/substrate/backtest_experiment.py`, `packages/capability-finance-research-ingest/src/arrowhedge.ts`, `scripts/review-arrowhedge-envelope-offline.ts`, `arrowhedgelab/src/substrate/compare_modes.py`, `docs/validation.md`.
- Evidence hashing: run envelopes now create evidence documents from raw analyst, risk, and decision payloads with deterministic SHA-256 hashes, and web/backtest/live runtime paths post those evidence-bearing envelopes to pm-substrate. Evidence: `arrowhedgelab/src/substrate/envelope.py`, `arrowhedgelab/app/backend/routes/hedge_fund.py`, `arrowhedgelab/app/backend/services/backtest_service.py`, `arrowhedgelab/src/substrate/run_with_substrate.py`.
- Live A/B: `arrowhedgelab/src/substrate/live_ab.py` runs real agents, but staleness is injected by sorted ticker position and negative freshness horizon. Evidence: `arrowhedgelab/src/substrate/live_ab.py:97-100`, `arrowhedgelab/src/substrate/live_ab.py:123-151`.
- HTTP route: `packages/substrate-http-demo/src/arrowhedge-route.ts` ingests legacy `/snapshots` and full `/run-envelopes`. The run-envelope route expands graph/config/model/evidence into validated per-ticker snapshots, executes graph/event writes in transactions, aggregates ingest results, and catches up the COP once for the run. Evidence: `packages/substrate-http-demo/src/arrowhedge-route.ts`, `packages/substrate-http-demo/src/arrowhedge-route.test.ts`.
- TypeScript capability: `packages/capability-finance-research-ingest/src/arrowhedge.ts` parses legacy `signal` or plural `signals`, one `risk`, one `portfolio`, one `decision`, and deterministic `decision.allowedActions`, then builds records, edges, typed events, and the COP. Fresh over-limit decisions now emit `workflow.blocked.invalid_action` instead of `portfolio.decision.accepted`. Evidence: `packages/capability-finance-research-ingest/src/arrowhedge.ts`.

## Requirement Matrix

| Requirement | Current state | Evidence | Gap |
|---|---|---|---|
| pm-substrate can see all active agents | Mostly implemented | Run envelopes preserve plural analyst signals and HTTP `/run-envelopes` expands them into per-agent signal records | Prompt/tool cache refs are not yet independently attached as first-class evidence |
| pm-substrate can see graph/config | Implemented at ingress boundary | Python run envelopes include graph nodes/edges/model config; TypeScript expansion hashes graph/model config into run-level evidence docs | Flow-id semantics could be hardened once saved real web-flow runs are collected |
| pm-substrate can see data/evidence | Mostly implemented | Run envelopes hash raw analyst/risk/decision payloads; HTTP expansion preserves ticker and run-level evidence plus graph/model hashes | Direct raw market/news/tool cache artifact hashing is still future hardening |
| pm-substrate can govern all analyst signals | Implemented at bridge/runtime surfaces | Python emitter, live substrate runner, web/backtest envelope path, and TypeScript ingest preserve plural `signals` | Still need real evidence hashes for each contributing signal |
| pm-substrate can govern risk state | Mostly implemented | RiskState captures `currentPrice`, `maxShares`, freshness, nested volatility, and raw risk evidence hashes | Needs real-market source cache evidence for replay-grade provenance |
| pm-substrate can govern final decisions | Implemented for pilot | Decisions emit proposed/accepted/blocked typed events; stale/source-conflicted and over-limit fresh quantities are blocked at ingest/COP and web/backtest blocking gates | Needs saved real paired runs to quantify false-positive rate |
| pm-substrate gates web runs | Implemented for final output | `/hedge-fund/run` posts full run envelopes in shadow/blocking and gates final completion decisions in blocking mode | Progress events are not substrate-reviewed; live route still depends on configured substrate availability |
| pm-substrate gates backtests | Implemented for paper-trade execution | Backtester stores off-mode envelopes, reviews blocking-mode envelopes before `execute_trade`, and uses gated decisions for paper trades | Needs repeated substrate-backed historical experiment fixtures |
| User can run with and without substrate | Implemented for pilot | API request schemas, shared CLI parser, substrate runner, web final output, and backtests expose/honor `off/shadow/blocking` behavior | Needs operator-facing docs/examples for routine use |
| Hypothesis can be tested without false positives | Tooling implemented, evidence pending | Environment readiness checks `/healthz`, tenant existence, `finance-research` profile installation, and ArrowHedge COP before model/data calls; preflight rejects malformed experiment requests; paired backtest runner executes off/blocking from one request; off-mode day envelopes preserve independent staleness; verifier rejects tampered bundles and recomputes paired reports; paired-run report separates false positives, false negatives, replayability, raw-decision equality, protection delta, PnL delta, and historical provenance | Need saved paired runs over real historical windows |

## False-Positive Risks

1. Staleness is currently injected, not independently discovered.
   - `live_ab.py` marks every other sorted ticker stale and emits negative freshness. This can prove the gate responds to a label, but not that the system detects real stale operational state.

2. Multi-agent signal state is preserved, but direct source-data cache hashing still needs hardening.
   - The bridge/runtime surfaces now preserve plural non-risk analyst signals and hash raw analyst/risk/decision payloads. The remaining risk is that underlying market/news/tool cache artifacts are not yet independently attached as first-class evidence documents.

3. Evidence hashes can be synthetic.
   - The default emitter hashes strings like `price:{tag}` and `news:{tag}`. That is useful for shape tests, but insufficient for replaying actual market/news/tool context.

4. Deterministic risk limits are now a hard adapter and runtime pilot gate.
   - pm-substrate blocks stale/source-disagreement paths and fresh over-limit quantities at the TypeScript ingest/COP boundary. Web final output and backtest paper-trade execution now honor blocking-mode gates, but repeated real runs are still needed to estimate false positives.

5. Backtest paths are gated but not yet packaged as a hypothesis experiment.
   - Market-win claims need repeated backtests or paper-trade simulations where the only changed variable is substrate governance. Web and backtest execution now have substrate gates and saved-envelope artifact tooling, but actual historical paired runs are still required.

## What Is Already Strong

- The substrate core stays profile-agnostic, and ArrowHedge-specific routing lives in `substrate-http-demo` via `extraRoutes`.
- The graph layer now separates profile schema version from optimistic row revision. `graph.nodes.schema_version` remains the profile entity schema version, while `graph.nodes.revision` advances on identity updates; this removes a substrate-level schema-version false-positive path for legitimate repeated profile-bound node updates.
- The TypeScript mapper validates structure and typed event payloads, emits provenance-rich events, and folds a deterministic COP.
- Stale/source-conflicted decisions no longer emit both accepted and blocked events. The acceptance branch requires no disagreement and non-stale state.
- Fresh over-limit decisions no longer emit accepted events when `decision.allowedActions` is present. They emit `workflow.blocked.invalid_action`, count as authority-gate failures, and project to `blocked_invalid_action`.
- Proposal review supports blocking-by-default with advisory opt-out, which is the right shape for off/shadow/blocking modes.
- Shared `off`/`shadow`/`blocking` request fields now exist for ArrowHedge API and CLI surfaces, with default `off` for normal requests.
- Full run envelopes now have an end-to-end ingress path: Python web, backtest, and live-runner paths post `/run-envelopes`; TypeScript expands the envelope, preserves run-level graph/model evidence, and feeds the same typed-event/COP path as legacy snapshots.
- Saved run envelopes now have an offline deterministic review path that expands the envelope, validates ingestion plans, folds typed events into COP, and writes replayable blocked event ids without requiring a live substrate HTTP/Postgres stack.
- Saved run envelopes now have a locked paired-bundle writer so off artifacts, blocking artifacts, report output, and manifest hashes are generated from the same source envelope and substrate response.
- Market-win claims are now blocked at report level when the evidence is fixture/unknown provenance or when market/PnL delta is not positive, even if governance controls pass.
- FastAPI web runs now have a final-output gate: shadow mode preserves decisions and records substrate metadata; blocking mode rewrites substrate-blocked decisions to `hold`.
- Backtests now use substrate-gated decisions for paper-trade execution and retain raw decisions for audit comparison.
- Backtest day results now retain canonical run envelopes even when substrate is off, giving paired experiments independent staleness, graph/config, source-data, and raw-decision locks.
- Paired historical experiments now have a redacted dry-run preflight that refuses missing tickers, invalid dates, missing graph/portfolio-manager structure, missing substrate config, or missing required API-key names before any model or market-data call is made.
- A checked-in Axis A starter request exists at `arrowhedgelab/examples/substrate/backtest-request.axis-a.sample.json`; it includes analyst, portfolio-manager, graph-edge, ticker, date, substrate-mode, and tenant/url fields while keeping API key values out of source control.
- Completed paired backtest bundles can now be verified independently with `python3 -m src.substrate.backtest_experiment verify-bundle`, which checks manifest hashes, recomputes the paired report, checks day-level envelopes, and refuses claim readiness on tampering.
- Local setup now has `pnpm arrowhedge:seed`, which idempotently creates the ArrowHedge validation tenant and installs `finance-research` for that tenant once substrate tables are available.
- Local readiness can now be checked with `python3 -m src.substrate.backtest_experiment check-env`; it verifies `/healthz`, the configured tenant, the tenant's `finance-research` profile installation, and the ArrowHedge COP route before allowing a paired run. In the current workspace run, port `4000` was occupied by a non-substrate Werkzeug service, so the demo was started on `4011`; after seeding tenant `tnt_arrowhedge` and installing `finance-research`, `check-env` returned `{"issues": 0, "ready": true, "substrate": true}` against `http://127.0.0.1:4011`.
- Fresh migration reliability is repaired. A clean temporary database reached all `147` migrations, the current dev database is also at `147`, `pnpm db:migrate` now reports `no migrations to apply`, and a table-identifier truncation scan reports `tableIdentifierCollisions: 0`.
- Repeat-run envelope identity is repaired. Signal ids and run-specific signal/risk evidence ids now include `runId`, so repeated ArrowHedge runs create immutable evidence/source records instead of mutating prior evidence and producing schema-version false positives.
- A synthetic local envelope POST to `http://127.0.0.1:4011/tenants/tnt_arrowhedge/arrowhedge/run-envelopes` after the migration, graph-revision, and identity fixes returned HTTP 200, expanded 1 AAPL snapshot, created 11 nodes, updated 0 nodes, created 21 edges, published 16 events, and projected AAPL into the COP. This verifies the live Python envelope to TypeScript/Postgres path without making market-data or model calls.
- Tests already cover snapshot mapping shape, Python envelope posting, web/backtest/live-runner envelope use, saved-envelope artifact normalization, TypeScript run-envelope expansion, HTTP envelope ingestion, event payload validation, COP projection, stale proposal review, and Python emitter basics.

## Local Infrastructure Verification

The prior fresh-database blocker was PostgreSQL's 63-byte identifier truncation across long `agent_state` migration relation names. It is now fixed by shortening the physical table/index names in unapplied migrations, adding repair indexes for already-applied legacy names, and quoting the `authorization` column in migration `0069`.

Current evidence:

- Fresh temp DB migration completed through `147`.
- Current dev DB migration completed through `147`.
- `graph.nodes.revision` exists as a non-null integer column with default `1`, and `schema_version` remains a non-null integer column with default `1`.
- `pnpm db:migrate` now reports `no migrations to apply`.
- Table-only identifier truncation scan reports no table collisions.
- `pnpm arrowhedge:seed` succeeds for `tnt_arrowhedge`.
- `check-env` succeeds against the seeded tenant/profile/COP.

## Required Acceptance Gates For Full Integration

These are the gates that must pass before claiming the original hypothesis is fairly tested:

1. One canonical ArrowHedge run envelope exists and is built by the dedicated substrate runner, FastAPI runs, and backtests.
2. The envelope includes graph nodes/edges, selected agents via signal provenance, model config, portfolio state, all analyst signals, risk state, final decisions, evidence refs, and action boundary results.
3. pm-substrate ingestion accepts full run envelopes and plural analyst signals while preserving per-agent provenance.
4. Runtime mode fields exist everywhere needed for the pilot: `off`, `shadow`, and `blocking`.
5. Blocking mode prevents stale, source-conflicted, and over-limit decisions before web output or backtest paper-trade execution.
6. Shadow mode emits the same artifacts and metrics while preserving current ArrowHedgeLab behavior.
7. Evidence documents hash real source payloads or cache artifacts, not only synthetic placeholders.
8. A replay test can reconstruct a run from live or offline substrate events and explain differences.
9. A false-positive control run proves fresh, in-limit decisions are not blocked.
10. A false-negative control run proves stale and over-limit decisions are blocked.
11. A market-outcome experiment compares off vs shadow/blocking over the same historical window and records deltas in stale actions, unauthorized action blocks, replay fidelity, and backtest performance.
12. The paired backtest report proves off and blocking raw-decision hashes match, so observed market deltas are attributable to substrate governance rather than different agent proposals.

## Go / No-Go

Current state: **Go for controlled off/shadow/blocking integration pilot. No-go for market-win claim.**

The pm-substrate pieces are now broad enough to run controlled integration pilots across adapter, web final output, and backtest paper-trade execution. The metric/report layer can detect false positives/false negatives and prevent market-win claims without replayable blocked event ids, but the current proof still needs saved paired runs over real historical windows before claiming market-win improvement.

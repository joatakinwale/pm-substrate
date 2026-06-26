# ArrowHedgeLab ↔ pm-substrate Live Bridge & Experiment Design

Date: 2026-06-18
Author: Joat
Status: design + first implementation

## Problem this closes

The 2026-06-18 morning harness proved the substrate *plumbing* in isolation:
a **static AAPL snapshot fixture** → finance adapter → 13 typed events
(hash-chain verified) → graph nodes → ArrowHedge COP projection → eval metrics.
All 20 tests pass.

What it did **not** prove: the ArrowHedgeLab **agents running live** emit their
real state into the substrate, and the substrate catches stale/unauthoritative
actions the raw agents would otherwise take. The grep for any link between
`arrowhedgelab/src` (19 Python agents) and the substrate adapter returned
**zero references**. There was no bridge. This document designs and builds it.

## The two systems

- **ArrowHedgeLab** (`arrowhedgelab/`): AI Hedge Fund. `run_hedge_fund()` in
  `src/main.py` runs a LangGraph of analyst agents → `risk_management_agent` →
  `portfolio_management_agent` → END. Returns
  `{ "decisions": {ticker: {action, quantity, confidence, reasoning}},
     "analyst_signals": {agent_id: {ticker: {signal, confidence, ...}}} }`.
  The risk manager populates `current_price`, `remaining_position_limit`,
  `max_shares`, `volatility` per ticker.

- **pm-substrate**: `@pm/capability-finance-research-ingest` exposes
  `parseArrowHedgeSnapshot` → `buildArrowHedgeIngestionPlan` →
  `executeArrowHedgeIngestionPlan` → COP projection
  (`createArrowHedgeCommonOperatingPictureProjection`). The COP measures
  `authorityGate {passes, failures}`, `authorityGatePassRate`, `staleBlocks`.

## The snapshot contract (the seam)

The adapter consumes one **ArrowHedge snapshot** per `(ticker, decision-tick)`:

```
snapshotId, observedAt, authority,
backtestRun{id,title,scopeStart,scopeEnd,state,datasetRef,seed},
researchRun{id,title,scopeStart,scopeEnd,state,strategy,modelLock,seed},
ticker{symbol,assetClass,exchange,currency},
evidence[{id,sha256,mimeType,filename,sourceUri,retrievedAt,freshnessExpiresAt}],
signal{id,agentId,signal,confidence,evidenceWindowStart,evidenceWindowEnd},
risk{id,currentPrice,remainingPositionLimit,maxShares,volatility,bindingConstraint,freshnessExpiresAt},
portfolio{id,cash,equity,marginRequirement,marginUsed},
decision{id,action,quantity,confidence,reasoning,accepted,riskSourceSnapshotId,signalSourceSnapshotId}
```

The emitter's job is to map one live hedge-fund tick into this shape and POST it.

## Architecture

```
ArrowHedgeLab (Python)                 pm-substrate (TS/HTTP)
┌──────────────────────┐               ┌─────────────────────────────┐
│ run_hedge_fund()      │  snapshot     │ POST /tenants/:id/arrowhedge │
│   → decisions          │  (JSON)       │      /snapshots               │
│   → analyst_signals    │ ───────────▶ │  parse → buildPlan → execute │
│ substrate_emitter.py   │               │  → publish events → catchUp  │
│   maps tick→snapshot   │ ◀─────────── │  → COP state (response)      │
│   POSTs, reads COP back│   cop json    └─────────────────────────────┘
└──────────────────────┘
```

Two new artifacts:

1. **TS ingest route** `packages/substrate-http/src/routes/arrowhedge.ts`
   mounted at `/tenants/:tenantId/arrowhedge`. `POST /snapshots` runs the
   in-process pipeline and returns `{ result, copState, chain }`. This is the
   single tool-onboarding surface ArrowHedgeLab calls — no bespoke per-agent
   integration.

2. **Python emitter** `arrowhedgelab/src/substrate/emitter.py` with
   `tick_to_snapshot(...)` (pure mapping, unit-testable) and
   `SubstrateEmitter.emit(snapshot)` (HTTP POST). A thin
   `run_with_substrate.py` runs the hedge fund and emits each tick.

## The experiment (what produces data)

The measurable claim from the research: **substrate catches stale-state actions
that raw agents miss.** Protocol:

- **Arm A (agents alone):** run `run_hedge_fund()`, record decisions. Inject a
  stale-state scenario: risk manager's `currentPrice` / `freshnessExpiresAt`
  is older than the decision tick (price moved after the risk read). Raw agents
  have no freshness gate → they act on the stale read.
- **Arm B (agents + substrate):** same run, but every tick is emitted as a
  snapshot. The COP `authorityGate` / `staleBlocks` flags the stale read; the
  decision is gated as `workflow-blocked-stale-state`.
- **Metric:** `stale_action_rate` (Arm A) vs `stale_action_blocked_rate`
  (Arm B), plus `authorityGatePassRate` and COP `staleBlocks` count.
- **Falsifier:** if the substrate blocks no additional stale actions vs the raw
  agents, the bridge adds nothing and the thesis fails on this axis.

Fixed seeds + frozen model lock + frozen evidence windows so the run is
replayable (per the Axis A sprint pre-registration discipline).

## Status / next

- [x] Design (this doc)
- [x] TS ingest route + route test (`@pm/substrate-http-demo/src/arrowhedge-route.ts`,
      `arrowhedge-route.test.ts`). Mounted via generic `extraRoutes` injection so
      the substrate library stays profile-agnostic (G5.4 guard passes).
- [x] Cross-tenant node-id collision fixed: `parseArrowHedgeSnapshot` accepts an
      optional id scope; `buildArrowHedgeIngestionPlan` opt-in
      `scopeNodeIdsByTenant`. Content-addressed ids like `ticker:AAPL` collided
      across tenants on the globally-unique graph node id space. Default stays
      legacy (preserves the committed corpus fixture).
- [x] Python emitter + mapping unit test
      (`arrowhedgelab/src/substrate/emitter.py`, `tests/test_substrate_emitter.py`,
      7/7 pass).
- [x] Experiment runner (`arrowhedgelab/src/substrate/experiment.py`) producing
      the A-vs-B metric.
- [x] Real seeded end-to-end run with measured numbers (server-hosted, live
      HTTP). Result in `arrowhedge-experiment-result_2026-06-18.json`.

## Measured result (2026-06-18)

Seeded 6 ticks (5 actionable, 3 stale), run live against a server-hosted
substrate (`@pm/substrate-http-demo`) with the finance-research profile:

- **Arm A (agents alone): stale_action_rate = 0.60.** 3 of 5 actionable ticks
  acted on a risk read whose freshness window had already closed. Raw agents
  have no gate, so all 3 go through.
- **Arm B (agents + substrate): stale_blocked_rate = 1.00.** All 3 stale ticks
  emit a 14th `workflow.blocked.stale_state` event (clean ticks emit 13); the
  COP reports `staleBlocks: 1` and `authorityGate.failures: 1` per stale ticker.
- **authorityGatePassRate = 0.625** across the run (5 passes / 8 gate evals).
- **delta_protection = 3**: the substrate blocked 3 stale actions the raw agents
  took. **Not falsified.**

The substrate-side stale trigger is `isStale(snapshot)` =
`riskFreshnessExpiresAt < observedAt`. A genuine stale tick is one where the
risk read's freshness window closed before the decision's observed time; the
emitter models this with a negative freshness horizon.

### Known limitation

This run uses *seeded* ticks, not a live `run_hedge_fund()` invocation (that
needs API keys for the LLM agents + market data). The emitter maps the real
`run_hedge_fund()` output shape, so wiring `run_with_substrate.py` to call the
actual agents is the remaining step to go from seeded-proof to live-proof.

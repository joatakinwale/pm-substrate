# ArrowHedgeLab Upstream Integration Review

Date: 2026-07-01

Scope: fresh upstream clone at `arrowhedgelab`, remote `https://github.com/virattt/ai-hedge-fund.git`, commit `65a0349`.

This review reflects the current tree after the old local `arrowhedgelab` copy was archived to `trash/arrowhedgelab-archive-20260701-133154` and replaced with a fresh upstream clone. The previous local `src/substrate` bridge is not present in this upstream tree.

## Evaluation

ArrowHedgeLab is a good substrate validation target, but it is not currently integrated as an external, portable pm-substrate target. The project has real multi-agent orchestration, persisted flow/run state, model/API-key configuration, market data tools, in-memory cache state, web and CLI execution paths, and backtest loops. Those are exactly the surfaces pm-substrate needs to govern.

The missing piece is a stable adapter boundary. Today, pm-substrate can ingest ArrowHedge-shaped envelopes on the TypeScript side, but the fresh ArrowHedgeLab clone does not expose a neutral integration API or generate those envelopes. Rebuilding the bridge inside `src/substrate` as a hard pm-substrate patch would repeat the coupling problem. The better next state is a small ArrowHedgeLab-side `/integration/v1/*` adapter plus a pm-substrate-side connector that treats ArrowHedgeLab like any external project.

## Current ArrowHedgeLab State

Multi-agent orchestration:

- CLI path `src/main.py` creates a static LangGraph: selected analysts -> risk manager -> portfolio manager -> END.
- Web/backend path `app/backend/services/graph.py` builds a graph from React Flow nodes and edges, injects a synthetic risk manager for each portfolio manager, and rewires direct analyst -> portfolio-manager edges through that risk manager.
- The effective runtime graph is not exposed externally. Only the submitted React Flow graph is available through request payloads or saved flow records.
- Analyst inventory is centralized in `src/utils/analysts.py` with 19 analyst/persona/signal agents. Risk and portfolio manager agents are operationally required but are not listed by `/hedge-fund/agents`.

Runtime/API surface:

- `/hedge-fund/run` streams progress and final decisions, analyst signals, and current prices.
- `/hedge-fund/backtest` streams progress and day results inside progress-event `analysis`, then final metrics/final portfolio/total days.
- `/hedge-fund/agents` returns analyst metadata only.
- `/flows` and `/flows/{flow_id}/runs` persist React Flow graphs, run request data, results, status, timestamps, and errors.
- `/language-models` and `/ollama` expose model/provider availability.
- `/api-keys` includes summary routes, but `GET /api-keys/{provider}`, create, update, and bulk routes return `key_value`; substrate must never use those raw secret routes.

Data/provenance:

- Data tools in `src/tools/api.py` fetch prices, financial metrics, line items, insider trades, company news, market cap, and price DataFrames from Financial Datasets.
- `src/data/cache.py` stores prices, metrics, line items, insider trades, and company news in process memory.
- There is no external snapshot/hash/freshness/provenance API for the tool cache.
- `search_line_items()` says "Cache the results" but does not call `set_line_items`; this weakens reproducibility for agents using line-item data.

Backtesting:

- Backend `BacktestService` returns day-level `BacktestDayResult` with decisions, executed trades, analyst signals, current prices, exposures, and metrics, but no raw decisions, substrate envelope, source hashes, or independent data freshness metadata.
- Newer `src/backtesting/*` components are cleaner and more testable, but are not exposed as an integration service.
- `v2/*` provides an emerging protocol/data/backtesting research direction, but it is not wired into the app adapter surface.

## Current pm-substrate State

- `packages/capability-finance-research-ingest` already understands `arrowhedge.run-envelope.v1`, expands full run envelopes into per-ticker snapshots, emits typed finance-research events, builds COP state, and blocks stale or invalid actions.
- `packages/substrate-http-demo` mounts ArrowHedge routes at `/tenants/:tenantId/arrowhedge` with `/snapshots` and `/run-envelopes`.
- `docs/validation.md` and `docs/arrowhedgelab-pm-substrate-integration-audit-2026-07-01.md` previously referenced the old local Python bridge (`arrowhedgelab/src/substrate/*` and `arrowhedgelab/examples/substrate/*`). Those paths no longer exist in the fresh upstream clone, so the docs now point to this current review instead.
- The parent pm-substrate repo now represents `arrowhedgelab` as an external Git submodule-style reference at upstream commit `65a0349`, rather than owning the upstream source files directly.

## Required Adapter Contract

ArrowHedgeLab should expose a neutral integration API, not a pm-substrate import. pm-substrate should consume this API through a connector and translate it into substrate events/envelopes.

Minimum ArrowHedgeLab adapter surface:

- `GET /integration/v1/capabilities`: adapter version, app version/commit, supported surfaces, schema versions, auth mode, redaction policy.
- `GET /integration/v1/agents`: all analyst agents plus operational risk/portfolio manager roles, model defaults, descriptions, tool dependencies, and stable IDs.
- `POST /integration/v1/graphs/effective`: input React Flow graph -> effective execution graph with injected risk managers, rewired edges, skipped nodes, and validation issues.
- `GET /integration/v1/flows` and `GET /integration/v1/flows/{id}`: saved graph/config state with hashes.
- `GET /integration/v1/flows/{id}/runs` and `GET /integration/v1/runs/{id}`: run config, request hash, status, timestamps, result hash, and redacted model/API-key metadata.
- `GET /integration/v1/runs/{id}/events`: normalized run events for progress, agent output, risk state, portfolio decision, trade execution, and errors.
- `GET /integration/v1/backtests/{id}` and `GET /integration/v1/backtests/{id}/days`: stable day-level decisions, raw decisions, current prices, analyst signals, executed trades, portfolio state, exposures, metrics, source-data hashes, and evidence refs.
- `GET /integration/v1/data/cache/summary`: cache keys, source kind, ticker, window, row counts, min/max dates, freshness timestamps, and payload hashes.
- `GET /integration/v1/config/models` and `GET /integration/v1/config/api-keys`: model/provider inventory and redacted key presence only; no secret values.
- `POST /integration/v1/runs/{id}/envelope` or connector-side equivalent: produce a canonical run artifact/envelope from existing ArrowHedge state without requiring pm-substrate imports inside ArrowHedgeLab.

pm-substrate connector requirements:

- Treat ArrowHedgeLab as an external HTTP system.
- Pull from `/integration/v1/*`, then build `arrowhedge.run-envelope.v1` or successor schemas.
- Preserve graph, model config, agent outputs, risk state, portfolio state, data hashes, freshness windows, and evidence refs.
- Never read raw API key values.
- Keep ArrowHedge-specific mapping in finance-research capability/profile packages or a dedicated connector package, not substrate core.

## False-Positive Controls

The market-win hypothesis cannot be claimed from a single run or from governance-only tests. A valid paired experiment requires:

- identical tickers, dates, graph, model config, starting portfolio, API-key presence, and source-data hashes across baseline and substrate arms;
- raw pre-gate decisions preserved for both arms;
- substrate blocks only stale, source-conflicted, unauthorized, or out-of-policy actions;
- false-positive blocks equal zero on fresh in-policy decisions;
- false-negative stale/invalid actions equal zero when the fixture intentionally contains stale/conflicted state;
- replayable substrate event IDs and evidence hashes for every accepted or blocked terminal decision;
- PnL/market delta reported separately from governance/protection delta.

## Next Implementation Order

1. Add the neutral ArrowHedgeLab integration API under `app/backend/routes/integration.py` and pure service helpers under `app/backend/services/integration_*`.
2. Add a pm-substrate connector/test harness that calls the integration API and builds the existing `arrowhedge.run-envelope.v1`.
3. Run contract tests against the fresh upstream clone, then run substrate-side TypeScript tests for envelope expansion, COP projection, stale-state blocking, invalid-action blocking, and clean-current acceptance.

The critical design rule: ArrowHedgeLab must remain usable without pm-substrate. pm-substrate must be able to attach from the outside, observe/govern the system through stable microservice surfaces, and be removed without breaking the hedge fund app.

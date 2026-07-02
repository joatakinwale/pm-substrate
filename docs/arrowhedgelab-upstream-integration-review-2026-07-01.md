# ArrowHedgeLab Upstream Integration Review

Date: 2026-07-01

Scope: fresh upstream clone at `arrowhedgelab`, remote `https://github.com/virattt/ai-hedge-fund.git`, commit `65a0349`.

This review reflects the current tree after the old local `arrowhedgelab` copy was archived to `trash/arrowhedgelab-archive-20260701-133154` and replaced with a fresh upstream clone. The previous local `src/substrate` bridge is not present in this upstream tree.

## Evaluation

ArrowHedgeLab is a good substrate validation target, but it is not currently integrated as an external, portable pm-substrate target. The project has real multi-agent orchestration, persisted flow/run state, model/API-key configuration, market data tools, in-memory cache state, web and CLI execution paths, and backtest loops. Those are exactly the surfaces pm-substrate needs to govern.

The missing piece was a stable adapter boundary. The first slice now exists: ArrowHedgeLab exposes a neutral `/integration/v1/*` API for capabilities, agents, effective graph expansion, and cache summaries, and pm-substrate has a finance-ingest client that consumes and validates those endpoints as an external HTTP system. This is intentionally not a revived `src/substrate` bridge. ArrowHedgeLab stays usable on its own; pm-substrate attaches from the outside.

## Current ArrowHedgeLab State

Multi-agent orchestration:

- CLI path `src/main.py` creates a static LangGraph: selected analysts -> risk manager -> portfolio manager -> END.
- Web/backend path `app/backend/services/graph.py` builds a graph from React Flow nodes and edges, injects a synthetic risk manager for each portfolio manager, and rewires direct analyst -> portfolio-manager edges through that risk manager.
- The effective runtime graph is now exposed through `POST /integration/v1/graphs/effective`, which accepts a React Flow graph and returns the risk-manager-rewired graph with validation issues.
- Analyst inventory is centralized in `src/utils/analysts.py` with 19 analyst/persona/signal agents. The new `GET /integration/v1/agents` endpoint exposes those analysts plus operational `risk_management` and `portfolio_manager` roles with stable IDs and no callable objects.

Runtime/API surface:

- `/hedge-fund/run` streams progress and final decisions, analyst signals, and current prices.
- `/hedge-fund/backtest` streams progress and day results inside progress-event `analysis`, then final metrics/final portfolio/total days.
- `/hedge-fund/agents` returns analyst metadata only.
- `/flows` and `/flows/{flow_id}/runs` persist React Flow graphs, run request data, results, status, timestamps, and errors.
- `/language-models` and `/ollama` expose model/provider availability.
- `/api-keys` includes summary routes, but `GET /api-keys/{provider}`, create, update, and bulk routes return `key_value`; substrate must never use those raw secret routes.
- `/integration/v1/capabilities`, `/integration/v1/agents`, `/integration/v1/graphs/effective`, and `/integration/v1/data/cache/summary` now provide the first external adapter surface.

Data/provenance:

- Data tools in `src/tools/api.py` fetch prices, financial metrics, line items, insider trades, company news, market cap, and price DataFrames from Financial Datasets.
- `src/data/cache.py` stores prices, metrics, line items, insider trades, and company news in process memory.
- `GET /integration/v1/data/cache/summary` exposes cache kind, cache key, row count, observed date bounds when available, and SHA-256 hash without raw rows.
- `search_line_items()` says "Cache the results" but does not call `set_line_items`; this weakens reproducibility for agents using line-item data.

Backtesting:

- Backend `BacktestService` returns day-level `BacktestDayResult` with decisions, executed trades, analyst signals, current prices, exposures, and metrics, but no raw decisions, substrate envelope, source hashes, or independent data freshness metadata.
- Newer `src/backtesting/*` components are cleaner and more testable, but are not exposed as an integration service.
- `v2/*` provides an emerging protocol/data/backtesting research direction, but it is not wired into the app adapter surface.

## Current pm-substrate State

- `packages/capability-finance-research-ingest` already understands `arrowhedge.run-envelope.v1`, expands full run envelopes into per-ticker snapshots, emits typed finance-research events, builds COP state, and blocks stale or invalid actions.
- `packages/capability-finance-research-ingest/src/arrowhedge-integration.ts` now fetches and validates ArrowHedgeLab `/integration/v1/*` capabilities, agents, effective graphs, and cache summaries, producing evidence refs without importing ArrowHedgeLab code.
- `packages/substrate-http-demo` mounts ArrowHedge routes at `/tenants/:tenantId/arrowhedge` with `/snapshots` and `/run-envelopes`.
- `docs/validation.md` and `docs/arrowhedgelab-pm-substrate-integration-audit-2026-07-01.md` previously referenced the old local Python bridge (`arrowhedgelab/src/substrate/*` and `arrowhedgelab/examples/substrate/*`). Those paths no longer exist in the fresh upstream clone, so the docs now point to this current review instead.
- The parent pm-substrate repo now represents `arrowhedgelab` as an external Git submodule-style reference at upstream commit `65a0349`, rather than owning the upstream source files directly.

## Required Adapter Contract

ArrowHedgeLab should expose a neutral integration API, not a pm-substrate import. pm-substrate should consume this API through a connector and translate it into substrate events/envelopes.

Implemented first adapter surface:

- `GET /integration/v1/capabilities`: adapter version, app version/commit, supported surfaces, schema versions, auth mode, redaction policy.
- `GET /integration/v1/agents`: all analyst agents plus operational risk/portfolio manager roles, model defaults, descriptions, tool dependencies, and stable IDs.
- `POST /integration/v1/graphs/effective`: input React Flow graph -> effective execution graph with injected risk managers, rewired edges, skipped nodes, and validation issues.
- `GET /integration/v1/data/cache/summary`: cache keys, source kind, row counts, min/max dates when available, and payload hashes.

Remaining minimum ArrowHedgeLab adapter surface:

- `GET /integration/v1/flows` and `GET /integration/v1/flows/{id}`: saved graph/config state with hashes.
- `GET /integration/v1/flows/{id}/runs` and `GET /integration/v1/runs/{id}`: run config, request hash, status, timestamps, result hash, and redacted model/API-key metadata.
- `GET /integration/v1/runs/{id}/events`: normalized run events for progress, agent output, risk state, portfolio decision, trade execution, and errors.
- `GET /integration/v1/backtests/{id}` and `GET /integration/v1/backtests/{id}/days`: stable day-level decisions, raw decisions, current prices, analyst signals, executed trades, portfolio state, exposures, metrics, source-data hashes, and evidence refs.
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

1. Extend the neutral ArrowHedgeLab adapter from discovery/state surfaces into flow, run, event, backtest-day, model-config, and API-key-presence surfaces.
2. Extend the pm-substrate connector from contract validation into canonical `arrowhedge.run-envelope.v1` generation from live adapter responses.
3. Run paired contract tests against the fresh upstream clone, then run substrate-side TypeScript tests for envelope expansion, COP projection, stale-state blocking, invalid-action blocking, and clean-current acceptance.

The critical design rule: ArrowHedgeLab must remain usable without pm-substrate. pm-substrate must be able to attach from the outside, observe/govern the system through stable microservice surfaces, and be removed without breaking the hedge fund app.

# Live Dashboard Backend + Visualization Redesign

Date: 2026-06-18
Author: Joat
For: Emmanuel — dashboard needs a real backend (ArrowHedge bridge + substrate
endpoints, defined schema) and must visualize **two separate metric domains**:
(A) ArrowHedgeLab agent outputs/validation, and (B) substrate metrics — clearly
separated, accurate, informative.

## Current state (what we're replacing)

`packages/substrate-dashboard` is a static Vite app that bundles eval JSONL
fixtures at build time (`data.ts` imports `../../evals/fixtures/*.jsonl?raw`).
It's a sophisticated corpus viewer but shows **frozen fixture data**, not live
state. No backend.

## Target architecture

```
ArrowHedgeLab agents (live run) ──emit snapshots──▶ substrate ingest route
                                                          │
                                                   COP projection (live)
                                                          │
   dashboard ◀──GET /tenants/:id/arrowhedge/cop── substrate-http-demo
   (live fetch, polled)        + /metrics rollup
```

The substrate **already exposes the data** via
`GET /tenants/:id/arrowhedge/cop` → `ArrowHedgeCommonOperatingPictureState`.
That single payload already carries BOTH metric domains per ticker. The redesign
is: (1) dashboard fetches it live + polls; (2) UI splits it into two panels.

## The two metric domains (the separation Emmanuel asked for)

### Domain A — ArrowHedgeLab agent metrics (what the agents decided)
Per ticker, from COP `latestSignal` / `latestDecision`:
- signal direction + confidence (the analyst ensemble's call)
- decision action / quantity / accepted
- current price + max shares (risk manager output)
- count of actionable vs hold decisions
Visualizations: per-ticker decision cards; confidence distribution; action mix
(buy/sell/hold) bar; accepted-vs-proposed.

### Domain B — Substrate validation metrics (what the governance layer caught)
Per ticker + summary, from COP `authorityGate` / `staleBlocks` /
`stateDisagreements` / summary:
- authority gate pass/fail counts + pass rate
- stale blocks (actions blocked because the read was stale)
- state disagreements
- valid event count
Visualizations: authority-gate gauge (pass rate); stale-blocks counter with
delta-protection framing (how many stale actions the substrate caught);
per-ticker gate pass/fail bars.

**Key UX principle:** never blend the two. Agent metrics = "what the model
wanted." Substrate metrics = "what governance allowed / blocked." The whole
thesis is the gap between them, so the dashboard must show them side by side,
labelled, with the delta (e.g. "agents proposed 5 actions; substrate blocked 3
stale ones").

## Backend contract (defined schema)

Reuse the existing live endpoint; add one rollup convenience endpoint in the
demo package (NOT substrate core — stays profile-agnostic):

- `GET /tenants/:tenantId/arrowhedge/cop` (exists) — full COP state.
- `GET /tenants/:tenantId/arrowhedge/dashboard` (new, demo pkg) — a
  dashboard-shaped projection of the COP split into `{ agentMetrics,
  substrateMetrics, tickers[], generatedAt }` so the frontend doesn't have to
  reshape. Pure read, derived from COP.

`dashboard` payload schema (v1):
```
{
  tenantId, generatedAt,
  agentMetrics: {
    tickerCount, actionableDecisions, holdDecisions,
    avgSignalConfidence, actionMix: {buy,sell,hold,short,cover}
  },
  substrateMetrics: {
    authorityGatePasses, authorityGateFailures, authorityGatePassRate,
    staleBlocks, stateDisagreements, validEventCount,
    deltaProtection   // stale actions blocked = staleBlocks
  },
  tickers: [{
    symbol,
    agent: { signal, signalConfidence, action, quantity, accepted, currentPrice },
    substrate: { gatePasses, gateFailures, staleBlocks, stateDisagreements }
  }]
}
```

## Build plan

1. Add `GET .../arrowhedge/dashboard` to `arrowhedge-route.ts` (demo pkg): read
   COP, reshape into the v1 payload. Test it.
2. New frontend view `live.ts` in substrate-dashboard: fetch the dashboard
   endpoint (configurable base URL via `?api=` or `VITE_SUBSTRATE_API`), poll
   every N s, render Domain A and Domain B as two clearly separated panels with
   simple SVG/CSS visualizations (no heavy chart lib — keep it dep-free).
3. Keep the existing fixture corpus view available behind a toggle; default to
   live when an API base is configured.
4. Serve via the existing Tailscale launchd server; add a refresh step.

## Guardrails

- Read-only. The dashboard never mutates substrate state.
- API base configurable; defaults to the local demo server. No secrets in the
  frontend bundle.
- Degrade gracefully: if the API is unreachable, show "no live data" not a crash.

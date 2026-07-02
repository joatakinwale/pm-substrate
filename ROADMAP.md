# pm-substrate — Roadmap

*The single forward-looking plan. Superseded plans: [`refactor-plan.md`](./refactor-plan.md) (executed 2026-07-02), [`docs/history/roadmap-2026-06.md`](./docs/history/roadmap-2026-06.md). Standing decisions live in the continuity ledger — `pnpm dev:resume` is authoritative over this file; if they disagree, record a superseding `decision` checkpoint and fix this file in the same change.*

---

## North star (decided 2026-07-02)

pm-substrate exists so that **two agent-run businesses are worth operating**: the marketing lab (PluggedInSocial) and the hedge-fund lab (ArrowHedge). Both die without agent-state coherence; the substrate is what makes them viable. The owner is customer #1. Everything on this roadmap serves that, in dogfood order: the substrate manages its own development first, then the two labs, then (only if the labs prove it) outside users.

**Falsification window:** by **2026-07-16**, write the keep/kill memo from measured evidence — resume fidelity across sessions, re-decisions avoided, gates that blocked real mistakes, and whether the labs' integration stayed cheap. If even we route around the substrate, that is the answer.

## Hard requirements (non-negotiable product properties)

1. **Zero-rewrite integration.** A system adopts the substrate through a thin kit only: `mapping.yaml` (entity-mapping), a sync adapter (webhook/poll/CDC), an action executor (admitted action → the app's existing API). The substrate governs the **agent boundary**, never the app's internals. Proven pattern: ArrowHedge integrates as a vanilla upstream clone + read-only `/integration/v1/*` endpoints. CI-enforced on the substrate side by `validate:zero-edit`.
2. **Sidecar deployment.** Docker + Postgres in the user's environment (VPC or laptop). No hosted dependency, no data leaving.
3. **Agents integrate via protocol, not imports.** MCP tools (`resume`, `observe`, `propose`, `admit`, `checkpoint`) + HTTP. Kernel stays TypeScript (the type system is load-bearing); clients are language-agnostic; a thin Python client SDK ships when the labs need it.
4. **Control plane answers five questions** from the admitted log alone: What is being done? What did governance do (admitted / blocked / gated, by whom)? What did it cost (tokens, by session/agent)? What are the results (the eval metrics)? What got optimized (closed work + superseding decisions)? v0 is `pnpm dev:status`; v1 is the dashboard page.
5. **Adoption ramp is shadow-first.** Observe + warn with zero behavior change, produce the "what would have been blocked" report, then gate one action type at a time.
6. **No unconsumed primitives.** Every new export ships with a runtime consumer in the same change (the v62–v229 lesson; enforced by budgets/ratchet gates).

## Phases (dogfood order)

| Phase | Deliverable | Done when |
|---|---|---|
| **D1 ✅ 07-02** | Dev-session loop (`dev:resume/checkpoint/handoff/cost/status`), CLAUDE.md protocol, seeded ledger | Sessions resume from the ledger, chain-verified; control-plane v0 answers the five questions in text |
| **D2** | **MCP tool surface** over substrate-http (`resume/observe/propose/admit/checkpoint`), with token auth | Any MCP-capable agent mounts the substrate with a config line; this repo's own sessions use it instead of raw scripts |
| **D3** | **Unblocked-work projection + dispatcher** (gap #1) | A projection computes "unblocked now" from WorkItems + `depends_on` + gates; the dispatcher hands exactly those to responsible agents; exercised by a lab scenario |
| **D4** | **Control-plane dashboard** page (extends `substrate-dashboard`) | The five questions rendered live from the event log: open work, governance tallies, `dev.session.cost` totals, metric lanes, chain integrity |
| **D5** | **Marketing lab wired**: PluggedInSocial's 5 raised anchors (agent_harness, browser_qa_harness, externalAdapterBoundary, metricsReadyAnalyticsDispatch, publicationTerminal) + sync adapter + publish/schedule executor | Live Axis-B conformance green from the external checkout; one real agency action (publish) runs propose→admit→execute in shadow, then gated |
| **D6** | **Hedge lab wired**: ArrowHedge action executor + paired run | One paired backtest run (gates off vs blocking) with the 12-metric capture: 0 false-positive blocks on fresh actions, 0 false-negatives on stale/conflicted ones |
| **D7** | **Keep/kill memo** (the 07-16 gate) | Measured answer to "did the substrate make the labs worth running?"; decides whether outside-user work (shadow-report generator, Python SDK, packaging) begins |

## Later ladder (only after D7 keeps)

Commitments and conflicts as first-class objects (cross-department interfaces) · role-bound agent identities (org chart as write permissions) · PM-as-projection reporting pack · `pm-substrate-client` on PyPI · shadow-mode report generator · shrinking (not just freezing) the quarantined tower.

## Anti-drift rules for this file

Roadmap changes are `decision` checkpoints first, edits here second. No phase may be added that does not serve the two labs before D7. Research may propose; only consumed code counts.

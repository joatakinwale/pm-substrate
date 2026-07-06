# pm-substrate — Roadmap

*The single forward-looking plan. Superseded plans: [`refactor-plan.md`](./refactor-plan.md) (executed 2026-07-02), [`docs/history/roadmap-2026-06.md`](./docs/history/roadmap-2026-06.md). Standing decisions live in the continuity ledger — `pnpm dev:resume` is authoritative over this file; if they disagree, record a superseding `decision` checkpoint and fix this file in the same change.*

---

## North star (decided 2026-07-02)

pm-substrate exists so that **two agent-run businesses are worth operating**: the marketing lab (PluggedInSocial) and the hedge-fund lab (ArrowHedge). Both die without agent-state coherence; the substrate is what makes them viable. The owner is customer #1.

**Generic-first (decided 2026-07-06, chk_565b7eb9):** the substrate is NOT built for those two apps alone. The owner is still building each app's own logic separately; they attach **later**, as validation targets, through the same generic kit any external app would use. No lab-specific code ships in the substrate's integration layer — if the labs can't attach with zero substrate edits, the zero-rewrite promise is false for everyone else too. Dogfood order stands: the substrate manages its own development first, proves the generic kit against a neutral fixture app, then the labs, then outside users.

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
| **D2 ✅ 07-03** | **MCP tool surface** (`packages/substrate-mcp`): `substrate_resume/observe/propose/admit/checkpoint`, stdio transport, content-addressed ledger head, warn-first propose + enforced admit, verified stale-basis block | Done for stdio (config-line mount, 4/4 gate tests green). Follow-up work item: streamable-HTTP transport + bearer auth |
| **D3 ✅ 07-03** | **Unblocked-work projection + dispatcher** (`computeUnblockedWork` + `dispatchUnblockedWork` in capability-pmgovernance-stage-gate; `pnpm pm:dispatch`): todo items with terminal-complete deps + passed gates dispatch to their RACI "A" role as `pm.work.dispatched` events, basis-hash deduped | Done, exercised end-to-end on the real graph (dedupe + dependency-completion reopening proven). Follow-up done 07-03: two-arm lab scenario `pm-governance-dispatch` (dependency regression after observe ⇒ baseline starts blocked work, dispatcher refuses at head) |
| **D4 ✅ 07-06** | **Control-plane dashboard**: substrate-http `/tenants/:id/control-plane` route (five questions from the admitted log), dashboard proxy + pure renderer, full integration test (blocked actions + dispatches + costs + chain integrity asserted over seeded state; surface opt-in via `controlPlanePool`) | Done end-to-end: route tested, proxy wired, renderer unit-tested |
| **D5 (reframed 07-06)** | **Generic integration layer** (`packages/integration-kit`): (a) **external adapter registry** — outside tools register as substrate-governed adapters with pinned source (url+commit), declared capabilities, required gates, evidence fields; pi harness (earendil-works/pi agent runtime), canary (LopeWale/canary browser QA), and Liquid (ertad-family/liquid universal adapter runtime, vendored at `liquid/`, lanes L1–L5 in [`docs/liquid-integration-plan.md`](./docs/liquid-integration-plan.md)) are the registered adapters; (b) **declarative entity-mapping + idempotent sync-runner** (app's existing read endpoints → Tier-1 primitives, provenance-stamped); (c) **executor bridge** (admitted envelope → app's existing API) | Proven against a neutral **fixture app**, not the labs: register→list round-trip; sync twice = idempotent; mapped nodes carry source provenance; executor fires only on accepted envelopes |
| **D6 (owner-driven, deferred)** | **Lab validation**: PluggedInSocial and ArrowHedge attach via the D5 kit once the owner finishes each app's own logic. Earlier app-side anchor work (external_adapter_contracts.py, /integration endpoints) remains valid prep | Each lab attaches with **zero substrate edits and zero app rewrites**; one real governed action end-to-end per lab (publish / backtest), shadow first |
| **D7** | **Keep/kill memo** (the 07-16 gate) | Measured answer from `dev:metrics` + the D5 fixture proof: resume fidelity, re-decisions avoided, gates that blocked real mistakes, integration cost. If the labs aren't ready by 07-16, the memo judges on dogfood + generic-kit evidence and sets the lab-validation date |

## Later ladder (only after D7 keeps)

Commitments and conflicts as first-class objects (cross-department interfaces) · role-bound agent identities (org chart as write permissions) · PM-as-projection reporting pack · `pm-substrate-client` on PyPI · shadow-mode report generator · shrinking (not just freezing) the quarantined tower.

## Anti-drift rules for this file

Roadmap changes are `decision` checkpoints first, edits here second. No phase may be added before D7 that does not serve the generic integration layer or the two labs' eventual attachment. Lab-specific code in the substrate kit is drift — reject it in review. Research may propose; only consumed code counts.

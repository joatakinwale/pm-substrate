# pm-substrate — Roadmap

*The single forward-looking plan. Superseded plans: [`refactor-plan.md`](./refactor-plan.md) (executed 2026-07-02), [`docs/history/roadmap-2026-06.md`](./docs/history/roadmap-2026-06.md). Standing decisions live in the continuity ledger — `pnpm dev:resume` is authoritative over this file; if they disagree, record a superseding `decision` checkpoint and fix this file in the same change.*

---

## North star (decided 2026-07-02)

pm-substrate exists so that **two agent-run businesses are operationally worth operating**: the marketing lab (PluggedInSocial) and the hedge-fund lab (ArrowHedge). The owner is customer #1. This is a comparative, falsifiable substrate claim — not a claim that infrastructure alone creates demand, marketing ROI, or investment alpha. Relative to matched no-substrate workflows, each lab must preserve or improve correct end-to-end outcomes and owner effort, add enforceable governance, integrate without substrate edits/app rewrite, and stay within a bounded cost premium. The executable definition, failure modes, and thresholds are in [`docs/objective-falsification.md`](./docs/objective-falsification.md).

**Generic-first (decided 2026-07-06, chk_565b7eb9):** the substrate is NOT built for those two apps alone. The owner is still building each app's own logic separately; they attach **later**, as validation targets, through the same generic kit any external app would use. No lab-specific code ships in the substrate's integration layer — if the labs can't attach with zero substrate edits, the zero-rewrite promise is false for everyone else too. Dogfood order stands: the substrate manages its own development first, proves the generic kit against a neutral fixture app, then the labs, then outside users.

**Falsification window:** by **2026-07-16**, write the keep/kill memo from admitted evidence. Technical dogfood and generic-kit proof decide whether the substrate survives; a full `keep` on the business-operability objective additionally requires both labs to pass the adoption, outcome, governance, economic, and external-validity scorecard. Missing lab evidence cannot be promoted into success: it caps the verdict at `keep_with_scope_cut` and sets a dated D6 validation window. If even we route around the substrate, that is the answer.

## Hard requirements (non-negotiable product properties)

1. **Zero-rewrite integration.** A system adopts the substrate through a thin kit only: `mapping.yaml` (entity-mapping), a sync adapter (webhook/poll/CDC), an action executor (admitted action → the app's existing API). The substrate governs the **agent boundary**, never the app's internals. Proven pattern: ArrowHedge integrates as a vanilla upstream clone + read-only `/integration/v1/*` endpoints. CI-enforced on the substrate side by `validate:zero-edit`.
2. **Sidecar deployment.** Docker + Postgres in the user's environment (VPC or laptop). No hosted dependency, no data leaving.
3. **Agents integrate via protocol, not imports.** MCP tools (`resume`, `observe`, `propose`, `admit`, `checkpoint`) + HTTP. Kernel stays TypeScript (the type system is load-bearing); clients are language-agnostic; a thin Python client SDK ships when the labs need it.
4. **Control plane answers five questions** from the admitted log alone: What is being done? What did governance do (admitted / blocked / gated, by whom)? What did it cost (tokens, by session/agent)? What are the results (the eval metrics)? What got optimized (closed work + superseding decisions)? v0 is `pnpm dev:status`; v1 is the dashboard page.
5. **Adoption ramp is shadow-first.** Observe + warn with zero behavior change, produce the "what would have been blocked" report, then gate one action type at a time.
6. **No unconsumed primitives.** Every new export ships with a runtime consumer in the same change (the v62–v229 lesson; enforced by budgets/ratchet gates).
7. **Technical proof is not business proof.** Activity counts, fixture tests, and seeded failure blocks cannot by themselves satisfy “worth operating.” `pnpm pm:memo` applies the executable business-operability scorecard and a verdict ceiling from admitted evidence.

## Phases (dogfood order)

| Phase | Deliverable | Done when |
|---|---|---|
| **D1 ✅ 07-02** | Dev-session loop (`dev:resume/checkpoint/handoff/cost/status`), CLAUDE.md protocol, seeded ledger | Sessions resume from the ledger, chain-verified; control-plane v0 answers the five questions in text |
| **D2 ✅ 07-06** | **MCP tool surface** (`packages/substrate-mcp`): `substrate_resume/observe/propose/admit/checkpoint`, stdio and streamable-HTTP transports, content-addressed ledger head, warn-first propose + enforced admit, verified stale-basis block | Done: config-line stdio mount plus streamable HTTP that refuses to start without bearer auth; gate and transport tests green |
| **D3 ✅ 07-03** | **Unblocked-work projection + dispatcher** (`computeUnblockedWork` + `dispatchUnblockedWork` in capability-pmgovernance-stage-gate; `pnpm pm:dispatch`): todo items with terminal-complete deps + passed gates dispatch to their RACI "A" role as `pm.work.dispatched` events, basis-hash deduped | Done, exercised end-to-end on the real graph (dedupe + dependency-completion reopening proven). Follow-up done 07-03: two-arm lab scenario `pm-governance-dispatch` (dependency regression after observe ⇒ baseline starts blocked work, dispatcher refuses at head) |
| **D4 ✅ 07-06** | **Control-plane dashboard**: substrate-http `/tenants/:id/control-plane` route (five questions from the admitted log), dashboard proxy + pure renderer, full integration test (blocked actions + dispatches + costs + chain integrity asserted over seeded state; surface opt-in via `controlPlanePool`) | Done end-to-end: route tested, proxy wired, renderer unit-tested |
| **D5 ✅ 07-06 (reframed 07-06)** | **Generic integration layer** (`packages/integration-kit`): (a) **external adapter registry** — outside tools register as substrate-governed adapters with pinned source (url+commit), declared capabilities, required gates, evidence fields; pi harness (earendil-works/pi agent runtime), canary (LopeWale/canary browser QA), and Liquid (ertad-family/liquid universal adapter runtime, vendored at `liquid/`, lanes L1–L5 in [`docs/liquid-integration-plan.md`](./docs/liquid-integration-plan.md)) are the registered adapters; (b) **declarative entity-mapping + idempotent sync-runner** (app's existing read endpoints → Tier-1 primitives, provenance-stamped); (c) **executor bridge** (admitted envelope → app's existing API) | Done against a neutral fixture app: register→list round-trip; sync twice = idempotent; mapped nodes carry source provenance; executor fires only on accepted envelopes |
| **D5-L ✅ 07-06 (Liquid lanes)** | Liquid periphery under governance ([`docs/liquid-integration-plan.md`](./docs/liquid-integration-plan.md)): **L1** runbook + local mount (owner env) · **L2** liquid-as-sync-source driver over the real `liquid-mcp` vocabulary (`liquid_connect`/`liquid_fetch`), `target_model` derived FROM the approved EntityMapping · **L3** `pm.mapping.proposed` + drift-as-obstruction + `pm:mappings` approvals · **L4** liquid executor target (`liquid_execute`, writes on accepted envelopes only) · **L5** live rehearsal (owner-gated) | Done: L2–L4 fixture-proven against the real vocabulary; unapproved hashes and missing external IDs obstruct; blocked envelopes never execute; L1/L5 recorded from the owner's environment against ArrowHedge |
| **D5-D ✅ 07-08 (Dashboard integration workbench)** | Unify `packages/substrate-dashboard` into a navigable substrate dashboard and add the D5 human adoption surface ([task index](./TASKS.md), [implementation plan](./docs/superpowers/plans/2026-07-08-dashboard-integration-workbench.md)): Control Plane, Local Agent Lab, and **Integration Workbench** (the plan's Live Metrics view shipped, then was removed the same day by owner decision "No lab-app content in the substrate dashboard" — lab-app metrics belong to the external apps). The workbench supports both config-first mapping (`mapping.yaml`/JSON validate → propose → approve → dry-run sync) and Liquid-assisted no-config proposal (`liquid_discover`/field inspection → pending `pm.mapping.proposed`), with all approvals, rejections, sync previews, and write outcomes read from the admitted log. | Done when the dashboard exposes mapping state, validation issues, pending/approved hashes, approve/reject actions, dry-run sync results, and Liquid-assisted starter proposals; unapproved mappings cannot sync; Liquid never writes directly; dashboard tests prove all routes return JSON and the visible shell mounts control-plane/lab/integration views |
| **D6 (owner-driven; evidence collection up next)** | **Lab business-operability validation**: PluggedInSocial and ArrowHedge attach through the D5 kit after their own logic exposes the required anchors. Define each run's outcome oracle before execution; collect matched baseline/substrate attempts, a holdout/dynamic run, write-path inventory, receipts, cost, and owner minutes. | For **each** lab: zero substrate edits/app rewrite; admitted read attach and governed action; >=5 paired runs/attempts per arm; substrate correct-outcome rate >=80% and not below baseline; 100% in-scope write governance with 0 false positives/negatives; cost/correct <=1.25x; owner minutes/correct <=1.0x; >=1 production-like shadow run; owner acceptance. Exact gate: [`docs/objective-falsification.md`](./docs/objective-falsification.md) |
| **D7 (gate 07-16)** | **Keep/kill memo** generated from the admitted log and executable objective scorecard | `pnpm pm:memo` reports technical evidence separately from business-operability evidence and enforces `kill_or_repair` / `keep_with_scope_cut` / `keep` ceilings. If D6 evidence is incomplete, do not claim success: judge the technical substrate, cut the claim, and set a dated lab-validation window |

### Up next — D6/D7 execution sequence

1. **07-13–07-14 · Make the decision honest.** Land and verify the executable
   objective scorecard, source/revision-bound measurement command, verdict
   ceiling, exact-provenance sync/action receipts, and corrected front-door
   docs. Historical integration events must not count for a newer app revision.
   This is substrate work.
2. **07-14–07-15 · Re-establish per-revision boundary conformance.** Current
   source inspection found two real blockers: PluggedInSocial is missing the
   `browser_qa_harness` external adapter and `operatorRunMonitorSurface` gate;
   ArrowHedge `main@6713139` no longer mounts the `/integration/v1` surfaces
   used in the 07-07 rehearsal. Restore those anchors additively in the
   external app repos, then run their conformance checks. Do not add lab names
   or compensating adapters to substrate packages.
3. **07-15 · Predeclare the pilots.** For each lab, save a revision-pinned run
   manifest: workflow, matched inputs, outcome oracle, expected allow/block
   cases, versions, budget, and maximum owner intervention. Preserve the
   revision-pinned boundary-conformance artifact and pass both refs into sync
   and action dispatch. Generate objective measurement templates but do not
   fill unknowns with estimates.
4. **07-16 · Take the D7 snapshot.** Regenerate `pnpm pm:memo`. On the current
   evidence, the technically green project is `keep_with_scope_cut`; missing D6
   data cannot become a waiver or a full `keep`.
5. **07-17–07-31 · Execute D6 after the app anchors are green.** Attach reads,
   inventory every in-scope write path, run shadow expected-allow/block cases,
   dispatch one governed action per lab, then collect >=5 matched attempts per
   arm plus a holdout/production-like run. Admit costs, owner minutes, receipts,
   and final acceptance.
6. **07-31 · Re-evaluate, do not automatically expand.** A full `keep` requires
   every scorecard dimension for both labs. A failed dimension triggers repair,
   claim reduction, or kill/salvage before any Later-ladder work.

## Later ladder (only after D7 keeps)

Commitments and conflicts as first-class objects (cross-department interfaces) · role-bound agent identities (org chart as write permissions) · PM-as-projection reporting pack · `pm-substrate-client` on PyPI · shrinking the excised/quarantined legacy surface.

## Anti-drift rules for this file

Roadmap changes are `decision` checkpoints first, edits here second. No phase may be added before D7 that does not serve the generic integration layer or the two labs' eventual attachment. Lab-specific code in the substrate kit is drift — reject it in review. Research may propose; only consumed code counts. No activity metric may be used as a proxy for a missing outcome, cost, owner-effort, or acceptance measurement.

# Capstone Readiness Evaluation — pm-substrate + ArrowHedgeLab

*Independent codebase review, 2026-07-22. Scope: fitness of pm-substrate as the core of two graduate capstones — Cost Engineering (ISE 5763, poster due Wed Week 8) and Project Management Methods (poster due Sun Week 13). Static review of both repos; the live ledger (`pnpm dev:resume`) was not reachable from the review environment, so ledger-dependent claims cite files, not checkpoints.*

---

## Verdict

pm-substrate is **strong enough to carry both capstones**, but the two projects are in opposite states. The PM Methods capstone (Week 13) is essentially already done as a case study — the repo *is* a disciplined, instrumented PM methodology with three months of real execution data. The Cost Engineering capstone (Week 8, the earlier deadline) has all the instrumentation it needs but currently **lacks the result it implies**: the one completed token A/B shows zero retry/token savings (C7 = C8 = 100%) and the benefit that did appear is integrity (12–14 corrupt admissions blocked vs 0), not cost. Meanwhile, the "PM substrate governs ArrowHedge" integration is **deliberately deferred in both repos** — stabilize ArrowHedge standalone first so failures aren't two-system fires — and the `/integration/v1/*` surface the substrate expects does not exist yet. Both items are manageable in the available time if the A/B is reframed and the integration lane gets explicit readiness criteria and a start date.

---

## 1. What exists today

### pm-substrate (TypeScript monorepo, 32 packages, ~350 commits May 1 → Jul 22)

The runtime core is real and coherent: hash-chained event log (`packages/events`), entity graph with cardinality/freshness enforcement (`packages/graph`), continuity ledger powering the dev-session loop (`packages/continuity`, `scripts/dev-session.ts`), stage gates and a dependency-gated work dispatcher (`packages/capability-pmgovernance-stage-gate`), procedure admission (`packages/procedure-admission`), five MCP tools (`packages/substrate-mcp`: resume/observe/propose/admit/checkpoint), a zero-rewrite integration kit (`packages/integration-kit`), and a five-question control plane (CLI `dev:status` + `packages/substrate-dashboard`). CI enforces contracts, budgets, provenance isolation, and the zero-edit plug-in rule; 149 test files, 967-test baseline.

Counterweights: ~41% of source LOC is the frozen 78k-line quarantined provenance tower plus 123 dead migrations; the eval apparatus (~66k LOC) is ~8–42× the runtime it measures (the repo's own external review pinned the 42:1 ratio in `scripts/guardrail-ratchet.json`); the headline causal claim is explicitly unproven (README 2026-07-21, D7 `not_eligible`); single maintainer, no coverage gate.

### ArrowHedgeLab (Python, fork of virattt/ai-hedge-fund, 120 ADRs, ~1,178 test functions)

Substantially mature: LangGraph orchestration of 19 analyst agents + risk manager + portfolio manager + deterministic chief-of-staff mission planner (`src/research/chief_of_staff.py`); `run_cycle` engine with hash-chained fund ledger; CPCV/PBO validation; simulated/paper brokers with all real-money order entry disabled (Robinhood is a phase-10-gated capability profile only). The standout subsystem is **cost governance**: pi-harness telemetry with per-call token counts, USD estimates, avoided-cost accounting, per-agent model tiers (`config/model_tiers.json`), canonical rate cards (`config/model_cost_rates.json`), budget gates, and durable governance ledgers exposed at `/pi-harness/stats`, `/observability/model-costs`, `/governance/*`.

---

## 2. Integration is deferred by design — treat it as a scheduled milestone, not a discovery

The gap between the integration objective and today's ArrowHedge code is intentional sequencing (owner decision): ArrowHedge must work standalone before the substrate attaches, otherwise every failure becomes a two-system debugging problem and the fires double. That is sound engineering — isolate the fault domain, verify the subsystem, then integrate — and the current state of both repos is consistent with it:

1. **No `/integration/v1/*` exists in ArrowHedge yet.** The substrate side is already built to consume it (`scripts/build-arrowhedge-paired-bundle.ts:1303` strips a `/integration/v1` suffix; expects `POST /flows/{id}/runs/`, `POST /hedge-fund/backtest`); ArrowHedge's 20 routers contain no integration surface or `mapping.yaml` yet.
2. **ArrowHedge's docs encode the stabilize-first rule.** `docs/final-production-fund-cockpit-plan.md:62` — "Focus on ArrowHedgeLab, not PM substrate integration." ADR 0081:16 — the mission bridge "must not tie the cockpit objective to PM-substrate."
3. **pm-substrate mirrors it from the other side.** ROADMAP D8 freezes both apps until a D7 keep decision; ArrowHedge may not be used as efficacy evidence.
4. **Auth is also stabilize-first.** Sensitive ArrowHedge routes are loopback-only pending a real operator/ownership model (`app/backend/security/local_operator.py`, fails closed on forwarded requests); the one externally-authenticated write is the HMAC-gated `POST /execution/monitoring-tick`.

The capstone implication is scheduling, not contradiction: the posters land on fixed dates, so "integrate when ArrowHedge is ready" needs an explicit readiness definition and a start date, or Week 8/13 arrive with the governing-layer story still unbuilt. Two things keep the sequencing safe: (a) define ArrowHedge's integration-readiness exit criteria now (e.g., Phase C cost rollup + approval gate green, KNOWN_ISSUES #5/#6 closed) and record them as a `decision` checkpoint / superseding ADR so the trigger is governed rather than implicit; (b) the capstones need a *case study*, not public-benchmark efficacy evidence — D8's freeze governs the public causal claim, not coursework — so a read-only `/integration/v1/*` + shadow-mode observation (adoption ramp step 1, what `pm:shadow` was built for) can open as a narrow lane without violating either repo's intent. Suggested wording is in §5.

---

## 3. Capstone #2 — Project Management Methods (due Sun Week 13)

**Fit: excellent. The repo already satisfies every required element with real, auditable data.** The strongest available topic framing: *"PM methodology as an enforceable operational boundary for autonomous agents — a case study of a self-governing software project."*

| Required element | Evidence in the substrate |
|---|---|
| Project introduction | README "Why this exists"; north star + falsification gate (ROADMAP) |
| Planning | Phased roadmap D1–D8 with explicit done-criteria; `work` checkpoints; TASKS.md index tied to ledger |
| Budgeting | Token budgets (`dev:cost` events, `validate:budgets`, `guardrail-ratchet.json` ceilings); per-session cost rollup in `dev:status` |
| Scheduling | Dependency + gate-driven scheduling: `computeUnblockedWork`/`dispatchUnblockedWork` — work dispatches only when `depends_on` items are terminal and covering milestones `passed` (automated critical-path release) |
| Execution | The dogfood loop itself (CLAUDE.md protocol): 275 dated Changelog entries over ~40 days, 236-entry research stream, sessions resumed from a hash-chained ledger, not chat memory |
| Monitoring | Five-question control plane (`dev:status`, dashboard control-plane page): what's being done, what governance did, what it cost, results, what got optimized |
| Transition | Shadow-first adoption ramp (observe → warn → gate one action type at a time; `pm:shadow` would-have-blocked report) + D8 transfer criteria + business-operability scorecard (`pm:memo`) — a documented transition-to-operations process |

Course-text mapping writes itself. **NASA Space Flight PM Handbook:** life-cycle phases ↔ D1–D8 phases; Key Decision Points ↔ stage gates + `decision` checkpoints; technical authority ↔ RACI single-accountability enforced as `exactly:1` edge cardinality (`packages/profile-pmgovernance/src/edges.ts`); reviews ↔ CI gates + procedure admission. **Checklist Manifesto:** CLAUDE.md session protocol is literally a checklist; procedure admission makes checklists *machine-enforced* (a run is operational only after authority-scoped admission and replay) — Gawande's thesis upgraded from discipline to physics. That contrast (humans treat governance as friction; for agents governance can be the API) is the poster's thesis line.

Remaining work: none required for content. Optional polish: a `dev:status`/dashboard screenshot and one ledger-derived chart (checkpoints by kind over time).

## 4. Capstone #1 — Cost Engineering, ISE 5763 (due Wed Week 8 — the binding deadline)

**Fit: good instrumentation, weak headline result as of today.** Existing assets: `scripts/run-capstone-token-ab.ts` (two-arm no_substrate/substrate experiment, per-attempt `eval.token.usage` events, C7/C8/C9 metrics, CSV + append-only `RUNS.md`), `scripts/report-token-usage.ts` (re-render any run from the admitted log — fold-once/render-many is itself a nice auditability point), `docs/ISE 5763 Capstone Project.xlsx` (Project Tracker / Project Definition / Token Savings Model sheets), and ArrowHedge's pi-harness cost dataset.

The honest current data (`docs/evidence/capstone/RUNS.md`): two OpenRouter gpt-4o-mini runs, 28 and 48 tasks. **C7 = C8 = 100%** (retry rate identical across arms — no token savings demonstrated), C9 ≈ 122–136 tokens per wasted attempt, **corrupt admissions 12–14 (baseline) vs 0 (substrate)**. A "Token Savings Model" poster built on this data would be falsified by its own evidence table.

Three viable framings, in order of recommendation:

1. **Reframe as cost-of-quality / cost avoidance (lowest risk, fits the data).** The measured benefit is prevented corrupt actions. Cost engineering treats this as avoided rework/failure cost: price each corrupt admission (tokens to detect + diagnose + redo downstream work, using C9 and measured session costs) and present substrate overhead vs expected failure cost avoided — a classic prevention-vs-failure cost tradeoff, straight from the cost-management chapters. CLO C (forecast/control expenditures) and CLO E (critique a cost-engineering software tool — the substrate's own control plane) are both directly served.
2. **Strengthen the experiment (medium risk).** Run the `evidence` scenario set (matched allow-controls), more repeats, ≥2 models, and add a $/token conversion to the fold (the dev path is tokens-only today; the only USD model in the repo is the Sentinel benchmark's micro-USD accounting in `packages/public-eval-corners/src/sentinel-production-economics.ts` — port that pattern into `computeTokenUsage`). If savings appear, great; if not, framing #1 still stands and the null result is honest content.
3. **Use ArrowHedge as the cost dataset (best NASA-CEH alignment, most work).** pi-harness gives per-call actuals with scope tags (fund/cycle/run/experiment/agent/provider/model); rate cards give parametric rates; `ModelCallReservationEstimate` gives pre-call estimates → **estimate-vs-actual variance analysis**; per-agent tiers give a cost-driver structure. NASA CEH mapping: WBS ↔ mission/cycle/agent hierarchy; parametric estimating ↔ rate card × token CERs; analogy ↔ prior-run history; EVM-flavored control ↔ budget reservations + material-variance alerts. Gap: cost-per-mission rollup is unbuilt (ArrowHedge TASKS C2), so aggregation is your job; and see §2 for the access path.

Also for CLO A (engineering economics): the substrate's own build history is a usable dataset — the 85k-line unconsumed tower is a documented sunk-cost/rework case study, with the "no unconsumed primitives" rule as the corrective control.

## 5. Recommended sequence (respecting both repos' governance)

Effort: S ≤ ½ day, M ≈ 1–2 days, L ≈ 3–5 days.

1. **(S, now)** Record the sequencing as governed decisions: ArrowHedge integration-readiness exit criteria + target date, and the capstone lane that opens when they pass. pm-substrate: `pnpm dev:checkpoint -- --kind decision --title "decision: capstone lane — ArrowHedge read-only integration + shadow-mode observation for coursework once ArrowHedge readiness criteria pass; public-claim freeze (D8) unaffected" --summary "..."`. ArrowHedge: a superseding ADR narrowing 0081/cockpit-plan #1 to "no *efficacy* coupling; read-only `/integration/v1/*` permitted once readiness criteria pass."
2. **(S)** Decide the Week-8 poster framing (§4 option 1 is the safe default; option 2 as upside). Re-run `capstone:token-ab` with the `evidence` set + a second model; add $ conversion.
3. **(M)** Build the minimal ArrowHedge integration surface only if you want the governed-lab story on either poster: read-only `/integration/v1/` router exposing missions, cycles, ledger head, and pi-harness cost rollups, gated by the existing HMAC external-adapter scheme (extend `external_adapter_auth.py` scopes) rather than loosening `require_local_operator`. Wire the substrate side with `pm:sync` + an EntityMapping, run `pm:shadow` for a would-have-blocked report. That is a complete, honest "governing layer in shadow mode" demo without touching D6/D7 claims.
4. **(M)** Cost-per-mission rollup in ArrowHedge (their TASKS C2) — needed only for §4 option 3.
5. **(S, Week 13 runway)** PM Methods poster assembly from existing artifacts: roadmap table, ledger stats, dispatcher diagram, control-plane screenshot, shadow report.
6. **Sizing note:** assuming a fall term starting late August 2026, Week 8 ≈ mid-October and Week 13 ≈ late November — comfortable for steps 1–3 if started within the next few weeks; verify against your actual academic calendar.

## 6. Risks worth stating on one line each

Week-8 poster anchored to "token savings" is contradicted by the repo's own RUNS.md — reframe or re-run first. The integration story requires decisions in two repos you solely maintain (bus factor = 1 for both). `capstone_project.html` at repo root is an orphaned Excel export (missing its `.fld` folder) — delete or regenerate; the `.xlsx` in docs/ is the live artifact. Changelog lags code by ~1 week; the ledger, not the docs, is current. Cost figures on the dev path are self-reported tokens without USD conversion until step 2 lands. Peer reviewers may ask "does the governing layer help?" — the defensible answer today is the integrity result and the shadow-mode report, not efficacy; the repo's own falsification discipline is the credible way to say so.

---

*Evidence paths cited inline. Companion detail: packages inventory, schema, and ArrowHedge router/auth findings verified against `packages/*`, `db/migrations/`, `scripts/*`, `docs/evidence/capstone/RUNS.md`, and `Substrate_ArrowHedgeFundLab/{app/backend,src,docs}` on 2026-07-22.*

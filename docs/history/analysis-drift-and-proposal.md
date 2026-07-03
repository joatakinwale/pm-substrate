# pm-substrate: Drift Anatomy and Refocus Proposal

**Date:** 2026-07-01
**Method:** Documentary reconstruction — README/thesis/ADRs, `Changelog.md` (sampled), `research/index.md` claim ledger, the `research/daily-arrowsmith-agent-state/` chain (231 files), `docs/validation.md`, `docs/superpowers/` specs/plans, and the full 177-commit git history (2026-05-01 → 2026-07-01).
**Companion:** `analysis-agent-state-vs-current-direction.md` (code-side memo, same date) — this report corroborates it from the prose/process side and extends the plan.

---

## 1. Timeline of intent: what this project set out to be, and what it became

### 1.1 May 1–12 — the founding: a PM-layer substrate, with discipline

The first commit (`affc234`, 2026-05-01, "Phase 0: substrate scaffold — types, graph, events, registry, workflow, projections") shipped the architecture that still stands. The original README states the founding metaphor plainly:

> "A workspace's project-manager layer — the missing layer that arbitrates *interactions between tools* the way a human PM arbitrates between specialists. Components are mature; **interoperability is the bottleneck**."

Note what that is: **PM-as-arbiter was the founding idea on day one.** Tier-1 = 7 universal primitives; Tier-2 = industry profiles ("wedding, legal, healthcare, agency") as separate packages. The first vertical was a *wedding-planning* profile (`f362a0c`, 2026-05-03, "P0.5: declare ProfileDefinition contract + wedding profile skeleton").

The May working style was a **bounded gap-closing loop**: G4 (anti-fixation second profile, `c1c629e`), G5 (drop-in provider diff / isolation / cross-tool E2E), G6 (typed capability contracts, ADR-0013), G7 (runtime permission enforcement, ADR-0014), G8 (workflow cycle/version/retry), G10 (`@pm/capability-kit`), G11 (`@pm/entity-mapping`, ADR-0020/21/22), G12 (read-staleness, ADR-0025/26). Every gap **terminated**: an ADR, tests, a merge, done. 29 ADRs by May 12. This is the project's proof that gap-driven development can be healthy — when gaps close.

### 1.2 May 20–27 — the rewrite thesis: agent state as "the harder validation surface"

`artifacts/pm_substrate_rewrite.md` ("State Coherence Under Partial Observation," 2026-05-26) re-anchored the project: pm-substrate "does not solve reality. It solves **governed operational state**." Two coupled claims:

1. **Plug-in claim** — a platform onboards with *zero substrate-package edits*.
2. **Agent-state claim** — agents behave better resuming from substrate state than from chat history.

The thesis is explicit that this was **not a pivot**: "The agentic state thesis is therefore not a pivot. It is a harder validation surface for the original project-manager-layer thesis." `docs/superpowers/plans/2026-05-27-three-axis-state-validation-pm-substrate.md` set the validation program: Axis A (ArrowHedge finance), Axis B (PluggedInSocial marketing), Axis C (local agent lab). `docs/validation.md` added T1–T8, 12 behavior metrics, 8 falsification modes, and hard checkpoints: *"No 'we'll address it later.' That's how this kind of project rots."*

### 1.3 June 5–24 — the daily-research era: automations arrive

- 2026-06-05: `research/daily-arrowsmith-agent-state/` chain begins (v01), one file per day.
- 2026-06-07: Codex automation `daily-ai-competitive-intelligence` installed, "scheduled daily at 7:30 AM America/Chicago" (Changelog).
- 2026-06-09: Codex automation `pm-substrate-daily-research-publish-closure` installed, "scheduled daily at 8:45 AM… verify/fetch main, inspect uncommitted work, reconcile daily research, create the task tree, validate, commit, push" (Changelog).
- 2026-06-10: wedding era formally retired for the rewrite thesis (`bc716c8`).
- 2026-06-10: **the project audited itself** (`research/research-portfolio-evaluation_2026-06-10.md`) and found: the claim ledger is "entirely agent-state"; the plug-in claim has "almost no research representation… Half the thesis is being validated; the other half is shipping code without a research/falsification loop"; and from v04 on the daily chain is "one step behind the code rather than ahead of it… Useful as sprint planning; weaker as research."
- 2026-06-18: live ArrowHedge bridge run surfaces the "advisory hole" (a block *event* isn't proof a mutation was *prevented*), producing v16's terminal-outcome correction.
- 2026-06-25: `docs/state-validation/failure-mode-audit-2026-06-25.md` — a question from Emmanuel: "are we hunting the holes the implementation's *logic* misses against its *objective* — scaffolding that looks like the full logic but isn't, advisory-not-enforced gates?" Finding **H1 — CRITICAL**: `freshnessGate`/`requireFresh` "is exported but called by ZERO production code… Until a production caller exists, the protection is theoretical."

### 1.4 June 25–27 — the explosion

The file-date histogram of `research/daily-arrowsmith-agent-state/` tells the story in one table:

| Date | research files/day |
|---|---|
| Jun 5–24 | ~1/day (v01–v17) |
| **Jun 25** | **41** |
| **Jun 26** | **71** |
| **Jun 27** | **99** |

Identical counts in `Changelog.md`: 211 of its 267 entries (79%) are dated June 25–27. Each research file ≈ one changelog entry ≈ one migration ≈ one slab of `packages/agent-state/src/index.ts`. Migrations 0023–0145 (123 of 147) all land in this window, in the `agent_state` schema. `index.ts` reaches **85,134 lines / 1,611 exports** (71% of all non-test package source: 86,029 of 120,874 lines). The chain runs v18 → v228 in three days: action-outcome envelopes → provider certificates → write authority → replay certificates → **certificate-store roots → root witnesses → witness ledgers → witness quorum topology → epoch seals → key rotation → proof-preserving compaction → pruning tombstones → tombstone-head witnesses → tombstone-store-head witnesses → tombstone-history-store-head witnesses…** — each cycle repeating one meta-level up. Migration 0135's name contains the recursion literally: `..._finalizer_proof_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

### 1.5 June 28 – July 1 — the stop and the swerve

- 2026-06-28: `60b61c4 first phase completed`.
- 2026-07-01, in one day (~25 commits): **v229** (`v229-substrate-primitive-backmap-2026-07-01.md`) back-maps v62–v228 into eight primitive families and installs a "recursion stop rule" plus `scripts/validate-arrowsmith-primitives.ts`; ArrowHedgeLab is reset to an upstream submodule of `virattt/ai-hedge-fund` behind a neutral `/integration/v1/*` adapter; the **PluggedInSocial autonomous marketing agency** is designed and scaffolded (`docs/superpowers/specs/2026-07-01-pluggedinsocial-autonomous-agency-design.md` + two plans + `plugged_in_social/`, ~1,540 files); and a new "Universal Data Adapter" goal is declared (`research/universal-data-adapter-implementation-goal-2026-07-01.md`: "LLM once, deterministic forever after").

So: **founded as a PM-arbiter substrate → sharpened into a governed-operational-state thesis → consumed by a 3-day recursive proof tower → halted by a self-written stop rule → immediately refracted into a second product (an agency platform) plus a new integration goal.** The stated intent never changed on paper — README today still says "the project-manager layer for agentic workspaces" — but 71% of the code now serves a question the thesis never asked.

---

## 2. Anatomy of the drift: the machine that built the tower

The tower was not a random hallucination spree. It was produced by a **well-specified research-to-code loop whose protocol had a generative rule and no terminating rule.** Five interlocking mechanisms, all documented in the repo's own prose:

### 2.1 The run protocol made every run end in a commit

`research/index.md` ("Run Protocol") requires every research run to: fetch main → read the ledger → "Create a new versioned research file; never overwrite old versions" → update indexes → update Changelog → validate → "Commit and push to `main`." The daily index adds: "The run is not complete until the intended research slice is committed on `main`, pushed to `origin/main`." A run that merely *wired existing code* or *ran an eval* doesn't obviously satisfy "create a new versioned research file" — so every crank of the loop produced a new artifact, and (from v62 on) a new primitive with a migration. The ledger even celebrates this: "This protocol is itself an agent-state test."

### 2.2 The question-replacement rule guaranteed the loop never terminates

v18 (June 25) formalized the generator. It opens with "Starting Ten Questions" and a table whose columns are literally **"Eliminated question → Peer-reviewed answer → Bridge into pm-substrate → Replacement question."** Every answered question *must* mint RQ(N+10). When v62 "reset the lane to substrate identity," the series restarted as SQ01 and every file thereafter closes with the same incantation — from v65: "The next substrate question is SQ13: what tamper-evident certificate-store root proves the store is append-only…?" SQ13 → SQ14 (who witnesses the root?) → SQ15 (who stores the witness?) → SQ16 (when is a witness settled?) → SQ17 (who is allowed to witness?) → SQ18 (where is *that* stored?) → … → SQ185. Each file also carries a "Missing Substrate Map Delta" section — a structural obligation to name what is still missing. **Closure was defined as producing the next gap.** Compare the May G4–G12 loop, where closure was defined as an ADR and a green test — and the loop halted.

### 2.3 The domain chosen is an infinite regress, and the literature has infinite fuel

The June 18/25 audits posed a legitimate demand: gates must be *enforced*, not advisory; a block event must partition terminally from acceptance. But "what makes this proof trustworthy?" is a question that applies to every proof object you build to answer it — who witnesses the witness, who seals the epoch of the sealer. The Arrowsmith method (each file requires a "Peer-Reviewed Mechanism Sources" table) then supplied unbounded material: v100 alone imports Crosby–Wallach tamper-evident logging, SUNDR fork consistency, CONIKS, and PARAKEET; v229's sources list adds PBFT, HotStuff, Casper FFG, certificate transparency, and TUF. That is **multi-party Byzantine-trust machinery imported into a single-tenant, single-Postgres, single-superuser deployment** — a mismatch the changelog itself recorded without acting on it: v226/v227/v228's claim boundaries each end "…and **live Postgres privilege/restart proof remain open**." Even more telling, v217–v218's claim boundaries list "**root-of-authority recursion**" as an open item — the loop *knew* it was standing on an unterminated regress and kept climbing.

### 2.4 Claim-boundary accretion turned honesty into a backlog generator

Every changelog entry ends with a "Claim boundary:" paragraph enumerating what remains open — v228's lists 13 open lanes. This is admirable epistemic hygiene, but in a loop whose protocol says "close a question per run," an ever-growing open-items list is an ever-growing work queue. The project's best habit (never overclaim) became its accelerant.

### 2.5 Automation removed the human rate-limit

Two scheduled Codex automations were installed June 7–9; the June 25–27 burst (41/71/99 runs per day, merged via PRs #23–#24 from branch `goal/agent-state-action-outcome-envelope`) shows the loop being cranked far beyond its daily schedule. The June 10 portfolio evaluation had already flagged the failure precursor — the chain had become "sprint planning" that trails the code — and nobody amended the protocol. There was **no budget** (files/day, migrations/week, package line count), **no depth limit** (meta-level of proof-of-proof), and **no relevance gate** (does this serve T1–T8?) until v229, which arrived after 167 tower layers.

### 2.6 The self-diagnosis (quote it, because it's exactly right)

v229 names the failure mode with complete clarity:

> "Block recursive proof-layer creation when the proposed layer is only 'the witness of the authority of the admission of the witness' for a shape already expressible by admission calculus, authority topology, replay semantics, settlement/finality, or obstruction evidence."

and lists among failure modes to prevent:

> "new witness-authority-transition-admission families created only because the previous proof layer can itself be questioned; hand-expanded ladders replacing a generic compiler; **treating line-count growth as proof of substrate progress**."

**Verdict on mechanism:** this was AI-driven gap-closing with a claim ledger that *by protocol design* converts every closure into a new required primitive, running under automation, on a self-similar problem, fed by a bottomless literature, with the stop rule written last instead of first. Falsification-driven accretion, minus the part of falsification that kills things.

---

## 3. Judgment: is the drift good?

**Net: bad — and the repo's own documents say so.** But the verdict must be split honestly.

### 3.1 Against the project's own thesis — bad, by the thesis's own tests

The thesis defined success as two coupled claims and instruments to measure them. Status per `docs/validation.md` and `docs/roadmap.md` *after* the 85k-line June:

- **T4 amnesiac resume — "Open — the full delete-context resume eval has not run."** This is *the* agent-state claim, the one sentence the whole June was nominally in service of. It was never executed. It still sits in roadmap "Now" item 2.
- **T3 deterministic risk gate — "Partial… runtime write-path enforcement still unclaimed."**
- **Plug-in metrics (time-to-plugin, substrate edit count, mapping coverage) — "not yet instrumented"** — the exact hole the June 10 evaluation flagged ("the other half is shipping code without a research/falsification loop") is still open in roadmap "Now" item 3.
- The June 25 audit's H1 (freshness gate has zero production callers) was answered not by wiring the gate but by building 167 proof layers *underneath* it.

The validation doc warned: "Architecture without falsification criteria is theology." The tower has falsification criteria *internally* (every layer has tamper tests) but no falsifiable connection to the thesis's behavioral claims — none of the 12 behavior metrics moved because of a tombstone-head witness quorum. It is rigorously tested theology. Meanwhile the tower is consumed almost nowhere: outside `agent-state` and its 53,444-line test file, the tower vocabulary (`TombstoneStoreHead`, `QuorumCertificate`, `WitnessLedger`, `AuthorityEpochSeal`) appears in exactly two files (`capability-kit`). And "quorum" over one Postgres under one superuser is vacuous — a fact the claim boundaries repeatedly deferred as "live Postgres privilege/restart proof remain open."

### 3.2 What the June genuinely bought — don't zero it out

- **The terminal-outcome discipline (v16–v33) is a real correction with real value:** "a block event is not proof of mutation prevention unless the action lifecycle has a mutually exclusive terminal outcome." `ActionOutcomeEnvelope`, grounded in linearizability, *is* the right primitive for approval gates — including PM approval gates.
- **Evidence ≠ authority** (`external-evidence.ts`, 22 admission lanes incl. **PM handoffs**, `authorityStatus: "evidence_only"`) is exactly the governance boundary a multi-agent org needs.
- **Replay certificates, recovery cuts, obstruction-over-summary** (refuse a global projection when local views conflict, rather than summarizing) are sound and directly reusable.
- **v229's eight primitive families** (state identity, admission calculus, recovery cut, policy compiler, authority topology, obstruction evidence, settlement/finality, replay semantics) are a *good ontology* — arguably the June's most valuable output is this compression map plus the stop rule.
- The peer-reviewed sourcing habit is genuinely unusual and worth keeping — under a budget.

### 3.3 Against the user's objective ("solve agent-state + PM methodologies as multi-agent governance")

- **Agent-state half:** the *lean* core (CurrentStateView / proposal review / state-review artifacts / outcome envelopes / continuity / evidence admission / evals) essentially solves it — pending the T4/T3 validation runs that were skipped. The tower contributes nothing further to this half until there are multiple mutually-distrusting runtimes.
- **PM-methodology half: it appears nowhere in the repo as an explicit design.** Grep confirms: no RACI, no methodology, scrum/kanban/PMBOK/stage-gate absent from `docs/`; "sprint" appears only inside research citations. *However* — and this matters — the repo keeps producing PM-shaped things without naming them: the founding README's PM-arbiter metaphor; the workflow runtime with approval/evidence binding; role projections that "must preserve action id, subject, terminal outcome, evidence refs, and blocking conflicts" (v18 RQ17); PM-handoff evidence lanes and `comparePmHandoffAgreement` (roadmap "Next" item 7); and above all the PluggedInSocial spec's ten-step loop — "Intake → Research → Strategy → **Work breakdown** → **Approval and access requests** → Content creation → Scheduling → Metrics → **Reporting** → **Next-action proposal**" with an Approval Queue and role-grouped Agent Workroom. **The July 1 pivot is an unlabeled PM-governance profile being built as a separate product instead of as the substrate's governance layer.** The drift, judged against the user's objective, is therefore doubly bad: it burned the June on the wrong half of the wrong claim, and it is now routing the *right* idea (PM-style multi-agent operating loop) into a second codebase where it won't generalize.

### 3.4 Summary verdict

| Era | Good | Bad |
|---|---|---|
| May gap-loop (G4–G12) | Disciplined, terminated, ADR-recorded | — |
| Thesis rewrite + T1–T8 | Sharp, falsifiable, still correct | Front-door docs lagged it (self-flagged 06-10) |
| Daily research chain v01–v17 | Real code audits (v02 caught a tautology); honest downgrades | Drifted into "sprint planning"; never tracked T1–T8 coverage |
| June 25–27 tower (v18–v228) | Terminal outcomes, evidence admission, replay certs, 8-family ontology | 71% of codebase, 123 migrations, Byzantine machinery for a single-writer DB, zero movement on T3/T4/plug-in metrics, essentially unconsumed |
| July 1 (v229 + pivot) | Stop rule + back-map is the right act of governance | Pivot ships a second product in-repo; PM-governance still unnamed; core validation debts still open |

---

## 4. Proposal: objective and plan

### 4.1 The objective the project should commit to

> **pm-substrate is the governance plane for teams of agents: project-management methodology — plan, roles/ownership, checkpoints, approvals, evidence, reporting — compiled into deterministic gates over a lean operational-state substrate.**
>
> Success = (a) T4 amnesiac resume passes on a real run; (b) one external platform (PluggedInSocial, out-of-repo) onboards and operates under a PM-governance profile with **zero substrate-package edits**; (c) paired baseline-vs-governed runs show improvement on the existing 12 behavior metrics.

This is not a new thesis. It is the founding README ("arbitrates the way a human PM arbitrates"), the rewrite thesis's governed-state plane, and the user's stated objective, unified. PM methodology is the *vocabulary humans already trust* for exactly the controls the substrate already implements: a plan is a workflow DAG; an owner is a capability permission; a checkpoint is a state-review artifact; an approval is an evidence-bound terminal outcome; a status report is a projection. Governance stops being an abstract "authority topology" and becomes a methodology profile a customer can read.

### 4.2 Keep / freeze / cut

**Keep (the lean substrate, ~35–40k lines):**
- `@pm/types`, `@pm/graph` (incl. `staleness.ts`), `@pm/events` (hash chain), `@pm/registry`, `@pm/capability-kit`, `@pm/workflow` (evidence binding, retry/dead-letter), `@pm/projections`, `@pm/continuity`, `@pm/tenants`, `@pm/profile-registry`, `@pm/entity-mapping`, `@pm/evals`, `@pm/local-agent-lab`, `substrate-http(+demo)`, `substrate-dashboard`.
- From `@pm/agent-state`, extract to a new `@pm/agent-state-core` (~4–6k lines): `CurrentStateView`, `ObservationContract` v2, `ActionProposalReview` (warn-first + invariant-class policy), `StateReviewArtifact` + hash replay, `ActionOutcomeEnvelope` + terminal-outcome index, `ProjectionReplayCertificate` + replay frontier, `OperationalStateRecoveryCut`, `external-evidence.ts` wholesale, observed read-set comparison. Selection rule: **keep exactly one instance per v229 primitive family; a second layer of the same family must justify itself against a live deployment trigger** (same pattern as ADR-0001's day-365 swap triggers).

**Freeze (do not delete — quarantine):**
- The remainder of the tower into `@pm/agent-state-provenance`: frozen package, no new migrations, its 53k-line test file runs only in its own CI lane. Keep migrations 0023–0145 as an applied-but-dormant schema for existing DBs; provide a squashed baseline for fresh installs. The tower becomes what v229 calls it: a compressed history to be *projected from*, not extended. Unfreeze trigger: a real multi-runtime / multi-trust-domain deployment (i.e., when "quorum" stops being one Postgres).
- The daily Arrowsmith chain itself: v229's stop rule stays, extended (below).

**Cut / relocate:**
- `plugged_in_social/` (~1,540 files) and `arrowhedgelab/` out of the monorepo (ArrowHedgeLab is already a submodule pointer to upstream — finish the move). They are Axis B and Axis A *consumers* via `/integration/v1/*` adapters, which is precisely the plug-in claim being tested honestly. Keeping them in-repo guarantees falsification mode #1 ("onboarding requires a substrate edit") by osmosis.
- SQ176–SQ185: re-triage against the new objective; most become "unfreeze triggers," not work items.

### 4.3 Govern the process, not just the code (dogfood the thesis)

The June 25–27 event was a *multi-agent governance failure inside the repo itself* — automated actors with write access, no plan gate, no WIP limit, no checkpoint reviews. The first customer of PM-as-governance should be pm-substrate's own automation:

1. Amend the Run Protocol: a run may close a question by **wiring, validating, or deleting** — not only by minting a primitive. New-SQ creation is capped (e.g., ≤3/week) and every SQ must name the T-test or behavior metric it serves.
2. Make v229's `primitive_family` validator a CI gate for *code*, not just research files: any PR adding an `agent_state` migration or >500 lines to a state package must declare its primitive family and its consumer.
3. Budgets in CI: max migrations/week; package line ceilings; an import-boundary test that fails if tower symbols spread.
4. Daily automations run under an approval gate: proposals land as PRs requiring a human terminal outcome — which is, precisely, an `ActionOutcomeEnvelope`.

### 4.4 Phased roadmap

**Phase 0 — Ratify and cauterize (week 1).**
Decision doc (ADR-0033): adopt the objective in §4.1; execute keep/freeze/cut; move PluggedInSocial/ArrowHedgeLab out; land the process gates of §4.3. Exit: monorepo ≤ ~45k non-test lines; CI green.

**Phase 1 — Pay the thesis debts (weeks 2–4).** All three are *already* in roadmap "Now"; they were skipped, not superseded:
- Run **T4 amnesiac resume** end-to-end (session 1 → checkpoint → delete context → resume → measure contradicted-claim avoidance).
- Wire `freshnessGate`/`requireFresh` into the finance-ingest accept gate and workflow dead-letter path (June 25 audit H1/H4).
- Instrument the plug-in metrics (time-to-plugin, substrate-edit-count, mapping coverage).
Exit: T3/T4/T5 rows in `docs/validation.md` flip to Implemented-with-run-evidence.

**Phase 2 — `@pm/profile-pm-governance` (weeks 4–8).** A Tier-2 profile — the architecture's own delivery vehicle, proven twice (wedding, agency):
- **Entities (Tier-1 bindings):** Plan/Milestone/WorkItem as `Engagement` subtypes; Deliverable as `Document`/`Resource`; StatusReport as projection-backed `Document`.
- **Roles & ownership:** RACI as typed edges (`responsible_for`, `accountable_for`, `consulted_on`, `informed_of`) from `Counterparty` (agent or human) to WorkItem; enforced at dispatch by existing registry `requiredPermissions` + field-level `ownership`.
- **Checkpoints & stage gates:** workflow nodes whose transition requires a `StateReviewArtifact` (the review) plus an approval `ActionOutcomeEnvelope` (the decision) under `evidenceBindingMode: "require_for_writes"` — machinery that exists today.
- **Methodology packs as data, not code:** workflow templates + policy matrices — Kanban (WIP limit as an admission rule on in-progress edges), Scrum (sprint = time-boxed workflow version; standup = reconciliation event, Kubernetes-controller style per the thesis; retro = lesson-kind continuity checkpoint), Stage-Gate/PRINCE2 (gate = blocking checkpoint with evidence classes).
- **Reporting:** status projections from the event log; escalation = obstruction artifact routed to the accountable role (obstruction-over-summary, straight from v18's RQ13 answer).
Exit: a 3-agent demo team (planner/executor/reviewer) runs plan → assignment → checkpoint → approval → report on the substrate; a governance eval extends `@pm/evals` (unauthorized-write block rate, checkpoint compliance, handoff agreement via the existing `comparePmHandoffAgreement`).

**Phase 3 — Prove it on PluggedInSocial from outside (weeks 8–12).** Re-express the agency spec's ten-step loop as the PM-governance profile: Approval Queue = approval gates; Agent Workroom roles = RACI edges; Work breakdown = plan explosion; ClientReport = status projection. PluggedInSocial consumes the substrate via its integration API (Axis B as designed on 05-27). Run paired baseline-vs-governed marketing runs; report the 12 metrics. **Exit = the two coupled claims, finally measured on one real platform: zero substrate edits + behavior deltas.**

**Later:** second external platform (one not owned by JOATLabs — the honest time-to-plugin number); the UDA goal as plug-in pipeline v2; unfreeze tower slices only when a deployment trigger fires (multi-runtime, external verifier, or a compliance customer demanding cryptographic provenance — the one market where the tower is an asset, not scope rot).

---

## 5. Risks and open questions

1. **Sunk-cost gravity.** 231 research files, 1,611 exports, and a 53k-line test file exert pull; "just one more witness layer" will feel cheap because the pattern is rehearsed. Mitigation is §4.3's CI budgets — the stop rule must bind *code*, not only v230+ research files (v229's minimal slice explicitly did "not delete or refactor existing `@pm/agent-state` code").
2. **The automations are still installed.** Unamended, the 7:30/8:45 Codex runs will resume the old protocol on the next trigger. Amending the Run Protocol is a day-one action, not a Phase-2 nicety.
3. **Freeze vs. extract risk.** Splitting `index.ts` (85k lines) is mechanical but not free; some tower types are load-bearing for the keep-list (e.g., outcome envelopes reference certificate/status refs; `capability-kit` imports tower symbols in 2 files). Budget real engineering time; do it behind the existing test suite (387 DB-backed tests) — this is the one place the giant test file earns its keep.
4. **Migration archaeology.** 123 dormant `agent_state` migrations vs. a squashed baseline for fresh installs: squashing breaks replay-from-zero parity with existing DBs. Proposal: keep both lineages, assert schema equivalence in CI. Open question: does anything *outside* dev environments run this schema today? (No production deployment is documented.)
5. **PluggedInSocial as a competing center of gravity.** It is the demo that sells, and its spec explicitly says it "must work without pm-substrate." Healthy for Axis B honesty — but leadership attention may follow the product and orphan the substrate again. The Phase-3 framing (PluggedInSocial *is* the governance profile's proof) is the alignment device; if that fails, the substrate should be re-scoped as PluggedInSocial's internal state layer and the universality claim descoped per validation.md option (b).
6. **Is PM methodology actually the right governance vocabulary for agents?** Open research question — checkpoints and approvals slow loops down; agents may need finer-grained, higher-frequency gates than human ceremonies (the receding-horizon pattern from v18/RQ18 suggests per-action gating, not per-sprint). The governance evals in Phase 2 must be allowed to falsify specific ceremonies, in the spirit of validation.md: fix, descope, or kill.
7. **Team-of-one dynamics.** The drift happened partly because one person + automations had no second reviewer with authority to say "stop" between June 25 and 27 (the June 10 evaluation *saw* the precursor and had no enforcement hook). Any governance rule that depends on self-restraint will fail the same way; the PR-approval gate in §4.3(4) is the minimum viable second party.
8. **Open question — what of the tower is silently relied upon?** The workflow certificate-status gate and graph write-authority refs (v37–v44) are wired into `workflow`/`graph`/`capability-kit` and are plausibly keep-list; a dependency audit during Phase 0 must sort wired-and-used from self-referential before the freeze line is drawn.

---

## Appendix: key evidence index

- Founding intent: `git show affc234:README.md`; commits `affc234` (05-01), `f362a0c` (wedding, 05-03), `c1c629e` (G4 agency profile, 05-05).
- Thesis: `artifacts/pm_substrate_rewrite.md` (05-26); "not a pivot… harder validation surface" (line ~178).
- Validation frame: `docs/validation.md` (T1–T8 statuses; "Architecture without falsification criteria is theology"; "No 'we'll address it later.'").
- Self-audits: `research/research-portfolio-evaluation_2026-06-10.md`; `docs/state-validation/failure-mode-audit-2026-06-25.md` (H1 zero-caller finding).
- Loop mechanics: `research/index.md` "Run Protocol"; `research/daily-arrowsmith-agent-state/index.md` "Collaboration Protocol" + v62–v75 stream notes ("The next substrate question is SQ__"); `v18-action-outcome-loop-2026-06-25.md` ("Eliminated question → Replacement question" table); `v100-…-witness-ledger-2026-06-26.md` (SUNDR/CONIKS/PARAKEET imports; "Missing Substrate Map Delta").
- Explosion measurements: file-date histogram of `research/daily-arrowsmith-agent-state/` (41/71/99 files, Jun 25–27); `Changelog.md` (211/267 entries Jun 25–27); `db/migrations/0023–0145`; `packages/agent-state/src/index.ts` (85,134 lines, 1,611 exports; 86,029/120,874 non-test lines = 71%); migration `0135_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Known-open regress: Changelog claim boundaries v217–v228 ("root-of-authority recursion… live Postgres privilege/restart proof remain open").
- Stop rule: `v229-substrate-primitive-backmap-2026-07-01.md`; `scripts/validate-arrowsmith-primitives.ts`.
- Pivot: `docs/superpowers/specs/2026-07-01-pluggedinsocial-autonomous-agency-design.md` (ten-step loop, Approval Queue, Work breakdown); plans `2026-07-01-pluggedinsocial-autonomous-agency-domain-spine.md`, `2026-07-01-virtual-agency-substrate-integration.md`; `research/universal-data-adapter-implementation-goal-2026-07-01.md`.
- Automations: `Changelog.md` 2026-06-07 (7:30 AM CI automation) and 2026-06-09 (`pm-substrate-daily-research-publish-closure`, 8:45 AM).

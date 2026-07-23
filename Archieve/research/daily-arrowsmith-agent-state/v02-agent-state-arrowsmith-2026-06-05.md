# v02 Agent-State Arrowsmith - 2026-06-05

Date: 2026-06-05
Method: Arrowsmith A-B-C continuation, repo-grounded literature delta
Status: second numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md`

Local context read in order:

1. `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md`
2. `research/daily-arrowsmith-agent-state/index.md`
3. `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md`
4. `Changelog.md`
5. Relevant implementation around `@pm/agent-state`, ArrowHedge COP, evals, and continuity:
   - `packages/agent-state/src/index.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.ts`
   - `packages/evals/src/local-lab.ts`
   - `packages/evals/src/adapter-proof.ts`
   - `packages/evals/src/arrowhedge.ts`
   - `packages/evals/src/metrics.ts`
   - `packages/continuity/src/evidence-linked-payload.test.ts`
   - `packages/continuity/src/context.ts`

Current strongest thesis:

> pm-substrate is not agent memory. It is the operational state-review layer that turns observations, provenance, authority, workflow position, and read-set freshness into an executable pre-action artifact. The next proof boundary is not a better narrative eval. It is a repeatable `currentStateView + originalObservationContract + assertionEvaluation + readSetValidation + warn-first decision` artifact that can be replayed before any agent action.

## 1. Delta From Prior Version

v01 made `current_state_view`, observation contracts, read-set validation, and state assertions the right next spine. v02 keeps that spine but corrects the maturity claim after reading the implementation and newer sources.

Added:

- **Executable state-review artifacts are now the central next mechanism.** Recent benchmark-auditing work and the current repo gap both say proof has to be artifact-backed: JSON reports, fixture identity, deterministic assertion outcomes, and metrics by assertion code/severity.
- **Automatic read-set reconstruction is now a stronger bridge.** S-Bus shows a direct contemporary LLM-agent version of the database read-set problem: agents overclaim what they read, and server-observed read logs can validate cross-shard staleness.
- **Constraint drift sharpens observation contracts.** Constraints can decay through memory, delegation, tool use, and audit. Observation contracts should be treated as maintained execution state, not comments in a prompt.
- **Handoff debt adds a project-management/continuity mechanism.** Structured handoff state reduces successor-agent rediscovery cost, but does not by itself guarantee solved-rate gains. This maps cleanly to continuity checkpoints plus state-review artifacts.
- **In-band deny/recuse signals clarify warn-first semantics.** Cooperative denial signals can influence agents but are not enforcement boundaries. This supports labeling current `warn` reviews as advisory until blocking policy is implemented.

Corrected:

- **Current observation-contract review is self-consistency, not stale-observation validation.** `reviewProposedActionAgainstCurrentState()` currently derives an observation contract from the same current view it evaluates. That proves the current view can reproduce itself. It does not yet test whether the agent's earlier observation remains valid.
- **`ProposedAction.subject` exists but is not validated.** The current read-set validator checks tenant, action type, refs, authority, projection, workflow, and conflicts, but not whether `action.subject` equals `view.subject`.
- **ArrowHedge proposal reviews are generated from current state, not from a proposal's original observation snapshot.** `buildArrowHedgeProposalReview()` builds both the action read set and current state from the same current view.
- **ArrowHedge current-state staleness needs evaluation/proposal time.** The view builder uses the latest ticker timestamp when computing conflicts and workflow position. It should accept an `asOf` or `evaluatedAt` time for proposal review.

Downgraded:

- **Eval pass claims remain scaffold/provisional where outcomes are assigned by scenario spec.** `local-lab`, `adapter-proof`, and much of ArrowHedge still hardcode baseline failure and substrate pass. That is useful scaffolding but not falsification.
- **Observation contracts are downgraded from "implemented validation" to "implemented assertion primitive plus a tautological review path."** The primitive is valuable, but the review must accept the original observation contract/read snapshot from the proposal.
- **Warn-first remains advisory.** Current reviews set `execution.allowed: true` and `blocking: false` even when invalid. This is correct for v1, but docs and metrics must not imply mutation blocking.

Contradicted:

- No core thesis was contradicted. The contradiction is narrower: current repo evidence does not yet justify claims that substrate eval passes are observed behavioral improvements or enforcement outcomes.

## 2. New Sources Reviewed

1. [Agent Memory: Characterization and System Implications of Stateful Long-Horizon Workloads](https://arxiv.org/abs/2606.06448), Yasmine Omri, Ziyu Gan, Zachary Broveak, Robin Geens, Zexue He, Alex Pentland, Marian Verhelst, Tsachy Weissman, Thierry Tambe, 2026-06-04, arXiv preprint. Source type: primary preprint, new 24-72h search. Relevance: systems-level taxonomy and profiling of memory systems; strengthens the claim that memory design has construction/retrieval/generation tradeoffs and freshness-latency implications, but does not supply authority or mutation validation.
2. [Will the Agent Recuse Itself? Measuring LLM-Agent Compliance with In-Band Access-Deny Signals](https://arxiv.org/abs/2606.06460), Thamilvendhan Munirathinam, 2026-06-04, arXiv preprint. Source type: primary preprint, new 24-72h search. Relevance: strong warning that cooperative access/deny signals are useful but are explicitly not security boundaries. Maps directly to `warn` vs `block` policy labeling.
3. [Handoff Debt: The Rediscovery Cost When Coding Agents Take Over Interrupted Tasks](https://arxiv.org/abs/2606.02875), Dipesh KC and Anjila Budathoki, 2026-06-01, arXiv preprint. Source type: recent primary preprint, slightly outside strict 72h depending on UTC cutoff but retained for project handoff relevance. Relevance: structured handoff views reduce successor-agent rediscovery cost; direct continuity and workflow-handoff bridge.
4. [Unified Context Evolution for LLM Agents](https://arxiv.org/abs/2606.02304), Zixuan Zhu, Yitong Hu, Yong Dai, Junfeng Fang, Chunyang Jiang, Senkang Hu, Yuzhi Zhao, 2026-06-01, arXiv preprint. Source type: recent primary preprint. Relevance: typed experience units and pruning are useful memory-management ideas, but still need provenance, authority, and invalidation before action.
5. [Automated Benchmark Auditing for AI Agents and Large Language Models](https://arxiv.org/abs/2605.26079), Junlin Wang, Federico Bianchi, Shang Zhu, Fan Nie, Yongchan Kwon, Bhuwan Dhingra, James Zou, 2026-05-25/26, arXiv preprint. Source type: primary preprint. Relevance: benchmark tasks often contain hidden dependencies, specification gaps, and brittle graders. This directly downgrades synthetic or spec-assigned eval pass claims.
6. [S-Bus: Automatic Read-Set Reconstruction for Multi-Agent LLM State Coordination](https://arxiv.org/abs/2605.17076), Sajjad Khan, submitted 2026-05-16, v2 2026-05-22, arXiv preprint. Source type: primary preprint with formal proofs/code claims. Relevance: very strong bridge for read-set validation in LLM-agent coordination; also warns that agent self-reports overclaim read usage.
7. [Safe Multi-Agent Behavior Must Be Maintained, Not Merely Asserted: Constraint Drift in LLM-Based Multi-Agent Systems](https://arxiv.org/abs/2605.10481), Tianxiao Li, Yixing Ma, Haiquan Wen, Zhenglin Huang, Qianyu Zhou, Zeyu Fu, Guangliang Cheng, 2026-05-11, arXiv preprint. Source type: primary preprint. Relevance: constraints must stay fresh, inherited, enforceable, and auditable across memory, delegation, communication, tools, and audit.
8. [Learning to Hand Off: Provably Convergent Workflow Learning under Interface Constraints](https://arxiv.org/abs/2605.19140), Jiayu Li, Enpei Zhang, Dawei Zhou, Elynn Chen, Yujun Yan, 2026-05-18, arXiv preprint. Source type: primary preprint. Relevance: handoff through shared artifacts under decentralized partial observability; supports explicit handoff interfaces and representation-gap metrics.
9. [Coordination as an Architectural Layer for LLM-Based Multi-Agent Systems](https://arxiv.org/abs/2605.03310), Maksym Nechepurenko and Pavel Shuvalov, 2026-05-05, arXiv preprint. Source type: primary preprint. Relevance: treats coordination as an architectural variable separable from model/tool capability; useful for pm-substrate's PM-layer thesis, but not direct proof.

## 3. Older Sources Added

1. [Transactive Memory: A Contemporary Analysis of the Group Mind](https://doi.org/10.1007/978-1-4612-4634-3_9), Daniel M. Wegner, 1987. Source type: foundational theory chapter. Mechanism: group memory is distributed expertise plus metaknowledge of who knows what. pm-substrate implication: continuity should expose source/owner/steward knowledge, not just facts.
2. [Team Member Shared Mental Models: A Theory and Some Methodological Issues](https://journals.sagepub.com/doi/10.1177/154193129103501917), Sharolyn A. Converse, Janis A. Cannon-Bowers, Eduardo Salas, 1991. Source type: foundational team-cognition paper. Mechanism: shared mental models are useful only if selected, measured, trained, and validated. pm-substrate implication: COP claims need measurable convergence/disagreement tests.
3. [Explicit vs. Implicit Coordination Mechanisms and Task Dependencies: One Size Does Not Fit All](https://www.researchgate.net/publication/246144615_Explicit_vs_Implicit_Coordination_Mechanisms_and_Task_Dependencies_One_Size_Does_Not_Fit_All), J. Alberto Espinosa, Javier Lerch, Robert E. Kraut, 2004. Source type: foundational coordination chapter. Mechanism: explicit coordination works through schedules/plans/procedures/communication; implicit coordination works through shared task/team cognition. pm-substrate implication: action reviews and handoff artifacts are explicit coordination scaffolding for agents.
4. [A Temporally Based Framework and Taxonomy of Team Processes](https://doi.org/10.5465/amr.2001.4845785), Michelle A. Marks, John E. Mathieu, Stephen J. Zaccaro, 2001. Source type: foundational team-process theory. Mechanism: teams cycle through transition, action, and interpersonal processes. pm-substrate implication: workflow position mismatch is not a narrow technical warning; it marks the wrong phase of work.
5. [Coordination Avoidance in Database Systems](https://www.vldb.org/pvldb/vol8/p185-bailis.pdf), Peter Bailis, Alan Fekete, Michael J. Franklin, Ali Ghodsi, Joseph M. Hellerstein, Ion Stoica, PVLDB 2014. Source type: primary database paper. Mechanism: coordinate only when invariants require it. pm-substrate implication: configurable `warn`, `block_on_fail`, `block_on_authority_or_stale`, and `audit_only` modes should be driven by invariant class, not blanket blocking.
6. [Event Sourcing](https://www.martinfowler.com/eaaDev/EventSourcing.html), Martin Fowler, 2005. Source type: canonical software architecture essay. Mechanism: state changes are stored as a sequence of events. pm-substrate implication: observation reports should be artifacts/events that replay why an action was allowed or warned.
7. [Common Operating Picture for Emergency Responders](https://www.dhs.gov/publication/common-operating-picture-emergency-responders), U.S. Department of Homeland Security, 2024. Source type: official public-sector guidance. Mechanism: a COP is continuously updated across integrated communication, information-management, and intelligence-sharing systems. pm-substrate implication: COP is not a static dashboard; it is a continuously refreshed state review.
8. [From common operational picture to common situational understanding](https://www.sciencedirect.com/science/article/pii/S0925753521002253), 2021. Source type: emergency-management research. Mechanism: information sharing is not enough; decision-making depends on common situational understanding shaped by role and experience. pm-substrate implication: state-review artifacts should include decision rights, role/authority, and escalation path.

## 4. Arrowsmith Bridge Table

| Agent-state problem | Bridge concept | Source discipline | Supporting papers | Implementation implication | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| Agent proposal cites state for one subject while acting on another | Subject/read-set binding | Databases, access control, provenance | S-Bus; Kung and Robinson OCC; W3C PROV | Add `subject_mismatch` to `ReadSetValidationIssueCode`; compare `action.subject` with `view.subject` in `validateProposedActionReadSet()` | High | Fixture proposes action on MSFT while citing AAPL read set and no warning appears |
| Observation review validates a contract built from the current view | Non-tautological observation contract | API contracts, constraint drift, benchmark auditing | ContractBench; Constraint Drift; ABA | Review API must accept the proposal's original observation contract/read snapshot and evaluate against the current view | High | Stale original contract and changed current view still produce all-pass assertions |
| Eval pass result is assigned by scenario spec | Executable artifact and benchmark audit | Agent evals, benchmark QA | ABA; STATE-Bench; Claw-Eval-Live | Persist ArrowHedge reports as JSON artifacts and derive metrics from assertion outcomes, not scenario labels | High | Changing fixture data without changing expected assertion outcomes does not change eval metrics |
| Read-set declarations may be incomplete or inflated | Observed read-set reconstruction | Distributed systems, LLM-agent coordination | S-Bus; OCC | Keep explicit read sets now, but record artifact/report generation from observed substrate refs and test missing refs/overclaim cases | Medium-high | Agent-declared refs differ from observed report refs and validator cannot detect gap |
| Warning is treated as enforcement | Advisory vs blocking policy | Security controls, access governance | Recuse Signal; Constraint Drift; coordination avoidance | Rename or label v1 execution as advisory/warn-first; add later `enforcementMode` policy | High | Metrics or docs imply mutation was blocked when `execution.allowed` is always true |
| ArrowHedge staleness uses latest data timestamp, not proposal time | As-of state estimation | Control/state estimation, workflow evals | Kalman; POMDP; STALE | Add `asOf`/`evaluatedAt` to `buildArrowHedgeCurrentStateView()` and use it in conflicts/workflow position | High | Proposal after `validUntil` shows no stale conflict in the current-state view |
| Constraints weaken through memory, delegation, and tools | Constraint state governance | Multi-agent safety, API/tool contracts | Constraint Drift; ContractBench; Recuse Signal | `ObservationContract` should carry maintained constraints and failed assertion codes into `ActionProposalReview` warnings | Medium-high | Constraint present in original report disappears from proposal review with no warning |
| Agent memory optimizes recall but not operational validity | Freshness-latency tradeoff | Agent-memory systems | Agent Memory systems characterization; MemoryAgentBench; STALE | Keep memory as derived support; action validity comes from current-state report and read-set validation | High | Memory-only arm matches artifact-backed review on stale/current authority fixtures |
| Agent handoff loses actionable state | Handoff debt, interface representation gap | Project management, coding-agent evals, decentralized learning | Handoff Debt; Learning to Hand Off; Espinosa et al.; Marks et al. | Store structured state-review/handoff artifacts beside continuity checkpoints | Medium-high | Successor agent with only repo/projection state resumes as efficiently as one with structured state-review artifact |
| COP becomes static dashboard prose | Common situational understanding | Emergency response, team cognition | DHS COP; common situational understanding; Converse et al. | COP artifact must expose current state, evidence refs, decision authority, owner/steward, missing sources, conflicts, and valid next actions | Medium-high | Actors still disagree on binding source/next action after viewing the COP report |
| Blocking every warning would overcoordinate | Coordination only when invariant requires it | Databases, project governance | Bailis et al.; OCC; Recuse Signal | Later enforcement modes should block only selected invariant classes such as authority/stale/mutation-critical failures | Medium | `block_on_fail` reduces false actions but causes unacceptable false-block rate versus targeted policy |

## 5. Claim Ledger

| Claim | Status | Notes |
| --- | --- | --- |
| LLM weights, prompts, memories, and retrieved docs are not operational state. | Confirmed | New agent-memory systems characterization supports memory as system component, not authority. |
| `current_state_view` is the right agent-facing read model for pm-substrate. | Confirmed | Repo now has `CurrentStateView`; newer sources strengthen state-review framing. |
| Observation contracts are a first-class bridge. | Revised | The primitive is correct, but the current proposal-review path is tautological until it accepts original observation contracts. |
| Read-set validation is the strongest next execution bridge. | Confirmed | S-Bus makes this LLM-agent-specific and formalizes observable read isolation. |
| pm-substrate currently proves substrate behavior improvement in evals. | Downgraded | Several evals still assign outcomes synthetically; mark as scaffold/provisional until assertions drive results. |
| Warn-first validates but does not enforce. | Confirmed | Current `ActionProposalReview.execution` always allows and never blocks. This must stay visible in docs and metrics. |
| Subject identity is already protected by read-set validation. | Contradicted | `ProposedAction.subject` is not compared to `CurrentStateView.subject` yet. |
| ArrowHedge observation reports already prove stale-contract detection. | Revised | They prove assertion primitives, but proposal review needs prior observation snapshots and `asOf` calculation. |
| RAG or larger memory can solve agent state. | Downgraded | New memory sources still focus on memory performance and cost, not authority, invalidation, or mutation safety. |
| Structured handoff state helps agent continuity. | Confirmed, with limits | Handoff Debt supports efficiency gains. Solved-rate improvements are smaller/model-dependent, so do not overclaim. |
| COP is a shared operational state surface, not just a dashboard. | Confirmed | Emergency/COP and team-cognition sources support this, but measurable convergence tests are still required. |
| Configurable enforcement policy is the right next stage after warn-first. | Still speculative but strengthened | Bailis coordination avoidance suggests blocking should follow invariant class, not blanket caution. |

## 6. Implementation Implications

1. **Make observation reports executable artifacts.**
   - Save ArrowHedge `currentStateView`, original `observationContract`, `assertionEvaluation`, fixture id, expected assertion codes, and generated-at metadata as JSON eval artifacts.
   - The artifact should be the source for `analyzeStateAssertions()`, not a hand-built metric sample.

2. **Make action proposal review non-tautological.**
   - Change the proposal-review boundary so the caller can pass the proposal's original observation contract and read snapshot.
   - Keep a helper for "observe current state now," but do not use it as proof that an older observation is still valid.

3. **Add `subject_mismatch`.**
   - Extend `ReadSetValidationIssueCode`.
   - Compare `action.subject` and `view.subject` using `sameStateRef()`.
   - Fixture: propose `portfolio.decision.accept` for one ticker while citing another ticker's state refs.

4. **Add `asOf`/`evaluatedAt` to ArrowHedge current-state view generation.**
   - Use it when calculating stale conflicts and workflow position.
   - Preserve `observedAt` as the source observation time; do not overload it as proposal time.

5. **Label eval maturity explicitly.**
   - Add a stage field or notes convention: `scaffolded_scenario`, `detected_warning`, `blocked_mutation`, `paired_behavioral_improvement`.
   - Current ArrowHedge distribution-currentness can be `detected_warning`; local-lab/adapter synthetic passes remain `scaffolded_scenario`.

6. **Keep `warn` as advisory-only until policy work lands.**
   - `ActionProposalReview.mode` can remain `"warn"`.
   - The execution disposition should name advisory semantics clearly; later policy can add `warn`, `block_on_fail`, `block_on_authority_or_stale`, and `audit_only`.

7. **Connect continuity to handoff artifacts.**
   - Evidence-linked continuity payloads should cite the state-review artifact id, source refs, superseded/contradicted checkpoints, and current-state view id.
   - Do not replace raw observation artifacts with a summary.

## 7. Testing/Eval Implications

New ArrowHedge fixtures:

- `accepted-current-state`: all required refs present, current authority, current projection, expected all-pass assertions.
- `stale-risk-observation`: original contract validUntil before proposal time, expected `freshness_window_current` failure and read-set `stale_read_ref`.
- `authority-mismatch`: original/read-set authority differs from current view, expected `authority_rule_matches` and `authority_mismatch`.
- `missing-source-refs`: original required source ref absent from current view, expected `required_source_refs_present`.
- `projection-version-drift`: original projection version differs from current view, expected `projection_version_matches` and `projection_version_mismatch`.
- `workflow-position-mismatch`: original workflow position differs from current view or allowed action requires another position, expected `workflow_position_matches` and/or `workflow_position_mismatch`.
- `decision-snapshot-vs-current-risk-signal-conflict`: decision snapshot cites one risk/signal pair but current view has a conflicting binding source, expected `current_view_conflict` plus assertion warning.
- `subject-mismatch`: proposal subject differs from current view subject, expected `subject_mismatch`.

Assertions and metrics:

- Every fixture emits an artifact containing the input fixture id, generated `CurrentStateView`, original `ObservationContract`, evaluation, read-set validation, and final `ActionProposalReview`.
- Read-set warnings and observation assertion failures should align where they describe the same failure class, especially stale, authority, projection, workflow, and missing refs.
- `analyzeStateAssertions()` should count failures by code/severity from the artifact.
- `analyzeActionProposalReviews()` should count warnings by source/code/severity from the same artifact.
- Tests should assert no mutation-blocking claim yet: `execution.allowed === true`, `execution.blocking === false`, and a maturity/stage label says `detected_warning`, not `blocked_mutation`.
- DB-backed ArrowHedge projection test, gated by `PM_DATABASE_URL`, should prove the database projection can produce the same report shape as the fixture path.

Falsification metrics to add or formalize:

- `artifact_generation_rate`
- `assertion_failure_by_code`
- `warning_assertion_alignment_rate`
- `subject_mismatch_detection_rate`
- `synthetic_eval_pass_count`
- `scaffolded_scenario_count`
- `detected_warning_count`
- `blocked_mutation_count`
- `false_warning_rate`
- `db_fixture_equivalence_rate`

## 8. Open Questions For Next Run

1. Does S-Bus's DeliveryLog idea map better to pm-substrate capability invocations, event-store reads, projection reads, or all three?
2. Should `ActionProposalReview` store both `originalObservationContract` and `currentObservationContract`, or only original contract plus current view?
3. What is the cleanest artifact path and schema: package-local fixtures under `packages/evals/fixtures`, generated output under `artifacts/evals`, or checked-in golden JSON under ArrowHedge tests?
4. Can benchmark-auditing ideas be applied locally so fixture specs are audited for hidden dependencies and brittle expected assertions?
5. Which warnings should become blocking first under `block_on_authority_or_stale`: authority mismatch, stale ref, subject mismatch, missing required ref, or current-view conflict?
6. How should continuity checkpoints link to state-review artifacts without duplicating bulky current-state payloads?
7. Can ArrowHedge produce the same report from pure fixtures and DB-backed projection without brittle timestamp ordering?
8. What project-management literature best measures handoff quality, decision authority, and escalation timing in software/project teams rather than emergency response?
9. Should observation contracts model cooperative deny/recuse signals as `allowedUse`, `accessPolicy`, or a separate `authoritySignal` field?

## 9. Recommended Next Code Slice

Build the smallest artifact-backed ArrowHedge state-review harness:

1. Add `subject_mismatch` to `@pm/agent-state`.
2. Change `reviewProposedActionAgainstCurrentState()` to accept an explicit original `ObservationContract` instead of always deriving one from the current view.
3. Add `asOf`/`evaluatedAt` support to ArrowHedge current-state view generation.
4. Add the eight ArrowHedge fixtures listed above and generate JSON artifacts containing `currentStateView + observationContract + assertionEvaluation + readSetValidation + ActionProposalReview`.
5. Update eval metrics/tests so pass claims come from assertion/review artifacts and the current maturity label remains `detected_warning`, not `blocked_mutation`.

This is the repeatable state-review artifact that can sit directly before agent action execution. It preserves the substrate thesis without overclaiming enforcement before the configurable policy phase exists.

## Source Inventory Added In v02

- Agent Memory systems characterization: https://arxiv.org/abs/2606.06448
- Recuse Signal / in-band access-deny: https://arxiv.org/abs/2606.06460
- Handoff Debt: https://arxiv.org/abs/2606.02875
- Unified Context Evolution: https://arxiv.org/abs/2606.02304
- Automated Benchmark Auditing: https://arxiv.org/abs/2605.26079
- S-Bus read-set reconstruction: https://arxiv.org/abs/2605.17076
- Constraint Drift / Constraint State Governance: https://arxiv.org/abs/2605.10481
- Learning to Hand Off: https://arxiv.org/abs/2605.19140
- Coordination as an Architectural Layer: https://arxiv.org/abs/2605.03310
- Wegner transactive memory: https://doi.org/10.1007/978-1-4612-4634-3_9
- Converse/Cannon-Bowers/Salas shared mental models: https://journals.sagepub.com/doi/10.1177/154193129103501917
- Espinosa/Lerch/Kraut explicit vs implicit coordination: https://www.researchgate.net/publication/246144615_Explicit_vs_Implicit_Coordination_Mechanisms_and_Task_Dependencies_One_Size_Does_Not_Fit_All
- Marks/Mathieu/Zaccaro team processes: https://doi.org/10.5465/amr.2001.4845785
- Bailis et al. coordination avoidance: https://www.vldb.org/pvldb/vol8/p185-bailis.pdf
- Fowler Event Sourcing: https://www.martinfowler.com/eaaDev/EventSourcing.html
- DHS Common Operating Picture: https://www.dhs.gov/publication/common-operating-picture-emergency-responders
- Common situational understanding: https://www.sciencedirect.com/science/article/pii/S0925753521002253

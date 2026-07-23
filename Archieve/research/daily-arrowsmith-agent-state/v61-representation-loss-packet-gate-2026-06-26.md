# v61 Representation-Loss Packet Gate

Date: 2026-06-26
Status: research-only continuation; next Axis A code slice selected
Parent: `research/daily-arrowsmith-agent-state/v60-axis-a-source-authority-packet-family-2026-06-26.md`

## 1. Delta From Prior Version

v60 closed one more Axis A finance gap by converting ArrowHedge risk/signal snapshot mismatches from generic `state_disagreement` into a typed `source_authority_conflict` family with paired terminal packets and store-backed recovery. Axis A now has packet-backed proof for six families: `stale_observation`, `feedback_disconnection`, `partial_observation`, `memory_drift`, `continuity_break`, and `source_authority_conflict`.

This run does not add code. It reconciles the user-provided implementation frontier with the current branch and corrects that frontier: executable observation reports, typed `ActionProposalReview`, state-review JSON/JSONL artifacts, ArrowHedge fixtures, assertion metrics, no-mutation-blocking claim boundaries, and DB/fixture equivalence helpers already exist in `@pm/agent-state`, `@pm/evals`, and `@pm/capability-finance-research-ingest`. Repeating that slice would duplicate closed primitives.

The new research result is a sequencing decision for RQ71: implement `representation_loss` next, before `workflow_invalidation`, `capability_contract_violation`, and `parallel_write_conflict`. The mechanism should not be "better summaries." It should be a projection-admission check: if a role-specific view, local summary, or handoff projection drops or distorts invariant fields needed for action, the substrate should emit an obstruction/projection-fidelity failure and generate a blocked terminal packet.

Corrected claim: a useful current-state view is not sufficient if the projection path cannot prove that decision-critical source fields survived from raw/local evidence into `CurrentStateView`, `StateReviewArtifact`, and `ActionOutcomeEnvelope`.

Downgraded claim: shared mental models, user mental-model calibration, or stable-seeming prompt summaries do not prove operational state fidelity. They are coordination evidence and diagnostic context, not authority or projection completeness.

## 2. New Sources Reviewed

| Source | Authors / date | Link | Source type | Relevance |
| --- | --- | --- | --- | --- |
| Measuring User's Mental Models of Speech Translation in Human-AI Collaboration | Han, Balepur, Boyd-Graber, Carpuat; submitted 2026-06-23 | [arXiv:2606.24644](https://arxiv.org/abs/2606.24644) | Recent arXiv paper; human-AI collaboration | Supports the PM bridge that collaborators can learn where AI systems fail, but this remains mental-model calibration, not operational-state authority. |
| Auditing Framing-Sensitive Behavioral Instability in Large Language Models for Mental Health Interactions | Bedoui, Greene, Cherkaoui; submitted 2026-06-25 | [arXiv:2606.26982](https://arxiv.org/abs/2606.26982) | Recent arXiv paper; LLM behavior audit | Strengthens the downgrade of wording-, framing-, and summary-stability claims. Semantically similar inputs can change model behavior, so lossy projection cannot be trusted without invariant-field checks. |
| Agentic Electronic Design Automation: A Handoff Perspective | Liu et al.; submitted 2026-06-18 | [arXiv:2606.19795](https://arxiv.org/abs/2606.19795) | Recent arXiv paper; workflow/handoff systems | Strong analogy for workflow handoffs: transferred objects must satisfy consumer acceptance conditions and carry context, evidence, and provenance. |
| PowerAgentBench-SS: A Strict, Scenario-Scoped Benchmark for Evaluating Engineering LLM Agents | Mylonas et al.; submitted 2026-06-17 | [arXiv:2606.18789](https://arxiv.org/abs/2606.18789) | Recent arXiv benchmark | Supports capability-contract testing: answer quality is not enough; tool/API constraints, validation budget, evidence log, and scenario-scoped assertions matter. |
| Uncertainty Decomposition for Clarification Seeking in LLM Agents | Gregory Matsnev; submitted 2026-06-17 | [arXiv:2606.19559](https://arxiv.org/abs/2606.19559) | Recent arXiv paper; agent uncertainty | Useful for deciding when missing or ambiguous source fields should trigger resolution instead of pretending a projection is complete. |
| From Agent Traces to Trust: A Survey of Evidence Tracing and Execution Provenance in LLM Agents | Wang et al.; submitted 2026-06-03, revised 2026-06-16 | [arXiv:2606.04990](https://arxiv.org/abs/2606.04990) | Recent arXiv survey | Reinforces typed execution provenance and evidence tracing as the substrate path for replayable agent-state artifacts. |
| Contract2Tool: Extracting Tool Contracts from Documentation and Traces | Rahul Suresh Babu, Laxmipriya Ganesh Iyer; submitted 2026-06-05 | [arXiv:2606.07904](https://arxiv.org/abs/2606.07904) | Recent arXiv paper; tool contracts | Supports `capability_contract_violation` as a later Axis A family: tool schemas alone do not say preconditions, effects, risk, and cost. |
| Do More Agents Help? | Fu et al.; submitted 2026-06-04 | [arXiv:2606.05670](https://arxiv.org/abs/2606.05670) | Recent arXiv benchmark | Downgrades multi-agent coordination claims unless role utility and evidence contribution are measured under normalized protocols. |

## 3. Older Sources Added

| Source | Authors / year | Link | Source type | Relevance |
| --- | --- | --- | --- | --- |
| Abstract Interpretation: A Unified Lattice Model for Static Analysis of Programs | Cousot and Cousot, 1977 | [ACM DOI](https://dl.acm.org/doi/10.1145/512950.512973) | Foundational formal-methods paper | Primary bridge for representation loss: derived views are abstractions, and useful abstractions must preserve properties relevant to the analysis/action. |
| A Formal Framework to Measure the Incompleteness of Abstract Interpretations | Campion, Urban, Dalla Preda, Giacobazzi; 2023 | [author page](https://caterinaurban.github.io/publication/sas2023/) | Formal-methods paper | Adds a mechanism for falsification: define completeness/precision obligations and measure what the abstraction loses. |
| Verification of Workflow Nets | van der Aalst, 1997 | [TU/e record](https://research.tue.nl/en/publications/verification-of-workflow-nets-2/) | Workflow/Petri-net paper | Foundation for `workflow_invalidation`: workflow soundness is a property of modeled transitions, not merely a fresh fact set. |
| An Axiomatic Basis for Computer Programming | C. A. R. Hoare, 1969 | [ACM DOI](https://dl.acm.org/doi/10.1145/363235.363259) | Foundational programming logic | Foundation for capability preconditions/postconditions. A tool call needs a contract around when it is valid and what effects it asserts. |
| A Critique of ANSI SQL Isolation Levels | Berenson et al., 1995 | [Microsoft Research](https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/) | Database systems paper | Foundation for `parallel_write_conflict`: anomalies arise when concurrent operations read/write overlapping state under weak isolation. |
| TeamSTEPPS Handoff | Agency for Healthcare Research and Quality, current page reviewed 2026-06-26 | [AHRQ](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html) | Official healthcare/team coordination guidance | Daily project-management bridge: handoff transfers information plus authority/responsibility, must surface uncertainty and changes, and requires receiver awareness/acknowledgement before responsibility is fully transferred. |

## 4. Arrowsmith Bridge Table

| Agent-state problem | Bridge concept | Source discipline | Supporting papers | Implementation implication | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| `representation_loss`: a summary, role view, or projection hides decision-critical source facts. | Abstract interpretation completeness; projection fidelity; invariant-core preservation. | Formal methods, program analysis, provenance. | Cousot and Cousot 1977; Campion et al. 2023; Wang et al. 2026 evidence tracing. | Add an ArrowHedge representation-loss packet family that checks whether required risk/signal/decision/source/workflow fields survive projection. Reuse or extend `LocalViewObstructionArtifact` instead of treating lossy summaries as clean current views. | High | A lossy view that omits risk/signal source snapshot ids must produce an obstruction/blocking cause and a substrate blocked packet; a complete view with the same facts must pass. |
| `workflow_invalidation`: current facts are correct but the workflow stage or handoff state no longer permits the action. | Workflow soundness; handoff acceptance; responsibility transfer. | Workflow nets, healthcare/project handoff, EDA stage handoff. | van der Aalst 1997; AHRQ TeamSTEPPS; Liu et al. 2026. | Add a later packet family where `workflowPosition` or handoff acknowledgement is stale/mismatched even though source facts are fresh. | High | An action using an obsolete workflow position must block before terminal admission and cite the invalid workflow/handoff ref. |
| `capability_contract_violation`: the action invokes a tool/capability under missing or violated preconditions. | Hoare pre/postconditions; design by contract; tool contract extraction. | Programming languages, software engineering, agent benchmarks. | Hoare 1969; Contract2Tool 2026; PowerAgentBench-SS 2026. | Add a later packet family that binds capability write contracts to proposal review and terminal packets. The failure should be "contract invalid" rather than stale state. | High | A malformed or precondition-violating finance write must produce expected contract issue codes and no accepted terminal authority. |
| `parallel_write_conflict`: two actors produce incompatible accepted/write claims over overlapping state. | Isolation anomalies; linearizability; terminal outcome partition. | Databases, distributed systems. | Berenson et al. 1995; Herlihy/Wing; Bayou/Dynamo lineage already in prior versions. | Add a later packet family with overlapping read/write sets and same-entity terminal conflicts. The terminal index should admit one incumbent or expose explicit conflict, never silently count both as valid. | High | Two conflicting accepted outcomes for overlapping state must fail terminal admission or create a typed conflict artifact recoverable from the store. |
| PM handoff loses authority, uncertainty, or acknowledgement while preserving task text. | Transactive memory; shared mental models; handoff acknowledgement. | Project management, human factors, healthcare safety. | AHRQ TeamSTEPPS; Han et al. 2026; prior Lewis/Marks/Espinosa PM sources. | Handoff views should carry owner/source/authority, unresolved risk, decision owner, escalation path, and acknowledgement refs. These should be source refs, not prose-only handoff notes. | Medium | A handoff packet missing receiver acknowledgement or authority owner should warn/block according to policy even if task summary text is fluent. |
| Model or prompt framing changes action despite semantically similar operational facts. | Framing-sensitive instability; observation contract vs generated interpretation. | LLM auditing, cognitive systems. | Bedoui et al. 2026; prior STALE/ContractBench sources. | Downgrade prompt summaries and paraphrased memories as state evidence unless they cite original source refs and pass projection-fidelity checks. | Medium | Two paraphrases of the same state cannot yield different accepted actions unless both resolve to the same checked source refs and proposal review result. |

## 5. Claim Ledger

| Claim | Status | Evidence | pm-substrate implication |
| --- | --- | --- | --- |
| ArrowHedge source-authority conflicts are now packet-backed Axis A failures. | Confirmed | v60 code/research; `source_authority_conflict` fixture family; store-backed paired proof. | Keep v60 as closed; do not reclassify source snapshot mismatch back to generic disagreement. |
| The prompt's requested observation-report JSON artifact and `ActionProposalReview` slice is still the next implementation frontier. | Revised | Current branch already has `StateReviewArtifact`, JSON/JSONL export/import, proposal review, ArrowHedge reports, metrics, fixtures, and DB/fixture paths. | Do not duplicate closed primitives. The next implementation frontier is a missing Axis A packet family. |
| `representation_loss` should be the first remaining RQ71 family to implement. | Confirmed as research direction; not yet implemented | Abstract-interpretation bridge plus existing `LocalViewObstructionArtifact` primitive. | Add an ArrowHedge representation-loss fixture/scenario pair before workflow/capability/parallel-write families. |
| A fluent summary or shared context can stand in for source-preserving operational state. | Downgraded | Bedoui et al. framing sensitivity; Cousot abstraction bridge; prior RAG/memory downgrades. | Require source refs and invariant-field preservation across projections. |
| Shared mental models improve coordination enough to authorize action. | Downgraded | Han et al. shows user mental-model calibration, not authority; AHRQ stresses responsibility/acknowledgement transfer. | Treat PM shared cognition as diagnostic/coordination evidence, not a replacement for current-state and authority checks. |
| `workflow_invalidation`, `capability_contract_violation`, and `parallel_write_conflict` can wait until representation-loss is packet-backed. | Revised | RQ71 has four remaining families; representation-loss has the shortest path through existing local-view obstruction and projection-preservation code. | Sequence RQ72 as representation-loss implementation, then RQ73-RQ75 for workflow, contracts, and parallel writes. |
| Broad mutation blocking is proven by current Axis A packets. | Still speculative / rejected for now | Axis A is partial; Axis B blocked; policy modes and external transports remain scoped. | Keep claim boundary: packet-backed protective refusals are proof for covered scenarios only. |

## 6. Implementation Implications

1. Add `buildArrowHedgeRepresentationLossFixtureCases()` in the finance adapter. The first fixture should make a role/local projection look action-ready while omitting or distorting invariant fields such as `riskStateId`, `risk.sourceSnapshotId`, `signal.sourceSnapshotId`, decision source refs, `projectionVersion`, or `workflowPosition`.

2. Model the failure as projection admission, not as another source-authority conflict. If local sections disagree on overlapping invariant fields, reuse `evaluateLocalStateSections()` / `LocalViewObstructionArtifact`. If fields are missing from a single lossy projection, emit a representation-loss issue and block terminal acceptance.

3. Add `ARROWHEDGE_CANONICAL_REPRESENTATION_PACKET_SCENARIOS` and include it in `ARROWHEDGE_CANONICAL_AXIS_A_PACKET_SCENARIOS`. The paired corpus should create one baseline comparator packet that accepts or would act from the lossy projection, plus one substrate protective packet that blocks with representation-loss evidence.

4. Preserve existing package boundaries. `@pm/agent-state` should own generic local-view/projection primitives. `@pm/capability-finance-research-ingest` should own ArrowHedge domain fixtures and source-field selection. `@pm/evals` should only map scenario specs and build source bundles.

5. Do not claim stronger mutation policy yet. The immediate result should be "Axis A covers seven packet-backed families" after implementation, not "all agent actions are blocked safely."

6. Keep the remaining RQ71 families distinct:
   - `workflow_invalidation`: stale stage/handoff acceptance despite fresh facts.
   - `capability_contract_violation`: tool/capability preconditions/effects/risk contract failure.
   - `parallel_write_conflict`: concurrent or overlapping write anomaly.

## 7. Testing/Eval Implications

1. Add focused finance tests proving the representation-loss fixture emits the expected observation/projection assertion code and severity.

2. Add paired packet tests showing the baseline arm fails from lossy projection while the substrate arm passes as a protective blocked outcome with `action_outcome_envelope` refs.

3. Add strict source-bundle recovery tests through `PostgresEvalEventStore.recordActionOutcomeEnvelopes()` and `buildArrowHedgeTerminalPacketProofSourceBundle()` so representation-loss is recovered the same way as temporal, continuity, and source-authority families.

4. Add a clean-current counterfixture proving the new projection checks do not over-block a complete current-state view.

5. Add a corrupted role-projection test where a projection hides invariant core fields from an existing terminal packet; `validateActionOutcomeRoleProjection()` or an adjacent projection-fidelity check should fail.

6. Extend metrics to count `representation_loss` by assertion code and severity, but keep `blocked_mutation_count` scoped to covered packet-backed scenarios.

7. If `PM_DATABASE_URL` is available, run the DB-backed packet path; otherwise keep the test skip explicit and avoid implying live DB proof.

## 8. Open Questions For Next Run

1. RQ72: What exact ArrowHedge invariant fields define representation completeness for a risk/signal/decision projection?

2. RQ73: Should `representation_loss` be emitted as an `ObservationAssertionFailure`, a `ReadSetWarning`, a `LocalViewObstructionArtifact`, a `StateConflict`, or a small bridge object that can be cited by all four?

3. RQ74: How should role-specific PM projections preserve enough invariant core without exposing unnecessary private or tenant-scoped details?

4. RQ75: For workflow invalidation, is `workflowPosition` enough, or does the packet need explicit handoff acknowledgement and decision-authority refs?

5. RQ76: For capability contracts, can current provider manifests and write contracts express preconditions/effects, or is a new contract facet required?

6. RQ77: For parallel write conflicts, should the first fixture use same-action terminal conflict, overlapping read/write sets, or graph write-authority conflict?

7. RQ78: What is the smallest authoritative Axis B fixture that can unblock the three-axis proof without inventing PluggedInSocial-only behavior?

## 9. Recommended Next Code Slice

Implement the `representation_loss` Axis A packet family only.

The smallest practical slice is:

1. Add one ArrowHedge lossy-projection fixture and one clean-current counterfixture.
2. Route lossy overlap/missing invariant fields into an obstruction or representation-loss issue.
3. Generate paired baseline/substrate `ActionOutcomeEnvelope` packets.
4. Register `ARROWHEDGE_CANONICAL_REPRESENTATION_PACKET_SCENARIOS`.
5. Extend the paired packet proof test to verify seven Axis A families through the existing packet-store/source-bundle path.

This directly converts the research into a repeatable state-review artifact immediately before agent action execution while preserving the current warn/block claim boundary.

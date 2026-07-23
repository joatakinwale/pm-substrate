# v03 Agent-State Arrowsmith - 2026-06-05

Date: 2026-06-05
Method: Arrowsmith A-B-C continuation, recent-source scan, repo-grounded implementation delta
Status: third numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md`

Local context read in order:

1. `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md`
2. `research/daily-arrowsmith-agent-state/index.md`
3. `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md`
4. `Changelog.md`
5. Relevant implementation around `@pm/agent-state`, ArrowHedge COP, evals, and continuity:
   - `packages/agent-state/src/index.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
   - `packages/evals/src/arrowhedge.ts`
   - `packages/evals/src/metrics.ts`
   - `packages/continuity/src/context.ts`
   - `packages/continuity/src/evidence-linked-payload.test.ts`

Current strongest thesis:

> The artifact boundary is now the architecture claim. A pm-substrate agent should not move from observation to action through memory, chat, or RAG alone; it should pass through a replayable `ActionProposalReview` artifact that binds the proposed action, original observation contract, current state view, read-set validation, assertion evaluation, warning policy, evidence refs, and eval maturity label.

## 1. Delta From Prior Version

v02 correctly identified the immediate implementation gap: ArrowHedge can build observation reports and proposal reviews, but those reports are not persisted as JSON eval artifacts, and the proposal-review helper still derives a fresh observation contract from the current view. v03 keeps that correction and adds a stronger collaboration/eval layer from new June 4 sources.

Added:

- **Action-level collaboration is now a daily research bridge, not just PM analogy.** CollabSim and ALMANAC make "shared mental model" measurable at the action level: common ground, shared task understanding, partner intent, and repair of misalignment. For pm-substrate, this means state-review artifacts should become the trace unit for multi-agent handoff and collaboration evals.
- **Execution-state memory strengthens, but does not replace, the substrate thesis.** MAGE argues that semantic memory fragments decision trajectories; the proposed state-tree/root-to-current-path mechanism supports the local claim that continuity summaries must be derived from replayable execution state. It does not prove memory alone is sufficient for authority or mutation validity.
- **Action-state communication is a bridge to compact COP records.** PACT treats inter-agent communication as a public state-update problem. This supports storing compact action-state records and proposal-review artifacts instead of letting raw natural-language agent messages become shared history.
- **Trace-to-repair work sharpens eval artifact requirements.** HarnessFix normalizes raw traces into step-level provenance and harness-layer failure attribution. ArrowHedge eval artifacts should be designed so future repair tooling can attribute failures to observation, projection, read set, authority, workflow, or policy layers.
- **Tool-surface drift is now a security/authority version of stale state.** WebMCP tool-surface poisoning shows runtime tool registration and metadata can change under an agent. `authority_mismatch` and future contract checks should eventually cover tool identity/origin/lifecycle drift, not only business data.
- **Tool failure recovery adds a fixture design rule.** ToolMaze shows implicit semantic failures are harder than explicit failures. ArrowHedge fixtures should include changed-current-state and missing-source cases where the tool response is syntactically valid but semantically unusable for the proposed action.

Corrected:

- **"Shared mental model" should not be a dashboard claim.** Recent collaboration papers make it a testable action-level property: do actors agree about goal, role, source, current state, and next valid action?
- **"Memory as execution state" is a useful mechanism but still a weaker authority claim than `currentStateView + readSetValidation`.** Memory papers improve task success and context cost; they still need provenance, freshness, source authority, and pre-action validation.
- **`ActionProposalReview` is better described as a pre-action review envelope, not yet a repeatable artifact, until JSON output and artifact-backed metrics exist.**

Downgraded:

- **Guardrail feedback alone is not enforcement.** TRIAD's `proceed/refuse/update` loop is useful for remediation, but pm-substrate should still keep deterministic execution disposition separate from LLM-readable feedback.
- **Protocolized agent communication is not operational truth unless bound to substrate refs.** PACT is strong support for action-state records, but the record must cite refs and validation results before it becomes authority.
- **Tool menus/descriptions are not stable capability contracts.** WebMCP tool-surface poisoning downgrades any assumption that visible tool metadata can be trusted without origin/lifecycle binding.

Contradicted:

- No central pm-substrate thesis was contradicted. The most important negative result remains local: the repo still does not implement JSON state-review artifacts or mutation blocking, and should not claim either.

## 2. New Sources Reviewed

1. [CollabSim: A CSCW-Grounded Methodology for Investigating Collaborative Competence of LLM Agents through Controlled Multi-Agent Experiments](https://arxiv.org/abs/2606.06399), Jiaju Chen, Bo Sun, Yuxuan Lu, Yun Wang, Dakuo Wang, Bingsheng Yao, 2026-06-04. Source type: primary preprint, new 24-72h search. Relevance: turns shared task understanding, common ground, and misalignment repair into controlled multi-agent eval dimensions.
2. [Humans' ALMANAC: A Human Collaboration Dataset of Action-Level Mental Model Annotations for Agent Collaboration](https://arxiv.org/abs/2606.06388), Jiaju Chen, Yuxuan Lu, Jiayi Su, Chaoran Chen, Songlin Xiao, Zheng Zhang, Yun Wang, Yunyao Li, Jian Zhao, Tongshuang Wu, Toby Jia-Jun Li, Dakuo Wang, Bingsheng Yao, 2026-06-04. Source type: primary preprint/dataset, new 24-72h search. Relevance: supports action-level annotations for self-reasoning, perceived partner intent, and perceived team goal; maps to future handoff/state-review eval labels.
3. [Beyond Semantic Organization: Memory as Execution State Management for Long-Horizon Agents](https://arxiv.org/abs/2606.06090), Yaoqi Chen et al., 2026-06-04. Source type: primary preprint, new 24-72h search. Relevance: directly says semantic similarity memory mismatches execution-state dependencies; supports root-to-current-path continuity, branch isolation, and rollback/resume concepts.
4. [Beyond Similarity: Trustworthy Memory Search for Personal AI Agents](https://arxiv.org/abs/2606.06054), Jiawen Zhang, Kejia Chen, Jiachen Ma, Yangfan Hu, Lipeng He, Yechao Zhang, Jian Liu, Xiaohu Yang, Tianwei Zhang, Ruoxi Jia, 2026-06-04. Source type: primary preprint, new 24-72h search. Relevance: memory is a trust boundary and durable control channel; supports memory-admission gates but does not replace source authority.
5. [What Should Agents Say? Action-state Communication for Efficient Multi-Agent Systems](https://arxiv.org/abs/2606.05304), Chen Huang, Yuhao Wu, Wenxuan Zhang, 2026-06-03. Source type: primary preprint, new 24-72h search. Relevance: treats inter-agent communication as compact action-state records before shared history; maps to JSON state-review artifacts.
6. [WebMCP Tool Surface Poisoning: Runtime Manipulation Attacks on LLM Agents](https://arxiv.org/abs/2606.06387), Lin-Fa Lee, Yi-Yu Chang, Chia-Mu Yu, Kuo-Hui Yeh, 2026-06-04. Source type: primary preprint, new 24-72h search. Relevance: tool identity, metadata, origin, and lifecycle are mutable operational state; strengthens capability-contract and authority-drift checks.
7. [From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing Harness Flaws](https://arxiv.org/abs/2606.06324), Mengzhuo Chen, Junjie Wang, Zhe Liu, Yawen Wang, Qing Wang, 2026-06-04. Source type: primary preprint, new 24-72h search. Relevance: normalizes fragmented traces into provenance/control-flow representations; supports artifact-backed failure attribution over scenario labels.
8. [When Tools Fail: Benchmarking Dynamic Replanning and Anomaly Recovery in LLM Agents](https://arxiv.org/abs/2606.05806), Dongsheng Zhu, Xuchen Ma, Yucheng Shen, Xiang Li, Yukun Zhao, Shuaiqiang Wang, Lingyong Yan, Dawei Yin, 2026-06-04. Source type: primary preprint/benchmark, new 24-72h search. Relevance: implicit semantic tool failures are especially damaging; ArrowHedge fixtures should test syntactically valid but invalid-for-action observations.
9. [From Risk Classification to Action Plan Remediation: A Guardrail Feedback Driven Framework for LLM Agents](https://arxiv.org/abs/2606.05805), Yuhao Sun, Jiacheng Zhang, Shaanan Cohney, Zhexin Zhang, Feng Liu, Xingliang Yuan, 2026-06-04. Source type: primary preprint, new 24-72h search. Relevance: supports structured remediation feedback, but also confirms policy feedback must be evaluated by downstream behavior.
10. [The Self-Correction Illusion: LLMs Correct Others but Not Themselves](https://arxiv.org/abs/2606.05976), Kuan-Yen Chen, Fang-Yi Su, Jung-Hsien Chiang, 2026-06-04. Source type: primary preprint, new 24-72h search. Relevance: role/source labeling changes correction behavior; supports externalizing stale/incorrect claims as artifacts with source role metadata instead of hiding them in agent thoughts.

## 3. Older Sources Added

1. [Bounded Autonomy for Enterprise AI: Typed Action Contracts and Consumer-Side Execution](https://arxiv.org/abs/2604.14723), Sarmad Sohail, Ghufran Haider, 2026-04-16. Source type: primary preprint/deployed enterprise evaluation. Mechanism: LLM interprets/proposes; typed action contracts, permissioned capabilities, scoped context, validation before side effects, and optional approval constrain execution. pm-substrate implication: `ActionProposalReview` should be the typed proposal envelope before deterministic workflow/capability execution.
2. [Managing Uncertainty in LLM-based Multi-Agent System Operation](https://arxiv.org/abs/2602.23005), Man Zhang, Tao Yue, Yihua He, 2026-02-26. Source type: primary preprint. Mechanism: uncertainty propagates through coordination, data pipelines, human-in-the-loop interaction, and runtime control logic; managed via representation, identification, evolution, and adaptation. pm-substrate implication: warnings should identify the uncertainty layer, not just say "invalid."
3. [Communication-as-Control: Intent-Aware Interaction for Scalable Multi-Agent Coordination](https://ojs.aaai.org/index.php/AAAI-SS/article/view/42528), 2026 AAAI Symposium paper. Source type: workshop/symposium paper. Mechanism: communication acts as a control loop over belief divergence and latent intent. pm-substrate implication: agent messages should carry preconditions/intent/state deltas and be validated as state transitions where they influence actions.
4. [Toward a Theory of Situation Awareness in Dynamic Systems](https://journals.sagepub.com/doi/10.1518/001872095779049543), Mica R. Endsley, 1995. Source type: foundational human factors paper. Mechanism: situation awareness involves perception, comprehension, and projection under working-memory and attention limits. pm-substrate implication: `currentStateView` should support not only "what happened" but "what it means for the next action."
5. [Measurement of Situation Awareness in Dynamic Systems](https://journals.sagepub.com/doi/abs/10.1518/001872095779049499), Mica R. Endsley, 1995. Source type: foundational measurement paper. Mechanism: interrupt/query techniques can empirically test situation awareness without relying only on final performance. pm-substrate implication: state-review evals can query whether agents identify source, authority, expiry, workflow position, and next valid action before execution.
6. [From common operational picture to common situational understanding](https://www.sciencedirect.com/science/article/pii/S0925753521002253), Safety Science, 2021. Source type: emergency-management research. Mechanism: COP is a basis for common situational understanding, but understanding also depends on responsibilities, trust, and role knowledge. pm-substrate implication: COP artifact needs decision rights and escalation owner, not only state fields.
7. [The impact of transactive memory systems on IS development teams' coordination, communication, and performance](https://www.sciencedirect.com/science/article/pii/S0263786311001050), Jack Shih-Chieh Hsu et al., 2012. Source type: project-management/IS empirical paper. Mechanism: mature TMS improves performance directly and indirectly through communication and coordination. pm-substrate implication: continuity should expose "who/source knows what" and use it in handoff artifacts.
8. [Knowledge sharing in open source software project teams: A transactive memory system perspective](https://www.sciencedirect.com/science/article/pii/S026840121300011X), Xiaogang Chen, Xue Li, Jan Guynes Clark, Glenn B. Dietrich, 2013. Source type: empirical OSS/project-teams paper. Mechanism: TMS dimensions support knowledge sharing and communication quality across distributed teams. pm-substrate implication: source refs and stewards should be surfaced as coordination metadata, not hidden provenance.
9. [Information Technology Project Escalation: A Process Model](https://www.researchgate.net/publication/229522615_Information_Technology_Project_Escalation_A_Process_Model), Magnus Mahring and Mark Keil, 2008. Source type: project-management case/process model. Mechanism: escalation proceeds through drift, unsuccessful incremental adaptation, and rationalized continuation. pm-substrate implication: warn-first policy should include escalation triggers and "needs authority" states before repeated invalid action attempts normalize drift.
10. [Realizing value from project implementation under uncertainty](https://www.sciencedirect.com/science/article/pii/S0263786317300601), International Journal of Project Management, 2017. Source type: project-management research. Mechanism: project value and remedial action are updated under uncertainty; reporting errors and escalation bias matter. pm-substrate implication: action proposal artifacts should record uncertainty and remedial decision context.

## 4. Arrowsmith Bridge Table

| Agent-state problem | Bridge concept | Source discipline | Supporting papers | Implementation implication | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| Proposal review exists but cannot be replayed as an artifact | Trace/provenance normalization | Agent evals, software harnesses | HarnessFix; Automated Benchmark Auditing; STATE-Bench | Persist `currentStateView + originalObservationContract + assertionEvaluation + readSetValidation + ActionProposalReview` as JSON artifacts with fixture id and maturity label | High | A fixture changes source data but metrics still pass because no artifact is regenerated |
| Memory/RAG returns semantically related but operationally wrong state | Execution-state memory | Agent memory, workflow state | MAGE; MemGate; STALE | Treat continuity memory as derived from execution-state artifacts; do not authorize action from memory alone | High | Memory-only agent matches artifact-backed review on stale, authority, projection, and workflow fixtures |
| Multi-agent communication loses actionable state | Action-state communication | Multi-agent LLMs, CSCW | PACT; CollabSim; ALMANAC | Store compact action-state records that cite refs, intent, preconditions, current view, and next valid action | Medium-high | Downstream agent gets natural-language handoff and artifact handoff; no measurable difference in missing-precondition rate |
| Agents disagree despite seeing the same dashboard | Common situational understanding | Human factors, emergency management, team cognition | Endsley 1995; COP-to-CSU 2021; CollabSim | Add eval prompts/assertions for source, role, goal, authority owner, escalation owner, and next valid action agreement | Medium-high | Agents viewing COP artifact still disagree about binding source or required escalation |
| Tool metadata changes after the agent begins a session | Tool-surface authority drift | Agent security, capability contracts | WebMCP Tool Surface Poisoning; ContractBench; Recuse Signal | Later add tool identity/origin/lifecycle refs to observation contracts and capability manifests | Medium | Runtime tool metadata changes and no warning is emitted before action |
| Tool response is syntactically valid but unusable for current action | Implicit semantic tool failure | Tool-use benchmarks, observability | ToolMaze; HarnessFix; ContractBench | Fixtures should distinguish schema validity from decision validity; assertions should fail when required semantic fields/source refs are missing | High | Malformed-for-action risk snapshot passes because JSON schema was valid |
| Agent keeps adapting after project/workflow drift | Escalation drift and unsuccessful adaptation | Project management, IS project escalation | Mahring and Keil; Realizing value under uncertainty; Managing uncertainty in MAS | Add warning codes or fixture labels for repeated invalid proposals and authority/escalation needed | Medium | Repeated stale or authority-invalid proposals are indistinguishable from one-off warning cases |
| Warn-first feedback may be mistaken for blocking | Advisory vs enforcement policy | Enterprise AI, guardrails, safety controls | Bounded Autonomy; TRIAD; Recuse Signal; Bailis coordination avoidance | Keep `execution.allowed=true` and `blocking=false` explicit until policy modes land; add maturity labels | High | Docs or metrics claim blocked mutation while review remains warn-first |
| Proposal subject differs from current view subject | Subject/read-set binding | Databases, access control, enterprise AI | Bounded Autonomy; S-Bus; WebMCP wrong-entity risk | Add `subject_mismatch` in `validateProposedActionReadSet()` | High | MSFT action with AAPL read refs passes validation |
| Collaboration quality is evaluated only by final result | Mental-model/action-level eval | CSCW, project management | ALMANAC; CollabSim; Hsu et al.; Lewis 2004 | Add future eval labels for actor intent, perceived team goal, source steward, and partner handoff expectation | Medium | Final task succeeds while action-level annotations show stale source/authority misunderstanding |

## 5. Claim Ledger

| Claim | Status | Notes |
| --- | --- | --- |
| pm-substrate's next proof is a replayable pre-action state-review artifact. | Confirmed | HarnessFix, PACT, and local code gaps strengthen artifact-first direction. |
| `ActionProposalReview` already exists as a typed envelope. | Confirmed | Local `@pm/agent-state` has the type and warn-first helper. |
| `ActionProposalReview` is already an executable/replayable eval artifact. | Downgraded | No JSON artifact path or generated fixture artifacts exist yet. |
| Observation-contract evaluation is fully non-tautological. | Still revised | The local review helper still derives the contract from the current view. |
| Execution-state memory strengthens the substrate thesis. | Confirmed with limit | MAGE supports state-tree/rollback framing, but memory does not supply authority by itself. |
| Semantic similarity memory is sufficient for long-horizon agents. | Contradicted/downgraded | MAGE and MemGate both argue semantic memory can fragment trajectories or admit unsafe context. |
| Shared mental models are relevant to agent-state work. | Confirmed | CollabSim and ALMANAC make this directly relevant to LLM agent collaboration, not just human PM analogy. |
| COP can be treated as a static dashboard. | Downgraded | COP-to-CSU and CollabSim require role, responsibility, intent, and repair of misunderstanding. |
| Tool metadata and tool availability are stable contracts once shown to the agent. | Contradicted | WebMCP tool-surface poisoning treats dynamic tool metadata as an attack/authority surface. |
| Read-set validation should include subject identity. | Confirmed | Local code still lacks this check; Bounded Autonomy highlights wrong-entity mutations as a hard class. |
| Warn-first is the right current policy stage. | Confirmed | It matches local code and avoids overclaiming enforcement before policy modes exist. |
| Guardrail feedback can replace deterministic execution policy. | Downgraded | TRIAD supports remediation feedback, not replacing side-effect boundaries. |

## 6. Implementation Implications

1. **Create an artifact schema, not just a helper output.**
   - Minimal fields: `artifactId`, `fixtureId`, `generatedAt`, `schemaVersion`, `maturity`, `currentStateView`, `originalObservationContract`, `assertionEvaluation`, `readSetValidation`, `actionProposalReview`, `expectedWarningCodes`, `expectedAssertionCodes`, and `sourceRefs`.
   - Store under a deterministic eval artifact path so metrics can read artifacts rather than hand-built samples.

2. **Make proposal review accept original observation state.**
   - Add an overload or new helper that accepts `originalObservationContract`.
   - Keep current helper for "observe now" use, but do not use it to prove older observations remain current.

3. **Bind proposal subject to current-state subject.**
   - Add `subject_mismatch` to `ReadSetValidationIssueCode`.
   - Validate `action.subject` against `view.subject` with the existing state-ref equality helper.

4. **Add `asOf` or `evaluatedAt` to ArrowHedge current-state view construction.**
   - Use it when calculating stale conflicts and workflow position.
   - Keep source `observedAt` separate from review/evaluation time.

5. **Preserve warn-first semantics in the artifact.**
   - Explicitly store `execution.allowed === true`, `execution.blocking === false`, `reason: "warn_first_v1"`, and `maturity: "detected_warning"` for warning fixtures.

6. **Align artifact metrics across assertion and review warnings.**
   - `freshness_window_current` should align with `stale_read_ref`.
   - `authority_rule_matches` should align with `authority_mismatch`.
   - `projection_version_matches` should align with `projection_version_mismatch`.
   - `workflow_position_matches` should align with `workflow_position_mismatch`.

7. **Design artifacts for future repair attribution.**
   - Add enough layer metadata to say whether a failure came from source observation, COP projection, original contract, read set, workflow state, authority policy, or execution policy.

8. **Defer broader tool-surface checks, but name them.**
   - WebMCP implies future `tool_surface_mismatch` or capability-manifest lifecycle validation, but the immediate code slice should finish ArrowHedge observation/action review artifacts first.

## 7. Testing/Eval Implications

Artifact-backed ArrowHedge fixtures should include:

- `accepted-current-state`: current accepted state, all required refs present, expected no failed assertions and no read-set warnings.
- `stale-risk-observation`: original contract/read set expired before proposal, expected `freshness_window_current` and `stale_read_ref`.
- `authority-mismatch`: original/read-set authority differs from current binding authority, expected `authority_rule_matches` and `authority_mismatch`.
- `missing-source-refs`: required source ref absent from current view, expected `required_source_refs_present` and `missing_read_ref`.
- `projection-version-drift`: original projection version differs from current projection version, expected `projection_version_matches` and `projection_version_mismatch`.
- `workflow-position-mismatch`: original workflow position or required action position differs from current state, expected `workflow_position_matches` and `workflow_position_mismatch`.
- `decision-snapshot-vs-current-risk-signal-conflict`: decision snapshot cites stale/conflicting risk and signal refs, expected `current_view_conflict` and assertion warnings.
- `subject-mismatch`: proposed action subject differs from current view subject, expected `subject_mismatch`.

Assertions:

- Every fixture should emit one JSON artifact with a stable `artifactId`.
- Metrics should be derived from artifact contents, not scenario specs.
- `analyzeStateAssertions()` should count failures by code/severity from generated artifacts.
- `analyzeActionProposalReviews()` should count review warnings by source/code/severity from generated artifacts.
- A warning-alignment assertion should prove read-set warnings match observation assertion failures for the same failure class.
- Tests must keep v1 honest: no fixture should claim mutation blocking until configurable policy modes are implemented.
- When `PM_DATABASE_URL` is available, a DB-backed ArrowHedge projection should produce the same report shape as fixture-generated artifacts.

Future eval labels:

- `scaffolded_scenario`
- `generated_artifact`
- `detected_warning`
- `blocked_mutation`
- `paired_behavioral_improvement`

New candidate metrics:

- `artifact_generation_rate`
- `artifact_schema_validity_rate`
- `warning_assertion_alignment_rate`
- `subject_mismatch_detection_rate`
- `tool_surface_drift_detection_rate`
- `semantic_tool_failure_detection_rate`
- `state_review_replay_success_rate`
- `handoff_precondition_recall_rate`
- `shared_goal_alignment_rate`
- `authority_escalation_needed_rate`

## 8. Open Questions For Next Run

1. Should state-review artifacts live under `packages/evals/fixtures`, `packages/evals/artifacts`, root `artifacts/evals`, or generated temp output with checked-in golden files?
2. Should `ActionProposalReview` contain both `originalObservationContract` and `currentObservationContract`, or should the current view plus evaluation be sufficient?
3. What schema name should represent the persisted artifact: `StateReviewArtifact`, `ActionProposalReviewArtifact`, or `PreActionStateReview`?
4. Should `subject_mismatch` be severity `fail` even in warn mode, preparing for `block_on_authority_or_stale`?
5. Which layer should own artifact writing: `@pm/agent-state`, `@pm/evals`, or the ArrowHedge capability package?
6. How should DB-backed and fixture-backed artifacts avoid brittle timestamp ordering while still proving freshness behavior?
7. Can CollabSim/ALMANAC concepts become lightweight eval labels without adding LLM-based judges?
8. Should future observation contracts include tool identity/origin/lifecycle fields now, or wait until a capability-manifest review phase?
9. How should repeated warn-first failures become an escalation artifact without prematurely blocking mutations?
10. Which project-management metric best maps to handoff artifacts: time to correct next action, source-owner resolution time, or missed-precondition rate?

## 9. Recommended Next Code Slice

Build the artifact-backed ArrowHedge state-review harness before broader policy work:

1. Add `subject_mismatch` validation in `@pm/agent-state`.
2. Add a non-tautological proposal-review helper that accepts an explicit original `ObservationContract`.
3. Add `asOf`/`evaluatedAt` support to ArrowHedge current-state view generation.
4. Define a JSON `StateReviewArtifact` shape in `@pm/evals` and generate artifacts for the eight ArrowHedge fixtures.
5. Update eval metrics/tests so assertion and proposal-review metrics are computed from artifacts.
6. Keep the maturity label at `detected_warning` and explicitly assert `execution.allowed === true` and `execution.blocking === false`.

This keeps the implementation aligned with the research: make state review a repeatable artifact that can sit directly before agent action execution, while preserving the current warn-first boundary until configurable policy modes are real.

## Source Inventory Added In v03

- CollabSim: https://arxiv.org/abs/2606.06399
- ALMANAC: https://arxiv.org/abs/2606.06388
- MAGE / memory as execution state: https://arxiv.org/abs/2606.06090
- MemGate / trustworthy memory search: https://arxiv.org/abs/2606.06054
- PACT action-state communication: https://arxiv.org/abs/2606.05304
- WebMCP tool-surface poisoning: https://arxiv.org/abs/2606.06387
- HarnessFix: https://arxiv.org/abs/2606.06324
- ToolMaze: https://arxiv.org/abs/2606.05806
- TRIAD guardrail feedback: https://arxiv.org/abs/2606.05805
- Self-Correction Illusion: https://arxiv.org/abs/2606.05976
- Bounded Autonomy for Enterprise AI: https://arxiv.org/abs/2604.14723
- Managing Uncertainty in LLM-based MAS: https://arxiv.org/abs/2602.23005
- Communication-as-Control: https://ojs.aaai.org/index.php/AAAI-SS/article/view/42528
- Endsley situation awareness theory: https://journals.sagepub.com/doi/10.1518/001872095779049543
- Endsley situation awareness measurement: https://journals.sagepub.com/doi/abs/10.1518/001872095779049499
- COP to common situational understanding: https://www.sciencedirect.com/science/article/pii/S0925753521002253
- TMS in IS development teams: https://www.sciencedirect.com/science/article/pii/S0263786311001050
- TMS in OSS project teams: https://www.sciencedirect.com/science/article/pii/S026840121300011X
- IT project escalation process: https://www.researchgate.net/publication/229522615_Information_Technology_Project_Escalation_A_Process_Model
- Project implementation under uncertainty: https://www.sciencedirect.com/science/article/pii/S0263786317300601

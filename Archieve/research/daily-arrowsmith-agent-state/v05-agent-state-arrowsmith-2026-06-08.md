# v05 Agent-State Arrowsmith - 2026-06-08

Date: 2026-06-08 UTC
Local run clock: 2026-06-07 21:33 CDT
Method: Arrowsmith A-B-C continuation, prior-version claim audit, repo-grounded implementation check, recent primary-source search, project-management bridge search
Status: fifth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md`

Local context read in required order:

1. `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md`
2. `research/daily-arrowsmith-agent-state/index.md`
3. `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md`
4. `Changelog.md`
5. Current implementation surfaces:
   - `packages/agent-state/src/index.ts`
   - `packages/agent-state/src/index.test.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.integration.test.ts`
   - `packages/evals/src/schema.ts`
   - `packages/evals/src/metrics.ts`
   - `packages/evals/src/arrowhedge.ts`
   - `packages/continuity/src/interfaces.ts`
   - `packages/continuity/src/evidence-linked-payload.test.ts`

Current strongest thesis:

> pm-substrate is the governed operational-state layer between statistical prediction and valid action. v04 correctly moved the frontier from "construct a state-review artifact" to "make artifacts durable evidence streams." v05 sharpens the shape of that evidence stream: a safe pre-action review must cover not only observation-to-action stale reads, but also action-to-feedback drift, feedback-to-observation drift, progressively disclosed constraints, typed safe aborts, and cross-step evidence links. The next code slice should therefore persist ArrowHedge review artifacts as deterministic JSON, derive eval metrics from those artifacts, and classify each fixture by temporal misalignment phase and invariant class before making any mutation-blocking claim.

## 1. Delta From Prior Version

v04 remains accurate on the implementation boundary. Local code still has pure `CurrentStateView`, `ObservationContract`, `ObservationContractEvaluation`, `ReadSetValidationDecision`, `ActionProposalReview`, `StateReviewArtifact`, ArrowHedge artifact construction, canonical artifact hash verification, and artifact metrics. No durable JSON artifact writer/reader, generated golden artifact corpus, artifact-to-eval-event linkage, observed read-set lane, or invariant-class policy matrix was found in this run.

The main v05 change is a sharper failure taxonomy from recent agent benchmarks. AdaPlanBench adds progressively disclosed world/user constraints; TIDE temporal state misalignment splits state drift into observation-to-action, action-to-feedback, and feedback-to-observation; TRACE and DuMate-DeepResearch emphasize long-horizon cross-step evidence and explicit tool-decision traces; H-CSC contributes typed commit vs typed safe abort; OPENPATH shows a supervisor-specialist pattern where LLM orchestration is separated from deterministic domain algorithms; Tree-of-Experience and MMPO strengthen structured experience and belief-clarity bridges while preserving the warning that memory optimization is not source authority.

Project-management research also sharpened the implementation lens. Coordination is not just information sharing. Okhuysen and Bechky's accountability, predictability, and common understanding; Faraj and Sproull's expertise coordination; Lewis's transactive-memory measurement; and common operational picture research all point to a PM-state artifact that must say who/source owns a fact, who can act, what changed, what is stale, and how a successor should revalidate before handoff.

Corrected or extended from v04:

- `StateReviewArtifact` remains implemented only as an in-memory pure object. The open proof is persisted/exported artifacts with schema/replay/eval linkage.
- Existing read-set validation mostly covers observation-to-action currentness. Recent TIDE-style failures require explicit action-to-feedback and feedback-to-observation fixtures.
- Blocking mode exists as a pure all-or-nothing mode, but targeted invariant-class blocking does not yet exist.
- Semantic consensus/commit protocols are useful bridge vocabulary, but not sufficient authority for pm-substrate unless tied to source refs, workflow position, tenant/subject identity, and deterministic policy.
- Memory belief clarity is useful as a diagnostic, but it cannot replace artifact-backed current-state review.

## 2. New Sources Reviewed

| Source | Authors | Date | Link | Source type | Relevance to pm-substrate |
| --- | --- | --- | --- | --- | --- |
| AdaPlanBench: Evaluating Adaptive Planning in Large Language Model Agents under World and User Constraints | Jiayu Liu, Cheng Qian, Zhenhailong Wang, Bingxuan Li, Jiateng Liu, Heng Wang, Jeonghwan Kim, Yumeng Wang, Xiusi Chen, Yi R. Fung, Heng Ji | 2026-06-04 | https://arxiv.org/abs/2606.05622 and https://github.com/JiayuJeff/AdaPlanBench | arXiv preprint plus official repo/dataset | Strong bridge for progressively disclosed constraints, repeated violation metrics, and fixture outputs as run artifacts. Maps directly to workflow/user-constraint invalidation. |
| Hierarchical Certified Semantic Commitment for Byzantine-Resilient LLM-Agent Collaboration | Haoran Xu, Lei Zhang, Iadh Ounis, Xianbin Wang | 2026-06-05 | https://arxiv.org/abs/2606.07316 | arXiv preprint | Useful for typed `semantic_commit`, `verdict_commit`, and safe abort vocabulary. Downgraded as authority proof because embedding/semantic consensus is not source authority. |
| TRACE: Trajectory Reasoning through Adaptive Cross-Step Evidence Aggregation for LLM Agents | Vijitha Mittapalli et al. | 2026-06-05 | https://arxiv.org/abs/2606.07054 | arXiv preprint | Supports cross-step evidence aggregation for long-horizon monitoring. Strengthens warning-to-evidence links and trajectory-level artifact metrics. |
| DuMate-DeepResearch: An Auditable Multi-Agent System with Recursive Search and Rubric-Grounded Reasoning | Lingyong Yan et al. | 2026-06-05 | https://arxiv.org/abs/2606.07299 | arXiv technical report | Reinforces explicit traceability for intermediate decisions and tool invocations. Leaderboard claims remain benchmark-specific. |
| Tree-of-Experience: A Structured Experience-Management Solution for Self-Evolving Agents under Low-Repetition and Implicit-Reward Environments | Zihao Deng et al. | 2026-06-05 | https://arxiv.org/abs/2606.06960 | arXiv preprint | Finance-adjacent benchmark where general experience mechanisms do not always beat no-experience baselines. Supports structured validation/update of experience, not free-form memory. |
| OPENPATH: A Supervisor-Specialist Agent System for Personalized, Accessible, and Multi-stop Urban Trip Planning | Ziyang Xiong, He Zong, Zhiyuan Xue, Manxi Wu | 2026-06-05 | https://arxiv.org/abs/2606.07486 | arXiv preprint | Shows a useful split: LLM agents orchestrate, classical algorithms enforce optimization/accessibility over curated data. Maps to deterministic substrate gates. |
| An End-to-End Encrypted Control Pipeline for Multi-Agent Coordination via CKKS Homomorphic Encryption | Sai Sandeep Damera, Maria Charitidou, Asim Zoulkarni, John S. Baras | 2026-06-05 | https://arxiv.org/abs/2606.07375 | arXiv preprint | Non-LLM bridge for privacy-preserving sensing, state estimation, propagation, and consensus control. Suggests redaction/privacy should be part of persisted artifact design. |
| TIDE: A Benchmark for Temporal State Misalignment in Language Agents | Anonymous ACL ARR submission | 2026-05-26, modified 2026-06-02 | https://openreview.net/forum?id=fNBMsYXORG | OpenReview primary submission | Directly names observation-to-action, action-to-feedback, and feedback-to-observation misalignment. Strong eval-shape input for ArrowHedge fixtures. |
| When Users Don't Ask: Benchmarking Context-Driven Memory Retrieval in Conversational Agents | Anonymous ACL ARR submission | 2026-05-26, modified 2026-06-02 | https://openreview.net/forum?id=jaAA72U0tr | OpenReview primary submission | Shows retrieval recall does not fully translate into response quality, especially under implicit/composed queries. Reinforces artifact-backed response grounding. |
| TIDE: Proactive Multi-Problem Discovery via Template-Guided Iteration | Soyeong Jeong, Jinheon Baek, Minki Kang, Sung Ju Hwang | 2026-06-03 | https://arxiv.org/abs/2606.04743 | arXiv preprint | Useful for proactive hidden-problem discovery over documents/tools/code, but must be downgraded unless discovered issues are backed by source refs and proposal reviews. |
| Meta-Cognitive Memory Policy Optimization for Long-Horizon LLM Agents | Ziyan Liu, Zhezheng Hao, Yeqiu Chen, Hong Wang, Jingren Hou, Ruiyi Ding, Yongkang Yang, Wence Ji, Wei Xia, Feng Liu | 2026-05-28 | https://arxiv.org/abs/2605.30159 | arXiv preprint | Belief entropy/belief preservation is a useful memory-quality metric. It does not establish source authority or workflow validity. |

## 3. Older Sources Added

| Source | Authors | Year | Link | Mechanism extracted |
| --- | --- | --- | --- | --- |
| Distributed Snapshots: Determining Global States of Distributed Systems | K. Mani Chandy, Leslie Lamport | 1985 | https://dblp.org/rec/journals/tocs/ChandyL85 and https://doi.org/10.1145/214451.214456 | A consistent global state in an asynchronous system is not the same as a bundle of local views. For pm-substrate, review artifacts should record enough causal markers to replay a coherent snapshot, not just the final prompt. |
| On Optimistic Methods for Concurrency Control | H. T. Kung, John T. Robinson | 1981 | https://doi.org/10.1145/319566.319567 and https://www.eecs.harvard.edu/~htk/publication/1981-tods-kung-robinson.pdf | Read phase -> validation phase -> write phase is the database ancestor of read-set validation before action. |
| Sagas | Hector Garcia-Molina, Kenneth Salem | 1987 | https://www.cs.princeton.edu/research/techreps/598 and https://doi.org/10.1145/38714.38742 | Long-lived work should be decomposed into steps with compensating actions. For agents, irreversible side effects need explicit policy, refresh, escalation, or compensation metadata. |
| Measuring Transactive Memory Systems in the Field | Kyle Lewis | 2003 | https://pubmed.ncbi.nlm.nih.gov/12940401/ | Transactive memory has measurable specialization, credibility, and coordination. PM artifacts should encode source steward, authority credibility, and coordination state. |
| Coordinating Expertise in Software Development Teams | Samer Faraj, Lee Sproull | 2000 | https://pubsonline.informs.org/doi/10.1287/mnsc.46.12.1554.12072 | Expertise coordination means knowing where expertise is located, where needed, and bringing it to bear. This maps to source/owner/ref escalation fields. |
| Coordination in Organizations: An Integrative Perspective | Gerardo A. Okhuysen, Beth A. Bechky | 2009 | https://doi.org/10.1080/19416520903047533 | Coordination mechanisms create accountability, predictability, and common understanding. COP artifacts should produce these conditions, not only display data. |
| From common operational picture to common situational understanding | Ragnhild Steen-Tveit, Bjorn Erik Munkvold | 2021 | https://doi.org/10.1016/j.ssci.2021.105381 | A COP is a basis for action and shared understanding across actors with different mandates. pm-substrate should measure agreement on binding source, owner, blocker, and valid next action. |
| Multiple Vantage Points of the Common Operational Picture | Michael D. McNeese et al. | 2006 | https://doi.org/10.1177/154193120605000354 | COP design has structure, representation, process, and management layers. This supports treating ArrowHedge artifacts as process/evidence objects, not only UI snapshots. |

## 4. Arrowsmith Bridge Table

| Agent-state problem | Bridge concept | Source discipline | Supporting papers | Implementation implication | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| Agent acts after state changes between observation and proposal | Observation-to-action temporal misalignment | LLM agent evals, OCC | TIDE temporal misalignment; Kung and Robinson; STALE | Persist original observation contract and read set; validate against current view at proposedAt; classify fixture phase as `observation_to_action`. | High | Plain prompt/RAG control matches artifact-backed review on stale read and projection drift fixtures. |
| Tool feedback is treated as valid after the world changes during/after action | Action-to-feedback temporal misalignment | Agent evals, distributed workflows | TIDE temporal misalignment; Sagas | Add fixture where proposal is reviewed, action is simulated, then feedback refers to a superseded state; require post-action revalidation before continuity write. | Medium-high | Existing pre-action review catches all feedback-drift cases without post-action artifact. |
| A successor agent resumes from feedback or memory that is no longer valid | Feedback-to-observation temporal misalignment | Memory agents, handoffs, PM coordination | TIDE temporal misalignment; LOCOMO-CONV; MMPO; Handoff Debt from prior run; Lewis 2003 | Continuity checkpoints should cite artifact id/hash, validUntil, supersedes/contradictedBy, and revalidation requirement. | High | Continuity summary without artifact lineage performs as well under implicit invalidation and handoff fixtures. |
| Constraints are revealed progressively and agents repeat violations | Progressive constraint disclosure | Interactive planning benchmarks | AdaPlanBench official repo/paper | Expand ArrowHedge fixtures with staged constraints: authority mismatch first, then workflow/risk/user policy; count repeated violation codes. | High | One-shot full-spec fixture catches the same failures as progressive-disclosure fixture. |
| Multi-agent agreement is mistaken for authority | Typed semantic finality vs source authority | BFT, LLM multi-agent collaboration | H-CSC; BFT prior art | Add `semantic_consensus` only as evidence/provenance; do not allow it to override source authority, tenant, subject, workflow, or read-set validation. | Medium-high | Semantic commit with wrong authoritative source is safe to treat as allowed in high-consequence fixture. |
| Long-horizon failures require evidence across distant steps | Cross-step evidence aggregation | Agent monitoring/security, provenance | TRACE; DuMate-DeepResearch; W3C PROV from prior run | State-review artifacts need warning-to-evidence refs and trajectory/run ids; eval metrics should count orphan warnings and cross-step coverage. | Medium-high | Single-step warning summaries give equal root-cause diagnosis time and equal regression detection. |
| Memory quality degrades before task outcome fails | Belief clarity / belief entropy | POMDP memory, agent memory optimization | MMPO; STALE; LOCOMO-CONV | Add diagnostic metric for memory/continuity payload ambiguity, but keep authority validation external. | Medium | Belief clarity metrics predict no stale-memory interventions and artifact lineage adds no value. |
| Agent discovers hidden issues but cannot prove or prioritize them | Proactive multi-problem discovery | Agentic workspace/code discovery | TIDE proactive multi-problem discovery | Proactive findings should become proposed `StateReviewArtifact` warnings with source refs and action proposals, not direct actions. | Medium | Proactive discoveries without source refs have equal precision and action validity. |
| Supervisor-specialist agents rely on LLM judgment for constraints | Deterministic specialist enforcement | Transportation, operations research | OPENPATH; AdaPlanBench | Keep LLM as proposer/orchestrator; enforce accessibility/risk/workflow constraints through deterministic validators. | Medium-high | LLM-only constraint checking matches deterministic validators under authority and stale-state fixtures. |
| Durable artifacts may leak sensitive state | Privacy-preserving state estimation and redaction | Control theory, cryptography, observability | CKKS encrypted control pipeline; prior OAuth/HTTP signature sources | Artifact persistence needs redaction policy, secret boundary, retention, and optional hash-only refs for sensitive sources. | Medium | Full-state persisted JSON has no additional privacy/security risk over in-memory review objects. |
| Project dashboard exists but actors still disagree | Common situational understanding | Project management, emergency management, team cognition | Okhuysen/Bechky; Faraj/Sproull; Lewis; COP papers | PM COP eval should measure agreement on binding source, owner, blocker, and valid next action after artifact exposure. | High for PM bridge, Medium for agent transfer | COP artifact exposure does not improve agreement vs chat transcript or generic dashboard. |
| Long-lived workflow cannot be made atomic | Saga decomposition and compensating actions | Databases, workflow systems | Garcia-Molina and Salem | Add policy metadata for irreversible vs compensatable actions; block/refresh/escalate should depend on action consequence. | Medium-high | Same policy is adequate for reversible note updates and irreversible external side effects. |

## 5. Claim Ledger

| Claim | Status | v05 evidence and correction |
| --- | --- | --- |
| LLM weights, prompt context, RAG, memory, and chat are not operational state. | Confirmed | New memory and planning sources keep showing failures under stale, implicit, progressive, or temporal state changes. |
| `StateReviewArtifact` exists in repo code. | Confirmed | Local `@pm/agent-state` defines `StateReviewArtifact`, canonical hash, event envelope, trace context, related objects, and provenance links. |
| Persisted/exported review artifacts exist. | Still speculative / not found | No JSON artifact writer/reader, golden fixture corpus, or schema validation path was found. |
| Existing read-set validation fully covers temporal state misalignment. | Revised | It covers observation-to-action style stale reads well. TIDE adds action-to-feedback and feedback-to-observation phases that need fixtures and probably new artifact stages. |
| `ActionProposalReview` should be created. | Confirmed as primitive | Already exists. Next work should serialize and evaluate it as an artifact, not recreate the type. |
| Warn-first review means mutation blocking is implemented. | Contradicted | Code has advisory default and a pure blocking mode, but no external mutation gate or targeted invariant policy. |
| Semantic consensus between agents can establish authority. | Downgraded | H-CSC is useful for typed commit/abort and provenance. It does not replace source authority, workflow state, tenant, subject, or read-set validation. |
| Memory optimization can solve stale state. | Downgraded | MMPO and LOCOMO-CONV sharpen memory quality and belief clarity, but they still do not provide source authority or invalidation gates. |
| Proactive issue discovery can become direct action. | Downgraded | TIDE-style hidden problem discovery should produce evidence-linked warnings/proposals first. |
| Project management maps to shared operational cognition. | Confirmed | PM/team sources converge on accountability, predictability, common understanding, expertise location/need, and common situational understanding as mechanisms. |
| Common operating picture is a dashboard. | Revised | COP should be treated as a process/evidence/current-state surface that supports decision-making and shared understanding. |
| Research automation must act like a substrate user. | Confirmed | This run fetched/pulled `origin/main`, inspected upstream research/code, and writes a new version plus ledgers instead of overwriting. |

## 6. Implementation Implications

1. **Persist ArrowHedge state-review artifacts before adding new policy.**
   - Add a deterministic export path for `StateReviewArtifact` JSON.
   - Keep artifact hashes stable under canonical serialization.
   - Prefer a fixture directory under `packages/evals` if the artifacts are primarily eval evidence; keep the type definition in `@pm/agent-state`.

2. **Turn observation reports into executable artifact inputs.**
   - Save the original `currentStateView`, `observationContract`, and `ObservationContractEvaluation` alongside the later proposal review.
   - Preserve `observedAt`, `validUntil`, `evaluatedAt`, `generatedAt`, `projectionVersion`, `workflowPosition`, and source refs.

3. **Classify artifact fixtures by temporal phase.**
   - Add metadata such as `temporalMisalignmentPhase: "observation_to_action" | "action_to_feedback" | "feedback_to_observation" | "none"`.
   - This prevents overclaiming that stale read validation covers all temporal drift.

4. **Add progressive-constraint fixture sequencing.**
   - Model AdaPlanBench-style incremental disclosure in ArrowHedge: risk freshness, authority source, workflow position, and decision snapshot conflicts should emerge across turns or fixture stages.
   - Track repeated warning codes across attempts.

5. **Separate semantic agreement from authoritative validity.**
   - If multi-agent consensus enters artifacts, encode it as `provenance.links` or related evidence only.
   - Do not let semantic consensus override deterministic authority rules.

6. **Add warning-to-evidence links.**
   - TRACE-style cross-step aggregation implies each warning should name the evidence refs that produced it.
   - Existing related object roles are a start; the next step is direct warning evidence lineage.

7. **Add PM coordination fields only where they affect validity.**
   - Candidate fields: `sourceOwner`, `decisionOwner`, `escalationOwner`, `coordinationRequirementRefs`, and `handoffRequiredBefore`.
   - Avoid turning owner metadata into productivity surveillance.

8. **Keep blocking policy consequence-aware.**
   - Reversible analysis actions can remain advisory.
   - External side effects and irreversible workflow transitions should move toward refresh/block/escalate based on invariant class.

## 7. Testing/Eval Implications

New fixture matrix:

| Fixture | Expected artifact/assertion behavior | Metric |
| --- | --- | --- |
| Accepted/current state | No failed assertions; advisory allowed; hash verifies. | `artifact_schema_validation_rate`, `hashVerificationRate` |
| Stale risk observation | `freshness_window_current` fail/warn plus `stale_read_ref`; advisory allowed in v1. | `assertion_failure_by_code`, `warning_assertion_alignment_rate` |
| Authority mismatch | `authority_rule_matches` fail plus `authority_mismatch`; no mutation-blocking claim unless blocking policy test is explicit. | `authority_mismatch_detection_rate` |
| Missing source refs | `required_source_refs_present` fail plus `missing_read_ref`. | `missing_required_ref_rate` |
| Projection version drift | `projection_version_matches` fail/warn plus `projection_version_mismatch`. | `projection_drift_detection_rate` |
| Workflow position mismatch | `workflow_position_matches` fail/warn plus `workflow_position_mismatch`. | `workflow_position_mismatch_rate` |
| Decision snapshot vs current risk/signal conflict | `current_view_conflict` and warning evidence refs to both decision/risk/signal sources. | `decision_snapshot_conflict_rate` |
| Action-to-feedback drift | Post-action feedback references stale or superseded state; successor artifact requires revalidation. | `action_to_feedback_drift_rate` |
| Feedback-to-observation drift | Continuity/handoff summary cites stale artifact; current review warns before reuse. | `feedback_to_observation_revalidation_rate` |
| Progressive constraint repeat | Same warning code appears across proposal attempts after disclosure. | `constraint_repeated_violation_rate` |

Assertions to add or preserve:

- Every persisted artifact validates against a runtime schema or schema-check helper.
- Import/export round trip preserves `artifactHash`.
- Artifact mutation changes replay verification result.
- Metrics are computed from artifact contents, not scenario labels.
- Read-set warnings align with observation assertion failures.
- Advisory artifacts do not claim mutation blocking.
- DB-backed ArrowHedge projection emits artifact-equivalent reports when `PM_DATABASE_URL` is available.
- Continuity payloads can cite artifact id/hash without making stale memory authoritative.

New metrics queue:

- `temporal_misalignment_phase_coverage`
- `observation_to_action_stale_rate`
- `action_to_feedback_drift_rate`
- `feedback_to_observation_revalidation_rate`
- `constraint_repeated_violation_rate`
- `progressive_constraint_resolution_rate`
- `warning_evidence_link_rate`
- `orphan_warning_rate`
- `artifact_schema_validation_rate`
- `artifact_export_import_fidelity`
- `artifact_to_eval_event_link_rate`
- `common_understanding_delta`
- `expertise_owner_resolution_rate`
- `handoff_revalidation_success_rate`

## 8. Open Questions For Next Run

1. Should persisted state-review artifacts live under `packages/evals/fixtures`, `packages/capability-finance-research-ingest/fixtures`, or a top-level `artifacts/evals` directory?
2. Should the external artifact schema be handwritten JSON Schema, generated from TypeScript, or a runtime validator in `@pm/agent-state`?
3. How should a single artifact represent post-action feedback drift without implying the action was actually executed?
4. Can `EvalEvent.substrateRefs` accept a state-review artifact id/hash without adding a new ref kind, or should `state_review_artifact` become a first-class ref kind?
5. Which invariant classes should block first: tenant mismatch, subject mismatch, authority mismatch, missing required source, stale read, expired observation, workflow mismatch, or multi-object role mismatch?
6. How can PM coordination fields encode source/owner/escalation authority without becoming personal performance scoring?
7. Can a DB-backed ArrowHedge COP projection produce byte-equivalent artifact evidence to fixture-backed generation, or do generated ids/timestamps require canonical normalization?
8. Should warning-to-evidence links be embedded in each `ActionProposalWarning`, or represented as artifact-level provenance links with `role: warning:<code>`?

## 9. Recommended Next Code Slice

Implement a persisted ArrowHedge state-review artifact fixture path in the smallest possible form:

1. Add a deterministic artifact sample builder that emits JSON-safe `StateReviewArtifact` objects for the seven core ArrowHedge cases: accepted/current, stale risk, authority mismatch, missing source refs, projection drift, workflow position mismatch, and decision snapshot vs current risk/signal conflict.
2. Add an import/replay helper that validates schema shape, recomputes `artifactHash`, and converts the artifact into `analyzeStateAssertions()`, `analyzeActionProposalReviews()`, and `analyzeStateReviewArtifacts()` samples.
3. Add focused tests proving expected assertion codes, read-set warning alignment, metrics by code/severity, advisory non-blocking semantics, and export/import hash fidelity.
4. If `PM_DATABASE_URL` is present, add a DB-backed equivalence test that folds ArrowHedge events into the COP projection and emits the same report shape as the fixture path after canonical timestamp/id normalization.

Do not implement mutation blocking in this slice. The next proof is artifact lifecycle and eval derivation. Blocking should wait for a separate invariant-class policy matrix.

## Source Inventory

Recent / newly reviewed:

- AdaPlanBench: https://arxiv.org/abs/2606.05622; official repo: https://github.com/JiayuJeff/AdaPlanBench; dataset linked from repo/Hugging Face.
- H-CSC: https://arxiv.org/abs/2606.07316.
- TRACE cross-step evidence aggregation: https://arxiv.org/abs/2606.07054.
- DuMate-DeepResearch: https://arxiv.org/abs/2606.07299.
- Tree-of-Experience: https://arxiv.org/abs/2606.06960.
- OPENPATH: https://arxiv.org/abs/2606.07486.
- Encrypted multi-agent control pipeline: https://arxiv.org/abs/2606.07375.
- TIDE temporal state misalignment: https://openreview.net/forum?id=fNBMsYXORG.
- LOCOMO-CONV context-driven memory retrieval: https://openreview.net/forum?id=jaAA72U0tr.
- TIDE proactive multi-problem discovery: https://arxiv.org/abs/2606.04743.
- MMPO: https://arxiv.org/abs/2605.30159.

Foundational / older:

- Chandy and Lamport distributed snapshots: https://doi.org/10.1145/214451.214456.
- Kung and Robinson optimistic concurrency control: https://doi.org/10.1145/319566.319567.
- Garcia-Molina and Salem sagas: https://www.cs.princeton.edu/research/techreps/598.
- Lewis transactive memory systems measure: https://pubmed.ncbi.nlm.nih.gov/12940401/.
- Faraj and Sproull expertise coordination: https://pubsonline.informs.org/doi/10.1287/mnsc.46.12.1554.12072.
- Okhuysen and Bechky coordination in organizations: https://doi.org/10.1080/19416520903047533.
- Steen-Tveit and Munkvold common situational understanding: https://doi.org/10.1016/j.ssci.2021.105381.
- McNeese et al. common operational picture vantage points: https://doi.org/10.1177/154193120605000354.

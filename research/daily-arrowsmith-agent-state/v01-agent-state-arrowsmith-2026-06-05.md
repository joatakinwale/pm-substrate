# v01 Agent-State Arrowsmith - 2026-06-05

Date: 2026-06-05
Method: Research Arrowsmith open discovery plus closed bridge checks
Status: first numbered daily continuation
Immediate predecessor read: `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md`
Additional local context read: `research/first-principles-agent-state-interoperability_2026-06-03.md`, `research/local-lab-state-bench-arrowsmith_2026-06-02.md`, `research/cross-disciplinary-state-interoperability-arrowsmith_2026-06-03.md`, `README.md`, `docs/validation.md`, `Changelog.md`

Current strongest thesis:

> LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, or tool-observation state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action.

## One-Paragraph Delta From Previous Version

The 2026-06-04 precursor correctly located the fault line between prediction and action, but it underweighted three mechanisms that make the claim operational: implicit invalidation of stale memory, observation contracts created by tool APIs, and database-style read-set validation before mutation. Today's continuation adds newly found 2026 benchmark sources around stale memory, continuous memory consolidation, observation-contract preservation, stateful enterprise-agent tasks, and live workflow evaluation; strengthens the project-management bridge with shared mental models, transactive memory, and PM complexity evidence; downgrades "RAG/memory update" claims that sound sufficient without provenance and invalidation; and turns the next implementation direction into a measurable `current_state_view + read_set + observation_contract` gate.

## Research Question

How should pm-substrate evolve if the agent-state problem is not merely "agents need memory," but "statistical predictors need governed operational state before their proposals can become valid actions"?

Sub-questions for this pass:

1. Which prior claims are still supported after checking newer memory, workflow-agent, and project-management sources?
2. Which bridge concepts have become stronger since the June 4 note?
3. Which claims should be downgraded because a source only supports retrieval, memory, or benchmark design rather than operational authority?
4. Which implementation implications are now concrete enough for a pm-substrate eval or package contract?

## A/B/C Framing

### A-literature

- LLM agents, agent loops, tool use, RAG, memory agents, multi-agent systems, workflow agents, statistical learning, prompt/context state, and model state.
- Product decision: decide what pm-substrate must supply so existing LLMs can act against current, admissible, source-backed state without model retraining.

### B-bridge concepts

- Partial observability
- Belief state
- State estimation
- Parametric state vs operational state
- Prompt context vs durable state
- Memory invalidation
- Observation contract
- Read-set validation
- Source authority
- Provenance
- Semantic contract
- Workflow invalidation
- Common operating picture
- Shared mental model
- Transactive memory
- Project coordination under complexity

### C-literatures

- POMDPs and control/state estimation
- Database optimistic concurrency control
- Distributed tracing and provenance standards
- Semantic interoperability standards and object-centric event logs
- Workflow-agent and memory-agent benchmarks
- Multi-agent failure attribution
- Project-management, team cognition, human-AI teaming, and organizational memory

### Open discovery run

A -> B extraction from the latest LLM-agent sources produced these new B terms:

- implicit conflict
- state resolution
- premise resistance
- implicit policy adaptation
- consolidated-memory regression
- episodic trace preservation
- observation contract
- temporal validity
- byte-level integrity
- deterministic service-state grading
- pass^5 reliability
- workflow demand drift
- mental model discrepancy

The strongest A -> B -> C bridges are:

- stale memory -> implicit conflict -> belief revision / state invalidation
- tool observations -> observation contract -> API contracts and database validation
- workflow action -> stateful service mutation -> enterprise task grading and read-set validation
- multi-agent failure -> failure attribution -> provenance / trace / workflow causality
- project coordination -> shared mental model and TMS -> common operating picture and operational transactive memory

### Closed bridge checks

Closed checks from the prior version:

- **Prompt context as state:** confirmed weak. Large or well-ordered context can carry observations, but neither POMDP nor QuBE supports treating context as a belief state without explicit state construction.
- **RAG as state:** downgraded. RAG supports non-parametric memory and provenance potential, but STALE and useful-memory regression evidence make plain retrieval/update insufficient for current authority.
- **Tool use as action:** strengthened. ReAct validates the reason/action loop shape, while ContractBench shows tool observations can impose validity and integrity constraints that agents do not reliably preserve.
- **Read-set validation:** strengthened. OCC gives the precise C-literature bridge: actions based on reads need a validation phase before writes.
- **PM layer as shared mental model:** strengthened but still an implementation inference. Team cognition literature supports the value of shared mental models and transactive memory; it does not prove pm-substrate's architecture by itself.

## Source Map

Source labels used below:

- **Primary paper:** peer-reviewed, conference, journal, or canonical research paper.
- **Primary preprint:** arXiv or workshop/preprint source; useful but not peer-reviewed unless otherwise noted.
- **Benchmark/source repo:** benchmark paper, official repo, or project documentation.
- **Standard/official docs:** standards body or official project docs.
- **Review:** systematic review, bibliometric review, or survey.
- **Vendor/professional context:** useful current industry context, not proof.
- **Weak/unverified:** not relied on for core claims.

### A: LLM agents, memory, and workflow agents

1. [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401), 2020, primary paper, High for parametric/non-parametric memory distinction. Supports the claim that parametric knowledge has update/provenance limits; does not prove retrieval is operational authority.
2. [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629), 2023 ICLR camera-ready, primary paper, High for reason/action/observation loop framing. It supports interleaved reasoning and tool observations, not governed state.
3. [QuBE: Question-based Belief Enhancement for Agentic LLM Reasoning](https://aclanthology.org/2024.emnlp-main.1193/), EMNLP 2024, primary paper, High for partial-observability/belief-state bridge. It is not a business-state substrate paper.
4. [MemoryAgentBench](https://openreview.net/pdf?id=DT7JyQC3MR), ICLR 2026 conference paper, benchmark, High for memory-agent competencies: accurate retrieval, test-time learning, long-range understanding, selective forgetting.
5. [STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?](https://arxiv.org/abs/2605.06527), submitted 2026-05-07, primary preprint/benchmark, Medium. New and directly relevant, but not peer-reviewed.
6. [Useful Memories Become Faulty When Continuously Updated by LLMs](https://arxiv.org/abs/2605.12978), submitted 2026-05-13, primary preprint, Medium. Strong mechanism for raw episodes vs lossy consolidation; not peer-reviewed.
7. [Evaluating Memory Structure in LLM Agents / StructMemEval](https://arxiv.org/abs/2602.11243), submitted 2026-02-11, revised 2026-05-22, primary preprint, Medium. Useful bridge for ledgers, to-do lists, trees; work in progress.
8. [ContractBench: Can LLM Agents Preserve Observation Contracts?](https://arxiv.org/abs/2605.17281), submitted 2026-05-17, primary preprint/benchmark, Medium. Strong new term: observation contract. Not peer-reviewed.
9. [STATE-Bench GitHub repository](https://github.com/microsoft/STATE-Bench), official benchmark repo, latest visible release v0.7.0 on 2026-05-28, Benchmark/source repo, Medium. Good for enterprise stateful task eval shape; synthetic data caveat.
10. [Microsoft STATE-Bench release post](https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/), 2026-05-19, official docs/vendor context, Medium for benchmark scope, not independent evidence.
11. [Claw-Eval-Live](https://arxiv.org/abs/2604.28139), submitted 2026-04-30, primary preprint/benchmark, Medium. Supports live workflow eval with service state, audit logs, and artifacts; not peer-reviewed.
12. [Claw-Eval-Live project page](https://claw-eval-live.github.io/), official benchmark docs, 2026 v1.0, Benchmark/source docs, Medium.

### B/C: State estimation, concurrency, provenance, and interoperability

1. [Planning and acting in partially observable stochastic domains](https://www.sciencedirect.com/science/article/pii/S000437029800023X), Artificial Intelligence 1998, primary paper, High. Direct bridge from partial observation to action selection.
2. [A New Approach to Linear Filtering and Prediction Problems](https://www.cs.unc.edu/~welch/kalman/media/pdf/Kalman1960.pdf), Kalman 1960, primary paper, High. Foundational for separating observation from estimated state.
3. [Optimistic Methods for Concurrency Control](https://www.cs.cmu.edu/afs/cs/academic/class/15712-f08/www/readings/kung81.pdf), Kung and Robinson 1981, primary paper, High. Gives read/validation/write phase structure for stale-read mutation problems.
4. [Improving Optimistic Concurrency Control Through Transaction Batching and Operation Reordering](https://www.vldb.org/pvldb/vol12/p169-ding.pdf), PVLDB 2018, primary paper, Medium-high. Useful modern OCC background; not necessary for the core thesis.
5. [W3C PROV Overview](https://www.w3.org/TR/prov-overview/), W3C 2013, standard/official docs, High for provenance vocabulary, validation, derivation, and trustworthiness assessment.
6. [W3C Trace Context](https://www.w3.org/TR/trace-context/), W3C Recommendation 2021, standard/official docs, High for cross-service context propagation; does not provide business authority.
7. [OCEL 2.0 Specification](https://www.ocel-standard.org/specification/overview/), 2024 standard/project docs, High for object-centric event-log framing.
8. [GS1 EPCIS 2.0.1](https://ref.gs1.org/standards/epcis/2.0.1/), GS1 standard, ratified 2022, High for object-centered visibility events.
9. [FHIR R5](https://hl7.org/fhir/R5/), HL7 standard, current permanent version generated 2023-03-26, High for resources, profiles, implementation guides, provenance/audit/workflow surfaces.
10. [OpenLineage docs](https://openlineage.io/docs/), official docs, version 1.48.0 visible on 2026-06-05, High for lineage event metadata pattern; not a workflow authority system.
11. [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0.html), official spec, High for capability/interface contract shape.

### C: Multi-agent failure and project management

1. [Why Do Multi-Agent LLM Systems Fail?](https://openreview.net/pdf?id=fAjbYBmonr), NeurIPS 2025 Datasets and Benchmarks track PDF, primary benchmark paper, High for MAS failure taxonomy and failure clusters.
2. [Which Agent Causes Task Failures and When?](https://openreview.net/forum?id=GazlTYxZss&noteId=ZxWlcagoVI), ICML 2025 spotlight poster, primary paper, High for failure attribution gap. Best method reported 53.5% agent identification and 14.2% step pinpointing on the visible OpenReview abstract, so this supports substrate provenance but also warns attribution remains hard.
3. [Team Member Shared Mental Models](https://journals.sagepub.com/doi/abs/10.1177/154193129103501917), 1991, primary/theory paper, Medium-high. Supports SMM as a teamwork mechanism, not a software architecture proof.
4. [Knowledge and Performance in Knowledge-Worker Teams](https://pubsonline.informs.org/doi/10.1287/mnsc.1040.0257), Management Science 2004, primary empirical paper, High for TMS-performance link in knowledge-worker teams.
5. [Teamwork in project management: Mapping AI as mediator with triangulated bibliometrics](https://www.sciencedirect.com/science/article/pii/S2444569X25002537), 2025, review/bibliometric, Medium-high. Supports coordination under uncertainty, SMM/TMS, and trust/psychological safety as recurring PM mediators.
6. [PMI Pulse of the Profession 2026 press release](https://www.pmi.org/about/press-media/2026/pulse-why-complex-projects-fail-best-practices-are-not-enough-system-thinking), 2026-05, vendor/professional context, Medium for current PM complexity framing; not independent research proof.
7. [Are you with me? A Framework for Detecting Mental Model Discrepancies in Task-Based Team Dialogues](https://arxiv.org/abs/2605.03149), submitted 2026-05, primary preprint, Low-medium. Useful for classifying unsupported beliefs, false beliefs, contradictions, and omissions; not yet peer-reviewed.
8. [Toward Agentic Software Project Management](https://arxiv.org/abs/2601.16392), submitted 2026-01-23, accepted AGENT workshop at ICSE 2026 per arXiv note, Low-medium. Useful roadmap context; not direct architecture evidence.
9. [A systematic review of generative AI usage for IT project management](https://arxiv.org/abs/2604.21958), submitted 2026-04-23, review preprint, Low-medium. Supports that AI-PM research is exploratory and prompt-heavy, so pm-substrate should avoid overclaiming current PM-agent maturity.

## Prior-Version Claim Audit

| Prior claim | Status | Change made today | Why |
| --- | --- | --- | --- |
| The state problem starts when a statistical predictor is promoted into an actor without governed current state. | High | Kept and strengthened. | POMDP/QuBE support partial-observability discipline; ContractBench and STATE/Claw sources show action-facing failures need external validation. |
| Model weights are parametric state, not operational state. | High | Kept. | RAG paper explicitly separates parametric and non-parametric memory and calls out update/provenance issues. |
| Prompt context is a read view, not state. | High | Kept. | QuBE strengthens this: belief state needs construction under partial observability; raw observations in context can derail reasoning. |
| Memory/RAG state can be stale or unauthoritative. | High | Kept and sharpened. | STALE adds implicit conflict; Useful Memories adds consolidation regression; MemoryAgentBench adds selective forgetting. |
| Tool mutation requires read-set freshness. | High | Strengthened from hypothesis to core implementation implication. | OCC provides the read/validate/write bridge; ContractBench adds observation validity/integrity constraints. |
| Common operating picture is the product surface of belief/current state. | Medium-high | Kept, with project-management qualification. | PM and team-cognition sources support shared cognition/coordination, but do not prove any exact UI or dashboard architecture. |
| RAG helps solve stale model knowledge. | Medium | Downgraded if stated alone. | RAG helps update/provenance relative to model weights, but STALE shows updated evidence can still fail to invalidate beliefs or downstream behavior. |
| Bigger memory/context is enough for long-horizon agent state. | Reject | Rejected explicitly. | STALE uses contexts up to 150K tokens; memory invalidation remains hard. |
| Continuous memory consolidation is a safe default. | Reject/Low | Newly rejected as a default. | Useful Memories reports degradation under continuous LLM-written consolidation; raw episodes should stay first-class evidence. |
| Multi-agent chat is a sufficient coordination substrate. | Reject | Kept rejected. | MAST and failure-attribution work show conversation history loss, verification gaps, and attribution difficulty. |
| Biological quorum/stigmergy analogies prove business authority design. | Low | Still downgraded. | Useful metaphor for substrate-as-environment, but no direct authority proof. |
| STATE-Bench was only a target category signal. | Medium | Updated/stale claim corrected. | STATE-Bench now has an official release post and public GitHub repo; still synthetic/benchmark docs rather than peer-reviewed proof. |

### Added findings

1. **Observation contracts are a new high-value bridge.** Tool outputs can create constraints that are temporal (`validUntil`) and byte-level (`integrityHash`), not merely textual facts.
2. **Memory invalidation needs premise resistance.** A stale premise embedded in a user query can cause an agent to accept the wrong state even when newer evidence is retrievable.
3. **Raw episodes must survive summaries.** Continuity should preserve source episodes/events as first-class evidence and gate consolidation/summarization.
4. **Enterprise workflow benchmarks now measure stateful service mutations.** STATE-Bench and Claw-Eval-Live support eval scenarios where success is grounded in database/service/workspace state, not only answer quality.
5. **Project-management AI research remains early.** The best PM bridge is not "AI PM replaces PM"; it is "AI changes coordination infrastructure and shared cognition under complexity."

### Modified findings

1. Replace "memory lifecycle" with **memory invalidation and adjudication lifecycle**.
2. Replace "tool provenance" with **tool observation contract + provenance + read-set validation**.
3. Replace "dashboard/COP" with **shared operating model that exposes current state, authority, missing sources, contradictions, owner, and next valid actions**.

### Downgraded findings

1. RAG-only claims are Medium at best unless the retrieved record has freshness, authority, provenance, and invalidation metadata.
2. LLM-assisted semantic mapping is Medium/Low as authority; it is useful as proposal generation only.
3. Project-management AI roadmap papers are Low/Medium until supported by empirical agent traces and measurable workflow outcomes.

### Removed or rejected findings

No prior source is removed from the corpus, but these bridges are rejected as architecture claims:

- "Model weights are the agent's memory."
- "A bigger context window solves state."
- "RAG solves state."
- "Continuous memory rewrite is always improvement."
- "Protocol/tool invocation alone provides shared operational truth."
- "Chat among agents is a common operating picture."

### Newly stale claims

1. The June 2 note's STATE-Bench phrasing should be updated from "useful and current but not peer-reviewed yet" to "official public benchmark/repo exists as of May 2026, still not treated as peer-reviewed proof."
2. MAST should be treated as stronger than an informal project page now that a NeurIPS 2025 Datasets and Benchmarks PDF is visible.
3. Any "memory-agent benchmark mainly tests retrieval/update" phrasing is stale: 2026 sources now separately test structure, implicit invalidation, and consolidation regression.

## Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LLM output is promoted from prediction to action without current state | Partial observability and belief state | POMDP, QuBE, ReAct | High | Agent reliability improves when model calls receive an explicit current-state/belief view rather than raw accumulated text. | Define `current_state_view` as a generated read model with source refs, authority, missing sources, conflicts, freshness, and admissible actions. | `stale_action_rate`, `partial_observation_rate`, `workflow_invalid_transition_rate` | Plain prompt context matches structured state view on stale/conflicting workflows. | Over-structuring can hide uncertainty if confidence/freshness is fake. |
| Model weights are stale relative to live operations | Parametric vs non-parametric memory | RAG, statistical learning | High | Treat model output as a prior/proposal, never as current authority. | High-consequence actions must cite current substrate/source refs, not only model text. | `evidence_coverage`, `source_authority_violation_rate` | Model-only arm performs as well as substrate under changed-source scenarios. | Avoid implying model retraining is required; runtime state infrastructure is the target. |
| Retrieved memories can remain behaviorally stale | Implicit conflict and premise resistance | STALE, MemoryAgentBench | Medium-high for mechanism, Medium due preprint | Memory systems need invalidation/adjudication, not just retrieval. | Continuity records need `supersedes`, `invalidates`, `validUntil`, `contradictionStatus`, and downstream affected entities. | `implicit_conflict_detection_rate`, `premise_resistance_rate`, `resume_success_rate` | Retrieval of newer evidence alone matches invalidation-aware continuity. | Wrong invalidation can erase legitimate preferences or create overblocking. |
| Continuous summarization/consolidation can corrupt useful memory | Episodic trace vs consolidated abstraction | Useful Memories preprint, event sourcing | Medium | Raw episodes/events should remain first-class evidence; summaries are derived views. | Store raw tool traces/events/observations; gate memory consolidation and link every summary to source episodes and consolidation policy. | `memory_regression_rate`, `episode_trace_coverage`, `summary_replay_fidelity` | Continuous consolidation improves without degrading under repeated updates. | Compression can hide user intent, constraints, or accountability. |
| Agent memory loses operational structure | Structured memory | StructMemEval, OCEL, EPCIS | Medium | Ledger/list/tree/workflow-native tasks should favor substrate structures over flat vector memory. | Add ledger, to-do, dependency tree, and object-event replay evals. | `structured_memory_success_rate`, `representation_loss_rate` | Flat RAG matches graph/event/workflow memory on structured tasks. | Benchmark tasks can overfit to substrate-native shapes; include realistic counterexamples. |
| Tool observations are treated as plain text | Observation contract | ContractBench, OpenAPI, API docs | Medium-high for bridge, Medium due preprint | Tool outputs often carry constraints that must survive from observation to action. | Add `observation_contract` metadata: `artifactId`, `issuedBy`, `validUntil`, `integrityHash`, `allowedUse`, `sourceInvocationId`. | `observation_contract_violation_rate`, `artifact_integrity_failure_rate`, `expired_artifact_use_rate` | Agents preserve expiry/integrity without substrate metadata under adversarial tool sequences. | Secret-bearing artifacts require privacy/security boundaries and redaction. |
| Agent mutates after reading a stale state view | Read-set validation | OCC, database serializability, workflow gates | High | Every high-consequence mutation should validate that its read set remains current/admissible. | Capability invocations record `readSetRefs`, `readSnapshotAt`, `authorityVersion`, and fail closed on changed binding sources. | `stale_read_rejection_rate`, `false_block_rate`, `workflow_invalid_transition_rate` | Revalidation blocks no bad actions and only adds latency. | Over-aggressive revalidation can deny service or frustrate users; track false blocks. |
| Workflow-agent benchmark success is graded too often as final text | Stateful service/workspace evidence | STATE-Bench, Claw-Eval-Live | Medium | pm-substrate evals should grade final service/workspace state, audit logs, and artifacts. | Extend local-lab evals with deterministic environment assertions and pass^5 reliability. | `state_assertion_pass_rate`, `pass5_reliability`, `audit_log_coverage` | Text-only grading correlates perfectly with state assertions. | Synthetic benchmark data can mislead; label external validity limits. |
| Multi-agent systems fail without attributable causality | Failure attribution and verification | MAST, Who&When, W3C Trace Context | High | Durable actor/tool/step causality should improve root-cause analysis over chat transcripts. | Propagate `workflowRunId`, `capabilityInvocationId`, `actorId`, `sourceRefs`, and `parentEventId` across calls. | `failure_attribution_rate`, `decisive_step_recall`, `replay_fidelity` | Substrate event causality cannot identify failing actor/step better than trace-only logs. | Attribution can become blame theater; use for system repair and accountability, not opaque punishment. |
| Business tool data enters the agent as lossy text | Semantic contract and profile validation | FHIR, EPCIS, OCEL, OpenLineage, OpenAPI | High for standards, Medium as product inference | Tool onboarding should map source records to validated profiles before agent use. | Source schema -> mapping proposal -> deterministic validation -> typed events -> projection -> agent read view. | `mapping_rejection_rate`, `adapter_time_to_first_valid_event`, `representation_loss_rate` | Profile validation still loses decision-critical semantics as often as text ingestion. | Incorrect mapping can encode institutional bias or compliance risk. |
| Teams and agents hold divergent local realities | Shared mental model and transactive memory | SMM, TMS, PM teamwork bibliometrics, PMI context | Medium-high | pm-substrate's PM layer should be a shared operational model, not just task storage. | COP/readiness surfaces should show what is known, who/source owns it, what changed, what is blocked, and what action is valid next. | `state_disagreement_rate`, `mean_time_to_reconcile`, `owner_resolution_time` | Teams still disagree after using substrate-backed COP. | Shared visibility can expose sensitive work patterns; role-based disclosure matters. |
| Human-AI project management is overclaimed | Socio-technical mediator, human-guided orchestration | AI-in-PM SLR, Agentic SPM roadmap, PMI 2026 | Medium/Low | The near-term claim should be governed coordination infrastructure, not autonomous PM replacement. | Keep PM-substrate agents in proposal/recommendation modes with auditable gates for authority-sensitive action. | `human_override_rate`, `consent_before_action_rate`, `benefit_realization_trace_coverage` | Fully autonomous PM agents outperform governed substrate under real multi-stakeholder constraints. | Accountability, consent, and labor impacts require explicit governance. |

## New Or Changed Hypotheses

### H1 - Observation-contract hypothesis

**Claim:** Tool outputs with expiry, identity, byte integrity, permissions, or allowed-use constraints should be modeled as observation contracts. LLMs should not be trusted to preserve those constraints through text alone.

**Implementation implication:** Add a substrate event/profile shape for observation contracts and have capability gates validate contract state before using tool artifacts.

**Metric:** `observation_contract_violation_rate`, split into expiry, integrity, permission, and wrong-artifact failures.

**Falsifier:** In controlled tool-use sequences, model-only or prompt-only agents preserve temporal validity and artifact integrity at the same rate as substrate-gated agents.

### H2 - Premise-resistance hypothesis

**Claim:** Stale state is not only retrieved from memory; it can be smuggled into the next task as a false premise. A current-state substrate should block or reframe such premises.

**Implementation implication:** Add eval tasks where user requests presuppose stale project/customer/tool state, and require agents to correct the premise from authoritative state before action.

**Metric:** `premise_resistance_rate`, `implicit_conflict_detection_rate`.

**Falsifier:** Agents with plain retrieval plus instruction prompting resist stale premises as reliably as substrate-backed state views.

### H3 - Raw-episode preservation hypothesis

**Claim:** Memory summaries and consolidated lessons should never replace raw source episodes/events because summary updates can degrade under repeated consolidation.

**Implementation implication:** Treat continuity summaries as derived projections from immutable event/tool episodes; require summary re-generation from raw evidence after invalidation.

**Metric:** `episode_trace_coverage`, `summary_replay_fidelity`, `memory_regression_rate`.

**Falsifier:** Summary-only memory remains replayable and more accurate than raw-event-derived memory under repeated updates.

### H4 - Read-set validation hypothesis

**Claim:** High-consequence agent actions should have an OCC-like read/validate/write lifecycle: read state, propose action, revalidate read set and authority, then mutate.

**Implementation implication:** Extend capability invocation contracts with `readSetRefs`, `readSnapshotAt`, `authorityVersion`, and `validationPolicy`.

**Metric:** `stale_read_rejection_rate`, `false_block_rate`, `action_after_rebase_success_rate`.

**Falsifier:** Revalidation creates latency/blocks but does not reduce invalid mutations.

### H5 - Shared operational transactive-memory hypothesis

**Claim:** The PM substrate's human value is closer to transactive memory than task management: it should make "who/source knows what, when it changed, and what authority it has" operationally queryable.

**Implementation implication:** Add owner/source authority views and escalation paths to COP scenarios.

**Metric:** `owner_resolution_time`, `state_disagreement_rate`, `mean_time_to_reconcile`.

**Falsifier:** Teams with a normal task board plus chat reconcile as quickly and accurately as teams using substrate state/provenance/COP views.

### H6 - Stateful workflow eval hypothesis

**Claim:** pm-substrate should score agents by final service/workspace state, audit logs, and replayable artifacts, not by final answer alone.

**Implementation implication:** Extend local-lab evals toward STATE/Claw-style tasks with deterministic service-state assertions and repeatability metrics.

**Metric:** `state_assertion_pass_rate`, `pass5_reliability`, `audit_log_coverage`.

**Falsifier:** Text-only grading detects the same failures as deterministic state/audit assertions.

## Project-Management Implications

1. **The PM layer should be framed as shared operational cognition.** Team-cognition sources support the idea that shared mental models and transactive memory help coordination. The product translation is not "AI remembers everything"; it is "the system keeps a current, source-backed model of what the team can safely act on."
2. **Complexity is a coordination problem before it is an intelligence problem.** PMI's 2026 context and PM bibliometrics point toward unclear governance, siloed teams, misaligned objectives, and coordination under uncertainty. pm-substrate should measure whether it reduces disagreement, not just whether it automates tasks.
3. **Human-AI PM claims need humility.** Current agentic PM papers are vision/roadmap-heavy. The defensible near-term claim is proposal generation plus governed execution, with humans retaining accountability for high-consequence choices.
4. **A common operating picture should include social state.** Owner, reviewer, source steward, blocker, consent, escalation path, and decision rights are part of project state, not UI garnish.
5. **Project success/failure evaluation should include handoff quality.** Handoffs are where stale state, missing authority, and mental-model divergence become operational failures.

## Implementation Implications For pm-substrate

1. **Define `current_state_view`.**
   - Minimum fields: `viewId`, `tenantId`, `asOf`, `projectionVersion`, `sourceRefs`, `observedAt`, `validUntil`, `authorityRule`, `authorityVersion`, `confidenceOrCoverage`, `missingSources`, `conflicts`, `workflowPosition`, `admissibleNextActions`.
   - This is the agent-facing read view. It is not memory and not a prompt transcript.

2. **Add read-set validation to capability invocations.**
   - Minimum fields: `readSetRefs`, `readSnapshotAt`, `authorityVersion`, `validationPolicy`, `validationResult`, `blockedReason`.
   - Validation should run immediately before mutation for authority-gated transitions.

3. **Add `observation_contract` as a first-class concept.**
   - Minimum fields: `artifactId`, `sourceInvocationId`, `issuedBy`, `issuedAt`, `validUntil`, `integrityHash`, `allowedUse`, `redactionPolicy`, `secretBoundary`.
   - This is most useful for presigned URLs, session tokens, OAuth state, temporary exports, quotes, price/risk snapshots, and one-time approvals.

4. **Make continuity summaries derived, not primary.**
   - Store raw events/tool observations as first-class evidence.
   - Store summaries with source episode refs, consolidation policy, generatedAt, invalidation status, and affected entities.

5. **Extend eval taxonomy.**
   - Add fields or labels for `implicit_conflict`, `premise_resistance`, `observation_contract`, `read_set_validation`, `memory_consolidation_regression`, and `state_assertion`.

6. **Use deterministic state assertions.**
   - For local-lab and ArrowHedge-style flows, assert final graph/projection/service state, not only emitted event count or model answer.

7. **Improve COP scenarios.**
   - Add a scenario with two actors, conflicting local truths, one stale artifact, one binding source, one ambiguous owner, and a required valid next action.

8. **Keep LLMs as proposal engines.**
   - LLMs can propose mappings, next actions, summaries, and state questions. Substrate validation decides admissibility.

## Rejected, Weak, Or Stale Bridges

### Reject

1. **Model weights as operational memory.** Not source-addressable, not tenant-scoped, not updateable at action time, and not authority-aware.
2. **Bigger context window as state solution.** Bigger context can still include stale premises and unauthoritative observations.
3. **RAG-only state layer.** Retrieval gives access, not source authority, invalidation, workflow validity, or action gating.
4. **Continuous memory rewrite as default.** New evidence suggests repeated consolidation can degrade useful memory; preserve raw episodes.
5. **Protocol-only interoperability.** Invocation/transport protocols do not by themselves define business truth, provenance, authority, or replay.
6. **Chat transcript as common operating picture.** Chat is evidence at best; it is not a validated current-state surface.

### Weak

1. **Agentic PM as autonomous PM replacement.** Current PM-agent roadmap sources are useful but mostly aspirational. Keep this as future research, not a product claim.
2. **Biological quorum/stigmergy.** Useful metaphor for substrate-as-environment and evidence quorum, but weak as business authority evidence.
3. **LLM semantic mapping as direct integration.** Use LLMs to propose mappings; deterministic validation remains the gate.

### Stale

1. **Memory benchmarks mainly test retrieval.** No longer sufficient. Current sources also test selective forgetting, implicit invalidation, structure, and consolidation regression.
2. **STATE-Bench as only a concept.** It now has an official public repo/release, but still carries synthetic-data and non-peer-reviewed caveats.
3. **MAST as only a project page.** Treat the NeurIPS 2025 D&B paper as the stronger source.

## Metrics And Eval Scenarios To Add

### New metrics

- `observation_contract_violation_rate`
- `expired_artifact_use_rate`
- `artifact_integrity_failure_rate`
- `implicit_conflict_detection_rate`
- `premise_resistance_rate`
- `memory_regression_rate`
- `episode_trace_coverage`
- `summary_replay_fidelity`
- `stale_read_rejection_rate`
- `false_block_rate`
- `state_assertion_pass_rate`
- `pass5_reliability`
- `audit_log_coverage`
- `owner_resolution_time`
- `action_after_rebase_success_rate`

### Eval scenario 1 - Expired observation contract

An agent receives a temporary artifact from a tool, waits through a virtual-clock expiry, and then attempts to use it. Baseline prompt agent likely uses the stale artifact. Substrate arm should block with `expired_artifact`.

Pass criteria:

- Expired artifact is not used.
- Block event includes source invocation, issuedAt, validUntil, attempted action, and remediation path.

### Eval scenario 2 - Byte-integrity observation contract

An agent copies a session/OAuth/state/presigned artifact through an observation-to-action pipeline. Baseline may truncate or modify bytes. Substrate arm validates `integrityHash`.

Pass criteria:

- Correct artifact passes.
- Mutated artifact fails before external side effect.

### Eval scenario 3 - Implicit stale-memory conflict

A project/client preference changes without explicit negation of the old memory. A user later asks a question presupposing the old state. Substrate arm should detect the newer binding state and resist the stale premise.

Pass criteria:

- Agent corrects the premise before action.
- Continuity record marks old memory invalidated/superseded.

### Eval scenario 4 - Continuous consolidation regression

Repeatedly update a project memory summary across 5-10 turns while preserving raw events. Compare summary-only vs raw-event-derived continuity after a contradiction.

Pass criteria:

- Raw-event-derived arm recovers exact current constraint.
- Summary-only arm's error is classified as `memory_consolidation_regression` if it fails.

### Eval scenario 5 - OCC read-set mutation

Agent reads ArrowHedge risk state, proposes a decision, then risk/source authority changes before execution.

Pass criteria:

- Read-set validation rejects action.
- Replan reads current risk state and records changed authority version.

### Eval scenario 6 - COP shared mental model

Two actors have divergent local project states. One has stale tool output, one has current source event. The COP must expose binding source, owner, blocker, and valid next action.

Pass criteria:

- Actors converge on current state.
- Mean time to reconcile and state-disagreement rate are measured.

### Eval scenario 7 - Stateful enterprise task grading

Adapt a STATE-Bench-style task to pm-substrate local-lab: stateful customer/project operation with tool calls, database mutations, and user consent.

Pass criteria:

- Final DB/projection state matches deterministic assertions.
- pass^5 reliability is reported across repeated runs.

## Next-Day Watchlist

1. Check whether ContractBench or STALE released code/datasets after arXiv submission.
2. Inspect STATE-Bench repo docs and dataset shapes directly, especially task schema, state assertions, and agent-learning track.
3. Search for "observation contract" or adjacent terms in API-security, OAuth, presigned URL, and workflow-agent papers.
4. Search backward citations from Kung and Robinson OCC into read-set validation variants that map better to event-sourced/domain workflows.
5. Find stronger primary sources for common operating picture in emergency response/aviation that include measurement, not only conceptual docs.
6. Search human-AI team cognition papers after 2024 that operationalize real-time shared mental model discrepancy detection.
7. Look for process-mining papers linking object-centric event logs to project management and handoff failure.
8. Check whether Claw-Eval-Live/STATE-Bench task distributions include project-management or multi-system business workflows close enough to local-lab scenarios.
9. Revisit pm-substrate code for the smallest implementation target: likely eval taxonomy + read-set metadata, not a full COP UI.

## Source Inventory With Links And Dates

### Primary papers and benchmark papers

- Kaelbling, Littman, Cassandra, "Planning and acting in partially observable stochastic domains," Artificial Intelligence, 1998. Type: primary paper. Link: https://www.sciencedirect.com/science/article/pii/S000437029800023X. Finding strength: High.
- Kalman, "A New Approach to Linear Filtering and Prediction Problems," 1960. Type: primary paper. Link: https://www.cs.unc.edu/~welch/kalman/media/pdf/Kalman1960.pdf. Finding strength: High.
- Kung and Robinson, "Optimistic Methods for Concurrency Control," 1981. Type: primary paper. Link: https://www.cs.cmu.edu/afs/cs/academic/class/15712-f08/www/readings/kung81.pdf. Finding strength: High.
- Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," submitted 2020, NeurIPS 2020. Type: primary paper. Link: https://arxiv.org/abs/2005.11401. Finding strength: High for parametric/non-parametric distinction.
- Yao et al., "ReAct," submitted 2022, ICLR camera ready 2023. Type: primary paper. Link: https://arxiv.org/abs/2210.03629. Finding strength: High for reason/action loop.
- Kim et al., "QuBE," EMNLP 2024. Type: primary paper. Link: https://aclanthology.org/2024.emnlp-main.1193/. Finding strength: High.
- Hu, Wang, McAuley, "MemoryAgentBench," ICLR 2026. Type: benchmark/conference paper. Link: https://openreview.net/pdf?id=DT7JyQC3MR. Finding strength: High.
- Cemri et al., "Why Do Multi-Agent LLM Systems Fail?", NeurIPS 2025 Datasets and Benchmarks PDF visible. Type: benchmark/conference paper. Link: https://openreview.net/pdf?id=fAjbYBmonr. Finding strength: High.
- Zhang et al., "Which Agent Causes Task Failures and When?", ICML 2025 spotlight poster. Type: primary paper. Link: https://openreview.net/forum?id=GazlTYxZss&noteId=ZxWlcagoVI. Finding strength: High for attribution gap.
- Lewis, "Knowledge and Performance in Knowledge-Worker Teams," Management Science, 2004. Type: primary empirical paper. Link: https://pubsonline.informs.org/doi/10.1287/mnsc.1040.0257. Finding strength: High for TMS bridge.
- Converse, Cannon-Bowers, Salas, "Team Member Shared Mental Models," 1991. Type: primary/theory paper. Link: https://journals.sagepub.com/doi/abs/10.1177/154193129103501917. Finding strength: Medium-high.

### Primary preprints and current benchmark preprints

- Chao et al., "STALE," submitted 2026-05-07. Type: primary preprint/benchmark, not peer-reviewed. Link: https://arxiv.org/abs/2605.06527. Finding strength: Medium.
- Zhang et al., "Useful Memories Become Faulty When Continuously Updated by LLMs," submitted 2026-05-13. Type: primary preprint, not peer-reviewed. Link: https://arxiv.org/abs/2605.12978. Finding strength: Medium.
- Shutova et al., "Evaluating Memory Structure in LLM Agents," submitted 2026-02-11, revised 2026-05-22. Type: primary preprint/work in progress. Link: https://arxiv.org/abs/2602.11243. Finding strength: Medium.
- Wang et al., "ContractBench," submitted 2026-05-17. Type: primary preprint/benchmark, not peer-reviewed. Link: https://arxiv.org/abs/2605.17281. Finding strength: Medium.
- Li et al., "Claw-Eval-Live," submitted 2026-04-30. Type: primary preprint/benchmark, not peer-reviewed. Link: https://arxiv.org/abs/2604.28139. Finding strength: Medium.
- Kowalyshyn and Scheutz, "Are you with me?", submitted 2026-05. Type: primary preprint. Link: https://arxiv.org/abs/2605.03149. Finding strength: Low-medium.
- Assalaarachchi et al., "Toward Agentic Software Project Management," submitted 2026-01-23, accepted AGENT workshop at ICSE 2026 per arXiv page. Type: workshop/preprint. Link: https://arxiv.org/abs/2601.16392. Finding strength: Low-medium.
- Anghel and Cioara, "A systematic review of generative AI usage for IT project management," submitted 2026-04-23. Type: review preprint. Link: https://arxiv.org/abs/2604.21958. Finding strength: Low-medium.

### Standards and official docs

- W3C PROV Overview, 2013. Type: standard/official docs. Link: https://www.w3.org/TR/prov-overview/. Finding strength: High for provenance bridge.
- W3C Trace Context, Recommendation 2021. Type: standard/official docs. Link: https://www.w3.org/TR/trace-context/. Finding strength: High for context propagation.
- OCEL 2.0 Specification, 2024. Type: standard/project docs. Link: https://www.ocel-standard.org/specification/overview/. Finding strength: High for object-centric event logs.
- GS1 EPCIS 2.0.1, ratified 2022. Type: standard. Link: https://ref.gs1.org/standards/epcis/2.0.1/. Finding strength: High for object/event visibility vocabulary.
- HL7 FHIR R5, generated 2023-03-26. Type: standard. Link: https://hl7.org/fhir/R5/. Finding strength: High for profiles, resources, implementation guides, provenance/audit/workflow concepts.
- OpenLineage docs, version 1.48.0 visible on 2026-06-05. Type: official docs. Link: https://openlineage.io/docs/. Finding strength: High for lineage event metadata.
- OpenAPI Specification v3.1.0. Type: official spec. Link: https://spec.openapis.org/oas/v3.1.0.html. Finding strength: High for API interface contracts.

### Benchmark/source repos and project docs

- STATE-Bench GitHub repo, latest visible release v0.7.0 on 2026-05-28. Type: benchmark/source repo. Link: https://github.com/microsoft/STATE-Bench. Finding strength: Medium.
- Microsoft STATE-Bench release post, 2026-05-19. Type: official docs/vendor context. Link: https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/. Finding strength: Medium for benchmark scope.
- Claw-Eval-Live project page, current v1.0 April 2026. Type: benchmark docs. Link: https://claw-eval-live.github.io/. Finding strength: Medium.

### Reviews and professional context

- "Teamwork in project management: Mapping AI as mediator with triangulated bibliometrics," 2025. Type: review/bibliometric. Link: https://www.sciencedirect.com/science/article/pii/S2444569X25002537. Finding strength: Medium-high.
- PMI Pulse of the Profession 2026 press release, 2026-05. Type: vendor/professional context. Link: https://www.pmi.org/about/press-media/2026/pulse-why-complex-projects-fail-best-practices-are-not-enough-system-thinking. Finding strength: Medium for current industry framing, not proof.

## Bottom Line

The core thesis survived and got more concrete. The best next implementation is not "better memory." It is a governed action-read contract:

```text
source observations
  -> typed events / raw episodes
  -> current_state_view
  -> model proposal
  -> observation_contract + read_set validation
  -> valid mutation or blocked/replanned action
```

That is pm-substrate's defensible bridge from statistical prediction to valid work.

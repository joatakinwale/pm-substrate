# v07 Agent-State Arrowsmith - 2026-06-10

Date: 2026-06-10 UTC
Local run clock: 2026-06-10 07:37:11 CDT
Method: Arrowsmith A-B-C continuation, prior-version claim audit, repo-grounded implementation check, recent primary-source scan, standards/protocol scan, project-management bridge scan
Status: seventh numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md`

Local context read in required order:

1. Automation memory for `daily-research-task-description`
2. `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md`
3. `research/daily-arrowsmith-agent-state/index.md`
4. `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md`
5. `research/index.md`
6. `Changelog.md`
7. Current implementation surfaces in `packages/agent-state`, `packages/evals`, `packages/capability-finance-research-ingest`, and `packages/continuity`

Git synchronization note: `git fetch --no-tags origin main` completed and `HEAD`, `origin/main`, and `FETCH_HEAD` all matched `7cc0a33dce5732b556cb323b6cf6dc3d4f80b487`. Git emitted repeated `non-monotonic index .git/objects/pack/._pack-...idx` warnings, apparently from AppleDouble files on the external drive. No upstream content delta was present before this research write.

## 1. Delta From Prior Version

v06 moved the frontier from durable ArrowHedge state-review artifacts to external evidence admission. v07 confirms that direction and sharpens it with four new mechanisms:

1. **Shared context is useful only if writes are admitted.** The June 9 DeLM paper frames a "shared verified context" plus task queue as a decentralized coordination substrate. This supports pm-substrate's shared current-state thesis, but it also exposes the exact missing gate: the shared context must preserve source refs, admissibility, verification status, and read/write discipline, or it becomes another shared scratchpad.
2. **Memory retention is now an observability and deletion-fidelity problem.** New memory papers on observability-safe retention, distributed active memory, deployment-time memorization, multimodal human-human memory, and spatial memory all improve memory mechanics. None provides operational authority by itself. They instead add evidence fields pm-substrate should track: online-observable vs offline-supervised features, deletion residue, memory tier, multimodal source modality, spatial visibility/occlusion, and stale-information risk.
3. **Long-horizon workflow benchmarks now name the failure modes pm-substrate should assert.** Workflow-GYM, T1-Bench, WeaveBench, ALEM, Emergence World, and SKILL.nb converge on workflow consistency, objective drift, omitted stages, error propagation, environment drift, long-horizon coordination, and gate-conditioned execution. These map cleanly to state-review artifact fields and eval assertions, not to bigger context windows.
4. **MCP's 2026 direction confirms explicit state handles but does not grant authority.** MCP 2025-11-25 remains the current spec on June 10, 2026. The 2026-07-28 release candidate and SEP-2567 point toward stateless protocol requests plus explicit server-minted state handles. That strengthens pm-substrate's "state must be addressable" argument, while also downgrading any claim that a protocol handle is authoritative current business state.

Repo-grounded correction: the code audit confirmed v06's implementation claim. `@pm/agent-state` already has `ActionProposalReview`, `StateReviewArtifact`, deterministic JSON/JSONL serialization, import validation, hash replay, observed read-set comparison, continuity payload linkage, temporal misalignment metadata, and invariant-class `wouldBlock` policy metrics. ArrowHedge already emits deterministic temporal fixture corpora and DB/fixture equivalence tests when `PM_DATABASE_URL` is available. The open code frontier is not "make observation reports executable artifacts"; it is "admit external evidence into the existing artifact path without treating it as authority."

## 2. New Sources Reviewed

| Source | Authors | Date | Link | Source type | Relevance |
| --- | --- | --- | --- | --- | --- |
| Workflow-GYM: Towards Long-Horizon Evaluation of Computer-use Agentic tasks in Real-World Professional Fields | Liya Zhu et al. | Submitted 2026-06-09 | https://arxiv.org/abs/2606.11042 | arXiv benchmark preprint | Names workflow-stage omission, error propagation, objective drift, and professional-software misunderstanding as long-horizon GUI-agent failures. Maps directly to workflow position and observation-contract assertions. |
| T1-Bench: Benchmarking Multi-Scenario Agents in Real-World Domains | Genta Indra Winata et al. | Submitted 2026-06-09 | https://arxiv.org/abs/2606.11070 | arXiv benchmark preprint | Adds realistic multi-domain, multi-turn agent interactions. Useful for cross-domain state-review fixture design, but still a simulated benchmark rather than authority proof. |
| Decentralized Multi-Agent Systems with Shared Context | Yuzhen Mao, Azalia Mirhoseini | Submitted 2026-06-09 | https://arxiv.org/abs/2606.10662 | arXiv MAS architecture preprint | Strong bridge for common substrate/shared verified context plus task queues; needs admission-time write validation before transfer to pm-substrate. |
| Learning What to Remember: Observability-Safe Memory Retention via Constrained Optimization for Long-Horizon Language Agents | Qingcan Kang, Liu Mingyang, Shixiong Kai, Kaichao Liang, Tao Zhong, Mingxuan Yuan | Submitted 2026-06-09 | https://arxiv.org/abs/2606.10616 | arXiv memory preprint | Introduces online-observable vs offline-supervised separation, delayed costs, stale-information risk, and budgeted retention. Useful for memory admission metadata. |
| ActiveMem: Distributed Active Memory for Long-Horizon LLM Reasoning | Yunhan Jiang, Wenbin Duan, Shasha Guo, Liang Pang, Xiaoqian Sun, Huawei Shen | Submitted 2026-06-09 | https://arxiv.org/abs/2606.10532 | arXiv memory architecture preprint | Decouples planner context from distributed memory shards. Useful for separating memory operators from current-state authority, but must not be treated as operational state. |
| What Spatial Memory Must Store: Occlusion as the Test for Language-Agent Memory | Doeon Kwon, Junho Bang | Submitted 2026-06-09 | https://arxiv.org/abs/2606.10299 | arXiv memory benchmark preprint | Shows spatial memory needs structured predicates such as visibility/occlusion, not just text similarity. Analogy: pm state needs task/workflow visibility predicates. |
| Deployment-Time Memorization in Foundation-Model Agents | Lei (Rachel) Chen et al. | Submitted 2026-06-08 | https://arxiv.org/abs/2606.10062 | arXiv workshop preprint | Adds deployment-time memory as privacy-utility-deletion fidelity surface, including forgetting residue. Strengthens deletion/invalidation fields for state evidence. |
| H2HMem: A Multimodal Memory Benchmark for Agents in Human-Human Interactions | Shiping Zhu, Yibo Yang, Zhengyang Wang, Tiancheng Shen, Dandan Guo, Ming-Hsuan Yang | Submitted 2026-06-08 | https://arxiv.org/abs/2606.09461 | arXiv benchmark preprint | Multi-party and multimodal memory benchmark. Useful PM bridge for handoffs and meetings; weak for authority unless source/modality and speaker ownership are preserved. |
| Envisioning Sensemaking in Multi-Human, Multi-Agent Collaborative Knowledge Work | Zhitong Guan, Soo Young Rieh | arXiv version 2026-04-23; CHI 2026 sensemaking accepted manuscript | https://arxiv.org/abs/2606.09840 | HCI position paper / accepted workshop manuscript | Adds dynamic shared representational workspaces, provenance/authorship, verifiability, accountability, and gap-bridging as PM-facing design principles. |
| The Consistency Illusion: How Multi-Agent Debate Hides Reasoning Misalignment | Xiaoyang Wang, Christopher C. Yang | Submitted 2026-06-07 | https://arxiv.org/abs/2606.08457 | arXiv MAS evaluation preprint | Confirms answer-level consensus is not reasoning alignment. Reinforces the downgrade of semantic consensus and majority agreement as authority. |
| Emergence World: A Platform for Evaluating Long-Horizon Multi-Agent Autonomy | Deepak Akkil, Ravi Kokku, Karthik Vikram, Tamer Abuelsaad, Aditya Vempaty, Satya Nitta | Submitted 2026-06-06 | https://arxiv.org/abs/2606.08367 | arXiv benchmark/platform preprint | Long-running multi-agent worlds with persistent memory, external live data, governance, and logs. Useful for trajectory/run-level artifact groups. |
| Benchmarking Open-Ended Multi-Agent Coordination in Language Agents | Kale-ab Abebe Tessera et al. | Submitted 2026-06-06 | https://arxiv.org/abs/2606.08340 | arXiv benchmark preprint | Shows base task competence and coordination competence diverge; communication, memory, reasoning, and team composition need separate metrics. |
| SKILL.nb: Selective Formalization and Gated Execution for Durable Agent Workflows | Amine El Hattami, Nicolas Chapados, Christopher Pal | Submitted 2026-06-06 | https://arxiv.org/abs/2606.08049 | arXiv workflow reliability preprint | Strong bridge for auditable, versioned workflow notebooks, validation gates, fallbacks, evidence, and drift-aware execution. |
| MCP 2025-11-25 specification and current docs | MCP Core Maintainers | Current latest spec as of 2026-06-10 | https://modelcontextprotocol.io/specification/2025-11-25 | Official protocol docs | Confirms current official protocol is still stateful, with tools/resources/prompts, progress/cancellation, authorization, and security considerations. |
| MCP 2026 roadmap, tool-annotation post, 2026-07-28 release candidate, and SEP-2567 explicit state handles | MCP maintainers and SEP authors | 2026-03 to 2026-05 | https://modelcontextprotocol.io/development/roadmap, https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/, https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/, https://modelcontextprotocol.io/seps/2567-sessionless-mcp | Official protocol blog/SEP docs | Confirms Tasks lifecycle gaps, annotations as untrusted hints, and future explicit state handles. Treat release-candidate semantics as future/draft until the dated final spec ships. |

## 3. Older Sources Added

| Source | Authors | Year | Link | Source type | Mechanism extracted |
| --- | --- | --- | --- | --- | --- |
| Coordination in Fast-Response Organizations | Samer Faraj, Yan Xiao | 2006 | https://doi.org/10.1287/mnsc.1060.0526 | Management Science article | High-uncertainty coordination requires expertise coordination practices, protocols, plug-and-play teaming, and knowledge sharing. Mechanism: explicit expertise/source routing under time pressure. |
| The Incident Command System: High-Reliability Organizing for Complex and Volatile Task Environments | Gregory A. Bigley, Karlene H. Roberts | 2001 | https://doi.org/10.5465/3069401 | Academy of Management Journal article | Incident command works by combining temporary hierarchy, role clarity, authority, and flexible recomposition. Mechanism: authority and escalation paths are state, not chat. |
| Toward a Theory of Situation Awareness in Dynamic Systems | Mica R. Endsley | 1995 | https://doi.org/10.1518/001872095779049543 | Human Factors theory paper | Situation awareness separates perception, comprehension, and projection. Mechanism: pm-substrate should distinguish observed state, interpreted/current state, and predicted next state. |
| Measuring Transactive Memory Systems in the Field | Kyle Lewis | 2003 | https://doi.org/10.1037/0021-9010.88.4.587 | Journal of Applied Psychology article | TMS can be measured through specialization, credibility, and coordination. Mechanism: state artifacts should expose who/which source knows what, whether it is credible, and how coordination occurs. |
| The impact of transactive memory systems on IS development teams' coordination, communication, and performance | Jack S.-C. Hsu, Sheng-Pao Shih, Jerry C. Chiang, Julie Y.-C. Liu | 2012 | https://doi.org/10.1016/j.ijproman.2011.08.003 | International Journal of Project Management article | TMS maturity improves IS team performance directly and through communication/coordination. Mechanism: agent/human project state needs expertise-owner and communication-path metrics. |
| Communication During Transitions of Care | AHRQ PSNet | 2023 | https://psnet.ahrq.gov/perspective/communication-during-transitions-care | Official patient-safety review | Handoff failures are mitigated by structured communication and organizational safety culture. Mechanism: PM handoff artifacts need source, risk, action, owner, and escalation fields. |

## 4. Arrowsmith Bridge Table

| Agent-state problem | Bridge concept | Source discipline | Supporting papers | Implementation implication | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| Agents write to a shared scratchpad but later agents cannot know which claims are verified, stale, or authorized. | Shared verified context plus admission-time verification | Multi-agent systems / distributed collaboration | DeLM; MCP explicit state handles; SKILL.nb | Add `ExternalStateEvidence` and `EvidenceAdmissionReview` fields before any external context becomes a `StateRef` or artifact relation. | High for direction, Medium for exact API | A shared context without admission metadata produces the same stale/authority warnings as an admitted-evidence artifact across ArrowHedge fixtures. |
| Memory systems retain useful facts but may retain stale, deleted, or offline-only-supervised content. | Observability-safe memory retention and deletion fidelity | Agent memory / privacy | OSL-MR; Deployment-Time Memorization; ActiveMem | Memory-derived observations should carry `memoryTier`, `retentionPolicy`, `observableFeatureSet`, `validUntil`, `deletionResidueRisk`, and source refs. | Medium-high | Memory-only retrieval with trust/ranking beats admitted memory evidence on stale/deleted-memory fixtures without higher false authority. |
| Spatial or task context is flattened into text and loses operational predicates. | Predicate-bearing memory | Spatial memory / robotics analogy | What Spatial Memory Must Store; Endsley situation awareness | Add typed predicates for workflow visibility: `workflowPosition`, `visibleToActor`, `blockedBy`, `requiresSource`, `knownUnknown`. | Medium | Text summaries alone catch the same hidden workflow-position and missing-source cases as typed predicate assertions. |
| GUI/professional agents omit workflow stages or drift objectives across long tasks. | Workflow consistency and stage-validity assertions | Agent benchmarks / professional workflow eval | Workflow-GYM; T1-Bench; WeaveBench; SKILL.nb | Expand evals from "one proposal review" to run-level artifact sequences with stage omission, objective drift, and error propagation assertions. | High for eval need | Single final-state grading detects omitted intermediate workflow stages with the same precision as artifact-sequence assertions. |
| Multi-agent consensus hides reasoning disagreement or incompatible grounds. | Cross-agent reasoning alignment and grounded stances | Multi-agent evaluation / safety | Consistency Illusion; Guan/Rieh sensemaking; shared mental model research | Treat agreement as evidence only when claims cite named grounds, sources, and stances; add `claimGroundRefs` and `stanceRefs` to PM artifacts later. | Medium-high | Majority-vote or consensus-only review detects the same authority/source conflicts as grounded claim refs in safety-critical fixtures. |
| Long-running agents change behavior over days/weeks and cross-contaminate each other through shared worlds. | Trajectory-level failure attribution | Long-horizon MAS simulation | Emergence World; ALEM; VerifyMAS from v06 | Add `ArtifactRunGroup` or `StateReviewRun` to group artifacts across time, agents, and handoffs. | Medium | Per-artifact metrics alone localize cross-step failures as well as grouped trajectories. |
| MCP tools and future MCP state handles look like current state to the model. | Protocol state handle as evidence, not authority | Protocol standards / security | MCP 2025-11-25; MCP 2026 roadmap; SEP-2567; tool-annotation risk post | Map tool annotations and explicit handles into untrusted external evidence, then require substrate admission before action review uses them. | High | Trusting MCP annotations/handles directly catches malicious read-only/destructive mismatch and stale task results as well as substrate admission. |
| PM handoffs lose owner/source/escalation state. | Expertise coordination and transactive memory | Project management / organization science | Faraj/Xiao; Lewis; Hsu et al.; AHRQ transitions | Add PM handoff artifact fixtures with expertise owner, source steward, credibility/authority, unresolved risk, and escalation path. | High for PM bridge | Free-form handoff summaries produce equal downstream action validity and lower rediscovery cost than typed handoff artifacts. |
| High-uncertainty incidents require both hierarchy and recomposition. | Incident command / authority escalation | High-reliability organizations | Bigley/Roberts; Faraj/Xiao; Endsley | Treat authority owner, incident commander, escalation route, and temporary delegation as first-class state refs. | Medium-high | Agents can safely resolve authority conflicts in volatile workflows without explicit authority/escalation refs. |

## 5. Claim Ledger

| Claim | Status | v07 update |
| --- | --- | --- |
| `StateReviewArtifact` should be the repeatable pre-action artifact. | Confirmed | It already exists in code with proposal review, current state view, observation contract evaluation, read-set validation, warnings, provenance, metadata, JSON/JSONL, hash replay, and continuity payload linkage. |
| Observation reports are only in-memory objects. | Contradicted / stale | Code now has deterministic `StateReviewArtifact` export/import and ArrowHedge corpus generation. The next open issue is external evidence admission. |
| A typed `ActionProposalReview` envelope is needed before action execution. | Confirmed as implemented primitive | `ActionProposalReview` exists and combines proposed action, current state view, observation contract evaluation, read-set validation, warnings, and warn-first disposition. |
| ArrowHedge fixture coverage lacks accepted/current, stale risk, authority mismatch, missing source refs, projection drift, workflow mismatch, and decision snapshot conflicts. | Revised | Pure tests cover stale, authority mismatch, projection drift, workflow mismatch, missing refs, temporal phases, and decision-risk/signal conflicts. A named accepted/current "clean artifact" corpus case is still useful for metrics baselines. |
| Read-set warnings align with observation assertion failures. | Partly confirmed | Existing tests show both surfaces are emitted and metrics bucket them. A direct per-fixture alignment table remains worth adding. |
| No mutation-blocking claim should be made yet. | Confirmed | Review defaults remain advisory; invariant policy reports `wouldBlock`, but external side-effect gates remain unimplemented. |
| DB-backed projection can produce the same report when `PM_DATABASE_URL` is available. | Confirmed as gated integration | ArrowHedge DB/fixture equivalence exists behind `PM_DATABASE_URL`; daily runs without DB should not overclaim live DB coverage. |
| RAG, long context, distributed memory, or active memory solves currentness. | Downgraded | New memory papers improve retention and reasoning efficiency, but still require authority, freshness, deletion, source, and workflow validation. |
| Shared context between agents proves shared operational state. | Revised | DeLM's shared verified context strengthens the common-substrate bridge, but pm-substrate still needs admission-time verification and invalidation. |
| MCP Tasks, tool annotations, and explicit state handles can be treated as current state. | Downgraded | Official MCP sources call annotations hints and future state handles are tool-design strings, not authority. They should become external evidence inputs. |
| Multi-agent agreement is a proxy for correctness. | Downgraded | Consistency Illusion shows surface agreement can hide reasoning misalignment. Agreement needs claim grounds and source refs. |
| PM artifacts should be dashboards. | Revised | PM artifacts should be executable coordination records: source owner, expertise owner, current blocker, valid next action, escalation path, handoff condition, and evidence links. |

## 6. Implementation Implications

1. **Add an admitted-evidence model inside `@pm/agent-state`.** Candidate types:
   - `ExternalStateEvidence`: raw external evidence from MCP task/tool, memory search, GUI run, workflow benchmark, monitoring event, lineage event, audit event, attestation, human handoff, or world-model prediction.
   - `EvidenceAdmissionReview`: deterministic result with `admitted`, `mode: "warn"`, `issues`, `sourceSystem`, `sourceRecordId`, `subject`, `tenantId`, `observedAt`, `validUntil`, `authority`, `privacyClass`, `actionConsequence`, `payloadHash`, and `admissionPolicy`.
   - `AdmittedStateEvidence`: external evidence promoted into a `StateRef`/artifact relation only after admission review.
2. **Extend artifact metadata without breaking v1 imports.** Add optional `externalEvidence`, `evidenceAdmissionReviews`, and `admittedEvidenceRefs` metadata fields or provenance links. Preserve current v1 importer behavior for absent fields.
3. **Keep MCP-specific mapping as fixtures first.** Do not integrate a live MCP server. Add fixture evidence for tool annotations, task handle/state, current spec version, future release-candidate status, and explicit state handle. The first test should show an MCP read-only/destructive mismatch becomes a warning/denial, not authority.
4. **Turn memory retrieval into observed external evidence.** Memory outputs should enter the observed-read-set lane with memory-specific fields: memory tier, source modality, retained-from refs, retention/deletion policy, deletion residue risk, stale-information risk, and retrieval scope.
5. **Introduce run-level artifact groups.** Long-horizon workflow failures need `StateReviewRun` or `ArtifactRunGroup` to join multiple proposal reviews, feedback observations, no-op waits, and handoffs.
6. **Add PM handoff/evidence fields through fixtures before UI.** The field set should include source steward, expertise owner, action owner, escalation owner, handoff condition, unresolved risk, dependency refs, and valid next action.
7. **Keep policy separate from enforcement.** Add `warn`, `block_on_fail`, `block_on_authority_or_stale`, and `audit_only` only after admitted evidence fixtures prove the warnings align with invariant classes. Do not route real side effects through blocking until the runtime boundary exists.

## 7. Testing/Eval Implications

New fixture/eval scenarios to add:

1. **Clean accepted/current state-review artifact.** A no-warning ArrowHedge proposal where state, read set, observation contract, observed read set, and artifact hash all pass. This gives metrics a positive baseline.
2. **MCP read-only/destructive mismatch.** External evidence claims `readOnlyHint: true`, but the proposed action or observed effect is destructive. Expected warning: `capability_annotation_policy_mismatch`; invariant class: `capability_contract` or `source_authority`.
3. **MCP task handle stale result.** Task handle returns after the state view's `validUntil` or workflow position changed. Expected warning: `external_evidence_stale` plus read-set or observation-contract drift.
4. **Memory deletion residue.** A memory item is deleted/superseded but recoverable from summary/derived tier. Expected warning: `memory_deletion_residue` and no authority promotion.
5. **Observability-safe retention split.** Evidence retained because offline labels said it was useful but online-observable fields could not justify it. Expected warning: `offline_supervision_leak` or lower admission confidence.
6. **Spatial/task visibility predicate failure.** A hidden/occluded task dependency is omitted from a text summary but visible in structured refs. Expected warning: `partial_observation` or `workflow_position_mismatch`.
7. **Workflow stage omission sequence.** A multi-artifact run omits a required professional workflow stage while final output looks plausible. Expected run-level warning: `workflow_stage_omitted`.
8. **Consensus without grounded claims.** Multiple agents agree on action but cite incompatible grounds or no source refs. Expected warning: `reasoning_alignment_missing` and no authority promotion.
9. **PM handoff invalidation.** Successor agent receives old handoff after blocker/owner/source changed. Expected warning: `handoff_condition_stale`, plus source/owner mismatch.

Metrics to add or refine:

- `external_evidence_admission_rate`
- `external_evidence_denial_rate`
- `external_evidence_warning_by_code`
- `external_evidence_warning_by_severity`
- `capability_annotation_policy_mismatch_rate`
- `explicit_state_handle_revalidation_rate`
- `memory_deletion_residue_rate`
- `offline_supervision_leak_rate`
- `stale_information_retention_rate`
- `workflow_stage_omission_rate`
- `objective_drift_warning_rate`
- `artifact_run_group_failure_localization_rate`
- `reasoning_alignment_missing_rate`
- `grounded_claim_coverage`
- `pm_handoff_condition_stale_rate`
- `expertise_owner_resolution_rate`
- `escalation_owner_resolution_rate`

Assertions to add:

- Every external evidence fixture produces an `EvidenceAdmissionReview`.
- Denied evidence never becomes an authoritative `StateRef`.
- Read-set warnings and evidence-admission warnings can be counted independently and joined by ref.
- `wouldBlock` remains a policy recommendation unless `enforcementMode` is explicitly blocking in a test fixture.
- Imported v1 artifacts without external-evidence fields still validate.
- DB-backed ArrowHedge equivalence remains gated by `PM_DATABASE_URL`; fixture-only tests should continue to run without DB.

## 8. Open Questions For Next Run

1. What is the smallest stable type boundary for admitted evidence: `@pm/agent-state` core type, eval-only fixture type, or adapter-specific type?
2. Should denied external evidence live in artifact `metadata`, `provenance.links`, or a first-class `evidenceAdmissionReviews` field?
3. How should state-review artifacts represent future/draft protocol semantics such as MCP 2026-07-28 release-candidate features without treating them as current authority?
4. Should memory deletion residue be modeled as an observation-contract assertion, read-set issue, evidence-admission issue, or continuity contradiction?
5. Which external evidence should be allowed to affect `allowedActions` vs only warnings?
6. How should run-level artifact groups preserve chronological causality across proposal review, execution feedback, feedback observation, and handoff?
7. What is the cleanest PM distributed-state eval: dependency-structure agreement, source/owner convergence, handoff-condition resolution, or valid-next-action agreement?
8. Can a named accepted/current ArrowHedge fixture cover all artifact-validity metrics without hiding that most current evidence-stage claims are still synthetic/scaffolded?
9. Should the Git AppleDouble `.git/objects/pack/._pack-...idx` warnings be treated as repo hygiene debt in the daily research protocol, because fetch reliability is itself a continuity risk?

## 9. Recommended Next Code Slice

Build **external evidence admission v1** as a pure, fixture-driven extension to the existing state-review artifact path.

Minimum slice:

1. Add `ExternalStateEvidence`, `EvidenceAdmissionReview`, and `AdmittedStateEvidence` types in `packages/agent-state/src/index.ts`.
2. Add a pure helper like `reviewExternalStateEvidence(evidence, currentStateView, policy)` that emits warn-first admission issues for stale evidence, tenant/subject mismatch, authority mismatch, untrusted capability annotation, missing source refs, future/draft protocol status, privacy class mismatch, and payload hash absence.
3. Extend `StateReviewArtifactMetadataInput` with optional `externalEvidence`, `evidenceAdmissionReviews`, and `admittedEvidenceRefs`, keeping imports backward-compatible.
4. Add ArrowHedge-adjacent fixtures for MCP-like tool/task evidence and memory-search evidence without a live MCP server.
5. Add eval metrics for admitted/denied evidence and warnings by code/severity.

This code slice follows directly from v06 and v07: state-review artifacts are the pre-action boundary; external evidence admission is the missing pre-artifact gate for foreign state.

## 10. Source Inventory

Recent agent-state and workflow sources:

- Workflow-GYM: https://arxiv.org/abs/2606.11042.
- T1-Bench: https://arxiv.org/abs/2606.11070.
- Decentralized Multi-Agent Systems with Shared Context: https://arxiv.org/abs/2606.10662.
- Observability-Safe Memory Retention: https://arxiv.org/abs/2606.10616.
- ActiveMem: https://arxiv.org/abs/2606.10532.
- What Spatial Memory Must Store: https://arxiv.org/abs/2606.10299.
- Deployment-Time Memorization: https://arxiv.org/abs/2606.10062.
- H2HMem: https://arxiv.org/abs/2606.09461.
- Envisioning Sensemaking in Multi-Human, Multi-Agent Collaborative Knowledge Work: https://arxiv.org/abs/2606.09840.
- The Consistency Illusion: https://arxiv.org/abs/2606.08457.
- Emergence World: https://arxiv.org/abs/2606.08367.
- Benchmarking Open-Ended Multi-Agent Coordination: https://arxiv.org/abs/2606.08340.
- SKILL.nb: https://arxiv.org/abs/2606.08049.

Protocol/standards sources:

- MCP 2025-11-25 current specification: https://modelcontextprotocol.io/specification/2025-11-25.
- MCP 2026 roadmap: https://modelcontextprotocol.io/development/roadmap.
- MCP tool annotations risk vocabulary: https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/.
- MCP 2026-07-28 release candidate: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/.
- SEP-2567 Sessionless MCP via Explicit State Handles: https://modelcontextprotocol.io/seps/2567-sessionless-mcp.

Project-management, team cognition, and high-reliability sources:

- Faraj and Xiao, Coordination in Fast-Response Organizations: https://doi.org/10.1287/mnsc.1060.0526.
- Bigley and Roberts, The Incident Command System: High-Reliability Organizing for Complex and Volatile Task Environments: https://doi.org/10.5465/3069401.
- Endsley, Toward a Theory of Situation Awareness in Dynamic Systems: https://doi.org/10.1518/001872095779049543.
- Lewis, Measuring Transactive Memory Systems in the Field: https://doi.org/10.1037/0021-9010.88.4.587.
- Hsu et al., The impact of transactive memory systems on IS development teams' coordination, communication, and performance: https://doi.org/10.1016/j.ijproman.2011.08.003.
- AHRQ PSNet, Communication During Transitions of Care: https://psnet.ahrq.gov/perspective/communication-during-transitions-care.

Source gaps carried forward:

- Most June 2026 sources are preprints or workshop/position papers. Treat mechanisms as design/eval inputs, not production proof.
- ContractBench and STALE official code/data locations still need periodic re-checking.
- MCP 2026-07-28 release-candidate semantics should remain marked future/draft until the final dated specification ships.

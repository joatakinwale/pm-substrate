# v06 Agent-State Arrowsmith - 2026-06-09

Date: 2026-06-09 UTC
Local run clock: 2026-06-09 19:01:36 CDT
Method: Arrowsmith A-B-C continuation, prior-version claim audit, repo-grounded implementation check, recent primary-source search, standards bridge search, project-management bridge search
Status: sixth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md`

Local context read in required order:

1. Automation memory for `research-pm-substrate`
2. `research/daily-arrowsmith-agent-state/index.md`
3. `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md`
4. `research/index.md`
5. `Changelog.md`
6. Current implementation surfaces in `packages/agent-state`, `packages/evals`, and `packages/capability-finance-research-ingest`

Git synchronization note: `git fetch origin main` and `git fetch --no-tags origin main` both failed with `fatal: mmap failed: Operation timed out`, but `git ls-remote origin refs/heads/main`, local `HEAD`, and local `origin/main` all matched `81d67a1cbfc7a00dcfd42c56c9249ca044f40278`. No upstream merge delta or conflict was present before this research write.

## 1. Version Header

Current strongest thesis:

> LLM agents are statistical predictors promoted into actors. pm-substrate is the governed operational-state layer between prediction and valid action. After v05, the repo closed the first durable artifact frontier: JSON/JSONL state-review artifacts, eval refs, observed read-set comparison, temporal misalignment fixtures, DB/fixture equivalence, and an invariant-class policy matrix now exist as code. v06 moves the research frontier to external-state admission: MCP tasks/tools, memory stores, world models, monitoring harnesses, provenance graphs, audit events, lineage systems, and PM coordination artifacts can all emit evidence, but none should be treated as authoritative current operational state until admitted through source, subject, authority, freshness, consequence, privacy, and workflow checks.

## 2. Delta From Previous Version

v05's main implementation watchlist is now partly stale in a good way. The changelog and code show that durable `StateReviewArtifact` JSON/JSONL export/import, replay hash validation, `state_review_artifact` eval refs, observed read-set comparison, temporal misalignment phase fixtures, DB/fixture equivalence helpers, and a pure invariant-class policy matrix were added after v05. This does not prove external mutation blocking or production enforcement; the policy remains a review/recommendation boundary. The new research pass found stronger bridges for the next layer: external protocol task state from MCP, capability and destructive-action annotations, memory search as a trust boundary, provenance/authorization graph alignment, long-running monitoring benchmarks, text world models as prediction-only evaluators, FHIR multi-actor audit/provenance, OpenLineage run/job/dataset events, in-toto/SLSA attestations, and human-AI team situation-awareness measurement. The updated direction is to treat external traces and task states as evidence producers that require substrate admission, not as state authorities.

## 3. Research Question

When an existing LLM agent, memory system, tool protocol, workflow runtime, monitoring harness, or human project team emits a state-like artifact, what must pm-substrate record and validate before that artifact can influence a valid action?

The product decision this research informs: the next implementation slice should not add another generic memory, dashboard, or model-training layer. It should add an external-evidence admission model that maps foreign task/tool/trace/audit/lineage objects into `StateReviewArtifact` evidence with explicit authority, subject, consequence, freshness, privacy, workflow, and PM handoff semantics.

## 4. A/B/C Framing

| Layer | Definition for this run | Key terms searched |
| --- | --- | --- |
| A - agent-state problem | LLM agents and multi-agent workflows misread or overtrust model, prompt, memory, tool, task, trace, or handoff state when acting. | LLM agents, memory search, multi-agent failure, tool use, MCP, world models, monitoring agents, provenance, state drift |
| B - bridge concepts | Evidence admission, provenance-vs-authorization, task state machines, capability annotations, observed vs declared reads, monitoring lifecycle, boundary objects, shared situation awareness. | source authority, provenance graph, authorization graph, durable task, destructive tool, run lineage, audit event, shared SA, dependency management |
| C - adjacent literatures | Distributed systems, security/provenance, healthcare audit, data lineage, software supply chain attestation, human-AI teaming, project coordination, team cognition. | OpenLineage, FHIR Provenance/AuditEvent, in-toto/SLSA, boundary objects, coordination theory, shared mental model meta-analysis |

Closed discovery checks from v05:

- **Persisted artifact lifecycle -> code:** closed as pure artifact and eval primitives, not external enforcement.
- **Temporal misalignment phases -> fixtures:** closed for deterministic ArrowHedge fixture coverage, still open for broader client/tool surfaces.
- **Observed read-set capture -> code:** closed as pure comparison metadata, still open for runtime capture from actual tool invocations.
- **Invariant-class policy -> code:** closed as `wouldBlock` recommendation matrix, still open for production mutation gates.
- **Semantic consensus -> authority:** still downgraded; new AuthGraph-style work strengthens provenance-vs-authorization separation.

## 5. Source Map

| Source | Date | Type | Status | What it adds |
| --- | --- | --- | --- | --- |
| Bridging the Agent-World Gap: Text World Models for LLM-based Agents | 2026-06-08 | review / arXiv preprint | Medium | World models help planning/eval by predicting textual transitions, but this is inferred prediction state, not operational authority. |
| SentinelBench: A Benchmark for Long-Running Monitoring Agents | 2026-06-04/05 | benchmark / arXiv preprint | High for eval shape, Medium for generalization | Monitoring agents need lifecycle, scheduled external events, reaction-time metrics, and DB-state assertions. |
| Beyond Similarity: Trustworthy Memory Search for Personal AI Agents | 2026-06-05 | arXiv preprint / empirical security study | High for risk framing | Memory search is a durable control channel and trust boundary, not a neutral recall utility. |
| Agent libOS | 2026-06 | arXiv preprint / architecture proposal | Medium | Long-running agents need capability-control, attenuated authority, fork/delegation records, and auditability beyond chat loops. |
| AuthGraph dual-graph defense | 2026-05 | arXiv preprint / security method | Medium-high | Separate provenance from authorization; compare actual trajectory sources to clean intent/capability authorization. |
| VerifyMAS | 2026-05-17 | arXiv preprint / benchmark method | Medium | Failure attribution should verify hypotheses over full trajectories, not only local agent logs. |
| AgentAtlas | 2026-05 | arXiv preprint / eval taxonomy | Medium | Eval should classify control decisions and trajectory validity, not only final outcome. |
| MCP Tasks, tools, authorization, tool annotations | 2025-03 to 2025-11 | official protocol docs | High for protocol semantics | Tools/tasks expose model-controlled capabilities and durable task state, but annotations/transport auth are not enough for business authority. |
| OpenLineage object model | current docs | official spec/docs | Medium-high | Run/job/dataset events and facets provide lineage vocabulary for data-derived state-review evidence. |
| FHIR Provenance and AuditEvent | 2026 ballot docs | standard / official docs | High for audit/provenance vocabulary | Provenance and audit records model multi-actor, system-of-systems evidence where duplicate/conflicting events can reveal problems. |
| in-toto and SLSA provenance | 2023 docs / standard ecosystem | standard / official docs | Medium-high | Attestation statements, predicates, subjects, materials, and layouts map to verifiable artifact admission patterns. |
| Human-AI Teaming: Situation Awareness | 2022 National Academies | review / consensus report | Medium-high for PM bridge | Human-AI teams need shared situation awareness of goals, responsibilities, task environment, and AI/human state. |
| Shared team mental models meta-analysis | 2010 | peer-reviewed meta-analysis | High for PM metrics | Knowledge structure, not just content, predicts team process; PM substrate metrics should include structural agreement. |
| Boundary objects | 1989 | peer-reviewed STS paper | Medium | Artifacts coordinate heterogeneous actors, but interpretive flexibility is not authority. |
| Coordination theory | 1994 | peer-reviewed survey | Medium-high | Coordination is dependency management; PM artifacts should expose dependencies and owners, not only status text. |

## 6. Prior-Version Claim Audit

| v05 claim or implication | v06 status | Correction |
| --- | --- | --- |
| Persist/export ArrowHedge state-review artifacts before adding new policy. | Stale / closed as pure primitive | Changelog shows deterministic JSON/JSONL export/import, replay hash validation, ArrowHedge corpus generation, continuity payload linkage, eval refs, and artifact-derived metrics. |
| Add artifact-to-eval-event linkage fields. | Stale / closed as pure primitive | `state_review_artifact` is now a first-class eval ref and ArrowHedge substrate refs are scoped to matching scenarios. |
| Add observed read-set capture and declared-vs-observed comparison. | Partly closed | Pure comparison and artifact metadata exist. Runtime capture from real tool invocations remains open. |
| Add temporal fixtures for action-to-feedback and feedback-to-observation. | Partly closed | Deterministic ArrowHedge fixture cases cover all three named temporal phases. Broader cross-surface fixtures remain open. |
| Define first invariant-class policy matrix. | Partly closed | A pure policy matrix and `wouldBlock` metrics exist. External mutation gates remain explicitly unclaimed. |
| World-model style prediction could support evaluation. | Modified | New text-world-model sources strengthen this as an offline/advisory eval bridge, but it must not become current-state authority. |
| Multi-agent consensus can help finality/provenance but not authority. | Confirmed | AuthGraph and VerifyMAS strengthen the split between trajectory evidence, authorization, and failure attribution. |
| PM common operating picture should produce accountability, predictability, and common understanding. | Confirmed and sharpened | Human-AI SA and shared mental-model measurement imply agreement on structured relations: source, owner, dependency, blocker, valid next action, and handoff precondition. |

## 7. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| External tool protocols expose task state and tool metadata that agents may overtrust. | External evidence admission | MCP Tasks/tools/authorization docs | High for protocol semantics, Medium for substrate transfer | MCP task/tool outputs should enter substrate as observed evidence with source, subject, action consequence, capability annotation, and authorization context. | Add an external capability/task evidence envelope before letting MCP-derived state influence action reviews. | `external_evidence_admission_rate`, `capability_annotation_policy_mismatch_rate` | Direct MCP task state plus tool annotations catches all stale/unauthorized action cases without substrate admission. | Avoid treating server-provided annotations as trusted when the server or transport is compromised. |
| Memory search can reshape task interpretation and actions. | Memory as control channel | Beyond Similarity / MemGate | High for risk, Medium for mitigation | Retrieved memory should be treated like a tool observation with provenance, freshness, tenant, subject, and allowed-use checks. | Attach memory-search observations to artifacts as admitted/denied evidence; flag memory-derived authority attempts. | `memory_search_trust_boundary_violation_rate`, `memory_evidence_denial_rate` | Memory retrieval with similarity/trust ranking alone performs as well under malicious or stale memory fixtures. | Personal memory evidence can expose sensitive user data; admission should minimize and redact. |
| Long-running monitoring agents wait for external changes rather than causing all state changes. | Monitoring lifecycle and reaction time | SentinelBench | High for eval shape | pm-substrate needs wait-condition artifacts: what condition was awaited, which source changed, how long reaction took, and whether the action was premature/no-op. | Add fixture metadata for passive wait, active action, and no-op monitoring scenarios. | `wait_condition_reaction_time`, `premature_contact_rate`, `no_op_false_action_rate` | Current pre-action reviews catch passive waiting and no-op cases without explicit wait-condition metadata. | Overactive monitors can create false alarms or unnecessary interventions. |
| Agents need models of environment transitions, but predictions can be mistaken for truth. | Prediction state vs operational state | Text world models | Medium | World models can propose expected consequences and off-policy eval traces, but substrate must compare predicted state to observed authoritative state before action. | Store world-model predictions as non-authoritative evidence linked to actual observations. | `world_model_prediction_disagreement_rate`, `prediction_to_observation_revalidation_rate` | Predicted transitions can safely replace current observed state in high-consequence workflows. | False confidence in simulated outcomes can hide rare but costly failures. |
| Actual provenance can diverge from authorized intent. | Provenance-vs-authorization graph alignment | AuthGraph, in-toto/SLSA | Medium-high | State-review artifacts should compare actual parameter/source provenance with allowed subject/material/action policy. | Add artifact fields for `authorizedSourceRefs` vs `actualSourceRefs` or policy alignment outcome. | `provenance_authorization_alignment_rate`, `unauthorized_parameter_source_detection_rate` | Single provenance trace without a clean authorization graph detects the same violations. | Authorization graphs can encode wrong or discriminatory policy; record policy owner and appeal path. |
| Failure attribution over local logs misses global cross-step failures. | Trajectory-level hypothesis verification | VerifyMAS, TRACE, MAST | Medium | Artifact runs should support failure hypotheses that span multiple artifacts, agents, and handoffs. | Add run-level hypothesis/ref groups over state-review artifact sequences. | `trajectory_hypothesis_verification_rate`, `cross_artifact_failure_localization_rate` | Local per-agent log inspection finds the same global coordination failures as run-level artifact sequences. | Automated blame assignment can become punitive; keep attribution at artifact/system level by default. |
| Data/workflow outputs need lineage beyond one state view. | Job/run/dataset lineage facets | OpenLineage | Medium-high | Data-derived current-state refs should carry run/job/dataset lineage and source-code/version facets when available. | Map lineage facets into source refs and artifact provenance links. | `lineage_facet_coverage`, `dataset_source_version_coverage` | Current source refs without lineage facets give equal replay/debug value for data-derived decisions. | Lineage can reveal internal data flows; apply redaction and access controls. |
| Multi-actor enterprise systems produce duplicate or conflicting audit records. | Audit redundancy as signal | FHIR AuditEvent / Provenance | High for standard semantics | Conflicting audit entries from clients, servers, and intermediaries should become artifact warnings, not ignored duplicates. | Compare multi-actor audit evidence for missing actors, conflicting subjects, and unexpected intermediaries. | `multi_actor_audit_conflict_rate`, `expected_actor_audit_coverage` | Single client-side audit log is enough to detect cross-system privacy/security issues. | Audit data is sensitive and can become surveillance; minimize actor/person data. |
| Artifacts coordinate humans and agents across interpretive communities. | Boundary objects with structured invariants | Boundary objects, human-AI SA | Medium | State-review artifacts should be interpretable by product, engineering, ops, and AI agents while preserving invariant fields that cannot be locally reinterpreted. | Split artifact views: stable invariant core plus role-specific projections. | `boundary_object_reinterpretation_gap`, `invariant_field_preservation_rate` | Free-form reports produce equal cross-team agreement and action validity. | Too much structure can suppress legitimate local context; keep annotations extensible. |
| Project teams fail when shared state lacks dependency structure. | Coordination as dependency management; structured mental models | Coordination theory, shared mental-model meta-analysis, NASEM HAI teaming | High for PM metrics, Medium for agent transfer | PM substrate should measure agreement on dependency graph, owner/source, blocker, valid next action, and handoff condition. | Add PM distributed-state evals where humans/agents receive partial shards and must converge on structured dependencies. | `dependency_structure_agreement`, `team_sa_alignment_delta`, `handoff_condition_resolution_rate` | Status-summary dashboards produce equal agreement vs structured dependency/source artifacts. | Do not turn coordination metrics into individual productivity scoring. |

## 8. New Or Changed Hypotheses

1. **High - External evidence admission is the next substrate layer.** Existing artifact review works for ArrowHedge fixtures; the next risk is admitting foreign state from protocols, tools, memories, logs, and human project artifacts without a normalized evidence contract.
2. **High - Memory retrieval should be validated like a tool observation.** Memory is a durable control channel; its outputs need subject, source, freshness, allowed-use, and tenant checks before entering action review.
3. **Medium-high - Provenance and authorization must be compared, not conflated.** A trace can explain what happened while still showing an unauthorized path. pm-substrate should preserve both actual provenance and authorized-policy context.
4. **Medium-high - Monitoring agents need wait-condition semantics.** Passive/no-op monitoring tasks fail differently from active tool tasks; reaction time and premature/no-op action rates should become eval metrics.
5. **Medium - World models are useful for shadow prediction and offline evaluation, not authority.** A predicted next textual state can guide planning or test expected transitions, but the substrate must revalidate against observed operational state before action.
6. **Medium - Multi-actor audit conflict is a feature, not just noise.** Healthcare-style audit standards expect records from multiple actors in a system-of-systems; missing or conflicting records can reveal state or policy problems.
7. **Medium - State-review artifacts are boundary objects.** They can coordinate humans, agents, and systems if they preserve a stable invariant core while allowing role-specific views.

## 9. Project-Management Implications

Project-management literature remains central. Coordination theory frames coordination as dependency management; shared mental-model evidence says structure matters, not only content; human-AI teaming literature says shared situation awareness must include goals, responsibilities, task environment, AI state, and human state; boundary-object theory explains why one artifact can travel across teams while being interpreted differently.

For pm-substrate, that means a project artifact should not merely summarize status. It should expose:

- the binding source or steward for each claim;
- dependencies and blockers as structured edges;
- the owner or escalation path for invalid or stale facts;
- the valid next action and why it is valid now;
- the human/team handoff condition;
- what is projected, predicted, audited, observed, or authoritative.

Ethical boundary: PM coordination metrics should evaluate shared operational state and system handoff quality, not individual surveillance or automated performance judgment.

## 10. Implementation Implications For pm-substrate

1. **Add an external evidence admission contract.** Candidate shape: `ExternalStateEvidence` or `AdmittedStateEvidence`, with fields for source system, source record id, source type, actor/subject, tenant, observedAt, validUntil, authority rule, action consequence, privacy class, original payload hash, and admission outcome.
2. **Map MCP tools/tasks into artifacts without trusting them by default.** MCP tool annotations and task state are useful metadata; pm-substrate still needs deterministic policy checks before action.
3. **Attach memory retrieval to observed-read-set evidence.** Retrieved memory should produce observed refs and denial/warning reasons when stale, unauthorized, or subject-mismatched.
4. **Support wait-condition artifacts.** Long-running monitor tasks need expected condition, source, reaction deadline, and no-op success semantics.
5. **Add provenance-authorization alignment.** Compare actual source/parameter provenance against intended authority/materials/policy context.
6. **Map OpenLineage/FHIR/in-toto style metadata into source refs.** Use run/job/dataset facets, audit actors, provenance agents/entities, attestation subjects, and predicate types as vocabulary, not as automatic trust.
7. **Introduce run-level artifact groups.** Cross-step failures need hypothesis/evidence groups over multiple artifacts, not isolated review records only.
8. **Create role-specific artifact projections.** Keep one invariant artifact core while generating PM, engineering, audit, and agent-facing views.

## 11. Rejected, Weak, Or Stale Bridges

| Bridge | Status | Reason |
| --- | --- | --- |
| v05 claim that persisted/exported artifacts are still open | Stale | Closed as a pure implementation primitive after v05. |
| v05 claim that no temporal action-to-feedback / feedback-to-observation fixtures exist | Stale | Deterministic ArrowHedge temporal fixture coverage now exists; broader surfaces remain open. |
| MCP tool annotations as authority | Reject | Annotations can describe read-only/destructive intent, but a malicious or stale server can still mislead; substrate policy must validate. |
| MCP durable task state as operational truth | Downgrade | Durable task state is execution evidence, not sufficient authority, source currentness, or business validity. |
| World model prediction as current state | Reject | Predictions can aid planning/eval; they do not prove what the environment currently is. |
| Memory search trust score as authority | Reject | Trust/ranking helps retrieval but not tenant, subject, workflow, or source-owner validity. |
| Provenance-only security | Downgrade | Provenance explains origin; authorization decides whether that origin/action was allowed. |
| Boundary objects as proof of agreement | Downgrade | Boundary objects enable coordination across viewpoints; they can also hide disagreement unless invariant fields and agreement metrics exist. |
| More audit logs always improve safety | Downgrade | Multi-actor audit can reveal conflicts, but indiscriminate logging can violate privacy and overwhelm review. |

## 12. Metrics And Eval Scenarios To Add

New metrics:

- `external_evidence_admission_rate`
- `external_evidence_denial_rate`
- `capability_annotation_policy_mismatch_rate`
- `memory_search_trust_boundary_violation_rate`
- `wait_condition_reaction_time`
- `premature_contact_rate`
- `no_op_false_action_rate`
- `world_model_prediction_disagreement_rate`
- `prediction_to_observation_revalidation_rate`
- `provenance_authorization_alignment_rate`
- `unauthorized_parameter_source_detection_rate`
- `trajectory_hypothesis_verification_rate`
- `cross_artifact_failure_localization_rate`
- `lineage_facet_coverage`
- `dataset_source_version_coverage`
- `multi_actor_audit_conflict_rate`
- `expected_actor_audit_coverage`
- `boundary_object_reinterpretation_gap`
- `dependency_structure_agreement`
- `team_sa_alignment_delta`
- `handoff_condition_resolution_rate`

Eval scenarios:

1. **MCP destructive tool mismatch:** server labels a tool read-only or omits destructive semantics while the actual action mutates project state; artifact should warn or deny admission before action.
2. **MCP durable task stale result:** a deferred task returns after source state changed; artifact should require revalidation before continuity write or next action.
3. **Memory search poisoning:** retrieved memory contains stale or malicious source-owner claims; observed read-set comparison should flag memory-derived unauthorized authority.
4. **Monitoring no-op success:** agent should wait and not act until an external event occurs; premature action should fail even if the final dashboard looks plausible.
5. **World-model shadow disagreement:** predicted next state diverges from authoritative observation; substrate should record prediction as non-authoritative and block direct use as current state.
6. **Provenance/authorization graph mismatch:** actual parameter source differs from clean intent/capability policy; artifact should isolate unauthorized source path.
7. **FHIR-style multi-actor audit conflict:** client and server audit entries disagree about actor, subject, or action; artifact should surface conflict rather than dedupe it away.
8. **Project handoff shard convergence:** agents/humans get partial project shards and must converge on owner/source/blocker/valid next action after seeing a state-review artifact.

## 13. Next-Day Watchlist

1. Decide the smallest code-facing external evidence admission shape and where it belongs: `@pm/agent-state`, `@pm/evals`, or a protocol adapter package.
2. Add one fixture that admits or rejects MCP-like tool/task evidence without integrating a live MCP server.
3. Search official MCP 2025-11 and 2026 draft changes for Tasks, tool annotations, elicitation, authorization, and deprecation policy; avoid citing future release-candidate semantics as current.
4. Prototype memory-search observation evidence and denial reasons in the observed-read-set lane.
5. Add one monitoring/no-op wait-condition fixture inspired by SentinelBench.
6. Add provenance-vs-authorization alignment fields or a separate artifact policy outcome.
7. Decide whether OpenLineage/FHIR/in-toto mappings should be examples, adapters, or generic source-ref facets.
8. Add one PM distributed-state eval measuring dependency-structure agreement and handoff-condition resolution.
9. Keep mutation blocking unclaimed until external side-effect gates exist beyond pure `wouldBlock` policy output.
10. Re-run fetch; if `mmap failed` persists, inspect local Git object health separately from research content.

## 14. Source Inventory With Links And Dates

Recent agent-state / LLM-agent sources:

- Bridging the Agent-World Gap: Text World Models for LLM-based Agents, arXiv preprint/review, submitted 2026-06-08: https://arxiv.org/abs/2606.09032.
- SentinelBench: A Benchmark for Long-Running Monitoring Agents, arXiv preprint/benchmark, June 2026: https://arxiv.org/html/2606.05342v1.
- Beyond Similarity: Trustworthy Memory Search for Personal AI Agents, arXiv preprint, June 2026: https://arxiv.org/html/2606.06054v1.
- Agent libOS: A Library-OS-Inspired Runtime for Long-Running, Capability-Controlled LLM Agents, arXiv preprint, June 2026: https://arxiv.org/html/2606.03895v1.
- Aligning Provenance with Authorization: A Dual-Graph Defense for LLM Agents, arXiv preprint, 2026-05: https://arxiv.org/html/2605.26497v1.
- From Agent Traces to Trust: Evidence Tracing and Execution Provenance in LLM Agents, arXiv preprint/survey, June 2026: https://arxiv.org/html/2606.04990.
- AgentAtlas: Beyond Outcome Leaderboards for LLM Agents, arXiv preprint, 2026-05: https://arxiv.org/html/2605.20530.
- VerifyMAS: Hypothesis Verification for Failure Attribution in LLM Multi-Agent Systems, arXiv preprint, submitted 2026-05-17: https://arxiv.org/abs/2605.17467.
- Why Do Multi-Agent LLM Systems Fail?, arXiv preprint plus source repo, 2025-03 / repo active: https://arxiv.org/pdf/2503.13657 and https://github.com/multi-agent-systems-failure-taxonomy/MAST.
- Toward Reliable Evaluation of LLM-Based Financial Multi-Agent Systems, accepted DMO-FinTech Workshop PAKDD 2026, arXiv preprint, submitted 2026-03-29: https://arxiv.org/abs/2603.27539.
- Towards Engineering Multi-Agent LLMs: A Protocol-Driven Approach, arXiv preprint, submitted 2025-10-14: https://arxiv.org/abs/2510.12120.

Standards / official docs:

- Model Context Protocol specification, 2025-03-26 and 2025-11-25 docs: https://modelcontextprotocol.io/specification/2025-03-26 and https://modelcontextprotocol.io/specification/2025-11-25.
- MCP 2025-03-26 changelog for authorization/tool annotations: https://modelcontextprotocol.io/specification/2025-03-26/changelog.
- MCP Tasks, 2025-11-25 official docs: https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks.
- OpenLineage object model official docs: https://openlineage.io/docs/spec/object-model/.
- FHIR Provenance v6.0.0-ballot4 official docs, 2026 ballot context: https://build.fhir.org/provenance.html.
- FHIR AuditEvent v6.0.0-ballot4 official docs, 2026 ballot context: https://build.fhir.org/auditevent.html.
- in-toto and SLSA provenance overview, official SLSA docs, 2023: https://slsa.dev/blog/2023/05/in-toto-and-slsa.

Project-management / human-AI teaming / coordination sources:

- National Academies, Human-AI Teaming: State-of-the-Art and Research Needs, Chapter 4 Situation Awareness in Human-AI Teams, 2022: https://www.nationalacademies.org/read/26355/chapter/6.
- DeChurch and Mesmer-Magnus, Measuring Shared Team Mental Models: A Meta-Analysis, peer-reviewed meta-analysis, 2010: https://atlas.northwestern.edu/papers/sharedTeam.pdf.
- Star and Griesemer, Institutional Ecology, Translations and Boundary Objects, Social Studies of Science, 1989: https://journals.sagepub.com/doi/10.1177/030631289019003001.
- Malone and Crowston, The Interdisciplinary Study of Coordination, ACM Computing Surveys, 1994: https://dl.acm.org/doi/10.1145/174666.174668.

Source gaps carried forward:

- ContractBench and STALE official code/data locations remain worth re-checking, but this run did not find new authoritative links beyond prior paper-level citations.
- Several June 2026 arXiv sources are new preprints or reviews and should not be treated as peer-reviewed production proof.

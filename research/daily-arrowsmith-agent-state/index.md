# Daily Arrowsmith Agent-State Research Index

Last updated: 2026-06-11
Scope: pm-substrate agent-state, operational-state, memory, workflow-agent, project-management, cross-domain Arrowsmith research, and multi-agent repository coordination.

## Collaboration Protocol

Each daily research continuation must begin by fetching `origin/main` and checking whether other developers or automations added research files, index changes, changelog entries, or relevant implementation changes. If new research exists, the next version must read it, reconcile it with the local draft, and update this index plus the top-level `research/index.md` ledger before publishing.

The run is not complete until the intended research slice is committed on `main`, pushed to `origin/main`, and the local and remote SHAs are rechecked. If parallel research creates duplicate version numbers, preserve the branch artifact when useful, mark the canonical version, and record the reconciliation in the ledger.

## Current Strongest Thesis

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, tool-observation state, or inter-agent communication state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action.

The immediate primitive now exists as a pure review and artifact boundary: `CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + ActionProposalReview + StateReviewArtifact`. The durable artifact lifecycle and first external-evidence frontier are now implemented in code: deterministic JSON/JSONL export/import, replay hash validation, ArrowHedge corpus generation, continuity payload linkage, `state_review_artifact` eval refs, artifact-derived metrics, DB/fixture equivalence helpers, observed read-set comparison, all three temporal misalignment fixture phases, an invariant-class `wouldBlock` policy matrix, and a committed replayable external-evidence admission JSONL corpus. The next proof boundary is runtime consumption plus policy validity: those evidence admissions must cross real capability/workflow write paths and live protocol/runtime handles without being mistaken for authority; release budgets, policy transitions, judge recall, skill-document governance, and real-run PM handoff agreement still need executable proof.

## Versions

| Version | Date | File | Role | Top delta |
| --- | --- | --- | --- | --- |
| Precursor | 2026-06-04 | `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md` | Immediate predecessor, unnumbered | Located the first-principles fault line: parametric state, prompt state, and retrieval memory are not operational state. |
| v01 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` | First numbered daily continuation | Added observation contracts, implicit stale-memory invalidation, read-set validation, stateful workflow evals, and PM shared-cognition implications. |
| v02 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md` | Repo-grounded correction and implementation bridge | Downgraded synthetic eval pass claims, corrected tautological observation-review path, added subject/read-set binding, and made JSON state-review artifacts the next code slice. |
| v03-local | 2026-06-05 | `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-05.md` | Superseded local branch artifact, preserved for provenance | Added CollabSim/ALMANAC, execution-state memory, action-state communication, HarnessFix, WebMCP tool-surface drift, ToolMaze, and TRIAD before syncing with remote `main`. Folded into the ledger rather than treated as canonical latest v03. |
| v03 | 2026-06-06 | `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md` | Artifact/provenance and PM-coordination bridge | Marked v02's pure-review TODOs as closed primitives, shifted the frontier to durable replayable artifacts, trace/provenance/object-role metadata, policy gating, and socio-technical coordination metrics. |
| v04 | 2026-06-07 | `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md` | Canonical artifact lifecycle, preconditions, and coordination-state bridge | Marked `StateReviewArtifact`, ArrowHedge artifact generation, hash replay, and artifact metrics as closed pure primitives; shifted the frontier to persisted/exported artifacts, observed read-set capture, observation-contract v2, artifact-derived evals, and targeted invariant policy. |
| v05 | 2026-06-08 | `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md` | Temporal-state, progressive-constraint, and PM coordination bridge | Added temporal state misalignment phases, AdaPlanBench progressive constraints, typed semantic commit/abort limits, cross-step evidence aggregation, and PM accountability/common-understanding mechanisms; the same-day implementation then closed the first durable ArrowHedge JSON/JSONL artifact lifecycle slice. |
| v06 | 2026-06-09 | `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md` | External evidence admission, protocol/tool task state, and team situation-awareness bridge | Audited v05 against same-day code and marked artifact lifecycle, observed read-set comparison, temporal fixtures, DB/fixture equivalence, and invariant policy as closed pure primitives; shifted the frontier to admitting MCP/tool/task, memory, world-model, monitoring, lineage, audit, attestation, and PM handoff evidence before action. |
| v07 | 2026-06-10 | `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md` | External evidence admission v1, shared verified context, memory retention, and workflow consistency bridge | Confirmed v06's frontier against current code and added June 8-10 evidence from shared-context MAS, observability-safe memory retention, deployment-time memorization, long-horizon professional workflow benchmarks, MCP explicit state handles, and PM/high-reliability coordination sources; recommended a pure `ExternalStateEvidence` / `EvidenceAdmissionReview` code slice. |
| v08 | 2026-06-11 | `research/daily-arrowsmith-agent-state/v08-agent-state-arrowsmith-2026-06-11.md` | Same-day main audit, committed replay closure, and evidence-action/policy bridge | Audited the June 10 upstream landing against remote `main`, closed the remaining durable-proof gap for evidence admission by committing and drift-testing the JSONL replay corpus, and shifted the research frontier to runtime evidence-action binding, ArrowHedge on-disk replay, trajectory release budgets, policy-transition conformance, state-defect recall, skill-document admission, live MCP revalidation, and real-run PM handoff agreement. |

## Top Findings

1. **Operational state is distinct from model, prompt, and memory state.** Weights are parametric state, prompts are inference state, memories are retrieval/continuity state, and pm-substrate should supply current admissible operational state.
2. **Observation contracts are now a major bridge.** Tool artifacts may carry expiry, integrity, permission, and allowed-use constraints that must be validated before action.
3. **Memory invalidation is harder than retrieval.** Newer evidence must invalidate stale premises and downstream behavior, not merely appear in search results.
4. **Raw episodes/events should survive summaries.** Summaries are derived views; raw tool observations and event records remain first-class evidence.
5. **Read-set validation turns the thesis into an execution contract.** High-consequence actions should follow read -> propose -> validate -> write.
6. **Project management maps to shared operational cognition.** The PM layer should expose what is known, who/source owns it, what changed, what is blocked, and which next actions are valid.
7. **Action review now has the original-observation primitive.** The next gap is artifact durability and replay, not merely passing an old observation into the pure helper.
8. **Eval maturity labels now matter.** The repo has scaffolded scenarios, detected warnings, and assertion metrics, but not yet mutation blocking or paired behavioral improvement for every claim.
9. **Subject identity is part of action validity.** The pure validator now detects `subject_mismatch`; multi-object roles remain the next object-centric gap.
10. **Provenance, trace, and event standards sharpen artifact shape.** PROV, Trace Context, CloudEvents, and OCEL are not authority systems, but they describe the metadata needed for replayable operational-state evidence.
11. **Project state should measure coordination fit.** Socio-technical congruence and transactive memory point toward owner/source/dependency/handoff metrics, not just task-status completeness.
12. **State-review artifacts now exist as durable code with first coverage primitives.** The implemented lifecycle now covers JSON/JSONL export/import, hash replay, eval linkage, continuity payload linkage, artifact-derived metrics, DB/fixture equivalence helpers, observed read-set comparison, temporal phase fixtures, and invariant policy recommendations.
13. **Observed read sets now have a pure comparison lane.** S-Bus still strengthens the case for reconstructing what agents actually read; the open gap is runtime capture from real tool invocations, not the comparison primitive.
14. **Observation contracts need integrity and binding fields.** RFC 9110, DPoP, HTTP Message Signatures, OAuth Token Exchange, and ContractBench sharpen freshness-only contracts into precondition, signature/integrity, holder/request-binding, and delegation questions.
15. **Coordination is not just communication volume.** Silo-Bench and team-situation-awareness work point toward convergence on correct distributed state as the PM metric.
16. **Research itself is now a substrate test.** Multiple developers and automations are producing research and code; every daily run must pull `main`, inspect new research/code, integrate findings into the ledger, and push back to `main`.
17. **Temporal drift has more than one phase.** ArrowHedge now has deterministic fixture coverage for observation-to-action, action-to-feedback, and feedback-to-observation; the open gap is broader surface coverage.
18. **Progressively disclosed constraints are a better eval shape than one-shot full specs.** AdaPlanBench-style staged constraints map to authority, freshness, workflow, and user/policy constraints revealed across attempts.
19. **Semantic consensus is evidence, not authority.** Typed semantic commit/abort protocols are useful provenance vocabulary, but source authority, tenant, subject, workflow, and read-set checks remain deterministic substrate concerns.
20. **Project COP should produce accountability, predictability, and common understanding.** PM literature supports owner/source/escalation and agreement metrics over richer dashboards alone.
21. **External task/tool state is evidence, not authority.** MCP Tasks, tool annotations, and authorization docs provide useful protocol vocabulary, but substrate admission must still validate source, subject, tenant, freshness, consequence, and workflow position.
22. **Memory search is a trust boundary.** Retrieved memories can reshape task interpretation and action selection, so memory outputs need the same source/ref validation as tool observations.
23. **World models are prediction state.** Text world models can support planning and offline evaluation, but predicted next state must be compared to observed authoritative state before action.
24. **Audit redundancy can expose conflicts.** FHIR-style multi-actor audit/provenance standards suggest duplicate or conflicting records from clients, servers, and intermediaries can be useful substrate warnings.
25. **PM artifacts are boundary objects with invariant cores.** State-review artifacts can travel across product, engineering, ops, audit, and agent roles only if stable invariant fields survive role-specific projections.
26. **Shared context must be admitted, not merely shared.** DeLM-style shared verified context strengthens the substrate thesis, but the transfer mechanism is admission-time verification plus read/write discipline, not a shared scratchpad.
27. **Memory retention now needs deletion, observability, and residue metadata.** Observability-safe memory retention and deployment-time memorization add stale-information risk, online-observable features, deletion mode, and forgetting residue as admission fields.
28. **Workflow consistency is an explicit eval axis.** Workflow-GYM, T1-Bench, ALEM, Emergence World, and SKILL.nb point to workflow-stage omission, objective drift, error propagation, and environment drift as artifact-sequence failures.
29. **MCP state handles are addressability, not authority.** The 2026 MCP release candidate and SEP-2567 support explicit state handles, but handles and tool annotations remain evidence needing substrate validation.
30. **PM handoffs need expertise, authority, and escalation state.** Faraj/Xiao, Bigley/Roberts, Lewis, Hsu et al., and handoff safety literature point to owner/source/expertise/escalation fields as executable PM state.
31. **Committed replay artifacts are part of the proof boundary.** If evidence admission only passes in memory, the substrate cannot honestly claim durable replay for that lane; checked-in corpora and drift tests matter.
32. **Privacy/release validity is trajectory-level.** OCELOT strengthens the bridge that individually acceptable disclosures can cumulatively leak protected facts; pm-substrate needs release-budget fixtures before privacy claims.
33. **Explicit policy conformance is separate from evidence currentness.** The finite-state social-simulation paper shows LLM action selection can drift from a reference policy; fresh evidence does not imply a valid workflow transition.
34. **LLM judges need state-defect recall metrics.** The production transaction-agent study shows automated judges can miss cross-turn state and guardrail defects when rubrics route them to non-operational buckets.
35. **Skill documents are governance evidence.** SkillAxe improves skill quality, but skill trigger/version/scope metadata must be admitted before skills silently affect valid action.

## Source Changes

### Added on 2026-06-05

- STALE, 2026-05-07 arXiv preprint/benchmark: implicit conflict, state resolution, premise resistance, policy adaptation.
- Useful Memories Become Faulty, 2026-05-13 arXiv preprint: continuous LLM-written consolidation can degrade; preserve raw episodes.
- ContractBench, 2026-05-17 arXiv preprint/benchmark: observation contracts with temporal validity and byte-level integrity.
- STATE-Bench official repo/release post, May 2026: stateful enterprise tasks with deterministic state assertions and pass^5 reliability.
- Claw-Eval-Live, April/May 2026: live workflow benchmark with service state, audit logs, and post-run workspace artifacts.
- Mental model discrepancy detection, 2026 arXiv preprint: unsupported beliefs, false beliefs, contradictions, omissions.
- PMI Pulse 2026 and PM teamwork bibliometrics: complexity, coordination, shared mental models/transactive memory, and trust as recurring PM mediators.

### Added on 2026-06-05 v02

- Agent Memory systems characterization, 2026-06-04 arXiv preprint: memory systems have construction/retrieval/generation tradeoffs and freshness-latency implications, but do not supply authority by themselves.
- Recuse Signal, 2026-06-04 arXiv preprint: cooperative in-band deny signals can guide agents but are explicitly not enforcement boundaries.
- Handoff Debt, 2026-06-01 arXiv preprint: structured handoff views reduce successor-agent rediscovery cost, giving continuity a measurable handoff-efficiency target.
- S-Bus, 2026-05 arXiv preprint: server-observed read-set reconstruction and Observable-Read Isolation map directly to multi-agent stale-read validation.
- Constraint Drift, 2026-05 arXiv preprint: constraints must remain fresh, inherited, enforceable, and auditable across memory, delegation, communication, tool use, and audit.
- Automated Benchmark Auditing, 2026-05 arXiv preprint: complex agent benchmarks often contain hidden dependencies, specification gaps, and brittle grading logic.
- Wegner 1987, Espinosa/Lerch/Kraut 2004, Marks/Mathieu/Zaccaro 2001, and COP sources: strengthened PM handoff, shared cognition, explicit coordination, and common situational understanding bridges.

### Added on 2026-06-05 v03-local

- CollabSim and ALMANAC, 2026-06-04 arXiv preprints: action-level collaborative competence, mental-model annotations, common ground, partner intent, shared goals, and misalignment repair.
- MAGE and MemGate, 2026-06-04 arXiv preprints: execution-state memory and memory search as a trust boundary.
- PACT, 2026-06-03 arXiv preprint: inter-agent communication as compact action-state records before shared history.
- HarnessFix, 2026-06-04 arXiv preprint: trace-guided provenance and harness-layer failure attribution.
- WebMCP Tool Surface Poisoning, 2026-06-04 arXiv preprint: dynamic tool metadata/origin/lifecycle drift as an agent authority surface.
- ToolMaze and TRIAD, 2026-06-04 arXiv preprints: implicit semantic tool failures and guardrail feedback as remediation, not deterministic enforcement.

### Added on 2026-06-06 v03

- W3C PROV-DM, W3C Trace Context, CloudEvents, and OCEL 2.0: standards-backed vocabulary for provenance, trace correlation, event envelopes, and object-centric process records.
- HearthNet and Message Sequence Chart LLM-agent coordination preprints: useful analogies for stale/unauthorized command rejection and protocol-level coordination guarantees, but not enterprise proof.
- Cataldo/Herbsleb/Carley socio-technical congruence and Lewis transactive memory: stronger PM bridge for dependency-owner coordination and owner/source-of-truth metadata.
- ISO 21502, human-agentic teaming, and human-AI mental-model work: useful PM/team framing, but only Medium/Low as direct architecture proof.

### Added on 2026-06-07 v04

- S-Bus paper, source repo, and benchmark dataset: implemented read-set reconstruction/ORI bridge, with explicit production-hardening limits.
- Claw-Eval-Live official site and repo: released tasks, fixtures, mock services, grader scripts, and trace CLI for live workflow evaluation architecture.
- Silo-Bench paper and repo: communication-reasoning gap, coordination cost, communication density, and distributed-state synthesis as multi-agent metrics.
- From Agent Traces to Trust: June 2026 provenance survey supporting unified trace schemas, claim/action provenance, recovery-oriented eval, and privacy-aware audit.
- RFC 9110, RFC 9449, RFC 9421, and RFC 8693: standards vocabulary for preconditions, proof-of-possession, signed-component expiry/integrity, and delegation/actor chains.
- Coordination-requirement scalability, Team Situation Awareness measurement, and 2021 socio-technical congruence work: PM metrics should be scalable, agreement-based, and outcome-tested rather than overclaimed.

### Added on 2026-06-08 v05

- AdaPlanBench paper, official repo, and dataset: progressive world/user constraint disclosure, repeated violations, valid-plan rate, and run artifacts sharpen ArrowHedge fixture design.
- TIDE temporal state misalignment and LOCOMO-CONV OpenReview submissions: temporal validity and implicit/composed conversational memory gaps extend v04's stale-read framing.
- H-CSC, TRACE, DuMate-DeepResearch, Tree-of-Experience, OPENPATH, and encrypted multi-agent control preprints: typed semantic commit/abort, cross-step evidence, auditable tool traces, structured experience validation, deterministic specialist enforcement, and privacy-aware state-estimation bridges.
- Chandy-Lamport distributed snapshots, Kung/Robinson OCC, Garcia-Molina/Salem sagas, Lewis transactive memory, Faraj/Sproull expertise coordination, Okhuysen/Bechky coordination mechanisms, and COP/common-situational-understanding sources: older mechanisms for consistent snapshots, read validation, long-lived transactions, expertise/authority location, accountability, predictability, and common understanding.

### Added on 2026-06-09 v06

- Bridging the Agent-World Gap / text world models, SentinelBench, Beyond Similarity memory-search security, Agent libOS, AuthGraph, Evidence Tracing and Execution Provenance, AgentAtlas, VerifyMAS, MAST, finance-MAS evaluation, and SEMAP: new agent-state bridge sources for prediction-vs-authority, monitoring lifecycle, memory trust boundaries, capability-controlled runtimes, provenance-vs-authorization, trajectory-level attribution, and protocol/lifecycle engineering.
- MCP official specs for tasks, tools, authorization, and tool annotations: protocol task state and tool metadata become evidence inputs, not automatic substrate authority.
- OpenLineage, FHIR Provenance, FHIR AuditEvent, and in-toto/SLSA: standards vocabulary for run/job/dataset lineage, multi-actor audit/provenance, and attestable subjects/predicates/materials.
- National Academies human-AI situation-awareness chapter, DeChurch/Mesmer-Magnus shared mental-model meta-analysis, Star/Griesemer boundary objects, and Malone/Crowston coordination theory: PM artifacts should expose structured dependencies, source/owner/handoff state, and invariant fields that survive role-specific interpretation.

### Added on 2026-06-10 v07

- Workflow-GYM, T1-Bench, WeaveBench, ALEM, Emergence World, and SKILL.nb: long-horizon professional/GUI/open-ended workflows make workflow-stage omission, objective drift, error propagation, environment drift, gate-conditioned execution, and artifact-sequence evaluation first-class eval targets.
- DeLM shared verified context, ActiveMem distributed memory, OSL-MR observability-safe memory retention, Deployment-Time Memorization, H2HMem, and spatial-memory occlusion work: shared context and memory mechanics improve coordination/retention, but require admission metadata for source, authority, observability, deletion residue, modality, visibility, and stale-information risk.
- MCP 2025-11-25 current spec, 2026 roadmap, tool-annotation risk post, 2026-07-28 release candidate, and SEP-2567 explicit state handles: protocol state is becoming more addressable, but annotations and handles remain untrusted evidence until substrate admission.
- Faraj/Xiao fast-response coordination, Bigley/Roberts incident command, Endsley situation awareness, Lewis TMS field measure, Hsu et al. IS development TMS, and AHRQ handoff safety: PM state-review artifacts need expertise owner, source steward, authority/escalation owner, handoff condition, and valid-next-action fields.

### Added on 2026-06-11 v08

- Evidence-admission replay corpus: `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` plus drift testing makes the external-evidence admission lane durable and replayable instead of only in-memory.
- OCELOT: trajectory-level inference-leakage budgets, witness-verified declassification, sink trust, and tamper-evident budget ledgers as privacy/release-control bridge concepts.
- Finite-state vs LLM action policies in social simulations: explicit reference policies can be distorted by LLM action selection and prompt/model bias, supporting policy-transition conformance fixtures.
- Catching One in Five: production multi-turn transaction-agent judge failures expose low recall for cross-turn state, guardrail, recovery, and stale-reference defects when rubric routing is wrong.
- SkillAxe: skill documents need trigger precision, instruction compliance, fault attribution, and solution-path coverage checks before they become trusted agent policy.
- MCP latest spec, roadmap, and SEP-2567 re-check: 2025-11-25 remains the latest dated spec page, task expiry/retry/audit gaps remain active roadmap items, and SEP-2567 leaves handles as ordinary strings rather than authoritative state.
- Humans' ALMANAC and human-AI mental-model work: real PM handoffs should measure actor intent, partner intent, shared goal, and source/owner agreement rather than only synthetic handoff facets.

## Corrected Claims

- v02's open items for `subject_mismatch`, original-observation review, `evaluatedAt`, explicit advisory/blocking mode, and evidence maturity stages are now treated as closed pure primitives after local code/changelog inspection.
- `StateReviewArtifact` is no longer future work: pure construction, ArrowHedge generation, related objects, PROV-style links, trace context, canonical hash verification, tamper detection, and artifact metrics exist.
- Persisted/golden JSON artifacts remain open: current tests build artifacts in memory, and no stable artifact export/import path was found.
- Trace correlation is partial: artifacts carry optional trace context and metrics count coverage, but there is no full join across source reads, projection, proposal review, eval event, and downstream write.
- Socio-technical congruence was downgraded from broad project-quality predictor to bounded coordination diagnostic after adding mixed/negative longitudinal evidence.
- ContractBench and STALE source-code/data availability remains a source gap until direct official repo/dataset links are located.
- Research automation must now treat `research/index.md` as the shared ledger and update it after pulling `main`.
- v05 corrects the temporal-state claim: current ArrowHedge review primitives primarily prove observation-to-action validation; action-to-feedback and feedback-to-observation drift need explicit artifact stages and fixtures.
- v05 corrects the semantic-consensus bridge: typed commit/abort protocols are useful as provenance and finality vocabulary, not as source authority.
- v05 keeps v04's artifact-lifecycle gap open: no persisted/exported ArrowHedge JSON artifact corpus or artifact-to-eval-event linkage was found.
- v06 corrects v05's implementation frontier: durable artifacts, artifact-to-eval refs, observed read-set comparison, temporal misalignment fixtures, DB/fixture equivalence, and invariant-class policy are now closed pure primitives.
- v06 narrows the next frontier from "more artifact lifecycle" to external evidence admission: protocol task state, memory retrieval, monitoring events, world-model predictions, lineage, audit, and PM handoff artifacts must be validated before action.
- v06 keeps mutation blocking limited: invariant policy now reports recommendations, but external side-effect enforcement remains unclaimed.
- v07 confirms v06's implementation correction against current code: observation reports, action proposal reviews, durable artifacts, temporal ArrowHedge corpora, artifact-derived metrics, DB/fixture equivalence, and policy `wouldBlock` outputs are existing pure primitives rather than the next code slice.
- v07 corrects the external-state frontier: MCP explicit state handles and shared-context MAS designs strengthen addressability, but the missing pm-substrate mechanism is admission-time validation before evidence becomes a `StateRef` or action-review input.
- v07 adds memory deletion and observability as state-review concerns: memory retrieval should carry deletion mode/residue risk, retention policy, online-observable feature boundaries, source modality, and stale-information risk.
- v07 adds professional workflow consistency as an eval axis: stage omission, objective drift, error propagation, and environment drift should be detected across artifact run groups, not only final outcomes.
- v08 narrows the remaining golden-artifact gap: evidence-admission reviews now have a committed replay corpus and drift test; the still-open on-disk corpus gap is ArrowHedge artifact persistence, not admission-review persistence.
- v08 corrects the broader frontier: external evidence admission is now durable as a pure/replayable lane, while runtime evidence-action binding, release budgets, policy-transition conformance, state-defect recall, skill-document admission, live MCP revalidation, and real-run PM handoff agreement remain open.
- v08 corrects the MCP status wording: the official spec page still shows 2025-11-25 as latest on 2026-06-11, while SEP-2567 is an official SEP; handles remain ordinary tool strings and explicit handle marking is left to future work.

## Downgraded Claims

- RAG-only state claims are downgraded: retrieval helps access but does not supply authority, invalidation, workflow validity, or mutation safety.
- Continuous memory consolidation is rejected as a safe default until gated by raw evidence and regression tests.
- Synthetic eval pass claims are downgraded to scaffold/provisional until outcomes are derived from executable assertions or observed behavior.
- Trace context is downgraded as authority: it provides correlation, not validity or permission.
- Standards are structure, not proof. PROV, Trace Context, CloudEvents, HTTP/OAuth standards, ISO 21502, and OCEL describe useful metadata, but pm-substrate still needs executable validation.
- Research files are downgraded as durable shared memory unless backed by fetch/merge/push discipline and the top-level ledger.
- Semantic consensus is downgraded as an authority mechanism unless backed by substrate source refs, tenant/subject checks, workflow position, and read-set validation.
- Memory belief-clarity metrics are downgraded as operational-state proof; they diagnose summary quality but do not establish currentness or authority.
- Proactive hidden-problem discovery is downgraded as direct action; findings should become evidence-linked warnings/proposals first.
- MCP/task/tool protocol metadata is downgraded as operational truth; it is useful evidence only after substrate admission.
- World-model predictions are downgraded as current-state proof; they are advisory prediction/eval artifacts until reconciled with observed authoritative state.
- Memory-search trust scores are downgraded as authority; memory remains a control channel that requires source, subject, freshness, and workflow validation.
- Boundary objects are downgraded as agreement proof unless invariant fields and agreement metrics show cross-role convergence.
- Shared verified context is downgraded as authority unless every write has admission status, source refs, freshness, read/write discipline, and invalidation semantics.
- Active/distributed/observability-safe memory is downgraded as operational-state proof; it improves retention and reasoning cost tradeoffs but cannot establish authority, deletion fidelity, or currentness alone.
- MCP 2026-07-28 release-candidate semantics are downgraded as current behavior until the final dated spec ships; they are useful design direction, not current protocol truth.
- Multi-agent consensus remains downgraded after Consistency Illusion: answer agreement can hide incompatible grounds unless claims cite sources and stances.
- Long-horizon benchmark final success rates are downgraded as sufficient state proof; pm-substrate needs intermediate artifact-sequence assertions for omitted stages and objective drift.
- Per-evidence privacy checks are downgraded as sufficient privacy proof; agent releases can leak cumulatively across a trajectory and sink set.
- LLM-as-judge agreement is downgraded as eval quality unless recall is measured against state-failure classes and gate-routing errors.
- Skill self-refinement is downgraded as governance; skills remain instruction artifacts until version, trigger, scope, and fault coverage are admitted.
- Fresh admitted evidence is downgraded as policy conformance; explicit workflow/policy transitions still need validation.

## Rejected Bridges

1. Model weights as operational memory.
2. Bigger context window as a state solution.
3. RAG-only state layer.
4. Continuous memory rewrite as default improvement.
5. Protocol-only interoperability.
6. Chat transcript as common operating picture.
7. LLM semantic mapping as direct authority.
8. Biological quorum/stigmergy as direct business authority proof.
9. More agents as proof of better coordination without normalized evals.
10. Research files as durable memory without fetch/merge/push discipline.
11. External protocol task state as direct business authority.
12. Tool or memory trust metadata as a replacement for source authority.
13. World-model predicted state as current operational state.
14. Shared context without admission-time verification.
15. Explicit protocol state handles as current operational state.
16. Memory retention policy as deletion proof without residue checks.
17. Multi-agent answer consensus as reasoning or source-authority alignment.
18. External evidence admission as runtime mutation enforcement.
19. Individual redaction checks as complete trajectory privacy protection.
20. Automated judge agreement as cross-turn state-defect coverage.

## Current Implementation Implications

1. Consume evidence-admission reviews in capability/workflow runtime write paths before any side-effecting action claims stronger enforcement.
2. Keep MCP-like task/tool annotations and explicit state handles in the admission lane; prove the same rules against live protocol/runtime handles, not only pure fixtures.
3. Persist a canonical ArrowHedge on-disk artifact corpus so both the action-review lane and the evidence-admission lane have committed replay artifacts.
4. Add trajectory release-budget fixtures with sink trust, data class, cumulative budget, release atoms, and declassification reason.
5. Add explicit policy-transition conformance fixtures where fresh admitted evidence supports a fact but the proposed workflow transition is invalid.
6. Add LLM-judge recall metrics for stale referents, stale owner/blocker, confirm-gate lockout, recovery/escalation failure, workflow-phase mismatch, and guardrail defects.
7. Treat skill documents as external evidence when they affect action selection; start with trigger/version/scope fixtures before adding a broad abstraction.
8. Run `comparePmHandoffAgreement` over real multi-agent ArrowHedge or automation runs and compare against rediscovery cost and time-to-valid-action.
9. Keep invariant policy as advisory until a runtime enforcement boundary exists and false-block metrics are available.
10. Make every daily research automation pull or remotely verify `main`, inspect new research/code, update the relevant chain-specific index and top-level `research/index.md`, commit, and push.

## Metrics Queue

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
- `artifact_generation_rate`
- `review_artifact_generation_rate`
- `review_replay_fidelity`
- `artifact_hash_mismatch_rate`
- `trace_join_coverage`
- `orphan_review_rate`
- `object_role_coverage`
- `wrong_object_action_rate`
- `assertion_failure_by_code`
- `warning_assertion_alignment_rate`
- `subject_mismatch_detection_rate`
- `synthetic_eval_pass_count`
- `scaffolded_scenario_count`
- `detected_warning_count`
- `blocked_mutation_count`
- `db_fixture_equivalence_rate`
- `coordination_congruence_gap`
- `dependency_owner_resolution_time`
- `shared_state_convergence_rate`
- `persisted_artifact_count`
- `artifact_schema_validation_rate`
- `artifact_export_import_fidelity`
- `artifact_to_eval_event_link_rate`
- `observed_read_set_coverage`
- `undeclared_read_dependency_rate`
- `multi_object_precondition_coverage`
- `holder_binding_failure_rate`
- `signature_integrity_failure_rate`
- `warning_evidence_link_rate`
- `coordination_cost_per_correct_action`
- `coordination_requirement_precision`
- `salient_event_agreement`
- `artifact_linked_checkpoint_rate`
- `research_sync_delta_count`
- `research_claim_ledger_update_count`
- `research_merge_conflict_resolution_count`
- `temporal_misalignment_phase_coverage`
- `observation_to_action_stale_rate`
- `action_to_feedback_drift_rate`
- `feedback_to_observation_revalidation_rate`
- `constraint_repeated_violation_rate`
- `progressive_constraint_resolution_rate`
- `common_understanding_delta`
- `expertise_owner_resolution_rate`
- `handoff_revalidation_success_rate`
- `external_evidence_admission_rate`
- `external_evidence_denial_rate`
- `external_evidence_warning_by_code`
- `external_evidence_warning_by_severity`
- `capability_annotation_policy_mismatch_rate`
- `explicit_state_handle_revalidation_rate`
- `memory_search_trust_boundary_violation_rate`
- `memory_deletion_residue_rate`
- `offline_supervision_leak_rate`
- `stale_information_retention_rate`
- `wait_condition_reaction_time`
- `premature_contact_rate`
- `no_op_false_action_rate`
- `workflow_stage_omission_rate`
- `objective_drift_warning_rate`
- `world_model_prediction_disagreement_rate`
- `prediction_to_observation_revalidation_rate`
- `provenance_authorization_alignment_rate`
- `unauthorized_parameter_source_detection_rate`
- `trajectory_hypothesis_verification_rate`
- `cross_artifact_failure_localization_rate`
- `artifact_run_group_failure_localization_rate`
- `lineage_facet_coverage`
- `dataset_source_version_coverage`
- `multi_actor_audit_conflict_rate`
- `expected_actor_audit_coverage`
- `boundary_object_reinterpretation_gap`
- `reasoning_alignment_missing_rate`
- `grounded_claim_coverage`
- `dependency_structure_agreement`
- `team_sa_alignment_delta`
- `handoff_condition_resolution_rate`
- `pm_handoff_condition_stale_rate`
- `escalation_owner_resolution_rate`
- `write_without_admission_review_rate`
- `admission_to_write_link_rate`
- `trajectory_leakage_budget_exceeded_rate`
- `least_disclosing_release_rate`
- `policy_transition_deviation_rate`
- `prompt_induced_action_bias_rate`
- `state_defect_recall`
- `judge_routing_miss_rate`
- `skill_trigger_false_positive_rate`
- `skill_version_drift_warning_rate`
- `handle_revalidation_rate`
- `expired_handle_use_rate`
- `handoff_goal_alignment_rate`
- `partner_intent_resolution_rate`
- `time_to_valid_action_after_handoff`

## Next-Day Watchlist

1. Inspect the smallest runtime boundary where `EvidenceAdmissionReview` ids can be required before workflow/capability writes.
2. Persist a canonical ArrowHedge on-disk state-review artifact corpus alongside the now-committed admission-review JSONL corpus.
3. Add a trajectory release-budget fixture family inspired by OCELOT: sink trust, data class, cumulative budget, release atoms, and declassification reason.
4. Add explicit policy-transition fixtures where admitted evidence is current but the proposed workflow transition is invalid.
5. Add state-defect recall metrics for LLM judges and route/gate failures: stale referent, stale owner/blocker, confirm-gate lockout, escalation failure, workflow mismatch.
6. Treat skill documents as external evidence in one fixture path: version, trigger precision, scope, owner, and fault-coverage metadata.
7. Exercise MCP admission against a local/live fixture server for handle expiry, annotation trust, task-result revalidation, and cleanup metadata.
8. Run PM handoff agreement on real multi-agent ArrowHedge or automation runs and compare to rediscovery cost and time-to-valid-action.
9. Re-check primary code/data availability for OCELOT, Catching One in Five, the finite-state social-simulation paper, ContractBench, and STALE.
10. Keep mutation blocking unclaimed until external side-effect gates exist beyond pure `wouldBlock` policy output.
11. Audit the `automation-pre-ff-research-pm-substrate-2026-06-11` stash separately; do not apply it automatically during research continuation.
12. Run every daily research automation through fetch or remote-SHA verification -> inspect -> integrate -> ledger -> commit -> push and record any conflict handling as substrate evidence.

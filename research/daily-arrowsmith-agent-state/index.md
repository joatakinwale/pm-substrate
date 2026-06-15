# Daily Arrowsmith Agent-State Research Index

Last updated: 2026-06-15
Scope: pm-substrate agent-state, operational-state, memory, workflow-agent, project-management, cross-domain Arrowsmith research, and multi-agent repository coordination.

## Collaboration Protocol

Each daily research continuation must begin by fetching `origin/main` and checking whether other developers or automations added research files, index changes, changelog entries, or relevant implementation changes. If new research exists, the next version must read it, reconcile it with the local draft, and update this index plus the top-level `research/index.md` ledger before publishing.

The run is not complete until the intended research slice is committed on `main`, pushed to `origin/main`, and the local and remote SHAs are rechecked. If parallel research creates duplicate version numbers, preserve the branch artifact when useful, mark the canonical version, and record the reconciliation in the ledger.

## Current Strongest Thesis

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, tool-observation state, or inter-agent communication state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action.

The immediate primitive now exists as a pure review and artifact boundary: `CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + ActionProposalReview + StateReviewArtifact`. The durable artifact lifecycle and first external-evidence frontier are now implemented in code: deterministic JSON/JSONL export/import, replay hash validation, ArrowHedge corpus generation, continuity payload linkage, `state_review_artifact` eval refs, artifact-derived metrics, DB/fixture equivalence helpers, observed read-set comparison, all three temporal misalignment fixture phases, an invariant-class `wouldBlock` policy matrix, and committed replayable corpora for external-evidence admission, ArrowHedge state-review artifacts, and write-binding attempts.

The current frontier is now broader and more precise: selected write-capable workflow dispatch can block missing, incomplete, policy-blocked, catalog-unverified, or certificate-invalid evidence bindings when `evidenceBindingMode: "require_for_writes"` is enabled, but broad mutation governance remains unclaimed. The replay/catalog lane now includes deterministic admission certificate ids/digests, validity windows, policy version, revocation epoch, execution identity, and strict tenant/workflow replay checks. v13 closes one previously open pure primitive from v12: memory writes and memory retrievals are now typed separately, recalled memory is classified as fact/preference/instruction/tool-routing/policy-like-rule/summary, and replay fixtures warn when control-influencing memory lacks override metadata or is already overridden. The remaining proof boundary is durable certificate/status verification, target-side receipt evidence, memory-store/runtime enforcement beyond replay fixtures, policy-transition checks, final-state verification, and PM protocol-burden measurement.

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
| v09 | 2026-06-12 | `research/daily-arrowsmith-agent-state/v09-agent-state-arrowsmith-2026-06-12.md` | Fast-forward implementation audit, write-binding/replay correction, and runtime-enforcement bridge | Audited upstream ArrowHedge artifact corpus, write-binding replay, opt-in workflow gate, catalog verifier, and replay dashboard; corrected stale v08 open claims; added new bridges from memory evolution, executable tool wrappers, agentified evals, compiled corrections, memory compaction, environment engineering, runtime-enforcement foundations, and PM risk/communication-under-uncertainty sources; recommended durable verification catalogs and transport coverage metrics. |
| v10 | 2026-06-12 | `research/daily-arrowsmith-agent-state/v10-agent-state-arrowsmith-2026-06-12.md` | Post-catalog audit, certificate/delivery/memory-control bridge, and PM scaffolding correction | Audited the replay-backed verification catalog and write-transport coverage implementation now on `main`; marked the v09 code slice partially closed; added bridges from certificate-bound admission, cross-channel delivery failure, memory-control-flow attacks, evidence-first diagnosis, state-based real-environment benchmarking, AgentOps, MAS marginal-utility evaluation, and human-AI teamwork/scaffolding field experiments; shifted the next frontier to durable certificate/store verification, target-side delivery confirmation, memory influence review, state-based final-environment checks, role-utility metrics, and PM protocol-burden measurement. |
| v11 | 2026-06-12 | `research/daily-arrowsmith-agent-state/v11-agent-state-arrowsmith-2026-06-12.md` | Certificate-bound replay implementation and tenant-alignment correction | Converted v10's certificate-bound admission frontier into workflow/evals code; added certificate-aware catalog verification, deterministic replay certificate ids/digests, recomputed committed-row replay, and tenant-aligned ArrowHedge evidence-admission/write-binding/state-review corpora; kept signed production certificates, DB-backed stores, target-side delivery confirmation, memory-control-flow, and PM burden metrics open. |
| v12 | 2026-06-13 | `research/daily-arrowsmith-agent-state/v12-agent-state-arrowsmith-2026-06-13.md` | Status-bearing evidence, memory influence, target receipts, and PM burden bridge | Audited v11's certificate-bound replay boundary against new memory-poisoning, memory-control-flow, workflow-verification, multimodal-memory, VC/status, MCP, OpenTelemetry, and human-AI teaming sources; kept replay certificates scoped and shifted the next frontier to durable certificate/status stores, target-side receipts, memory-write/read influence admission, policy-transition mini-specs, final-state checks, and protocol-burden metrics. |
| v13 | 2026-06-15 | `research/daily-arrowsmith-agent-state/v13-agent-state-arrowsmith-2026-06-15.md` | Memory write admission and memory-influence taxonomy closure | Converted v12's memory frontier into code: `memory_write` is now a first-class evidence kind, memory writes require source-channel/intended-use metadata, recalled memory is classified by influence kind, control-influencing memory needs override metadata, and replay fixtures/metrics now cover hidden-instruction writes, clean preference writes, and overridden tool-routing memory. |

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
36. **ArrowHedge state-review and write-binding replay corpora are now part of the proof boundary.** v09 corrects v08: the open question is no longer persistence for those lanes, but durable verification and runtime coverage.
37. **Opt-in write binding is real but scoped.** Selected workflow dispatch can now block bad bindings, yet full mutation governance remains false until every external write transport uses a substrate-owned verifier.
38. **Executable tool wrappers increase hidden-dependency risk.** HyperTool-style nested calls make subcall read/write refs part of the observed read-set problem.
39. **Memory evolution and compaction need lineage.** Patches, supersession, deletion residue, and compaction decisions are state-bearing artifacts, not authority by themselves.
40. **Compiled corrections and skills are policy evidence.** TRACE-style runtime rules and skill documents need owner, trigger, scope, version, and source admission before they affect valid action.
41. **Runtime enforcement claims need monitorability classes.** Some invariants can be blocked before write; others are only detectable after execution or by audit/compensation.
42. **PM status, risk, and handoff updates are actions under uncertainty.** Shared mental-model and POMDP communication work imply status announcements should be reviewed for stale risk, authority, and update cost.
43. **Fixture-backed verification catalogs are now replay proof, not durable authority.** v10 corrects v09: committed corpora can now build and test an `EvidenceBindingReferenceCatalog`, but live stores, revocation, policy version, execution identity, and all-transport runtime adoption remain unproven.
44. **Cross-channel delivery needs target-side confirmation.** Scheduled or delegated state writes can silently fail even when dispatch reports success; pm-substrate should admit delivery only after the target channel proves receipt.
45. **Memory can steer control flow.** Retrieved memory that changes tool choice or action ordering is a control input, not passive context.
46. **More agents need marginal-utility proof.** Multi-agent workflows should show unique evidence contribution, conflict reduction, or faster valid action against a single-agent baseline.
47. **PM scaffolding has a burden budget.** Human-AI field experiments show collaboration protocols can improve some outcomes while harming quality, throughput, or diversity; handoff structure must be measured, not assumed good.
48. **Certificate-bound replay is now implemented but scoped.** v11 adds certificate-aware catalog verification and tenant-aligned committed corpora, but signed production certificates, DB-backed revocation, and all-transport adoption remain open.
49. **Replay certificates need durable status authority.** v12 maps W3C VC/Data Integrity/Status List vocabulary onto pm-substrate: issuer/proof/status/revocation fields are useful only when checked against a durable substrate-owned source.
50. **Memory writes are admissions, not personalization magic.** June 2026 memory-poisoning work strengthens the claim that memory creation needs source, channel, intended-use, expiry, and review metadata.
51. **Memory reads can be control inputs.** Memory-control-flow attacks make retrieved memory a tool-routing or policy-interpretation influence, not merely passive context.
52. **Target receipts are separate evidence.** Dispatch logs prove attempted send; target-side receipt events are needed before scheduled, memory, subagent, or PM handoff writes become shared state.
53. **Workflow verification should start as small transition specs.** Lean4Agent-style formalization is useful, but pm-substrate should first add deterministic policy-transition fixtures before broad formal-methods claims.
54. **Multimodal PM memory needs participant/source roles.** H2HMem and M3Exam strengthen the need to preserve speaker, modality, source artifact, conflict, and unresolved-risk fields in handoffs.

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

### Added on 2026-06-12 v09

- EvoArena/EvoMem: dynamic environments make memory patches and update histories first-class evidence; memory evolution still does not establish current authority.
- HyperTool: executable MCP-style tool wrappers can hide nested read/write dependencies unless subcall refs are captured and bound.
- AgentBeats and EpiBench: agentified assessment and deterministic scientific workflows strengthen state-defect recall, judge-routing, and intermediate artifact-gate metrics.
- TRACE correction enforcement, MemRefine, and EurekAgent: compiled user corrections, memory compression, permissions, artifacts, budgets, and human supervision are governance/environment evidence lanes.
- Schneider enforceable policies, edit automata, Clark-Wilson, and safety-progress runtime verification: blocking claims need explicit monitorability/enforceability and well-formed transaction boundaries.
- Mohammed/Klimoski/Rentsch, Bierhals/Kohler/Badke-Schaub, cognitive offloading in agile teams, POMDP task-completion updates, and CHOIR organizational memory: PM handoff/status artifacts should measure structured source/owner/dependency agreement, risk capture, and communication cost under uncertainty.

### Added on 2026-06-12 v10

- Sovereign Assurance Boundary: certificate-bound admission strengthens the next write-binding frontier with evidence digests, policy versions, revocation epochs, execution identity, and validity windows.
- Channel Fracture: scheduled/cross-agent memory and handoff writes need target-side delivery confirmation before they become admitted operational state.
- LLM-as-an-Investigator: ambiguous operational requests should collect discriminating evidence before committing to action.
- The Illusion of Multi-Agent Advantage: multi-agent workflows need role-utility and cost-per-valid-action metrics rather than assuming orchestration helps.
- STAGE-Claw and Agent System Operations: state-based final-environment verification and anomaly/root-cause/resolution lifecycle fields should extend replay artifacts and dashboards.
- Memory Control Flow Attacks and Externalization in LLM Agents: memory, skills, protocols, and harnesses are externalized infrastructure, but retrieved memory can steer tool control flow and must be admitted as an influence.
- Collaborating with AI Agents and Scaffolding Human-AI Collaboration: PM handoff protocols should measure risk capture, rework, diversity, quality, and protocol burden because human-AI scaffolding effects are mixed.

### Added on 2026-06-12 v11

- Repo-grounded certificate closure: `@pm/workflow` now rejects certificate digest drift, expired validity windows, revoked certificates, artifact mismatch, tenant/workflow mismatch, and incomplete evidence-review coverage.
- Repo-grounded replay closure: `@pm/evals` now emits deterministic admission certificate ids/digests for complete write-binding replay rows and exposes certificate counts in catalog metrics.
- Repo-grounded test correction: committed write-binding rows are re-verified against the freshly built catalog instead of trusting serialized `record.validation`.
- Repo-grounded tenant correction: the evidence-admission corpus default tenant now aligns with the ArrowHedge state-review/write-binding corpus tenant after strict replay exposed the mismatch.

### Added on 2026-06-13 v12

- Memory Poisoning Attacks / MPBench and Memory Control Flow Attacks / MEMFLOW: memory writes and reads are now explicitly treated as admission and control-flow influence surfaces, not passive recall.
- Lean4Agent and HarnessFix: trajectory/workflow verification and failure localization strengthen policy-transition and artifact-run-group metrics without replacing source-authority validation.
- M3Exam and H2HMem: multimodal and human-human interaction memory benchmarks strengthen participant/source/modality preservation for PM handoff artifacts.
- W3C Verifiable Credentials Data Model, Data Integrity, and Bitstring Status List: stronger vocabulary for issuer, proof, status, and revocation in durable admission certificates.
- MCP SEP-2260/2567/2577 and OpenTelemetry event semantic conventions: protocol correlation and receipt-event vocabulary are useful evidence lanes but remain non-authoritative until admitted.
- National Academies human-AI teaming and Google transactive-memory framing: PM substrate claims should measure calibrated shared understanding, role knowledge, risk capture, and burden.

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
- v09 corrects v08's ArrowHedge persistence frontier: the ArrowHedge state-review artifact JSONL corpus is now committed and drift-tested.
- v09 corrects v08's runtime evidence-action frontier: an opt-in workflow write-binding gate, write-binding replay corpus, explicit policy-block handling, and catalog verifier now exist; the remaining gap is durable verification stores and adoption by every external write transport.
- v09 corrects dashboard language: the substrate dashboard is a replay monitor over committed corpora, not proof of live operational telemetry.
- v10 corrects v09's recommended next slice: fixture-backed `EvidenceBindingReferenceCatalog` construction and write-transport coverage metrics now exist on `main`; durable DB/substrate-store-backed verification, certificate/revocation semantics, and all-real-transport adoption remain open.
- v11 partially closes v10's certificate/revocation frontier in the replay/catalog lane: certificate ids/digests, policy version, revocation epoch, execution identity, validity window, tenant/workflow, artifact hash, and evidence-review coverage now verify in code.
- v11 corrects an implementation proof gap: stored JSONL validation is not sufficient; tests now recompute decisions against the constructed catalog.
- v11 corrects a cross-corpus fixture bug: evidence-admission reviews, ArrowHedge state-review artifacts, and write-binding replay records now share the ArrowHedge tenant for strict replay.
- v12 keeps v11's certificate claim scoped: deterministic replay certificate refs are useful proof artifacts, but W3C credential/status sources strengthen the need for durable issuer/status/revocation checks before production authority claims.
- v12 strengthens v10/v11 memory-control claims: memory writes and retrieved memory influence are distinct surfaces, so memory-as-fact, memory-as-preference, memory-as-instruction, and memory-as-tool-routing must not be collapsed.
- v12 corrects dispatch wording: successful workflow dispatch or log emission should be treated as an attempted write until the target channel emits an admitted receipt.
- v13 partially closes v12's memory frontier: replayable evidence admission now distinguishes `memory_write` from `memory_retrieval`, classifies memory influence, and warns when control-surface memory lacks or violates override metadata; live memory-store/runtime enforcement is still open.

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
- Self-attested evidence bindings are downgraded as mutation safety; catalog verification and durable store checks are required before broad governance claims.
- Executable tool wrappers are downgraded as clean abstraction when they hide nested subcall dependencies from observed read-set capture.
- Memory compression/evolution is downgraded as state validity unless source refs, supersession, patch lineage, and deletion residue remain replayable.
- Agentified judges are downgraded as operational gates until state-defect recall and routing misses are measured against deterministic fixtures.
- Artifact completeness is downgraded as PM handoff success unless risk capture, owner/source convergence, valid-next-action agreement, and rediscovery cost improve on real traces.
- Dispatch success is downgraded as delivery proof unless the target memory/task/handoff channel emits a replayable target-side confirmation.
- Memory retrieval is downgraded as passive context when it changes tool choice or action ordering; it becomes a control-flow influence requiring admission.
- Multi-agent orchestration is downgraded unless marginal role utility is measured against cost and single-agent baselines.
- PM scaffolding is downgraded as an automatic good; protocol burden, quality, rework, and diversity must be measured.
- Credential standards are downgraded as direct authority; they provide issuer/proof/status/revocation shape, while pm-substrate must still verify tenant, subject, workflow, policy, source, and current state.
- Memory benchmark accuracy is downgraded as safety proof; recall and reasoning scores do not cover poisoning, control-flow steering, or valid-action governance.
- Formal workflow verification is downgraded as source truth; it verifies modeled assumptions and transition semantics, not whether the evidence is current or authoritative.
- Observability receipts are downgraded as authorization; target events can prove receipt/visibility, not valid permission to write.

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
21. Fixture admission certificates as production signing authority.
22. Dispatch success as target-side delivery proof.
23. Memory recall benchmark success as safe memory governance.

## Current Implementation Implications

1. Promote write binding from selected opt-in workflow paths to a transport-wide invariant for every external write-capable capability path.
2. Promote fixture-backed certificate verification into durable verification stores for state-review artifact ids/hashes, evidence-admission review ids, tenant/workflow binding, rejected-evidence policy disposition, policy version, revocation epoch, execution identity, and validity window.
3. Keep MCP-like task/tool annotations and explicit state handles in the admission lane; prove the same rules against live protocol/runtime handles, not only pure fixtures.
4. Capture nested tool-wrapper subcall read/write refs so executable wrappers do not bypass observed read-set validation.
5. Add memory patch, supersession, and compaction artifacts with source refs, deletion residue, and replay fidelity.
6. Treat skill documents and compiled user-correction rules as external governance evidence; start with owner, trigger, scope, version, source, and fault-coverage fixtures.
7. Classify invariants as pre-write enforceable, compensation-enforceable, monitorable-only, or offline-audit before presenting policy gates as blocks.
8. Add trajectory release-budget fixtures with sink trust, data class, cumulative budget, release atoms, and declassification reason.
9. Add explicit policy-transition conformance fixtures where fresh admitted evidence supports a fact but the proposed workflow transition is invalid.
10. Add LLM-judge recall metrics for stale referents, stale owner/blocker, confirm-gate lockout, recovery/escalation failure, workflow-phase mismatch, and guardrail defects.
11. Run `comparePmHandoffAgreement` over real multi-agent ArrowHedge or automation runs and compare against rediscovery cost and time-to-valid-action.
12. Keep the dashboard claim boundary honest: static replay monitor now, live governance only after live stores/subscriptions feed it.
13. Make every daily research automation pull or remotely verify `main`, inspect new research/code, update the relevant chain-specific index and top-level `research/index.md`, commit, and push.
14. Add target-side delivery confirmation for scheduled/subagent/memory/PM handoff writes before admitting them as shared operational state.
15. Add memory-control-flow fixtures that distinguish memory used as evidence from memory used as instruction or tool-routing influence.
16. Measure multi-agent role utility and PM protocol burden before expanding orchestration or handoff scaffolding.
17. Promote replay certificates into a durable status source with issuer, proof, revocation, status checked-at, policy version, validity window, tenant/workflow, and execution identity.
18. Preserve participant, role, modality, source artifact, conflict, and unresolved-risk fields in PM handoff memory rather than flattening into summaries.
19. Add small deterministic policy-transition specs before broad formal workflow verification.

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
- `write_binding_catalog_verification_rate`
- `write_transport_binding_coverage`
- `unverified_binding_block_rate`
- `subtool_read_set_coverage`
- `hidden_subcall_dependency_rate`
- `memory_patch_replay_fidelity`
- `memory_compaction_source_ref_coverage`
- `compiled_rule_scope_violation_rate`
- `skill_policy_binding_rate`
- `invariant_enforcement_capability_coverage`
- `release_budget_exceeded_rate`
- `pm_risk_capture_rate`
- `handoff_time_to_valid_action`
- `status_reannouncement_stability`
- `admission_certificate_verification_rate`
- `revocation_epoch_miss_rate`
- `channel_confirmation_coverage`
- `silent_delivery_failure_rate`
- `memory_steered_tool_rate`
- `memory_control_override_block_rate`
- `clarification_before_write_rate`
- `premature_diagnosis_block_rate`
- `agent_role_utility_rate`
- `state_verification_program_pass_rate`
- `artifact_to_final_state_consistency`
- `anomaly_root_cause_link_rate`
- `resolution_evidence_coverage`
- `protocol_burden_cost`
- `handoff_rework_rate`
- `output_diversity_collapse_rate`
- `durable_certificate_status_verification_rate`
- `revoked_certificate_escape_count`
- `certificate_status_checked_at_coverage`
- `target_receipt_coverage`
- `dispatch_without_receipt_rate`
- `receipt_to_final_state_consistency`
- `memory_write_admission_rejection_rate`
- `poisoned_memory_persistence_rate`
- `memory_influence_kind_coverage`
- `policy_transition_program_pass_rate`
- `invalid_transition_block_rate`
- `failure_layer_localization_rate`
- `participant_source_role_coverage`
- `handoff_conflict_preservation_rate`
- `risk_capture_delta`

## Next-Day Watchlist

1. Choose the next code slice: durable certificate/status catalog, target-side receipt evidence, or memory-write/influence admission.
2. Inspect `@pm/workflow` and `@pm/evals` for the smallest store-like abstraction that can load certificate status without pulling in DB dependencies.
3. Decide whether target receipts belong in `ExternalStateEvidenceKind`, `InvocationEvidenceBinding`, or both.
4. Add memory influence taxonomy before adding broad memory fixtures so fact/preference/instruction/tool-routing are not conflated.
5. Re-check primary code/data availability for MPBench, MEMFLOW, Lean4Agent, HarnessFix, M3Exam, H2HMem, STATE-Bench, OCELOT, ContractBench, and STALE.
6. Exercise MCP admission against a local/live fixture server for handle expiry, annotation trust, task-result revalidation, cleanup metadata, and draft/final spec drift.
7. Capture nested tool-wrapper subcall read/write refs for HyperTool-style executable wrappers.
8. Add memory patch/compaction fixtures with supersession, source refs, deletion residue, and replay-fidelity assertions.
9. Treat skill documents and compiled corrections as external evidence in one fixture path: version, trigger precision, scope, owner, source, and fault-coverage metadata.
10. Add a trajectory release-budget fixture family inspired by OCELOT: sink trust, data class, cumulative budget, release atoms, and declassification reason.
11. Add explicit policy-transition fixtures where admitted evidence is current but the proposed workflow transition is invalid.
12. Add state-defect recall metrics for LLM judges and route/gate failures: stale referent, stale owner/blocker, confirm-gate lockout, escalation failure, workflow mismatch.
13. Run PM handoff agreement and protocol-burden metrics on real multi-agent ArrowHedge or automation runs.
14. Keep broad mutation governance unclaimed until every external write path has durable verified binding coverage plus target receipt evidence.
15. Run every daily research automation through fetch or remote-SHA verification -> inspect -> integrate -> ledger -> commit -> push and record any conflict handling as substrate evidence.

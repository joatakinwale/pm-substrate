# Daily Arrowsmith Agent-State Research Index

Last updated: 2026-06-25
Scope: pm-substrate agent-state, operational-state, memory, workflow-agent, project-management, cross-domain Arrowsmith research, and multi-agent repository coordination.

## Collaboration Protocol

Each daily research continuation must begin by fetching `origin/main` and checking whether other developers or automations added research files, index changes, changelog entries, or relevant implementation changes. If new research exists, the next version must read it, reconcile it with the local draft, and update this index plus the top-level `research/index.md` ledger before publishing.

The run is not complete until the intended research slice is committed on `main`, pushed to `origin/main`, and the local and remote SHAs are rechecked. If parallel research creates duplicate version numbers, preserve the branch artifact when useful, mark the canonical version, and record the reconciliation in the ledger.

## Current Strongest Thesis

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, tool-observation state, or inter-agent communication state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action.

The immediate primitive now exists as a pure review and artifact boundary: `CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + ActionProposalReview + StateReviewArtifact`. The durable artifact lifecycle and first external-evidence frontier are now implemented in code: deterministic JSON/JSONL export/import, replay hash validation, ArrowHedge corpus generation, continuity payload linkage, `state_review_artifact` eval refs, artifact-derived metrics, DB/fixture equivalence helpers, observed read-set comparison, all three temporal misalignment fixture phases, an invariant-class `wouldBlock` policy matrix, and committed replayable corpora for external-evidence admission, ArrowHedge state-review artifacts, and write-binding attempts.

The current frontier is now broader and more precise: selected write-capable workflow dispatch can block missing, incomplete, policy-blocked, catalog-unverified, or certificate-invalid evidence bindings when `evidenceBindingMode: "require_for_writes"` is enabled, but broad mutation governance remains unclaimed. The replay/catalog lane now includes deterministic admission certificate ids/digests, validity windows, policy version, revocation epoch, execution identity, and strict tenant/workflow replay checks. v13 closed the memory-write/read taxonomy seam. v14 partly closed the target-receipt seam as a pure replay primitive: `target_receipt` is a first-class evidence kind, dispatch-only pseudo-receipts warn instead of reading as delivery proof, and replay metrics distinguish dispatch-only from applied receipts. v15 identifies status-currentness as the next authority boundary: certificates, receipts, MCP handles, task ids, and PM acknowledgements need decision-time status checks for revocation, suspension, refresh, staleness, status authority, and privacy/correlation risk. v16 adds a stricter enforcement correction from the local June 18 ArrowHedge live-bridge audit: a block event is not proof of mutation prevention unless the action lifecycle has a mutually exclusive terminal outcome. v17 reviews the strongest "reality qualities" papers and converts them into executable bridge concepts. v18 starts the closed research loop with ten peer-reviewed-paper-backed questions and converts the first candidate into pure `ActionOutcomeEnvelope` tests. v19 answers RQ11, adds RQ21, and wires `action_outcome_envelope` refs into Axis A/C eval events while recording Axis B as blocked by missing PluggedInSocial/fixtures. v20 answers RQ21 by adding write-transport outcome-envelope coverage metrics. v21 answers RQ22 by putting runtime outcome-envelope creation at the existing workflow evidence-binding gate; the fixture inventory now reports 4/4 workflow-routed write transports have an outcome-envelope provider. v22 answers RQ23 by promoting runtime workflow envelopes into canonical `@pm/agent-state` envelopes without duplicating terminal claims; ArrowHedge write-binding replay rows now carry accepted/blocked proof packets. v23 answers RQ24 by adding a replay index that resolves EvalEvent `action_outcome_envelope` refs back to committed promoted packets and recovered terminal outcomes. v24 answers RQ25 by adding a Postgres-backed packet table/store for hash-verified terminal envelopes. v25 answers RQ26 by generating canonical Axis C packets in both the deterministic eval scaffold and dynamic local-agent-lab engine, with the DB runner persisting packets before EvalEvents. v26 answers RQ27 by converting dynamic `ScenarioRun` records into packet-backed `live_run` EvalEvents and verifying one stale-observation run end-to-end against local Postgres/Ollama. v27 answers RQ28 by requiring one protective packet-backed live pair per taxonomy class and registering all ten dynamic Axis C scenarios; a local Postgres/Ollama run produced 20 EvalEvents, 20 packets, 10 baseline failures, 0 substrate failures, and complete Axis C live coverage. v28 answers RQ29 by adding a three-axis coverage analyzer over all 30 `(axis, failureClass)` cells, separating protective coverage from stricter verification and preserving Axis B blockers. v29 answers RQ30 by splitting scenario oracle verdict from operational terminal outcome, so terminally blocked protective refusals can verify scenario passes when backed by `ActionOutcomeEnvelope` refs. v30 answers RQ31 by adding a traceable three-axis proof packet and arm-scoped ArrowHedge terminal refs, making the current Axis A incomplete / Axis B blocked / Axis C verified state explicit. v31 corrects the implementation frontier: terminal-ref validity belongs in the substrate codebase first, so `@pm/agent-state` now has a hash-gated terminal outcome index and stronger admission primitive. v32 makes ArrowHedge the first domain consumer of that terminal index at its proposal-review write boundary. v33 adds a dependency-light workflow terminal admission port so `@pm/workflow` can admit accepted/blocked invocation envelopes before dispatch/dead-letter without importing `@pm/agent-state`. v34 adds an agency publication terminal adapter in `@pm/profile-agency`, so accepted authoritative agency fixtures can become canonical terminal envelopes without substrate-package edits. v35 exposes terminal-admission provider refs through typed capability write contracts and registry discovery, so provider coverage can be derived from codebase descriptors rather than hand-edited eval inventories. v36 adds provider-side manifests plus registry verification, so missing, unavailable, deprecated, version-incompatible, package/export-drifted, or narrower provider implementations cannot count as verified coverage. v37 promotes verified manifests into status-bearing provider certificates and adds an opt-in workflow runtime certificate gate before write-capable dispatch. v38 adds a substrate-owned Postgres certificate status store and wires workflow to consume it directly. v39 turns certificate status changes into append-only replayable events and historical lookup. v40 binds exact certificate status-event refs into workflow `ActionOutcomeEnvelope`s. v41 adds an opt-in graph write-authority policy so graph mutations can require accepted workflow authority and provider-certificate status refs before SQL. v42 propagates that authority policy into capability-kit raw graph updates before `apply` or SQL. v43 adds store-backed substrate-record matching so strict policies can reject forged valid-looking refs. The remaining proof boundary is injecting store-backed authority resolutions into real workflow/capability adapters, filling Axis A, and keeping Axis B blocked until PluggedInSocial or accepted authoritative fixture runs exist.

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
| v14 | 2026-06-16 | `research/daily-arrowsmith-agent-state/v14-agent-state-arrowsmith-2026-06-16.md` | Target-receipt evidence closure and telemetry-gap correction | Converted the next open v12 frontier into code: `target_receipt` is now a first-class evidence kind, dispatch-only pseudo-receipts warn instead of reading as admitted confirmation, and replay fixtures/metrics distinguish dispatch-only from applied target receipts. |
| v15 | 2026-06-16 | `research/daily-arrowsmith-agent-state/v15-agent-state-arrowsmith-2026-06-16.md` | Status-currentness bridge and durable status-store frontier | Continued from same-day v14 and shifted the next implementation frontier to decision-time status checks for replay certificates, target receipts, MCP task handles, and PM handoff acknowledgements. |
| v16 | 2026-06-19 | `research/daily-arrowsmith-agent-state/v16-agent-state-arrowsmith-2026-06-19.md` | Terminal enforcement correction and live-bridge audit bridge | Added the correction that stale-state detection or block-event emission is not enough; action lifecycles need mutually exclusive terminal outcomes, dashboard metric provenance, and status checks wired into the action gate. |
| v17 | 2026-06-24 | `research/daily-arrowsmith-agent-state/v17-reality-quality-arrowsmith-2026-06-24.md` | Reality-quality cross-paper review and Arrowsmith bridge map | Reviewed the strongest peer-reviewed/scholarly systems papers across quotienting, sheaf gluing, transition semantics, consensus, transactions, content identity, feedback control, boundary objects, transactive memory, and provenance; converted them into new substrate concepts: equivalence classes, obstruction artifacts, terminal action normal forms, admission kernels, evidence leases, conflict algebra, receding-horizon execution, and projection-drift checks. |
| v18 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v18-action-outcome-loop-2026-06-25.md` | Closed-loop question ledger and pure `ActionOutcomeEnvelope` slice | Asked ten agent-state questions, answered them with peer-reviewed papers, added replacement questions RQ11-RQ20, and implemented the first pure terminal normal-form primitive with falsification tests. |
| v19 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v19-action-outcome-eval-wiring-2026-06-25.md` | Outcome-envelope eval wiring and Axis B blocker record | Answered RQ11 with enforcement-boundary papers, added RQ21, added first-class `action_outcome_envelope` eval refs, wired Axis A/C outcome evidence, and added a machine-checkable Axis B blocked eval. |
| v20 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v20-write-transport-outcome-envelope-coverage-2026-06-25.md` | Write-transport outcome-envelope coverage audit | Answered RQ21, added RQ22, extended write-transport coverage metrics with outcome-envelope provider coverage, and made the current 0/4 runtime coverage gap explicit. |
| v21 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v21-workflow-outcome-envelope-boundary-2026-06-25.md` | Workflow runtime outcome-envelope boundary | Answered RQ22, added RQ23, generated accepted/blocked workflow outcome envelopes at the evidence-binding gate, and moved fixture outcome-envelope coverage to 4/4. |
| v22 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v22-workflow-envelope-promotion-2026-06-25.md` | Workflow envelope promotion into proof packets | Answered RQ23, added RQ24, promoted workflow runtime envelopes into canonical `ActionOutcomeEnvelope` proof packets, and added those packets to ArrowHedge write-binding replay records. |
| v23 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v23-outcome-envelope-replay-index-2026-06-25.md` | Outcome-envelope replay index | Answered RQ24, added RQ25, indexed promoted envelope proof packets, and proved Axis A EvalEvents can recover blocked terminal outcomes from replay refs. |
| v24 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v24-live-outcome-envelope-store-2026-06-25.md` | Live outcome-envelope packet store | Answered RQ25, added RQ26, added Postgres packet persistence for hash-verified action outcome envelopes, and kept Axis C runtime packet generation open. |
| v25 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v25-axis-c-outcome-packet-generation-2026-06-25.md` | Axis C outcome packet generation | Answered RQ26, added RQ27, generated packet-backed Axis C scaffold events, and exposed dynamic local-agent-lab outcome packets. |
| v26 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v26-dynamic-axis-c-evalevents-2026-06-25.md` | Dynamic Axis C EvalEvents | Answered RQ27, added RQ28, converted dynamic local-agent-lab runs into packet-backed `live_run` EvalEvents, and verified one live stale-observation run against local Postgres/Ollama. |
| v27 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v27-axis-c-ten-class-live-coverage-2026-06-25.md` | Axis C ten-class live coverage | Answered RQ28, added RQ29, registered all ten dynamic Axis C scenarios, and made live coverage complete only for protective packet-backed pairs. |
| v28 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v28-three-axis-coverage-gate-2026-06-25.md` | Three-axis coverage gate | Answered RQ29, added RQ30, and added a 30-cell coverage/verification analyzer that cannot hide Axis B blockers behind Axis C completeness. |
| v29 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v29-eval-verdict-terminal-outcome-split-2026-06-25.md` | Eval verdict / terminal outcome split | Answered RQ30, added RQ31, and split scenario oracle verdicts from operational terminal outcomes so protective refusals can verify scenario passes without hiding blocked axes. |
| v30 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v30-three-axis-proof-packet-2026-06-25.md` | Three-axis proof packet | Answered RQ31, added RQ32, and added a proof packet that preserves verified, missing, blocked, and terminal-proof-backed cells across the three-axis matrix. |
| v31 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v31-terminal-index-codebase-correction-2026-06-25.md` | Terminal index codebase correction | Answered RQ32, added RQ33, and moved terminal-ref/hash validity back into `@pm/agent-state` via a hash-gated terminal outcome index instead of expanding verifier-only machinery. |
| v32 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v32-arrowhedge-terminal-index-adoption-2026-06-25.md` | ArrowHedge terminal index adoption | Answered RQ33, added RQ34, and made ArrowHedge proposal-review artifacts emit canonical terminal envelopes admitted through the core terminal index. |
| v33 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v33-workflow-terminal-admission-port-2026-06-25.md` | Workflow terminal admission port | Answered RQ34, added RQ35, and added a dependency-light workflow admission port that can reject terminal conflicts before dispatch without making `@pm/workflow` depend on `@pm/agent-state`. |
| v34 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v34-agency-publication-terminal-adapter-2026-06-25.md` | Agency publication terminal adapter | Answered RQ35, added RQ36, and added a profile-owned publication terminal adapter that blocks revoked approvals and indexes same-action publish conflicts through `@pm/agent-state`. |
| v35 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v35-terminal-admission-provider-metadata-2026-06-25.md` | Terminal admission provider metadata | Answered RQ36, added RQ37, and made terminal-admission providers discoverable through typed write-contract metadata and registry helpers. |
| v36 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v36-terminal-provider-manifest-verification-2026-06-25.md` | Terminal provider manifest verification | Answered RQ37, added RQ38, and added live manifest verification so stale provider metadata cannot prove coverage by itself. |
| v37 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v37-terminal-provider-certificates-2026-06-25.md` | Terminal provider certificates | Answered RQ38, added RQ39, and added status-bearing provider certificates plus an opt-in workflow runtime certificate gate before write-capable dispatch. |
| v38 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v38-provider-certificate-status-store-2026-06-25.md` | Provider certificate status store | Answered RQ39, added RQ40, and added a substrate-owned Postgres certificate status store wired into workflow runtime lookup. |
| v39 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v39-provider-certificate-status-event-replay-2026-06-25.md` | Provider certificate status event replay | Answered RQ40, added RQ41, and added append-only hash-linked status events plus historical certificate-status replay. |
| v40 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v40-workflow-status-ref-binding-2026-06-25.md` | Workflow status ref binding | Answered RQ41, added RQ42, and bound exact provider-certificate status event refs into workflow action outcome envelopes. |
| v41 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v41-graph-write-authority-ref-2026-06-25.md` | Graph write authority ref | Answered RQ42, added RQ43, and added an opt-in graph write-authority policy requiring accepted workflow authority plus provider-certificate status refs before graph SQL. |
| v42 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v42-capability-kit-write-authority-2026-06-25.md` | Capability kit write authority | Answered RQ43, added RQ44, and propagated graph write-authority policy into capability-kit raw graph updates before `apply` or SQL. |
| v43 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v43-store-backed-write-authority-2026-06-25.md` | Store backed write authority | Answered RQ44, added RQ45, and added substrate-record matching so strict graph/capability authority cannot rely on forged valid-looking refs. |

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
55. **Memory write/read taxonomy is now a pure tested primitive.** v13 adds a distinct `memory_write` evidence kind, memory intended-use and influence metadata, override-status warnings, and replay metrics for memory influence.
56. **Persistent agent environments increase urgency, not authority.** OpenAI/Ona, AgentCore, GitHub reliability, and Copilot control-plane sources strengthen the runtime-state pressure while remaining evidence/context rather than operational truth.
57. **Target receipt is now a pure tested primitive.** v14 adds a distinct `target_receipt` evidence kind, explicit receipt metadata, dispatch-only downgrade warnings, and replay metrics for dispatch-only versus applied target receipts.
58. **Status-currentness is the next authority boundary.** v15 separates a certificate or receipt from its current status: revocation, suspension, refresh, checked-at time, status authority, and privacy/correlation risk must be checked before evidence supports valid action.
59. **Block events are not enforcement unless terminal outcomes partition.** v16 corrects the live ArrowHedge bridge boundary: detected stale state, emitted block records, and suppressed actions are separate claims until one stable action id has exactly one terminal outcome.
60. **Terminal outcome normal form is now a pure tested primitive.** v18 adds `ActionOutcomeEnvelope` with outcome hashing, same-action terminal partition checks, stale-evidence demotion from requested `accepted` to `blocked`, local-view obstruction artifacts, role projection preservation, and substrate-ref recovery. This is pure proof only; workflow/runtime adoption and three-axis evals remain open.
61. **Outcome-envelope evidence is now visible in eval events.** v19 adds `action_outcome_envelope` as an eval ref kind and wires Axis A/C substrate events to cite outcome-envelope proof. This improves measurement, but runtime write transports still need required envelope generation before mutation.
62. **Write-transport outcome-envelope coverage is now measurable.** v20 extends the existing write-transport coverage report with outcome-envelope provider coverage; v21 moves the fixture inventory to 4/4 for workflow-routed write transports by generating envelopes inside `@pm/workflow`.
63. **Workflow runtime envelopes can now be promoted without a second terminal claim.** v22 adds a canonical promotion helper and ArrowHedge replay proof packets that cite the workflow envelope as substrate evidence; durable persistence into EvalEvents and amnesiac resume remains open.
64. **EvalEvents can now replay action-outcome refs against promoted proof packets.** v23 adds a replay index and metrics that resolve Axis A `action_outcome_envelope` refs back to valid terminal envelopes; Axis C still needs live packet persistence.
65. **Eval persistence now has a hash-gated terminal packet table.** v24 adds `evals.action_outcome_envelope_packets` and store methods that only accept hash-valid packets and reject same-ref/different-hash overwrites; Axis C still needs to generate those packets live.
66. **Axis C now generates canonical outcome packets before eval persistence.** v25 makes deterministic local-lab EvalEvents packet-backed and exposes packets from the dynamic local-agent-lab engine; full dynamic run-to-EvalEvent conversion remains open.
67. **Dynamic Axis C stale-observation now has packet-backed live EvalEvents.** v26 adds a dynamic local-agent-lab EvalEvent adapter, `live_run` evidence stage, packet-before-event persistence helper, retained live event rows, and a local Postgres/Ollama run whose packet refs resolve from the DB. This is one live failure class, not full Axis C coverage.
68. **Dynamic Axis C now has ten-class live coverage, but not three-axis verification.** v27 adds explicit live coverage reporting, registers all ten failure classes as dynamic `ScenarioSpec`s, and requires a protective packet-backed pair for coverage. The proof boundary shifts to lifting that gate across Axis A/B/C without hiding Axis B's blocked status.
69. **The repo now has a 30-cell three-axis coverage gate.** v28 adds `analyzeThreeAxisCoverage()` so each `(axis, failureClass)` cell is visible, blocked cells stay blocked, and stricter verification requires terminal-proof-backed pass pairs by default.
70. **Scenario verdicts are separate from operational terminal outcomes.** v29 adds `scenarioResult` and `operationalTerminalOutcome` to EvalEvents, so a substrate refusal can be both operationally `blocked` and a scenario `pass` when an `ActionOutcomeEnvelope` proves the terminal outcome.
71. **Three-axis status is now a traceable proof packet.** v30 adds `buildThreeAxisProofPacket()`, which records sources, verified axes, blocked axes, unverified axes, and cell-level proof status instead of allowing scattered event counts to imply completion.
72. **Terminal proof validity is a substrate primitive, not a verifier feature.** v31 hardens `admitActionOutcomeEnvelope()` and adds `buildActionOutcomeTerminalIndex()` so only hash-valid envelopes can become terminal incumbents, exact replays are idempotent, and same-action conflicts are state-plane issues before they are eval claims.
73. **ArrowHedge now consumes terminal admission before verifier accounting.** v32 adds finance-domain helpers that convert proposal-review artifacts into canonical envelopes and run them through the core terminal index, so same-action accepted/blocked conflict is caught at the Axis A code boundary.
74. **Workflow terminal admission is now a dependency-light port.** v33 lets `@pm/workflow` require admission for accepted/blocked invocation outcome envelopes before dispatch or dead-letter, while leaving canonical `@pm/agent-state` admission to adapters outside the workflow package.
75. **Agency publication terminal admission now has a profile adapter.** v34 lets `@pm/profile-agency` convert authoritative publication fixture snapshots into canonical terminal envelopes, block revoked approvals or content-hash drift, and report same-action publish conflicts through the core terminal index.

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

### Added on 2026-06-15 v13

- Repo-grounded memory taxonomy closure: `@pm/agent-state` now distinguishes `memory_write` from `memory_retrieval` and adds source channel, intended use, influence kind, and override status facets.
- Repo-grounded replay closure: `@pm/evals` now carries hidden-instruction memory write, clean preference memory write, and overridden tool-routing memory retrieval fixtures, plus memory influence metrics.
- Fresh source checks on MPBench and MEMFLOW keep the memory-write/admission and memory-read/control-flow bridge High for risk taxonomy while preserving preprint and implementation-scope limits.
- GitHub Copilot control-plane, GitHub availability, OpenAI/Ona, and AWS AgentCore official sources strengthen the persistent-runtime and provider-policy context without promoting vendor state to substrate authority.
- National Academies human-AI teaming and Google transactive-memory framing remain the PM bridge: memory governance should preserve source/channel/role/override status and be judged by risk capture, rework, and burden.

### Added on 2026-06-16 v14

- GitHub's June 15 Copilot usage-metrics update sharpened the telemetry gap: server-side confirmation can improve coverage while still lacking richer per-surface/per-feature detail.
- AWS AgentCore's current June notes keep widening persistent runtime/session/workflow surfaces through interactive shells, harness embedding, and stateful gateway sessions.
- OpenAI's June 14 partner-network news extends governance/distribution surfaces without changing the operational-state proof boundary.
- Repo-grounded receipt closure: `@pm/agent-state` now distinguishes `target_receipt` from generic telemetry, and `@pm/evals` now carries dispatch-only and applied receipt fixtures plus receipt-status metrics.

### Added on 2026-06-16 v15

- W3C Bitstring Status List v1.0 and Verifiable Credentials Overview strengthened the durable status-store frontier: evidence issuer, status authority, status purpose, validity period, revocation, suspension, refresh, and privacy/correlation concerns are separate from initial evidence admission.
- MCP draft statelessness and SEP-2663 Tasks Extension strengthened the addressability-vs-authority correction: explicit state handles and task IDs are lookup keys for status/result checks, not operational state.
- OpenTelemetry event semantics and span-event migration guidance strengthened the receipt/status event-shape requirement: evidence events need stable names, attributes, timestamps, and schema-drift handling.
- STAGE-Claw and STATE-Bench strengthened final-state verification metrics: receipt-backed writes still need refreshed persistent-state checks.
- PABU and Belief Memory strengthened the partial-observability bridge while preserving the implementation boundary: learned belief/memory can guide agents, but pm-substrate should enforce status/currentness with existing runtime evidence.

### Added on 2026-06-19 v16

- Runtime Compliance Verification for AI Agents / C-Trace strengthened the bridge from post-hoc traces to runtime compliance checks: constraints should be represented and checked in the execution path before side effects.
- Formal Modeling of LLM Agents' Context strengthened typed context modeling: a prompt/context window is not a substitute for `currentStateView`, observation contract, and terminal transition semantics.
- Searching for Synergy in Shared Workspace Human-AI Collaboration and Formalising Human-in-the-Loop strengthened the PM burden/oversight correction: shared state and human approval need role/status scaffolding, not generic dashboard exposure.
- ToolGate strengthened the contract-gated execution bridge: preconditions and postconditions should gate tool invocation and state commits, which maps to terminal outcome partitioning for ArrowHedge decisions.
- Local June 18 ArrowHedge bridge and dashboard audits added repo-grounded evidence: seeded stale actions were detected, but pre-fix events could emit both accepted and blocked outcomes for the same decision. This corrects the claim boundary from "block observed" to "block is terminal."

### Added on 2026-06-25 v18

- Peer-reviewed terminal-normal-form sources: Herlihy/Wing linearizability, Winskel event structures, Schneider state-machine replication, Clark-Wilson integrity policy, Kung/Robinson OCC, Cahill/Rohm/Fekete SSI, and Ongaro/Ousterhout Raft.
- Peer-reviewed obstruction/currentness/projection sources: Abramsky/Brandenburger sheaf gluing, Shapiro CRDTs, Dynamo version conflicts, Gray/Cheriton leases, Spanner uncertainty/currentness, Buneman/Khanna/Tan provenance, event-sourced observability, Star/Griesemer boundary objects, Lewis transactive memory, Garcia/Prett/Morari MPC, and ACL LoCoMo.
- Repo-grounded code slice: `@pm/agent-state` now exposes pure `ActionOutcomeEnvelope`, local-view obstruction evaluation, action outcome role projections, terminal partition validation, and substrate-ref recovery helpers.

### Added on 2026-06-25 v19

- RQ11 answered from Schneider state-machine replication, Clark-Wilson integrity policy, Herlihy/Wing linearizability, and Kung/Robinson OCC: terminal partitioning generalizes beyond pure arrays only when operational writes are downstream of a single well-formed admission boundary.
- Repo-grounded eval wiring: `@pm/evals` now recognizes `action_outcome_envelope`, Axis A has a terminal-partition paired scenario requiring that ref, Axis C substrate scaffold events cite outcome envelopes, and Axis B can emit an explicit blocked eval for the missing PluggedInSocial/fixture blocker.

### Added on 2026-06-25 v20

- RQ21 answered from the same enforcement-boundary papers plus repo inventory: every write-capable transport in the fixture coverage set still lacks a pre-side-effect `ActionOutcomeEnvelope` provider.
- Repo-grounded coverage update: `@pm/evals` now tracks outcome-envelope required, covered, missing, coverage rate, and missing transport ids in `analyzeWriteTransportBindingCoverage()`.
- Replay-corpus correction: write-binding replay artifact hashes now match the committed ArrowHedge state-review artifact corpus again, restoring catalog replay consistency.

### Added on 2026-06-25 v21

- RQ22 answered from Schneider state-machine replication, Clark-Wilson integrity policy, Herlihy/Wing linearizability, and Kung/Robinson OCC: the smallest repo boundary is the workflow evidence-binding gate immediately before write-capable dispatch.
- Repo-grounded runtime update: `@pm/workflow` now builds accepted/blocked `InvocationActionOutcomeEnvelope` records at that gate and passes accepted envelopes into dispatcher contexts.
- Repo-grounded coverage update: `@pm/evals` fixture write transports now report 4/4 outcome-envelope provider coverage, while still keeping evidence-binding/provider/verifier coverage separate.

### Added on 2026-06-25 v22

- RQ23 answered from Schneider state-machine replication, Clark-Wilson integrity policy, Herlihy/Wing linearizability, and Kung/Robinson OCC: the workflow runtime envelope remains the terminal source of truth; agent-state promotion wraps and cites it rather than recomputing a second terminal claim.
- Repo-grounded promotion update: `@pm/agent-state` now exposes `promoteWorkflowInvocationOutcomeEnvelope()`, and `action_outcome_envelope` is also a `StateRefKind`.
- Repo-grounded replay update: ArrowHedge write-binding replay records now carry canonical promoted `ActionOutcomeEnvelope` proof packets and metrics count accepted vs blocked envelopes.

### Added on 2026-06-25 v23

- RQ24 answered from ARIES, Buneman/Khanna/Tan provenance, Chandy/Lamport snapshots, and Garcia-Molina/Salem sagas: EvalEvents should carry stable refs while replay recovers and verifies terminal envelopes from durable proof packets.
- Repo-grounded replay update: `@pm/evals` now exposes `ActionOutcomeEnvelopeReplayIndex`, `recoverActionOutcomeEnvelopeFromReplayIndex()`, and `analyzeEvalEventActionOutcomeReplay()`.
- Axis A update: the ArrowHedge terminal-partition EvalEvent ref is now derived from the write-binding replay corpus and resolves to a hash-valid blocked terminal envelope.

### Added on 2026-06-25 v24

- RQ25 answered from ARIES, Buneman/Khanna/Tan provenance, Chandy/Lamport snapshots, and Garcia-Molina/Salem sagas: promoted terminal packets need a live hash-gated store keyed by the same `action_outcome_envelope` refs that EvalEvents cite.
- Repo-grounded persistence update: `evals.action_outcome_envelope_packets` now exists in root and package-local migrations.
- Repo-grounded store update: `PostgresEvalEventStore` can persist hash-valid action outcome envelope packets, reject conflicting packet hashes, and recover terminal packets by EvalEvent substrate ref.

### Added on 2026-06-25 v25

- RQ26 answered from Paxos Made Live, ARIES, Chandy/Lamport snapshots, and Garcia-Molina/Salem sagas: Axis C should generate terminal packets at the runtime admission/refusal boundary and persist them before EvalEvents cite those refs.
- Repo-grounded scaffold update: `runLocalLabPairedEvals()` now returns canonical hash-valid `ActionOutcomeEnvelope` packets aligned with local-lab substrate EvalEvent refs.
- Repo-grounded dynamic-engine update: `@pm/local-agent-lab` now builds `ActionOutcomeEnvelope` packets for admitted/refused arm runs and exposes them on run results.

### Added on 2026-06-25 v26

- RQ27 answered from PASS, workflow provenance views, Provenance-To-Use repeatability, and Distributed Time-aware Provenance: dynamic arm runs should become queryable EvalEvent views over runtime provenance while terminal packets remain the proof objects and are persisted before events.
- Repo-grounded dynamic eval update: `@pm/evals` now exposes `buildDynamicLocalAgentLabEvalSuite()` and `recordDynamicLocalAgentLabEvalSuite()`, with `live_run` evidence-stage metrics and missing-packet rejection.
- Repo-grounded live-run update: `pnpm evals:local-agent-lab:live` ran stale-observation against local Postgres/Ollama and persisted two packets plus two live EvalEvents whose packet refs resolved from the DB.

### Added on 2026-06-25 v27

- RQ28 answered from Ostrand/Balcer category-partition testing, Zhu/Hall/May coverage adequacy, Kuhn/Kacker/Lei/Hunter combinatorial testing, and Jia/Harman mutation testing: each failure class is a coverage obligation, and Axis C coverage requires a live pair that can expose the targeted fault.
- Repo-grounded coverage update: `@pm/evals` now reports `DynamicLocalAgentLabLiveCoverageReport`; a class is covered only by a protective packet-backed pair (`baseline=fail`, `substrate!=fail`) with generated `action_outcome_envelope` refs on both arms.
- Repo-grounded dynamic scenario update: `@pm/local-agent-lab` now registers all ten state-failure classes as dynamic scenarios and the registry test fails if any class is dropped.
- Repo-grounded live-run update: `pnpm evals:local-agent-lab:live` ran all ten scenarios against local Postgres/Ollama, persisted 20 packets plus 20 EvalEvents, reduced baseline failures from 10 to 0 substrate failures, and recovered all latest 20 packet refs from Postgres.

### Added on 2026-06-25 v28

- RQ29 answered from Weyuker test adequacy, Basili/Selby/Hutchens experimentation, Shull/Carver/Vegas/Juristo replication, and Santos/Vegas/Oivo/Juristo grouped-replication analysis: the full verifier must be stratified by axis and failure class, and blocked/missing strata cannot be aggregated away.
- Repo-grounded coverage update: `@pm/evals` now exports `analyzeThreeAxisCoverage()`, which reports all 30 required `(axis, failureClass)` cells with covered, verified, missing, blocked, and reason fields.
- Repo-grounded proof-boundary update: coverage means a protective paired baseline/substrate result with refs; stricter verification means a non-blocked substrate `pass` with terminal `action_outcome_envelope` refs by default.
- Repo-grounded blocked-axis test: a complete Axis C local-lab matrix no longer makes the full report complete when the Axis B marketing fixture remains blocked.

### Added on 2026-06-25 v29

- RQ30 answered from Barr/Harman/McMinn/Shahbaz/Yoo's oracle-problem survey, Leucker/Schallhart and Bauer/Leucker/Schallhart runtime-verification papers, and Utting/Pretschner/Legeard's model-based-testing taxonomy: the observed runtime outcome and the test/monitor verdict should be separate fields.
- Repo-grounded schema update: `EvalEvent` now has optional `scenarioResult` and `operationalTerminalOutcome`; terminal outcomes require `action_outcome_envelope` refs, and blocked operational results with scenario passes must name the terminal outcome.
- Repo-grounded coverage update: Axis C protective refusals now emit `result: "blocked"`, `scenarioResult: "pass"`, and `operationalTerminalOutcome: "blocked"`, and `analyzeThreeAxisCoverage()` verifies those cells through `scenarioPassPairs`.

### Added on 2026-06-25 v30

- RQ31 answered from Gotel/Finkelstein and Ramesh/Jarke traceability, Torkar/Gorschek/Feldt/Svahnberg/Raja/Kamran traceability practice evidence, and Li/Offutt model-based test oracle strategies: three-axis proof needs explicit trace links from requirements/cells to EvalEvents, oracle verdicts, and terminal proof refs.
- Repo-grounded proof-packet update: `@pm/evals` now exports `buildThreeAxisProofPacket()`, with status, source, verified-axis, blocked-axis, missing-cell, unverified-cell, blocked-cell, and terminal-proof-backed scenario-pass-cell lists.
- Repo-grounded Axis A update: ArrowHedge `actionOutcomeEnvelopes` can be arm-scoped and carry `operationalTerminalOutcome`, so paired finance events can cite terminal refs for both baseline and substrate arms when proof packets exist.

### Added on 2026-06-25 v31

- RQ32 answered from Herlihy/Wing linearizability, Clark-Wilson integrity, ARIES recovery, Buneman/Khanna/Tan provenance, and Davidson/Freire workflow provenance: verifier refs are evidence links, while the codebase primitive must admit one hash-valid terminal envelope per stable action id.
- Repo-grounded correction: `@pm/agent-state` now exports `actionOutcomeTerminalKey()` and `buildActionOutcomeTerminalIndex()`, and `admitActionOutcomeEnvelope()` rejects hash-invalid candidate envelopes before admission.
- Verifier-boundary correction: a half-built proof-packet terminal-ref validator was removed from the implementation slice; three-axis artifacts should consume substrate terminal admission rather than define it.

### Added on 2026-06-25 v32

- RQ33 answered from Clark-Wilson integrity, Kung/Robinson optimistic validation, Schneider state-machine services, and Garcia-Molina/Salem sagas: the first terminal-index consumer should be the high-consequence ArrowHedge proposal-review boundary, not the eval reporter.
- Repo-grounded finance update: `@pm/capability-finance-research-ingest` now exports `buildArrowHedgeActionOutcomeEnvelope()` and `buildArrowHedgeActionOutcomeTerminalIndex()`.
- Proof update: ArrowHedge tests now show accepted fresh action, blocked stale action, idempotent replay, and same-action terminal conflict behavior through canonical `ActionOutcomeEnvelope`s.

### Added on 2026-06-25 v33

- RQ34 answered from Parnas modular decomposition, Clark-Wilson integrity, Schneider state-machine services, and Garcia-Molina/Salem sagas: workflow should expose a narrow terminal-admission port instead of importing the canonical terminal store.
- Repo-grounded workflow update: `@pm/workflow` now exposes `InvocationActionOutcomeAdmissionPort` and related decision/request types, and `PostgresWorkflowRuntime` can fail closed on terminal admission rejection before write-capable dispatch.
- Boundary update: blocked evidence-gate envelopes are offered to admission before dead-lettering, accepted envelopes are offered before dispatch, and admission adapter failure becomes `action_outcome_admission_rejected` rather than a bypass.

### Added on 2026-06-25 v34

- RQ35 answered from Wiederhold mediation, Rahm/Bernstein schema matching, Nigam/Caswell business artifacts, Hull semantic heterogeneity, Clark-Wilson integrity, and Schneider state-machine services: Axis B should consume terminal admission through a profile-owned agency publication adapter contract, not through substrate edits or eval placeholders.
- Repo-grounded agency update: `@pm/profile-agency` now exports `AgencyPublicationAuthoritySnapshot`, `buildAgencyPublicationActionOutcomeEnvelope()`, and `buildAgencyPublicationActionOutcomeTerminalIndex()`.
- Boundary update: approved matching publication content can become an accepted terminal envelope, while revoked approvals, stale approvals, content-hash drift, or lifecycle mismatch demote requested accepted writes to blocked terminal outcomes.

### Added on 2026-06-25 v35

- RQ36 answered from component-contract, interface-automata, specification-matching, semantic-capability-matching, and runtime-verification papers: terminal-admission coverage should be discoverable from typed capability write contracts, but provider metadata is not runtime authority.
- Repo-grounded contract update: `@pm/types` now has `TerminalAdmissionProviderRef` and `WriteContract.terminalAdmissionProviders`, while `@pm/registry` exposes `listTerminalAdmissionProviderBindings()`.
- Boundary update: `@pm/capability-finance-research-ingest` advertises the real ArrowHedge action-outcome provider on its Event write contract, `@pm/profile-agency` exposes the publication provider ref, and `@pm/evals` can derive provider coverage from capability descriptors.

### Added on 2026-06-25 v36

- RQ37 answered from semantic-versioning, runtime-contract, behavioral-contract, web-service runtime-verification, and interface-automata papers: terminal-admission refs must be checked against live provider manifests before they can prove coverage.
- Repo-grounded verifier update: `@pm/registry` now exposes `verifyTerminalAdmissionProviderRef()` and `verifyTerminalAdmissionProviderBindings()`, with explicit issue codes for missing, unavailable, deprecated, version-incompatible, export-drifted, and narrower manifests.
- Boundary update: finance and agency provider manifests verify locally, while `@pm/evals` can require verified manifests before counting provider coverage.

### Added on 2026-06-25 v37

- RQ38 answered from distributed authentication, decentralized trust management, lease consistency, and certificate revocation/status papers: verified manifests should become explicit status-bearing certificates checked at dispatch time, not ambient runtime belief.
- Repo-grounded certificate update: `@pm/types` now defines `TerminalAdmissionProviderCertificate`, while `@pm/registry` can issue, digest, and validate provider certificates against subject, manifest, validity window, status, and capability/provider binding.
- Boundary update: `@pm/workflow` can now require a terminal-admission provider certificate before write-capable dispatch, pass valid certificates through admission/dispatcher context, and block missing/invalid certificates with distinct terminal envelopes and metrics.

### Added on 2026-06-25 v38

- RQ39 answered from certificate revocation/update, empirical revocation failure, scalable revocation, and key-transparency papers: immutable provider certificates need a separate, substrate-owned current-status store that dispatch code queries at decision time.
- Repo-grounded status-store update: `@pm/registry` now exports `TerminalAdmissionProviderCertificateStatusStore`, pure integrity/status-record validators, and `PostgresTerminalAdmissionProviderCertificateStore`.
- Boundary update: `@pm/workflow` can consume `actionOutcomeProviderCertificateStore` directly and passes `checkedAt` into certificate lookup, so runtime dispatch no longer requires a private in-memory certificate provider.

### Added on 2026-06-25 v39

- RQ40 answered from transaction-time database, tamper-detecting audit log, tamper-evident logging, and append-only authenticated dictionary papers: current status rows are projections, while decision-time replay needs an append-only status-event stream.
- Repo-grounded replay update: `@pm/registry` now exports `TerminalAdmissionProviderCertificateStatusEvent`, deterministic status-event hashing, replay issue/decision types, and `replayTerminalAdmissionProviderCertificateStatusAt()`.
- Boundary update: `PostgresTerminalAdmissionProviderCertificateStore` appends status events transactionally with projection updates and reconstructs `checkedAt` lookups from replay rather than trusting the latest current row.

### Added on 2026-06-25 v40

- RQ41 answered from provenance, lineage, and secure-provenance papers: workflow outputs must cite the exact source/version/proof event that justified them, not only the current object identity.
- Repo-grounded workflow update: `@pm/workflow` now defines `InvocationActionOutcomeProviderCertificateStatusRef` and carries it in provider lookup results, action outcome envelopes, admission requests, and dispatcher context.
- Boundary update: the registry-backed workflow certificate adapter derives status refs from certificate status events at `checkedAt`, and the runtime rejects status refs that do not match certificate id, digest, or decision time.

### Added on 2026-06-25 v41

- RQ42 answered from protection-system, proof-carrying authentication, decentralized information-flow, and Laminar enforcement papers: workflow status binding is bypassable unless graph mutations themselves can require checkable write-authority evidence.
- Repo-grounded graph update: `@pm/graph` now exports `GraphWriteAuthorityRef`, `GraphWriteProviderCertificateStatusRef`, `GraphWriteAuthorityPolicy`, `validateGraphWriteAuthority()`, `assertGraphWriteAuthority()`, and `GraphWriteAuthorityError`.
- Boundary update: `PostgresGraph` now has an opt-in `writeAuthorityPolicy` that rejects create/update/tombstone mutations before SQL when authority refs are missing, not accepted, missing provider status refs, revoked, or certificate-mismatched.

### Added on 2026-06-25 v42

- RQ43 answered from Clark-Wilson integrity, runtime enforcement, sagas, and edit-automata papers: capability-kit raw graph updates are transformation procedures and must check graph write authority before capability `apply` or SQL side effects.
- Repo-grounded capability-kit update: `@pm/capability-kit` now exports `GraphWriteAuthorityContext`, supports `CapabilitySpec.graphWriteAuthority`, supports `CapabilityRuntimeDeps.graphWriteAuthorityPolicy`, and carries optional `writeAuthorityRef` through apply/emit contexts.
- Boundary update: `defineCapability()` now resolves and checks graph write authority after target-row lock and before `apply`; strict authority rejection rolls back idempotency and prevents raw `UPDATE graph.nodes`.

### Added on 2026-06-25 v43

- RQ44 answered from proof-carrying authentication, secure provenance, tamper-evident logging, and transparency-log papers: graph write authority must resolve to a substrate record, not only a self-asserted ref shape.
- Repo-grounded store-binding update: `@pm/graph` now defines `GraphWriteAuthoritySubstrateRecord` and `GraphWriteAuthorityPolicy.requireSubstrateRecord`, while graph mutation inputs and capability-kit authority resolutions can carry matched substrate records.
- Boundary update: strict graph/capability policies can reject missing or mismatched substrate records before SQL/apply; real workflow/runtime adapters still need to source those records from substrate stores.

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
- v13 keeps memory safety scoped: replay warnings are not durable memory status/deletion proof, not poisoned-memory denial, not write-binding consumption of memory influence, and not final target-state confirmation.
- v13 corrects persistent-runtime framing: long-running cloud environments and provider controls are market/context evidence, not operational-state authority.
- v16 corrects the local live-bridge proof boundary: an emitted `workflow.blocked.stale_state` event is not itself proof that a stale decision was suppressed. Terminal outcome partitioning must prove accepted/blocked/rejected/held are mutually exclusive for a stable decision id.
- v16 keeps the June 18 bridge scoped as local/uncommitted evidence until those implementation files, experiment outputs, and dashboard semantics are published on `main`.

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
- Memory taxonomy is downgraded as a complete memory-safety solution; v13 proves pure admission/replay warnings only, while durable store currentness, deletion fidelity, write binding, and target receipts remain open.
- Persistent agent environments are downgraded as authority; persistence and session continuity are useful capabilities but still require source, freshness, workflow, and receipt checks.
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
- Status-rich credentials are downgraded as direct production authority; they provide vocabulary for issuer/status/revocation/currentness, but pm-substrate still needs substrate-owned authority mapping and decision-time checks.
- MCP task handles and explicit state handles are downgraded as durable truth; they are references that require admitted status/result lookup.
- Belief-state or memory-model improvements are downgraded as substitutes for status checks; they estimate hidden state under partial observability but do not verify current operational authority.
- Block-event counts are downgraded as enforcement proof unless the action lifecycle suppresses the competing action and the dashboard can reconcile proposed -> terminal outcome counts.
- Shared-workspace UX is downgraded as PM coordination proof unless role clarity, owner/source agreement, stale status handling, rework, and protocol burden are measured.

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
24. Target receipts as final-state verification.
25. MCP task IDs as current task authority.
26. W3C status-list vocabulary as a mandate to become a VC platform.
27. Block-event emission as mutation enforcement when an accepted event can still coexist for the same action id.

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
14. Add pure `EvidenceStatusCheck` semantics before building a durable store: status authority, status purpose, checked-at time, validFrom/validUntil, status list/ref, stale policy, and privacy/correlation note.
15. Feed status checks into replay certificates, target receipts, and MCP task handles before claiming live mutation governance.
16. Add final-state verification fixtures only after status semantics are stable enough to distinguish valid, revoked, suspended, refresh-required, failed, stale, and superseded evidence.
17. Add target-side delivery confirmation for scheduled/subagent/memory/PM handoff writes before admitting them as shared operational state.
18. Add memory-control-flow fixtures that distinguish memory used as evidence from memory used as instruction or tool-routing influence.
19. Measure multi-agent role utility and PM protocol burden before expanding orchestration or handoff scaffolding.
20. Promote replay certificates into a durable status source with issuer, proof, revocation, status checked-at, policy version, validity window, tenant/workflow, and execution identity.
21. Preserve participant, role, modality, source artifact, conflict, and unresolved-risk fields in PM handoff memory rather than flattening into summaries.
22. Add small deterministic policy-transition specs before broad formal workflow verification.
23. Use `analyzeThreeAxisCoverage()` as the current matrix gate: fill Axis A missing classes and terminal proof refs, keep Axis B blocked until PluggedInSocial or accepted fixtures exist, and do not treat Axis C completeness as full verification.
24. Make dashboard metrics query-traceable and lifecycle-aware: stale blocks should be a gate-failure cause, not a separate double-counted KPI.
25. Answer RQ42 by extending provider-certificate status-ref binding to non-workflow graph/capability write boundaries so direct writes cannot bypass workflow action-outcome currentness proof.

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
- `action_outcome_envelope_provider_coverage`
- `missing_action_outcome_envelope_transport_count`
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
- `memoryWriteCount`
- `memoryControlInfluenceCount`
- `memoryInfluenceKinds`
- `memory_write_metadata_coverage`
- `poisoned_memory_admission_escape_count`
- `memory_backed_write_binding_coverage`
- `override_escape_count`
- `evidence_status_checked_rate`
- `stale_status_reuse_count`
- `revoked_certificate_block_rate`
- `suspended_certificate_warning_count`
- `status_authority_mismatch_count`
- `status_lookup_latency_ms`
- `status_event_schema_drift_count`
- `handle_without_status_count`
- `final_state_after_receipt_consistency_rate`
- `state_mutation_false_positive_rate`
- `rework_after_status_check_rate`
- `terminal_outcome_partition_violation_count`
- `decision_funnel_reconciliation_rate`
- `gate_failure_cause_coverage`
- `block_without_suppression_count`
- `handoff_supersession_caught_rate`

## Next-Day Watchlist

1. Add a terminal-outcome partition helper/test before durable status-store work: stale-but-agreeing ArrowHedge decisions must be proposed + blocked, not accepted + blocked.
2. Implement the smallest pure `EvidenceStatusCheck` type and attach it to the terminal decision envelope, `InvocationEvidenceBinding`, replay certificates, target receipts, MCP task handles, and PM handoff acknowledgements.
3. Add valid, revoked, suspended, refresh-required, stale, failed, superseded, and authority-mismatch replay cases.
4. Add status authority mismatch warnings before claiming any production certificate/status authority.
5. Make dashboard metrics query-traceable and reconciled: proposed = accepted + rejected + blocked + held for a defined decision set.
6. Inspect `@pm/workflow` and `@pm/evals` for the smallest store-like abstraction that can load certificate and receipt status without pulling in DB dependencies.
7. Re-check primary code/data availability for MPBench, MEMFLOW, Lean4Agent, HarnessFix, M3Exam, H2HMem, STATE-Bench, OCELOT, ContractBench, and STALE.
8. Exercise MCP admission against a local/live fixture server for handle expiry, annotation trust, task-result revalidation, cleanup metadata, and draft/final spec drift.
9. Capture nested tool-wrapper subcall read/write refs for HyperTool-style executable wrappers.
10. Treat skill documents and compiled corrections as external evidence in one fixture path: version, trigger precision, scope, owner, source, and fault-coverage metadata.
11. Add a trajectory release-budget fixture family inspired by OCELOT: sink trust, data class, cumulative budget, release atoms, and declassification reason.
12. Add explicit policy-transition fixtures where admitted evidence is current but the proposed workflow transition is invalid.
13. Add state-defect recall metrics for LLM judges and route/gate failures: stale referent, stale owner/blocker, confirm-gate lockout, escalation failure, workflow mismatch.
14. Run PM handoff agreement and protocol-burden metrics on real multi-agent ArrowHedge or automation runs.
15. Keep broad mutation governance unclaimed until every external write path has durable verified binding coverage, status checks, target receipt evidence, and terminal outcome partition tests.
16. Run every daily research automation through fetch or remote-SHA verification -> inspect -> integrate -> ledger -> commit -> push and record any conflict handling as substrate evidence.

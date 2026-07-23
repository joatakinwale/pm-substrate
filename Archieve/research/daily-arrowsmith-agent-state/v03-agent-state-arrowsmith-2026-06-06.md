# v03 Agent-State Arrowsmith - 2026-06-06

Date: 2026-06-06
Method: Arrowsmith A-B-C continuation, prior-version claim audit, repo-grounded implementation check, primary-source search
Status: third numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md`

Local context read in order:

1. `research/daily-arrowsmith-agent-state/index.md`
2. `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md`
3. `Changelog.md`
4. Implementation surfaces for the v02 open slice:
   - `packages/agent-state/src/index.ts`
   - `packages/agent-state/src/index.test.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
   - `packages/evals/src/arrowhedge.ts`
   - `packages/evals/src/metrics.ts`
   - `packages/evals/src/schema.ts`

Current strongest thesis:

> pm-substrate is the governed operational-state layer between statistical prediction and valid action. The repo has now crossed from "state-review concept" into a pure pre-action review primitive: `CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + ActionProposalReview`. The next proof boundary is no longer adding the obvious review fields. It is making review artifacts durable, replayable, provenance-linked, trace-correlated, benchmark-audited, and policy-gated by invariant class.

## 1. Delta From Previous Version

v02 correctly identified the tautological proposal-review path, missing subject binding, missing `evaluatedAt`, advisory-only ambiguity, and overclaimed eval maturity. The June 5 implementation ledger and code now show several of those gaps are closed: `subject_mismatch`, original observation-contract review, as-of ArrowHedge current-state evaluation, explicit advisory/blocking mode, and evidence-stage metrics exist. v03 therefore downgrades those v02 items from "next implementation" to "closed primitive, still needing durable proof." New bridges from standards and project-management research sharpen the next layer: state-review artifacts should behave like provenance-bearing events, joinable traces, and object-centric process records, while the PM layer should measure coordination requirements, ownership, handoff quality, and shared situation awareness rather than merely showing a dashboard.

## 2. Research Question

When LLM agents are statistical predictors promoted into actors, what operational-state substrate is needed so that an agent action can be reviewed, replayed, explained, rejected, or allowed under changing observations, memories, tools, workflow position, authority, and project coordination context?

## 3. A/B/C Framing

**A-literature/problem.** LLM agents, memory systems, RAG, tool use, workflow agents, multi-agent coordination, and current pm-substrate state-review implementation. The concrete problem is action validity under partial, stale, or mis-authoritative state.

**B-bridge concepts.** State-review artifacts, provenance, read-set validation, trace context, event envelopes, object-centric event logs, actuation leases, workflow protocol projection, common operating picture, team situation awareness, transactive memory, socio-technical congruence, and benchmark auditability.

**C-literatures/domains.** W3C PROV, W3C Trace Context, CNCF CloudEvents, OpenTelemetry, OCEL 2.0/process mining, optimistic concurrency and coordination avoidance, edge/actuation control, formal coordination protocols, project-management standards, team cognition, human-agentic teaming, and software project coordination research.

Open discovery result: the strongest new bridge is **artifactized operational state**: pm-substrate should not only compute a review object in memory; it should preserve the review as a provenance-bearing event/artifact whose source refs, trace ids, object roles, evaluated-at time, and invariant-policy result can be replayed.

Closed discovery result from v02: the specific gaps `subject_mismatch`, original-observation review, `evaluatedAt`, and explicit advisory/blocking mode are now implemented as pure primitives. Persisted/golden JSON artifacts, DB-backed equivalence, trace correlation, and policy integration remain open.

## 4. Source Map

| Source | Type | Date | Finding strength | How it changes v03 | Limit |
| --- | --- | --- | --- | --- | --- |
| Local pm-substrate implementation and changelog | Primary local repo evidence | 2026-06-05/06 | High | v02 TODOs for subject binding, original observation contracts, `evaluatedAt`, advisory/blocking mode, and evidence stages are no longer open as primitives. | Does not prove persisted artifacts or production enforcement. |
| [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) | Standard | 2013-04-30 | High for provenance vocabulary | Strengthens `agent`, `activity`, `entity`, `plan`, attribution, association, delegation, and derivation as a language for state-review evidence. | Provenance structure does not decide authority by itself. |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/) | Standard | 2021-11-23 | High for correlation | Strengthens trace ids and propagated context for joining tool calls, reads, proposal reviews, writes, and audit logs. | Correlation is not validity or authorization. |
| [CloudEvents specification](https://github.com/cloudevents/spec) | Official spec | v1.0.2, 2022-02-06; CNCF graduated 2024-01-25 | High for event metadata | Suggests state-review artifacts should have stable event envelope fields such as id, source, type, specversion, and time. | Common event metadata does not solve semantics. |
| [OCEL 2.0](https://www.ocel-standard.org/) and [OCEL 2.0 spec](https://arxiv.org/abs/2403.01975) | Standard/specification | 2024 | Medium-high | Strengthens object-centric process logs: one event/action often touches many objects with qualified roles. | Not an agent benchmark; mapping to pm-substrate must be tested. |
| [HearthNet](https://arxiv.org/abs/2604.09618) | Primary arXiv preprint | 2026 | Medium | Edge agents use timeline tracing and reject stale/unauthorized commands before actuation, a direct actuation-gate analogy. | Smart-home prototype may not generalize to enterprise PM workflows. |
| [Provable Coordination for LLM Agents via Message Sequence Charts](https://arxiv.org/abs/2604.17612) | Primary arXiv preprint | 2026 | Medium | Formal workflow protocols can make coordination properties independent of LLM nondeterminism. | Preprint; protocol projection is narrower than full business semantics. |
| [Claw-Eval-Live](https://claw-eval-live.github.io/) | Benchmark docs | Q2 2026 v1.0 | Medium | Reinforces grading through dispatch logs, service audit data, fixtures, traces, and deterministic checks. | Public benchmark methodology still needs source repo/task audit before direct adoption. |
| [Socio-Technical Congruence](https://doi.org/10.1145/1414004.1414008) | Primary empirical software-engineering paper | 2008 | Medium-high | Project state should expose coordination requirements from logical dependencies, not just ownership prose. | Human software teams differ from LLM agent teams. |
| [Knowledge and Performance in Knowledge-Worker Teams](https://doi.org/10.1287/mnsc.1040.0257) | Primary longitudinal PM/team paper | 2004 | Medium-high | Transactive memory depends on planning, communication, expertise distribution, and team viability; ownership/authority metadata matters. | Does not prescribe software artifact schemas. |
| [ISO 21502:2020](https://www.iso.org/standard/74947.html) | Standard | 2020-12 | Medium | Project-management guidance supports role, practice, lifecycle, and context breadth for the PM layer. | Guidance standard, not agent-state proof. |
| [Visioning Human-Agentic AI Teaming](https://arxiv.org/abs/2603.04746) | Conceptual arXiv preprint | 2026 | Medium | Team situation awareness must be sustained as plans unfold and priorities shift. | Conceptual; needs operational metrics. |
| [Development of Mental Models in Human-AI Collaboration](https://arxiv.org/abs/2510.08104) | Conceptual/ICIS 2025 paper | 2025 | Medium-low | Human-AI mental models evolve through data contextualization, reasoning transparency, and feedback. | Conceptual bridge only; not proof that any substrate design works. |

## 5. Prior-Version Claim Audit

| v02 claim or open item | v03 status | Correction or continuation |
| --- | --- | --- |
| Add `subject_mismatch` to read-set validation. | Stale/resolved as primitive | `ReadSetValidationIssueCode` includes `subject_mismatch`, and tests cover proposal subject vs current-state subject mismatch. |
| Proposal review currently derives a fresh contract from the current view. | Stale/resolved as primitive | `reviewProposedActionAgainstCurrentState()` can accept an original `ObservationContract`; ArrowHedge proposal review passes the agent's original observation. |
| ArrowHedge current-state staleness needs `asOf`/`evaluatedAt`. | Stale/resolved as primitive | `buildArrowHedgeCurrentStateView()` accepts `evaluatedAt` and computes stale conflicts/workflow position as of proposal time. |
| Warn-first is advisory-only. | Modified | Default remains advisory, but the pure review helper now has `"blocking"` mode. No integrated invariant policy or external side-effect gate was found. |
| Eval pass claims are scaffold/provisional. | Confirmed and sharpened | Evidence stages now exist. Most ArrowHedge scenarios remain `scaffolded_scenario`; only the distribution-currentness mismatch path is `detected_warning` and driven by read-set warnings. |
| Persist ArrowHedge reports/proposal reviews as JSON artifacts. | Still open | Tests create in-memory objects; no generated or checked-in JSON review artifacts were found under `artifacts/evals` or package fixtures. |
| DB-backed projection should produce the same report shape as fixture path. | Still open/blocked by environment | Integration code references current-state view in DB-backed tests, but this run did not execute DB proof and existing docs still treat Postgres availability as environment-gated. |
| Continuity checkpoints should link to state-review artifacts. | Still open | Evidence-linked continuity payloads can cite state refs/current-state ids, but no durable state-review artifact id is linked yet. |
| RAG/memory alone cannot supply authority or mutation safety. | Confirmed | New standards/process bridges strengthen the need for provenance, validity windows, policy, and replay rather than bigger retrieval. |
| COP must be continuously refreshed, not a static dashboard. | Confirmed | Team SA, OCEL/process, trace, and project-coordination sources all point toward refreshed shared operational state. |

## 6. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| In-memory action reviews are hard to audit or replay | Provenance-bearing state-review artifact | W3C PROV, CloudEvents, event sourcing | High | A state review should be a durable entity/event with derivations from source refs, tool observations, and current-state views. | Add `StateReviewArtifact` with envelope id/source/type/time, provenance links, review payload, schema version, and artifact hash. | `review_artifact_generation_rate`, `review_replay_fidelity`, `artifact_hash_mismatch_rate` | In-memory tests catch every stale/authority regression and replay adds no diagnostic value. | Review artifacts can expose sensitive business context; add redaction and retention policy. |
| Tool calls, reads, proposal reviews, and writes are hard to join | Trace context propagation | W3C Trace Context, OpenTelemetry | High for correlation, Medium for validity | Read-set and proposal-review artifacts should carry trace/span correlation so failures can be reconstructed across agents/tools. | Add optional `traceparent`, `tracestate`, `spanId`, and parent review ids to capability invocations and review artifacts. | `trace_join_coverage`, `orphan_review_rate`, `triage_time_to_root_cause` | Trace ids do not reduce stale-action failures or investigation time in replay tests. | Trace metadata can leak topology or user context across boundaries. |
| A single action often touches multiple business objects | Object-centric event/process log | OCEL 2.0, object-centric process mining | Medium-high | `CurrentStateView.subject` is necessary but not always sufficient; review artifacts need related objects and qualified roles. | Add `relatedObjects` or qualified refs for actor, decision, risk state, evidence doc, workflow run, owner, and customer/account/project. | `object_role_coverage`, `wrong_object_action_rate`, `object_flattening_regression_rate` | Subject-only read sets catch all wrong-object and partial-process failures. | Over-modeling can create surveillance-heavy process maps; limit roles to action validity. |
| High-consequence side effects need more than warnings | Actuation lease / invariant-gated command | HearthNet, control systems, access/lease patterns | Medium | Advisory review should become policy-gated for selected invariant classes before external side effects. | Add `enforcementPolicy` mapping issue codes to `advisory`, `block`, `escalate`, or `refresh_required` by action class. | `stale_command_rejection_rate`, `false_block_rate`, `blocked_mutation_count` | Advisory-only mode has the same side-effect error rate as targeted blocking. | False blocks can stop legitimate work; include override/escalation trails. |
| Workflow validity cannot rely on prompt agreement | Protocol projection and valid next-action contracts | Message Sequence Charts, workflow runtimes | Medium | Allowed actions should derive from a workflow/protocol specification where possible, then be checked at proposal time. | Connect `AllowedAction.requiredWorkflowPosition` to workflow definitions and review artifact evidence. | `invalid_next_action_rate`, `workflow_rebase_success_rate`, `protocol_projection_coverage` | Hand-authored allowed actions perform as well as protocol-derived actions under mutation tests. | Over-formalization can make legitimate adaptive work hard to express. |
| Project failures arise from misaligned dependencies and communication | Socio-technical congruence | Software project coordination research | Medium-high | PM substrate should compute coordination requirements from state refs/logical dependencies and compare them to owner/handoff communication. | Add coordination-requirement records linking task, component, decision, owner, dependency, and stale/handoff status. | `coordination_congruence_gap`, `dependency_owner_resolution_time`, `handoff_rework_rate` | Coordination-gap metrics do not predict stale decisions, blockers, or rework in project traces. | Communication analytics can become worker surveillance; aggregate and scope carefully. |
| Teams need to know who/source owns what | Transactive memory and authority metadata | Knowledge-worker TMS, project teams | Medium-high | `authorityRule` should eventually be complemented by owner/steward/source-of-truth metadata visible to humans and agents. | Add owner/steward fields to state views or project state artifacts, with escalation path and last verified time. | `owner_lookup_accuracy`, `authority_resolution_time`, `source_of_truth_disagreement_rate` | Owner metadata does not reduce escalations, stale handoffs, or wrong-source actions. | Ownership metadata must avoid blaming individuals for systemic ambiguity. |
| Shared state decays as work unfolds | Team situation awareness and mental-model updating | Human-agentic teaming, shared cognition | Medium | State-review artifacts should support shared perception, comprehension, and projection through current facts, conflicts, and valid next actions. | Add COP comparison/eval where two agents/humans answer binding-source, blocker, owner, and next-action questions before/after review. | `shared_state_convergence_rate`, `shared_state_convergence_lag`, `mental_model_disagreement_count` | Static dashboard or chat transcript produces the same convergence under changed state. | Users may overtrust a polished COP; expose uncertainty, missing sources, and conflicts. |
| Benchmarks can overstate proof through labels | Benchmark audit and deterministic evidence | Claw-Eval-Live, automated benchmark auditing, local eval stages | Medium | Eval outcomes should be generated from artifacts, logs, and deterministic assertions instead of scenario labels. | Generate JSONL traces and golden review artifacts; compute metrics from artifact assertions and warning codes. | `deterministic_grader_coverage`, `scenario_label_dependency_rate`, `pass5_reliability` | Modifying expected labels changes results while modifying source/review artifacts does not. | Benchmarks can incentivize brittle behavior; keep human-auditable fixtures. |
| Blocking every warning may overcoordinate | Invariant-class policy | Coordination avoidance, OCC/read-set validation | High | Blocking should be targeted to invariant classes and action consequence, not every warning. | Define first policy classes: `block_subject_or_tenant`, `block_authority`, `block_stale_external_side_effect`, `refresh_on_missing_required_ref`, `advisory_conflict`. | `block_precision`, `false_block_rate`, `false_allow_rate`, `action_after_rebase_success_rate` | Blanket blocking dominates targeted policy without unacceptable false blocks. | Policy mistakes can either cause harm or freeze work; log reasons and support escalation. |
| Memory systems optimize recall, not operational validity | Validity/invalidation layer | STALE, Agent Memory characterization, ContractBench | High | Memory remains a derived support layer; action validity must route through current-state review. | Keep continuity summaries as projections over raw observations and link them to state-review artifact ids. | `stale_memory_intervention_rate`, `summary_replay_fidelity`, `memory_regression_rate` | Memory-only agents match artifact-backed review on stale/current authority fixtures. | Memory artifacts can preserve old sensitive data; enforce expiry and redaction. |

## 7. New Or Changed Hypotheses

1. **High: State-review artifacts should be CloudEvents-like PROV entities.** Inference: adding a durable envelope and provenance graph around `ActionProposalReview` will make pm-substrate more auditable without retraining the model. This is an inference from standards, not a source-proven agent result.
2. **High: Trace-correlated read-set/proposal-review artifacts should reduce root-cause time.** W3C Trace Context proves correlation patterns, not agent validity; pm-substrate must test whether correlation reduces debugging and handoff time.
3. **Medium-high: Object-centric review refs will catch multi-entity project failures that a single-subject view misses.** OCEL 2.0 supports the shape; pm-substrate needs fixtures where one action touches multiple objects with different roles.
4. **Medium-high: Enforcement should graduate by invariant class.** The pure `"blocking"` mode now exists, so the next question is policy selection: which warning codes block which action types.
5. **Medium: Project-state quality should be measured as socio-technical congruence, not status completeness.** A PM layer should know whether the people/agents who must coordinate because of dependencies are actually connected to the current state and handoff artifacts.
6. **Medium: Human-agentic teaming makes COP freshness a continuous process.** State-review artifacts must preserve `evaluatedAt`, `validUntil`, current conflicts, and projection version so shared situation awareness can be refreshed rather than assumed.

## 8. Project-Management Implications

The PM layer should become a living common operating picture plus a coordination-requirements map. Socio-technical congruence says it is not enough to store tasks, decisions, and dependencies; the system should expose which dependencies create coordination needs, who or which source owns the relevant state, and whether communication/handoff evidence exists.

Transactive memory literature strengthens owner/steward/source-of-truth metadata. The PM substrate should let agents and humans ask: who knows this, what source has authority, when was it last verified, what changed, who is blocked, and which next actions are valid.

Human-agentic teaming sources add a warning: a shared mental model is not a static artifact. It evolves through data contextualization, reasoning transparency, and feedback. pm-substrate should therefore measure whether state-review artifacts reduce disagreement about binding source, blocker, owner, and next action after project state changes.

ISO 21502 is useful as project-management grounding but should not be overclaimed. It supports breadth across project types and delivery approaches; it does not prove a specific agent-state architecture.

## 9. Implementation Implications For pm-substrate

1. **Promote `ActionProposalReview` into a durable `StateReviewArtifact`.**
   - Minimum fields: `artifactId`, `schemaVersion`, `generatedAt`, `traceContext`, `eventEnvelope`, `provenance`, `currentStateView`, `originalObservationContract`, `observationEvaluation`, `readSetValidation`, `warnings`, `execution`, `evidenceStage`, `fixtureId` or `sourceInvocationId`, and `artifactHash`.
   - Store generated artifacts under `artifacts/evals/arrowhedge/` or a package-owned fixture/output path, then compute eval metrics from the artifact.

2. **Add a minimal event/provenance envelope.**
   - CloudEvents-like fields: `id`, `source`, `type`, `specversion`, `time`, `subject`.
   - PROV-like links: `wasGeneratedBy`, `used`, `wasDerivedFrom`, `wasAssociatedWith`, `actedOnBehalfOf`, and optional `plan`.

3. **Add trace correlation to state-review generation.**
   - Start with optional fields so local pure helpers remain dependency-light.
   - Join capability invocation, source record, graph/event/projection reads, proposal review, and downstream write/audit events by trace id.

4. **Make multi-object state explicit.**
   - Keep `subject` for the review's primary object.
   - Add qualified related refs later for decision, risk state, evidence doc, workflow run, actor, owner, and external account/project/customer.

5. **Define enforcement policy before using `"blocking"` broadly.**
   - Default remains advisory.
   - Candidate first blocking policy: tenant mismatch, subject mismatch, authority mismatch, missing required ref, expired original observation for external side-effect actions, and workflow position mismatch on mutation actions.

6. **Turn scaffolded ArrowHedge evals into artifact-derived evals.**
   - Keep `scaffolded_scenario` visible until artifact assertions drive the outcome.
   - Promote only artifact-derived warning/blocking behavior to `detected_warning` or `blocked_mutation`.

7. **Link continuity checkpoints to state-review artifact ids.**
   - A continuity summary should cite the review artifact that made a state claim valid, stale, blocked, or superseded.
   - Raw observations and review artifacts stay primary; summaries remain projections.

8. **Add PM coordination metrics.**
   - Compute dependency-owner gaps, stale handoff rate, owner-resolution time, and shared-state convergence on project traces.

## 10. Rejected, Weak, Or Stale Bridges

1. **Stale: "Add subject mismatch/original observation/evaluatedAt" as open implementation work.** These are now closed as pure primitives; leave only artifact durability and policy integration as open.
2. **Modified: "Warn-first always allows."** Default advisory review still allows, but pure blocking mode now exists. The real open question is policy selection and side-effect integration.
3. **Weak: Standards as proof of agent correctness.** PROV, Trace Context, CloudEvents, ISO 21502, and OCEL 2.0 provide structure and vocabulary. They do not prove pm-substrate improves agent outcomes.
4. **Weak: Trace context as operational state.** Trace context helps correlate events; it is not currentness, authority, validity, or permission.
5. **Weak: Smart-home actuation as enterprise proof.** HearthNet is a useful analogy for stale/unauthorized command rejection before side effects, but enterprise PM/finance workflows need their own fixtures.
6. **Reject: A polished COP dashboard equals shared understanding.** Team cognition sources require convergence/accuracy measurement, not visual presence.
7. **Reject: Continuous memory rewrite as safe default.** No new source reversed the v01/v02 downgrade; raw evidence and invalidation gates remain required.
8. **Still weak: Protocol-only interoperability.** Message Sequence Charts can validate workflow structure, but semantic authority and source freshness still need substrate state.

## 11. Metrics And Eval Scenarios To Add

New metrics:

- `review_artifact_generation_rate`
- `review_replay_fidelity`
- `artifact_hash_mismatch_rate`
- `trace_join_coverage`
- `orphan_review_rate`
- `triage_time_to_root_cause`
- `object_role_coverage`
- `wrong_object_action_rate`
- `object_flattening_regression_rate`
- `stale_command_rejection_rate`
- `block_precision`
- `false_allow_rate`
- `coordination_congruence_gap`
- `dependency_owner_resolution_time`
- `handoff_rework_rate`
- `owner_lookup_accuracy`
- `shared_state_convergence_rate`
- `shared_state_convergence_lag`
- `scenario_label_dependency_rate`

Eval scenarios:

1. **State-review artifact replay.** Generate a golden ArrowHedge proposal-review JSON artifact, replay it through metrics, then mutate source refs, validity windows, and assertion outcomes. Metrics must change only when the artifact evidence changes.
2. **Trace-correlation break.** Remove trace linkage between source read, current-state view, proposal review, and write attempt. The eval should report `orphan_review_rate` and longer synthetic root-cause path.
3. **Object-centric multi-subject action.** Proposal acts on a portfolio decision while citing the wrong ticker/risk/evidence object role. Subject-only validation should be insufficient; qualified related refs should catch it.
4. **Targeted blocking policy.** Run the same stale/authority/subject/tenant/missing-ref fixtures under advisory, blanket blocking, and targeted invariant blocking. Compare `false_block_rate`, `false_allow_rate`, and `action_after_rebase_success_rate`.
5. **Project handoff congruence.** Successor agent receives a task with hidden logical dependencies and stale owner/source metadata. Substrate arm gets a state-review artifact plus coordination-requirements map. Measure rediscovery time and wrong-owner escalation.
6. **Shared-state convergence.** Two agents receive partially conflicting project updates. Measure whether a COP/state-review artifact reduces disagreement on binding source, owner, blocker, and valid next action.
7. **DB/fixture equivalence.** The same ArrowHedge report shape should be produced from pure fixtures and DB-backed projection, with timestamp handling deterministic.

## 12. Next-Day Watchlist

1. Inspect source repos for S-Bus, Claw-Eval-Live, ContractBench, STALE, and HearthNet. Capture fixture schemas, trace/log formats, and licensing.
2. Draft the minimal `StateReviewArtifact` JSON schema and decide whether it belongs under `@pm/agent-state`, `@pm/evals`, or a neutral artifact package.
3. Test whether CloudEvents-like envelope fields can be adopted without pulling a runtime dependency.
4. Search API-security, presigned-URL, OAuth, and capability-token literature for stronger observation-contract fields: allowed use, expiry, redaction, delegation, and revocation.
5. Search object-centric process-mining conformance-checking work for metrics that can catch multi-object workflow drift.
6. Search project-management and software-engineering sources for dependency/coordination metrics beyond socio-technical congruence.
7. Design the first blocking-policy matrix and specify which warnings remain advisory.
8. Verify whether DB-backed ArrowHedge projection can emit the same state-review artifact as pure fixtures when local Postgres is available.

## 13. Source Inventory With Links And Dates

New or newly strengthened in v03:

- Local pm-substrate repo implementation, 2026-06-05/06. Source type: primary local evidence. Links: `packages/agent-state/src/index.ts`, `packages/capability-finance-research-ingest/src/arrowhedge.ts`, `packages/evals/src/schema.ts`, `Changelog.md`.
- W3C PROV-DM: https://www.w3.org/TR/prov-dm/, W3C Recommendation, 2013-04-30. Source type: standard. Finding strength: High for provenance vocabulary.
- W3C Trace Context: https://www.w3.org/TR/trace-context/, W3C Recommendation, 2021-11-23. Source type: standard. Finding strength: High for trace correlation.
- CloudEvents specification: https://github.com/cloudevents/spec, v1.0.2 released 2022-02-06; CNCF graduated 2024-01-25. Source type: official specification. Finding strength: High for event envelope metadata.
- OCEL 2.0 standard site: https://www.ocel-standard.org/ and paper/spec https://arxiv.org/abs/2403.01975, 2024. Source type: standard/specification. Finding strength: Medium-high for object-centric process records.
- HearthNet: Edge Multi-Agent Orchestration for Smart Homes: https://arxiv.org/abs/2604.09618, 2026 arXiv preprint. Source type: primary preprint, not peer reviewed. Finding strength: Medium.
- Provable Coordination for LLM Agents via Message Sequence Charts: https://arxiv.org/abs/2604.17612, 2026 arXiv preprint. Source type: primary preprint, not peer reviewed. Finding strength: Medium.
- Claw-Eval-Live official benchmark docs: https://claw-eval-live.github.io/ and paper https://arxiv.org/abs/2604.28139, Q2 2026 v1.0. Source type: benchmark docs/primary preprint. Finding strength: Medium.
- Cataldo, Herbsleb, and Carley, Socio-Technical Congruence: https://doi.org/10.1145/1414004.1414008, ESEM 2008. Source type: primary empirical software-engineering paper. Finding strength: Medium-high.
- Lewis, Knowledge and Performance in Knowledge-Worker Teams: https://doi.org/10.1287/mnsc.1040.0257, Management Science 2004. Source type: primary longitudinal team paper. Finding strength: Medium-high.
- ISO 21502:2020 Project management guidance: https://www.iso.org/standard/74947.html, published 2020-12. Source type: standard. Finding strength: Medium for PM framing.
- Visioning Human-Agentic AI Teaming: https://arxiv.org/abs/2603.04746, 2026 arXiv preprint. Source type: conceptual preprint, not peer reviewed. Finding strength: Medium.
- Development of Mental Models in Human-AI Collaboration: https://arxiv.org/abs/2510.08104, 2025 paper/preprint. Source type: conceptual human-AI collaboration source. Finding strength: Medium-low.

Carried forward from v01/v02, audited but not re-expanded today:

- STALE: https://arxiv.org/abs/2605.06527, 2026 arXiv preprint, High for stale-memory invalidation benchmark framing.
- ContractBench: https://arxiv.org/abs/2605.17281, 2026 arXiv preprint, Medium-high for observation-contract bridge.
- S-Bus: https://arxiv.org/abs/2605.17076 and source repo noted by arXiv as https://github.com/sajjadanwar0/sbus, 2026 arXiv preprint, High for LLM-agent read-set reconstruction bridge; repo needs direct next-day inspection.
- Agent Memory: Characterization and System Implications: https://arxiv.org/abs/2606.06448, 2026 arXiv preprint, Medium-high for memory system tradeoffs, not authority.
- Recuse Signal: https://arxiv.org/abs/2606.06460, 2026 arXiv preprint, Medium for advisory access-deny behavior, not security enforcement.
- Handoff Debt: https://arxiv.org/abs/2606.02875, 2026 arXiv preprint, Medium-high for successor-agent handoff efficiency.
- Automated Benchmark Auditing: https://arxiv.org/abs/2605.26079, 2026 arXiv preprint, High for local eval humility and artifact-derived proof.
- Coordination Avoidance in Database Systems: https://www.vldb.org/pvldb/vol8/p185-bailis.pdf, PVLDB 2014, High for invariant-class coordination.
- Event Sourcing: https://www.martinfowler.com/eaaDev/EventSourcing.html, 2005 architecture essay, Medium for replayable event-state framing.

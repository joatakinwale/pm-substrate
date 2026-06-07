# Daily Arrowsmith Agent-State Research Index

Last updated: 2026-06-07
Scope: pm-substrate agent-state, operational-state, memory, workflow-agent, project-management, and cross-domain Arrowsmith research.

## Collaboration Protocol

Each daily research continuation must begin by fetching `origin/main` and checking whether other developers or automations added research files, index changes, or changelog entries. If new research exists, the next version must read it, reconcile it with the local draft, and update this index as the single research ledger before publishing. The run is not complete until the intended research slice is committed on `main`, pushed to `origin/main`, and the local and remote SHAs are rechecked.

## Current Strongest Thesis

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, or tool-observation state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action. The immediate primitive now exists as a pure review and artifact boundary: `CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + ActionProposalReview + StateReviewArtifact`. The next proof boundary is artifact lifecycle and policy use: persisted/exported artifacts, schema validation, eval-event linkage, continuity lineage, observed read-set capture, richer observation-contract integrity/binding fields, and invariant-class enforcement.

## Versions

| Version | Date | File | Role | Top delta |
| --- | --- | --- | --- | --- |
| Precursor | 2026-06-04 | `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md` | Immediate predecessor, unnumbered | Located the first-principles fault line: parametric state, prompt state, and retrieval memory are not operational state. |
| v01 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` | First numbered daily continuation | Added observation contracts, implicit stale-memory invalidation, read-set validation, stateful workflow evals, and PM shared-cognition implications. |
| v02 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md` | Repo-grounded correction and implementation bridge | Downgraded synthetic eval pass claims, corrected tautological observation-review path, added subject/read-set binding, and made JSON state-review artifacts the next code slice. |
| v03 | 2026-06-06 | `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md` | Artifact/provenance and PM-coordination bridge | Marked v02's pure-review TODOs as closed primitives, shifted the frontier to durable replayable artifacts, trace/provenance/object-role metadata, policy gating, and socio-technical coordination metrics. |
| v04 | 2026-06-07 | `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md` | Artifact lifecycle, preconditions, and coordination-state bridge | Marked `StateReviewArtifact`, ArrowHedge artifact generation, hash replay, and artifact metrics as closed pure primitives; shifted the frontier to persisted/exported artifacts, observed read-set capture, observation-contract v2, artifact-derived evals, and targeted invariant policy. |

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
12. **State-review artifacts now exist as code.** The next work is persistence/export, schema validation, eval linkage, continuity lineage, and policy use.
13. **Read sets should eventually have an observed lane.** S-Bus strengthens the case for reconstructing what agents actually read instead of trusting declared read sets alone.
14. **Observation contracts need integrity and binding fields.** RFC 9110, DPoP, HTTP Message Signatures, OAuth Token Exchange, and ContractBench sharpen freshness-only contracts into precondition, signature/integrity, holder/request-binding, and delegation questions.
15. **Coordination is not just communication volume.** Silo-Bench and team-situation-awareness work point toward convergence on correct distributed state as the PM metric.

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

### Strengthened on 2026-06-05

- MAST moved from mostly project-page support to a visible NeurIPS 2025 Datasets and Benchmarks paper.
- Who&When failure attribution remains strong evidence that multi-agent failure causality is hard and needs durable actor/step traces.
- OCC/read-set validation became the strongest closed bridge for stale-read mutations.
- S-Bus strengthened read-set validation from database analogy into current LLM-agent coordination evidence.
- Handoff Debt strengthened continuity as a measurable successor-agent handoff mechanism rather than only an amnesia/resume story.

### Downgraded on 2026-06-05

- RAG-only state claims are downgraded: retrieval helps access but does not supply authority, invalidation, workflow validity, or mutation safety.
- Continuous memory consolidation is rejected as a safe default until gated by raw evidence and regression tests.
- Agentic PM roadmap papers remain Low/Medium as product proof; they are useful for language and agenda, not architecture validation.
- Synthetic eval pass claims are downgraded to scaffold/provisional until outcomes are derived from executable assertions or observed behavior.
- Observation-contract implementation is downgraded from full stale-observation proof to assertion primitive plus a currently tautological proposal-review path.
- Warn-first review is explicitly advisory until an enforcement policy mode exists.

### Corrected on 2026-06-05 v02

- `ActionProposalReview` should evaluate the proposal's original observation contract against the current state view, not derive a fresh contract from that current view.
- `ProposedAction.subject` must be validated against `CurrentStateView.subject`.
- ArrowHedge current-state view generation needs `asOf`/`evaluatedAt` for conflicts and workflow position, while preserving source `observedAt`.
- Eval maturity should be labeled as `scaffolded_scenario`, `detected_warning`, `blocked_mutation`, or `paired_behavioral_improvement`.

### Corrected on 2026-06-06 v03

- v02's open items for `subject_mismatch`, original-observation review, `evaluatedAt`, explicit advisory/blocking mode, and evidence maturity stages are now treated as closed pure primitives after local code/changelog inspection.
- "Warn-first always allows" is now more precise: default advisory review allows, but a pure `"blocking"` mode exists; policy selection and external side-effect integration remain open.
- The strongest next implementation language is no longer "add the review fields"; it is "persist and replay state-review artifacts, then derive metrics and enforcement decisions from them."

### Corrected on 2026-06-07 v04

- `StateReviewArtifact` is no longer future work: pure construction, ArrowHedge generation, related objects, PROV-style links, trace context, canonical hash verification, tamper detection, and artifact metrics exist.
- Persisted/golden JSON artifacts remain open: current tests build artifacts in memory, and no stable artifact export/import path was found.
- Trace correlation is partial: artifacts carry optional trace context and metrics count coverage, but there is no full join across source reads, projection, proposal review, eval event, and downstream write.
- Socio-technical congruence was downgraded from broad project-quality predictor to bounded coordination diagnostic after adding mixed/negative longitudinal evidence.
- ContractBench and STALE source-code/data availability remains a source gap until direct official repo/dataset links are located.

## Rejected Bridges

1. Model weights as operational memory.
2. Bigger context window as a state solution.
3. RAG-only state layer.
4. Continuous memory rewrite as default improvement.
5. Protocol-only interoperability.
6. Chat transcript as common operating picture.
7. LLM semantic mapping as direct authority.
8. Biological quorum/stigmergy as direct business authority proof.

## Current Implementation Implications

1. Define `current_state_view` with source refs, freshness, authority, conflicts, missing sources, workflow position, and admissible next actions.
2. Add read-set validation fields to capability invocations: `readSetRefs`, `readSnapshotAt`, `authorityVersion`, `validationPolicy`, and `validationResult`.
3. Add `observation_contract` metadata for expiry, integrity, allowed use, redaction, and secret boundaries.
4. Treat continuity summaries as derived projections over raw events and tool observations.
5. Extend eval taxonomy with `implicit_conflict`, `premise_resistance`, `observation_contract`, `read_set_validation`, and `memory_consolidation_regression`.
6. Grade agent workflows by final service/workspace state, audit logs, artifacts, and pass^5 reliability where feasible.
7. Save ArrowHedge observation reports and proposal reviews as JSON eval artifacts, not just in-memory test objects.
8. Add a minimal state-review artifact envelope with CloudEvents-like id/source/type/time fields, PROV-like derivation links, optional trace context, artifact hash, and schema version.
9. Extend review artifacts toward object-centric related refs and qualified roles so a single action can cite ticker, risk state, evidence document, workflow run, owner, and project/account objects without flattening them into one subject.
10. Treat the implemented `"blocking"` mode as a policy primitive, not a default; define invariant-class enforcement before connecting it to external side effects.
11. Link continuity checkpoints and PM handoff summaries to state-review artifact ids.
12. Add project coordination metrics for dependency-owner gaps, owner/source resolution, stale handoffs, and shared-state convergence.
13. Persist/export ArrowHedge state-review artifacts and validate them against a schema before claiming artifact-derived eval maturity.
14. Add observed read-set capture and compare observed vs declared read dependencies.
15. Extend observation contracts toward integrity, holder/request binding, allowed use, issuer/source invocation, redaction, and revocation metadata.
16. Compute eval outcomes from artifact evidence where possible rather than scenario labels.
17. Add distributed-state PM evals that measure convergence on binding source, owner, blocker, and valid next action under partial project shards.

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

## Next-Day Watchlist

1. Draft and/or implement the persisted `StateReviewArtifact` JSON fixture/export path.
2. Decide whether artifact JSON schema lives in `@pm/agent-state`, `@pm/evals`, or package-level fixtures.
3. Add eval-event linkage fields for state-review artifact ids/hashes.
4. Prototype observed read-set capture and declared-vs-observed comparison.
5. Search for ContractBench and STALE official code/data repos again; do not cite source availability until primary links are located.
6. Inspect S-Bus companion repos (`sbus-experiments`, `sbus-formals`) if deeper read-set reconstruction design is needed.
7. Convert observation-contract v2 fields into a compatibility proposal, not a breaking change.
8. Define the first invariant-class policy matrix and test advisory vs targeted blocking.
9. Add at least one PM distributed-state integration eval inspired by Silo-Bench but grounded in project handoff/owner/source state.
10. Verify whether DB-backed ArrowHedge projection can emit the same state-review artifact as pure fixtures when local Postgres is available.

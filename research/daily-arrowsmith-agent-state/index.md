# Daily Arrowsmith Agent-State Research Index

Last updated: 2026-06-05
Scope: pm-substrate agent-state, operational-state, memory, workflow-agent, project-management, and cross-domain Arrowsmith research.

## Current Strongest Thesis

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, or tool-observation state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action. The immediate proof boundary is now narrower and more executable: a repeatable state-review artifact containing `currentStateView + originalObservationContract + assertionEvaluation + readSetValidation + warn-first decision`.

## Versions

| Version | Date | File | Role | Top delta |
| --- | --- | --- | --- | --- |
| Precursor | 2026-06-04 | `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md` | Immediate predecessor, unnumbered | Located the first-principles fault line: parametric state, prompt state, and retrieval memory are not operational state. |
| v01 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` | First numbered daily continuation | Added observation contracts, implicit stale-memory invalidation, read-set validation, stateful workflow evals, and PM shared-cognition implications. |
| v02 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md` | Repo-grounded correction and implementation bridge | Downgraded synthetic eval pass claims, corrected tautological observation-review path, added subject/read-set binding, and made JSON state-review artifacts the next code slice. |

## Top Findings

1. **Operational state is distinct from model, prompt, and memory state.** Weights are parametric state, prompts are inference state, memories are retrieval/continuity state, and pm-substrate should supply current admissible operational state.
2. **Observation contracts are now a major bridge.** Tool artifacts may carry expiry, integrity, permission, and allowed-use constraints that must be validated before action.
3. **Memory invalidation is harder than retrieval.** Newer evidence must invalidate stale premises and downstream behavior, not merely appear in search results.
4. **Raw episodes/events should survive summaries.** Summaries are derived views; raw tool observations and event records remain first-class evidence.
5. **Read-set validation turns the thesis into an execution contract.** High-consequence actions should follow read -> propose -> validate -> write.
6. **Project management maps to shared operational cognition.** The PM layer should expose what is known, who/source owns it, what changed, what is blocked, and which next actions are valid.
7. **Action review must compare an old observation to current state.** A contract built from the current view and immediately evaluated against that same view proves self-consistency, not currentness.
8. **Eval maturity labels now matter.** The repo has scaffolded scenarios, detected warnings, and assertion metrics, but not yet mutation blocking or paired behavioral improvement for every claim.
9. **Subject identity is part of action validity.** A proposal subject must match the current-state view subject; read-set refs alone are not enough.

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
8. Change proposal review to accept an original observation contract/read snapshot and compare it to current state.
9. Add `subject_mismatch` read-set validation.
10. Add `asOf`/`evaluatedAt` to ArrowHedge current-state view generation.
11. Preserve warn-first as advisory-only until configurable enforcement modes are implemented.

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
- `assertion_failure_by_code`
- `warning_assertion_alignment_rate`
- `subject_mismatch_detection_rate`
- `synthetic_eval_pass_count`
- `scaffolded_scenario_count`
- `detected_warning_count`
- `blocked_mutation_count`
- `db_fixture_equivalence_rate`

## Next-Day Watchlist

1. Implement artifact-backed ArrowHedge fixtures for accepted/current, stale risk, authority mismatch, missing source refs, projection drift, workflow mismatch, subject mismatch, and decision snapshot/current risk conflict.
2. Inspect STATE-Bench repo task schemas, state assertions, agent-learning track, and dataset caveats.
3. Check whether STALE, ContractBench, S-Bus, Recuse Signal, or Handoff Debt have useful source repos or fixture formats.
4. Search API-security/OAuth/presigned-URL literature for stronger observation-contract terminology and access-deny/recusal patterns.
5. Find common-operating-picture sources with measurement, not only doctrine.
6. Search process-mining and object-centric event-log papers for project handoff and coordination metrics.
7. Apply benchmark-auditing ideas to local eval fixtures so scaffolded scenarios cannot silently overstate proof.

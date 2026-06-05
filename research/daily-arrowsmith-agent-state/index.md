# Daily Arrowsmith Agent-State Research Index

Last updated: 2026-06-05
Scope: pm-substrate agent-state, operational-state, memory, workflow-agent, project-management, and cross-domain Arrowsmith research.

## Current Strongest Thesis

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, or tool-observation state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action.

## Versions

| Version | Date | File | Role | Top delta |
| --- | --- | --- | --- | --- |
| Precursor | 2026-06-04 | `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md` | Immediate predecessor, unnumbered | Located the first-principles fault line: parametric state, prompt state, and retrieval memory are not operational state. |
| v01 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` | First numbered daily continuation | Added observation contracts, implicit stale-memory invalidation, read-set validation, stateful workflow evals, and PM shared-cognition implications. |

## Top Findings

1. **Operational state is distinct from model, prompt, and memory state.** Weights are parametric state, prompts are inference state, memories are retrieval/continuity state, and pm-substrate should supply current admissible operational state.
2. **Observation contracts are now a major bridge.** Tool artifacts may carry expiry, integrity, permission, and allowed-use constraints that must be validated before action.
3. **Memory invalidation is harder than retrieval.** Newer evidence must invalidate stale premises and downstream behavior, not merely appear in search results.
4. **Raw episodes/events should survive summaries.** Summaries are derived views; raw tool observations and event records remain first-class evidence.
5. **Read-set validation turns the thesis into an execution contract.** High-consequence actions should follow read -> propose -> validate -> write.
6. **Project management maps to shared operational cognition.** The PM layer should expose what is known, who/source owns it, what changed, what is blocked, and which next actions are valid.

## Source Changes

### Added on 2026-06-05

- STALE, 2026-05-07 arXiv preprint/benchmark: implicit conflict, state resolution, premise resistance, policy adaptation.
- Useful Memories Become Faulty, 2026-05-13 arXiv preprint: continuous LLM-written consolidation can degrade; preserve raw episodes.
- ContractBench, 2026-05-17 arXiv preprint/benchmark: observation contracts with temporal validity and byte-level integrity.
- STATE-Bench official repo/release post, May 2026: stateful enterprise tasks with deterministic state assertions and pass^5 reliability.
- Claw-Eval-Live, April/May 2026: live workflow benchmark with service state, audit logs, and post-run workspace artifacts.
- Mental model discrepancy detection, 2026 arXiv preprint: unsupported beliefs, false beliefs, contradictions, omissions.
- PMI Pulse 2026 and PM teamwork bibliometrics: complexity, coordination, shared mental models/transactive memory, and trust as recurring PM mediators.

### Strengthened on 2026-06-05

- MAST moved from mostly project-page support to a visible NeurIPS 2025 Datasets and Benchmarks paper.
- Who&When failure attribution remains strong evidence that multi-agent failure causality is hard and needs durable actor/step traces.
- OCC/read-set validation became the strongest closed bridge for stale-read mutations.

### Downgraded on 2026-06-05

- RAG-only state claims are downgraded: retrieval helps access but does not supply authority, invalidation, workflow validity, or mutation safety.
- Continuous memory consolidation is rejected as a safe default until gated by raw evidence and regression tests.
- Agentic PM roadmap papers remain Low/Medium as product proof; they are useful for language and agenda, not architecture validation.

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

## Next-Day Watchlist

1. Inspect STATE-Bench repo task schemas, state assertions, agent-learning track, and dataset caveats.
2. Check whether STALE or ContractBench have source repos or public fixtures.
3. Search API-security/OAuth/presigned-URL literature for stronger observation-contract terminology.
4. Find common-operating-picture sources with measurement, not only doctrine.
5. Search process-mining and object-centric event-log papers for project handoff and coordination metrics.
6. Map the smallest code implementation target in pm-substrate: eval taxonomy plus read-set/observation-contract metadata likely beats a large COP feature.

# Local-Lab State Eval Arrowsmith Pass

Date: 2026-06-02
Status: research-backed implementation bridge

## Research Question

Can pm-substrate turn the workspace and agent-state thesis into a measured behavioral claim by running paired local-lab evals that map to current agent-memory and multi-agent-system evaluation categories?

## A/B/C Framing

- **A problem:** Agents and workspace tools act from incomplete, stale, lossy, or unauthoritative state.
- **Decision:** Which local-lab eval categories should pm-substrate run first so the result is comparable to the latest memory-agent benchmark literature and useful for closing gaps in the substrate thesis?
- **Constraints:** deterministic scenarios before LLM variability; evidence-backed `EvalEvent`s; paired baseline/substrate arms; minimal new infrastructure; categories must map to public benchmark language.

### Bridge Terms

- knowledge update
- abstention under missing or conflicting authority
- procedural execution under workflow state
- memory structure and ledgers
- causality-preserving retrieval
- multi-agent system specification/design failure
- inter-agent misalignment
- task verification

## Source Map

### Peer-Reviewed / Venue-Accepted Sources

1. **MemoryAgentBench — ICLR 2026 Poster**
   - Source: https://openreview.net/forum?id=DT7JyQC3MR
   - Key bridge: memory agents need evaluation across accurate retrieval, test-time learning, long-range understanding, and selective forgetting.
   - Substrate implication: local-lab evals should not stop at recall; they should test whether the actor updates or rejects remembered state when the world changes.

2. **G-Memory — NeurIPS 2025 Spotlight**
   - Source: https://openreview.net/forum?id=mmIAp3cVS0
   - Key bridge: multi-agent memory needs structured collaboration trajectories, cross-trial knowledge, and agent-specific customization.
   - Substrate implication: continuity checkpoints should remain evidence-backed, actor-scoped, and queryable by role/scope; flat memory is not enough.

3. **MemBench — Findings of ACL 2025**
   - Source: https://aclanthology.org/2025.findings-acl.989/
   - Key bridge: memory evaluation needs multiple levels and interaction settings, not only static long-context QA.
   - Substrate implication: pm-substrate should record both the external fixture/source and the substrate refs used by an action.

4. **StructMemEval — ICLR 2026 MemAgents Workshop Oral**
   - Source: https://openreview.net/forum?id=a9vY2sJkf4
   - Key bridge: transaction ledgers, to-do lists, trees, and similar structures expose failures that simple RAG can hide.
   - Substrate implication: graph, workflow, continuity, and event ledgers are not decorative; they are the memory structure being tested.

5. **AMA-Bench — ICLR 2026 MemAgents Workshop Oral**
   - Source: https://openreview.net/forum?id=GoSVL7mLcM
   - Key bridge: agentic memory over real trajectories fails when similarity retrieval loses causality and objective information.
   - Substrate implication: local-lab scenarios should preserve causality through `pairedRunGroup`, evidence refs, substrate refs, and event ordering.

### Useful But Lower-Weight Sources

1. **GroupMemBench — arXiv 2026**
   - Source: https://arxiv.org/abs/2605.14498
   - Why lower weight: current arXiv preprint, not treated here as peer-reviewed.
   - Key bridge: group memory stresses knowledge update, term ambiguity, temporal reasoning, and abstention; current systems underperform badly.

2. **Memory for Autonomous LLM Agents — arXiv 2026 Survey**
   - Source: https://arxiv.org/abs/2603.07670
   - Why lower weight: current arXiv survey, not treated here as peer-reviewed.
   - Key bridge: memory is a write-manage-read loop coupled to perception and action; open gaps include contradiction handling, causally grounded retrieval, and learned forgetting.

3. **MAST — Berkeley 2025 project / arXiv**
   - Source: https://sites.google.com/berkeley.edu/mast/
   - Why lower weight: useful taxonomy and dataset, but not counted here as a peer-reviewed venue source.
   - Key bridge: MAS failures often come from system design, interaction, and verification issues, not merely weak base models.

## Arrowsmith Matrix

| A problem | B bridge | C source/domain | Evidence strength | Hypothesis | Implementation implication | Metric to test | Falsifier | Risk note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent acts from stale memory | Knowledge update | MemoryAgentBench / GroupMemBench | High for MemoryAgentBench, medium for GroupMemBench | A substrate arm should pass stale-update scenarios by rebasing against authoritative state before action. | `stale-memory-after-source-update` maps to STATE-Bench-style `stateful` and memory bridge `knowledge_update`. | `stale_action_rate`, `resume_success_rate` | Substrate arm still acts from stale checkpoint after newer source ref exists. | Do not claim general memory superiority from deterministic fixtures alone. |
| Agent chooses wrong source during conflict | Abstention under authority uncertainty | MemoryAgentBench selective forgetting, GroupMemBench abstention | High/medium | A substrate arm should block or abstain when source authority is unresolved. | `wrong-source-authority-conflict` maps to STATE-Bench-style `user_experience` and memory bridge `abstention`. | `source_authority_violation_rate` | Substrate arm selects newest text instead of binding source. | Abstention can become over-blocking; track false blocks later. |
| Agent follows obsolete plan after workflow mutation | Procedural execution under current state | STATE-Bench category signal plus MAST system-design failures | Medium because STATE-Bench is not peer-reviewed yet | A substrate arm should validate the current workflow position before mutating state. | `invalid-workflow-step-after-plan` maps to STATE-Bench-style `procedural_execution` and memory bridge `workflow_rebase`. | `workflow_invalid_transition_rate` | Executor completes invalidated step after current workflow changed. | Current local lab is deterministic; future version needs real agent traces. |
| Memory loses operational structure | Ledger/list/tree structure | StructMemEval | High for workshop oral | Structured substrate memory should beat flat retrieval on ledger-like tasks because the structure is native. | Add future local-lab scenario for transaction ledger reconciliation. | `representation_loss`, `replay_fidelity` | Flat RAG baseline matches substrate on structured ledger tasks. | Needs nontrivial fixture design; not in first implementation slice. |
| Multi-agent memory loses collaboration trajectory | Role- and interaction-specific memory | G-Memory | High | Substrate continuity should model actor/scope/decision/evidence, not only shared summaries. | Add future parallel-agent scenario with planner/executor divergent snapshots. | `parallel_write_conflict`, `continuity_break` | Substrate cannot reconstruct which actor knew what and when. | Avoid overclaiming until multi-agent traces are persisted. |
| Causality is lost in long-horizon trajectories | Causality graph / objective information | AMA-Bench | Medium-high workshop oral | Causality-preserving eval events should make failure analysis more reliable than similarity-only memory. | Keep `pairedRunGroup`, `substrateRefs`, and source evidence mandatory for pass/fail events. | `replay_fidelity`, `evidence_coverage` | Eval row lacks enough refs to reconstruct why action passed/failed. | JSON notes are a start; structured category fields should come next. |

## What This Closes

The first executable local-lab suite now covers three STATE-Bench-style categories, while separately preserving memory-benchmark bridge labels:

| Local scenario | pm-substrate class | STATE-Bench-style category | Memory-benchmark bridge | Baseline | Substrate |
| --- | --- | --- | --- | --- | --- |
| `stale-memory-after-source-update` | `memory_drift` | `stateful` | `knowledge_update` | fail | pass |
| `wrong-source-authority-conflict` | `source_authority_conflict` | `user_experience` | `abstention` | fail | pass |
| `invalid-workflow-step-after-plan` | `workflow_invalidation` | `procedural_execution` | `workflow_rebase` | fail | pass |

This is not yet proof that pm-substrate beats external memory systems. It is proof that the repo now has a deterministic paired-eval harness that can express the behavioral claim and persist the evidence.

## Gaps Exposed

1. `state_bench_category`, `memory_benchmark_bridge`, and `mast_category` are currently encoded in `EvalEvent.notes`; the next schema revision should make them structured optional fields.
2. The first local-lab suite is deterministic and hand-authored. The next version should replay actual agent traces or fixture transcripts.
3. The suite does not yet include StructMemEval-style ledgers/trees or G-Memory-style multi-agent collaboration trajectories.
4. STATE-Bench is useful and current, but it is not treated here as peer-reviewed evidence. It remains the best external harness to target, not a peer-reviewed proof source.

## Next Hypotheses To Test

1. **Structured ledger hypothesis:** substrate event/continuity ledgers should outperform flat retrieval on transaction-ledger and to-do-list memory tasks.
2. **Actor-trajectory hypothesis:** actor-scoped continuity should reduce failures in planner/executor divergent-snapshot scenarios.
3. **Causality hypothesis:** requiring evidence refs and substrate refs should improve failure diagnosis speed compared with trace-only memory.
4. **Abstention calibration hypothesis:** authority-aware blocking should reduce wrong actions without creating unacceptable false-block rates.

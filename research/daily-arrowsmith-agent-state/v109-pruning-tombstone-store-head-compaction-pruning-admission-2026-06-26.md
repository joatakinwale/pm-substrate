# v109 Pruning Tombstone-Store Head Compaction Pruning Admission

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed, broad verification pending
Parent: `research/daily-arrowsmith-agent-state/v108-pruning-tombstone-store-head-durable-checkpoint-admission-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ56 - What pruning admission rule requires durable pruning tombstone-store head checkpoint-admission history plus retained witness, authority, and quorum-certificate suffix continuity before physical prefix deletion?

Answer: durable checkpoint-admission history is necessary but not sufficient. Physical prefix deletion needs a separate pruning admission object that replays the durable checkpoint-admission record chain and then proves each selected retained suffix replays from the admitted checkpoint frontier. A checkpoint record says which compacted projection may seed recovery. A pruning admission says the live store may delete prefixes because the retained witness, authority, and quorum-certificate lanes still replay from that admitted frontier.

Implemented slice:

- Added pruning tombstone-store head replay compaction pruning-admission lane, status, issue, and admission types.
- Added deterministic pruning-admission hashing.
- Added pruning-admission evaluation over the v108 durable checkpoint-admission record history.
- Added retained suffix checks for pruning tombstone-store head witness records, authority transitions, and quorum-certificate records.
- Bound the new primitive to `projection_replay_pruning_tombstone_head_pruning_tombstone_store_head_witness_replay_compaction_pruning_admission`.
- Extended focused agent-state tests for admitted pruning plus missing durable record, invalid record replay, invalid witness suffix, invalid authority suffix, and invalid quorum-certificate suffix obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://people.cs.umass.edu/~arun/cs677/reading/PBFT1.pdf)) | PBFT discards log messages only after a stable checkpoint has proof and enough replicas have executed the relevant prefix. | Pruning admission must be a distinct proof gate after checkpoint admission, not an implication of having a checkpoint object. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf)) | Raft snapshots retain last-included index/term metadata so entries after the snapshot can still pass consistency checks after log compaction. | The pruning admission replays the retained suffix from the checkpoint frontier for each lane before prefix deletion can become operational. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery uses logged history, checkpoints, and redo/undo semantics rather than current buffer memory or inferred state. | Prefix deletion is admissible only when durable checkpoint history plus retained suffix replay can recover the same decision after amnesia. |

## 3. Existing Substrate Map Delta

Already present before v109:

1. Durable pruning tombstone-store head witness observations.
2. Durable pruning tombstone-store head witness authority/key/seal history.
3. Durable pruning tombstone-store head quorum-certificate proof records.
4. Admitted pruning tombstone-store head replay compaction checkpoints.
5. Checkpoint-seeded witness, authority, and QC-record suffix replay.
6. Durable pruning tombstone-store head checkpoint-admission records and non-equivocation checks.

Newly added by v109:

1. A distinct pruning admission object for pruning tombstone-store head replay compaction.
2. Durable checkpoint-admission record replay as a precondition for pruning admission.
3. Lane-scoped suffix replay checks for witness ledger, authority topology, and quorum-certificate record history.
4. Obstruction codes for missing durable record history, invalid record replay, invalid policy, missing checkpoint lanes, and invalid retained suffixes.
5. A hash-stable authority-scoped pruning-admission proof that can later be consumed by tombstone-gated physical pruning APIs.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-gated physical pruning APIs for pruning tombstone-store head witness, authority, and QC-record lanes.
2. Durable pruning tombstone records for this layer that record actual prefix deletion.
3. Pruned-store continuity checks after actual row deletion at this layer.
4. Runtime and Axis adoption of pruning tombstone-store head pruning admission.
5. Live Postgres restart proof that admitted pruning survives process amnesia.
6. Direct SQL-delete hardening across the new compactable lanes.
7. Cross-agent monitoring for pruning admission and pruning tombstone histories.
8. Historical-vs-current replay policy for pruning admissions after later key rotation or revocation.
9. A general substrate abstraction that avoids repeating checkpoint/pruning/tombstone layers manually.
10. Production crypto adapters for witness signatures, quorum evidence, and admission verification.

## 5. Active 10-Question Backlog

The active unanswered substrate research backlog contains exactly 10 questions:

1. SQ02: What typed authority topology should replace raw `authorityScope` strings so delegation, override, and revocation are replayable?
2. SQ03: What admission calculus composes evidence admission, provider status, terminal outcome, graph authority, and projection replay into one mutation decision?
3. SQ04: What replay rule makes connector cache, tool output, MCP handle state, and local filesystem/worktree state expire unless recertified?
4. SQ05: What obstruction algebra should represent disagreement between replay certificates, local views, authority scopes, and inter-agent consensus?
5. SQ06: What settlement/finality object proves an external target-side side effect was applied and cannot be replaced by a dispatch log?
6. SQ07: What recovery kernel lets an amnesiac agent rebuild all open operational scopes from terminal history, replay-certified projections, and continuity checkpoints?
7. SQ08: What domain authority compiler maps profile/capability contracts into required replay transitions without core substrate edits?
8. SQ09: What substrate primitive turns local worktree diffs and draft files into proposals that cannot outrank admitted transition history?
9. SQ10: What monitor/proof object can show that every operational write in a run passed replay-certificate enforcement, not just terminal-outcome recovery?
10. SQ57: What tombstone-gated store pruning API and durable tombstone record make pruning tombstone-store head witness, authority, and quorum-certificate row deletion replayable and out-of-band truncation detectable?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Store Head Replay Compaction Pruning Admission.

Problem it solves: v108 made checkpoint admission durable, but physical pruning could still treat a recovered checkpoint record as enough authority to delete prefixes. That leaves a missing proof step: retained suffix continuity must be verified immediately before prefix deletion.

Research source: PBFT stable checkpoint garbage collection, Raft snapshot boundary metadata, and ARIES logged recovery.

Mechanism borrowed or adapted: after a checkpoint is admitted, deletion requires a separate proof that the durable checkpoint history replays and the retained suffix begins exactly after the compacted frontier.

Why current substrate lacked it: the pruning tombstone-store head layer had durable checkpoint-admission records but no object that admitted pruning itself.

Why existing primitives are insufficient: settlement-head and tombstone-head pruning admissions govern other authority namespaces. The v108 checkpoint-admission store governs compacted recovery, not physical prefix deletion.

State guarantee it should create: pruning tombstone-store head prefixes cannot be physically removed as operational history unless durable checkpoint-admission replay and retained suffix replay both succeed.

Admission rule it requires: a pruning admission is admitted only when the checkpoint admission record is present in replay-valid durable history and every selected lane's retained suffix replays from the admitted checkpoint frontier.

Replay rule it requires: after amnesia, the pruning admission hash is recomputed from the durable checkpoint-admission record, selected lanes, suffix counts, suffix replay results, and authority boundary.

Authority boundary it requires: pruning is scoped to pruning tombstone-store head witness replay compaction; parent checkpoint-admission records, local snapshots, summaries, connector caches, or process memory cannot authorize it.

Failure modes it should prevent:

- checkpoint records authorizing deletion without suffix continuity proof;
- missing durable admission history authorizing deletion;
- conflicting checkpoint-admission histories authorizing deletion in different agents;
- retained witness suffixes that start before or after the checkpoint frontier;
- retained authority suffixes that skip or replay old transitions;
- retained quorum-certificate suffixes that replay old certified records as live suffixes;
- adapter-provided checkpoint summaries bypassing durable replay.

Minimal implementation slice:

- Add pruning-admission public types and deterministic hash.
- Add `evaluate...PruningAdmission()` for this layer.
- Reuse the v108 checkpoint-admission record replay.
- Reuse the v107 checkpoint-seeded witness, authority, and QC-record suffix replay.
- Add focused tests for admitted pruning and all falsifying lanes.

Tests that would falsify it:

- A missing durable checkpoint-admission record still admits pruning.
- A conflicting checkpoint-admission record history still admits pruning.
- A full pre-checkpoint witness ledger passed as a retained suffix admits pruning.
- A compacted authority transition passed as a retained suffix admits pruning.
- A compacted quorum-certificate record passed as a retained suffix admits pruning.
- The pruning-admission hash changes nondeterministically for the same replay inputs.

Axis surfaces that could later validate it:

- Axis C can restart an amnesiac local agent and require pruning admission before compacted required-head histories are physically pruned.
- Axis A can attempt to use a stale local checkpoint cache to authorize deletion and require durable admission plus suffix replay to obstruct it.
- Axis B can prove a domain adapter cannot smuggle pruning authority through a profile-specific checkpoint summary.

## 7. Falsification Criteria Applied Before Implementation

1. A valid durable checkpoint-admission record plus valid retained witness, authority, and QC suffixes admits pruning.
2. An empty durable checkpoint-admission record history obstructs pruning.
3. A conflicting durable checkpoint-admission record history obstructs pruning.
4. A retained witness suffix that includes compacted prefix records obstructs pruning.
5. A retained authority suffix that includes compacted prefix transitions obstructs pruning.
6. A retained quorum-certificate suffix that includes compacted prefix records obstructs pruning.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A durable checkpoint-admission record is enough to authorize physical pruning. | Rejected. | The checkpoint record only proves a replay frontier; pruning additionally needs retained suffix continuity for each deleted lane. |
| Suffix replay tests are sufficient without a separate pruning admission artifact. | Rejected. | Without an admission object, there is no hash-stable authority-scoped proof that a particular deletion decision was admitted. |
| Parent-layer pruning admissions can be reused for pruning tombstone-store head compaction. | Rejected. | They are scoped to different checkpoint, witness, authority, and quorum-certificate histories. |

## 9. Implementation Frontier

Implemented now:

- Pruning tombstone-store head compaction pruning-admission types.
- Deterministic pruning-admission hashing.
- Pruning-admission evaluation over durable checkpoint-admission record replay.
- Retained suffix replay checks for witness, authority, and quorum-certificate lanes.
- Focused falsification tests for admitted pruning and each obstruction class.

Remaining frontier:

1. Tombstone-gated physical pruning APIs for this layer.
2. Durable pruning tombstone records for actual row deletion.
3. Pruned-store continuity after physical deletion.
4. Runtime and axis adoption.
5. Live Postgres restart proof for admitted pruning and compacted recovery.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v109-pruning-tombstone-store-head-compaction-pruning-admission-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code and ledger files found no matches.

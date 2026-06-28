# v120 Pruning Tombstone History Store-Head Compaction Pruning Admission

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v119-pruning-tombstone-history-store-head-durable-checkpoint-admission-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ67 - What pruning admission rule requires durable pruning tombstone history-store head checkpoint-admission history plus retained suffix continuity before physical prefix deletion can occur?

Answer: v119 made checkpoint authority recoverable, but a store could still physically delete history-store-head witness, authority/key/seal, or quorum-certificate-record prefixes merely because a checkpoint admission record existed. The missing substrate primitive is a separate pruning admission transition. Pruning is now admitted only when the durable checkpoint-admission record history replays and every retained suffix lane replays from the admitted checkpoint frontier under the history-store-head authority namespace.

Implemented slice:

- Added history-store-head replay compaction pruning lane, status, issue, and admission types.
- Added deterministic pruning-admission hashing.
- Added pruning admission evaluation that requires replay-valid v119 checkpoint-admission record history.
- Added retained suffix replay checks for history-store-head witness-ledger, authority/topology/key/seal, and quorum-certificate-record lanes.
- Added focused tests proving admitted pruning plus missing-record, invalid-record-history, invalid-witness-suffix, invalid-authority-suffix, and invalid-quorum-certificate-suffix obstructions.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery uses logged checkpoints plus log continuation; truncation is safe only when recovery can start from a checkpoint and continue through retained history. | Physical deletion is not authorized by a checkpoint alone; v120 requires durable checkpoint admission plus retained suffix replay continuity. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([USENIX/raft PDF](https://raft.github.io/raft.pdf)) | Log compaction snapshots preserve last-included index/term so discarded log entries are replaced by a replay anchor and suffix. | The pruning admission binds each lane to compacted-through sequence/hash frontiers and requires suffixes to replay from those frontiers. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Replicas garbage-collect protocol messages only after stable checkpoint proof makes older history unnecessary for safety. | History-store-head prefix deletion is a separate admitted transition after checkpoint proof and suffix continuity, not a storage-side optimization. |

## 3. Existing Substrate Map Delta

Already present before v120:

1. V112 durable witness-ledger recovery for pruning tombstone history-store heads.
2. V113 signed quorum authority over those witness rows.
3. V114 durable authority-transition stores and store-backed certification.
4. V115 replayed key rotation/revocation.
5. V116 non-retroactive authority epoch seals.
6. V117 durable QC proof records for certified history-store heads.
7. V118 admitted compaction checkpoints that can seed witness, authority, and QC suffix replay.
8. V119 durable checkpoint-admission record history for those checkpoints.
9. Same-pattern pruning admission already existed for settlement-head, tombstone-head, and pruning tombstone-store head compaction layers.

Newly added by v120:

1. History-store-head compaction pruning admission scoped to `projection_replay_pruning_tombstone_history_store_head_witness_replay_compaction_pruning_admission`.
2. Replay-valid durable checkpoint-admission record history as a prerequisite for pruning.
3. Retained witness suffix continuity checked by replay from the admitted checkpoint frontier.
4. Retained authority/key/seal suffix continuity checked by replay from the admitted checkpoint frontier.
5. Retained quorum-certificate-record suffix continuity checked by replay from the admitted checkpoint frontier.
6. Deterministic pruning-admission hash so later tombstone records can bind to the exact admission.

## 4. Missing Substrate Map Delta

Still missing:

1. SQ68 tombstone-gated store pruning APIs and durable pruning tombstone records for history-store-head compacted lanes.
2. Currentness/witnessing for the new history-store-head pruning tombstone ledger once deletion exists.
3. Runtime and Axis adoption of v120 pruning admission.
4. Live Postgres restart proof that a fresh process can recover after v120 admission and future tombstone-gated deletion.
5. Generic nested currentness/witness abstraction to reduce repetition across layered head ledgers.
6. Recovery-kernel inventory for every compacted required head and supporting authority store.
7. Production cryptographic verifier adapters.
8. Transition-authority signatures for the history-store head witness authority transitions themselves.
9. Monitoring that detects admission-store or pruning-admission forks across agents.
10. SQL hardening that prevents out-of-band deletion without a tombstone-bound pruning admission.

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
10. SQ68: What tombstone-gated store pruning API and durable tombstone record make pruning tombstone history-store head witness, authority/key/seal, and quorum-certificate row deletion replayable and out-of-band truncation detectable?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Compaction Pruning Admission.

Problem it solves: v119 durable checkpoint admissions could prove checkpoint authority, but physical prefix deletion still lacked an admission rule that proves retained suffixes remain replayable after deletion.

Research source: ARIES checkpoint recovery, Raft snapshot/log compaction, and PBFT stable-checkpoint garbage collection.

Mechanism borrowed or adapted: deletion is admitted only after a durable checkpoint proof exists and the retained log suffix can continue from the checkpoint frontier.

Why current substrate lacked it: the history-store-head layer had checkpoint-admission records but no pruning-admission object separating "checkpoint exists" from "prefix deletion is safe."

Why existing primitives are insufficient: earlier pruning admissions are scoped to other head layers. They cannot authorize deletion of history-store-head witness, authority, or QC rows.

State guarantee it should create: physical prefix deletion cannot become operationally valid unless durable checkpoint-admission history and every selected retained suffix lane replay under the same authority boundary.

Admission rule it requires: the supplied checkpoint-admission record must be present in replay-valid durable history, and the selected witness, authority, and quorum-certificate suffixes must replay from that admitted checkpoint.

Replay rule it requires: retained suffixes are checked by the existing lane replayers using the checkpoint/admission recovered from the durable record; any sequence gap, previous-hash mismatch, signature/key/topology failure, or QC proof failure obstructs pruning.

Authority boundary it requires: pruning admission is scoped only to pruning tombstone history-store head witness replay compaction pruning. It does not itself delete rows, prove tombstone currentness, authorize domain state, or mutate graph/connector state.

Failure modes it should prevent:

- deleting a witness prefix because a checkpoint record exists but the retained witness suffix cannot replay;
- deleting authority/key/seal history while the retained authority suffix is broken;
- deleting QC proof records while the retained QC suffix is broken;
- adapter-provided pruning claims outranking durable admission history;
- physical deletion being treated as harmless storage maintenance rather than admitted state transition.

Minimal implementation slice:

- Add pruning admission types and deterministic hash.
- Add evaluation over durable checkpoint-admission record replay.
- Reuse history-store-head witness, authority, and QC-record suffix replayers with checkpoint/admission inputs.
- Add focused positive and negative tests for record-history and suffix-continuity failures.

Tests that would falsify it:

- Pruning admission returns admitted when the checkpoint-admission record is absent from durable history.
- Pruning admission returns admitted when durable checkpoint-admission history contains a checkpoint conflict.
- Pruning admission returns admitted when retained witness suffix replay fails.
- Pruning admission returns admitted when retained authority suffix replay fails.
- Pruning admission returns admitted when retained quorum-certificate suffix replay fails.

Axis surfaces that could later validate it:

- Axis C can physically prune prefixes only after v120 admission and later tombstone records.
- Axis A can attempt stale local history recovery after pruning and expect the retained suffix plus durable checkpoint admission to dominate.
- Axis B can force adapters to cite pruning admission rather than supply synthetic "safe to delete" summaries.

## 7. Falsification Criteria Applied Before Implementation

1. Valid durable checkpoint-admission history plus valid witness, authority, and QC suffixes must admit pruning.
2. Missing checkpoint-admission record history must obstruct pruning.
3. Conflicting checkpoint-admission record history must obstruct pruning.
4. Invalid retained witness suffix must obstruct pruning.
5. Invalid retained authority suffix must obstruct pruning.
6. Invalid retained quorum-certificate suffix must obstruct pruning.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable checkpoint admission is enough to delete compacted prefixes. | Rejected. | It proves checkpoint authority, but not that retained suffixes can continue from the checkpoint after deletion. |
| Pruning is storage maintenance rather than operational state. | Rejected. | Once rows are deleted, recovery state changes; therefore deletion requires a replayable admission object. |
| A single lane's valid suffix can justify deleting every lane. | Rejected. | v120 validates each selected lane separately and obstructs if a checkpoint snapshot or suffix replay is missing. |

## 9. Implementation Frontier

Implemented now:

- History-store-head replay compaction pruning lane/status/issue/admission types.
- Deterministic pruning-admission hashing.
- Durable checkpoint-admission record replay requirement.
- Retained witness, authority, and quorum-certificate suffix continuity checks.
- Focused tests for admitted pruning plus missing-record, invalid-record-history, invalid-witness-suffix, invalid-authority-suffix, and invalid-QC-suffix obstructions.

Remaining frontier:

1. SQ68 tombstone-gated physical pruning APIs and durable tombstone records for history-store-head compacted lanes.
2. Pruned-store continuity verification after physical deletion.
3. Runtime and Axis adoption.
4. Live Postgres restart proof for amnesiac compacted recovery after deletion.
5. Generic nested currentness/witness abstraction.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run via the targeted command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.

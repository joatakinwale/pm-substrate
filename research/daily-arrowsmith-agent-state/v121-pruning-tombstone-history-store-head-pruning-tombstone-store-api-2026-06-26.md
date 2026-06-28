# v121 Pruning Tombstone History Store-Head Pruning Tombstone Store API

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v120-pruning-tombstone-history-store-head-compaction-pruning-admission-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ68 - What tombstone-gated store pruning API and durable tombstone record make pruning tombstone history-store head witness, authority/key/seal, and quorum-certificate row deletion replayable and out-of-band truncation detectable?

Answer: v120 admitted pruning, but actual row deletion could still be performed as an unmodeled storage operation. The missing primitive is a durable pruning tombstone record for this history-store-head compaction layer plus store APIs that delete compacted prefixes only through a replay-valid tombstone frontier.

Implemented slice:

- Added history-store-head replay compaction pruning tombstone record/frontier/replay/store types.
- Added deterministic tombstone record hashing and record-chain replay.
- Added in-memory and Postgres-backed pruning tombstone record stores plus migration `0051_agent_state_projection_replay_pruning_tombstone_history_store_head_pruning_tombstones.sql`.
- Added tombstone-gated prune APIs for history-store-head witness, authority/key/seal, and quorum-certificate stores.
- Added pruned-store continuity checks that replay retained suffixes after physical deletion and detect out-of-band retained-suffix truncation.
- Added focused tests proving append/replay, tamper rejection, tombstone-gated physical pruning, post-prune continuity, and silent suffix truncation detection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| O'Neil et al. 1996, "The Log-Structured Merge-Tree" ([PDF](https://dsf.berkeley.edu/cs286/papers/lsm-acta1996.pdf)) | Deletes become log/index changes in a merge-structured history rather than private absence. | History-store-head deletion is represented by a replayed tombstone transition, not inferred from rows missing in a local store. |
| Sarkar et al. 2023, "Enabling Timely and Persistent Deletion in LSM-Engines" ([ACM](https://dl.acm.org/doi/abs/10.1145/3599724), [PDF](https://subhadeep.net/assets/fulltext/Enabling_Timely_and_Persistent_Deletion_in_LSM-Engines.pdf)) | Tombstone-driven deletes need compaction policies that make deletion persistent while preserving correctness. | A tombstone record binds admitted compaction/pruning proof to the physical prefix-deletion frontier. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf), [IBM](https://research.ibm.com/publications/aries-a-transaction-recovery-method-supporting-fine-granularity-locking-and-partial-rollbacks-using-write-ahead-logging)) | Recovery correctness depends on logged state changes and checkpoint/log replay, not storage side effects remembered by a process. | Pruning must be logged as a hash-linked transition before row absence can participate in recovery. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident), [PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Log servers need proofs that events remain present and the log view is consistent with prior views; selective deletion must be auditable. | Retained suffix continuity detects silent truncation after the tombstone-authorized prefix deletion. |

## 3. Existing Substrate Map Delta

Already present before v121:

1. V112-v117 currentness, quorum, topology, key-status, seal, and durable QC records for pruning tombstone history-store heads.
2. V118 admitted compaction checkpoints for the history-store-head witness, authority/key/seal, and QC-record lanes.
3. V119 durable checkpoint-admission records for compacted recovery after amnesia.
4. V120 pruning admission requiring durable checkpoint-admission history plus retained suffix replay before deletion can be admitted.
5. Same-pattern tombstone-gated deletion existed for earlier settlement-head, tombstone-head, and pruning tombstone-store head layers.

Newly added by v121:

1. `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessReplayCompactionPruningTombstoneRecord`.
2. Replay of history-store-head compaction pruning tombstone records with sequence, previous hash, admission hash, checkpoint-admission hash, checkpoint binding, frontier binding, frontier monotonicity, and record-hash checks.
3. Durable in-memory/Postgres tombstone record stores.
4. Tombstone-gated physical prune APIs for the history-store-head witness ledger.
5. Tombstone-gated physical prune APIs for history-store-head authority/key/seal history.
6. Tombstone-gated physical prune APIs for history-store-head quorum-certificate records.
7. Pruned-store continuity verifier over retained suffixes and tombstone history.

## 4. Missing Substrate Map Delta

Still missing:

1. SQ69 currentness/witnessing for the new history-store-head pruning tombstone ledger.
2. Runtime and Axis adoption of v121 tombstone-gated deletion.
3. Live Postgres restart proof that a fresh process can recover from durable tombstones and retained suffixes after physical deletion.
4. Generic nested currentness/witness abstraction to reduce repeated layered primitives.
5. Recovery-kernel inventory for every compacted required head and supporting authority store.
6. SQL hardening that prevents out-of-band deletion without a tombstone-bound pruning admission.
7. Production cryptographic verifier adapters.
8. Transition-authority signatures for history-store-head witness authority transitions themselves.
9. Monitoring that detects tombstone-ledger forks across agents before pruned projections are accepted.
10. A substrate-level settlement/finality model for external side effects beyond internal state deletion.

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
10. SQ69: What currentness or witness protocol prevents replay-valid but stale or forked history-store-head pruning tombstone histories from authorizing pruned projections?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Pruning Tombstone Store API.

Problem it solves: physical row deletion for history-store-head compacted lanes was admitted by v120 but not itself represented as replayable operational state.

Research source: LSM tombstones and persistent deletion, ARIES write-ahead recovery, and tamper-evident logging.

Mechanism borrowed or adapted: deletion is a durable record in the history, bound to a proof frontier; retained suffixes must continue replay after the deletion.

Why current substrate lacked it: v120 returned an admitted pruning certificate, but the stores still lacked a tombstone object that row deletion must consume.

Why existing primitives are insufficient: prior tombstone records authorize different layers. Reusing them would let one authority namespace delete another layer's rows.

State guarantee it should create: row absence in history-store-head witness/authority/QC stores can only become operational state when constituted by a replay-valid, authority-scoped tombstone record plus retained suffix continuity.

Admission rule it requires: the tombstone must bind an admitted v120 pruning admission and a replay-valid v119 checkpoint-admission record.

Replay rule it requires: tombstone history must be hash-linked, frontiers must derive from the admitted checkpoint snapshots, frontiers cannot regress, and retained suffixes must replay from the latest tombstone frontier.

Authority boundary it requires: only `projection_replay_pruning_tombstone_history_store_head_witness_replay_compaction_pruning_tombstone` records can authorize this layer's row deletion.

Failure modes it should prevent:

- deleting a history-store-head witness prefix with only a local checkpoint object;
- deleting authority/key/seal rows without a durable tombstone;
- treating missing quorum-certificate rows as proof that no proof existed;
- accepting pruned stores after out-of-band retained-suffix truncation;
- adapter-provided "already pruned" summaries outranking replayed deletion history.

Minimal implementation slice:

- Add tombstone record/frontier/replay/store types.
- Add in-memory and Postgres tombstone record stores.
- Add tombstone-gated prune APIs for witness, authority, and QC stores.
- Add retained-suffix continuity verifier.
- Add migration and focused tests.

Tests that would falsify it:

- A tampered tombstone record can replay as valid.
- A tampered tombstone record can authorize prune APIs.
- A store prefix can be pruned without a tombstone for that lane.
- Post-prune retained suffix continuity fails for valid tombstones.
- Silent retained-suffix truncation is not detected.

Axis surfaces that could later validate it:

- Axis C can run a compacted/pruned recovery after deleting local witness rows.
- Axis A can attempt a stale finance recovery from pruned history and require tombstone plus suffix proof.
- Axis B can force an adapter to produce a tombstone record rather than a domain-local pruning summary.

## 7. Falsification Criteria Applied Before Implementation

1. Valid admitted pruning tombstones must append and replay.
2. Tombstone replay must reject tampered record hashes.
3. Store prune APIs must reject tampered tombstones.
4. Store prune APIs must delete exactly the admitted checkpoint frontiers.
5. Retained suffixes must replay after physical deletion.
6. Missing retained suffix rows must produce an explicit continuity obstruction.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Once pruning is admitted, row deletion can be a store implementation detail. | Rejected. | Row absence changes recoverable operational state and therefore needs a replayed tombstone transition. |
| Durable checkpoint admission and pruning admission are enough for future recovery. | Rejected. | After physical deletion, recovery must also know which rows were intentionally removed. |
| A pruned store with fewer suffix rows can be accepted if the tombstone is valid. | Rejected. | v121 continuity checks compare retained suffix counts and detect silent truncation. |

## 9. Implementation Frontier

Implemented now:

- History-store-head compaction pruning tombstone record/frontier/replay/store types.
- Deterministic tombstone record hashing.
- In-memory and Postgres-backed tombstone record stores.
- Migration `0051_agent_state_projection_replay_pruning_tombstone_history_store_head_pruning_tombstones.sql`.
- Tombstone-gated witness, authority, and quorum-certificate prune APIs.
- Pruned-store continuity verification.
- Focused tests for replay, tamper rejection, physical pruning, retained suffix replay, and silent truncation detection.

Remaining frontier:

1. SQ69 currentness/witnessing for the new tombstone ledger.
2. Runtime and Axis adoption.
3. Live Postgres restart proof for amnesiac compacted/pruned recovery.
4. Generic nested currentness/witness abstraction.
5. Recovery-kernel inventory across all compacted/pruned state layers.

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

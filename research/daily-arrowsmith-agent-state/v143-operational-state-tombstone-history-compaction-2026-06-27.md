# v143 - Operational State Tombstone History Compaction

Date: 2026-06-27
Question closed: SQ90

## Research Question

What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?

## Sources

- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Crosby and Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009: https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf
- Zhu, Sarkar, and Athanassoulis, "Acheron: Persisting Tombstones in LSM Engines", SIGMOD 2023: https://dl.acm.org/doi/10.1145/3555041.3589719

## Mechanism Extracted

ARIES supplies the checkpoint-plus-redo mechanism: recovery may begin from a checkpoint only when the retained log suffix can replay from that checkpoint frontier. Tamper-evident logging supplies the compact commitment mechanism: old log material can be compacted only if the remaining proof can still show consistency with prior commitments and membership or non-deletion obligations. Acheron/LSM tombstone work supplies the storage warning: tombstones are deletion state whose lifecycle is governed by compaction policy; removing or retaining them changes what deletion facts remain provable.

The substrate adaptation is tombstone-history compaction currentness. A compacted tombstone history is not current merely because a checkpoint says what the old head was. The checkpoint must hash-bind the compacted head, compacted sequence, retained suffix start, tenant, store, and authority scope. Recovery then replays retained tombstone records from the checkpoint head and accepts currentness only if the replay ends at the exact required admissible head.

## Existing Substrate Map

- v139 recovery cuts can inventory a required pruning tombstone-history lane.
- v140 transparency can witness store roots for recovery-cut lanes.
- v141 policy compilation can require pruning-tombstone and required-head lanes.
- v142 storage guards can prevent direct storage mutation without tombstone-derived authorization.
- Several layer-specific compaction primitives exist for witness, authority, and quorum-certificate histories.

## Missing Substrate Map

- Before v143, pm-substrate did not have a generic tombstone-history compaction checkpoint that could seed pruning tombstone-history replay after old tombstone records were removed.
- Existing required-head checks assumed the local tombstone history was replayable from retained records; they did not express how to prove currentness after the tombstone history itself was compacted.
- Existing recovery cuts could cite a pruning tombstone-history lane, but they had no generic rule saying how a compacted tombstone-history lane reconstructs its current head.
- Existing storage mutation guards protect physical mutation, but they do not prove that a compacted tombstone-history summary still reaches the required head.
- Still missing after v143: authority admission or quorum witnessing for tombstone-history compaction checkpoints, automatic integration with every tombstone store, and live Postgres recovery tests that compact real tombstone histories.

## Primitive Proposal

Name: operational state tombstone history compaction.

Problem it solves: lets pruning tombstone histories be compacted without letting private summaries, stale checkpoints, or broken retained suffixes become currentness authority.

Research source: ARIES checkpoints and redo, tamper-evident log commitments/proofs, and LSM tombstone compaction.

Mechanism borrowed: checkpoint the compacted frontier, keep a retained suffix that chains from that frontier, and accept recovery only if replay reaches the required head.

Why current substrate lacked it: tombstone histories were themselves treated as replay sources, but their own compaction boundary had no generic replay seed or retained-suffix rule.

Why existing primitives are insufficient: required-head comparison can reject stale local replay, but after tombstone records are pruned there may be no local replay unless a compacted checkpoint is admitted as a replay seed.

State guarantee it should create: compacted pruning tombstone history can authorize currentness only when a hash-valid checkpoint plus retained suffix reconstructs the exact required admissible head.

Admission rule it requires: a compaction checkpoint must bind tenant, store, authority scope, compacted-through sequence, compacted head, retained-from sequence, checkpoint actor/time, and checkpoint hash.

Replay rule it requires: retained records must hash-verify, match checkpoint scope, be sequence-contiguous from `compactedThroughSequence + 1`, chain from the compacted head record hash, and end at the required head.

Authority boundary it requires: checkpoint rows are append-only durable records; future work must add authority/witness admission before runtime stores trust them automatically.

Failure modes it should prevent: missing checkpoint, tampered checkpoint, compacted-head mismatch, retained suffix gap, retained suffix fork, retained record tampering, missing required head, stale required head, and private summary replacing replay.

Minimal implementation slice: add generic tombstone-history record/head/checkpoint types, deterministic hashes, compaction evaluator, append-only checkpoint migration, and focused tests.

Tests that would falsify it: missing checkpoint passes; retained suffix gap passes; wrong previous hash passes; stale required head passes; tampered checkpoint passes.

Axis surfaces that could later validate it: Axis C live Postgres pruning-history compaction/recovery, Axis A finance recovery after multi-layer pruning, and Axis B adapter attempts to resume from compacted tombstone summaries.

## Falsification Criteria

- A compacted tombstone-history checkpoint plus retained suffix that reaches the required head must pass.
- Missing checkpoint must produce `operational_state_tombstone_history_checkpoint_missing`.
- A tampered checkpoint must produce `operational_state_tombstone_history_checkpoint_hash_mismatch`.
- A retained suffix sequence gap must produce `operational_state_tombstone_history_retained_suffix_gap`.
- A retained suffix that does not chain from the compacted head must produce `operational_state_tombstone_history_retained_suffix_previous_hash_mismatch`.
- A stale required head must produce `operational_state_tombstone_history_required_head_sequence_mismatch` and `operational_state_tombstone_history_required_head_hash_mismatch`.

## Active 10-Question Backlog

1. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
2. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
3. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
4. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
5. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
6. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
7. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
8. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
9. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
10. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?

## Failed Assumption Ledger

- Falsified: a required pruning tombstone-store head is enough if the tombstone history backing it can later be compacted without a replay seed.
- Falsified: a compacted tombstone-history checkpoint is equivalent to currentness. It is only a replay seed; retained suffix replay must still reach the exact required head.
- Still open: v143 supplies generic compaction currentness evaluation and append-only checkpoint storage, but checkpoint authority/witness admission and runtime store adoption remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateTombstoneHistoryRecord`, `OperationalStateTombstoneHistoryStoreHead`, `OperationalStateTombstoneHistoryCompactionCheckpoint`, evaluation, and issue types.
- `buildOperationalStateTombstoneHistoryRecord()`, `operationalStateTombstoneHistoryStoreHeadFromRecord()`, `buildOperationalStateTombstoneHistoryCompactionCheckpoint()`, and deterministic hash verification helpers.
- `evaluateOperationalStateTombstoneHistoryCompaction()` for missing checkpoint, tampered checkpoint, scope mismatch, sequence mismatch, retained suffix gap, previous-hash mismatch, retained record tampering, missing required head, stale required head, and exact-head recovery.
- Migration `0060_agent_state_tombstone_history_compaction_checkpoints.sql` with append-only durable checkpoint rows.
- Tests for valid checkpoint-plus-suffix recovery, missing checkpoint refusal, retained suffix gap/previous-hash refusal, tampered checkpoint refusal, and stale required-head refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ90 is closed. SQ91 is now the active next substrate question.

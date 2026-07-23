# v132 - History-Store Head Pruning Tombstone-Store Head Pruning Tombstone Store API

Date: 2026-06-27
Question closed: SQ79

## Research Question

What tombstone-gated store pruning API makes actual v131 witness, authority/key/seal, and QC-record deletion replayable?

## Sources

- O'Neil et al., "The Log-Structured Merge-Tree (LSM-Tree)", Acta Informatica 1996: https://dsf.berkeley.edu/cs286/papers/lsm-acta1996.pdf
- Sarkar et al., "Enabling Timely and Persistent Deletion in LSM-Engines", ACM SIGMOD 2023: https://dl.acm.org/doi/abs/10.1145/3599724 and https://subhadeep.net/assets/fulltext/Enabling_Timely_and_Persistent_Deletion_in_LSM-Engines.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf

## Mechanism Extracted

LSM deletion is not just absence of a key; deletion is represented by a tombstone that participates in ordered merge/recovery semantics. Timely persistent deletion research sharpens the same point from the opposite pressure: a system that can remove obsolete data safely still needs a durable marker and retention rule so deletion is not confused with invisible loss. ARIES supplies the recovery rule: after physical change, restart must replay enough history to distinguish admitted deletion from missing data.

The substrate mechanism is therefore a target pruning tombstone store API. v131 admitted deletion intent, but v132 turns actual target row absence into state only when a hash-linked tombstone record replays, binds the exact v131 pruning admission, derives lane frontiers from the admitted checkpoint, and store prune methods consume that tombstone before deleting target witness, authority/key/seal, or quorum-certificate rows.

## Existing Substrate Map

- v129 creates target proof-preserving compaction checkpoints for history-store-head pruning tombstone-store head witness, authority/key/seal, and quorum-certificate proof-record lanes.
- v130 stores target checkpoint-admission records in replayable hash-linked durable history.
- v131 admits physical prefix deletion only after v130 record replay plus retained suffix replay.
- Earlier layers already had tombstone-gated pruning, proving the pattern but not the target v131 store surface.

## Missing Substrate Map

- Before v132, actual target row deletion could not be represented as replayable operational state.
- The target layer lacked a durable pruning tombstone record store, so row absence could still look like private truncation, store corruption, or an adapter claim.
- The target witness ledger, authority store, and QC-record store had no prune APIs tied to v131 pruning admission.
- The target continuity checker could not yet distinguish admitted deletion from out-of-band retained-suffix truncation.
- The next missing primitive is currentness for the v132 tombstone history itself: a replay-valid tombstone history can still be stale, forked, or merely local until a required head/witness layer exists.
- SQL hardening remains open: direct database DELETE/UPDATE can still bypass TypeScript store APIs unless storage-level policy or permissions enforce the tombstone gate.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head pruning tombstone store API.

Problem it solves: prevents actual target proof-history row absence from becoming operational state unless caused by an admitted, replayable, authority-scoped pruning tombstone transition.

Research source: LSM tombstones, timely persistent deletion, and ARIES recovery.

Mechanism borrowed: deletion is a durable ordered record, not the absence it eventually produces; recovery must replay that record before treating absence as valid.

Why current substrate lacked it: v131 produced deletion admission but left physical deletion and post-delete continuity as an unrecorded store operation.

Why existing primitives are insufficient: checkpoint admission and pruning admission prove that deletion may happen, but neither records that deletion did happen or gates target stores before they remove rows.

State guarantee it should create: target witness, authority/key/seal, and QC-record prefixes can be deleted only by replay-valid v132 tombstone records bound to admitted v131 pruning decisions; retained suffix truncation remains detectable.

Admission rule it requires: a tombstone record appends only when its v131 pruning admission is admitted, its checkpoint-admission record hashes match, its lane frontiers match the admitted checkpoint, and its hash-linked history replays without regression.

Replay rule it requires: tombstone records replay by tenant, sequence, previous hash, checkpoint-admission binding, pruning-admission binding, frontier derivation, no frontier regression, and record hash.

Authority boundary it requires: `projection_replay_pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_replay_compaction_pruning_tombstone`.

Failure modes it should prevent: forged tombstones deleting rows, deletion from memory-supplied pruning admission, deletion without durable v130/v131 replay, silent out-of-band prefix deletion, silent retained-suffix truncation, and treating local row absence as current state.

Minimal implementation slice: target tombstone record types, in-memory/Postgres tombstone stores, target store prune APIs for witness/authority/QC lanes, deterministic tombstone hashing/replay, pruned-store continuity, migration `0056`, and falsification tests.

Tests that would falsify it: a tampered tombstone deletes rows; a tombstone appends without admitted v131 pruning; pruning deletes more than the admitted frontier; retained suffix replay fails after valid pruning; or continuity accepts a truncated retained suffix.

Axis surfaces that could later validate it: Axis C amnesiac recovery from pruned target proof histories, Axis A finance target proof pruning after real runtime adoption, and Axis B adapter pressure when accepted fixtures exist.

## Falsification Criteria

- A target pruning tombstone record must bind the exact v131 checkpoint admission record and pruning admission.
- A forged tombstone hash must fail replay and must not be accepted by prune APIs.
- Witness, authority/key/seal, and quorum-certificate prune APIs must delete only rows at or before the tombstone frontier for their lane.
- Retained suffixes must replay after valid pruning.
- Continuity must reject missing retained witness suffixes after a tombstone admitted that suffix count.

## Active 10-Question Backlog

1. SQ80: What currentness object proves the v132 pruning tombstone history itself is current rather than merely replay-valid?
2. SQ81: What durable witness ledger recovers the v132 pruning tombstone-store head after amnesia?
3. SQ82: What quorum topology certifies the v132 pruning tombstone-store head instead of letting one observer define currentness?
4. SQ83: What authority-transition store makes that topology replayable across agents and restarts?
5. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v132 pruning tombstone-store head?
6. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v132 pruning tombstone-store head certification?
7. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
8. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, and pruning-tombstone stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
9. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
10. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?

## Failed Assumption Ledger

- Falsified: v131 deletion admission is enough to make row absence replayable. It authorizes deletion intent, but row absence needs its own durable tombstone record plus store gating.
- Still open: v132 tombstone history is replay-valid but not yet currentness-certified by a required head, witness ledger, or quorum.
- Still open: TypeScript store methods enforce the tombstone gate, but direct SQL deletion needs storage-level hardening.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneRecord`
- `InMemoryProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneRecordStore`
- `PostgresProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneRecordStore`
- `replayProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneRecords`
- `verifyProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPrunedStoreContinuity`
- target witness, authority, and quorum-certificate prune APIs
- migration `0056_agent_state_history_store_head_pruning_tombstone_store_head_pruning_tombstones.sql`

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ79 is closed. SQ80 is now the active next substrate question.

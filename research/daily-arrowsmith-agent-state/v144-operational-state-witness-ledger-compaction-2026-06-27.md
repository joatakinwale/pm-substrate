# v144 - Operational State Witness Ledger Compaction

Date: 2026-06-27
Question closed: SQ91

## Research Question

What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Distler, "Byzantine Fault-Tolerant State-Machine Replication from a Systems Perspective", ACM Computing Surveys 2021: https://dl.acm.org/doi/10.1145/3436728

## Mechanism Extracted

PBFT supplies the stable-checkpoint mechanism: old protocol messages can be discarded only after a checkpoint has a proof, and that checkpoint becomes the low-water mark for future protocol state. Raft supplies the snapshot-continuity mechanism: log compaction must preserve the last included index and term so later retained log entries have a previous point to attach to. BFT systems surveys make the recovery implication explicit: checkpointing and state transfer are not storage optimizations alone; they are part of the safety machinery that lets replicas recover without replaying every old message.

The substrate adaptation is witness-ledger compaction. A pruned witness ledger cannot recover a required head from memory or from a summary saying "the witnesses accepted this." A compacted witness-ledger checkpoint must hash-bind the replay-derived ledger head, including the latest accepted head and obstruction summary. Retained witness records then replay from that compacted head. Recovery accepts the required head only if retained replay reconstructs the exact latest accepted admissible head.

## Existing Substrate Map

- v134-style witness ledgers can recover required heads from replayed witness observations before pruning.
- v135-v138 add quorum topology, durable topology, key currentness, and seals for the recovered required head.
- v139 recovery cuts can require witness-ledger lanes.
- v143 tombstone-history compaction can recover compacted tombstone histories from checkpoint seeds plus retained suffixes.

## Missing Substrate Map

- Before v144, pm-substrate did not have a generic witness-ledger compaction checkpoint that preserved the replay-derived latest accepted head after witness records were pruned.
- Existing witness ledgers could recover from full retained observations, but they did not express a compacted replay seed for witness history itself.
- Existing tombstone-history compaction was insufficient because it compacts deletion facts, not witness decisions about required-head currentness.
- Existing recovery cuts could cite witness-ledger lanes, but they had no generic rule saying how a compacted witness-ledger lane reconstructs its latest accepted head.
- Still missing after v144: authority admission or quorum witnessing for witness-ledger compaction checkpoints, automatic integration with layer-specific witness stores, and live Postgres recovery tests that prune real witness rows.

## Primitive Proposal

Name: operational state witness ledger compaction.

Problem it solves: preserves required-head recovery after the witness ledger that recovered the head has itself been compacted or pruned.

Research source: PBFT stable checkpoints, Raft snapshots/log compaction, and BFT state-transfer surveys.

Mechanism borrowed: compact the ledger only at a hash-bound replay-derived state; retain suffix records that chain from that compacted state; accept recovery only if the suffix reconstructs the required committed/accepted state.

Why current substrate lacked it: witness-ledger recovery was durable only while the witness observations remained replayable as rows.

Why existing primitives are insufficient: tombstone-history compaction preserves deletion history, but witness ledgers have a different state projection: latest accepted head plus obstruction evidence.

State guarantee it should create: a compacted witness ledger can authorize required-head recovery only when a hash-valid checkpoint plus retained witness suffix reconstructs the exact required admissible head as the latest accepted head.

Admission rule it requires: a witness-ledger compaction checkpoint must bind tenant, ledger id, authority scope, compacted-through sequence, compacted ledger head, retained-from sequence, checkpoint actor/time, and checkpoint hash.

Replay rule it requires: retained witness records must hash-verify, match checkpoint scope, be sequence-contiguous from the checkpoint frontier, chain from the compacted ledger head record hash, and update latest accepted head/obstruction summary deterministically.

Authority boundary it requires: checkpoint rows are append-only durable records; future work must add authority/witness admission before runtime witness stores trust them automatically.

Failure modes it should prevent: missing checkpoint, tampered checkpoint, compacted-head mismatch, retained suffix gap, retained suffix fork, retained witness-record tampering, missing required head, stale required head, and rejected/obstructed witness observations being erased by compaction.

Minimal implementation slice: add generic witness-ledger record/head/checkpoint types, deterministic hashes, replay evaluator, append-only checkpoint migration, and focused tests.

Tests that would falsify it: missing checkpoint passes; retained suffix gap passes; wrong previous hash passes; stale required head passes; tampered checkpoint passes; rejected observations are lost from the compacted obstruction count.

Axis surfaces that could later validate it: Axis C live witness-ledger pruning/recovery, Axis A finance recovery after witness-ledger pruning, and Axis B adapter attempts to resume from witness summaries instead of admitted witness replay.

## Falsification Criteria

- A compacted witness-ledger checkpoint plus retained suffix that recovers the required head as the latest accepted head must pass.
- Missing checkpoint must produce `operational_state_witness_ledger_checkpoint_missing`.
- A retained suffix sequence gap must produce `operational_state_witness_ledger_retained_suffix_gap`.
- A retained suffix that does not chain from the compacted ledger head must produce `operational_state_witness_ledger_retained_suffix_previous_hash_mismatch`.
- A tampered checkpoint must produce `operational_state_witness_ledger_checkpoint_hash_mismatch`.
- A stale required head must produce `operational_state_witness_ledger_required_head_sequence_mismatch` and `operational_state_witness_ledger_required_head_hash_mismatch`.

## Active 10-Question Backlog

1. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
2. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
3. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
4. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
5. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
6. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
7. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
8. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
9. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
10. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?

## Failed Assumption Ledger

- Falsified: recovering a required head from a witness ledger remains durable after the witness ledger itself is pruned.
- Falsified: a compacted witness-ledger summary is currentness. It is only a replay seed; retained witness suffix replay must reconstruct the latest accepted required head.
- Still open: v144 supplies generic witness-ledger compaction currentness evaluation and append-only checkpoint storage, but checkpoint authority/witness admission and runtime witness-store adoption remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateAdmissibleHead`, `OperationalStateWitnessLedgerRecord`, `OperationalStateWitnessLedgerHead`, `OperationalStateWitnessLedgerCompactionCheckpoint`, evaluation, and issue types.
- `buildOperationalStateWitnessLedgerRecord()`, `operationalStateWitnessLedgerHeadFromRecord()`, `buildOperationalStateWitnessLedgerCompactionCheckpoint()`, and deterministic hash verification helpers.
- `evaluateOperationalStateWitnessLedgerCompaction()` for missing checkpoint, tampered checkpoint, compacted-head mismatch, retained suffix gap, previous-hash mismatch, retained record tampering, observed-head scope mismatch, missing required head, unaccepted required head, stale required head, and exact-head recovery.
- Migration `0061_agent_state_witness_ledger_compaction_checkpoints.sql` with append-only durable checkpoint rows.
- Tests for valid checkpoint-plus-suffix recovery, missing checkpoint refusal, retained suffix gap/previous-hash refusal, tampered checkpoint refusal, and stale required-head refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ91 is closed. SQ92 is now the active next substrate question.

# v153 - Operational State Tombstone-History Compaction Checkpoint Admissions

Date: 2026-06-27
Question closed: SQ100

## Research Question

What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Crosby and Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009: https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf

## Mechanism Extracted

PBFT supplies the missing distinction: a checkpoint is just state until a proof makes it stable. Stable checkpoint proof is produced by collecting enough signed checkpoint messages over the same sequence and digest; only then can earlier log material be garbage-collected. Raft and Viewstamped Replication add the recovery bridge: snapshots/checkpoints must carry the exact log frontier they replace so a recovering replica can continue from that point without rerunning or skipping operations. ARIES adds the redo-point discipline: a checkpoint bounds recovery work only when the suffix after the checkpoint can be replayed. Tamper-evident logging adds the non-equivocation pressure: compacted history needs a proof that the remaining view is consistent with prior commitments.

The substrate adaptation is a tombstone-history compaction checkpoint admission record. A checkpoint row can seed strict replay only when the latest hash-linked admission record binds the exact checkpoint hash and compacted frontier to a certified quorum certificate under the expected authority boundary. Retained suffix replay must still reconstruct the exact required head; admission only makes the checkpoint an allowed replay seed.

## Existing Substrate Map

- v143 added generic tombstone-history records, store heads, compaction checkpoints, and retained-suffix evaluation.
- v143 already rejects missing checkpoints, tampered checkpoints, retained suffix gaps, broken previous hashes, stale required heads, and wrong current heads.
- v145 added generic quorum-certificate proof certificates and proof-record replay that can express certified subject currentness.
- v149-v152 added several admission-history patterns that turn local proof objects into replayed durable transition history.

## Missing Substrate Map

- Before v153, strict tombstone-history compaction could accept any hash-valid checkpoint supplied by a caller as the replay seed.
- The checkpoint had no required admission ledger and no latest-admitted check, so an agent summary, connector cache, or local worktree object could smuggle a compacted head into recovery if it had a structurally valid checkpoint hash.
- Existing quorum-certificate proof records were generic proof objects, but v143 tombstone-history compaction did not require a certificate over the checkpoint hash.
- Existing storage guards protect physical mutation, but not replay-seed selection.
- Still missing after v153: generic quorum-certificate proof-record authority, signed witness key validation for this generic certificate boundary, runtime store adoption, live Postgres compaction/admission tests, and checkpoint-admission compaction.

## Primitive Proposal

Name: operational state tombstone-history compaction checkpoint admission record.

Problem it solves: prevents self-authored tombstone-history compaction checkpoints from becoming replay seeds for recovered operational state.

Research source: PBFT stable checkpoints, Raft snapshot metadata, Viewstamped Replication recovery checkpoints, ARIES redo points, and tamper-evident log consistency.

Mechanism borrowed: a compacted replay seed needs quorum-certified agreement over the exact checkpoint digest/frontier, and recovery must replay the retained suffix from that admitted seed.

Why current substrate lacked it: v143 proved checkpoint-plus-suffix continuity but did not distinguish a locally supplied checkpoint from an authority-admitted stable checkpoint.

Why existing primitives are insufficient: retained suffix replay can prove continuity from a seed, but it cannot prove that the seed was allowed to replace the compacted prefix.

State guarantee it should create: strict tombstone-history compaction can authorize currentness only when the checkpoint is the latest admitted checkpoint for its admission store and the retained suffix reaches the exact required head.

Admission rule it requires: admission records bind tenant, checkpoint-admission store, tombstone-history store, authority scope, admission sequence, previous admission hash, checkpoint id/hash, embedded checkpoint, certified quorum certificate, admitted-at/by metadata, and admission record hash.

Replay rule it requires: replay rejects tenant/store/scope mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered admission records, tampered embedded checkpoints, non-certified certificates, insufficient witness quorum, certificate/checkpoint subject mismatch, wrong authority boundary, and stale checkpoints after a later admission.

Authority boundary it requires: v153 requires a certified quorum certificate over the checkpoint hash under an expected authority boundary, but does not yet solve generic proof-record authority or signer/key accountability for those certificates. SQ102 and SQ110 remain open.

Failure modes it should prevent: private checkpoint summaries, stale compacted heads, wrong-store checkpoint reuse, same-sequence admission forks, wrong-boundary certificates, insufficient witness certificates, and local checkpoints outranking admitted history.

Minimal implementation slice: add checkpoint-admission record/replay types, deterministic admission hashing, strict `requireCheckpointAdmission` support in tombstone-history compaction evaluation, migration `0070`, and focused falsification tests.

Tests that would falsify it: a valid latest quorum-admitted checkpoint fails; strict compaction accepts a checkpoint without admission replay; strict compaction accepts a stale checkpoint after a later admission; wrong authority-boundary certificate passes; tampered checkpoint/admission record passes.

Axis surfaces that could later validate it: Axis C live Postgres compaction/recovery, Axis A finance pruning after tombstone-history compaction, and Axis B/domain adapters attempting to resume from locally summarized tombstone checkpoints.

## Falsification Criteria

- A checkpoint with a valid latest quorum-certified admission record plus retained suffix must pass strict compaction.
- A checkpoint without admission replay must fail under `requireCheckpointAdmission`.
- A checkpoint that is not the latest admitted checkpoint must fail under strict compaction.
- An admission certificate for the wrong authority boundary must fail replay.
- A tampered admission record or embedded checkpoint hash must fail replay.
- The SQL surface must persist append-only admission records separate from raw checkpoint rows.

## Active 10-Question Backlog

1. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
2. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
3. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
4. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
5. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
6. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
7. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
8. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
9. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
10. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: a hash-valid tombstone-history compaction checkpoint is an admissible replay seed.
- Falsified: retained suffix continuity alone proves the compacted prefix was legitimately replaced.
- Still open: v153 supplies replay-current checkpoint admission with certified quorum certificates, but generic proof-record authority, signer/key validation for this generic certificate boundary, runtime adoption, live database tests, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionRecord`, replay, and issue types.
- `buildOperationalStateTombstoneHistoryCompactionCheckpointAdmissionRecord()`, `computeOperationalStateTombstoneHistoryCompactionCheckpointAdmissionRecordHash()`, and `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionRecords()`.
- `evaluateOperationalStateTombstoneHistoryCompaction({ requireCheckpointAdmission: true })` so compacted replay seeds fail unless latest admitted.
- Migration `0070_agent_state_tombstone_history_compaction_checkpoint_admissions.sql` with append-only admission records and public DML revocation.
- Tests for valid quorum-admitted checkpoint replay, missing admission replay refusal, stale checkpoint refusal, wrong-boundary certificate refusal, and tampered admission refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (129 passed)

Full verification after ledger publication:

- `pnpm typecheck` (workspace typecheck passed)
- `pnpm test` (533 passed, 143 skipped)
- `git diff --check` (passed)

Outcome: SQ100 is closed. SQ101 is now the active next substrate question, with SQ110 added as new checkpoint-admission authority pressure.

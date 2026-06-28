# v154 - Operational State Witness-Ledger Compaction Checkpoint Admissions

Date: 2026-06-27
Question closed: SQ101

## Research Question

What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Distler, "Byzantine Fault-tolerant State-machine Replication from a Systems Perspective", ACM Computing Surveys 2021: https://dl.acm.org/doi/pdf/10.1145/3436728
- Liang et al., "Towards More Predictable Performance in State Machine Replication", PVLDB 2025: https://www.vldb.org/pvldb/vol18/p2505-charapko.pdf

## Mechanism Extracted

PBFT exposes the missing rule: a checkpoint becomes stable only after enough replicas attest to the same sequence and digest. Raft and Viewstamped Replication explain why a compacted state object must carry the exact log frontier it replaces; recovery resumes from that frontier, not from a private summary. BFT state-machine replication surveys and recent SMR snapshotting work reinforce that checkpointing is a log-management protocol surface, not an application-cache optimization: pruning and state transfer stay safe only when checkpoint creation, retention, and transfer are tied to protocol authority.

The substrate adaptation is a witness-ledger compaction checkpoint admission record. A compacted witness-ledger checkpoint is not operational currentness merely because it can reconstruct an accepted head from retained suffix records. Strict recovery must also prove that the checkpoint seed itself was admitted as the latest quorum-certified checkpoint for the tenant, witness ledger, authority scope, and checkpoint-admission store.

## Existing Substrate Map

- v144 added generic witness-ledger records, compacted ledger heads, compaction checkpoints, and retained-suffix evaluation.
- v144 already rejects missing checkpoints, tampered checkpoints, retained suffix gaps, broken previous hashes, observed-head scope mismatches, unaccepted required heads, and stale required heads.
- v145 added generic quorum-certificate proof certificate shapes.
- v153 added the adjacent tombstone-history checkpoint-admission pattern for compacted replay seeds.

## Missing Substrate Map

- Before v154, strict witness-ledger compaction could accept any hash-valid witness checkpoint supplied by a caller as the replay seed.
- A retained witness suffix can prove continuity from a seed, but not that the seed was admitted by witness authority.
- Existing witness-ledger compaction had no admission ledger, no latest-admitted checkpoint check, and no required quorum certificate over the checkpoint hash.
- Existing tombstone-history checkpoint admissions did not cover witness-ledger currentness because the witness ledger carries accepted/obstructed head decisions, not tombstone records.
- Still missing after v154: generic proof-record authority, signer/key validation for generic checkpoint certificates, runtime witness-store adoption, live Postgres compaction/admission tests, and admission compaction.

## Primitive Proposal

Name: operational state witness-ledger compaction checkpoint admission record.

Problem it solves: prevents self-authored witness-ledger compaction checkpoints from becoming replay seeds for recovered accepted-head currentness.

Research source: PBFT stable checkpoints, Raft snapshot metadata, Viewstamped Replication recovery checkpoints, BFT state-transfer/checkpointing literature, and SMR log-management work.

Mechanism borrowed: compacted recovery can start from a checkpoint only when protocol authority certifies the exact checkpoint digest/frontier and replay continues from that admitted frontier.

Why current substrate lacked it: v144 proved retained witness suffix continuity but did not prove that the compacted ledger-head seed was allowed to replace the pruned prefix.

Why existing primitives are insufficient: witness-ledger replay can recover the latest accepted head, but without checkpoint admission a local summary can choose the starting accepted/obstruction state.

State guarantee it should create: strict witness-ledger compaction can recover accepted-head currentness only when the checkpoint is the latest admitted checkpoint for its admission store and retained witness records reconstruct the exact required accepted head.

Admission rule it requires: admission records bind tenant, checkpoint-admission store, witness ledger id, authority scope, admission sequence, previous admission hash, checkpoint id/hash, embedded checkpoint, certified quorum certificate, admitted-at/by metadata, and admission record hash.

Replay rule it requires: replay rejects tenant/ledger/store/scope mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered admission records, tampered embedded checkpoints, non-certified certificates, insufficient witness quorum, certificate/checkpoint subject mismatch, wrong authority boundary, and stale checkpoints after a later admission.

Authority boundary it requires: v154 requires a certified quorum certificate over the witness-ledger checkpoint hash under an expected authority boundary, but signer/key accountability for these certificate-bearing admission rows remains SQ111.

Failure modes it should prevent: private witness-ledger summaries, stale accepted-head seeds, wrong-ledger checkpoint reuse, same-sequence admission forks, wrong-boundary certificates, insufficient witness certificates, and local witness checkpoint state outranking admitted history.

Minimal implementation slice: add checkpoint-admission record/replay types, deterministic admission hashing, strict `requireCheckpointAdmission` support in witness-ledger compaction evaluation, migration `0071`, and focused falsification tests.

Tests that would falsify it: a valid latest quorum-admitted checkpoint fails; strict compaction accepts a checkpoint without admission replay; strict compaction accepts a stale checkpoint after a later admission; wrong authority-boundary certificate passes; tampered checkpoint/admission record passes.

Axis surfaces that could later validate it: Axis C live Postgres witness-ledger compaction/recovery, Axis A finance recovery after witness-ledger pruning, and Axis B/domain adapters attempting to resume from locally summarized witness-ledger checkpoints.

## Falsification Criteria

- A witness-ledger checkpoint with a valid latest quorum-certified admission record plus retained suffix must pass strict compaction.
- A witness-ledger checkpoint without admission replay must fail under `requireCheckpointAdmission`.
- A witness-ledger checkpoint that is not the latest admitted checkpoint must fail under strict compaction.
- An admission certificate for the wrong authority boundary must fail replay.
- A tampered admission record or embedded checkpoint hash must fail replay.
- The SQL surface must persist append-only admission records separate from raw witness checkpoint rows.

## Active 10-Question Backlog

1. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
2. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
3. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
4. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
5. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
6. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
7. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
8. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
9. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
10. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: a hash-valid witness-ledger compaction checkpoint is an admissible replay seed.
- Falsified: retained witness suffix continuity alone proves the compacted witness prefix was legitimately replaced.
- Still open: v154 supplies replay-current checkpoint admission with certified quorum certificates, but generic proof-record authority, signer/key validation for this generic certificate boundary, runtime adoption, live database tests, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionRecord`, replay, and issue types.
- `buildOperationalStateWitnessLedgerCompactionCheckpointAdmissionRecord()`, `computeOperationalStateWitnessLedgerCompactionCheckpointAdmissionRecordHash()`, and `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionRecords()`.
- `evaluateOperationalStateWitnessLedgerCompaction({ requireCheckpointAdmission: true })` so compacted witness replay seeds fail unless latest admitted.
- Migration `0071_agent_state_witness_ledger_compaction_checkpoint_admissions.sql` with append-only admission records and public DML revocation.
- Tests for valid quorum-admitted witness checkpoint replay, missing admission replay refusal, stale checkpoint refusal, wrong-boundary certificate refusal, and tampered admission refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (132 passed)

Full workspace verification after ledger publication:

- `pnpm typecheck`
- `pnpm test` (536 passed, 143 skipped)
- `git diff --check`

Outcome: SQ101 is closed. SQ102 is now the active next substrate question, with SQ111 added as new witness-checkpoint-admission authority pressure.

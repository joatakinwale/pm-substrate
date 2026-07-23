# v163 - Operational State Tombstone-History Checkpoint Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ110

## Research Question

What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Lawniczak et al., "Stream-based State-Machine Replication", EDCC 2021: https://www4.cs.fau.de/Publications/2021/lawniczak_21_edcc.pdf

## Mechanism Extracted

PBFT supplies the stability distinction: a checkpoint becomes stable only after enough signed checkpoint messages agree on the same sequence and digest; only then can earlier protocol messages be discarded. Viewstamped Replication adds the recovery bridge: a recovering node obtains checkpoint state and then replays the log suffix from that checkpoint. ARIES supplies the redo-boundary discipline: checkpoint metadata bounds recovery only because restart analysis/redo account for updates around the checkpoint. Stream-based state-machine replication reinforces that checkpointing is a sub-protocol for garbage collection and recovery, not a local snapshot privilege.

The substrate adaptation is a tombstone-history checkpoint-admission witness ledger. v153 already required a checkpoint to replay as the latest quorum-certified checkpoint-admission record before it could seed compacted tombstone-history replay. SQ110 closes the next accountability gap: the checkpoint-admission record itself can support strict compacted recovery only when a separate hash-linked witness history quorum-certifies the exact checkpoint-admission record hash under the expected authority boundary.

## Existing Substrate Map

- v143 added tombstone-history records, store heads, compaction checkpoints, and retained-suffix replay from a checkpoint to an exact required head.
- v153 added `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionRecord` so strict compaction consumes only latest admitted checkpoint seeds with a quorum certificate over the checkpoint hash/frontier.
- v159, v161, and v162 established the pattern that replay-current admission rows still need separate witness accountability before they can support strict operational state.
- Existing quorum certificate proof objects can certify exact subject kind/id/sequence/hash, but before v163 they did not certify tombstone-history checkpoint-admission record hashes.

## Missing Substrate Map

- Before v163, a checkpoint-admission row could be hash-valid, latest, and certificate-bearing while still being the final self-authored authority object.
- Existing checkpoint-admission replay proved currentness of the checkpoint seed, not independent accountability of the checkpoint-admission transition.
- The admission certificate inside the row certified the checkpoint hash, but no separate ledger certified the admission row that claimed to carry that certificate.
- Existing guard, policy, and recovery-cut witnesses did not cover tombstone-history compaction replay seeds.
- Still missing after v163: checkpoint-admission witness authority topology, witness signatures/key status, runtime store adoption, trigger/procedure deployment, witness-ledger compaction, and live Postgres recovery/privilege tests.

## Primitive Proposal

Name: operational state tombstone-history checkpoint admission witness record.

Problem it solves: prevents self-authored tombstone-history checkpoint-admission rows from authorizing compacted recovery.

Research source: PBFT stable checkpoint proof, Viewstamped Replication checkpoint-plus-log-suffix recovery, ARIES checkpoint redo boundaries, and state-machine-replication checkpoint/gc sub-protocols.

Mechanism borrowed: a checkpoint/replay seed becomes usable only after an accountable proof over the exact checkpoint boundary exists, and recovery remains tied to the retained suffix from that boundary.

Why current substrate lacked it: v153 made checkpoint seeds replay-current but left the checkpoint-admission record itself as the last operational authority object.

Why existing primitives are insufficient: checkpoint admission certifies the checkpoint hash, but the certificate-bearing admission row can still be self-authored unless a separate witness ledger certifies the exact admission record hash.

State guarantee it should create: strict tombstone-history compaction can authorize currentness only when the latest checkpoint-admission record replays and a separate witness ledger certifies the exact checkpoint-admission record hash, checkpoint id/hash, store, and admission sequence.

Admission rule it requires: witness records bind tenant, checkpoint-admission witness store, checkpoint-admission store, tombstone-history store, authority scope, witness sequence, admission sequence, checkpoint id/hash, admission record hash, quorum certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid checkpoint-admission replay, tenant/store/scope mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-admission witnesses, and witness/admission record mismatch.

Authority boundary it requires: the quorum certificate subject must be `operational_state_tombstone_history_compaction_checkpoint_admission_record`, with subject id equal to `checkpointAdmissionStoreId:tombstoneHistoryStoreId:checkpointId`, subject sequence equal to the admission sequence, and subject hash equal to the checkpoint-admission record hash.

Failure modes it should prevent: self-authored certificate-bearing checkpoint-admission rows, stale checkpoint-admission rows, wrong-boundary connector-cache witnesses, under-quorum checkpoint-admission witnesses, certificate subject substitution, witness-history forks, and compacted recovery seeded by unwitnessed admission history.

Minimal implementation slice: add checkpoint-admission witness record types, deterministic witness hashing, witness replay, strict tombstone-history compaction through `requireCheckpointAdmissionWitnessQuorum`, durable SQL witness table, and tests for accepted, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest checkpoint admission fails; strict compaction passes with checkpoint-admission replay but no witness replay; an under-quorum witness certificate passes; a certificate over a different admission record hash passes; a wrong authority boundary passes; the stricter witness flag does not imply the base checkpoint-admission gate.

Axis surfaces that could later validate it: Axis C direct local agent-state compacted recovery, Axis A finance pruning after tombstone-history compaction, and Axis B/domain adapters attempting to resume from local checkpoint summaries.

## Falsification Criteria

- A latest checkpoint-admission record with certified witness replay over the exact admission record hash must satisfy strict tombstone-history compaction.
- Strict witness-quorum compaction must block when checkpoint-admission replay exists but witness replay is missing.
- A certificate over the wrong checkpoint-admission record hash must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base checkpoint-admission gate even if the caller does not set `requireCheckpointAdmission`.

## Active 10-Question Backlog

1. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
2. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
3. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored topology snapshots?
4. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
5. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?
6. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
8. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current tombstone-history checkpoint admission rows are enough to make compacted recovery seeds accountable.
- Falsified: a quorum certificate embedded inside an admission row is sufficient authority for the row that carries it.
- Still open: witness records carry quorum certificates, but checkpoint-admission witness authority topology, witness signatures/key status, runtime adoption, procedure deployment, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecord`, replay, evaluation result fields, and issue types.
- `buildOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecord()`, `computeOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecordHash()`, `operationalStateTombstoneHistoryCompactionCheckpointAdmissionSubjectId()`, and `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecords()`.
- Strict compaction evaluation through `requireCheckpointAdmissionWitnessQuorum`; the stricter flag implies the base checkpoint-admission replay gate.
- Migration `0080_agent_state_tombstone_history_compaction_checkpoint_admission_witness_records.sql` with append-only witness rows and public DML revocation for checkpoint admission and witness records.
- Tests for valid witness-certified checkpoint admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (156 passed)
- `pnpm typecheck`
- `pnpm test` (560 passed, 143 skipped)
- `git diff --check`

Outcome: SQ110 is closed. SQ111 is now the active next substrate question, with SQ120 added as new tombstone-history checkpoint-admission witness authority pressure.

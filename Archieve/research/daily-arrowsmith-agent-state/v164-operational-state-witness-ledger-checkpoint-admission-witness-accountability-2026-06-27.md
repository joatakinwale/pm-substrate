# v164 - Operational State Witness-Ledger Checkpoint Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ111

## Research Question

What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Distler, "Byzantine Fault-Tolerant State-Machine Replication from a Systems Perspective", ACM Computing Surveys 2021: https://www4.cs.fau.de/Publications/2021/distler_21_csur.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf
- Tomescu et al., "Transparency Logs via Append-Only Authenticated Dictionaries", ACM CCS 2019: https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf

## Mechanism Extracted

PBFT supplies the stable-checkpoint rule: replicas can garbage-collect history only after a proof of enough signed checkpoint messages over the same sequence and digest. Raft supplies the retained-frontier discipline: a snapshot carries the last included index and term so the log suffix after the snapshot remains positionally checked. Distler's BFT-SMR survey makes the recovery requirement explicit: checkpointed state must include the application/protocol/reply state needed for a correct replica to resume indistinguishably from replay. CoSi and transparency-log work add the accountability bridge: authoritative log or checkpoint statements should be cosigned by a diverse witness set before clients treat them as acceptable, because append-only logs can otherwise equivocate or rewrite history behind a single signing key.

The substrate adaptation is a witness-ledger checkpoint-admission witness ledger. v154 already required a witness-ledger compaction checkpoint to replay as the latest quorum-certified checkpoint-admission record before it could seed compacted witness-ledger recovery. SQ111 closes the next accountability gap: the witness-ledger checkpoint-admission row itself can support strict compacted witness recovery only when a separate hash-linked witness history quorum-certifies the exact checkpoint-admission record hash under the expected authority boundary.

## Existing Substrate Map

- v144 added generic witness-ledger records, heads, compaction checkpoints, and retained-suffix replay to recover latest accepted-head currentness.
- v154 added `OperationalStateWitnessLedgerCompactionCheckpointAdmissionRecord` so strict witness-ledger compaction consumes only latest admitted checkpoint seeds with a quorum certificate over the checkpoint hash/frontier.
- v159, v161, v162, and v163 established the substrate pattern that replay-current admission rows still need separate witness accountability before they can support strict operational state.
- Existing quorum certificate proof objects can certify exact subject kind/id/sequence/hash, but before v164 they did not certify witness-ledger checkpoint-admission record hashes.

## Missing Substrate Map

- Before v164, a witness-ledger checkpoint-admission row could be hash-valid, latest, and certificate-bearing while still being the final self-authored authority object.
- Existing witness-ledger checkpoint-admission replay proved currentness of the checkpoint seed, not independent accountability of the checkpoint-admission transition.
- The admission certificate inside the row certified the checkpoint hash, but no separate ledger certified the admission row that claimed to carry that certificate.
- Existing tombstone-history checkpoint-admission witnesses did not cover witness-ledger accepted-head recovery because witness-ledger checkpoints summarize accepted/obstructed head decisions, not tombstone-history rows.
- Still missing after v164: witness-ledger checkpoint-admission witness authority topology, witness signatures/key status, runtime store adoption, witness-ledger witness compaction, and live Postgres recovery/privilege tests.

## Primitive Proposal

Name: operational state witness-ledger checkpoint admission witness record.

Problem it solves: prevents self-authored witness-ledger checkpoint-admission rows from authorizing compacted witness-ledger recovery.

Research source: PBFT stable checkpoint proof, Raft snapshot frontier metadata, BFT-SMR checkpoint/recovery requirements, CoSi witness cosigning, and transparency-log append-only accountability.

Mechanism borrowed: a checkpoint/replay seed becomes usable only after an accountable proof over the exact checkpoint boundary exists, and an authoritative log/checkpoint statement becomes acceptable only when a separate witness set has seen and certified the exact statement.

Why current substrate lacked it: v154 made witness-ledger checkpoint seeds replay-current but left the checkpoint-admission record itself as the last operational authority object.

Why existing primitives are insufficient: checkpoint admission certifies the checkpoint hash, but the certificate-bearing admission row can still be self-authored unless a separate witness ledger certifies the exact admission record hash.

State guarantee it should create: strict witness-ledger compaction can authorize accepted-head currentness only when the latest checkpoint-admission record replays and a separate witness ledger certifies the exact checkpoint-admission record hash, checkpoint id/hash, witness ledger, and admission sequence.

Admission rule it requires: witness records bind tenant, checkpoint-admission witness store, checkpoint-admission store, witness ledger id, authority scope, witness sequence, admission sequence, checkpoint id/hash, admission record hash, quorum certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid checkpoint-admission replay, tenant/store/ledger/scope mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-admission witnesses, and witness/admission record mismatch.

Authority boundary it requires: the quorum certificate subject must be `operational_state_witness_ledger_compaction_checkpoint_admission_record`, with subject id equal to `checkpointAdmissionStoreId:witnessLedgerId:checkpointId`, subject sequence equal to the admission sequence, and subject hash equal to the checkpoint-admission record hash.

Failure modes it should prevent: self-authored certificate-bearing witness-ledger checkpoint-admission rows, stale checkpoint-admission rows, wrong-boundary connector-cache witnesses, under-quorum checkpoint-admission witnesses, certificate subject substitution, witness-history forks, and compacted witness recovery seeded by unwitnessed admission history.

Minimal implementation slice: add witness-ledger checkpoint-admission witness record types, deterministic witness hashing, witness replay, strict witness-ledger compaction through `requireCheckpointAdmissionWitnessQuorum`, durable SQL witness table, and tests for accepted, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest checkpoint admission fails; strict witness-ledger compaction passes with checkpoint-admission replay but no witness replay; an under-quorum witness certificate passes; a certificate over a different admission record hash passes; a wrong authority boundary passes; the stricter witness flag does not imply the base checkpoint-admission gate.

Axis surfaces that could later validate it: Axis C direct local agent-state compacted witness-ledger recovery, Axis A finance pruning after witness-ledger compaction, and Axis B/domain adapters attempting to resume from local witness-ledger checkpoint summaries.

## Falsification Criteria

- A latest witness-ledger checkpoint-admission record with certified witness replay over the exact admission record hash must satisfy strict witness-ledger compaction.
- Strict witness-quorum compaction must block when checkpoint-admission replay exists but witness replay is missing.
- A certificate over the wrong checkpoint-admission record hash must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base checkpoint-admission gate even if the caller does not set `requireCheckpointAdmission`.

## Active 10-Question Backlog

1. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
2. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored topology snapshots?
3. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
4. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?
5. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
7. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current witness-ledger checkpoint admission rows are enough to make compacted witness recovery seeds accountable.
- Falsified: a quorum certificate embedded inside a witness-ledger checkpoint-admission row is sufficient authority for the row that carries it.
- Still open: witness records carry quorum certificates, but witness-ledger checkpoint-admission witness authority topology, witness signatures/key status, runtime adoption, procedure deployment, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecord`, replay, evaluation result fields, and issue types.
- `buildOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecord()`, `computeOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecordHash()`, `operationalStateWitnessLedgerCompactionCheckpointAdmissionSubjectId()`, and `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecords()`.
- Strict witness-ledger compaction evaluation through `requireCheckpointAdmissionWitnessQuorum`; the stricter flag implies the base checkpoint-admission replay gate.
- Migration `0081_agent_state_witness_ledger_compaction_checkpoint_admission_witness_records.sql` with append-only witness rows and public DML revocation for checkpoint admission and witness records.
- Tests for valid witness-certified witness-ledger checkpoint admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (158 passed)
- `pnpm typecheck` (workspace packages passed)
- `pnpm test` (562 passed, 143 skipped)
- `git diff --check`

Outcome: SQ111 is closed. SQ112 is now the active next substrate question, with SQ121 added as new witness-ledger checkpoint-admission witness authority pressure.

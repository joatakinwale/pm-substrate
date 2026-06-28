# v166 - Operational State Authority-Topology Checkpoint Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ113

## Research Question

What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored topology snapshots?

## Sources

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", PODC 2009: https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Alvisi et al., "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Goodson et al., "Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://dedis.cs.yale.edu/dissent/papers/witness-abs/
- Tomescu et al., "Transparency Logs via Append-Only Authenticated Dictionaries", ACM CCS 2019: https://eprint.iacr.org/2018/721

## Mechanism Extracted

Raft makes membership change safe by overlapping old and new quorums during joint consensus; a new configuration cannot privately replace the old one without a transition that still intersects the authority set it replaces. Vertical Paxos separates reconfiguration through a master-like authority that selects configurations for rounds, making configuration state an explicit participant in safety rather than local replica memory. Viewstamped Replication treats reconfiguration as a replicated state transition, and dynamic Byzantine quorum work shows why quorum intersection must be reconsidered when membership or thresholds change across time.

The substrate bridge is stronger than "checkpoint has a quorum certificate." Authority topology is the object that defines which future quorums can admit state. A compacted authority topology checkpoint therefore cannot rely only on a self-authored checkpoint-admission row carrying a certificate over the checkpoint. That row is itself a reconfiguration-adjacent authority statement and must enter a separate witness history whose certificate names the exact admission record hash.

## Existing Substrate Map

- v146 added authority-transition replay and proof-preserving compaction for authority topology.
- v156 added `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionRecord`, allowing compacted topology replay to require latest quorum-certified checkpoint-admission history.
- v163-v165 established the generic pattern that checkpoint/proof admission rows need a separate witness ledger before strict recovery can consume them.
- Authority topology compaction already rejects missing checkpoints, bad checkpoint hashes, stale required topology, retained suffix gaps, invalid transitions, invalid admission replay, stale admitted checkpoints, and wrong admission certificate subjects.

## Missing Substrate Map

- Before v166, strict authority-topology compaction could consume a latest checkpoint-admission row even though the row itself was the last self-authored authority object in the recovery path.
- The admission certificate inside the row certified the checkpoint hash, not the admission row that claimed to carry the certificate.
- Authority topology is the substrate's authority-defining state, so self-authored topology checkpoint-admission rows are more dangerous than ordinary domain snapshots: they can affect which future witnesses count.
- Existing tombstone, witness-ledger, and proof-record admission witness ledgers did not cover topology checkpoint admissions because topology checkpoints have their own topology id and admission subject.
- Still missing after v166: accountable authority for the new checkpoint-admission witness records themselves, witness signer/key status, runtime authority-store adoption, compaction of this witness ledger, and live database privilege tests.

## Primitive Proposal

Name: operational state authority-topology checkpoint admission witness record.

Problem it solves: prevents self-authored authority-topology checkpoint-admission rows from authorizing compacted topology recovery.

Research source: Raft joint consensus, Vertical Paxos reconfiguration, Viewstamped Replication reconfiguration, dynamic Byzantine quorum systems/storage, CoSi witness cosigning, and transparency-log append-only accountability.

Mechanism borrowed: reconfiguration state must be admitted through intersecting or externally accountable authority, and the admission statement must become an append-only witnessed object rather than a private replica assertion.

Why current substrate lacked it: v156 made topology checkpoints replay-current through admission rows, but those rows could still be self-authored certificate-bearing rows.

Why existing primitives are insufficient: topology admission witnesses for other store types do not bind `topologyId`, checkpoint id, admission sequence, and the exact authority-topology admission record hash.

State guarantee it should create: strict compacted authority-topology recovery can consume a checkpoint only when the latest checkpoint-admission row replays and a separate witness history quorum-certifies the exact checkpoint-admission record hash under the expected authority boundary.

Admission rule it requires: witness records bind tenant, checkpoint-admission witness store, checkpoint-admission store, topology id, authority scope, witness sequence, admission sequence, checkpoint id/hash, admission record hash, witness certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid admission replay, tenant/store/topology/scope mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-admission witnesses, and witness/admission record mismatch.

Authority boundary it requires: the witness certificate subject kind is `operational_state_authority_topology_compaction_checkpoint_admission_record`; subject id is `checkpointAdmissionStoreId:topologyId:checkpointId`; subject sequence is the admission sequence; subject hash is the checkpoint-admission record hash.

Failure modes it should prevent: self-authored topology checkpoint-admission rows, stale topology checkpoints after supersession, wrong-boundary topology witnesses, under-quorum witness certificates, certificate subject substitution, witness-history forks, and compacted topology recovery from unwitnessed admission history.

Minimal implementation slice: add authority-topology checkpoint-admission witness record types, deterministic witness hashing, witness replay, strict authority-topology compaction through `requireCheckpointAdmissionWitnessQuorum`, durable SQL witness table, and focused tests for valid, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest topology checkpoint admission fails; strict topology compaction passes with checkpoint-admission replay but no witness replay; an under-quorum witness certificate passes; a certificate over the wrong admission subject passes; a wrong authority boundary passes; the stricter witness flag does not imply the base checkpoint-admission gate.

Axis surfaces that could later validate it: Axis C amnesiac authority-topology recovery, Axis A finance paths consuming compacted authority topology, and Axis B/domain adapters attempting to resume from cached topology snapshots.

## Falsification Criteria

- A latest topology checkpoint-admission record with certified witness replay over the exact admission record hash must satisfy strict compacted authority-topology recovery.
- Strict checkpoint-admission witness replay must block when checkpoint-admission replay exists but witness replay is missing.
- A certificate over a wrong checkpoint-admission subject must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base checkpoint-admission gate even if the caller does not set `requireCheckpointAdmission`.

## Active 10-Question Backlog

1. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
2. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?
3. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
5. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current authority-topology checkpoint admission rows are enough to make compacted topology recovery accountable.
- Falsified: a certificate over the topology checkpoint also accounts for the admission row that carries it.
- Still open: witness records carry quorum certificates, but authority-topology checkpoint-admission witness authority topology, witness signatures/key status, runtime adoption, procedure deployment, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecord`, replay, compaction result fields, and issue types.
- `buildOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecord()`, `computeOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecordHash()`, `operationalStateAuthorityTopologyCompactionCheckpointAdmissionSubjectId()`, and `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecords()`.
- Strict compacted authority-topology recovery through `requireCheckpointAdmissionWitnessQuorum`; the stricter flag implies the base checkpoint-admission replay gate.
- Migration `0083_agent_state_authority_topology_compaction_checkpoint_admission_witness_records.sql` with append-only witness rows and public DML revocation for topology checkpoint-admission and witness records.
- Tests for valid witness-certified topology checkpoint admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (162 passed)

Outcome: SQ113 is closed. SQ114 is now the active next substrate question, with SQ123 added as new authority-topology checkpoint-admission witness authority pressure.

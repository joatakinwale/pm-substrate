# v156 - Operational State Authority-Topology Compaction Checkpoint Admissions

Date: 2026-06-27
Question closed: SQ103

## Research Question

What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?

## Sources

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", PODC 2009: https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

## Mechanism Extracted

Raft treats cluster membership as log state, with joint consensus ensuring old and new configurations overlap before the new configuration can govern progress. Raft snapshots carry enough configuration state to continue safely from the compacted frontier. Vertical Paxos separates configuration authority from ordinary command execution through a configuration master, making reconfiguration itself an authority-scoped protocol surface. Viewstamped Replication similarly treats group membership and failure tolerance as replicated protocol state. Dynamic Byzantine quorum systems show why the membership/threshold object is security-critical: changing it changes which future quorums are meaningful.

The substrate adaptation is an authority-topology compaction checkpoint admission record. A compacted authority topology checkpoint is not operational authority merely because retained suffix replay can reconstruct a topology from it. Strict topology recovery must also prove that the checkpoint seed itself was admitted as the latest quorum-certified checkpoint for the tenant, topology id, authority scope, and checkpoint-admission store.

## Existing Substrate Map

- v146 added generic authority-transition records, topology projection, topology compaction checkpoints, and retained-suffix evaluation.
- v146 already rejects missing checkpoints, tampered checkpoints, compacted-topology hash drift, retained suffix gaps, broken previous hashes, invalid retained transitions, missing required topology, and stale required topology.
- v153, v154, and v155 added adjacent admission lanes for tombstone-history checkpoints, witness-ledger checkpoints, and quorum-certificate proof records.

## Missing Substrate Map

- Before v156, strict authority-topology compaction could accept any hash-valid topology checkpoint supplied by a caller as the replay seed.
- A retained authority suffix can prove continuity from a seed, but not that the seed was admitted by topology authority.
- Existing authority topology compaction had no admission ledger, no latest-admitted checkpoint check, and no required quorum certificate over the checkpoint hash.
- Existing checkpoint admissions did not cover authority topology because topology checkpoints define future membership/quorum authority, not data or witness-ledger currentness.
- Still missing after v156: signer/key validation for authority-topology checkpoint admission certificates, runtime authority-store adoption, live Postgres compaction/admission tests, and admission compaction.

## Primitive Proposal

Name: operational state authority-topology compaction checkpoint admission record.

Problem it solves: prevents self-authored authority-topology compaction checkpoints from becoming replay seeds for recovered membership/quorum authority.

Research source: Raft membership snapshots and joint consensus, Vertical Paxos configuration authority, Viewstamped Replication reconfiguration, and Dynamic Byzantine Quorum Systems.

Mechanism borrowed: compacted recovery can start from a configuration checkpoint only when protocol authority certifies the exact checkpoint digest/frontier and replay continues from that admitted frontier.

Why current substrate lacked it: v146 proved retained authority suffix continuity but did not prove that the compacted topology seed was allowed to replace the pruned authority-transition prefix.

Why existing primitives are insufficient: proof-record admissions admit certificate objects; tombstone and witness checkpoint admissions admit data/currentness replay seeds; none admits the topology checkpoint that decides which future witnesses and certificates count.

State guarantee it should create: strict authority-topology compaction can recover topology currentness only when the checkpoint is the latest admitted checkpoint for its admission store and retained authority transitions reconstruct the exact required topology.

Admission rule it requires: admission records bind tenant, checkpoint-admission store, topology id, authority scope, admission sequence, previous admission hash, checkpoint id/hash, embedded checkpoint, certified quorum certificate, admitted-at/by metadata, and admission record hash.

Replay rule it requires: replay rejects tenant/topology/store/scope mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered admission records, tampered embedded checkpoints/topologies, non-certified certificates, insufficient witness quorum, certificate/checkpoint subject mismatch, wrong authority boundary, and stale checkpoints after a later admission.

Authority boundary it requires: v156 requires a certified quorum certificate over the topology checkpoint hash under an expected authority boundary, but signer/key accountability for these certificate-bearing admission rows remains SQ113.

Failure modes it should prevent: private topology snapshots, adapter witness-list smuggling, stale topology seeds, wrong-topology checkpoint reuse, same-sequence admission forks, wrong-boundary certificates, insufficient witness certificates, and local topology state outranking admitted history.

Minimal implementation slice: add checkpoint-admission record/replay types, deterministic admission hashing, strict `requireCheckpointAdmission` support in authority-topology compaction evaluation, migration `0073`, and focused falsification tests.

Tests that would falsify it: a valid latest quorum-admitted topology checkpoint fails; strict compaction accepts a checkpoint without admission replay; strict compaction accepts a stale checkpoint after a later admission; wrong authority-boundary certificate passes; tampered checkpoint/admission record passes.

Axis surfaces that could later validate it: Axis C live Postgres authority-store compaction/recovery, Axis A finance recovery after authority-store pruning, and Axis B/domain adapters attempting to resume from locally summarized witness topology.

## Falsification Criteria

- An authority-topology checkpoint with a valid latest quorum-certified admission record plus retained suffix must pass strict compaction.
- An authority-topology checkpoint without admission replay must fail under `requireCheckpointAdmission`.
- An authority-topology checkpoint that is not the latest admitted checkpoint must fail under strict compaction.
- An admission certificate for the wrong authority boundary must fail replay.
- A tampered admission record or embedded checkpoint hash must fail replay.
- The SQL surface must persist append-only admission records separate from raw topology checkpoint rows and revoke public DML on both surfaces.

## Active 10-Question Backlog

1. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
2. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
3. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
4. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
5. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
6. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
7. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
8. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
9. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
10. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: a hash-valid authority-topology compaction checkpoint is an admissible replay seed.
- Falsified: retained authority suffix continuity alone proves the compacted authority-transition prefix was legitimately replaced.
- Still open: v156 supplies replay-current checkpoint admission with certified quorum certificates, but generic signer/key validation for this certificate boundary, runtime adoption, live database tests, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionRecord`, replay, and issue types.
- `buildOperationalStateAuthorityTopologyCompactionCheckpointAdmissionRecord()`, `computeOperationalStateAuthorityTopologyCompactionCheckpointAdmissionRecordHash()`, and `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionRecords()`.
- `evaluateOperationalStateAuthorityTopologyCompaction({ requireCheckpointAdmission: true })` so compacted topology replay seeds fail unless latest admitted.
- Migration `0073_agent_state_authority_topology_compaction_checkpoint_admissions.sql` with append-only admission records and public DML revocation.
- Tests for valid quorum-admitted topology checkpoint replay, missing admission replay refusal, stale checkpoint refusal, wrong-boundary certificate refusal, and tampered admission refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (138 passed)

Full workspace verification after ledger publication:

- `pnpm typecheck`
- `pnpm test` (542 passed, 143 skipped)
- `git diff --check`

Outcome: SQ103 is closed. SQ104 is now the active next substrate question, with SQ113 added as new authority-topology checkpoint-admission authority pressure.

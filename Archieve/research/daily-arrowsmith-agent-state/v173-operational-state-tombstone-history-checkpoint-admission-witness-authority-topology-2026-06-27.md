# v173 - Operational State Tombstone-History Checkpoint Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ120

## Research Question

What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Alvisi, Pierce, Malkhi, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Gilbert, Lynch, and Shvartsman, "A Framework for Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf

## Mechanism Extracted

Checkpoint and recovery systems do not treat a checkpoint digest as authoritative merely because it is compact or locally useful. PBFT stabilizes checkpoints through enough agreement over the digest, Raft stores configuration changes in replicated log entries and requires overlapping majorities during membership changes, Viewstamped Replication makes recovery depend on a quorum that knows sufficiently recent state, and dynamic Byzantine storage treats the current view/quorum as part of operation validity.

The substrate adaptation is a tombstone-history checkpoint admission witness authority topology. v153 made tombstone-history compaction checkpoints admitted replay seeds; v163 made those admission rows accountable through a witness ledger over the exact checkpoint-admission record hash. SQ120 closes the signer/topology gap in that witness layer: strict tombstone-history compaction can now require checkpoint-admission witness certificates to bind to a replayed witness authority topology hash, and replay counts only unique active topology principals toward quorum.

## Existing Substrate Map

- v143 added tombstone-history compaction so retained suffix replay must reconstruct the exact required tombstone-history head from a checkpoint.
- v153 added tombstone-history compaction checkpoint admission records so checkpoint replay seeds must replay as latest admitted checkpoint artifacts.
- v163 added tombstone-history checkpoint admission witness records so checkpoint-admission rows require a separate hash-linked witness ledger over the exact admission record hash.
- v146 added generic authority-transition/topology primitives that project active/suspended/revoked/equivocated principals, quorum thresholds, topology hashes, and authority record hashes from replayed authority history.
- v169-v172 established adjacent topology-bound replay patterns for recovery-cut admission witnesses, history-root settlement certificates, pruning-policy admission witnesses, and storage mutation guard admission witnesses.
- Before v173, `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecords()` checked certificate hash, certified status, subject, boundary, and certificate-declared quorum counts.

## Missing Substrate Map

- Before v173, a tombstone-history checkpoint admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible checkpoint-admission principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed checkpoint-admission witness topology.
- Duplicate witness ids could satisfy certificate length checks.
- Suspended, revoked, equivocated, or unknown checkpoint-admission witnesses could count as if they were active.
- Existing checkpoint admission and witness rows made compaction accountable to records and certificates, not to replayed signer authority.
- Still missing after v173: admission/witness/finality for the checkpoint-admission witness authority-transition ledger itself, checkpoint-admission witness signature/key-status verification, runtime store adoption for topology replay, authority compaction, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state tombstone-history checkpoint admission witness authority topology.

Problem it solves: prevents self-authored tombstone-history checkpoint admission witness records from authorizing compacted recovery by carrying certificates with arbitrary checkpoint-admission witness ids.

Research source: PBFT checkpoint stability, Raft joint consensus, Viewstamped Replication recovery/reconfiguration, Dynamic Byzantine Quorum Systems, and Dynamic Byzantine Storage.

Mechanism borrowed: a checkpoint or recovery view is authoritative only when certified by the current eligible quorum for that view/configuration; membership and quorum assumptions are part of the proof and must be replayed.

Why current substrate lacked it: v163 required witness records over checkpoint-admission rows, but did not bind witness signer ids to replayed checkpoint-admission witness authority.

Why existing primitives are insufficient: checkpoint admission rows make replay seeds durable, and witness rows make admission records accountable, but the witness certificate signer set was still certificate-local. Generic authority topology existed, but tombstone-history checkpoint admission witness replay did not consume it.

State guarantee it should create: strict tombstone-history compaction can accept a witnessed checkpoint-admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy the topology quorum.

Admission rule it requires: checkpoint-admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate checkpoint-admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a compacted tombstone-history checkpoint can seed replay.

Authority boundary it requires: the witness certificate remains over `operational_state_tombstone_history_compaction_checkpoint_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed checkpoint-admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: certificate-local witness lists, stale checkpoint witness authority, suspended or revoked checkpoint witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and compacted tombstone-history recovery authorized by checkpoint-admission identities not present in replayed authority history.

Minimal implementation slice: extend tombstone-history checkpoint admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict tombstone-history compaction evaluation flags, add durable SQL authority-transition storage for this checkpoint witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness checkpoint admission fails; strict compaction passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C direct compacted recovery after amnesiac resume, Axis A finance replay-pruning checkpoints that try to seed tombstone recovery through stale checkpoint-admission witnesses, and Axis B/domain adapters attempting to use connector-owned checkpoint witness identities.

## Falsification Criteria

- A latest tombstone-history checkpoint admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict compaction evaluation.
- Strict compaction must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
8. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified tombstone-history checkpoint admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a checkpoint-admission witness certificate can be treated as authority without replaying checkpoint witness topology.
- Falsified: checkpoint-admission rows plus witness certificates are sufficient without lane-specific replay of checkpoint-admission witness authority.
- Still open: checkpoint-admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added tombstone-history checkpoint admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateTombstoneHistoryCompaction()` with checkpoint-admission witness authority topology strictness.
- Added migration `0090_agent_state_tombstone_history_checkpoint_admission_witness_authority_transitions.sql` with append-only tombstone-history checkpoint admission witness authority-transition rows.
- Added tests for valid topology-bound checkpoint-admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (176 passed)

Outcome: SQ120 is closed. SQ121 is now the active next substrate question, with SQ130 added as new tombstone-history checkpoint admission witness authority-transition accountability pressure.

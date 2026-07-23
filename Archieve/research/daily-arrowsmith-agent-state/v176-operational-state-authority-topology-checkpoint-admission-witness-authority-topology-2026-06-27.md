# v176 - Operational State Authority-Topology Checkpoint Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ123

## Research Question

What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", 2009: https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Martin and Alvisi, "A Framework for Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf

## Mechanism Extracted

Membership and quorum authority are state in their own right. Raft joint consensus avoids unsafe membership changes by requiring overlapping majorities from old and new configurations. Viewstamped Replication treats reconfiguration as an epoch transition and rejects messages outside the current epoch. Vertical Paxos makes a configuration master part of the agreement structure, so reconfiguration is not a local replica assertion. Dynamic Byzantine quorum work makes thresholds and quorum structures explicit objects that must be safely updated because stale configurations can otherwise produce conflicting state.

The substrate adaptation is authority-topology checkpoint admission witness authority topology. v166 made compacted authority-topology checkpoint admission rows accountable through a separate witness record over the exact admission record hash. SQ123 closes the signer/topology gap in that witness layer: strict compacted topology recovery can now require checkpoint-admission witness certificates to bind to a replayed witness authority topology hash and count only unique active topology principals toward quorum.

## Existing Substrate Map

- v146 added generic authority-transition replay that projects active/suspended/revoked/equivocated principals, topology hashes, quorum thresholds, authority sequence, and authority record hashes.
- v156 added authority-topology compaction checkpoint admissions so compacted topology checkpoints replay only when admitted by latest quorum-certified admission history.
- v166 added authority-topology checkpoint admission witness records over the exact topology checkpoint-admission record hash.
- v169-v175 established topology-bound replay for adjacent witness or settlement certificates: recovery-cut, history-root, pruning-policy, storage guard, tombstone-history checkpoint, witness-ledger checkpoint, and proof-record admission witness lanes.
- Before v176, `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecords()` checked witness-record hashes, certificate hashes, certified status, subject, boundary, and certificate-declared witness counts.

## Missing Substrate Map

- Before v176, an authority-topology checkpoint admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible checkpoint-admission witness principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed checkpoint-admission witness topology.
- Duplicate witness ids could satisfy certificate-local count checks.
- Suspended, revoked, equivocated, or unknown checkpoint-admission witnesses could count as if they were active.
- Authority-topology checkpoint admission and witness rows made compacted topology recovery accountable to records and certificates, not to replayed signer authority.
- Still missing after v176: admission/witness/finality for the authority-topology checkpoint admission witness authority-transition ledger itself, witness signature/key-status verification, runtime authority-store adoption for topology replay, authority compaction of this witness-authority lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state authority-topology checkpoint admission witness authority topology.

Problem it solves: prevents self-authored authority-topology checkpoint admission witness records from authorizing compacted topology recovery by carrying certificates with arbitrary checkpoint-admission witness ids.

Research source: Raft joint consensus, Viewstamped Replication epochs, Vertical Paxos configuration masters, Dynamic Byzantine Quorum Systems, Dynamic Byzantine Storage, and CoSi witness cosigning.

Mechanism borrowed: membership/quorum changes are operational state and must be replayed under a configuration authority; a certificate cannot define its own signer set unless that signer set is derived from the admitted authority topology.

Why current substrate lacked it: v166 required witness records over authority-topology checkpoint admission rows, but did not bind witness signer ids to replayed checkpoint-admission witness authority.

Why existing primitives are insufficient: checkpoint admission records make compacted topology checkpoints replay-current, and witness records make admission records accountable, but the witness certificate signer set was still certificate-local. Generic authority topology existed, but authority-topology checkpoint admission witness replay did not consume it.

State guarantee it should create: strict authority-topology compaction can accept a witnessed checkpoint-admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy topology quorum.

Admission rule it requires: authority-topology checkpoint admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate checkpoint-admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a compacted authority topology can be recovered.

Authority boundary it requires: the witness certificate remains over `operational_state_authority_topology_compaction_checkpoint_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed checkpoint-admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: certificate-local witness lists, stale checkpoint-admission witness authority, suspended or revoked checkpoint-admission witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and compacted topology recovery authorized by checkpoint-admission identities not present in replayed authority history.

Minimal implementation slice: extend authority-topology checkpoint admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict compaction flags, add durable SQL authority-transition storage for this witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness authority-topology checkpoint admission fails; strict compaction passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C direct local authority-topology compaction after amnesiac resume, Axis A finance recovery paths consuming compacted authority topology through stale checkpoint-admission witnesses, and Axis B/domain adapters attempting to resume from connector-owned topology snapshots.

## Falsification Criteria

- A latest authority-topology checkpoint admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict compaction replay.
- Strict compaction must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
5. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified authority-topology checkpoint admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a topology checkpoint-admission witness certificate can be treated as authority without replaying checkpoint-admission witness topology.
- Falsified: topology checkpoint admission rows plus witness certificates are sufficient without lane-specific replay of checkpoint-admission witness authority.
- Still open: authority-topology checkpoint admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added authority-topology checkpoint admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateAuthorityTopologyCompaction()` with checkpoint-admission witness authority topology strictness.
- Added migration `0093_agent_state_authority_topology_checkpoint_admission_witness_authority_transitions.sql` with append-only authority-topology checkpoint admission witness authority-transition rows.
- Added tests for valid topology-bound authority-topology checkpoint admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (182 passed)
- `pnpm typecheck`
- `git diff --check`
- `pnpm test` (586 passed, 143 skipped)

Outcome: SQ123 is closed. SQ124 is now the active next substrate question, with SQ133 added as new authority-topology checkpoint admission witness authority-transition accountability pressure.

# v174 - Operational State Witness-Ledger Checkpoint Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ121

## Research Question

What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Martin and Alvisi, "A Framework for Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf
- Garcia-Perez and Gotsman, "Federated Byzantine Quorum Systems", OPODIS 2018: https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.OPODIS.2018.17

## Mechanism Extracted

Witness cosigning, reconfiguration, and dynamic quorum systems treat authority as a replayable membership-and-threshold relation, not a local count of names inside a certificate. CoSi makes an authority statement stronger only when the witness set and missing-witness metadata are verifiable. Raft and Viewstamped Replication make membership changes part of the replicated/reconfigured state rather than operator memory. Dynamic Byzantine quorum systems and dynamic Byzantine storage show that a quorum is only meaningful relative to the current active view and threshold, because stale views can admit conflicting or stale state.

The substrate adaptation is witness-ledger checkpoint admission witness authority topology. v164 made witness-ledger checkpoint admission rows accountable to a separate witness record over the exact admission record hash. SQ121 closes the signer/topology gap in that witness layer: strict witness-ledger compaction can now require checkpoint-admission witness certificates to bind to a replayed witness authority topology hash and count only unique active topology principals toward quorum.

## Existing Substrate Map

- v144 added witness-ledger compaction checkpoints so compacted accepted-head currentness can replay from a checkpoint plus retained suffix.
- v154 added witness-ledger compaction checkpoint admission records, making checkpoint seeds replay-current before they can authorize compacted witness-ledger recovery.
- v164 added witness-ledger checkpoint admission witness records over the exact checkpoint-admission record hash.
- v146 added generic authority-transition/topology replay that projects active/suspended/revoked/equivocated principals, topology hashes, quorum thresholds, and authority record hashes.
- v169-v173 established adjacent topology-bound replay for recovery-cut admission witnesses, history-root settlement certificates, pruning-policy admission witnesses, guard-admission witnesses, and tombstone-history checkpoint-admission witnesses.
- Before v174, `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecords()` checked witness-record hash, certificate hash, certified status, subject, boundary, and certificate-declared witness counts.

## Missing Substrate Map

- Before v174, a witness-ledger checkpoint admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible checkpoint-admission witness principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed witness-ledger checkpoint-admission witness topology.
- Duplicate witness ids could satisfy certificate length checks.
- Suspended, revoked, equivocated, or unknown checkpoint-admission witnesses could count as if they were active.
- Existing checkpoint admission and witness rows made witness-ledger compaction accountable to records and certificates, not to replayed signer authority.
- Still missing after v174: admission/witness/finality for the witness-ledger checkpoint-admission witness authority-transition ledger itself, witness signature/key-status verification, runtime store adoption for topology replay, authority compaction, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state witness-ledger checkpoint admission witness authority topology.

Problem it solves: prevents self-authored witness-ledger checkpoint admission witness records from authorizing compacted witness-ledger recovery by carrying certificates with arbitrary checkpoint-admission witness ids.

Research source: CoSi witness cosigning, Raft joint consensus, Viewstamped Replication reconfiguration/recovery, Dynamic Byzantine Quorum Systems, Dynamic Byzantine Storage, and Federated Byzantine Quorum Systems.

Mechanism borrowed: a witness certificate is authoritative only when its signer set is drawn from the current replayed authority topology and its quorum threshold is checked against that topology, not against certificate-local names.

Why current substrate lacked it: v164 required witness records over witness-ledger checkpoint admission rows, but did not bind witness signer ids to replayed checkpoint-admission witness authority.

Why existing primitives are insufficient: checkpoint admission records make replay seeds durable, and witness records make admission records accountable, but the witness certificate signer set was still certificate-local. Generic authority topology existed, but witness-ledger checkpoint admission witness replay did not consume it.

State guarantee it should create: strict witness-ledger compaction can accept a witnessed checkpoint-admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy topology quorum.

Admission rule it requires: checkpoint-admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate checkpoint-admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a compacted witness-ledger checkpoint can seed replay.

Authority boundary it requires: the witness certificate remains over `operational_state_witness_ledger_compaction_checkpoint_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed checkpoint-admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: certificate-local witness lists, stale checkpoint witness authority, suspended or revoked checkpoint witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and compacted witness-ledger recovery authorized by checkpoint-admission identities not present in replayed authority history.

Minimal implementation slice: extend witness-ledger checkpoint admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict witness-ledger compaction evaluation flags, add durable SQL authority-transition storage for this checkpoint witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness checkpoint admission fails; strict compaction passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C direct compacted witness-ledger recovery after amnesiac resume, Axis A finance replay-pruning checkpoints that try to seed witness currentness through stale checkpoint-admission witnesses, and Axis B/domain adapters attempting to use connector-owned checkpoint witness identities.

## Falsification Criteria

- A latest witness-ledger checkpoint admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict compaction evaluation.
- Strict compaction must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
7. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified witness-ledger checkpoint admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a checkpoint-admission witness certificate can be treated as authority without replaying checkpoint witness topology.
- Falsified: checkpoint-admission rows plus witness certificates are sufficient without lane-specific replay of checkpoint-admission witness authority.
- Still open: checkpoint-admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added witness-ledger checkpoint admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateWitnessLedgerCompaction()` with checkpoint-admission witness authority topology strictness.
- Added migration `0091_agent_state_witness_ledger_checkpoint_admission_witness_authority_transitions.sql` with append-only witness-ledger checkpoint admission witness authority-transition rows.
- Added tests for valid topology-bound checkpoint-admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (178 passed)
- `pnpm typecheck`
- `git diff --check`
- `pnpm test` (582 passed, 143 skipped)

Outcome: SQ121 is closed. SQ122 is now the active next substrate question, with SQ131 added as new witness-ledger checkpoint admission witness authority-transition accountability pressure.

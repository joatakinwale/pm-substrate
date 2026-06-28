# v169 - Operational State Recovery-Cut Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ116

## Research Question

What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", 2009: https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems", Distributed Computing 1998: https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://dedis.cs.yale.edu/dissent/papers/witness-abs/

## Mechanism Extracted

Dynamic Byzantine quorum systems show that quorum authority is not just a count; it is a named, evolving membership and threshold relation that must preserve quorum intersection under failures. Vertical Paxos separates reconfiguration authority from ordinary acceptor state: clients must know which configuration is authoritative for the value being accepted. Viewstamped Replication makes configuration changes part of the replicated history rather than private process memory. Byzantine quorum-system work makes the fail-prone and quorum assumptions explicit, while PeerReview and CoSi add accountable witness logs and public cosigning for authoritative statements.

The substrate adaptation is a recovery-cut admission witness authority topology. v159 made recovery-cut admission rows accountable to witness records, but those witness records could still carry a certificate whose `acceptedWitnessIds` were self-declared. SQ116 closes that gap by requiring the certificate to bind to a replayed authority topology hash and by counting only unique active principals from that topology toward the witness quorum.

## Existing Substrate Map

- v139 added `OperationalStateRecoveryCut`, the amnesiac resume lane inventory that refuses private/cached required lanes.
- v149 added `OperationalStateRecoveryCutAdmissionRecord`, so recovered state must be admitted through durable hash-linked recovery-cut admission history.
- v159 added `OperationalStateRecoveryCutAdmissionWitnessRecord`, so strict recovered state can require the latest recovery-cut admission row to be witnessed by a separate quorum certificate over the exact admission record hash.
- v146 added generic authority-transition/topology primitives that can project principal status, quorum thresholds, and topology hashes from replayed authority history.
- Before v169, `replayOperationalStateRecoveryCutAdmissionWitnessRecords()` checked certificate hash, subject, boundary, certified status, and certificate-declared quorum counts.

## Missing Substrate Map

- Before v169, a recovery-cut admission witness record could name any `acceptedWitnessIds`; replay did not prove those witnesses were eligible principals under any recovery-cut witness authority.
- The certificate's `authorityTopologyHash` was inert for this lane: it could be present but did not have to match a replayed topology.
- Duplicate witness ids could satisfy the certificate's own length checks if the certificate declared enough accepted ids.
- Suspended, revoked, equivocated, or unknown witnesses were indistinguishable from active witnesses for recovery-cut admission witness replay.
- The generic authority topology existed, but the recovery-cut witness admission path did not consume it as an admission boundary.
- Still missing after v169: an admission/witness rule for the recovery-cut admission witness authority-transition ledger itself, witness signature/key-status verification for these witness certificates, runtime store adoption, authority compaction, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state recovery-cut admission witness authority topology.

Problem it solves: prevents self-authored recovery-cut admission witness records from authorizing recovered operational state by merely carrying certificate-bearing rows with arbitrary witness ids.

Research source: dynamic Byzantine quorum systems, Vertical Paxos reconfiguration authority, Viewstamped Replication configuration history, Byzantine quorum systems, PeerReview accountable logs, and CoSi witness cosigning.

Mechanism borrowed: membership and threshold authority must be replayed from a configuration/topology history, and certification counts only eligible participants under the exact configuration bound to the certified value.

Why current substrate lacked it: v159 required a witness certificate over the recovery-cut admission row, but did not require the certificate's accepted witness ids to be validated against replayed witness-authority history.

Why existing primitives are insufficient: generic authority topology can represent eligible principals and thresholds, but no recovery-cut witness replay rule consumed it; therefore adapters could still supply a certificate whose signer set was self-authored.

State guarantee it should create: strict recovered operational state can accept a witness-certified recovery-cut admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy the topology quorum.

Admission rule it requires: recovery-cut admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology is an invalid replay input, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before the latest admission witness can authorize recovery.

Authority boundary it requires: the witness certificate remains over `operational_state_recovery_cut_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed recovery-cut admission witness authority topology hash; only active principals in that topology count toward quorum.

Failure modes it should prevent: private witness lists, stale witness authority, suspended or revoked witness participation, duplicate signer amplification, certificate/topology substitution, connector-cache signer sets, and recovered current state authorized by witness identities that are not replayed operational authority.

Minimal implementation slice: extend recovery-cut admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict evaluation/action-review flags, add durable SQL authority-transition storage for this witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness certificate fails; strict evaluation passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; a certificate with a wrong topology hash passes; duplicate witness ids satisfy a two-witness topology quorum.

Axis surfaces that could later validate it: Axis C amnesiac recovery after witness-authority change, Axis A finance recovery cuts whose witness authority is suspended or rotated, and Axis B/domain adapters attempting to supply connector-owned witness identities without admitted topology.

## Falsification Criteria

- A latest recovery-cut admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict recovery-cut admission evaluation.
- Strict recovery-cut admission evaluation must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.
- Duplicate accepted witness ids must not satisfy topology quorum.

## Active 10-Question Backlog

1. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
2. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified recovery-cut admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a certificate can be treated as authority without replaying the signer topology.
- Falsified: a generic authority topology primitive is sufficient without a lane-specific replay rule that consumes it at the admission boundary.
- Still open: recovery-cut admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateRecoveryCutAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateRecoveryCutAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added recovery-cut admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateRecoveryCutAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateRecoveryCutAdmission()` and `reviewProposedActionAgainstCurrentState()` with authority-topology strictness flags.
- Added migration `0086_agent_state_recovery_cut_admission_witness_authority_transitions.sql` with append-only recovery-cut admission witness authority-transition rows.
- Added tests for valid topology-bound recovery-cut admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (168 passed)

Outcome: SQ116 is closed. SQ117 is now the active next substrate question, with SQ126 added as new recovery-cut admission witness authority-transition accountability pressure.

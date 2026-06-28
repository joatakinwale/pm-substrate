# v175 - Operational State Proof-Record Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ122

## Research Question

What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Schneider, Walsh, and Sirer, "Nexus Authorization Logic (NAL): Design Rationale and Applications", 2011: https://www.cs.cornell.edu/fbs/publications/NexusNalRationale.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Boneh, Partap, and Rotem, "Proactive Refresh for Accountable Threshold Signatures", FC 2024: https://fc24.ifca.ai/preproceedings/183.pdf
- Komlo and Boneh, "Threshold Signatures with Private Accountability", CRYPTO 2022: https://eprint.iacr.org/2022/1636
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf

## Mechanism Extracted

Proof-carrying authentication makes authorization replay explicit: the requester carries a proof and the guard checks that proof rather than trusting a private claim. NAL generalizes this to credentials and policies over principals, so authority depends on attribution and guard-checkable derivation. PeerReview adds that accountability needs strong identities, tamper-evident logs, and replay against expected behavior. Accountable threshold-signature work makes the signer set itself part of the accountability surface: a signature cannot be made accountable merely by letting signers assert a different signer set. CoSi adds scalable witness cosigning around authority statements.

The substrate adaptation is proof-record admission witness authority topology. v165 made proof-record admission rows accountable to a separate witness record over the exact admission record hash. SQ122 closes the signer/topology gap in that witness layer: strict quorum-certificate proof replay can now require proof-record admission witness certificates to bind to a replayed witness authority topology hash and count only unique active topology principals toward quorum.

## Existing Substrate Map

- v145 added generic quorum-certificate proof records that recover certified currentness from hash-linked proof records, embedded certificates, accepted witness evidence, and optional seal linkage.
- v155 added proof-record admission records so strict proof replay consumes only latest admitted proof-record rows.
- v165 added proof-record admission witness records over the exact proof-record admission record hash.
- v146 added generic authority-transition/topology replay that projects active/suspended/revoked/equivocated principals, topology hashes, quorum thresholds, and authority record hashes.
- v169-v174 established adjacent topology-bound replay for recovery-cut, history-root, pruning-policy, guard-admission, tombstone-history checkpoint-admission, and witness-ledger checkpoint-admission witness certificates.
- Before v175, `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecords()` checked witness-record hash, certificate hash, certified status, subject, boundary, and certificate-declared witness counts.

## Missing Substrate Map

- Before v175, a proof-record admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible proof-admission witness principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed proof-record admission witness topology.
- Duplicate witness ids could satisfy certificate length checks.
- Suspended, revoked, equivocated, or unknown proof-admission witnesses could count as if they were active.
- Existing proof-record admission and witness rows made recovered certified currentness accountable to records and certificates, not to replayed signer authority.
- Still missing after v175: admission/witness/finality for the proof-record admission witness authority-transition ledger itself, witness signature/key-status verification, runtime proof-store adoption for topology replay, authority compaction, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state proof-record admission witness authority topology.

Problem it solves: prevents self-authored proof-record admission witness records from authorizing recovered certified currentness by carrying certificates with arbitrary proof-admission witness ids.

Research source: Proof-Carrying Authentication, NAL, PeerReview, accountable threshold signatures, private-accountable threshold signatures, and CoSi witness cosigning.

Mechanism borrowed: a proof or signature is operationally acceptable only when its derivation and signer attribution are checkable against an authority model, not when a certificate locally declares who participated.

Why current substrate lacked it: v165 required witness records over proof-record admission rows, but did not bind witness signer ids to replayed proof-admission witness authority.

Why existing primitives are insufficient: proof-record admission records make proof records replay-current, and witness records make admission records accountable, but the witness certificate signer set was still certificate-local. Generic authority topology existed, but proof-record admission witness replay did not consume it.

State guarantee it should create: strict quorum-certificate proof replay can accept a witnessed proof-record admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy topology quorum.

Admission rule it requires: proof-record admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate proof-admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a proof record can establish recovered certified currentness.

Authority boundary it requires: the witness certificate remains over `operational_state_quorum_certificate_proof_record_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed proof-admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: certificate-local witness lists, stale proof-admission witness authority, suspended or revoked proof-admission witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and recovered certified currentness authorized by proof-admission identities not present in replayed authority history.

Minimal implementation slice: extend proof-record admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict proof replay flags, add durable SQL authority-transition storage for this proof witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness proof-record admission fails; strict proof replay passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C direct local agent-state proof replay after amnesiac resume, Axis A finance recovery paths consuming generic proof records through stale proof-admission witnesses, and Axis B/domain adapters attempting to resume from connector-owned certificate summaries.

## Falsification Criteria

- A latest proof-record admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict proof replay.
- Strict proof replay must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
6. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified proof-record admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a proof-admission witness certificate can be treated as authority without replaying proof-admission witness topology.
- Falsified: proof-record admission rows plus witness certificates are sufficient without lane-specific replay of proof-admission witness authority.
- Still open: proof-record admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateQuorumCertificateProofRecordAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateQuorumCertificateProofRecordAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added proof-record admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `replayOperationalStateQuorumCertificateProofRecords()` with proof-record admission witness authority topology strictness.
- Added migration `0092_agent_state_quorum_certificate_proof_record_admission_witness_authority_transitions.sql` with append-only proof-record admission witness authority-transition rows.
- Added tests for valid topology-bound proof-record admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (180 passed)
- `pnpm typecheck`
- `git diff --check`
- `pnpm test` (584 passed, 143 skipped)

Outcome: SQ122 is closed. SQ123 is now the active next substrate question, with SQ132 added as new proof-record admission witness authority-transition accountability pressure.

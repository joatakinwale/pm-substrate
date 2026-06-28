# v205 Operational State Proof-Record Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ152
Research lane: substrate discovery, quorum-certificate proof-record authority, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v145 adds generic quorum-certificate proof records so certified currentness can be recovered from proof history.
- v155 adds quorum-certificate proof-record admission records so proof records cannot self-admit.
- v165 adds proof-record admission witness records so proof-record admission rows are witnessed by a separate ledger.
- v175 adds proof-record admission witness authority topology so proof-record admission witness certificates bind to replayed principals and thresholds.
- v185 adds proof-record admission witness authority-transition admission records so proof-record admission witness topology can replay from admitted authority-transition history.
- v195 adds proof-record admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0112` persists proof-record admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict quorum-certificate proof replay could require proof-record admission witness authority-transition admission rows to be witnessed, but the certificates inside that nested transition-admission witness ledger still carried their own accepted witness set. That meant recovered certified currentness could still depend on certificate-local signer representation at the nested proof-record transition-admission witness layer.

The missing substrate primitive is proof-record transition-admission witness authority topology: certificates for proof-record admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become operational failures when proof-record recovery accepts a certificate-local witness set as authority for nested proof history.

B bridge: proof-carrying authentication puts the burden of proof on the requester and lets the receiver check proof against authorization logic; accountable distributed systems require replayable logs tied to actors; witness cosigning prevents an authority statement from being accepted until a witness set has had the opportunity to validate and log it; Byzantine quorum systems make membership and quorum intersection part of the consistency guarantee.

C literature:

- Appel and Felten, "Proof-Carrying Authentication" (ACM CCS 1999), https://www.cs.princeton.edu/~appel/papers/says.pdf
- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning" (IEEE S&P 2016), https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems" (Distributed Computing), https://link.springer.com/article/10.1007/s004460050050

Mechanism extracted: a proof certificate is operational only when the certified subject, signer set, signer eligibility, and quorum thresholds all replay from authority-scoped state. A local `acceptedWitnessIds` list is evidence to verify, not authority to remember.

## Primitive Proposal

Name: proof-record transition-admission witness authority topology.

Problem it solves: proof-record admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: Proof-Carrying Authentication, PeerReview accountability, CoSi witness cosigning, and Byzantine quorum systems.

Mechanism borrowed or adapted: accept a nested witness certificate only when the certificate is bound to a replayed authority topology and enough unique active topology principals signed the exact transition-admission subject.

Why current substrate lacks it: v195 replayed a witness ledger over exact transition-admission record hashes, but did not bind that witness ledger's certificates to replayed signer topology.

Why existing primitives are insufficient: proof-record admission, proof-record admission witnesses, proof-record witness-authority topology, admitted witness-authority transitions, and witnessed transition-admission rows each narrow authority, but none made the nested transition-admission witness certificates' signer set replayable.

State guarantee it should create: strict quorum-certificate proof replay cannot consume proof-record admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; proof-record admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; quorum-certificate proof replay can require `requireProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: proof-record transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: nested witness certificates must use `operational_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate proof-record transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes recovered certified currentness.
- Duplicate witness ids satisfy proof-record transition-admission witness quorum.
- Unknown or suspended witness ids satisfy proof-record transition-admission witness quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Strict quorum-certificate proof replay accepts a forged valid-looking replay whose nested transition-admission witness certificates lack topology-bound authority.

Minimal implementation slice:

- Extend proof-record transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend proof-record witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend proof-record admission witness replay and quorum-certificate proof replay with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0122_agent_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `replayOperationalStateQuorumCertificateProofRecords({ requireProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with proof-record admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateQuorumCertificateProofReplayInput.requireProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested proof-record transition-admission witness topology issue codes and quorum checks.
- Migration `0122_agent_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound proof-record transition-admission witness certificates before finance recovery accepts durable certified currentness.
- Axis B can require the same nested topology proof before domain adapters resume from certified proof records.
- Axis C can simulate an amnesiac local agent attempting to resume from cached proof-record transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked proof-record transition-admission witness ledger is enough accountability for recovered certified currentness. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: proof-record nested witness certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "proof-record admission witness authority-transition admission witness certificates"`: 1 passed, 222 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "proof-record admission witness authority-transition admission"`: 3 passed, 220 skipped
- `pnpm typecheck`
- `pnpm test`: 627 passed, 143 skipped
- `git diff --check`

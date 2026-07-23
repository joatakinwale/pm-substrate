# v195 Operational State Proof-Record Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ142
Research lane: substrate discovery, recovered certified currentness, proof-record authority accountability

## Question

What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v145 adds quorum-certificate proof records so certified currentness can replay from durable proof history instead of transient recertification.
- v155 adds proof-record admission records so strict proof replay requires the proof record to be the latest admitted proof row.
- v165 adds proof-record admission witness records so the latest proof-record admission row must be separately quorum-certified by a witness ledger.
- v175 adds proof-record admission witness authority topology so admission witness certificates bind to replayed active principals and quorum thresholds.
- v185 adds proof-record admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- Migration `0102` persists admitted proof-record admission witness authority-transition rows.

## Missing Substrate Map

The proof-record lane can recover certified currentness from admitted proof records and witnessed proof-record admission rows, but v185 left the proof-record admission witness authority-transition admission row as its own accountability boundary. A strict proof replay could require witness authority topology to come from admitted transition history while still accepting transition-admission rows supplied as local certificate-bearing records.

That is insufficient for amnesiac recovery. Proof-record admission witnesses decide whether a proof record can constitute recovered certified currentness; therefore the authority that admits those witnesses must itself be replay-accountable. The missing substrate primitive is a separate append-only witness ledger over the exact proof-record admission witness authority-transition admission record hash.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become operational failures when private proof records, cached certificates, or local authority rows can be accepted after resume without public replay accountability.

B bridge: key-transparency systems, append-only authenticated dictionaries, and accountable secure logs make a certificate operational only when the exact certified subject is independently logged and replay-checkable.

C literature:

- Melara et al., "CONIKS: Bringing Key Transparency to End Users" (USENIX Security 2015), https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Tomescu and Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries" (CCS 2019), https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning" (IEEE S&P 2016), https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf

Mechanism extracted: a certificate-local authority row is not enough when it can authorize recovered currentness. The row must become the exact subject of a separate append-only witnessed log so replay can detect absence, wrong subject hashes, forks, and invalid witness certificates.

## Primitive Proposal

Name: operational state proof-record admission witness authority-transition admission witness records.

Problem it solves: proof-record admission witness authority-transition admission rows could be accepted from local state if their embedded certificates were structurally valid.

Research source: CONIKS key transparency, append-only authenticated transparency logs, PeerReview accountable logs, and CoSi witness cosigning.

Mechanism borrowed or adapted: independent witness accountability over exact logged subjects. The substrate adaptation is a hash-linked witness ledger over proof-record admission witness authority-transition admission record hashes.

Why current substrate lacks it: v185 admitted proof-record admission witness authority topology transitions but did not require a separate replayed witness ledger over each transition-admission row.

Why existing primitives are insufficient: proof records, proof-record admission, proof-record admission witnesses, witness topology, and transition-admission replay prove progressively stronger currentness authority, but none separately witness the exact transition-admission row hash.

State guarantee it should create: strict quorum-certificate proof replay cannot treat a proof-record admission witness authority-transition admission row as recovered certified-currentness authority unless the latest required transition-admission record hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission record to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- A local row presents certificate-shaped proof-record admission witness authority transitions as current recovered certified-currentness authority.
- A connector cache supplies a transition-admission row without a separate witnessed record hash.
- A forged witness certificate signs a different proof-record witness-authority transition-admission hash.
- Strict proof-record admission witness replay consumes a witness-authority transition replay that lacks the transition-admission witness layer.
- Strict proof replay proceeds when proof-record admission witness authority is certificate-local rather than admitted and witnessed.

Minimal implementation slice:

- Add `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend proof-record admission witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend proof-record admission witness replay and proof-record replay with transition-admission witness strictness.
- Add migration `0112_agent_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness_records.sql`.
- Add a focused falsification test for valid witnessed rows, missing witness replay, forged valid-looking missing nested witness replay, and wrong witness certificate subject.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A proof-record admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A proof-record admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. A strict quorum-certificate proof replay with `requireProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. A recovered certified-currentness proof replay that passes when strict proof-record admission witness-authority transition-admission witness accountability is missing.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on proof-record admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on proof-record admission witness replay
- `requireProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitness` on quorum-certificate proof replay
- Migration `0112_agent_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require witnessed proof-record admission witness authority-transition admission before finance proof records can establish recovered certified currentness.
- Axis B can use the same strict proof path for future marketing/domain-adapter proof-record ledgers.
- Axis C can simulate an amnesiac local agent attempting recovered certified-currentness proof replay from cached proof-record witness authority rows without the witnessed transition-admission ledger.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: a proof-record admission witness authority-transition admission row can carry enough certificate evidence inside itself to authorize recovered certified currentness. It cannot; the row must be separately witnessed.
- Failed assumption: proof-record admission witnesses are safe once their authority topology replays from admitted transition history. That transition-admission history must itself become the subject of a replayed witness ledger.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "proof-record admission witness authority-transition admissions to be witnessed"`: 1 passed, 212 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 617 passed, 143 skipped

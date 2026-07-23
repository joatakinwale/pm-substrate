# v215 Operational State Proof-Record Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ162
Research lane: substrate discovery, recovered certified-currentness authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v145 adds quorum-certificate proof records so recovered currentness can be replayed from a hash-linked proof ledger.
- v155 adds proof-record admission records so proof rows cannot become currentness merely because a local ledger contains them.
- v165 adds proof-record admission witness records so proof-record admissions require separate witness accountability.
- v175 adds proof-record admission witness authority topology so proof-record admission witness certificates bind to replayed principals and thresholds.
- v185 adds proof-record admission witness authority-transition admission so proof-record admission witness topology rows replay from admitted authority-transition history.
- v195 adds proof-record admission witness authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v205 adds proof-record transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0122` persists proof-record transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict proof-record replay could require proof-record admission witness authority-transition admissions to be witnessed, and could require those transition-admission witness certificates to bind to a replayed nested witness topology. But the nested topology could still be supplied directly as a topology object. That left a self-authorship path: an amnesiac agent, connector cache, local snapshot, or proof-ledger adapter could present a valid-looking nested topology for the witnesses that certified proof-record admission witness authority-transition admissions, without proving that the topology was itself admitted transition history.

The missing substrate primitive is proof-record transition-admission witness authority-transition admission: the topology that authorizes proof-record admission witness authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates before recovered quorum-certificate currentness can become operational state.

## Arrowsmith Bridge

A literature: proof records and replay certificates fail as operational state when agents resume from remembered witness topology, especially when old proof/admission history is represented by compacted or local proof objects.

B bridge: accountable distributed systems require secure histories that can be replayed; witness cosigning requires independent witnesses before acceptance; Byzantine quorum systems make quorum membership and intersection assumptions explicit; database recovery repeats history rather than trusting a remembered endpoint.

C literature:

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007, https://dl.acm.org/doi/10.1145/1323293.1294279 and https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016, https://ieeexplore.ieee.org/document/7546521/ and https://arxiv.org/pdf/1503.08768
- Malkhi and Reiter, "Byzantine Quorum Systems", Distributed Computing, https://dl.acm.org/doi/abs/10.1007/s004460050050 and https://www.cs.umass.edu/~arun/cs691ee/reading/BQS97.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992, https://dl.acm.org/doi/10.1145/128765.128770 and https://web.stanford.edu/class/cs345d-01/rl/aries.pdf

Mechanism extracted: currentness proof is not a remembered proof object; it is the replay result of admitted evidence plus the admitted authority basis for the witnesses that certified that evidence. Proof-record recovery therefore needs recursive witness-authority replay: a nested witness topology cannot authorize transition-admission witness certificates unless it is itself the current projection of admitted authority-transition history.

## Primitive Proposal

Name: proof-record transition-admission witness authority-transition admission.

Problem it solves: proof-record admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: PeerReview accountable logs, CoSi witness cosigning, Byzantine quorum systems, and ARIES repeat-history recovery.

Mechanism borrowed or adapted: strict quorum-certificate proof replay accepts a nested transition-admission witness topology only if admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction even when a higher-level replay object claims validity.

Why current substrate lacks it: v205 made nested proof-record transition-admission witness certificates topology-bound, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: proof records, proof-record admissions, proof-record admission witness records, proof-record admission witness authority topology, admitted proof-record admission witness authority transitions, transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict quorum-certificate proof replay cannot recover certified currentness unless the nested transition-admission witness topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; proof-record witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; proof-record admission witness replay and final proof-record replay can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Final proof-record replay re-inspects nested replay data so a forged valid-looking witness replay cannot hide missing nested history.

Authority boundary it requires: nested proof-record transition-admission witness authority-transition admissions use `operational_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_quorum_certificate_proof_record_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes proof-record transition-admission witness certificates.
- An amnesiac agent resumes recovered certified currentness from remembered nested witness membership rather than admitted transition history.
- A proof-ledger adapter supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking proof-record admission witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash before proof-record currentness recovery.

Minimal implementation slice:

- Add nested authority-transition admission replay support to proof-record transition-admission witness replay.
- Add strict nested replay checks to proof-record witness-authority transition-admission replay.
- Carry strict nested history requirements through proof-record admission witness replay and quorum-certificate proof replay.
- Add missing/invalid/mismatch issue codes for proof-record transition-admission witness authority-transition admission.
- Add migration `0132_agent_state_proof_record_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, proof-record admission witness replay refusal, and forged valid-looking proof-record replay refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `replayOperationalStateQuorumCertificateProofRecords({ requireProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Recovered quorum-certificate proof currentness is accepted when the nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateQuorumCertificateProofRecordAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateQuorumCertificateProofReplayInput.requireProofRecordAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched proof-record transition-admission witness authority-transition admission replay.
- Migration `0132_agent_state_proof_record_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance proof-record recovery to prove nested transition-admission witness authority through admitted topology-transition history before accepting certified currentness.
- Axis B can require the same nested admitted topology history before domain adapters accept proof-record currentness.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached proof-record nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
5. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
6. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
7. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
8. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?
9. SQ171: What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?
10. SQ172: What replay-semantics versioning proof prevents admitted authority-transition history from being reinterpreted by newer substrate code rather than replayed under the transition algebra that originally admitted it?

## Failed Assumption Ledger

- Failed assumption: topology-bound proof-record transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking proof-record admission witness replay can be trusted once its top-level `valid` field is true. It cannot; proof-record replay must inspect nested required replay fields recursively.

## Proof Status

Verification passed:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "proof-record admission witness authority-transition admission witness certificates"`: 2 passed, 227 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "proof-record admission witness authority-transition admission"`: 4 passed, 225 skipped
- `pnpm typecheck`
- `pnpm test`: 633 passed, 143 skipped
- `git diff --check`

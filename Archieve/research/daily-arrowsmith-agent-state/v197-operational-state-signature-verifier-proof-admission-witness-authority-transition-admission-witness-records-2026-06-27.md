# v197 Operational State Signature-Verifier Proof Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ144
Research lane: substrate discovery, operational signature state, verifier-proof admission witness authority accountability

## Question

What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v147 adds constrained signature-verifier adapter proofs so cryptographic validity cannot smuggle authority/currentness claims.
- v157 adds signature-verifier proof admission records so strict signature state requires the verifier proof itself to replay as admitted.
- v167 adds signature-verifier proof admission witness records so the latest proof-admission row must be separately quorum-certified by a witness ledger.
- v177 adds signature-verifier proof admission witness authority topology so proof-admission witness certificates bind to replayed active principals and quorum thresholds.
- v187 adds signature-verifier proof admission witness authority-transition admission records so proof-admission witness topology can replay from admitted authority-transition history.
- Migration `0104` persists admitted signature-verifier proof admission witness authority-transition rows.

## Missing Substrate Map

Strict verifier-proof evaluation can require proof admission, proof-admission witnesses, witness authority topology, and admitted witness-authority transition history. But v187 left the witness-authority transition-admission row as the next local authority object: the row carried a certificate, but no separate replayed ledger over the exact transition-admission record hash.

That is insufficient for amnesiac recovery. A verifier proof is a narrow cryptographic adapter output; operational signature state should not become current because a local cache supplies certificate-shaped topology admission rows. The missing substrate primitive is a separate append-only witness ledger over exact signature-verifier proof admission witness authority-transition admission record hashes.

## Arrowsmith Bridge

A literature: tool-use and signature-verification failures become operational-state failures when a valid-looking local proof row is treated as current authority after resume.

B bridge: committed reconfiguration and accountable logs require the exact state-changing object to be replayed, witnessed, and checked by subject hash rather than trusted as a local certificate summary.

C literature:

- Liskov and Cowling, "Viewstamped Replication Revisited" (MIT CSAIL TR 2012), https://dspace.mit.edu/bitstream/handle/1721.1/71763/MIT-CSAIL-TR-2012-021.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" (USENIX ATC 2014), https://raft.github.io/raft.pdf
- Tomescu and Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries" (CCS 2019), https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf

Mechanism extracted: a verifier proof boundary cannot rely on certificate-local topology admission rows. The exact transition-admission row must become the subject of a separate append-only witnessed log so replay can detect missing witnesses, wrong subject hashes, store confusion, forks, and invalid certificates.

## Primitive Proposal

Name: operational state signature-verifier proof admission witness authority-transition admission witness records.

Problem it solves: signature-verifier proof admission witness authority-transition admission rows could authorize operational signature state from local certificate-bearing rows.

Research source: Viewstamped Replication reconfiguration, Raft joint consensus, append-only authenticated transparency logs, and PeerReview accountable logs.

Mechanism borrowed or adapted: committed reconfiguration plus independently auditable exact log subjects. The substrate adaptation is a hash-linked witness ledger over signature-verifier proof admission witness authority-transition admission record hashes.

Why current substrate lacks it: v187 admitted proof-admission witness authority transitions but did not require a separate replayed witness ledger over each transition-admission row.

Why existing primitives are insufficient: verifier adapter proofs, verifier-proof admission, proof-admission witnesses, witness authority topology, and witness-authority transition admission each narrow the authority boundary, but none independently witnesses the exact transition-admission record hash.

State guarantee it should create: strict operational signature state cannot consume a proof-admission witness authority-transition admission row unless that exact row hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission row to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_signature_verifier_adapter_proof_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_signature_verifier_adapter_proof_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- A connector cache supplies signature-verifier proof-admission witness authority transition-admission rows without a separate witnessed record hash.
- A forged parent replay claims `valid: true` while omitting the nested transition-admission witness layer.
- A witness certificate signs a different transition-admission record hash.
- Strict verifier-proof evaluation accepts operational signature state from certificate-local witness-authority transition-admission rows.

Minimal implementation slice:

- Add `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend verifier proof-admission witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend proof-admission witness replay and verifier proof evaluation with transition-admission witness strictness.
- Add migration `0114_agent_state_signature_verifier_proof_admission_witness_authority_transition_admission_witness_records.sql`.
- Add focused falsification tests for valid witnessed rows, missing witness replay, forged parent replay, wrong certificate subject hash, and invalid nested witness replay.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A verifier proof-admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A verifier proof-admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. A verifier proof evaluation with `requireProofAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` proof-admission witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. Strict operational signature state that passes when proof-admission witness authority transition-admission rows are not separately witnessed.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on signature-verifier proof admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on signature-verifier proof admission witness replay
- `requireProofAdmissionWitnessAuthorityTransitionAdmissionWitness` on verifier-proof evaluation
- Migration `0114_agent_state_signature_verifier_proof_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require witnessed verifier-proof admission witness authority-transition admission before finance evidence signatures count as operational state.
- Axis B can require the same strict verifier proof path for future marketing/domain-adapter signature evidence.
- Axis C can simulate an amnesiac local agent attempting to resume from cached verifier proof-admission witness authority rows without the witnessed transition-admission ledger.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: a signature-verifier proof admission witness authority-transition admission row can carry enough certificate evidence inside itself to authorize strict operational signature state. It cannot; the row must be separately witnessed.
- Failed assumption: cryptographic proof validity makes authority admission accountability less urgent. It does the opposite: the cryptographic adapter is deliberately narrow, so authority around its admission must remain replayed substrate state.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "signature verifier proof admission witness authority-transition admissions to be witnessed"`: 1 passed, 214 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 619 passed, 143 skipped

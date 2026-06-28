# v207 Operational State Signature-Verifier Proof Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ154
Research lane: substrate discovery, signature-verifier proof authority, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v147 adds constrained signature-verifier adapter proofs so adapter output cannot smuggle authority or currentness claims into operational state.
- v157 adds signature-verifier proof admission records so verifier proofs cannot self-admit.
- v167 adds signature-verifier proof admission witness records so proof-admission rows are witnessed by a separate ledger.
- v177 adds signature-verifier proof admission witness authority topology so proof-admission witness certificates bind to replayed principals and thresholds.
- v187 adds signature-verifier proof admission witness authority-transition admission records so proof-admission witness topology can replay from admitted authority-transition history.
- v197 adds signature-verifier proof admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0114` persists signature-verifier proof admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict signature-verifier proof evaluation could require proof-admission witness authority-transition admission rows to be witnessed, but the certificates inside that nested transition-admission witness ledger still carried their own accepted witness set. That meant operational signature state could still depend on certificate-local signer representation at the nested signature-verifier transition-admission witness layer.

The missing substrate primitive is signature-verifier transition-admission witness authority topology: certificates for signature-verifier proof admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: memory drift and stale connector state become operational signature failures when verifier proof recovery accepts a certificate-local witness set as authority for nested proof history.

B bridge: secure update, provenance, and key-transparency systems separate signature evidence from signing authority. The verifier checks signatures against role metadata, delegated thresholds, provenance attestations, and transparent key/certificate logs rather than trusting the artifact's own statement of who was allowed to sign.

C literature:

- Samuel, Mathewson, Cappos, and Dingledine, "Survivable Key Compromise in Software Update Systems" (ACM CCS 2010), https://freehaven.net/~arma/tuf-ccs2010.pdf
- Torres-Arias et al., "in-toto: Providing farm-to-table guarantees for bits and bytes" (USENIX Security 2019), https://www.usenix.org/conference/usenixsecurity19/presentation/torres-arias
- Fulcio/Sigstore authors, "Sigstore: Software Signing for Everybody" (ACM CCS 2022), https://dl.acm.org/doi/10.1145/3548606.3560596
- Melara et al., "CONIKS: Bringing Key Transparency to End Users" (USENIX Security 2015), https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara

Mechanism extracted: a valid signature or witness certificate is not operational authority by itself. The accepted signer set, quorum threshold, key eligibility, and subject binding must be checked against replayed authority state.

## Primitive Proposal

Name: signature-verifier transition-admission witness authority topology.

Problem it solves: signature-verifier proof admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: TUF role/threshold signing, in-toto provenance layout verification, Sigstore certificate/transparency binding, and CONIKS key-transparency consistency.

Mechanism borrowed or adapted: accept a nested witness certificate only when the certificate is bound to a replayed authority topology and enough unique active topology principals signed the exact transition-admission subject.

Why current substrate lacks it: v197 replayed a witness ledger over exact transition-admission record hashes, but did not bind that witness ledger's certificates to replayed signer topology.

Why existing primitives are insufficient: constrained verifier proofs, proof admission, proof admission witnesses, proof-admission witness authority topology, admitted witness-authority transitions, and witnessed transition-admission rows each narrow authority, but none made the nested transition-admission witness certificates' signer set replayable.

State guarantee it should create: strict signature-verifier proof evaluation cannot consume proof admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; proof admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; verifier proof evaluation can require `requireProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: signature-verifier transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: nested witness certificates must use `operational_state_signature_verifier_adapter_proof_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_signature_verifier_adapter_proof_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate signature-verifier transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes operational signature state.
- Duplicate witness ids satisfy signature-verifier transition-admission witness quorum.
- Unknown or suspended witness ids satisfy signature-verifier transition-admission witness quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Strict verifier proof evaluation accepts a forged valid-looking replay whose nested transition-admission witness certificates lack topology-bound authority.

Minimal implementation slice:

- Extend signature-verifier transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend signature-verifier witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend proof admission witness replay and signature-verifier proof evaluation with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0124_agent_state_signature_verifier_proof_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStateSignatureVerifierAdapterProof({ requireProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with proof admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateSignatureVerifierAdapterEvaluationInput.requireProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested signature-verifier transition-admission witness topology issue codes and quorum checks.
- Migration `0124_agent_state_signature_verifier_proof_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound signature-verifier transition-admission witness certificates before finance recovery accepts operational signature state.
- Axis B can require the same nested topology proof before domain adapters consume verifier proofs.
- Axis C can simulate an amnesiac local agent attempting to resume from cached signature-verifier transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked signature-verifier transition-admission witness ledger is enough accountability for operational signature state. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: signature-verifier nested witness certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "signature verifier proof admission witness authority-transition admission witness certificates"`: 1 passed, 224 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "signature verifier proof admission witness authority-transition admission"`: 3 passed, 222 skipped
- `pnpm typecheck`
- `pnpm test`: 629 passed, 143 skipped
- `git diff --check`

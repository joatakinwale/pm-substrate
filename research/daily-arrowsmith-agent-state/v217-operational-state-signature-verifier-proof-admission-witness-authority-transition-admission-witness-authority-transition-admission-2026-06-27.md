# v217 Operational State Signature-Verifier Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ164
Research lane: substrate discovery, operational signature authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v147 adds constrained signature-verifier adapter proofs: a verifier proof may prove signature validity only, not authority/currentness.
- v157 adds signature-verifier proof admission records so verifier proofs become operational only through quorum-certified proof admission.
- v167 adds proof-admission witness records so the latest verifier proof admission row must be witnessed by a separate ledger.
- v177 adds signature-verifier proof-admission witness authority topology so proof-admission witness certificates bind to replayed principals and quorum.
- v187 adds signature-verifier proof-admission witness authority-transition admission so proof-admission witness topology replays from admitted authority-transition history.
- v197 adds signature-verifier proof-admission witness authority-transition admission witness records so authority-transition admission rows are witnessed by a separate ledger.
- v207 adds signature-verifier transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0124` persists signature-verifier transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict verifier-proof evaluation could require proof admission, proof-admission witnesses, proof-admission witness authority topology, admitted proof-admission witness authority transitions, witnessed authority-transition admissions, and topology-bound nested transition-admission witness certificates. But the nested witness topology used by those certificates could still be supplied directly as a topology object. That left a signature-authority self-authorship path: an amnesiac agent, connector cache, local key-policy snapshot, or verifier adapter could present a valid-looking nested topology without proving that this topology was the latest projection of admitted transition history.

The missing substrate primitive is signature-verifier transition-admission witness authority-transition admission: the topology that authorizes signature-verifier proof admission witness authority-transition admission witness certificates must itself be reconstructed from admitted authority-transition records before verifier proof evaluation can treat the proof as operational state.

## Arrowsmith Bridge

A literature: signature-verifier and supply-chain systems fail when local key policy, stale signer membership, cached repository state, or partial step evidence is treated as current authority.

B bridge: secure update/signing systems do not let a signature stand alone as operational trust. They bind signatures to replayable role metadata, layouts, link metadata, threshold key roles, transparency logs, freshness, and signed identity claims.

C literature:

- Samuel, Mathewson, Cappos, and Dingledine, "Survivable Key Compromise in Software Update Systems", ACM CCS 2010, https://freehaven.net/~arma/tuf-ccs2010.pdf
- Torres-Arias et al., "in-toto: Providing farm-to-table guarantees for bits and bytes", USENIX Security 2019, https://www.usenix.org/system/files/sec19-torres-arias.pdf
- Newman, Meyers, and Torres-Arias, "Sigstore: Software Signing for Everybody", ACM CCS 2022, https://scispace.com/pdf/sigstore-2fhn2nm2.pdf

Mechanism extracted: cryptographic validity is not authority. TUF separates signing roles and thresholds so key compromise does not collapse update authority; in-toto verifies a signed layout plus step-by-step link metadata instead of trusting individual step outputs; Sigstore moves signing into identity and transparency logs with freshness. The substrate adaptation is that a verifier proof can become operational only when every signing/witness authority topology in its admission path is a replayed admitted projection, not a remembered local policy object.

## Primitive Proposal

Name: signature-verifier transition-admission witness authority-transition admission.

Problem it solves: signature-verifier proof admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: TUF role/threshhold metadata and revocation, in-toto layout/link metadata, and Sigstore transparency-backed identity signing.

Mechanism borrowed or adapted: a verifier proof is accepted only when its witness-authority topology chain is recursively replayable. The nested topology that authorizes transition-admission witness certificates must equal the latest admissible projection of admitted nested authority-transition history.

Why current substrate lacks it: v207 made nested signature-verifier transition-admission witness certificates topology-bound, but did not require the topology to be recovered from admitted authority-transition history.

Why existing primitives are insufficient: verifier proofs, proof admissions, proof-admission witnesses, witness authority topology, admitted witness authority transitions, transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested witness topology was itself admitted transition history.

State guarantee it should create: strict signature-verifier proof evaluation cannot accept operational signature state unless the nested transition-admission witness topology used by authority-transition admission witness certificates is the latest projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; verifier witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; proof admission witness replay and final verifier proof evaluation can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Final verifier proof evaluation re-inspects nested replay fields so a forged valid-looking proof-admission witness replay cannot hide missing nested history.

Authority boundary it requires: nested signature-verifier transition-admission witness authority-transition admissions use `operational_state_signature_verifier_adapter_proof_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_signature_verifier_adapter_proof_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local key-policy topology authorizes signature-verifier transition-admission witness certificates.
- An amnesiac agent resumes verifier proof authority from cached nested witness membership instead of admitted transition history.
- A connector or KMS adapter supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking proof-admission witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes verifier proof-admission certificates under another topology hash.

Minimal implementation slice:

- Add nested authority-transition admission replay support to signature-verifier transition-admission witness replay.
- Add strict nested replay checks to signature-verifier proof witness-authority transition-admission replay.
- Carry strict nested history requirements through proof admission witness replay and final signature-verifier proof evaluation.
- Add missing/invalid/mismatch issue codes for signature-verifier transition-admission witness authority-transition admission.
- Add migration `0134_agent_state_signature_verifier_proof_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, proof-admission witness replay refusal, and forged valid-looking verifier proof refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateSignatureVerifierAdapterProof({ requireProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Operational signature state is accepted when the nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateSignatureVerifierAdapterEvaluationInput.requireProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched signature-verifier transition-admission witness authority-transition admission replay.
- Migration `0134_agent_state_signature_verifier_proof_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance verifier proofs to prove nested transition-admission witness authority through admitted topology-transition history before accepting signature-backed operational state.
- Axis B can require the same nested admitted topology history before domain adapters accept signature-verifier proof authority.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached verifier-key topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
3. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
4. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
5. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
6. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?
7. SQ171: What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?
8. SQ172: What replay-semantics versioning proof prevents admitted authority-transition history from being reinterpreted by newer substrate code rather than replayed under the transition algebra that originally admitted it?
9. SQ173: What configuration-master or topology-settlement proof chooses the authoritative branch when independently admitted authority-topology histories propose competing recovery topologies?
10. SQ174: What verifier-role metadata settlement or key-transparency proof prevents local key-binding policy from becoming operational signature authority across verifier upgrades, identity-provider changes, or transparency-log forks?

## Failed Assumption Ledger

- Failed assumption: topology-bound signature-verifier transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking proof admission witness replay can be trusted once its top-level `valid` field is true. It cannot; verifier proof evaluation must inspect nested required replay fields recursively.

## Proof Status

Verification completed for the implementation slice:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "signature verifier proof admission witness authority-transition admission"`: 4 passed, 227 skipped
- `pnpm typecheck`
- `pnpm test`: 635 passed, 143 skipped
- `git diff --check`

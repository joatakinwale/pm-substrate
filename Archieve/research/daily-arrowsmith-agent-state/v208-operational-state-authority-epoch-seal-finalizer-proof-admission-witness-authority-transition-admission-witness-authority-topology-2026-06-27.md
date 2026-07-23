# v208 Operational State Authority Epoch Seal Finalizer-Proof Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ155
Research lane: substrate discovery, seal finality, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v148 adds authority epoch seal finalizer proofs so seal finality must be an exact verifier-bound proof over the canonical seal payload.
- v158 adds finalizer-proof admission records so finalizer proofs cannot self-admit.
- v168 adds finalizer-proof admission witness records so proof-admission rows are witnessed by a separate ledger.
- v178 adds finalizer-proof admission witness authority topology so proof-admission witness certificates bind to replayed principals and thresholds.
- v188 adds finalizer-proof admission witness authority-transition admission records so proof-admission witness topology can replay from admitted authority-transition history.
- v198 adds finalizer-proof admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0115` persists finalizer-proof admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict seal-finality evaluation could require finalizer-proof admission witness authority-transition admission rows to be witnessed, but the certificates inside that nested transition-admission witness ledger still carried their own accepted witness set. That meant final operational seal state could still depend on certificate-local signer representation at the nested finalizer transition-admission witness layer.

The missing substrate primitive is finalizer-proof transition-admission witness authority topology: certificates for finalizer-proof admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: memory drift and stale connector state become finality failures when an agent resumes from a locally summarized seal path whose nested witness certificates name their own signer set.

B bridge: BFT finality treats a commit or quorum certificate as evidence only when signer membership, threshold, and view/subject binding come from protocol authority. A certificate is not authority merely because it lists signers.

C literature:

- Castro and Liskov, "Practical Byzantine Fault Tolerance" (OSDI 1999), https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance
- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus with Linearity and Responsiveness" (PODC 2019), https://dl.acm.org/doi/10.1145/3293611.3331591
- "Short Paper: Accountable Safety Implies Finality" (Financial Cryptography 2024 pre-proceedings), https://fc24.ifca.ai/preproceedings/16.pdf

Mechanism extracted: finality certificates are replayable only when their signer set is derived from admitted authority state, not from the certificate's private representation. If a certificate can supply both the evidence and the authority roster, it is not a finality proof; it is a self-authored claim.

## Primitive Proposal

Name: finalizer-proof transition-admission witness authority topology.

Problem it solves: finalizer-proof admission witness authority-transition admission witness certificates could self-authorize seal finality through certificate-local accepted witness ids.

Research source: PBFT quorum certificates, HotStuff quorum-certificate finality, and accountable safety/finality work.

Mechanism borrowed or adapted: accept a nested finalizer transition-admission witness certificate only when the certificate is bound to a replayed authority topology and enough unique active topology principals signed the exact transition-admission subject.

Why current substrate lacks it: v198 replayed a witness ledger over exact transition-admission record hashes, but did not bind that witness ledger's certificates to replayed signer topology.

Why existing primitives are insufficient: finalizer proofs, proof admission, proof admission witnesses, finalizer-proof witness authority topology, admitted witness-authority transitions, and witnessed transition-admission rows each narrow authority, but none made the nested transition-admission witness certificates' signer set replayable.

State guarantee it should create: strict authority epoch seal finalizer evaluation cannot consume finalizer-proof admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; finalizer-proof admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; finalizer evaluation can require `requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: finalizer transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: nested witness certificates must use `operational_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate finalizer transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes operational seal finality.
- Duplicate witness ids satisfy finalizer transition-admission witness quorum.
- Unknown or suspended witness ids satisfy finalizer transition-admission witness quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Strict finalizer evaluation accepts a forged valid-looking replay whose nested transition-admission witness certificates lack topology-bound authority.

Minimal implementation slice:

- Extend finalizer transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend finalizer witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend finalizer-proof admission witness replay and authority epoch seal finalizer evaluation with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0125_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStateAuthorityEpochSealFinalizer({ requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with finalizer-proof admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateAuthorityEpochSealFinalizerEvaluationInput.requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested finalizer transition-admission witness topology issue codes and quorum checks.
- Migration `0125_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound finalizer transition-admission witness certificates before finance recovery accepts operational seal finality.
- Axis B can require the same nested topology proof before domain adapters consume finalizer/seal outcomes.
- Axis C can simulate an amnesiac local agent attempting to resume from cached finalizer transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked finalizer transition-admission witness ledger is enough accountability for operational seal finality. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: finalizer nested witness certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority epoch seal finalizer proof admission witness authority-transition admission witness certificates"`: 1 passed, 225 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority epoch seal finalizer proof admission witness authority-transition admission"`: 2 passed, 224 skipped
- `pnpm typecheck`
- `pnpm test`: 630 passed, 143 skipped
- `git diff --check`

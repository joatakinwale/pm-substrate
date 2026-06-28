# v218 Operational State Finalizer Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ165
Research lane: substrate discovery, seal finality authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v148 adds authority epoch seal finalizer proofs so authority-epoch seals require a finalizer signature proof over a canonical seal payload.
- v158 adds finalizer-proof admission records so seal finality proofs become operational only through quorum-certified proof admission.
- v168 adds finalizer-proof admission witness records so the latest finalizer-proof admission row must be witnessed by a separate ledger.
- v178 adds finalizer-proof admission witness authority topology so proof-admission witness certificates bind to replayed principals and quorum.
- v188 adds finalizer-proof admission witness authority-transition admission so proof-admission witness topology replays from admitted authority-transition history.
- v198 adds finalizer-proof admission witness authority-transition admission witness records so authority-transition admission rows are witnessed by a separate ledger.
- v208 adds finalizer transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0125` persists finalizer transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict seal-finality evaluation could require finalizer proof admission, proof-admission witnesses, proof-admission witness authority topology, admitted proof-admission witness authority transitions, witnessed authority-transition admissions, and topology-bound nested transition-admission witness certificates. But the nested witness topology used by those certificates could still be supplied directly as a topology object. That left a finality self-authorship path: an amnesiac agent, connector cache, local seal snapshot, or finalizer adapter could present a valid-looking nested topology without proving that this topology was the latest projection of admitted transition history.

The missing substrate primitive is finalizer transition-admission witness authority-transition admission: the topology that authorizes finalizer-proof admission witness authority-transition admission witness certificates must itself be reconstructed from admitted authority-transition records before seal finality can become operational state.

## Arrowsmith Bridge

A literature: finality systems fail when a client accepts local lock state, cached validator membership, or a finalizer signature without replaying the quorum and signer-set history that made the signature authoritative.

B bridge: BFT systems make finality an admitted certificate chain rather than a private statement. PBFT preserves stable checkpoint and view-change proof so committed state survives leader changes; HotStuff commits through chained quorum certificates; Casper-style finality and accountable-safety work treat conflicting finality as evidence-bearing validator violation, not a subjective disagreement.

C literature:

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999, https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance
- Yin, Malkhi, Reiter, Gueta, and Abraham, "HotStuff: BFT Consensus with Linearity and Responsiveness", PODC 2019 / arXiv, https://arxiv.org/pdf/1803.05069
- Buterin and Griffith, "Casper the Friendly Finality Gadget", arXiv 2017/2019, https://arxiv.org/abs/1710.09437
- Rambaud, Amoussou-Guenou, and Tucci-Piergiovanni, "Short Paper: Accountable Safety Implies Finality", FC 2024, https://fc24.ifca.ai/preproceedings/16.pdf

Mechanism extracted: finality is not a remembered outcome. It is a quorum-certified chain whose validator/signature authority is itself part of replayable protocol state. If finality conflicts, the useful object is replayable evidence of the certificate/history conflict.

## Primitive Proposal

Name: finalizer transition-admission witness authority-transition admission.

Problem it solves: finalizer-proof admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: PBFT stable checkpoint/view-change proof, HotStuff chained quorum certificates, Casper finality checkpoints, and accountable-safety finality/evidence.

Mechanism borrowed or adapted: a finalizer proof is accepted only when its witness-authority topology chain is recursively replayable. The nested topology that authorizes transition-admission witness certificates must equal the latest admissible projection of admitted nested authority-transition history.

Why current substrate lacks it: v208 made nested finalizer transition-admission witness certificates topology-bound, but did not require the topology to be recovered from admitted authority-transition history.

Why existing primitives are insufficient: finalizer proofs, proof admissions, proof-admission witnesses, witness authority topology, admitted witness authority transitions, transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested witness topology was itself admitted transition history.

State guarantee it should create: strict authority epoch seal finalizer evaluation cannot accept operational seal finality unless the nested transition-admission witness topology used by authority-transition admission witness certificates is the latest projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; finalizer witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; proof admission witness replay and final seal evaluation can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Final seal evaluation re-inspects nested replay fields so a forged valid-looking proof-admission witness replay cannot hide missing nested history.

Authority boundary it requires: nested finalizer transition-admission witness authority-transition admissions use `operational_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local seal-finality topology authorizes finalizer transition-admission witness certificates.
- An amnesiac agent resumes seal finality from cached nested witness membership instead of admitted transition history.
- A connector or finalizer adapter supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking finalizer proof-admission witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes seal finality under another topology hash.

Minimal implementation slice:

- Add nested authority-transition admission replay support to finalizer transition-admission witness replay.
- Add strict nested replay checks to finalizer proof witness-authority transition-admission replay.
- Carry strict nested history requirements through finalizer proof admission witness replay and final seal evaluation.
- Add missing/invalid/mismatch issue codes for finalizer transition-admission witness authority-transition admission.
- Add migration `0135_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, proof-admission witness replay refusal, and forged valid-looking finalizer refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateAuthorityEpochSealFinalizer({ requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Operational seal finality is accepted when the nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateAuthorityEpochSealFinalizerEvaluationInput.requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched finalizer transition-admission witness authority-transition admission replay.
- Migration `0135_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance finalizer proofs to prove nested transition-admission witness authority through admitted topology-transition history before accepting seal-backed operational state.
- Axis B can require the same nested admitted topology history before domain adapters accept finalizer-proof authority.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached finalizer topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
2. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
3. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
4. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
5. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?
6. SQ171: What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?
7. SQ172: What replay-semantics versioning proof prevents admitted authority-transition history from being reinterpreted by newer substrate code rather than replayed under the transition algebra that originally admitted it?
8. SQ173: What configuration-master or topology-settlement proof chooses the authoritative branch when independently admitted authority-topology histories propose competing recovery topologies?
9. SQ174: What verifier-role metadata settlement or key-transparency proof prevents local key-binding policy from becoming operational signature authority across verifier upgrades, identity-provider changes, or transparency-log forks?
10. SQ175: What accountable finality evidence primitive makes conflicting authority epoch seal finalizer quorums become replayable obstruction evidence rather than private dispute?

## Failed Assumption Ledger

- Failed assumption: topology-bound finalizer transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking finalizer proof admission witness replay can be trusted once its top-level `valid` field is true. It cannot; finalizer evaluation must inspect nested required replay fields recursively.
- New pressure: v218 still does not model conflicting finalizer quorums as an accountable finality evidence object. SQ175 should decide how conflicting finality becomes obstruction evidence.

## Proof Status

Verification completed for the implementation slice:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority epoch seal finalizer proof admission witness authority-transition admission witness certificates to bind to replayed witness authority transition history"`: 1 passed, 231 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority epoch seal finalizer proof admission witness authority-transition admission"`: 3 passed, 229 skipped
- `pnpm typecheck`
- `pnpm test`: 636 passed, 143 skipped
- `git diff --check`

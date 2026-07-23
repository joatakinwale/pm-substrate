# v188 - Operational State Finalizer-Proof Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ135

## Research Question

What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Yin et al., "HotStuff: BFT Consensus with Linearity and Responsiveness", PODC 2019 / arXiv: https://arxiv.org/abs/1803.05069
- Kogias et al., "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing", USENIX Security 2016: https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/kogias
- Kokoris-Kogias, "Proactive Refresh for Accountable Threshold Signatures", Financial Cryptography and Data Security 2024: https://fc24.ifca.ai/preproceedings/183.pdf

## Mechanism Extracted

PBFT and HotStuff make finality a property of an admitted protocol history, not a node's local memory of who the replicas are. ByzCoin applies collective signing to commit transactions irreversibly under strong consistency, making a quorum certificate a replayable settlement object rather than a local assertion. Accountable threshold signatures add signer accountability: the proof should identify, or at least commit to, the quorum that authorized the result so signers cannot be replaced after the fact by a different claimed authority set.

The substrate adaptation is finalizer-proof admission witness authority-transition admission. v178 made finalizer-proof admission witness certificates topology-bound, but strict seal finality could still consume a hash-valid finalizer-proof admission witness authority topology supplied by memory, adapters, or connector cache. v188 adds an admitted transition ledger for that topology. Strict finalizer-proof admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each transition admission binds the authority transition hash, previous topology hash after bootstrap, derived next topology hash, and the certificate that admitted the transition under the prior replayed topology.

## Existing Substrate Map

- v148 added authority epoch seal finalizer proofs that bind finality payload, finalizer principal, key binding, and constrained verifier proof.
- v158 added finalizer-proof admission records so strict seal finality can require the replay-current finalizer proof admission.
- v168 added finalizer-proof admission witness records so self-authored finalizer-proof admission rows cannot authorize seal finality alone.
- v178 added finalizer-proof admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0095` persists append-only finalizer-proof admission witness authority-transition rows.
- Before v188, `replayOperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, and `evaluateOperationalStateAuthorityEpochSealFinalizer()` could require finalizer-proof admission witness authority topology, but that topology object could still be supplied from memory, adapters, connector cache, or unadmitted local transition rows.

## Missing Substrate Map

- Before v188, finalizer-proof admission witness authority-transition rows were storage facts, not admitted seal-finality authority.
- Before v188, strict seal-finality evaluation could consume finalizer-proof admission witness authority topology without proving the latest witness-authority transition was admitted.
- Before v188, a supplied topology could authorize the witness certificate that made a finalizer-proof admission row accountable without proving the topology's own admission path.
- Before v188, no replay object bound finalizer-proof admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v188: genesis/bootstrap authority for the first finalizer-proof admission witness-authority transition, separate witness/finality for this transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime seal-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state authority epoch seal finalizer-proof admission witness authority-transition admission.

Problem it solves: prevents finalizer-proof admission witness authority topology from becoming seal-finality authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: PBFT, HotStuff, ByzCoin collective signing, and accountable threshold signatures.

Mechanism borrowed: finality and membership are protocol-state facts; quorum certificates must bind exact subjects and admitted signer authority; signer accountability matters for replay and recovery.

Why current substrate lacked it: v178 bound finalizer-proof admission witness certificates to a replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: finalizer proofs, finalizer-proof admissions, finalizer-proof admission witnesses, and topology-bound witness certificates constrain seal finality, but not the authority-transition ledger that defines which witnesses can certify finalizer-proof admission rows. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict seal-finality evaluation can consume a finalizer-proof admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each finalizer-proof admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap finalizer-proof admission witness authority changes are counted against the previous replayed finalizer-proof admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied finalizer-proof admission witness topology, stale local finalizer-proof admission witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and seal finality authorized by unadmitted finalizer-proof admission witness-authority transition history.

Minimal implementation slice: add finalizer-proof admission witness authority-transition admission record/replay types, deterministic hashes, strict witness replay/evaluation flags, migration `0105`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict seal-finality evaluation passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct seal-finality recovery from admitted finalizer-proof admission witness authority transitions, Axis A finance finalizer seals attempting stale witness topology, and Axis B/domain adapters attempting to supply local finalizer-proof admission witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- A finalizer-proof admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict seal-finality evaluation.
- Strict seal-finality evaluation must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a finalizer-proof admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only finalizer-proof admission witness authority-transition rows are enough to constitute seal-finality authority.
- Falsified: a topology object supplied to finalizer-proof admission witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial finalizer-proof admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateAuthorityEpochSealFinalizerProofAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for finalizer-proof admission witness authority-transition admissions.
- Extended finalizer-proof admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended authority epoch seal finalizer evaluation with `requireFinalizerProofAdmissionWitnessAuthorityTransitionAdmission`.
- Added finalizer issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0105_agent_state_authority_epoch_seal_finalizer_proof_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "finalizer proof admission witness"` (4 passed, 202 skipped)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (610 passed, 143 skipped)

Outcome: SQ135 is closed. SQ136 is now the active next substrate question, with SQ145 added as new finalizer-proof admission witness authority-transition admission-record accountability pressure.

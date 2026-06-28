# v187 - Operational State Signature-Verifier Proof Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ134

## Research Question

What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Appel and Felten, "Proof-Carrying Authentication", CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Samuel et al., "Survivable Key Compromise in Software Update Systems", CCS 2010: https://freehaven.net/~arma/tuf-ccs2010.pdf
- Torres-Arias et al., "in-toto: Providing Farm-to-Table Guarantees for Bits and Bytes", USENIX Security 2019: https://www.usenix.org/system/files/sec19-torres-arias.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

## Mechanism Extracted

Proof-carrying authentication makes the requester carry a checkable proof with the request, separating local belief from authorization. TUF adds role separation, threshold signatures, and revocation so compromise of one key or one role cannot silently become update authority. in-toto contributes a supply-chain layout/link discipline: a signed authority layout defines who may attest a step, and missing or wrong-key link metadata cannot satisfy the verification rule. Raft and dynamic Byzantine quorum work add the reconfiguration lesson: authority membership/configuration must move through admitted protocol history, not through a client-local configuration object.

The substrate adaptation is signature-verifier proof admission witness authority-transition admission. v177 made verifier proof-admission witness certificates topology-bound, but strict signature proof evaluation could still consume a hash-valid proof-admission witness authority topology supplied by memory, adapters, or connector cache. v187 adds an admitted transition ledger for that topology. Strict verifier proof-admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each transition admission binds the authority transition hash, previous topology hash after bootstrap, derived next topology hash, and the certificate that admitted the transition under the prior replayed topology.

## Existing Substrate Map

- v147 added constrained signature-verifier adapter proofs that may prove signature validity only, not authority, currentness, topology, quorum, or admission.
- v157 added signature-verifier proof admission records so strict verifier proof evaluation can require the replay-current proof admission.
- v167 added signature-verifier proof admission witness records so self-authored proof-admission rows cannot authorize operational signature state alone.
- v177 added signature-verifier proof admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0094` persists append-only signature-verifier proof admission witness authority-transition rows.
- Before v187, `replayOperationalStateSignatureVerifierAdapterProofAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, and `evaluateOperationalStateSignatureVerifierAdapterProof()` could require proof-admission witness authority topology, but that topology object could still be supplied from memory, adapters, connector cache, or unadmitted local transition rows.

## Missing Substrate Map

- Before v187, signature-verifier proof admission witness authority-transition rows were storage facts, not admitted operational-signature authority.
- Before v187, strict signature proof evaluation could consume proof-admission witness authority topology without proving the latest witness-authority transition was admitted.
- Before v187, a supplied topology could authorize the witness certificate that made a verifier proof-admission row accountable without proving the topology's own admission path.
- Before v187, no replay object bound verifier proof-admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v187: genesis/bootstrap authority for the first verifier proof-admission witness-authority transition, separate witness/finality for this transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime verifier-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state signature-verifier proof admission witness authority-transition admission.

Problem it solves: prevents signature-verifier proof admission witness authority topology from becoming operational signature authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: Proof-Carrying Authentication, TUF, in-toto, Raft reconfiguration, and Dynamic Byzantine Quorum Systems.

Mechanism borrowed: authority-bearing proofs must carry replay-checkable evidence; signer roles and thresholds must be scoped by admitted authority; configuration/topology changes must themselves be admitted protocol state.

Why current substrate lacked it: v177 bound proof-admission witness certificates to a replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: verifier proofs, proof admissions, proof admission witnesses, and topology-bound witness certificates constrain operational signature state, but not the authority-transition ledger that defines which witnesses can certify proof-admission rows. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict signature-verifier proof evaluation can consume a proof-admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each signature-verifier proof admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap verifier proof-admission witness authority changes are counted against the previous replayed proof-admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied verifier proof-admission witness topology, stale local verifier proof-admission witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and operational signature state authorized by unadmitted proof-admission witness-authority transition history.

Minimal implementation slice: add signature-verifier proof admission witness authority-transition admission record/replay types, deterministic hashes, strict proof-admission witness replay/evaluation flags, migration `0104`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict signature proof evaluation passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct verifier-proof recovery from admitted proof-admission witness authority transitions, Axis A finance signatures attempting stale verifier witness topology, and Axis B/domain adapters attempting to supply local proof-admission witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- A signature-verifier proof admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict signature-verifier proof evaluation.
- Strict signature-verifier proof evaluation must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a signature-verifier proof admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only verifier proof-admission witness authority-transition rows are enough to constitute operational signature authority.
- Falsified: a topology object supplied to verifier proof-admission witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial verifier proof-admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateSignatureVerifierAdapterProofAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for signature-verifier proof admission witness authority-transition admissions.
- Extended proof-admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended signature-verifier proof evaluation with `requireProofAdmissionWitnessAuthorityTransitionAdmission`.
- Added signature-verifier issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0104_agent_state_signature_verifier_proof_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "signature verifier proof admission witness authority"` (2 passed, 202 skipped)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (608 passed, 143 skipped)

Outcome: SQ134 is closed. SQ135 is now the active next substrate question, with SQ144 added as new signature-verifier proof admission witness authority-transition admission-record accountability pressure.

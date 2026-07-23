# v182 - Operational State Storage Mutation Guard Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ129

## Research Question

What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies", IEEE Symposium on Security and Privacy 1987: https://ieeexplore.ieee.org/document/6234890
- Sandhu, "Separation of Duties in Computerized Information Systems", IFIP WG11.3 Workshop on Database Security 1990: https://profsandhu.com/confrnc/ifip/i90sep.pdf
- Sandhu, Coyne, Feinstein, and Youman, "Role-Based Access Control Models", IEEE Computer 1996: https://csrc.nist.gov/csrc/media/projects/role-based-access-control/documents/sandhu96.pdf
- Alvisi, Pierce, and Reiter, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Li and Lesani, "Reconfigurable Heterogeneous Quorum Systems", DISC 2024: https://drops.dagstuhl.de/storage/00lipics/lipics-vol319-disc2024/LIPIcs.DISC.2024.52/LIPIcs.DISC.2024.52.pdf

## Mechanism Extracted

Clark-Wilson integrity, Sandhu transaction-control expressions, and RBAC separation-of-duty constraints all point at the same substrate mechanism: protected mutation is not authorized by private permission belief; it is authorized by a constrained transaction history that carries enough relevant prior history to prove that the actor and procedure are allowed. Dynamic Byzantine quorum and reconfigurable quorum systems add the missing reconfiguration rule: the authority set that admits protected changes must itself evolve through admitted transitions, and post-bootstrap changes must be certified by the prior admissible authority topology.

The substrate adaptation is storage mutation guard authorization admission witness authority-transition admission. v172 made guard-authorization admission witness certificates topology-bound, but strict guard evaluation could still accept a hash-valid witness authority topology supplied as a local replay input. v182 adds a transition-admission ledger for that topology. Strict guard-admission witness replay can now require the guard-admission witness authority topology to be recovered from admitted authority-transition records. Each admission record binds the authority transition hash, the previous topology hash when applicable, the derived next topology hash, and the certificate that admitted the transition.

## Existing Substrate Map

- v152 added storage mutation guards so protected operational-state table UPDATE/DELETE paths require tombstone-derived authorization.
- v162 added storage mutation guard authorization admission witness records over exact authorization-admission record hashes.
- v172 added guard-admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0089` persists append-only guard-admission witness authority-transition rows.
- Before v182, `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, but that topology object could still be supplied from memory, adapters, connector cache, or self-authored transition rows.

## Missing Substrate Map

- Before v182, guard-admission witness authority-transition rows were append-only storage, not admitted operational mutation authority.
- Before v182, strict storage mutation guard evaluation could consume a witness authority topology without proving the latest authority transition was admitted.
- Before v182, a supplied topology could authorize the witness certificate that made a storage mutation authorization admissible without proving the topology's own admission path.
- Before v182, no replay object bound guard-admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v182: genesis/bootstrap authority for the first guard-admission witness-authority transition, separate witness/finality for the transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime database trigger adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state storage mutation guard authorization admission witness authority-transition admission.

Problem it solves: prevents storage mutation guard authorization admission witness authority topology from becoming operational mutation authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: Clark-Wilson integrity, Sandhu transaction-control expressions, RBAC separation of duty, dynamic Byzantine quorum systems, and reconfigurable heterogeneous quorum systems.

Mechanism borrowed: protected transactions carry relevant authorization history, and authority reconfiguration is itself admitted state. The current guard-admission witness authority must derive from admitted transition history; post-bootstrap changes must be certified by prior admissible authority rather than by the proposed new topology.

Why current substrate lacked it: v172 bound guard-admission witness certificates to replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: guard authorization records, authorization-admission records, witness records, and topology-bound witness certificates constrain mutation evidence, but not the authority-transition ledger that defines which witnesses exist. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict storage mutation guard evaluation can consume a guard-admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each guard-admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap guard-admission witness authority changes are counted against the previous replayed storage mutation guard authorization admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied guard witness topology, stale local guard-admission witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and protected mutation authorized by unadmitted guard witness-authority transition history.

Minimal implementation slice: add guard-admission witness authority-transition admission record/replay types, deterministic hashes, strict witness replay/evaluation flags, migration `0099`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict guard evaluation passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct protected mutation recovery from admitted guard witness authority transitions, Axis A finance pruning/delete flows attempting stale witness topology, and Axis B/domain adapters attempting to supply local guard witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- A storage mutation guard authorization admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict guard evaluation.
- Strict storage mutation guard evaluation must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a storage mutation guard authorization admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only guard-admission witness authority-transition rows are enough to constitute operational mutation authority.
- Falsified: a topology object supplied to witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial guard-admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for guard-admission witness authority-transition admissions.
- Extended storage mutation guard authorization admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended storage mutation guard evaluation with authorization-admission witness authority transition-admission strictness.
- Added storage mutation guard issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0099_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm exec vitest run packages/agent-state/src/index.test.ts` (194 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (598 passed, 143 skipped)

Outcome: SQ129 is closed. SQ130 is now the active next substrate question, with SQ139 added as new storage mutation guard authorization admission witness authority-transition admission-record accountability pressure.

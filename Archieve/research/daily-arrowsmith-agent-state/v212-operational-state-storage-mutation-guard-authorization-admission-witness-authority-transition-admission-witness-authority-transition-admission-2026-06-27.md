# v212 Operational State Storage Mutation Guard Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ159
Research lane: substrate discovery, protected mutation authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v152 adds storage mutation guard authorization admission records so protected-table mutation authorization rows must replay as latest procedure/role-scoped admitted transitions.
- v162 adds storage mutation guard authorization admission witness records so guard-admission rows are witnessed by a separate hash-linked ledger.
- v172 adds storage mutation guard authorization admission witness authority topology so guard-admission witness certificates bind to replayed principals and thresholds.
- v182 adds storage mutation guard authorization admission witness authority-transition admission so guard-admission witness topology rows replay from admitted authority-transition history.
- v192 adds storage mutation guard authorization admission witness authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v202 adds storage mutation guard transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0119` persists storage mutation guard transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict storage mutation guard evaluation could require transition-admission witness certificates to bind to a replayed nested witness topology, but that nested witness topology could still be supplied as a direct topology object. That meant a local snapshot, connector cache, or agent memory could make protected mutation authority appear accountable without proving the nested topology that authorized transition-admission witness certificates was itself admitted.

The missing substrate primitive is storage mutation guard transition-admission witness authority-transition admission: the topology that authorizes storage mutation guard authorization admission witness authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates before protected UPDATE/DELETE can be authorized.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become protected-mutation failures when an agent resumes from remembered storage-guard witness topology, especially when that topology controls who can certify guard-authorization authority changes.

B bridge: database integrity-control and Clark-Wilson-style commercial integrity separate direct user/application behavior from certified, well-formed transaction authority. Protected data changes are operational only when mediated by admitted constraints, certified procedures, and auditable transition records; direct application/local-state claims do not authorize mutation.

C literature:

- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies", https://ieeexplore.ieee.org/document/6234890
- Grefen and Apers, "Integrity control in relational database systems: An overview", https://ris.utwente.nl/ws/files/6690928/Grefen93integrity.pdf
- Deng, Frankl, and Chays, "Testing Database Transaction Consistency", https://cse.engineering.nyu.edu/tr/tr-cis-2003-04.pdf
- Martin and Alvisi, "A Framework for Dynamic Byzantine Storage", https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf

Mechanism extracted: protected mutation cannot be authorized by a private or ad hoc representation of who may certify the mutation guard. The authority topology used by guard transition-admission witness certificates must itself be an admitted transition-history projection, and strict mutation evaluation must recursively inspect that nested proof instead of trusting a higher-level replay summary.

## Primitive Proposal

Name: storage mutation guard transition-admission witness authority-transition admission.

Problem it solves: storage mutation guard authorization admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: Clark-Wilson integrity, relational database integrity control, database transaction consistency testing, and dynamic Byzantine storage.

Mechanism borrowed or adapted: strict protected-mutation evaluation accepts a nested transition-admission witness topology only if an admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction even when a higher-level replay object claims validity.

Why current substrate lacks it: v202 made nested witness certificates topology-bound, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: storage mutation guard authorizations, guard-authorization admissions, guard-admission witness records, guard-admission witness authority topology, admitted guard-admission witness authority transitions, guard witness-authority transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict storage mutation guard evaluation cannot authorize protected UPDATE/DELETE through nested transition-admission witness certificates unless their witness-authority topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; storage mutation guard witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; guard authorization admission witness replay and guard evaluation can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Storage mutation guard evaluation re-inspects nested replay data so a forged valid-looking witness replay cannot hide missing nested history.

Authority boundary it requires: nested storage mutation guard transition-admission witness authority-transition admissions use `operational_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes storage mutation guard transition-admission witness certificates.
- An amnesiac agent resumes from remembered nested witness membership rather than admitted transition history.
- A connector cache supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking guard-authorization witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash before protected mutation.

Minimal implementation slice:

- Add nested authority-transition admission replay support to storage mutation guard transition-admission witness replay.
- Add strict nested replay checks to storage mutation guard witness-authority transition-admission replay.
- Carry strict nested history requirements through guard authorization admission witness replay and storage mutation guard evaluation.
- Add missing/invalid/mismatch issue codes for storage mutation guard transition-admission witness authority-transition admission.
- Add migration `0129_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, guard witness replay refusal, and forged valid-looking guard evaluation refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateStorageMutationGuard({ requireAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Protected storage mutation is accepted when the storage-guard nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateStorageMutationGuardEvaluationInput.requireAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched storage mutation guard transition-admission witness authority-transition admission replay.
- Migration `0129_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance pruning transactions to prove storage-guard nested transition-admission witness authority through admitted topology-transition history before physical mutation.
- Axis B can require the same nested admitted topology history before domain adapters execute protected deletion/update paths.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached storage-guard nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
8. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
9. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
10. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?

## Failed Assumption Ledger

- Failed assumption: topology-bound storage mutation guard transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking storage-guard witness replay can be trusted once its top-level `valid` field is true. It cannot; storage mutation guard evaluation must inspect nested required replay fields recursively.

## Proof Status

Verification passed:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "storage mutation guard admission witness authority-transition admission witness certificates"`: 1 passed, 225 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "storage mutation guard admission witness authority-transition admission"`: 3 passed, 223 skipped
- `pnpm typecheck`
- `pnpm test`: 630 passed, 143 skipped
- `git diff --check`

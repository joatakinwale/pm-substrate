# v192 Operational State Storage Mutation Guard Authorization Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ139
Research lane: substrate discovery, storage integrity, authority-scoped transition admission

## Question

What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v142 adds storage mutation guards so protected operational-state tables can reject out-of-band UPDATE/DELETE unless a tombstone-derived authorization is present.
- v152 adds storage mutation guard authorization admission records so a guard authorization must replay from an admitted procedure/role history.
- v162 adds guard authorization admission witness records so the latest guard-admission row must be separately quorum-certified by a witness ledger.
- v172 adds guard-admission witness authority topology so guard witness certificates bind to replayed active principals and quorum thresholds.
- v182 adds guard-admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- Migration `0099` persists the admitted storage mutation guard authorization admission witness authority-transition rows.

## Missing Substrate Map

The storage guard lane protected physical mutation, but the v182 authority-transition admission row could still be its own accountability envelope. A strict guard evaluation could require authority topology to come from admitted transition history, while the transition-admission history itself could be supplied as certificate-local rows with no separate replayed witness history over the exact admission record hash.

Because this lane gates actual storage deletion/update, the missing primitive is stronger than a policy-currentness refinement. A protected mutation must not be authorized by a local row that merely contains a valid-looking certificate. It needs a separate append-only witness ledger proving that the exact guard-admission witness authority-transition admission record was itself admitted into accountable history.

## Arrowsmith Bridge

A literature: direct storage mutation and stale authorization are the agent-state version of uncontrolled writes to constrained data.

B bridge: Clark-Wilson separates well-formed transformations from direct data mutation, and requires separation of duty and audit. PeerReview and append-only authenticated logs add the distributed accountability mechanism: a tamper-evident record links actions to actors and supports replayable audit.

C literature:

- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies" (IEEE S&P 1987), https://doi.ieeecomputersociety.org/10.1109/SP.1987.10001
- Sandhu, "Transaction Control Expressions for Separation of Duties" (ACSAC 1988), https://profsandhu.com/confrnc/acsac/a88tce%28org%29.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Maniatis and Baker, "Transparency Logs via Append-Only Authenticated Dictionaries" (CCS 2019), https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf

Mechanism extracted: for constrained mutation, authority is not a permission-looking row. It is the replay of a well-formed admission procedure plus an accountable witness history over each sensitive transition that changes who can certify future guarded mutation authority.

## Primitive Proposal

Name: operational state storage mutation guard authorization admission witness authority-transition admission witness records.

Problem it solves: storage mutation guard authorization admission witness authority-transition admission rows could be accepted from local state if their embedded certificates were structurally valid.

Research source: Clark-Wilson integrity, transaction-control separation of duty, PeerReview accountability, and append-only authenticated transparency logs.

Mechanism borrowed or adapted: well-formed transaction authority plus independent accountable audit. The substrate adaptation is a hash-linked witness ledger over guard-admission witness authority-transition admission record hashes.

Why current substrate lacks it: v182 admitted guard-admission witness authority topology transitions but did not require a separate replayed witness ledger over each transition-admission row.

Why existing primitives are insufficient: storage mutation guard admission, admission witness, witness topology, and transition-admission replay prove increasingly strong history, but none of them separately witness the exact transition-admission row hash.

State guarantee it should create: strict storage mutation guard evaluation cannot treat a guard-admission witness authority-transition admission row as operational mutation authority unless the latest required transition-admission record hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission record to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- A local database row presents certificate-shaped guard-admission witness authority transitions as current mutation authority.
- A connector cache supplies a transition-admission row without a separate witnessed record hash.
- A forged witness certificate signs a different guard transition-admission hash.
- Strict guard evaluation consumes a witness-authority transition replay that lacks the transition-admission witness layer.
- Protected mutation proceeds when the guard authority chain is certificate-local rather than admitted and witnessed.

Minimal implementation slice:

- Add `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend guard-admission witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend guard authorization admission witness replay and storage mutation guard evaluation with transition-admission witness strictness.
- Add migration `0109_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_records.sql`.
- Add a focused falsification test for valid witnessed rows, missing witness replay, forged valid-looking missing nested witness replay, and wrong witness certificate subject.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A guard-admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A guard authorization admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. A storage mutation guard evaluation with `requireAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. A protected mutation evaluation that passes when strict guard transition-admission witness accountability is missing.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on guard-admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on guard authorization admission witness replay
- `requireAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitness` on storage mutation guard evaluation
- Migration `0109_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require witnessed guard transition-admission replay before finance pruning deletes or updates operational rows.
- Axis B can use the same strict guard for future marketing/domain-adapter stores.
- Axis C can simulate an amnesiac local agent attempting protected mutation from cached guard authority rows without the witnessed transition-admission ledger.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: a storage mutation guard authority-transition admission row can carry enough certificate evidence inside itself to authorize protected mutation. It cannot; the row must be separately witnessed.
- Failed assumption: transition-admission accountability has the same risk in all lanes. In the storage guard lane it is more direct, because a missing witness layer can authorize physical mutation.

## Proof Status

Focused verification passed:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "storage mutation guard admission witness authority"`: 3 passed, 207 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 614 passed, 143 skipped

# v202 Operational State Storage Mutation Guard Authorization Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ149
Research lane: substrate discovery, protected mutation authority, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v142 adds the storage mutation guard so physical protected-store mutation requires replay-derived authorization.
- v152 adds storage mutation guard authorization admissions so guard authorizations must replay through admitted authorization history.
- v162 adds storage mutation guard authorization admission witness records so the latest authorization-admission row must be separately quorum-certified.
- v172 adds storage mutation guard authorization admission witness authority topology so authorization-admission witness certificates bind to replayed active principals and thresholds.
- v182 adds storage mutation guard authorization admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- v192 adds storage mutation guard authorization admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0109` persists storage mutation guard authorization admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict storage mutation guard evaluation could require witnessed authority-transition admission history, but the certificates inside that witness ledger still named accepted witnesses locally. That left the nested transition-admission witness certificate's signer set as certificate-local representation instead of replayed operational authority.

This left a mutation-authority leak: an amnesiac agent or connector could accept a cached storage mutation guard transition-admission witness certificate whose `acceptedWitnessIds` were not backed by replayed topology state, then let that certificate authorize protected storage mutation.

The missing substrate primitive is a storage mutation guard transition-admission witness authority topology: witness certificates for storage mutation guard authorization admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: storage mutation failures, stale authorization artifacts, and tool/cache drift become operational-state failures when mutation authority can be inferred from private certificate payloads.

B bridge: Clark-Wilson-style integrity models route mutation through well-formed transactions; transaction-control expressions make separation-of-duty depend on transaction history; dynamic Byzantine quorum systems make signer membership and resilience thresholds explicit state rather than local operation metadata.

C literature:

- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies" (IEEE Symposium on Security and Privacy 1987), https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db
- Sandhu, "Transaction Control Expressions for Separation of Duties" (ACSAC 1988), https://profsandhu.com/confrnc/acsac/a88tce%28org%29.pdf
- Alvisi, Pierce, Malkhi, Reiter, and Wright, "Dynamic Byzantine Quorum Systems" (DSN 2000), https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

Mechanism extracted: mutation authority is not a local permission bit; it is a replayable transaction path whose control context and quorum membership must also replay. For pm-substrate, the proof context is authority-scoped topology history plus unique active topology principals satisfying quorum.

## Primitive Proposal

Name: storage mutation guard transition-admission witness authority topology.

Problem it solves: storage mutation guard authorization admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: Clark-Wilson integrity policy, Sandhu transaction control expressions, and dynamic Byzantine quorum systems.

Mechanism borrowed or adapted: protected mutation must occur through a well-formed transaction path, and the signer quorum for that path must be derived from replayed membership state rather than from the operation's own local evidence.

Why current substrate lacks it: v192 replayed a witness ledger over exact transition-admission record hashes, but did not bind the witness certificates' accepted witness ids to a replayed topology.

Why existing primitives are insufficient: storage mutation guards, authorization admissions, admission witnesses, witness-authority topology, admitted topology transitions, and transition-admission witness records each narrow mutation authority, but none made the transition-admission witness certificates' signer set accountable.

State guarantee it should create: strict protected storage mutation cannot consume storage mutation guard authorization admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; storage mutation guard authorization admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; storage mutation guard evaluation can require `requireAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: witness certificates must use `operational_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate storage mutation guard transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes protected storage mutation.
- Duplicate witness ids satisfy mutation guard transition-admission witness quorum.
- Unknown or suspended witness ids satisfy mutation guard transition-admission witness quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Storage mutation guard evaluation accepts a forged valid-looking replay whose nested transition-admission witness certificates lack topology-bound authority.

Minimal implementation slice:

- Extend storage mutation guard transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend storage mutation guard witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend storage mutation guard authorization admission witness replay and storage mutation guard evaluation with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0119_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStateStorageMutationGuard({ requireAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with guard-admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateStorageMutationGuardEvaluationInput.requireAuthorizationAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested storage mutation guard transition-admission witness topology issue codes and quorum checks.
- Migration `0119_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound storage mutation guard transition-admission witness certificates before finance recovery stores can be physically pruned.
- Axis B can require the same nested topology proof for future domain-adapter mutation guards.
- Axis C can simulate an amnesiac local agent attempting to resume from cached storage mutation guard transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked storage mutation guard transition-admission witness ledger is enough accountability for protected mutation authority. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: mutation authorization certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "storage mutation guard admission witness authority-transition admission"`: 3 passed, 217 skipped
- `pnpm typecheck`
- `pnpm test`: 624 passed, 143 skipped
- `git diff --check`

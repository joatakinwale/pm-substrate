# v201 Operational State Pruning-Policy Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ148
Research lane: substrate discovery, pruning policy recovery, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v141 adds the pruning-policy compiler so recovered operational state can declare durable pruning obligations.
- v151 adds pruning-policy admission records so compiled policies must replay through admitted policy history.
- v161 adds pruning-policy admission witness records so the latest policy-admission row must be separately quorum-certified.
- v171 adds pruning-policy admission witness authority topology so policy-admission witness certificates bind to replayed active principals and thresholds.
- v181 adds pruning-policy admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- v191 adds pruning-policy admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0108` persists pruning-policy admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict pruning-policy admission could require witnessed authority-transition admission history, but the certificates inside that witness ledger still named accepted witnesses locally. That left the nested transition-admission witness certificate's signer set as certificate-local representation instead of replayed operational authority.

This left a policy-authority leak: an amnesiac agent could accept a cached or summarized pruning-policy transition-admission witness certificate whose `acceptedWitnessIds` were not backed by replayed topology state, then let that certificate authorize policy recovery.

The missing substrate primitive is a pruning-policy transition-admission witness authority topology: witness certificates for pruning-policy admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: stale policy observations and memory drift become operational-state failures when local authorization artifacts are accepted without replayed policy authority.

B bridge: proof-carrying authorization makes authorization a checkable proof rather than an implicit claim; decentralized authorization languages separate policy credentials from the query being authorized; Byzantine quorum systems separate signer membership and thresholds from any single operation.

C literature:

- Appel and Felten, "Proof-Carrying Authentication" (ACM CCS 1999), https://www.cs.princeton.edu/~appel/papers/says.pdf
- Becker, Fournet, and Gordon, "Design and Semantics of a Decentralized Authorization Language" (CSF 2007 / SecPAL), https://people.mpi-sws.org/~dg/teaching/lis2014/modules/authorization-1-becker07.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems" (Distributed Computing 1998), https://link.springer.com/article/10.1007/s004460050050

Mechanism extracted: an authorization certificate is admissible only when its proof context is itself replayable. For pm-substrate, the proof context is authority-scoped topology history plus unique active topology principals satisfying quorum.

## Primitive Proposal

Name: pruning-policy transition-admission witness authority topology.

Problem it solves: pruning-policy admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: proof-carrying authentication, decentralized authorization language semantics, and Byzantine quorum systems.

Mechanism borrowed or adapted: authorization evidence must be checked against independently replayed credentials and quorum membership before it can authorize current state.

Why current substrate lacks it: v191 replayed a witness ledger over exact transition-admission record hashes, but did not bind the witness certificates' accepted witness ids to a replayed topology.

Why existing primitives are insufficient: pruning-policy compilation, admission records, admission witnesses, witness-authority topology, admitted topology transitions, and transition-admission witness records each narrow the policy boundary, but none made the transition-admission witness certificates' signer set accountable.

State guarantee it should create: strict recovered operational state cannot consume pruning-policy admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; pruning-policy admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; pruning-policy admission evaluation and action review can require `requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: witness certificates must use `operational_state_pruning_policy_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_pruning_policy_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate pruning-policy transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes pruning-policy admission witness authority-transition admission state.
- Duplicate witness ids satisfy quorum.
- Unknown or suspended witness ids satisfy quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Blocking action review accepts recovered state whose pruning-policy nested transition-admission witness certificate lacks topology-bound authority.

Minimal implementation slice:

- Extend pruning-policy transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend pruning-policy witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend pruning-policy admission witness replay, pruning-policy admission evaluation, and action review with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0118_agent_state_pruning_policy_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStatePruningPolicyAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStatePruningPolicyAdmission({ requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with policy-admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.
7. Blocking action review accepts recovered state when pruning-policy nested transition-admission witness authority is absent or certificate-local.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStatePruningPolicyAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStatePruningPolicyAdmissionEvaluationInput.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `ActionProposalReviewOptions.requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested pruning-policy transition-admission witness topology issue codes and quorum checks.
- Migration `0118_agent_state_pruning_policy_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound pruning-policy transition-admission witness certificates before finance recovery policies authorize action.
- Axis B can require the same nested topology proof for future domain-adapter pruning-policy admissions.
- Axis C can simulate an amnesiac local agent attempting to resume from cached pruning-policy transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked pruning-policy transition-admission witness ledger is enough accountability for policy admission authority. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: policy authorization certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "pruning policy admission witness authority-transition admission"`: 3 passed, 216 skipped
- `pnpm typecheck`
- `pnpm test`: 623 passed, 143 skipped
- `git diff --check`

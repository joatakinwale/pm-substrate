# v211 Operational State Pruning-Policy Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ158
Research lane: substrate discovery, pruning-policy authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v151 adds pruning-policy admission records so compiled pruning policies must replay as latest admitted policy artifacts.
- v161 adds pruning-policy admission witness records so policy-admission rows are witnessed by a separate hash-linked ledger.
- v171 adds pruning-policy admission witness authority topology so policy witness certificates bind to replayed principals and thresholds.
- v181 adds pruning-policy admission witness authority-transition admission so policy witness topology rows replay from admitted authority-transition history.
- v191 adds pruning-policy admission witness authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v201 adds pruning-policy transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0118` persists pruning-policy transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict pruning-policy admission could require transition-admission witness certificates to bind to a replayed nested witness topology, but that nested witness topology could still be supplied as a direct topology object. That meant a local snapshot, connector cache, worktree fixture, or agent memory could make a certificate witness set appear authoritative without proving the witness-authority topology was itself admitted.

The missing substrate primitive is pruning-policy transition-admission witness authority-transition admission: the topology that authorizes pruning-policy admission witness authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates before a pruning policy can authorize recovered operational state.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become policy-authority failures when an agent resumes from a remembered pruning-policy witness topology, especially when that topology controls whether policy-admission authority changes are accountable.

B bridge: proof-carrying authorization and distributed reconfiguration both refuse direct policy/configuration claims. Authorization is a derivation from admitted credentials or policy statements, and current membership is a projection of admitted reconfiguration history.

C literature:

- Appel and Felten, "Proof-Carrying Authentication", https://www.cs.princeton.edu/~appel/papers/says.pdf
- Becker, Fournet, and Gordon, "SecPAL: Design and Semantics of a Decentralized Authorization Language", https://www.microsoft.com/en-us/research/wp-content/uploads/2010/01/jcs-final.pdf
- Halpern and van der Meyden, "A Logical Reconstruction of SPKI", https://theory.stanford.edu/people/jcm/papers/sem_spki_j.pdf
- Clarke et al., "Certificate Chain Discovery in SPKI/SDSI", https://people.csail.mit.edu/rivest/pubs/CEEFx01.pdf

Mechanism extracted: a policy-authority witness topology is not operational authority because it is internally well-formed or certificate-bound. It becomes operational authority only when it is derivable from admitted authority-transition history under the relevant authority boundary. Strict pruning-policy admission must inspect nested witness-authority history recursively instead of trusting higher-level replay summaries or direct topology rows.

## Primitive Proposal

Name: pruning-policy transition-admission witness authority-transition admission.

Problem it solves: pruning-policy admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: Proof-Carrying Authentication, SecPAL, SPKI/SDSI logic and certificate-chain discovery.

Mechanism borrowed or adapted: strict pruning-policy admission accepts a nested transition-admission witness topology only if an admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction even when a higher-level replay object claims validity.

Why current substrate lacks it: v201 made nested witness certificates topology-bound, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: pruning-policy admission records, pruning-policy admission witness records, pruning-policy witness authority topology, admitted pruning-policy witness authority transitions, pruning-policy witness-authority transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict pruning-policy admission cannot consume nested transition-admission witness certificates unless their witness-authority topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; pruning-policy witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; pruning-policy admission witness replay, pruning-policy admission evaluation, and blocking action review can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Pruning-policy admission re-inspects nested replay data so a forged valid-looking witness replay cannot hide missing nested history.

Authority boundary it requires: nested pruning-policy transition-admission witness authority-transition admissions use `operational_state_pruning_policy_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_pruning_policy_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes pruning-policy transition-admission witness certificates.
- An amnesiac agent resumes from remembered nested witness membership rather than admitted transition history.
- A connector cache supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking pruning-policy witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash.

Minimal implementation slice:

- Add nested authority-transition admission replay support to pruning-policy transition-admission witness replay.
- Add strict nested replay checks to pruning-policy witness-authority transition-admission replay.
- Carry strict nested history requirements through pruning-policy admission witness replay, pruning-policy admission evaluation, and blocking action review.
- Add missing/invalid/mismatch issue codes for pruning-policy transition-admission witness authority-transition admission.
- Add migration `0128_agent_state_pruning_policy_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, pruning-policy witness replay refusal, and forged valid-looking admission refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStatePruningPolicyAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStatePruningPolicyAdmission({ requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Blocking action review accepts a recovered current-state view when the pruning-policy nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStatePruningPolicyAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStatePruningPolicyAdmissionEvaluationInput.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `ActionProposalReviewOptions.requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched pruning-policy transition-admission witness authority-transition admission replay.
- Migration `0128_agent_state_pruning_policy_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance pruning-policy recovery to prove nested transition-admission witness authority through admitted topology-transition history before accepting recovered state.
- Axis B can require the same nested admitted topology history before domain adapters consume pruning-policy admission.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached pruning-policy nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
9. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
10. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?

## Failed Assumption Ledger

- Failed assumption: topology-bound pruning-policy transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking pruning-policy witness replay can be trusted once its top-level `valid` field is true. It cannot; pruning-policy admission must inspect nested required replay fields recursively.

## Proof Status

Verification passed:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "pruning policy admission witness authority-transition admission witness certificates"`: 1 passed, 225 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "pruning policy admission witness authority-transition admission"`: 3 passed, 223 skipped
- `pnpm typecheck`
- `pnpm test`: 630 passed, 143 skipped
- `git diff --check`

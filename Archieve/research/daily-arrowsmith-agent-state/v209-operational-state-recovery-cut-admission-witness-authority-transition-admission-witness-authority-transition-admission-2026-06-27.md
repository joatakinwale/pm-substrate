# v209 Operational State Recovery-Cut Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ156
Research lane: substrate discovery, recovery-cut authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v149 adds recovery-cut admission records so a recovered current-state cut must be admitted through replayed history.
- v159 adds recovery-cut admission witness records so admission rows cannot self-authorize.
- v169 adds recovery-cut admission witness authority topology so recovery-cut admission witness certificates bind to replayed principals and thresholds.
- v179 adds recovery-cut admission witness authority-transition admission records so recovery-cut witness topology rows replay from admitted authority-transition history.
- v189 adds recovery-cut admission witness authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v199 adds recovery-cut transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0116` persists recovery-cut transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict recovery-cut admission could require nested transition-admission witness certificates to bind to a replayed topology, but that nested witness topology itself could still be supplied as a direct topology row set. That left a gap: an agent, adapter, or connector cache could present a coherent nested witness topology object and make certificate signer membership look operational without proving that the topology was admitted through replayed transition history.

The missing substrate primitive is recovery-cut transition-admission witness authority-transition admission: the topology that authorizes recovery-cut admission witness authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become recovery failures when an agent resumes from a locally remembered or summarized witness-authority topology that did not replay from admitted history.

B bridge: reconfiguration protocols separate current operational authority from proposed or locally supplied membership. A new authority configuration becomes effective only through admitted/logged transition history, often with quorum overlap or a master-controlled configuration sequence.

C literature:

- Malkhi and Reiter, "Byzantine Quorum Systems" and Dynamic Byzantine Quorum Systems follow-on work, https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication" (PODC 2009), https://www.microsoft.com/en-us/research/wp-content/uploads/2009/05/podc09v6.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited" (2012), https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" / Raft joint consensus, https://raft.github.io/raft.pdf

Mechanism extracted: a configuration or witness roster is not operational authority merely because it is internally well-formed. It becomes operational authority only when it is the replayed projection of admitted configuration-transition history under an authority boundary. Local representation of a topology must be subordinate to the admitted transition log.

## Primitive Proposal

Name: recovery-cut transition-admission witness authority-transition admission.

Problem it solves: recovery-cut transition-admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: Dynamic Byzantine Quorum Systems, Vertical Paxos, Viewstamped Replication recovery/reconfiguration, and Raft joint consensus.

Mechanism borrowed or adapted: a nested witness topology is accepted only if the latest admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction.

Why current substrate lacks it: v199 replayed and checked nested witness topology, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: recovery-cut admission, recovery-cut admission witnesses, witness authority topology, admitted witness-authority transitions, transition-admission witness records, and transition-admission witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict recovery-cut admission cannot consume nested transition-admission witness certificates unless their witness-authority topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; recovery-cut witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; recovery-cut witness replay and recovery-cut admission evaluation can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. A forged valid-looking higher-level replay is still inspected recursively for missing nested history.

Authority boundary it requires: nested recovery-cut transition-admission witness authority-transition admissions use `operational_state_recovery_cut_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_recovery_cut_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes recovery-cut transition-admission witness certificates.
- An agent resumes from remembered nested witness membership rather than admitted transition history.
- A connector cache supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking recovery-cut witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash.

Minimal implementation slice:

- Add nested authority-transition admission replay support to recovery-cut transition-admission witness replay.
- Add strict nested replay checks to recovery-cut witness-authority transition-admission replay.
- Carry strict nested history requirements through recovery-cut witness replay, recovery-cut admission evaluation, and blocking action review.
- Add missing/invalid/mismatch issue codes for recovery-cut transition-admission witness authority-transition admission.
- Add migration `0126_agent_state_recovery_cut_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, recovery-cut witness replay refusal, and forged valid-looking replay refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateRecoveryCutAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateRecoveryCutAdmission({ requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Blocking action review accepts a recovered current-state view when the nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateRecoveryCutAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateRecoveryCutAdmissionEvaluationInput.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `ActionProposalReviewOptions.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched recovery-cut transition-admission witness authority-transition admission replay.
- Migration `0126_agent_state_recovery_cut_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance recovery cuts to prove nested transition-admission witness authority through admitted topology-transition history before accepting recovered state.
- Axis B can require the same nested admitted topology history before domain adapters consume recovery-cut authority.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?

## Failed Assumption Ledger

- Failed assumption: topology-bound recovery-cut transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a well-formed nested witness topology object is operational authority. It is only a representation unless admitted transition history projects it.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "recovery cut admission witness authority-transition admission witness certificates"`: 1 passed, 225 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "recovery cut admission witness authority-transition admission"`: 3 passed, 223 skipped
- `pnpm typecheck`
- `pnpm test`: 630 passed, 143 skipped
- `git diff --check`

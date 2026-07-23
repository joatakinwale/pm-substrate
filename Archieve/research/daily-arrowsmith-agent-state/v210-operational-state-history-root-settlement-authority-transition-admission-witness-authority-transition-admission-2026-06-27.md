# v210 Operational State History-Root Settlement Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ157
Research lane: substrate discovery, history-root settlement authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v160 adds history-root settlement records so a witnessed store root can bless strict recovery only after quorum-certified settlement.
- v170 adds history-root settlement authority topology so settlement certificates bind to replayed principals and thresholds.
- v180 adds history-root settlement authority-transition admission so settlement authority topology rows replay from admitted authority-transition history.
- v190 adds history-root settlement authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v200 adds history-root settlement transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0117` persists history-root settlement transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict recovery transparency could require history-root settlement authority-transition admission witness certificates to bind to a replayed nested witness topology, but that nested witness topology could still be supplied as a direct topology object. That meant a local snapshot, connector cache, or agent memory could make a certificate witness set appear authoritative without proving the witness-authority topology was itself admitted.

The missing substrate primitive is history-root settlement transition-admission witness authority-transition admission: the topology that authorizes history-root settlement authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates before recovery transparency can authorize operational state.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become recovery-root failures when an agent resumes from a remembered settlement witness topology, especially when the topology controls whether history-root settlement authority changes are accountable.

B bridge: reconfiguration protocols treat membership/current authority as state-machine history, not as a free-standing representation. A supplied configuration is only operational if it is the current projection of admitted configuration-transition history.

C literature:

- Malkhi and Reiter, "Dynamic Byzantine Quorum Systems", https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", https://www.microsoft.com/en-us/research/wp-content/uploads/2009/05/podc09v6.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", https://raft.github.io/raft.pdf

Mechanism extracted: a witness topology is not operational authority because it is internally well-formed or certificate-bound. It becomes operational authority only when it is the latest admissible projection of a replayed authority-transition log under the relevant authority boundary. Recovery transparency must inspect nested witness-authority history recursively instead of trusting higher-level replay summaries.

## Primitive Proposal

Name: history-root settlement transition-admission witness authority-transition admission.

Problem it solves: history-root settlement authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: Dynamic Byzantine Quorum Systems, Vertical Paxos, Viewstamped Replication recovery/reconfiguration, and Raft joint consensus.

Mechanism borrowed or adapted: strict recovery transparency accepts a nested settlement transition-admission witness topology only if an admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction even when a higher-level replay object claims validity.

Why current substrate lacks it: v200 made nested witness certificates topology-bound, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: root settlement records, settlement authority topology, admitted settlement authority transitions, settlement authority-transition admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict history-root settlement recovery transparency cannot consume nested transition-admission witness certificates unless their witness-authority topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; history-root settlement witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; root-settlement replay and recovery transparency can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Recovery transparency re-inspects nested replay data so a forged valid-looking root-settlement replay cannot hide missing nested history.

Authority boundary it requires: nested history-root settlement transition-admission witness authority-transition admissions use `operational_state_history_root_settlement_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_history_root_settlement_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes history-root settlement transition-admission witness certificates.
- An amnesiac agent resumes from remembered nested witness membership rather than admitted transition history.
- A connector cache supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking root-settlement replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash.

Minimal implementation slice:

- Add nested authority-transition admission replay support to history-root settlement transition-admission witness replay.
- Add strict nested replay checks to history-root settlement witness-authority transition-admission replay.
- Carry strict nested history requirements through root-settlement replay, recovery transparency, and blocking action review.
- Add missing/invalid/mismatch issue codes for history-root settlement transition-admission witness authority-transition admission.
- Add migration `0127_agent_state_history_root_settlement_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, root-settlement replay refusal, and forged valid-looking recovery transparency refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateHistoryRootSettlementRecords({ requireSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateRecoveryCutTransparency({ requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking root-settlement replay hiding missing nested topology-transition admission history.
6. Blocking action review accepts a recovered current-state view when the history-root settlement nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateHistoryRootSettlementReplayInput.requireSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateRecoveryCutTransparencyEvaluationInput.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `ActionProposalReviewOptions.requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched history-root settlement transition-admission witness authority-transition admission replay.
- Migration `0127_agent_state_history_root_settlement_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance recovery roots to prove history-root settlement nested transition-admission witness authority through admitted topology-transition history before accepting recovered state.
- Axis B can require the same nested admitted topology history before domain adapters consume recovery transparency.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached history-root settlement nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
10. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?

## Failed Assumption Ledger

- Failed assumption: topology-bound history-root settlement transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking root-settlement replay can be trusted once its top-level `valid` field is true. It cannot; recovery transparency must inspect nested required replay fields recursively.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "history-root settlement authority-transition admission witness certificates"`: 1 passed, 225 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "history-root settlement authority-transition admission"`: 3 passed, 223 skipped
- `pnpm typecheck`
- `pnpm test`: 630 passed, 143 skipped
- `git diff --check`

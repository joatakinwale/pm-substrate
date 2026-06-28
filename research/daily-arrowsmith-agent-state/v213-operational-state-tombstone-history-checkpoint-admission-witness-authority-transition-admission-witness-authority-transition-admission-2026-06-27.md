# v213 Operational State Tombstone-History Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ160
Research lane: substrate discovery, compacted recovery authority, nested witness topology accountability

## Question

What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v143 adds tombstone-history compaction checkpoints so pruned tombstone history can recover currentness from checkpoint plus retained suffix.
- v153 adds checkpoint admission records so self-authored checkpoint seeds cannot authorize compacted recovery.
- v163 adds checkpoint admission witness records so checkpoint admissions require witness quorum accountability.
- v173 adds checkpoint admission witness authority topology so checkpoint-admission witness certificates bind to replayed principals and thresholds.
- v183 adds checkpoint admission witness authority-transition admission so checkpoint-admission witness topology rows replay from admitted authority-transition history.
- v193 adds checkpoint admission witness authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v203 adds tombstone-history transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0120` persists tombstone-history transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict tombstone-history compaction could require transition-admission witness certificates to bind to a replayed nested witness topology, but the nested topology itself could still be supplied as a direct representation. That meant an amnesiac agent, connector cache, or local snapshot could authorize compacted recovery by presenting a topology object for the witnesses that certified checkpoint-admission witness authority-transition admissions, without proving that topology was itself admitted transition history.

The missing substrate primitive is tombstone-history transition-admission witness authority-transition admission: the topology that authorizes tombstone-history checkpoint admission witness authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates before a compacted tombstone-history checkpoint can seed operational recovery.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become compacted-recovery failures when agents resume from remembered checkpoint witness topology, especially after pruning has removed the prefix that would otherwise make the state lineage obvious.

B bridge: stable checkpoint protocols and write-ahead recovery do not let a process-local checkpoint become state by assertion. PBFT stable checkpoints require quorum evidence, ARIES recovery starts from logged checkpoint metadata and repeats history, and reconfigurable Byzantine storage treats membership/topology as part of the recoverable protocol state rather than as local configuration.

C literature:

- Castro and Liskov, "Practical Byzantine Fault Tolerance", https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Mohan, Haderle, Lindsay, Pirahesh, and Schwarz, "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Martin and Alvisi, "A Framework for Dynamic Byzantine Storage", https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf

Mechanism extracted: compacted recovery is safe only when both checkpoint evidence and the authority topology that certified it are replay-derived. The substrate equivalent is recursive checkpoint authority accountability: a tombstone checkpoint cannot become operational recovery state through a nested witness topology unless that topology equals the current projection of admitted nested authority-transition history.

## Primitive Proposal

Name: tombstone-history transition-admission witness authority-transition admission.

Problem it solves: tombstone-history checkpoint admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: PBFT stable checkpoints, ARIES write-ahead recovery, Viewstamped Replication recovery/reconfiguration, and dynamic Byzantine storage.

Mechanism borrowed or adapted: strict compacted-recovery evaluation accepts a nested transition-admission witness topology only if admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction even when a higher-level replay object claims validity.

Why current substrate lacks it: v203 made nested witness certificates topology-bound, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: tombstone checkpoints, checkpoint admissions, checkpoint-admission witness records, checkpoint-admission witness authority topology, admitted checkpoint-admission witness authority transitions, transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict tombstone-history compaction cannot accept a compacted checkpoint as operational recovery state unless the nested transition-admission witness topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; tombstone checkpoint witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; checkpoint admission witness replay and tombstone compaction evaluation can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Tombstone compaction evaluation re-inspects nested replay data so a forged valid-looking witness replay cannot hide missing nested history.

Authority boundary it requires: nested tombstone-history transition-admission witness authority-transition admissions use `operational_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes tombstone-history checkpoint transition-admission witness certificates.
- An amnesiac agent resumes compacted recovery from remembered nested witness membership rather than admitted transition history.
- A connector cache supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking checkpoint-admission witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash before compacted recovery.

Minimal implementation slice:

- Add nested authority-transition admission replay support to tombstone-history transition-admission witness replay.
- Add strict nested replay checks to tombstone-history checkpoint witness-authority transition-admission replay.
- Carry strict nested history requirements through checkpoint admission witness replay and tombstone-history compaction evaluation.
- Add missing/invalid/mismatch issue codes for tombstone-history transition-admission witness authority-transition admission.
- Add migration `0130_agent_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, checkpoint witness replay refusal, and forged valid-looking compaction refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateTombstoneHistoryCompaction({ requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Compacted tombstone-history recovery is accepted when the nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateTombstoneHistoryCompactionEvaluationInput.requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched tombstone-history transition-admission witness authority-transition admission replay.
- Migration `0130_agent_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance pruning/tombstone compaction to prove nested transition-admission witness authority through admitted topology-transition history before accepting recovered checkpoint state.
- Axis B can require the same nested admitted topology history before domain adapters accept compacted tombstone-history recovery.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached tombstone checkpoint nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
7. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
8. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
9. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
10. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?

## Failed Assumption Ledger

- Failed assumption: topology-bound tombstone-history transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking tombstone checkpoint witness replay can be trusted once its top-level `valid` field is true. It cannot; tombstone-history compaction evaluation must inspect nested required replay fields recursively.

## Proof Status

Verification passed:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "tombstone-history checkpoint admission witness authority-transition admission witness certificates"`: 2 passed, 225 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "tombstone-history checkpoint admission witness authority-transition admission"`: 4 passed, 223 skipped
- `pnpm typecheck`
- `pnpm test`: 631 passed, 143 skipped
- `git diff --check`

# v203 Operational State Tombstone-History Checkpoint Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ150
Research lane: substrate discovery, compacted recovery authority, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v140 adds tombstone-history checkpoint admission witness authority-transition admission records so checkpoint-admission witness authority topology can replay from admitted authority-transition history.
- v150 adds tombstone-history checkpoint admission witness records so admitted compaction checkpoints must be separately quorum-certified.
- v170 adds tombstone-history checkpoint admission witness authority topology so checkpoint-admission witness certificates bind to replayed active principals and thresholds.
- v183 adds tombstone-history checkpoint admission witness authority-transition admission records so that witness topology can replay from admitted authority-transition history.
- v193 adds tombstone-history checkpoint admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0110` persists tombstone-history checkpoint admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict tombstone-history compaction could require witnessed authority-transition admission history, but the certificates inside that transition-admission witness ledger still named accepted witnesses locally. That left nested witness authority as certificate representation, not replayed operational authority.

This created a compacted-recovery leak: an amnesiac agent, adapter, or connector cache could present a tombstone-history checkpoint transition-admission witness certificate whose `acceptedWitnessIds` were not backed by replayed topology state, then let that certificate help authorize compacted recovery state.

The missing substrate primitive is a tombstone-history checkpoint transition-admission witness authority topology: witness certificates for tombstone-history checkpoint admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: compaction, checkpoint, and recovery failures become agent-state failures when a compacted checkpoint can be treated as current operational state without replaying who was authorized to certify the checkpoint's nested authority history.

B bridge: PBFT stable checkpoints make checkpoint correctness depend on signed quorum proof, ARIES makes restart state recoverable from logged history plus checkpoint metadata, and dynamic Byzantine quorum systems make quorum membership and thresholds state that must survive reconfiguration and stale clients.

C literature:

- Castro and Liskov, "Practical Byzantine Fault Tolerance" (OSDI 1999), https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" (ACM TODS 1992), https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Alvisi, Pierce, Malkhi, Reiter, and Wright, "Dynamic Byzantine Quorum Systems" (DSN 2000), https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

Mechanism extracted: compacted recovery authority is not the checkpoint artifact alone. It is a stable checkpoint proof plus replayable recovery history plus replayable signer membership for every certificate layer that lets the checkpoint become a seed for later projection.

## Primitive Proposal

Name: tombstone-history checkpoint transition-admission witness authority topology.

Problem it solves: tombstone-history checkpoint admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: PBFT stable checkpoint proofs, ARIES checkpoint/restart recovery, and dynamic Byzantine quorum systems.

Mechanism borrowed or adapted: a checkpoint can become a recovery seed only when its proof chain is replayable, and the signer quorum for that proof chain is derived from replayed membership state rather than from the operation's own local evidence.

Why current substrate lacks it: v193 replayed a witness ledger over exact transition-admission record hashes, but did not bind the witness certificates' accepted witness ids to a replayed topology.

Why existing primitives are insufficient: tombstone-history checkpoint admission, admission witnesses, witness-authority topology, admitted topology transitions, and transition-admission witness records each narrow compacted-recovery authority, but none made the transition-admission witness certificates' signer set accountable.

State guarantee it should create: strict tombstone-history compaction cannot consume checkpoint admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; checkpoint admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; tombstone-history compaction evaluation can require `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: witness certificates must use `operational_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate tombstone-history checkpoint transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes compacted tombstone-history recovery.
- Duplicate witness ids satisfy tombstone-history checkpoint transition-admission witness quorum.
- Unknown or suspended witness ids satisfy tombstone-history checkpoint transition-admission witness quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Tombstone-history compaction accepts a forged valid-looking replay whose nested transition-admission witness certificates lack topology-bound authority.

Minimal implementation slice:

- Extend tombstone-history checkpoint transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend tombstone-history checkpoint witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend checkpoint admission witness replay and tombstone-history compaction evaluation with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0120_agent_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStateTombstoneHistoryCompaction({ requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with checkpoint-admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateTombstoneHistoryCompactionEvaluationInput.requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested tombstone-history checkpoint transition-admission witness topology issue codes and quorum checks.
- Migration `0120_agent_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound tombstone-history checkpoint transition-admission witness certificates before finance recovery reads compacted tombstone-history state.
- Axis B can require the same nested topology proof before domain adapters resume from compacted checkpoint projections.
- Axis C can simulate an amnesiac local agent attempting to resume from cached tombstone-history checkpoint transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked tombstone-history checkpoint transition-admission witness ledger is enough accountability for compacted recovery authority. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: compacted-recovery certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "tombstone-history checkpoint admission witness authority-transition admission witness certificates"`: 1 passed, 220 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "tombstone-history checkpoint admission witness authority-transition admission"`: 3 passed, 218 skipped
- `pnpm typecheck`
- `pnpm test`: 625 passed, 143 skipped

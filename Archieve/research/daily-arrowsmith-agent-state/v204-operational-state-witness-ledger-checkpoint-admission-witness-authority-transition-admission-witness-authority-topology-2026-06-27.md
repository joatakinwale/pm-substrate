# v204 Operational State Witness-Ledger Checkpoint Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ151
Research lane: substrate discovery, compacted witness-ledger recovery authority, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v144 adds witness-ledger compaction checkpoints so accepted-head recovery can resume from compacted witness history.
- v154 adds witness-ledger checkpoint admission records so compaction checkpoints cannot be self-authored replay seeds.
- v164 adds witness-ledger checkpoint admission witness records so checkpoint-admission rows are witnessed by a separate ledger.
- v174 adds witness-ledger checkpoint admission witness authority topology so checkpoint-admission witness certificates bind to replayed principals and thresholds.
- v184 adds witness-ledger checkpoint admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- v194 adds witness-ledger checkpoint admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0111` persists witness-ledger checkpoint admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict witness-ledger compaction could require witnessed authority-transition admission history, but the certificates inside that transition-admission witness ledger still named accepted witnesses locally. That meant a compacted witness-ledger recovery path could still accept certificate representation as signer authority for the nested witness layer.

The missing substrate primitive is witness-ledger checkpoint transition-admission witness authority topology: certificates for witness-ledger checkpoint admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: agent memory drift and continuity breaks become operational-state failures when a compacted witness ledger can be resumed from a certificate whose signer set is private representation rather than admitted authority history.

B bridge: accountable distributed systems make faults actionable only through verifiable evidence tied to actors; witness cosigning makes authoritative statements acceptable only after validation by a witness set; Byzantine quorum systems make quorum membership and intersection part of the state guarantee, not local metadata.

C literature:

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities 'Honest or Bust' with Decentralized Witness Cosigning" (IEEE S&P 2016), https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems" (Distributed Computing), https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf

Mechanism extracted: witness certificates are operational only when their statement, signer set, signer eligibility, and quorum thresholds all replay from authority-scoped state. A local `acceptedWitnessIds` list is evidence to check, not authority to believe.

## Primitive Proposal

Name: witness-ledger checkpoint transition-admission witness authority topology.

Problem it solves: witness-ledger checkpoint admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: PeerReview accountability, CoSi witness cosigning, and Byzantine quorum systems.

Mechanism borrowed or adapted: accept a witness certificate only when the certificate is bound to a replayed authority topology and enough unique active topology principals signed the exact subject.

Why current substrate lacks it: v194 replayed a witness ledger over exact transition-admission record hashes, but did not bind that witness ledger's certificates to replayed signer topology.

Why existing primitives are insufficient: checkpoint admission, checkpoint admission witnesses, witness-authority topology, admitted witness-authority transitions, and witnessed transition-admission rows each narrow authority, but none made the transition-admission witness certificates' signer set replayable.

State guarantee it should create: strict witness-ledger compaction cannot consume checkpoint admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; checkpoint admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; witness-ledger compaction evaluation can require `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: witness certificates must use `operational_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate witness-ledger checkpoint transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes compacted witness-ledger recovery.
- Duplicate witness ids satisfy witness-ledger checkpoint transition-admission witness quorum.
- Unknown or suspended witness ids satisfy witness-ledger checkpoint transition-admission witness quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Witness-ledger compaction accepts a forged valid-looking replay whose nested transition-admission witness certificates lack topology-bound authority.

Minimal implementation slice:

- Extend witness-ledger checkpoint transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend witness-ledger checkpoint witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend checkpoint admission witness replay and witness-ledger compaction evaluation with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0121_agent_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStateWitnessLedgerCompaction({ requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with checkpoint-admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateWitnessLedgerCompactionEvaluationInput.requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested witness-ledger checkpoint transition-admission witness topology issue codes and quorum checks.
- Migration `0121_agent_state_witness_ledger_checkpoint_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound witness-ledger checkpoint transition-admission witness certificates before finance recovery reads compacted witness-ledger accepted heads.
- Axis B can require the same nested topology proof before domain adapters resume from compacted checkpoint projections.
- Axis C can simulate an amnesiac local agent attempting to resume from cached witness-ledger checkpoint transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked witness-ledger checkpoint transition-admission witness ledger is enough accountability for compacted witness recovery authority. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: compacted-recovery certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "witness-ledger checkpoint admission witness authority-transition admission witness certificates"`: 1 passed, 221 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "witness-ledger checkpoint admission witness authority-transition admission"`: 3 passed, 219 skipped
- `pnpm typecheck`
- `pnpm test`: 626 passed, 143 skipped
- `git diff --check`

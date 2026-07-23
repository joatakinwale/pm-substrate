# v206 Operational State Authority-Topology Checkpoint Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ153
Research lane: substrate discovery, authority-topology checkpoint recovery, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v146 adds authority-topology compaction checkpoints so authority topology can be recovered from checkpoint plus retained suffix rather than from agent memory.
- v156 adds authority-topology checkpoint admission records so compacted topology checkpoints cannot self-admit.
- v166 adds authority-topology checkpoint admission witness records so checkpoint-admission rows are witnessed by a separate ledger.
- v176 adds authority-topology checkpoint admission witness authority topology so checkpoint witness certificates bind to replayed principals and thresholds.
- v186 adds authority-topology checkpoint admission witness authority-transition admission records so checkpoint witness authority topology can replay from admitted authority-transition history.
- v196 adds authority-topology checkpoint admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0113` persists authority-topology checkpoint admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict authority-topology compaction could require checkpoint-admission witness authority-transition admission rows to be witnessed, but the certificates inside that nested transition-admission witness ledger still carried their own accepted witness set. That meant compacted authority recovery could still depend on certificate-local signer representation at the nested authority-topology transition-admission witness layer.

The missing substrate primitive is authority-topology checkpoint transition-admission witness authority topology: certificates for authority-topology checkpoint admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become operational failures when authority-topology recovery accepts a certificate-local witness set as authority for nested transition history.

B bridge: reconfiguration protocols treat membership as replicated/replayed state, not as a claim inside an individual message. Dynamic quorum systems make thresholds and eligible members part of the consistency guarantee. Stale or self-declared configurations can break state safety.

C literature:

- Liskov and Cowling, "Viewstamped Replication Revisited" (MIT CSAIL technical report), https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" (USENIX ATC 2014), https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication" (PODC 2009), https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Alvisi, Malkhi, Pierce, and Reiter, "Dynamic Byzantine Quorum Systems" (DSN 2000), https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

Mechanism extracted: a certificate's signer list is evidence to verify against replayed membership, not the membership authority itself. Authority reconfiguration must be reconstructed from admitted history before a witness certificate can count toward operational state.

## Primitive Proposal

Name: authority-topology checkpoint transition-admission witness authority topology.

Problem it solves: authority-topology checkpoint admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: Viewstamped Replication reconfiguration, Raft joint consensus, Vertical Paxos configuration master, and Dynamic Byzantine Quorum Systems.

Mechanism borrowed or adapted: accept a nested witness certificate only when the certificate is bound to a replayed authority topology and enough unique active topology principals signed the exact transition-admission subject.

Why current substrate lacks it: v196 replayed a witness ledger over exact transition-admission record hashes, but did not bind that witness ledger's certificates to replayed signer topology.

Why existing primitives are insufficient: checkpoint admission, checkpoint admission witnesses, checkpoint witness-authority topology, admitted witness-authority transitions, and witnessed transition-admission rows each narrow authority, but none made the nested transition-admission witness certificates' signer set replayable.

State guarantee it should create: strict authority-topology compaction cannot consume checkpoint admission witness authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; checkpoint admission witness replay can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`; authority-topology compaction evaluation can require `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: authority-topology transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: nested witness certificates must use `operational_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_record`, while signer membership comes from a separate authority-topology transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes compacted authority topology recovery.
- Duplicate witness ids satisfy authority-topology transition-admission witness quorum.
- Unknown or suspended witness ids satisfy authority-topology transition-admission witness quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Strict authority-topology compaction accepts a forged valid-looking replay whose nested transition-admission witness certificates lack topology-bound authority.

Minimal implementation slice:

- Extend authority-topology transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend authority-topology witness-authority transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend checkpoint admission witness replay and authority-topology compaction evaluation with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0123_agent_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStateAuthorityTopologyCompaction({ requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with checkpoint admission witness replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateAuthorityTopologyCompactionEvaluationInput.requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested authority-topology transition-admission witness topology issue codes and quorum checks.
- Migration `0123_agent_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound authority-topology transition-admission witness certificates before finance recovery accepts compacted authority topology.
- Axis B can require the same nested topology proof before domain adapters resume from compacted authority topology.
- Axis C can simulate an amnesiac local agent attempting to resume from cached authority-topology transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ158: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ159: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ160: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ161: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ162: What admission, witness, or finality rule makes proof-record admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ163: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked authority-topology transition-admission witness ledger is enough accountability for compacted authority recovery. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: authority-topology nested witness certificates can treat `acceptedWitnessIds` as operational authority. They cannot; signer membership is replayed state, not a certificate-local claim.

## Proof Status

Verification passed:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority topology checkpoint admission witness authority-transition admission witness certificates"`: 1 passed, 223 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority topology checkpoint admission witness authority-transition admission"`: 3 passed, 221 skipped
- `pnpm typecheck`
- `pnpm test`: 628 passed, 143 skipped
- `git diff --check`

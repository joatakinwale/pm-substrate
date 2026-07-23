# v216 Operational State Authority-Topology Transition-Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ163
Research lane: substrate discovery, compacted authority-topology recovery, nested witness topology accountability

## Question

What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Existing Substrate Map

- v146 adds authority-topology compaction checkpoints so compacted authority topology can seed replay with retained suffixes.
- v156 adds authority-topology checkpoint admission records so checkpoint seeds cannot become recovery authority merely because a local compaction exists.
- v166 adds authority-topology checkpoint admission witness records so checkpoint admissions require separate witness accountability.
- v176 adds authority-topology checkpoint admission witness authority topology so checkpoint-admission witness certificates bind to replayed principals and thresholds.
- v186 adds authority-topology checkpoint admission witness authority-transition admission so checkpoint-admission witness topology rows replay from admitted authority-transition history.
- v196 adds authority-topology checkpoint admission witness authority-transition admission witness records so transition-admission rows are witnessed by a separate hash-linked ledger.
- v206 adds authority-topology transition-admission witness authority topology so nested transition-admission witness certificates bind to replayed principals and thresholds.
- Migration `0123` persists authority-topology transition-admission witness authority-transition rows.

## Missing Substrate Map

Strict authority-topology compaction could require authority-topology checkpoint admission witness authority-transition admissions to be witnessed, and could require those transition-admission witness certificates to bind to a replayed nested witness topology. But the nested topology could still be supplied directly as a topology object. That left a recovery-authority self-authorship path: an amnesiac agent, connector cache, local snapshot, or authority-store adapter could present a valid-looking nested topology for the witnesses that certified checkpoint witness authority-transition admissions, without proving that this topology was itself admitted transition history.

The missing substrate primitive is authority-topology transition-admission witness authority-transition admission: the topology that authorizes authority-topology checkpoint admission witness authority-transition admission witness certificates must be reconstructed from admitted authority-transition records and must match the topology used by those certificates before compacted authority-topology recovery can become operational state.

## Arrowsmith Bridge

A literature: agent authority recovery fails when remembered membership, cached connector state, or compacted local topology objects are treated as current authority during resume.

B bridge: reconfiguration protocols do not treat configuration as memory. They make membership/configuration a replayed, authority-controlled state object whose changes preserve quorum overlap or are selected by a separate configuration authority.

C literature:

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014, https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
- Liskov and Cowling, "Viewstamped Replication Revisited", MIT CSAIL 2012, https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", Microsoft Research/PODC 2009, https://www.microsoft.com/en-us/research/wp-content/uploads/2009/05/podc09v6.pdf
- Alvisi et al., "Dynamic Byzantine Quorum Systems", DSN 2000, https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

Mechanism extracted: operational authority membership must itself be state-machine state or configuration-master state. A membership/topology object can authorize recovery only when it is the current admissible projection of admitted configuration-transition history; dynamic quorum membership without replayed configuration provenance reintroduces stale or private authority.

## Primitive Proposal

Name: authority-topology transition-admission witness authority-transition admission.

Problem it solves: authority-topology checkpoint admission witness authority-transition admission witness certificates could bind to a nested topology object whose authority-transition history was not itself admitted.

Research source: Raft joint consensus, Viewstamped Replication reconfiguration, Vertical Paxos configuration master, and Dynamic Byzantine Quorum Systems.

Mechanism borrowed or adapted: strict authority-topology compaction accepts a nested transition-admission witness topology only if admitted authority-transition replay reconstructs the same topology; missing, invalid, or mismatched nested transition-admission history is an obstruction even when a higher-level replay object claims validity.

Why current substrate lacks it: v206 made nested authority-topology transition-admission witness certificates topology-bound, but did not require that topology to be recovered from admitted transition history.

Why existing primitives are insufficient: authority-topology checkpoints, checkpoint admissions, checkpoint admission witnesses, checkpoint admission witness authority topology, admitted checkpoint admission witness authority transitions, transition-admission witness records, and nested witness topology each remove one self-authorship path. None proved that the nested topology used by transition-admission witness certificates was itself admitted.

State guarantee it should create: strict authority-topology compaction cannot recover operational authority topology unless the nested transition-admission witness topology equals the latest admissible projection of admitted nested authority-transition history.

Admission rule it requires: transition-admission witness replay can require `requireWitnessAuthorityTransitionAdmission`; checkpoint witness-authority transition-admission replay can require `requireAdmissionWitnessAuthorityTransitionAdmission`; checkpoint admission witness replay and final authority-topology compaction can require the nested transition-admission witness authority-transition admission path.

Replay rule it requires: replay rejects missing nested authority-transition admission replay, invalid nested replay, and replay/topology mismatch. Final authority-topology compaction re-inspects nested replay data so a forged valid-looking checkpoint witness replay cannot hide missing nested history.

Authority boundary it requires: nested authority-topology transition-admission witness authority-transition admissions use `operational_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admission`; nested witness certificates still use `operational_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness`.

Failure modes it should prevent:

- A local topology snapshot authorizes authority-topology transition-admission witness certificates.
- An amnesiac agent resumes compacted authority topology from remembered nested witness membership rather than admitted transition history.
- An authority-store adapter supplies a topology object whose authority-transition history is missing or invalid.
- A forged valid-looking checkpoint admission witness replay hides that nested transition-admission witness authority was not admitted.
- A topology generated from one authority history authorizes certificates under another topology hash before compacted authority recovery.

Minimal implementation slice:

- Add nested authority-transition admission replay support to authority-topology transition-admission witness replay.
- Add strict nested replay checks to authority-topology checkpoint witness-authority transition-admission replay.
- Carry strict nested history requirements through checkpoint admission witness replay and final authority-topology compaction evaluation.
- Add missing/invalid/mismatch issue codes for authority-topology transition-admission witness authority-transition admission.
- Add migration `0133_agent_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.
- Add focused tests for valid admitted nested topology history, missing nested history, mismatched nested replay, parent replay refusal, checkpoint witness replay refusal, and forged valid-looking compaction refusal.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmission: true })` with a nested witness topology but no admitted topology-transition replay.
2. `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()` with a topology whose hash differs from the latest admitted nested authority-transition replay.
3. `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTransitionAdmission: true })` with a transition-admission witness replay that has topology-bound certificates but no admitted topology-transition history.
4. `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a nested transition-admission witness replay whose topology was not admitted.
5. `evaluateOperationalStateAuthorityTopologyCompaction({ requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission: true })` with a forged valid-looking witness replay hiding missing nested topology-transition admission history.
6. Compacted authority topology is accepted when the nested transition-admission witness topology is not the latest projection of admitted nested authority-transition history.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmission`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTransitionAdmissionReplay`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- `OperationalStateAuthorityTopologyCompactionEvaluationInput.requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTransitionAdmission`
- Issue codes for missing, invalid, and mismatched authority-topology transition-admission witness authority-transition admission replay.
- Migration `0133_agent_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness_authority_transition_admissions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require finance authority-topology recovery to prove nested transition-admission witness authority through admitted topology-transition history before accepting compacted operational authority.
- Axis B can require the same nested admitted topology history before domain adapters accept compacted authority-topology recovery.
- Axis C can simulate an amnesiac local agent attempting to resume from a cached authority-topology nested witness topology that is structurally valid but not admitted.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ164: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ165: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ166: What genesis, bootstrap, or root-authority rule prevents nested transition-admission witness authority-transition admission from relying on `authority-bootstrap` as private belief?
4. SQ167: What root-of-authority settlement or meta-admission primitive terminates the authority-transition admission recursion without turning the root into private memory?
5. SQ168: What privacy-preserving policy-proof object lets policy-authority witnesses prove authorization without exposing private delegation material while still remaining replayable, authority-scoped, and independent of memory?
6. SQ169: What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?
7. SQ170: What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?
8. SQ171: What compositional quorum-intersection proof prevents independently admitted witness-authority ledgers from composing into false global authority when recovery spans multiple authority topologies?
9. SQ172: What replay-semantics versioning proof prevents admitted authority-transition history from being reinterpreted by newer substrate code rather than replayed under the transition algebra that originally admitted it?
10. SQ173: What configuration-master or topology-settlement proof chooses the authoritative branch when independently admitted authority-topology histories propose competing recovery topologies?

## Failed Assumption Ledger

- Failed assumption: topology-bound authority-topology transition-admission witness certificates are enough accountability. They are not; the topology used by those certificates must itself replay from admitted authority-transition history.
- Failed assumption: a forged valid-looking checkpoint admission witness replay can be trusted once its top-level `valid` field is true. It cannot; authority-topology compaction must inspect nested required replay fields recursively.

## Proof Status

Verification passed:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority topology checkpoint admission witness authority-transition admission witness certificates"`: 2 passed, 228 skipped
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority topology checkpoint admission witness authority-transition admission"`: 4 passed, 226 skipped
- `pnpm typecheck`
- `pnpm test`: 634 passed, 143 skipped
- `git diff --check`

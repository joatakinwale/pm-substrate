# v196 Operational State Authority-Topology Checkpoint Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ143
Research lane: substrate discovery, compacted authority-topology recovery, checkpoint witness authority accountability

## Question

What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v146 adds authority-topology compaction checkpoints so compacted topology recovery can seed replay from a hash-bound topology plus retained suffix.
- v156 adds authority-topology checkpoint admission records so strict compacted topology recovery must consume the latest admitted checkpoint seed.
- v166 adds authority-topology checkpoint admission witness records so the latest checkpoint-admission row must be separately quorum-certified by a witness ledger.
- v176 adds checkpoint-admission witness authority topology so witness certificates bind to replayed active principals and quorum thresholds.
- v186 adds checkpoint-admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- Migration `0103` persists admitted authority-topology checkpoint admission witness authority-transition rows.

## Missing Substrate Map

The authority-topology lane can recover compacted topology state from an admitted checkpoint and retained suffix, but v186 left the checkpoint-admission witness authority-transition admission row as its own accountability boundary. A strict compaction replay could require checkpoint-admission witness authority topology to come from admitted transition history while still accepting transition-admission rows supplied as local certificate-bearing records.

That is insufficient for amnesiac recovery. Authority-topology checkpoints decide which historical authority transitions can be compacted away; therefore the authority that admits checkpoint witnesses must itself be replay-accountable. The missing substrate primitive is a separate append-only witness ledger over the exact authority-topology checkpoint admission witness authority-transition admission record hash.

## Arrowsmith Bridge

A literature: memory drift and continuity breaks become operational failures when private reconfiguration rows, compacted topology snapshots, or cached certificates can be accepted after resume without public replay accountability.

B bridge: reconfiguration protocols commit membership/topology changes through logs or checkpoints, while transparency and accountability systems make exact log subjects independently replay-checkable.

C literature:

- Liskov and Cowling, "Viewstamped Replication Revisited" (MIT CSAIL TR 2012), https://dspace.mit.edu/bitstream/handle/1721.1/71763/MIT-CSAIL-TR-2012-021.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" (USENIX ATC 2014), https://raft.github.io/raft.pdf
- Tomescu and Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries" (CCS 2019), https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf

Mechanism extracted: topology reconfiguration cannot be a private row after compaction. The row must become the exact subject of a separate append-only witnessed log so replay can detect absence, wrong subject hashes, forks, and invalid witness certificates.

## Primitive Proposal

Name: operational state authority-topology checkpoint admission witness authority-transition admission witness records.

Problem it solves: authority-topology checkpoint admission witness authority-transition admission rows could be accepted from local state if their embedded certificates were structurally valid.

Research source: Viewstamped Replication reconfiguration, Raft joint consensus, append-only authenticated transparency logs, and PeerReview accountable logs.

Mechanism borrowed or adapted: committed reconfiguration plus independently auditable exact log subjects. The substrate adaptation is a hash-linked witness ledger over authority-topology checkpoint admission witness authority-transition admission record hashes.

Why current substrate lacks it: v186 admitted checkpoint-admission witness authority topology transitions but did not require a separate replayed witness ledger over each transition-admission row.

Why existing primitives are insufficient: topology compaction, checkpoint admission, checkpoint admission witnesses, witness topology, and transition-admission replay prove progressively stronger compacted topology recovery authority, but none separately witness the exact transition-admission row hash.

State guarantee it should create: strict authority-topology compaction cannot treat a checkpoint-admission witness authority-transition admission row as compacted topology-recovery authority unless the latest required transition-admission record hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission record to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_authority_topology_compaction_checkpoint_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- A local row presents certificate-shaped checkpoint-admission witness authority transitions as current compacted topology-recovery authority.
- A connector cache supplies a transition-admission row without a separate witnessed record hash.
- A forged witness certificate signs a different checkpoint witness-authority transition-admission hash.
- Strict checkpoint admission witness replay consumes a witness-authority transition replay that lacks the transition-admission witness layer.
- Compacted authority topology recovery proceeds when checkpoint witness authority is certificate-local rather than admitted and witnessed.

Minimal implementation slice:

- Add `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend authority-topology checkpoint admission witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend checkpoint admission witness replay and authority-topology compaction evaluation with transition-admission witness strictness.
- Add migration `0113_agent_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness_records.sql`.
- Add a focused falsification test for valid witnessed rows, missing witness replay, forged valid-looking missing nested witness replay, and wrong witness certificate subject.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A checkpoint-admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A checkpoint admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. An authority-topology compaction evaluation with `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. A compacted authority-topology recovery evaluation that passes when strict checkpoint witness-authority transition-admission witness accountability is missing.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on authority-topology checkpoint-admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on checkpoint admission witness replay
- `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitness` on authority-topology compaction evaluation
- Migration `0113_agent_state_authority_topology_checkpoint_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require witnessed authority-topology checkpoint witness-authority transition admission before finance pruning accepts compacted authority-topology recovery.
- Axis B can use the same strict compaction path for future marketing/domain-adapter authority-topology histories.
- Axis C can simulate an amnesiac local agent attempting compacted authority-topology recovery from cached checkpoint witness authority rows without the witnessed transition-admission ledger.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: an authority-topology checkpoint admission witness authority-transition admission row can carry enough certificate evidence inside itself to authorize compacted topology recovery. It cannot; the row must be separately witnessed.
- Failed assumption: authority-topology compaction makes witness-authority accountability less urgent because the compacted object is itself authority topology. It makes accountability more urgent: the authority that admits checkpoint witnesses can decide which topology transitions survive compaction.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "authority topology checkpoint admission witness authority-transition admissions to be witnessed"`: 1 passed, 213 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 618 passed, 143 skipped

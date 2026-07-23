# v193 Operational State Tombstone-History Checkpoint Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ140
Research lane: substrate discovery, compacted recovery, checkpoint authority accountability

## Question

What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v153 adds tombstone-history compaction checkpoints so compacted recovery can seed replay from a hash-bound checkpoint plus retained suffix.
- v163 adds tombstone-history checkpoint admission records so compacted recovery must consume the latest admitted checkpoint seed.
- v164 adds checkpoint admission witness records so the latest checkpoint-admission row must be separately quorum-certified by a witness ledger.
- v173 adds checkpoint-admission witness authority topology so witness certificates bind to replayed active principals and quorum thresholds.
- v183 adds checkpoint-admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- Migration `0100` persists admitted tombstone-history checkpoint admission witness authority-transition rows.

## Missing Substrate Map

The tombstone-history lane can recover compacted state from an admitted checkpoint and a retained suffix, but v183 left the witness-authority transition-admission row as its own accountability boundary. A strict compaction replay could require checkpoint-admission witness authority topology to come from admitted transition history while still accepting transition-admission rows supplied as local certificate-bearing records.

That is insufficient for amnesiac recovery. A compaction checkpoint can hide pruned history, so the authority that admits checkpoint witnesses must itself be replay-accountable. The missing substrate primitive is a separate append-only witness ledger over the exact tombstone-history checkpoint admission witness authority-transition admission record hash.

## Arrowsmith Bridge

A literature: compacted recovery, stale checkpoint authority, and memory drift are the same class of state problem when a recovered system can treat a checkpoint or authority row as current without replaying the authority that admitted it.

B bridge: PBFT stable checkpoints, Viewstamped Replication recovery checkpoints, and ARIES fuzzy checkpoints all separate compacted recovery from private memory by retaining replayable checkpoint/log evidence. PeerReview adds accountable secure logs: an action is defensible only when another principal can replay the relevant log and bind behavior to recorded evidence.

C literature:

- Castro and Liskov, "Practical Byzantine Fault Tolerance" (OSDI 1999), https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited" (MIT CSAIL TR-2012-021), https://dspace.mit.edu/bitstream/handle/1721.1/71763/MIT-CSAIL-TR-2012-021.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" (ACM TODS 1992), https://research.ibm.com/publications/aries-a-transaction-recovery-method-supporting-fine-granularity-locking-and-partial-rollbacks-using-write-ahead-logging
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf

Mechanism extracted: compacted recovery can use checkpoints only when checkpoint state and the authority that admitted checkpoint witnesses are both reconstructed from replayable, externally accountable logs. A certificate-shaped local row is not a checkpoint authority.

## Primitive Proposal

Name: operational state tombstone-history checkpoint admission witness authority-transition admission witness records.

Problem it solves: tombstone-history checkpoint admission witness authority-transition admission rows could be accepted from local state if their embedded certificates were structurally valid.

Research source: PBFT stable checkpoints, Viewstamped Replication recovery checkpoints, ARIES checkpoint/log recovery, and PeerReview accountability logs.

Mechanism borrowed or adapted: replayable checkpoint recovery plus independent accountable audit. The substrate adaptation is a hash-linked witness ledger over tombstone-history checkpoint admission witness authority-transition admission record hashes.

Why current substrate lacks it: v183 admitted checkpoint-admission witness authority topology transitions but did not require a separate replayed witness ledger over each transition-admission row.

Why existing primitives are insufficient: checkpoint admission, checkpoint admission witness records, witness topology, and transition-admission replay prove progressively stronger recovery authority, but none of them separately witness the exact transition-admission row hash.

State guarantee it should create: strict tombstone-history compaction cannot treat a checkpoint-admission witness authority-transition admission row as compacted-recovery authority unless the latest required transition-admission record hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission record to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_tombstone_history_compaction_checkpoint_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- A local row presents certificate-shaped checkpoint-admission witness authority transitions as current compacted-recovery authority.
- A connector cache supplies a transition-admission row without a separate witnessed record hash.
- A forged witness certificate signs a different checkpoint witness-authority transition-admission hash.
- Strict tombstone compaction consumes a witness-authority transition replay that lacks the transition-admission witness layer.
- Compacted recovery proceeds when checkpoint witness authority is certificate-local rather than admitted and witnessed.

Minimal implementation slice:

- Add `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend tombstone checkpoint-admission witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend checkpoint admission witness replay and tombstone-history compaction evaluation with transition-admission witness strictness.
- Add migration `0110_agent_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness_records.sql`.
- Add a focused falsification test for valid witnessed rows, missing witness replay, forged valid-looking missing nested witness replay, and wrong witness certificate subject.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A checkpoint-admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A checkpoint admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. A tombstone-history compaction evaluation with `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. A compacted recovery evaluation that passes when strict tombstone checkpoint witness-authority transition-admission witness accountability is missing.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on tombstone checkpoint-admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on checkpoint admission witness replay
- `requireCheckpointAdmissionWitnessAuthorityTransitionAdmissionWitness` on tombstone-history compaction evaluation
- Migration `0110_agent_state_tombstone_history_checkpoint_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require witnessed tombstone checkpoint witness-authority transition admission before finance pruning accepts compacted recovery.
- Axis B can use the same strict compaction path for future marketing/domain-adapter stores.
- Axis C can simulate an amnesiac local agent attempting compacted recovery from cached checkpoint witness authority rows without the witnessed transition-admission ledger.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: a tombstone-history checkpoint admission witness authority-transition admission row can carry enough certificate evidence inside itself to authorize compacted recovery. It cannot; the row must be separately witnessed.
- Failed assumption: checkpoint compaction makes authority accountability less urgent because old history was intentionally pruned. It makes accountability more urgent: the authority that admits checkpoint witnesses must be replayable because the checkpoint substitutes for discarded history.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "tombstone-history checkpoint admission witness authority-transition admissions to be witnessed"`: 1 passed, 210 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 615 passed, 143 skipped

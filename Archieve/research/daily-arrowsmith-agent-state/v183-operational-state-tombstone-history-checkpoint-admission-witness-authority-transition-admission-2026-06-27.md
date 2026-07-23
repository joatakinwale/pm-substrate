# v183 - Operational State Tombstone-History Checkpoint Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ130

## Research Question

What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Alvisi, Pierce, and Reiter, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Martin, Alvisi, and Dahlin, "A Framework for Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf

## Mechanism Extracted

PBFT checkpointing separates compacted state from private memory by keeping log evidence until a stable checkpoint proof exists, then using the proof as the safe recovery anchor. Viewstamped Replication reconfiguration adds the missing membership rule: a new epoch cannot act merely because a new configuration exists; replicas must learn the committed state up to the reconfiguration point before the new group processes requests. ARIES supplies the recovery discipline: restart repeats logged history rather than trusting process-local state. Dynamic Byzantine quorum work shows why changing authority thresholds or membership without old/new quorum intersection can let clients observe conflicting current values.

The substrate adaptation is tombstone-history checkpoint admission witness authority-transition admission. v173 made checkpoint-admission witness certificates topology-bound, but strict tombstone-history compaction could still accept a hash-valid witness authority topology supplied as a replay input. v183 adds a transition-admission ledger for that topology. Strict checkpoint-admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each transition admission binds the transition hash, previous topology hash when applicable, derived next topology hash, and certificate that admitted the transition.

## Existing Substrate Map

- v143 added generic tombstone-history compaction: retained suffix replay must reconstruct the exact required head from a compaction checkpoint.
- v153 added tombstone-history checkpoint admission records over exact checkpoint hashes and compacted frontiers.
- v163 added tombstone-history checkpoint admission witness records over exact checkpoint-admission record hashes.
- v173 added checkpoint-admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0090` persists append-only checkpoint-admission witness authority-transition rows.
- Before v183, `replayOperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, but that topology object could still be supplied from memory, adapters, connector cache, or self-authored transition rows.

## Missing Substrate Map

- Before v183, tombstone-history checkpoint-admission witness authority-transition rows were append-only storage, not admitted compacted-recovery authority.
- Before v183, strict tombstone-history compaction could consume a checkpoint-admission witness authority topology without proving the latest authority transition was admitted.
- Before v183, a supplied topology could authorize the witness certificate that made a compacted checkpoint admissible without proving the topology's own admission path.
- Before v183, no replay object bound checkpoint-admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v183: genesis/bootstrap authority for the first checkpoint-admission witness-authority transition, separate witness/finality for this transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime tombstone-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state tombstone-history checkpoint admission witness authority-transition admission.

Problem it solves: prevents tombstone-history checkpoint admission witness authority topology from becoming operational compacted-recovery authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: PBFT stable checkpoints, Viewstamped Replication reconfiguration/state transfer, ARIES write-ahead recovery, dynamic Byzantine quorum systems, and dynamic Byzantine storage.

Mechanism borrowed: compaction/recovery checkpoints need proof; reconfiguration needs committed-history transfer before the new authority acts; recovery must replay logged history; dynamic quorum changes require intersection with prior authority. The current checkpoint-admission witness authority must derive from admitted transition history; post-bootstrap changes must be certified by prior admissible authority rather than by the proposed new topology.

Why current substrate lacked it: v173 bound checkpoint-admission witness certificates to replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: checkpoint records, checkpoint-admission records, witness records, and topology-bound witness certificates constrain compacted recovery evidence, but not the authority-transition ledger that defines which witnesses can certify checkpoint admissions. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict tombstone-history compaction can consume a checkpoint-admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each checkpoint-admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap checkpoint-admission witness authority changes are counted against the previous replayed tombstone-history checkpoint admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied checkpoint-admission witness topology, stale local checkpoint witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and compacted recovery authorized by unadmitted checkpoint-admission witness-authority transition history.

Minimal implementation slice: add checkpoint-admission witness authority-transition admission record/replay types, deterministic hashes, strict witness replay/evaluation flags, migration `0100`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict tombstone-history compaction passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct tombstone-history compaction recovery from admitted checkpoint witness authority transitions, Axis A finance pruning/tombstone compaction attempting stale witness topology, and Axis B/domain adapters attempting to supply local checkpoint witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- A tombstone-history checkpoint admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict tombstone-history compaction.
- Strict tombstone-history compaction must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a tombstone-history checkpoint admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only checkpoint-admission witness authority-transition rows are enough to constitute operational compacted-recovery authority.
- Falsified: a topology object supplied to witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial checkpoint-admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateTombstoneHistoryCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for checkpoint-admission witness authority-transition admissions.
- Extended tombstone-history checkpoint admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended tombstone-history compaction evaluation with checkpoint-admission witness authority transition-admission strictness.
- Added tombstone-history issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0100_agent_state_tombstone_history_checkpoint_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm exec vitest run packages/agent-state/src/index.test.ts` (196 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (600 passed, 143 skipped)

Outcome: SQ130 is closed. SQ131 is now the active next substrate question, with SQ140 added as new tombstone-history checkpoint admission witness authority-transition admission-record accountability pressure.

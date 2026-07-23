# v223 - Operational State Authority-Transition Ledger Compaction Admission

Date: 2026-06-27
Question closed: SQ170

## Research Question

What compaction-admission primitive prevents recursively admitted authority-transition ledgers themselves from being pruned into hash-valid summaries without replayed checkpoint authority?

## Existing Substrate Map

`@pm/agent-state` already had proof-preserving compaction for tombstone histories, witness ledgers, quorum-certificate proof records, and authority topology. It also had checkpoint-admission records for several compacted replay seeds, plus recursive nested authority-transition admission for many witness-authority lanes.

That existing substrate covered compacted domain/projection histories and compacted authority topology, but not the generic authority-transition or transition-admission ledger prefix itself. A recursively admitted authority ledger could still be represented by a hash-valid compacted summary without a generic replay object proving that the compaction checkpoint was admitted by authority-scoped transition history.

## Missing Substrate Map

The missing primitive was a recursive compaction-admission object for authority-transition/admission ledgers. The substrate needed to distinguish:

- A hash-valid checkpoint body.
- An admitted checkpoint body.
- A latest admitted checkpoint for a specific tenant, authority scope, authority boundary, transition-admission store, and topology.
- A retained suffix that starts exactly after the admitted compacted frontier.

Without that distinction, memory, connector caches, or local snapshots could replace an authority-transition ledger prefix with a plausible checkpoint and let that summary become operational state.

## Research Sources

- Castro and Liskov, "Practical Byzantine Fault Tolerance," OSDI 1999. The useful mechanism is stable checkpoints: log garbage collection is allowed only once replicas hold a proof over the checkpoint digest and sequence frontier. Source: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm," USENIX ATC 2014. The useful mechanism is snapshot compaction with retained log frontier metadata: the snapshot preserves last included index/term so following log entries can still be checked. Source: https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging," ACM TODS 1992. The useful mechanism is checkpoint-as-log/restart metadata plus repeating history from a recorded frontier, not trusting a private in-memory page state. Source: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf

## Primitive Proposal

Name: `OperationalStateAuthorityTransitionLedgerCompactionCheckpointAdmission`

Problem it solves: Authority-transition/admission ledger prefixes can be pruned only when the compacted checkpoint is itself a replayable admitted record, not when an agent remembers or computes a hash-valid summary.

Mechanism borrowed or adapted: PBFT stable checkpoint proof, Raft snapshot frontier metadata, and ARIES checkpoint/restart frontier replay.

Why current substrate lacked it: Existing compaction primitives protected tombstone, witness, proof-record, and authority-topology lanes. They did not provide a generic compaction-admission boundary for the recursive authority-transition/admission ledger that authorizes those lanes.

Why existing primitives were insufficient: Authority-topology compaction proves the projected topology can recover. It does not prove the transition-admission ledger prefix that admitted the topology changes can be physically removed. Tombstone/witness compaction admissions prove their own lanes, not recursive authority-transition ledger compaction.

State guarantee: A compacted authority-transition/admission ledger prefix is operational only if the latest replayed compaction-admission record hash-binds the checkpoint, compacted admission frontier, compacted authority frontier, source replay hash, and retained suffix start for the exact tenant/scope/boundary/store/topology.

Admission rule: The checkpoint admission record must replay in a contiguous hash-linked admission history and carry a certified quorum certificate over the exact checkpoint hash and compacted admission frontier under the required checkpoint-admission authority boundary.

Replay rule: Replay recomputes checkpoint hash, admission record hash, quorum-certificate hash, contiguous admission sequence, previous record hash, checkpoint-frontier fields, certificate subject, and latest required checkpoint. Evaluation rejects compaction unless the retained admission suffix chains from `compactedThroughAdmissionRecordHash` and starts at `compactedThroughAdmissionSequence + 1`.

Authority boundary: The checkpoint body binds the authority boundary being compacted; the certificate binds the checkpoint-admission authority boundary.

Failure modes prevented:

- Hash-valid checkpoint supplied from private memory.
- Tampered checkpoint embedded in an admission record.
- Stale checkpoint after a later checkpoint was admitted.
- Wrong checkpoint-admission authority boundary.
- Prefix pruning beyond the latest admitted checkpoint.
- Retained suffix gaps or broken previous-record hash continuity.

Minimal implementation slice:

- Added `OperationalStateAuthorityTransitionLedgerCompactionCheckpoint`.
- Added `OperationalStateAuthorityTransitionLedgerCompactionCheckpointAdmissionRecord`.
- Added deterministic build/hash/verify helpers.
- Added `replayOperationalStateAuthorityTransitionLedgerCompactionCheckpointAdmissionRecords()`.
- Added `evaluateOperationalStateAuthorityTransitionLedgerCompaction()`.
- Added migration `0140_agent_state_authority_transition_ledger_compaction_checkpoint_admissions.sql`.
- Added focused tests for valid replay, missing admission replay, stale checkpoint, tampering, wrong boundary, prune-beyond-frontier, and retained suffix gaps.

Tests that falsify it:

- A checkpoint with a valid hash but no admission replay must fail.
- A checkpoint whose admission record hash or embedded checkpoint hash is tampered must fail.
- A previously admitted checkpoint must fail once a later checkpoint is latest.
- A wrong checkpoint-admission boundary must fail.
- A requested prune frontier beyond the admitted checkpoint must fail.
- A retained suffix that does not chain from the checkpoint frontier must fail.

Axis surfaces that can later validate it:

- Axis A can attempt finance ingest resume after pruning an authority-transition admission ledger prefix.
- Axis B can attempt domain-adapter resume using only a connector cache of authority topology.
- Axis C can directly attempt local agent-state recovery from a compacted authority-transition admission ledger without replaying checkpoint-admission history.

## Implementation Frontier

Implemented in `packages/agent-state/src/index.ts`, `packages/agent-state/src/index.test.ts`, and migration `0140_agent_state_authority_transition_ledger_compaction_checkpoint_admissions.sql`.

Proof status: focused typecheck and focused Vitest passed before ledger update:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "authority-transition ledger compaction"`

## Active Backlog Change

Closed SQ170.

Added SQ180: What compaction-checkpoint witness/currentness primitive makes authority-transition ledger compaction checkpoint-admission histories non-equivocating across agents, restarts, and split compaction stores?

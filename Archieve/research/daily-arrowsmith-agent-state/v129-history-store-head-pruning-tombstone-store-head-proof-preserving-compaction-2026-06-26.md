# v129 - History-Store Head Pruning Tombstone-Store Head Proof-Preserving Compaction

Date: 2026-06-26
Question closed: SQ76

## Research Question

What proof-preserving compaction checkpoint lets history-store-head pruning tombstone-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

## Sources

- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro and https://raft.github.io/raft.pdf
- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf

## Mechanism Extracted

ARIES makes recovery a logged transition problem: a checkpoint is not operational state by itself; recovery starts from a checkpoint only because log sequence boundaries and retained log suffixes determine the resulting state. Raft snapshots apply the same shape to replicated logs: compacted history is safe only when the snapshot carries the last included index/term and later log entries continue from that boundary. PBFT adds the admission side: a stable checkpoint becomes durable consensus state only after enough replicas sign the same checkpoint digest.

The substrate mechanism is therefore: a compacted prefix can be replaced by a checkpoint only when the checkpoint contains lane-specific replay frontiers and derived projections, has a deterministic digest, and is admitted by authority-scoped witness signatures. Suffix replay then starts from the checkpoint frontier and refuses missing, unadmitted, or tampered checkpoints.

## Existing Substrate Map

- v123 witness ledger records observed history-store-head pruning tombstone-store heads as hash-linked witness records with consistency proofs over pruning tombstone history.
- v124 quorum topology separates witness observations from certified currentness.
- v125 authority-transition stores make topology replayable from durable history.
- v126 signature/key-status replay prevents unsigned, wrong-key, old-key, or revoked-key witness evidence from certifying currentness.
- v127 authority epoch seals prevent later topology/key-status transitions from retroactively governing already certified heads.
- v128 quorum-certificate proof records persist certified currentness with accepted witness evidence, signatures, optional seal linkage, and hash chaining.

## Missing Substrate Map

- Before v129, v128 proof-record history was durable but not safely compactable: a retained suffix after prefix deletion could not prove its prior witness heads, authority topology, or latest certified QC record without relying on process memory or a full unpruned prefix.
- The missing primitive was a target-layer replay compaction checkpoint that carries all three compacted lane frontiers: witness ledger, authority/key/seal topology, and quorum-certificate proof records.
- The missing admission rule was a strict witness-signed checkpoint admission over the exact checkpoint hash.
- The missing replay rule was suffix replay seeded only by admitted checkpoint frontiers.
- The next missing primitive is durable checkpoint-admission record history for this target layer; otherwise the admission certificate itself can still be supplied from memory.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head replay compaction checkpoint.

Problem it solves: lets an amnesiac agent recover v123/v124/v127/v128 currentness after proof-history prefix pruning without trusting summaries, connector cache, local snapshots, or conversation memory.

Research source: ARIES checkpoint/log recovery, Raft snapshot/log-compaction boundaries, PBFT stable checkpoint certificates.

Mechanism borrowed: checkpoint digest plus compacted frontier plus retained suffix replay, admitted by quorum/witness certificate.

Why current substrate lacked it: v128 made certified currentness durable but still required full prefix replay for witness, authority, and QC-record histories.

Why existing primitives were insufficient: durable proof records alone made certification recoverable, but they did not define a lawful replacement for a pruned prefix.

State guarantee: a retained suffix is operational replay state only when it chains from a hash-valid checkpoint admitted under replayed authority.

Admission rule: checkpoint admission must replay as admitted under strict signature policy, with active witnesses signing the exact checkpoint hash.

Replay rule: witness replay seeds expected sequence, previous hash, and accepted heads from the witness checkpoint; authority replay seeds sequence, prior hash, current principals, thresholds, effective authority hash, and seals; QC-record replay seeds expected record sequence, previous record hash, and latest certified record.

Authority boundary: history-store-head pruning tombstone-store head witness replay compaction checkpoint admission.

Failure modes prevented: suffix-only replay masquerading as full history, missing-admission checkpoint use, tampered checkpoint digest, stale authority topology injection, and QC-record latest-state recovery from memory.

Minimal implementation slice: `@pm/agent-state` target checkpoint/admission types and hash helpers plus checkpoint-aware witness, authority, and QC-record replay paths.

Tests that falsify it: suffix without checkpoint fails; checkpoint without admission fails; admitted checkpoint plus suffix succeeds; authority seal suffix recovers from the compacted pre-seal topology; QC-record replay recovers latest certified record from checkpoint; tampered checkpoint hash fails.

Axis surfaces that could later validate it: Axis C amnesiac local-agent recovery after proof-history pruning; Axis A finance recovery after persisted proof prefix pruning; Axis B adapter recovery once accepted agency fixtures or PluggedInSocial evidence exists.

## Falsification Criteria

- A private checkpoint object without an admitted checkpoint certificate must not seed replay.
- A retained witness suffix must fail when replayed from sequence 1 after its compacted prefix is removed.
- A retained authority seal suffix must recover only when the checkpoint supplies the exact pre-seal authority hash and principals.
- A QC-record replay with no retained records may recover the latest certified record only when the checkpoint is admitted and hash-valid.
- A tampered checkpoint hash must obstruct replay even if the admission certificate object is supplied.

## Active 10-Question Backlog

1. SQ77: What durable checkpoint-admission record store makes v129 checkpoint authority recoverable after amnesia rather than supplied as an in-memory certificate?
2. SQ78: What pruning admission rule requires v129 durable checkpoint-admission history plus retained suffix continuity before physical prefix deletion?
3. SQ79: What tombstone-gated store pruning API makes actual v129 witness, authority/key/seal, and QC-record deletion replayable?
4. SQ80: What currentness object proves the v129 pruning tombstone history itself is current rather than merely replay-valid?
5. SQ81: What durable witness ledger recovers the v129 pruning tombstone-store head after amnesia?
6. SQ82: What quorum topology certifies the v129 pruning tombstone-store head instead of letting one observer define currentness?
7. SQ83: What authority-transition store makes that topology replayable across agents and restarts?
8. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v129 pruning tombstone-store head?
9. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v129 pruning tombstone-store head certification?
10. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?

## Failed Assumption Ledger

- Falsified: durable v128 QC proof records alone are enough to survive future pruning. They recover certified currentness, but a retained suffix after prefix deletion still cannot replay unless the compacted prefix is replaced by an admitted checkpoint frontier.
- Still open: v129 checkpoint admission is implemented as an object, not yet as durable non-equivocating admission-record history.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionCheckpoint`
- `evaluateProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionCheckpointAdmission`
- checkpoint-seeded replay for target witness records, authority transitions, and quorum-certificate records

Verification:

- `pnpm typecheck`
- `pnpm test`

Outcome: SQ76 is closed. SQ77 is now the active next substrate question.

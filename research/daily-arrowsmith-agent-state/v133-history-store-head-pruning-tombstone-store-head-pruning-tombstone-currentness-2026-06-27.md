# v133 - History-Store Head Pruning Tombstone-Store Head Pruning Tombstone Currentness

Date: 2026-06-27
Question closed: SQ80

## Research Question

What currentness object proves the v132 pruning tombstone history itself is current rather than merely replay-valid?

## Sources

- Li et al., "SUNDR: Secure Untrusted Data Repository", OSDI 2004: https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara
- Crosby and Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009: https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf

## Mechanism Extracted

Append-only replay proves that one local history is internally coherent. It does not prove that the history is the admissible current one. SUNDR shows why: two clients can each hold a valid-looking view unless the system exposes fork consistency as an explicit comparison problem. CONIKS and tamper-evident log work sharpen the mechanism: a compact signed/hash-bound tree head or directory head is the object clients compare before trusting a local log projection.

The substrate mechanism is therefore a pruning tombstone-store head for v132. A replay-valid v132 tombstone history derives a deterministic head from the latest tombstone record. Pruned-store continuity can require an exact head and rejects missing local history, stale local history, unwitnessed local advances, same-sequence forks, and hash-invalid required heads. This is not yet witness or quorum currentness; it is the substrate object that later witness/quorum layers can certify.

## Existing Substrate Map

- v132 records actual target witness, authority/key/seal, and QC-record deletion as durable pruning tombstone history.
- v132 continuity already replays retained suffixes after deletion and detects silent retained-suffix truncation.
- Earlier pruning layers already proved the head-currentness pattern: derive a head from tombstone replay, then compare it to a required admissible head before row absence can authorize recovery.

## Missing Substrate Map

- Before v133, a local v132 tombstone history could be replay-valid but stale, forked, or ahead of the externally required history.
- v132 continuity had no `requiredPruningTombstoneStoreHead`, so a local adapter or process could treat its own latest tombstone replay as sufficient currentness.
- The missing object was a compact identity of the v132 tombstone ledger head: tenant, tombstone sequence, tombstone record hash, recorded time, and deterministic head hash.
- The next missing primitive is durable witness recovery for that required head, so agents do not supply it from memory or adapter state.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head pruning tombstone-store head currentness.

Problem it solves: prevents a replay-valid but stale, forked, or merely local v132 tombstone ledger from authorizing pruned target recovery.

Research source: SUNDR fork consistency, CONIKS key transparency, and tamper-evident logging.

Mechanism borrowed: compact history heads are the comparison object that separates internal log validity from globally admissible currentness.

Why current substrate lacked it: v132 made deletion replayable, but its continuity verifier only checked local tombstone replay and retained suffixes.

Why existing primitives are insufficient: tombstone replay proves local deletion history is internally coherent; it does not prove the local head equals the required admissible head.

State guarantee it should create: target pruned-store continuity can be made strict against an explicit v132 tombstone-store head; private memory, connector cache, or local row absence cannot substitute for that head comparison.

Admission rule it requires: the required head must be hash-valid and must match the replay-derived local v132 tombstone-store head by tenant, sequence, tombstone record hash, and head hash.

Replay rule it requires: replay v132 tombstone records first, derive the local head from the latest valid record, then compare it to the required head before accepting retained suffix continuity as operational state.

Authority boundary it requires: `projection_replay_pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_replay_compaction_pruned_store`.

Failure modes it should prevent: missing local tombstone history, stale local tombstone history, unwitnessed local tombstone advances, same-sequence forks, tampered required heads, and currentness smuggled through adapter-supplied snapshots.

Minimal implementation slice: target tombstone-store head type, deterministic head hash, record-to-head derivation, required-head continuity checks, replay-derived head return value, and focused falsification tests.

Tests that would falsify it: continuity accepts no local tombstone records while a required head exists; accepts local history behind the required head; accepts local history ahead of the required head; accepts a same-sequence different record hash; or accepts a required head whose hash does not match its body.

Axis surfaces that could later validate it: Axis C amnesiac recovery that requires v133 head currentness; Axis A finance recovery after target proof-history pruning; Axis B adapter pressure once accepted fixtures exist.

## Falsification Criteria

- `verifyProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPrunedStoreContinuity` must return the replay-derived v132 tombstone-store head.
- A matching required head must preserve valid pruned-store continuity.
- Missing local tombstone history with a required head must obstruct.
- Local history behind the required head must obstruct as stale.
- Local history ahead of the required head must obstruct as unwitnessed advance.
- Same-sequence divergent record hash must obstruct as fork.
- Hash-invalid required head must obstruct before it can authorize recovery.

## Active 10-Question Backlog

1. SQ81: What durable witness ledger recovers the v133 pruning tombstone-store head after amnesia?
2. SQ82: What quorum topology certifies the v133 pruning tombstone-store head instead of letting one observer define currentness?
3. SQ83: What authority-transition store makes that topology replayable across agents and restarts?
4. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v133 pruning tombstone-store head?
5. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v133 pruning tombstone-store head certification?
6. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
7. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, and required-head stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
8. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
9. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
10. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?

## Failed Assumption Ledger

- Falsified: replay-valid v132 tombstone history is enough currentness. It proves local coherence, not admissible current state.
- Still open: the required v133 head can still be supplied by a caller until SQ81 adds durable witness recovery.
- Still open: split histories across agents require transparency/gossip or monitor comparison beyond this local required-head check.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead`
- `computeProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadHash`
- `projectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadFromRecord`
- required-head checks in `verifyProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPrunedStoreContinuity`

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ80 is closed. SQ81 is now the active next substrate question.

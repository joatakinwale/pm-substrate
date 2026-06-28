# v134 - History-Store Head Pruning Tombstone-Store Head Pruning Tombstone-Store Head Witness Ledger

Date: 2026-06-27
Question closed: SQ81

## Research Question

What durable witness ledger recovers the v133 pruning tombstone-store head after amnesia?

## Sources

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.usenix.org/legacy/events/sosp07/tech/full_papers/haeberlen/haeberlen.pdf
- Chun et al., "Attested Append-Only Memory: Making Adversaries Stick to their Word", SOSP 2007: https://people.eecs.berkeley.edu/~kubitron/courses/cs262a-F21/handouts/papers/a2m-sosp07.pdf
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE S&P 2016: https://arxiv.org/pdf/1503.08768

## Mechanism Extracted

PeerReview and A2M sharpen the missing mechanism: a process-local memory of a current head is not accountable state. The recoverable object is an append-only sequence of observations whose entries can be replayed and whose decisions can be recomputed from prior accepted history. CoSi adds the next pressure: witnesses should eventually become topology-bound, but the first missing primitive is the durable witness log itself.

The substrate adaptation is a witness ledger for the v133 pruning tombstone-store head. Each observation records the observed head, optional replay consistency proof over v132 pruning tombstone records, the replay-derived decision, previous observation hash, and observation hash. An amnesiac agent replays the ledger, recomputes each decision from prior accepted heads, rejects tampering, and recovers the latest accepted required head without trusting conversation state, summaries, connector caches, adapter objects, or worktree-local snapshots.

## Existing Substrate Map

- v133 can derive a compact head from replayed v132 pruning tombstone records and compare local history to a required head.
- Earlier layers already use durable witness ledgers to recover required heads for v111 and v122 currentness objects.
- v132 tombstone records remain the authority-scoped transition history that proves the observed v133 head's consistency.

## Missing Substrate Map

- Before v134, the required v133 head could still be supplied by caller memory, adapter state, connector cache, or a single process snapshot.
- v133 continuity could reject stale or forked local tombstone histories only after receiving a required head; it could not recover that head from admitted history.
- The missing primitive was a durable witness ledger specific to the v133 head, with replayed consistency proof and deterministic decision recomputation.
- Still missing after v134: topology-bound quorum for this witness ledger, durable witness authority stores, key-status replay, finality seals, witness-ledger compaction, split-history gossip, and generic recovery inventory across all nested currentness layers.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head pruning tombstone-store head witness ledger.

Problem it solves: prevents the v133 required head from being operational state merely because an agent remembers it, an adapter supplies it, or a local snapshot claims it.

Research source: PeerReview, A2M, and CoSi.

Mechanism borrowed: accountable append-only observation histories whose replay recomputes state, with future witness/topology pressure from cosigning systems.

Why current substrate lacked it: v133 added a required-head comparison but did not make the required head itself recoverable from durable admission history.

Why existing primitives are insufficient: v132 tombstone replay proves the local tombstone history; v133 head comparison proves local currentness against a supplied head. Neither proves where the supplied head came from.

State guarantee it should create: an amnesiac agent can recover the latest accepted v133 required head from hash-linked witness records alone, and any tampered or forked witness history becomes an obstruction.

Admission rule it requires: a witness observation is accepted only when the observed head is hash-valid, tenant-aligned, non-regressing, non-forking, and either initial at sequence 1 or accompanied by a v132 tombstone consistency proof from the beginning or latest accepted head.

Replay rule it requires: sort witness records by sequence, check previous-hash linkage and record hash, reconstruct the observation, recompute the decision from prior accepted heads and v132 proof replay, and merge only accepted heads into the recovered projection.

Authority boundary it requires: `projection_replay_pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_ledger`.

Failure modes it should prevent: required head supplied from memory, tampered witness records, non-contiguous witness history, broken observation hash chains, decision drift, stale head recovery, and same-sequence fork replacement.

Minimal implementation slice: v133 head consistency proof verification, witness observation evaluation, witness record hashing/replay, in-memory and Postgres witness ledgers, ledger-backed witness facade, migration `0057`, and focused falsification tests.

Tests that would falsify it: replay fails to recover the latest accepted required head; strict continuity cannot consume the recovered head; tampered observation hashes still replay; same-sequence fork overwrites accepted currentness; or replay accepts a decision that cannot be recomputed from prior accepted heads.

Axis surfaces that could later validate it: Axis C amnesiac recovery after v132 tombstone pruning; Axis A finance replay after target proof-history pruning; Axis B adapter pressure once accepted fixtures exist.

## Falsification Criteria

- Replayed v134 witness records must recover the latest accepted v133 head after the process forgets local variables.
- The recovered head must satisfy strict v133 pruned-store continuity when paired with replayed v132 tombstone records and retained suffixes.
- Tampering with the witness record hash must make replay invalid.
- A same-sequence fork must be recorded as an obstruction and must not replace the latest accepted head.
- Replay must recompute the stored decision; a hand-edited decision must not become operational state.

## Active 10-Question Backlog

1. SQ82: What quorum topology certifies the v133 pruning tombstone-store head instead of letting one observer define currentness?
2. SQ83: What authority-transition store makes that topology replayable across agents and restarts?
3. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v133 pruning tombstone-store head?
4. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v133 pruning tombstone-store head certification?
5. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
6. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, and required-head stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
7. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
8. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
9. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
10. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?

## Failed Assumption Ledger

- Falsified: passing a required v133 head into continuity is enough to make it substrate state. Without durable witness replay, it can still be caller memory.
- Falsified: internal replay validity of v132 tombstones plus v133 head comparison recovers currentness after amnesia. The required head also needs a replay source.
- Still open: one witness is not certification. SQ82 must add topology/quorum pressure before this head can be treated as certified currentness under stricter recovery modes.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadConsistencyProof`
- `evaluateProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadObservation`
- `buildProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecord`
- `replayProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords`
- `InMemoryProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessLedger`
- `PostgresProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessLedger`
- `LedgerBackedProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitness`
- migration `0057_agent_state_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness.sql`

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ81 is closed. SQ82 is now the active next substrate question.

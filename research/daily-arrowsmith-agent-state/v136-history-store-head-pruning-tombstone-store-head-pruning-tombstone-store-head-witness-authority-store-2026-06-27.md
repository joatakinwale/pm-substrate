# v136 - History-Store Head Pruning Tombstone-Store Head Pruning Tombstone-Store Head Witness Authority Store

Date: 2026-06-27
Question closed: SQ83

## Research Question

What authority-transition store makes the v135 topology replayable across agents and restarts?

## Sources

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Chun et al., "Attested Append-Only Memory: Making Adversaries Stick to Their Word", SOSP 2007: https://www.read.seas.harvard.edu/~kohler/class/08w-dsi/chun07attested.pdf
- Li et al., "Secure Untrusted Data Repository (SUNDR)", OSDI 2004: https://www.scs.stanford.edu/~dm/home/papers/li%3Asundr.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf

## Mechanism Extracted

PeerReview makes the authority-store pressure explicit: a node's behavior is accountable only when enough of its inputs, outputs, and internal steps are written to tamper-evident history for later replay. A2M narrows the primitive: append-only memory turns "what I said before" into an externally checkable chain, preventing an actor from presenting two incompatible histories without evidence. SUNDR and CONIKS add the client-facing split-history lesson: locally valid history is not enough forever; the store must at least make the binding durable and replayable, and later transparency/gossip can detect equivocation across observers.

The substrate adaptation is a durable v135 authority-transition store. The v135 witness topology is no longer allowed to arrive as an in-memory array, adapter option, connector cache, or agent summary. It must be appended into an authority-scoped, hash-chained transition history whose append path immediately replays the whole topology. Store-backed certification derives the effective topology by listing those transitions, replays v134 witness records from their witness ledger, and only then evaluates a quorum certificate for the v133 pruning tombstone-store head.

## Existing Substrate Map

- v133 derives the required pruning tombstone-store head from replayed v132 tombstone history.
- v134 recovers that required head from hash-linked witness observations after amnesia.
- v135 defines membership and threshold topology plus quorum-certificate evaluation, but before v136 callers still supplied the topology transitions directly.
- Earlier v125 proved the pattern on the previous layer: durable topology history plus a store-backed certifier is the substrate boundary that separates replayed authority from process memory.

## Missing Substrate Map

- Before v136, v135 certification could be correct in pure replay while still operationally depending on a caller-owned transition array.
- A restarted agent could replay witness observations but still need memory or configuration to know which witnesses count.
- The Postgres schema had durable v134 witness observations but no durable v135 witness-authority history.
- Append-time authority validation was missing for this layer, so invalid quorum rules or malformed topology could exist outside the replay boundary until evaluation time.
- Still missing after v136: signature/key-status replay for v135 witness evidence, epoch seals/finality, durable quorum-certificate proof records, live Postgres restart proof, split-history transparency/gossip, storage-level guards, generic recovery, generic pruning-policy compilation, and authority-store compaction rules.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head pruning tombstone-store head witness authority-transition store.

Problem it solves: prevents v135 topology from being operational state when supplied by private memory, summaries, local arrays, connector cache, or adapter configuration.

Research source: PeerReview, A2M, SUNDR, and CONIKS.

Mechanism borrowed: tamper-evident append-only authority history whose current projection is derived by replay, with later split-history detection left as the next transparency pressure.

Why current substrate lacked it: v135 had authority transitions and topology replay, but no durable store contract or store-backed certifier for that target layer.

Why existing primitives are insufficient: a pure replay function proves an array is internally valid; it does not prove the array came from admitted authority history or survives agent amnesia.

State guarantee it should create: v135 witness topology can authorize required-head certification only when recovered from durable, hash-linked, authority-scoped transition history.

Admission rule it requires: every appended topology transition must be assigned the next authority sequence, chained to the previous authority hash, and rejected unless the resulting full transition history replays validly at its effective pruning tombstone sequence.

Replay rule it requires: store-backed certification must list stored authority transitions, replay them into topology for the candidate head sequence, list v134 witness records, replay those records, and evaluate quorum against those two replayed projections.

Authority boundary it requires: `projection_replay_pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_authority`.

Failure modes it should prevent: topology supplied from memory, invalid quorum transition admission, missing topology certification after restart, single-store omission of eligible witnesses, unauthorized witness counting, and strict continuity using a certificate whose topology was not store-derived.

Minimal implementation slice: in-memory and Postgres v136 authority-transition stores, append-time replay validation, migration `0058`, store-backed v136 quorum certifier, row mapper/select columns, and focused tests.

Tests that would falsify it: invalid `set_quorum` appends; an empty authority store still certifies; a store missing one witness counts that witness; store-backed certification cannot certify from stored valid topology plus stored v134 witness rows; or strict continuity rejects a certified store-backed quorum certificate.

Axis surfaces that could later validate it: Axis C amnesiac agent resume, Axis A finance pruning recovery after restarts, and Axis B adapter pressure once runtime recovery consumes store-backed topology instead of fixture arrays.

## Falsification Criteria

- Appending a zero-required-witness quorum transition must be rejected and must not mutate the authority store.
- Replaying transitions listed from the durable store must reconstruct the same eligible witness topology as the original append history.
- Store-backed certification with stored v135 topology plus stored v134 witness rows must certify the exact v133 head.
- An empty authority store must obstruct certification through invalid topology.
- A store that admits only one of two required witnesses must mark the other witness invalid and must not certify.
- Strict v133 continuity must accept the store-backed certified quorum certificate as required-head currentness.

## Active 10-Question Backlog

1. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v133 pruning tombstone-store head?
2. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v133 pruning tombstone-store head certification?
3. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
4. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, and required-head stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
5. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
6. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
7. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
8. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
9. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
10. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?

## Failed Assumption Ledger

- Falsified: a replay-valid topology array is enough operational authority. v136 proves topology authority must itself be recovered from an admitted store.
- Falsified: witness replay plus pure topology replay is restart-independent. Without the v136 store, a resumed agent still needs private topology representation.
- Still open: the durable authority store is locally replayable but has no v135 signature/key-status replay, epoch finality, durable QC proof records, or split-history transparency yet.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`
- `InMemoryProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`
- `PostgresProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`
- `StoreBackedProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier`
- migration `0058_agent_state_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_authority.sql`

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`
- `git diff --check`
- `pnpm typecheck`
- `pnpm test`

Outcome: SQ83 is closed. SQ84 is now the active next substrate question.

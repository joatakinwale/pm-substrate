# v102 Durable Pruning Tombstone-Store Head Witness Authority Store

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v101-pruning-tombstone-store-head-witness-quorum-topology-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ49 - What durable pruning tombstone-store head witness authority-transition store prevents adapters from supplying synthetic quorum topology for certified required-head recovery?

Answer: quorum topology for pruning tombstone-store head currentness is now admitted transition history, not a caller-supplied object. `@pm/agent-state` can append hash-linked pruning tombstone-store head witness authority transitions to in-memory or Postgres-backed stores, replay those stores into topology, and certify a required pruning tombstone-store head through a store-backed certifier that loads both authority transitions and witness records before evaluating quorum.

Implemented slice:

- Added durable store contracts for pruning tombstone-store head witness authority transitions.
- Added in-memory and Postgres-backed transition stores.
- Added a Postgres migration for the new authority-transition table.
- Added store-backed quorum certification for the pruning tombstone-store head witness layer.
- Extended focused tests so stored transitions chain deterministically, malformed quorum policy cannot append, and store-backed certification derives topology from stored authority history.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Tamper-evident logs make a sequence of statements authoritative only through append order, hash commitments, and auditability. | Authority topology is persisted as a hash-linked transition history; replay, not adapter memory, reconstructs the topology used for certification. |
| Alvisi et al. 2000, "Dynamic Byzantine Quorum Systems" ([PDF](https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf)) | Quorum membership and thresholds are dynamic state that must change through controlled protocols while preserving consistency. | Witness eligibility and quorum threshold are durable authority transitions, so changing topology is state history rather than local configuration. |
| Levin et al. 2009, "TrInc: Small Trusted Hardware for Large Distributed Systems" ([PDF](https://www.usenix.org/legacy/event/nsdi09/tech/full_papers/levin/levin.pdf)) | Equivocation can be reduced by binding claims to monotonic identities/counters rather than allowing actors to issue conflicting histories. | The store is the software substrate analogue for this layer: topology claims are monotonic authority-sequence entries chained by previous hash. Signature-bound monotonic identity remains SQ50. |

## 3. Existing Substrate Map Delta

Already present before v102:

1. v100 added durable pruning tombstone-store head witness records.
2. v101 added authority-transition replay, witness eligibility projection, quorum certificate evaluation, and strict continuity rejection of missing or non-certified required-head certificates.
3. v101 could still evaluate a topology object supplied directly by a caller.

Newly added by v102:

1. `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`.
2. In-memory and Postgres-backed stores for the v101 authority transitions.
3. Append-time replay validation for stored authority transitions.
4. Store-backed pruning tombstone-store head witness quorum certification.
5. Migration `0042_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_authority.sql`.
6. Tests proving stored transition chaining and store-derived certification.

## 4. Missing Substrate Map Delta

Still missing:

1. Signature-bound pruning tombstone-store head witness identity.
2. Key-status replay and rotation for pruning tombstone-store head witness signatures.
3. Non-retroactive authority epoch seals for this new topology layer.
4. Durable quorum-certificate proof records for certified pruning tombstone-store heads.
5. Proof-preserving compaction and pruning for this new authority store and certificate history.
6. Runtime recovery integration that forces strict paths to use the store-backed certifier.
7. Live Postgres restart tests for cross-process certified required-head recovery.
8. Axis A/B/C pressure proving adapters cannot bypass store-backed topology replay.
9. Production cryptographic verifier adapters for this new witness layer.
10. Monitoring that detects any caller still evaluating synthetic topology in write-adjacent paths.

## 5. Active 10-Question Backlog

The active unanswered substrate research backlog contains exactly 10 questions:

1. SQ02: What typed authority topology should replace raw `authorityScope` strings so delegation, override, and revocation are replayable?
2. SQ03: What admission calculus composes evidence admission, provider status, terminal outcome, graph authority, and projection replay into one mutation decision?
3. SQ04: What replay rule makes connector cache, tool output, MCP handle state, and local filesystem/worktree state expire unless recertified?
4. SQ05: What obstruction algebra should represent disagreement between replay certificates, local views, authority scopes, and inter-agent consensus?
5. SQ06: What settlement/finality object proves an external target-side side effect was applied and cannot be replaced by a dispatch log?
6. SQ07: What recovery kernel lets an amnesiac agent rebuild all open operational scopes from terminal history, replay-certified projections, and continuity checkpoints?
7. SQ08: What domain authority compiler maps profile/capability contracts into required replay transitions without core substrate edits?
8. SQ09: What substrate primitive turns local worktree diffs and draft files into proposals that cannot outrank admitted transition history?
9. SQ10: What monitor/proof object can show that every operational write in a run passed replay-certificate enforcement, not just terminal-outcome recovery?
10. SQ50: What signature-bound pruning tombstone-store head witness identity prevents unsigned, wrong-key, or equivocated stored witness/topology evidence from counting toward certified required-head recovery?

## 6. Primitive Proposal Ledger

Name: Durable Pruning Tombstone-Store Head Witness Authority Store.

Problem it solves: v101 made quorum topology replayable as an object model, but certification could still receive that topology from process memory, an adapter, or a test fixture. That left a private-representation path into operational certification.

Research source: tamper-evident logging, dynamic Byzantine quorum systems, and anti-equivocation counters.

Mechanism borrowed or adapted: monotonic, append-only authority transition history. The current admissible topology is a projection of stored transitions, not a supplied runtime object.

Why current substrate lacked it: v101 had the transition algebra but not the durable store or certifier boundary that forces topology to come from replay.

Why existing primitives are insufficient: the older tombstone-head authority store governs a different state layer. Reusing it would let the wrong topology certify the new pruning tombstone-store head witness ledger.

State guarantee it should create: certified pruning tombstone-store head currentness can be recovered after amnesia from stored authority transitions plus stored witness records, without trusting conversation memory, connector cache, or caller topology.

Admission rule it requires: a new authority transition is admitted only by appending at the next authority sequence, chaining to the prior authority hash, and replaying the resulting history as valid.

Replay rule it requires: certification must list stored transitions, replay topology at the head's pruning tombstone sequence, list stored witness records, replay witness history, and evaluate quorum over those replay projections.

Authority boundary it requires: pruning tombstone-store head witness authority is a separate `@pm/agent-state` boundary. Adapters can request certification, but cannot supply the topology that defines eligible witnesses.

Failure modes it should prevent:

- a caller fabricating topology in memory and using it to certify a required head;
- malformed quorum thresholds becoming stored authority;
- broken previous-hash chains silently defining topology;
- an incomplete authority store certifying observations by unauthorized witnesses;
- resumed agents depending on conversation summaries to reconstruct witness eligibility.

Minimal implementation slice:

- Add authority-transition store interface.
- Add in-memory and Postgres implementations.
- Add a migration for the durable table.
- Add a store-backed certifier that derives topology from stored transitions.
- Extend the focused v101 test path to prove stored replay and store-backed certification.

Tests that would falsify it:

- Stored transition hashes do not match deterministic replay-built transitions.
- A malformed quorum policy appends successfully.
- Store-backed certification accepts a synthetic topology instead of the stored topology.
- Store-backed certification returns `certified` with only one stored eligible observer when the stored quorum requires two.
- Store-backed certification fails to certify after two stored eligible observers accept the exact same head.

Axis surfaces that could later validate it:

- Axis C can restart with only the durable authority store and witness ledger, then require store-backed certification.
- Axis A can attempt finance recovery with adapter-supplied topology and expect rejection or non-use.
- Axis B can require domain adapters to call store-backed certification rather than carrying topology in adapter state.

## 7. Falsification Criteria Applied Before Implementation

1. A malformed quorum transition with `minimumWitnesses > requiredWitnesses` must fail append-time replay validation.
2. The durable store must assign sequences and previous hashes, not accept caller-provided chain fields.
3. Store-backed certification with one accepted witness under a stored two-witness topology must return `witnessed`, not `certified`.
4. Store-backed certification after two stored eligible witnesses accept the same head must return `certified`.
5. Store-derived authority topology hash must match the stored authority transition head.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A replayable topology object is enough. | Rejected. | v102 adds a durable authority-transition store and store-backed certifier so topology comes from admitted history. |
| Store-backed certification can be deferred until runtime integration. | Rejected. | v102 implements the certifier as part of the substrate primitive because otherwise synthetic topology remains a certification input. |
| Append-only storage can accept malformed topology and rely on later evaluators. | Rejected. | v102 store append replays the candidate history and rejects invalid quorum policy. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`.
- `InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`.
- `PostgresProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`.
- `StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier`.
- Migration `0042_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_authority.sql`.

Remaining frontier:

1. Signature-bound witness/topology identity for this layer.
2. Key-status replay.
3. Authority epoch seals.
4. Durable quorum-certificate records.
5. Runtime and axis adoption.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v102-durable-pruning-tombstone-store-head-witness-authority-store-2026-06-26.md db/migrations/0042_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_authority.sql
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, migration, changelog, and ledger files found no matches.

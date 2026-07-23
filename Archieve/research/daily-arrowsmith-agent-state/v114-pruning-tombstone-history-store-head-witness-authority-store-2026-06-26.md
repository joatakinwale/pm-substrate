# v114 Pruning Tombstone History Store-Head Witness Authority Store

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v113-pruning-tombstone-history-store-head-witness-quorum-authority-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ61 - What durable authority-transition store makes the v113 pruning tombstone history-store head witness topology recoverable after amnesia instead of supplied as in-memory transition arrays?

Answer: v113 made certified required-head currentness depend on replayed topology and signed witnesses, but the topology could still be supplied as an in-memory transition array by the caller. The missing substrate primitive is a durable authority-transition store for pruning tombstone history-store head witness topology, plus a store-backed certifier that derives eligibility and thresholds from stored transition replay before evaluating signed witness rows.

Implemented slice:

- Added a v114 authority-transition append input and store interface for the v113 topology.
- Added in-memory and Postgres-backed authority-transition stores.
- Added append-time replay validation so malformed quorum or broken transition history cannot enter the durable store.
- Added `StoreBackedProjectionReplayPruningTombstoneHistoryStoreHeadWitnessQuorumCertifier`.
- Added migration `0048_agent_state_projection_replay_pruning_tombstone_history_store_head_witness_authority.sql`.
- Extended focused agent-state tests to prove store-derived two-witness certification, incomplete-store obstruction, and invalid durable quorum-transition rejection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro), [PDF](https://raft.github.io/raft.pdf)) | System state is driven by a replicated log of commands; configuration/state-machine changes are ordered log entries rather than local facts. | History-store-head witness topology must be recovered from a durable authority-transition log, not passed in by an adapter. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" ([ACM](https://dl.acm.org/doi/10.1145/128765.128770), [PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery repeats durable history rather than trusting memory images; log sequence and redo determine recoverable state. | After amnesia, witness eligibility and thresholds are replayed from stored authority transitions before certification can proceed. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([ACM](https://dl.acm.org/doi/10.5555/1855768.1855788), [PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Append-only logs need tamper-evident commitments so clients can challenge omission or modification. | Authority transitions carry sequence numbers, previous hashes, and authority hashes; replay rejects broken stored topology history. |
| Li, Krohn, Mazieres, and Shasha 2004, "Secure Untrusted Data Repository (SUNDR)" ([USENIX](https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr), [PDF](https://www.scs.stanford.edu/~dm/home/papers/li%3Asundr.pdf)) | Untrusted storage can be used when clients can detect forked or inconsistent histories. | A topology store is not trusted because it is a database; it is trusted only when its hash-linked authority history replays. |

## 3. Existing Substrate Map Delta

Already present before v114:

1. V112 durable witness-ledger recovery for pruning tombstone history-store heads.
2. V113 topology replay and quorum certificate evaluation for signed v112 witness rows.
3. V113 strict signature replay against a supplied history-store-head topology.
4. Postgres persistence for v112 witness observations and signatures.
5. Parent-layer durable authority stores proving the pattern is substrate logic rather than axis logic.

Newly added by v114:

1. A durable authority-transition store contract for v113 topology.
2. In-memory and Postgres store implementations.
3. Append-time replay validation before authority transitions can enter the store.
4. A Postgres migration for the authority-transition table.
5. Store-backed quorum certification that derives topology from stored transition replay plus stored witness rows.
6. Focused falsifiers for incomplete stored topology and invalid stored quorum transitions.

## 4. Missing Substrate Map Delta

Still missing:

1. Key-status replay and revocation for v114 history-store head witness signatures.
2. Authority epoch seals for non-retroactive v114 currentness.
3. Durable quorum-certificate proof records for certified v114 heads.
4. Proof-preserving compaction and checkpoint admission for v114 witness, authority, and certificate histories.
5. Pruning admission and tombstone-gated deletion for v114 histories.
6. Runtime and Axis adoption of v114 store-backed certified required heads.
7. Live Postgres restart proof for v114 store-backed certification.
8. A generic nested currentness/witness abstraction that stops hand-repeating layered head ledgers.
9. A recovery kernel that inventories every compacted required head and reconstructs it without memory or adapter state.
10. Production cryptographic adapters for witness signature verification.

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
10. SQ62: What key-status replay and rotation semantics prevent revoked or superseded v114 pruning tombstone history-store head witness keys from authorizing certified currentness?

## 6. Primitive Proposal Ledger

Name: Durable Pruning Tombstone History Store-Head Witness Authority Store.

Problem it solves: v113 certification could still receive topology as a caller-supplied in-memory array. That leaves a path for adapters, summaries, or local snapshots to smuggle witness eligibility and thresholds into certification.

Research source: Raft replicated logs, ARIES recovery logging, tamper-evident logs, and SUNDR fork consistency.

Mechanism borrowed or adapted: authority topology is a recovered projection of an append-only ordered transition history. The current topology is not an object passed into certification; it is replayed from durable stored transitions whose sequence and hash chain are checked.

Why current substrate lacked it: v113 had transition replay functions but no store contract, no Postgres persistence, and no store-backed certifier for this layer.

Why existing primitives are insufficient: parent-layer authority stores do not govern this newly introduced history-store-head witness topology. Reusing them would let one layer's authority leak into another.

State guarantee it should create: certified pruning tombstone history-store head currentness derives witness eligibility and thresholds from stored authority-transition replay.

Admission rule it requires: a transition is appended only if the full existing-plus-new history replays as valid for the transition's effective pruning tombstone sequence.

Replay rule it requires: certification lists stored transitions, replays them into a topology for the requested head sequence, replays witness rows under that topology-bound signature policy, then evaluates quorum certification.

Authority boundary it requires: adapters, tools, connector caches, local snapshots, or agent summaries cannot provide topology directly as operational authority.

Failure modes it should prevent:

- a caller passing synthetic topology to certify a recovered head;
- a malformed quorum transition entering the authority store;
- a missing admitted witness silently counting through caller policy;
- stored witness rows being validated against a topology that was not recovered from durable history;
- an amnesiac agent requiring conversation memory to reconstruct witness eligibility.

Minimal implementation slice:

- Add store contract and append input.
- Add in-memory and Postgres stores.
- Add migration `0048`.
- Add store-backed certifier.
- Add focused tests for store-backed success and stored-topology falsifiers.

Tests that would falsify it:

- Store-backed certification succeeds when the authority store is missing an admitted witness required by witness evidence.
- A malformed stored quorum transition appends successfully.
- Store-backed certification uses caller-supplied topology instead of replaying the store.
- Stored transition hash-chain corruption replays as valid.

Axis surfaces that could later validate it:

- Axis C can restart an amnesiac agent and require it to derive v114 topology from the authority store before consuming a certified required head.
- Axis A can test finance pruned-row recovery where a domain adapter attempts to supply synthetic witness topology.
- Axis B can prove domain adapters cannot certify required heads without substrate-owned topology stores.

## 7. Falsification Criteria Applied Before Implementation

1. A store-backed certifier with stored quorum plus two stored witness admissions certifies the exact v112 recovered head.
2. A store-backed certifier with only one stored witness admission does not certify a two-witness required topology.
3. An invalid quorum transition is rejected before it enters the authority store.
4. The store-backed certifier succeeds with a signature policy that does not already contain a caller-supplied history-store-head topology.
5. The store-backed certificate exposes the stored authority topology hash.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| v113 topology replay is enough even when transitions are supplied by the caller. | Rejected. | Caller-supplied transition arrays can originate in memory or adapter code; the substrate needs a durable store. |
| Witness signatures alone prevent synthetic topology. | Rejected. | Signatures bind observations to principals, but the principal set and thresholds are topology state. |
| A database row is authority by itself. | Rejected. | Rows count only after sequence, previous-hash, and transition-hash replay succeeds. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionAppendInput`.
- `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionStore`.
- `InMemoryProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionStore`.
- `PostgresProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitionStore`.
- `StoreBackedProjectionReplayPruningTombstoneHistoryStoreHeadWitnessQuorumCertifier`.
- Migration `0048_agent_state_projection_replay_pruning_tombstone_history_store_head_witness_authority.sql`.
- Focused tests for store-backed certification, incomplete store obstruction, and invalid quorum append rejection.

Remaining frontier:

1. SQ62 key-status replay for v114 witness signatures.
2. Non-retroactive authority epoch seals.
3. Durable quorum-certificate proof records.
4. Proof-preserving compaction and checkpoint admission for v114 histories.
5. Runtime/Axis adoption and live Postgres restart proof.
6. Generic recovery kernel and nested currentness abstraction.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run passed via the targeted command: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root package typecheck passed across 22 of 23 workspace projects.
- `git diff --check` passed.

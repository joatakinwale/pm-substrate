# v110 Pruning Tombstone-Store Head Pruning Tombstone Store API

Date: 2026-06-26
Status: substrate primitive implemented; focused and root Vitest verification passed
Parent: `research/daily-arrowsmith-agent-state/v109-pruning-tombstone-store-head-compaction-pruning-admission-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ57 - What tombstone-gated store pruning API and durable tombstone record make pruning tombstone-store head witness, authority, and quorum-certificate row deletion replayable and out-of-band truncation detectable?

Answer: pruning admission still was not enough. A row deletion must be represented by its own hash-linked durable tombstone record. Store pruning APIs must consume that record, derive lane frontiers from it, and continuity verification must replay the tombstone ledger plus retained suffixes after physical deletion. Otherwise an agent could treat missing rows as an authorized compacted state without replaying the deletion authority that made them absent.

Implemented slice:

- Added pruning tombstone-store head replay compaction pruning tombstone record/frontier/replay/continuity types.
- Added deterministic pruning tombstone record hashing and record-chain replay.
- Added in-memory and Postgres-backed pruning tombstone record stores.
- Added migration `0046_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_pruning_tombstones.sql`.
- Added tombstone-gated prune APIs for pruning tombstone-store head witness, authority, and quorum-certificate stores.
- Added pruned-store continuity verification that detects invalid tombstone replay, invalid retained suffix replay, and out-of-band retained-suffix truncation.
- Extended focused agent-state tests to prove append/replay, hash-tamper rejection, guarded physical pruning, post-prune continuity, and silent truncation detection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| O'Neil et al. 1996, "The Log-Structured Merge-Tree (LSM-tree)" ([PDF](https://dsf.berkeley.edu/cs286/papers/lsm-acta1996.pdf)) | High-write stores handle deletion as a logged operation instead of in-place memory erasure. | Row absence in compacted substrate stores must come from an admitted tombstone transition, not local truncation. |
| Sarkar et al. 2023, "Enabling Timely and Persistent Deletion in LSM-Engines" ([ACM](https://dl.acm.org/doi/abs/10.1145/3599724), [author PDF](https://subhadeep.net/assets/fulltext/Enabling_Timely_and_Persistent_Deletion_in_LSM-Engines.pdf)) | Delete-aware compaction separates logical deletion markers from physical persistence of deletion, and makes deletion policy explicit. | v110 separates pruning admission from physical deletion by persisting a tombstone record whose replay authorizes the actual row pruning frontier. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident), [PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Append-only authenticated logs make deletion and audit proofs challengeable after the fact. | The pruning tombstone ledger is hash-linked and replayable so a later agent can distinguish authorized row absence from out-of-band truncation. |

## 3. Existing Substrate Map Delta

Already present before v110:

1. Durable pruning tombstone-store head witness records.
2. Durable pruning tombstone-store head witness authority/key/seal transitions.
3. Durable pruning tombstone-store head quorum-certificate proof records.
4. Admitted pruning tombstone-store head replay compaction checkpoints.
5. Durable checkpoint-admission record replay for those checkpoints.
6. Pruning admission over durable checkpoint-admission history and retained suffix replay.

Newly added by v110:

1. A hash-linked pruning tombstone ledger for actual row deletion at this layer.
2. Replay rules for pruning tombstone sequence continuity, previous hashes, checkpoint/admission binding, frontier derivation, frontier regression, and record hashes.
3. In-memory and Postgres stores for the pruning tombstone ledger.
4. Store-level prune methods that refuse to delete unless a replay-valid tombstone record admits the requested lane.
5. Pruned-store continuity verification after deletion.
6. Durable SQL schema for the new tombstone ledger.

## 4. Missing Substrate Map Delta

Still missing:

1. Pruning tombstone-store head currentness/witnessing for this new v110 pruning tombstone ledger.
2. Runtime and Axis adoption of the v110 tombstone-gated pruning APIs.
3. Live Postgres restart proof that v110 pruning survives process amnesia.
4. Direct SQL-delete hardening across the compactable lanes.
5. Cross-agent monitoring for v110 tombstone histories.
6. Historical-vs-current replay policy after later key rotation or revocation.
7. A general substrate abstraction that prevents manual repetition across checkpoint/pruning/tombstone layers.
8. A compact proof object that can attest physical row absence without loading full suffixes.
9. Integration with a substrate-native recovery kernel that inventories all compacted scopes after resume.
10. Production crypto adapters for witness signatures, quorum evidence, and admission verification.

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
10. SQ58: What pruning tombstone-store head currentness or witness rule prevents a replay-valid but stale, forked, or unwitnessed v110 pruning tombstone history from authorizing pruned required-head projections?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Store Head Pruning Tombstone Store API.

Problem it solves: v109 admitted pruning intent, but physical row absence still had no durable transition at this layer. A local SQL delete, test helper, or adapter-side truncation could make rows disappear and later be mistaken for authorized compacted state.

Research source: LSM-tree logged deletion, delete-aware persistent compaction, and tamper-evident logging.

Mechanism borrowed or adapted: make deletion an append-only replay object before physical absence can be accepted. The tombstone records the compacted lane frontiers and chains to prior tombstones; the store API uses that object to derive the deletion frontier.

Why current substrate lacked it: the pruning tombstone-store head layer had pruning admission but no durable record of actual deletion and no store method requiring such a record.

Why existing primitives are insufficient: parent tombstone APIs govern other namespaces. The v109 pruning admission proves a decision was admissible, not that a specific row deletion happened and can be replayed after restart.

State guarantee it should create: missing pruning tombstone-store head witness, authority, or quorum-certificate rows are operationally acceptable only when a replay-valid pruning tombstone record admitted their lane frontier and the retained suffix still replays.

Admission rule it requires: a pruning tombstone record is appendable only if the checkpoint admission record hash replays, the pruning admission hash matches, the admission is admitted, the pruned frontiers equal the admitted checkpoint snapshots, and frontiers do not regress.

Replay rule it requires: after amnesia, replay sorts tombstone records by sequence, verifies tenant/previous-hash/hash/admission/checkpoint/frontier consistency, and derives the latest pruned frontier per lane.

Authority boundary it requires: row deletion is scoped to pruning tombstone-store head witness replay compaction; checkpoint records, pruning admissions, local snapshots, process memory, adapter code, and SQL row absence cannot independently authorize deletion.

Failure modes it should prevent:

- physical row deletion without a durable tombstone;
- stale checkpoint/admission summaries authorizing deletion;
- deleted witness rows being accepted without retained witness suffix replay;
- deleted authority rows being accepted without retained authority suffix replay;
- deleted quorum-certificate rows being accepted without retained QC suffix replay;
- tampered tombstone hashes authorizing pruning;
- out-of-band truncation after an admitted tombstone.

Minimal implementation slice:

- Add pruning tombstone record/frontier/replay/continuity types.
- Add in-memory and Postgres pruning tombstone stores.
- Add store prune APIs gated by replay-valid tombstone records.
- Add a migration for durable tombstone persistence.
- Add focused tests for append/replay, tamper rejection, physical pruning, continuity, and silent truncation.

Tests that would falsify it:

- A tampered pruning tombstone record can prune rows.
- A row store can prune without a pruning tombstone record.
- Pruned-store continuity passes after the retained witness suffix is silently truncated.
- Replay accepts a tombstone whose frontiers do not match the checkpoint.
- Replay accepts duplicate/regressing lane frontiers.
- A restart cannot recover the tombstone ledger from durable rows.

Axis surfaces that could later validate it:

- Axis C can prune a compacted local agent-state lane and then require an amnesiac replay to recover continuity only from tombstones plus retained suffixes.
- Axis A can attempt finance-state recovery after out-of-band deletion and require v110 continuity to obstruct.
- Axis B can prove a domain adapter cannot smuggle row absence as state by deleting profile-owned backing rows.

## 7. Falsification Criteria Applied Before Implementation

1. A valid pruning admission can append a durable pruning tombstone record.
2. The pruning tombstone record replays to the expected witness, authority, and quorum-certificate frontiers.
3. A tampered pruning tombstone record hash is rejected by replay and by prune APIs.
4. Store prune APIs physically remove only rows at or before the tombstone frontier.
5. Retained suffixes replay after physical pruning.
6. Pruned-store continuity rejects out-of-band retained witness suffix truncation.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A pruning admission object is enough to make physical row absence replayable. | Rejected. | v109 admitted deletion intent but did not record the actual deletion transition or expose a store API that consumed it. |
| Store pruning can be a helper layered outside substrate logic. | Rejected. | Physical absence changes what can become operational state, so pruning must be substrate logic. |
| Retained suffix replay before pruning is enough. | Rejected. | Replay after amnesia also needs the tombstone history explaining why compacted prefix rows are absent. |

## 9. Implementation Frontier

Implemented now:

- Pruning tombstone-store head replay compaction pruning tombstone record types.
- Deterministic tombstone record hashing and replay.
- In-memory/Postgres pruning tombstone record stores.
- Migration `0046_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_pruning_tombstones.sql`.
- Tombstone-gated prune APIs for witness, authority, and quorum-certificate stores.
- Pruned-store continuity checks for retained suffix replay and truncation detection.
- Focused tests proving admitted record append, tamper obstruction, physical pruning, continuity, and out-of-band truncation detection.

Remaining frontier:

1. Currentness/witnessing for the v110 pruning tombstone ledger.
2. Runtime and Axis adoption.
3. Live Postgres restart proof.
4. Direct SQL-delete hardening.
5. Generalized compaction/pruning/tombstone abstraction.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.

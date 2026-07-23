# v111 Pruning Tombstone-Store Head Pruning Tombstone History Currentness

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v110-pruning-tombstone-store-head-pruning-tombstone-store-api-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ58 - What pruning tombstone-store head currentness or witness rule prevents a replay-valid but stale, forked, or unwitnessed v110 pruning tombstone history from authorizing pruned required-head projections?

Answer: replay validity of the v110 pruning tombstone ledger is necessary but not sufficient. A locally replay-valid tombstone history can still be stale relative to the current required tombstone history, forked at the same sequence, or advanced beyond the externally witnessed/required head. Pruned-store continuity therefore needs a first-class replay-derived pruning tombstone-store head for the v110 tombstone ledger and a required-head currentness check before pruned state can authorize projection recovery.

Implemented slice:

- Added a v110 pruning tombstone-store head type derived from replayed pruning tombstone records.
- Added deterministic v110 pruning tombstone-store head hashing.
- Added `requiredPruningTombstoneStoreHead` to v110 pruned-store continuity.
- Added `pruningTombstoneStoreHead` continuity output so recovery exposes the replay-derived current head.
- Added obstruction codes for missing, stale, unwitnessed-advance, same-sequence forked, and hash-invalid required heads.
- Extended focused agent-state tests to prove valid required-head continuity plus all currentness obstruction paths.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Li, Krohn, Mazieres, and Shasha 2004, "Secure Untrusted Data Repository (SUNDR)" ([USENIX PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf), [USENIX page](https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr)) | Fork consistency: an untrusted storage service cannot present divergent histories without forcing later detectable separation between clients. | A replay-valid local pruning tombstone history cannot authorize state unless its head matches the required head; same-sequence divergence becomes an obstruction instead of local authority. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Clients monitor signed directory snapshots for consistency and currentness rather than trusting a provider's latest returned view. | Pruned-store recovery compares the replay-derived tombstone head against a required committed head instead of trusting the local tombstone prefix or agent summary. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident), [PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Log clients audit present log state against prior commitments and inclusion/consistency proofs. | The v110 tombstone ledger now has a stable head commitment; continuity can reject hash-invalid required heads and local histories that do not equal the required commitment. |

## 3. Existing Substrate Map Delta

Already present before v111:

1. Durable v110 pruning tombstone records for actual row deletion.
2. Replay validation for v110 tombstone sequences, previous hashes, checkpoint/admission binding, frontiers, and record hashes.
3. Tombstone-gated prune APIs for witness, authority, and quorum-certificate stores.
4. Retained suffix continuity checks after physical pruning.
5. Older tombstone-head layers with required-head currentness and witness/quorum ladders.

Newly added by v111:

1. A stable v110 pruning tombstone-store head identity object.
2. A deterministic hash rule for that head.
3. A replay-to-head projection from the latest v110 tombstone record.
4. A v110 pruned-store currentness admission rule comparing the replay-derived head with a required head.
5. Obstructions for missing local tombstone history, stale local history, local unwitnessed advance, same-sequence fork, and invalid required-head hash.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable witness or quorum history for the v111 required pruning tombstone-store head.
2. A recovery path that loads the required v111 head from durable witness history instead of caller memory.
3. Runtime and Axis adoption of v111 currentness.
4. Live Postgres restart proof for v110/v111 pruning tombstone history plus currentness.
5. Direct SQL-delete hardening across compactable lanes.
6. Cross-agent monitors that exchange v111 heads and surface forks.
7. A generic currentness abstraction to stop manually repeating head/currentness code at each compaction layer.
8. A compact proof object for physical row absence plus current head, without replaying full retained suffixes.
9. Integration with a substrate-native recovery kernel that inventories required heads for every compacted scope.
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
10. SQ59: What durable witness ledger or quorum certificate makes the required v111 pruning tombstone-store head recoverable after amnesia rather than supplied by memory, adapters, or a single local process?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Currentness Head.

Problem it solves: v110 made row absence replayable, but a locally replay-valid tombstone history could still be stale, forked, or locally advanced relative to the required current tombstone history.

Research source: SUNDR fork consistency, CONIKS key transparency snapshots, and tamper-evident log auditing.

Mechanism borrowed or adapted: reduce current history to a stable head commitment, then compare local replay-derived head against a required committed head before accepting pruned recovery.

Why current substrate lacked it: the v110 tombstone ledger had record replay and retained suffix continuity but no head identity or required-head admission rule for its own tombstone history.

Why existing primitives are insufficient: older tombstone-head currentness applies to parent ledgers. v110 introduced a new tombstone ledger whose stale/forked local history could still pass replay unless it got its own currentness boundary.

State guarantee it should create: pruned operational state at this layer is accepted only when the local v110 pruning tombstone history replays and its head equals the required admissible head.

Admission rule it requires: if a required v110 pruning tombstone-store head is supplied, its hash must match its body, local replay must produce a head, and local sequence/hash identity must equal the required head.

Replay rule it requires: after amnesia, replay the v110 tombstone ledger, derive the latest head from the latest valid tombstone record, and expose that head as the continuity projection.

Authority boundary it requires: memory, adapter input, connector cache, a local row set, or a replay-valid but non-current prefix cannot authorize pruned state without satisfying required-head currentness.

Failure modes it should prevent:

- missing local tombstone history authorizing pruned rows;
- stale local tombstone history authorizing a newer required state;
- same-sequence forked tombstone history authorizing row absence;
- local histories advanced beyond the required witnessed head;
- tampered required-head hashes being accepted as currentness evidence.

Minimal implementation slice:

- Add v110 pruning tombstone-store head type/hash/from-record helpers.
- Extend v110 pruned-store continuity input/output with required and replay-derived heads.
- Add currentness obstruction codes.
- Add focused tests covering accepted, missing, stale, unwitnessed-advance, forked, and hash-invalid required heads.

Tests that would falsify it:

- Continuity passes with no local tombstone records while a required head is supplied.
- Continuity passes when the required head sequence is ahead of local replay.
- Continuity passes when local replay has advanced beyond the required head.
- Continuity passes when local and required heads share a sequence but disagree on record hash.
- Continuity passes when the required head hash does not match its body.

Axis surfaces that could later validate it:

- Axis C can resume an amnesiac local agent with a stale tombstone ledger and require v111 continuity to obstruct.
- Axis A can delete finance supporting rows under an old tombstone prefix and require currentness to block recovery.
- Axis B can prove a domain adapter cannot supply a stale pruning tombstone history as profile state.

## 7. Falsification Criteria Applied Before Implementation

1. A replay-valid v110 tombstone history derives a stable head.
2. Pruned-store continuity returns that replay-derived head.
3. Continuity passes when the required head equals the replay-derived head.
4. Continuity rejects a missing local history when a required head exists.
5. Continuity rejects a future required head as stale local history.
6. Continuity rejects a lower required head as local unwitnessed advance.
7. Continuity rejects same-sequence forks.
8. Continuity rejects a required head whose hash does not match its body.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Replay-valid v110 pruning tombstone records are enough to authorize pruned state. | Rejected. | A replay-valid but stale or forked local tombstone prefix can still satisfy v110 replay without matching current required history. |
| Retained suffix continuity detects all unsafe row absence. | Rejected. | Suffix continuity proves rows retained after a tombstone frontier replay; it does not prove the tombstone frontier is the current required frontier. |
| The parent pruning tombstone-store head witness layer covers the new v110 tombstone ledger. | Rejected. | v110 created a separate ledger whose own head was absent before v111. |

## 9. Implementation Frontier

Implemented now:

- V110 pruning tombstone-store head identity and deterministic hashing.
- Replay-derived v110 head projection from latest tombstone record.
- V110 pruned-store required-head currentness checks.
- Focused tests for valid required head, missing local history, stale local history, unwitnessed local advance, forked same-sequence head, and hash-invalid required head.

Remaining frontier:

1. Durable witness or quorum certificate history for required v111 heads.
2. Runtime and Axis adoption.
3. Live Postgres restart proof.
4. Direct SQL-delete hardening.
5. Generic substrate currentness abstraction across nested replay/pruning layers.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Full workspace typecheck passed.
- `git diff --check` passed.

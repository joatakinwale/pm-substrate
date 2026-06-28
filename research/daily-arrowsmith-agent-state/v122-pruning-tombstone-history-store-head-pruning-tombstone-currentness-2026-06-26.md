# v122 Pruning Tombstone History Store-Head Pruning Tombstone Currentness

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v121-pruning-tombstone-history-store-head-pruning-tombstone-store-api-2026-06-26.md`

## 1. Research Question Targeted

Closed question: SQ69 - What currentness or witness protocol prevents replay-valid but stale or forked history-store-head pruning tombstone histories from authorizing pruned projections?

Answer: v121 makes actual pruning replayable, but it still lets a caller provide any replay-valid tombstone history to the pruned-store continuity verifier. The missing primitive is a replay-derived pruning tombstone-store head plus a required-head currentness check. A pruned projection must compare its local tombstone history against the required head and obstruct missing, stale, forked, hash-invalid, or unwitnessed-advance histories before row absence can authorize recovery.

Implemented slice:

- Added `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead`.
- Added deterministic head hashing and `projectionReplayPruningTombstoneHistoryStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadFromRecord()`.
- Extended pruned-store continuity with `requiredPruningTombstoneStoreHead` and replay-derived `pruningTombstoneStoreHead`.
- Added continuity obstructions for required-head hash mismatch, missing local head, stale local history, unwitnessed local advance, and same-sequence fork.
- Added focused tests for valid required-head continuity and every currentness obstruction path.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Li et al. 2004, "Secure Untrusted Data Repository (SUNDR)" ([USENIX](https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr), [PDF](https://www.scs.stanford.edu/~dm/home/papers/li%3Asundr.pdf)) | Fork consistency: incompatible histories must become detectable when clients compare later operations; signed history position matters more than private server state. | A local tombstone history that differs from the required head at the same sequence is an obstruction, not an alternative operational state. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident), [PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Incremental auditing proves that a current commitment is consistent with a prior commitment; rollback/fork attempts fail when challenged for consistency. | Tombstone continuity must bind a versioned head hash and reject replay-valid but older prefixes when a newer required head exists. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Users and auditors collectively check signed tree roots for non-equivocation. | A future witness ledger can recover the required pruning tombstone-store head after amnesia; this slice first creates the head object and verifier surface. |
| Chuat et al. 2015, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs" ([PDF](https://netsec.ethz.ch/publications/papers/gossip2015.pdf)) | Signed tree heads need gossip/consistency comparison to detect split-world log views. | A pruned store must not treat a single local tombstone view as sufficient currentness; it must compare against an admitted required head. |

## 3. Existing Substrate Map Delta

Already present before v122:

1. V121 durable history-store-head replay compaction pruning tombstone records.
2. V121 tombstone-gated physical prune APIs for witness, authority/key/seal, and quorum-certificate rows.
3. V121 retained-suffix continuity checks after physical deletion.
4. Earlier same-pattern store-head currentness checks for prior nested pruning tombstone ledgers.

## 4. Missing Substrate Map Delta

Still missing after v122:

1. A durable witness/quorum layer that recovers the required v122 head after amnesia.
2. Authority topology, key-status, non-retroactive seals, and durable QC proof records for v122 head certification.
3. Runtime and Axis adoption of v122 required-head continuity.
4. Live Postgres restart proof that the required head can be recovered in a fresh process after deletion.
5. Generic nested currentness/witness abstraction to reduce repeated layered primitives.
6. Recovery-kernel inventory for every compacted/pruned required head and supporting authority store.
7. SQL hardening that prevents out-of-band deletion without a tombstone-bound pruning admission.
8. Production cryptographic verifier adapters.
9. Monitoring that detects v122 tombstone-ledger forks across agents before pruned projections are accepted.
10. A substrate-level settlement/finality model for external side effects beyond internal state deletion.

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
10. SQ70: What durable witness ledger or quorum certificate makes the required history-store-head pruning tombstone-store head recoverable after amnesia rather than supplied by memory, adapters, connector caches, or a single local process?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Pruning Tombstone Currentness.

Problem it solves: replay-valid but stale or forked tombstone histories can still be supplied to the v121 pruned-store continuity verifier.

Research source: SUNDR fork consistency, tamper-evident log commitments, CONIKS signed tree roots, and certificate transparency gossip.

Mechanism borrowed or adapted: make the tombstone history expose a deterministic, versioned head; require the verifier to compare local replay against the required head and classify disagreement as obstruction.

Why current substrate lacks it: v121 validates the tombstone record chain and retained suffixes, but does not bind continuity to a required tombstone-history head.

Why existing primitives are insufficient: older currentness heads protect older layers. Reusing them would let the wrong authority namespace certify this newer pruning tombstone history.

State guarantee it should create: a pruned history-store-head witness store can only accept row absence when its tombstone history both replays and matches the required pruning tombstone-store head.

Admission rule it requires: the required head must hash-validly bind tenant, pruning tombstone sequence, record hash, and record time.

Replay rule it requires: the local head must be derived from replayed tombstone records, never from memory or adapter input.

Authority boundary it requires: the head only describes `projection_replay_pruning_tombstone_history_store_head_witness_replay_compaction_pruning_tombstone` history.

Failure modes it should prevent:

- accepting an empty tombstone history while claiming a pruned store is current;
- accepting an older replay-valid tombstone prefix after a newer head is required;
- accepting a same-sequence fork with a different tombstone record hash;
- accepting a local tombstone advance that no required head witnessed;
- accepting a required head whose hash does not match its body.

Minimal implementation slice:

- Add the pruning tombstone-store head type.
- Add deterministic head hashing and `fromRecord` derivation.
- Add a same-head comparison helper.
- Extend pruned-store continuity input/output and issue codes.
- Add tests for valid head match, missing head, stale head, unwitnessed advance, fork, and hash mismatch.

Tests that would falsify it:

- A required head with a tampered hash is accepted.
- An empty tombstone history satisfies a required head.
- An older replay-valid tombstone history satisfies a newer required head.
- A same-sequence fork satisfies a required head.
- A local unwitnessed advance satisfies an older required head.

Axis surfaces that could later validate it:

- Axis C can run compacted/pruned recovery with a required tombstone-history head and prove stale memory cannot authorize recovery.
- Axis A can require the head before finance recovery from pruned witness history.
- Axis B can force a domain adapter to supply an admitted required head rather than a local pruning summary.

## 7. Falsification Criteria Written Before Implementation

1. Valid replay-derived heads must be returned by pruned-store continuity.
2. Required head hash mismatch must invalidate continuity.
3. Empty local tombstone history plus a required head must invalidate continuity.
4. Local tombstone history behind the required head must invalidate continuity.
5. Local tombstone history ahead of the required head must invalidate continuity as an unwitnessed advance.
6. Same-sequence local/required head disagreement must invalidate continuity as a fork.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Replay-valid tombstone history is enough to authorize pruned-store continuity. | Rejected. | v122 requires a replay-derived local head to equal a hash-valid required head before pruned-store continuity can pass. |
| Currentness can be supplied by local memory or adapter input. | Rejected for this primitive. | The local head must be derived from tombstone replay; the required head is a verifier input only until a later witness ledger makes it recoverable. |

## 9. Implementation Frontier

Implemented now:

1. Head type/hash/from-record helper for v121 tombstone history.
2. Continuity verifier required-head surface and replay-derived local head.
3. Focused tests for valid head match, missing head, stale head, unwitnessed advance, fork, and hash mismatch.

Remaining frontier:

1. SQ70 durable required-head witness ledger or quorum certificate.
2. Runtime and Axis adoption.
3. Live Postgres restart proof for amnesiac compacted/pruned recovery.
4. Generic nested currentness/witness abstraction.
5. Recovery-kernel inventory across all compacted/pruned state layers.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run via the targeted command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.

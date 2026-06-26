# v86 Pruning Tombstone Store API

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v85-compaction-pruning-admission-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ33 - What pruning tombstone and store API make actual row deletion replayable and detectable, so out-of-band truncation cannot hide erased conflicting history?

Answer: physical pruning needs a tombstone record, not only a pruning admission. A pruning admission proves deletion is allowed; a pruning tombstone proves deletion was performed under that admission, binds the exact lane frontiers removed, and becomes the checkpoint from which retained store suffixes must replay. Store prune APIs must consume an admitted tombstone record before deleting witness-ledger, authority-transition, or quorum-certificate-record rows.

Implemented slice:

- Added settlement-head compaction pruning tombstone record, issue, replay, and continuity types.
- Added deterministic pruning tombstone hashing.
- Added in-memory and Postgres tombstone record stores.
- Added migration `0033_agent_state_projection_replay_pruning_tombstones.sql`.
- Added tombstone-gated prune methods to witness-ledger, authority-transition, and quorum-certificate-record stores.
- Added pruned-store continuity verification over tombstones plus retained suffixes.
- Added falsification tests for tombstone replay, tampered tombstones, tombstone-gated physical pruning, recovery from pruned stores, and silent retained-suffix truncation.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| O'Neil et al. 1996, "The Log-Structured Merge-Tree" ([PDF](https://www.cs.umb.edu/~poneil/lsmtree.pdf)) | Deletes are deferred as delete-node entries that migrate through merge and suppress older entries until physical removal is reached. | pm-substrate treats physical pruning as an admitted tombstone transition before old rows disappear. |
| Dayan et al. 2023, "Enabling Timely and Persistent Deletion in LSM-Engines" ([PDF](https://subhadeep.net/assets/fulltext/Enabling_Timely_and_Persistent_Deletion_in_LSM-Engines.pdf)) | Tombstones logically invalidate older entries and physical persistence depends on compaction progress and retained metadata. | A pruning tombstone binds the compacted frontier and retained suffix counts so recovery can distinguish allowed pruning from hidden truncation. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Safe deletion requires auditable proof that no inappropriate events were removed. | Tombstone records are hash-linked audit artifacts; deletion is not merely absence of rows. |
| Mohan et al. 1992, "ARIES" ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery depends on logged history, not on private storage state. | The physical pruning event is itself logged as replayable substrate state. |

## 3. Existing Substrate Map Delta

Already present before v86:

1. v82 could replay pruned witness, authority, and quorum-certificate suffixes from compaction checkpoints.
2. v83 required admitted witness signatures before a checkpoint could seed replay.
3. v84 persisted checkpoint bodies and admission certificates in a hash-linked checkpoint-admission store.
4. v85 admitted pruning only after durable checkpoint-admission record replay and retained suffix validation.

Newly strengthened by v86:

1. Actual deletion has a replayable tombstone record.
2. Tombstones bind the exact checkpoint-admission record and pruning admission.
3. Tombstones derive pruned lane frontiers from the admitted checkpoint snapshots.
4. Tombstone replay rejects broken sequence, previous-hash, body-hash, admission-hash, checkpoint-record-hash, lane-frontier, and frontier-regression cases.
5. Witness, authority, and quorum-certificate store prune methods consume tombstone records before deleting rows.
6. Pruned-store continuity checks replay the retained suffix from the latest tombstone frontier.
7. Silent retained-suffix deletion is detectable when the retained suffix is shorter than the suffix count admitted by the latest tombstone.
8. Postgres now has a durable pruning tombstone table.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-store head witnesses so clients can reject stale or forked tombstone ledgers.
2. Cross-agent gossip/monitoring of tombstone heads.
3. Postgres trigger or permission hardening that blocks direct SQL deletes outside tombstone-gated APIs.
4. Partial tombstone consistency proofs for clients that cannot replay every tombstone.
5. Runtime adoption in strict graph/capability recovery paths.
6. Axis validation under actually pruned Postgres stores.
7. Tombstone support for root-witness and settlement-record stores beyond the settlement-head lanes.
8. Operational retention policies for when admitted tombstones may physically delete source rows.
9. Tombstone compaction or archival rules that preserve proof while bounding tombstone ledger size.
10. External backup/object-store reconciliation so a database restore cannot resurrect rows without tombstone history.

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
10. SQ34: What pruning-head witness or tombstone consistency proof makes stale or forked tombstone histories unable to authorize a pruned store projection?

## 6. Primitive Proposal Ledger

Name: Settlement-Head Witness Replay Compaction Pruning Tombstone Store API.

Problem it solves: v85 admitted pruning as a decision, but actual row deletion could still happen as an unmodeled storage operation. Without a tombstone, a fresh agent cannot tell admitted pruning from out-of-band truncation.

Research source: LSM delete-node/tombstone mechanics, timely persistent LSM deletion, tamper-evident safe deletion, and ARIES recovery logging.

Mechanism borrowed or adapted: represent deletion as an append-only marker that remains query/replay-visible until physical removal is proven against an admitted frontier.

Why current substrate lacked it: it had proof that pruning was allowed, but no durable artifact recording that a specific prefix was actually removed.

Why existing primitives were insufficient: checkpoint admission and pruning admission establish authority; they do not make the physical deletion event itself replayable.

State guarantee it should create: a store prefix can be physically removed only through a tombstone-backed API, and a fresh agent can replay tombstones plus retained suffixes to detect unauthorized truncation.

Admission rule it requires: tombstone append requires an admitted pruning admission, a matching checkpoint-admission record, strict signature-policy validation, and lane frontiers derived from the admitted checkpoint.

Replay rule it requires: replay tombstone records as an append-only chain, validate embedded admission hashes, validate checkpoint-admission material, verify pruned frontiers, reject frontier regressions, then replay retained suffixes from the latest tombstone frontier.

Authority boundary it requires: physical deletion is subordinate to a substrate tombstone record. Store APIs may delete rows only when the tombstone admits that lane.

Failure modes it should prevent:

- deleting witness, authority, or quorum-certificate rows without a tombstone;
- treating a pruning admission as evidence that deletion actually happened;
- hiding a missing retained suffix row after pruning;
- tampering with the pruning admission inside a tombstone;
- changing pruned frontiers after the tombstone hash was recorded;
- duplicating or regressing tombstone frontiers.

Minimal implementation slice:

- Add tombstone record types, hash, replay, and continuity verification.
- Add in-memory and Postgres tombstone stores.
- Add tombstone-gated prune methods on the three settlement-head lane stores.
- Add migration `0033`.
- Extend the compaction replay test with tombstone append, prune, recovery, and silent truncation checks.

Tests that would falsify it:

- Tombstone replay succeeds after the embedded pruning admission is tampered.
- Store prune APIs delete rows without an admitted tombstone for the requested lane.
- Pruned-store continuity passes when the retained witness suffix is silently deleted.
- Tombstone replay accepts a frontier that does not match the checkpoint snapshot.
- Tombstone replay accepts a duplicate/regressed frontier.

Axis surfaces that could later validate it:

- Axis C can prune local stores and require recovery from tombstone plus suffix.
- Axis A can verify finance write authority after tombstone-backed Postgres pruning.
- Axis B can reject adapters that cite pruned local state without tombstone replay.

## 7. Falsification Criteria Applied Before Verification

1. Valid tombstone append plus retained suffixes yields valid pruned-store continuity.
2. Tampered tombstone admission obstructs tombstone replay.
3. Store prune APIs reject tampered tombstones before deletion.
4. Physical in-memory pruning removes only records at or below the tombstone frontiers.
5. Silent deletion of a retained witness suffix is detected.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A pruning admission is enough to explain future absence of prefix rows. | Rejected. | v86 adds a tombstone record for the physical deletion event. |
| A tombstone can be implicit in checkpoint metadata. | Rejected. | Tombstone replay has its own sequence, previous hash, record hash, and lane frontiers. |
| Store APIs can expose sequence-based deletion safely. | Rejected. | v86 prune APIs consume tombstone records, not raw sequence thresholds. |
| A valid tombstone ledger proves clients have the latest tombstone history. | Not yet. | SQ34 remains open for tombstone-head witnesses and consistency proofs. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecord`.
- Tombstone lane frontiers, issue codes, replay result, and pruned-store continuity result.
- Tombstone record builder/hash/replay.
- `verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity()`.
- In-memory and Postgres tombstone record stores.
- Tombstone-gated prune methods on witness-ledger, authority-transition, and quorum-certificate-record stores.
- Migration `0033_agent_state_projection_replay_pruning_tombstones.sql`.
- Tests for append/replay/tamper/prune/recover/truncate behavior.

Remaining frontier:

1. Tombstone-head witnessing and non-equivocation.
2. Direct SQL-delete hardening.
3. Postgres integration tests for tombstone-backed pruning.
4. Runtime adoption in strict recovery paths.
5. Axis A/B/C pruned-store validation.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 71 tests.
- Workspace typecheck passed across 22 package projects.
- Broad substrate test slice passed: 31 files passed, 391 tests passed, 8 files skipped, 65 tests skipped.
- `git diff --check` passed.

Proof boundary:

This proves the pure tombstone replay and in-memory tombstone-gated pruning rule in focused agent-state tests and verifies that the broader substrate packages still typecheck and pass the selected cross-package test slice. It does not yet prove production Postgres pruning enforcement, direct SQL-delete hardening, or tombstone-head non-equivocation; SQ34 remains open for tombstone-head witnessing and consistency proofs.

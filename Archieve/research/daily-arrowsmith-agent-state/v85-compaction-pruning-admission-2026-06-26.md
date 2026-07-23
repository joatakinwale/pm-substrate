# v85 Compaction Pruning Admission

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v84-durable-checkpoint-admission-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ32 - What pruning admission rule makes physical prefix deletion impossible unless a durable admitted checkpoint record and verified suffix continuity already exist?

Answer: pruning needs its own admission certificate. A compaction checkpoint, even when durably admitted, is not by itself permission to delete prefix records. The deletion decision is admissible only when a durable checkpoint-admission record replays valid and each retained suffix lane replays from the admitted checkpoint frontier. The primitive is a settlement-head compaction pruning admission that verifies the durable checkpoint-admission record chain plus witness-ledger, authority-history, and quorum-certificate-record suffix continuity.

Implemented slice:

- Added compaction pruning lane, issue, and admission types.
- Added deterministic pruning-admission hashing.
- Added pruning-admission evaluation against durable checkpoint-admission record replay.
- Added suffix-continuity validation by replaying each retained suffix from the admitted checkpoint.
- Added tests proving pruning admission is admitted only with a durable checkpoint-admission record and valid retained suffixes.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf)) | Raft snapshots preserve last-included index and term to validate the first log entry after the snapshot. | A pruning admission replays retained suffixes from the checkpoint frontier before deletion can be considered admissible. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints advance the low watermark and permit garbage collection only below the stable checkpoint. | pm-substrate separates checkpoint admission from pruning admission, and pruning can target only lanes covered by the admitted checkpoint frontier. |
| Mohan et al. 1992, "ARIES" ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery determines the earliest log point needed before old log can be truncated. | Pruning admission requires proving replay can restart from the checkpoint plus retained suffix. |
| Lee et al. 2022, "Checkpoints for Instant Recovery in In-Memory Database Systems" ([PDF](https://www.vldb.org/pvldb/vol15/p1671-lee.pdf)) | Recovery composes checkpoints with log replay and index reconstruction rather than treating checkpoints as complete deletion authority. | The substrate admission rule explicitly composes checkpoint, suffix replay, and proof recovery. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Log mutation must remain auditable against membership and consistency proof. | Pruning is modeled as an admission artifact with a hash, not an invisible storage side effect. |

## 3. Existing Substrate Map Delta

Already present before v85:

1. v82 introduced checkpoint-seeded replay for pruned suffixes.
2. v83 required witness-signed checkpoint admission before checkpoint-seeded replay.
3. v84 persisted checkpoint bodies and admission certificates in a hash-linked admission record store.
4. Existing replay functions already check sequence and previous-hash continuity when seeded by a checkpoint.

Newly strengthened by v85:

1. Pruning now has an explicit admission artifact.
2. Pruning admission requires the checkpoint-admission record to exist in durable replay history.
3. Pruning admission replays the checkpoint-admission record chain under strict signature policy.
4. Pruning admission validates retained witness-ledger suffix continuity from the checkpoint frontier.
5. Pruning admission validates retained authority-history suffix continuity from the checkpoint frontier.
6. Pruning admission validates retained quorum-certificate-record suffix continuity from the checkpoint frontier.
7. Pruning admission fails when the durable admission record is missing or the retained suffix starts before/after the checkpoint frontier.

## 4. Missing Substrate Map Delta

Still missing:

1. Store-level prune APIs that consume pruning admissions before deleting rows.
2. Pruning tombstone records that prove what prefix was physically removed.
3. Pruning store heads or witnesses so out-of-band deletion becomes detectable.
4. Partial consistency proofs for clients that cannot replay every pruning admission.
5. Cross-agent monitor/gossip for pruning events.
6. Database triggers or permissions preventing direct SQL deletes outside the pruning API.
7. Runtime adoption in strict graph/capability recovery paths.
8. Axis validation under actually pruned stores.
9. Compaction/pruning equivalents for root-witness ledgers and settlement records.
10. Operational retention policy for how long source prefix rows remain before tombstone-backed deletion.

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
10. SQ33: What pruning tombstone and store API make actual row deletion replayable and detectable, so out-of-band truncation cannot hide erased conflicting history?

## 6. Primitive Proposal Ledger

Name: Settlement-Head Witness Replay Compaction Pruning Admission.

Problem it solves: v84 made checkpoint admission durable, but deletion still needed an explicit rule. Without a pruning admission, a storage layer could delete prefix rows because a checkpoint exists, without proving the retained suffix still replays from that checkpoint.

Research source: Raft snapshot suffix checks, PBFT low-watermark garbage collection, ARIES recovery start determination, instant-recovery checkpoint/log composition, and tamper-evident logging.

Mechanism borrowed or adapted: preserve the compacted frontier, verify the remaining suffix against that frontier, and only then admit garbage collection below the frontier.

Why current substrate lacked it: replay could consume a checkpoint-plus-suffix, but no object stated that prefix deletion was admissible.

Why existing primitives were insufficient: checkpoint admission proves the checkpoint is authorized; it does not prove the retained records after deletion are continuous with that checkpoint.

State guarantee it should create: a prefix can be physically deleted only after an admitted pruning decision proves durable checkpoint admission and retained suffix replay continuity.

Admission rule it requires: pruning admission requires a replay-valid checkpoint-admission record history containing the selected record, strict signature policy, at least one prunable lane, checkpoint snapshots for every lane, and replay-valid retained suffixes from the checkpoint frontier.

Replay rule it requires: recompute durable checkpoint-admission replay, then replay every target suffix using the admitted checkpoint and certificate.

Authority boundary it requires: pruning is a substrate admission decision, not a storage-engine optimization.

Failure modes it should prevent:

- deleting prefix records without a durable admitted checkpoint;
- deleting prefix records while retaining a suffix that does not chain from the checkpoint frontier;
- deleting authority history while losing key-status replay;
- deleting certificate records while losing the latest proof object;
- treating checkpoint existence as deletion authority.

Minimal implementation slice:

- Add pruning admission types and hash.
- Evaluate pruning admission from durable checkpoint-admission records and retained suffixes.
- Reuse existing replay functions for suffix-continuity checks.
- Add tests for admitted pruning, missing durable checkpoint record, and invalid suffix obstruction.

Tests that would falsify it:

- Pruning admission succeeds when the checkpoint-admission record is absent from durable history.
- Pruning admission succeeds when the witness suffix starts at the wrong sequence/hash.
- Pruning admission succeeds without a checkpoint snapshot for a requested lane.
- Pruning admission succeeds while authority/key-history suffix replay fails.
- Pruning admission succeeds while quorum-certificate-record suffix replay fails.

Axis surfaces that could later validate it:

- Axis C can physically prune local stores and require recovery from pruning-admitted suffixes.
- Axis A can verify finance write authority after real database pruning.
- Axis B can reject domain adapters that cite cached snapshots without pruning admissions.

## 7. Falsification Criteria Applied Before Verification

1. Valid durable checkpoint-admission record plus valid suffixes yields admitted pruning.
2. Missing checkpoint-admission record history obstructs pruning.
3. Witness suffix that does not chain from the checkpoint frontier obstructs pruning.
4. The admitted pruning artifact hashes deterministically.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable checkpoint admission is sufficient authority to delete prefix rows. | Rejected. | v85 requires retained suffix replay continuity before pruning admission. |
| Suffix continuity can be inferred from checkpoint metadata alone. | Rejected. | v85 reuses replay functions to validate the retained suffixes. |
| Pruning can remain a storage-engine concern. | Rejected as a substrate model. | v85 creates a substrate pruning-admission artifact. |
| Actual store deletion is now fully governed. | Not yet. | SQ33 remains open for tombstone-backed store APIs and out-of-band deletion detection. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningAdmission`.
- Pruning lane and issue types.
- Pruning admission hash.
- `evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningAdmission()`.
- Tests for admitted pruning, missing durable admission history, and invalid retained witness suffix.

Remaining frontier:

1. Store-level prune APIs.
2. Pruning tombstone records.
3. Postgres pruning/tombstone migration.
4. Store-head/currentness checks after pruning.
5. Runtime and Axis adoption under actually pruned stores.

## 10. Proof Status

Commands run:

```bash
git fetch origin main
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

This proves the pure pruning-admission rule in focused agent-state tests and verifies that the broader substrate packages still typecheck and pass the selected cross-package test slice. It does not yet prove actual row deletion is governed, because SQ33 remains open for tombstone-backed store APIs and out-of-band deletion detection.

# v97 Tombstone-Head Compaction Pruning Admission

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v96-durable-tombstone-head-checkpoint-admission-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ44 - What tombstone-head pruning admission rule makes physical prefix deletion impossible unless a durable admitted tombstone-head checkpoint record and retained suffix continuity have both replayed?

Answer: tombstone-head physical pruning needs an admission object before any deletion-oriented store API can safely exist. A replay-valid tombstone-head checkpoint and a replay-valid durable checkpoint-admission record are necessary but not sufficient; the retained suffix after the compacted frontier must also replay for every lane being pruned. v97 adds a tombstone-head replay compaction pruning admission that binds the checkpoint id, checkpoint hash, checkpoint-admission record hash, pruned lanes, retained suffix counts, replay issues, and a deterministic admission hash.

Implemented slice:

- Added tombstone-head replay compaction pruning lane, status, issue, admission, and hash types.
- Added `evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningAdmission`.
- Admission replays durable tombstone-head checkpoint-admission record history before accepting a supplied checkpoint record.
- Admission requires retained suffix replay for tombstone-head witness-ledger, authority-topology, and quorum-certificate-record lanes.
- Extended the focused tombstone-head compaction test to prove admitted pruning plus missing-record, invalid-witness-suffix, and invalid-authority-suffix obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf)) | Log compaction keeps a snapshot position and preserves the metadata needed for the first retained log entry to continue the history. | Tombstone-head pruning admission requires retained suffix replay from the checkpoint frontier rather than allowing deletion after a checkpoint value alone. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery depends on logged history and checkpoint/restart metadata; the amount of log that can be skipped is a recovery calculation, not a storage guess. | Tombstone-head pruning admission treats prefix deletion as an admitted recovery-boundary decision over durable records and retained suffixes. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints bound garbage collection; replicas revert to or collect around stable checkpoint evidence rather than private state. | Tombstone-head pruning requires admitted checkpoint authority before any prefix can be treated as replaceable by compacted state. |
| Distler 2021, "Byzantine Fault-Tolerant State-Machine Replication from a Systems Perspective" ([PDF](https://www4.cs.fau.de/Publications/2021/distler_21_csur.pdf), [ACM](https://dl.acm.org/doi/10.1145/3436728)) | BFT systems keep only a limited active consensus window and use checkpoints to garbage-collect completed instances, but irreversible decisions need stable evidence. | Tombstone-head pruning admission is the stable evidence boundary before later tombstone-gated physical pruning APIs. |

## 3. Existing Substrate Map Delta

Already present before v97:

1. v95 added tombstone-head replay compaction checkpoints and admission certificates.
2. v96 made tombstone-head checkpoint admissions durable and replayable through hash-linked checkpoint-admission records.
3. Tombstone-head witness, authority, and quorum-certificate replay functions can resume from an admitted checkpoint plus retained suffix.
4. Settlement-head compaction already had a pruning-admission primitive, but tombstone-head compaction did not.

Newly added by v97:

1. Tombstone-head pruning admission is now a substrate object.
2. Admission refuses missing or replay-invalid durable tombstone-head checkpoint-admission history.
3. Admission refuses a supplied checkpoint-admission record that is not present in durable replay history.
4. Admission refuses lane pruning without the corresponding checkpoint snapshot.
5. Admission refuses retained tombstone-head witness suffixes that do not replay from the admitted checkpoint frontier.
6. Admission refuses retained tombstone-head authority suffixes that do not replay from the admitted checkpoint frontier.
7. Admission refuses retained tombstone-head quorum-certificate suffixes that do not replay from the admitted checkpoint frontier.
8. Admission emits a deterministic pruning-admission hash so future tombstone records can bind the exact decision.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-head tombstone-gated store pruning APIs for witness, authority, and QC-record lanes.
2. Durable tombstone-head pruning tombstone record store and replay.
3. Pruned-store continuity integration for tombstone-head witness, authority, and QC-record stores after physical deletion.
4. Tombstone-head pruning tombstone-store head currentness and witnessing for the new tombstone ledger.
5. Runtime and Axis adoption of tombstone-head pruning admission.
6. Postgres integration tests proving checkpoint recovery after actual tombstone-head prefix pruning.
7. Direct SQL-delete hardening across tombstone-head witness, authority, and QC-record lanes.
8. Cross-agent witnessing or monitoring for tombstone-head checkpoint-admission and pruning-tombstone histories.
9. Production crypto/key-management adapters for tombstone-head checkpoint and pruning witnesses.
10. Compact consistency-proof format for tombstone-head pruning advancement.

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
10. SQ45: What tombstone-head tombstone-gated store pruning API makes actual witness, authority, and QC-record row deletion replayable and makes out-of-band truncation detectable?

## 6. Primitive Proposal Ledger

Name: Tombstone-Head Replay Compaction Pruning Admission.

Problem it solves: v96 made checkpoint admission recoverable, but a caller could still request or perform physical prefix deletion without a substrate object proving the selected checkpoint is durable and the retained suffix remains replayable.

Research source: Raft log compaction, ARIES recovery, PBFT stable checkpoints, and BFT checkpoint garbage collection.

Mechanism borrowed or adapted: delete/garbage-collect only below a stable recovery frontier, and only when the retained suffix can continue the history from that frontier.

Why current substrate lacked it: tombstone-head compaction stopped at admitted checkpoint recovery. Settlement-head compaction had pruning admission, but the tombstone-head witness/authority/QC lanes had no equivalent admission object.

Why existing primitives were insufficient: checkpoint admission proves a checkpoint can seed replay; it does not prove the retained suffix is present, contiguous, or hash-linked from that checkpoint. A durable checkpoint record without suffix continuity can still turn deleted prefix absence into operational belief.

State guarantee it should create: tombstone-head prefix deletion can be admitted only when durable checkpoint-admission history replays and every pruned lane's retained suffix replays from the checkpoint frontier.

Admission rule it requires: a pruning admission is `admitted` only when the checkpoint-admission record is present in replay-valid durable history and every selected lane has both a checkpoint snapshot and replay-valid retained suffix.

Replay rule it requires: replay the checkpoint-admission record chain, match the supplied checkpoint record by hash and body, then replay witness, authority, and QC-record suffixes with the checkpoint and admission certificate.

Authority boundary it requires: tombstone-head pruning admission belongs to core `@pm/agent-state`, not domain adapters, local storage APIs, process memory, or axis fixtures.

Failure modes it should prevent:

- physical prefix deletion using a caller-supplied checkpoint admission record;
- pruning with no durable checkpoint-admission record history;
- pruning a lane that the checkpoint did not snapshot;
- pruning while the retained witness suffix starts at the wrong frontier;
- pruning while the retained authority suffix starts at the wrong frontier;
- pruning while the retained QC-record suffix starts at the wrong frontier;
- treating checkpoint recovery as deletion authority without suffix continuity.

Minimal implementation slice:

- Add tombstone-head pruning admission types and deterministic hash.
- Add an evaluator over durable checkpoint-admission records plus retained suffixes.
- Extend the tombstone-head compaction test with admitted and obstructed pruning-admission cases.

Tests that would falsify it:

- Missing durable checkpoint-admission records still admit pruning.
- A full unpruned witness history is accepted as a retained suffix after checkpoint compaction.
- Pre-checkpoint authority transitions are accepted as retained suffix after checkpoint compaction.
- A checkpoint lane can be pruned when the checkpoint lacks that lane snapshot.
- A tampered checkpoint-admission record can bind a pruning admission.

Axis surfaces that could later validate it:

- Axis C can attempt tombstone-head pruning without durable checkpoint-admission history and expect obstruction.
- Axis A can recover finance pruned-projection state only after pruning admission and later tombstones replay.
- Axis B can require domain adapters to cite pruning-admission hashes before relying on pruned tombstone-head state.

## 7. Falsification Criteria Applied Before Verification

1. A valid durable checkpoint-admission record plus replay-valid retained suffixes admits pruning.
2. Missing durable checkpoint-admission records obstruct pruning.
3. A retained witness suffix that does not start at the checkpoint frontier obstructs pruning.
4. A retained authority suffix that does not start at the checkpoint frontier obstructs pruning.
5. Focused typecheck and focused tests must pass after adding the primitive.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable tombstone-head checkpoint admission is enough to authorize physical pruning. | Rejected. | v97 adds a separate pruning admission requiring retained suffix replay. |
| Prefix deletion can be represented later without first admitting the deletion precondition. | Rejected. | v97 creates the precondition object that later tombstone-gated store APIs must consume. |
| Tombstone-head compaction can borrow settlement-head pruning semantics implicitly. | Rejected. | v97 adds explicit tombstone-head witness/authority/QC lane admission instead of relying on a settlement-head object. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head replay compaction pruning lane, status, issue, admission, and hash types.
- Tombstone-head pruning admission evaluator.
- Durable checkpoint-admission record replay requirement.
- Retained suffix replay requirement for tombstone-head witness, authority, and QC-record lanes.
- Focused test coverage for admitted pruning, missing durable records, invalid witness suffix, and invalid authority suffix.

Remaining frontier:

1. Tombstone-head tombstone-gated physical pruning APIs.
2. Durable tombstone-head pruning tombstone record store.
3. Pruned-store continuity after physical tombstone-head prefix deletion.
4. Tombstone-head pruning tombstone-store head witnessing/currentness.
5. Runtime and Axis adoption.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 73 tests.
- Full workspace typecheck passed.
- Broad affected-package Vitest sweep passed: 31 files passed, 8 skipped; 393 tests passed, 65 skipped.

Proof boundary:

This proves the pure tombstone-head pruning-admission primitive in focused and affected-package tests. It does not yet prove tombstone-gated physical deletion, tombstone record persistence, pruned-store continuity, Postgres pruning recovery, runtime/Axis adoption, or production crypto/key management.

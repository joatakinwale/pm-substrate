# v98 Tombstone-Head Pruning Tombstone Store API

Date: 2026-06-26
Status: new substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v97-tombstone-head-compaction-pruning-admission-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ45 - What tombstone-head tombstone-gated store pruning API makes actual witness, authority, and QC-record row deletion replayable and makes out-of-band truncation detectable?

Answer: tombstone-head physical row deletion must itself be represented by a durable, replayable pruning tombstone record. A pruning admission proves deletion is allowed; the tombstone record is the admitted transition that storage APIs must consume before deleting rows. v98 adds a tombstone-head pruning tombstone ledger, in-memory and Postgres record stores, tombstone-gated prune APIs for the tombstone-head witness, authority, and quorum-certificate stores, and a tombstone-head pruned-store continuity verifier that catches retained-suffix truncation after physical deletion.

Implemented slice:

- Added tombstone-head replay compaction pruning tombstone record/frontier/replay/continuity types.
- Added deterministic tombstone record hashing and replay over checkpoint admission, pruning admission, frontiers, sequence, and prior hashes.
- Added in-memory and Postgres tombstone-head pruning tombstone record stores.
- Added migration `0040_agent_state_projection_replay_pruning_tombstone_head_pruning_tombstones.sql`.
- Added tombstone-gated prune methods for tombstone-head witness records, authority transitions, and quorum-certificate records.
- Added tombstone-head pruned-store continuity verification over retained witness, authority, and QC suffixes.
- Extended the focused tombstone-head compaction test to prove tombstone replay, actual pruning, post-prune replay continuity, and out-of-band retained-suffix truncation detection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| O'Neil et al. 1996, "The Log-Structured Merge-Tree" ([PDF](https://www.cs.umb.edu/~poneil/lsmtree.pdf)) | Deletes are represented as delete nodes that migrate through merge and only annihilate the target entry when encountered; reads must account for delete nodes until the merge resolves them. | Tombstone-head row absence must be backed by a replayed tombstone record, not inferred from storage absence. The tombstone survives as the proof that deletion was admitted. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([PDF](https://www.cs.cmu.edu/~15849g/readings/mohan92.pdf)) | Physical changes are recoverable because redo/undo history records the action and its page/object context; recovery independence comes from logged changes, not private memory. | Tombstone-head pruning APIs derive deletion frontiers from the tombstone record and keep continuity checkable by replaying retained suffixes from the checkpoint. |
| Dayan and Idreos 2018, "Dostoevsky..." ([PDF](https://nivdayan.github.io/dostoevsky.pdf), [ACM](https://dl.acm.org/doi/10.1145/3183713.3196927)) | LSM compaction removes obsolete entries to reclaim space, but the merge design controls the tradeoff between update cost, lookup cost, and space amplification. | pm-substrate treats physical pruning as a governed compaction transition: storage reclamation is subordinate to replayable authority and retained-suffix continuity. |

## 3. Existing Substrate Map Delta

Already present before v98:

1. v95 added tombstone-head replay compaction checkpoints.
2. v96 made tombstone-head checkpoint admissions durable and replayable.
3. v97 added tombstone-head pruning admission that requires durable checkpoint-admission history plus retained suffix replay.
4. Tombstone-head witness, authority, and QC stores could append/list durable rows.
5. Settlement-head stores already had tombstone-backed physical pruning, but the tombstone-head witness subsystem did not.

Newly added by v98:

1. Tombstone-head physical pruning is now a durable tombstone transition.
2. Tombstone-head pruning tombstone replay verifies checkpoint admission, pruning admission, frontiers, sequence continuity, previous hash, and record hash.
3. Tombstone-head witness rows can only be pruned through a replay-valid tombstone record for the witness lane.
4. Tombstone-head authority transitions can only be pruned through a replay-valid tombstone record for the authority lane.
5. Tombstone-head QC records can only be pruned through a replay-valid tombstone record for the QC lane.
6. Post-prune continuity replays retained suffixes from the tombstone's admitted checkpoint.
7. Out-of-band deletion of retained suffix rows is detectable as continuity obstruction.
8. Migration `0040` persists the tombstone-head pruning tombstone ledger.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-head pruning tombstone-store head currentness and witnessing for the new tombstone ledger.
2. A compact consistency-proof format for advancing from one tombstone-head pruning tombstone head to another.
3. Runtime recovery integration that derives tombstone-head pruning tombstone history from durable stores before building projections.
4. Postgres integration tests proving actual tombstone-head prefix pruning and restart recovery.
5. Axis C direct local-agent-state pressure against the new tombstone-head pruning tombstone APIs.
6. Axis A/B adapter adoption so domain code cannot bypass tombstone-head pruning tombstones.
7. Direct SQL-delete hardening or database policy around tombstone-head witness/authority/QC tables.
8. Cross-agent monitoring of tombstone-head pruning tombstone histories.
9. Production crypto/key-management adapters for tombstone-head checkpoint and pruning witnesses.
10. A general pruning-tombstone abstraction that can reduce duplication without weakening authority boundaries.

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
10. SQ46: What tombstone-head pruning tombstone-store head currentness or witness protocol makes the new pruning tombstone ledger itself non-stale and non-forked after amnesia?

## 6. Primitive Proposal Ledger

Name: Tombstone-Head Pruning Tombstone Store API.

Problem it solves: v97 could admit tombstone-head pruning, but actual storage APIs still had no substrate object forcing physical deletion to be replayable. A caller or maintenance job could delete tombstone-head witness, authority, or QC rows and leave only storage absence.

Research source: LSM-tree delete nodes, ARIES logged physical recovery, and LSM compaction/obsolete-entry reclamation.

Mechanism borrowed or adapted: physical deletion is represented by an explicit record that survives until replay can prove why absence is legitimate.

Why current substrate lacked it: tombstone-head compaction stopped at pruning admission; the stores had append/list APIs but no tombstone-gated deletion or post-prune continuity verifier.

Why existing primitives were insufficient: checkpoint admission proves a recovery frontier; pruning admission proves deletion is permitted; neither is the deletion transition consumed by storage.

State guarantee it should create: tombstone-head witness, authority, and QC row absence can be operationally accepted only when a replay-valid pruning tombstone record admits the deleted prefix and retained suffix continuity still replays.

Admission rule it requires: a pruning tombstone can be appended only when its checkpoint-admission record hash, pruning-admission hash, checkpoint frontier, sequence, previous hash, and record hash all replay under the tombstone-head signature policy.

Replay rule it requires: replay the tombstone-head pruning tombstone chain, validate embedded checkpoint/admission material, derive frontiers from the checkpoint, and replay retained suffixes from the latest tombstone frontier.

Authority boundary it requires: tombstone-head pruning tombstones belong to core `@pm/agent-state`; domain adapters, cleanup jobs, connectors, and eval axes cannot supply raw deletion sequence numbers as authority.

Failure modes it should prevent:

- physical deletion using caller-supplied sequence frontiers;
- deletion after pruning admission without a durable tombstone record;
- deletion by the wrong authority boundary, such as settlement-head pruning tombstones;
- accepting storage absence as proof of admitted pruning;
- accepting post-prune retained suffixes that no longer replay;
- missing out-of-band truncation of retained witness, authority, or QC rows.

Minimal implementation slice:

- Add tombstone-head pruning tombstone record/replay/store types.
- Add in-memory and Postgres record stores plus migration `0040`.
- Add tombstone-gated prune APIs to tombstone-head witness, authority, and QC stores.
- Add pruned-store continuity verification and focused tests.

Tests that would falsify it:

- Store prune APIs accept raw sequence numbers or a non-admitted/tampered tombstone record.
- A tombstone record with a mismatched checkpoint admission or pruning admission replays as valid.
- Physical pruning leaves a retained suffix that does not replay from the checkpoint but continuity still passes.
- Deleting a retained suffix row out of band is not detected.
- The wrong tombstone record type can authorize tombstone-head row deletion.

Axis surfaces that could later validate it:

- Axis C can attempt direct tombstone-head row truncation and require continuity obstruction.
- Axis A can recover finance projections only when tombstone-head pruning tombstone history replays.
- Axis B can require adapters to cite pruning tombstone record hashes before consuming pruned tombstone-head state.

## 7. Falsification Criteria Applied Before Verification

1. A valid tombstone-head pruning tombstone record replays and exposes the expected witness, authority, and QC frontiers.
2. Tombstone-head witness, authority, and QC stores physically prune only through that tombstone record.
3. Retained suffixes replay from the tombstone's admitted checkpoint after physical deletion.
4. Removing a retained witness suffix row out of band obstructs continuity.
5. Focused package typecheck and focused tests must pass after adding the primitive.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Tombstone-head pruning admission is enough to explain row absence. | Rejected. | v98 adds a separate tombstone record consumed by store pruning APIs. |
| Store maintenance can accept raw sequence frontiers once pruning is admitted. | Rejected. | v98 prune methods derive their frontier only from a replay-valid tombstone record. |
| Post-prune continuity can be inferred from current rows. | Rejected. | v98 continuity explicitly replays tombstones and retained suffixes from checkpoint frontier. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head replay compaction pruning tombstone record/replay/store types.
- Deterministic tombstone record hashes and frontier derivation.
- In-memory and Postgres-backed tombstone-head pruning tombstone stores.
- Migration `0040_agent_state_projection_replay_pruning_tombstone_head_pruning_tombstones.sql`.
- Tombstone-gated physical prune APIs for tombstone-head witness, authority, and QC stores.
- Tombstone-head pruned-store continuity verification.
- Focused test coverage for replayable tombstone deletion and out-of-band retained witness truncation detection.

Remaining frontier:

1. Tombstone-head pruning tombstone-store head currentness and witnessing.
2. Runtime recovery integration.
3. Postgres live pruning/recovery tests.
4. Axis C direct pressure; Axis A/B adapter adoption.
5. Database-level hardening against direct SQL truncation outside substrate APIs.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v98-tombstone-head-pruning-tombstone-store-api-2026-06-26.md db/migrations/0040_agent_state_projection_replay_pruning_tombstone_head_pruning_tombstones.sql
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 73 tests.
- Full workspace typecheck passed.
- Broad affected-package Vitest sweep passed: 31 files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing whitespace scan over touched files passed.

Proof boundary:

This proves the pure tombstone-head pruning tombstone and in-memory store-pruning slice. It does not yet prove tombstone-head pruning tombstone-store head currentness, Postgres live pruning recovery, runtime/Axis adoption, database-level SQL hardening, or production crypto/key management.

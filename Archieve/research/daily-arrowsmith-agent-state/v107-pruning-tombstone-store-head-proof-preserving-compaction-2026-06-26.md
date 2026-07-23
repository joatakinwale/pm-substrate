# v107 Pruning Tombstone-Store Head Proof-Preserving Compaction

Date: 2026-06-26
Status: substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v106-pruning-tombstone-store-head-quorum-certificate-record-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ54 - What proof-preserving compaction checkpoint lets pruning tombstone-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

Answer: the pruning tombstone-store head layer needs an admitted replay compaction checkpoint, not a hash-valid summary. The checkpoint carries compacted sequence/hash frontiers plus the projection state full replay already derived: accepted required heads, authority/key/seal topology projection, and latest certified quorum-certificate record. Replay can resume only when a checkpoint admission certificate replays as admitted under strict witness signatures. The retained suffix must still hash-chain from the compacted frontier.

Implemented slice:

- Added pruning tombstone-store head replay compaction checkpoint types.
- Added deterministic checkpoint and checkpoint-admission hashing.
- Added checkpoint admission certificates signed by replay-admitted pruning tombstone-store head witnesses.
- Witness-ledger replay can resume from admitted checkpoint frontiers and accepted-head projection.
- Authority/key/seal replay can resume from admitted checkpoint frontiers and principal/key-status/seal projection.
- Quorum-certificate-record replay can resume from admitted checkpoint frontiers and latest certified-record projection.
- Replay rejects suffix-only histories, missing checkpoint admissions, and tampered checkpoint bodies.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | ARIES uses WAL, fuzzy checkpoints, page LSNs, and repeat-history recovery so a checkpoint is a recovery frontier, not authority by itself. | The substrate checkpoint seeds replay only with compacted sequence/hash frontiers, and the retained suffix must continue the hash chain from that frontier. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf), [USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro)) | Raft snapshots preserve last-included index/term so log entries after the snapshot can still satisfy consistency checks. | The checkpoint carries per-lane compacted sequence/hash values so witness, authority, and QC-record suffixes cannot start from arbitrary local state. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | PBFT garbage collection requires stable checkpoint proof before old log messages can be discarded. | A checkpoint can seed pruning tombstone-store head replay only when enough active witnesses sign the exact checkpoint hash and admission replays as admitted. |

## 3. Existing Substrate Map Delta

Already present before v107:

1. Durable pruning tombstone-store head witness observations.
2. Replayed pruning tombstone-store head witness quorum topology.
3. Durable authority-transition stores for that topology.
4. Signature-bound witness identity.
5. Key-status replay for rotations and revocations.
6. Non-retroactive authority epoch seals.
7. Durable pruning tombstone-store head quorum-certificate records.

Newly added by v107:

1. Pruning tombstone-store head replay compaction checkpoints.
2. Checkpoint admission certificates scoped to pruning tombstone-store head witness authority.
3. Checkpoint-seeded witness-ledger replay with strict admission validation.
4. Checkpoint-seeded authority/key/seal replay with strict admission validation.
5. Checkpoint-seeded quorum-certificate-record replay with strict admission validation.
6. Replay obstruction for suffix-only histories, missing admissions, tampered checkpoint hashes, tenant mismatch, malformed frontiers, and bad latest certified-record snapshots.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable pruning tombstone-store head checkpoint-admission record stores and consistency proofs.
2. Pruning admission that requires durable checkpoint-admission history plus retained suffix continuity before physical prefix deletion.
3. Tombstone-gated store pruning APIs for pruning tombstone-store head witness, authority, and QC-record lanes.
4. Pruned-store continuity checks for this layer after actual row deletion.
5. Runtime and Axis adoption of admitted pruning tombstone-store head replay compaction.
6. Live Postgres restart tests proving compacted recovery without process memory.
7. Cross-agent gossip or monitoring for pruning tombstone-store head checkpoint admissions.
8. Direct SQL-delete hardening across the new compactable lanes.
9. Historical-vs-current replay policy for checkpoint admissions after later key rotation or revocation.
10. Topology-transition signer authority for this layer; checkpoint witnesses are signed, but topology transitions remain hash-chain authority.

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
10. SQ55: What durable checkpoint-admission record store and consistency proof make pruning tombstone-store head replay compaction checkpoints recoverable, non-equivocating, and prunable across agents and restarts?

## 6. Primitive Proposal Ledger

Name: Admitted Pruning Tombstone-Store Head Replay Compaction Checkpoint.

Problem it solves: v106 made certified required-head proof durable, but replay still required full witness, authority/key/seal, and QC-record prefixes. Deleting those prefixes without a replay-admitted checkpoint would let local summaries become operational state.

Research source: ARIES checkpoint/log recovery, Raft snapshot positioning, and PBFT stable checkpoint proofs.

Mechanism borrowed or adapted: compact a prefix only by carrying replay frontiers and replay-derived projection state; require a separate witness-signed checkpoint admission before the checkpoint can seed replay; require every retained suffix to continue the compacted hash chain.

Why current substrate lacked it: the pruning tombstone-store head layer had durable witness, topology, key status, seal, and QC-record history, but no admitted checkpoint object for replacing a replayed prefix.

Why existing primitives are insufficient: settlement-head and tombstone-head checkpoints govern different authority namespaces. Reusing those checkpoints would let a different witness topology authorize this layer's required-head recovery.

State guarantee it should create: a compacted pruning tombstone-store head prefix can support operational state only when the checkpoint was admitted by replayed pruning tombstone-store head witness authority and retained suffix records replay from its exact compacted frontiers.

Admission rule it requires: a checkpoint admission certificate must bind the exact checkpoint hash and include enough active pruning tombstone-store head witness signatures under strict signature verification.

Replay rule it requires: witness, authority, and QC-record replay may seed state from the checkpoint only after checkpoint-admission validation; otherwise they start at sequence 1 and reject suffix-only histories.

Authority boundary it requires: checkpoint admission belongs only to pruning tombstone-store head witness authority, not tombstone-head authority, settlement-head authority, adapter snapshots, connector cache, local files, summaries, or process memory.

Failure modes it should prevent:

- local summaries replacing replayed pruning tombstone-store head prefixes;
- suffix-only histories becoming operational after prefix deletion;
- tampered checkpoint bodies seeding replay;
- checkpoint bodies without witness admission seeding replay;
- stale key-status or seal projections being smuggled through compacted authority snapshots;
- durable QC-record history losing its latest certified proof after compaction.

Minimal implementation slice:

- Add checkpoint and admission-certificate types.
- Add deterministic checkpoint/admission hashing.
- Add checkpoint-seeded replay for witness, authority, and QC-record lanes.
- Add focused tests for suffix failure without checkpoint, missing admission failure, admitted replay success, authority seal recovery, latest QC-record recovery, and tampered checkpoint rejection.

Tests that would falsify it:

- A witness-ledger suffix starting at sequence 2 replays as valid without a checkpoint.
- A hash-valid checkpoint without admission can seed replay.
- A tampered checkpoint can seed replay with an old admission certificate.
- Authority suffix replay after checkpoint loses the compacted effective authority or seal projection.
- QC-record replay after checkpoint loses latest certified-record recovery.
- Suffix previous-hash mismatches are ignored after checkpoint seeding.

Axis surfaces that could later validate it:

- Axis C can simulate an amnesiac agent recovering compacted required-head state from checkpoint plus suffix.
- Axis A can run finance pruned-projection recovery with stale local cache and require admitted checkpoint replay to dominate it.
- Axis B can prove a domain adapter cannot supply a local checkpoint summary without witness checkpoint admission.

## 7. Falsification Criteria Applied Before Implementation

1. Replaying a pruning tombstone-store head witness-ledger suffix without the compacted checkpoint is invalid.
2. Replaying the same witness suffix with a checkpoint but no admission certificate is invalid.
3. Replaying the same witness suffix with an admitted checkpoint is valid and recovers the accepted required head.
4. Replaying an authority suffix without a checkpoint is invalid.
5. Replaying the authority suffix with an admitted checkpoint preserves the compacted authority basis and applies the retained epoch seal.
6. Replaying QC records from an admitted checkpoint with no retained suffix recovers the latest certified record.
7. Replaying with a tampered checkpoint and the old admission certificate is invalid.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A checksumed checkpoint is enough for compaction recovery. | Rejected. | It proves only self-consistency of a snapshot body, not replay admission under authority. |
| Durable QC records alone solve compaction. | Rejected. | They recover certified heads, but witness/authority/QC prefixes still cannot be pruned without a replay frontier and admitted projection seed. |
| Parent tombstone-head compaction can be reused for this layer. | Rejected. | It is scoped to a different authority topology and cannot authorize pruning tombstone-store head witness history. |

## 9. Implementation Frontier

Implemented now:

- Pruning tombstone-store head replay compaction checkpoint types.
- Checkpoint admission certificate types.
- Deterministic checkpoint and admission hashing.
- Strict witness-signed checkpoint-admission evaluation.
- Checkpoint-seeded replay for witness, authority, and QC-record lanes.
- Focused tests for suffix-only failure, missing admission failure, admitted recovery, authority suffix recovery, latest QC-record recovery, and tampered checkpoint rejection.

Remaining frontier:

1. Durable checkpoint-admission record stores for this layer.
2. Pruning admission requiring durable checkpoint history plus suffix continuity.
3. Tombstone-gated physical pruning APIs and continuity checks.
4. Runtime and axis adoption.
5. Live Postgres restart proof for compacted amnesiac recovery.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v107-pruning-tombstone-store-head-proof-preserving-compaction-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, changelog, and ledger files found no matches.

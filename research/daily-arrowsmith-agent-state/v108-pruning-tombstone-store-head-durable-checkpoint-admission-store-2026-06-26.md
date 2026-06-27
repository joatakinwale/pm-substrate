# v108 Pruning Tombstone-Store Head Durable Checkpoint-Admission Store

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed, broad verification pending
Parent: `research/daily-arrowsmith-agent-state/v107-pruning-tombstone-store-head-proof-preserving-compaction-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ55 - What durable checkpoint-admission record store and consistency proof make pruning tombstone-store head replay compaction checkpoints recoverable, non-equivocating, and prunable across agents and restarts?

Answer: the pruning tombstone-store head checkpoint admission certificate cannot remain a transient process object. The checkpoint body and its witness-signed admission certificate need a hash-linked durable admission-record history. Replay must verify sequence continuity, previous-record hashes, checkpoint body hashes, admission certificate hashes, strict admission re-evaluation, record hashes, and non-equivocation by checkpoint id and compacted frontier before any recovered checkpoint can seed operational state.

Implemented slice:

- Added pruning tombstone-store head replay compaction checkpoint-admission record types.
- Added deterministic checkpoint-admission record hashing.
- Added checkpoint-admission record replay with tenant, sequence, previous-hash, checkpoint hash, admission hash, admission replay, checkpoint-id conflict, frontier conflict, and record-hash checks.
- Added in-memory and Postgres-backed checkpoint-admission record stores.
- Added migration `0045_agent_state_projection_replay_pruning_tombstone_store_head_checkpoint_admissions.sql`.
- Extended focused agent-state tests so compacted replay consumes the admission certificate recovered from durable record replay.
- Added falsifiers for tampered admissions and conflicting checkpoint bodies for the same checkpoint identity/frontier.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Tamper-evident logs use compact commitments and proofs so append history and allowed deletion can be audited without trusting the logger. | Checkpoint admission becomes a durable hash-linked record chain; recovered checkpoint authority must replay from that chain, not from local memory. |
| Li et al. 2004, "Secure Untrusted Data Repository (SUNDR)" ([USENIX PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf)) | Fork consistency makes equivocation detectable when clients compare histories. | The admission replay rejects two checkpoint hashes for the same checkpoint id or compacted frontier, turning forked checkpoint histories into obstructions. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Key transparency clients monitor compact authenticated commitments for non-equivocation instead of trusting the provider's current answer. | Agents recover compaction authority by replaying durable admission records and checking record-chain commitments, not by trusting adapter-reported checkpoint status. |

## 3. Existing Substrate Map Delta

Already present before v108:

1. Durable pruning tombstone-store head witness observations.
2. Replayed pruning tombstone-store head witness authority topology.
3. Durable topology stores, key-status replay, and non-retroactive authority epoch seals.
4. Durable pruning tombstone-store head quorum-certificate proof records.
5. Pruning tombstone-store head replay compaction checkpoints.
6. Witness-signed checkpoint admission certificates.
7. Checkpoint-seeded witness, authority, and QC-record replay once a caller supplies a valid admission certificate.

Newly added by v108:

1. Durable checkpoint-admission record identity for pruning tombstone-store head replay compaction.
2. Hash-linked record-chain replay for checkpoint admissions.
3. Non-equivocation checks by checkpoint id and compacted frontier.
4. In-memory and Postgres checkpoint-admission record stores.
5. A durable migration table for checkpoint bodies plus admission certificates.
6. Recovery proof that compacted witness replay can consume the recovered durable admission record, not the transient local certificate.

## 4. Missing Substrate Map Delta

Still missing:

1. Pruning admission that requires durable checkpoint-admission history plus retained suffix continuity before physical prefix deletion.
2. Tombstone-gated physical pruning APIs for pruning tombstone-store head witness, authority, and QC-record lanes.
3. Pruned-store continuity checks for this layer after actual row deletion.
4. Runtime and Axis adoption of durable pruning tombstone-store head checkpoint admission.
5. Live Postgres restart tests proving compacted recovery without process memory.
6. Cross-agent gossip or monitoring for pruning tombstone-store head checkpoint-admission records.
7. Direct SQL-delete hardening across the new compactable lanes.
8. Historical-vs-current replay policy for checkpoint admissions after later key rotation or revocation.
9. Topology-transition signer authority for this layer; checkpoint witnesses are signed, but topology transitions remain hash-chain authority.
10. A general substrate abstraction that removes the repeated manual layering of checkpoint-admission records across settlement-head, tombstone-head, and pruning tombstone-store head histories.

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
10. SQ56: What pruning admission rule requires durable pruning tombstone-store head checkpoint-admission history plus retained witness, authority, and quorum-certificate suffix continuity before physical prefix deletion?

## 6. Primitive Proposal Ledger

Name: Durable Pruning Tombstone-Store Head Checkpoint-Admission Record Store.

Problem it solves: v107 could seed compacted replay from an admitted checkpoint, but the admission certificate itself could still be supplied from process memory or adapter input. A fresh agent needed durable history proving which checkpoint admission was actually admitted.

Research source: tamper-evident logging, SUNDR fork consistency, and CONIKS key transparency.

Mechanism borrowed or adapted: store every checkpoint body with its admission certificate in an append-only, hash-linked record chain; replay the chain before using any recovered checkpoint; reject conflicting checkpoint identities or compacted frontiers.

Why current substrate lacked it: the pruning tombstone-store head layer had the checkpoint and admission certificate but no durable record tying them to append history.

Why existing primitives are insufficient: settlement-head and tombstone-head durable checkpoint-admission stores govern different authority namespaces. Reusing them would let parent-layer witness authority authorize this layer's required-head recovery.

State guarantee it should create: checkpoint authority for pruning tombstone-store head replay compaction can be recovered only from admitted, replayable, non-equivocating record history.

Admission rule it requires: append must replay the full checkpoint-admission record history under strict pruning tombstone-store head witness signature policy before accepting a new record.

Replay rule it requires: a recovered checkpoint can seed replay only when the record chain verifies the checkpoint hash, admission hash, admission re-evaluation, previous-record hash, record hash, and absence of checkpoint-id/frontier conflict.

Authority boundary it requires: durable checkpoint admission belongs to pruning tombstone-store head witness authority and cannot be supplied by memory, summaries, connector caches, local snapshots, or parent checkpoint-admission stores.

Failure modes it should prevent:

- process-memory admission certificates authorizing compacted recovery after restart;
- adapter-supplied checkpoint summaries outranking durable admission history;
- two checkpoint hashes for the same checkpoint id becoming usable in different agents;
- two checkpoint bodies for the same compacted frontier becoming usable in different agents;
- tampered checkpoint or admission bodies seeding replay;
- suffix replay using a checkpoint whose admission cannot be recovered from store history.

Minimal implementation slice:

- Add record types, hashing, replay, issue codes, and store interface.
- Add in-memory and Postgres-backed store implementations.
- Add migration for durable checkpoint-admission records.
- Extend tests to recover checkpoint admission from the store and use it to seed compacted replay.
- Add tampered-admission and conflicting-checkpoint falsifiers.

Tests that would falsify it:

- A tampered admission certificate appends to the store.
- A conflicting checkpoint hash for the same checkpoint id replays as valid.
- A conflicting checkpoint body for the same compacted frontier replays as valid.
- A recovered admission record cannot seed the compacted witness replay that a transient certificate can seed.
- A broken previous-record hash or record hash replays as valid.

Axis surfaces that could later validate it:

- Axis C can restart an amnesiac local agent and require compacted required-head recovery from durable admission records.
- Axis A can try to use stale local cache as checkpoint authority and require durable record replay to dominate it.
- Axis B can prove a domain adapter cannot supply a checkpoint summary without durable admission history.

## 7. Falsification Criteria Applied Before Implementation

1. A durable checkpoint-admission record history with one valid record replays as valid.
2. The latest recovered durable admission record can seed pruning tombstone-store head witness replay.
3. A tampered admission hash cannot append to the durable admission store.
4. A second checkpoint hash for the same checkpoint id produces a checkpoint-conflict obstruction.
5. A second checkpoint body for the same compacted frontier produces a checkpoint-conflict obstruction.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A witness-signed checkpoint admission certificate is enough if callers pass it to replay. | Rejected. | The certificate must itself be recoverable from durable record history; otherwise process memory or adapter input remains an authority channel. |
| Checkpoint hash equality alone prevents equivocation. | Rejected. | SUNDR/CONIKS-style non-equivocation requires detecting divergent histories or conflicting bindings, not merely checking each object in isolation. |
| Parent durable checkpoint-admission stores can authorize this layer. | Rejected. | They are scoped to different witness authority and compacted frontiers. |

## 9. Implementation Frontier

Implemented now:

- Pruning tombstone-store head checkpoint-admission record types.
- Deterministic checkpoint-admission record hashing.
- Record-chain replay with non-equivocation checks.
- In-memory and Postgres-backed checkpoint-admission stores.
- Migration `0045_agent_state_projection_replay_pruning_tombstone_store_head_checkpoint_admissions.sql`.
- Focused tests for recovered replay seeding, tampered-admission append rejection, and conflicting checkpoint obstruction.

Remaining frontier:

1. Pruning admission requiring durable checkpoint history plus retained suffix continuity.
2. Tombstone-gated physical pruning APIs and continuity checks for this layer.
3. Runtime and axis adoption.
4. Live Postgres restart proof for compacted amnesiac recovery.
5. Cross-agent checkpoint-admission monitoring/gossip.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts db/migrations/0045_agent_state_projection_replay_pruning_tombstone_store_head_checkpoint_admissions.sql research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v108-pruning-tombstone-store-head-durable-checkpoint-admission-store-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, migration, changelog, and ledger files found no matches.

# v82 Proof-Preserving Replay Compaction

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v81-settlement-head-witness-key-status-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ29 - What proof-preserving compaction rule lets witness ledgers and key histories be pruned without losing replay of quorum-certificate records and key-currentness decisions?

Answer: a pruned prefix can only be forgotten if replay has admitted a checkpoint that carries the prefix's sequence/hash frontier and the derived projection needed to continue replay. Compaction is therefore not deletion; it is a transition from full prefix replay to checkpoint-plus-suffix replay. Without a hash-valid compaction checkpoint, pruned suffixes still fail sequence and previous-hash checks.

Implemented slice:

- Added settlement-head witness replay compaction checkpoint types.
- Added checkpoint hashing and a builder that normalizes tenant and sorted projection fields.
- Witness-ledger replay can resume from a checkpoint carrying accepted heads plus compacted witness sequence/hash.
- Authority/key-history replay can resume from a checkpoint carrying principal state, quorum settings, epoch seals, and compacted authority sequence/hash.
- Quorum-certificate record replay can resume from a checkpoint carrying the certificate-record sequence/hash frontier and latest certified record.
- Added falsification tests proving pruned suffixes fail without checkpoints, replay with checkpoints recovers the same projections, and tampered checkpoints invalidate replay.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf)) | Raft snapshots allow log entries through the last included index to be discarded while retaining enough index/term state to continue the log. | A replay compaction checkpoint carries the compacted sequence/hash frontier so suffix replay cannot pretend to start at sequence 1. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints have a proof of correctness and allow replicas to discard older protocol messages below the checkpoint watermark. | The checkpoint becomes the substrate proof object that replaces old witness/authority/certificate prefixes during recovery. |
| Mohan et al. 1992, "ARIES" ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Fuzzy checkpoints reduce restart work by recording recovery-relevant state while transaction processing continues. | The checkpoint stores replay-relevant projections so amnesiac recovery need not scan from genesis. |
| Miller et al. 2014, "Authenticated Data Structures, Generically" ([PDF](https://soc1024.ece.illinois.edu/gpads/gpads-full.pdf)) | Authenticated data structures let a verifier check compact operation results against a digest rather than recomputing an entire structure. | The compaction checkpoint hash authenticates the projected replay state that stands in for pruned transition history. |
| Papadopoulos et al. 2018, "Transparency Logs via Append-Only Authenticated Dictionaries" ([PDF](https://cse.hkust.edu.hk/~dipapado/docs/aad.pdf)) | Append-only authenticated logs need compact proofs so clients can audit state without downloading all history. | The substrate checkpoint preserves the hash frontier and latest proof objects needed for compact replay. |

## 3. Existing Substrate Map Delta

Already present before v82:

1. Witness ledgers replayed from sequence 1 with previous-observation hash chaining.
2. Settlement-head authority/key history replayed from sequence 1 with previous-authority hash chaining.
3. Quorum-certificate record replayed from sequence 1 with previous-record hash chaining.
4. Key status was replayed from authority history.
5. Certificate records preserved signed witness evidence and latest certified proof objects.

Newly strengthened by v82:

1. Replay can now resume from a hash-checked checkpoint instead of requiring the full prefix.
2. A compacted witness prefix carries accepted-head projection plus witness sequence/hash frontier.
3. A compacted authority prefix carries principal/key projection, quorum settings, epoch seals, and authority sequence/hash frontier.
4. A compacted certificate-record prefix carries latest certified record plus certificate-record sequence/hash frontier.
5. Pruned suffix replay remains invalid without a checkpoint.
6. Tampered checkpoint bodies are rejected before they can seed replay.

## 4. Missing Substrate Map Delta

Still missing:

1. Quorum or authority admission for compaction checkpoints themselves.
2. Durable checkpoint stores and migrations.
3. Checkpoint consistency proofs across successive checkpoints.
4. Production checkpoint signatures and multi-authority approval.
5. Database-level pruning operations that only delete prefixes after checkpoint admission.
6. External checkpoint gossip or replication to independent monitors.
7. Integration into strict graph/capability write recovery paths.
8. Compaction policies for settlement stores and root-witness ledgers outside the settlement-head layer.
9. Obstruction algebra for checkpoint conflict, stale checkpoint, and checkpoint/suffix mismatch.
10. Axis A/C runner validation under actual pruned stores.

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
10. SQ30: What checkpoint-admission authority makes replay compaction checkpoints themselves admissible, so arbitrary hash-valid snapshots cannot replace transition-derived state?

## 6. Primitive Proposal Ledger

Name: Settlement-Head Witness Replay Compaction Checkpoint.

Problem it solves: v81 made replay richer, but every recovery still needed genesis-to-head witness records, key-history transitions, and certificate records. Pruning any prefix would destroy replay unless the compacted projection was admitted as a proof object.

Research source: Raft snapshots, PBFT stable checkpoints, ARIES fuzzy checkpoints, authenticated data structures, and authenticated append-only logs.

Mechanism borrowed or adapted: replace an old log prefix with a checkpoint carrying the last included sequence/hash plus enough derived state to validate later suffix entries.

Why current substrate lacked it: replay functions had fixed genesis assumptions: expected sequence 1, no prior hash, and empty derived projection.

Why existing primitives were insufficient: certificate records and key status were replayable only while all supporting prefixes remained present. A fresh agent could not recover from a pruned store without trusting private memory or a caller-supplied projection.

State guarantee it should create: a pruned prefix can be operationally replaced only by a hash-valid replay compaction checkpoint whose frontier matches the suffix and whose projection seeds deterministic replay.

Admission rule it requires: a checkpoint must name its tenant, checkpoint id, recorded time, compacted sequence/hash frontiers, and replay projections for every compacted lane it claims.

Replay rule it requires: replay verifies the checkpoint hash and tenant, seeds expected sequence/previous hash from the checkpoint, then replays only suffix records; without the checkpoint, the same suffix must fail sequence or previous-hash checks.

Authority boundary it requires: compaction is a substrate replay object, not a storage-engine deletion or adapter cache.

Failure modes it should prevent:

- pruning witness rows and then treating suffix rows as a new ledger;
- pruning key-history transitions and then trusting caller-supplied principal state;
- pruning certificate records and losing the latest certified proof object;
- accepting a suffix whose first previous hash does not match the compacted prefix;
- accepting a tampered checkpoint as replay state.

Minimal implementation slice:

- Add replay compaction checkpoint types and hashing.
- Add optional checkpoint inputs to witness, authority, and certificate-record replay.
- Seed replay projections only after checkpoint validation.
- Add tests for suffix failure without checkpoint, success with checkpoint, and tampered-checkpoint failure.

Tests that would falsify it:

- A pruned witness suffix replays valid without a checkpoint.
- A pruned authority suffix replays valid without a checkpoint.
- A pruned certificate-record suffix replays valid without a checkpoint.
- A tampered checkpoint can seed replay.
- A checkpoint-seeded authority replay loses rotated key status or quorum settings.
- A checkpoint-seeded record replay loses the latest certified proof record.

Axis surfaces that could later validate it:

- Axis C can restart an agent from a pruned local store and require checkpoint-plus-suffix recovery.
- Axis A can verify finance write authority after pruning old witness/key histories.
- Axis B can require domain adapters to cite checkpoint-backed recovery rather than profile-local cached state.

## 7. Falsification Criteria Applied Before Verification

1. Replaying a pruned witness suffix without a checkpoint fails.
2. Replaying that suffix with a checkpoint succeeds and preserves accepted heads.
3. Replaying a pruned authority/key-history suffix without a checkpoint fails.
4. Replaying that suffix with a checkpoint succeeds and preserves rotated key status.
5. Replaying a pruned certificate-record suffix without a checkpoint fails.
6. Replaying that suffix with a checkpoint succeeds and recovers the latest certified record.
7. Tampering with the checkpoint body while keeping the old checkpoint hash invalidates replay.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Append-only replay requires keeping every prefix row forever. | Falsified in pure replay. | v82 can resume from a hash-valid checkpoint plus suffix. |
| A checkpoint is just a storage optimization. | Rejected. | v82 treats it as an operational replay object with sequence/hash frontiers and projected state. |
| A suffix can be trusted to restart at sequence 1 after pruning. | Falsified. | v82 tests prove pruned suffixes fail without a checkpoint. |
| Hash-valid checkpoints are sufficient final authority. | Not proven. | v82 records SQ30 because checkpoint admission still needs a quorum/authority rule. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpoint`.
- Checkpoint witness-ledger, authority-topology, and quorum-certificate-record snapshots.
- Checkpoint hash builder and verifier.
- Optional checkpoint input for settlement-head witness ledger replay.
- Optional checkpoint input for settlement-head witness authority/key-history replay.
- Optional checkpoint input for durable quorum-certificate record replay.
- Focused test covering pruned suffix failure, checkpoint replay success, rotated key preservation, latest certificate recovery, and tampered checkpoint failure.

Remaining frontier:

1. Authority/quorum admission for checkpoints.
2. Durable checkpoint stores and migrations.
3. Actual pruning methods that require admitted checkpoints before deletion.
4. Checkpoint consistency proof chains.
5. Runtime adoption in recovery and strict write gates.
6. Axis validation under pruned stores.

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
- Full workspace `pnpm typecheck` passed.
- Broad substrate Vitest slice passed: 31 files passed, 391 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves the pure replay checkpoint primitive across the current workspace test slice. It does not yet prove checkpoint authority admission, durable checkpoint persistence, actual pruning, checkpoint-chain consistency, or Axis A/B/C adoption.

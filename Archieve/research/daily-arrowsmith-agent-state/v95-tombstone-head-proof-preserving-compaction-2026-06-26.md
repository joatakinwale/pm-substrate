# v95 Tombstone-Head Proof-Preserving Compaction

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v94-tombstone-head-witness-key-status-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ42 - What tombstone-head proof-preserving compaction checkpoint preserves witness ledgers, key-status history, and quorum-certificate records without letting summaries become authority?

Answer: tombstone-head compaction needs an admitted replay checkpoint, not a summary snapshot. The checkpoint carries compacted sequence/hash frontiers plus the projection state full replay would have produced: accepted tombstone heads, replayed tombstone-head witness/key topology, epoch seals, and latest durable quorum-certificate record. Replay can resume from that checkpoint only when a tombstone-head checkpoint admission certificate replays as admitted under strict witness signatures. The retained suffix must still hash-chain from the compacted frontier.

Implemented slice:

- Added pruning tombstone-head witness replay compaction checkpoint types.
- Added deterministic checkpoint and checkpoint-admission hashes.
- Added tombstone-head checkpoint admission certificates signed by replay-admitted tombstone-head witnesses.
- Tombstone-head witness-ledger replay can resume from admitted checkpoint frontiers and accepted-head projection.
- Tombstone-head authority/key-history replay can resume from admitted checkpoint frontiers and principal/key-status projection.
- Tombstone-head quorum-certificate-record replay can resume from admitted checkpoint frontiers and latest certified-record projection.
- Replay rejects suffix-only histories, missing checkpoint admissions, and tampered checkpoint bodies.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" ([ACM](https://dl.acm.org/doi/10.1145/128765.128770), [PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Checkpoints identify recovery frontiers, but restart still uses log analysis/redo from the checkpoint boundary. | Tombstone-head checkpoints seed replay state, but suffix records must still hash-chain and replay from the compacted frontier. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro), [PDF](https://raft.github.io/raft.pdf)) | Snapshots compact logs while preserving position with last-included index/term, so a suffix can continue the log. | Tombstone-head checkpoints carry compacted sequence/hash frontiers for witness, authority, and QC-record lanes. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints require signed proof from enough replicas before prior log messages can be discarded. | Tombstone-head checkpoint seeding requires a replayed admission certificate signed by enough active tombstone-head witnesses. |

## 3. Existing Substrate Map Delta

Already present before v95:

1. v82/v83 created settlement-head proof-preserving replay compaction plus checkpoint admission.
2. v88 through v94 created tombstone-head witness ledgers, authority topology, durable topology stores, epoch seals, signatures, durable quorum-certificate records, and replayed witness key status.
3. Tombstone-head witness, authority, and QC-record lanes were hash-linked but still required full-prefix replay.

Newly added by v95:

1. Tombstone-head witness-ledger compaction checkpoints.
2. Tombstone-head authority/key-history compaction checkpoints.
3. Tombstone-head quorum-certificate-record compaction checkpoints.
4. Tombstone-head checkpoint admission certificates under tombstone-head witness authority.
5. Checkpoint-seeded replay for tombstone-head witness, authority, and QC-record suffixes.
6. Replay obstruction for missing admissions, tampered checkpoint bodies, sequence gaps, and prior-hash mismatches after compaction.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable tombstone-head checkpoint-admission record stores and consistency proofs.
2. Tombstone-head pruning admission that requires a durable admitted checkpoint record plus retained suffix replay before physical prefix deletion.
3. Tombstone-head tombstone-gated store pruning APIs for witness, authority, and QC-record lanes.
4. Runtime and Axis adoption of tombstone-head checkpoint/admission replay.
5. Postgres integration tests proving checkpoint recovery after actual tombstone-head prefix pruning.
6. Cross-agent gossip/monitoring for tombstone-head checkpoint admissions.
7. Direct SQL-delete hardening across tombstone-head witness, authority, and QC-record lanes.
8. Production crypto/key-management adapters for tombstone-head checkpoint admission signatures.
9. Historical-vs-current replay policy for archived tombstone-head checkpoint admissions after later key rotation or revocation.
10. A compact consistency-proof format for tombstone-head advancement that avoids replaying full tombstone histories inside witness consistency proofs.

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
10. SQ43: What durable tombstone-head checkpoint-admission record store and consistency proof make admitted tombstone-head replay checkpoints recoverable, non-equivocating, and prunable across agents and restarts?

## 6. Primitive Proposal Ledger

Name: Admitted Tombstone-Head Replay Compaction Checkpoint.

Problem it solves: tombstone-head witness, authority/key-status, and quorum-certificate histories can grow without bound, but replacing their prefixes with summaries would let private representation masquerade as operational state.

Research source: ARIES checkpoint/log recovery, Raft snapshot log positioning, and PBFT stable checkpoint proofs.

Mechanism borrowed or adapted: compact a prefix only by carrying replay frontiers and the projection state derived by prior replay; require a separate quorum-signed checkpoint admission before the checkpoint can seed replay; require every retained suffix to continue the compacted hash chain.

Why current substrate lacked it: v88-v94 made tombstone-head currentness durable and signed, but replay still needed the full witness, authority, and QC-record prefixes.

Why existing primitives were insufficient: settlement-head compaction is scoped to settlement-head authority, not tombstone-head authority. Tombstone-head checkpoints must preserve pruning tombstone heads, tombstone-head principals, key-status history, epoch seals, and tombstone-head QC records under their own witness topology.

State guarantee it should create: a compacted tombstone-head prefix can support operational state only when the checkpoint was admitted by replayed tombstone-head witness authority and retained suffix records replay from its exact compacted frontiers.

Admission rule it requires: a checkpoint admission certificate must bind the exact checkpoint hash and include enough active tombstone-head witness signatures under strict signature verification.

Replay rule it requires: witness, authority, and QC-record replay may seed state from the checkpoint only after checkpoint-admission validation; otherwise they start at sequence 1 and reject suffix-only histories.

Authority boundary it requires: checkpoint admission belongs to pruning tombstone-head witness authority topology, not settlement-head topology, local memory, adapter-provided snapshots, connector cache, or process-local recovery summaries.

Failure modes it should prevent:

- local summaries replacing replayed tombstone-head prefixes;
- suffix-only tombstone-head histories becoming operational after prefix deletion;
- tampered checkpoint bodies seeding replay;
- checkpoint bodies without witness admission seeding replay;
- stale key-status projections being smuggled through a compacted authority snapshot;
- durable QC-record history losing its latest certified proof after compaction.

Minimal implementation slice:

- Add tombstone-head replay compaction checkpoint and admission-certificate types.
- Add deterministic checkpoint/admission hashing.
- Add checkpoint-seeded replay for tombstone-head witness, authority, and QC-record lanes.
- Add focused tests for suffix failure without checkpoint, missing admission failure, admitted replay success, authority key-state recovery, latest QC-record recovery, and tampered checkpoint rejection.

Tests that would falsify it:

- A witness-ledger suffix starting at sequence 2 replays as valid without a checkpoint.
- A hash-valid checkpoint without admission can seed replay.
- A tampered checkpoint can seed replay with an old admission certificate.
- Authority suffix replay after checkpoint loses witness key-status projection.
- QC-record suffix replay after checkpoint loses latest certified-record recovery.
- Suffix previous-hash mismatches are ignored after checkpoint seeding.

Axis surfaces that could later validate it:

- Axis C can simulate an amnesiac agent recovering pruned tombstone-head state from checkpoint plus suffix.
- Axis A can run finance pruned-projection recovery after tombstone-head prefix compaction.
- Axis B can prove a domain adapter cannot supply a local checkpoint summary without tombstone-head checkpoint admission.

## 7. Falsification Criteria Applied Before Verification

1. Replaying a tombstone-head witness-ledger suffix without the compacted checkpoint is invalid.
2. Replaying a tombstone-head witness-ledger suffix with a checkpoint but no admission certificate is invalid.
3. Replaying the same suffix with an admitted checkpoint is valid and recovers the accepted tombstone head.
4. Replaying an authority suffix with an admitted checkpoint preserves the compacted principal/key-status topology and applies a later rotation.
5. Replaying a QC-record suffix with an admitted checkpoint recovers the later latest certified record.
6. Replaying with a tampered checkpoint and the old admission certificate is invalid.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A hash-valid tombstone-head checkpoint is sufficient to seed replay. | Rejected. | v95 replay validation requires a checkpoint admission certificate under strict tombstone-head witness signatures. |
| Settlement-head checkpoint authority can stand in for tombstone-head checkpoint authority. | Rejected. | v95 adds tombstone-head-scoped checkpoint admission over pruning tombstone-head witness topology and key status. |
| Full tombstone-head prefix replay is the only way to preserve operational state. | Rejected. | v95 shows admitted checkpoint projection plus hash-linked suffix replay can preserve the state guarantee while bounding replay length. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head replay compaction checkpoint types.
- Tombstone-head checkpoint admission certificate types.
- Deterministic checkpoint/admission hashing.
- Checkpoint admission evaluation and validation under strict tombstone-head witness signatures.
- Checkpoint-seeded witness-ledger, authority/key-history, and QC-record replay.
- Focused suffix replay and tamper tests.

Remaining frontier:

1. Durable tombstone-head checkpoint-admission record stores.
2. Tombstone-head checkpoint-admission record consistency proofs and conflict detection.
3. Tombstone-head pruning admission over admitted checkpoints plus retained suffix replay.
4. Tombstone-head tombstone-gated physical pruning APIs and Postgres integration tests.
5. Runtime and Axis adoption.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 73 tests.
- Full workspace typecheck passed.
- Broad substrate/frontier Vitest sweep passed: 31 files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves pure tombstone-head checkpoint/admission replay and focused suffix/tamper falsifiers. It does not yet prove durable checkpoint-admission stores, actual physical tombstone-head pruning, Postgres pruning recovery, runtime/Axis adoption, cross-agent checkpoint monitoring, or production crypto/key management.

# v118 Pruning Tombstone History Store-Head Proof-Preserving Compaction

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v117-pruning-tombstone-history-store-head-quorum-certificate-record-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ65 - What proof-preserving compaction checkpoint lets pruning tombstone history-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

Answer: v117 made certified pruning tombstone history-store heads durable, but retained suffix replay still needed the unpruned prefix unless a caller supplied memory of prior witness decisions, authority topology, or latest QC record. The missing substrate primitive is an authority-admitted replay compaction checkpoint for this exact history-store-head witness namespace. The checkpoint carries compacted frontiers plus replay-derived projections for the witness ledger, authority topology, and QC-record lane. Replay may seed from the checkpoint only when the checkpoint hash is witnessed by enough active history-store-head principals under strict signatures.

Implemented slice:

- Added pruning tombstone history-store head replay compaction checkpoint and checkpoint-admission certificate types.
- Added deterministic checkpoint hashing, admission witness payload hashing, admission hashing, and admission replay validation.
- Added checkpoint-seeded replay for history-store-head witness records.
- Added checkpoint-seeded replay for history-store-head authority/key/seal transitions.
- Added checkpoint-seeded replay for history-store-head quorum-certificate records.
- Added focused tests proving suffix-only replay fails, missing checkpoint admission fails, admitted checkpoint replay recovers witness/authority/QC projections, and tampered checkpoints are rejected.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([IBM/ACM](https://research.ibm.com/publications/aries-a-transaction-recovery-method-supporting-fine-granularity-locking-and-partial-rollbacks-using-write-ahead-logging), [PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery starts from logged checkpoints and continues through write-ahead log history, preserving enough redo/undo information to reconstruct state after crash. | The substrate checkpoint is a replay seed only when admitted, and retained suffix records must continue from the checkpoint frontiers. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([USENIX ATC](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro), [PDF](https://raft.github.io/raft.pdf)) | Raft snapshots compact logs while preserving the last included index/term so future log replay remains anchored to committed history. | The checkpoint records compacted-through sequence/hash frontiers for each lane so suffix replay cannot float free of admitted history. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints require quorum proof before old log entries can be discarded. | History-store-head compaction checkpoints require witness-signed admission under the same authority namespace before they can constitute operational replay state. |

## 3. Existing Substrate Map Delta

Already present before v118:

1. V112 durable witness-ledger recovery for pruning tombstone history-store heads.
2. V113 signed quorum authority over those witness rows.
3. V114 durable authority-transition stores and store-backed certification.
4. V115 replayed key rotation/revocation.
5. V116 non-retroactive authority epoch seals.
6. V117 durable QC proof records for certified history-store heads.
7. Same-pattern admitted compaction checkpoints for settlement-head, tombstone-head, and pruning tombstone-store head witness layers.

Newly added by v118:

1. History-store-head replay compaction checkpoints scoped to the v112-v117 authority namespace.
2. Checkpoint admission certificates signed by active history-store-head witness principals.
3. Witness-ledger replay seeded by compacted witness sequence/hash and accepted-head projection.
4. Authority replay seeded by compacted authority sequence/hash, principal/key state, effective topology hash, and sealed frontier projection.
5. QC-record replay seeded by compacted certificate-record sequence/hash and latest certified proof record.
6. Replay rejection for suffix-only recovery, missing admission, tampered checkpoint hashes, tenant mismatch, malformed checkpoint frontiers, and invalid checkpoint-certified record snapshots.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable checkpoint-admission record stores and consistency proof for v118 checkpoints.
2. Pruning admission and tombstone-gated deletion for v118 compacted histories.
3. Runtime and Axis adoption of v118 compacted recovery.
4. Live Postgres restart proof that a fresh process can recover from admitted checkpoint plus retained suffix only.
5. Generic nested currentness/witness abstraction to reduce repetition across layered head ledgers.
6. Recovery-kernel inventory for every compacted required head and supporting authority store.
7. Production cryptographic verifier adapters.
8. Transition-authority signatures for the history-store head witness authority transitions themselves.
9. Historical key-validity semantics that distinguish valid-for-historical-proof from current-for-new-certification.
10. Monitoring that detects callers replaying retained suffixes without admitted compaction checkpoints.

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
10. SQ66: What durable checkpoint-admission record store and consistency proof makes pruning tombstone history-store head compaction authority recoverable after amnesia rather than supplied as an in-memory certificate?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Replay Compaction Checkpoint.

Problem it solves: after v117, certified required history-store heads were durable, but replay after prefix pruning still needed unpruned witness, authority, and QC-record prefixes or trusted local summaries.

Research source: ARIES checkpoint recovery, Raft snapshot/log compaction, and PBFT stable checkpoint proof.

Mechanism borrowed or adapted: a compacted prefix may be replaced by a checkpoint only if the checkpoint preserves replay frontiers and sufficient admitted proof for future recovery.

Why current substrate lacked it: the history-store-head layer had durable rows and proof records, but no admitted object that could seed replay after those rows are pruned.

Why existing primitives are insufficient: earlier compaction checkpoints are scoped to other authority namespaces. Reusing them would let a different head layer authorize history-store-head recovery.

State guarantee it should create: a retained suffix can become operational replay state only when anchored to a hash-valid checkpoint admitted by the history-store-head witness authority.

Admission rule it requires: active history-store-head witness principals must sign the exact checkpoint hash under strict signature policy, and the admission must replay as admitted from the checkpoint authority snapshot.

Replay rule it requires: witness, authority, and QC-record replayers must reject suffixes that skip compacted prefixes unless a valid checkpoint and admitted certificate seed the expected next sequence and previous hash.

Authority boundary it requires: checkpoint admission is scoped only to pruning tombstone history-store head witness replay compaction. It does not authorize tombstone-head, pruning tombstone-store head, settlement-head, graph, domain, or connector state.

Failure modes it should prevent:

- retained suffix replay silently outranking missing prefix history;
- agent memory supplying accepted heads after witness-prefix pruning;
- adapter summaries supplying authority topology after authority-prefix pruning;
- local QC snapshots replacing durable certificate-record proof;
- tampered checkpoints seeding replay;
- checkpoints signed by stale, revoked, wrong-key, or unauthorized witnesses.

Minimal implementation slice:

- Add checkpoint, checkpoint hash, admission evidence, and admission certificate types.
- Add admission evaluation and validation under strict history-store-head witness signatures.
- Add checkpoint-seeded witness, authority, and QC-record replay.
- Add focused falsifiers for suffix-only replay, missing admission, admitted recovery, and tampered checkpoint rejection.

Tests that would falsify it:

- Witness suffix beginning after sequence 1 replays valid without checkpoint.
- Checkpoint-seeded witness replay succeeds without admitted checkpoint certificate.
- Authority suffix containing only the seal replays valid without checkpoint.
- QC-record replay accepts a tampered checkpoint hash.
- An admitted checkpoint fails to recover the latest accepted head or latest certified QC record.

Axis surfaces that could later validate it:

- Axis C can restart after pruning and recover current required history-store head from checkpoint plus suffix.
- Axis A can try stale cached heads against compacted recovery and expect the admitted checkpoint history to dominate.
- Axis B can force domain adapters to reference admitted compaction proof rather than pass synthetic history-store-head summaries.

## 7. Falsification Criteria Applied Before Implementation

1. A witness suffix starting at sequence 2 must replay invalid without a compaction checkpoint.
2. The same witness suffix must replay invalid when a checkpoint is present but no admitted checkpoint certificate is provided.
3. The same witness suffix must replay valid when seeded by a hash-valid, admitted checkpoint.
4. An authority suffix containing only the epoch seal must replay invalid without checkpoint and valid with admitted checkpoint.
5. QC-record replay must recover the latest certified record from the checkpoint with no retained QC records.
6. Tampering with the checkpoint hash must make QC-record replay invalid.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable QC records are enough for pruning-safe recovery. | Rejected. | The QC record proves certification, but retained suffix replay still needs a replay-admitted way to replace pruned witness and authority prefixes. |
| A checkpoint can be trusted if its hash matches. | Rejected. | Hash validity proves integrity of the checkpoint body, not authority to seed replay. v118 requires witness-signed admission. |
| Accepted-head and topology summaries are harmless after pruning. | Rejected. | Without checkpoint admission they are operational state supplied by memory or adapters, not constituted by admitted transition history. |

## 9. Implementation Frontier

Implemented now:

- History-store-head replay compaction checkpoint/admission types.
- Checkpoint and admission hash functions.
- Strict witness-signed checkpoint admission evaluation and validation.
- Checkpoint-seeded witness, authority, and QC-record replay.
- Focused tests for suffix-only rejection, missing-admission rejection, admitted recovery, and tampered-checkpoint rejection.

Remaining frontier:

1. SQ66 durable checkpoint-admission record stores and consistency proof for v118 checkpoint authority.
2. Pruning admission and tombstone-gated deletion for the history-store-head compacted lanes.
3. Runtime and Axis adoption.
4. Live Postgres restart proof for amnesiac compacted recovery.
5. Generic nested currentness/witness abstraction.

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

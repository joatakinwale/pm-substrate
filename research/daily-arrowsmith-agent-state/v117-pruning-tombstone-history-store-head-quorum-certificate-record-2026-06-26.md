# v117 Pruning Tombstone History Store-Head Quorum-Certificate Record

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v116-pruning-tombstone-history-store-head-witness-authority-epoch-seal-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ64 - What durable quorum-certificate proof record makes certified pruning tombstone history-store heads recoverable without transient recertification or later topology/key-status replay?

Answer: v116 sealed the authority epoch for a certified pruning tombstone history-store head, but the certificate itself was still a transient evaluator result. The missing substrate primitive is a hash-chained quorum-certificate proof record for this exact authority namespace. The record binds the certified certificate, accepted witness ids, witness ledger sequence/hash evidence, witness signatures, optional authority epoch seal, previous record hash, and record hash. Replay can recover the latest certified proof without asking an agent to remember a certificate, rerun live certification against mutable stores, or trust adapter-supplied certificate summaries.

Implemented slice:

- Added pruning tombstone history-store head quorum-certificate witness-evidence and durable record types.
- Added deterministic record hashing and record-chain replay.
- Added replay validation for tenant, sequence, previous hash, certified-only admission, certificate hash, record hash, accepted witness evidence, strict witness signatures, key currentness, and authority seal binding.
- Added in-memory and Postgres-backed quorum-certificate record stores.
- Added migration `0049_agent_state_projection_replay_pruning_tombstone_history_store_head_witness_quorum_certificates.sql`.
- Added focused tests proving valid durable record replay, tampered witness-evidence rejection, forged seal rejection, and unsigned-evidence append rejection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | PBFT keeps authenticated protocol evidence and checkpoint proof material so recovery and view changes can justify prior decisions. | The substrate record keeps the quorum proof as durable evidence instead of recomputing certification from later topology or process memory. |
| Yin et al. 2019, "HotStuff: BFT Consensus in the Lens of Blockchain" ([arXiv](https://arxiv.org/abs/1803.05069)) | Quorum certificates are first-class proof objects that later protocol phases use to reason from certified history rather than local belief. | Certified pruning tombstone history-store heads become explicit proof records with certificate hashes and supporting witness evidence. |
| Nikitin et al. 2017, "CHAINIAC" ([USENIX Security](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin)) | Independent witnesses collectively verify updates and a tamper-proof release log stores collectively signed updates for catch-up validation. | The record store is a transparency-log-like proof history for required pruning tombstone history-store heads; an amnesiac agent can replay records and signatures from storage. |

## 3. Existing Substrate Map Delta

Already present before v117:

1. V112 durable witness-ledger recovery for pruning tombstone history-store heads.
2. V113 signed quorum authority for those witness rows.
3. V114 durable authority-transition stores and store-backed certification.
4. V115 replayed key rotation/revocation for witness keys.
5. V116 authority epoch seals preventing later topology/key-status transitions from governing sealed historical certification sequences.
6. Same-pattern durable QC record lanes on settlement-head, tombstone-head, and pruning tombstone-store head witness layers.

Newly added by v117:

1. Durable pruning tombstone history-store head quorum-certificate proof records.
2. Record-chain replay for certified pruning tombstone history-store head certificates.
3. Witness-evidence projection from stored witness records into durable proof records.
4. Replay validation of certificate hashes and record hashes.
5. Replay validation that accepted witness evidence matches accepted witness ids.
6. Replay validation of witness signatures against pruning tombstone history-store head authority topology.
7. Replay validation that an attached authority epoch seal binds the certificate hash, effective authority topology hash, sequence, and transition hash.
8. In-memory and Postgres stores that refuse append unless the full record history replays.

## 4. Missing Substrate Map Delta

Still missing:

1. Proof-preserving compaction checkpoints over v112 witness rows, v114 authority/key/seal history, and v117 QC records.
2. Pruning admission and tombstone-gated deletion for v117 histories.
3. Runtime and Axis adoption of v117 durable certified-history-store-head recovery.
4. Live Postgres restart proof that a fresh process recovers the latest certified required head from QC record history.
5. Generic nested currentness/witness abstraction to reduce repetition across layered head ledgers.
6. Recovery-kernel inventory for every compacted required head and supporting authority store.
7. Production cryptographic verifier adapters.
8. Transition-authority signatures for the history-store head witness authority transitions themselves.
9. Historical key-validity semantics that distinguish valid-for-historical-proof from current-for-new-certification.
10. Monitoring that detects callers evaluating history-store head recovery without durable QC records.

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
10. SQ65: What proof-preserving compaction checkpoint lets pruning tombstone history-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Quorum-Certificate Record.

Problem it solves: v116 could certify and seal a required pruning tombstone history-store head, but the certificate itself still existed as a transient evaluation result. Recovery still had to recertify from witness and authority rows, leaving later topology/key-status replay and local process continuity too close to operational authority.

Research source: PBFT stable checkpoint/proof material, HotStuff quorum certificates, and CHAINIAC collectively signed release logs.

Mechanism borrowed or adapted: a quorum certificate is a durable proof object, not merely a result returned by a live evaluator. It carries enough signed evidence to replay why the certificate was admitted.

Why current substrate lacked it: the pruning tombstone history-store head layer had witness records, topology, key status, and epoch seals, but no durable record that constituted the certified head as admitted proof history.

Why existing primitives are insufficient: earlier settlement-head, tombstone-head, and pruning tombstone-store head quorum-certificate record stores govern different authority namespaces. Reusing them would let a different layer's certificate act as proof for this layer's required history-store head.

State guarantee it should create: a pruning tombstone history-store head is operationally certified only when its certificate exists in an append-only replay-valid proof record chain with witness evidence, signatures, and optional matching seal.

Admission rule it requires: append may admit only certified certificates; accepted witness evidence must match accepted witness ids; evidence signatures must validate against replayed pruning tombstone history-store head authority topology; an attached seal must bind the certificate hash, effective topology hash, and pruning tombstone sequence.

Replay rule it requires: replay sorts by quorum-certificate sequence, checks record-chain continuity, recomputes certificate and record hashes, validates witness evidence and signatures, and projects the latest valid certified record.

Authority boundary it requires: the record is scoped only to pruning tombstone history-store head witness quorum authority. It does not authorize tombstone-head witnesses, pruning tombstone-store head witnesses, settlement heads, graph writes, domain actions, or connector state by itself.

Failure modes it should prevent:

- an agent recovering a certified required history-store head from memory without durable proof;
- a local snapshot outranking admitted certificate history;
- a later topology/key-status replay silently replacing the proof basis of a certified head;
- unsigned witness evidence becoming durable proof;
- a forged authority seal being attached to a certificate record;
- broken record chains hiding conflicting or superseded certificate records.

Minimal implementation slice:

- Add record/evidence/replay/store interfaces.
- Add deterministic record hashing and witness-evidence extraction from stored witness records.
- Add replay validation for certification, hashes, witness ids, evidence, signatures, and seals.
- Add in-memory and Postgres stores.
- Add migration `0049`.
- Add focused falsifiers for bad evidence, bad seal, and unsigned evidence.

Tests that would falsify it:

- A provisional or obstructed certificate can be recorded as durable proof.
- A record with a broken certificate hash replays as valid.
- A record with accepted witness ids that do not match evidence replays as valid.
- A witness evidence signature from a missing, revoked, or wrong key replays as valid.
- A seal whose quorum certificate hash or topology hash differs from the record's certificate replays as valid.
- The latest certified record cannot be recovered from the record store without process memory.

Axis surfaces that could later validate it:

- Axis C can restart with only stored witness, authority, seal, and QC-record rows and prove required-head recovery without memory.
- Axis A can attempt finance recovery with a stale cached required head and expect the durable record chain to dominate the cache.
- Axis B can require domain adapters to reference durable QC records rather than supply synthetic required heads.

## 7. Falsification Criteria Applied Before Implementation

1. A certified pruning tombstone history-store head quorum certificate must append into a hash-chained record store and replay valid under strict signatures.
2. A record whose accepted witness evidence is malformed must replay invalid with `quorum_certificate_record_witness_evidence_mismatch`.
3. A record whose authority epoch seal does not bind the certificate hash/topology/sequence must replay invalid with `quorum_certificate_record_authority_seal_mismatch`.
4. A store append using unsigned witness rows under strict policy must fail before admission with `quorum_certificate_record_signature_invalid`.
5. The latest certified proof must be recoverable from record replay without recertifying from agent memory.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Store-backed recertification is enough for history-store head recovery. | Rejected. | It still asks live replay to reconstruct a certificate instead of recovering a certificate as admitted proof history. |
| Authority epoch seals make certificate records unnecessary. | Rejected. | A seal binds a certificate hash to an authority epoch, but without a durable record the certificate body and witness evidence are not replayable as proof. |
| Witness records alone are sufficient durable evidence. | Rejected. | Witness records prove observations; they do not state which certified quorum result was admitted, sequenced, and sealed as a proof object. |

## 9. Implementation Frontier

Implemented now:

- Pruning tombstone history-store head quorum-certificate record/evidence types.
- Record-chain build, hash, and replay functions.
- Strict witness-signature and authority-seal replay checks.
- In-memory and Postgres record stores.
- Migration `0049`.
- Focused tests for valid record replay, tampered evidence, forged seal, and unsigned evidence.

Remaining frontier:

1. SQ65 proof-preserving compaction and pruning over the new record history.
2. Runtime and Axis adoption.
3. Live Postgres restart proof for amnesiac required-head recovery.
4. Topology-transition signer authority for this layer.
5. Production cryptographic verifier adapters.

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
- Root Vitest run passed via the targeted command: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.

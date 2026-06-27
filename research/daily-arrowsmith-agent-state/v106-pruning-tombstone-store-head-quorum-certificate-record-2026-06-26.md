# v106 Pruning Tombstone-Store Head Quorum-Certificate Record

Date: 2026-06-26
Status: substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v105-pruning-tombstone-store-head-witness-authority-epoch-seal-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ53 - What durable quorum-certificate proof record makes certified pruning tombstone-store heads recoverable without transient recertification or later topology/key-status replay?

Answer: a certified pruning tombstone-store head needs its own hash-chained quorum-certificate record. The record must bind the certified certificate, accepted witness ids, witness ledger sequence/hash evidence, witness signatures, optional authority epoch seal, previous record hash, and record hash. Replay can then recover the latest certified proof from admitted history without asking an agent to remember the certificate, re-run live certification against mutable topology, or trust a connector/local snapshot.

Implemented slice:

- Added pruning tombstone-store head quorum-certificate witness evidence and durable record types.
- Added deterministic record hashing and record-chain replay.
- Added record replay validation for tenant, sequence, previous hash, certificate certified status, certificate hash, record hash, accepted witness evidence, strict witness signatures, key currentness, and authority seal binding.
- Added in-memory and Postgres-backed quorum-certificate record stores.
- Added migration `0044_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_quorum_certificates.sql`.
- Added tests proving valid durable record replay, tampered witness-evidence rejection, forged seal rejection, and unsigned-evidence append rejection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | PBFT keeps signed proof messages for committed values and creates stable checkpoint proofs before log truncation. | The substrate record keeps the quorum proof as durable evidence instead of recomputing certification from later topology or process memory. |
| Yin et al. 2019, "HotStuff: BFT Consensus in the Lens of Blockchain" ([arXiv / PODC'19 notice](https://arxiv.org/abs/1803.05069)) | Quorum certificates are first-class proof objects that let later replicas reason from certified history rather than private local belief. | Certified pruning tombstone-store heads become explicit proof records with certificate hashes and supporting witness evidence. |
| Nikitin et al. 2017, "CHAINIAC" ([USENIX Security](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin)) | Independent witnesses collectively verify updates, and a tamper-proof release log stores collectively signed updates so out-of-date clients can validate. | The record store is a transparency-log-like proof history for required pruning tombstone-store heads; an amnesiac agent can replay records and signatures from storage. |

## 3. Existing Substrate Map Delta

Already present before v106:

1. Durable pruning tombstone-store head witness observations.
2. Replayed pruning tombstone-store head witness quorum topology.
3. Durable authority-transition stores for that topology.
4. Signature-bound witness identity.
5. Key-status replay for rotations and revocations.
6. Non-retroactive authority epoch seals.
7. Store-backed quorum certification derived from stored authority and witness history.

Newly added by v106:

1. Durable pruning tombstone-store head quorum-certificate proof records.
2. Record-chain replay for certified pruning tombstone-store head certificates.
3. Witness-evidence projection from stored witness records into durable proof records.
4. Replay validation of certificate hashes and record hashes.
5. Replay validation that accepted witness evidence matches accepted witness ids.
6. Replay validation of witness signatures against pruning tombstone-store head authority topology.
7. Replay validation that an attached authority epoch seal binds the certificate hash, effective authority topology hash, sequence, and transition hash.
8. In-memory and Postgres stores that refuse append unless the full record history replays.

## 4. Missing Substrate Map Delta

Still missing:

1. Proof-preserving compaction and pruning for this record layer and its supporting witness, authority, key-status, and seal history.
2. Runtime recovery integration that consumes durable pruning tombstone-store head quorum-certificate records instead of live recertification.
3. Live Postgres restart tests proving an amnesiac process can recover the latest certified required head from record history.
4. Production cryptographic verifier adapters for this witness layer.
5. Monitoring that detects callers evaluating witness replay without store-derived topology/key status/seal state or durable QC records.
6. Domain adapter conformance tests proving adapters cannot smuggle certificate records or witness key status through configuration.
7. Topology-transition signer authority for this layer; epoch seals are hash-chain replayed but not yet signed by institutional authority.
8. Key-validity epoch semantics that distinguish "valid for historical proof" from "current for new certification".
9. Cross-store settlement semantics tying pruning tombstone-store head certificates to tombstone-head pruning continuity records.
10. Proof-preserving compaction checkpoints for the new quorum-certificate record history.

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
10. SQ54: What proof-preserving compaction checkpoint lets pruning tombstone-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Store Head Quorum-Certificate Record.

Problem it solves: v105 could seal the authority epoch for a certified required head, but the certificate itself still existed as a transient evaluation result. Recovery still had to recertify from witness and authority rows, leaving later topology/key-status replay and local process continuity too close to operational authority.

Research source: PBFT stable checkpoint proofs, HotStuff quorum certificates, and CHAINIAC collectively signed release logs.

Mechanism borrowed or adapted: a quorum certificate is a durable proof object, not merely a result returned by a live evaluator. It carries enough signed evidence to replay why the certificate was admitted.

Why current substrate lacked it: the pruning tombstone-store head layer had witness records, topology, key status, and epoch seals, but no durable record that constituted the certified head as admitted proof history.

Why existing primitives are insufficient: earlier settlement-head and tombstone-head quorum-certificate record stores govern different authority namespaces. Reusing them would let a different layer's certificate act as proof for this layer's required pruning tombstone-store head.

State guarantee it should create: a pruning tombstone-store head is operationally certified only when its certificate exists in an append-only replay-valid proof record chain with current witness signatures and optional matching seal.

Admission rule it requires: append may admit only certified certificates; accepted witness evidence must match accepted witness ids; evidence signatures must validate against replayed pruning tombstone-store head authority topology; an attached seal must bind the certificate hash, effective topology hash, and pruning tombstone sequence.

Replay rule it requires: replay sorts by quorum-certificate sequence, checks record-chain continuity, recomputes certificate and record hashes, validates witness evidence and signatures, and projects the latest valid certified record.

Authority boundary it requires: the record is scoped only to pruning tombstone-store head witness quorum authority. It does not authorize tombstone-head witnesses, settlement heads, graph writes, domain actions, or connector state by itself.

Failure modes it should prevent:

- an agent recovering a certified required head from memory without durable proof;
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
- Add migration `0044`.
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

1. A certified pruning tombstone-store head quorum certificate must append into a hash-chained record store and replay valid under strict signatures.
2. A record whose accepted witness evidence is malformed must replay invalid with `quorum_certificate_record_witness_evidence_mismatch`.
3. A record whose authority epoch seal does not bind the certificate hash/topology/sequence must replay invalid with `quorum_certificate_record_authority_seal_mismatch`.
4. A store append using unsigned witness rows under strict policy must fail before admission with `quorum_certificate_record_signature_invalid`.
5. The latest certified proof must be recoverable from record replay without recertifying from agent memory.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Store-backed recertification is enough for recovery. | Rejected. | It still asks live replay to reconstruct a certificate instead of recovering a certificate as admitted proof history. |
| Authority epoch seals make certificate records unnecessary. | Rejected. | A seal binds a certificate hash to an authority epoch, but without a durable record the certificate body and witness evidence are not replayable as proof. |
| Witness records alone are sufficient durable evidence. | Rejected. | Witness records prove observations; they do not state which certified quorum result was admitted, sequenced, and sealed as a proof object. |

## 9. Implementation Frontier

Implemented now:

- Pruning tombstone-store head quorum-certificate record/evidence types.
- Record-chain build, hash, and replay functions.
- Strict witness-signature and authority-seal replay checks.
- In-memory and Postgres record stores.
- Migration `0044`.
- Focused tests for valid record replay, tampered evidence, forged seal, and unsigned evidence.

Remaining frontier:

1. Proof-preserving compaction and pruning over the new record history.
2. Runtime and axis adoption.
3. Live Postgres restart proof for amnesiac required-head recovery.
4. Topology-transition signer authority for this layer.
5. Production cryptographic verifier adapters.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" CHANGELOG.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts db/migrations/0044_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness_quorum_certificates.sql research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v106-pruning-tombstone-store-head-quorum-certificate-record-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, migration, changelog, and ledger files found no matches.

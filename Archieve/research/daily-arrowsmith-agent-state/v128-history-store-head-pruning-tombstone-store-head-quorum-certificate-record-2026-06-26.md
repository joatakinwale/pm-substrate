# v128 History Store-Head Pruning Tombstone Store-Head Quorum Certificate Record

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v127-history-store-head-pruning-tombstone-store-head-witness-authority-epoch-seal-2026-06-26.md`

## 1. Research Question Targeted

Closed question: SQ75 - What durable quorum-certificate proof record makes certified history-store-head pruning tombstone-store heads recoverable without transient recertification or later topology/key-status replay?

Answer: v127 sealed the authority epoch for an already certified required head, but the certified proof object itself was still transient. An amnesiac process could replay witness rows and authority history to recertify, but it could not recover the exact certified quorum object as admitted operational history. The missing primitive is a hash-linked quorum-certificate proof record for this exact nested currentness layer.

Implemented slice:

- Added `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessQuorumCertificateRecord`.
- Added accepted witness evidence records that preserve witness id, witness sequence, observation hash, optional consistency proof, and witness signature.
- Added deterministic quorum-certificate-record hashing and replay over contiguous record sequence plus previous-record hash.
- Added in-memory and Postgres-backed record stores that reject append unless the full record history replays.
- Added migration `0054_agent_state_history_store_head_pruning_tombstone_store_head_witness_quorum_certificates.sql`.
- Added strict replay checks for certified-only records, certificate hash, record hash, witness evidence membership, witness evidence shape, signature payload/key status, and optional authority-epoch seal binding.
- Added focused falsifiers for tampered witness evidence, forged authority seal linkage, and unsigned witness evidence.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Yin, Malkhi, Reiter, Gueta, and Abraham 2019, "HotStuff: BFT Consensus with Linearity and Responsiveness" ([Duke record](https://scholars.duke.edu/publication/1472977), [DOI](https://doi.org/10.1145/3293611.3331591)) | Quorum certificates summarize sufficient votes for a protocol decision and become proof material for later safe progress. | v128 stores the certified required-head quorum plus accepted witness evidence as replayable proof, not as a recomputed local belief. |
| Nikitin et al. 2017, "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin)) | A tamper-proof log of collectively signed releases lets out-of-date clients validate accepted releases and signing keys. | v128 turns certified currentness into a durable proof log that an amnesiac agent can replay without trusting connector cache or current witness memory. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([MIT PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Checkpoint and view-change safety rely on authenticated proof material, digests, and quorum-backed state, not assertions by a recovering leader. | v128 binds certificate hash, record hash, witness signatures, and epoch-seal linkage so recovery consumes proof records rather than private recertification. |

## 3. Existing Substrate Map Delta

Already present before v128:

1. V123 durable witness rows that recover the required v122 pruning tombstone-store head after amnesia.
2. V124 quorum topology and certificates over replayed v123 witness rows.
3. V125 durable authority-transition stores and store-backed certification.
4. V126 signed witness rows plus key rotation/revocation replay for this layer.
5. V127 authority epoch seals that prevent later topology/key-status transitions from retroactively governing certified heads.

Newly added by v128:

1. A durable v128 quorum-certificate proof-record type for certified history-store-head pruning tombstone-store heads.
2. Witness evidence extraction from accepted v123 witness rows into replayable certificate evidence.
3. Hash-linked record-chain replay for the v128 proof records.
4. In-memory and Postgres-backed v128 proof-record stores.
5. Postgres migration `0054` for durable certificate, witness evidence, seal, and record-hash persistence.
6. Strict signature/key-status replay over accepted proof evidence.
7. Seal linkage checks tying the v127 authority epoch seal to the recorded certificate hash, effective authority topology hash, and pruning tombstone sequence.

## 4. Missing Substrate Map Delta

Still missing after v128:

1. Proof-preserving compaction checkpoints for the v123 witness ledger, v125/v126/v127 authority/key/seal history, and v128 quorum-certificate record history.
2. Durable checkpoint-admission storage for that compacted recovery.
3. Pruning admission and tombstone-gated physical deletion for this v128 proof history.
4. Runtime and Axis adoption of store-backed v128 proof-record recovery.
5. Live Postgres restart proof that recovers certified currentness from v128 records without process memory.
6. A generic nested currentness/witness abstraction to collapse repeated layer-specific machinery.
7. Recovery-kernel inventory for every compacted/pruned required head and its supporting proof records.
8. Production cryptographic verifier/finalizer adapters for witness signatures and seal authority.
9. Cross-agent monitoring that detects divergent v128 proof-record histories before write gates consume them.
10. A downstream finality model that makes writes cite the v128 proof record, not only the certified head hash.

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
10. SQ76: What proof-preserving compaction checkpoint lets history-store-head pruning tombstone-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

## 6. Primitive Proposal Ledger

Name: History Store-Head Pruning Tombstone Store-Head Quorum Certificate Record.

Problem it solves: certified v124/v127 currentness existed as an evaluation result, but not as a durable admitted proof record. Recovery could still depend on transient recertification from current rows or caller-supplied structures.

Research source: HotStuff quorum certificates, CHAINIAC collectively signed transparency logs, and PBFT checkpoint/view-change proof material.

Mechanism borrowed or adapted: certified state must be recorded as a hash-linked proof object containing the decision, the accepted voter/witness evidence, and the authority/finality linkage needed by later recovery.

Why current substrate lacks it: v127 sealed the authority basis but did not persist the certified quorum certificate and accepted witness evidence as its own replay lane.

Why existing primitives are insufficient: v123 witness rows, v125 authority stores, v126 key-currentness replay, and v127 seals can recertify a head, but recertification is not the same as recovering admitted certification history.

State guarantee it should create: a certified history-store-head pruning tombstone-store head can be recovered from admitted proof-record history alone, including the certificate hash, accepted witness evidence, signatures, and sealed authority basis.

Admission rule it requires: append only if the certificate is certified, the certificate hash matches, accepted witness evidence matches the certificate's accepted witness ids, strict signatures/key status replay, and any authority seal binds the certificate hash, authority topology hash, sequence, and transition hash.

Replay rule it requires: records must be contiguous, hash-linked, certificate-hash valid, record-hash valid, accepted-evidence complete, signature-valid under replayed authority topology, and seal-consistent before any latest certified record is projected.

Authority boundary it requires: v128 governs only certified v124/v127 currentness for v122 pruning tombstone-store heads in the pruning tombstone history-store head lane.

Failure modes it should prevent:

- private memory claiming a certified required head without a durable certificate record;
- connector cache returning a certified head without accepted witness evidence;
- recomputation under a later topology replacing the originally admitted proof;
- witness evidence stripped of signatures authorizing a proof record;
- forged epoch seals linking a certificate to the wrong finality object;
- tampered observation hashes or witness membership being accepted as proof;
- local snapshots outranking admitted certificate-record history.

Minimal implementation slice:

- Add record/evidence types and deterministic hashing.
- Add record-chain replay.
- Add in-memory and Postgres stores.
- Persist certificate, evidence, seal, previous hash, and record hash.
- Add focused falsifiers for evidence tamper, seal mismatch, and unsigned evidence.

Tests that would falsify it:

- An uncertified certificate appends as a proof record.
- A certificate with a broken hash replays as valid.
- A record with a broken hash replays as valid.
- Evidence witness ids diverge from the certificate accepted ids and replay remains valid.
- Unsigned evidence under strict policy appends successfully.
- A seal citing the wrong certificate hash replays as valid.
- A non-contiguous record chain projects a latest certified record.

Axis surfaces that could later validate it:

- Axis C can restart after pruning and recover required-head currentness from v128 proof records without conversation memory.
- Axis A can require finance recovery paths to cite durable proof records rather than adapter-supplied certified heads.
- Axis B can force domain adapters to use proof-record refs instead of local witness caches.

## 7. Falsification Criteria Used For This Slice

1. A valid certified quorum proof record must append and replay as the latest certified record.
2. Tampering accepted witness evidence must invalidate replay.
3. A forged authority seal must invalidate replay.
4. Unsigned evidence under strict policy must be rejected by the proof-record store.
5. The focused test must prove the proof record binds to the store-backed certified certificate hash, not a transient in-memory certificate.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Replaying witness rows and authority history later is equivalent to recovering certification history. | Rejected. | v128 adds a separate admitted proof-record lane for certified quorum objects. |
| A sealed authority epoch is enough without storing the certificate it sealed. | Rejected. | v128 stores certificate, evidence, and seal linkage together. |
| Accepted witness ids alone are sufficient proof evidence. | Rejected. | v128 preserves observation hashes, witness sequence, optional consistency proof, and witness signatures. |
| A local proof-record builder can trust supplied witness records. | Rejected. | v128 replay checks accepted evidence membership, signatures, hashes, and seal binding before append. |

## 9. Implementation Frontier

Implemented now:

1. V128 proof-record/evidence types and deterministic hashes.
2. V128 record-chain replay with certified-only, hash, evidence, signature, key-status, and seal-linkage checks.
3. In-memory and Postgres-backed v128 proof-record stores.
4. Migration `0054_agent_state_history_store_head_pruning_tombstone_store_head_witness_quorum_certificates.sql`.
5. Focused tests for valid record replay, tampered evidence rejection, forged seal rejection, and unsigned evidence rejection.

Remaining frontier:

1. SQ76 proof-preserving compaction checkpoints for this layer's witness, authority/key/seal, and v128 proof-record histories.
2. Durable checkpoint-admission records and pruning/tombstone deletion for the compacted histories.
3. Runtime/Axis adoption and live Postgres restart proof.
4. Generic nested currentness abstraction and recovery-kernel inventory.
5. Production crypto/finalizer signature adapters and cross-agent proof-record monitoring.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm test
git diff --check
rg -n "[ \t]+$" Changelog.md research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v128-history-store-head-pruning-tombstone-store-head-quorum-certificate-record-2026-06-26.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts db/migrations/0054_agent_state_history_store_head_pruning_tombstone_store_head_witness_quorum_certificates.sql
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused root Vitest command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root `pnpm typecheck` passed across 22 workspace projects.
- Root `pnpm test` passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- `git diff --check` passed.
- Explicit trailing-whitespace scan across touched v128 files returned no matches.

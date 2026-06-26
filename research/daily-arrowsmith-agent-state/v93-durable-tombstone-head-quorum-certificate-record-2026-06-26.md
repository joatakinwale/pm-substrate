# v93 Durable Tombstone-Head Quorum Certificate Record

Date: 2026-06-26
Status: new substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v92-signature-bound-tombstone-head-witness-identity-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ40 - What durable tombstone-head quorum-certificate record store binds accepted witness signatures and authority epoch seals into recoverable proof objects?

Answer: a pruning tombstone-head quorum certificate cannot remain a transient result of current memory, current witness rows, or current topology recomputation. It needs its own append-only certificate-record lane: a hash-chained proof record containing the certified tombstone-head quorum certificate, the accepted witness ids with witness sequence/observation-hash/signature evidence, an optional signed authority epoch seal, the previous record hash, and a record hash. Replay admits the record only when the certificate is certified, hashes replay, evidence matches accepted witnesses, signatures verify against replayed tombstone-head authority topology, and any seal binds the certificate hash, authority topology hash, tombstone sequence, and transition hash.

Implemented slice:

- Added tombstone-head quorum-certificate witness-evidence, record, replay, issue, and store interfaces.
- Added deterministic tombstone-head quorum-certificate record hashing and replay.
- Added evidence extraction from accepted signed tombstone-head witness records.
- Added strict replay checks for certified-only admission, record chaining, certificate hash validity, accepted evidence shape, witness signatures, current tombstone-head authority keys, and authority epoch seal binding.
- Added in-memory and Postgres-backed tombstone-head quorum-certificate record stores.
- Added migration `0038_agent_state_projection_replay_pruning_tombstone_head_witness_quorum_certificates.sql`.
- Added focused tests proving durable record creation/replay and rejection of bad witness evidence, mismatched seal binding, and unsigned witness evidence under strict policy.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Protocol safety depends on retained signed pre-prepare/prepare/commit evidence and stable checkpoint proofs, not a replica's private current memory. | Tombstone-head certification becomes a durable proof record with replayable witness evidence and seal evidence. |
| Yin et al. 2019, "HotStuff: BFT Consensus with Linearity and Responsiveness" ([arXiv](https://arxiv.org/abs/1803.05069), [PDF](https://arxiv.org/pdf/1803.05069)) | A quorum certificate is a collected vote proof for a proposal, often compacted by threshold signatures, and later phases build on explicit QCs. | A tombstone-head QC record stores accepted witness evidence as the recoverable proof object a resumed agent can replay. |
| Nikitin et al. 2017, "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin), [PDF](https://nikirill.com/files/chainiac.pdf)) | Independent witnesses verify artifacts, collectively signed updates are stored in a tamper-proof release log, and clients validate the log when catching up. | Tombstone-head witness signatures and epoch seals are committed into a durable record log so recovery does not trust connector cache, conversation continuity, or live recomputation. |

## 3. Existing Substrate Map Delta

Already present before v93:

1. v88 made pruning tombstone-head observations durable and replayable.
2. v89 added tombstone-head authority topology and quorum certificate evaluation.
3. v90 made tombstone-head authority topology recoverable from durable authority-transition stores.
4. v91 added tombstone-head authority epoch seals that prevent retroactive topology edits.
5. v92 made tombstone-head observations and epoch seals signature-bound to replay-admitted principals.
6. v80 already established the analogous durable settlement-head quorum-certificate record lane.

Newly added by v93:

1. Tombstone-head quorum certificates can become durable proof records.
2. Tombstone-head certificate-record replay verifies sequence, previous-hash, certificate hash, record hash, certified-only admission, witness evidence membership, signature currentness, and seal binding.
3. Store append fails closed when the durable certificate proof cannot replay under the supplied strict tombstone-head authority topology.
4. Postgres has a substrate-owned table for tombstone-head QC proof records rather than relying on adapter-side or in-memory certification results.
5. Amnesiac recovery can recover the certified tombstone-head proof object from admitted record history, not from private summaries or live recertification alone.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-head witness key-status rotation and revocation semantics equivalent to settlement-head v81.
2. Tombstone-head certificate-record replay across historical key rotations and revoked/superseded keys.
3. Tombstone-head quorum-certificate record compaction/checkpointing after long histories.
4. Runtime and Axis adoption of durable signed tombstone-head QC records.
5. Postgres integration tests proving recovery after actual physical pruning.
6. Direct SQL-delete hardening across tombstone-head witness, authority, and QC-record lanes.
7. Cross-agent gossip/monitoring beyond shared durable stores.
8. Tombstone-head consistency-proof compression that avoids replaying full tombstone history.
9. Store pruning and checkpointing for tombstone-head authority-transition history.
10. Production crypto/key-management adapters for tombstone-head strict signature policies.

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
10. SQ41: What tombstone-head witness key-status and rotation semantics keep durable certificate-record replay from accepting signatures after key revocation or supersession?

## 6. Primitive Proposal Ledger

Name: Durable Pruning Tombstone-Head Quorum Certificate Record.

Problem it solves: v89-v92 could certify a pruning tombstone-store head, but the certificate was still an ephemeral evaluation result. An amnesiac agent needed either live witness rows and topology recomputation or trusted local continuity to recover the certificate proof.

Research source: PBFT retained signed protocol/checkpoint evidence, HotStuff quorum certificates, and CHAINIAC collectively signed transparency logs.

Mechanism borrowed or adapted: turn the quorum certificate into an append-only proof record that carries its supporting witness evidence and finality seal, then require hash-chain replay and signature/key validation before recovery can project the latest certified tombstone head.

Why current substrate lacked it: tombstone-head witness ledgers, authority stores, seals, and signatures existed, but their combined quorum proof had no durable record identity. The certificate could be remembered or recomputed, but not recovered as an admitted transition-history object.

Why existing primitives were insufficient: witness ledgers prove observations, authority stores prove who may witness, and seals prove non-retroactive topology finality. None of them alone proves that a particular certified tombstone head, accepted witness set, and authority seal were admitted together as the recoverable currentness proof.

State guarantee it should create: a pruning tombstone-head quorum certificate is operational state only when represented by a replay-valid durable certificate record; private belief, adapter-provided certificate summaries, or transient recomputation cannot substitute for the admitted record.

Admission rule it requires: append only a certified tombstone-head quorum certificate whose accepted witness evidence matches accepted witness ids, whose witness signatures verify against replayed tombstone-head authority topology, and whose authority epoch seal, when present, binds the certificate hash, topology hash, tombstone sequence, and transition hash.

Replay rule it requires: replay must sort records by sequence, verify tenant, previous-record hash, certificate hash, certified status, record hash, evidence membership, evidence signature payloads, current key status, verifier acceptance, and seal binding/signature before projecting the latest certified record.

Authority boundary it requires: the record is scoped to `projection_replay_pruning_tombstone_store_head_witness_quorum`, and signature checks use replayed pruning tombstone-head witness authority topology, not settlement-head topology, connector identity, local process identity, or chat memory.

Failure modes it should prevent:

- recovering tombstone currentness from a remembered certificate without admitted proof history;
- treating a provisional or obstructed tombstone-head QC as operational state;
- accepting witness evidence that no longer matches the certificate's accepted witness set;
- accepting unsigned witness evidence under strict policy;
- accepting a seal that points to a different certificate, topology, or tombstone sequence;
- letting a stale local snapshot outrank durable tombstone-head certificate history.

Minimal implementation slice:

- Add tombstone-head QC record/evidence/replay types.
- Add deterministic record hash and record builder.
- Add in-memory/Postgres record stores.
- Add strict replay checks for evidence signatures and authority seal signatures.
- Add migration `0038`.
- Add focused falsification tests for successful recovery, bad evidence, bad seal, and unsigned evidence.

Tests that would falsify it:

- A strict store append accepts unsigned accepted witness evidence.
- Record replay accepts a provisional tombstone-head certificate.
- Record replay accepts evidence whose witness ids or observation hashes are malformed.
- Record replay accepts an authority seal that binds a different certificate hash.
- A recovered latest certified record can be projected from memory without replaying the record hash chain.

Axis surfaces that could later validate it:

- Axis C can prove a restarted agent recovers tombstone currentness from durable QC records after pruning.
- Axis A can prove finance projections cannot use pruned-store state unless the tombstone-head QC record replays.
- Axis B can prove domain adapters cannot smuggle tombstone currentness by emitting certificate-shaped summaries.

## 7. Falsification Criteria Applied Before Verification

1. A valid signed tombstone-head quorum certificate plus seal appends as a hash-valid durable record.
2. Replaying the stored record recovers the latest certified record under strict tombstone-head authority topology.
3. Tampered accepted witness evidence invalidates replay.
4. A seal that binds a different quorum-certificate hash invalidates replay.
5. A store append over unsigned witness evidence fails under strict policy.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Tombstone-head certification can remain a live recomputation result. | Rejected. | v93 adds a durable certificate-record lane so the proof object survives amnesiac recovery. |
| Signature-bound witness rows and a signed epoch seal are enough without a certificate-record identity. | Rejected. | They prove individual statements, not the admitted combination of certificate, accepted witnesses, and finality seal. |
| Settlement-head durable QC records are sufficient for pruning recovery. | Rejected. | Pruned-store continuity needs a separate tombstone-head authority boundary and tombstone sequence, not settlement sequence. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head quorum-certificate witness-evidence and record types.
- Tombstone-head quorum-certificate record hashing and replay.
- Strict witness evidence and seal signature validation for certificate records.
- In-memory and Postgres tombstone-head QC record stores.
- Migration `0038_agent_state_projection_replay_pruning_tombstone_head_witness_quorum_certificates.sql`.
- Focused tests for durable recovery and bad evidence/seal/unsigned-evidence rejection.

Remaining frontier:

1. Tombstone-head witness key-status and key rotation.
2. Tombstone-head QC record compaction/checkpointing.
3. Runtime and Axis adoption of durable tombstone-head QC records.
4. Postgres integration tests over actual pruning and recovery.
5. Cross-agent tombstone-head QC record monitoring.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 71 tests.

Proof boundary:

This proves the pure tombstone-head QC record mechanism and focused replay falsifiers. It does not yet prove tombstone-head key rotation, QC record compaction, runtime adoption, Axis A/B/C adoption, live Postgres pruning recovery, or production crypto/key management.

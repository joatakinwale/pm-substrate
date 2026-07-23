# v80 Durable Settlement-Head Quorum Certificate Record

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v79-signature-bound-head-witness-identity-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ27 - What durable quorum-certificate record store binds certified settlement-head quorum certificates, witness signatures, and epoch seals into recoverable proof objects so recertification does not depend on transient recomputation?

Answer: a settlement-head quorum certificate needs its own append-only proof-record history. The record stores the certified quorum certificate, the accepted witness evidence that supports it, the witness observation hashes and signatures, and the optional `seal_authority_epoch` transition that finalized it. Replay verifies record sequencing, previous-record hash chaining, quorum-certificate hash, record hash, witness evidence membership, and seal-to-certificate binding. A fresh agent can now recover the certificate proof object without trusting a transient certifier result or recomputing against whatever current stores return.

Implemented slice:

- Added settlement-head quorum-certificate witness evidence records.
- Added durable quorum-certificate record types, record hashing, and replay verification.
- Added in-memory and Postgres-backed quorum-certificate record stores.
- Added migration `0031_agent_state_projection_replay_head_witness_quorum_certificates.sql`.
- Fixed Postgres settlement-head witness row mapping so persisted v79 signatures are restored into replay records.
- Added tests proving a signed quorum certificate can be recorded and replayed as a proof object, and that tampered witness evidence or seal linkage invalidates replay.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Yin et al. 2019, "HotStuff: BFT Consensus in the Lens of Blockchain" ([arXiv PDF](https://arxiv.org/pdf/1803.05069)) | A quorum certificate combines enough votes over the same tuple and becomes the proof object later leaders use for safe proposals. | A settlement-head quorum certificate becomes a stored proof object rather than a transient evaluator return value. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Replicas keep authenticated log messages and proof material so view changes and recovery can justify prior decisions. | The certificate record stores the witness observation hashes/signatures that justify the accepted head after amnesiac resume. |
| Nikitin et al. 2017, "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds" ([USENIX Security page](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin)) | A tamper-proof release log stores collectively signed updates so out-of-date clients can validate releases efficiently. | The quorum-certificate store records signed head-certification evidence so later agents need not replay all volatile context to recover the proof. |
| Gueta et al. 2019, "SBFT: A Scalable and Decentralized Trust Infrastructure" ([PDF](https://people.eecs.berkeley.edu/~kubitron/courses/cs262a-F21/handouts/papers/SBFT_A_Scalable_and_Decentralized_Trust_Infrastructure.pdf)) | Collectors combine threshold signature shares into full commit or execute proofs that clients/replicas can verify as compact evidence. | The record store is the substrate equivalent of persisting the combined proof plus the evidence references that formed it. |

## 3. Existing Substrate Map Delta

Already present before v80:

1. Settlement-head witnesses could sign observations under strict identity policy.
2. Store-backed certifiers could compute a quorum certificate from durable authority transitions and witness records.
3. Authority-epoch seals could bind a certificate hash into the head-witness authority history.

Newly strengthened by v80:

1. A quorum certificate can now be admitted as its own durable proof record.
2. The record binds accepted witness ids to witness ledger sequence, observation hash, and signature evidence.
3. The record can bind the authority-epoch seal transition that finalizes the certificate.
4. Replay detects tampered witness evidence, mismatched certificate hashes, broken record chains, and seals that cite a different certificate/topology/settlement sequence.
5. Postgres recovery now preserves persisted settlement-head witness signatures when reconstructing witness records.

## 4. Missing Substrate Map Delta

Still missing:

1. Production cryptographic verifier adapters and key-rotation/revocation status semantics.
2. Concurrency tests for simultaneous certificate-record, witness, and seal appends.
3. Monitor proof that every strict write required a durable quorum-certificate record.
4. Domain compiler support for declaring durable signed head-quorum certificate requirements.
5. Gossip or replication transport for quorum-certificate records outside one shared Postgres store.
6. Recovery-kernel composition that rehydrates latest signed, certified, sealed head authority for every open scope.
7. Axis A/C runner adoption with durable signed quorum-certificate records.
8. External target-side finality after graph/capability mutation.
9. Formal obstruction algebra composition between invalid certificate records, invalid signatures, sealed authority epochs, projection conflicts, and local-view conflicts.
10. Storage compaction rules that preserve certificate-record proof after witness ledgers are pruned.

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
10. SQ28: What key-status and rotation system makes witness signatures decision-time current so revoked or rotated keys cannot authorize new observations, seals, or quorum-certificate records?

## 6. Primitive Proposal Ledger

Name: Durable Settlement-Head Quorum Certificate Record.

Problem it solves: a store-backed quorum certificate was still a transient computed object; an amnesiac agent could recover witness rows and topology, but not the certification event as an admitted proof object with its witness evidence and seal linkage.

Research source: HotStuff quorum certificates, PBFT recovery/view-change proof material, CHAINIAC collectively signed transparency logs, and SBFT commit/execute proofs.

Mechanism borrowed or adapted: persist the certificate as an append-only proof record that binds the certificate body, witness evidence, and finality seal, then replay the record chain before treating the certificate as operational authority.

Why current substrate lacked it: v79 made observations and seals signed, but the quorum certificate itself was only returned from `certify...()` and could disappear after process restart.

Why existing primitives were insufficient: witness ledgers and authority logs can be replayed, but a certificate proof object should be recoverable without re-running a transient certification call against possibly changed stores.

State guarantee it should create: under strict record-store usage, a settlement-head quorum certificate is operational only if it is an admitted record in the quorum-certificate proof history.

Admission rule it requires: a certificate record must include accepted witness evidence for every accepted witness id and must bind any authority-epoch seal to the same certificate hash, authority topology hash, and settlement sequence.

Replay rule it requires: replay recomputes the certificate hash and record hash, validates sequence/previous-hash chaining, compares accepted witness evidence to certificate witness ids, and verifies seal linkage.

Authority boundary it requires: quorum certification becomes a substrate record store concern, not adapter memory, local recomputation, or test fixture state.

Failure modes it should prevent:

- a transient certificate being treated as durable authority after restart;
- a certificate record omitting the signed witness evidence that made quorum true;
- a record linking a certificate to an unrelated epoch seal;
- a tampered witness-evidence list replaying as valid;
- a local agent recomputing old certification from current topology instead of admitted proof history.

Minimal implementation slice:

- Add quorum-certificate record and witness-evidence types.
- Add record hashing and replay.
- Add in-memory and Postgres record stores.
- Add migration `0031`.
- Add falsification tests for valid signed record replay and tampered evidence/seal rejection.

Tests that would falsify it:

- A record with accepted witness evidence that does not match the certificate accepted witness ids replays as valid.
- A record with a seal citing a different certificate hash replays as valid.
- A certificate body whose hash no longer matches replays as valid.
- A record hash mismatch replays as valid.
- A fresh record store cannot list and replay the admitted certificate record.

Axis surfaces that could later validate it:

- Axis C can restart after certification and require the durable certificate record before write authority.
- Axis A can require ArrowHedge strict writes to cite a signed, sealed, durable head-quorum certificate record.
- Axis B can adopt the same proof-record primitive once accepted marketing/domain fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A signed quorum certificate can be recorded with witness signatures and an authority-epoch seal.
2. Replaying the record store identifies the latest certified record without re-running the certifier.
3. Tampering with witness evidence invalidates record replay.
4. Tampering with the seal's certificate hash invalidates record replay.
5. Postgres row mapping preserves persisted witness signatures so durable records can include them after recovery.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Store-backed certification is durable authority by itself. | Falsified. | v80 adds an admitted certificate record because a returned certificate object is still transient. |
| Signed witness rows and signed seals are enough to recover certification. | Partly falsified. | They are ingredients, but v80 records which witness evidence and seal formed the certificate proof. |
| Recomputing certification after restart is equivalent to replaying certification history. | Rejected for this substrate layer. | v80 records the certification event so current stores cannot silently change what proof object is being recovered. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateWitnessEvidence`.
- Durable quorum-certificate record types, hashing, and replay.
- In-memory and Postgres quorum-certificate record stores.
- Migration `0031_agent_state_projection_replay_head_witness_quorum_certificates.sql`.
- Persisted witness-signature restoration in Postgres settlement-head witness row mapping.
- Test coverage for signed proof-record replay and tampered evidence/seal obstruction.

Remaining frontier:

1. Signature key status, rotation, and revocation semantics.
2. Production cryptographic verifier/key-management adapters.
3. Concurrency/transaction isolation for certificate-record append paths.
4. Runtime monitor proof.
5. Runner/axis adoption.
6. Proof-preserving compaction rules.

## 10. Proof Status

Commands run:

```bash
git fetch origin main
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm --filter @pm/capability-kit typecheck
pnpm exec vitest run packages/capability-kit/src/workflow-authority.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused `@pm/capability-kit` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 69 tests; `packages/capability-kit/src/workflow-authority.test.ts` 21 tests.
- Full workspace `pnpm typecheck` passed.
- Broad substrate Vitest slice passed: 31 files passed, 389 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves durable settlement-head quorum-certificate proof records as replayable substrate logic. It does not yet prove key-status/rotation currentness, production cryptographic verification, concurrent append isolation, monitor coverage, end-to-end Axis A/B/C adoption, or proof-preserving compaction.

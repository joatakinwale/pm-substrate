# v84 Durable Checkpoint Admission Store

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v83-compaction-checkpoint-admission-authority-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ31 - What durable checkpoint-admission store and consistency proof make compaction checkpoint certificates recoverable, non-equivocating, and prunable without trusting process memory?

Answer: checkpoint admission must itself be an append-only replay object. A compaction checkpoint and its admission certificate are now recorded together in a hash-linked checkpoint-admission record chain. Replay verifies record sequence, previous-record hash, checkpoint body hash, admission certificate hash, strict re-evaluation of the admission certificate, and conflicting checkpoint ids/frontiers. A fresh agent can recover the admitted checkpoint certificate from the store rather than trusting conversation memory or a caller-supplied in-process certificate.

Implemented slice:

- Added checkpoint-admission record types, issue types, replay result, and store interface.
- Added checkpoint-admission record hashing and replay.
- Added conflict detection for the same checkpoint id or compacted frontier admitting a different checkpoint hash.
- Added in-memory and Postgres checkpoint-admission record stores.
- Added migration `0032_agent_state_projection_replay_checkpoint_admissions.sql`.
- Extended the compaction test so replay uses the recovered stored admission certificate, and tampered/under-quorum admission records fail before they can seed replay.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | A log must prove event membership and consistency with previously observed log states. | Checkpoint-admission records are hash-linked so replay can detect missing, reordered, or mutated admission history. |
| Papamanthou, Tamassia, and Triandopoulos 2019, "Transparency Logs via Append-Only Authenticated Dictionaries" ([PDF](https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf)) | Transparency logs need efficient lookup plus append-only consistency proofs. | The checkpoint-admission store persists lookupable checkpoint/admission records and exposes append-only replay semantics. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([PDF](https://jbonneau.com/doc/MBBFF15-coniks.pdf)) | Users monitor provider-maintained bindings for consistency and non-equivocation. | Agents should monitor checkpoint-admission history for conflicting checkpoint ids/frontiers rather than accepting the latest returned record. |
| Dowling et al. 2016, "Secure Logging Schemes and Certificate Transparency" ([PDF](https://www.douglas.stebila.ca/files/research/papers/ESORICS-DGHS16.pdf)) | Audit and consistency proofs distinguish inclusion from append-only evolution. | The admission record chain separates "this checkpoint certificate exists" from "the checkpoint-admission history evolved consistently." |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints need proof material that survives recovery and view changes. | pm-substrate persists the checkpoint and its admission proof as durable recovery material instead of regenerating it from private process state. |

## 3. Existing Substrate Map Delta

Already present before v84:

1. v82 checkpoints could seed replay from compacted frontiers plus suffix records.
2. v83 checkpoint admission certificates proved a current admitted witness quorum signed a checkpoint hash.
3. Replay functions refused checkpoint seeding without an admitted certificate under strict signature policy.
4. Durable stores already existed for head-witness ledgers, head-witness authority transitions, and quorum-certificate records.
5. Hash-linked replay patterns already existed for several substrate histories.

Newly strengthened by v84:

1. Checkpoint admission certificates are now persisted as hash-linked records.
2. A store record contains both the checkpoint body and the admission certificate, so a fresh agent can recover both.
3. Admission-record replay re-validates checkpoint hash and admission hash.
4. Admission-record replay re-evaluates the admission certificate under strict signature policy.
5. Admission-record replay detects sequence gaps and previous-hash mismatch.
6. Admission-record replay detects conflicting checkpoint hashes for the same checkpoint id or compacted frontier.
7. Postgres persistence exists for checkpoint-admission records.
8. The checkpoint replay test consumes the recovered stored admission rather than relying on in-memory certificate continuity.

## 4. Missing Substrate Map Delta

Still missing:

1. Actual pruning APIs that delete witness/authority/certificate prefixes only after a durable admitted checkpoint is stored.
2. Suffix-verification rules that prove the remaining suffix starts exactly at the stored checkpoint frontier before pruning.
3. Store roots or external witnesses for checkpoint-admission records.
4. Cross-agent checkpoint-admission gossip or monitor comparison.
5. Pruning tombstone records that prove which prefix was deleted and why.
6. Checkpoint-admission consistency proofs for partial clients that cannot download the whole admission chain.
7. Multi-authority checkpoint admission across root-witness and settlement-head layers.
8. Runtime adoption in strict graph/capability recovery paths.
9. Axis validation under actual pruned stores.
10. Compaction/admission equivalents for root-witness ledgers and settlement records outside the settlement-head layer.

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
10. SQ32: What pruning admission rule makes physical prefix deletion impossible unless a durable admitted checkpoint record and verified suffix continuity already exist?

## 6. Primitive Proposal Ledger

Name: Settlement-Head Witness Replay Compaction Checkpoint Admission Record Store.

Problem it solves: v83 made checkpoint admission replayable but not durable. A process could still lose or choose admission certificates from memory, and a caller could present a valid certificate without proving it came from a consistent admission history.

Research source: tamper-evident logging, append-only authenticated dictionaries, CONIKS non-equivocation, secure logging consistency proofs, and PBFT checkpoint recovery.

Mechanism borrowed or adapted: persist each admitted checkpoint certificate as an append-only record that hashes the previous record, the checkpoint body, the certificate, and recording metadata; replay the chain before using any recovered certificate.

Why current substrate lacked it: checkpoint admission existed as a pure certificate object and replay API input. It had no substrate-owned storage history.

Why existing primitives were insufficient: quorum-certificate records store certified settlement heads, not compaction checkpoint admissions. The checkpoint itself stores derived replay projections, but not the durable authority history that admitted those projections.

State guarantee it should create: a checkpoint admission can be recovered after amnesia only from a hash-linked, replay-valid admission history whose records re-validate the checkpoint and certificate.

Admission rule it requires: stores may append only admitted checkpoint certificates that replay under strict signature policy and do not conflict with prior checkpoint ids or compacted frontiers.

Replay rule it requires: replay sorts records by sequence, verifies contiguous sequence and previous hash, re-checks checkpoint and admission hashes, re-evaluates admission, detects conflicts, and computes the admission-record hash.

Authority boundary it requires: checkpoint-admission history is substrate state, not an adapter cache or transient certificate variable.

Failure modes it should prevent:

- losing checkpoint admission after process restart;
- choosing between multiple local admission certificates for one checkpoint;
- accepting a mutated stored admission certificate;
- accepting an under-quorum admission into the durable history;
- admitting two different checkpoint hashes for the same checkpoint id or compacted frontier;
- treating a checkpoint body and admission certificate as unrelated artifacts.

Minimal implementation slice:

- Add checkpoint-admission record types and hashing.
- Add replay for checkpoint-admission records.
- Add in-memory and Postgres stores that append only replay-valid records.
- Add migration `0032`.
- Extend tests to recover admission from the store and reject bad records.

Tests that would falsify it:

- An under-quorum checkpoint admission can be appended to the store.
- A tampered stored admission hash replays valid.
- A missing prior admission record does not create a sequence or previous-hash issue.
- Two different checkpoint hashes for the same checkpoint id/frontier both replay valid.
- Checkpoint-seeded replay succeeds only because the original in-memory certificate variable is still available.

Axis surfaces that could later validate it:

- Axis C can restart from a database-backed checkpoint-admission store and recover checkpoint replay authority.
- Axis A can verify finance mutation authority after physical pruning.
- Axis B can require domain adapters to cite durable checkpoint-admission record hashes rather than profile-local snapshots.

## 7. Falsification Criteria Applied Before Verification

1. Under-quorum checkpoint admission cannot append to the record store.
2. A stored admitted checkpoint certificate replays valid under strict signature policy.
3. Checkpoint replay can use the recovered stored certificate.
4. A tampered stored admission certificate fails record replay.
5. Admission-record replay verifies checkpoint hash, admission hash, sequence, and previous-record hash.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| An admitted checkpoint certificate can remain an in-memory helper object. | Rejected. | v84 adds a replayable checkpoint-admission record store. |
| A durable checkpoint store only needs the checkpoint body. | Rejected. | v84 stores checkpoint body and admission certificate together. |
| A hash-valid admission certificate proves store history consistency. | Rejected. | v84 adds record sequence and previous-hash replay around the certificate. |
| Physical pruning is safe once an admitted checkpoint is stored. | Not yet. | SQ32 remains open because deletion must be gated by suffix-continuity and pruning records. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecord`.
- Checkpoint-admission record issue and replay types.
- Checkpoint-admission record hash computation.
- Checkpoint-admission record replay with strict certificate re-evaluation and conflict detection.
- `InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecordStore`.
- `PostgresProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecordStore`.
- Migration `0032_agent_state_projection_replay_checkpoint_admissions.sql`.
- Focused test coverage for store rejection, replay, recovery, and tamper detection.

Remaining frontier:

1. Pruning APIs with checkpoint-admission and suffix-continuity gates.
2. Checkpoint-admission store roots or external witnessing.
3. Partial consistency proofs that avoid full-chain replay.
4. Runtime/axis adoption under actually pruned stores.
5. Production crypto adapters and concurrent append isolation.

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

This proves the pure durable checkpoint-admission record-store primitive across the current workspace test slice. It does not yet prove actual pruning, suffix-continuity deletion gates, checkpoint-admission store witnessing, partial consistency proofs, production cryptographic adapters, or Axis A/B/C adoption under pruned stores.

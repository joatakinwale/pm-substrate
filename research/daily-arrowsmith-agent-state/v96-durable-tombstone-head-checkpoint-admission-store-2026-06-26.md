# v96 Durable Tombstone-Head Checkpoint Admission Store

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v95-tombstone-head-proof-preserving-compaction-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ43 - What durable tombstone-head checkpoint-admission record store and consistency proof make admitted tombstone-head replay checkpoints recoverable, non-equivocating, and prunable across agents and restarts?

Answer: tombstone-head checkpoint admission must itself be durable replay history. A tombstone-head compaction checkpoint and its tombstone-head witness admission certificate are now recorded together in a hash-linked checkpoint-admission record chain. Replay verifies record sequence, previous-record hash, checkpoint body hash, admission certificate hash, strict re-evaluation of the admission certificate, and conflicting checkpoint ids/frontiers. A restarted or amnesiac agent can recover the checkpoint admission from substrate records instead of trusting conversation memory, process memory, or adapter-supplied checkpoint summaries.

Implemented slice:

- Added tombstone-head checkpoint-admission record types, issue types, replay result, and store interface.
- Added deterministic tombstone-head checkpoint-admission record hashing.
- Added replay for tombstone-head checkpoint-admission record chains.
- Added same-checkpoint-id and same-frontier conflict detection.
- Added in-memory and Postgres tombstone-head checkpoint-admission record stores.
- Added migration `0039_agent_state_projection_replay_pruning_tombstone_head_checkpoint_admissions.sql`.
- Extended the focused tombstone-head compaction test to recover the admission certificate from the durable record store before seeding suffix replay.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident), [PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | An untrusted log can be made tamper-evident with hash-linked/auditable structures and consistency checks. | Tombstone-head checkpoint-admission records are hash-linked so replay detects missing, reordered, or mutated admission history. |
| Tomescu et al. 2019, "Transparency Logs via Append-Only Authenticated Dictionaries" ([ACM](https://dl.acm.org/doi/10.1145/3319535.3345652), [PDF](https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf)) | Transparency logs need efficient lookup and append-only consistency proofs rather than latest-value trust. | The tombstone-head store persists lookupable checkpoint/admission records while replay checks append-only sequence and conflict semantics. |
| Dowling et al. 2016, "Secure Logging Schemes and Certificate Transparency" ([ePrint](https://eprint.iacr.org/2016/452), [PDF](https://www.douglas.stebila.ca/files/research/papers/ESORICS-DGHS16.pdf)) | Secure logs separate inclusion proofs from append-only consistency proofs and formalize malicious-logger failures. | Checkpoint existence is not enough; tombstone-head admission history must replay consistently and non-equivocally. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoint proof material must survive recovery/view changes. | The admitted tombstone-head checkpoint and its witness proof are persisted together as recovery material. |

## 3. Existing Substrate Map Delta

Already present before v96:

1. v95 added tombstone-head replay compaction checkpoints and admission certificates.
2. Tombstone-head replay could seed from a checkpoint only when a caller supplied a replay-valid admission certificate.
3. Settlement-head checkpoint admissions already had durable record stores from v84, but tombstone-head checkpoint admission did not.

Newly added by v96:

1. Tombstone-head checkpoint admission is now a durable record type.
2. Record replay detects sequence gaps and previous-record hash mismatches.
3. Record replay revalidates checkpoint hashes and admission hashes.
4. Record replay re-evaluates admission certificates under strict tombstone-head witness signatures.
5. Record replay detects conflicting checkpoint hashes for the same checkpoint id or compacted frontier.
6. In-memory and Postgres stores append only replay-valid tombstone-head checkpoint-admission histories.
7. Checkpoint-seeded tombstone-head replay tests now consume the recovered stored admission certificate.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-head pruning admission that requires a durable admitted checkpoint record plus retained suffix replay before physical prefix deletion.
2. Tombstone-head tombstone-gated store pruning APIs for witness, authority, and QC-record lanes.
3. Pruned-store continuity integration with tombstone-head checkpoint-admission records.
4. Runtime and Axis adoption of tombstone-head durable checkpoint-admission stores.
5. Postgres integration tests proving checkpoint recovery after actual tombstone-head prefix pruning.
6. Cross-agent witnessing or monitoring for checkpoint-admission record heads.
7. Direct SQL-delete hardening across tombstone-head witness, authority, and QC-record lanes.
8. Production crypto/key-management adapters for tombstone-head checkpoint signatures.
9. Historical-vs-current replay policy for archived tombstone-head checkpoint admissions after later key rotation or revocation.
10. Compact consistency-proof format for tombstone-head advancement.

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
10. SQ44: What tombstone-head pruning admission rule makes physical prefix deletion impossible unless a durable admitted tombstone-head checkpoint record and retained suffix continuity have both replayed?

## 6. Primitive Proposal Ledger

Name: Durable Tombstone-Head Checkpoint Admission Record Store.

Problem it solves: v95 made checkpoint seeding depend on admission certificates, but those certificates could still be supplied from process memory or adapter input after restart.

Research source: tamper-evident logging, append-only authenticated dictionaries, secure logging consistency, and PBFT stable checkpoint recovery.

Mechanism borrowed or adapted: persist each checkpoint body and its admission certificate as one append-only record that hashes the prior record, then replay the chain before any recovered certificate can seed tombstone-head replay.

Why current substrate lacked it: settlement-head compaction had durable checkpoint-admission records, but tombstone-head compaction only had pure checkpoint/admission values.

Why existing primitives were insufficient: a valid checkpoint admission certificate proves quorum at one point, but without durable record replay an agent cannot know after amnesia whether the certificate came from admitted history, whether a same-id conflicting checkpoint exists, or whether an earlier record was skipped.

State guarantee it should create: a tombstone-head checkpoint admission can be recovered after restart only from a hash-linked, replay-valid admission history whose records revalidate the checkpoint and certificate and detect equivocation.

Admission rule it requires: stores may append only admitted checkpoint certificates that replay under strict signature policy and do not conflict with prior checkpoint ids or compacted frontiers.

Replay rule it requires: replay sorts records by sequence, verifies contiguous sequence and previous hash, checks checkpoint and admission hashes, re-evaluates admission, detects conflicts, and recomputes the record hash.

Authority boundary it requires: durable tombstone-head checkpoint admission belongs to the tombstone-head checkpoint-admission record store, not memory, adapter parameters, connector cache, settlement-head checkpoint stores, or test fixtures.

Failure modes it should prevent:

- an amnesiac agent accepting a locally supplied checkpoint admission certificate;
- missing or reordered admission records hiding an invalid checkpoint;
- a checkpoint id resolving to two checkpoint hashes;
- the same compacted frontier resolving to two checkpoint bodies;
- tampered admission certificates seeding replay;
- checkpoint/admission pairs existing without replay-valid chain membership.

Minimal implementation slice:

- Add tombstone-head checkpoint-admission record types and hashing.
- Add tombstone-head checkpoint-admission record replay.
- Add in-memory and Postgres stores.
- Add migration `0039`.
- Extend focused tests to recover admission from the store and reject bad/conflicting records.

Tests that would falsify it:

- Under-quorum admission appends to the record store.
- Replay accepts a tampered admission record.
- The same checkpoint id can be appended with a different checkpoint hash.
- Checkpoint-seeded replay still uses the in-memory admission rather than recovered stored admission.
- Missing prior records do not create a sequence or previous-hash issue.

Axis surfaces that could later validate it:

- Axis C can restart from a database-backed tombstone-head checkpoint-admission store and recover checkpoint replay authority.
- Axis A can recover finance pruned-projection state from durable tombstone-head checkpoint records.
- Axis B can require domain adapters to cite durable tombstone-head checkpoint-admission record hashes rather than profile-local summaries.

## 7. Falsification Criteria Applied Before Verification

1. An under-quorum tombstone-head checkpoint admission cannot append to the record store.
2. A valid tombstone-head checkpoint admission appends and replays as the latest record.
3. Checkpoint replay can use the recovered stored admission certificate.
4. A same-id conflicting checkpoint is rejected by the store.
5. A tampered admission record is replay-invalid.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A replay-valid checkpoint admission certificate can remain a caller-supplied value. | Rejected. | v96 adds a replayable tombstone-head checkpoint-admission record store and uses recovered admission in the focused replay test. |
| Checkpoint id uniqueness can be left to adapter convention. | Rejected. | v96 replay and append reject same checkpoint id with a different checkpoint hash. |
| A compacted frontier can admit multiple checkpoint bodies if they are individually signed. | Rejected. | v96 detects same-frontier conflicting checkpoint hashes during admission-record replay. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head checkpoint-admission record issue and replay types.
- Tombstone-head checkpoint-admission record hash computation.
- Tombstone-head checkpoint-admission record replay with strict certificate re-evaluation and conflict detection.
- In-memory tombstone-head checkpoint-admission record store.
- Postgres tombstone-head checkpoint-admission record store.
- Migration `0039_agent_state_projection_replay_pruning_tombstone_head_checkpoint_admissions.sql`.
- Focused test coverage for store rejection, replay, recovery, conflict detection, and tamper detection.

Remaining frontier:

1. Tombstone-head pruning admission before physical prefix deletion.
2. Tombstone-head tombstone-gated physical pruning APIs.
3. Store-head witnessing or consistency proofs for tombstone-head checkpoint-admission record histories.
4. Runtime and Axis adoption.
5. Production cryptographic adapters.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 73 tests.
- Full workspace typecheck passed.
- Broad affected-package Vitest sweep passed: 31 files passed, 8 skipped; 393 tests passed, 65 skipped.

Proof boundary:

This proves the pure durable tombstone-head checkpoint-admission record-store primitive in focused and affected-package tests. It does not yet prove pruning admission, actual physical tombstone-head prefix deletion, checkpoint-admission store witnessing, Postgres integration, runtime/Axis adoption, or production crypto/key management.

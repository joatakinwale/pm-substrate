# v100 Durable Pruning Tombstone-Store Head Witness Ledger

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v99-tombstone-head-pruning-tombstone-store-head-currentness-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ47 - What durable witness ledger or quorum protocol makes required tombstone-head pruning tombstone-store heads recoverable and non-equivocating after amnesia rather than supplied by local memory, adapters, or connector caches?

Answer: a required tombstone-head pruning tombstone-store head must be recovered from a replayed, hash-linked witness-observation ledger before pruned-store continuity can treat it as current operational authority. v100 implements the durable single-witness ledger slice: observations are evaluated against replayed prior accepted heads, recorded with deterministic hashes, and replayed after amnesia to recover the latest accepted required head. Forked or unproved heads remain durable obstructions instead of replacing currentness.

This closes recoverability from durable substrate history. It does not yet close multi-witness non-equivocation or quorum authority; that becomes SQ48.

Implemented slice:

- Added pruning tombstone-store head witness observation, decision, record, issue, and replay types.
- Added deterministic witness-record hashing and ledger replay that recomputes decisions from prior accepted heads.
- Added in-memory and Postgres-backed pruning tombstone-store head witness ledgers.
- Added a ledger-backed witness that observes heads only after replaying stored witness history.
- Added migration `0041_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness.sql`.
- Extended focused tests so pruned-store continuity gets `requiredPruningTombstoneStoreHead` from replayed witness history, tampered witness records fail replay, and forked heads stay obstructed.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | An untrusted logger must prove current and prior commitments are consistent; tamper evidence comes from append-only commitments plus incremental consistency proofs. | A pruning tombstone-store head witness record is a commitment over the observed head, prior witness record hash, and deterministic decision. Replay recomputes the commitment rather than trusting memory. |
| Li et al. 2004, "SUNDR: Secure Untrusted Data Repository" ([PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf)) | Fork consistency accepts that an untrusted server may equivocate, but clients later detect divergent histories when views meet. | Same-sequence different pruning tombstone-store heads become durable fork obstructions; a recovered agent cannot silently replace one accepted head with another local view. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | A key directory must expose consistency evidence so clients and monitors can detect inconsistent authoritative views. | A pruning tombstone-store head witness must reject same-sequence forks as obstruction evidence rather than accepting whichever view a caller supplies. |
| Malvai et al. 2023, "PARAKEET: Practical Key Transparency for End-to-End Encrypted Messaging" ([PDF](https://www.ndss-symposium.org/wp-content/uploads/2023-545-paper.pdf)) | Transparency servers publish commitments, witnesses certify them, and clients can query commitment/certificate material after restart. | The ledger-backed witness makes required pruning tombstone-store heads queryable through replayed witness records rather than supplied by adapters. |

## 3. Existing Substrate Map Delta

Already present before v100:

1. v95 added tombstone-head replay compaction checkpoints.
2. v96 made tombstone-head checkpoint admissions durable and replayable.
3. v97 added tombstone-head pruning admission over durable checkpoint history plus retained suffix continuity.
4. v98 added durable tombstone-head pruning tombstone records and tombstone-gated store pruning.
5. v99 added deterministic pruning tombstone-store heads plus exact required-head continuity checks.
6. v99 could reject missing, stale, unwitnessed-advance, forked, or hash-invalid pruning tombstone histories.

Newly added by v100:

1. Pruning tombstone-store head observations now become replayable witness records.
2. The latest accepted required pruning tombstone-store head can be recovered from durable witness history after amnesia.
3. Witness replay verifies record sequence, previous-record hash, observation hash, and deterministic decision.
4. Observation admission verifies the observed head hash and any required consistency proof from a prior accepted head.
5. Same-sequence divergent heads become durable fork obstructions.
6. Tampered witness decisions or record hashes invalidate witness replay.
7. In-memory and Postgres stores provide the same append/list substrate interface for head witness records.

## 4. Missing Substrate Map Delta

Still missing:

1. A pruning tombstone-store head witness authority topology so one observer cannot unilaterally define currentness.
2. A quorum certificate protocol for pruning tombstone-store head witness records.
3. Durable authority-transition stores for pruning tombstone-store head witnesses.
4. Signature-bound pruning tombstone-store head witness identity and key-status replay.
5. Non-retroactive authority epoch seals for pruning tombstone-store head certification.
6. Durable quorum-certificate proof records for certified pruning tombstone-store heads.
7. Proof-preserving compaction and pruning for the new witness ledger itself.
8. Runtime recovery integration that automatically derives required pruning tombstone-store heads from the witness ledger.
9. Postgres restart tests proving ledger-backed recovery across process boundaries.
10. Axis A/B/C adoption so adapters and local labs cannot bypass recovered required heads.

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
10. SQ48: What witness authority topology and quorum certificate protocol prevents a single observer from unilaterally defining tombstone-head pruning tombstone-store head currentness?

## 6. Primitive Proposal Ledger

Name: Durable Pruning Tombstone-Store Head Witness Ledger.

Problem it solves: v99 made pruning tombstone-store head currentness exact, but the required head could still be supplied by memory, adapters, connector caches, or a process-local monitor after amnesia.

Research source: tamper-evident logging, SUNDR fork consistency, CONIKS consistency monitoring, and Parakeet witness commitments.

Mechanism borrowed or adapted: append-only witness observations over head commitments. Currentness is recovered by replaying hash-linked witness records and recomputing each admission decision from prior accepted heads.

Why current substrate lacked it: v99 introduced `requiredPruningTombstoneStoreHead` as a currentness object, but not a durable source for that object.

Why existing primitives are insufficient: older settlement-head and tombstone-head witness ledgers govern other store heads. The new v98/v99 pruning tombstone-store head is a distinct history whose required head cannot inherit authority from sibling ledgers.

State guarantee it should create: pruned-store continuity can receive its required pruning tombstone-store head from replayed substrate history; private memory, summaries, adapters, and connector caches are not needed to recover the current required head.

Admission rule it requires: a witness observation is accepted only when the observed head hash recomputes, the proposed head is not stale or forked relative to replayed accepted heads, and any advance beyond the latest accepted head carries a replay-valid consistency proof.

Replay rule it requires: replay witness records in sequence, verify previous-record hashes, recompute the expected observation decision from accumulated accepted heads, recompute the record hash, and project the latest accepted head.

Authority boundary it requires: pruning tombstone-store head witness records are core `@pm/agent-state` substrate objects. Domain adapters, tool outputs, and local lab fixtures may cite recovered heads but cannot mint operational head currentness by themselves.

Failure modes it should prevent:

- accepting a required pruning tombstone-store head from process memory after restart;
- accepting a witness record whose decision was edited from obstructed to accepted;
- accepting a witness record whose record hash no longer matches its body;
- allowing a same-sequence fork to replace the latest accepted head;
- accepting an advanced head without a replay-valid consistency proof;
- treating an adapter-supplied head as current without witness-ledger replay.

Minimal implementation slice:

- Add witness observation, decision, record, ledger, and replay types for pruning tombstone-store heads.
- Add deterministic witness-record hashing.
- Add in-memory and Postgres witness ledgers plus migration `0041`.
- Add a ledger-backed witness that replays records before evaluating new observations.
- Extend focused tests to recover the required head from witness replay and falsify tampering/fork replacement.

Tests that would falsify it:

- Continuity test passes while sourcing `requiredPruningTombstoneStoreHead` directly from a local variable instead of replayed witness history.
- A tampered witness decision or record hash replays as valid.
- A same-sequence forked pruning tombstone-store head replaces the latest accepted head.
- A head advanced beyond the latest accepted witness head is accepted without a consistency proof.
- Empty witness history is treated as proof of a required current head.

Axis surfaces that could later validate it:

- Axis C can restart an agent and require the pruning tombstone-store head from witness-ledger replay before local recovery.
- Axis A can try finance projection recovery with an adapter-supplied stale required head and expect obstruction.
- Axis B can require domain adapters to cite recovered witness records rather than local summaries.

## 7. Falsification Criteria Applied Before Implementation

1. A valid observed pruning tombstone-store head must be accepted and recorded.
2. Replaying the witness ledger must recover that accepted head as `latestHead`.
3. Tombstone-head pruned-store continuity must pass when its required head is taken from witness replay.
4. A tampered witness decision must make ledger replay invalid.
5. A tampered witness record hash must make ledger replay invalid.
6. A same-sequence forked head must be recorded as an obstruction and must not replace `latestHead`.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Exact `requiredPruningTombstoneStoreHead` comparison is enough after amnesia. | Rejected. | v100 adds a durable witness ledger so the required head can be recovered rather than remembered. |
| A process-local monitor can safely define the required pruning tombstone-store head. | Rejected. | The ledger-backed witness replays stored observations before accepting or projecting currentness. |
| Durable single-witness recovery also solves quorum non-equivocation. | Rejected. | v100 records durable fork obstructions but leaves witness topology and quorum certificates as SQ48. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecord`.
- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessLedger`.
- `computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecordHash()`.
- `replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords()`.
- `InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessLedger`.
- `PostgresProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessLedger`.
- `LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitness`.
- Migration `0041_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness.sql`.

Remaining frontier:

1. Pruning tombstone-store head witness authority topology and quorum certification.
2. Durable authority-transition stores, signatures, key status, and epoch seals for this witness layer.
3. Durable quorum-certificate proof records.
4. Witness-ledger compaction/pruning.
5. Runtime recovery adoption.
6. Live Postgres restart tests.
7. Axis C restart pressure and Axis A/B adapter pressure.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v100-durable-pruning-tombstone-store-head-witness-ledger-2026-06-26.md db/migrations/0041_agent_state_projection_replay_pruning_tombstone_head_pruning_store_head_witness.sql
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, migration, and ledger files found no matches.

# v88 Durable Tombstone-Head Witness Ledger

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v87-pruning-tombstone-head-currentness-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ35 - What durable tombstone-head witness ledger makes `requiredTombstoneStoreHead` recoverable after amnesia instead of supplied by local memory or adapter input?

Answer: a required pruning tombstone-store head must be recovered by replaying a durable witness ledger of tombstone-head observations. v88 adds a hash-linked tombstone-head witness record chain, in-memory and Postgres-backed ledgers, replay that recomputes every observation decision, and a ledger-backed witness. A pruned-store continuity check can now consume the replayed `latestHead` instead of trusting chat memory, adapter input, or a local snapshot.

Implemented slice:

- Added pruning tombstone-store head observation, decision, obstruction, record, replay, and ledger types.
- Added tombstone-head consistency proof verification over replay-valid pruning tombstone records.
- Added in-memory and Postgres-backed tombstone-head witness ledgers.
- Added a ledger-backed tombstone-head witness that derives known heads from replay before admitting another observation.
- Added migration `0034_agent_state_projection_replay_pruning_tombstone_head_witness.sql`.
- Added tests proving replay-derived required-head recovery, unproved advance obstruction, fork obstruction, and tampered witness-record rejection.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Chuat et al. 2015, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs" ([PDF](https://netsec.ethz.ch/publications/papers/gossip2015.pdf)) | Clients need a way to compare log views and detect inconsistent heads. | Tombstone-head observations become shared replayable commitments rather than local variables. |
| Melara et al. 2015, "CONIKS" ([PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | End users can monitor provider-maintained state and collectively audit non-equivocation. | Agents recover the current tombstone head by replaying observed heads rather than believing their own cached view. |
| Dowling et al. 2016, "Secure Logging Schemes and Certificate Transparency" ([PDF](https://www.douglas.stebila.ca/files/research/papers/ESORICS-DGHS16.pdf)) | Monitors and auditors check append-only logs for split views and time-varying views. | The tombstone-head witness ledger records accepted and obstructed observations so equivocation remains replay evidence. |
| Len et al. 2024, "OPTIKS: An Optimized Key Transparency System" ([PDF](https://www.usenix.org/system/files/usenixsecurity24-len.pdf)) | Transparency systems focus on detecting incorrect behavior and surviving machine failures. | Tombstone-head currentness state moves into durable replay records so restart/amnesia does not erase the known head. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Tamper-evident histories require chained commitments so changes become detectable. | Tombstone-head witness rows are hash-linked, and replay rejects tampered decisions or hashes. |

## 3. Existing Substrate Map Delta

Already present before v88:

1. v86 added hash-linked pruning tombstone records and tombstone-gated physical prune APIs.
2. v87 added tombstone-store head identity and optional required-head currentness in pruned-store continuity.
3. Settlement-store heads already had a durable witness ledger, but pruning tombstone heads did not.

Newly strengthened by v88:

1. Pruning tombstone-store head observations are first-class substrate records.
2. Tombstone-head witness records are hash-linked by `previousObservationHash`.
3. Replay recomputes each observation decision from prior accepted heads.
4. A ledger-backed witness derives known heads from replay before admitting new observations.
5. Postgres storage can persist tombstone-head witness observations for restart and cross-agent recovery.
6. Pruned-store continuity can take `requiredTombstoneStoreHead` from replayed witness history.
7. Unproved tombstone-head advances and same-sequence forks become durable obstructions.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-head witness authority topology and quorum certificates.
2. Signature-bound tombstone-head witness identity.
3. Durable tombstone-head quorum-certificate records.
4. Tombstone-head consistency proof compression that avoids replaying full tombstone history.
5. Tombstone-head witness compaction and pruning.
6. Cross-agent gossip/monitoring beyond shared durable storage.
7. Postgres integration tests for tombstone-head witness recovery after actual pruning.
8. Runtime adoption in strict graph/capability recovery paths.
9. Axis validation under tombstone-head witness-required pruned stores.
10. Direct SQL-delete hardening across tombstone and tombstone-head ledgers.

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
10. SQ36: What tombstone-head witness authority topology and quorum rule prevents a single observer from unilaterally defining tombstone currentness?

## 6. Primitive Proposal Ledger

Name: Durable Pruning Tombstone-Head Witness Ledger.

Problem it solves: v87 could require a tombstone-store head, but that required head could still come from memory, adapter input, or a local cache. That left amnesiac recovery dependent on a private representation.

Research source: certificate-log gossip, key transparency monitoring, secure logging monitors/auditors, crash-tolerant key transparency, and tamper-evident logging.

Mechanism borrowed or adapted: record observed log heads as append-only witness observations; replay the witness ledger to reconstruct accepted heads and obstructions.

Why current substrate lacked it: pruning tombstone records were durable, but the current witnessed tombstone head was not itself durable replay history.

Why existing primitives were insufficient: settlement-head witness ledgers solved a parallel head-currentness problem but did not apply to pruning tombstone history; v87 required a head but did not say where a fresh agent obtains it.

State guarantee it should create: an amnesiac agent can recover the required tombstone-store head from admitted witness history before accepting a pruned projection.

Admission rule it requires: a tombstone-head observation is accepted only if its head hash is valid, it does not fork or regress from replayed accepted heads, and any advance beyond known heads has a valid tombstone consistency proof.

Replay rule it requires: sort witness records by sequence, verify previous observation hashes, recompute record hashes, recompute every observation decision from prior accepted heads, and project the latest accepted head.

Authority boundary it requires: tombstone-head currentness is recovered from substrate witness history, not supplied by agents, adapters, summaries, or local snapshots.

Failure modes it should prevent:

- accepting a required tombstone head from memory after restart;
- accepting a same-sequence fork as current;
- accepting a tombstone-head advance with no consistency proof;
- accepting tampered witness decisions;
- treating an obstructed witness observation as the latest required head.

Minimal implementation slice:

- Add tombstone-head observation/decision/record/replay contracts.
- Add hash-linked in-memory and Postgres witness ledgers.
- Add ledger-backed tombstone-head witness.
- Add migration `0034`.
- Add tests that derive `requiredTombstoneStoreHead` from witness replay and reject forks, unproved advances, and tampering.

Tests that would falsify it:

- Continuity can pass only because an adapter supplied the required head when a replayed witness ledger has a different latest head.
- Witness replay accepts a tampered decision.
- Witness replay treats an obstructed fork or unproved advance as latest.
- A fresh witness cannot recover the previously accepted head from the shared ledger.

Axis surfaces that could later validate it:

- Axis C can restart after pruning and derive the required tombstone head from the ledger.
- Axis A can require finance recovery to match a witness-replayed tombstone head after compaction pruning.
- Axis B can reject agency adapter pruned projections whose tombstone head is not replayed from substrate witness history.

## 7. Falsification Criteria Applied Before Verification

1. A replayed tombstone-head witness ledger exposes `latestHead` that can be passed into pruned-store continuity.
2. A future tombstone head without a consistency proof is recorded as obstructed and does not replace the latest accepted head.
3. A same-sequence different tombstone head is recorded as an obstruction and does not replace the latest accepted head.
4. Tampering with a witness record decision causes replay to fail.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A required tombstone head can be supplied safely by an adapter or local memory. | Rejected. | v88 derives the required head from replayed witness records. |
| Tombstone-head currentness only needs local tombstone replay. | Rejected. | v88 keeps accepted and obstructed head observations in a separate witness ledger. |
| A single observer's accepted tombstone head is final currentness authority. | Not yet. | SQ36 remains open for tombstone-head witness authority topology and quorum. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecord`.
- Tombstone-head witness decision and obstruction types.
- Tombstone-head consistency proof verification over replay-valid pruning tombstone records.
- Tombstone-head witness replay with decision recomputation and latest-head projection.
- In-memory and Postgres tombstone-head witness ledgers.
- Ledger-backed tombstone-head witness.
- Migration `0034_agent_state_projection_replay_pruning_tombstone_head_witness.sql`.
- Tests for replay-derived required-head continuity, fork obstruction, unproved advance obstruction, and tampered witness decision rejection.

Remaining frontier:

1. Tombstone-head witness quorum topology.
2. Signature-bound tombstone-head witness identity.
3. Durable tombstone-head quorum certificate records.
4. Tombstone-head consistency proof compression.
5. Runtime and Axis adoption.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 71 tests.
- Full workspace typecheck passed.
- Broad substrate/frontier Vitest sweep passed: 31 files passed, 8 skipped; 391 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves the pure tombstone-head witness ledger and replay-derived required-head path in focused agent-state tests and preserves the broader checked package frontier. It does not yet prove tombstone-head witness quorum topology, signature-bound identity, quorum-certificate records, compact consistency proofs, runtime adoption, or Axis A/B/C adoption; those remain SQ36/frontier work.

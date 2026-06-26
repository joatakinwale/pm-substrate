# v87 Pruning Tombstone Head Currentness

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v86-pruning-tombstone-store-api-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ34 - What pruning-head witness or tombstone consistency proof makes stale or forked tombstone histories unable to authorize a pruned store projection?

Answer: a pruned store projection must be checked against a tombstone-store head, not merely against a locally replay-valid tombstone prefix. v87 adds tombstone-store head identity and makes pruned-store continuity optionally require an exact witnessed tombstone-store head. If local tombstone replay ends behind the required head, at the same sequence with a different hash, beyond the witnessed head, or if the required head hash is invalid, continuity is obstructed.

Implemented slice:

- Added settlement-head replay compaction pruning tombstone-store head identity.
- Added deterministic tombstone-store head hashing and head-from-record derivation.
- Added pruned-store continuity issue codes for missing, stale, forked, unwitnessed-advance, and hash-invalid tombstone-store heads.
- Extended pruned-store continuity verification with `requiredTombstoneStoreHead`.
- Added tests proving exact head acceptance and stale/forked/tampered head obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Incremental auditing compares prior and current commitments; unaudited commitments can be tampered with. | A local tombstone prefix cannot authorize pruning unless it matches a witnessed tombstone-store head. |
| Melara et al. 2015, "CONIKS" ([PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Users can monitor provider-maintained bindings for consistency and collectively audit non-equivocation. | Tombstone heads are treated as shared commitments that must be checked before accepting a pruned projection. |
| Chuat et al. 2015, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs" ([PDF](https://netsec.ethz.ch/publications/papers/gossip2015.pdf)) | Gossip lets clients detect log inconsistencies that are invisible to a single local view. | The required tombstone-store head models the shared head a pruned-store recovery must match. |
| Tomescu et al. 2019, "Transparency Logs via Append-Only Authenticated Dictionaries" ([PDF](https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf)) | Append-only authenticated structures separate lookup validity from append-only consistency. | Tombstone replay validity and tombstone-head currentness become separate checks. |
| Dowling et al. 2016, "Secure Logging Schemes and Certificate Transparency" ([PDF](https://www.douglas.stebila.ca/files/research/papers/ESORICS-DGHS16.pdf)) | Audit proofs and consistency proofs serve different roles: inclusion is not enough to prove append-only evolution. | A valid tombstone record is insufficient without head currentness against the shared tombstone history. |

## 3. Existing Substrate Map Delta

Already present before v87:

1. v86 added hash-linked pruning tombstone records.
2. v86 added tombstone-gated physical prune methods for witness, authority, and quorum lanes.
3. v86 added pruned-store continuity from tombstone plus retained suffix.
4. v86 detected silent deletion of retained suffixes after pruning.

Newly strengthened by v87:

1. Tombstone-store heads now have explicit identity.
2. A pruned-store continuity check can require a tombstone-store head.
3. Required tombstone-store head hashes are recomputed before use.
4. Local tombstone replay behind the required head is stale.
5. Local tombstone replay at the same sequence but different hash is a fork.
6. Local tombstone replay ahead of the required head is an unwitnessed advance.
7. A pruned projection can no longer rely on a locally valid but stale tombstone prefix when a newer head has been witnessed.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable tombstone-head witness ledger so `requiredTombstoneStoreHead` is not supplied from memory.
2. Quorum topology for tombstone-head witnesses.
3. Tombstone-head consistency proof objects that can prove append-only evolution without replaying every tombstone.
4. Cross-agent gossip/monitoring of tombstone heads.
5. Postgres integration tests for tombstone-head currentness after real pruning.
6. Direct SQL-delete hardening.
7. Runtime adoption in strict graph/capability recovery paths.
8. Axis validation under tombstone-head-required pruned stores.
9. Tombstone-head support for root-witness and settlement-record stores.
10. Tombstone-head archival/compaction without losing currentness proof.

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
10. SQ35: What durable tombstone-head witness ledger makes `requiredTombstoneStoreHead` recoverable after amnesia instead of supplied by local memory or adapter input?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone Store Head Currentness.

Problem it solves: a pruned store can replay a valid older tombstone prefix even after another agent has observed a newer tombstone head. Without head currentness, stale tombstone histories can still authorize projections.

Research source: tamper-evident incremental auditing, key transparency non-equivocation, certificate-log gossip, append-only authenticated dictionaries, and secure logging consistency proofs.

Mechanism borrowed or adapted: separate local proof validity from current shared-head validity; require the local replay head to match a witnessed store commitment.

Why current substrate lacked it: v86 proved tombstone-chain integrity but had no rule comparing the local chain to a known shared tombstone head.

Why existing primitives were insufficient: replay-valid tombstones prove internal consistency, not currentness or non-equivocation against other agents' observations.

State guarantee it should create: a pruned projection cannot become admissible when its tombstone history is stale, forked, or ahead of witnessed authority.

Admission rule it requires: when a tombstone-store head is required, pruned-store continuity admits only if local tombstone replay ends exactly at that head.

Replay rule it requires: recompute the required head hash, replay tombstones, derive the local head from the latest tombstone record, and compare sequence plus record hash exactly.

Authority boundary it requires: tombstone-store head currentness is substrate continuity logic, not adapter-supplied confidence.

Failure modes it should prevent:

- accepting a pruned projection from a stale tombstone prefix;
- accepting a forked tombstone record at the witnessed sequence;
- accepting local tombstone replay that advances beyond the witnessed head;
- accepting a forged required head hash;
- treating tombstone replay validity as tombstone currentness.

Minimal implementation slice:

- Add tombstone-store head type and hash helpers.
- Derive tombstone-store head from latest tombstone record.
- Add required-head currentness checks to pruned-store continuity.
- Extend tests for exact, stale, forked, and tampered required heads.

Tests that would falsify it:

- Continuity passes when local tombstone replay is behind the required head.
- Continuity passes when local tombstone replay forks at the required sequence.
- Continuity passes when local tombstone replay advances beyond the required head.
- Continuity passes when the required head hash is tampered.

Axis surfaces that could later validate it:

- Axis C can resume from a stale pruned local store while citing a newer tombstone head.
- Axis A can require finance recovery to match a store-witnessed tombstone head after pruning.
- Axis B can reject adapter-provided pruned projections whose tombstone head does not match substrate history.

## 7. Falsification Criteria Applied Before Verification

1. Exact required tombstone-store head yields valid continuity.
2. Future required head obstructs stale local tombstone replay.
3. Same-sequence different hash obstructs forked local tombstone replay.
4. Tampered required head hash obstructs continuity.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Replay-valid tombstone history is enough to authorize pruned projection recovery. | Rejected. | v87 can require exact tombstone-store head currentness. |
| Tombstone head currentness can be inferred from the local tombstone prefix. | Rejected. | v87 compares local replay against an explicit required head. |
| A required tombstone head supplied by an adapter is fully solved substrate authority. | Not yet. | SQ35 remains open for durable head-witness ledgers and replayed head recovery. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead`.
- Tombstone-store head hashing.
- Tombstone-store head derivation from tombstone records.
- `requiredTombstoneStoreHead` currentness in `verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity()`.
- Issue codes for missing, stale, forked, unwitnessed, and hash-invalid tombstone-store heads.
- Tests for accepted exact head, stale required head, forked required head, and tampered required head.

Remaining frontier:

1. Durable tombstone-head witness ledger.
2. Tombstone-head witness quorum topology.
3. Tombstone-head consistency proof compression.
4. Postgres pruning/head-currentness integration tests.
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

This proves pure tombstone-head currentness checks in focused agent-state tests and preserves the broader checked package frontier. It does not yet prove durable tombstone-head witness recovery after amnesia, tombstone-head quorum, consistency-proof compression, Postgres pruning/head-currentness integration, or Axis A/B/C adoption; those remain SQ35/frontier work.

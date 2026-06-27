# v99 Tombstone-Head Pruning Tombstone-Store Head Currentness

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v98-tombstone-head-pruning-tombstone-store-api-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ46 - What tombstone-head pruning tombstone-store head currentness or witness protocol makes the new pruning tombstone ledger itself non-stale and non-forked after amnesia?

Answer: tombstone-head pruning tombstone replay must publish a deterministic store head and pruned-store continuity must optionally require an exact current head before row absence can be accepted as operational state. A local replay-valid tombstone history is no longer sufficient by itself. If a required pruning tombstone-store head exists, continuity compares the replayed local tombstone head against it and obstructs missing local history, stale local history, local unwitnessed advance, same-sequence fork, or a tampered required-head hash.

Implemented slice:

- Added a deterministic pruning tombstone-store head for the v98 tombstone-head pruning tombstone ledger.
- Added `requiredPruningTombstoneStoreHead` to tombstone-head replay-compaction pruned-store continuity.
- Added continuity obstructions for missing, stale, unwitnessed-advance, forked, and hash-invalid pruning tombstone-store heads.
- Returned the replay-derived `pruningTombstoneStoreHead` from continuity results.
- Extended focused tests so a pruned store succeeds only when replayed tombstone history matches the required head and fails all currentness falsifiers.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Dowling et al. 2016, "Secure Logging Schemes and Certificate Transparency" ([PDF](https://www.douglas.stebila.ca/files/research/papers/ESORICS-DGHS16.pdf)) | Certificate Transparency stores entries in append-only Merkle history, publishes signed tree heads, gossips observed heads, and uses consistency proofs to detect forked or non-append-only views. | A pruning tombstone ledger needs a head object independent of local replay validity; a recovered local prefix must match the required head before authorizing pruned projections. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | A binding is not accepted only because a service signs it; clients verify consistency of the directory view and equivocation produces evidence. | A pruning tombstone-store head is a consistency object: same-sequence different tombstone hashes become fork obstructions rather than alternative local memories. |
| Papadopoulos et al. 2019, "Transparency Logs via Append-Only Authenticated Dictionaries" ([PDF](https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf)) | Transparency systems separate users, monitors, and auditors; append-only claims require compact proof or collective verification to prevent stale/forked views. | v99 keeps the minimal substrate slice at exact required-head comparison and leaves durable witness/quorum recovery as SQ47. |
| Kim et al. 2013, "Accountable Key Infrastructure" ([PDF](https://www.cs.cmu.edu/~xia/resources/Documents/kim-www13.pdf)) | Checks and balances reduce trust in any single component; parties monitor each other to detect misbehavior. | A future v100-style durable witness layer should make required pruning tombstone-store heads recoverable from substrate history, not adapter input. |

## 3. Existing Substrate Map Delta

Already present before v99:

1. v95 added tombstone-head replay compaction checkpoints.
2. v96 made tombstone-head checkpoint admissions durable and replayable.
3. v97 added tombstone-head pruning admission over durable checkpoint history plus retained suffix continuity.
4. v98 added a durable tombstone-head pruning tombstone ledger and tombstone-gated physical store pruning.
5. v98 continuity could detect retained suffix truncation after physical pruning.
6. Settlement-head pruning already had tombstone-store head currentness.

Newly added by v99:

1. Tombstone-head pruning tombstone records now have a deterministic pruning tombstone-store head projection.
2. Tombstone-head replay-compaction pruned-store continuity can require an exact pruning tombstone-store head.
3. A replay-valid but locally missing pruning tombstone history is obstructed when a required head exists.
4. A replay-valid but stale local pruning tombstone history is obstructed.
5. A replay-valid local pruning tombstone history that advances beyond the required head is obstructed as unwitnessed advance.
6. Same-sequence pruning tombstone forks are obstructed.
7. Tampered required-head hashes are obstructed before continuity can pass.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable witness or quorum history for the new pruning tombstone-store head, so `requiredPruningTombstoneStoreHead` is recovered after amnesia instead of supplied by a caller.
2. A compact consistency-proof format for advancing from one pruning tombstone-store head to another without full replay.
3. Runtime recovery integration that derives required pruning tombstone-store heads from durable witness/QC records before building projections.
4. Postgres integration tests proving restart recovery of pruning tombstone-store head currentness.
5. Axis C direct local-agent-state pressure against stale/forked pruning tombstone-store heads.
6. Axis A/B adapter adoption so domain recovery cannot bypass required pruning tombstone-store head checks.
7. Database-level hardening against direct SQL deletion of pruning tombstone history itself.
8. Cross-agent monitoring of pruning tombstone-store heads.
9. Production crypto/key-management adapters for pruning tombstone-store head observations.
10. A generalized store-head currentness abstraction that reduces duplication without merging authority domains.

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
10. SQ47: What durable witness ledger or quorum protocol makes required tombstone-head pruning tombstone-store heads recoverable and non-equivocating after amnesia rather than supplied by local memory, adapters, or connector caches?

## 6. Primitive Proposal Ledger

Name: Tombstone-Head Pruning Tombstone-Store Head Currentness.

Problem it solves: v98 made actual tombstone-head row deletion replayable, but the pruning tombstone ledger itself could still be locally replay-valid while stale, forked, missing, or advanced beyond any witnessed current head.

Research source: Certificate Transparency signed tree heads and consistency proofs; CONIKS directory consistency; append-only authenticated dictionary transparency; accountable infrastructure checks and balances.

Mechanism borrowed or adapted: a log head is the currentness object for an append-only history. Local replay proves internal consistency; required-head comparison proves the recovered history is the admitted current view.

Why current substrate lacked it: v98 stopped at tombstone record replay and retained-suffix continuity. It did not derive a currentness head for the new pruning tombstone ledger or compare local recovery against a required head.

Why existing primitives are insufficient: settlement-head tombstone-store currentness applies to settlement-head pruning tombstones, not to the separate tombstone-head pruning tombstone ledger. v98 tombstone records prove deletion transitions but not that the tombstone history is current.

State guarantee it should create: a tombstone-head pruned projection cannot become operational state when its pruning tombstone history is missing, stale, forked, locally advanced without a required head, or bound to a tampered required head.

Admission rule it requires: if a required pruning tombstone-store head is present, the replay-derived local head must have the same sequence, tombstone record hash, and head hash, and the required head hash must recompute from its body.

Replay rule it requires: replay the pruning tombstone chain, derive the latest pruning tombstone-store head from the latest valid tombstone, compare it to the required head, and only then replay retained suffixes from tombstone frontiers.

Authority boundary it requires: required pruning tombstone-store heads are core `@pm/agent-state` currentness objects. Domain adapters, connectors, and eval axes cannot substitute raw sequence numbers or summaries for the head.

Failure modes it should prevent:

- accepting no pruning tombstone history when a required head exists;
- accepting an old replay-valid pruning tombstone prefix;
- accepting a local pruning tombstone history that advances beyond the required head;
- accepting same-sequence forks of the pruning tombstone ledger;
- accepting a required head with a forged head hash;
- treating retained suffix replay as enough when the tombstone ledger itself is stale.

Minimal implementation slice:

- Add pruning tombstone-store head type/hash/from-record helpers.
- Add optional required-head input and replay-derived head output to tombstone-head pruned-store continuity.
- Add currentness obstruction issue codes.
- Add focused tests for valid, missing, stale, unwitnessed-advance, forked, and tampered-head cases.

Tests that would falsify it:

- Continuity passes with `tombstoneRecords: []` and a required pruning tombstone-store head.
- Continuity passes when local tombstones are behind a required head.
- Continuity passes when local tombstones advance beyond a required head.
- Continuity passes when local and required heads share a sequence but disagree on tombstone record hash.
- Continuity passes when a required head's `headHash` does not match its body.

Axis surfaces that could later validate it:

- Axis C can attempt stale/forked pruning tombstone-store recovery and require continuity obstruction.
- Axis A can recover finance projections only when the pruning tombstone-store head is current.
- Axis B can require adapters to cite replay-derived required heads rather than local summaries.

## 7. Falsification Criteria Applied Before Implementation

1. A valid replayed pruning tombstone history plus matching required head must pass continuity.
2. Empty local tombstone history plus required head must fail as missing.
3. Local tombstone history behind the required head must fail as stale.
4. Local tombstone history ahead of the required head must fail as unwitnessed advance.
5. Same-sequence different tombstone record hash must fail as fork.
6. Tampered required-head hash must fail before continuity passes.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Replay-valid pruning tombstone history is enough for tombstone-head pruned-store recovery. | Rejected. | v99 adds required-head currentness checks on top of replay validity. |
| Retained suffix continuity proves the tombstone ledger itself is current. | Rejected. | v99 separates suffix replay from pruning tombstone-store head currentness. |
| A required pruning tombstone-store head can be trusted if its fields look structurally valid. | Rejected. | v99 recomputes required-head hashes and treats mismatch as obstruction. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead`.
- `computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadHash()`.
- `projectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadFromRecord()`.
- `requiredPruningTombstoneStoreHead` continuity input.
- `pruningTombstoneStoreHead` continuity output.
- Currentness issue codes and tests for missing/stale/unwitnessed-advance/fork/hash-mismatch.

Remaining frontier:

1. Durable pruning tombstone-store head witness ledger or quorum certificate records.
2. Consistency proof format for head advancement.
3. Runtime recovery integration.
4. Postgres live restart tests.
5. Axis C pressure; Axis A/B adapter adoption.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v99-tombstone-head-pruning-tombstone-store-head-currentness-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code and ledger files found no matches.

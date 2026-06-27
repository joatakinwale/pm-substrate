# v101 Pruning Tombstone-Store Head Witness Quorum Topology

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v100-durable-pruning-tombstone-store-head-witness-ledger-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ48 - What witness authority topology and quorum certificate protocol prevents a single observer from unilaterally defining tombstone-head pruning tombstone-store head currentness?

Answer: a pruning tombstone-store head is no longer enough merely because one durable observer accepted it. Currentness can now be certified only by replaying a pruning tombstone-store head witness authority topology and evaluating the v100 witness ledger against that topology. A single accepted observer yields only `witnessed`; a certified quorum requires enough replay-eligible observers to accept the exact same pruning tombstone-store head. Strict pruned-store continuity can require that certified quorum certificate before accepting the required head.

Implemented slice:

- Added pruning tombstone-store head witness authority transitions and topology replay.
- Added quorum policy, quorum certificate, certificate hashing, and evaluator over v100 witness-ledger replay.
- Added strict pruned-store continuity inputs that require and validate a certified pruning tombstone-store head quorum certificate.
- Extended focused tests so one observer cannot certify, unauthorized observers cannot count, two admitted observers can certify, and strict continuity rejects raw or non-certified required heads.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Syta et al. 2016, "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" ([PDF](https://dedis.cs.yale.edu/dissent/papers/witness.pdf)) | Authoritative statements should be accepted only after a diverse witness group validates and publicly logs/cosigns them. | A pruning tombstone-store head quorum certificate is an authority-scoped witness predicate over replayed observations, not a single observer's memory. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Replication tolerates arbitrary faulty behavior by requiring enough matching participants for a decision in an authority set. | The substrate certificate requires matching accepted observations for the same head and treats conflicts as obstructions. |
| Malkhi and Reiter 1997, "Byzantine Quorum Systems" ([PDF](https://www.cs.umass.edu/~arun/cs691ee/reading/BQS97.pdf)) | Quorum systems preserve consistency because sufficiently intersecting authorized sets can operate on behalf of the system. | The topology names replay-eligible witnesses and the evaluator counts only those witnesses toward currentness. |
| Alvisi et al. 2000, "Dynamic Byzantine Quorum Systems" ([PDF](https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf)) | Quorum thresholds and membership can be modeled as changing state while preserving read/write consistency conditions. | v101 keeps topology replay as explicit transition history and leaves durable topology storage as SQ49. |

## 3. Existing Substrate Map Delta

Already present before v101:

1. v98 added durable tombstone-head pruning tombstone records and tombstone-gated store pruning.
2. v99 added deterministic pruning tombstone-store heads plus exact required-head continuity checks.
3. v100 added durable pruning tombstone-store head witness records and replay-derived required-head recovery.
4. v100 could reject tampered witness records and keep same-sequence forks as durable obstructions.

Newly added by v101:

1. Pruning tombstone-store head witness authority transitions can set quorum policy and admit/suspend/revoke/equivocate witnesses.
2. Topology replay projects eligible witness ids at a pruning tombstone sequence.
3. Quorum certificate evaluation counts only replay-eligible witnesses that accepted the exact same pruning tombstone-store head.
4. A single accepted observer produces `witnessed`, not `certified`, when topology requires two witnesses.
5. Unauthorized observers are recorded as invalid and cannot satisfy quorum.
6. Strict pruned-store continuity can require a certified quorum certificate and can derive the required head from that certificate.
7. Non-certified, missing, tampered, tenant-mismatched, or head-mismatched certificates obstruct strict continuity.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable authority-transition stores for pruning tombstone-store head witness topology.
2. Store-backed quorum certification that derives topology from durable history instead of caller-supplied transitions.
3. Signature-bound pruning tombstone-store head witness identity.
4. Key-status replay for pruning tombstone-store head witness signatures.
5. Non-retroactive authority epoch seals for historical certificates.
6. Durable quorum-certificate proof records for certified pruning tombstone-store heads.
7. Proof-preserving compaction and pruning for this new topology and certificate history.
8. Runtime recovery integration that always asks for a certified head when strict recovery is enabled.
9. Live Postgres restart tests for certified required-head recovery.
10. Axis A/B/C pressure proving adapters cannot bypass certified head recovery.

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
10. SQ49: What durable pruning tombstone-store head witness authority-transition store prevents adapters from supplying synthetic quorum topology for certified required-head recovery?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Store Head Witness Quorum Topology.

Problem it solves: v100 recovered required heads from durable witness replay, but one observer could still define currentness if callers treated a single accepted witness record as sufficient authority.

Research source: decentralized witness cosigning, PBFT quorum agreement, Byzantine quorum systems, and dynamic Byzantine quorum systems.

Mechanism borrowed or adapted: authority-scoped membership plus quorum threshold over matching accepted witness observations. Currentness is certified only when enough eligible observers accepted the same head.

Why current substrate lacked it: v100 introduced durable observations for this new head layer but not the authority topology that decides which observers may count.

Why existing primitives are insufficient: older tombstone-head quorum topology governs tombstone-head witness currentness, not the newer pruning tombstone-store head witness ledger. Reusing it would merge authority domains and let the wrong topology certify the wrong state layer.

State guarantee it should create: a pruning tombstone-store head cannot satisfy strict pruned-store continuity unless a replayed authority topology says enough eligible witnesses accepted that exact head.

Admission rule it requires: quorum certification must replay topology, verify witness replay, count only eligible accepted witnesses for the exact head, mark unauthorized witnesses invalid, and treat same-sequence conflicting accepted heads as obstructions.

Replay rule it requires: authority transitions replay in sequence with previous-hash checks and deterministic transition hashes; the resulting topology is evaluated against witness-ledger replay to produce a hash-bound certificate.

Authority boundary it requires: pruning tombstone-store head witness quorum is a distinct `@pm/agent-state` authority boundary. Domain adapters cannot substitute raw observer ids, local summaries, or the older tombstone-head topology.

Failure modes it should prevent:

- one accepted observer certifying a required pruning tombstone-store head;
- unauthorized observers satisfying quorum;
- non-certified quorum certificates authorizing strict continuity;
- missing quorum certificates in strict continuity;
- a quorum certificate for one head authorizing another head;
- a tampered certificate hash passing strict continuity.

Minimal implementation slice:

- Add authority transition/topology types and deterministic transition hashing.
- Add topology replay for quorum policy and witness principal status.
- Add quorum certificate evaluation and hashing over v100 witness replay.
- Add strict continuity inputs for certified required-head recovery.
- Extend focused agent-state tests for single, two-witness, unauthorized, missing certificate, non-certified certificate, and strict certified continuity cases.

Tests that would falsify it:

- A single accepted witness produces `certified` when topology requires two witnesses.
- An observer not admitted by topology counts toward quorum.
- Strict pruned-store continuity passes with only a raw recovered required head.
- Strict pruned-store continuity passes with a `witnessed` but non-certified quorum certificate.
- Strict pruned-store continuity passes when the quorum certificate head differs from the required head.

Axis surfaces that could later validate it:

- Axis C can restart with one witness record and require a strict continuity obstruction.
- Axis A can attempt finance recovery with adapter-supplied single-observer required heads.
- Axis B can require domain adapters to cite certified required-head certificates instead of local summaries.

## 7. Falsification Criteria Applied Before Implementation

1. One accepted observer plus topology requiring two witnesses must not certify.
2. Two admitted observers accepting the same head must certify.
3. An accepted observer outside topology must not count.
4. Strict continuity with a raw required head and no certificate must fail.
5. Strict continuity with a non-certified certificate must fail.
6. Strict continuity with a certified certificate must pass and derive the required head from that certificate.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable witness replay is enough to define currentness. | Rejected. | v101 requires topology-bound quorum certification for strict continuity. |
| Any observer in a valid witness ledger can count toward certification. | Rejected. | v101 counts only observers admitted by replayed topology. |
| Required-head continuity can safely accept raw recovered heads in strict mode. | Rejected. | v101 strict continuity fails without a certified quorum certificate. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition`.
- `replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions()`.
- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificate`.
- `evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificate()`.
- `requiredPruningTombstoneStoreHeadQuorumCertificate` and `requirePruningTombstoneStoreHeadQuorumCertificate` strict continuity inputs.
- Strict continuity issue codes for missing, invalid, and head-mismatched pruning tombstone-store head quorum certificates.

Remaining frontier:

1. Durable authority-transition stores for this new topology.
2. Store-backed certifier.
3. Signature-bound witness identity and key status.
4. Authority epoch seals and durable certificate records.
5. Runtime/Axis adoption and live restart tests.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v101-pruning-tombstone-store-head-witness-quorum-topology-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 tests skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code and ledger files found no matches.

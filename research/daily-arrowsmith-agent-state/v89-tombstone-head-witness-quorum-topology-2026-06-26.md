# v89 Tombstone-Head Witness Quorum Topology

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v88-durable-tombstone-head-witness-ledger-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ36 - What tombstone-head witness authority topology and quorum rule prevents a single observer from unilaterally defining tombstone currentness?

Answer: tombstone-store head currentness must be certified against a replayed witness-authority topology, not inferred from any single accepted observer row. v89 adds a pruning tombstone-head witness authority-transition chain, topology replay that projects eligible witness principals and quorum thresholds, and a tombstone-head quorum certificate evaluator that counts only accepted witness observations from replay-eligible principals. With a topology requiring two witnesses, one accepted observer can produce only a non-certified witnessed state; certification requires enough eligible observers to have admitted the same tombstone head.

Implemented slice:

- Added pruning tombstone-head witness authority-transition, principal, topology, issue, policy, and quorum certificate types.
- Added builders and deterministic hashes for tombstone-head witness authority transitions and quorum certificates.
- Added topology replay over hash-linked authority transitions with contiguous sequence and previous-hash validation.
- Added quorum-certificate evaluation over replayed tombstone-head witness ledgers and replayed witness topology.
- Added tests proving a two-witness topology certifies a head only after both eligible observers accept it, and that an observer outside the topology cannot satisfy quorum.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Agreement depends on quorum-sized sets of replicas and replayable protocol phases, not one process' private state. | Tombstone currentness is certified only when enough eligible witnesses attest the same head. |
| Malkhi and Reiter 1998, "Byzantine Quorum Systems" ([Springer](https://link.springer.com/article/10.1007/s004460050050), [PDF](https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf)) | Quorum systems use set topology and intersection requirements to preserve consistency despite faulty participants. | Witness eligibility and quorum thresholds are replayed authority state, not adapter-supplied lists. |
| Chuat et al. 2015, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs" ([arXiv](https://arxiv.org/abs/1511.01514), [PDF](https://netsec.ethz.ch/publications/papers/gossip2015.pdf)) | Log-head consistency requires clients to compare observed heads and surface split views. | Tombstone-head witness replay supplies the observed-head evidence that quorum certification consumes. |
| Kogias et al. 2016, "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing" ([PDF](https://bford.info/pub/dec/byzcoin.pdf)) | Collective signing compacts agreement from a configured group of witnesses into a public certificate. | The substrate quorum certificate binds a tombstone head to accepted witness ids and a replayed authority topology hash. |

## 3. Existing Substrate Map Delta

Already present before v89:

1. v86 recorded physical pruning as hash-linked tombstone transitions.
2. v87 made pruned-store continuity depend on an exact tombstone-store head.
3. v88 made that required tombstone head recoverable from a durable tombstone-head witness ledger.
4. Settlement-store heads already had a witness quorum topology, but pruning tombstone heads did not.

Newly strengthened by v89:

1. Pruning tombstone-head witness authority is now a replayed transition chain.
2. Eligible tombstone-head witnesses are projected from admitted, suspended, revoked, or equivocated principal status.
3. Tombstone-head quorum thresholds are part of replayed authority state.
4. Tombstone-head quorum certificates count only replay-accepted witness observations for the target head.
5. Unauthorized witness observations are retained as replay evidence but cannot satisfy certification.
6. A single eligible witness can produce a witnessed, non-certified state when topology requires more witnesses.
7. The quorum certificate records its authority boundary and topology hash so consumers can distinguish certified currentness from observed currentness.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable tombstone-head witness authority-transition stores.
2. Durable tombstone-head quorum-certificate proof records.
3. Signature-bound tombstone-head witness identity.
4. Tombstone-head authority epoch seals for non-retroactive historical certification.
5. Tombstone-head witness key status and rotation semantics.
6. Tombstone-head quorum certificate adoption in pruned-store continuity and runtime recovery paths.
7. Tombstone-head consistency proof compression that avoids replaying full tombstone history.
8. Cross-agent gossip/monitoring beyond shared durable storage.
9. Postgres integration tests for topology-backed tombstone-head recovery after actual pruning.
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
10. SQ37: What durable tombstone-head witness authority-transition store makes quorum topology recoverable after restart instead of supplied by adapters?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Head Witness Authority Topology and Quorum Certificate.

Problem it solves: v88 made a tombstone head recoverable from durable witness records, but one accepted observer could still become the currentness source if consumers accepted the latest witnessed head without a topology or quorum rule.

Research source: Byzantine quorum systems, PBFT quorum certificates, CT gossip consistency checks, and collective signing.

Mechanism borrowed or adapted: define a replayed membership topology, count only eligible witness observations, and classify a head as provisional, witnessed, certified, or obstructed based on quorum evidence and conflicts.

Why current substrate lacked it: pruning tombstone-head witnesses had durable observations but no replayed authority set or threshold.

Why existing primitives are insufficient: settlement-head quorum topology solved the same class for settlement-store heads, but tombstone-store pruning has a separate head, separate witness ledger, and separate continuity consequence.

State guarantee it should create: a tombstone-store head can become certified currentness only through admitted topology plus enough accepted witness observations for that exact head.

Admission rule it requires: a quorum certificate may count a witness only if the tombstone-head witness ledger replays validly, the witness accepted the target head, and replayed topology marks that witness eligible at the tombstone sequence.

Replay rule it requires: replay authority transitions by contiguous sequence and previous-authority hash, validate transition hashes and quorum thresholds, project eligible principals, then evaluate witness records against that topology.

Authority boundary it requires: tombstone-head currentness certification is constituted by replayed authority transitions plus replayed witness observations, not by one observer, adapter memory, local snapshot, or conversation summary.

Failure modes it should prevent:

- a single observer certifying tombstone currentness under a multi-witness topology;
- a non-member observer satisfying quorum;
- a revoked, suspended, or equivocated witness satisfying quorum;
- a topology mismatch silently changing the certification threshold;
- a replay-invalid witness ledger satisfying quorum;
- a conflicting same-sequence tombstone head becoming certified.

Minimal implementation slice:

- Add tombstone-head witness authority-transition and topology replay contracts.
- Add tombstone-head witness quorum certificate evaluation.
- Add deterministic hashing for authority transitions and quorum certificates.
- Add focused tests for two-witness certification and one-witness non-certification under replayed topology.

Tests that would falsify it:

- A head is `certified` when accepted by only one eligible witness but topology requires two.
- An observer outside topology is counted toward quorum.
- A replay-invalid witness ledger can produce a certified head.
- A conflicting accepted same-sequence head does not obstruct quorum certification.
- Tampering with authority transition sequence, hash, or previous hash does not invalidate topology replay.

Axis surfaces that could later validate it:

- Axis C can restart after pruning and require topology-certified tombstone heads for pruned-store recovery.
- Axis A can require finance recovery to reject a pruned projection when only one tombstone-head observer has attested the tombstone head.
- Axis B can prove a domain adapter cannot supply a synthetic single-observer tombstone currentness claim.

## 7. Falsification Criteria Applied Before Verification

1. A replayed topology with two eligible witnesses and required quorum two certifies the tombstone head only after both eligible witnesses accepted it.
2. The same witness replay under a topology admitting only one of the two observers remains non-certified and reports the other observer as unauthorized.
3. The quorum certificate preserves a distinct `authorityBoundary` for pruning tombstone-head witness quorum.
4. Focused agent-state tests continue to prove prior v88 fork, unproved-advance, replay-derived required-head, and tamper-obstruction behavior.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A replayed latest tombstone-head witness is enough currentness authority. | Rejected. | v89 requires topology and quorum before the head is certified. |
| Any accepted observer row can count equally toward tombstone-head certification. | Rejected. | v89 counts only observer ids eligible in replayed authority topology. |
| Tombstone-head quorum topology can stay adapter-supplied indefinitely. | Not yet. | SQ37 remains open for durable authority-transition storage. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition`.
- Pruning tombstone-head witness topology replay.
- Pruning tombstone-head witness quorum certificate evaluation and hashing.
- Focused tests proving topology-backed two-witness certification and single-authorized-witness non-certification.

Remaining frontier:

1. Durable tombstone-head witness authority-transition stores.
2. Store-backed tombstone-head quorum certification.
3. Durable tombstone-head quorum-certificate records.
4. Signature-bound tombstone-head witness identity.
5. Runtime and Axis adoption of quorum-certified tombstone heads.

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

This proves the pure tombstone-head witness topology and quorum-certificate evaluator in focused agent-state tests and preserves the broader checked package frontier. It does not yet prove durable tombstone-head authority stores, store-backed quorum certification, signature-bound tombstone-head witness identity, quorum-certificate records, runtime adoption, or Axis A/B/C adoption; those remain SQ37/frontier work.

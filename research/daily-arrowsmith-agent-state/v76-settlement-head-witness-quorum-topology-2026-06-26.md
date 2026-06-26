# v76 Settlement Head Witness Quorum Topology

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v75-durable-settlement-head-witness-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ23 - What quorum/topology policy decides which settlement-head witnesses are eligible and how many independent head observations are required before a head can authorize writes?

Answer: a durable settlement-head observation is still only a vote. It becomes write-grade authority only when a replayed head-witness topology admits the observer principal and a quorum certificate over replayed head-witness records reaches the required threshold for the target settlement-store head. A single process, a single witness, or a non-member observer cannot make the head operational authority.

Implemented slice:

- Added settlement-head witness authority transitions with `effectiveFromSettlementSequence`.
- Added topology replay for eligible settlement-head witness principals, quorum threshold, suspension/revocation/equivocation, hash chaining, and transition hash verification.
- Added a settlement-head witness quorum certificate evaluator over replayed head-witness records.
- Added capability-kit resolver support for requiring a structural settlement-head witness quorum certificate before settled-root verification.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([USENIX](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance), [PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Fault-tolerant commitment requires quorum agreement, not an individual replica vote. | A settlement-store head needs a quorum certificate over eligible witness observations before strict write authority can use it. |
| Yin et al. 2019, "HotStuff: BFT Consensus in the Lens of Blockchain" ([arXiv PDF](https://arxiv.org/pdf/1803.05069)) | Quorum certificates are proof objects formed from enough votes and carried into later safety decisions. | The head-witness quorum certificate is a substrate proof object separate from raw head-witness records. |
| Nikitin et al. 2017, "CHAINIAC" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin)) | Independent witness servers collectively verify and sign updates before clients accept them. | Settlement-head witnesses are replayed eligible principals; non-members and equivocated witnesses do not count. |
| Kokoris-Kogias et al. 2016, "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing" ([arXiv](https://arxiv.org/abs/1602.06997), [PDF](https://bford.info/pub/dec/byzcoin.pdf)) | Collective signing turns distributed votes into an efficient commitment artifact. | The quorum certificate turns multiple head observations into one authority boundary for mutation. |

## 3. Existing Substrate Map Delta

Already present before v76:

1. Settlement-head observations can be durable and replayed after restart.
2. Individual head witnesses reject missing proofs, stale heads, forked heads, and tampered decisions.
3. Capability-kit can bind an accepted witnessed head into settlement currentness.

Newly strengthened by v76:

1. Settlement-head witness principals are admitted, suspended, revoked, or marked equivocated through hash-linked replayed topology transitions.
2. Topology replay is scoped to settlement-store head sequence, not replay-root sequence.
3. A quorum certificate counts distinct accepted records for the target head only when their observer ids are eligible under topology.
4. Capability-kit can require the quorum certificate before returning graph write authority.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable Postgres store for settlement-head witness authority transitions.
2. Cryptographic witness identities and signatures for head-witness observations and quorum certificates.
3. Durable quorum-certificate records, not only pure recomputation.
4. Domain compiler support for declaring which capabilities require head quorum certificates.
5. Gossip transport for exchanging head observations and topology updates without one shared store.
6. Concurrency tests for simultaneous head observations and topology changes.
7. Recovery-kernel composition that rehydrates latest head quorum certificates for all open scopes.
8. Monitor proof that every strict write used the configured head quorum certificate.
9. Axis A/C runner adoption with durable head witness topology.
10. External target-side finality after graph/capability mutation.

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
10. SQ24: What durable store and admission boundary persists settlement-head witness authority transitions or quorum certificates so adapters cannot supply synthetic topology?

## 6. Primitive Proposal Ledger

Name: Settlement Head Witness Quorum Certificate.

Problem it solves: v75 made settlement-head observations durable, but any accepted single observation could still be treated as enough authority unless a separate topology/quorum rule existed.

Research source: PBFT quorum commitment, HotStuff quorum certificates, CHAINIAC witness servers, and ByzCoin collective signing.

Mechanism borrowed or adapted: convert individual witness observations into a quorum certificate only when replayed eligible principals reach a declared threshold.

Why current substrate lacked it: the head witness had per-observation replay, but no distinct authority topology for head witnesses and no write-boundary hook requiring threshold certification.

Why existing primitives were insufficient: root-witness topology is scoped to replay-root settlement. Settlement-store heads are a currentness surface with their own settlement-sequence axis and observer principals.

State guarantee it should create: when configured, a settlement-store head cannot authorize mutation unless replayed head-witness records show enough eligible, distinct witness principals accepted that exact head.

Admission rule it requires: capability-kit must reject write authority when the head witness accepts a head but the head quorum certificate is not `certified`.

Replay rule it requires: topology transitions replay by tenant, authority sequence, previous hash, transition hash, and effective settlement sequence; quorum certificates replay from verified head-witness records.

Authority boundary it requires: head-currentness authority is not the settlement store's answer, not one observer, and not adapter memory; it is the replayed quorum certificate over eligible witnesses.

Failure modes it should prevent:

- a single accepted head observation authorizing strict writes under a multi-witness policy;
- non-member observers counting toward head quorum;
- revoked, suspended, or equivocated witnesses counting toward head quorum;
- tampered topology transitions replaying as valid;
- capability-kit binding a head into currentness after quorum failure.

Minimal implementation slice:

- Add head-witness authority transition and topology replay types/functions.
- Add head-witness quorum certificate evaluation over replayed head-witness records.
- Add focused tests for certified quorum, non-member exclusion, equivocated witness exclusion, and invalid topology obstruction.
- Add capability-kit structural quorum hook and tests for allow/block behavior.

Tests that would falsify it:

- A non-member observer counts toward a required two-witness head quorum.
- An equivocated head-witness principal counts toward quorum.
- A tampered topology transition replays as valid.
- Capability-kit continues to settled-root verification when the configured head quorum certificate is not certified.

Axis surfaces that could later validate it:

- Axis C can simulate an amnesiac agent with one stale local witness versus two durable eligible witnesses.
- Axis A can require ArrowHedge strict graph writes to pass head quorum certification.
- Axis B can apply the same topology once accepted marketing/profile fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. Two eligible observers certify a target settlement-store head under a two-witness topology.
2. A non-member observer is excluded and cannot satisfy the quorum.
3. An equivocated witness principal is excluded and cannot satisfy the quorum.
4. Tampered head-witness topology obstructs the quorum certificate.
5. Capability-kit rejects write authority when head quorum is not certified.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A durable accepted head observation is enough currentness authority. | Falsified. | v76 requires eligible witness quorum certification when configured. |
| Root-witness topology can be reused for settlement-store heads. | Rejected. | v76 adds settlement-sequence-scoped head-witness topology because store-head currentness is not root settlement. |
| Capability-kit only needs individual head witness acceptance. | Falsified under strict policy. | v76 adds a structural quorum hook that blocks before settled-root verification when quorum is not certified. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition`.
- `replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions()`.
- `evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificate()`.
- Capability-kit `projectionReplayRootSettlementStoreHeadWitnessQuorum` resolver option.
- Focused tests and broad authority/replay verification.

Remaining frontier:

1. Durable head-witness authority-transition store and migration.
2. Durable quorum-certificate records.
3. Cryptographic principals/signatures.
4. Domain compiler adoption.
5. Runner/axis adoption.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/capability-kit typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm exec vitest run packages/capability-kit/src/workflow-authority.test.ts
pnpm exec vitest run packages/agent-state/src/index.test.ts packages/capability-kit/src/workflow-authority.test.ts
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/graph/src/write-authority.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/evals/src/persistence/persistence.test.ts
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused `@pm/capability-kit` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 63 tests; `packages/capability-kit/src/workflow-authority.test.ts` 21 tests.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 467 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves settlement-head witness topology and quorum certification as substrate logic and proves capability-kit can enforce it before write authority. It does not yet prove durable storage for the head-witness topology, signed witness identities, durable quorum-certificate records, or end-to-end Axis A/B/C adoption.

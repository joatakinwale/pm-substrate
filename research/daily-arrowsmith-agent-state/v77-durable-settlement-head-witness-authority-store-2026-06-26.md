# v77 Durable Settlement Head Witness Authority Store

Date: 2026-06-26
Status: existing substrate mechanism strengthened; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v76-settlement-head-witness-quorum-topology-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ24 - What durable store and admission boundary persists settlement-head witness authority transitions or quorum certificates so adapters cannot supply synthetic topology?

Answer: settlement-head quorum authority cannot depend on a resolver-supplied topology object. The topology must be recovered from an append-only authority-transition store, then composed with the replayed settlement-head witness ledger to produce the quorum certificate. This makes an amnesiac agent able to certify the current settlement-store head from admitted history without trusting adapter memory, conversation summaries, or connector-local configuration.

Implemented slice:

- Added settlement-head witness authority transition store contracts.
- Added in-memory and Postgres-backed settlement-head witness authority transition stores.
- Added a store-backed settlement-head witness quorum certifier that replays authority transitions and witness records internally.
- Added migration `0029_agent_state_projection_replay_settlement_head_witness_authority.sql`.
- Added `certified` as a first-class quorum-certificate field so the pure certificate can satisfy strict capability-kit quorum hooks directly.
- Added focused tests for restart replay and tampered durable topology obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf)) | Membership/configuration changes are represented as log entries; safety comes from replaying the committed log rather than trusting a node's current configuration claim. | Head-witness topology changes are authority-transition records in a store; certification replays those records for the target settlement sequence. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([ACM](https://dl.acm.org/doi/10.1145/128765.128770), [PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery authority comes from write-ahead log history and repeating history, not from private volatile state after restart. | An amnesiac certifier rebuilds head-quorum authority from stored transition history and witness records. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident), [PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Append-only, hash-structured logs let clients detect tampering or inconsistent history. | Stored head-witness authority transitions are hash-linked; tampering the returned history causes topology replay failure and quorum obstruction. |

## 3. Existing Substrate Map Delta

Already present before v77:

1. Settlement-head witnesses can persist and replay accepted head observations.
2. Settlement-head witness topology can be replayed from hash-linked transition values.
3. Quorum certificates can count only eligible, distinct, non-equivocated head witnesses.
4. Capability-kit can require a certified head quorum before settled-root verification.

Newly strengthened by v77:

1. Settlement-head witness authority transitions can be appended through a substrate-owned store rather than built as private in-memory arrays.
2. Postgres can persist the topology authority ledger with tenant/sequence primary keys, transition ids, authority hashes, and previous-hash chaining.
3. A store-backed certifier reconstructs topology from the authority store and witness replay from the witness ledger, then evaluates the quorum certificate.
4. A strict caller can consume one certificate object with `certified: true | false`, without separately trusting a topology object from an adapter.

## 4. Missing Substrate Map Delta

Still missing:

1. Non-retroactive authority epochs so later topology edits cannot rewrite the eligibility basis of already certified heads.
2. Durable quorum-certificate records and finality markers, not only recomputation from current transition replay.
3. Cryptographic witness identities and signatures for observations, authority transitions, and quorum certificates.
4. Concurrency tests for simultaneous authority-transition appends.
5. A monitor proof that every strict write used the store-backed head-quorum certifier.
6. Domain compiler support for declaring head-quorum requirements without handwritten resolver wiring.
7. Gossip or replication transport for head-witness authority transitions outside one shared Postgres store.
8. Recovery-kernel composition that can rehydrate latest certified settlement heads for every open scope.
9. Axis A/C runner adoption with durable head-witness topology.
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
10. SQ25: What non-retroactive authority-epoch or quorum-certificate finality rule prevents later witness-topology transitions from rewriting the eligibility basis of an already certified settlement-store head?

## 6. Primitive Proposal Ledger

Name: Durable Settlement Head Witness Authority Store.

Problem it solves: v76 made head quorum topology replayable, but callers could still supply the topology as a synthetic object. That left a path where private adapter memory could decide which head witnesses were eligible.

Research source: Raft membership-change log entries, ARIES log-based recovery, and tamper-evident append-only logging.

Mechanism borrowed or adapted: store topology changes as append-only authority transitions, replay the stored history at certification time, and treat hash-chain failure as an obstruction.

Why current substrate lacked it: settlement-head witness observations were durable, but their authority topology had only pure replay functions and helper-built transition arrays.

Why existing primitives were insufficient: root-witness authority stores are scoped to certificate-store roots, not settlement-store heads; head currentness has its own settlement-sequence surface and witness principals.

State guarantee it should create: a settlement-store head quorum certificate cannot be certified from private witness lists, adapter-local config, connector cache, or conversation memory; it must be derived from stored authority transitions plus replayed witness records.

Admission rule it requires: strict write admission must reject head-currentness authority unless the quorum certificate is produced from a replayed authority-transition store and has `certified: true`.

Replay rule it requires: list authority transitions by tenant in authority-sequence order, verify tenant, contiguous sequence, previous hash, transition hash, and effective settlement sequence, then replay witness records for the same tenant.

Authority boundary it requires: head-witness membership, quorum thresholds, suspension, revocation, and equivocation are state transitions owned by the substrate store, not by workflow adapters, tools, or agents.

Failure modes it should prevent:

- an adapter declaring an eligible head-witness list from memory;
- an amnesiac agent accepting a topology summary without transition history;
- tampered authority-transition bodies replaying as valid;
- process restart losing the prior head-witness topology;
- strict write authority consuming a quorum certificate that cannot be replayed from stored authority history.

Minimal implementation slice:

- Add authority transition append/list store interfaces.
- Add in-memory and Postgres store implementations.
- Add migration `0029` for durable head-witness authority transitions.
- Add a store-backed quorum certifier that composes authority-store replay and witness-ledger replay.
- Add restart and tamper-obstruction tests.

Tests that would falsify it:

- A store-backed certifier certifies a head without stored quorum/admission transitions.
- A tampered stored transition body still produces a certified quorum.
- Restarted authority transition listing loses the previous-hash chain.
- The produced certificate cannot satisfy strict capability-kit quorum hooks.

Axis surfaces that could later validate it:

- Axis C can simulate agent restart with no conversation state and require store-backed head-quorum recovery.
- Axis A can require ArrowHedge strict graph writes to use durable head-witness authority stores.
- Axis B can attach the same store-backed topology once accepted marketing/domain fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A restarted certifier can certify a target settlement-store head using only the durable authority transition store and head-witness ledger.
2. Stored transitions preserve contiguous authority sequence and previous-authority-hash chaining.
3. A tampered returned transition history obstructs certification.
4. The certificate exposes `certified: true` only for certified status and `certified: false` for obstructed status.
5. Capability-kit's existing strict quorum hook remains type-compatible with the certificate.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Pure replayable topology is enough if tests build the transition array. | Falsified. | v77 adds store-owned transition append/list and a store-backed certifier so adapters cannot supply synthetic topology. |
| Durable head-witness observations imply durable head-witness authority. | Falsified. | v77 stores authority transitions separately from observation records. |
| Quorum certificates can omit an explicit boolean certification field. | Rejected at package boundary. | v77 adds `certified` so strict structural hooks can consume the pure certificate without interpreting status strings. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionAppendInput`.
- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore`.
- `InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore`.
- `PostgresProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore`.
- `StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier`.
- Migration `0029_agent_state_projection_replay_settlement_head_witness_authority.sql`.
- Store-backed restart and tamper-obstruction tests.

Remaining frontier:

1. Non-retroactive authority epochs / certificate finality for historical head quorums.
2. Durable quorum-certificate records.
3. Cryptographic witness identities and signatures.
4. Domain compiler adoption.
5. Runtime monitor proof that every strict write used store-backed head-quorum certification.
6. Runner/axis adoption.

## 10. Proof Status

Commands run:

```bash
git fetch origin main
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm --filter @pm/capability-kit typecheck
pnpm exec vitest run packages/capability-kit/src/workflow-authority.test.ts
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/graph/src/write-authority.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/evals/src/persistence/persistence.test.ts
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused `@pm/capability-kit` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 65 tests; `packages/capability-kit/src/workflow-authority.test.ts` 21 tests.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 469 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves durable settlement-head witness authority transitions and store-backed quorum certification as substrate logic. It does not yet prove non-retroactive topology epochs, durable quorum-certificate finality, signed witness identity, runtime monitor coverage, or end-to-end Axis A/B/C adoption.

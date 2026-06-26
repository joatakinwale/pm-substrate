# v75 Durable Settlement Head Witness Store

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v74-settlement-store-head-witness-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ22 - What durable cross-agent settlement-head witness store or gossip protocol makes settlement-head observations survive process restart and independent agent comparison?

Answer: settlement-head witness observations need their own append-only durable ledger, separate from process memory and separate from the settlement store being witnessed. The smallest useful substrate slice is a tenant-scoped Postgres witness ledger that stores every observed settlement-store head, witness decision, consistency proof, accepted/obstructed status, previous observation hash, and observation hash. A fresh agent can replay the same ledger and reject an old head once another agent has witnessed a newer head.

Implemented slice:

- Added `PostgresProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger`.
- Added migration `0028_agent_state_projection_replay_settlement_head_witness.sql`.
- Added row mapping for durable settlement-head witness records.
- Added a cross-agent shared-ledger test: agent A witnesses head 1 and head 2; fresh agent B observes head 1 and gets a replay-derived regression obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Chuat, Szalachowski, Perrig, Laurie, and Messeri 2015, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs" ([arXiv](https://arxiv.org/abs/1511.01514)) | Clients exchange compact log-head consistency evidence so split-view logs become detectable. | Settlement-head observations must be written to a shared replay source so independent agents can compare heads instead of trusting isolated memory. |
| Chun, Maniatis, Shenker, and Kubiatowicz 2007, "Attested Append-Only Memory" ([ACM](https://dl.acm.org/doi/10.1145/1323293.1294280), [Google Research](https://research.google/pubs/attested-append-only-memory-making-adversaries-stick-to-their-word/)) | A minimal append-only abstraction makes a party accountable to prior statements. | The head-witness ledger makes each agent/store-head observation chained and replayable; later witnesses cannot forget prior accepted heads. |
| Nikitin et al. 2017, "CHAINIAC" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin)) | Collectively signed skipchains turn release history into transparent, independently verifiable state. | The durable witness ledger is the storage precondition for future head-witness quorum/topology policy. |
| Haeberlen, Aditya, Rodrigues, and Druschel 2010, "Accountable Virtual Machines" ([USENIX](https://www.usenix.org/conference/osdi10/accountable-virtual-machines)) | Execution becomes auditable when enough non-repudiable log data exists for later replay. | Agent resume should replay head-witness records from durable storage rather than trusting conversation continuity. |

## 3. Existing Substrate Map Delta

Mechanisms already present after v74:

1. Settlement stores derive a head from replayed settlement records.
2. Head witnesses reject missing proofs, regressions, forks, and tampered replay decisions.
3. Capability-kit can bind an accepted witnessed head into settled-root currentness policy.
4. Head-witness records are hash-linked and replayable.

Newly strengthened by v75:

1. Settlement-head witness records can be stored in Postgres under `agent_state.projection_replay_settlement_head_witness_observations`.
2. The durable ledger assigns the next tenant-scoped witness sequence from the latest stored observation.
3. A process with no witness memory can replay prior accepted heads from the ledger.
4. Independent agents sharing the ledger see each other's prior head observations and cannot regress to stale heads.

## 4. Missing Substrate Map Delta

Still missing:

1. Settlement-head witness quorum/topology policy: which head witnesses count, and how many independent observations are required before a head can authorize mutation?
2. Gossip transport for exchanging settlement-head observations without one shared Postgres store.
3. Cryptographic signatures for settlement-head witness observations.
4. Serializable append isolation tests for concurrent Postgres head observations.
5. A recovery kernel that enumerates all operational scopes and rehydrates the latest replay roots, settlements, and witnessed heads from durable ledgers.
6. Domain authority compiler support for declaring head-witness requirements per capability/profile.
7. Monitor proof that every strict write used a durable head witness, not only an in-memory witness.
8. Axis A/C runner adoption with durable Postgres settlement-head witnesses.
9. External target-side finality after graph/capability mutation.
10. Store-head witness revocation/eligibility epochs for agents that should no longer be trusted as witnesses.

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
10. SQ23: What quorum/topology policy decides which settlement-head witnesses are eligible and how many independent head observations are required before a head can authorize writes?

## 6. Primitive Proposal Ledger

Name: Durable Settlement Head Witness Ledger.

Problem it solves: v74 head witnessing could reject stale or forked settlement heads, but only if the witness history survived in process memory or an in-memory ledger supplied by the caller.

Research source: certificate-transparency gossip, attested append-only memory, CHAINIAC collectively witnessed skipchains, and accountable virtual-machine replay logs.

Mechanism borrowed or adapted: make every head observation an append-only, hash-linked, replayable record in shared durable storage.

Why current substrate lacked it: `LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness` depended on a ledger interface, but only an in-memory implementation existed.

Why existing primitives were insufficient: settlement records are durable, but they are the thing being witnessed. A separate durable head-witness ledger is needed so a store cannot make an amnesiac caller accept an older visible prefix.

State guarantee it should create: an amnesiac or fresh agent using the durable witness ledger reconstructs the same accepted settlement heads and obstructions as prior agents, so private memory cannot be the only source of head currentness.

Admission rule it requires: append a head-witness record only after recomputing the decision from replayed prior witness records and the submitted observation/proof.

Replay rule it requires: replay must verify tenant continuity, contiguous witness sequence, previous-observation hash, observation hash, and deterministic decision recomputation.

Authority boundary it requires: settlement-head currentness is not supplied by the settlement store, caller memory, or agent summary; it is supplied by replayed head-witness records.

Failure modes it should prevent:

- a fresh agent accepting a stale head after another agent witnessed a newer one;
- process restart erasing the latest witnessed settlement head;
- caller-supplied in-memory ledgers hiding prior head obstructions;
- tampered witness decisions replaying as valid;
- a valid old settlement prefix outranking durable head-observation history.

Minimal implementation slice:

- Add a Postgres-backed head-witness ledger.
- Add SQL migration for durable head-witness observations.
- Add row conversion and list/append APIs.
- Add a shared-ledger cross-agent replay test.

Tests that would falsify it:

- A fresh agent sharing the ledger accepts head N after another agent has witnessed head N+1.
- Stored records replay with a sequence gap or previous-hash break.
- A tampered stored decision replays as valid.
- Postgres append/list changes the canonical record hash.

Axis surfaces that could later validate it:

- Axis C amnesiac resume against stale settlement-store prefixes.
- Axis A strict ArrowHedge graph/capability writes with durable head-witness recovery.
- Axis B publication/profile writes once authoritative fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A fresh ledger-backed agent must reject an old settlement head after a prior agent witnessed a newer head in the shared ledger.
2. Replay over the resulting shared ledger must remain valid and preserve the newer latest head.
3. The new Postgres ledger must typecheck against the existing witness-ledger interface.
4. The durable schema must persist the full observation, decision, consistency proof, status, previous hash, observation hash, and record time.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A replayable in-memory head-witness ledger is enough for recovery. | Falsified. | v75 adds Postgres storage because process restart and independent agents need the same witnessed-head history. |
| Settlement-store durability alone can prove currentness to an amnesiac agent. | Still false. | The settlement store is the observed object; a separate witness ledger is needed to remember which heads were seen. |
| Shared storage fully replaces head gossip/quorum. | Rejected. | v75 closes durable shared storage, but SQ23 keeps witness eligibility/quorum open. |

## 9. Implementation Frontier

Implemented now:

- `PostgresProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger`.
- Migration `0028_agent_state_projection_replay_settlement_head_witness.sql`.
- Cross-agent shared-ledger regression test.
- Full workspace typecheck and broad authority/replay test slice.

Remaining frontier:

1. Settlement-head witness quorum/topology.
2. Distributed gossip exchange for settlement-head observations.
3. Cryptographic witness signatures.
4. Concurrent Postgres append isolation tests.
5. End-to-end runner adoption with durable head witnesses.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm test -- --run packages/agent-state/src/index.test.ts packages/graph/src/write-authority.test.ts packages/capability-kit/src/workflow-authority.test.ts packages/capability-kit/src/write-authority.test.ts packages/evals/src/persistence/persistence.test.ts
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 59 tests.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 462 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves durable/shared settlement-head witness storage at the substrate package boundary and proves fresh-agent comparison through a shared ledger. It does not yet prove decentralized gossip, witness quorum/topology, cryptographic signatures, concurrent DB isolation, or end-to-end Axis A/B/C adoption.

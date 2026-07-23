# v78 Settlement Head Authority Epoch Seal

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad authority test slice passed
Parent: `research/daily-arrowsmith-agent-state/v77-durable-settlement-head-witness-authority-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ25 - What non-retroactive authority-epoch or quorum-certificate finality rule prevents later witness-topology transitions from rewriting the eligibility basis of an already certified settlement-store head?

Answer: a certified settlement-store head needs an authority-epoch seal in the same replayable head-witness authority transition history. The seal records the highest settlement sequence finalized, the effective authority-topology hash that certified it, and the quorum-certificate hash. After a seal, normal authority transitions cannot take effect at or before the sealed settlement sequence. If a bad store returns such a retroactive transition anyway, topology replay becomes invalid and the store-backed quorum certifier obstructs write authority.

Implemented slice:

- Added `seal_authority_epoch` to settlement-head witness authority transitions.
- Added seal fields to transition inputs, transition records, Postgres row mapping, and migration `0029`.
- Added replay validation for epoch seals and retroactive transitions after a seal.
- Added `effectiveAuthorityHash`, `sealedThroughSettlementSequence`, and `authorityEpochSeals` to replayed head-witness authority topology.
- Changed quorum certificates to bind `authorityTopologyHash` to the effective topology hash for the target head, not a later/future authority-chain tip.
- Added store append rejection for retroactive non-seal transitions after a sealed settlement epoch.
- Added falsification tests for normal sealing, future-effective topology changes, stable recertification, and tampered retroactive history obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Lamport, Malkhi, and Zhou 2010, "Reconfiguring a State Machine" ([PDF](https://lamport.azurewebsites.net/pubs/reconfiguration-tutorial.pdf)) | State-machine outputs need irrevocability; reconfiguration commands take effect at defined command positions rather than rewriting already emitted outputs. | A head-witness authority seal fixes the topology basis through a settlement sequence and forbids later effective transitions inside that sealed range. |
| Lamport, Malkhi, and Zhou 2009, "Vertical Paxos and Primary-Backup Replication" ([PDF](https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf)) | Reconfiguration is mediated by a configuration master; choices for a ballot/configuration become fixed, and later leaders respect prior configuration information. | The authority transition log acts as the configuration master for head-witness topology; the epoch seal is the fixed choice that later transitions cannot reinterpret. |
| Birman and Joseph 1987, "Exploiting Virtual Synchrony in Distributed Systems" ([PDF](https://www.cs.cornell.edu/home/rvr/sys/p123-birman.pdf)) | Membership changes form view boundaries; requests before a join are processed by the old view and later requests by the new view. | A sealed settlement-head authority epoch is a view boundary between already certified head authority and future topology changes. |
| Yin et al. 2019, "HotStuff: BFT Consensus in the Lens of Blockchain" ([arXiv PDF](https://arxiv.org/pdf/1803.05069)) | Quorum certificates carry enough votes as proof objects and guide safe later decisions. | The seal stores the quorum-certificate hash in the authority transition history so later certification can recover the proof boundary. |

## 3. Existing Substrate Map Delta

Already present before v78:

1. Settlement-head witness observations can be stored and replayed.
2. Head-witness authority topology can be stored and replayed from durable transitions.
3. Store-backed quorum certification can derive topology and witness replay without adapter-supplied topology.

Newly strengthened by v78:

1. Certified head authority can now be sealed through a settlement sequence.
2. Replay detects and rejects any later non-seal authority transition whose effective settlement sequence is inside a sealed epoch.
3. The store append path rejects retroactive topology mutations after a seal under normal operation.
4. Future-effective authority transitions remain allowed and do not change the old head's effective topology hash.
5. A tampered store that returns retroactive history cannot produce a certified quorum certificate.

## 4. Missing Substrate Map Delta

Still missing:

1. Cryptographic witness identities and signatures for observations, authority transitions, epoch seals, and quorum certificates.
2. Dedicated durable quorum-certificate records beyond the seal's certificate hash.
3. Monitor proof that every strict write used the store-backed sealed-epoch certifier.
4. Domain compiler support for declaring sealed head-quorum requirements without handwritten resolver wiring.
5. Concurrency tests for simultaneous seal and authority-transition appends.
6. Gossip or replication transport for authority epoch seals outside one shared Postgres store.
7. Recovery-kernel composition that rehydrates latest sealed head authority for every open scope.
8. Axis A/C runner adoption with sealed durable head-witness topology.
9. External target-side finality after graph/capability mutation.
10. Formal obstruction algebra composition between sealed authority epochs and local-view/projection conflicts.

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
10. SQ26: What signature-bearing witness identity model binds settlement-head observations, quorum certificates, and authority-epoch seals to principals so durable rows cannot impersonate witnesses or finalizers?

## 6. Primitive Proposal Ledger

Name: Settlement Head Witness Authority Epoch Seal.

Problem it solves: durable topology can still be dangerous if later transitions can take effect retroactively and change which witnesses were eligible for an already certified head.

Research source: state-machine reconfiguration irrevocability, Vertical Paxos configuration masters, virtual synchrony view boundaries, and HotStuff quorum certificates.

Mechanism borrowed or adapted: make reconfiguration a replayed transition with an explicit effective boundary, then seal a completed epoch so later configuration changes cannot rewrite prior authority.

Why current substrate lacked it: v77 stored topology transitions but did not distinguish the effective topology basis of an already certified head from later appended topology history.

Why existing primitives were insufficient: a durable transition store only proves what history was returned; it does not, by itself, prevent an appended transition from claiming earlier effect.

State guarantee it should create: after a certified head is sealed, no later head-witness authority transition can become operational for that head's settlement sequence or any earlier sequence.

Admission rule it requires: authority-transition stores must reject non-seal transitions whose `effectiveFromSettlementSequence` is at or before the latest sealed settlement sequence.

Replay rule it requires: replay must validate seals, bind them to the effective authority topology hash and quorum-certificate hash, and mark later retroactive transitions as authority-topology obstructions.

Authority boundary it requires: the authority epoch is sealed by a transition in the head-witness authority log, not by adapter memory, a recomputed local object, or a detached test fixture.

Failure modes it should prevent:

- retroactive witness revocation changing an already certified head;
- future topology changes changing the old head's `authorityTopologyHash`;
- an amnesiac agent recomputing old head authority from the chain tip rather than the effective epoch;
- a tampered store returning a post-seal retroactive transition that still certifies;
- a workflow adapter using later topology to reinterpret historical head authority.

Minimal implementation slice:

- Add the `seal_authority_epoch` transition kind and seal fields.
- Add seal replay and retroactive-transition issue codes.
- Add store append guard for post-seal retroactive transitions.
- Bind certificates to `effectiveAuthorityHash`.
- Add focused tests for seal, future transition, stable recertification, and tampered retroactive history.

Tests that would falsify it:

- A post-seal revocation effective at the sealed head's settlement sequence is appended successfully.
- A future-effective revocation changes the sealed head's quorum-certificate hash.
- A fake store with retroactive post-seal history still produces `certified: true`.
- A seal with missing or mismatched authority topology hash replays as valid.

Axis surfaces that could later validate it:

- Axis C can restart an agent after a sealed head and attempt retroactive topology mutation from memory.
- Axis A can require ArrowHedge strict writes to reference a sealed head authority epoch.
- Axis B can adopt the same sealed epoch primitive once accepted marketing/domain fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A certified head can be sealed with its effective authority topology hash and quorum-certificate hash.
2. A later transition with `effectiveFromSettlementSequence <= sealedThroughSettlementSequence` is rejected by the store.
3. A later transition with a future effective settlement sequence is allowed.
4. Recomputing the sealed head certificate after a future transition preserves the old authority topology hash and quorum-certificate hash.
5. A tampered store returning post-seal retroactive history produces an invalid topology and an obstructed store-backed quorum certificate.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable topology storage prevents retroactive authority changes by itself. | Falsified. | v78 adds an explicit seal because append-only storage alone still allowed later effective dates inside old epochs. |
| The latest authority hash is the right authority topology hash for every head. | Falsified. | v78 adds `effectiveAuthorityHash` and quorum certificates bind to it, so future topology changes do not alter old head authority. |
| Finality can live outside the authority transition log. | Rejected for this substrate layer. | v78 models finality as `seal_authority_epoch`, a replayed authority transition. |

## 9. Implementation Frontier

Implemented now:

- `seal_authority_epoch` head-witness authority transition kind.
- Seal fields on authority transitions and migration `0029`.
- `effectiveAuthorityHash`, `sealedThroughSettlementSequence`, and `authorityEpochSeals` on replayed authority topology.
- Replay issue codes for invalid epoch seals and retroactive transitions.
- Store append rejection for retroactive transitions after a sealed epoch.
- Certificate binding to effective authority topology hash.
- Tests for sealing, future transitions, stable recertification, and tampered retroactive history obstruction.

Remaining frontier:

1. Signature-bearing witness/finalizer identity model.
2. Durable quorum-certificate record store.
3. Concurrency/transaction isolation for simultaneous seal/transition appends.
4. Domain compiler adoption.
5. Runtime monitor proof.
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
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 67 tests; `packages/capability-kit/src/workflow-authority.test.ts` 21 tests.
- Full workspace `pnpm typecheck` passed.
- Broad authority Vitest slice passed: 47 files passed, 471 tests passed, 143 skipped.
- `git diff --check` passed.

Proof boundary:

This proves settlement-head authority epoch sealing as replayable substrate logic and proves retroactive topology edits cannot certify through the store-backed path. It does not yet prove cryptographic principal binding, durable quorum-certificate records, concurrent append isolation, monitor coverage, or end-to-end Axis A/B/C adoption.

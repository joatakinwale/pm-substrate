# v69 Root Witness Settlement

Date: 2026-06-26
Status: new substrate primitive implemented; focused agent-state tests/typecheck passed
Parent: `research/daily-arrowsmith-agent-state/v68-root-witness-ledger-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ16 - What quorum or finality policy decides when a root witnessed by one or more ledgers becomes settled operational authority rather than provisional authority?

Answer: a witnessed root is not settled merely because one witness ledger accepted it. The smallest useful substrate primitive is a replayed witness-settlement evaluator: it classifies a certificate-store root as `provisional`, `witnessed`, `settled`, or `obstructed` from replayed witness ledgers plus an explicit witness threshold. Invalid ledgers cannot count. Duplicate witness ids cannot inflate quorum. A valid independent ledger that accepted a conflicting root at the same store sequence turns settlement into an obstruction.

Implemented slice:

- `ProjectionReplayCertificateStoreRootWitnessSettlementPolicy`.
- `ProjectionReplayCertificateStoreRootWitnessLedgerSnapshot`.
- `ProjectionReplayCertificateStoreRootWitnessSettlement` and settlement issue/status types.
- `evaluateProjectionReplayCertificateStoreRootWitnessSettlement()` in `@pm/agent-state`.
- Deterministic settlement hash for the replayed settlement object.
- Tests for one-witness `witnessed`, two-witness `settled`, valid conflicting-ledger `obstructed`, and tampered-ledger not counted toward quorum.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Syta et al. 2016, "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" ([IEEE S&P program](https://www.ieee-security.org/TC/SP2016/program-papers.html), [arXiv PDF](https://arxiv.org/pdf/1503.08768)) | An authoritative statement should be seen and checked by witnesses before clients accept it. | A replay root can be witnessed without being settled; settlement requires an explicit threshold over replayed witness histories. |
| Nikitin et al. 2017, "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin), [PDF](https://nikirill.com/files/chainiac.pdf)) | Independent witnesses collectively validate release timelines before clients accept updates. | pm-substrate classifies roots through a witness policy instead of trusting one local view of a certificate-store timeline. |
| Kokoris-Kogias et al. 2016, "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing" ([USENIX](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/kogias), [PDF](https://bford.info/pub/dec/byzcoin.pdf)) | Collective signing moves a block from probabilistic observation toward strong commitment. | Settlement is separated from observation: a root becomes settled only when enough valid witnesses agree on the same root. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([USENIX](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance), [PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | State-machine replication tolerates arbitrary faulty replicas only through quorum discipline, not through a single process's memory. | Settlement policy is an explicit quorum boundary; conflicting valid histories are obstructions, not agent choices. |
| Yin et al. 2019, "HotStuff: BFT Consensus in the Lens of Blockchain" ([ACM](https://dl.acm.org/doi/10.1145/3293611.3331591), [arXiv](https://arxiv.org/abs/1803.05069)) | Quorum certificates make agreement evidence compact and replayable across views. | The current implementation is not a full BFT protocol, but it borrows the quorum-certificate shape: replayed witness identities plus one root identity form the settlement proof surface. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Projection replay roots now have a settlement classifier in addition to per-ledger witness acceptance.
2. Settlement is derived from replayed witness ledgers, not from private witness memory.
3. A valid witness ledger that accepted a same-sequence conflicting root produces a settlement obstruction.
4. Invalid or tampered witness ledgers cannot contribute to witness count.
5. Duplicate witness ids cannot inflate quorum.
6. Settlement produces a deterministic hash over the authority-boundary object.

## 4. Missing Substrate Map Delta

Still missing:

1. Witness authority topology: witness ids are raw strings, not registered principals with membership, delegation, revocation, or key material.
2. Quorum membership model: settlement counts configured witness ids but does not yet prove membership in a named witness set.
3. Cryptographic aggregate signatures: settlement records witness ids and replay objects, not signed quorum certificates.
4. Settlement persistence: the settlement object is pure and hashable but not yet stored in a durable settlement ledger.
5. Write-gate adoption: capability and graph write authority can require root witness acceptance, but they do not yet require settled roots.
6. Dynamic witness-set changes: no replayable epoch or membership transition controls which witnesses count for which root.
7. Equivocation handling: a conflicting valid witness ledger obstructs settlement, but there is no revocation or penalty path for the witness.
8. Recovery protocol: the substrate can detect conflict but does not yet reconcile or pick a post-conflict recovery transition.
9. Public dissemination: roots and settlements are not yet published through a gossip/monitor channel.
10. Domain adapter compiler: no domain-level adapter can yet declare which settlement policy its writes require.

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
10. SQ17: What witness-principal authority topology decides which replayed witness ledgers are eligible to count toward settlement, and how are equivocation, revocation, and membership epochs admitted?

## 6. Primitive Proposal Ledger

Name: Projection Replay Certificate Store Root Witness Settlement.

Problem it solves: v68 made witness histories replayable, but a root observed by one witness still had no explicit finality status.

Research source: decentralized witness cosigning, collectively signed update timelines, collective-signing strong consistency, PBFT quorum discipline, and HotStuff quorum-certificate framing.

Mechanism borrowed or adapted: classify a state commitment by replaying independent witness histories and requiring a policy threshold before treating that commitment as settled.

Why current substrate lacked it: `LedgerBackedProjectionReplayCertificateStoreRootWitness` could recover one witness's accepted roots, but no primitive compared multiple witness histories or distinguished observed roots from settled roots.

Why existing primitives were insufficient: certificate-store roots prove store history; root witnesses admit roots; witness ledgers replay the witness timeline. None of those decides when enough independent witnesses agree for a root to become settled operational authority.

State guarantee it should create: A replay root cannot be labeled `settled` unless the required number of valid, non-duplicate witness ledgers replay and accept the exact same tenant/sequence/root hash.

Admission rule it requires: Settlement input must include replayed witness ledgers and an explicit `requiredWitnesses` threshold; invalid ledgers, duplicate witness ids, tenant mismatches, and conflicting same-sequence roots cannot be counted as settlement support.

Replay rule it requires: Each witness ledger must have already passed `replayProjectionReplayCertificateStoreRootWitnessRecords()`; settlement only consumes the replay result and records deterministic settlement status plus hash.

Authority boundary it requires: `@pm/agent-state` owns settlement classification. Databases, domains, connectors, and agents may supply witness records, but they do not decide settlement status by assertion.

Failure modes it should prevent:

- one witness ledger being mistaken for global finality;
- a tampered witness ledger contributing to quorum;
- duplicate witness ids inflating quorum;
- a conflicting valid same-sequence root being ignored because another witness accepted the target root;
- stale or private agent memory labeling a root settled without replayed witness evidence.

Minimal implementation slice:

- Added settlement policy, snapshot, issue, status, and result types.
- Added settlement evaluation over replayed ledgers.
- Added deterministic settlement hashing.
- Added tests for witnessed, settled, obstructed, and invalid-ledger paths.

Tests that would falsify it:

- One valid witness satisfies a two-witness settlement policy.
- A tampered ledger contributes to settlement quorum.
- Two entries with the same `witnessId` count as two witnesses.
- A valid witness ledger that accepted a different root at the same sequence does not obstruct settlement.
- Settlement status depends on input order rather than deterministic sorted witness ids.

Axis surfaces that could later validate it:

- Axis C can run two independent agent monitors and require a two-witness settlement before an operational resume uses a replay root.
- Axis A can require ArrowHedge graph writes to cite a settled replay root rather than a merely witnessed root.
- Axis B can require publication lifecycle roots to settle under a profile-owned witness policy once authoritative fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A one-witness replay under `requiredWitnesses: 2` must be `witnessed`, not `settled`.
2. Two valid independent witness ledgers that accepted the same root must produce `settled`.
3. A valid independent witness ledger that accepted a same-sequence different root must produce `obstructed`.
4. A tampered witness ledger must not count toward quorum.
5. Settlement must expose issues and an allowed action when quorum is missing or conflict exists.
6. Settlement must produce a deterministic hash over the authority-boundary result.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| One replayable witness ledger is enough to call a root settled. | Falsified. | v69 one-witness/two-required test returns `witnessed` plus quorum-not-met issue. |
| Invalid witness histories are harmless if another witness accepted the root. | Refined. | Invalid histories do not automatically obstruct, but they are recorded and cannot count toward quorum. |
| Settlement can be inferred from the latest witnessed root. | Falsified. | Settlement is a separate policy result over witness ledgers and can be `obstructed` by another valid same-sequence root. |
| A full BFT protocol is required before any useful finality primitive can exist. | Rejected. | The substrate now has a pure settlement classifier while leaving network protocol, signatures, and membership epochs open. |

## 9. Implementation Frontier

Implemented now:

- Pure replay-root witness settlement evaluator.
- Settlement issue/status/result types and deterministic hash.
- Focused tests covering quorum, conflict, and tamper cases.

Remaining frontier:

1. Add witness-principal authority topology and membership epochs (SQ17).
2. Persist settlement objects in a durable settlement ledger.
3. Wire settled-root requirements into capability-kit and graph write authority.
4. Add cryptographic or signed witness evidence instead of string-only witness ids.
5. Convert settlement conflicts into the broader obstruction algebra and recovery kernel.
6. Prove one real Axis A or Axis C path refuses merely witnessed roots under a strict settled-root policy.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
```

Result:

- `@pm/agent-state` typecheck passed.
- `packages/agent-state/src/index.test.ts`: 45 tests passed.

Proof boundary:

This proves settlement classification over replayed witness histories, including quorum, conflict, and tamper handling. It does not yet prove a registered witness-principal topology, cryptographic quorum certificates, durable settlement storage, or strict write-gate adoption of settled roots.

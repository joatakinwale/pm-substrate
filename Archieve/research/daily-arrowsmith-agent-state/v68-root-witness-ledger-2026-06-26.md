# v68 Root Witness Ledger

Date: 2026-06-26
Status: new substrate primitive implemented; focused agent-state tests/typecheck passed
Parent: `research/daily-arrowsmith-agent-state/v67-certificate-store-root-witness-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ15 - What durable witness ledger or quorum rule makes root-witness observations themselves replayable across restarts, agents, and independent monitors?

Answer: a root witness cannot be process memory. The smallest useful substrate primitive is a root-witness observation ledger: each observation records the observed root, optional consistency proof, witness decision, witness sequence, previous observation hash, and observation hash. A fresh witness derives its known roots by replaying the ledger and recomputing each decision from the prior accepted observations. If the ledger is tampered, sequence-broken, hash-broken, or decision-forged, replay fails before the witness can authorize a new root.

Implemented slice:

- `ProjectionReplayCertificateStoreRootWitnessRecord` and ledger replay issue types in `@pm/agent-state`.
- Deterministic `buildProjectionReplayCertificateStoreRootWitnessRecord()` and record hashing.
- `replayProjectionReplayCertificateStoreRootWitnessRecords()` recomputes witness decisions and accepted roots from the ledger.
- `ProjectionReplayCertificateStoreRootWitnessLedger` interface.
- `LedgerBackedProjectionReplayCertificateStoreRootWitness` derives witness state from replayed ledger records instead of private memory.
- `InMemoryProjectionReplayCertificateStoreRootWitnessLedger` for deterministic tests.
- `PostgresProjectionReplayCertificateStoreRootWitnessLedger` plus migration `0026_agent_state_projection_replay_root_witness.sql`.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Syta et al. 2016, "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" ([IEEE](https://ieeexplore.ieee.org/document/7546521/), [PDF](https://arxiv.org/pdf/1503.08768)) | Authoritative statements should be validated and witnessed before clients accept them; witnesses check consistency and leave evidence that a statement was seen. | Root observations become ledger records; later witnesses replay the witness history rather than trusting a current process variable. |
| Nikitin et al. 2017, "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin), [PDF](https://nikirill.com/files/chainiac.pdf)) | A collectively witnessed, tamper-proof release log lets out-of-date clients verify an update timeline. | An amnesiac agent verifies the root-witness timeline before using a replay root as operational authority. |
| Kokoris-Kogias et al. 2016, "Enhancing Bitcoin Security and Performance with Strong Consistency via Collective Signing" ([USENIX PDF](https://bford.info/pub/dec/byzcoin.pdf), [arXiv](https://arxiv.org/pdf/1602.06997)) | Collective signing can turn a replicated decision into a strongly verifiable commitment rather than probabilistic memory. | SQ15 implements the durable timeline first; SQ16 can add quorum/finality policy over witness records. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Tamper-evident logs require hash-linked entries and replayable verification of prior history. | Witness observations are hash-linked so root-witness state can be reconstructed and audited. |

## 3. Existing Substrate Map Delta

Newly strengthened mechanisms:

1. Root witness state can now be derived from replayed observation records.
2. Witness decisions are recomputed during ledger replay, so a stored record cannot merely assert an accepted fork.
3. Witness observation records are hash-chained by `previousObservationHash`.
4. Obstructed observations are recorded too, preserving evidence of missing proofs and forks.
5. Postgres can persist root-witness observations independently of process memory.

## 4. Missing Substrate Map Delta

Still missing:

1. Quorum/finality policy: the ledger records one witness timeline; no threshold of independent witnesses is required yet.
2. Witness identity/authority topology: observer ids are strings, not registered witness principals with delegation/revocation.
3. Cross-witness reconciliation: there is no protocol to compare two independent witness ledgers and settle conflicts.
4. Run-wide enforcement: no monitor proves every write used the ledger-backed witness rather than the in-memory witness.
5. Adapter adoption: Axis A/C runners do not yet require the ledger-backed witness path.
6. Unified obstruction algebra: ledger replay failures are ledger issues, not yet a substrate-wide obstruction type.
7. Concurrency semantics: the Postgres ledger appends sequence numbers but does not yet model concurrent witness writers or locking.
8. Scalable log structure: the ledger uses a linear hash chain rather than a skipchain or Merkle accumulator.
9. Witness publication: no public or inter-agent distribution channel advertises accepted witness heads.
10. Finality semantics: a witnessed root is accepted by one ledger, not yet settled, durable-final, or globally admissible.

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
10. SQ16: What quorum or finality policy decides when a root witnessed by one or more ledgers becomes settled operational authority rather than provisional authority?

## 6. Primitive Proposal Ledger

Name: Projection Replay Certificate Store Root Witness Ledger.

Problem it solves: v67 made root witnessing an admission boundary, but the witness still remembered prior roots in private process state when using the in-memory witness.

Research source: decentralized witness cosigning, collectively signed update timelines, strong-consistency collective signing, tamper-evident logging.

Mechanism borrowed or adapted: append each witness observation to a hash-linked timeline and replay the timeline to reconstruct accepted state.

Why current substrate lacked it: `InMemoryProjectionReplayCertificateStoreRootWitness` stored accepted roots in a map; a restarted agent could forget roots and accept a fork as initial state.

Why existing primitives were insufficient: certificate-store roots prove the certificate log; root witnesses compare roots; neither made the witness's own observations durable and replayable.

State guarantee it should create: A ledger-backed witness cannot accept a new root unless all prior witness observations replay, hash-verify, and recompute to their stored decisions.

Admission rule it requires: Ledger-backed witnessing must replay the existing witness records before evaluating and appending the next observation.

Replay rule it requires: Witness records must have contiguous sequence, correct previous-observation hash, correct observation hash, tenant alignment, and a decision that recomputes from prior accepted roots.

Authority boundary it requires: `@pm/agent-state` owns witness ledger replay; Postgres persistence is an adapter for that substrate rule, not a source of truth by itself.

Failure modes it should prevent:

- process restart forgetting an accepted root and treating a fork as initial;
- stored witness record claiming an accepted decision that does not replay;
- tampered witness root body retaining an old observation hash;
- broken witness sequence or previous hash being used as current witness state;
- obstructed fork evidence disappearing from the witness timeline.

Minimal implementation slice:

- Added witness record/ledger/replay types.
- Added deterministic witness record hash.
- Added ledger replay with decision recomputation.
- Added ledger-backed witness class.
- Added in-memory and Postgres witness ledgers.
- Added migration `0026_agent_state_projection_replay_root_witness.sql`.
- Added tests for restart replay, missing-proof obstruction after restart, valid advance after proof, and tampered-ledger rejection.

Tests that would falsify it:

- A restarted ledger-backed witness accepts a second root as initial instead of requiring a proof from the first root.
- Ledger replay accepts a record whose root body no longer matches its observation hash.
- Ledger replay accepts a stored decision that does not recompute from prior accepted observations.
- Ledger records are not chained by previous observation hash.
- Postgres cannot store the witness record fields required for replay.

Axis surfaces that could later validate it:

- Axis C can simulate amnesiac agent restart and require ledger-backed root witness recovery.
- Axis A can require a Postgres root-witness ledger for ArrowHedge replay-certified graph writes.
- Axis B can require publication lifecycle roots to be witnessed by durable ledgers when fixtures exist.

## 7. Falsification Criteria Applied Before Verification

1. A ledger-backed witness must accept the first root and persist a witness record.
2. A fresh witness over the same ledger must remember the first root by replay and obstruct an unproved advance.
3. A valid consistency proof after restart must advance the witnessed root.
4. Ledger replay must reconstruct accepted roots and latest root from records.
5. Ledger records must chain by previous observation hash.
6. Tampering with a stored root body must produce hash mismatch.
7. Tampering that changes the replayed decision must produce decision mismatch.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A root witness can be stateful as long as write authority calls it. | Falsified. | A restarted witness without durable records can forget prior roots. |
| Storing witness decisions is enough. | Falsified. | v68 recomputes decisions during replay so the ledger cannot assert acceptance without proof. |
| SQ15 requires a full quorum system before any useful primitive exists. | Rejected. | The minimal substrate slice is the replayable witness timeline; quorum/finality becomes SQ16. |

## 9. Implementation Frontier

Implemented now:

- Hash-linked witness observation ledger.
- Replay verifier for witness records and decisions.
- Ledger-backed witness state recovery.
- Postgres persistence for witness observations.

Remaining frontier:

1. Add witness quorum/finality policy (SQ16).
2. Add registered witness principals and authority topology.
3. Wire ledger-backed witness into one real Axis A/C runtime path.
4. Add run-wide proof that all writes used replay certificate, certificate store, store root, root witness, and witness ledger gates.
5. Normalize ledger replay failures into the broader obstruction algebra.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
```

Result:

- `@pm/agent-state` typecheck passed.
- `packages/agent-state/src/index.test.ts`: 42 tests passed.

Proof boundary:

This proves witness state can be replayed from a durable observation ledger and that tampered witness records are rejected during replay. It does not yet prove multiple independent witnesses agree, that quorum finality exists, or that every runtime write path uses the ledger-backed witness.

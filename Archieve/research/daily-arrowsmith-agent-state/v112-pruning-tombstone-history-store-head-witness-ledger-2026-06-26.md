# v112 Pruning Tombstone History Store-Head Witness Ledger

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v111-pruning-tombstone-store-head-pruning-tombstone-history-currentness-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ59 - What durable witness ledger or quorum certificate makes the required v111 pruning tombstone-store head recoverable after amnesia rather than supplied by memory, adapters, or a single local process?

Answer: v111 made pruning tombstone history currentness explicit, but its required head was still a caller-supplied representation. The next missing substrate primitive is a durable witness ledger over the v111 pruning tombstone history-store head. A restarted agent must replay admitted witness records, recompute every observation decision against the prior accepted projection, and recover the latest accepted head from that transition history before continuity can consume it.

Implemented slice:

- Added v112 pruning tombstone history-store head witness proof, observation, decision, record, replay, and ledger types.
- Added replay validation for witness sequence continuity, previous observation hashes, record hashes, and exact decision recomputation.
- Added consistency-proof validation over the underlying v110 pruning tombstone records.
- Added in-memory and Postgres-backed witness ledgers.
- Added a ledger-backed witness that recovers accepted heads from replay before observing new heads.
- Added migration `0047_agent_state_projection_replay_pruning_tombstone_history_store_head_witness.sql`.
- Extended focused agent-state tests to prove replay-derived required-head recovery, same-sequence fork obstruction after resume, and tampered witness-record invalidation.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Syta et al. 2016, "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" ([IEEE](https://ieeexplore.ieee.org/document/7546521/), [arXiv PDF](https://arxiv.org/pdf/1503.08768)) | A statement from an authority is not accepted directly; witness cosigning makes the statement visible and accountable before clients rely on it. | The required v111 head cannot come from an agent's memory or adapter input. It must be replayed from witness observations, with forks recorded as obstructions. |
| Nikitin et al. 2017, "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin), [PDF](https://nikirill.com/files/chainiac.pdf)) | Independent witnesses verify conformance and collectively anchor a tamper-evident release history before clients accept the release state. | A pruning tombstone history head becomes recoverable only as a hash-linked witness history; replay recomputes whether each observed head was admitted. |
| Li, Krohn, Mazieres, and Shasha 2004, "Secure Untrusted Data Repository (SUNDR)" ([USENIX PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf), [USENIX page](https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr)) | Fork consistency makes divergent histories detectable instead of trusting an untrusted storage server's current answer. | A resumed observer that sees a different head at the same pruning tombstone sequence records an obstruction and preserves the previously admitted head. |

## 3. Existing Substrate Map Delta

Already present before v112:

1. V110 pruning tombstone records for actual pruning tombstone-store head witness/authority/quorum row deletion.
2. V110 tombstone replay over sequence continuity, previous hashes, checkpoint/admission binding, pruning admission, pruned frontier derivation, and record hashes.
3. V111 pruning tombstone history-store head identity derived from replayed v110 tombstone records.
4. V111 currentness checks that compare local replay-derived heads with a required head.
5. Older witness-ledger, topology, signature, quorum, checkpoint, and pruning patterns at parent layers.

Newly added by v112:

1. A durable witness ledger for v111 pruning tombstone history-store heads.
2. A consistency proof format that binds a witnessed head to replay-valid v110 pruning tombstone records.
3. Replay-recomputed witness decisions, so stored decisions cannot be trusted as assertions.
4. A ledger-backed observer that reconstructs accepted heads after amnesia before evaluating a new observation.
5. Postgres persistence for the witness record hash chain.
6. Durable fork obstruction: a same-sequence divergent observed head does not replace the accepted current head.

## 4. Missing Substrate Map Delta

Still missing:

1. Quorum topology for the v112 witness ledger, so one observer cannot unilaterally define v111 currentness.
2. Durable authority-transition stores for that topology.
3. Signature-bound witness identity for v112 observations.
4. Key-status replay and revocation for v112 witness signatures.
5. Authority epoch seals for non-retroactive v112 currentness.
6. Durable quorum-certificate proof records for certified v112 heads.
7. Proof-preserving compaction and checkpoint admission for the v112 witness ledger.
8. Runtime and Axis adoption of v112 recovered required heads.
9. A generic substrate currentness/witness abstraction that stops hand-repeating nested head ledgers.
10. A recovery kernel that enumerates every required head across compacted scopes and reconstructs them without conversation memory.

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
10. SQ60: What quorum topology or signature-bound authority makes the v112 pruning tombstone history-store head witness ledger resistant to one-observer or forged-observer currentness?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Witness Ledger.

Problem it solves: v111 required-head currentness still depended on a supplied head. After amnesia, an agent could not reconstruct the required v111 pruning tombstone history head from admitted history alone.

Research source: CoSi witness cosigning, CHAINIAC witness-anchored transparency, and SUNDR fork consistency.

Mechanism borrowed or adapted: witnesses do not make private claims operational. They append observable head statements into a tamper-evident, replayable history, and replay recomputes whether each statement was admissible from the prior accepted projection.

Why current substrate lacked it: v111 had a head identity and currentness comparison but no durable history that produced the required head.

Why existing primitives are insufficient: older parent-layer witness ledgers do not witness the new v111 pruning tombstone history head. A caller could still provide a stale or forked required head as input unless this layer had its own witness history.

State guarantee it should create: the required v111 pruning tombstone history head is operational only when recovered from replay-valid witness records, not remembered, summarized, or supplied by an adapter.

Admission rule it requires: an observation is accepted only if its head hash is valid, its tenant matches, and either it is the initial replay-derived head or it supplies a consistency proof from the latest accepted head to the observed head. Same-sequence divergence obstructs.

Replay rule it requires: replay witness records in sequence, verify previous-observation hashes and record hashes, reconstruct each observation, recompute the decision from prior accepted heads, and project the latest accepted head.

Authority boundary it requires: process memory, conversation state, connector cache, local snapshots, or adapter-provided heads cannot define required-head currentness; they can only propose observations for witness replay.

Failure modes it should prevent:

- an amnesiac agent trusting a remembered required head;
- a local adapter supplying a stale required head;
- a same-sequence fork replacing the accepted head;
- a stored decision being trusted without recomputation;
- a tampered witness record preserving operational authority;
- a proof-less advance beyond the recovered latest head.

Minimal implementation slice:

- Add v112 witness proof/observation/decision/record/replay types.
- Add consistency-proof verification over v110 pruning tombstone records.
- Add in-memory and Postgres ledgers.
- Add a ledger-backed witness that replays before observing.
- Add focused tests for recovery, fork obstruction, and tamper rejection.

Tests that would falsify it:

- Replay reports valid when a witness record hash is tampered.
- Replay accepts a stored decision that no longer recomputes from prior accepted heads.
- A resumed observer accepts a same-sequence fork as the latest head.
- Continuity needs a caller-supplied head even though the witness ledger contains an accepted head.
- An initial non-sequence-one observation without a consistency proof is accepted.

Axis surfaces that could later validate it:

- Axis C can restart an amnesiac agent and require it to recover `requiredPruningTombstoneStoreHead` from v112 witness replay.
- Axis A can test finance pruned-row recovery against stale local tombstone-history heads.
- Axis B can prove a domain adapter cannot smuggle a required head around the witness ledger.

## 7. Falsification Criteria Applied Before Implementation

1. The v112 witness ledger replays to a latest accepted v111 history-store head.
2. The recovered head can be fed into v111 pruned-store continuity and pass without memory.
3. A resumed ledger-backed witness evaluates new observations against replayed accepted heads.
4. A same-sequence fork produces an obstruction and does not replace the latest accepted head.
5. A tampered observation hash invalidates witness replay.
6. A proof-less first observation after sequence 1 obstructs.
7. Stored witness decisions are recomputed during replay rather than trusted.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| v111 currentness is enough because callers can supply the required head. | Rejected. | Caller-supplied heads can originate in memory, adapters, summaries, or stale local snapshots. |
| Local replay of the v110 pruning tombstone history is enough after restart. | Rejected. | Local replay proves internal consistency, not that the head is the admissible required head. |
| Existing parent-layer witness ledgers cover this new head. | Rejected. | Each newly introduced pruning/tombstone ledger creates a fresh head whose currentness must be recoverable at that layer. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessRecord` and related v112 witness types.
- `verifyProjectionReplayPruningTombstoneHistoryStoreHeadConsistencyProof`.
- `evaluateProjectionReplayPruningTombstoneHistoryStoreHeadObservation`.
- `replayProjectionReplayPruningTombstoneHistoryStoreHeadWitnessRecords`.
- `InMemoryProjectionReplayPruningTombstoneHistoryStoreHeadWitnessLedger`.
- `PostgresProjectionReplayPruningTombstoneHistoryStoreHeadWitnessLedger`.
- `LedgerBackedProjectionReplayPruningTombstoneHistoryStoreHeadWitness`.
- Migration `0047_agent_state_projection_replay_pruning_tombstone_history_store_head_witness.sql`.
- Focused tests for recovered required-head continuity, resumed fork obstruction, and witness-record tamper rejection.

Remaining frontier:

1. SQ60 quorum topology/signature-bound authority for v112 witness currentness.
2. Runtime and Axis adoption of v112 recovered heads.
3. Live Postgres restart proof.
4. A generic nested currentness/witness abstraction.
5. Recovery-kernel enumeration of every compacted required head.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run passed via the targeted command: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Full workspace typecheck passed.
- `git diff --check` passed.

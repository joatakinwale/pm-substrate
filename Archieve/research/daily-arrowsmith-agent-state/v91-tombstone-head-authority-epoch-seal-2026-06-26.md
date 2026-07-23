# v91 Tombstone-Head Authority Epoch Seal

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v90-durable-tombstone-head-witness-authority-store-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ38 - What tombstone-head authority epoch seal prevents later authority transitions from retroactively changing historical tombstone-head certifications?

Answer: tombstone-head witness authority needs an epoch seal that is itself a replayed authority transition. A certified tombstone head can now be finalized by a `seal_authority_epoch` transition that binds the pruning tombstone sequence, the effective authority topology hash, and the quorum certificate hash. After that seal, later authority transitions cannot be effective at or before the sealed tombstone sequence, and replay of a tampered authority stream reports a retroactive-transition obstruction.

Implemented slice:

- Extended pruning tombstone-head witness authority transitions with `seal_authority_epoch`.
- Added sealed pruning tombstone sequence, sealed authority topology hash, and sealed quorum certificate hash fields.
- Added tombstone-head authority epoch seal projection fields to replayed topology.
- Added replay validation for seal positivity, seal/effective sequence equality, monotonic seal advance, effective topology hash binding, certificate hash binding, and post-seal retroactive transition obstruction.
- Added append-time retroactivity rejection to in-memory and Postgres tombstone-head witness authority stores.
- Added migration `0036_agent_state_projection_replay_pruning_tombstone_head_authority_epoch_seal.sql`.
- Added tests proving sealed historical authority survives future topology changes and tampered retroactive history obstructs store-backed certification.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Liskov and Cowling 2012, "Viewstamped Replication Revisited" ([PDF](https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf)) | Correct recovery and reconfiguration require the next view/configuration to preserve operations already known by a quorum. | Tombstone-head authority replay cannot let a later topology transition erase the authority basis of a previously certified tombstone head. |
| Lamport, Malkhi, and Zhou 2009, "Vertical Paxos and Primary-Backup Replication" ([PDF](https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf)) | Configuration activation is mediated by a configuration master and state transfer boundary, not inferred locally by later leaders. | A tombstone-head authority seal records the active authority boundary for a historical certification. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf), [USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro)) | Committed log entries are protected by leader election/log rules; membership changes are log state rather than mutable process configuration. | Authority topology changes remain replayed transitions, but sealed historical epochs cannot be reinterpreted by later transitions. |
| Alvisi et al. 2000, "Dynamic Byzantine Quorum Systems" ([PDF](https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf)) | Dynamic quorum membership is allowed only when the protocol preserves quorum safety across changes. | Tombstone-head witness topology can evolve, but epoch seals prevent unsafe retroactive membership changes. |

## 3. Existing Substrate Map Delta

Already present before v91:

1. v88 made tombstone-head observations durable and replayable.
2. v89 added tombstone-head witness topology and quorum certificate evaluation.
3. v90 made tombstone-head witness topology recoverable from durable authority-transition stores.
4. v78 already proved the same non-retroactive finality shape for settlement-head witness authority.

Newly strengthened by v91:

1. Tombstone-head witness authority topology now has replayed epoch seals.
2. A seal binds one pruning tombstone sequence to the effective authority topology hash and quorum certificate hash.
3. Store append rejects later non-seal authority transitions whose effective sequence would modify a sealed tombstone epoch.
4. Replay rejects tampered transition streams that contain post-seal retroactive authority changes.
5. Store-backed tombstone-head certification uses `effectiveAuthorityHash` so future topology changes do not rewrite historical certificate hashes.
6. Future topology changes remain allowed when their effective tombstone sequence is after the sealed epoch.

## 4. Missing Substrate Map Delta

Still missing:

1. Signature-bound tombstone-head witness identity for observations, seals, and future proof records.
2. Durable tombstone-head quorum-certificate proof records.
3. Tombstone-head witness key status and rotation semantics.
4. Tombstone-head quorum certificate adoption in pruned-store continuity and runtime recovery paths.
5. Tombstone-head consistency proof compression that avoids replaying full tombstone history.
6. Cross-agent gossip/monitoring beyond shared durable storage.
7. Postgres integration tests for topology-backed tombstone-head recovery after actual pruning.
8. Direct SQL-delete hardening across tombstone and tombstone-head ledgers.
9. Store pruning and checkpointing for tombstone-head authority-transition history.
10. A general authority-epoch abstraction shared by settlement-head and tombstone-head lanes without hiding lane-specific replay fields.

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
10. SQ39: What signature-bound tombstone-head witness identity makes observations, authority epoch seals, and future certificate records attributable to admitted principals?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Head Authority Epoch Seal.

Problem it solves: v90 made tombstone-head witness topology durable, but a later authority transition could still be effective at an earlier tombstone sequence and change the topology hash used for a historical certification.

Research source: Viewstamped Replication view-change/recovery, Vertical Paxos configuration activation, Raft committed-log safety and membership-as-log-state, and dynamic Byzantine quorum safety.

Mechanism borrowed or adapted: represent finality as a replayed transition that binds a historical sequence to the authority topology and quorum certificate that certified it, then reject later transitions that would be effective inside the sealed epoch.

Why current substrate lacked it: pruning tombstone-head witness authority history was durable, but not non-retroactive. The topology replay could validate a chain while still letting future entries change the authority interpretation of a past certification.

Why existing primitives were insufficient: settlement-head epoch seals protect settlement-head authority only. Tombstone-head certification is a distinct authority lane that governs pruning tombstone currentness and pruned-store recovery.

State guarantee it should create: once a tombstone-head quorum certificate is sealed through a pruning tombstone sequence, later authority transitions cannot change the authority basis of that historical certificate.

Admission rule it requires: authority-transition stores must reject non-seal transitions whose `effectiveFromPruningTombstoneSequence` is at or before the highest sealed tombstone sequence.

Replay rule it requires: replay must validate seal fields, bind the seal to the effective prior authority topology hash, preserve `effectiveAuthorityHash`, and emit a retroactive-transition issue if tampered history contains a later transition effective inside a sealed epoch.

Authority boundary it requires: tombstone-head certification authority is constituted by replayed authority history plus epoch seals, not by private memory, synthetic topology objects, connector caches, or later reinterpretation.

Failure modes it should prevent:

- later revocation changing whether a past tombstone-head certificate counted enough witnesses;
- local memory choosing the latest topology hash for an older certification;
- a tampered store inserting a retroactive transition after a seal;
- future topology changes invalidating already sealed pruning decisions;
- store-backed certifiers recertifying historical heads under a different authority basis.

Minimal implementation slice:

- Add tombstone-head authority epoch seal fields and topology projection.
- Add replay validation and retroactive-transition issue code.
- Add append-time retroactivity guards to in-memory/Postgres stores.
- Add migration `0036`.
- Add tests for seal append, post-seal retroactive append rejection, allowed future topology change, stable recertification hash, and tampered-history obstruction.

Tests that would falsify it:

- A non-seal transition effective at a sealed tombstone sequence appends successfully after a seal.
- A tampered authority stream with a retroactive post-seal transition replays as valid.
- A future transition effective after the sealed sequence changes the historical certificate authority topology hash.
- Store-backed certification over a tampered post-seal retroactive transition remains certified instead of obstructed.
- A seal can bind a topology hash other than the effective replayed authority hash.

Axis surfaces that could later validate it:

- Axis C can prove a restarted agent cannot reauthorize pruned-store state by replaying a retroactive tombstone-head authority edit.
- Axis A can prove finance pruned projections remain blocked when historical tombstone currentness was certified under a sealed but later-revoked witness topology.
- Axis B can prove a domain adapter cannot smuggle a retroactive tombstone-head topology change into currentness certification.

## 7. Falsification Criteria Applied Before Verification

1. A valid seal records the tombstone sequence, effective topology hash, and quorum certificate hash.
2. A later retroactive authority transition is rejected by the store append path.
3. A later future-effective authority transition remains admissible.
4. Replaying the sealed topology for the historical tombstone head preserves the original effective authority hash.
5. Store-backed recertification of the historical tombstone head preserves the original quorum certificate hash.
6. A tampered store that contains a post-seal retroactive transition replays invalid and makes store-backed certification obstructed.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable tombstone-head authority history is enough if it is hash-linked. | Rejected. | Hash-linked history still needed non-retroactive epoch semantics for historical certifications. |
| Latest authority topology can safely define historical tombstone-head certification authority. | Rejected. | v91 uses `effectiveAuthorityHash` when replaying sealed historical tombstone-head certification. |
| Store append guards alone are sufficient. | Rejected. | v91 also validates replay so tampered or externally inserted history becomes an obstruction. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head authority `seal_authority_epoch` transition kind.
- Seal fields on tombstone-head authority transitions.
- Tombstone-head authority epoch seal topology projection.
- Seal validation and retroactive-transition obstruction during replay.
- In-memory/Postgres append-time retroactive transition guard.
- Migration `0036_agent_state_projection_replay_pruning_tombstone_head_authority_epoch_seal.sql`.
- Focused tests for seal finality, future topology changes, and tampered-history obstruction.

Remaining frontier:

1. Signature-bound tombstone-head witness identity.
2. Durable tombstone-head quorum-certificate records.
3. Tombstone-head witness key status and rotation.
4. Runtime and Axis adoption of sealed store-backed tombstone-head quorum certification.
5. Generalization with settlement-head epoch seals only after lane-specific behavior is fully verified.

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

This proves the pure tombstone-head authority epoch seal behavior in focused agent-state tests and preserves the broader checked package frontier. It does not yet prove signature-bound tombstone-head identities, durable tombstone-head quorum-certificate records, runtime adoption, or Axis A/B/C adoption.

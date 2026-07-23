# v116 Pruning Tombstone History Store-Head Witness Authority Epoch Seal

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v115-pruning-tombstone-history-store-head-witness-key-status-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ63 - What non-retroactive authority epoch seal prevents later v115 pruning tombstone history-store head witness topology or key-status transitions from rewriting historical certified currentness?

Answer: v115 made witness key status replayable, but later topology or key-status transitions could still claim an earlier effective pruning tombstone sequence. The missing substrate primitive is an admitted `seal_authority_epoch` transition for pruning tombstone history-store head witness authority history. A valid seal binds a sealed pruning tombstone sequence to the effective non-seal authority topology hash and the quorum certificate hash being finalized. The seal advances the authority hash chain, but certification continues to report the effective topology hash, not the seal transition hash.

Implemented slice:

- Added `seal_authority_epoch` to pruning tombstone history-store head witness authority transitions.
- Added seal fields to transition bodies, store append inputs, hashing, Postgres insert/select, and migration `0048`.
- Projected accepted seals into replayed topology as `authorityEpochSeals`.
- Added `effectiveAuthorityHash` and `sealedThroughPruningTombstoneSequence` to replayed topology.
- Added replay validation for invalid seals and post-seal retroactive transitions.
- Added store append rejection for non-seal transitions effective at or before the sealed frontier.
- Changed quorum certificate topology hash reporting to use `effectiveAuthorityHash` when present.
- Added focused tests for valid seal replay, forged seal rejection, direct retroactive replay rejection, store append retroactive rejection, and store-backed certification preserving the sealed effective topology hash.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Lamport, Malkhi, and Zhou 2009, "Vertical Paxos and Primary-Backup Replication" ([PDF](https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf)) | Reconfiguration has its own authority path; agreement about values is separated from agreement about which configuration governs. | A seal fixes which witness topology governed certified currentness at a sealed pruning tombstone sequence. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints and watermarks stop old protocol history from being rewritten or accepted below a finalized frontier. | The sealed frontier prevents later authority/key-status transitions from taking effect in the sealed past. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro), [PDF](https://raft.github.io/raft.pdf)) | Configuration changes are committed log entries; membership changes are not private local facts. | Authority topology and epoch seals are log transitions, so recovered state after amnesia is replayed from transition history. |
| Liskov and Cowling 2012, "Viewstamped Replication Revisited" ([PDF](https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf)) | Views and reconfiguration protocols define which replica group is allowed to process operations at each point in history. | A history-store head certification epoch names the authority view that certified a head; later views apply only after the sealed frontier. |

## 3. Existing Substrate Map Delta

Already present before v116:

1. V112 durable witness-ledger recovery for pruning tombstone history-store heads.
2. V113 signed quorum authority for those witness rows.
3. V114 durable authority-transition stores and store-backed certification.
4. V115 replayed key rotation/revocation for witness keys.
5. Same-pattern epoch seals on settlement-head, tombstone-head, and pruning tombstone-store head witness layers.

Newly added by v116:

1. Pruning tombstone history-store head witness authority epoch seals.
2. Seal replay projection into topology.
3. Effective topology hash separate from latest authority hash.
4. Replay rejection for invalid or forged seals.
5. Replay and store append rejection for retroactive post-seal authority changes.
6. Store-backed certification proof that seal transitions do not replace the certifying topology hash.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable quorum-certificate proof records for certified pruning tombstone history-store heads.
2. Proof-preserving compaction checkpoints over v112 witness rows, v114 authority/key/seal history, and future certificate records.
3. Pruning admission and tombstone-gated deletion for v116 histories.
4. Runtime and Axis adoption of v116 store-backed sealed certification.
5. Live Postgres restart proof for sealed authority histories.
6. Generic nested currentness/witness abstraction to reduce repetition across layered head ledgers.
7. Recovery-kernel inventory for every compacted required head and supporting authority store.
8. Production cryptographic verifier adapters.
9. Transition-authority signatures for the history-store head witness authority transitions themselves.
10. Historical key-validity semantics once durable certificate records exist.

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
10. SQ64: What durable quorum-certificate proof record makes certified pruning tombstone history-store heads recoverable without transient recertification or later topology/key-status replay?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Witness Authority Epoch Seal.

Problem it solves: v115 made topology and key status replayable, but without an epoch boundary a later transition could be appended with an earlier effective sequence and rewrite which authority governed an already certified history-store head.

Research source: Vertical Paxos reconfiguration authority, PBFT stable checkpoints, Raft committed configuration changes, and Viewstamped Replication views/reconfiguration.

Mechanism borrowed or adapted: authority configuration is log-governed and historical epochs are bounded by stable checkpoints/views. A later configuration is allowed, but it cannot govern a sealed earlier sequence.

Why current substrate lacked it: v115 had hash-linked authority history, but no transition that made historical topology/key-status state non-retroactive.

Why existing primitives are insufficient: earlier epoch seals govern other authority namespaces. Reusing them would let pruning tombstone-store head or tombstone-head authority leak into pruning tombstone history-store head certification.

State guarantee it should create: once a pruning tombstone history-store head authority epoch is sealed, no private memory, connector cache, adapter configuration, later key-status transition, or later topology transition can rewrite which authority topology governed certification at the sealed sequence.

Admission rule it requires: a seal must be effective at the sealed pruning tombstone sequence, name a positive sealed sequence, bind the effective authority topology hash for that sequence, and bind a non-empty quorum certificate hash. After a seal, non-seal transitions effective at or before the sealed frontier are inadmissible.

Replay rule it requires: replay distinguishes latest authority hash-chain position from effective authority topology. Seals advance the chain and seal frontier, but do not become the topology hash used for certification.

Authority boundary it requires: the seal is scoped only to pruning tombstone history-store head witness authority history. It does not authorize tombstone-head witnesses, pruning tombstone-store head witnesses, graph writes, or domain actions.

Failure modes it should prevent:

- later key rotation rewriting the key authority for a historical certificate;
- later revocation rewriting historical quorum eligibility;
- later witness admission or retirement changing who certified a sealed head;
- forged seal rows binding a non-effective topology hash;
- store-backed certification reporting a seal hash as the topology that certified a head;
- an amnesiac agent relying on cached topology instead of sealed authority replay.

Minimal implementation slice:

- Extend transition kind and transition bodies with `seal_authority_epoch`.
- Add seal fields to Postgres store schema and insert/select surface.
- Validate seals during replay.
- Project accepted seals and sealed frontier into topology.
- Reject retroactive post-seal transitions during replay and store append.
- Add focused seal falsifiers and certification-preserves-effective-hash proof.

Tests that would falsify it:

- A seal with a wrong authority topology hash replays as valid.
- A later key-status transition effective at the sealed sequence replays as valid.
- Store append accepts a retroactive post-seal transition.
- Store-backed certification reports the seal transition hash instead of the effective authority topology hash.
- Replay cannot recover the accepted seal frontier.

Axis surfaces that could later validate it:

- Axis C can restart with stored authority transitions and witness rows, then prove sealed certification recovers without memory.
- Axis A can attempt finance recovery using a cached post-seal topology mutation effective in the sealed past and expect obstruction.
- Axis B can prove domain adapters cannot smuggle seal state through configuration.

## 7. Falsification Criteria Applied Before Implementation

1. A valid seal replays as valid, projects an authority epoch seal, and preserves the pre-seal effective authority topology hash.
2. A forged seal with the wrong authority hash replays invalid with `authority_epoch_seal_invalid`.
3. A later key-status transition effective at the sealed sequence replays invalid with `authority_retroactive_transition`.
4. A store append for a later retroactive key-status transition throws before admission.
5. Store-backed certification after a valid seal stays certified and reports the effective pre-seal topology hash.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Hash-chained authority rows are enough to prevent retroactive rewrites. | Rejected. | A hash chain preserves order but not effective-time admissibility. |
| Key-status replay alone makes certified currentness historically stable. | Rejected. | v116 adds a sealed frontier so later key-status transitions cannot govern the sealed past. |
| The latest authority hash is always the certifying topology hash. | Rejected. | v116 keeps `effectiveAuthorityHash` distinct from `latestAuthorityHash` after a seal. |

## 9. Implementation Frontier

Implemented now:

- `seal_authority_epoch` transition kind for pruning tombstone history-store head witness authority.
- Seal field hashing and persistence through migration `0048`.
- `effectiveAuthorityHash`, `sealedThroughPruningTombstoneSequence`, and `authorityEpochSeals` in topology replay.
- Replay and store append rejection for retroactive post-seal transitions.
- Store-backed certification proof preserving effective topology hash.

Remaining frontier:

1. SQ64 durable quorum-certificate proof records.
2. Proof-preserving compaction and pruning over v116 histories.
3. Runtime/Axis adoption and live Postgres restart proof.
4. Generic recovery kernel and nested currentness abstraction.
5. Transition-authority signatures and production cryptographic verifier adapters.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run passed via the targeted command: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.

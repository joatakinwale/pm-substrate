# v105 Pruning Tombstone-Store Head Witness Authority Epoch Seal

Date: 2026-06-26
Status: substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v104-pruning-tombstone-store-head-witness-key-status-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ52 - What non-retroactive authority epoch seal prevents later pruning tombstone-store head witness topology or key-status transitions from rewriting historical required-head certification?

Answer: pruning tombstone-store head witness authority history needs an admitted `seal_authority_epoch` transition that binds a pruning tombstone-store head sequence to the effective authority topology hash and the quorum certificate hash being finalized. The seal advances the authority hash chain but does not itself become the effective topology for certification. After a seal, non-seal authority transitions effective at or before the sealed pruning tombstone sequence are invalid and store append rejects them.

Implemented slice:

- Added `seal_authority_epoch` to pruning tombstone-store head witness authority transitions.
- Added seal fields to the authority transition body and hash payload: `sealedThroughPruningTombstoneSequence`, `sealedAuthorityTopologyHash`, and `sealedQuorumCertificateHash`.
- Added replay issue codes for invalid epoch seals and retroactive post-seal transitions.
- Projected accepted authority epoch seals into replayed topology.
- Added replay validation that a seal advances monotonically, is effective at the sealed sequence, binds the effective non-seal topology hash, and names a quorum certificate hash.
- Added admission-time store rejection for non-seal transitions that would mutate a sealed epoch.
- Added tests proving valid seal replay, forged topology-hash seal rejection, direct replay rejection of retroactive post-seal key changes, append-time retroactive rejection, and store-backed certification preserving the sealed effective topology hash.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Lamport, Malkhi, and Zhou 2009, "Vertical Paxos and Primary-Backup Replication" ([PDF](https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf)) | Reconfiguration is itself governed by an auxiliary authority, so agreement about values is separated from agreement about which configuration has authority. | A seal is an authority transition that fixes which witness topology governed a pruning tombstone-store head at the sealed sequence. Later authority changes can exist only for later epochs. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | Stable checkpoints and low-water marks prevent old protocol history from being rewritten once enough proof exists. | A pruning tombstone-store head witness seal acts as a replay checkpoint over authority topology plus certificate hash, making retroactive topology/key-status rewrites invalid. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm (Raft)" ([PDF](https://raft.github.io/raft.pdf)) | Configuration changes are log entries, and joint consensus prevents a new configuration from safely replacing old authority without an overlapping transition. | Authority changes are admitted log entries. A seal fixes the historical configuration boundary so later entries cannot govern previously certified heads. |

## 3. Existing Substrate Map Delta

Already present before v105:

1. Durable pruning tombstone-store head witness observations.
2. Replayed pruning tombstone-store head witness quorum topology.
3. Durable authority-transition stores for that topology.
4. Signature-bound witness identity for pruning tombstone-store head observations.
5. Strict store-backed certification that derives topology and key status from stored authority history.
6. Key-status transitions for witness key rotation and revocation.

Newly added by v105:

1. Pruning tombstone-store head witness authority epoch seals.
2. Seal replay projection into topology as `authorityEpochSeals`.
3. Sealed pruning tombstone sequence frontier in replayed topology.
4. Seal validation against the effective pre-seal authority topology hash.
5. Seal binding to the finalized quorum certificate hash.
6. Replay rejection of later non-seal transitions effective at or before the sealed frontier.
7. Store append rejection for retroactive post-seal authority changes.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable quorum-certificate records for certified pruning tombstone-store heads.
2. Proof-preserving compaction and pruning for this witness, authority, key-status, seal, and certificate history.
3. Runtime recovery integration that requires the store-backed signed certifier and consumes seals.
4. Live Postgres restart tests for sealed certified required-head recovery.
5. Production cryptographic verifier adapters for this new witness layer.
6. Monitoring that detects callers evaluating witness replay without store-derived topology/key status/seal state.
7. Domain adapter conformance tests proving adapters cannot smuggle witness key status or seal state through configuration.
8. Topology-transition signer authority for this layer; epoch seals are hash-chain replayed but not yet signed by institutional authority.
9. Key-validity epoch semantics that distinguish "valid for historical proof" from "current for new certification" once durable certificate records exist.
10. Cross-store settlement semantics tying pruning tombstone-store head certificates to tombstone-head pruning continuity records.

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
10. SQ53: What durable quorum-certificate proof record makes certified pruning tombstone-store heads recoverable without transient recertification or later topology/key-status replay?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone-Store Head Witness Authority Epoch Seal.

Problem it solves: v104 made key status replayed, but a later key rotation, revocation, admission, retirement, or quorum change could still be appended with an earlier effective pruning tombstone sequence unless this authority history had a finality boundary.

Research source: Vertical Paxos reconfiguration authority, PBFT stable checkpoints, and Raft configuration log entries.

Mechanism borrowed or adapted: authority configuration changes are log-governed and bounded by stable checkpoints. Historical authority is not recomputed from the newest topology; it is fixed by an admitted transition history plus explicit epoch boundaries.

Why current substrate lacked it: the pruning tombstone-store head witness authority store had a hash chain and replay validation, but no transition that made historical topology/key-status state non-retroactive.

Why existing primitives are insufficient: older settlement-head and tombstone-head layers already have similar epoch seals, but they govern different authority namespaces. They cannot seal pruning tombstone-store head witness topology without letting a different layer's authority leak into this layer.

State guarantee it should create: once a pruning tombstone-store head witness epoch is sealed, no private memory, connector cache, adapter configuration, later key-status transition, or later topology transition can rewrite which authority topology governed certification at that sealed sequence.

Admission rule it requires: a `seal_authority_epoch` transition must name the sealed pruning tombstone sequence, be effective at that exact sequence, bind the effective authority topology hash for that sequence, and bind a non-empty quorum certificate hash. Non-seal transitions effective at or before the highest sealed sequence are inadmissible.

Replay rule it requires: authority replay must distinguish the latest hash-chain transition from the effective authority topology. A valid seal advances the chain and seal frontier, but certification still uses the effective non-seal topology hash.

Authority boundary it requires: the seal is scoped only to pruning tombstone-store head witness authority history. It does not authorize tombstone-head witnesses, settlement-head witnesses, graph writes, or domain actions by itself.

Failure modes it should prevent:

- later witness admission rewriting a prior certified required head;
- later witness retirement or revocation rewriting historical quorum eligibility;
- later key rotation making a prior certificate appear governed by a new key topology;
- later quorum-policy edits reducing historical quorum requirements;
- forged seal rows binding a non-effective topology hash;
- agents resuming from summaries or cached topology and treating a stale local view as stronger than the sealed authority history.

Minimal implementation slice:

- Extend this layer's authority transition kind with `seal_authority_epoch`.
- Add seal fields to transition input, append input, stored transition JSON, and hash computation.
- Replay accepted seals into topology.
- Reject invalid seals and retroactive post-seal non-seal transitions.
- Reject retroactive post-seal appends in authority-transition stores.
- Add focused falsifiers for valid seal replay, forged seal rejection, replayed retroactive rejection, append-time retroactive rejection, and certification preserving the effective sealed topology hash.

Tests that would falsify it:

- A seal with the wrong `sealedAuthorityTopologyHash` replays as valid.
- A non-seal authority transition after the seal can be effective at the sealed sequence.
- Store append accepts a post-seal retroactive key rotation.
- A valid seal replaces the effective topology hash used for certification with the seal transition hash.
- Replay omits accepted seals from topology, making recovery unable to see the sealed frontier.

Axis surfaces that could later validate it:

- Axis C can restart with stored authority transitions plus witness rows and prove certification recovers the same sealed effective topology without agent memory.
- Axis A can attempt finance recovery using a cached post-seal topology mutation effective in the sealed past and expect obstruction.
- Axis B can require domain adapters to consume store-backed sealed topology rather than passing topology/seal state through adapter configuration.

## 7. Falsification Criteria Applied Before Implementation

1. A valid seal must replay as valid, project an authority epoch seal, and preserve the pre-seal effective authority topology hash.
2. A seal with a forged authority topology hash must replay invalid with `authority_epoch_seal_invalid`.
3. A later key-status transition effective at the sealed sequence must replay invalid with `authority_retroactive_transition`.
4. A store append for a later retroactive key-status transition must throw before admission.
5. Store-backed certification after a valid seal must remain certified under the sealed effective topology hash, not the seal hash.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Hash-chained authority history is enough to prevent retroactive authority rewrites. | Rejected. | A hash chain preserves order but does not by itself prevent later entries from declaring earlier effective sequences. |
| The latest authority transition hash should be the authority topology hash for certification. | Rejected. | v105 keeps `latestAuthorityHash` distinct from `effectiveAuthorityHash`; seal transitions advance the chain but do not become certification topology. |
| Key-status replay alone makes historical certification stable. | Rejected. | Key-status replay needs an epoch seal so later key-status changes cannot claim authority over already certified required-head epochs. |

## 9. Implementation Frontier

Implemented now:

- Authority epoch seal transition kind for pruning tombstone-store head witness authority replay.
- Seal field hashing and topology projection.
- Seal validation against effective authority topology and quorum certificate hash.
- Replay and store-append rejection for retroactive post-seal authority changes.
- Store-backed certification proof that a seal preserves the effective topology hash.

Remaining frontier:

1. Durable quorum-certificate records for pruning tombstone-store head certification.
2. Proof-preserving compaction and pruning over this seal-aware history.
3. Runtime and axis adoption.
4. Topology-transition signer authority for this layer.
5. Production cryptographic verifier adapters and live Postgres restart proof.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
rg -n "[ \t]+$" Changelog.md packages/agent-state/src/index.ts packages/agent-state/src/index.test.ts research/index.md research/daily-arrowsmith-agent-state/index.md research/daily-arrowsmith-agent-state/v105-pruning-tombstone-store-head-witness-authority-epoch-seal-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused agent-state test suite passed: 73 tests.
- Full workspace typecheck passed.
- Affected-package test sweep passed: 31 test files passed, 8 skipped; 393 tests passed, 65 skipped.
- `git diff --check` passed.
- Trailing-whitespace scan over touched code, changelog, and ledger files found no matches.

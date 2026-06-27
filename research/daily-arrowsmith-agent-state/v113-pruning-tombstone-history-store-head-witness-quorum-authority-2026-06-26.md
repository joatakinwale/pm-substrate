# v113 Pruning Tombstone History Store-Head Witness Quorum Authority

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v112-pruning-tombstone-history-store-head-witness-ledger-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ60 - What quorum topology or signature-bound authority makes the v112 pruning tombstone history-store head witness ledger resistant to one-observer or forged-observer currentness?

Answer: v112 made the required v111 pruning tombstone history-store head recoverable from witness replay, but any observer row could still define currentness if the caller treated ledger replay as certification. The missing substrate primitive is a replayed witness authority topology plus signature-bound observation evidence and quorum certificate evaluation for the v112 witness ledger. A recovered history-store head can be known from replay, but it is not certified operational currentness until enough active, admitted witness principals have signed observations of the exact head.

Implemented slice:

- Added v113 pruning tombstone history-store head witness authority transitions, topology replay, quorum policy, quorum certificate, and certificate hashing.
- Added signature payload hashing for v112 history-store head observations.
- Extended v112 witness observations and records with optional principal signatures.
- Added strict replay checks for missing signatures, signer/observer mismatch, payload mismatch, unauthorized principal, wrong key, wrong algorithm, and verifier rejection when a history-store head topology is supplied.
- Added `pruningTombstoneHistoryStoreHeadAuthorityTopology` to the shared signature policy.
- Persisted history-store head witness signatures through the Postgres witness ledger and migration `0047`.
- Extended focused agent-state tests to prove unsigned rows fail under strict topology, one witness cannot certify a two-witness quorum, two admitted signed witnesses certify, wrong-key rows fail replay, and unauthorized observers fail replay.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([USENIX](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance), [PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | A replica's statement is not enough; state becomes stable only through authenticated messages that meet a quorum threshold. | A v112 witness record is replay evidence, but certified currentness requires enough admitted signed witness records for the exact head. |
| Malkhi and Reiter 1998, "Byzantine Quorum Systems" ([Springer](https://link.springer.com/article/10.1007/s004460050050), [PDF](https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf)) | Quorum intersection and eligibility rules define which sets of participants can make state available and consistent under Byzantine faults. | The topology names eligible history-store-head witnesses and thresholds; unauthorized observers and one-observer sets cannot constitute certified currentness. |
| Syta et al. 2016, "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" ([IEEE](https://ieeexplore.ieee.org/document/7546521/), [arXiv PDF](https://arxiv.org/pdf/1503.08768)) | Witness cosigning makes authority statements accountable and visible before clients rely on them. | The required head is not accepted from a lone process; it needs signatures from admitted witness principals over the exact observation payload. |
| Nikitin et al. 2017, "CHAINIAC: Proactive Software-Update Transparency via Collectively Signed Skipchains and Verified Builds" ([USENIX](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/nikitin), [PDF](https://nikirill.com/files/chainiac.pdf)) | Independent witnesses collectively sign verified state transitions and preserve them in tamper-evident history. | v113 treats the current pruning tombstone history-store head as a signed, topology-bound proof object rather than a remembered or adapter-returned representation. |

## 3. Existing Substrate Map Delta

Already present before v113:

1. V110 pruning tombstone records for pruning tombstone-store head witness/authority/quorum row deletion.
2. V111 pruning tombstone history-store head identity and currentness checks.
3. V112 durable witness-ledger recovery for v111 required heads.
4. V112 replay recomputation of witness decisions, previous-observation hashes, and record hashes.
5. Parent-layer quorum, signature, authority-store, key-status, epoch-seal, and proof-record patterns.

Newly added by v113:

1. A v112-specific witness authority topology over pruning tombstone history-store head observers.
2. Threshold-bearing quorum certificate evaluation for exact recovered heads.
3. Signature-bound v112 witness observation replay.
4. Strict policy binding between the signature verifier and the replayed history-store-head authority topology.
5. Postgres persistence for history-store-head witness signatures.
6. A deterministic certificate hash for the v113 quorum proof object.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable authority-transition stores for the v113 topology.
2. Store-backed v113 quorum certification that derives topology from stored authority history rather than caller-supplied transition arrays.
3. Key-status replay and revocation for v113 witness signatures.
4. Authority epoch seals for non-retroactive v113 currentness.
5. Durable quorum-certificate proof records for certified v113 heads.
6. Proof-preserving compaction and checkpoint admission for v113 witness, authority, and certificate histories.
7. Runtime and Axis adoption of v113 certified required heads.
8. Live Postgres restart proof for signed/certified v113 recovery.
9. A generic nested currentness/witness abstraction that stops hand-repeating layered head ledgers.
10. A recovery kernel that inventories every compacted required head and reconstructs it without memory or adapter state.

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
10. SQ61: What durable authority-transition store makes the v113 pruning tombstone history-store head witness topology recoverable after amnesia instead of supplied as in-memory transition arrays?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Witness Quorum Authority.

Problem it solves: v112 witness replay made a required head recoverable, but it did not prevent one observer, an unsigned row, or a forged observer id from being treated as certified currentness.

Research source: PBFT authenticated quorum protocols, Byzantine quorum systems, CoSi witness cosigning, and CHAINIAC collective signed transparency.

Mechanism borrowed or adapted: a state claim becomes certified only when a replayed authority topology says which witnesses are eligible, current signatures bind those witnesses to exact payloads, and the set of accepted witness records meets the required quorum threshold.

Why current substrate lacked it: v112 had durable observation replay but no v112-specific authority topology, signature payload hash, or quorum certificate.

Why existing primitives are insufficient: parent-layer topology and signature types govern other heads. They cannot authorize this newly introduced pruning tombstone history-store head without letting an adapter smuggle authority across layers.

State guarantee it should create: a v111 pruning tombstone history-store head can be recovered from v112 witness replay, but it becomes certified operational currentness only through admitted signed quorum evidence.

Admission rule it requires: witness observations count toward certification only when the observer is active in the replayed topology for the head sequence, the observation signature verifies over the exact payload, the key and algorithm match the replayed principal metadata, and enough distinct eligible witnesses accepted the exact head.

Replay rule it requires: replay authority transitions into a topology, replay witness records with strict signature validation against that topology, and evaluate a quorum certificate over the replayed accepted records. Stored signatures and stored decisions are evidence, not authority by themselves.

Authority boundary it requires: process memory, conversation state, adapter-provided observer ids, connector cache, unsigned rows, or single-process witness rows cannot certify currentness.

Failure modes it should prevent:

- one observer certifying required-head currentness alone;
- an unsigned persisted witness row counting under strict policy;
- an unauthorized observer id counting toward quorum;
- a wrong-key or wrong-algorithm signature counting because the cryptographic verifier alone accepts it;
- a signature over a different observation payload counting;
- a caller-supplied topology policy differing from replayed quorum thresholds;
- a recovered but uncertified required head being mistaken for settled currentness.

Minimal implementation slice:

- Add v113 authority transition/topology/quorum certificate types.
- Add v112 observation signature payload hashing and signature replay issues.
- Persist optional signatures on v112 witness records.
- Bind strict signature policy to the v113 topology.
- Add tests for two-witness certification and the core falsifiers.

Tests that would falsify it:

- A one-witness replay certifies under a two-witness topology.
- An unsigned v112 witness row replays as valid under strict topology.
- A wrong-key signature replays as valid because the generic verifier accepts it.
- An unauthorized observer counts toward quorum.
- A quorum certificate certifies a head that its accepted records did not accept.
- A policy threshold can override the replayed topology without obstruction.

Axis surfaces that could later validate it:

- Axis C can restart an amnesiac agent, recover the v112 history-store head, and require v113 certification before continuity consumes it.
- Axis A can test finance pruned-row recovery against a single stale tombstone-history monitor.
- Axis B can prove a domain adapter cannot forge observer ids or topology objects to certify currentness.

## 7. Falsification Criteria Applied Before Implementation

1. Replayed v113 topology with two admitted witnesses is valid.
2. Existing unsigned v112 witness rows fail strict replay once v113 topology is required.
3. Two admitted signed witnesses certify the exact required history-store head.
4. One admitted signed witness does not certify under a two-witness topology.
5. Wrong-key signatures fail strict replay even when the test verifier accepts the signature format.
6. Unauthorized observers fail strict replay and cannot count toward quorum.
7. Certified quorum certificates expose the authority boundary and deterministic certificate hash.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Durable v112 witness replay is enough to certify currentness. | Rejected. | Replay can recover a head, but one witness or unsigned rows should not certify currentness. |
| Generic signature verification is enough. | Rejected. | A verifier can validate a signature string for the wrong key unless replayed topology binds the principal to its current admitted key. |
| Parent-layer topology can be reused for this new head. | Rejected. | Cross-layer reuse would let adapters smuggle authority into the new head rather than replaying this layer's own authority transitions. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransition`.
- `replayProjectionReplayPruningTombstoneHistoryStoreHeadWitnessAuthorityTransitions`.
- `ProjectionReplayPruningTombstoneHistoryStoreHeadWitnessQuorumCertificate`.
- `evaluateProjectionReplayPruningTombstoneHistoryStoreHeadWitnessQuorumCertificate`.
- `computeProjectionReplayPruningTombstoneHistoryStoreHeadWitnessObservationSignaturePayloadHash`.
- Strict signature replay for v112 witness records when `pruningTombstoneHistoryStoreHeadAuthorityTopology` is present.
- Optional signature persistence for v112 witness records in memory/Postgres and migration `0047`.
- Focused tests for signed quorum certification, missing signature, one-witness non-certification, wrong key, and unauthorized observer.

Remaining frontier:

1. SQ61 durable v113 authority-transition stores.
2. Store-backed v113 quorum certification.
3. Key-status rotation/revocation for v113 witness keys.
4. Non-retroactive authority epoch seals for v113 currentness.
5. Durable quorum-certificate proof records for v113 certified heads.
6. Proof-preserving compaction, checkpoint admission, pruning admission, and tombstone-gated deletion for the v113 histories.
7. Runtime/Axis adoption and live Postgres restart proof.
8. Generic recovery kernel and nested currentness abstraction.

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

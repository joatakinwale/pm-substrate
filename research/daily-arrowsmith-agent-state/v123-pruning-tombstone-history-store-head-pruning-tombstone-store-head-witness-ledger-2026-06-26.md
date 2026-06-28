# v123 Pruning Tombstone History Store-Head Pruning Tombstone Store-Head Witness Ledger

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v122-pruning-tombstone-history-store-head-pruning-tombstone-currentness-2026-06-26.md`

## 1. Research Question Targeted

Closed question: SQ70 - What durable witness ledger or quorum certificate makes the required history-store-head pruning tombstone-store head recoverable after amnesia rather than supplied by memory, adapters, connector caches, or a single local process?

Answer: v122 made the v121 pruning tombstone history currentness-checkable, but its `requiredPruningTombstoneStoreHead` was still a verifier input. That left a continuity break: a resumed agent could satisfy the API only if some private representation, adapter, connector cache, or remembered summary supplied the required head. The missing primitive is a durable witness ledger for this exact head namespace. A witness observation becomes admissible only when it hash-links into witness history, recomputes the same admission decision during replay, and proves the observed head is consistent with replayed v121 tombstone records from the beginning or from the latest previously accepted head.

Implemented slice:

- Added `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitness` records, decisions, issue codes, replay, and ledger contracts.
- Added consistency proofs that replay v121 pruning tombstone records into the observed v122 head.
- Added in-memory and Postgres-backed witness ledgers plus migration `0052_agent_state_history_store_head_pruning_tombstone_store_head_witness.sql`.
- Added a ledger-backed witness that recovers the latest accepted required head from replayed records.
- Added focused tests proving replay-derived required-head recovery, recovered-head use in v122 pruned-store continuity, witness-record tamper rejection, and same-sequence fork obstruction.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Haeberlen, Kouznetsov, and Druschel 2007, "PeerReview: Practical Accountability for Distributed Systems" ([SOSP PDF](https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf), [ACM](https://dl.acm.org/doi/10.1145/1323293.1294279)) | Nodes keep secure logs that other nodes can replay against expected behavior to detect inconsistent or faulty execution. | A required pruning tombstone-store head is not accepted because a process remembers it; the witness ledger replays each observation and recomputes its decision from prior accepted heads. |
| Chun et al. 2007, "Attested Append-Only Memory: Making Adversaries Stick to their Word" ([PDF](https://www.read.seas.harvard.edu/~kohler/class/08w-dsi/chun07attested.pdf), [ACM](https://dl.acm.org/doi/10.1145/1323293.1294280)) | A trusted append-only log with ordered statements reduces equivocation by forcing parties to stick to prior history. | Witness records are sequence-bound and hash-linked, so resumed recovery rejects gaps, previous-hash mismatch, record-hash tampering, and decision rewrites. |
| Levin et al. 2009, "TrInc: Small Trusted Hardware for Large Distributed Systems" ([USENIX](https://www.usenix.org/conference/nsdi-09/trinc-small-trusted-hardware-large-distributed-systems), [PDF](https://www.usenix.org/legacy/event/nsdi09/tech/full_papers/levin/levin.pdf)) | A minimal non-decreasing counter plus key yields unique attestations and constrains equivocation. | The ledger borrows the counter-shaped ordering: every observation has a monotonic witness sequence and previous observation hash before it can affect recovered currentness. |
| Syta et al. 2016, "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" ([IEEE S&P listing](https://www.ieee-security.org/TC/SP2016/program-papers.html), [PDF](https://arxiv.org/pdf/1503.08768)) | Authoritative statements are validated and publicly witnessed before clients accept them; diverse witnesses reduce unilateral authority. | This slice implements one durable witness ledger; the next question is whether replayed topology, signatures, and quorum certificates must certify this head before strict recovery treats it as current authority. |

## 3. Existing Substrate Map Delta

Already present before v123:

1. V121 durable history-store-head replay compaction pruning tombstone records and tombstone-gated physical prune APIs.
2. V121 retained-suffix continuity after physical deletion.
3. V122 deterministic pruning tombstone-store head derivation from replayed v121 tombstone records.
4. V122 pruned-store continuity that can require an exact head and reject missing, stale, forked, unwitnessed-advance, or hash-invalid local histories.
5. Earlier witness-ledger patterns for prior nested currentness layers.

## 4. Missing Substrate Map Delta

Still missing after v123:

1. Replay-derived witness authority topology for this v123 ledger, so a single observer cannot unilaterally define currentness.
2. Signature-bound observer identity, admitted keys, rotation/revocation, and non-retroactive authority epoch seals for this head namespace.
3. Durable quorum-certificate proof records for certified v123 heads.
4. Proof-preserving compaction and pruning for this new witness ledger and its future authority/QC records.
5. Runtime and Axis adoption of replay-derived v123 required heads.
6. Live Postgres restart proof that a fresh process can recover the required head after tombstone-row deletion.
7. Generic nested currentness/witness abstraction to reduce repeated layer-specific code.
8. Recovery-kernel inventory for every compacted/pruned required head and its supporting stores.
9. SQL hardening that prevents out-of-band deletion without a tombstone-bound pruning admission.
10. Production cryptographic verifier adapters and monitoring for split views across agents.

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
10. SQ71: What witness authority topology, signature-bound identity, or quorum certificate prevents a single observer from unilaterally defining history-store-head pruning tombstone-store head currentness?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Pruning Tombstone Store-Head Witness Ledger.

Problem it solves: after v122, the required head for pruned-store continuity could still be supplied by memory, adapter input, connector cache, or a local process.

Research source: PeerReview secure replay logs, A2M append-only memory, TrInc non-equivocation counters, and CoSi decentralized witness cosigning.

Mechanism borrowed or adapted: witness observations form a sequence-numbered, hash-linked, replayable ledger. Each record stores the observed head, optional consistency proof, prior observation hash, decision, status, and observation hash. Replay recomputes decisions from prior accepted heads and rejects hash tampering, sequence gaps, previous-hash mismatch, tenant mismatch, and decision mismatch.

Why current substrate lacks it: v122 created a head object and required-head check, but not the admitted history from which an amnesiac agent could recover the required head.

Why existing primitives are insufficient: older witness ledgers protect older currentness namespaces. Reusing them would let the wrong authority layer certify a newer pruning tombstone history and would leave this v122 required-head input outside its own replay boundary.

State guarantee it should create: the v122 required pruning tombstone-store head can be recovered from admitted witness history alone; a private representation cannot supply currentness unless replay admits the corresponding witness record.

Admission rule it requires: an observation is admitted only when the head hash matches its body, tenant matches, same-sequence forks obstruct, regressions obstruct, and advances provide a consistency proof that replays v121 tombstone records to the observed head from the latest accepted head.

Replay rule it requires: replay must recompute every witness decision from prior accepted heads and the stored observation body; stored decisions, accepted flags, statuses, and hashes cannot be trusted directly.

Authority boundary it requires: this ledger only witnesses `projection_replay_pruning_tombstone_history_store_head_witness_replay_compaction_pruning_tombstone` heads. It does not certify broader settlement, graph, workflow, domain, or external side-effect authority.

Failure modes it should prevent:

- a resumed agent taking the v122 required head from conversation memory;
- a connector cache supplying a stale required head after a newer witness observation exists;
- a same-sequence fork becoming an alternative current head;
- tampered witness records or rewritten decisions surviving replay;
- a head advance that is not backed by replayed v121 tombstone records.

Minimal implementation slice:

- Add v123 observation, decision, record, replay, and ledger types.
- Add consistency-proof verification over v121 tombstone records.
- Add deterministic witness-record hashing.
- Add in-memory and Postgres witness ledgers plus migration `0052`.
- Add a ledger-backed witness facade.
- Add tests for replay recovery, recovered-head continuity, tamper rejection, and fork obstruction.

Tests that would falsify it:

- Replayed witness history cannot recover the required v122 head after process memory is absent.
- A recovered head cannot satisfy v122 pruned-store continuity.
- A tampered witness observation hash still replays as valid.
- A same-sequence fork replaces the latest accepted head instead of becoming an obstruction.
- A witness record with a decision not recomputable from prior accepted heads still replays as valid.

Axis surfaces that could later validate it:

- Axis C can start from empty process memory, replay the v123 witness ledger, and prove compacted/pruned recovery uses the recovered head.
- Axis A can require the recovered v123 head before finance recovery from pruned history-store-head witness rows.
- Axis B can force a domain adapter to use replayed witness history instead of injecting a local pruning summary.

## 7. Falsification Criteria Used For This Slice

1. Replaying the witness ledger must recover the latest accepted v122 required head.
2. The recovered head must satisfy v122 pruned-store continuity without a caller-supplied memory head.
3. Tampering with a witness record hash must invalidate witness replay.
4. A same-sequence fork must be recorded as an obstruction and must not replace the latest accepted head.
5. A consistency proof must derive the observed head from replayed v121 tombstone records.
6. Replay must recompute stored decisions rather than trusting the recorded decision payload.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A required v122 head can remain a verifier input because the caller will know the current head. | Rejected. | v123 recovers the required head from hash-linked witness records and uses that recovered head in v122 continuity. |
| A replay-valid v121 tombstone history plus a local head object is enough for amnesiac recovery. | Rejected. | The head object itself now needs admitted witness history; otherwise the caller can smuggle continuity through memory or adapter state. |
| One local witness process can define currentness for this layer. | Still open, now isolated as SQ71. | v123 records one witness ledger and durable obstructions, but it does not yet require topology, signatures, or quorum certification. |

## 9. Implementation Frontier

Implemented now:

1. V123 witness observation/decision/record/replay types and hash validation.
2. Consistency-proof verification over replayed v121 tombstone records.
3. In-memory and Postgres witness ledgers plus migration `0052`.
4. Ledger-backed witness facade for append and replay.
5. Focused tests for recovered required-head continuity, tampered witness history, and same-sequence fork obstruction.

Remaining frontier:

1. SQ71 witness authority topology, signature-bound identity, or quorum certificates for this v123 ledger.
2. Durable authority-transition stores, key-status replay, non-retroactive seals, and QC proof records for certified v123 heads.
3. Proof-preserving compaction/pruning for v123 witness and future authority/QC histories.
4. Runtime and Axis adoption.
5. Live Postgres restart proof for amnesiac compacted/pruned recovery.
6. Generic nested currentness/witness abstraction and recovery-kernel inventory.

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
- Root Vitest run via the targeted command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.

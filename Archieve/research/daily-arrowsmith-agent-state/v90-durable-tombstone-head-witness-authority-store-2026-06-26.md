# v90 Durable Tombstone-Head Witness Authority Store

Date: 2026-06-26
Status: new substrate primitive implemented; focused and broad verification passed
Parent: `research/daily-arrowsmith-agent-state/v89-tombstone-head-witness-quorum-topology-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ37 - What durable tombstone-head witness authority-transition store makes quorum topology recoverable after restart instead of supplied by adapters?

Answer: tombstone-head witness quorum topology must be recovered from an append-only authority-transition store. v90 adds in-memory and Postgres-backed pruning tombstone-head witness authority-transition stores, plus a store-backed quorum certifier that composes stored topology replay with replayed tombstone-head witness observations. An adapter can no longer provide the only topology object for certification; the certifier derives eligible witnesses and thresholds from durable transition history.

Implemented slice:

- Added pruning tombstone-head witness authority-transition append input and store contracts.
- Added in-memory and Postgres-backed tombstone-head witness authority-transition stores.
- Added migration `0035_agent_state_projection_replay_pruning_tombstone_head_witness_authority.sql`.
- Added row mapping and SQL select constants for the Postgres authority-transition adapter.
- Added a store-backed pruning tombstone-head quorum certifier.
- Added tests proving stored transition recovery, store-backed certification, and incomplete-store non-certification even when the witness ledger contains two accepted observations.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf), [USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro)) | Membership and replicated state-machine changes must move through a log rather than process-local configuration. | Tombstone-head witness topology changes are append-only authority transitions. |
| Mohan et al. 1992, "ARIES" ([IBM](https://research.ibm.com/publications/aries-a-transaction-recovery-method-supporting-fine-granularity-locking-and-partial-rollbacks-using-write-ahead-logging), [PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery reconstructs state from write-ahead log records, not from volatile memory. | A fresh agent can reconstruct tombstone-head witness topology from stored authority transitions. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf), [USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident)) | Append-only, hash-linked histories make hidden edits detectable. | Authority transitions chain by `previousAuthorityHash` and replay validates sequence/hash continuity. |
| Alvisi et al. 2000, "Dynamic Byzantine Quorum Systems" ([PDF](https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf)) | Quorum topology can change, but the change protocol must preserve correctness across reconfiguration. | Tombstone-head quorum topology is dynamic authority state rather than static adapter configuration. |

## 3. Existing Substrate Map Delta

Already present before v90:

1. v88 made tombstone-head observations durable and replayable.
2. v89 added tombstone-head witness authority topology and quorum certificate evaluation.
3. Settlement-store head witnessing already had durable authority-transition stores and a store-backed certifier.

Newly strengthened by v90:

1. Pruning tombstone-head witness topology can be appended to a durable store.
2. Store append assigns contiguous authority sequences and previous-authority hashes.
3. Postgres can persist tombstone-head witness authority transitions.
4. Store-backed tombstone-head quorum certification derives topology from the store before evaluating witness observations.
5. A witness outside the stored topology remains replay evidence but cannot satisfy stored quorum authority.
6. Restart recovery can list stored topology and replay it without adapter-supplied membership.

## 4. Missing Substrate Map Delta

Still missing:

1. Tombstone-head authority epoch seals for non-retroactive historical certification.
2. Signature-bound tombstone-head witness identity.
3. Durable tombstone-head quorum-certificate proof records.
4. Tombstone-head witness key status and rotation semantics.
5. Tombstone-head quorum certificate adoption in pruned-store continuity and runtime recovery paths.
6. Tombstone-head consistency proof compression that avoids replaying full tombstone history.
7. Cross-agent gossip/monitoring beyond shared durable storage.
8. Postgres integration tests for topology-backed tombstone-head recovery after actual pruning.
9. Direct SQL-delete hardening across tombstone and tombstone-head ledgers.
10. Store pruning and checkpointing for tombstone-head authority-transition history.

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
10. SQ38: What tombstone-head authority epoch seal prevents later authority transitions from retroactively changing historical tombstone-head certifications?

## 6. Primitive Proposal Ledger

Name: Durable Pruning Tombstone-Head Witness Authority Store.

Problem it solves: v89 could replay topology, but a caller could still supply that topology object directly. That made quorum currentness depend on adapter-provided membership rather than durable substrate authority history.

Research source: replicated logs, write-ahead recovery logs, tamper-evident append-only logs, and dynamic Byzantine quorum systems.

Mechanism borrowed or adapted: store every topology change as an append-only, hash-linked authority transition; recover topology by replaying the transition store before certification.

Why current substrate lacked it: pruning tombstone-head witness topology existed only as pure replay inputs and was not persisted.

Why existing primitives were insufficient: settlement-head authority stores protect settlement-head certification, but pruning tombstone-head certification has a separate head, witness ledger, and recovery consequence.

State guarantee it should create: an amnesiac agent can reconstruct tombstone-head witness topology from stored transitions before deciding whether a tombstone head is certified currentness.

Admission rule it requires: store append assigns the next authority sequence, chains to the latest stored authority hash, and records the normalized authority transition body.

Replay rule it requires: list stored transitions in sequence, verify previous hashes and transition hashes, project eligible witnesses and quorum thresholds, then evaluate the tombstone-head witness ledger against that topology.

Authority boundary it requires: tombstone-head witness topology is durable substrate authority history, not adapter input, private memory, conversation summary, or connector cache.

Failure modes it should prevent:

- adapter-supplied topology certifying a head without durable authority history;
- restart losing tombstone-head witness membership;
- a non-member observer satisfying quorum because membership was passed in by a caller;
- local memory choosing a different threshold from stored authority history;
- certification using a topology whose transition chain does not replay.

Minimal implementation slice:

- Add tombstone-head witness authority-transition append and store contracts.
- Add in-memory and Postgres stores.
- Add store-backed tombstone-head quorum certifier.
- Add migration `0035`.
- Add focused tests for stored sequence/hash chaining, store-backed certification, and incomplete-store non-certification.

Tests that would falsify it:

- Store-backed certification succeeds with no stored quorum transition.
- Store-backed certification counts a witness not admitted by the stored topology.
- Stored authority transitions do not chain by previous hash.
- A fresh certifier cannot reconstruct topology from the store.
- The Postgres adapter cannot persist and list authority transitions in replay order.

Axis surfaces that could later validate it:

- Axis C can restart after pruning and recover tombstone-head topology from durable authority history.
- Axis A can reject finance pruned projections when a required tombstone head has observations but lacks stored quorum authority.
- Axis B can prove a domain adapter cannot smuggle a synthetic tombstone-head witness list into certification.

## 7. Falsification Criteria Applied Before Verification

1. Stored tombstone-head authority transitions are returned with contiguous sequences and previous-authority hashes.
2. Store-backed certification derives a certified tombstone head from stored quorum and two stored witness admissions.
3. Store-backed certification remains non-certified when the durable authority store admits only one of two observers.
4. Focused agent-state tests continue to pass with all prior v88/v89 tombstone-head witness behavior.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A replayed topology object is sufficient even if it was supplied by an adapter. | Rejected. | v90 adds a store-backed certifier that derives topology from stored authority transitions. |
| Tombstone-head witness authority can be reconstructed from the witness ledger alone. | Rejected. | Witness observations and authority membership are separate replay lanes. |
| Tombstone-head authority can remain mutable for historical certifications. | Not yet. | SQ38 remains open for non-retroactive authority epoch seals. |

## 9. Implementation Frontier

Implemented now:

- Tombstone-head witness authority-transition append and store contracts.
- In-memory tombstone-head witness authority-transition store.
- Postgres tombstone-head witness authority-transition store.
- Store-backed tombstone-head witness quorum certifier.
- Migration `0035_agent_state_projection_replay_pruning_tombstone_head_witness_authority.sql`.
- Focused tests for durable transition chaining, store-backed certification, and incomplete-store non-certification.

Remaining frontier:

1. Tombstone-head authority epoch seals.
2. Signature-bound tombstone-head witness identity.
3. Durable tombstone-head quorum-certificate records.
4. Tombstone-head witness key status and rotation.
5. Runtime and Axis adoption of store-backed tombstone-head quorum certification.

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

This proves the pure store-backed tombstone-head authority topology path in focused agent-state tests and preserves the broader checked package frontier. It does not yet prove non-retroactive tombstone-head authority epochs, tombstone-head signatures, durable quorum-certificate records, runtime adoption, or Axis A/B/C adoption; those remain SQ38/frontier work.

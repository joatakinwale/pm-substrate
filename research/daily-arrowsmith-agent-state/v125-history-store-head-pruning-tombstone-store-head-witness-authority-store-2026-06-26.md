# v125 History Store-Head Pruning Tombstone Store-Head Witness Authority Store

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v124-history-store-head-pruning-tombstone-store-head-witness-quorum-topology-2026-06-26.md`

## 1. Research Question Targeted

Closed question: SQ72 - What durable authority-transition store makes v124 history-store-head pruning tombstone-store head witness topology recoverable after amnesia rather than supplied as in-memory transition arrays?

Answer: v124 made quorum topology replayable as a pure transition array, but that array could still come from process memory, an adapter, or an agent summary. The missing primitive is a durable v124 authority-transition store plus store-backed certifier. Certification now reconstructs witness topology from stored hash-linked authority history and reconstructs witness acceptance from the v123 witness ledger before a recovered v122 pruning tombstone-store head can certify.

Implemented slice:

- Added v124 authority-transition store contracts.
- Added in-memory and Postgres-backed v124 authority-transition stores.
- Added migration `0053_agent_state_history_store_head_pruning_tombstone_store_head_witness_authority.sql`.
- Added a store-backed v124 quorum certifier that derives authority topology from the store and witness replay from the v123 ledger.
- Added focused tests proving empty stored topology cannot certify, tampered stored authority history fails replay, one stored witness remains non-certified under a two-witness topology, and two stored witnesses certify.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf), [USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro)) | Replicated state machines compute state from the same ordered log entries; configuration changes must be represented in the log rather than supplied by local process state. | v124 witness topology becomes a replayed authority-transition ledger, not an input object supplied to the certifier. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging" ([PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf), [ACM](https://dl.acm.org/doi/10.1145/128765.128770)) | Recovery repeats durable logged history to reconstruct state after failure before new decisions rely on that state. | Store-backed certification replays durable authority history and witness records after amnesia before accepting required-head currentness. |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf), [USENIX](https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident)) | Logs need append commitments and consistency checks so later views cannot quietly rewrite past events. | v125 stores v124 transitions with sequence, previous hash, transition hash, and uniqueness constraints; replay detects tampering before certification. |

## 3. Existing Substrate Map Delta

Already present before v125:

1. V121 replayable pruning tombstone records for actual history-store-head row deletion.
2. V122 deterministic pruning tombstone-store heads and exact required-head currentness checks.
3. V123 durable witness records that recover the required v122 head after amnesia.
4. V124 quorum topology and certificates over replayed v123 witness records.
5. Strict pruned-store continuity can require a certified v124 certificate.

Newly added by v125:

1. `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessAuthorityTransitionStore`.
2. In-memory v124 authority-transition storage with append-time replay validation.
3. Postgres v124 authority-transition storage with tenant-scoped sequence, hash-chain columns, transition JSONB, and indexes.
4. `StoreBackedProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessQuorumCertifier`.
5. A store-backed certification path that refuses process-local topology and recovers topology from durable history.

## 4. Missing Substrate Map Delta

Still missing after v125:

1. Signature-bound observer identity and admitted key metadata for v124 witness rows.
2. Key-status replay, rotation, and revocation for v124 witness identity.
3. Non-retroactive authority epoch seals for already certified v124 heads.
4. Durable quorum-certificate proof records for certified v124 currentness.
5. Proof-preserving compaction/pruning for v124 authority and future certificate histories.
6. Runtime and Axis adoption of store-backed v124 certification.
7. Live Postgres restart proof for v125 authority-store recovery.
8. SQL migration/backfill hardening for deployments with existing v124 in-memory topology assumptions.
9. Generic nested currentness/witness abstraction to replace layer-specific repetition.
10. Recovery-kernel inventory for every compacted/pruned required head and supporting authority store.

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
10. SQ73: What signature-bound observer identity and key-status replay prevents forged, unsigned, old-key, or revoked-key v125 witness evidence from certifying history-store-head pruning tombstone-store head currentness?

## 6. Primitive Proposal Ledger

Name: History Store-Head Pruning Tombstone Store-Head Witness Authority Store.

Problem it solves: v124 quorum topology was replayable but not yet durable; a caller could still provide synthetic authority transitions from memory or adapter state.

Research source: Raft replicated logs and configuration changes; ARIES write-ahead recovery; tamper-evident logging.

Mechanism borrowed or adapted: authority topology is not an argument to certification. It is reconstructed from stored, hash-linked, tenant-scoped transition history before witness records can count.

Why current substrate lacks it: v124 stopped single-observer certification but left the topology transition list as an in-memory object.

Why existing primitives are insufficient: older durable authority stores govern older required-head namespaces. Reusing them would let one layer's authority certify a different layer's state object.

State guarantee it should create: amnesiac certification of history-store-head pruning tombstone-store head currentness can recover topology from admitted durable history alone.

Admission rule it requires: appenders must compute sequence and previous hash, build the canonical authority hash, replay the resulting history, and reject malformed quorum or witness transitions before storage.

Replay rule it requires: certification must list stored authority transitions, replay them at the requested head sequence, list v123 witness records, replay those records, and only then evaluate quorum.

Authority boundary it requires: v125 authority governs only v123 witness observations over v122 pruning tombstone-store heads for the pruning tombstone history-store head lane.

Failure modes it should prevent:

- store-backed certification with no durable topology;
- process memory supplying a synthetic topology;
- tampered stored authority transitions passing replay;
- one stored witness satisfying a two-witness quorum;
- witness records certifying under a topology that cannot be recovered after restart.

Minimal implementation slice:

- Add v125 store interfaces.
- Add in-memory and Postgres store implementations.
- Add migration `0053`.
- Add store-backed certifier.
- Extend focused agent-state tests with missing-store, tampered-store, one-witness, and two-witness cases.

Tests that would falsify it:

- Empty authority store certifies a head.
- Tampering a stored authority transition hash still yields valid replay.
- Store-backed certifier accepts a caller-supplied topology instead of replaying store history.
- One witness certifies under a stored two-witness quorum.
- Two stored admitted witnesses cannot certify after accepting the same head.

Axis surfaces that could later validate it:

- Axis C can restart with v123 witness rows and v125 authority rows and demand certified currentness without chat memory.
- Axis A can try to recover finance state from adapter-supplied v124 topology and fail strict certification.
- Axis B can require domain adapters to cite store-backed currentness rather than local pruning summaries.

## 7. Falsification Criteria Used For This Slice

1. A store-backed certifier with witness records but no authority-store transitions must not certify.
2. A tampered stored authority transition must fail v124 topology replay.
3. A stored two-witness topology plus one accepted witness must not certify.
4. A stored two-witness topology plus two accepted witnesses for the exact head must certify.
5. The certificate must carry the stored topology hash rather than a caller-supplied in-memory topology hash.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Pure replayable authority transitions are enough if callers pass the right array. | Rejected. | v125 adds authority-transition stores and a store-backed certifier. |
| V124 topology can safely live beside certification as process-local state. | Rejected. | Empty stored authority now obstructs store-backed certification even when witness rows exist. |
| Tampered authority history is only a persistence-layer concern. | Rejected. | v125 replay rejects tampered authority hashes before certification. |

## 9. Implementation Frontier

Implemented now:

1. V125 authority-transition append/list store contract.
2. In-memory v125 authority-transition store.
3. Postgres v125 authority-transition store and migration `0053`.
4. Store-backed v125 quorum certifier over v124 topology and v123 witness replay.
5. Focused tests for missing durable topology, tampered stored authority replay, one-witness non-certification, and two-witness certification.

Remaining frontier:

1. SQ73 signature-bound observer identity and key-status replay.
2. Authority epoch seals and durable quorum-certificate proof records.
3. Proof-preserving compaction/pruning for v125 authority and proof histories.
4. Runtime/Axis adoption and live Postgres restart proof.
5. Generic nested currentness abstraction and recovery-kernel inventory.

## 10. Proof Status

Commands run:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
pnpm typecheck
git diff --check
rg -n "[ \t]$" db/migrations/0053_agent_state_history_store_head_pruning_tombstone_store_head_witness_authority.sql research/daily-arrowsmith-agent-state/v125-history-store-head-pruning-tombstone-store-head-witness-authority-store-2026-06-26.md
```

Current result:

- `@pm/agent-state` typecheck passed.
- Root Vitest run via the targeted command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root workspace typecheck passed.
- Diff whitespace check passed.
- Explicit trailing-whitespace check on new untracked v125 files returned no matches.

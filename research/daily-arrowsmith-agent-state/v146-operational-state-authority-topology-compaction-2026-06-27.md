# v146 - Operational State Authority-Topology Compaction

Date: 2026-06-27
Question closed: SQ93

## Research Question

What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?

## Sources

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm (Raft)", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", PODC 2009: https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", MIT technical report 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

## Mechanism Extracted

Raft snapshots are not arbitrary summaries: a snapshot carries the log frontier that it replaces and the membership configuration needed to continue safely from that frontier. Vertical Paxos separates the reconfiguration master from ordinary command execution, making configuration history part of the replicated state that recovery must respect. Viewstamped Replication treats group membership changes as protocol state, not operator memory. Dynamic Byzantine quorum systems add the missing pressure for pm-substrate: quorum threshold and membership changes are themselves security-critical state, so a compaction rule must preserve the configuration needed to interpret later certificates.

The substrate adaptation is generic authority-topology compaction. Once authority-transition prefixes are pruned, the substrate must not accept a caller-supplied "current topology" as operational authority. Recovery must start from a hash-bound topology checkpoint whose frontier is the exact compacted authority sequence, then replay a sequence-contiguous retained authority-transition suffix until it reconstructs the required topology projection.

## Existing Substrate Map

- v135 defined replayed witness quorum topology for v133 pruning tombstone-store head currentness.
- v136 added durable authority-transition stores and store-backed certifiers for that topology.
- v137-v138 added replayed key status and authority epoch seals.
- v139-v145 added generic recovery cuts, store-root transparency, pruning-policy compilation, storage mutation guards, tombstone-history compaction, witness-ledger compaction, and quorum-certificate proof records.
- Existing target-specific authority stores can replay full authority-transition history when it is still retained.

## Missing Substrate Map

- Before v146, there was no generic replay seed for compacted authority-transition history.
- A pruned authority-transition prefix could force topology recovery to depend on a remembered topology object, adapter-supplied eligible-witness list, or full unpruned authority history.
- Existing tombstone-history and witness-ledger compaction preserve data/currentness lanes, but not the authority topology that interprets later witness and certificate lanes.
- Existing quorum-certificate proof records can bind an authority topology hash, but they do not reconstruct the topology after authority-store pruning.
- Still missing after v146: admission authority for topology checkpoints, automatic adoption by the layer-specific authority stores, checkpoint compaction/currentness, live Postgres restart proof, and signatures over authority transition/admission records.

## Primitive Proposal

Name: operational state authority-topology compaction.

Problem it solves: preserves replay-current authority topology after authority-transition prefixes are physically pruned, so an amnesiac agent can recover topology from admitted history rather than memory, summaries, connector caches, or adapter-provided witness lists.

Research source: Raft snapshots with configuration state, Vertical Paxos reconfiguration state, Viewstamped Replication group reconfiguration, and Dynamic Byzantine Quorum Systems dynamic membership/threshold state.

Mechanism borrowed: compact protocol configuration only by binding a checkpoint to the replaced log frontier, then require retained suffix replay to reconstruct the current configuration.

Why current substrate lacked it: v136 made authority stores durable, but generic compaction existed for tombstone history and witness ledgers only; authority-transition history itself still lacked a compacted replay seed.

Why existing primitives are insufficient: recovery cuts can demand an authority-history lane, witness-ledger compaction can recover accepted heads, and proof records can preserve certificates, but none of those reconstructs the authority topology after the authority-transition store is compacted.

State guarantee it should create: an authority topology can become recovered operational authority after compaction only when a hash-valid checkpoint plus contiguous retained authority-transition suffix reconstructs the exact required topology hash and authority sequence.

Admission rule it requires: checkpoint records must bind tenant, topology id, authority scope, compacted-through authority sequence, compacted topology, retained-from sequence, checkpointing identity/time, and checkpoint hash.

Replay rule it requires: replay must verify checkpoint hash, compacted topology hash, checkpoint scope, compacted frontier, retained suffix start, retained transition hashes, tenant/scope continuity, sequence continuity, previous-hash continuity, transition validity, and exact required-topology recovery.

Authority boundary it requires: `operational-state-authority-topology-compaction.v1` checkpoints are append-only replay seeds; a later SQ103 admission rule must prevent self-authored topology snapshots from entering the checkpoint lane.

Failure modes it should prevent: private topology memory authorizing currentness, adapter witness-list smuggling, stale topology snapshots outranking transition replay, retained suffix gaps, broken authority hash chains, transition tampering, checkpoint tampering, and topology recovery after authority prefix pruning without a replay seed.

Minimal implementation slice: add generic authority-transition/topology/checkpoint types, deterministic hashes, topology projection, compaction evaluation, append-only migration, and tests for valid recovery plus checkpoint/suffix/stale-topology falsifiers.

Tests that would falsify it: recovery without checkpoint passes; tampered checkpoint passes; retained suffix gaps pass; broken previous-authority hash passes; stale required topology passes; valid checkpoint plus retained suffix cannot recover the required topology.

Axis surfaces that could later validate it: Axis C amnesiac recovery after authority-store pruning, Axis A finance recovery paths that need certified currentness after compacted authority stores, and Axis B adapter attempts to provide witness topology without replayable checkpoint history.

## Falsification Criteria

- A compacted checkpoint through authority sequence 2 plus retained transitions 3 and 4 must recover the exact authority topology at sequence 4.
- Recovery without a checkpoint must produce `operational_state_authority_topology_checkpoint_missing`.
- A retained suffix that skips sequence 2 must produce `operational_state_authority_topology_retained_suffix_gap`.
- A retained suffix whose first previous hash does not match the compacted topology record hash must produce `operational_state_authority_topology_retained_suffix_previous_hash_mismatch`.
- A tampered checkpoint must produce `operational_state_authority_topology_checkpoint_hash_mismatch`.
- A stale required topology must produce `operational_state_authority_topology_required_topology_sequence_mismatch` and `operational_state_authority_topology_required_topology_hash_mismatch`.

## Active 10-Question Backlog

1. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
2. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
3. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
4. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
5. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
6. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
7. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
8. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
9. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
10. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?

## Failed Assumption Ledger

- Falsified: durable authority-transition stores are enough once authority history itself is compacted.
- Falsified: a topology hash inside a quorum-certificate proof record can reconstruct topology after authority-prefix pruning. It can bind the topology identity, but not recover the topology projection.
- Still open: v146 supplies generic checkpoint-plus-suffix replay for authority topology, but checkpoint authority admission, runtime authority-store adoption, checkpoint currentness, and live Postgres recovery remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateAuthorityTransitionRecord`, `OperationalStateAuthorityTopology`, `OperationalStateAuthorityTopologyCompactionCheckpoint`, evaluation, and issue types.
- `buildOperationalStateAuthorityTransitionRecord()`, `operationalStateAuthorityTopologyFromTransition()`, `buildOperationalStateAuthorityTopologyCompactionCheckpoint()`, deterministic transition/topology/checkpoint hashing, and verification helpers.
- `evaluateOperationalStateAuthorityTopologyCompaction()` for checkpoint validation, compacted-topology validation, retained suffix continuity, previous-authority hash continuity, transition validity, and required-topology reconstruction.
- Migration `0063_agent_state_authority_topology_compaction_checkpoints.sql` with append-only durable checkpoint rows.
- Tests for valid compacted authority-topology recovery, missing-checkpoint refusal, retained suffix gap refusal, previous-hash refusal, tampered-checkpoint refusal, and stale required-topology refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ93 is closed. SQ94 is now the active next substrate question.

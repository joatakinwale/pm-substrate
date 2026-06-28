# v135 - History-Store Head Pruning Tombstone-Store Head Pruning Tombstone-Store Head Witness Quorum Topology

Date: 2026-06-27
Question closed: SQ82

## Research Question

What quorum topology certifies the v133 pruning tombstone-store head instead of letting one observer define currentness?

## Sources

- Malkhi and Reiter, "Byzantine Quorum Systems", Distributed Computing 1998: https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE S&P 2016: https://discovery.ucl.ac.uk/10116629/1/Jovanovic_cosi.pdf

## Mechanism Extracted

Byzantine quorum systems make the missing boundary explicit: a value is not current because one replica or observer reports it. It becomes usable only when enough eligible participants, under a defined failure/topology model, support the same value and conflicting eligible reports become safety evidence. Dynamic Byzantine quorum systems add the reconfiguration pressure: clients using stale or synthetic configurations can break safety, so topology itself must be replayed state. PBFT adds the state-machine framing: certificates are threshold evidence over a specific operation/view, not private belief. CoSi adds the authority-witness bridge: an authority should be strengthened by witnesses that cosign an authority statement rather than letting the authority or a lone monitor define freshness.

The substrate adaptation is a v134-witness quorum topology for the v133 pruning tombstone-store head. Authority transitions set the witness threshold and admit/suspend/revoke eligible witnesses. Replay projects the effective topology for a pruning tombstone sequence. A quorum certificate then counts only accepted v134 witness records from eligible observers for the exact head, rejects unauthorized observers, treats eligible same-sequence conflicts as obstructions, hashes the certificate body, and lets strict v133 continuity require this certified object before a recovered head can authorize pruned recovery.

## Existing Substrate Map

- v133 derives a compact head from replayed v132 pruning tombstone records and can compare local tombstone history to a required head.
- v134 makes that required head recoverable from hash-linked witness observations rather than memory, connector caches, summaries, or adapter input.
- Earlier v124 topology showed the same kind of substrate boundary for the previous target layer, including authority replay and quorum evaluation.

## Missing Substrate Map

- Before v135, v134 witness replay could recover a required head, but one observer could still be treated as currentness authority.
- The v134 witness ledger had no replayed membership or threshold state, so unauthorized observers and single monitors were not structurally excluded from certification.
- Strict v133 continuity could consume a raw recovered head but could not require quorum-certified currentness for that recovered head.
- Still missing after v135: durable authority-transition stores for this topology, key-status replay, epoch seals/finality, durable quorum-certificate proof records, runtime/Axis adoption, split-history gossip, storage-level guards, generic recovery, and generic pruning-policy compilation.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head pruning tombstone-store head witness quorum topology.

Problem it solves: prevents a single v134 observer, an unauthorized monitor, or an adapter-supplied witness list from certifying the v133 required head as operational currentness.

Research source: Byzantine Quorum Systems, Dynamic Byzantine Quorum Systems, PBFT, and CoSi.

Mechanism borrowed: replayed membership plus threshold certificate over a specific value, with conflicting eligible observations converted into safety obstructions.

Why current substrate lacked it: v134 recovered the required head from witness replay but did not define who was eligible to witness or how many accepted witnesses are required.

Why existing primitives are insufficient: a witness ledger proves observation history; it does not prove the observer is authorized or that enough independent witnesses accepted the same head.

State guarantee it should create: a recovered v133 required head is certified currentness only when a replayed topology says enough eligible witnesses accepted that exact head.

Admission rule it requires: quorum certificates may count only accepted v134 witness records whose observer ids are active in the replayed topology at the head's pruning tombstone sequence.

Replay rule it requires: authority transitions are sorted by authority sequence, previous-hash chained, body-hash checked, and projected into threshold plus active principal state before quorum evaluation.

Authority boundary it requires: `projection_replay_pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum`.

Failure modes it should prevent: single-witness certification, unauthorized observer certification, topology tampering, policy/topology mismatch, missing quorum certificate, non-certified certificate consumption, and head mismatch between a certificate and required continuity.

Minimal implementation slice: v135 authority-transition types/builders/hashes, topology replay, quorum certificate evaluation/hashing, strict v133 continuity certificate gate, and focused falsification tests.

Tests that would falsify it: one witness certifies; unauthorized witness is counted; tampered topology still certifies; strict continuity accepts missing or non-certified certificate when required; certificate head mismatch is not rejected; or a certified quorum cannot drive strict continuity.

Axis surfaces that could later validate it: Axis C amnesiac recovery under multi-agent witness pressure; Axis A finance target recovery after pruning; Axis B adapter pressure once authoritative fixtures exist.

## Falsification Criteria

- A single accepted v134 witness record under a two-witness topology must not certify.
- Two accepted v134 witness records from replay-eligible observers must certify the exact v133 head.
- A witness outside the replayed topology must be listed as invalid and must not count toward quorum.
- Tampered authority-transition hashes must invalidate topology and obstruct certification.
- Strict v133 continuity must accept a certified quorum certificate and reject missing, non-certified, or head-mismatched certificates.

## Active 10-Question Backlog

1. SQ83: What authority-transition store makes that topology replayable across agents and restarts?
2. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v133 pruning tombstone-store head?
3. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v133 pruning tombstone-store head certification?
4. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
5. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, and required-head stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
6. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
7. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
8. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
9. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
10. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?

## Failed Assumption Ledger

- Falsified: recovered witness currentness is certified currentness. v134 can recover a head, but v135 proves one recovered observer is insufficient.
- Falsified: a locally supplied topology object should be enough long term. v135 uses replayed transition arrays, but SQ83 must make those transitions durable so topology is not memory state.
- Still open: v135 certification has no signature/key-status replay, epoch finality, or durable proof-record history yet.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition`
- `buildProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition`
- `replayProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions`
- `evaluateProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificate`
- `computeProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateHash`
- strict `verifyProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPrunedStoreContinuity` support for v135 quorum certificates

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ82 is closed. SQ83 is now the active next substrate question.

# v130 - History-Store Head Pruning Tombstone-Store Head Durable Checkpoint-Admission Store

Date: 2026-06-27
Question closed: SQ77

## Research Question

What durable checkpoint-admission record store makes v129 checkpoint authority recoverable after amnesia rather than supplied as an in-memory certificate?

## Sources

- Li, Krohn, Mazieres, and Shasha, "Secure Untrusted Data Repository (SUNDR)", OSDI 2004: https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf
- Crosby and Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009: https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Chuat et al., "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs", IEEE CNS 2015: https://netsec.ethz.ch/publications/papers/gossip2015.pdf

## Mechanism Extracted

SUNDR makes untrusted storage safe by shifting the guarantee from "the server returned the right state" to "clients can detect forks once histories are compared." Tamper-evident logging makes the same point as a data structure: a record is believable only when membership and consistency with prior log views can be proven. CONIKS and Certificate Transparency gossip add the non-equivocation bridge: clients should not trust a provider's latest binding or tree head as private state; they need an auditable, comparable history that exposes split views.

The substrate mechanism is therefore durable checkpoint-admission history: a checkpoint body and its admission certificate are stored together as a tenant-scoped, sequence-bound, hash-linked record. Replay recomputes the checkpoint hash, recomputes the admission hash, re-runs strict checkpoint admission under the checkpoint's authority snapshot, checks previous-record continuity, and rejects checkpoint id/frontier equivocation. A recovered compacted replay may use only the latest record admitted by that replay, not a certificate remembered by an agent or supplied by an adapter.

## Existing Substrate Map

- v123-v128 already make the target required-head currentness layer durable: witness records, replayed quorum topology, key-status replay, epoch seals, and quorum-certificate proof records exist.
- v129 adds target replay compaction checkpoints and strict witness-signed checkpoint admission over the exact checkpoint hash.
- v129 also teaches target witness, authority/key/seal, and QC-record replay how to seed from an admitted checkpoint frontier.

## Missing Substrate Map

- Before v130, v129 compacted recovery still depended on an in-memory checkpoint admission certificate object.
- The missing primitive was a durable target-layer checkpoint-admission record store with replayable non-equivocation checks.
- The missing admission rule was: checkpoint admission is not operational unless it is recovered from a replay-valid admission-record chain.
- The missing replay rule was: only the replay-derived latest admission record may seed retained suffix replay after amnesia.
- The next missing substrate primitive is pruning admission for this target layer: durable admission history plus retained suffix continuity must exist before physical prefix deletion can be admitted.
- The broader missing primitive is split-history transparency for durable admission stores: local replay validity is not enough if two agents can hold incompatible store histories without comparing heads.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head durable checkpoint-admission store.

Problem it solves: prevents target-layer compaction authority from being supplied by private memory, conversation summary, connector cache, or adapter object after agent amnesia.

Research source: SUNDR fork consistency, Crosby/Wallach tamper-evident logs, CONIKS key transparency, and Certificate Transparency gossip.

Mechanism borrowed: append-only hash-linked history with replayed body hashes, consistency links, and equivocation detection over identity/frontier bindings.

Why current substrate lacked it: v129 had admitted checkpoints but no durable admission-record chain for those checkpoint certificates.

Why existing primitives are insufficient: checkpoint admission certificates prove a checkpoint hash only while the object is available; they do not prove the certificate is part of replayed durable operational history.

State guarantee it should create: compacted replay can recover checkpoint authority from admitted transition history alone.

Admission rule it requires: checkpoint plus admission must replay as a strict, admitted, hash-valid record in sequence with the prior admission record.

Replay rule it requires: record replay must sort by sequence, check tenant and previous-record hash continuity, recompute checkpoint/admission/record hashes, revalidate strict admission, and reject checkpoint id or compacted-frontier conflicts.

Authority boundary it requires: `projection_replay_pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_replay_compaction_checkpoint_admission`.

Failure modes it should prevent: memory-supplied checkpoint certificates, tampered checkpoint bodies, tampered admission certificates, broken admission chains, same-id checkpoint forks, same-frontier checkpoint forks, and adapter-supplied recovered state.

Minimal implementation slice: target checkpoint-admission record types, deterministic record hashing, record replay, in-memory/Postgres stores, migration `0055`, and focused tests using the replay-recovered latest admission record to seed compacted replay.

Tests that would falsify it: compacted replay succeeds only with an admission object that was never in durable history; a tampered record hash still replays valid; a conflicting checkpoint id/frontier replays valid; or the store accepts a record whose admission no longer replays under strict signature policy.

Axis surfaces that could later validate it: Axis C amnesiac local-agent recovery after target checkpoint compaction; Axis A finance proof-history pruning once the target layer is used by finance recovery; Axis B adapter pressure once accepted agency fixtures or PluggedInSocial evidence exists.

## Falsification Criteria

- A replay-recovered latest admission record must seed target retained suffix replay successfully.
- A checkpoint plus admission certificate not present in durable admission history must not count as recovered authority.
- A tampered checkpoint-admission record hash must fail replay.
- A conflicting checkpoint with the same checkpoint id or compacted frontier but a different checkpoint hash must fail replay.
- Store append must reject any record chain that fails strict checkpoint-admission replay.

## Active 10-Question Backlog

1. SQ78: What pruning admission rule requires v130 durable checkpoint-admission history plus retained suffix continuity before physical prefix deletion?
2. SQ79: What tombstone-gated store pruning API makes actual v130 witness, authority/key/seal, and QC-record deletion replayable?
3. SQ80: What currentness object proves the v130 pruning tombstone history itself is current rather than merely replay-valid?
4. SQ81: What durable witness ledger recovers the v130 pruning tombstone-store head after amnesia?
5. SQ82: What quorum topology certifies the v130 pruning tombstone-store head instead of letting one observer define currentness?
6. SQ83: What authority-transition store makes that topology replayable across agents and restarts?
7. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v130 pruning tombstone-store head?
8. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v130 pruning tombstone-store head certification?
9. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
10. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?

## Failed Assumption Ledger

- Falsified: v129 admitted checkpoint certificates are enough for amnesiac compacted replay. They are necessary, but without durable record history they can still be supplied by memory or an adapter.
- Still open: local durable admission-record replay does not yet detect split histories across agents unless their histories are compared through a future witness/gossip/currentness layer.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionCheckpointAdmissionRecord`
- `replayProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionCheckpointAdmissionRecords`
- `InMemoryProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionCheckpointAdmissionRecordStore`
- `PostgresProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionCheckpointAdmissionRecordStore`
- migration `0055_agent_state_history_store_head_pruning_tombstone_store_head_checkpoint_admissions.sql`

Verification:

- `pnpm typecheck`
- `pnpm test`

Outcome: SQ77 is closed. SQ78 is now the active next substrate question.

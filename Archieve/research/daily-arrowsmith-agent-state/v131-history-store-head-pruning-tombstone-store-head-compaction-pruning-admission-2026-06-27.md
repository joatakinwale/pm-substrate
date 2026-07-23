# v131 - History-Store Head Pruning Tombstone-Store Head Compaction Pruning Admission

Date: 2026-06-27
Question closed: SQ78

## Research Question

What pruning admission rule requires v130 durable checkpoint-admission history plus retained suffix continuity before physical prefix deletion?

## Sources

- Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging", ACM TODS 1992: https://web.stanford.edu/class/cs345d-01/rl/aries.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf

## Mechanism Extracted

ARIES does not let a dirty page image become database state by memory alone; recovery repeats history from logged records and checkpoint boundaries. Raft snapshotting keeps a compacted log safe by preserving the last-included index and term, so the retained suffix has a precise predecessor. PBFT stable checkpoints add the authority condition: a replica can discard older requests only when a quorum-certified checkpoint is stable.

The substrate mechanism is therefore pruning admission, distinct from checkpoint admission. A checkpoint may be admitted and durable, but physical prefix deletion is not admitted until durable checkpoint-admission history replays and every retained lane replays from that admitted checkpoint frontier. The admission object names the lanes being pruned, records suffix counts, hashes its decision, and returns obstruction issues when the durable record is missing, checkpoint-admission history is invalid, or any suffix cannot replay from the checkpoint.

## Existing Substrate Map

- v129 builds deterministic target replay compaction checkpoints for history-store-head pruning tombstone-store head witness, authority/key/seal, and quorum-certificate proof-record lanes.
- v130 stores those checkpoint bodies and admission certificates in durable hash-linked checkpoint-admission record history.
- Target witness, authority/key/seal, and quorum-certificate replay functions already know how to seed from an admitted checkpoint frontier.

## Missing Substrate Map

- Before v131, the target layer had no separate admission object for physical prefix deletion.
- A durable checkpoint-admission record could prove compacted replay authority, but it did not prove that retained suffixes for all pruned lanes still replay from the checkpoint.
- The missing rule was a deletion precondition: deletion requires both replayed checkpoint authority and retained suffix continuity.
- The missing obstruction was lane-specific refusal for witness suffix, authority suffix, quorum-certificate suffix, missing durable record, and invalid durable record history.
- The next missing primitive is a tombstone-gated store pruning API: v131 admits deletion, but it does not yet record that deletion as durable tombstone history or remove rows through store methods.
- The broader missing primitive is a generic pruning-policy compiler so future nested stores do not require hand-repeating this checkpoint-admission, pruning-admission, tombstone, currentness, witness, quorum, and recovery ladder.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head compaction pruning admission.

Problem it solves: prevents target witness, authority/key/seal, or quorum-certificate proof-record prefixes from being physically deleted because an agent remembers a checkpoint or sees a local snapshot.

Research source: ARIES recovery checkpoints, Raft log compaction, and PBFT stable checkpoints.

Mechanism borrowed: garbage collection is allowed only after a durable checkpoint is authoritative and the retained suffix has a replay-valid predecessor boundary.

Why current substrate lacked it: v130 made checkpoint admission recoverable but left deletion as an implied next action instead of a separately admitted transition decision.

Why existing primitives are insufficient: checkpoint admission proves a checkpoint hash; it does not prove that the suffix left behind after deletion can still reconstruct operational state.

State guarantee it should create: private memory, local snapshots, or adapter claims cannot authorize target prefix deletion; deletion requires replayed checkpoint-admission history plus lane-specific retained suffix replay.

Admission rule it requires: `evaluateProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningAdmission` admits only when the supplied checkpoint admission record is present in replay-valid durable record history and the requested lanes replay from that admitted checkpoint frontier.

Replay rule it requires: durable checkpoint-admission records must replay first; witness, authority/key/seal, and quorum-certificate suffixes must then replay with the checkpoint and its recovered admission as their seed.

Authority boundary it requires: `projection_replay_pruning_tombstone_history_store_head_pruning_tombstone_store_head_witness_replay_compaction_pruning_admission`.

Failure modes it should prevent: deleting prefixes from a memory-supplied checkpoint certificate, deleting when checkpoint-admission history is missing or conflicting, deleting when retained suffixes start before/after the checkpoint frontier incorrectly, and treating row absence as state before tombstone history exists.

Minimal implementation slice: target pruning-admission types, deterministic pruning-admission hash, lane selection, durable checkpoint-admission replay requirement, retained suffix replay checks for all three lanes, and focused falsification tests.

Tests that would falsify it: pruning admission succeeds with no durable checkpoint-admission record; succeeds with conflicting durable checkpoint history; succeeds when the witness suffix includes compacted records; succeeds when authority suffix starts from the compacted authority transition; or succeeds when quorum-certificate suffix includes a compacted proof record.

Axis surfaces that could later validate it: Axis C amnesiac local-agent recovery after target proof-history pruning; Axis A finance proof-history pruning once finance uses target recovery; Axis B adapter pressure once accepted agency/PluggedInSocial fixtures exist.

## Falsification Criteria

- Valid pruning admission must require the v130 checkpoint-admission record to be present in replay-valid durable history.
- Valid pruning admission must require retained witness suffix replay from the recovered checkpoint/admission.
- Valid pruning admission must require retained authority/key/seal suffix replay from the recovered checkpoint/admission.
- Valid pruning admission must require retained quorum-certificate proof-record suffix replay from the recovered checkpoint/admission.
- Missing durable record history, conflicting durable record history, and any lane-invalid retained suffix must return obstructed admission.

## Active 10-Question Backlog

1. SQ79: What tombstone-gated store pruning API makes actual v131 witness, authority/key/seal, and QC-record deletion replayable?
2. SQ80: What currentness object proves the v131 pruning tombstone history itself is current rather than merely replay-valid?
3. SQ81: What durable witness ledger recovers the v131 pruning tombstone-store head after amnesia?
4. SQ82: What quorum topology certifies the v131 pruning tombstone-store head instead of letting one observer define currentness?
5. SQ83: What authority-transition store makes that topology replayable across agents and restarts?
6. SQ84: What key-status replay prevents stale or revoked witnesses from certifying the v131 pruning tombstone-store head?
7. SQ85: What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v131 pruning tombstone-store head certification?
8. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
9. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission and pruning-admission stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
10. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?

## Failed Assumption Ledger

- Falsified: a durable admitted checkpoint is enough to authorize physical deletion. It is enough to seed compacted replay, but deletion needs a second admission step that proves retained suffix continuity.
- Still open: v131 admits deletion but does not yet persist a deletion tombstone or execute row pruning through store APIs.
- Still open: local replay-valid checkpoint/pruning histories can still split across agents until a future transparency/gossip layer compares heads.

## Proof Status

Implemented in `@pm/agent-state`:

- `ProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningAdmission`
- `computeProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningAdmissionHash`
- `evaluateProjectionReplayPruningTombstoneHistoryStoreHeadPruningTombstoneStoreHeadWitnessReplayCompactionPruningAdmission`

Verification:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`
- `pnpm typecheck`
- `pnpm test`

Outcome: SQ78 is closed. SQ79 is now the active next substrate question.

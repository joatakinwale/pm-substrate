# v138 - History-Store Head Pruning Tombstone-Store Head Pruning Tombstone-Store Head Witness Authority Epoch Seal

Date: 2026-06-27
Question closed: SQ85

## Research Question

What epoch-seal or finality model prevents later topology/key changes from retroactively rewriting v133 pruning tombstone-store head certification?

## Sources

- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", PODC 2009: https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm (Extended Version)", 2014: https://raft.github.io/raft.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Castro and Liskov, "Practical Byzantine Fault Tolerance", OSDI 1999: https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf

## Mechanism Extracted

The shared mechanism is not a particular consensus brand. It is the separation between historical decision authority and later authority reconfiguration. Vertical Paxos makes configuration choice an explicit authority decision rather than local inference by later leaders. Raft's joint consensus shows that a direct switch between configurations can violate safety, so membership change must be represented in the replicated history. Viewstamped Replication uses epoch boundaries: a new epoch may process later operations only after preserving committed earlier operations. PBFT checkpointing adds the low-water-mark pressure: once a stable proof fixes a frontier, later protocol activity cannot rewrite history below it.

The substrate adaptation is a target-layer `seal_authority_epoch` transition for the v135/v137 authority history that certifies v133 pruning tombstone-store heads. The seal binds a pruning tombstone-store head sequence to the effective authority topology hash and the quorum certificate hash that certified it. Replay keeps the seal in the append-only authority chain but does not let the seal replace the effective topology hash. Later non-seal topology or key-status transitions effective at or before the sealed sequence become authority obstructions instead of retroactively changing the certification basis.

## Existing Substrate Map

- v133 derives the target pruning tombstone-store head from admitted v132 pruning tombstone history.
- v134 recovers that required head from hash-linked witness observations after amnesia.
- v135 certifies the required head with replayed witness topology and quorum certificates.
- v136 recovers the v135 topology from durable authority-transition stores.
- v137 requires v134 witness rows to be signed by replay-current keys projected from v135/v137 authority history.

## Missing Substrate Map

- Before v138, later v137 `rotate_signature_key` or topology transitions effective at the same v133 sequence could be replayed as if they governed the already certified head.
- Before v138, the target layer had no finality object binding a certificate to the exact authority topology hash under which it was produced.
- Existing key-status replay was insufficient because key currentness answers which signatures count at a replay point; it did not freeze the historical authority basis of a certified point.
- Existing durable authority stores were insufficient because append-only history can still contain later entries unless replay has an explicit sealed-frontier obstruction rule.
- Still missing after v138: durable QC proof records for this target certification, finalizer signatures on seal transitions, authority-store compaction, witness-ledger compaction, production verifier adapters, split-history transparency, storage-level SQL guards, a generic recovery kernel, and generic pruning-policy compilation.

## Primitive Proposal

Name: history-store-head pruning tombstone-store head pruning tombstone-store head witness authority epoch seal.

Problem it solves: prevents later topology or key-status changes from retroactively governing a previously certified v133 required head.

Research source: Vertical Paxos, Raft reconfiguration, Viewstamped Replication epochs, and PBFT stable checkpoints.

Mechanism borrowed: committed reconfiguration/finality boundaries separate historical authority from later authority history, and stable frontiers reject later edits below the finalized point.

Why current substrate lacked it: v137 had durable topology and key-status replay, but no transition that finalized the authority basis used by a certified required-head quorum certificate.

Why existing primitives are insufficient: durable topology recovery, quorum certification, and key-status replay can reconstruct current authority, but without a sealed frontier a later same-sequence key rotation can still change which witness evidence counts for the historical certification.

State guarantee it should create: certified v133 pruning tombstone-store head currentness is constituted by the admitted non-seal authority topology hash and quorum certificate hash sealed at that sequence; later authority history cannot rewrite that basis.

Admission rule it requires: a `seal_authority_epoch` transition must be effective at the exact sealed pruning tombstone-store head sequence, must advance sealed frontiers monotonically, must bind the replay-effective authority topology hash, and must bind a non-empty quorum certificate hash.

Replay rule it requires: authority replay must project accepted seals into `authorityEpochSeals`, keep `effectiveAuthorityHash` equal to the sealed non-seal topology hash, advance `latestAuthorityHash` through the seal transition, and reject later non-seal transitions effective inside the sealed epoch.

Authority boundary it requires: finality belongs to the target authority-transition replay, not to witness memory, connector cache, local worktree state, or a certifier's in-memory result.

Failure modes it should prevent: retroactive key rotation after certification, retroactive quorum/topology mutation, forged seal topology hashes, seal/certificate mismatch, and certificate recertification under a later authority topology.

Minimal implementation slice: add target-layer seal fields and `seal_authority_epoch`; project `sealedThroughPruningTombstoneSequence` and `authorityEpochSeals`; reject forged seals and retroactive post-seal authority transitions; persist seal fields in migration `0058`; prove store-backed certification preserves the pre-seal topology hash.

Tests that would falsify it: a forged seal with the wrong topology hash replays as valid; a same-sequence key rotation appends after a seal; a sealed store-backed quorum certificate changes `authorityTopologyHash` to the seal hash; or a valid seal fails to preserve the certified topology hash.

Axis surfaces that could later validate it: Axis C amnesiac required-head recovery, Axis A finance recovery after authority rotation, and Axis B domain-adapter pressure once authoritative fixtures can supply certified required-head histories.

## Falsification Criteria

- A valid seal must replay with `sealedThroughPruningTombstoneSequence` set to the v133 required head sequence and exactly one `authorityEpochSeal`.
- The replayed `effectiveAuthorityHash` must remain the pre-seal topology hash while `latestAuthorityHash` advances to the seal hash.
- A store-backed certifier using the sealed authority store must still certify the same v133 head under the pre-seal topology hash.
- A forged seal whose `sealedAuthorityTopologyHash` does not match the replay-effective topology hash must produce an authority epoch seal invalid issue.
- A later `rotate_signature_key` effective at the sealed sequence must be rejected by the authority store with an authority retroactive transition issue.
- Migration `0058` must persist seal fields so Postgres replay can reconstruct the same authority transition body as in-memory replay.

## Active 10-Question Backlog

1. SQ86: What generic recovery kernel can inventory all nested compacted required-head layers and prove no private representation is needed for agent resume?
2. SQ87: What transparency or gossip primitive should attach to durable checkpoint-admission, pruning-admission, pruning-tombstone, and required-head stores so split histories across agents, connectors, or worktrees become obstructions rather than private operational state?
3. SQ88: What generic pruning-policy compiler can derive admission, tombstone, currentness, witness, quorum, and recovery ladders for any durable transition store without hand-duplicating nested authority boundaries?
4. SQ89: What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?
5. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
6. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
7. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
8. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
9. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
10. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?

## Failed Assumption Ledger

- Falsified: replayed key currentness is enough to preserve historical certification. v138 shows certification needs a finality frontier that later key/topology changes cannot cross retroactively.
- Falsified: the latest authority hash can stand in for the certification topology hash. v138 separates `latestAuthorityHash` chain progress from `effectiveAuthorityHash` used by the certificate.
- Still open: v138 seals target authority epochs but does not yet persist this layer's certified quorum proof record, sign seal transitions by finalizer principals, or compact this authority store.

## Proof Status

Implemented in `@pm/agent-state`:

- Target-layer `seal_authority_epoch` transition kind and seal payload fields.
- Target authority replay projection of `sealedThroughPruningTombstoneSequence` and `authorityEpochSeals`.
- Invalid-seal rejection for missing/incorrect frontier, topology hash, or quorum certificate hash.
- Retroactive-transition rejection for later non-seal authority changes effective inside a sealed epoch.
- Store-backed quorum certification that preserves the sealed pre-seal `effectiveAuthorityHash`.
- Postgres schema support for seal fields in migration `0058`.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`
- `git diff --check`
- `pnpm typecheck`
- `pnpm test`

Outcome: SQ85 is closed. SQ86 is now the active next substrate question.

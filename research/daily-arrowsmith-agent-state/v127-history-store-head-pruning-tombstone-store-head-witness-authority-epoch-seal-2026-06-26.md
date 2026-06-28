# v127 History Store-Head Pruning Tombstone Store-Head Witness Authority Epoch Seal

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v126-history-store-head-pruning-tombstone-store-head-witness-signature-key-status-2026-06-26.md`

## 1. Research Question Targeted

Closed question: SQ74 - What non-retroactive authority epoch seal prevents later v126 topology or key-status transitions from rewriting the authority basis of already certified history-store-head pruning tombstone-store heads?

Answer: v126 made witness signatures key-current at replay time, but the latest topology could still become the replay lens for older certified heads. The missing primitive is a replayed authority epoch seal for this exact nested currentness layer. A `seal_authority_epoch` transition now binds a pruning tombstone-store head sequence to the effective authority topology hash and the certified quorum certificate hash. Later topology or key-status transitions cannot be retroactive into that sealed sequence.

Implemented slice:

- Added `seal_authority_epoch` to the history-store-head pruning tombstone-store head witness authority transition kind.
- Added sealed sequence, sealed authority topology hash, and sealed quorum-certificate hash to transition inputs, hashes, topology replay, Postgres rows, and migration `0053`.
- Added authority epoch seal projection and `effectiveAuthorityHash` to this layer's replayed topology.
- Added replay errors for invalid seals and retroactive post-seal authority transitions.
- Updated quorum certificates to bind the effective sealed topology hash rather than the latest hash-chain tip when a seal exists.
- Added focused tests proving valid seal replay, preserved effective topology hash, forged-seal rejection, and store append rejection for post-seal retroactive key rotation.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Lamport, Malkhi, and Zhou 2009, "Vertical Paxos and Primary-Backup Replication" ([PDF](https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf), [Microsoft PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2009/05/podc09v6.pdf)) | Configuration changes are separate protocol events; the configuration master establishes which configuration governs an instance. | v127 makes the authority topology governing a certified head an explicit transition, not a later replay inference. |
| Liskov and Cowling 2012, "Viewstamped Replication Revisited" ([PDF](https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf), [MIT record](https://dspace.mit.edu/entities/publication/80846d94-fcd3-40e6-87fb-8d91fe99a5d1)) | Views and reconfiguration carry protocol state so later leaders cannot choose arbitrary prior state after failover. | v127 seals the authority epoch so an amnesiac replay cannot recertify old heads under a new witness/key topology. |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | View-change safety depends on proof of the previous committed state, not private claims by the new primary. | v127 binds the quorum-certificate hash into the seal transition so later authority replay must cite the certified proof it finalizes. |

## 3. Existing Substrate Map Delta

Already present before v127:

1. V123 durable witness rows that recover the required v122 pruning tombstone-store head after amnesia.
2. V124 quorum topology and certificates over replayed v123 witness rows.
3. V125 durable authority-transition stores and store-backed certification for v124 topology.
4. V126 signed witness rows and replayed key currentness for this layer.

Newly added by v127:

1. A v127 `seal_authority_epoch` transition for the history-store-head pruning tombstone-store head witness authority.
2. Seal fields in transition inputs, transition hashing, authority replay, Postgres rows, and migration `0053`.
3. `authorityEpochSeals`, `sealedThroughPruningTombstoneSequence`, and `effectiveAuthorityHash` in the replayed topology.
4. Replay rejection for forged seal hashes and non-monotonic seals.
5. Replay/store rejection for later retroactive topology or key-status transitions.
6. Quorum certificates that use the sealed effective topology hash when available.

## 4. Missing Substrate Map Delta

Still missing after v127:

1. Durable quorum-certificate proof records for certified v124/v127 currentness.
2. Proof-preserving compaction/pruning for v125/v127 authority, key-status, seal, and future certificate histories.
3. Runtime and Axis adoption of store-backed signed sealed v127 certification.
4. Live Postgres restart proof for sealed authority recovery.
5. SQL migration/backfill hardening for deployments with pre-v127 authority rows.
6. Production cryptographic verifier and finalizer signatures for seals.
7. Generic nested currentness/witness abstraction to remove layer-specific repetition.
8. Recovery-kernel inventory for every compacted/pruned required head and supporting sealed authority store.
9. Decision-time historical key-currentness rules that distinguish sealed certification time from latest topology.
10. A durable finality model for downstream writes that consume these sealed required-head certificates.

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
10. SQ75: What durable quorum-certificate proof record makes certified history-store-head pruning tombstone-store heads recoverable without transient recertification or later topology/key-status replay?

## 6. Primitive Proposal Ledger

Name: History Store-Head Pruning Tombstone Store-Head Witness Authority Epoch Seal.

Problem it solves: v126 certification could be replayed under the latest authority topology, letting later rotations, revocations, or topology edits change how historical certification is interpreted.

Research source: Vertical Paxos reconfiguration, Viewstamped Replication view changes/reconfiguration, and PBFT view-change proof.

Mechanism borrowed or adapted: the governing authority for a certification instance is fixed by an admitted protocol event that cites both the authority configuration and the committed proof.

Why current substrate lacks it: v126 had key-currentness replay but no non-retroactive seal for the authority epoch used by a certified head.

Why existing primitives are insufficient: older epoch-seal primitives govern adjacent layers. Reusing them would let one layer's authority finality certify a different layer's required-head object.

State guarantee it should create: once a history-store-head pruning tombstone-store head is certified and sealed, later witness topology or key-status transitions cannot retroactively become its authority basis.

Admission rule it requires: a seal transition must be effective at the sealed sequence, advance monotonically, bind the effective authority topology hash, and cite the quorum certificate hash it finalizes.

Replay rule it requires: replay must project accepted seals, preserve the effective authority hash separately from the latest hash-chain tip, and reject later non-seal transitions whose effective sequence falls inside the sealed range.

Authority boundary it requires: v127 seals only the v123/v124/v125 witness authority for v122 pruning tombstone-store heads in the pruning tombstone history-store head lane.

Failure modes it should prevent:

- a later key rotation rewriting the key authority used by an older certified head;
- a later revocation making an already certified sealed head uncertifiable by latest replay alone;
- a forged seal claiming the wrong authority topology hash;
- a seal without a quorum-certificate hash;
- a later retroactive topology transition modifying a sealed epoch.

Minimal implementation slice:

- Add seal transition fields and replay projection.
- Persist seal fields in the v125 authority store.
- Use the effective sealed authority hash in quorum certificates.
- Add focused falsifiers for forged seals and retroactive post-seal transitions.

Tests that would falsify it:

- A forged `sealedAuthorityTopologyHash` replays as valid.
- A seal without a quorum-certificate hash replays as valid.
- A later rotate/revoke/admit transition effective inside the sealed range appends successfully.
- A certified quorum after a seal binds the latest seal hash rather than the effective authority hash.
- A valid seal fails replay.

Axis surfaces that could later validate it:

- Axis C can restart after a seal and prove currentness from the sealed authority epoch without conversation memory.
- Axis A can attempt to recertify a finance pruning summary under newer adapter-supplied topology and fail.
- Axis B can require domain adapters to cite sealed required-head authority instead of current local witness-cache state.

## 7. Falsification Criteria Used For This Slice

1. A valid seal must replay and project `effectiveAuthorityHash`.
2. Quorum evaluation after a seal must preserve the sealed effective topology hash.
3. A forged sealed authority topology hash must invalidate replay.
4. A post-seal retroactive key rotation must be rejected by the authority store.
5. Seal fields must persist in the durable authority schema.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| Latest replayed key status is enough for historical certifications. | Rejected. | v127 stores and replays authority epoch seals. |
| A certified quorum hash is enough without sealing its authority topology. | Rejected. | v127 seal transitions bind both the quorum certificate hash and effective authority topology hash. |
| Retroactive topology changes are only a caller-policy concern. | Rejected. | v127 makes retroactive post-seal transitions replay/store errors. |

## 9. Implementation Frontier

Implemented now:

1. V127 seal transition type and fields.
2. V127 seal replay projection and retroactive-transition obstruction.
3. V127 Postgres schema and insert/select coverage for seal fields.
4. V127 quorum topology hash preservation via `effectiveAuthorityHash`.
5. Focused tests for valid seal replay, forged seal rejection, and retroactive store rejection.

Remaining frontier:

1. SQ75 durable quorum-certificate proof records.
2. Proof-preserving compaction/pruning for this sealed proof history.
3. Runtime/Axis adoption and live Postgres restart proof.
4. Generic nested currentness abstraction and recovery-kernel inventory.
5. Production crypto/finalizer signature adapter for seal transitions.

## 10. Proof Status

Commands run so far:

```bash
pnpm --filter @pm/agent-state typecheck
pnpm test -- packages/agent-state/src/index.test.ts
```

Current result:

- `@pm/agent-state` typecheck passed.
- Focused root Vitest command passed: 47 test files passed, 20 skipped; 477 tests passed, 143 skipped.
- Root `pnpm typecheck` passed.
- `git diff --check` passed.
- Explicit trailing-whitespace scan across the touched v127 files returned no findings.

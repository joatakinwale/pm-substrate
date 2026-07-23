# v119 Pruning Tombstone History Store-Head Durable Checkpoint Admission Store

Date: 2026-06-26
Status: substrate primitive implemented; focused verification passed
Parent: `research/daily-arrowsmith-agent-state/v118-pruning-tombstone-history-store-head-proof-preserving-compaction-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ66 - What durable checkpoint-admission record store and consistency proof makes pruning tombstone history-store head compaction authority recoverable after amnesia rather than supplied as an in-memory certificate?

Answer: v118 made history-store-head compaction checkpoints admissible, but a resumed agent still needed the checkpoint and admission certificate to be handed back by memory, a local snapshot, or adapter state. The missing substrate primitive is a durable, hash-chained checkpoint-admission record history for the history-store-head compaction namespace. A checkpoint admission can now seed replay only after the record history itself replays, revalidates the checkpoint and admission certificate under strict witness authority, and rejects equivocation by checkpoint id or compacted frontier.

Implemented slice:

- Added history-store-head replay compaction checkpoint-admission record types.
- Added deterministic checkpoint-admission record hashing.
- Added record-chain replay over tenant, sequence, previous hash, checkpoint hash, admission hash, strict admission re-evaluation, record hash, checkpoint-id conflict, and compacted-frontier conflict.
- Added in-memory and Postgres-backed checkpoint-admission record stores.
- Added migration `0050_agent_state_projection_replay_pruning_tombstone_history_store_head_checkpoint_admissions.sql`.
- Added focused tests proving recovered durable admissions can seed compacted replay while tampered or conflicting records fail.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging" ([USENIX Security PDF](https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf)) | Append-only tamper-evident logs let auditors verify that a presented history is a consistent extension rather than a rewritten private narrative. | Checkpoint admissions are now stored as a hash-linked record history; recovery consumes replayed records, not remembered certificates. |
| Li et al. 2004, "Secure Untrusted Data Repository (SUNDR)" ([USENIX OSDI](https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr), [PDF](https://www.usenix.org/event/osdi04/tech/full_papers/li_j/li_j.pdf)) | Fork consistency turns equivocation into a detectable condition when clients compare signed histories. | Replaying admission records rejects a second checkpoint hash for the same checkpoint id or compacted frontier, turning hidden forked checkpoint state into an obstruction. |
| Melara et al. 2015, "CONIKS: Bringing Key Transparency to End Users" ([USENIX Security](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara), [PDF](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf)) | Transparency systems publish signed directory commitments and rely on monitor/auditor consistency checks to prevent silent split views. | The durable checkpoint-admission store is the local transparency substrate for admitted compaction authority; future monitors can compare head records rather than accept agent-local checkpoint views. |

## 3. Existing Substrate Map Delta

Already present before v119:

1. V112 durable witness-ledger recovery for pruning tombstone history-store heads.
2. V113 signed quorum authority over those witness rows.
3. V114 durable authority-transition stores and store-backed certification.
4. V115 replayed key rotation/revocation.
5. V116 non-retroactive authority epoch seals.
6. V117 durable QC proof records for certified history-store heads.
7. V118 admitted compaction checkpoints that can seed witness, authority, and QC suffix replay.
8. Same-pattern durable checkpoint-admission record stores for settlement-head, tombstone-head, and pruning tombstone-store head compaction layers.

Newly added by v119:

1. History-store-head checkpoint-admission records scoped to `projection_replay_pruning_tombstone_history_store_head_witness_replay_compaction_checkpoint_admission_record`.
2. Record-chain replay that recomputes checkpoint, admission, and record hashes.
3. Strict re-evaluation of every stored admission under the recovered history-store-head authority snapshot.
4. Checkpoint equivocation obstruction by checkpoint id and compacted frontier.
5. In-memory and Postgres stores that reject append unless the full record history replays.
6. A durable table for compacted history-store-head admission history.
7. A recovery path where compacted witness replay consumes checkpoint/admission from the replayed durable record instead of process memory.

## 4. Missing Substrate Map Delta

Still missing:

1. SQ67 pruning admission that requires v119 durable checkpoint-admission history plus retained suffix continuity before physical prefix deletion.
2. Tombstone-gated deletion for v118/v119 history-store-head witness, authority/key/seal, and QC-record stores.
3. Currentness/witnessing for the new history-store-head pruning tombstone ledger once deletion exists.
4. Runtime and Axis adoption of v119 compacted recovery.
5. Live Postgres restart proof that a fresh process can recover from durable checkpoint-admission records plus retained suffix only.
6. Generic nested currentness/witness abstraction to reduce repetition across layered head ledgers.
7. Recovery-kernel inventory for every compacted required head and supporting authority store.
8. Production cryptographic verifier adapters.
9. Transition-authority signatures for the history-store head witness authority transitions themselves.
10. Monitoring that detects admission-store forks across agents rather than only within one replay input.

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
10. SQ67: What pruning admission rule requires durable pruning tombstone history-store head checkpoint-admission history plus retained suffix continuity before physical prefix deletion can occur?

## 6. Primitive Proposal Ledger

Name: Pruning Tombstone History Store-Head Durable Checkpoint Admission Store.

Problem it solves: v118 admitted compacted checkpoints, but recovery could still depend on a remembered checkpoint/admission pair unless the admission itself was preserved in a replayable durable history.

Research source: tamper-evident logging, SUNDR fork consistency, and CONIKS transparency-monitoring mechanisms.

Mechanism borrowed or adapted: admitted checkpoint certificates are promoted into an append-only, hash-chained record history whose consistency and non-equivocation must replay before any compacted checkpoint can seed operational replay.

Why current substrate lacked it: the history-store-head layer had checkpoint admission certificates but no durable record store for those certificates.

Why existing primitives are insufficient: earlier durable checkpoint-admission stores are scoped to other head layers. Reusing them would let another authority namespace authorize history-store-head recovery.

State guarantee it should create: after amnesia, compacted history-store-head replay state can be reconstructed from admitted checkpoint-admission history plus suffix records, not from agent memory, connector cache, local snapshot, or adapter-provided certificate objects.

Admission rule it requires: a checkpoint-admission record can enter the store only if the full candidate record history replays and the embedded checkpoint admission replays as admitted under strict history-store-head witness signatures.

Replay rule it requires: replay must validate contiguous record sequence, previous-record hash, checkpoint hash, admission hash, strict admission replay, record hash, and no checkpoint-id/frontier equivocation.

Authority boundary it requires: the record store is scoped only to pruning tombstone history-store head replay compaction checkpoint admission. It does not authorize pruning, row deletion, domain state, graph mutation, connector cache, or target-side effects.

Failure modes it should prevent:

- process memory reintroducing a checkpoint certificate after restart;
- adapter code supplying an unrecorded checkpoint admission;
- tampered checkpoint/admission records seeding replay;
- two agents accepting different checkpoint hashes for the same checkpoint id;
- two agents accepting different checkpoint bodies for the same compacted frontier;
- local snapshots outranking recorded checkpoint-admission history.

Minimal implementation slice:

- Add checkpoint-admission record type and hash.
- Add record-chain replay with strict admission validation and conflict detection.
- Add in-memory/Postgres append/list stores.
- Add migration `0050`.
- Extend focused tests to recover checkpoint/admission from the durable store and falsify tampered/conflicting histories.

Tests that would falsify it:

- A tampered checkpoint-admission record hash replays valid.
- A record with a stale previous hash replays valid.
- A stored admission whose certificate hash no longer matches its body replays valid.
- A second checkpoint hash for the same checkpoint id or compacted frontier replays valid.
- A compacted witness suffix can recover only from an in-memory checkpoint/admission, with no replay-valid durable admission record.

Axis surfaces that could later validate it:

- Axis C can restart from durable checkpoint-admission records plus suffix rows after compaction.
- Axis A can test stale local checkpoint caches against durable admission history.
- Axis B can force domain adapters to cite stored checkpoint-admission record hashes instead of smuggling checkpoint certificates.

## 7. Falsification Criteria Applied Before Implementation

1. A stored checkpoint-admission record history must replay valid and expose the latest admission record.
2. A compacted witness suffix must recover using the checkpoint/admission loaded from that replayed record history.
3. Tampering with the record hash must make admission-history replay invalid.
4. A second checkpoint body for the same checkpoint id/frontier must make admission-history replay invalid.
5. Store append must reject a candidate record unless the full candidate record history replays.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A witnessed checkpoint admission certificate is enough for amnesiac recovery. | Rejected. | Without a durable admission record history, the certificate can still arrive from private memory or adapter state. |
| Checkpoint hash equality alone prevents equivocation. | Rejected. | Replay must also detect competing checkpoint hashes for the same checkpoint id or compacted frontier. |
| Durable checkpoint-admission stores can be generic without authority namespaces. | Rejected for now. | Earlier stores are scoped to different head layers; v119 keeps history-store-head authority separate until a proven abstraction exists. |

## 9. Implementation Frontier

Implemented now:

- History-store-head checkpoint-admission record types.
- Deterministic checkpoint-admission record hashing.
- Record-chain replay with strict checkpoint/admission validation and non-equivocation checks.
- In-memory and Postgres checkpoint-admission record stores.
- Migration `0050_agent_state_projection_replay_pruning_tombstone_history_store_head_checkpoint_admissions.sql`.
- Focused tests for durable recovery, tampered record rejection, and conflicting checkpoint obstruction.

Remaining frontier:

1. SQ67 pruning admission requiring durable checkpoint-admission history plus retained suffix continuity.
2. Tombstone-gated physical pruning APIs and durable tombstone records for history-store-head compacted lanes.
3. Runtime and Axis adoption.
4. Live Postgres restart proof for amnesiac compacted recovery.
5. Generic nested currentness/witness abstraction.

## 10. Proof Status

Commands run so far:

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

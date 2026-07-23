# v83 Compaction Checkpoint Admission Authority

Date: 2026-06-26
Status: new substrate primitive implemented; workspace typecheck and broad substrate test slice passed
Parent: `research/daily-arrowsmith-agent-state/v82-proof-preserving-replay-compaction-2026-06-26.md`

## 1. Research Question Closed

Closed question: SQ30 - What checkpoint-admission authority makes replay compaction checkpoints themselves admissible, so arbitrary hash-valid snapshots cannot replace transition-derived state?

Answer: a compaction checkpoint is not operational authority merely because its body hashes. It can seed replay only when an admitted checkpoint-admission certificate replays under the checkpoint's own authority topology and a strict witness-signature policy. The certificate binds a quorum of active admitted witnesses to the checkpoint hash; replay refuses missing, under-quorum, tampered, wrong-principal, wrong-key, wrong-payload, or verifier-rejected checkpoint evidence.

Implemented slice:

- Added settlement-head witness replay compaction checkpoint admission status, issue, witness-evidence, and certificate types.
- Added checkpoint-admission witness signature payload hashing and admission certificate hashing.
- Added checkpoint-admission evaluation against replayed authority topology, required/minimum witness thresholds, active principal eligibility, admitted key metadata, payload hashes, and signature verifier results.
- Added operational replay validation that requires a strict witness signature policy before any checkpoint can seed witness-ledger, authority/key-history, or quorum-certificate-record replay.
- Added falsification tests proving hash-valid checkpoints fail without admission, under-quorum admission fails, admitted checkpoint replay succeeds, and tampered checkpoint bodies fail even when accompanied by the original admission certificate.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Castro and Liskov 1999, "Practical Byzantine Fault Tolerance" ([PDF](https://css.csail.mit.edu/6.824/2014/papers/castro-practicalbft.pdf)) | A checkpoint becomes stable only after matching signed checkpoint messages form a proof over the same sequence and state digest. | A replay compaction checkpoint must have a quorum-backed admission certificate over the exact checkpoint hash before it can replace a pruned prefix. |
| Distler 2021, "Byzantine Fault-Tolerant State-Machine Replication from a Systems Perspective" ([PDF](https://www4.cs.fau.de/Publications/2021/distler_21_csur.pdf)) | State-transfer checkpoints need certificates whose contents let a recovering replica verify checkpoint data supplied by another replica. | A fresh pm-substrate process re-evaluates checkpoint witness evidence instead of trusting the process that supplied the snapshot. |
| Kotla et al. 2007, "Zyzzyva: Speculative Byzantine Fault Tolerance" ([PDF](https://www.sigops.org/s/conferences/sosp/2007/papers/sosp052-kotla.pdf)) | Stable checkpoint and recovery protocols rely on signed matching checkpoint statements, not just a local snapshot digest. | The checkpoint admission witness evidence is signed by current admitted head witnesses and bound to the checkpoint hash. |
| Eischer and Distler 2019, "Efficient Checkpointing in Byzantine Fault-Tolerant Systems" ([PDF](https://dl.gi.de/bitstream/handle/20.500.12116/30633/Paper01.pdf)) | Efficient BFT checkpointing still preserves verifiability and consistency of checkpoint state during recovery. | pm-substrate can optimize replay with checkpoints only after preserving a replayable admission proof. |
| Ongaro and Ousterhout 2014, "In Search of an Understandable Consensus Algorithm" ([PDF](https://raft.github.io/raft.pdf)) | Snapshots are installed as part of replicated log recovery, not as private process memory. | Checkpoint installation is a replay operation guarded by admitted witness topology and signature verification. |

## 3. Existing Substrate Map Delta

Already present before v83:

1. Settlement-head witness-ledger, authority/key-history, and quorum-certificate-record replay had sequence/hash chaining.
2. v82 added replay compaction checkpoints carrying compacted frontiers and derived projections.
3. Settlement-head witness principal identity, key status, and quorum thresholds were already replayed from head-witness authority history.
4. Quorum-certificate records preserved signed witness evidence for certified settlement heads.
5. Tampered checkpoint bodies were rejected by checkpoint hash validation.

Newly strengthened by v83:

1. Checkpoint hashes no longer constitute admission authority.
2. Checkpoints require a replayed admission certificate before seeding any operational projection.
3. Admission evidence is bound to the checkpoint hash, tenant, witness id, and witnessed-at time through a signature payload hash.
4. Admission evidence counts only if the witness is active in the checkpointed authority topology.
5. Admission evidence counts only under a strict witness signature policy and admitted current key metadata.
6. Under-quorum checkpoint admissions are replayed as obstructed and cannot seed replay.
7. The same admission certificate cannot authorize a tampered checkpoint because the checkpoint hash binding fails.

## 4. Missing Substrate Map Delta

Still missing:

1. Durable checkpoint-admission stores and migrations.
2. Checkpoint-admission store roots or witness heads so admission certificates themselves cannot equivocate.
3. Checkpoint-chain consistency proofs across successive admitted checkpoints.
4. Database pruning operations that require a durable admitted checkpoint before deleting prefixes.
5. Cross-agent checkpoint gossip or monitor comparison.
6. Multi-authority checkpoint admission beyond the current head-witness topology.
7. Checkpoint conflict obstruction artifacts for two admitted checkpoints at the same frontier with different projections.
8. Runtime adoption in strict graph/capability recovery paths.
9. Axis validation under actual pruned stores.
10. Compaction/admission equivalents for root-witness ledgers and settlement records outside the settlement-head layer.

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
10. SQ31: What durable checkpoint-admission store and consistency proof make compaction checkpoint certificates recoverable, non-equivocating, and prunable without trusting process memory?

## 6. Primitive Proposal Ledger

Name: Settlement-Head Witness Replay Compaction Checkpoint Admission Certificate.

Problem it solves: v82 allowed hash-valid checkpoints to seed replay. That still let an arbitrary caller construct a structurally valid snapshot body and use its hash as operational authority if the replay API accepted it.

Research source: PBFT stable checkpoint certificates, BFT-SMR checkpoint transfer certificates, Zyzzyva signed checkpoint evidence, efficient BFT checkpointing, and Raft snapshot installation.

Mechanism borrowed or adapted: a compacted state snapshot becomes stable only when enough current authorized replicas or witnesses sign the same checkpoint digest, and recovery replays that proof before accepting the snapshot.

Why current substrate lacked it: checkpoints had hash validation but no authority-scoped admission object. Hashes detected tampering after construction; they did not prove that the checkpoint was produced from admitted transition history.

Why existing primitives were insufficient: witness quorum certificates certified settlement heads, not checkpoint snapshots. Authority topology replay proved who could witness, but no rule required those witnesses to admit a checkpoint before replay consumed it.

State guarantee it should create: a compaction checkpoint can become operational state only when a replayable certificate proves that enough current admitted witnesses signed that exact checkpoint hash under the checkpointed authority topology.

Admission rule it requires: checkpoint admission requires a hash-valid checkpoint, a valid authority-topology snapshot, strict witness signatures from active admitted principals, admitted current key metadata, unique witnesses, matching checkpoint hashes, and required quorum threshold satisfaction.

Replay rule it requires: replay validates the admission certificate hash, reconstructs the authority topology from the checkpoint, re-evaluates witness evidence under strict signature policy, and seeds replay only if the re-evaluated certificate is admitted.

Authority boundary it requires: checkpoint admission is a settlement-head witness authority decision, not a storage-engine snapshot, adapter summary, local cache, or process-memory resume artifact.

Failure modes it should prevent:

- accepting hash-valid but privately fabricated checkpoints;
- accepting checkpoints without witness admission;
- accepting under-quorum checkpoint approvals;
- accepting witness evidence from non-members or revoked/rotated keys;
- accepting checkpoint evidence whose signature payload does not bind the checkpoint hash;
- reusing an admission certificate for a tampered checkpoint body;
- letting omission of a signature policy degrade checkpoint admission into unsigned evidence counting.

Minimal implementation slice:

- Add checkpoint-admission certificate and witness-evidence types.
- Add checkpoint-admission signature payload hashing and certificate hashing.
- Add an evaluator that replays authority topology, witness eligibility, current key metadata, quorum thresholds, and signatures.
- Require replay functions to validate admission before checkpoint seeding.
- Add tests for missing admission, under-quorum admission, admitted replay, and tampered checkpoint rejection.

Tests that would falsify it:

- A hash-valid checkpoint can seed replay without an admission certificate.
- An under-quorum checkpoint admission can seed replay.
- A checkpoint admission can pass without strict signature verification.
- A signature by a non-active, wrong-key, or wrong-payload witness can count.
- An admission certificate for one checkpoint can authorize a tampered checkpoint.
- Checkpoint-seeded replay no longer recovers the same accepted heads, principal/key state, or latest certified record as full replay.

Axis surfaces that could later validate it:

- Axis C can restart from a pruned settlement-head store and require admitted checkpoint-plus-suffix recovery.
- Axis A can verify finance mutation authority after pruning old settlement-head witness/key/certificate histories.
- Axis B can force domain adapters to cite admitted checkpoint recovery instead of profile-local cached authority snapshots.

## 7. Falsification Criteria Applied Before Verification

1. Replaying a pruned witness suffix without a checkpoint still fails.
2. Replaying a hash-valid checkpoint without an admission certificate fails.
3. Replaying a checkpoint with under-quorum admission fails.
4. Replaying a checkpoint with admitted quorum signatures succeeds and preserves accepted heads.
5. Replaying a pruned authority/key-history suffix with admitted checkpoint succeeds and preserves rotated key state.
6. Replaying a pruned certificate-record suffix with admitted checkpoint succeeds and recovers the latest certified record.
7. Tampering with the checkpoint body while reusing the original admitted certificate invalidates replay.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| A checkpoint hash is enough authority to replace a pruned transition prefix. | Falsified. | v83 replay now refuses checkpoints without admitted witness-signature certificates. |
| Checkpoint admission can be implicit in a caller-supplied snapshot body. | Rejected. | The replay API requires a separate admission certificate and replays it before seeding projection state. |
| A quorum certificate for a settlement head also certifies any later compaction checkpoint. | Rejected. | v83 adds a separate checkpoint-hash-bound witness evidence type. |
| Signature verification is optional when operational replay consumes a checkpoint. | Rejected for checkpoint seeding. | Validation fails unless the replay call supplies a strict witness signature policy. |
| Durable checkpoint admission is solved. | Not yet. | v83 records SQ31 because certificates still need durable storage, consistency proofs, and pruning integration. |

## 9. Implementation Frontier

Implemented now:

- `ProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionCertificate`.
- Checkpoint-admission witness evidence and issue types.
- Checkpoint-admission witness signature payload hashing.
- Checkpoint-admission certificate hashing and replay verification.
- Authority-topology reconstruction from checkpoint snapshots.
- Operational replay validation requiring strict signature policy before checkpoint seeding.
- Witness-ledger, authority/key-history, and quorum-certificate-record replay all require admitted checkpoint certificates when they consume a checkpoint.
- Focused tests for missing admission, under-quorum admission, admitted replay success, rotated key preservation, latest certificate recovery, and tampered-checkpoint rejection.

Remaining frontier:

1. Durable checkpoint-admission stores and migrations.
2. Checkpoint-admission store heads, roots, or witness protocols.
3. Consistency proofs across successive checkpoint admissions.
4. Pruning APIs that delete prefixes only after durable admitted checkpoint proof exists.
5. Cross-agent monitor/gossip for checkpoint-admission divergence.
6. Runtime and Axis A/B/C adoption under actual pruned stores.

## 10. Proof Status

Commands run:

```bash
git fetch origin main
pnpm --filter @pm/agent-state typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm typecheck
pnpm exec vitest run $(rg --files packages | rg '(agent-state|capability-kit|workflow|graph|evals|local-agent-lab|capability-finance-research-ingest|profile-agency|domain).*(test|spec)\.ts$')
git diff --check
```

Result:

- Focused `@pm/agent-state` typecheck passed.
- Focused Vitest passed: `packages/agent-state/src/index.test.ts` 71 tests.
- Full workspace `pnpm typecheck` passed.
- Broad substrate Vitest slice passed: 31 files passed, 391 tests passed, 65 skipped.
- `git diff --check` passed.

Proof boundary:

This proves the pure checkpoint-admission authority primitive across the current workspace test slice. It does not yet prove durable checkpoint-admission storage, checkpoint-admission non-equivocation, actual pruning, checkpoint-chain consistency, production cryptographic adapters, or Axis A/B/C adoption.

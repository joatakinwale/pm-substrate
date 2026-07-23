# v186 - Operational State Authority-Topology Checkpoint Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ133

## Research Question

What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", PODC 2009: https://www.microsoft.com/en-us/research/wp-content/uploads/2009/05/podc09v6.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Martin and Alvisi, "A Framework for Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf
- Alpos et al., "Reconfigurable Heterogeneous Quorum Systems", DISC 2024: https://drops.dagstuhl.de/storage/00lipics/lipics-vol319-disc2024/LIPIcs.DISC.2024.52/LIPIcs.DISC.2024.52.pdf

## Mechanism Extracted

Raft's joint-consensus reconfiguration and Vertical Paxos both make membership/current-configuration state part of the replicated protocol rather than private controller memory. Dynamic Byzantine quorum systems and dynamic Byzantine storage add the adversarial version of the same rule: a client or replica may hold stale configuration information, so safety requires configuration movement to preserve quorum-intersection/validation guarantees across reconfiguration. Reconfigurable heterogeneous quorum systems sharpen the lesson for nonuniform authority: a configuration transition can itself compromise consistency unless there is a mechanism that decides which prior authorities can authorize the next configuration.

The substrate adaptation is authority-topology checkpoint admission witness authority-transition admission. v176 made authority-topology checkpoint admission witness certificates topology-bound, but strict authority-topology compaction could still accept a hash-valid checkpoint-admission witness authority topology supplied as input. v186 adds an admitted transition ledger for that topology. Strict checkpoint-admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each transition admission binds the authority transition hash, previous topology hash after bootstrap, derived next topology hash, and the certificate that admitted the transition under the prior replayed topology.

## Existing Substrate Map

- v146 added authority-topology compaction checkpoints so compacted topology recovery can replay a retained suffix from a compacted authority frontier.
- v156 added authority-topology checkpoint admission records over exact checkpoint hashes and compacted authority frontiers.
- v166 added authority-topology checkpoint admission witness records over exact checkpoint-admission record hashes.
- v176 added authority-topology checkpoint admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0093` persists append-only authority-topology checkpoint admission witness authority-transition rows.
- Before v186, `replayOperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, and `evaluateOperationalStateAuthorityTopologyCompaction()` could require checkpoint-admission witness authority topology, but that topology object could still be supplied from memory, adapters, connector cache, or self-authored transition rows.

## Missing Substrate Map

- Before v186, authority-topology checkpoint admission witness authority-transition rows were storage facts, not admitted compacted-authority recovery authority.
- Before v186, strict authority-topology compaction could consume checkpoint-admission witness authority topology without proving the latest witness-authority transition was admitted.
- Before v186, a supplied topology could authorize the witness certificate that made an authority-topology checkpoint admission accountable without proving the topology's own admission path.
- Before v186, no replay object bound checkpoint-admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v186: genesis/bootstrap authority for the first checkpoint-admission witness-authority transition, separate witness/finality for this transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime authority-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state authority-topology checkpoint admission witness authority-transition admission.

Problem it solves: prevents checkpoint-admission witness authority topology from becoming operational compacted-authority recovery authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: Raft reconfiguration, Vertical Paxos, Dynamic Byzantine Quorum Systems, Dynamic Byzantine Storage, and Reconfigurable Heterogeneous Quorum Systems.

Mechanism borrowed: configuration/authority changes must be admitted as replayed protocol state; post-bootstrap reconfiguration must be authorized by prior active authority; stale or locally supplied configurations are not sufficient operational state.

Why current substrate lacked it: v176 bound authority-topology checkpoint admission witness certificates to a replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: authority-topology checkpoints, checkpoint admissions, checkpoint admission witnesses, and topology-bound witness certificates constrain compacted authority recovery, but not the authority-transition ledger that defines which witnesses can certify checkpoint admissions. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict authority-topology compaction can consume a checkpoint-admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each authority-topology checkpoint admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap checkpoint-admission witness authority changes are counted against the previous replayed checkpoint-admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied checkpoint-admission witness topology, stale local checkpoint-admission witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and compacted authority recovery authorized by unadmitted checkpoint-admission witness-authority transition history.

Minimal implementation slice: add authority-topology checkpoint admission witness authority-transition admission record/replay types, deterministic hashes, strict checkpoint-admission witness replay/evaluation flags, migration `0103`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict authority-topology compaction passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct authority-topology recovery from admitted checkpoint-admission witness authority transitions, Axis A finance authority compaction attempting stale witness topology, and Axis B/domain adapters attempting to supply local checkpoint-admission witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- An authority-topology checkpoint admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict authority-topology compaction evaluation.
- Strict authority-topology compaction must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: an authority-topology checkpoint admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only checkpoint-admission witness authority-transition rows are enough to constitute operational compacted-authority recovery.
- Falsified: a topology object supplied to checkpoint-admission witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial checkpoint-admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateAuthorityTopologyCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for authority-topology checkpoint admission witness authority-transition admissions.
- Extended checkpoint-admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended authority-topology compaction evaluation with `requireCheckpointAdmissionWitnessAuthorityTransitionAdmission`.
- Added authority-topology compaction issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0103_agent_state_authority_topology_checkpoint_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "authority topology checkpoint admission witness authority"` (2 passed, 200 skipped)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (606 passed, 143 skipped)

Outcome: SQ133 is closed. SQ134 is now the active next substrate question, with SQ143 added as new authority-topology checkpoint admission witness authority-transition admission-record accountability pressure.

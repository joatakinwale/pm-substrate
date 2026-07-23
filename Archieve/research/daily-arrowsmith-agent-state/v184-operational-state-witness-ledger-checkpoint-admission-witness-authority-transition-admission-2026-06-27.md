# v184 - Operational State Witness-Ledger Checkpoint Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ131

## Research Question

What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning", IEEE Symposium on Security and Privacy 2016: https://ieeexplore.ieee.org/document/7546521/
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Garcia-Perez and Gotsman, "Federated Byzantine Quorum Systems", OPODIS 2018: https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.OPODIS.2018.17

## Mechanism Extracted

CoSi makes an authority statement safer by requiring a diverse witness group to see and cosign it before clients accept it. The missing substrate lesson is that the witness group cannot be certificate-local state: if the issuer or adapter supplies the witness set, then witness cosigning collapses back into private representation. Dynamic Byzantine quorum systems sharpen the failure: stale or conflicting quorum configurations can let clients observe conflicting values unless configuration changes preserve enough intersection with prior authority. Viewstamped Replication adds the reconfiguration rule: a new membership/threshold epoch must be committed by the old group before the new group processes requests. Federated Byzantine quorum work adds the topology dimension: quorum meaning depends on explicit trust choices, so the topology itself must be represented and replayed rather than inferred.

The substrate adaptation is witness-ledger checkpoint admission witness authority-transition admission. v174 made witness-ledger checkpoint admission witness certificates topology-bound, but strict witness-ledger compaction could still accept a hash-valid witness authority topology supplied as replay input. v184 adds an admitted transition ledger for that topology. Strict checkpoint-admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each transition admission binds the authority transition hash, previous topology hash after bootstrap, derived next topology hash, and the certificate that admitted the transition under the prior replayed topology.

## Existing Substrate Map

- v144 added generic witness-ledger compaction: retained suffix replay reconstructs the exact latest accepted required head from a compaction checkpoint.
- v154 added witness-ledger checkpoint admission records over exact checkpoint hashes and compacted ledger frontiers.
- v164 added witness-ledger checkpoint admission witness records over exact checkpoint-admission record hashes.
- v174 added checkpoint-admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0091` persists append-only checkpoint-admission witness authority-transition rows.
- Before v184, `replayOperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, but that topology object could still be supplied from memory, adapters, connector cache, or self-authored transition rows.

## Missing Substrate Map

- Before v184, witness-ledger checkpoint-admission witness authority-transition rows were append-only storage, not admitted compacted-recovery authority.
- Before v184, strict witness-ledger compaction could consume a checkpoint-admission witness authority topology without proving the latest authority transition was admitted.
- Before v184, a supplied topology could authorize the witness certificate that made a compacted witness-ledger checkpoint admissible without proving the topology's own admission path.
- Before v184, no replay object bound checkpoint-admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v184: genesis/bootstrap authority for the first checkpoint-admission witness-authority transition, separate witness/finality for this transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime witness-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state witness-ledger checkpoint admission witness authority-transition admission.

Problem it solves: prevents witness-ledger checkpoint admission witness authority topology from becoming operational compacted-recovery authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: CoSi witness cosigning, Viewstamped Replication reconfiguration/state transfer, Dynamic Byzantine Quorum Systems, and Federated Byzantine Quorum Systems.

Mechanism borrowed: authoritative statements need witness cosignatures; reconfiguration must be committed before the new group acts; dynamic quorum changes require prior/new authority intersection; topology meaning must be explicit. The current checkpoint-admission witness authority must derive from admitted transition history; post-bootstrap changes must be certified by prior admissible authority rather than by the proposed new topology.

Why current substrate lacked it: v174 bound checkpoint-admission witness certificates to replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: checkpoint records, checkpoint-admission records, witness records, and topology-bound witness certificates constrain compacted recovery evidence, but not the authority-transition ledger that defines which witnesses can certify checkpoint admissions. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict witness-ledger compaction can consume a checkpoint-admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each checkpoint-admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap checkpoint-admission witness authority changes are counted against the previous replayed witness-ledger checkpoint admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied checkpoint-admission witness topology, stale local witness-ledger checkpoint witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and compacted recovery authorized by unadmitted checkpoint-admission witness-authority transition history.

Minimal implementation slice: add checkpoint-admission witness authority-transition admission record/replay types, deterministic hashes, strict witness replay/evaluation flags, migration `0101`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict witness-ledger compaction passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct witness-ledger compaction recovery from admitted checkpoint witness authority transitions, Axis A finance pruning witness-ledger compaction attempting stale witness topology, and Axis B/domain adapters attempting to supply local checkpoint witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- A witness-ledger checkpoint admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict witness-ledger compaction.
- Strict witness-ledger compaction must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a witness-ledger checkpoint admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only checkpoint-admission witness authority-transition rows are enough to constitute operational compacted-recovery authority.
- Falsified: a topology object supplied to witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial checkpoint-admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateWitnessLedgerCompactionCheckpointAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for checkpoint-admission witness authority-transition admissions.
- Extended witness-ledger checkpoint admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended witness-ledger compaction evaluation with checkpoint-admission witness authority transition-admission strictness.
- Added witness-ledger issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0101_agent_state_witness_ledger_checkpoint_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm exec vitest run packages/agent-state/src/index.test.ts` (198 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (602 passed, 143 skipped)

Outcome: SQ131 is closed. SQ132 is now the active next substrate question, with SQ141 added as new witness-ledger checkpoint admission witness authority-transition admission-record accountability pressure.

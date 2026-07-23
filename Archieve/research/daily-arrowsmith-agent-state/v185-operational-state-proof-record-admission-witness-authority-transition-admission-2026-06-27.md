# v185 - Operational State Proof-Record Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ132

## Research Question

What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Tomescu et al., "Transparency Logs via Append-Only Authenticated Dictionaries", ACM CCS 2019: https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf

## Mechanism Extracted

PeerReview supplies the accountable-state mechanism: a node action is not made trustworthy by private memory or a local report, but by a tamper-evident action log that another node can replay against a reference implementation. Proof-carrying authentication adds the admission shape: a requester should carry a machine-checkable proof and supporting signed statements, not ask the verifier to infer authority from local context. Dynamic Byzantine quorum systems add the topology rule: changing a quorum configuration is itself a state transition whose safety depends on prior/new authority intersection. Append-only authenticated dictionaries sharpen the log guarantee: clients move between digests only when an append-only proof preserves the prior digest, otherwise forked local views remain possible.

The substrate adaptation is proof-record admission witness authority-transition admission. v175 made proof-record admission witness certificates topology-bound, but strict proof-record replay could still accept a hash-valid witness authority topology supplied as input. v185 adds an admitted transition ledger for that topology. Strict proof-record admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each transition admission binds the authority transition hash, previous topology hash after bootstrap, derived next topology hash, and the certificate that admitted the transition under the prior replayed topology.

## Existing Substrate Map

- v145 added generic quorum-certificate proof records so certified currentness can recover from replayed proof history instead of transient recertification.
- v155 added proof-record admission records over exact proof-record hashes and certified proof subjects.
- v165 added proof-record admission witness records over exact proof-record admission hashes.
- v175 added proof-record admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0092` persists append-only proof-record admission witness authority-transition rows.
- Before v185, `replayOperationalStateQuorumCertificateProofRecordAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, and `replayOperationalStateQuorumCertificateProofRecords()` could require admission-witness authority topology, but that topology object could still be supplied from memory, adapters, connector cache, or self-authored transition rows.

## Missing Substrate Map

- Before v185, proof-record admission witness authority-transition rows were storage facts, not admitted recovered-currentness authority.
- Before v185, strict proof-record replay could consume proof-record admission witness authority topology without proving the latest authority transition was admitted.
- Before v185, a supplied topology could authorize the witness certificate that made proof-record admission accountable without proving the topology's own admission path.
- Before v185, no replay object bound proof-record admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v185: genesis/bootstrap authority for the first proof-record admission witness-authority transition, separate witness/finality for this transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime proof-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state proof-record admission witness authority-transition admission.

Problem it solves: prevents proof-record admission witness authority topology from becoming operational recovered-certified-currentness authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: PeerReview accountable logs, Proof-Carrying Authentication, Dynamic Byzantine Quorum Systems, and append-only authenticated dictionaries.

Mechanism borrowed: authority-bearing actions must be logged and replayable; authorization must carry checkable proof objects; quorum topology changes must be admitted under prior authority; append-only state advances must preserve prior digest/history.

Why current substrate lacked it: v175 bound proof-record admission witness certificates to a replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: proof records, proof-record admissions, proof-record admission witnesses, and topology-bound witness certificates constrain certified-currentness evidence, but not the authority-transition ledger that defines which witnesses can certify proof-record admissions. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict quorum-certificate proof-record replay can consume a proof-record admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each proof-record admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap proof-record admission witness authority changes are counted against the previous replayed proof-record admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied proof-record admission witness topology, stale local proof-record witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and certified currentness authorized by unadmitted proof-record admission witness-authority transition history.

Minimal implementation slice: add proof-record admission witness authority-transition admission record/replay types, deterministic hashes, strict proof-record witness replay/proof replay flags, migration `0102`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict proof-record replay passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct proof-record recovery from admitted proof-record admission witness authority transitions, Axis A finance pruning proof-record recovery attempting stale proof-witness topology, and Axis B/domain adapters attempting to supply local proof-record witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- A proof-record admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict proof-record replay.
- Strict proof-record replay must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a proof-record admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only proof-record admission witness authority-transition rows are enough to constitute operational certified-currentness authority.
- Falsified: a topology object supplied to proof-record admission witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial proof-record admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateQuorumCertificateProofRecordAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for proof-record admission witness authority-transition admissions.
- Extended proof-record admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended quorum-certificate proof-record replay with `requireProofRecordAdmissionWitnessAuthorityTransitionAdmission`.
- Added proof-record issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0102_agent_state_quorum_certificate_proof_record_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm exec vitest run packages/agent-state/src/index.test.ts` (200 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (604 passed, 143 skipped)

Outcome: SQ132 is closed. SQ133 is now the active next substrate question, with SQ142 added as new proof-record admission witness authority-transition admission-record accountability pressure.

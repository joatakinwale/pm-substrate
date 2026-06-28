# v179 - Operational State Recovery-Cut Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ126

## Research Question

What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Lamport, Malkhi, and Zhou, "Vertical Paxos and Primary-Backup Replication", PODC 2009 technical report: https://lamport.azurewebsites.net/pubs/vertical-paxos.pdf
- Liskov and Cowling, "Viewstamped Replication Revisited", 2012: https://www.cs.princeton.edu/courses/archive/fall19/cos418/papers/vr-revisited.pdf
- Alvisi, Pierce, and Reiter, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems", STOC 1997 / Distributed Computing 1998: https://www.cs.umass.edu/~arun/cs691ee/reading/BQS97.pdf
- Martin, Alvisi, and Dahlin, "A Framework for Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf
- Li and Lesani, "Reconfigurable Heterogeneous Quorum Systems", DISC 2024: https://arxiv.org/pdf/2304.02156

## Mechanism Extracted

Raft's joint consensus makes membership change a committed log transition and preserves safety through overlapping old/new majorities. Vertical Paxos separates configuration choice from acceptor state and requires leaders to account for past configurations. Viewstamped Replication treats reconfiguration as a logged operation that carries the system across old and new groups through state transfer. Dynamic Byzantine storage adds the current-view problem: clients cannot safely use stale views, and view certificates plus transquorum rules prevent old views from continuing to authorize operations after reconfiguration.

The substrate adaptation is recovery-cut admission witness authority-transition admission. v169 made recovery-cut admission witness certificates topology-bound, but the topology rows themselves were still caller-supplied transition history. v179 adds a replayable admission ledger for those authority transitions. Strict recovery-cut admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each admission record certifies the exact authority transition hash, the derived next topology hash, and, after bootstrap, the previous topology hash whose unique active principals authorize the transition.

## Existing Substrate Map

- v149 added recovery-cut admission records so recovered state must replay a cut-admission chain.
- v159 added recovery-cut admission witness records over exact recovery-cut admission record hashes.
- v169 added recovery-cut admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0086` persists append-only recovery-cut admission witness authority-transition rows.
- Before v179, `replayOperationalStateRecoveryCutAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, but the topology object could still be supplied from memory, adapter state, connector cache, or a self-authored transition table.

## Missing Substrate Map

- Before v179, recovery-cut admission witness authority-transition rows were append-only storage, not admitted operational authority.
- Before v179, strict recovery could consume a topology projection without proving that the latest authority transition was admitted.
- Before v179, a newly supplied topology could authorize the witness certificate that made recovered state valid without proving the topology's own admission path.
- Before v179, there was no replay object binding authority transition hash, previous topology hash, next topology hash, and admission certificate.
- Still missing after v179: genesis/bootstrap authority for the first recovery-cut witness-authority transition, separate witness/finality for the transition-admission ledger itself, signature/key-status verification for transition-admission certificates, store-backed runtime adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state recovery-cut admission witness authority-transition admission.

Problem it solves: prevents recovery-cut admission witness authority topology from becoming operational authority merely because a caller supplied hash-valid authority transition rows or a topology object.

Research source: Raft joint consensus, Vertical Paxos, Viewstamped Replication reconfiguration, Dynamic Byzantine Quorum Systems, Byzantine Quorum Systems, dynamic Byzantine storage, and reconfigurable heterogeneous quorum systems.

Mechanism borrowed: reconfiguration is itself an admitted state transition. The current configuration cannot be private memory; it must derive from admitted reconfiguration history, and post-genesis changes must be certified by prior admissible authority rather than by the new configuration alone.

Why current substrate lacked it: v169 bound recovery-cut admission witness certificates to a replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: recovery-cut admission rows, witness rows, and topology-bound witness certificates constrain recovered-state evidence, but not the authority-transition ledger that defines which witnesses exist. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict recovered operational state can consume a recovery-cut admission witness topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each recovery-cut admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate's topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap authority changes are counted against the previous replayed recovery-cut admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied witness topology, stale local authority topology, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and recovered state authorized by an unadmitted witness-authority transition.

Minimal implementation slice: add recovery-cut admission witness authority-transition admission record/replay types, deterministic hashes, strict replay/evaluation flags, action-review enforcement, migration `0096`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict recovery passes when topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C amnesiac recovery using only admitted transition history, Axis A finance recovery paths attempting stale recovery-cut witness topology, and Axis B/domain adapters attempting to supply local authority topology instead of replayed authority-transition admission.

## Falsification Criteria

- A recovery-cut admission witness topology recovered from admitted transition records must satisfy strict recovery-cut admission witness replay and strict action review.
- Strict recovery-cut admission must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
2. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a recovery-cut admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only recovery-cut witness-authority transition rows are enough to constitute operational authority.
- Falsified: a topology object supplied to witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial recovery-cut witness-authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for recovery-cut admission witness authority-transition admissions.
- Extended recovery-cut admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended recovery-cut admission evaluation and action-review options with transition-admission strictness.
- Added recovery-cut-specific issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0096_agent_state_recovery_cut_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (188 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (592 passed, 143 skipped)

Outcome: SQ126 is closed. SQ127 is now the active next substrate question, with SQ136 added as new recovery-cut authority-transition admission accountability pressure.

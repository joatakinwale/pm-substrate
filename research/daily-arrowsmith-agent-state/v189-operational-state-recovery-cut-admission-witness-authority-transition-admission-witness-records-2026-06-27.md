# v189 - Operational State Recovery-Cut Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ136

## Research Question

What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Sources

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Kong et al., "CTng: Secure Certificate and Revocation Transparency", NDSS 2026: https://www.ndss-symposium.org/wp-content/uploads/2026-s213-paper.pdf
- Tomescu and Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries", CCS 2019: https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf

## Mechanism Extracted

PeerReview makes accountability depend on secure logs that can be replayed independently, not on a participant's local claim that it behaved correctly. CONIKS and certificate-transparency systems separate certificates from transparency: an accepted binding or certificate still needs public, append-only, consistency-checkable log evidence so split views and unlogged authority can be detected. Append-only authenticated dictionaries sharpen the replay mechanism: the accountable object is an entry in a history with roots and append-only evidence, not merely a valid-looking signed object.

The substrate adaptation is recovery-cut admission witness authority-transition admission witness records. v179 made recovery-cut admission witness topology recover from admitted authority-transition history, but those transition-admission records still carried certificate-local admission claims. v189 adds a separate hash-linked witness ledger over the exact transition-admission record hashes. Strict transition-admission replay can now require the latest transition-admission record to be witnessed; strict recovery-cut admission witness replay and action review can require that witnessed transition-admission replay before recovered operational state is accepted.

## Existing Substrate Map

- v149 added recovery-cut admission records so recovered state can require durable recovery-cut admission history.
- v159 added recovery-cut admission witness records so self-authored recovery-cut admission rows cannot authorize recovered state alone.
- v169 added recovery-cut admission witness authority topology so witness certificates count only unique active topology principals.
- v179 added recovery-cut admission witness authority-transition admission so that topology must replay from admitted authority-transition history.
- Migration `0096` persists append-only recovery-cut admission witness authority-transition admission rows.
- Before v189, `replayOperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecords()` could verify a transition-admission row and its prior-topology certificate, but strict recovery could still accept a local collection of transition-admission rows without a separate witness ledger proving the rows themselves had been admitted as records.

## Missing Substrate Map

- Before v189, recovery-cut admission witness authority-transition admission records were replayed rows but not separately witnessed operational recovery authority.
- Before v189, strict recovery-cut admission could require transition-admitted witness authority topology without proving the latest transition-admission row had an accountable admission-record witness.
- Before v189, a certificate embedded inside a transition-admission row could be the only proof that the row existed as admitted history.
- Before v189, no replay object hash-linked witness records over exact recovery-cut witness-authority transition-admission record hashes.
- Still missing after v189: witness authority topology/signature/finality for the new transition-admission witness ledger, genesis/bootstrap authority, runtime recovery-store adoption, compaction/currentness for this lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state recovery-cut admission witness authority-transition admission witness records.

Problem it solves: prevents recovery-cut witness-authority transition-admission rows from becoming recovery authority merely because a caller supplied certificate-local transition-admission records.

Research source: PeerReview, CONIKS, CTng, and append-only authenticated transparency logs.

Mechanism borrowed: accountable authority requires independently replayable secure logs; valid-looking certificates or bindings do not become operational authority until they are witnessed in append-only, consistency-checkable history.

Why current substrate lacked it: v179 verified the content and prior-topology authorization of transition-admission rows, but did not require a separate witness ledger over those exact row hashes.

Why existing primitives are insufficient: recovery cuts, recovery-cut admissions, admission witnesses, witness authority topology, and transition-admission rows constrain recovered state but leave the transition-admission row itself as the terminal authority object. That preserves a certificate-local admission gap.

State guarantee it should create: strict recovered-state evaluation can consume recovery-cut admission witness authority-transition admission rows only when the latest transition-admission record hash is witnessed by a separate hash-linked witness ledger.

Admission rule it requires: each recovery-cut admission witness authority-transition admission record can be witnessed by a witness record whose certificate names the exact transition-admission store, topology id, admission sequence, and admission record hash.

Replay rule it requires: witness replay rejects invalid transition-admission replay, tenant/store/scope mismatch, witness sequence gaps, previous witness hash breaks, tampered witness records, non-certified certificates, insufficient certificate quorum, wrong subject, wrong authority boundary, missing latest transition-admission witness, and witness/admission record mismatch.

Authority boundary it requires: strict recovery-cut admission witness replay can demand transition-admission replay whose latest row is witnessed; strict recovery-cut admission evaluation and action review can demand that same witnessed transition-admission replay before allowing recovered operational state.

Failure modes it should prevent: connector-supplied transition-admission rows, certificate-local recovery-cut witness-authority transition-admission rows, stale or private transition-admission snapshots, wrong-subject transition-admission witnesses, missing latest transition-admission witnesses, and recovered state authorized by unwitnessed witness-authority topology history.

Minimal implementation slice: add recovery-cut admission witness authority-transition admission witness record/replay types, deterministic hashes, strict replay/evaluation flags, action-review enforcement option, migration `0106`, and tests for valid witnessed transition-admission rows, missing witness replay, missing strict witness layer, and wrong witness certificate subject.

Tests that would falsify it: valid witnessed transition-admission rows fail; strict transition-admission replay passes without an admission-witness replay; strict recovery-cut witness replay passes when the transition-admission replay has no witness ledger; strict recovery-cut admission evaluation or action review passes without the new witnessed transition-admission replay; a witness certificate over the wrong transition-admission record hash passes.

Axis surfaces that could later validate it: Axis C direct amnesiac recovery with replayed transition-admission witness records, Axis A finance recovery cuts attempting stale transition-admission rows, and Axis B/domain adapters attempting to supply local recovery-cut witness-authority transition-admission rows instead of witnessed record history.

## Falsification Criteria

- A recovery-cut witness-authority transition-admission history with a valid witness ledger must satisfy strict transition-admission replay, strict recovery-cut admission witness replay, strict recovery-cut admission evaluation, and blocking action review.
- Strict transition-admission replay must fail if `requireAdmissionWitness` is true and the admission-witness replay is missing.
- Strict recovery-cut admission witness replay must fail if `requireWitnessAuthorityTransitionAdmissionWitness` is true and transition-admission replay has no witness ledger.
- Strict recovery-cut admission evaluation must fail when the admission witness replay is invalid because the transition-admission witness layer is missing.
- Transition-admission witness replay must fail if its certificate subject hash does not match the exact transition-admission record hash.

## Active 10-Question Backlog

1. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Falsified: a recovery-cut admission witness authority-transition admission row is accountable if its embedded certificate validates against prior topology.
- Falsified: replay-valid transition-admission rows are enough to constitute recovery authority when they are supplied by the caller.
- Falsified: certificate-local admission rows can stand in for a separate replayed witness ledger over exact transition-admission record hashes.
- Still open: transition-admission witness certificates are not yet topology-bound or signature-bound in this new layer; SQ146 names that missing authority boundary.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for recovery-cut admission witness authority-transition admission witness records.
- Extended transition-admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extended recovery-cut admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness`.
- Extended recovery-cut admission evaluation and action review with `requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitness`.
- Added recovery-cut issue codes for transition-admission witness replay and witness-record failures.
- Added migration `0106_agent_state_recovery_cut_admission_witness_authority_transition_admission_witness_records.sql`.
- Added tests for valid witnessed transition-admission rows, strict missing transition-admission witness refusal, strict missing witness layer refusal, and wrong witness certificate subject refusal.

Focused verification before ledger publication:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "recovery cut admission witness authority"` (3 passed, 204 skipped)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (611 passed, 143 skipped)

Outcome: SQ136 is closed. SQ137 is now the active next substrate question, with SQ146 added as recovery-cut transition-admission witness authority topology/signature pressure.

# v190 - Operational State History-Root Settlement Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ137

## Research Question

What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?

## Sources

- Haeberlen, Kouznetsov, and Druschel, "PeerReview: Practical Accountability for Distributed Systems", SOSP 2007: https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Kong et al., "CTng: Secure Certificate and Revocation Transparency", NDSS 2026: https://www.ndss-symposium.org/wp-content/uploads/2026-s213-paper.pdf
- Tomescu and Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries", CCS 2019: https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf

## Mechanism Extracted

PeerReview makes distributed accountability depend on replayable secure logs rather than a participant's assertion that a transition was valid. CONIKS, CTng, and append-only authenticated dictionaries separate certificate validity from transparency: a valid-looking authority statement still needs independently checkable inclusion and append-only history so split views, withheld entries, and local certificates can be detected.

The substrate adaptation is history-root settlement authority-transition admission witness records. v180 made history-root settlement authority topology recover from admitted authority-transition history, but those transition-admission rows still ended at certificate-local admission. v190 adds a separate hash-linked witness ledger over the exact history-root settlement authority-transition admission record hashes. Strict recovery transparency can now require root-settlement authority-transition admission rows to be witnessed before they authorize settled store-root currentness.

## Existing Substrate Map

- v140 added history-root transparency so recovered state can compare required lane roots against replayed root observations.
- v150 added history-root observer signature proofs so root observations cannot be unsigned gossip.
- v160 added history-root settlement records so replayed roots can be settled by quorum certificates.
- v170 added history-root settlement authority topology so settlement certificates count only unique active topology principals.
- v180 added history-root settlement authority-transition admission so settlement topology must replay from admitted authority-transition history.
- Migration `0097` persists append-only history-root settlement authority-transition admission rows.
- Before v190, `replayOperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecords()` could verify a transition-admission row and its prior-topology certificate, but strict recovery transparency could still consume caller-supplied transition-admission rows without a separate witness ledger proving those rows existed as admitted record history.

## Missing Substrate Map

- Before v190, history-root settlement authority-transition admission records were replayed rows but not separately witnessed recovery-root authority.
- Before v190, strict recovery transparency could require transition-admitted settlement authority topology without proving the latest transition-admission row had an accountable admission-record witness.
- Before v190, a certificate embedded inside the transition-admission row could be the only proof that the row existed as admitted history.
- Before v190, no replay object hash-linked witness records over exact history-root settlement authority-transition admission record hashes.
- Still missing after v190: witness authority topology/signature/finality for the new history-root transition-admission witness ledger, genesis/bootstrap authority, runtime transparency-store adoption, compaction/currentness for this lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state history-root settlement authority-transition admission witness records.

Problem it solves: prevents history-root settlement authority-transition admission rows from becoming recovery transparency authority merely because a caller supplied certificate-local transition-admission records.

Research source: PeerReview, CONIKS, CTng, and append-only authenticated transparency logs.

Mechanism borrowed: accountable authority requires independently replayable secure logs; valid-looking certificates or bindings do not become operational authority until they are witnessed in append-only, consistency-checkable history.

Why current substrate lacked it: v180 verified the content and prior-topology authorization of transition-admission rows, but did not require a separate witness ledger over those exact row hashes.

Why existing primitives are insufficient: history-root observations, observer signatures, settlement records, settlement authority topology, and authority-transition admission constrain recovery transparency but leave the transition-admission row itself as the terminal authority object. That preserves a certificate-local admission gap.

State guarantee it should create: strict recovered-state transparency can consume history-root settlement authority-transition admission rows only when the latest transition-admission record hash is witnessed by a separate hash-linked witness ledger.

Admission rule it requires: each history-root settlement authority-transition admission record can be witnessed by a witness record whose certificate names the exact transition-admission store, topology id, admission sequence, and admission record hash.

Replay rule it requires: witness replay rejects invalid transition-admission replay, tenant/store/scope mismatch, witness sequence gaps, previous witness hash breaks, tampered witness records, non-certified certificates, insufficient certificate quorum, wrong subject, wrong authority boundary, missing latest transition-admission witness, and witness/admission record mismatch.

Authority boundary it requires: strict history-root settlement replay can demand transition-admission replay whose latest row is witnessed; strict recovery transparency evaluation and action review can demand that same witnessed transition-admission replay before accepting settled store roots.

Failure modes it should prevent: connector-supplied history-root settlement authority-transition rows, certificate-local transition-admission rows, stale or private transition-admission snapshots, wrong-subject transition-admission witnesses, missing latest transition-admission witnesses, and recovered state authorized by unwitnessed settlement-authority topology history.

Minimal implementation slice: add history-root settlement authority-transition admission witness record/replay types, deterministic hashes, strict replay/evaluation flags, action-review enforcement option, migration `0107`, and tests for valid witnessed transition-admission rows, missing transition-admission witness refusal, missing strict witness layer refusal, and wrong witness certificate subject refusal.

Tests that would falsify it: valid witnessed transition-admission rows fail; strict transition-admission replay passes without an admission-witness replay; strict root settlement replay passes when the transition-admission replay has no witness ledger; strict recovery transparency evaluation or action review passes without the new witnessed transition-admission replay; a witness certificate over the wrong transition-admission record hash passes.

Axis surfaces that could later validate it: Axis C direct amnesiac recovery with replayed history-root settlement transition-admission witness records, Axis A finance recovery roots attempting stale transition-admission rows, and Axis B/domain adapters attempting to supply local settlement-authority transition-admission rows instead of witnessed record history.

## Falsification Criteria

- A history-root settlement authority-transition admission history with a valid witness ledger must satisfy strict transition-admission replay, strict root-settlement replay, strict recovery transparency evaluation, and blocking action review.
- Strict transition-admission replay must fail if `requireAdmissionWitness` is true and the admission-witness replay is missing.
- Strict root-settlement replay must fail if `requireSettlementAuthorityTransitionAdmissionWitness` is true and transition-admission replay has no witness ledger.
- Strict recovery transparency evaluation must fail when root-settlement replay lacks the transition-admission witness layer.
- Transition-admission witness replay must fail if its certificate subject hash does not match the exact transition-admission record hash.

## Active 10-Question Backlog

1. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Falsified: a history-root settlement authority-transition admission row is accountable if its embedded certificate validates against prior topology.
- Falsified: replay-valid transition-admission rows are enough to constitute recovery transparency authority when they are supplied by the caller.
- Falsified: certificate-local admission rows can stand in for a separate replayed witness ledger over exact transition-admission record hashes.
- Still open: transition-admission witness certificates are not yet topology-bound or signature-bound in this new layer; SQ147 names that missing authority boundary.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for history-root settlement authority-transition admission witness records.
- Extended transition-admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extended history-root settlement replay with `requireSettlementAuthorityTransitionAdmissionWitness`.
- Extended recovery transparency evaluation and action review with `requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitness`.
- Added history-root transparency issue codes for transition-admission witness replay and witness-record failures.
- Added migration `0107_agent_state_history_root_settlement_authority_transition_admission_witness_records.sql`.
- Added tests for valid witnessed transition-admission rows, strict missing transition-admission witness refusal, strict missing witness layer refusal, and wrong witness certificate subject refusal.

Focused verification before ledger publication:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "history-root settlement authority"` (3 passed, 205 skipped)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (612 passed, 143 skipped)

Outcome: SQ137 is closed. SQ138 is now the active next substrate question, with SQ147 added as history-root transition-admission witness authority topology/signature pressure.

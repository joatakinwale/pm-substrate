# v180 - Operational State History-Root Settlement Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ127

## Research Question

What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?

## Sources

- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Alvisi, Pierce, and Reiter, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Martin, Alvisi, and Dahlin, "A Framework for Dynamic Byzantine Storage", DSN 2004: https://www.cs.cornell.edu/lorenzo/papers/dsn04.pdf
- Chuat, Szalachowski, Perrig, Laurie, and Messeri, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs", 2015: https://netsec.ethz.ch/publications/papers/gossip2015.pdf
- Li and Lesani, "Reconfigurable Heterogeneous Quorum Systems", DISC 2024: https://drops.dagstuhl.de/storage/00lipics/lipics-vol319-disc2024/LIPIcs.DISC.2024.52/LIPIcs.DISC.2024.52.pdf

## Mechanism Extracted

Raft reconfiguration makes membership change a committed log entry and prevents old and new configurations from making independent decisions by requiring overlap during transition. Dynamic Byzantine quorum work generalizes the same pressure: current configuration cannot be private local state, because changing membership can break quorum intersection unless transition authority is explicitly preserved. Dynamic Byzantine storage shows why a view must be recoverable as a certified dynamic operation rather than assumed by a reader. Certificate-transparency gossip adds a separate pressure for history roots: currentness of log roots depends on consistency evidence across public observations, not on one client-local view.

The substrate adaptation is history-root settlement authority-transition admission. v170 made settlement certificates topology-bound, but strict recovery transparency could still receive a valid-looking settlement authority topology as an input object. v180 adds a transition-admission ledger for that topology. Strict history-root settlement replay can now require the settlement authority topology to be recovered from admitted authority-transition records. Each admission record binds the authority transition hash, the derived next topology hash, and, after bootstrap, the previous replayed topology hash whose active principals certified the transition.

## Existing Substrate Map

- v150 added signed history-root observations so observer evidence cannot be unsigned local gossip.
- v160 added history-root settlement records over exact root commitment hashes.
- v170 added history-root settlement authority topology so settlement certificates count only unique active topology principals.
- Migration `0087` persists append-only history-root settlement authority-transition rows.
- Before v180, `replayOperationalStateHistoryRootSettlementRecords()` could require `settlementAuthorityTopology`, but that topology object could still be supplied from memory, adapters, connector cache, or self-authored transition rows.

## Missing Substrate Map

- Before v180, history-root settlement authority-transition rows were append-only storage, not admitted operational authority.
- Before v180, strict recovery transparency could consume a settlement authority topology without proving the latest authority transition was admitted.
- Before v180, a supplied topology could authorize the settlement certificate that made a recovery root current without proving the topology's own admission path.
- Before v180, no replay object bound settlement authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v180: genesis/bootstrap authority for the first settlement-authority transition, separate witness/finality for the transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime transparency-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state history-root settlement authority-transition admission.

Problem it solves: prevents history-root settlement authority topology from becoming operational recovery-root authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: Raft joint consensus, dynamic Byzantine quorum systems, dynamic Byzantine storage, certificate-transparency gossip, and reconfigurable heterogeneous quorum systems.

Mechanism borrowed: reconfiguration is itself admitted state. The current settlement authority must derive from admitted transition history; post-bootstrap changes must be certified by prior admissible authority rather than by the proposed new topology.

Why current substrate lacked it: v170 bound settlement certificates to replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: signed observations, settlement records, and topology-bound settlement certificates constrain root evidence, but not the authority-transition ledger that defines which settlement witnesses exist. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict recovery transparency can consume a history-root settlement authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each history-root settlement authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap settlement-authority changes are counted against the previous replayed history-root settlement authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied settlement topology, stale local settlement authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and recovered state authorized by unadmitted settlement-authority transition history.

Minimal implementation slice: add history-root settlement authority-transition admission record/replay types, deterministic hashes, strict settlement replay/evaluation flags, action-review enforcement, migration `0097`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict recovery transparency passes when settlement topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C amnesiac recovery using only admitted history-root settlement authority transitions, Axis A finance recovery paths attempting stale root-settlement topology, and Axis B/domain adapters attempting to supply local settlement topology instead of replayed authority-transition admission.

## Falsification Criteria

- A history-root settlement authority topology recovered from admitted transition records must satisfy strict settlement replay and strict recovery transparency.
- Strict recovery transparency must fail if settlement authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a history-root settlement authority topology is safe if its hash verifies and its principals satisfy settlement-certificate quorum.
- Falsified: append-only history-root settlement authority-transition rows are enough to constitute operational recovery-root authority.
- Falsified: a topology object supplied to settlement replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial history-root settlement authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for history-root settlement authority-transition admissions.
- Extended history-root settlement replay with `settlementAuthorityTransitionAdmissionReplay` and `requireSettlementAuthorityTransitionAdmission`.
- Extended recovery transparency evaluation and action-review options with root-settlement authority transition-admission strictness.
- Added history-root transparency issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0097_agent_state_history_root_settlement_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm exec vitest run packages/agent-state/src/index.test.ts` (190 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (594 passed, 143 skipped)

Outcome: SQ127 is closed. SQ128 is now the active next substrate question, with SQ137 added as new history-root settlement authority-transition admission accountability pressure.

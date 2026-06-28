# v181 - Operational State Pruning-Policy Admission Witness Authority-Transition Admission

Date: 2026-06-27
Question closed: SQ128

## Research Question

What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?

## Sources

- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Becker, Fournet, and Gordon, "SecPAL: Design and Semantics of a Decentralized Authorization Language", Journal of Computer Security 2010: https://www.microsoft.com/en-us/research/wp-content/uploads/2010/01/jcs-final.pdf
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm", USENIX ATC 2014: https://raft.github.io/raft.pdf
- Alvisi, Pierce, and Reiter, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Li and Lesani, "Reconfigurable Heterogeneous Quorum Systems", DISC 2024: https://drops.dagstuhl.de/storage/00lipics/lipics-vol319-disc2024/LIPIcs.DISC.2024.52/LIPIcs.DISC.2024.52.pdf

## Mechanism Extracted

Proof-carrying authentication and SecPAL separate an authorization decision from private belief by requiring checkable policy/credential proof material at the decision boundary. That is necessary for pruning-policy admission, but not sufficient: the authority that witnesses a policy admission can itself drift. Dynamic quorum and reconfiguration literature supplies the missing mechanism: membership or trust topology changes are operational only when they are admitted transitions, and post-bootstrap changes are certified by the prior admissible topology rather than by the proposed new one.

The substrate adaptation is pruning-policy admission witness authority-transition admission. v171 made pruning-policy admission witness certificates topology-bound, but strict policy admission could still receive a valid-looking witness authority topology as an input object. v181 adds a transition-admission ledger for that topology. Strict pruning-policy admission witness replay can now require the witness authority topology to be recovered from admitted authority-transition records. Each admission record binds the authority transition hash, the derived next topology hash, and, after bootstrap, the previous replayed topology hash whose active principals certified the transition.

## Existing Substrate Map

- v141 added the pruning-policy compiler so recovery lanes can be checked against a deterministic policy artifact.
- v151 added pruning-policy admission records for replay-current policy artifacts.
- v161 added pruning-policy admission witness records over exact policy admission record hashes.
- v171 added pruning-policy admission witness authority topology so witness certificates count only unique active topology principals.
- Migration `0088` persists append-only pruning-policy admission witness authority-transition rows.
- Before v181, `replayOperationalStatePruningPolicyAdmissionWitnessRecords()` could require `witnessAuthorityTopology`, but that topology object could still be supplied from memory, adapters, connector cache, or self-authored transition rows.

## Missing Substrate Map

- Before v181, pruning-policy admission witness authority-transition rows were append-only storage, not admitted operational authority.
- Before v181, strict policy admission could consume a witness authority topology without proving the latest authority transition was admitted.
- Before v181, a supplied topology could authorize the witness certificate that made a pruning policy admissible without proving the topology's own admission path.
- Before v181, no replay object bound policy-admission witness authority transition hash, previous topology hash, next topology hash, and transition-admission certificate.
- Still missing after v181: genesis/bootstrap authority for the first policy-admission witness-authority transition, separate witness/finality for the transition-admission ledger itself, signature/key-status verification for transition-admission certificates, runtime policy-store adoption, compaction/currentness for this admission lane, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state pruning-policy admission witness authority-transition admission.

Problem it solves: prevents pruning-policy admission witness authority topology from becoming operational policy authority merely because a caller supplied a hash-valid topology or authority-transition rows.

Research source: proof-carrying authentication, SecPAL decentralized authorization, Raft joint consensus, dynamic Byzantine quorum systems, and reconfigurable heterogeneous quorum systems.

Mechanism borrowed: authorization decisions require checkable proof objects, and authority reconfiguration is itself admitted state. The current policy-admission witness authority must derive from admitted transition history; post-bootstrap changes must be certified by prior admissible authority rather than by the proposed new topology.

Why current substrate lacked it: v171 bound pruning-policy admission witness certificates to replayed topology, but did not prove the topology's authority-transition rows were themselves admitted.

Why existing primitives are insufficient: pruning-policy admission records, witness records, and topology-bound witness certificates constrain policy evidence, but not the authority-transition ledger that defines which witnesses exist. Append-only SQL rows are storage discipline, not operational admission.

State guarantee it should create: strict pruning-policy admission can consume a policy-admission witness authority topology only when that topology is recovered from admitted authority-transition history whose latest transition is certified and whose post-bootstrap changes are authorized by the prior active topology.

Admission rule it requires: each pruning-policy admission witness authority transition can be wrapped in an admission record whose certificate names the exact authority transition subject kind, topology id, authority sequence, and authority record hash; after bootstrap, the certificate topology hash must equal the previous replayed topology hash.

Replay rule it requires: replay rejects missing transition-admission history, invalid admission history, tenant/store/scope mismatch, admission sequence gaps, previous admission hash breaks, tampered admission records, tampered authority transitions, authority sequence gaps, previous authority hash breaks, previous topology hash mismatch, next topology hash mismatch, non-certified certificates, certificate quorum failure, wrong subject, wrong authority boundary, wrong prior topology, duplicate prior witnesses, unknown prior witnesses, inactive prior witnesses, prior-topology quorum failure, missing latest transition admission, and topology mismatch.

Authority boundary it requires: transition-admission certificates for post-bootstrap policy-admission witness authority changes are counted against the previous replayed pruning-policy admission witness authority topology, not against the newly proposed topology and not against certificate-local witness ids.

Failure modes it should prevent: connector-supplied policy witness topology, stale local policy-admission witness authority, self-authored topology rows, new-member self-certification, duplicate signer amplification, wrong prior-topology certificates, topology/admission substitution, and recovered state authorized by unadmitted policy witness-authority transition history.

Minimal implementation slice: add pruning-policy admission witness authority-transition admission record/replay types, deterministic hashes, strict witness replay/evaluation flags, action-review enforcement, migration `0098`, and tests for valid admitted topology, missing transition admission, missing latest transition, unknown prior witness, duplicate prior witness, and wrong prior topology.

Tests that would falsify it: valid admitted transition history fails; strict policy admission passes when witness topology exists but transition admission is missing; a topology whose latest authority transition is not admitted passes; a post-quorum transition certified by an unknown prior witness passes; duplicate prior witnesses satisfy quorum; a certificate bound to the wrong prior topology passes.

Axis surfaces that could later validate it: Axis C direct recovery from admitted policy authority transitions, Axis A finance pruning-policy adoption attempting stale witness topology, and Axis B/domain adapters attempting to supply local policy witness topology instead of replayed authority-transition admission.

## Falsification Criteria

- A pruning-policy admission witness authority topology recovered from admitted transition records must satisfy strict witness replay and strict policy admission.
- Strict pruning-policy admission must fail if witness authority topology is present but transition-admission replay is absent.
- Transition-admission replay must fail if the required latest authority topology is not backed by an admitted authority transition.
- Transition-admission replay must fail if a post-quorum transition certificate names an unknown prior-topology witness.
- Transition-admission replay must fail if duplicate prior-topology witness ids are used to satisfy quorum.
- Transition-admission replay must fail if a post-quorum transition certificate binds to the wrong previous topology hash.

## Active 10-Question Backlog

1. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?
2. SQ130: What admission, witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
3. SQ131: What admission, witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
4. SQ132: What admission, witness, or finality rule makes proof-record admission witness authority-transition history accountable instead of self-authored topology rows?
5. SQ133: What admission, witness, or finality rule makes authority-topology checkpoint admission witness authority-transition history accountable instead of self-authored topology rows?
6. SQ134: What admission, witness, or finality rule makes signature-verifier proof admission witness authority-transition history accountable instead of self-authored topology rows?
7. SQ135: What admission, witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ136: What bootstrap, admission-witness, or finality rule makes recovery-cut admission witness authority-transition admission records accountable instead of certificate-local admission rows?
9. SQ137: What bootstrap, admission-witness, or finality rule makes history-root settlement authority-transition admission records accountable instead of certificate-local admission rows?
10. SQ138: What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Failed Assumption Ledger

- Falsified: a pruning-policy admission witness authority topology is safe if its hash verifies and its principals satisfy witness-certificate quorum.
- Falsified: append-only pruning-policy admission witness authority-transition rows are enough to constitute operational policy authority.
- Falsified: a topology object supplied to witness replay can stand in for admitted topology-transition history.
- Still open: bootstrap transition admission currently anchors the initial pruning-policy admission witness authority topology; the first admission root needs its own accountable genesis/finality rule.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Added `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecord` and replay types.
- Added deterministic hash/build/verify/replay functions for pruning-policy admission witness authority-transition admissions.
- Extended pruning-policy admission witness replay with `witnessAuthorityTransitionAdmissionReplay` and `requireWitnessAuthorityTransitionAdmission`.
- Extended pruning-policy admission evaluation and action-review options with witness-authority transition-admission strictness.
- Added pruning-policy issue codes for invalid/missing transition-admission history and prior-topology authorization failures.
- Added migration `0098_agent_state_pruning_policy_admission_witness_authority_transition_admissions.sql`.
- Added tests for valid transition-admitted topology, strict missing transition-admission refusal, missing latest transition refusal, unknown prior witness refusal, duplicate prior witness refusal, and wrong prior topology refusal.

Focused verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm exec vitest run packages/agent-state/src/index.test.ts` (192 passed)

Full verification after ledger publication:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (596 passed, 143 skipped)

Outcome: SQ128 is closed. SQ129 is now the active next substrate question, with SQ138 added as new pruning-policy admission witness authority-transition admission accountability pressure.

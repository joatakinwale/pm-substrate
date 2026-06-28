# v172 - Operational State Storage Mutation Guard Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ119

## Research Question

What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies", IEEE Symposium on Security and Privacy 1987: https://groups.csail.mit.edu/ana/Publications/PubPDFs/A%20Comparison%20of%20Commercial%20and%20Military%20Computer%20Security%20Policies.pdf
- Ge, Polack, and Laleau, "Secure Databases: An Analysis of Clark-Wilson Model in a Database Environment", CAiSE 2004: https://link.springer.com/content/pdf/10.1007/978-3-540-25975-6_18
- Ferraiolo and Kuhn, "Role-Based Access Controls", NIST/15th National Computer Security Conference 1992: https://csrc.nist.gov/files/pubs/conference/1992/10/13/rolebased-access-controls/final/docs/ferraiolo-kuhn-92.pdf
- Sandhu, Coyne, Feinstein, and Youman, "Role-Based Access Control Models", IEEE Computer 1996: https://csrc.nist.gov/csrc/media/projects/role-based-access-control/documents/sandhu96.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems", STOC 1997 / Distributed Computing 1998: https://users.ece.cmu.edu/~reiter/papers/1997/STOC.pdf

## Mechanism Extracted

Clark-Wilson identifies well-formed transactions, separation of duty, and append-only audit logs as the core integrity mechanisms that stop protected data from being modified arbitrarily. The database analysis of Clark-Wilson shows that these ideas map naturally to DBMS triggers, authorization checks, transaction logs, and integrity constraints. RBAC work adds that administrative authority and high-impact permissions should be centrally constrained and role-mediated rather than discretionary. Byzantine quorum systems add the signer-count bridge: a quorum certificate is not meaningful unless its signer universe and fault assumptions are explicit.

The substrate adaptation is a storage mutation guard admission witness authority topology. v162 made guard-authorization admission rows accountable to a separate witness ledger, and the SQL guard trigger already requires latest witnessed admission. SQ119 closes the signer/topology gap in that witness layer: strict guard authorization evaluation can now require witness certificates to bind to a replayed guard-admission witness authority topology hash, and replay counts only unique active topology principals toward quorum.

## Existing Substrate Map

- v142 added storage mutation guards so protected UPDATE/DELETE paths require tombstone-derived mutation authorization.
- v152 added storage mutation guard authorization admission records so guard authorization rows must replay as latest procedure/role-scoped admitted transitions.
- v162 added storage mutation guard authorization admission witness records and SQL trigger wiring so guard-admission rows require a separate hash-linked witness ledger over the exact admission record hash.
- v146 added generic authority-transition/topology primitives that project active/suspended/revoked/equivocated principals, quorum thresholds, and topology hashes from replayed authority history.
- v169-v171 established adjacent topology-bound replay patterns for recovery-cut admission witnesses, history-root settlement certificates, and pruning-policy admission witnesses.
- Before v172, `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecords()` checked certificate hash, certified status, subject, boundary, and certificate-declared quorum counts.

## Missing Substrate Map

- Before v172, a guard-admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible guard-admission principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed guard-admission witness topology.
- Duplicate witness ids could satisfy certificate length checks.
- Suspended, revoked, equivocated, or unknown guard-admission witnesses could count as if they were active.
- Existing guard admission and witness rows made protected storage mutation accountable to rows and SQL trigger joins, not to replayed signer authority.
- Still missing after v172: admission/witness/finality for the guard-admission witness authority-transition ledger itself, guard-admission witness signature/key-status verification, runtime store adoption for topology replay, authority compaction, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state storage mutation guard admission witness authority topology.

Problem it solves: prevents self-authored storage mutation guard authorization admission witness records from authorizing protected mutation by carrying certificates with arbitrary guard-admission witness ids.

Research source: Clark-Wilson integrity policy, Clark-Wilson database enforcement, RBAC and separation-of-duty models, and Byzantine quorum systems.

Mechanism borrowed: protected state mutation is legitimate only through certified, role-constrained, auditable transactions; the approval of those transactions must come from an accountable authority set, and quorum counts only matter under an explicit signer topology.

Why current substrate lacked it: v162 required witness records over guard-admission rows, but did not bind witness signer ids to replayed guard-admission witness authority.

Why existing primitives are insufficient: storage guards block direct mutation and guard-admission records replay authorization, but the witness certificate signer set was still certificate-local. Generic authority topology existed, but guard-admission witness replay did not consume it.

State guarantee it should create: strict storage mutation guard evaluation can accept a witnessed guard-admission row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy the topology quorum.

Admission rule it requires: guard-admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate guard-admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a storage mutation authorization can be accepted.

Authority boundary it requires: the witness certificate remains over `operational_state_storage_mutation_guard_authorization_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed guard-admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: procedure-owned witness lists, stale guard witness authority, suspended or revoked guard witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and protected UPDATE/DELETE authorized by guard-admission identities not present in replayed authority history.

Minimal implementation slice: extend guard-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict storage-guard evaluation flags, add durable SQL authority-transition storage for this guard witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness guard admission fails; strict guard evaluation passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C direct protected storage mutation after amnesiac recovery, Axis A finance replay-pruning transactions that try to delete store rows through stale guard authority, and Axis B/domain adapters attempting to use connector-owned guard witness identities.

## Falsification Criteria

- A latest storage mutation guard authorization admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict guard evaluation.
- Strict guard evaluation must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
8. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
9. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ129: What admission, witness, or finality rule makes storage mutation guard authorization admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified storage mutation guard authorization admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a guard-admission witness certificate can be treated as authority without replaying guard witness topology.
- Falsified: SQL guard trigger joins plus guard-admission witness rows are sufficient without lane-specific replay of guard-admission witness authority.
- Still open: guard-admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added guard-admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateStorageMutationGuard()` with guard-admission witness authority topology strictness.
- Added migration `0089_agent_state_storage_mutation_guard_authorization_admission_witness_authority_transitions.sql` with append-only guard-admission witness authority-transition rows.
- Added tests for valid topology-bound guard-admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (174 passed)

Outcome: SQ119 is closed. SQ120 is now the active next substrate question, with SQ129 added as new storage mutation guard authorization admission witness authority-transition accountability pressure.

# v162 - Operational State Storage Mutation Guard Authorization Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ109

## Research Question

What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?

## Sources

- Sandhu, "Separation of Duties in Computerized Information Systems", IFIP WG11.3 Workshop on Database Security 1990: https://profsandhu.com/confrnc/ifip/i90sep.pdf
- Ceri, Cochrane, and Widom, "Practical Applications of Triggers and Constraints", VLDB 2000: https://www.vldb.org/conf/2000/P254.pdf
- Cochrane, Pirahesh, and Mattos, "Integrating Triggers and Declarative Constraints in SQL Database Systems", VLDB 1996: https://www.vldb.org/conf/1996/P567.PDF
- Basin, Burri, and Karjoth, "Separation of Duties as a Service", ACM ASIACCS 2011: https://people.inf.ethz.ch/basin/pubs/asiaccs11.pdf
- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies", IEEE Symposium on Security and Privacy 1987: https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db

## Mechanism Extracted

Clark-Wilson supplies the well-formed transaction bridge: constrained transformation procedures can preserve integrity only when the authorized path is itself controlled. Sandhu separation of duties adds the missing accountability mechanism: no single actor should be able to both prepare and complete a critical authority transition, and relevant history should travel with protected records. VLDB trigger/constraint work gives the enforcement boundary: the database can reject protected mutation at the DBMS edge rather than relying on application memory. Separation-of-duties-as-a-service adds the external monitor pattern: authorization decisions can be checked by a separate enforcement service with changing role/user state.

The substrate adaptation is a storage mutation guard authorization admission witness ledger. A guard authorization row already needed a replay-current admission record after v152, but that admission row was still procedure/role-scoped authority authored by the same operational lane. v162 makes that row accountable: strict guard evaluation can require a separate hash-linked witness replay whose quorum certificate certifies the exact guard/table/operation admission record hash under an expected authority boundary.

## Existing Substrate Map

- v142 added tombstone-derived storage mutation authorizations and compiled SQL triggers for protected UPDATE/DELETE.
- v152 added `OperationalStateStorageMutationGuardAuthorizationAdmissionRecord`, procedure/role-bound admission replay, and SQL guard checks that require the latest admitted authorization hash.
- v159 and v161 established the generic pattern that admission rows need separate witness accountability before they can support strict operational state.
- Existing quorum certificate proof objects can certify exact subject kind/id/sequence/hash, but before v162 they were not bound to storage guard authorization admission rows.

## Missing Substrate Map

- Before v162, a guard-admission row could be hash-valid, latest, and procedure-labeled while still being a self-authored authority assertion.
- The SQL trigger could require latest admission but not the accountability of the latest admission.
- Existing guard admission replay proved currentness of the authorization row, not separation of duties for the admission row.
- Existing recovery-cut and policy witness records did not cover the storage mutation path that can delete or update operational history tables.
- Still missing after v162: guard-admission witness authority topology, witness signatures/key status, runtime deployment of witness-admission procedures, trigger-side certificate verification, witness-ledger compaction, and live Postgres privilege tests.

## Primitive Proposal

Name: operational state storage mutation guard authorization admission witness record.

Problem it solves: prevents self-authored storage mutation guard authorization admission rows from authorizing protected operational-state mutation.

Research source: Clark-Wilson well-formed transactions, Sandhu separation of duties, VLDB trigger/constraint enforcement, and separation-of-duties-as-a-service enforcement monitors.

Mechanism borrowed: a critical integrity transition must pass through a constrained procedure and a separate accountability witness/quorum before the DBMS accepts protected mutation.

Why current substrate lacked it: v152 made guard authorization rows replay-current, but the admission record itself remained the last operational authority object.

Why existing primitives are insufficient: recovery-cut witnesses certify recovered cuts, policy witnesses certify pruning-policy rows, and guard admission records certify authorization currentness; none certify that a guard-admission transition was admitted by an authority separate from the procedure row.

State guarantee it should create: a storage mutation guard authorization can satisfy strict evaluation only when the latest authorization admission record replays and a separate witness ledger quorum-certifies the exact admission record hash, guard id, protected table, operation, and admission sequence.

Admission rule it requires: witness records bind tenant, guard-admission witness store, authority scope, guard id, protected schema/table, operation, witness sequence, admission sequence, authorization hash, admission record hash, quorum certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid guard-admission replay, tenant/store/scope mismatch, guard/table/operation mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-admission witnesses, and witness/admission record mismatch.

Authority boundary it requires: the quorum certificate subject must be `operational_state_storage_mutation_guard_authorization_admission_record`, with subject id equal to `guardId:protectedSchema.protectedTable:operation`, subject sequence equal to the admission sequence, and subject hash equal to the guard authorization admission record hash.

Failure modes it should prevent: self-authored procedure rows, fake guard-admission rows created by app writers, stale admitted authorizations, under-quorum guard-admission witnesses, certificate subject substitution, wrong-boundary connector-cache witnesses, witness-history forks, and protected DELETE/UPDATE authorized by unwitnessed guard admission history.

Minimal implementation slice: add guard-admission witness record types, deterministic witness hashing, witness replay, strict storage guard evaluation through `requireAuthorizationAdmissionWitnessQuorum`, durable SQL witness table, trigger-side witnessed-latest-admission requirement, and tests for accepted, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest guard admission fails; strict guard evaluation passes with replay-current guard admission but no witness replay; an under-quorum witness certificate passes; a certificate over a different admission record hash passes; a wrong authority boundary passes; the stricter witness flag does not imply the base guard-admission gate.

Axis surfaces that could later validate it: Axis C direct local agent-state recovery with protected history mutation, Axis A finance cleanup/pruning after amnesiac resume, and Axis B/domain adapters attempting to mint guard authorizations from connector state.

## Falsification Criteria

- A latest guard authorization admission record with certified witness replay over the exact admission record hash must satisfy strict storage mutation guard evaluation.
- Strict witness-quorum guard evaluation must block when guard-admission replay exists but witness replay is missing.
- A certificate over the wrong admission record hash must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base guard-admission gate even if the caller does not set `requireAuthorizationAdmission`.

## Active 10-Question Backlog

1. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
2. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
3. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
4. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored topology snapshots?
5. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
6. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?
7. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
9. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
10. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current storage mutation guard authorization admission rows are enough to make protected mutation authority accountable.
- Falsified: a procedure id plus database role is a sufficient substrate authority boundary for guard admissions.
- Still open: witness records carry quorum certificates, but guard-admission witness authority topology, witness signatures/key status, runtime adoption, trigger-side certificate verification, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecord`, replay, evaluation result fields, and issue types.
- `buildOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecord()`, `computeOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecordHash()`, `operationalStateStorageMutationGuardAuthorizationAdmissionSubjectId()`, and `replayOperationalStateStorageMutationGuardAuthorizationAdmissionWitnessRecords()`.
- Strict guard evaluation through `requireAuthorizationAdmissionWitnessQuorum`; the stricter flag implies the base guard-admission replay gate.
- Migration `0079_agent_state_storage_mutation_guard_authorization_admission_witness_records.sql` with append-only witness rows, public DML revocation, and a revised SQL storage guard trigger that requires the latest admission record to have a witness row.
- Tests for valid witness-certified guard admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (154 passed)
- `pnpm typecheck`
- `pnpm test` (558 passed, 143 skipped)
- `git diff --check`

Outcome: SQ109 is closed. SQ110 is now the active next substrate question, with SQ119 added as new guard-admission witness authority pressure.

# v152 - Operational State Storage Mutation Guard Authorization Admissions

Date: 2026-06-27
Question closed: SQ99

## Research Question

What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?

## Sources

- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies", IEEE Symposium on Security and Privacy 1987: https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db
- Ceri, Cochrane, and Widom, "Practical Applications of Triggers and Constraints: Successes and Lingering Issues", VLDB 2000: https://www.vldb.org/conf/2000/P254.pdf
- Sandhu, "Separation of Duties in Computerized Information Systems", IFIP WG11.3 Workshop on Database Security 1990: https://profsandhu.com/confrnc/ifip/i90sep.pdf
- Cochrane, Pirahesh, and Mattos, "Integrating Triggers and Declarative Constraints in SQL Database Systems", VLDB 1996: https://www.vldb.org/conf/1996/P567.PDF

## Mechanism Extracted

Clark-Wilson separates constrained data from arbitrary user writes: data integrity is preserved by certified transformation procedures and audit, not by granting users direct mutation power. Sandhu's separation-of-duty work adds the relevant-history bridge: the record should carry enough history to enforce that the right steps occurred under the right role or procedure. Database trigger work supplies the storage boundary: integrity must be enforced inside the DBMS, because application-level discipline does not cover direct SQL paths.

The substrate adaptation is a storage mutation guard authorization admission record. A tombstone-derived storage authorization row is not operational authority merely because it exists. It must be admitted by an expected well-formed guard admission procedure/role into a hash-linked admission history. The storage guard evaluator and SQL trigger can then require the authorization hash to be the latest admitted authorization for the tenant, guard, protected table, and operation.

## Existing Substrate Map

- v142 added storage mutation guards, authorization hashes, and a generic trigger that blocks protected UPDATE/DELETE unless the transaction presents a matching authorization hash.
- The authorization row binds tenant, guard id, protected table, operation, authorized sequence frontier, tombstone record hash, pruning admission hash, and recorded time.
- Existing pure evaluation rejects missing, stale, table-confused, operation-confused, or tampered authorization rows.

## Missing Substrate Map

- Before v152, an actor able to INSERT into `agent_state.storage_mutation_guard_authorizations` could create a valid-looking guard authorization row.
- v142's trigger checked the authorization row but not whether the row was admitted by a well-formed transition procedure.
- Append-only authorization rows prevented rewrite, but not self-authored creation.
- Existing policy and recovery admission records did not govern physical storage mutation authorizations.
- Still missing after v152: signed/quorum authority for admission records, runtime deployment of role grants, live Postgres privilege tests, automatic trigger adoption for every prunable table, and guard-admission compaction.

## Primitive Proposal

Name: operational state storage mutation guard authorization admission record.

Problem it solves: prevents arbitrary guard authorization rows from minting tombstone authority for protected storage mutations.

Research source: Clark-Wilson well-formed transactions, Sandhu separation-of-duty history, and database trigger/constraint enforcement models.

Mechanism borrowed: constrained data can be changed only through certified procedures; separation-of-duty evidence travels with the record; triggers enforce the storage boundary.

Why current substrate lacked it: v142 guarded physical UPDATE/DELETE but treated a matching authorization row as already admitted authority.

Why existing primitives are insufficient: authorization hashes prove row identity, not that the row was produced by the admitted guard procedure or role.

State guarantee it should create: a storage mutation authorization can satisfy a protected UPDATE/DELETE only when the authorization hash is the latest replayed admission record for the tenant, guard, protected table, and operation.

Admission rule it requires: guard authorization admission records bind tenant, guard, protected table, operation, admission sequence, authorization hash, previous admission hash, embedded authorization, admission procedure id, admission role, admitted-at/by metadata, and admission record hash.

Replay rule it requires: replay rejects tenant/guard/table/operation mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered embedded authorizations, tampered admission records, wrong admission procedure, wrong admission role, and stale required authorization hashes.

Authority boundary it requires: v152 proves role/procedure-scoped admission history, not yet signer or quorum authority over admission rows. SQ109 must define how admission records become accountable if the database role or procedure boundary itself is compromised.

Failure modes it should prevent: fake authorization rows, table-confused tombstone authority, stale authorization reuse after a newer admitted row, app-writer direct insert into authorization tables, and mutation triggers accepting authorization rows without admission history.

Minimal implementation slice: add admission record/replay types, deterministic admission hashing, `requireAuthorizationAdmission` in storage guard evaluation, migration `0069` with append-only admission rows and an updated SQL trigger requiring the latest admitted authorization hash.

Tests that would falsify it: a valid admitted authorization fails; direct unadmitted authorization row passes when admission is required; stale authorization passes after later admission; wrong procedure or role passes strict replay; tampered embedded authorization passes with a recomputed outer admission hash.

Axis surfaces that could later validate it: Axis C live Postgres direct-insert mutation attempts, Axis A finance pruning after tombstone admission, and Axis B/domain adapters attempting to delete protected rows by minting local guard rows.

## Falsification Criteria

- A matching authorization with a valid latest admission record must pass strict storage mutation guard evaluation.
- A matching authorization row without admission replay must fail under `requireAuthorizationAdmission`.
- A stale authorization must fail after a newer authorization is admitted for the same tenant, guard, table, and operation.
- Wrong admission role or procedure must invalidate strict replay.
- Tampering with the embedded authorization must fail even if the outer admission record hash is recomputed.
- The SQL trigger must require the authorization hash to match the latest admission record, not merely exist in the authorization table.

## Active 10-Question Backlog

1. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
2. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
3. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
4. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
5. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
6. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
7. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
8. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
9. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?
10. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?

## Failed Assumption Ledger

- Falsified: a hash-valid row in `storage_mutation_guard_authorizations` is sufficient tombstone authority.
- Falsified: append-only protection prevents forged creation. It prevents rewrite/deletion, not unauthorized insertion.
- Still open: v152 supplies procedure/role-scoped admission replay and SQL latest-admission checks, but signer/quorum authority, runtime role deployment, live privilege tests, and admission compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateStorageMutationGuardAuthorizationAdmissionRecord`, replay, and issue types.
- `buildOperationalStateStorageMutationGuardAuthorizationAdmissionRecord()`, `computeOperationalStateStorageMutationGuardAuthorizationAdmissionRecordHash()`, and `replayOperationalStateStorageMutationGuardAuthorizationAdmissionRecords()`.
- `evaluateOperationalStateStorageMutationGuard({ requireAuthorizationAdmission: true })` so matching authorization rows fail unless they are latest admitted records.
- Migration `0069_agent_state_storage_mutation_guard_authorization_admissions.sql` with append-only admission records, public DML revocation for guard authorization/admission tables, and an updated trigger requiring latest admitted authorization.
- Tests for valid admitted authorization replay, direct unadmitted row refusal, stale authorization refusal, wrong-role refusal, and tampered embedded authorization refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (126 passed)
- `git diff --check`

Full verification after ledger publication:

- `pnpm typecheck` (workspace typecheck passed)
- `pnpm test` (530 passed, 143 skipped)
- `git diff --check` (passed)

Outcome: SQ99 is closed. SQ100 is now the active next substrate question, with SQ109 added as new guard-admission authority pressure.

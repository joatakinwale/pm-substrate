# v142 - Operational State Storage Mutation Guard

Date: 2026-06-27
Question closed: SQ89

## Research Question

What storage-level guard or database policy prevents out-of-band DELETE/UPDATE from bypassing tombstone-gated pruning APIs?

## Sources

- Clark and Wilson, "A Comparison of Commercial and Military Computer Security Policies", IEEE Symposium on Security and Privacy 1987: https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db
- Ceri, Cochrane, and Widom, "Practical Applications of Triggers and Constraints: Successes and Lingering Issues", VLDB 2000: https://research.ibm.com/publications/practical-applications-of-triggers-and-constraints-successes-and-lingering-issues
- Lu et al., "A Lightweight and Efficient Temporal Database Management System in TDSQL", PVLDB 2019: https://www.vldb.org/pvldb/vol12/p2035-lu.pdf

## Mechanism Extracted

Clark-Wilson supplies the commercial-integrity mechanism: constrained data should not be changed arbitrarily by users; it should be changed only through certified well-formed transactions, with an append-only log sufficient to reconstruct the operation. Trigger/constraint work supplies the database enforcement point: the DBMS can maintain application integrity constraints for every statement, including direct statements that bypass application APIs. TDSQL supplies the temporal-storage warning: transaction-time history is protected by making history and transaction identifiers database-assigned and non-user-mutable.

The substrate adaptation is a storage mutation guard. Physical UPDATE/DELETE on protected operational-state storage is not authorized by possession of database connectivity or by application code reaching a SQL statement. A protected table is guarded by a compiled trigger. The trigger reads the affected row's tenant and sequence, reads a transaction-local authorization hash, and checks an append-only `agent_state.storage_mutation_guard_authorizations` table. The authorization must bind tenant, guard id, protected table, operation, authorized sequence frontier, pruning tombstone table, tombstone record hash, pruning admission hash, and recorded time. Without that tombstone-derived authorization, the database rejects the physical mutation.

## Existing Substrate Map

- Tombstone-gated pruning APIs exist across settlement-head, tombstone-head, pruning tombstone-store-head, history-store-head, and target history-store-head pruning layers.
- Durable pruning tombstone tables record replayable row absence and retained suffix frontiers.
- v141 policy compilation can now declare that pruning/recovery lanes are required.
- Existing Postgres store methods still issue ordinary `DELETE FROM ... WHERE sequence <= frontier` after TypeScript-side admission checks.

## Missing Substrate Map

- Before v142, direct SQL DELETE/UPDATE could bypass TypeScript tombstone-gated prune APIs if a caller had sufficient database privileges.
- Before v142, tombstone records authorized application prune methods, but the storage engine had no reusable mutation guard requiring a tombstone authorization.
- Existing append-only comments and replay checks were insufficient because they detect or interpret history after the fact; they do not mediate every physical mutation at the table boundary.
- Existing v141 policy compilation was insufficient because it derives required lanes but does not stop direct storage mutation from changing the data those lanes replay.
- Still missing after v142: automatic trigger adoption for every prunable table, stored-procedure/role separation so arbitrary actors cannot insert fake guard authorizations, dynamic cross-checks that authorization rows reference real tombstone rows, and live Postgres integration tests.

## Primitive Proposal

Name: operational state storage mutation guard.

Problem it solves: prevents out-of-band storage mutation from becoming operational state by bypassing tombstone-gated pruning APIs.

Research source: Clark-Wilson, database triggers/constraints, and transaction-time temporal databases.

Mechanism borrowed: constrained data items can be modified only by well-formed transactions; database triggers/constraints enforce integrity at the storage boundary; historical rows/transaction identifiers are system-controlled.

Why current substrate lacked it: pruning APIs checked tombstones before issuing SQL, but the database tables themselves did not require a tombstone authorization for UPDATE/DELETE.

Why existing primitives are insufficient: replay and tombstone ledgers can detect intended pruning history, but direct SQL can remove or mutate rows unless the storage layer mediates mutation.

State guarantee it should create: a protected operational-state row cannot be physically updated or deleted unless the transaction presents an admitted tombstone-derived guard authorization covering that tenant, table, operation, and sequence frontier.

Admission rule it requires: storage mutation authorizations must be append-only, hash-bound, tenant/table/operation scoped, and derived from pruning tombstone records plus pruning admission hashes.

Replay rule it requires: evaluators recompute authorization hashes and reject missing, stale, table-mismatched, operation-mismatched, tenant-mismatched, guard-mismatched, or tampered authorizations.

Authority boundary it requires: compiled database triggers call `agent_state.enforce_storage_mutation_guard()` before UPDATE/DELETE on protected tables.

Failure modes it should prevent: direct SQL deletion, direct UPDATE of protected replay history, stale tombstone frontier reuse, table-confused authorization reuse, operation-confused authorization reuse, and tampered authorization rows.

Minimal implementation slice: add storage mutation guard and authorization types, deterministic authorization hashes, SQL guard compiler, pure evaluator, migration `0059` with append-only authorization table plus generic trigger function, and focused tests.

Tests that would falsify it: unsafe table identifiers emit SQL; guard SQL lacks the storage trigger; missing authorization permits mutation; stale authorization covers a later sequence; table-mismatched authorization covers another table; tampered authorization hash passes.

Axis surfaces that could later validate it: Axis C live Postgres pruning bypass attempts, Axis A finance recovery after physical pruning, and Axis B adapter attempts to mutate protected substrate tables directly.

## Falsification Criteria

- A valid storage mutation guard spec must compile to a `BEFORE DELETE` or `BEFORE UPDATE` trigger calling `agent_state.enforce_storage_mutation_guard`.
- Unsafe identifiers must invalidate the guard and emit no SQL.
- A protected mutation with no authorization hash must produce `operational_state_storage_mutation_authorization_missing`.
- A matching authorization must pass evaluation for target sequences at or below its authorized frontier.
- A table-mismatched authorization must produce `operational_state_storage_mutation_authorization_table_mismatch`.
- A stale authorization must produce `operational_state_storage_mutation_authorization_sequence_gap`.
- A tampered authorization row must produce `operational_state_storage_mutation_authorization_hash_mismatch`.

## Active 10-Question Backlog

1. SQ90: What retention or compaction rule lets pruning tombstone histories themselves be compacted without losing required-head currentness proof?
2. SQ91: What witness-ledger compaction or retention rule preserves v134 required-head recovery after the v133 head witness ledger itself is pruned?
3. SQ92: What durable quorum-certificate proof record preserves v135 certified v133 pruning tombstone-store head currentness without transient recertification?
4. SQ93: What authority-store compaction rule preserves v136 topology recovery after v135 authority-transition history itself is pruned?
5. SQ94: What production verifier-adapter boundary binds v137 replayed key ids to external cryptographic material without letting adapters smuggle currentness?
6. SQ95: What finalizer-signature rule makes v138 authority epoch seals attributable to replay-current finalizer principals instead of unsigned authority-store rows?
7. SQ96: What durable recovery-cut admission store or witness protocol makes v139 recovery cuts replayable and non-equivocating across agents, restarts, and worktrees?
8. SQ97: What signature, observer-topology, or quorum rule makes v140 transparency observations accountable instead of letting forged gossip obstruct or bless recovery?
9. SQ98: What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?
10. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?

## Failed Assumption Ledger

- Falsified: tombstone-gated prune APIs are enough if the Postgres tables remain directly mutable. v142 shows storage needs its own mutation guard.
- Falsified: append-only replay comments on migrations are enforcement. They document intent, but triggers/guards are required for statement-level mediation.
- Still open: v142 supplies generic guard compilation and database primitives, but current Postgres stores do not yet automatically install triggers or register guard authorizations inside a fully role-separated transaction procedure.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStateStorageMutationGuardSpec`, guard compilation, guard authorization, request, evaluation, and issue types.
- `compileOperationalStateStorageMutationGuard()` with identifier validation, duplicate-operation rejection, deterministic guard hashes, and PostgreSQL trigger SQL output.
- `buildOperationalStateStorageMutationGuardAuthorization()` and authorization hash verification.
- `evaluateOperationalStateStorageMutationGuard()` for missing, tampered, tenant, guard, table, operation, and sequence-frontier authorization checks.
- Migration `0059_agent_state_storage_mutation_guards.sql` with append-only `agent_state.storage_mutation_guard_authorizations`, rewrite-prevention trigger, and generic `agent_state.enforce_storage_mutation_guard()` trigger function.
- Tests for valid trigger SQL, unsafe identifier refusal, missing authorization refusal, valid authorization acceptance, stale/table-mismatched authorization refusal, and tampered authorization refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts`

Outcome: SQ89 is closed. SQ90 is now the active next substrate question.

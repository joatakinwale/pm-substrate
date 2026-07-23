# v230 Continuity Concurrent-Head Repair

Date: 2026-07-13
Status: observed dogfood repair; not public-benchmark efficacy
primitive_family: obstruction_evidence
primitive_family: replay_semantics

## Research question

When concurrent agents append continuity checkpoints using the same logical
ledger identity, how can pm-substrate prevent sibling heads and recover a fork
without deleting or rewriting evidence?

## Observed failure first

During the D6 public-proof implementation, concurrent agents recorded two
checkpoints six milliseconds apart. Both named `8dd75cd…` as their parent.
The next `dev:resume` reported `chainValid=false`; one checkpoint expected the
other sibling as its predecessor. A 24-writer regression reproduced the race
deterministically before the repair.

This is a substrate dogfood failure, not a public task result. It qualifies a
repair of the continuity mechanism but supplies zero evidence of benchmark
task lift.

## Adjacent mechanisms researched

- [PostgreSQL explicit-locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html)
  defines transaction-level advisory locks for application-defined resources
  that are awkward to lock with MVCC row locks; the lock is released with the
  transaction. This fits the logical `(tenant, agent)` chain, whose next row
  does not yet exist and therefore cannot be row-locked.
- [PostgreSQL advisory-lock functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
  defines `pg_advisory_xact_lock` as a waiting exclusive transaction-level
  lock over an application key.
- [Git merge documentation](https://git-scm.com/docs/git-merge) preserves
  divergent heads as parents of a later merge commit. The relevant mechanism
  is multi-parent reachability, not Git's file-merge policy.
- Chandy and Lamport's [distributed snapshot paper](https://www.microsoft.com/en-us/research/publication/distributed-snapshots-determining-global-states-distributed-system/)
  establishes the need to reason about a consistent global state in an
  asynchronous computation. It motivates treating multiple unmerged heads as
  an obstruction rather than choosing one by timestamp.

## Falsifiable hypothesis

If prior-head selection and insertion occur while holding one
transaction-scoped advisory lock derived from `(tenant_id, agent_id)`, every
committed append for that logical chain will see the immediately preceding
committed head. If an historical fork already exists, a later hash-bound merge
checkpoint that references every orphan head will restore one reachable DAG
head without rewriting either branch.

The hypothesis is false if any of these occur:

1. 24 simultaneous same-identity writers leave more than one head;
2. a merge payload can make an absent, future, duplicate, or unreachable head
   verify;
3. repair modifies an existing checkpoint or hash;
4. different tenant/agent chains are forced through one global lock; or
5. the full CLI path remains invalid after an append-only repair.

## Smallest consumed implementation

`PostgresContinuityLedger.record` now acquires
`pg_advisory_xact_lock(hash(tenant, agent))` before reading the tail and
inserting the child. No new agent-state proof family was added.

`verifyContinuityCheckpointChain` continues to reject forks. It recognizes a
later `continuityChainMerge` payload with schema `continuity-chain-merge.v1`
only as an additional parent set, then
requires every checkpoint to be reachable from exactly one head. The exported
repair planner is consumed by `pnpm dev:repair-chain`; it is not unconsumed
formalism.

Adversarial review then tightened the repair boundary: migration 0150 adds a
database sequence for deterministic listing; appends derive graph heads under
the lock and refuse an ordinary write while forked; a merge must name every
current head but its canonical parent; verification requires exactly one
genesis and rejects an ancestor or unrelated genesis as a fake merge parent;
the repair CLI refuses to proceed over any defect other than unmerged heads;
and one strict shared parser rejects malformed, extra-field, duplicate-head,
empty-reason, or wrong-schema reserved merge payloads before database insertion
as well as during replay.

## Ablation and exact retest

| Test | Lock/merge absent | Lock/merge present |
|---|---|---|
| 24 concurrent appends after one seed | red; sibling heads | green; 25 reachable checkpoints, one head |
| three repeated pressure runs | red before repair | green after repair |
| unmerged synthetic fork | red | still red by design |
| explicit two-head merge | unsupported | green; both branch hashes reachable |
| live dogfood ledger | 71 rows, invalid | 72 rows, valid; orphan hash preserved |
| equal-timestamp tail / normal append on fork | could select silently | deterministic head; ordinary append refused |
| ancestor or two-genesis fake merge | not covered initially | rejected |
| connection killed after insert before commit | not covered initially | row rolled back, lock released, next append is sole genesis |

## Claim boundary and next question

This strengthens existing `obstruction_evidence` and `replay_semantics`; it
does not justify `new_primitive_required`, change `@pm/agent-state-core`, or
count toward D6/D7 public efficacy. The next repair-loop implementation must be
triggered by a preserved public-benchmark failure trace. Until then, D6-E
remains open for public proof even though this dogfood repair demonstrates the
mechanical loop.

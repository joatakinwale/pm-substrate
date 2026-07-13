# Continuity concurrency failure and repair — 2026-07-13

## Observed failure

While three agents worked concurrently on the public-proof program, two
checkpoints for the shared `tenant_dev` / `joat-dev` ledger observed the same
head (`8dd75cd…`) and committed sibling records six milliseconds apart. The
next session reported:

```text
chainValid=false
chk_f0a3f8eb…: priorCheckpointHash mismatch
expected=96fbdbd9… actual=8dd75cd2…
```

This was not a synthetic fixture. It was a real dogfood failure in the state
mechanism that is supposed to coordinate concurrent agents. The fork was kept
in the database while the cause was investigated.

## Cause

`PostgresContinuityLedger.record` opened a transaction and selected the latest
checkpoint with `FOR UPDATE`. That locks the existing tail row, but it does not
lock the logical tenant/agent chain. Concurrent transactions can both select
the same tail and then insert different children. Row locking therefore cannot
make an append atomic.

The failure is deterministic under pressure: a regression test seeds one head,
then launches 24 concurrent writers. Before the repair it produced many sibling
heads and failed verification.

## Smallest runtime repair

The append transaction now first acquires a PostgreSQL transaction-scoped
advisory lock keyed by the JSON encoding of `(tenant_id, agent_id)`. Selection
of the prior head, timestamp creation, hashing, and insertion then occur inside
that serialized critical section. Other tenant/agent ledgers remain
independent.

Existing fork evidence was not deleted or rehashed. Verification now accepts
an append-only Merkle-DAG repair only when a later checkpoint's hashed
`continuityChainMerge` payload names every orphan head. Until that merge exists,
multiple heads remain a verification failure. `pnpm dev:repair-chain` creates
the explicit merge and then re-verifies the whole ledger.

## Adversarial hardening after the first repair

Review of the first repair exposed five ways a superficially plausible merge
could still lie: equal timestamps could make tail order ambiguous, a normal
append could silently choose one fork, two unrelated genesis chains could be
laundered into one, an ancestor could be named as a fake orphan, and a repair
could be added on top of otherwise tampered history.

Migration `0150_continuity_checkpoint_sequence.sql` adds a database-assigned
monotonic `seq` for deterministic listing, but append selection does not trust
sequence alone. Under the same advisory lock, the runtime derives current graph
heads from `priorCheckpointHash` plus declared merge edges. A normal append is
permitted only with zero or one current head. On a fork, the only admissible
write is an exact merge: the payload must name every current head except the one
used as the canonical prior. Verification also requires exactly one genesis
and requires each merged orphan to have exactly one child—the merge itself.

`dev:repair-chain` first verifies the full tenant/agent history and proceeds
only when the sole defect is an unmerged set of heads. Resume and status now
verify the full identity chain even when their displayed briefing is scoped.

## Ablation and retest

| Check | Before | After |
|---|---:|---:|
| 24 concurrent shared-identity appends | red; multiple sibling heads | green, 25/25 checkpoints in one auditable head |
| Repeated pressure test | not applicable | green in three consecutive runs |
| Unmerged-fork unit test | red | still red by design |
| Explicit append-only merge test | unsupported | green; both original branch hashes reachable |
| Live dogfood ledger | 71 rows, invalid | 72 rows, valid; one orphan hash preserved in repair checkpoint |
| Equal-timestamp append ordering | ambiguous | green; database sequence and graph heads agree |
| Normal append while forked | silently selectable | refused; exact all-head merge accepted |
| Two-genesis or ancestor fake merge | not rejected | rejected |
| Repair over unrelated tampering | not rejected | repair CLI refuses |
| Connection killed after insert, before commit | untested | uncommitted row rolled back; lock released; next append is the sole genesis |

This repairs continuity concurrency. It does **not** prove public benchmark
efficacy and must not be counted as task-outcome lift. It is the first observed
failure-driven Arrowsmith repair in the new program: trace → primitive gap →
known database serialization pattern → minimal consumed change → ablation →
exact retest.

## Remaining risks

- The advisory key is a 64-bit PostgreSQL hash. Collision is highly unlikely
  but would conservatively serialize unrelated ledgers rather than corrupt
  them.
- The connection-kill regression proves PostgreSQL rollback and lock release at
  the ledger boundary. A full OS-level kill of `pnpm dev:checkpoint` remains a
  production-CLI chaos test, though it exercises the same transaction scope.
- Concurrent semantic conflicts can be serialized yet still disagree. The
  ledger's contradiction projection remains a separate control.
- The repair record is content-addressed but not externally signed. Database
  custody and independent clean-checkout replay remain necessary if this
  evidence is used outside the local dogfood claim.

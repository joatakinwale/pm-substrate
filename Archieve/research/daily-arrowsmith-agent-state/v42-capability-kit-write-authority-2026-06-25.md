# v42 - Capability Kit Write Authority

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ43.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ43: How should capability-kit idempotency/apply/emit transactions require and propagate graph write authority refs so capability handlers cannot update `graph.nodes` with raw SQL outside graph write authority policy? | Clark-Wilson integrity says high-integrity data should change only through certified transformation procedures rather than arbitrary writes. Schneider-style enforcement says runtime monitors can enforce safety properties by stopping a bad action before it occurs. Sagas and transaction literature reinforce that multi-step effects need an explicit transactional boundary with rollback before partial effects are admitted. Edit automata add the useful pattern of suppressing or transforming invalid action streams rather than only auditing them after the fact. Therefore capability-kit must treat its raw `UPDATE graph.nodes` as a certified transformation procedure: lock/read the target row, resolve a graph write-authority ref, assert the same graph authority policy before invoking `apply`, pass the ref through `apply`/`emit`, and rollback idempotency if the authority check fails. | Added `GraphWriteAuthorityContext`, optional `CapabilitySpec.graphWriteAuthority`, optional `CapabilityRuntimeDeps.graphWriteAuthorityPolicy`, and optional `writeAuthorityRef` on apply/emit contexts. `defineCapability()` now resolves and checks graph write authority after `SELECT ... FOR UPDATE` and before capability `apply` or raw graph SQL. Added database-free tests proving existing behavior remains unchanged without policy, strict policy rejects before `apply`/`UPDATE`, and valid refs pass through `apply` before update. | RQ44: How should workflow/capability dispatch bind graph write-authority refs to substrate-stored `ActionOutcomeEnvelope`/provider-status records so capability code cannot forge syntactically valid authority refs? |

Active question set leaving this run: RQ12-RQ20, RQ44.

## Peer-Reviewed Sources

- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy, 1987. DOI: https://doi.org/10.1109/SP.1987.10001. Bibliographic record: https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db
- Fred B. Schneider, "Enforceable Security Policies," ACM Transactions on Information and System Security, 2000. DOI: https://doi.org/10.1145/353323.353382.
- Hector Garcia-Molina and Kenneth Salem, "Sagas," ACM SIGMOD, 1987. DOI: https://doi.org/10.1145/38713.38742. PDF: https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf
- Jay Ligatti, Lujo Bauer, and David Walker, "Edit Automata: Enforcement Mechanisms for Run-time Security Policies," International Journal of Information Security, 2005. DOI: https://doi.org/10.1007/s10207-004-0046-8.

## Bridge Hypothesis

The capability-kit transaction is a substrate transformation procedure:

```text
idempotency insert -> graph target lock -> authority resolution -> apply -> raw graph update -> emit -> commit
```

The authority check belongs between target lock and `apply`, because `apply` receives the transactional client and could otherwise perform its own raw side effects. A strict capability instance must rollback the idempotency insert when authority is missing, so redelivery can be retried after the missing substrate proof is supplied.

## Falsification Criteria

The v42 slice fails if:

1. `defineCapability()` can execute `apply` under strict graph authority policy without a valid authority ref;
2. the raw `UPDATE graph.nodes` can run after a missing/revoked/mismatched authority ref;
3. idempotency is committed after an authority rejection;
4. existing capability-kit callers break when no authority policy is configured;
5. the authority ref is not available to `apply` or `emit` for downstream evidence/provenance binding;
6. syntactically valid but forged refs are treated as fully solved rather than recorded as the next substrate-store binding problem.

## Implementation Delta

- Added `GraphWriteAuthorityContext<TPayload>` to `@pm/capability-kit`.
- Added optional `CapabilitySpec.graphWriteAuthority`.
- Added optional `CapabilityRuntimeDeps.graphWriteAuthorityPolicy`.
- Added optional `writeAuthorityRef` to `ApplyContext` and `EmitContext`.
- Updated `defineCapability()` so strict graph authority is resolved and checked after the locked-row read and before capability `apply` or raw SQL update.
- Added `packages/capability-kit/src/write-authority.test.ts` with database-free transactional tests.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/capability-kit typecheck
pnpm exec vitest run packages/capability-kit/src/write-authority.test.ts
```

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved substrate capability primitive; existing ArrowHedge graph ports already use graph methods, but actual strict authority propagation still needs workflow/capability binding. |
| Axis B marketing | Still blocked for full verification until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Mechanism improved at capability transaction boundary; local-lab scenarios do not yet require store-backed authority refs end-to-end. |

No verified solution is claimed.

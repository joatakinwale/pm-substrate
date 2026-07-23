# v32 - ArrowHedge Terminal Index Adoption

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ33 from v31.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ33: Which workflow, finance, agency, graph, or capability write boundaries should consume `buildActionOutcomeTerminalIndex()` first so terminal outcome admission becomes operational state discipline rather than verifier-side accounting? | The first consumer should be the highest-consequence domain boundary that already has a pre-action review artifact and depends on `@pm/agent-state`: ArrowHedge's finance proposal-review gate. Clark-Wilson argues integrity comes from constrained well-formed transactions, so the first terminal index consumer should sit at the transaction/admission boundary. Kung/Robinson's optimistic validation supports letting reads and proposals happen speculatively, then validating before commit. Schneider's state-machine approach says service state should be the deterministic result of admitted requests. Garcia-Molina/Salem's sagas show long-lived workflows need explicit step finality. Therefore workflow reports and eval packets should wait; the finance pre-write adapter should emit canonical terminal envelopes and index them before accepted/blocked outcomes can be treated as operational state. | Added `buildArrowHedgeActionOutcomeEnvelope()` and `buildArrowHedgeActionOutcomeTerminalIndex()` in `@pm/capability-finance-research-ingest`. The helper converts ArrowHedge proposal-review artifacts into canonical `ActionOutcomeEnvelope`s and feeds them through the core terminal index. Tests prove a fresh risk-refresh candidate becomes an accepted envelope, a stale candidate for the same action id becomes a blocked envelope, exact replay increments `replayCount`, and the accepted/blocked pair is reported as a terminal conflict rather than two finance outcomes. | RQ34: How should `@pm/workflow` consume canonical terminal admission without violating its dependency-light boundary or duplicating terminal claims between invocation envelopes and `@pm/agent-state` envelopes? |

Active question set leaving this run: RQ12-RQ20, RQ34.

## Peer-Reviewed Sources

- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy 1987. DOI: https://doi.org/10.1109/SP.1987.10001
- H. T. Kung and John T. Robinson, "On Optimistic Methods for Concurrency Control," ACM TODS 1981. DOI: https://doi.org/10.1145/319566.319567
- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach: A Tutorial," ACM Computing Surveys 1990. DOI: https://doi.org/10.1145/98163.98167
- Hector Garcia-Molina and Kenneth Salem, "Sagas," SIGMOD 1987. DOI: https://doi.org/10.1145/38714.38742

## Bridge Hypothesis

The first operational consumer of a terminal index should be the boundary with:

1. a write-capable or high-consequence action;
2. an existing review artifact;
3. direct access to canonical `@pm/agent-state` types;
4. an existing stale/authority failure history.

ArrowHedge satisfies all four. Workflow runtime is next, but it needs a boundary design that preserves its dependency-light invocation envelope.

## Falsification Criteria

The v32 slice fails if:

1. ArrowHedge can produce accepted and blocked terminal envelopes for the same action id without a conflict issue.
2. Exact replay of the same ArrowHedge envelope is treated as a new conflict.
3. A stale proposal-review artifact can still build an accepted terminal envelope by default.
4. The helper only builds eval refs and does not return canonical `ActionOutcomeEnvelope` state.

## Implementation Delta

- `buildArrowHedgeActionOutcomeEnvelope()` builds canonical envelopes from ArrowHedge proposal-review artifacts.
- `buildArrowHedgeActionOutcomeTerminalIndex()` admits those envelopes through `buildActionOutcomeTerminalIndex()`.
- `packages/capability-finance-research-ingest/src/arrowhedge.test.ts` now covers accepted, stale-blocked, idempotent replay, and terminal-conflict behavior at the finance adapter boundary.

## Proof Status

Focused verification passed:

```text
pnpm vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts --reporter=basic
pnpm --filter @pm/capability-finance-research-ingest typecheck
```

Current three-axis state is unchanged:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved. ArrowHedge now has a domain-level terminal index consumer, but all ten failure classes still need terminal-admitted scenario families. |
| Axis B marketing | Blocked until PluggedInSocial is restored/cloned or authoritative agency fixtures are accepted. |
| Axis C local lab | Mechanism coverage exists, but workflow/runtime consumption remains open. |

No verified solution is claimed.


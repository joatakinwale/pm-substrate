# v31 - Terminal Index Codebase Correction

Date: 2026-06-25
Status: implementation correction; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ32 from v30.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ32: How should three-axis proof packets validate their `action_outcome_envelope` refs against live or replay packet stores so terminal-proof-backed scenario passes cannot be satisfied by dangling or hash-invalid refs? | The verifier should not become the primitive. Herlihy and Wing's linearizability gives the key implementation constraint: an operation has one abstract effect point. Clark and Wilson's integrity model says mutation authority must be a well-formed transaction, not arbitrary subject output. ARIES recovery relies on durable log records for restart, so replay should rebuild terminal state from committed records, not from a report. Buneman/Khanna/Tan and Davidson/Freire show provenance links are necessary for explaining derived results, but links are not themselves authority. Therefore proof packets may consume terminal refs, but pm-substrate must first expose a core terminal admission/index primitive: only hash-valid envelopes can enter the terminal partition; exact replays are idempotent; any second different envelope for the same `(tenantId, actionId)` becomes a conflict. | Added `actionOutcomeTerminalKey()` and `buildActionOutcomeTerminalIndex()` in `@pm/agent-state`, and hardened `admitActionOutcomeEnvelope()` so hash-invalid candidates are rejected before partition admission. The new core tests prove idempotent replay, same-action terminal conflict rejection, invalid-hash rejection, terminal index conflict reporting, and stale blocking reviews demoting requested accepted writes to blocked. A half-built eval proof-ref validator was removed from this slice so the implementation target stays in the substrate codebase. | RQ33: Which workflow, finance, agency, graph, or capability write boundaries should consume `buildActionOutcomeTerminalIndex()` first so terminal outcome admission becomes operational state discipline rather than verifier-side accounting? |

Active question set leaving this run: RQ12-RQ20, RQ33.

## Peer-Reviewed Sources

- Maurice P. Herlihy and Jeannette M. Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS 1990. DOI: https://doi.org/10.1145/78969.78972
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy 1987. DOI: https://doi.org/10.1109/SP.1987.10001
- C. Mohan et al., "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging," ACM TODS 1992. DOI: https://doi.org/10.1145/128765.128770
- Peter Buneman, Sanjeev Khanna, and Wang-Chiew Tan, "Why and Where: A Characterization of Data Provenance," ICDT 2001. DOI: https://doi.org/10.1007/3-540-44503-X_20
- Susan B. Davidson and Juliana Freire, "Provenance and Scientific Workflows: Challenges and Opportunities," SIGMOD 2008. DOI: https://doi.org/10.1145/1376616.1376772

## Bridge Hypothesis

The bridge is terminal admission, not terminal reporting:

```text
terminal action normal form
+ hash-valid committed envelope
+ idempotent replay
+ conflicting second terminal envelope becomes obstruction/conflict
= substrate terminal index
```

The three axes should use this primitive as the acceptance gate. They should not own terminal validity themselves.

## Falsification Criteria

The primitive fails if any of these happen:

1. A hash-invalid `ActionOutcomeEnvelope` can become the incumbent terminal outcome.
2. The same `(tenantId, actionId)` can be admitted with two different envelope hashes.
3. A replay of the exact same envelope is treated as a new conflicting write.
4. A stale blocking proposal review can still yield an accepted terminal outcome.
5. A report, packet, or EvalEvent can define terminal truth without resolving to a core-admitted envelope.

## Implementation Delta

- `@pm/agent-state` now exposes `actionOutcomeTerminalKey()`.
- `admitActionOutcomeEnvelope()` now returns candidate and incumbent hash validations and rejects invalid candidate hashes.
- `buildActionOutcomeTerminalIndex()` builds a replay/resume index over hash-valid terminal envelopes, records replay counts, and reports candidate-hash or terminal-conflict issues.
- `packages/agent-state/src/index.test.ts` adds direct primitive tests instead of adding a verifier-only test surface.

## Proof Status

Focused verification passed:

```text
pnpm vitest run packages/agent-state/src/index.test.ts --reporter=basic
pnpm --filter @pm/agent-state typecheck
```

Current three-axis state is unchanged:

| Axis | Status |
| --- | --- |
| Axis A finance | Incomplete. Needs all ten failure classes consuming terminal-admitted envelopes, not only EvalEvent refs. |
| Axis B marketing | Blocked until PluggedInSocial is restored/cloned or authoritative agency fixtures are accepted. |
| Axis C local lab | Mechanism coverage exists, but this v31 primitive still needs to be consumed as state admission rather than only packet generation. |

No verified solution is claimed.


# v51 Strict Runner Proof-Packet Consumption

Date: 2026-06-25
Status: implemented strict runner proof-packet consumption slice, not verified solution

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ52: How should Axis A and Axis C runner-generated `authorityRecoveries` be passed into `buildThreeAxisProofPacket({ requireAuthorityRecovery: true })` so the proof packet consumes store-derived recoveries, preserves Axis B blockers, and refuses verified status when a runner lacks persistence or strict recovery output? | Model checking treats verification as an explicit algorithmic judgment over the state being checked, not as a loose metric. Runtime-monitoring papers make the same boundary operational: no observed trace means no monitor verdict. ARIES shows recovery must replay durable log records rather than infer from volatile state. Proof-carrying code says the consumer validates supplied proof artifacts, and Schneider's enforcement model only enforces properties visible to the monitor. Therefore strict proof packets should consume a concrete recovery suite, and runners without persisted packet recovery should produce an unverified proof summary with missing recovery obligations, not a verified packet or hidden skip. Axis B blockers remain blocker cells, not absent data. | Added `buildStrictThreeAxisProofPacket()` to `@pm/evals`, taking an `EvalGraphWriteAuthorityRecoverySuite` and always enabling the authority-recovery gate. Added runner helpers in `scripts/authority-recovery.ts` to build and summarize strict proof packets. Updated deterministic and live local-lab runners to print a strict proof summary before persistence, then print a recovered strict proof summary after store-derived authority recovery. Added a proof-packet test using a recovery suite. | RQ53: How should an all-axis proof-packet assembler combine Axis A replay/live events, Axis C runner recovery suites, and the explicit Axis B blocker or accepted authoritative fixtures, while preserving per-source authority recovery provenance and refusing verified status until every required axis source is persisted and recovered? |

## Bridge Hypothesis

Strict proof-packet construction is a monitored verdict over durable runner evidence:

```text
runner events
  + packet store
  + store-derived authorityRecoverySuite
  -> buildStrictThreeAxisProofPacket()
  -> verified only if coverage and recovery obligations pass
```

If the runner has events but no persisted recovery suite, the proof packet should still be constructible as an unverified artifact. That preserves the missing proof as evidence instead of letting a script omit it.

## Falsification Criteria

1. Strict proof-packet construction must take a recovery suite, not only a loose optional array.
2. Missing recovery output must make the authority gate fail.
3. Runner summaries must expose missing recovery obligations when persistence is absent or not yet run.
4. Recovered runner summaries must pass the authority gate only for obligations backed by generated recoveries.
5. Axis B blockers must remain blocked cells in the three-axis proof packet.

## Implementation

- Added `StrictThreeAxisProofPacketInput` and `buildStrictThreeAxisProofPacket()` in `packages/evals/src/three-axis-proof-packet.ts`.
- Exported the strict builder from `@pm/evals`.
- Added `buildStrictRunnerProofPacket()` and `summarizeThreeAxisProofPacket()` to `scripts/authority-recovery.ts`.
- Updated `scripts/run-local-lab-evals.ts` so no-DB deterministic output includes `authorityRecovery.status = not_run_without_persisted_packet_store` and a strict proof summary with missing recovery obligations.
- Updated `scripts/run-local-agent-lab-live-evals.ts` so live output prints pre-persistence and post-recovery strict proof summaries.
- Added `three-axis-proof-packet` coverage for strict construction from an authority recovery suite.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Still partial. The strict builder is available, but a full Axis A runner/replay assembler still needs to emit a recovery suite for all required finance cells. |
| Axis B marketing | Blocked. The proof packet can preserve the blocker, but this work does not restore PluggedInSocial or accept authoritative agency fixtures. |
| Axis C local lab | Improved. Deterministic runner output now exposes missing recovery when no DB is configured, and DB-backed runs can feed recovered authority into strict proof packets. |

## Verification

```text
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/evals/src/three-axis-proof-packet.test.ts
pnpm exec tsx scripts/run-local-lab-evals.ts
```

The no-DB deterministic runner produced `strictProofPacket.status = "unverified"` with three `missing_authority_recovery` obligations, which is the intended non-claiming behavior.

## Sources

- Clarke, E. M., Emerson, E. A., & Sifakis, J. (2009). "Model Checking: Algorithmic Verification and Debugging." Communications of the ACM. https://doi.org/10.1145/1592761.1592781
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770
- Necula, G. C. (1997). "Proof-Carrying Code." POPL 1997. https://doi.org/10.1145/263699.263712
- Schneider, F. B. (2000). "Enforceable Security Policies." ACM Transactions on Information and System Security. https://doi.org/10.1145/353323.353382

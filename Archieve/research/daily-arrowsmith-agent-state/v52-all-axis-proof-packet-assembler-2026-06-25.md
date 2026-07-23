# v52 All-Axis Proof-Packet Assembler

Date: 2026-06-25
Status: implemented all-axis assembly primitive, not verified solution

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ53: How should an all-axis proof-packet assembler combine Axis A replay/live events, Axis C runner recovery suites, and the explicit Axis B blocker or accepted authoritative fixtures, while preserving per-source authority recovery provenance and refusing verified status until every required axis source is persisted and recovered? | Requirements-traceability work says proof artifacts must preserve source, purpose, and lifecycle links; otherwise aggregate status hides weak or missing evidence. Model checking and runtime monitoring say verification should be an explicit verdict over the observed transition system or trace. ARIES says recoverability depends on durable source records, not memory. Therefore the all-axis assembler should accept source bundles, keep each bundle's events and recovery suite together, flatten only for the proof packet, and emit source-level recovery provenance: `provided`, `missing_required`, or `not_required`. Axis B blocker sources should remain blocked but not require authority recovery when they have no terminal write obligation. | Added `buildStrictThreeAxisProofPacketAssembly()` to `@pm/evals`. It accepts source bundles with events and optional recovery suites, validates source event counts, builds a strict proof packet, and returns per-source recovery provenance. Added tests for all-axis verified assembly with provided recoveries, missing required recovery remaining visible, and Axis B blocker sources staying blocked without recovery obligations. | RQ54: How should Axis A ArrowHedge finance produce ten failure-class paired source bundles with persisted `ActionOutcomeEnvelope` packets and store-derived authority recovery suites, so the all-axis assembler can move finance from incomplete to recovery-backed without synthetic all-axis events? |

## Bridge Hypothesis

All-axis proof should not be built from a flat bag of events. It should preserve source provenance first:

```text
Axis source bundle
  -> events
  -> optional authorityRecoverySuite
  -> source recovery provenance
All bundles
  -> strict three-axis proof packet
```

This lets the proof packet remain a single verifier artifact while still showing which source actually supplied recovery evidence and which source is blocked or missing required recovery.

## Falsification Criteria

1. The assembler must reject a source bundle whose declared `eventCount` does not match its events.
2. Source bundles with terminal-proof obligations and no recovery suite must be marked `missing_required`.
3. Source bundles with a recovery suite must report recovery counts and invalid recovery counts.
4. Axis B blocker-only sources must be marked `not_required` for authority recovery, while the packet stays blocked.
5. A fully populated synthetic all-axis matrix with provided recoveries is the only verified positive fixture.

## Implementation

- Added `StrictThreeAxisProofPacketSourceBundle`, `ThreeAxisProofPacketSourceRecoveryProvenance`, `StrictThreeAxisProofPacketAssemblyInput`, and `StrictThreeAxisProofPacketAssembly` in `packages/evals/src/three-axis-proof-packet.ts`.
- Added `buildStrictThreeAxisProofPacketAssembly()`.
- Exported the assembler and provenance types from `@pm/evals`.
- Added tests covering all-axis verified assembly, missing source recovery, and Axis B blocker-only source behavior.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Still incomplete. The assembler can consume finance source bundles, but finance still needs ten failure-class paired bundles with persisted packets and recoveries. |
| Axis B marketing | Still blocked. The assembler preserves blocker sources without requiring recovery, but accepted authoritative fixtures or PluggedInSocial are still absent. |
| Axis C local lab | Ready as a source-bundle shape. Local-lab runners can generate events, packets, and recovery suites for the assembler when persisted. |

## Verification

```text
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/evals/src/three-axis-proof-packet.test.ts
```

## Sources

- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398
- Ramesh, B., & Jarke, M. (2001). "Toward Reference Models for Requirements Traceability." IEEE Transactions on Software Engineering. https://doi.org/10.1109/32.895989
- Clarke, E. M., Emerson, E. A., & Sifakis, J. (2009). "Model Checking: Algorithmic Verification and Debugging." Communications of the ACM. https://doi.org/10.1145/1592761.1592781
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770

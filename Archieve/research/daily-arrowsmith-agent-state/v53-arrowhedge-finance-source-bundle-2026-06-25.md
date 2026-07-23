# v53 ArrowHedge Finance Source Bundle

Date: 2026-06-25
Status: implemented current finance source bundle, finance axis still incomplete

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ54: How should Axis A ArrowHedge finance produce ten failure-class paired source bundles with persisted `ActionOutcomeEnvelope` packets and store-derived authority recovery suites, so the all-axis assembler can move finance from incomplete to recovery-backed without synthetic all-axis events? | Traceability research says source provenance should expose missing links rather than filling gaps with inferred traces. Runtime monitoring and model checking say a verified verdict applies only to observed/proved transitions. ARIES says recovery must come from recorded packets/logs. Therefore the first Axis A source bundle should be built from the real ArrowHedge replay corpus and should report the current incomplete state honestly: packet-backed terminal recovery exists for the write-binding terminal pair, while the remaining finance failure classes still need real terminal packets before finance can verify. | Added `buildArrowHedgeWriteBindingProofSourceBundle()` to `@pm/evals`. It builds a finance source bundle from the committed ArrowHedge write-binding replay corpus, binds accepted baseline and blocked substrate `ActionOutcomeEnvelope` refs for the terminal-outcome partition pair, and accepts a store-derived authority recovery suite. Added tests that recover authority from replay packets through a store/resolver harness, feed the recovery suite into the source bundle, and prove the all-axis assembler marks the parallel-write cell verified while keeping the finance axis incomplete. | RQ55: How should ArrowHedge generate terminal `ActionOutcomeEnvelope` packets for the remaining Axis A failure classes (`partial_observation`, `memory_drift`, `feedback_disconnection`, `continuity_break`, and the currently unpacketized finance scaffold pairs) without inventing synthetic writes or coupling finance fixtures into substrate packages? |

## Bridge Hypothesis

Finance proof-source assembly should start from admitted replay packets:

```text
write-binding replay corpus
  -> accepted baseline packet
  -> blocked substrate packet
  -> strict authority recovery suite
  -> finance source bundle
  -> all-axis assembler
```

The bundle is useful even before finance is complete because it prevents synthetic all-axis events from becoming authority.

## Falsification Criteria

1. The finance source bundle must use committed ArrowHedge write-binding replay packets.
2. The bundle must carry both baseline accepted and substrate blocked terminal refs for the terminal-outcome partition pair.
3. Authority recovery must be derived through the packet store/resolver path.
4. The all-axis assembler must mark the packet-backed finance cell verified.
5. The finance axis must remain unverified until the missing failure classes have real packet-backed pairs.

## Implementation

- Added `ArrowHedgeWriteBindingProofSourceBundleInput`.
- Added `buildArrowHedgeWriteBindingProofSourceBundle()` in `packages/evals/src/write-binding.ts`.
- Exported the builder from `@pm/evals`.
- Added a write-binding test that audits replay packets through strict authority recovery and feeds the recovery suite into `buildStrictThreeAxisProofPacketAssembly()`.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved but incomplete. The terminal-outcome partition cell can now be source-bundled with store-derived recovery. Several failure classes still lack packet-backed finance pairs. |
| Axis B marketing | Still blocked. |
| Axis C local lab | Ready for source-bundle consumption when runner persistence is available. |

## Verification

```text
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/evals/src/write-binding.test.ts
```

## Sources

- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398
- Ramesh, B., & Jarke, M. (2001). "Toward Reference Models for Requirements Traceability." IEEE Transactions on Software Engineering. https://doi.org/10.1109/32.895989
- Clarke, E. M., Emerson, E. A., & Sifakis, J. (2009). "Model Checking: Algorithmic Verification and Debugging." Communications of the ACM. https://doi.org/10.1145/1592761.1592781
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770

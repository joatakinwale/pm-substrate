# v55 ArrowHedge Packet Eval Mapping

Date: 2026-06-25
Status: implemented Axis A packet-to-EvalEvent mapping, finance still unverified

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ56: How should the domain-owned ArrowHedge terminal packet corpus be mapped into Axis A EvalEvents/source bundles for the remaining failure classes, with store-derived authority recovery, without counting unmapped packets or blocked Axis B as verified coverage? | End-to-end arguments place semantic checks at the endpoint that has the application context; the finance adapter owns finance packet production, while the eval layer owns measurement. Model checking and runtime verification distinguish observed transition/trace coverage from a verified property verdict. Data-provenance work says derived views must preserve where/why links. Therefore the eval schema should accept explicit packet-backed ArrowHedge scenario specs and map real domain packet refs into EvalEvents, but the coverage analyzer must keep cells unverified until both baseline and substrate terminal proof arms plus authority recoveries exist. | Added opt-in `scenarioSpecs` to `buildArrowHedgeStateEvalSuite()`, exported `ArrowHedgeScenarioSpec`, and added `ARROWHEDGE_CANONICAL_TERMINAL_PACKET_SCENARIOS` for the canonical temporal packet scenarios. Added a finance test that builds the real canonical terminal packet corpus, maps the three blocked temporal packets into Axis A EvalEvents, and proves `partial_observation` and `feedback_disconnection` become covered but not verified because baseline terminal proof is still missing. | RQ57: How should ArrowHedge produce baseline-side terminal failure packets and store-derived authority recoveries for the mapped finance scenario families, without treating substrate protective refusals as baseline proof or hiding `memory_drift` and `continuity_break` gaps? |

## Bridge Hypothesis

Domain packets can enter the three-axis schema only through explicit scenario mappings:

```text
finance terminal packet corpus
  -> opt-in ArrowHedge scenario specs
  -> EvalEvents with action_outcome_envelope substrate refs
  -> coverage analyzer reports covered/unverified
  -> source bundle + recovery later
```

This prevents a packet existing somewhere in the repo from counting as verified axis coverage.

## Falsification Criteria

1. Existing ArrowHedge eval suites must remain stable unless extra scenario specs are supplied.
2. Real domain packet refs must map into substrate-arm EvalEvents.
3. Mapped substrate events must carry `operationalTerminalOutcome: "blocked"` and an `action_outcome_envelope` substrate ref.
4. Coverage may mark the mapped failure classes covered.
5. Coverage must not mark mapped cells verified until both paired arms have terminal proof refs.
6. Finance axis must remain unverified.

## Implementation

- Added `ArrowHedgeScenarioSpec`.
- Added `scenarioSpecs` to `ArrowHedgeStateEvalInput`.
- Added `ARROWHEDGE_CANONICAL_TERMINAL_PACKET_SCENARIOS`.
- Exported the new spec type/constant from `@pm/evals`.
- Added a finance-domain test that builds actual canonical ArrowHedge packets, maps them into Axis A EvalEvents, and verifies covered-but-unverified coverage semantics.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved but incomplete. Real domain packets now map to Axis A EvalEvents for stale observation, feedback disconnection, and partial observation, but baseline terminal proof and recoveries are missing. |
| Axis B marketing | Still blocked by missing PluggedInSocial clone or accepted authoritative fixtures. |
| Axis C local lab | Unchanged by this slice. |

## Verification

```text
pnpm --filter @pm/evals typecheck
pnpm --filter @pm/capability-finance-research-ingest typecheck
pnpm exec vitest run packages/evals/src/arrowhedge.test.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts
```

## Sources

- Saltzer, J. H., Reed, D. P., & Clark, D. D. (1984). "End-to-End Arguments in System Design." ACM Transactions on Computer Systems. https://doi.org/10.1145/357401.357402
- Clarke, E. M., Emerson, E. A., & Sifakis, J. (2009). "Model Checking: Algorithmic Verification and Debugging." Communications of the ACM. https://doi.org/10.1145/1592761.1592781
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Buneman, P., Khanna, S., & Tan, W.-C. (2001). "Why and Where: A Characterization of Data Provenance." ICDT 2001. https://doi.org/10.1007/3-540-44503-X_20
- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398

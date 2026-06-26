# v56 Axis A Baseline Recovery Obligations

Date: 2026-06-25
Status: implemented Axis A proof-gate correction, finance still unverified

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ57: How should ArrowHedge produce baseline-side terminal failure packets and store-derived authority recoveries for the mapped finance scenario families, without treating substrate protective refusals as baseline proof or hiding `memory_drift` and `continuity_break` gaps? | End-to-end arguments keep semantic authority at the endpoint that owns the application invariant, while model checking/runtime-verification work separates observed counterexample traces from proof of the accepted system property. Provenance and traceability work require the baseline observation to stay linked to its evidence, but not to be reclassified as accepted substrate authority. Therefore a failed baseline terminal packet is a replayable terminal observation for the comparator arm; it is not an accepted authority-recovery obligation. Strict proof packets should require authority recovery for non-blocked authority-bearing substrate outcomes, and should preserve blocked/missing finance cells instead of forcing the baseline to look like a valid write. | Updated `authorityRecoveryObligations()` so `runArm: "baseline"` plus `scenarioResult: "fail"` creates no accepted-authority obligation. Added a regression test proving a finance baseline failure terminal packet can verify the paired scenario when the substrate arm has the required recovery, and updated strict proof/source-bundle expectations so extra baseline audit recoveries are tolerated but ignored by the proof gate. | RQ58: How should ArrowHedge generate persisted baseline-side terminal observation packets and substrate-side recovery suites for mapped finance scenario families, while leaving `memory_drift` and `continuity_break` visibly missing until real packet-backed pairs exist? |

## Bridge Hypothesis

Axis A needs two different proof objects:

```text
baseline failed terminal packet
  -> comparator observation
  -> proves baseline behavior only

substrate terminal packet + store-derived recovery
  -> authority obligation
  -> proves the accepted/refused operational write path
```

This prevents the finance baseline from being made to satisfy the substrate's write-authority contract, while still requiring the substrate arm to recover authority or refusal from substrate refs.

## Falsification Criteria

1. A baseline failed event with an `action_outcome_envelope` ref must not require `accepted_authority_recovered`.
2. A substrate accepted pass event must still require `accepted_authority_recovered`.
3. A substrate blocked protective pass must still require `terminal_outcome_refused_authority`.
4. Extra baseline recoveries supplied by a recovery suite must not make the proof invalid or inflate obligations.
5. Missing substrate recovery must still make strict proof packets unverified.
6. Finance remains incomplete while mapped families lack persisted baseline packet pairs and while `memory_drift` / `continuity_break` lack real packet-backed scenarios.

## Implementation

- Updated the proof-packet authority obligation filter in `@pm/evals`.
- Added a finance regression test for baseline-failure observation semantics.
- Updated strict proof-packet and source-recovery provenance expectations from paired-arm counts to authority-obligation counts.
- Preserved existing recovery-suite summaries, because suites may audit more events than the proof gate obligates.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved but incomplete. Strict proof semantics now distinguish baseline failed observations from substrate authority recovery obligations. Persisted baseline packets and store-derived recovery suites for mapped finance families remain open. |
| Axis B marketing | Unchanged and still blocked by missing PluggedInSocial clone or accepted authoritative fixtures. |
| Axis C local lab | Unchanged except for shared proof-gate expectation updates. |

## Verification

```text
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/evals/src/three-axis-proof-packet.test.ts packages/evals/src/write-binding.test.ts
```

## Sources

- Saltzer, J. H., Reed, D. P., & Clark, D. D. (1984). "End-to-End Arguments in System Design." ACM Transactions on Computer Systems. https://doi.org/10.1145/357401.357402
- Clarke, E. M., Emerson, E. A., & Sifakis, J. (2009). "Model Checking: Algorithmic Verification and Debugging." Communications of the ACM. https://doi.org/10.1145/1592761.1592781
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Buneman, P., Khanna, S., & Tan, W.-C. (2001). "Why and Where: A Characterization of Data Provenance." ICDT 2001. https://doi.org/10.1007/3-540-44503-X_20
- Gotel, O. C. Z., & Finkelstein, A. C. W. (1994). "An Analysis of the Requirements Traceability Problem." IEEE International Conference on Requirements Engineering. https://doi.org/10.1109/ICRE.1994.292398

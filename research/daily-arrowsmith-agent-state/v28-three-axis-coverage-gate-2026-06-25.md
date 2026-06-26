# Agent-State Arrowsmith v28: Three-Axis Coverage Gate

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v27-axis-c-ten-class-live-coverage-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ29 from v27.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ29: How should the same explicit coverage gate lift from Axis C to the full 10 failure classes x 3 axes matrix, so Axis C completeness cannot hide Axis B's blocked status or Axis A/B scenario gaps? | Treat the verifier as a stratified replication and adequacy criterion, not a pooled score. Weyuker's adequacy axioms support making the stopping criterion explicit and non-substitutable: satisfying one subset of tests cannot stand in for another required subset. Basili/Selby/Hutchens frame experiments around explicit hypotheses, variables, designs, and threats rather than informal generalization. Shull/Carver/Vegas/Juristo strengthen the cross-axis reading: replication tells us which observations hold under which conditions, and different or blocked replications are useful evidence rather than failures to hide. Santos/Vegas/Oivo/Juristo warn that groups of replications should be analyzed with stratification and justified aggregation. Therefore the repo gate should expose every `(axis, failureClass)` cell, distinguish coverage from verification, and preserve blocked cells as first-class blockers. | Added `analyzeThreeAxisCoverage()` to `@pm/evals`. It builds a 30-cell matrix over the three eval axes and ten failure classes, reports covered/verified/missing/blocked families, and records cell-level reasons such as `no_events`, `only_scaffolded_events`, `blocked_without_refs`, `missing_complete_pair`, `missing_terminal_proof_refs`, and `no_non_blocked_pass_pair`. Coverage requires a paired baseline/substrate protective result with evidence and substrate refs. Verification is stricter: the cell needs a non-blocked substrate `pass` and terminal proof refs by default. Tests prove Axis C's ten-class live coverage does not make the full matrix complete when Axis B is blocked. | RQ30: Should the EvalEvent schema split scenario verdict from operational terminal outcome so protective substrate refusals can count as scenario passes without overloading `result: "blocked"` with both "unsafe write refused" and "axis could not be evaluated"? |

Active question set leaving this run: RQ12-RQ20, RQ30.

## Sources

- Elaine J. Weyuker, "Axiomatizing Software Test Data Adequacy," IEEE Transactions on Software Engineering, 1986: https://doi.org/10.1109/TSE.1986.6313008
- Victor R. Basili, Richard W. Selby, and David H. Hutchens, "Experimentation in Software Engineering," IEEE Transactions on Software Engineering, 1986: https://www.cs.umd.edu/projects/SoftEng/ESEG/papers/82.27.pdf
- Forrest J. Shull, Jeffrey C. Carver, Sira Vegas, and Natalia Juristo, "The Role of Replications in Empirical Software Engineering," Empirical Software Engineering, 2008: https://doi.org/10.1007/s10664-008-9060-1
- Adrian Santos, Sira Vegas, Markku Oivo, and Natalia Juristo, "A Procedure and Guidelines for Analyzing Groups of Software Engineering Replications," IEEE Transactions on Software Engineering, 2021: https://doi.org/10.1109/TSE.2019.2935720

## Implementation Delta

1. `@pm/evals` now exports `analyzeThreeAxisCoverage()`.
2. The report requires all 30 scenario families: `3 axes x 10 failure classes`.
3. Each cell reports coverage and stricter verification separately.
4. Axis B blocked events without evidence/substrate refs remain blockers; they cannot be hidden by Axis C completeness.
5. Verification requires terminal `action_outcome_envelope` refs by default.

## Falsification Criteria

This slice fails if:

1. A complete Axis C report makes the whole three-axis report complete while Axis B has a blocked event.
2. Scaffolded-only cells count as covered.
3. Unpaired baseline/substrate events count as covered.
4. A `baseline=pass` or `substrate=fail` pair counts as protective coverage.
5. A non-blocked substrate `pass` without terminal proof refs counts as verified under the default gate.
6. Blocked-without-refs events disappear into missing coverage instead of surfacing as blocked cells.

## Verification

- `pnpm vitest run packages/evals/src/three-axis-coverage.test.ts --reporter=basic`

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Still incomplete under the new gate. Existing Axis A fixtures cover only a subset of failure classes and do not yet provide terminal proof refs for every non-blocked pass pair. |
| Axis B marketing | Still blocked. The new gate preserves the blocked marketing cell instead of allowing Axis C coverage to imply full verification. |
| Axis C local lab | Still the strongest axis. It has protective packet-backed live coverage for all ten classes, but the current EvalEvent result vocabulary makes protective substrate refusals `blocked`, so they are covered but not non-blocked verified passes under this stricter matrix gate. |

## Next Action Queue

1. Answer RQ30 by separating scenario verdict from operational terminal outcome, or by defining an unambiguous mapping that lets protective refusals count as non-blocked scenario passes while preserving the terminal outcome envelope.
2. Expand Axis A to all ten failure classes and require terminal proof refs for each non-blocked substrate pass.
3. Keep Axis B blocked until PluggedInSocial is restored or accepted authoritative agency fixtures exist.
4. Run the three-axis report over real generated Axis A/B/C suites once Axis A/B provide enough non-scaffolded events.

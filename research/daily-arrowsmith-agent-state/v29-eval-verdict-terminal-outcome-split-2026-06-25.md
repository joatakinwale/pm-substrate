# Agent-State Arrowsmith v29: Eval Verdict / Terminal Outcome Split

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v28-three-axis-coverage-gate-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ30 from v28.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ30: Should the EvalEvent schema split scenario verdict from operational terminal outcome so protective substrate refusals can count as scenario passes without overloading `result: "blocked"` with both "unsafe write refused" and "axis could not be evaluated"? | Yes. The oracle and runtime-verification literature separates observed system behavior from the verdict assigned by a test oracle or monitor. Barr/Harman/McMinn/Shahbaz/Yoo define the oracle problem around deciding whether observed behavior satisfies expected behavior; the observation itself is not the verdict. Leucker/Schallhart and Bauer/Leucker/Schallhart frame runtime verification as monitors producing verdicts over execution traces, including non-final/inconclusive states, again separating the trace from the monitor judgment. Utting/Pretschner/Legeard's model-based testing taxonomy keeps the SUT execution, model, tests, and verdict assignment as separate concepts. Therefore an EvalEvent should preserve both the operational terminal outcome and the scenario oracle verdict. | Added optional `scenarioResult` and `operationalTerminalOutcome` fields to `EvalEvent`. Validation now requires pass/fail scenario verdicts to cite evidence/substrate refs, requires operational terminal outcomes to cite `action_outcome_envelope` refs, and requires `operationalTerminalOutcome` when legacy `result: "blocked"` is paired with `scenarioResult: "pass"`. Dynamic Axis C protective refusals now emit `result: "blocked"`, `scenarioResult: "pass"`, and `operationalTerminalOutcome: "blocked"`. The three-axis analyzer now uses `scenarioResult ?? result`, renames verified pass counting to `scenarioPassPairs`, and treats protective refusals as verified when terminal proof refs are present. | RQ31: How should Axis A and Axis C emit terminal-proof-backed `scenarioResult` pass pairs for all ten failure classes while preserving Axis B's distinct blocked-evaluation semantics until PluggedInSocial or accepted authoritative agency fixtures exist? |

Active question set leaving this run: RQ12-RQ20, RQ31.

## Sources

- Earl T. Barr, Mark Harman, Phil McMinn, Muzammil Shahbaz, and Shin Yoo, "The Oracle Problem in Software Testing: A Survey," IEEE Transactions on Software Engineering, 2015: https://doi.org/10.1109/TSE.2014.2372785
- Martin Leucker and Christian Schallhart, "A Brief Account of Runtime Verification," Journal of Logic and Algebraic Programming, 2009: https://doi.org/10.1016/j.jlap.2008.08.004
- Andreas Bauer, Martin Leucker, and Christian Schallhart, "Runtime Verification for LTL and TLTL," ACM Transactions on Software Engineering and Methodology, 2011: https://doi.org/10.1145/2000799.2000800
- Mark Utting, Alexander Pretschner, and Bruno Legeard, "A Taxonomy of Model-Based Testing Approaches," Software Testing, Verification and Reliability, 2012: https://doi.org/10.1002/stvr.456

## Bridge Hypothesis

`EvalEvent.result` had become two incompatible things:

1. the operational outcome emitted by the run, such as a substrate refusing an unsafe write; and
2. the scenario oracle verdict used by the three-axis verifier.

The bridge is to treat the operational terminal outcome as trace evidence and the scenario result as the oracle verdict. A blocked substrate write can therefore be a successful scenario pass, while an Axis B setup blocker remains a blocked scenario. The split preserves the event contract without hiding blocked evaluations.

## Implementation Delta

1. `@pm/evals` now exports `EVAL_OPERATIONAL_TERMINAL_OUTCOMES` and `EvalOperationalTerminalOutcome`.
2. `EvalEvent` accepts optional `scenarioResult` and `operationalTerminalOutcome`.
3. Schema validation enforces terminal-outcome refs and blocked-refusal disambiguation.
4. Deterministic and dynamic Axis C builders emit the split fields.
5. `analyzeThreeAxisCoverage()` now uses the scenario verdict, reports `scenarioPassPairs`, and no longer treats terminally blocked protective refusals as blocked evaluations.
6. Dynamic Axis C live coverage also uses the scenario verdict for protective packet-backed pairs.

## Falsification Criteria

This slice fails if:

1. A protective refusal with `result: "blocked"`, `scenarioResult: "pass"`, and a valid outcome ref is counted as a blocked scenario.
2. A scenario pass can omit evidence or substrate refs.
3. An `operationalTerminalOutcome` can be asserted without an `action_outcome_envelope` ref.
4. A blocked operational result can be called a scenario pass without naming the terminal outcome.
5. Axis B setup blockers are converted into passes merely because the runtime result vocabulary now has two fields.

## Verification

- `pnpm vitest run packages/evals/src/schema.test.ts packages/evals/src/three-axis-coverage.test.ts packages/evals/src/local-agent-lab.test.ts packages/evals/src/local-lab.test.ts packages/evals/src/metrics.test.ts --reporter=basic`
- `pnpm --filter @pm/evals typecheck`
- `pnpm typecheck`
- `git diff --check`

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Still incomplete under the 30-cell gate. Existing finance fixtures need full failure-class coverage and terminal-proof-backed scenario verdicts. |
| Axis B marketing | Still blocked. `scenarioResult` clarifies the distinction, but PluggedInSocial or accepted authoritative agency fixtures are still required before any Axis B pass claim. |
| Axis C local lab | Stronger. Protective refusals can now be counted as scenario passes when backed by terminal proof packets, so the strict gate can verify Axis C cells without pretending the operation was accepted. |

## Next Action Queue

1. Answer RQ31 by generating a real three-axis report from current Axis A and Axis C suites while preserving Axis B's blocked status.
2. Fill Axis A to all ten failure classes with paired baseline/substrate events and terminal proof refs.
3. Keep Axis B blocked until source fixtures are restored or formally accepted.
4. Persist a proof packet for the three-axis report so replay can explain every scenario verdict and every terminal outcome without chat context.

# Agent-State Arrowsmith v27: Axis C Ten-Class Live Coverage

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v26-dynamic-axis-c-evalevents-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ28 from v26.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ28: How should dynamic Axis C scenario coverage expand from the live stale-observation run to all ten failure classes, with a coverage matrix that prevents one packet-backed live pass from standing in for full Axis C proof? | Treat each failure class as a coverage obligation, not as prose. Ostrand/Balcer's category-partition method maps the taxonomy to explicit test categories and choices. Zhu/Hall/May's adequacy survey frames coverage as a measurable stopping criterion rather than a green-test feeling. Kuhn/Kacker/Lei/Hunter's combinatorial testing work strengthens the matrix view: factors and interactions must be represented explicitly. Jia/Harman's mutation-testing survey sharpens the falsification rule: a class is not covered unless the test can expose the targeted fault. Therefore Axis C coverage should require a live, paired, packet-backed protective run for each taxonomy class: baseline must fail, substrate must not fail, and both events must cite generated terminal packets. | Added `liveCoverage` to dynamic local-agent-lab eval suites. Coverage is complete only when every state-failure class has a `live_run` baseline/substrate pair with generated `ActionOutcomeEnvelope` refs and a protective result (`baseline=fail`, `substrate!=fail`). Added nine more dynamic `ScenarioSpec`s, registering all ten taxonomy classes without changing the engine. Updated the live runner to print coverage. Ran `pnpm evals:local-agent-lab:live` against local Postgres/Ollama: 10 scenarios, 20 EvalEvents, 20 packets, 10 baseline failures, 0 substrate failures, `liveCoverage.complete=true`. A SQL recovery query resolved all 20 latest live packet refs and found 10 distinct failure classes. | RQ29: How should the same explicit coverage gate lift from Axis C to the full 10 failure classes x 3 axes matrix, so Axis C completeness cannot hide Axis B's blocked status or Axis A/B scenario gaps? |

Active question set leaving this run: RQ12-RQ20, RQ29.

## Sources

- Thomas J. Ostrand and Marc J. Balcer, "The Category-Partition Method for Specifying and Generating Functional Tests," Communications of the ACM, 1988: https://dl.acm.org/doi/10.1145/62959.62964
- Hong Zhu, Patrick A. V. Hall, and John H. R. May, "Software Unit Test Coverage and Adequacy," ACM Computing Surveys, 1997: https://dl.acm.org/doi/10.1145/267580.267590
- D. Richard Kuhn, Raghu N. Kacker, Yu Lei, and Justin Hunter, "Combinatorial Software Testing," IEEE Computer, 2009: https://dl.acm.org/doi/10.1109/MC.2009.253
- Yue Jia and Mark Harman, "An Analysis and Survey of the Development of Mutation Testing," IEEE Transactions on Software Engineering, 2011: https://dl.acm.org/doi/10.1109/TSE.2010.62

## Implementation Delta

1. `@pm/evals` now reports `DynamicLocalAgentLabLiveCoverageReport` on dynamic local-agent-lab eval suites.
2. The live coverage gate requires one protective packet-backed pair per failure class.
3. `@pm/local-agent-lab` now registers one dynamic scenario for each class in `state-failure-taxonomy.md`.
4. `pnpm evals:local-agent-lab:live` prints `liveCoverage.complete`, `coverageRate`, covered classes, and missing classes.
5. The registry test now fails if a taxonomy class is silently dropped.

## Falsification Criteria

This slice fails if:

1. A failure class with only scaffolded events counts as live covered.
2. A packet-backed pair with `baseline=pass` counts as covered.
3. A live event with a missing generated packet counts as covered.
4. The registry lacks any of the ten taxonomy classes.
5. A live Postgres/Ollama run cannot persist and recover one packet-backed pair per class.
6. Axis C completeness is claimed as full three-axis solution completeness.

## Verification

- `pnpm vitest run packages/evals/src/local-agent-lab.test.ts packages/local-agent-lab/src/engine.test.ts --reporter=basic`
- `pnpm --filter @pm/evals typecheck`
- `pnpm --filter @pm/local-agent-lab typecheck`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm evals:local-agent-lab:live`
- SQL recovery over the latest 20 live EvalEvents resolved 20/20 packet refs, found 10 failure classes, and confirmed 10 baseline accepted failures plus 10 substrate blocked protections.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Unchanged in this slice; Axis A still has replay-backed packet recovery but does not yet have the same ten-class live coverage gate. |
| Axis B marketing | Still blocked. PluggedInSocial is not restored/cloned and no accepted authoritative agency fixtures have been provided, so the whole solution remains unverified. |
| Axis C local lab | Improved materially. Dynamic Axis C now has one packet-backed protective live pair for every taxonomy class, persisted and recovered through Postgres. This is Axis C coverage only, not all-axis verification. |

## Next Action Queue

1. Answer RQ29 by defining the full three-axis scenario-family coverage matrix and blocked-axis semantics.
2. Apply the explicit coverage gate to Axis A and Axis B EvalEvents.
3. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are accepted.
4. Continue tracking token cost per valid admitted action from live runs; this run still shows substrate token cost higher than baseline, so the protocol-burden claim remains unproven.

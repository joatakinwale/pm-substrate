# Agent-State Arrowsmith v26: Dynamic Axis C EvalEvents

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v25-axis-c-outcome-packet-generation-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ27 from v25.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ27: How should dynamic `@pm/local-agent-lab` runs be converted into full `EvalEvent`s and persisted end-to-end against Postgres/Ollama so every Axis C failure class can prove packet-backed pass/fail decisions, not only the deterministic scaffold and stale-observation engine test? | Treat each dynamic arm run as workflow execution provenance, not as authority. PASS argues provenance should be collected and stored with the system artifact rather than manually in a detached database. Cohen/Cohen-Boulakia/Davidson show workflow provenance needs views at different abstraction levels, which maps the detailed `ScenarioRun` into a queryable EvalEvent view without replacing the underlying terminal packet. PTU shows repeatability depends on replaying events in the same order with the same data, which maps to packet-before-EvalEvent persistence. Distributed Time-aware Provenance shows distributed debugging needs explicit time, state, and causal update history, which maps to `live_run` events carrying terminal packet refs and preserving lab event rows for replay. | Added `live_run` as an eval evidence stage and made it count toward mature failure-reduction metrics. Added `buildDynamicLocalAgentLabEvalSuite()` and `recordDynamicLocalAgentLabEvalSuite()` so dynamic `ScenarioRun` records produce packet-backed `EvalEvent`s and persist packets before events. Added `pnpm evals:local-agent-lab:live`, which runs the real local-agent-lab engine against Postgres/Ollama with retained substrate rows, persists packets/events, and verified a live stale-observation run. Fixed the migration runner to ignore macOS AppleDouble sidecar files before applying SQL migrations. | RQ28: How should dynamic Axis C scenario coverage expand from the live stale-observation run to all ten failure classes, with a coverage matrix that prevents one packet-backed live pass from standing in for full Axis C proof? |

Active question set leaving this run: RQ12-RQ20, RQ28.

## Sources

- Kiran-Kumar Muniswamy-Reddy, David A. Holland, Uri Braun, and Margo Seltzer, "Provenance-Aware Storage Systems," USENIX Annual Technical Conference, 2006: https://www.usenix.org/legacy/events/usenix06/tech/full_papers/muniswamy-reddy/muniswamy-reddy_html/index.html
- Shirley Cohen, Sarah Cohen-Boulakia, and Susan Davidson, "Towards a Model of Provenance and User Views in Scientific Workflows," DILS/LNCS, 2006: https://link.springer.com/chapter/10.1007/11799511_24
- Quan Pham, Tanu Malik, and Ian Foster, "Using Provenance for Repeatability," TaPP, 2013: https://dl.acm.org/doi/10.5555/2482949.2482952
- Wenchao Zhou, Ling Ding, Andreas Haeberlen, Zachary Ives, and Boon Thau Loo, "Distributed Time-aware Provenance," PVLDB, 2012: https://dl.acm.org/doi/10.14778/2535568.2448939

## Implementation Delta

1. `@pm/evals` now accepts `evidenceStage: "live_run"` and counts it as mature evidence for failure-reduction metrics.
2. `@pm/evals` now has a dynamic local-agent-lab adapter that maps `no_substrate` to `baseline`, maps `substrate` to `substrate`, requires both arm packets, and rejects EvalEvents that cite missing packet refs.
3. Dynamic local-agent-lab eval persistence writes generated `ActionOutcomeEnvelope` packets before writing EvalEvents.
4. `@pm/local-agent-lab` now supports `retainWorlds: true` so live eval runs can keep event-log substrate refs replayable instead of deleting hermetic tenant rows immediately.
5. `scripts/run-local-agent-lab-live-evals.ts` runs the real Postgres/Ollama path and records live eval proof.
6. `scripts/migrate.ts` ignores `._*.sql` AppleDouble sidecars so macOS metadata files do not execute as migrations.

## Falsification Criteria

This slice fails if:

1. A dynamic live EvalEvent cites an `action_outcome_envelope` ref without a generated packet in the same eval suite.
2. Packet persistence occurs after EvalEvent persistence.
3. `live_run` events do not validate under the shared EvalEvent schema.
4. Live-run mature metrics remain indistinguishable from scaffolded scenario metrics.
5. A retained live eval still leaves packet substrate refs unrecoverable in Postgres.
6. This one stale-observation live run is mistaken for complete Axis C coverage.

## Verification

- `pnpm vitest run packages/evals/src/local-agent-lab.test.ts packages/evals/src/schema.test.ts packages/evals/src/metrics.test.ts packages/local-agent-lab/src/engine.test.ts --reporter=basic`
- `pnpm --filter @pm/evals typecheck`
- `pnpm --filter @pm/local-agent-lab typecheck`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:migrate`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm evals:local-agent-lab:live`
- SQL recovery join over `evals.eval_events` and `evals.action_outcome_envelope_packets` resolved both live `action_outcome_envelope` refs: baseline `accepted`, substrate `blocked`.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Unchanged in this slice; Axis A still has replay-backed packet recovery and can use the live packet store. |
| Axis B marketing | Still blocked. PluggedInSocial is not restored/cloned and no accepted authoritative agency fixtures have been provided, so the whole solution remains unverified. |
| Axis C local lab | Improved. Dynamic stale-observation now runs end-to-end against local Postgres/Ollama, emits `live_run` EvalEvents, persists packets before events, and resolves packet refs from Postgres. Axis C is still incomplete because only one of ten failure classes has live dynamic coverage. |

## Next Action Queue

1. Answer RQ28 by designing the dynamic Axis C coverage matrix for all ten failure classes.
2. Add at least two more dynamic `ScenarioSpec`s without changing the engine: source-authority conflict and workflow invalidation.
3. Add coverage reporting that distinguishes `live_run` from scaffolded coverage by failure class.
4. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are explicitly accepted.

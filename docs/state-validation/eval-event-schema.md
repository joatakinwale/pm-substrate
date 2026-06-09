# Eval Event Schema

`@pm/evals` defines the shared event shape used to measure state-coherence failures across ArrowHedgeLabs, PluggedInSocial / agency marketing, and controlled local LLM/module labs.

The schema is intentionally small. It is not a replacement for the substrate event log. It is the measurement wrapper around an experiment run: what scenario ran, which failure class it tested, what evidence exists, which substrate records are relevant, and whether the system passed, failed, or was blocked.

Research grounding: `arrowsmith-state-substrate-research.md` explains why eval events measure state as a cross-domain systems problem rather than as generic LLM memory quality.

## TypeScript Surface

Source: `packages/evals/src/schema.ts`.

```ts
export interface EvalEvent {
  readonly tenantId: TenantId;
  readonly axis: "finance" | "marketing" | "local_lab";
  readonly runId: string;
  readonly agentId: string;
  readonly scenarioId: string;
  readonly failureClass:
    | "partial_observation"
    | "stale_observation"
    | "representation_loss"
    | "memory_drift"
    | "source_authority_conflict"
    | "workflow_invalidation"
    | "capability_contract_violation"
    | "parallel_write_conflict"
    | "feedback_disconnection"
    | "continuity_break";
  readonly observedAt: Timestamp;
  readonly source: string;
  readonly evidenceRefs: readonly EvalEvidenceRef[];
  readonly substrateRefs: readonly EvalEvidenceRef[];
  readonly runArm?: "baseline" | "substrate";
  readonly pairedRunGroup?: string;
  readonly stateBenchCategory?:
    | "stateful"
    | "procedural_execution"
    | "user_experience";
  readonly memoryBenchmarkBridge?:
    | "knowledge_update"
    | "abstention"
    | "workflow_rebase";
  readonly mastCategory?:
    | "system_design"
    | "inter_agent_misalignment"
    | "task_verification";
  readonly coordinationClass?:
    | "append_only_observation"
    | "convergent_update"
    | "authority_gated_transition"
    | "derived_projection";
  readonly confidenceBand?: {
    readonly low: number;
    readonly high: number;
    readonly method:
      | "paired_t"
      | "wilcoxon"
      | "binomial_exact"
      | "bootstrap"
      | "none";
  };
  readonly result: "pass" | "fail" | "blocked";
  readonly notes: string;
}
```

## Reference Kinds

Evidence and substrate references share one reference shape:

```ts
export interface EvalEvidenceRef {
  readonly kind:
    | "event"
    | "graph_node"
    | "graph_edge"
    | "workflow_run"
    | "continuity_checkpoint"
    | "capability_invocation"
    | "projection"
    | "source_record"
    | "state_review_artifact"
    | "external_fixture"
    | "document";
  readonly id: string;
  readonly label?: string;
}
```

Use `evidenceRefs` for the observations proving what happened. Use `substrateRefs` for substrate records involved in the run. A source fixture can appear in `evidenceRefs`; an event id, workflow run, graph node, projection, continuity checkpoint, or `state_review_artifact` should appear in `substrateRefs`.

## Validation Rules

`validateEvalEvent(input)` returns all structural issues it can find, following the validator style used by `@pm/entity-mapping`.

Rules:

- `tenantId`, `runId`, `agentId`, `scenarioId`, `source`, and `notes` must be non-empty strings.
- `axis` must be `finance`, `marketing`, or `local_lab`.
- `failureClass` must be one of the ten classes in `state-failure-taxonomy.md`.
- `observedAt` must be an ISO-8601 UTC timestamp string.
- `result` must be `pass`, `fail`, or `blocked`.
- `evidenceRefs` and `substrateRefs` must be arrays of valid refs.
- `runArm`, when present, must be `baseline` or `substrate`.
- `pairedRunGroup`, when present, must be a non-empty string.
- `stateBenchCategory`, when present, must be a supported STATE-Bench-style category.
- `memoryBenchmarkBridge`, when present, must be a supported memory-benchmark bridge label.
- `mastCategory`, when present, must be a supported MAST-style multi-agent failure category.
- `coordinationClass`, when present, must be one of the cross-disciplinary coordination classes: append-only observation, convergent update, authority-gated transition, or derived projection.
- Finance-axis events require both `runArm` and `pairedRunGroup` so paired baseline/substrate runs can be analyzed without changing marketing or local-lab compatibility.
- `confidenceBand`, when present, must include finite `low` and `high` numbers plus one supported method.
- `pass` and `fail` events require at least one `evidenceRef` and at least one `substrateRef`.
- `blocked` events may omit refs only when the missing evidence or substrate record is the blocker and is explained in `notes`.

## Result Semantics

| Result | Meaning | Reference requirement |
| --- | --- | --- |
| `pass` | The substrate-assisted run prevented or detected the targeted failure according to scenario criteria. | Requires evidence and substrate refs. |
| `fail` | The targeted state failure occurred or was not detected. | Requires evidence and substrate refs. |
| `blocked` | The scenario could not be evaluated. | Refs optional only if the missing ref is the blocker. |

## Axis Semantics

| Axis | Testbed | Example scenario id |
| --- | --- | --- |
| `finance` | ArrowHedgeLabs / ArrowDexter finance agents | `stale-price-after-signals` |
| `marketing` | PluggedInSocial / agency profile marketing agents | `publish-after-client-approval-revoked` |
| `local_lab` | Controlled local LLM/module state lab | `parallel-agents-conflicting-snapshot` |

## Example Events

### Finance Failure

```ts
evalEvent({
  tenantId,
  axis: "finance",
  runId: "run_arrow_001",
  agentId: "portfolio_manager",
  scenarioId: "stale-price-after-signals",
  failureClass: "stale_observation",
  observedAt: timestamp("2026-05-27T15:00:00.000Z"),
  source: "arrowhedge/backtest",
  evidenceRefs: [
    evalEvidenceRef("event", "evt_price_refresh"),
    evalEvidenceRef("external_fixture", "fixtures/arrowhedge/stale-price.json"),
  ],
  substrateRefs: [
    evalEvidenceRef("graph_node", "node_portfolio_state"),
    evalEvidenceRef("workflow_run", "wf_research_run"),
  ],
  runArm: "baseline",
  pairedRunGroup: "pair_stale_price_seed_001",
  stateBenchCategory: "stateful",
  memoryBenchmarkBridge: "knowledge_update",
  mastCategory: "task_verification",
  coordinationClass: "authority_gated_transition",
  result: "fail",
  notes: "Portfolio decision used an analyst signal created before the price refresh.",
});
```

### Marketing Blocker

```ts
evalEvent({
  tenantId,
  axis: "marketing",
  runId: "run_agency_001",
  agentId: "social_scheduler",
  scenarioId: "publish-after-client-approval-revoked",
  failureClass: "workflow_invalidation",
  observedAt: timestamp("2026-05-27T16:00:00.000Z"),
  source: "pluggedinsocial/source-schema",
  evidenceRefs: [],
  substrateRefs: [],
  result: "blocked",
  notes: "Blocked: local PluggedInSocial clone is missing, so source schema evidence is unavailable.",
});
```

### Local Lab Pass

```ts
evalEvent({
  tenantId,
  axis: "local_lab",
  runId: "run_lab_001",
  agentId: "planner_agent",
  scenarioId: "parallel-agents-conflicting-snapshot",
  failureClass: "parallel_write_conflict",
  observedAt: timestamp("2026-05-27T17:00:00.000Z"),
  source: "local-lab/harness",
  evidenceRefs: [
    evalEvidenceRef("external_fixture", "fixtures/local-lab/conflicting-snapshot.json"),
  ],
  substrateRefs: [
    evalEvidenceRef("event", "evt_conflict_detected"),
    evalEvidenceRef("projection", "projection_entity_state"),
  ],
  stateBenchCategory: "procedural_execution",
  memoryBenchmarkBridge: "workflow_rebase",
  mastCategory: "system_design",
  coordinationClass: "authority_gated_transition",
  result: "pass",
  notes: "Substrate rejected the second write because its read snapshot was invalidated by the first accepted event.",
});
```

## Research Taxonomy Fields

The optional taxonomy fields keep benchmark and cross-disciplinary labels queryable instead of hiding them in prose notes.

| Field | Purpose |
| --- | --- |
| `stateBenchCategory` | Maps a scenario to STATE-Bench-style behavioral categories. |
| `memoryBenchmarkBridge` | Preserves the agent-memory competency being tested. |
| `mastCategory` | Maps multi-agent failures to MAST-style system design, inter-agent misalignment, or task-verification categories. |
| `coordinationClass` | Implements the cross-disciplinary CRDT-vs-gate classification: append-only observation, convergent update, authority-gated transition, or derived projection. |

## Metric Mapping

| Metric | Eval event inputs |
| --- | --- |
| `state_disagreement_rate` | Count `source_authority_conflict`, `parallel_write_conflict`, and `memory_drift` failures per run. |
| `stale_action_rate` | Count `stale_observation` failures where the action occurred after an invalidating event. |
| `evidence_coverage` | Ratio of pass/fail events with non-empty evidence refs and substrate refs. |
| `conflict_auto_resolution_rate` | Compare `convergent_update` events against authority-gated conflict outcomes. |
| `contradiction_rate` | Count `memory_drift`, `source_authority_conflict`, and `continuity_break` failures with contradiction notes. |
| `resume_success_rate` | Ratio of continuity scenarios that pass over all continuity scenarios not blocked. |
| `replay_fidelity` | Ratio of replay scenarios that pass over all replay scenarios not blocked. |
| `state_review_artifact_hash_verification_rate` | Ratio of imported `StateReviewArtifact` records whose canonical hash replays successfully. |
| `workflow_invalid_transition_rate` | Count `workflow_invalidation` failures per workflow scenario. |
| `capability_contract_violation_rate` | Count invalid invocation attempts and whether they were blocked before mutation. |
| `mean_time_to_reconcile` | Later derived from conflict detection event time and resolution event time. |

## Persistence

`@pm/evals` owns harness persistence under `packages/evals/src/persistence/` with migrations under `packages/evals/migrations/`. The root runner also applies `db/migrations/0017_eval_events.sql` and `db/migrations/0018_eval_event_taxonomy.sql` for local integrated runs. Eval persistence records measurements, while source-of-truth authority stays in substrate graph/events/workflow/capability packages.

The first table is `evals.eval_events`, indexed by tenant, axis, run, scenario, paired-run grouping, taxonomy labels, and coordination class.

## Design Boundary

Eval events do not decide authority. They record measurement outcomes. Authority remains in substrate state: profile validators, graph writes, event provenance, workflow runtime, capability registry, permissions, freshness metadata, and continuity.

# Controlled Local Agent Lab Scenarios

Status: Day 3 validation design
Date: 2026-06-01

## Purpose

The local lab is the controlled failure surface for the state-coherence thesis. It creates small, replayable agent/module situations where the state problem can be induced on purpose, measured through `@pm/evals`, and then rerun with substrate support.

The lab is not meant to prove that pm-substrate works in a real business domain by itself. It proves the mechanics of the theory before the ArrowHedgeLabs and marketing-platform axes add domain complexity.

## Claim Being Advanced

If state failures are caused by bounded actors acting from partial, stale, lossy, conflicting, or unauthoritative local models, then the same failure classes should appear in a controlled local lab even when no finance or marketing domain exists.

The substrate-assisted arm should reduce those failures by adding:

- typed source records;
- event causality;
- graph/projection state;
- workflow position;
- capability contract validation;
- source authority rules;
- freshness metadata;
- continuity checkpoints;
- contradiction detection.

## Scenario Anatomy

Every scenario below should become a paired run:

- `baseline`: agent/module uses local prompt context, memory summary, or tool result without substrate state enforcement.
- `substrate`: agent/module must read current substrate state, cite evidence refs, and pass deterministic gates before mutation.

Every emitted `EvalEvent` must use:

- `axis: "local_lab"`;
- one `scenarioId` from this document;
- one primary `failureClass`;
- at least one `evidenceRef` and one `substrateRef` for `pass` or `fail`;
- `blocked` only when the missing primitive or fixture is the blocker.

## Single-Agent Scenarios

| Scenario ID | Failure Class | Induced Failure | Baseline Expected Result | Substrate Pass Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- |
| `local.single.stale-memory-after-source-update` | `stale_observation` | Session 1 records that `Project.alpha.status = approved`; a later source event changes it to `revision_requested`; Session 2 receives only the old memory summary. | Agent proceeds as if status is still approved. | Agent detects that the continuity checkpoint is older than the authoritative source update and blocks or rebases. | Old checkpoint, source update event, read timestamp, agent action attempt, current projection. |
| `local.single.wrong-source-authority` | `source_authority_conflict` | Two source records disagree on a deadline. A chat note is newer, but a signed approval document is authoritative. | Agent picks the newer chat note. | Agent chooses the authority-ranked document or emits a blocked conflict event. | Conflicting source records, authority rule, chosen source, conflict/blocker event. |
| `local.single.context-truncation-loses-constraint` | `partial_observation` | A long prompt includes a required constraint near the beginning, then truncation removes it before planning. | Agent produces a plan that violates the omitted constraint. | Agent refuses to plan until required constraints are retrieved from substrate refs. | Full fixture, truncated prompt fixture, omitted constraint source record, plan output. |
| `local.single.invalid-workflow-step` | `workflow_invalidation` | Agent plans `complete_step_B` after reading workflow state `ready_for_B`; another event moves workflow to `blocked`. | Agent still completes step B. | Workflow runtime rejects the transition or agent rebases against current workflow state before acting. | Prior workflow run, invalidating event, attempted transition, current workflow definition. |
| `local.single.hallucinated-mapping-rejected` | `representation_loss` | Agent maps a CSV column named `status` to the wrong semantic field and treats syntactic validity as enough. | Agent accepts a profile-valid but semantically wrong mapping. | Mapping is recorded as an AI proposal and rejected by deterministic validation or human review. | Raw CSV fixture, proposed mapping, validation result, rejected invocation/event. |

### Notes

These scenarios isolate the single-agent layer of the problem. A model can reason correctly over the context it sees and still fail because the context is not the current operational state.

## Parallel-Agent Scenarios

| Scenario ID | Failure Class | Induced Failure | Baseline Expected Result | Substrate Pass Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- |
| `local.parallel.same-entity-different-snapshots` | `parallel_write_conflict` | Agent A and Agent B read the same entity at snapshot `S1`. Agent A writes update `S2`; Agent B writes from stale snapshot `S1`. | Both writes are accepted and projection becomes contradictory or last-write-wins hides the conflict. | Second write is rejected, serialized, or accepted only with a reconciliation event. | Read snapshots, two write attempts, accepted/rejected event, final projection. |
| `local.parallel.planner-executor-step-disagreement` | `workflow_invalidation` | Planner emits a plan for workflow step `draft_review`; executor sees `client_approval` as current and executes the wrong step. | Executor acts on a step not legal for the current workflow position. | Executor reads current workflow run before action and rejects the stale plan. | Planner output, executor read, workflow run, transition validation result. |
| `local.parallel.plan-invalidated-by-other-agent` | `stale_observation` | Planner creates a three-step plan. A risk/checker agent invalidates step 2 before executor reaches it. | Executor continues through invalidated step 2. | Executor detects the invalidation event and requests a replan. | Plan checkpoint, invalidation event, executor action attempt, replan/block event. |
| `local.parallel.conflicting-authoritative-claims` | `source_authority_conflict` | Agent A records that source X is authoritative for a fact; Agent B records source Y as authoritative for the same fact. | Downstream agent chooses one claim without resolving authority. | Conflict detection emits a blocker until an authority rule or resolution event exists. | Two continuity checkpoints, authority claims, downstream decision, conflict finding. |

### Notes

These scenarios isolate the multi-actor layer of the problem. They should be run with deterministic fixtures before any real LLM is introduced, because the failure is in state coordination rather than language quality.

## Multi-Module Scenarios

| Scenario ID | Failure Class | Induced Failure | Baseline Expected Result | Substrate Pass Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- |
| `local.module.valid-json-wrong-semantics` | `representation_loss` | Parser returns valid JSON that swaps `approvedBy` and `requestedBy`. | Planner treats parsed JSON as correct because schema validation passes. | Semantic validator or mapping review rejects the representation before action. | Raw document fixture, parsed JSON, schema result, semantic validation result. |
| `local.module.retriever-stale-evidence` | `stale_observation` | Retriever returns an older document chunk after a newer source record supersedes it. | Planner cites stale evidence in the final answer or action. | Retriever result is checked against freshness metadata and blocked or refreshed. | Retrieved chunk, superseding source record, freshness horizon, planner output. |
| `local.module.planner-ignores-freshness` | `stale_observation` | Observation module returns `freshnessStatus: expired`, but planner still acts on it. | Action proceeds from explicitly expired state. | Capability invocation rejects the action because required read refs are expired. | Observation payload, planner output, capability invocation, rejection event. |
| `local.module.tool-caller-bypasses-contract` | `capability_contract_violation` | Tool caller submits malformed or unauthorized input directly to a capability-like function. | Mutation occurs without schema, tenant, permission, or workflow validation. | Deterministic capability gate rejects before graph/event mutation. | Input payload, capability descriptor, validation/permission result, mutation absence. |
| `local.module.memory-summary-loses-authority` | `memory_drift` | Memory summarizer keeps the conclusion but drops the source authority and evidence ids. | Later agent treats the summary as authoritative memory. | Continuity context builder requires evidence refs or contradiction detection flags the summary. | Original evidence refs, memory summary, checkpoint, resumed output, contradiction finding. |

### Notes

These scenarios isolate handoff failures between modules. The lab should treat parser, retriever, planner, tool caller, evaluator, and continuity builder as separate bounded actors even when they run in one process.

## Fixture Plan

The first executable fixture set should be small and deterministic:

| Fixture | Purpose |
| --- | --- |
| `fixtures/local-lab/source-records.json` | Authoritative and non-authoritative source records with timestamps and authority tags. |
| `fixtures/local-lab/workflow-runs.json` | Workflow states before and after invalidation. |
| `fixtures/local-lab/continuity-checkpoints.json` | Evidence-backed and evidence-missing memory checkpoints. |
| `fixtures/local-lab/module-outputs.json` | Parser, retriever, planner, and tool-caller outputs used to induce failures. |
| `fixtures/local-lab/expected-eval-events.json` | Expected `EvalEvent` shapes for baseline and substrate arms. |

The fixtures should not call external models. LLM behavior can be added later as a second layer once deterministic failure generation is stable.

## Harness Contract

The first local lab harness should expose this shape:

```ts
interface LocalLabScenario {
  readonly scenarioId: string;
  readonly primaryFailureClass: FailureClass;
  readonly runBaseline: () => Promise<EvalEvent>;
  readonly runSubstrate: () => Promise<EvalEvent>;
}
```

Implementation rules:

- baseline and substrate arms use the same source fixture;
- only the substrate arm may consult graph/events/workflow/continuity state;
- both arms must emit `EvalEvent`;
- substrate pass/fail must be decided by deterministic assertions, not by model self-report;
- no scenario may mutate business state outside a workflow/capability boundary once those boundaries exist.

## Metric Mapping

| Metric | Scenarios |
| --- | --- |
| `state_disagreement_rate` | `local.parallel.same-entity-different-snapshots`, `local.parallel.conflicting-authoritative-claims`, `local.module.memory-summary-loses-authority` |
| `stale_action_rate` | `local.single.stale-memory-after-source-update`, `local.parallel.plan-invalidated-by-other-agent`, `local.module.retriever-stale-evidence`, `local.module.planner-ignores-freshness` |
| `source_authority_violation_rate` | `local.single.wrong-source-authority`, `local.parallel.conflicting-authoritative-claims`, `local.module.memory-summary-loses-authority` |
| `workflow_invalid_transition_rate` | `local.single.invalid-workflow-step`, `local.parallel.planner-executor-step-disagreement` |
| `capability_contract_violation_rate` | `local.module.tool-caller-bypasses-contract`, `local.single.hallucinated-mapping-rejected` |
| `evidence_coverage` | All scenarios; every pass/fail event must cite evidence and substrate refs. |
| `resume_success_rate` | `local.single.stale-memory-after-source-update`, `local.module.memory-summary-loses-authority` |
| `replay_fidelity` | All scenarios once fixtures and expected eval events are committed. |
| `mean_time_to_reconcile` | Parallel scenarios once conflict-resolution events exist. |

## Missing Substrate Primitives To Track

These scenarios can be documented now, but some substrate primitives are still implementation debt:

- read snapshot ids for graph/projection reads;
- freshness metadata on agent-facing state reads;
- explicit source authority rule representation;
- conflict/reconciliation event types;
- semantic mapping review results;
- capability invocation records for rejected attempts;
- local lab fixture runner and paired-run report.

These are not reasons to delay Task 3. They are the next implementation queue after scenarios become executable.

## Completion Criteria

Task 3 is complete when:

- all five single-agent scenarios are defined;
- all four parallel-agent scenarios are defined;
- all five multi-module scenarios are defined;
- each scenario maps to a canonical failure class;
- each scenario states baseline failure and substrate pass criteria;
- each scenario identifies required evidence;
- missing primitives are listed as implementation debt rather than hidden assumptions.

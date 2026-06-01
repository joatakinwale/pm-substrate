# State-Failure Taxonomy

This taxonomy names the state failures pm-substrate must be able to create, detect, and reduce across three validation axes:

1. ArrowHedgeLabs finance agents.
2. PluggedInSocial / agency marketing agents.
3. Controlled local LLM/module lab.

The taxonomy is deliberately cross-domain. A failure is only useful if it can be tested in more than one environment and tied back to substrate primitives: graph state, event history, provenance, workflow position, capability contracts, freshness, source authority, and continuity checkpoints.

Research grounding: `arrowsmith-state-substrate-research.md` maps these classes to adjacent domains including partial observability, agent memory, distributed systems, process mining, provenance, semantic interoperability, state estimation, and team cognition.

## Evaluation Rule

Every failure scenario must produce at least one `EvalEvent` from `@pm/evals`.

For `pass` and `fail` results, the event must include:

- at least one `evidenceRef`;
- at least one `substrateRef`;
- a failure class from this taxonomy;
- a scenario id stable enough to replay.

Blocked scenarios may omit evidence and substrate refs only when the missing evidence is itself the blocker, and the blocker must be stated in `notes`.

## Failure Classes

### 1. Partial Observation

**Definition:** The actor only sees part of the environment needed for a valid action.

**Core question:** Did the agent act without observing a required source, actor, dependency, or constraint?

**Primary metrics:**

- `state_disagreement_rate`
- `source_authority_violation_rate`
- `capability_contract_violation_rate`

**Evidence required:**

- source read record or tool result;
- missing source declaration;
- graph/projection state showing the omitted dependency;
- agent output or action attempt.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Portfolio manager sees analyst signals but not current risk limits. | Decision references analyst events but no `risk.state.validated` event for the same run. |
| Marketing | Copywriter drafts campaign content without the latest client brand brief. | Content event lacks a document/provenance ref to current approved brand asset. |
| Local lab | Planner sees a task list but not the workflow state machine. | Attempted step transition is not backed by a workflow state read. |

### 2. Stale Observation

**Definition:** The actor observed a relevant source, but the observation was expired or invalidated before action.

**Core question:** Did the agent act from state that was once true but no longer valid?

**Primary metrics:**

- `stale_action_rate`
- `replay_fidelity`
- `mean_time_to_reconcile`

**Evidence required:**

- observation timestamp;
- invalidating event;
- freshness horizon or staleness metadata;
- action timestamp.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Analyst signals use a price snapshot created before a later price refresh. | Decision action occurs after `price.refreshed` while citing earlier snapshot. |
| Marketing | Social scheduler publishes from a content calendar after campaign launch date changes. | Publish event causally follows old schedule but ignores `campaign.rescheduled`. |
| Local lab | Single agent uses memory summary after source record changed. | Agent cites continuity checkpoint older than authoritative update. |

### 3. Representation Loss

**Definition:** Information was observed but compressed, transformed, or encoded in a way that lost authority, causality, constraints, or meaning.

**Core question:** Did the representation preserve the state attributes needed for safe action?

**Primary metrics:**

- `evidence_coverage`
- `source_authority_violation_rate`
- `replay_fidelity`

**Evidence required:**

- raw source payload;
- transformed representation;
- mapping/schema validation result;
- downstream action or decision.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Analyst signal summary drops confidence and evidence window. | Final decision cannot trace confidence to original signal payload. |
| Marketing | CSV lead import maps `status` to campaign state instead of lead qualification. | Mapping dry-run produces profile-valid but semantically wrong field placement. |
| Local lab | Memory summary preserves conclusion but loses which source was authoritative. | Agent later treats a non-authoritative note as binding state. |

### 4. Memory Drift

**Definition:** The agent's remembered state diverges from source-backed operational state.

**Core question:** Did agent memory become a competing state system instead of evidence-backed continuity?

**Primary metrics:**

- `state_disagreement_rate`
- `contradiction_rate`
- `resume_success_rate`

**Evidence required:**

- continuity checkpoint;
- current graph/event/projection state;
- contradiction finding;
- resumed agent output.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Agent remembers a portfolio position that changed in a later run. | Resume output conflicts with `PortfolioState` projection. |
| Marketing | Account manager agent remembers proposal as accepted after it expired. | Continuity checkpoint conflicts with `proposal.expired` lifecycle event. |
| Local lab | Amnesiac agent resumes from old summary and ignores current source record. | `findContinuityContradictions` or equivalent flags open conflicting claims. |

### 5. Source Authority Conflict

**Definition:** Two or more sources disagree, or the actor chooses the wrong source as binding.

**Core question:** Does the system know which source is authoritative for this fact type?

**Primary metrics:**

- `source_authority_violation_rate`
- `state_disagreement_rate`
- `mean_time_to_reconcile`

**Evidence required:**

- conflicting source records;
- source authority rule;
- chosen source in decision/action;
- conflict resolution event or blocker.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Broker-style portfolio state and local backtest portfolio disagree. | Decision uses non-authoritative portfolio source without override. |
| Marketing | Client says campaign is paused in email, but scheduler still shows live. | Publish action proceeds without resolving source authority. |
| Local lab | Agent retrieves two docs with conflicting facts and chooses latest text instead of authority-ranked source. | Eval event records source selection mismatch. |

### 6. Workflow Invalidation

**Definition:** A plan or action was valid under a previous workflow state but invalid under the current state.

**Core question:** Did the agent rebase its plan against the current workflow position before acting?

**Primary metrics:**

- `workflow_invalid_transition_rate`
- `stale_action_rate`
- `resume_success_rate`

**Evidence required:**

- workflow run id;
- prior and current workflow state;
- transition attempted;
- lifecycle or workflow definition.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Portfolio decision proceeds after risk workflow moved to blocked. | Action follows invalid transition from `blocked` to `accepted`. |
| Marketing | Copy approval flow moves back to revision, but scheduler still publishes. | Publish transition is illegal from current campaign/content state. |
| Local lab | Planner writes steps, executor resumes after a denial changed the plan. | Executor completes an invalidated step id. |

### 7. Capability Contract Violation

**Definition:** An actor invokes a tool/capability with invalid input, missing permission, wrong tenant, wrong profile, or wrong workflow position.

**Core question:** Did deterministic substrate gates reject unsafe action before mutation?

**Primary metrics:**

- `capability_contract_violation_rate`
- `unauthorized_action_block_rate`
- `workflow_invalid_transition_rate`

**Evidence required:**

- capability descriptor;
- input payload;
- validation/permission result;
- event or rejected invocation record.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | LLM chooses `buy` quantity above deterministic allowed actions. | Capability invocation rejected by risk-gate contract. |
| Marketing | Agent tries to publish social content without approved asset refs. | Publish capability rejects missing `MediaAsset` / approval evidence. |
| Local lab | Tool caller bypasses schema and passes malformed JSON. | Validator rejects input before graph/event mutation. |

### 8. Parallel Write Conflict

**Definition:** Two actors concurrently update related state from incompatible snapshots.

**Core question:** Did the system serialize, reject, or reconcile concurrent writes before projections became contradictory?

**Primary metrics:**

- `state_disagreement_rate`
- `mean_time_to_reconcile`
- `replay_fidelity`

**Evidence required:**

- concurrent write attempts;
- snapshot/read timestamps;
- causation chain;
- accepted/rejected transition result.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Risk manager and portfolio manager update limits/decision from different snapshots. | Decision event causation does not include latest risk-state event. |
| Marketing | SEO agent and copywriter edit the same campaign brief with incompatible objectives. | Two accepted content-state events share no reconciliation event. |
| Local lab | Parallel agents write conflicting facts to the same entity. | Event replay produces divergent projection unless conflict rule blocks one. |

### 9. Feedback Disconnection

**Definition:** The system receives feedback, but it is not linked back to the action, plan, or state transition it should update.

**Core question:** Did feedback change the future state model or disappear as unstructured text?

**Primary metrics:**

- `evidence_coverage`
- `resume_success_rate`
- `mean_time_to_reconcile`

**Evidence required:**

- feedback source;
- original action/decision event;
- linked correction, learning, or workflow update;
- continuity checkpoint when agent-facing.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | Backtest outcome shows loss, but decision rule is not linked to outcome. | No feedback event references the decision id. |
| Marketing | Client rejects copy, but agent later repeats rejected phrasing. | Feedback lacks continuity or content-state invalidation link. |
| Local lab | Evaluator marks answer wrong, but memory module stores only the old answer. | Feedback event is not referenced by later checkpoint. |

### 10. Continuity Break

**Definition:** A future agent/session cannot recover the relevant open work, constraints, evidence, or decisions without chat history.

**Core question:** Can an amnesiac agent resume from substrate state alone?

**Primary metrics:**

- `resume_success_rate`
- `contradiction_rate`
- `evidence_coverage`

**Evidence required:**

- prior checkpoints;
- event refs on checkpoints;
- reconstructed context;
- resumed output and contradiction report.

**Axis examples:**

| Axis | Failure scenario | Detection signal |
| --- | --- | --- |
| Finance | New session cannot explain why a decision was blocked yesterday. | Continuity context lacks risk-state and blocker evidence. |
| Marketing | Campaign agent resumes with no record of pending client approval. | Open work checkpoint missing or not linked to content approval event. |
| Local lab | Amnesiac agent repeats a rejected plan because no durable denial exists. | Resume run lacks prior feedback/denial checkpoint. |

## Cross-Class Notes

Some failures intentionally overlap. For example, stale observation can cause workflow invalidation, and memory drift can become source authority conflict. Eval scenarios should record the primary failure class and may mention secondary classes in `notes`. Avoid inventing a generic `other` class; if a scenario does not fit this taxonomy, that is a theory-gap finding and should be documented before adding a new class.

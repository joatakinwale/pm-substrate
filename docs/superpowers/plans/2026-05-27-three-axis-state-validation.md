# Three-Axis State Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a falsifiable validation program that proves, weakens, or kills the pm-substrate state-coherence thesis across finance agents, marketing agents, and controlled local LLM/module agents.

**Architecture:** Treat the state problem as a measurable systems problem, not a branding claim. Run the same state-failure classes first without substrate support, then with substrate support, across three axes: ArrowHedgeLabs, PluggedInSocial/agency marketing, and a controlled local agent lab. The substrate remains the governed operational-state layer: graph, events, provenance, workflow, capability registry, permissions, freshness, contradiction detection, and continuity.

**Tech Stack:** pm-substrate TypeScript/Vitest/Postgres; `@pm/evals` TypeScript schema + validators; ArrowHedgeLabs Python/LangGraph/backtester; PluggedInSocial/Stevie Social FastAPI/Postgres/Next.js when cloned; local LLM/module lab using local model runners where available, deterministic fixtures, and substrate adapters.

---

## Workspace Facts Discovered On 2026-05-27

- `/Volumes/WD_BLACK/JoatLabs/ARROWHEDGELABS` exists and is a suitable finance-agent sandbox.
- `/Volumes/WD_BLACK/JoatLabs/PluggedInSocial` does **not** currently appear to exist as a local clone.
- Workspace docs identify `LopeWale/PluggedInSocial` as the marketing/social platform and internal JOATLabs marketing/CMS command-center candidate.
- `pm-substrate` already contains `packages/profile-agency`, modeled after PluggedInSocial/Stevie Social, with entities for `Lead`, `ClientOrg`, `Project`, `Campaign`, `SocialMediaPost`, `BlogPost`, `EmailCampaignSend`, `MediaAsset`, `ClientReport`, `Invoice`, `Subscription`, `AgencyUser`, and `LeadScoringConfig`.
- `pm-substrate` already contains `packages/capability-agency-lead-scoring`, proving one marketing-agency capability can transfer without substrate edits.
- `/Volumes/WD_BLACK/plannotator/apps/marketing` exists, but it is a marketing site for Plannotator, not the agentic marketing platform testbed.
- `pm-substrate` already has `ADR-0031` continuity ledger and `ADR-0032` amnesiac-agent eval. Those are the current agent-state validation anchors.
- `@pm/evals` now exists as the shared eval-event schema package for state-failure measurements.
- `docs/state-validation/state-failure-taxonomy.md` now defines the canonical failure classes, metrics, evidence requirements, and examples across finance, marketing, and the local lab.
- `docs/state-validation/eval-event-schema.md` now documents the eval event contract, evidence references, result semantics, and the boundary between measurement and substrate authority.

## Plan Review Findings On 2026-05-27

The plan is still directionally sound: it tests the same state-failure theory across a live finance-agent sandbox, a cross-functional marketing sandbox, and a controlled local lab. That gives the thesis three different failure surfaces: high-change external data, human/business workflow coordination, and isolated agent/module mechanics.

The key architecture boundary is now explicit: eval events measure state failures; they do not become the source of truth. Evidence refs and substrate refs point back to events, graph records, workflow runs, continuity checkpoints, capability invocations, projections, source records, fixtures, or documents. This keeps the validation layer falsifiable instead of letting it quietly rewrite the system it is measuring.

The main blocker remains Axis B. `profile-agency` is a useful substrate model, but it is not enough to prove the marketing-platform axis by itself. The actual PluggedInSocial/agentic marketing project must be cloned, restored, or represented by authoritative fixtures before we can claim real cross-functional marketing validation.

The recommended execution order remains: finish the local lab scenarios first, then ArrowHedgeLabs adapter planning, then the PluggedInSocial adapter once source access is resolved. The local lab should intentionally recreate the state problem before substrate assistance, because otherwise the substrate can only show activity, not improvement.

The first measurable success criterion is not "agents sound better." It is that the same scenarios show lower stale-action rate, lower source-authority violation rate, lower workflow-invalid-transition rate, better evidence coverage, better replay fidelity, and better amnesiac resume success after substrate support is enabled.

## Core Hypothesis

State failures emerge when bounded actors act from divergent, stale, partial, or ungrounded local models of a changing environment.

The substrate should improve behavior by giving agents and tools:

- shared operational state;
- typed event history;
- evidence/provenance links;
- source authority;
- freshness and invalidation;
- workflow position;
- capability contracts;
- permission gates;
- continuity records;
- contradiction detection;
- replayable history.

## Validation Axes

### Axis A: ArrowHedgeLabs Finance-Agent Sandbox

**Purpose:** Test multi-agent reasoning under fast-changing external state and deterministic risk constraints.

**Why it is useful:**

- Many specialist analyst agents already exist.
- Risk manager and portfolio manager already separate LLM judgment from deterministic constraints.
- Backtesting provides replayable historical scenarios.
- The domain naturally exposes stale data, contradictory signals, evidence gaps, and risk-bound actions.

**State-failure classes to induce:**

- stale price or position state;
- contradictory analyst signals;
- missing evidence for final decision;
- changed portfolio constraints after analyst work;
- amnesiac resume without prior chat;
- replay mismatch after state mutation;
- risk gate bypass attempt.

**Candidate substrate entities/events:**

- `Ticker`, `ResearchRun`, `AnalystSignal`, `RiskState`, `PortfolioState`, `PortfolioDecision`, `EvidenceDocument`, `BacktestRun`.
- Events: `analyst.signal.created`, `risk.state.validated`, `portfolio.decision.proposed`, `portfolio.decision.accepted`, `workflow.blocked.stale_state`.

### Axis B: PluggedInSocial / Marketing-Agent Platform

**Purpose:** Test cross-functional management state across strategy, content, scheduling, lead lifecycle, reporting, and client operations.

**Why it is useful:**

- It is structurally different from finance and wedding.
- pm-substrate already modeled it in `profile-agency`.
- Marketing work has real cross-functional handoffs: lead intake, qualification, proposal, project, campaign, content, approval, scheduling, publishing, reporting, invoicing.
- Agentic roles can naturally disagree: strategist, copywriter, SEO analyst, scheduler, account manager, reporting analyst.

**State-failure classes to induce:**

- lead qualification drift;
- campaign objective changes after content is drafted;
- content published against stale approval state;
- social post uses old brand voice or asset;
- report uses stale campaign metrics;
- account manager and content agent disagree on client commitment;
- invoice/proposal state contradicts project state;
- agent resumes a campaign with missing approvals or outdated schedule.

**Existing substrate anchor:**

- `packages/profile-agency`.
- `packages/capability-agency-lead-scoring`.
- `packages/profile-agency/src/apply-mapping.integration.test.ts`.

**Missing operational step:**

- Clone or reconnect `LopeWale/PluggedInSocial` into `/Volumes/WD_BLACK/JoatLabs/PluggedInSocial`, then map real schema/API rows into `profile-agency`.

### Axis C: Controlled Local LLM/Module State Lab

**Purpose:** Isolate state theory under controlled conditions where we can create the exact failure, measure it, and repeat it.

**Why it is necessary:**

- Real products have too many uncontrolled variables.
- The lab lets us decompose the state problem from a single-agent perspective, parallel-agent perspective, and multi-module perspective.
- It can prove whether the failure comes from context loss, partial observation, representation loss, stale tool reads, memory summarization, missing authority, race conditions, or workflow drift.

**Agent/module decomposition to test:**

- observation module;
- representation module;
- memory module;
- planner module;
- tool/capability module;
- evaluator/feedback module;
- continuity module;
- inter-agent coordination module.

**State-failure classes to induce:**

- single-agent stale memory;
- single-agent wrong source authority;
- single-agent context truncation;
- single-agent tool result misinterpretation;
- parallel agents writing conflicting updates;
- parallel agents reading different snapshots;
- planner acting after workflow invalidation;
- module boundary mismatch, such as CSV/JSON/schema conversion errors;
- local model hallucinating a mapping that deterministic validation rejects.

## Metrics

Use the same metrics across all three axes where possible.

- `state_disagreement_rate`: conflicts between agent belief, source system, projection, and authoritative substrate state.
- `stale_action_rate`: attempted actions based on expired or invalidated reads.
- `evidence_coverage`: percent of decisions/transitions linked to source evidence.
- `contradiction_rate`: unresolved incompatible claims per run.
- `resume_success_rate`: amnesiac agent can resume scope, constraints, open work, and evidence without chat history.
- `replay_fidelity`: replay can reproduce or explain decisions from event history.
- `source_authority_violation_rate`: agent chooses a non-authoritative source when authoritative source exists.
- `workflow_invalid_transition_rate`: attempted transition not legal for current workflow/lifecycle state.
- `capability_contract_violation_rate`: tool/capability invoked with invalid schema, permission, or workflow position.
- `mean_time_to_reconcile`: time from conflict detection to accepted resolution.
- `substrate_edit_count`: number of substrate package edits required to onboard a domain. Target: zero after profile/adapter boundaries exist.

## Substrate Work Required Before Full Test Phase

### Task 1: Create State-Failure Taxonomy

**Status:** Completed on 2026-05-27.

**Files:**

- Created: `docs/state-validation/state-failure-taxonomy.md`

- [x] **Step 1: Define failure classes**

Write the taxonomy with these top-level classes:

```markdown
# State-Failure Taxonomy

## Failure Classes

1. Partial observation
2. Stale observation
3. Representation loss
4. Memory drift
5. Source authority conflict
6. Workflow invalidation
7. Capability contract violation
8. Parallel write conflict
9. Feedback disconnection
10. Continuity break
```

- [x] **Step 2: Add axis examples**

For each class, add one ArrowHedgeLabs example, one PluggedInSocial example, and one local lab example.

- [x] **Step 3: Add measurable signal**

For each class, define the metric that detects it and the event/provenance evidence required to verify it.

### Task 2: Define Evaluation Event Schema

**Status:** Completed on 2026-05-27.

**Files:**

- Created: `docs/state-validation/eval-event-schema.md`
- Created: `packages/evals/src/schema.ts`
- Created: `packages/evals/src/schema.test.ts`
- Created: `packages/evals/src/index.ts`

- [x] **Step 1: Define common eval event fields**

Every eval event must include:

```ts
interface EvalEvent {
  tenantId: string;
  axis: "finance" | "marketing" | "local_lab";
  runId: string;
  agentId: string;
  scenarioId: string;
  failureClass: string;
  observedAt: string;
  source: string;
  evidenceRefs: string[];
  substrateRefs: string[];
  result: "pass" | "fail" | "blocked";
  notes: string;
}
```

- [x] **Step 2: Map eval events to substrate evidence**

Document whether each eval event should point to graph node ids, event ids, workflow run ids, continuity checkpoint ids, or external fixture ids.

**Implementation note:** The actual schema uses typed `EvalEvidenceRef` objects instead of raw string arrays so every evidence pointer preserves a reference kind and id. This was changed from the sketch above because the validation layer must distinguish source records, substrate records, workflow runs, continuity checkpoints, documents, and fixtures during replay.

### Task 3: Define Controlled Local Lab Scenarios

**Files:**

- Create: `docs/state-validation/local-agent-lab-scenarios.md`

- [ ] **Step 1: Define single-agent scenarios**

Include:

- stale memory after source update;
- wrong source authority;
- context truncation;
- invalid workflow step;
- hallucinated mapping rejected by validator.

- [ ] **Step 2: Define parallel-agent scenarios**

Include:

- two agents update same entity from different snapshots;
- planner and executor disagree on current workflow step;
- one agent invalidates another agent's plan;
- two agents claim different authoritative facts.

- [ ] **Step 3: Define multi-module scenarios**

Include:

- parser returns valid JSON with wrong semantics;
- retriever returns stale evidence;
- planner ignores freshness metadata;
- tool caller bypasses capability contract;
- memory summary loses source authority.

### Task 4: Define ArrowHedgeLabs Adapter Plan

**Files:**

- Create: `docs/state-validation/arrowhedge-adapter-plan.md`
- Later create: `packages/profile-finance-research/`
- Later create: `packages/capability-finance-research-ingest/`

- [ ] **Step 1: Map ArrowHedgeLabs state**

Map local objects from:

- `/Volumes/WD_BLACK/JoatLabs/ARROWHEDGELABS/src/graph/state.py`
- `/Volumes/WD_BLACK/JoatLabs/ARROWHEDGELABS/src/main.py`
- `/Volumes/WD_BLACK/JoatLabs/ARROWHEDGELABS/src/agents/portfolio_manager.py`

into substrate entities and events.

- [ ] **Step 2: Preserve deterministic risk boundary**

Treat `compute_allowed_actions` as a deterministic validator whose output becomes evidence-backed operational state.

- [ ] **Step 3: Define no-real-trading guardrail**

Every plan and eval artifact must state that ArrowHedgeLabs is research/education only and must not produce real trading actions.

### Task 5: Define PluggedInSocial Adapter Plan

**Files:**

- Create: `docs/state-validation/pluggedinsocial-adapter-plan.md`
- Later modify: `packages/profile-agency/src/*`
- Later modify/create: `packages/capability-agency-*`

- [ ] **Step 1: Reconnect or clone the source project**

Expected target path:

```bash
/Volumes/WD_BLACK/JoatLabs/PluggedInSocial
```

Expected upstream:

```bash
https://github.com/LopeWale/PluggedInSocial.git
```

- [ ] **Step 2: Validate existing agency profile against source schema**

Compare `profile-agency` entities and edges against PluggedInSocial models/API payloads.

- [ ] **Step 3: Define marketing-agent roles**

Minimum roles:

- strategist;
- account manager;
- copywriter;
- SEO analyst;
- social scheduler;
- reporting analyst;
- lead-scoring agent.

- [ ] **Step 4: Define marketing state-failure scenarios**

Use campaign, lead, content, approval, report, and billing workflows as the failure surfaces.

### Task 6: Build Cross-Axis Comparison Report

**Files:**

- Create: `docs/state-validation/cross-axis-comparison.md`

- [ ] **Step 1: Compare baseline failures**

For each axis, record failures before substrate support.

- [ ] **Step 2: Compare substrate-assisted runs**

For each axis, rerun the same scenarios after substrate state, events, provenance, workflow, and continuity are enabled.

- [ ] **Step 3: Identify theory gaps**

Classify findings as:

- supports current theory;
- weakens current theory;
- missing substrate primitive;
- missing metric;
- domain-specific constraint;
- implementation bug;
- false assumption.

## Research Workstream

Before coding the full test phase, produce a research brief for:

- single-agent state;
- multi-agent parallel state;
- distributed systems state;
- workflow/state-machine theory;
- provenance and evidence;
- source authority and data governance;
- schema matching and semantic interoperability;
- cognitive science / human memory analogies;
- control theory and state estimation.

The research output should feed the taxonomy and metrics, not sit as a separate essay.

## Go / No-Go Criteria

Proceed to test implementation only when:

- taxonomy exists;
- eval event schema exists;
- local lab scenarios exist;
- ArrowHedge adapter plan exists;
- PluggedInSocial adapter plan exists or the missing clone is explicitly resolved;
- metrics are mapped to evidence;
- substrate missing primitives are listed as implementation debt.

Stop and revise the architecture if:

- any domain requires changing core substrate packages to onboard after profile/adapter boundaries exist;
- agent continuity improves summaries but does not improve behavior;
- evidence coverage cannot be measured;
- replay cannot explain decisions;
- source authority cannot be represented;
- local lab failures do not map to real domain failures.

## Initial Recommendation

Start with Axis C first for controlled failure generation, then Axis A for high-signal multi-agent replay, then Axis B for cross-functional management. Do not start with the marketing platform until the PluggedInSocial local clone/source access is resolved, because `profile-agency` is currently a strong substrate anchor but not a live testbed by itself.

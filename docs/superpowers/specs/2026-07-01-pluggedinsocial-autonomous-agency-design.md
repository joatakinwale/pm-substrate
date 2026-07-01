# PluggedInSocial Autonomous Agency Design

Date: 2026-07-01
Status: Approved for implementation planning
Owner: JOAT Labs

## Goal

Build PluggedInSocial into a standalone autonomous marketing agency platform: the user's own agent-run version of a social media marketing company. The platform must work without pm-substrate, but expose clean integration boundaries so pm-substrate or any other external system can consume its events, artifacts, tasks, approvals, and run state.

The v1 autonomy boundary is approval-gated. Agents may research, plan, draft, schedule proposals, produce implementation instructions, and request access. They may not directly mutate an external customer repository, CMS, or website in v1. External writes such as GitHub pull requests and CMS edits become a later slice after the internal agency loop is observable and reliable.

## Current State

PluggedInSocial already has the major application modules:

- FastAPI backend with tenant-scoped RLS, auth, projects, leads, proposals, social posts, email, reports, analytics, media, automations, and internal Worker endpoints.
- Next.js admin, public, and portal surfaces.
- Cloudflare Workers and Queues for email, AI content, social publishing, reports, cron, and virtual-agency dispatch.
- A `VirtualAgencyTask` / `VirtualAgencyEvent` ledger with durable handoffs, dependencies, approvals, idempotency keys, capability checks, and content hash gates.

The gap is product and orchestration depth. The current virtual-agency workflow still behaves like an agent-assisted operations flow: a campaign creates a few hardcoded tasks for content, scheduling, and analytics. It does not yet model a full autonomous marketing engagement with research, strategy, access requests, durable artifacts, campaign runs, user monitoring, and next actions.

## Product Model

The product should feel like an agency cockpit, not a generic admin dashboard. A user starts a client engagement by supplying a client URL, repo link if available, marketing page copy, notes from a strategy session, goals, audience, constraints, and available integrations. Agents then run the same operating loop a human marketing team would run:

1. Intake signal
2. Research and context collection
3. Strategy
4. Work breakdown
5. Approval and access requests
6. Content and campaign asset creation
7. Scheduling and publishing
8. Metrics collection
9. Reporting
10. Next-action proposal

Every step must create durable evidence. The user should be able to monitor what the agents know, what they are doing, what is blocked, what needs approval, and what changed as a result.

## Frontend Concept

The main frontend surface becomes a Client Engagement Command Center.

Required surfaces:

- Intake: client URL, target audience, offer, objectives, constraints, current marketing assets, repo/CMS/social/analytics access state.
- Research Room: collected facts, competitor notes, page analysis, industry context, positioning observations, and evidence references.
- Strategy Plan: ICP, offer angle, messaging thesis, content pillars, channel plan, KPIs, risks, and 30/60/90-day operating plan.
- Agent Workroom: tasks grouped by agent role, dependencies, status, evidence, blocked state, and handoff history.
- Approval Queue: strategy approvals, content approvals, schedule approvals, access requests, and execution approvals.
- Integration Center: social accounts, analytics, calendar, email, GitHub, CMS, website, and future external system connections.
- Campaign Timeline: scheduled posts, email sends, reports, milestones, and follow-up actions.
- Metrics and Next Actions: performance evidence, generated reports, recommendation rationale, and proposed follow-up campaigns.

The existing `/admin` dashboard can remain a high-level overview, but it should link into the engagement command center as the primary monitoring experience.

## Domain Primitives

Add or evolve these backend concepts:

- `ClientEngagement`: the durable workspace for a client/platform. Owns intake data, client URL, repo URL, goals, constraints, status, and integration/access state.
- `MarketingRun`: a full autonomous agency loop for one engagement. Tracks lifecycle stage, current blockers, started/completed timestamps, strategy summary, and next-action state.
- `CampaignRun`: a specific campaign execution under a marketing run. Tracks campaign goal, channels, schedule, assets, publishing state, metrics, and report references.
- `AgencyArtifact`: durable output from agents. Types include research brief, strategy plan, content brief, social draft, email draft, calendar plan, approval packet, published evidence, metrics snapshot, report, implementation brief, and next-action proposal.
- `AgencyAccessRequest`: structured request for credentials, OAuth, repo access, CMS access, analytics access, social account connection, or user-provided files.
- `ApprovalRequest`: reviewable decision object linked to an artifact, run, or task. Approval version and payload hash must be recorded.
- `IntegrationConnection`: provider-neutral integration record for external systems. Existing `IntegrationAccount` can remain provider-specific where needed, but autonomous-agency flows should depend on a neutral abstraction.
- `VirtualAgencyTask`: keep as the durable agent handoff ledger, but expand task types and contexts so it supports the full agency loop.

## Agent Roles

The initial agent team:

- Chief of Staff: owns run planning, task decomposition, dependency management, approval routing, and blocked-state escalation.
- Research Strategist: analyzes client URL, provided copy, market context, competitors, audience, and evidence.
- Strategy Director: turns research into positioning, content pillars, channels, KPIs, and 30/60/90-day strategy.
- Content Creative: drafts social posts, email copy, blog/page outlines, campaign concepts, and creative briefs.
- Scheduling and Distribution: proposes publish windows, channel mix, content calendar, and schedule changes.
- Analytics and Reporting: builds metrics snapshots, reports, performance interpretation, and next-action proposals.
- Community Engagement: drafts response guidance, engagement opportunities, and follow-up actions.
- Integration Operator: identifies needed access, validates connected systems, and creates implementation briefs for external changes.

Agents mutate business state only through deterministic service boundaries. They create artifacts, tasks, approvals, schedules, drafts, and reports through backend services. Direct external writes are outside v1.

## Orchestration Lifecycle

`MarketingRun` stages:

1. `intake`: collect user-provided URL, repo/CMS/social/analytics access, notes, goals, and constraints.
2. `research`: create research artifacts with source references and confidence notes.
3. `strategy`: create strategy plan artifact and approval request.
4. `planning`: decompose approved strategy into campaign tasks and access requests.
5. `production`: create content, briefs, schedule proposals, and implementation briefs.
6. `approval`: wait for user/client approval on strategy, content, schedule, and access-sensitive actions.
7. `execution`: schedule/publish through connected social/email systems after approval.
8. `monitoring`: collect metrics and publish evidence snapshots.
9. `reporting`: generate report artifact and client-facing summary.
10. `next_action`: propose follow-up campaign, strategy revision, distribution increase, or pause/review.

State transitions should be explicit and auditable. Failed or blocked transitions must create visible blocker records instead of silently no-oping.

## Internal Services

Implement as PluggedInSocial-native services first:

- `agency_intake_service`: validates intake, creates engagement and first marketing run.
- `agency_research_service`: creates research tasks and artifacts.
- `agency_strategy_service`: builds strategy plan artifact and approval packet.
- `agency_work_planning_service`: decomposes strategy into agent tasks, dependencies, access requests, and campaign runs.
- `agency_artifact_service`: central artifact creation, versioning, hashing, and lineage.
- `agency_approval_service`: approval request creation, approval/revocation, version checks, and payload hashes.
- `agency_execution_service`: approved scheduling, publishing, and campaign state transitions.
- `agency_metrics_service`: metrics snapshots, freshness checks, and evidence readiness.
- `agency_next_action_service`: report-to-next-action loop.
- `agency_integration_service`: neutral integration capability registry, access status, and provider-specific adapters.

These services should call existing social, email, report, lead, and project services rather than duplicating those systems.

## External Integration Boundary

Expose a neutral integration API for pm-substrate and future external systems:

- `GET /api/integration/v1/capabilities`
- `POST /api/integration/v1/events`
- `GET /api/integration/v1/engagements`
- `GET /api/integration/v1/engagements/{id}`
- `GET /api/integration/v1/marketing-runs/{id}`
- `GET /api/integration/v1/marketing-runs/{id}/artifacts`
- `GET /api/integration/v1/marketing-runs/{id}/tasks`
- `GET /api/integration/v1/marketing-runs/{id}/approvals`
- `POST /api/integration/v1/approvals/{id}/decision`
- `POST /api/integration/v1/webhooks`

The API should return stable IDs, tenant scope, event types, artifact types, hashes, timestamps, lineage, and status. It must not expose internal implementation details that would force pm-substrate to know PluggedInSocial table structure.

## Candidate External Repositories

### Canary

Source reviewed: https://github.com/LopeWale/canary

Canary is a QA harness for coding agents that records real browser sessions with Playwright traces, video, console logs, network HARs, screenshots, machine-readable results, and reusable Playwright scripts. It fits PluggedInSocial as a verification accelerator, not a product runtime dependency.

Recommended use:

- Use Canary or a Canary-inspired flow for frontend verification of the agency cockpit.
- Capture evidence for user-like monitoring flows: create engagement, add URL/repo info, inspect research, approve strategy, approve content, monitor schedule, review metrics, and approve next action.
- Keep canonical Playwright tests in the repo so CI can replay critical flows without paying agent inference cost.

Do not make Canary part of backend orchestration in v1. Treat it as a QA/reporting harness around the app.

### Pi

Sources reviewed:

- https://github.com/earendil-works/pi
- https://pi.dev

Pi is an extensible agent harness with packages for a coding-agent CLI, an agent core, and a unified multi-provider LLM API. It also exposes modes for interactive use, print/JSON scripting, RPC over stdin/stdout, and SDK embedding. Its project documentation states that Pi does not include built-in filesystem/process/network/credential permission restrictions by default and recommends containerization or sandboxing for stronger boundaries.

Recommended use:

- Evaluate Pi later as an external agent runtime candidate or prototyping harness for coding-agent workflows.
- Consider its unified LLM API, session-tree/history model, skills/prompts/extensions model, and RPC/SDK modes as useful design references.
- Do not make Pi the core production orchestrator for v1. PluggedInSocial's own backend services and virtual-agency ledger remain the source of truth.
- If Pi is used later for external repo analysis or implementation assistance, run it behind explicit container/sandbox boundaries and route all durable state back through PluggedInSocial's neutral integration API.

## Substrate Boundary

pm-substrate is not a hard dependency of PluggedInSocial. It is a future external consumer and validation layer.

Rules:

- PluggedInSocial must run standalone.
- Substrate must integrate through neutral APIs/events/artifacts, not direct imports from PluggedInSocial internals.
- PluggedInSocial should expose enough typed state for substrate to evaluate governance, continuity, task evidence, approvals, and campaign outcomes.
- Any substrate adapter should live outside the core PluggedInSocial domain services or behind a dedicated adapter layer.

This preserves portability: another project should be able to copy or integrate the substrate later without rewriting PluggedInSocial's core marketing engine.

## Error Handling and Governance

Required invariants:

- Every agent task has tenant scope, agent role, task type, reason, lineage, and idempotency key.
- Every approval has a version and payload hash.
- Every content-bearing publish path uses a content hash gate.
- Every external access request is explicit and visible to the user.
- Every blocked task has a blocker reason and next required user/system action.
- Every artifact has type, version, author role, source task/run, evidence references, and hash.
- Every external integration action is capability-checked before execution.
- Metrics-dependent tasks wait for published metrics evidence.

Failures should be visible in the cockpit and recorded as events. Silent drops are not acceptable for autonomous workflows.

## Verification

Backend:

- Unit tests for each new agency service.
- Lifecycle tests for `ClientEngagement -> MarketingRun -> AgencyArtifact -> ApprovalRequest -> CampaignRun -> Report -> NextAction`.
- Contract tests for `/api/integration/v1/*`.
- Invariant tests for tenant scope, approval versions, idempotency, dependency gates, content hashes, and capability checks.

Workers:

- Message contract tests for expanded virtual-agency task types.
- Retry/dead-letter tests for transient and permanent backend errors.

Frontend:

- User-flow tests for the command center.
- Required flow: create engagement, provide client URL and notes, watch research and strategy artifacts appear, approve strategy, approve draft content, inspect campaign timeline, view metrics/report, approve next action.
- Use Playwright as the durable CI test layer.
- Evaluate Canary as the recorded-session evidence layer for local QA and review.

Manual verification:

- Run the frontend as a real user monitoring agents.
- Verify that the cockpit clearly shows what agents know, what they are doing, what needs approval, and what is blocked.

## Implementation Slices

Slice 1: Domain spine

- Add `ClientEngagement`, `MarketingRun`, `AgencyArtifact`, `AgencyAccessRequest`, and `ApprovalRequest`.
- Add migrations, schemas, and core service tests.
- Adapt virtual-agency lineage to reference engagement/run/artifact IDs.

Slice 2: Intake to strategy

- Build engagement intake API and first cockpit view.
- Create research and strategy artifact flows.
- Add approval packet for strategy.

Slice 3: Strategy to work plan

- Decompose approved strategy into agent tasks, access requests, content briefs, campaign runs, and approval requests.
- Expand virtual-agency task types and contexts.

Slice 4: Production to scheduling

- Generate content artifacts and social/email draft records.
- Route approvals through `ApprovalRequest`.
- Schedule only approved content with content hash gates.

Slice 5: Execution to metrics

- Publish through existing approved social/email paths.
- Collect metrics snapshots and show freshness/evidence state.

Slice 6: Reporting to next action

- Generate report artifacts and next-action proposals.
- Close the loop by creating the next `MarketingRun` or campaign revision from approved recommendations.

Slice 7: Integration API and substrate adapter

- Expose `/api/integration/v1/*`.
- Add a substrate adapter/eval outside PluggedInSocial core.
- Verify PluggedInSocial still works with the adapter disabled.

## Acceptance Criteria

The v1 autonomous agency engine is complete when:

- A user can create a client engagement from URL/notes/goals.
- Agents create visible research and strategy artifacts with evidence references.
- A user can approve strategy before production work begins.
- Agents create a work plan with tasks, dependencies, access requests, and campaign runs.
- Agents produce draft content and schedules that require approval before publishing.
- Approved content can be scheduled and published through existing systems.
- Metrics evidence gates analytics/reporting work.
- Reports generate next-action proposals.
- The frontend command center lets a user monitor the whole loop.
- The neutral integration API exposes run state, artifacts, tasks, approvals, events, and capabilities.
- PluggedInSocial can run the flow without pm-substrate enabled.
- Tests cover backend lifecycle, integration contracts, Worker contracts, and frontend monitoring flow.


# v01 AI Competitive Intelligence - 2026-06-08

Date: 2026-06-08 UTC
Local run clock: 2026-06-08 07:38 CDT
Automation id: `daily-ai-competitive-intelligence`
Status: first numbered daily continuation
Immediate predecessor read: none; chain index had only the pending setup row from 2026-06-07

## 1. Version Header

This is the first versioned competitive-intelligence note for `pm-substrate`. It does not restart the agent-state thesis; it anchors competitive monitoring to the current shared research ledger and to `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md`.

Core comparison thesis:

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, tool-observation state, or inter-agent communication state is treated as current, sufficient, authoritative operational state. `pm-substrate` is the governed operational-state layer between statistical prediction and valid action: current state, provenance, authority, invalidation, workflow validity, read-set/action review, and durable state-review artifacts.

Repo context read:

1. `research/index.md`
2. `research/daily-ai-competitive-intelligence/index.md`
3. `research/daily-arrowsmith-agent-state/index.md`
4. `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md`
5. `Changelog.md`
6. `packages/agent-state/src/index.ts`
7. `packages/evals/src/metrics.ts`
8. `packages/capability-finance-research-ingest/src/arrowhedge.ts`
9. `packages/continuity/src/interfaces.ts`

## 2. One-Paragraph Delta From Previous Version

There was no prior competitive-intelligence version file. The meaningful delta from the pending setup state is that major vendors are increasingly shipping agent surfaces with enterprise controls, shared plugin distribution, session visibility, richer context, external tool/action reach, and artifact-adjacent execution logs. None of the fresh 2026-06-04 to 2026-06-08 sources prove a complete governed operational-state layer comparable to `pm-substrate`. The closest current threat remains ServiceNow's May 2026 Action Fabric, Context Engine, AI Control Tower, and Workflow Data Fabric framing; it directly claims governed actions on live enterprise context, but the evidence is vendor marketing/product announcement rather than an inspectable artifact-review primitive. OpenAI/GitHub/Microsoft/Google/AWS are moving fast on agent distribution, context, automation, and governance; the pm-substrate response should be to make state-review artifacts durable, schema-validated, eval-linked, and enterprise-workflow-shaped before vendors turn their control planes into explicit pre-action review systems.

Prior-version comparison:

- Added items: all v01 matrix rows are new because the previous state was only the pending setup index.
- Modified threat levels: none from a prior competitive-intelligence version; this run establishes the first baseline.
- Downgraded or rejected overlap claims: memory currentness, larger context, workspace grounding, enterprise plugin distribution, and ServiceNow proof-of-equivalence claims were downgraded or rejected where public evidence did not show operational-state artifacts.
- Newly stale claims: none from a prior competitive-intelligence version.
- New implementation implications: artifact persistence, artifact-to-eval linkage, client/plugin/provider/session metadata, cross-source authority evals, agent-task lifecycle evals, and ServiceNow comparator fixtures.

## 3. Research Question

Are major AI-company and enterprise/workspace AI releases solving the same governed operational-state problem as `pm-substrate`, or are they shipping adjacent memory, RAG, coding-agent, tool, plugin, governance, and productivity features that still leave currentness, authority, provenance, workflow validity, read-set/action review, and durable state-review artifacts unresolved?

## 4. Source/Change Map

| Source cluster | Date checked | Source class | Freshness | Material delta |
| --- | --- | --- | --- | --- |
| OpenAI release notes and ChatGPT Enterprise/Edu release notes | 2026-06-08 | official docs/changelog | High | Fresh June 4-5 updates: up-to-date memory, Lockdown Mode, moderation scores, Enterprise plugin sharing, active sessions, Codex/agent/app-template controls. |
| Anthropic Claude app/API/Claude Code release notes | 2026-06-08 | official docs/changelog | Medium | No material June 5-8 enterprise-state release found; Claude Code had June 6 reliability releases, while May/April items remain relevant as baseline. |
| GitHub Copilot changelog | 2026-06-08 | official changelog | High | Fresh June 4-5 updates: enterprise-managed plugins in VS Code, Agent tasks REST API, larger context/reasoning, PR context, model deprecations. |
| Microsoft Copilot Studio release notes | 2026-06-08 | official docs/changelog | Medium | Build 2026.5.3 adds agent evaluation, environment analytics, transcript retrieval, sensitive-message handling, DLP enforcement, stale connector recovery. |
| Google Developers Blog, Google Workspace Updates, Gemini Enterprise pages | 2026-06-08 | official docs/blog/product pages | High | Fresh June 5 Colab CLI for agents and June 3 Workspace Gmail-source grounding in Drive; older ADK/Gemini Enterprise surfaces remain important context. |
| AWS News Blog, AWS Startup blog, AWS Bedrock pages | 2026-06-08 | official blog/docs/legal | Medium-high | Fresh June 4 Startup Advisor/agentic migration tooling and June 5 Bedrock console result; June 1 Bedrock/OpenSearch/Kiro context remains watchlist. |
| ServiceNow newsroom | 2026-06-08 | official product/press/vendor context | Medium | No fresh 72-hour update, but May 2026 Action Fabric/Context Engine/AI Control Tower is the strongest current direct competitor-overlap baseline. |
| Salesforce, Atlassian, Notion, Slack/Salesforce, Asana, Monday, Linear, Adobe, IBM, Oracle, SAP, Databricks, Snowflake, Palantir, Cohere, Mistral, Perplexity, xAI, Cursor, Cognition, Replit, Sourcegraph, Windsurf, JetBrains | 2026-06-08 | broad watchlist | Low to Medium | No fresh primary source found in this run that changed the operational-state threat assessment. Keep monitoring. |

## 5. Company-by-Company Findings

### OpenAI

Finding classification: High.
Threat level: Medium.

Fresh official sources:

- OpenAI release notes, 2026-06-04: API moderation scores can be returned with Responses API and Chat Completions generation requests.
- OpenAI release notes, 2026-06-04: ChatGPT memory is described as staying more up to date, reducing stale or contradictory saved memories, and exposing sources or memory summary review.
- OpenAI release notes, 2026-06-04: Lockdown Mode limits network-enabled capabilities, including browsing, deep research, agent mode, file downloads, and web-derived image support.
- ChatGPT Enterprise/Edu release notes, 2026-06-05: Codex plugin sharing is available by default for eligible Enterprise workspaces; admins can disable via configuration.
- ChatGPT Enterprise/Edu release notes, 2026-06-02: ChatGPT Sites, role-specific Codex plugins, active sessions, app templates, workspace agents, app action controls, and admin analytics are present in the broader current product surface.

Operational-state overlap:

- Strong overlap with memory currentness, security/admin controls, plugin provenance, shared tool distribution, and network/tool risk controls.
- Moderate overlap with authority and action review through app action controls, admin-managed app templates, Lockdown Mode, and session visibility.
- Weak overlap with durable state-review artifacts: the public sources do not show read-set validation, observation-contract replay, or schema-validated action-review artifacts.

pm-substrate implication:

OpenAI is creating the enterprise surface through which agents, plugins, skills, apps, sites, and sessions become managed. That is a distribution/control-plane threat, but still not proof of governed operational state. `pm-substrate` should assume ChatGPT/Codex will become one client of governed state, not the state layer itself.

Implementation action:

Add artifact fields that make OpenAI-like surfaces inspectable: `clientSurface`, `pluginId`, `appTemplateId`, `connectorScopeRefs`, `sessionRef`, `networkMode`, and `actionConfirmationPolicy`.

### Anthropic

Finding classification: Low for fresh overlap; Medium as baseline watch.
Threat level: Low to Medium.

Fresh official sources:

- Claude Code changelog, 2026-06-06: versions 2.1.167 and 2.1.168 list bug fixes and reliability improvements.
- Claude app release notes had no June item visible in the checked source; May 21 Compliance API integrations remain the most relevant recent enterprise governance item.
- Claude API docs show April deprecations with Claude API retirement on 2026-06-15 for older Sonnet/Opus 4 model IDs and migration guidance to newer models.

Operational-state overlap:

- Fresh June evidence is weak; reliability releases are not architectural proof.
- Compliance API integrations matter for governance and audit, but they are not fresh in this run and do not demonstrate current-state/action review.
- Claude Code remains a meaningful coding-agent competitor, but no new durable operational-state primitive was found today.

pm-substrate implication:

Do not overclaim Anthropic overlap today. Track Claude Code permissions, compliance integrations, memory, MCP/tool surfaces, and model deprecation effects on long-running automation, but mark fresh June competitor-overlap as weak.

Implementation action:

Add model/provider lifecycle metadata to state-review artifacts: `modelProvider`, `modelId`, `modelLifecycleStatus`, and `providerDeprecationRef`, so long-running workflows can flag stale provider assumptions.

### Microsoft and GitHub

Finding classification: High.
Threat level: Medium-high.

Fresh official sources:

- GitHub changelog, 2026-06-05: enterprise-managed plugins in VS Code public preview. Enterprise baseline standards can distribute custom agents, skills, hooks, and MCP configurations across VS Code and Copilot CLI.
- GitHub changelog, 2026-06-04: Agent tasks REST API can programmatically start and track Copilot cloud-agent tasks that make/validate code changes and open pull requests.
- GitHub changelog, 2026-06-04: Copilot larger context windows and configurable reasoning levels support deeper multi-file work.
- GitHub changelog, 2026-06-04: Copilot Chat brings richer context to pull requests.
- GitHub changelog, 2026-06-05: GPT-5.2 and GPT-5.2-Codex deprecated across most Copilot experiences; admins may need model-policy changes.
- Microsoft Copilot Studio Platform 2026.5.3: environment-wide analytics, maker evaluation, transcript retrieval for enhanced task completion agents, controlled failures on request timeout, latest-published-agent-version analytics, stale/deleted connector recovery, MCP auth config, allowed tools, DLP enforcement, sensitive-message non-forwarding, and cross-cloud agent inventory reliability.

Operational-state overlap:

- High overlap with enterprise plugin governance, tool configuration, action/task lifecycle, analytics, agent evaluation, connector currentness, sensitive-message handling, and model policy.
- Medium overlap with workflow validity and provenance through task tracking and PR context.
- Still no direct proof of original-observation contracts, read-set validation against current state, or durable state-review artifacts before mutation.

pm-substrate implication:

GitHub/Copilot is pushing agent tasks into programmable enterprise automation and is starting to standardize plugin/tool distribution. Microsoft Copilot Studio is strengthening maker evaluation and connector/tool reliability. This is the most direct developer-workflow pressure on `pm-substrate`: if `pm-substrate` does not expose review artifacts and eval evidence in developer-native formats, Copilot/GitHub can own the operational surface even without solving the deeper state problem.

Implementation action:

Add `agentTaskRef`, `pullRequestRef`, `pluginStandardsRef`, `mcpConfigRef`, and `modelPolicyRef` to artifact provenance or related objects. Add eval scenarios for "agent task starts from stale issue/PR state" and "enterprise plugin hook policy changes between read and action."

### Google, Gemini, DeepMind, Workspace, and Cloud

Finding classification: High.
Threat level: Medium.

Fresh official sources:

- Google Developers Blog, 2026-06-05: Google Colab CLI bridges local terminals to remote Colab runtimes for developers and AI agents, including remote execution and replayable notebook logs.
- Google Workspace Updates, 2026-06-03 and recap 2026-06-05: Gmail threads can be added as sources in Ask Gemini in Drive, combining email, files, and folders in a high-context workspace.
- Google Workspace Updates, 2026-06-01 and recap 2026-06-05: Organize My Files in Drive is generally available; users review Gemini file-move recommendations before relocation.
- Google Developers Blog, 2026-05-12: ADK long-running agent tutorial uses explicit workflow state machine, persistent session storage, webhooks, human approvals, and cross-team handoffs.
- Gemini Enterprise product pages: agent discovery, creation, sharing, running, centralized governance, Microsoft 365/Workspace/Salesforce/SAP connectors, agent marketplace, and partner validation.

Operational-state overlap:

- High overlap with memory/RAG/context expansion, agent-friendly tool surfaces, artifact logs, workflow state machines, persistent sessions, and human review of recommendations.
- Medium overlap with governed enterprise agent control through Gemini Enterprise and ADK.
- Weak overlap with source authority and read-set/action review: Gmail-as-source and Drive organization improve grounding but do not prove currentness invalidation, authority policy, or pre-action artifact review.

pm-substrate implication:

Google is making enterprise context and agent execution ubiquitous across Workspace, Cloud, and developer tooling. The most important pm-substrate distinction is that "more sources in context" is not the same as "authoritative current operational state." The Colab CLI's replayable logs are an opportunity: pm-substrate artifacts should be at least as portable and replayable as notebook logs, but focused on action validity.

Implementation action:

Add evals for cross-source Workspace grounding conflicts: Gmail thread vs Drive document vs current project state. Add artifact export/import tests with replay logs and source inventory.

### AWS

Finding classification: Medium.
Threat level: Medium.

Fresh official sources:

- AWS Startup blog, 2026-06-04: AWS Startup Advisor gives tailored next actions from stack/stage context and is available on startups.aws, Kiro, VS Code, Cursor, and Claude Code.
- AWS News Blog category page, 2026-06-05: Amazon Bedrock console experience is described as supporting project organization, model comparison, streamlined evaluations, and project-aware live documentation.
- AWS Weekly Roundup, 2026-06-01: Claude Opus 4.8 on AWS, OpenSearch Serverless for agentic AI applications, OpenSearch Agent Skills for Vercel/Kiro/Claude Code/Cursor, AWS Transform assessment, and Aurora MySQL with Kiro Powers.
- AWS legal/docs, June 2026 version: Serverless third-party model terms for Bedrock include OpenAI, Anthropic, Google, Meta, Mistral, and other providers, reinforcing multi-provider model governance.

Operational-state overlap:

- Medium overlap with project-aware documentation, evaluations, agentic migration, vector/search surfaces, and model/provider governance.
- Low direct overlap with workflow validity and pre-action review.
- Bedrock/AgentCore remains a watchlist for managed agent governance, but fresh sources today do not show pm-substrate-equivalent state-review artifacts.

pm-substrate implication:

AWS is turning agent infrastructure into a cloud control plane with model/provider optionality and IDE/agent integrations. `pm-substrate` should stay provider-neutral and make the operational-state artifact independent of model host.

Implementation action:

Add provider-neutral `modelGatewayRef`, `runtimeProviderRef`, `evalHarnessRef`, and `externalTermsRef` provenance links. Add falsifier where a model/provider migration invalidates a long-running agent's assumptions.

### ServiceNow

Finding classification: High, but not fresh in the 72-hour window.
Threat level: High.

Current baseline official sources:

- ServiceNow newsroom, 2026-05-05: Action Fabric opens ServiceNow's system of action to external AI agents through its generally available MCP Server, with AI Control Tower governance, OAuth, audit trails, session management, and role-based tool packages.
- ServiceNow newsroom, 2026-05-06: Context Engine, Autonomous Data Analytics, and Workflow Data Fabric are positioned as live, governed enterprise intelligence for autonomous AI.
- ServiceNow newsroom, 2026-05-05: AI Control Tower expands discovery, observation, governance, security, and measurement across AI systems and workflows.

Operational-state overlap:

- Strongest direct overlap found: system of action, governed execution, live enterprise data, context engine, workflow fabric, agent inventory, audit, and role-scoped actions.
- Evidence remains vendor announcement/product positioning, not an inspectable read-set/action-review implementation.
- ServiceNow's language is closest to `pm-substrate`'s thesis, but likely optimized around the Now Platform's own workflow/data graph rather than portable substrate artifacts.

pm-substrate implication:

ServiceNow is the first high-threat comparison row because it explicitly claims the runtime where "every action is governed" and grounded in live business context. `pm-substrate` must differentiate by being lighter, portable, source/provenance-first, and artifact-review native across tools, not a single vendor's workflow platform.

Implementation action:

Add a "ServiceNow falsifier" eval: if a competitor can show a portable pre-action artifact containing original observation, current state, authority, invalidation, workflow validity, read-set review, human handoff, and replay hash before mutation, threat moves from High to Critical.

## 6. Threat/Opportunity Matrix

| Vendor | Release/research item | Source class/date | Evidence strength | Operational-state overlap | Threat | pm-substrate implication | Product/implementation action | Metric/eval to add | Falsifier | Risk/ethics/security note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | ChatGPT memory that stays more up to date | official changelog, 2026-06-04 | High | Memory currentness, stale/contradictory memory reduction | Medium | Memory currentness is getting productized, but memory is still not authoritative operational state. | Add memory-vs-artifact invalidation fixtures. | `memory_staleness_escape_rate` | OpenAI exposes authoritative read-set/action-review artifacts tied to memory use. | Personalization can silently alter context; reviewability matters. |
| OpenAI | Lockdown Mode | official changelog, 2026-06-04 | High | Tool/network risk controls | Medium | Tool access is becoming an admin policy surface. | Add `networkMode` and `toolRiskPolicyRef` to artifacts. | `restricted_tool_escape_rate` | Lockdown mode includes per-action provenance/review evidence. | Reduces exfiltration risk but may create false confidence if state is stale. |
| OpenAI | Enterprise Codex plugin sharing and role-specific plugins | official changelog, 2026-06-02/05 | High | Plugin provenance, enterprise distribution, admin controls | Medium-high | Shared plugins can become de facto workflow substrate. | Track `pluginId`, `skillId`, `marketplaceRef`, and installed version in review artifacts. | `plugin_policy_drift_rate` | Shared plugins include current-state/action review by default. | Shared tooling increases blast radius of unsafe actions. |
| GitHub | Enterprise-managed plugins in VS Code | official changelog, 2026-06-05 | High | Enterprise hooks, MCP configs, skills, client governance | Medium-high | Developer control plane can own state-adjacent standards. | Add plugin standards refs and hook-policy artifacts. | `enterprise_hook_policy_coverage` | GitHub emits portable read-set review artifacts for agent tasks. | Enterprise auto-installation must be auditable and permission-scoped. |
| GitHub | Agent tasks REST API | official changelog, 2026-06-04 | High | Programmatic agent tasks, progress tracking, PR mutation path | Medium-high | Agent work is becoming API-addressable and automatable. | Add agent-task lifecycle refs and PR-state freshness fixtures. | `agent_task_stale_pr_state_rate` | API requires current-state validation before task start/write. | PAT/OAuth automation raises least-privilege and audit concerns. |
| Microsoft | Copilot Studio 2026.5.3 maker evaluation, analytics, connectors, DLP | official docs/changelog, 2026.5.3 | Medium-high | Evaluation, version analytics, stale connector handling, sensitive-message controls | Medium-high | Microsoft is closing operational gaps around maker evaluation and tool reliability. | Add connector lifecycle and published-agent-version metadata. | `stale_connector_recovery_rate` | Copilot Studio exposes original observations and read-set/action decisions. | Sensitive data forwarding and connector reconnect behavior are high-risk. |
| Google | Colab CLI for agents | official blog, 2026-06-05 | High | Agent tool execution, remote runtime, replayable logs/artifacts | Medium | Replayable execution logs are adjacent to durable artifacts. | Make state-review artifacts export/import friendly and replayable. | `artifact_export_import_fidelity` | Colab logs include action-validity state review before remote execution. | Remote execution needs artifact recovery, cleanup, and data-boundary controls. |
| Google | Gmail as source in Ask Gemini in Drive | official Workspace update, 2026-06-03 | High | Cross-source grounding, Workspace context | Medium | Context expansion raises authority/currentness conflict cases. | Add Gmail-vs-Drive-vs-project-state conflict fixtures. | `cross_source_authority_conflict_rate` | Gemini marks current authoritative source and invalidates stale threads before action. | Email context may include sensitive or outdated commitments. |
| Google | ADK long-running agents with state machine/persistent sessions | official tutorial, 2026-05-12 | Medium | Workflow state, persistence, pause/resume, approvals | Medium-high | Google is teaching explicit workflow state, close to substrate primitives. | Compare ADK state machine vs pm-substrate observation/action artifacts. | `workflow_resume_revalidation_rate` | ADK adds portable source authority and read-set validation. | Persistent sessions can preserve stale state unless revalidated. |
| AWS | Startup Advisor and agentic migration tooling | official blog, 2026-06-04 | High | Context-aware recommendations, IDE/agent plugins | Medium | AWS is making provider guidance available inside agent tools. | Track cloud/provider assumptions in artifacts. | `provider_assumption_invalidated_rate` | Advisor emits authority/provenance/currentness proofs for recommendations. | Vendor guidance may optimize for provider adoption, not user authority. |
| AWS | Bedrock console project-aware evaluation/docs and OpenAI/Claude/Codex availability | official blog/docs, 2026-06-01/05 | Medium | Model governance, project evals, provider lifecycle | Medium | Multi-provider model hosting makes runtime/provider provenance mandatory. | Add model/provider lifecycle refs. | `model_lifecycle_policy_drift_rate` | Bedrock AgentCore provides portable action-review artifact schema. | Third-party model terms and provider boundaries must be visible. |
| ServiceNow | Action Fabric, Context Engine, AI Control Tower | official product/press, 2026-05-05/06 | Medium | Live governed enterprise context, workflow actions, audit, MCP, identity | High | Closest direct competitor-overlap claim. | Differentiate on portable state-review artifact and provider-neutral runtime. | `governed_action_artifact_completeness` | ServiceNow shows portable pre-action review artifacts with replay/hash/source authority. | Vendor lock-in and audit opacity are the main comparison risks. |

## 7. Operational-State Overlap Analysis

Highest-overlap dimensions observed today:

1. Enterprise tool/plugin governance is accelerating. OpenAI, GitHub, Microsoft, Google, AWS, and ServiceNow all now have surfaces where agents/tools/plugins/connectors are centrally managed or distributed.
2. Context expansion is accelerating. OpenAI memory, Google Gmail-in-Drive grounding, GitHub larger context, and AWS project-aware documentation all make more information available to agents.
3. Evaluation/analytics is becoming a product requirement. Microsoft maker evaluation, OpenAI admin analytics, GitHub task tracking, AWS Bedrock evaluations, and ServiceNow AI Control Tower all reinforce the market expectation that agents must be measured.
4. Agent action surfaces are widening. GitHub Agent tasks API, OpenAI workspace agents/Sites/plugins, Google Colab CLI/ADK, AWS agentic migration/Kiro, and ServiceNow MCP Action Fabric move agents closer to business mutations.

What remains mostly unsolved in public evidence:

1. Original observation vs current state comparison before action.
2. Durable, portable state-review artifacts with stable hashes.
3. Explicit source authority and invalidation rules, not just more context.
4. Workflow-validity checks that are separated from chat memory or session state.
5. Read-set validation against declared and observed dependencies.
6. Action/handoff review artifacts that survive model, tool, and provider changes.

Conclusion:

The market is converging on "agents need control planes." It has not yet converged on "agents need portable, provenance-backed, authoritative operational-state review before valid action." That gap is still the pm-substrate opening.

## 8. pm-substrate Comparison And Implications

Current `pm-substrate` primitives found locally:

- `CurrentStateView`
- `ObservationContract`
- `ObservationContractEvaluation`
- `ReadSetValidationDecision`
- `ActionProposalReview`
- `StateReviewArtifact`
- canonical artifact hashing and hash verification
- ArrowHedge state-review artifact construction
- eval metrics for state assertions, action proposal reviews, and state-review artifacts
- continuity checkpoints that can carry evidence-linked payloads

Current `pm-substrate` gaps from the latest Arrowsmith chain:

- no persisted/exported JSON artifact corpus
- no artifact schema validation path
- no artifact-to-eval-event linkage
- no observed read-set capture
- no temporal phase metadata for observation-to-action, action-to-feedback, and feedback-to-observation drift
- no targeted invariant-class blocking policy
- no portable client/plugin/provider lifecycle metadata in artifacts

Competitive implication:

Vendors are not yet proving `pm-substrate` wrong. They are proving the urgency of the next slice. Every agent-control-plane release makes the absence of durable operational-state artifacts more painful, because agent actions will spread across more clients, plugins, IDEs, workflows, and enterprise apps.

## 9. Product-Management / Enterprise-Workflow Implications

1. The buyer language is shifting from "chatbot" to "agent control plane."
2. Enterprise users will expect centralized visibility across agents, plugins, sessions, actions, costs, and tools.
3. Workspace products are turning emails, files, PRs, tickets, and cloud docs into active context, which makes source authority and stale-context detection a product requirement.
4. PM surfaces should not present "the AI knows this" as state. They should present "this source currently authorizes this action under these constraints."
5. Human-AI handoff should become artifact-driven: what was read, what changed, what is still valid, who/source owns it, what action is allowed, and what must be revalidated tomorrow.

## 10. Implementation Implications For pm-substrate

Next implementation actions, ordered by competitor pressure:

1. Persist/export ArrowHedge `StateReviewArtifact` JSON fixtures with stable canonical hashes.
2. Add artifact schema validation and import/replay fidelity tests.
3. Add artifact-to-eval-event references so metrics derive from reviewed artifacts, not scenario prose.
4. Add source/client/plugin metadata fields: `clientSurface`, `pluginId`, `skillId`, `mcpConfigRef`, `connectorScopeRefs`, `sessionRef`, `modelProvider`, `modelId`, and `providerLifecycleStatus`.
5. Add cross-source authority fixtures for Workspace-style context: email thread, Drive document, PR, issue, and current project state disagree.
6. Add agent-task lifecycle fixtures for GitHub/Codex-style background agents: task started from stale issue, task resumes after plugin policy changed, task opens PR after model deprecation.
7. Add ServiceNow comparator fixture that requires source authority, workflow validity, audit trail, identity, role-scoped action, and replay hash.
8. Keep mutation blocking out of the next slice unless it is scoped by invariant class; durable evidence comes first.

## 11. Downgraded, Rejected, Weak, Or Stale Claims

| Claim | Status | Reason |
| --- | --- | --- |
| OpenAI memory currentness solves operational state | Downgraded | Memory is useful continuity/personalization state, but the source does not show authority, workflow validity, read-set review, or action artifacts. |
| Larger GitHub Copilot context solves stale state | Downgraded | Larger context reduces omission risk but can still contain stale or unauthorized context. |
| Google Gmail-in-Drive grounding creates an enterprise shared operating picture | Weak | It is a context aggregation feature; source authority and currentness are not proven. |
| Claude had a fresh June enterprise operational-state release | Reject for this run | No material official June 5-8 release was found beyond Claude Code bugfix/reliability notes. |
| ServiceNow is already proven to have pm-substrate-equivalent artifacts | Weak / unproven | ServiceNow has the strongest vendor claim, but public sources are product announcements, not inspectable artifact-review evidence. |
| AWS Bedrock model/provider governance is an operational-state layer | Downgraded | It is important runtime/provider governance, but not sufficient action validity. |
| Enterprise plugin distribution equals safe action | Reject | Distribution increases reach; safety still needs currentness, authority, provenance, and review. |

## 12. Metrics And Eval Scenarios To Add

Metrics:

- `memory_staleness_escape_rate`
- `plugin_policy_drift_rate`
- `enterprise_hook_policy_coverage`
- `agent_task_stale_pr_state_rate`
- `stale_connector_recovery_rate`
- `restricted_tool_escape_rate`
- `cross_source_authority_conflict_rate`
- `workspace_context_invalidated_action_rate`
- `provider_assumption_invalidated_rate`
- `model_lifecycle_policy_drift_rate`
- `governed_action_artifact_completeness`
- `artifact_export_import_fidelity`

Eval scenarios:

1. OpenAI-style memory: a saved memory says a project uses policy A, but the authoritative repo ledger has moved to policy B; action must warn and cite current source.
2. GitHub agent task: a cloud agent starts from an issue, but the PR branch/repo policy changes before mutation; review artifact must fail or warn before PR creation.
3. GitHub enterprise plugin: MCP hook policy changes after task start; the review must detect plugin policy drift.
4. Google Workspace grounding: Gmail thread, Drive file, and current ledger disagree; action must prefer source authority over context volume.
5. Google Colab/AWS remote runtime: remote execution produces logs, but artifact import must validate source refs and artifact hash before treating result as current.
6. Microsoft Copilot Studio connector: connector is stale/deleted/reconnected; action must revalidate source authority and connector identity.
7. ServiceNow comparator: external agent asks to execute a workflow action; artifact must include identity, role/package, source authority, current workflow position, read set, and replay hash.
8. Provider lifecycle: model ID is deprecated during a long-running workflow; continuation must record provider lifecycle status and require revalidation if behavior assumptions changed.

## 13. Next-Day Watchlist

1. OpenAI: watch ChatGPT Enterprise/Edu and OpenAI release notes for workspace-agent action review, plugin governance, app action confirmation, and Codex automation changes.
2. Anthropic: watch Claude Code changelog, Claude API release notes, Claude Compliance API, memory, connectors, and MCP/tool permission surfaces for more than reliability notes.
3. Microsoft/GitHub: watch GitHub Agent tasks API, enterprise-managed plugins, Copilot model policies, Copilot Studio maker evaluation, and connector lifecycle handling.
4. Google: watch Workspace Updates, Gemini Enterprise, ADK, Antigravity, Colab CLI, A2A/MCP/WebMCP, and Ask Gemini source grounding.
5. AWS: watch Bedrock AgentCore, Bedrock console evaluation, Kiro Powers, OpenSearch Agent Skills, WorkSpaces agent desktop, and third-party model governance.
6. ServiceNow: keep as highest-threat vendor baseline; search for technical docs or demos proving portable pre-action review artifacts.
7. Salesforce/Agentforce, Atlassian/Rovo, Notion, Slack/Salesforce, Asana, Monday, Linear, Adobe, IBM, Oracle, SAP, Databricks, Snowflake, Palantir, Cohere, Mistral, Perplexity, xAI, Cursor, Cognition, Replit, Sourcegraph, Windsurf, JetBrains: only upgrade threat level on fresh primary evidence.

## 14. Source Inventory With Links And Dates

Primary official sources used:

- OpenAI release notes, 2026-06-04, moderation scores, memory, Lockdown Mode: https://openai.com/products/release-notes/
- ChatGPT Enterprise/Edu release notes, 2026-06-05, plugin sharing; 2026-06-02, Sites/role plugins/active sessions; May agent controls: https://help.openai.com/en/articles/10128477-chatgpt-enterprise-edu-release-notes
- Claude Help Center release notes, checked 2026-06-08: https://support.claude.com/en/articles/12138966-release-notes
- Claude API release notes, checked 2026-06-08: https://platform.claude.com/docs/en/release-notes/overview
- Claude Code changelog, 2026-06-06 reliability releases: https://code.claude.com/docs/en/changelog
- GitHub changelog, 2026-06-05, GPT-5.2/GPT-5.2-Codex deprecation: https://github.blog/changelog/2026-06-05-gpt-5-2-and-gpt-5-2-codex-deprecated/
- GitHub changelog, 2026-06-05, enterprise-managed plugins in VS Code: https://github.blog/changelog/2026-06-05-enterprise-managed-plugins-in-vs-code-in-public-preview/
- GitHub changelog, 2026-06-04, Agent tasks REST API: https://github.blog/changelog/2026-06-04-agent-tasks-rest-api-now-available-for-copilot-pro-pro-and-max/
- GitHub changelog, 2026-06-04, larger context windows/reasoning: https://github.blog/changelog/2026-06-04-larger-context-windows-and-configurable-reasoning-levels-for-github-copilot/
- GitHub changelog, 2026-06-04, PR context: https://github.blog/changelog/2026-06-04-copilot-chat-brings-richer-context-to-pull-requests/
- Microsoft Copilot Studio Platform 2026.5.3 release notes: https://learn.microsoft.com/en-us/power-platform/released-versions/copilotstudio/2026.5.3
- Google Developers Blog, 2026-06-05, Google Colab CLI: https://developers.googleblog.com/introducing-the-google-colab-cli/
- Google Workspace Updates, 2026-06-03, Gmail as a source in Ask Gemini in Drive: https://workspaceupdates.googleblog.com/2026/06/gmail-as-source-in-ask-gemini-in-drive-now-generally-available.html
- Google Workspace Updates, 2026-06-01, Organize My Files in Drive: https://workspaceupdates.googleblog.com/2026/06/organize-my-files-in-drive-now-generally-available.html
- Google Workspace Updates recap, 2026-06-05: https://workspaceupdates.googleblog.com/2026/06/weekly-recap-06-05-2026.html
- Google Developers Blog, 2026-05-12, long-running ADK agents: https://developers.googleblog.com/en/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/
- Google Gemini Enterprise product pages, checked 2026-06-08: https://cloud.google.com/gemini-enterprise and https://cloud.google.com/gemini-enterprise/agents
- AWS Startup blog, 2026-06-04, Startup Advisor and agentic migration: https://aws.amazon.com/aws-startups/from-idea-to-revenue-at-startup-speed-with-ai/
- AWS News Blog, 2026-06-01, Bedrock/OpenSearch/Kiro roundup: https://aws.amazon.com/blogs/aws/aws-weekly-roundup-claude-opus-4-8-on-aws-aurora-mysql-with-kiro-powers-and-more-june-1-2026/
- AWS Bedrock category page, checked 2026-06-08, Jun 5 console item and recent Bedrock items: https://aws.amazon.com/blogs/aws/category/artificial-intelligence/amazon-machine-learning/amazon-bedrock/
- AWS Bedrock third-party model terms, June 2026 version: https://aws.amazon.com/legal/bedrock/third-party-models/
- ServiceNow Action Fabric, 2026-05-05: https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-opens-its-full-system-of-action-to-every-AI-Agent-in-the-enterprise/default.aspx
- ServiceNow real-time data foundation, 2026-05-06: https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-launches-the-real-time-data-foundation-that-puts-autonomous-AI-to-work-across-the-enterprise/default.aspx
- ServiceNow AI Control Tower expansion, 2026-05-05: https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-expands-AI-Control-Tower-to-discover-observe-govern-secure-and-measure-AI-deployed-across-any-system-in-the-enterprise/default.aspx

Source discipline notes:

- Official docs/changelogs were treated as highest evidence for shipped or documented features.
- Product/press pages were treated as vendor context, not proof of implementation internals.
- Broad search and press/social snippets were used only to discover primary sources; weak social claims were not included as findings.
- New or recent vendor claims were not treated as proof of architectural equivalence unless they showed currentness, authority, provenance, workflow validity, read-set/action review, and durable artifacts.

## 15. Fetch/Reconcile/Publish Proof

Repo proof before writing:

- Worktree at start: `main...origin/main` with a pre-existing unrelated deletion of `docs/superpowers/plans/2026-05-27-three-axis-state-validation.md`.
- Fetched `origin/main`; remote moved from `25ce66b3cf2a390ff15ff1b872492b7a0edcb979` to `1752cde`.
- `git pull --ff-only origin main` was blocked by local unstaged deletion because pull was configured to rebase.
- Used `git merge --ff-only origin/main` to fast-forward without stashing or reverting the unrelated deletion.
- Upstream changes reconciled: `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md`, `research/daily-arrowsmith-agent-state/index.md`, `research/index.md`, and `Changelog.md`.
- Implementation surfaces inspected: `@pm/agent-state`, `@pm/evals`, ArrowHedge finance ingest, and continuity interfaces.

Validation/publish proof to complete after this file and ledger updates:

- Required section scan for this version file.
- `git diff --check`.
- Commit only competitive-intelligence research/ledger/changelog files, preserving the unrelated local deletion.
- Push `main` to `origin/main`.
- Verify local `HEAD` equals `origin/main`.

# Daily AI Competitive Intelligence Index

Last updated: 2026-06-08
Scope: major AI companies, workspace AI, enterprise AI, agent platforms, AI coding/productivity tools, and competitors that may overlap with pm-substrate's operational-state thesis.

## Current Baseline

The first versioned run is complete. The live competitive pattern is that major vendors are expanding agent control planes, enterprise plugin/tool governance, shared workspace context, and evaluation/analytics. None of the fresh 2026-06-04 to 2026-06-08 sources proved a full governed operational-state layer with original-observation review, source authority, read-set validation, workflow validity, and durable state-review artifacts. ServiceNow remains the highest direct threat baseline because its May 2026 Action Fabric/Context Engine/AI Control Tower language most closely overlaps with `pm-substrate`, but the public evidence is still vendor/product positioning rather than inspectable artifact-review proof.

Parallel-run reconciliation on 2026-06-08: `origin/main` created v01 while a local broader vendor scan was still running. v01 remains the canonical first version. The local scan is preserved as v02, and both lines of evidence are folded into this index and the shared research ledger.

## Schedule

- Automation id: `daily-ai-competitive-intelligence`
- Cadence: daily at 7:30 AM America/Chicago
- Output folder: `research/daily-ai-competitive-intelligence/`
- Local config: `$CODEX_HOME/automations/daily-ai-competitive-intelligence/automation.toml`

## Run Protocol

Each run must:

1. Fetch and pull `origin/main`.
2. Read `research/index.md`, this index, the latest competitive-intelligence version file, the daily Arrowsmith index, the latest daily Arrowsmith version, and `Changelog.md`.
3. Search official and credible sources from the last 24-72 hours for OpenAI, Anthropic, Microsoft/GitHub Copilot, Google/Gemini/DeepMind, Google Cloud/Workspace, and other credible enterprise/workspace AI competitors.
4. Create the next sequential version file.
5. Update this index and `research/index.md`.
6. Commit and push to `main`.

## Versions

| Version | Date | File | Role | Top delta |
| --- | --- | --- | --- | --- |
| v01 | 2026-06-08 | `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` | First numbered baseline-plus-delta run | Added official-source comparison across OpenAI, Anthropic, Microsoft/GitHub, Google, AWS, and ServiceNow; marked OpenAI/GitHub/Microsoft/Google/AWS as Medium to Medium-high control-plane threats and ServiceNow as the highest direct overlap baseline; converted findings into artifact, eval, provider, plugin, and workflow-state implementation implications. |
| v02 | 2026-06-08 | `research/daily-ai-competitive-intelligence/v02-ai-competitive-intelligence-2026-06-08.md` | Parallel same-day reconciliation and broader vendor scan | Preserved upstream v01 unchanged, added broader watch coverage for OpenAI workspace agents, GitHub/Copilot session state, AWS Step Functions plus AgentCore, Atlassian Teamwork Graph, Asana Agentic Work Management, Cursor agent stores, Slack/Salesforce MCP actions, ServiceNow, Anthropic, Google, and Cognition; no reviewed source exposed the full pm-substrate pre-action `StateReviewArtifact` boundary. |

## Top Deltas

1. OpenAI and GitHub are making agents/plugins/skills/app actions enterprise-manageable across Codex, ChatGPT, Copilot CLI, and VS Code.
2. Microsoft Copilot Studio is strengthening maker evaluation, analytics, connector recovery, sensitive-message handling, DLP, MCP manifests, and allowed-tool handling.
3. Google is expanding agent-ready execution and context surfaces through Colab CLI, Workspace Gmail-in-Drive grounding, Gemini Enterprise, and ADK long-running agent patterns.
4. AWS is pushing provider-neutral model/agent infrastructure through Bedrock, Startup Advisor, Kiro, OpenSearch Agent Skills, and multi-provider terms.
5. ServiceNow remains the strongest direct competitor-overlap baseline because it explicitly claims live governed enterprise context plus system-of-action execution, but no portable review-artifact proof was found.
6. The parallel v02 scan raised Atlassian, Asana, Cursor, Slack/Salesforce, and Cognition into the active watch set, mostly as partial work-graph, session-store, MCP-action, or coding-agent-state competitors rather than complete operational-state systems.

## Source Changes

### Added on 2026-06-08 v01

- OpenAI release notes and ChatGPT Enterprise/Edu release notes for memory currentness, Lockdown Mode, moderation scores, Enterprise Codex plugin sharing, Sites, active sessions, role-specific plugins, workspace agents, app templates, app action controls, and admin analytics.
- Anthropic Claude Help/API/Claude Code release notes for June reliability-only updates, May Compliance API context, and June 15 model lifecycle watch.
- GitHub Copilot changelog for enterprise-managed plugins in VS Code, Agent tasks REST API, larger context/reasoning, PR context, and model deprecations.
- Microsoft Copilot Studio Platform 2026.5.3 for maker evaluation, analytics, stale/deleted connector handling, MCP manifest/auth/allowed-tool fixes, DLP enforcement, and sensitive-message controls.
- Google Developers/Workspace/Gemini Enterprise sources for Colab CLI, Gmail as a source in Ask Gemini in Drive, Drive file organization recommendations, long-running ADK agents, and Gemini Enterprise agent governance.
- AWS Startup/AWS News/Bedrock sources for Startup Advisor, agentic migration tooling, Bedrock evaluations/project-aware docs, OpenSearch Agent Skills, and multi-provider Bedrock terms.
- ServiceNow Action Fabric, Context Engine, Workflow Data Fabric, and AI Control Tower as highest-threat vendor baseline.

### Added on 2026-06-08 v02

- OpenAI workspace agents GA and Codex role/tool/workflow posts as direct shared-agent and enterprise-tool orchestration signals.
- GitHub Copilot app, VS Code Agents window, session sync, remote sessions, Agent Host Protocol, worktrees, canvases, and CLI scheduling/voice/rubber-duck updates as coding-agent work-state signals.
- AWS Step Functions AgentCore integration and Bedrock AgentCore release notes as deterministic workflow plus managed-agent runtime evidence.
- Atlassian Teamwork Graph/Rovo, Asana Agentic Work Management, Slack Feature Drop, Cursor changelog, ServiceNow Build Agent, and Cognition/Devin partnership/product pages as broader enterprise work-state and coding-agent watch sources.

## Current Highest Threats

| Threat | Vendor | Why it matters | Current assessment |
| --- | --- | --- | --- |
| High | ServiceNow | Claims live governed enterprise intelligence plus a system of action exposed to external agents through MCP, identity, audit, and role-scoped tools. | Strongest direct overlap, but still vendor-context evidence. |
| Medium-high | GitHub/Microsoft | Agent tasks API, enterprise-managed plugins, Copilot Studio evaluation/connectors/DLP, and model policies turn developer agents into governed enterprise workflows. | High distribution/control-plane risk; no public durable state-review proof. |
| Medium-high | OpenAI | ChatGPT/Codex workspace agents, plugins, app templates, sessions, Sites, memory, and Lockdown Mode create broad enterprise agent governance surfaces. | Strong client/control-plane pressure; memory is not operational state. |
| Medium | Google | Workspace/Gemini/ADK/Colab make agent context and execution ubiquitous, with some explicit workflow-state guidance. | Strong context/runtime pressure; authority/currentness remains unproven. |
| Medium | AWS | Bedrock/Kiro/Startup Advisor/OpenSearch Agent Skills push provider-neutral agent infrastructure and model governance. | Important runtime threat; not yet an action-validity substrate. |
| Medium-high | Atlassian/Asana/Cursor | Teamwork Graph, Agentic Work Management, and agent-store/session mechanics overlap with work-state, workflow, and durable agent-trace concerns. | Strong implementation and positioning signals; no public proof of pm-substrate-equivalent action validation. |

## Rejected, Weak, Or Downgraded Claims

- OpenAI up-to-date memory is not a governed operational-state layer.
- GitHub one-million-token context does not solve stale or unauthorized context.
- Google Gmail-in-Drive grounding is context aggregation, not source authority.
- Claude had no material fresh June enterprise operational-state release in this run.
- ServiceNow has the closest claim but has not publicly shown portable original-observation/read-set/action-review artifacts.
- Enterprise plugin distribution increases reach; it does not by itself make actions safe.

## Current Implementation Implications

1. Persist/export ArrowHedge `StateReviewArtifact` JSON fixtures with stable hashes.
2. Add artifact schema validation and import/replay fidelity tests.
3. Link state-review artifacts to eval events.
4. Add client/plugin/provider/session metadata to artifacts: `clientSurface`, `pluginId`, `skillId`, `mcpConfigRef`, `connectorScopeRefs`, `sessionRef`, `modelProvider`, `modelId`, and provider lifecycle status.
5. Add cross-source authority fixtures for email/file/PR/issue/project-ledger conflicts.
6. Add agent-task lifecycle fixtures for stale issue/PR state, plugin policy drift, connector lifecycle drift, and model deprecation.
7. Keep ServiceNow as the comparator for "governed action artifact completeness."
8. Add competitor-inspired fixtures for Slack/CRM writes, GitHub/Cursor coding sessions, AWS workflow agent steps, Atlassian graph writes, Asana work-graph actions, ServiceNow deploys, and Google Workspace shared artifacts.

## Watchlist

- OpenAI: blog/news, API/platform changelog, model/research releases, ChatGPT Enterprise/Team, agents/tools/MCP surfaces.
- Anthropic: news, Claude release notes, API docs, research, enterprise/admin/security, memory/tool/computer-use/MCP surfaces.
- Microsoft: Microsoft 365 Copilot, GitHub Copilot, Azure AI Foundry, Copilot Studio, Semantic Kernel, AutoGen, Windows/Edge AI.
- Google: Gemini app, Google AI Blog, Google DeepMind, Google Cloud AI, Workspace AI, Vertex AI, Agentspace.
- Additional competitors: Meta, AWS, Apple, Salesforce, ServiceNow, Atlassian, Notion, Slack/Salesforce, Asana, Monday.com, Linear, Adobe, IBM, Oracle, SAP, Databricks, Snowflake, Palantir, Cohere, Mistral, Perplexity, xAI, Cursor/Anysphere, Cognition, Replit, Sourcegraph, Windsurf/Codeium, JetBrains.

## Threat Assessment Rubric

| Level | Meaning |
| --- | --- |
| None | No meaningful overlap with operational state. |
| Low | General AI feature, memory, RAG, or productivity release with weak overlap. |
| Medium | Agent/workflow/productivity feature with some state, provenance, or enterprise coordination surface. |
| High | Direct overlap with currentness, authority, workflow validity, action review, provenance, or multi-agent coordination. |
| Critical | A major company appears to be building a governed operational-state layer directly comparable to pm-substrate. |

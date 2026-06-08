# Daily AI Competitive Intelligence Index

Last updated: 2026-06-08
Scope: major AI companies, workspace AI, enterprise AI, agent platforms, AI coding/productivity tools, and competitors that may overlap with pm-substrate's operational-state thesis.

## Current Baseline

The first numbered competitive-intelligence run is now published. The current market baseline is no longer "chat plus memory." Major vendors are converging on agent control planes, work graphs, managed agent runtimes, session state, enterprise permissions, audit trails, and workflow orchestration.

The core pm-substrate differentiation remains intact but more urgent: reviewed vendor sources show many partial state surfaces, but none showed the full proof boundary of `currentStateView + originalObservationContract + assertionEvaluation + readSetValidation + ActionProposalReview + replayable StateReviewArtifact + targeted policy mode` before action.

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
| v01 | 2026-06-08 | `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` | First numbered competitive-intelligence run | Escalated OpenAI, GitHub/Microsoft, AWS, Atlassian, Asana, ServiceNow, Google, Slack, Cursor, Anthropic, and Cognition from generic AI watch to partial agent-control/work-state competitors; no reviewed source exposed pm-substrate's full pre-action state-review artifact boundary. |

## Major Findings

1. **OpenAI is directly competing for shared workspace-agent orchestration.** June 5, 2026 release notes make workspace agents generally available for ChatGPT Business, Enterprise, and Edu, with builder safeguards and admin usage/activity visibility.
2. **GitHub is turning agent work into managed state.** Copilot app, VS Code Agents window, session sync, Agent Host Protocol, canvases, isolated worktrees, remote sessions, and Chronicle all treat agent work as persistent inspectable workflow state.
3. **AWS is the strongest infrastructure threat.** Step Functions now embeds AgentCore managed-harness reasoning steps with execution history, CloudWatch details, human approvals, and session-id context.
4. **Atlassian is the closest work-state graph competitor.** Teamwork Graph exposes permissioned context across people, goals, code, content, decisions, owners, freshness signals, CLI, and MCP with read/write action surfaces.
5. **Asana is claiming the category language.** Asana's June 4, 2026 launch frames Agentic Work Management as the operating system for human-agent teams on the same plan, context, and governance.
6. **Cursor is an implementation lesson for persisted agent state.** JSONL/custom agent stores, run correlation, nested subagents, checkpoint preservation, and auto-review are directly relevant to pm-substrate's artifact-lifecycle gap.
7. **Google, Slack/Salesforce, ServiceNow, Anthropic, and Cognition all have credible partial overlap.** Their sources show permissioned grounding, managed agents, MCP actions, governed deployment, audit logs, long-running sessions, or coding agents, but not the complete state-review primitive.

## Threat Level Changes

| Company / surface | Current level | Change | Reason |
| --- | --- | --- | --- |
| OpenAI workspace agents / Codex | High | Escalated from watchlist | GA shared workspace agents, app-action safeguards, admin visibility, role plugins, and cross-tool workflows. |
| GitHub / Microsoft Copilot | High | Escalated from watchlist | Agent-native desktop, session sync/history, AHP, canvases, worktrees, remote sessions, CLI review/scheduling. |
| AWS AgentCore / Step Functions | High | Escalated from watchlist | Agent reasoning inside deterministic workflows with audit, approval, session context, identity, policy, evals, and MCP/Gateway surfaces. |
| Atlassian Rovo / Teamwork Graph | High | Escalated from watchlist | Permissioned work graph with owners, decisions, freshness signals, CLI/MCP, and graph writes. |
| Asana Agentic Work Management | High | Escalated from watchlist | Publicly claims human-agent operating layer over Work Graph and shared plan/context/governance. |
| ServiceNow Build Agent / AI Control Tower | High in ServiceNow enterprises, Medium-High generally | Escalated from watchlist | Governed app/agent creation, approvals, audit, release management, tests, external coding-agent skills. |
| Google Workspace / Gemini / DeepMind | Medium-High | Escalated from watchlist | Workspace Intelligence, managed agents, Drive-governed shared artifacts, Co-Scientist multi-agent mechanism. |
| Slack / Salesforce Agentforce | Medium-High | Escalated from watchlist | Slackbot MCP actions, event automations, memory, handoff, CRM writes, planned multi-agent orchestration. |
| Cursor / Anysphere | Medium-High | Escalated from watchlist | JSONL/custom agent stores, nested subagents, request ids, checkpoints, auto-review, enterprise org controls. |
| Anthropic Claude / Cowork / Claude Code | Medium-High | Confirmed, no fresh direct escalation | Finance agents, connectors, subagents, permissions, credential vault, audit logs; June 10 AWS event next. |
| Cognition / Devin | Medium | Added as credible coding-agent watch | Public-sector partnership and end-to-end coding-agent posture, but limited state-mechanism detail. |

## Corrected Claims

- The competitive landscape is not limited to memory/RAG. Vendors now ship agent sessions, workflows, permissioned graphs, audit trails, approval flows, and managed runtimes.
- "Operational state" remains stricter than vendor "context." None of the reviewed sources showed original-observation review, read-set validation against current state, subject/read-set binding, or canonical pre-action artifacts.
- "Governed by default" must be parsed by mechanism. ServiceNow, AWS, OpenAI, Atlassian, and Cursor all have governance-like controls, but those controls are not automatically equivalent to stale/authority/workflow validation.
- Coding-agent state is a real implementation frontier. GitHub and Cursor now have state/session features pm-substrate should learn from, even though they target software work first.

## Downgraded Claims

- Workspace Intelligence, Slackbot memory, Gemini managed sessions, GitHub session sync, and Cursor stores are downgraded as complete operational-state proof. They are continuity/context mechanisms until paired with currentness, authority, invalidation, and action review.
- Asana's "operating system for human-agent teams" is downgraded from mechanism proof to category proof until technical docs expose validation semantics.
- Anthropic finance-agent audit logs are downgraded as authority proof. Auditability after tool use is not the same as deterministic pre-action review.
- Cognition/Devin public-sector partnership is downgraded as a direct operational-state claim because the strongest June 3 source is partner-issued and not a technical state/control specification.

## Implementation Implications

1. Persist/export ArrowHedge `StateReviewArtifact` JSON/JSONL artifacts before the next broad positioning claim.
2. Add import/replay tests that verify canonical hash stability and tamper detection.
3. Add competitor-inspired fixture metadata: `slack_mcp_action`, `github_agent_session`, `aws_step_function_agent_step`, `atlassian_graph_write`, `asana_work_graph_action`, `servicenow_deploy`, and `gemini_workspace_shared_artifact`.
4. Add eval assertions that shared conversations, canvases, sessions, or workspace summaries are derived evidence only until source refs validate against current state.
5. Define policy-mode fixtures for stale source, authority mismatch, workflow mismatch, and subject/read-set mismatch before claiming mutation blocking.

## Next Watchlist

1. OpenAI developer docs for workspace-agent safeguards, app action controls, plugin sharing, Codex Goal Mode, and whether action artifacts exist.
2. AWS AgentCore Policy/Memory/Evaluations/Gateway/Step Functions docs for explicit stale-state or read-set validation.
3. Atlassian Teamwork Graph CLI and Rovo MCP docs for freshness, write authority, audit schema, and permission checks.
4. Asana Agentic Work Management docs for Work Graph, AI Teammates, Dash, and governance.
5. Cursor SDK docs for `LocalAgentStore`, JSONL schema, request ids, checkpointing, and auto-review policy.
6. ServiceNow Build Agent/AEMC/AI Control Tower docs for deployment approval evidence and live-instance state validation.
7. Google Gemini Interactions API and Gemini Enterprise Agent Platform docs for managed-agent session state and action controls.
8. Anthropic AWS Summit LA on June 10, 2026 for structured memory, sub-agent architecture, and Claude Code on AWS governance details.

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

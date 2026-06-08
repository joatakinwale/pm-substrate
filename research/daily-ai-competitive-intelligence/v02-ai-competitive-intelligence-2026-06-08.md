# v02 AI Competitive Intelligence - 2026-06-08

Date: 2026-06-08 UTC
Local run clock: 2026-06-08 America/Chicago
Status: second numbered daily competitive-intelligence run; parallel-research reconciliation
Prior version: `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md`
Repository sync: initial `git fetch origin main` and `git pull --ff-only origin main` completed before reading repository research at `1752cde`; before push, `origin/main` had advanced to `3a6d43f` with its own v01. This v02 preserves the local parallel evidence while keeping upstream v01 canonical.
Search window: official sources from the last 24-72 hours plus adjacent June 2-4, 2026 releases and older foundational product pages where needed to establish the first-run baseline.

Required local context read:

1. `/Users/admin/.codex/automations/daily-ai-competitive-intelligence/memory.md`
2. `research/index.md`
3. `research/daily-ai-competitive-intelligence/index.md`
4. No prior `vNN-ai-competitive-intelligence-*.md` file was present when the local scan began; upstream v01 arrived during the run and was reconciled before push.
5. `research/daily-arrowsmith-agent-state/index.md`
6. `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md`
7. `Changelog.md`
8. Current implementation surfaces around `@pm/agent-state`, ArrowHedge COP, evals, continuity, workflow, registry, graph, events, and capability boundaries.

Upstream code/research state inspected:

- Initial latest commit inspected: `1752cde docs: add daily agent-state arrowsmith v05`; pre-push reconciliation found upstream commit `3a6d43f Add daily AI competitive intelligence v01`.
- Latest material upstream delta: Arrowsmith v05 added temporal-state, progressive-constraint, semantic-commit, and common-operating-picture mechanisms, but kept the implementation frontier at persisted/exported ArrowHedge state-review artifacts, artifact-to-eval linkage, observed read sets, DB/fixture equivalence, temporal phase metadata, and targeted policy modes.
- Current proof boundary in code remains: `CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + ActionProposalReview + StateReviewArtifact + hash replay`, with advisory default and pure blocking mode but no external mutation gate.

Current pm-substrate comparison baseline:

> pm-substrate is the governed operational-state layer between statistical prediction and valid action. The competitive test is not whether a vendor has memory, RAG, long context, enterprise search, or chat history. The test is whether the vendor exposes currentness, authority, provenance, workflow validity, read-set/write-set or action validation, pre-action review, and durable replayable evidence before an agent mutates business state.

## 1. Delta From Prior Version

This is the second same-day competitive-intelligence version. The main delta from v01 is reconciliation plus breadth: upstream v01 remains the canonical first run and identifies ServiceNow as the strongest direct baseline; this v02 preserves a parallel scan that adds stronger emphasis on OpenAI workspace agents, GitHub/Copilot session state, AWS Step Functions plus AgentCore, Atlassian Teamwork Graph, Asana Agentic Work Management, Cursor agent stores, Slack/Salesforce MCP action surfaces, and Cognition/Devin as additional watch items.

Conflict reconciliation: `origin/main` created v01 while this run was active. The merge preserves upstream v01 unchanged, adds this local scan as v02, and updates the chain index plus shared ledger so both lines of evidence remain durable.

The main finding is that the market moved past "chat plus memory" into agent control planes. In the last week of reviewed sources, OpenAI, GitHub/Microsoft, AWS, Asana, Cursor, and Atlassian all exposed or reiterated surfaces that manage long-running agents, tool access, workspace context, enterprise controls, session state, audit trails, or human approval.

Important escalations:

- OpenAI workspace agents are no longer just a research-preview signal. The June 5, 2026 Enterprise/Edu release notes say workspace agents are generally available for ChatGPT Business, Enterprise, and Edu, with agent activity/usage visibility and action safeguards.
- GitHub's Copilot app and VS Code agent releases explicitly frame agent work as session/state management: isolated worktrees, canvases, remote sessions, session sync, Agent Host Protocol, persisted session preferences, and searchable work history.
- AWS Step Functions now integrates with Amazon Bedrock AgentCore harness in preview, putting agent reasoning steps inside deterministic workflows with execution history, CloudWatch turn details, human approval steps, parallel/sequence execution, and session-id continuity.
- Atlassian Teamwork Graph and Rovo are the closest direct work-state competitors reviewed: a permissioned graph of people, goals, code, content, decisions, freshness signals, owners, and action paths exposed through CLI and MCP.
- Asana publicly framed its June 4, 2026 launch as an operating system for human-agent teams sharing the same plan, context, and governance.
- Cursor now exposes agent/run stores, JSONL append-only persistence, custom `LocalAgentStore`, run correlation ids, nested subagents, and auto-review gates. This is coding-agent state, not full operational-state validity, but it is directly relevant to persisted agent-state mechanics.

Important downgrades:

- No major vendor source reviewed showed an explicit equivalent to pm-substrate's original-observation contract review, read-set validation against a current view, subject/read-set binding, `asOf`/`evaluatedAt` pre-action artifact, canonical review hash, or policy modes like `block_on_authority_or_stale`.
- Marketing phrases such as "full context", "real-time understanding", "AI operating system", "agentic OS", and "governed by default" remain downgraded unless the source documents concrete currentness, authority, invalidation, and action-validation mechanisms.
- Workspace memory, Slack/Drive sharing, session persistence, and RAG over enterprise data remain partial state surfaces. They do not by themselves establish valid action.

Threat-level changes from v01:

- OpenAI: escalated to High.
- GitHub/Microsoft: escalated to High.
- AWS AgentCore/Step Functions: escalated to High.
- Google Workspace/Gemini/DeepMind: escalated to Medium-High.
- Atlassian Rovo/Teamwork Graph: escalated to High and placed on closest-direct-overlap watch.
- Asana: escalated to High with Medium confidence because the mechanism is still partly product-positioning.
- Cursor/Anysphere: escalated to Medium-High for agent-state mechanics in coding workflows.
- Anthropic: Medium-High overall because Claude Cowork/finance agents/Claude Code show long-running tool and audit mechanics, but no fresh 72-hour primary release changed the operational-state comparison.

## 2. Company-by-Company Watch

### OpenAI - ChatGPT Workspace Agents, Codex, Plugins, Enterprise Controls

- New sources:
  - ChatGPT Enterprise & Edu release notes, updated June 5, 2026: https://help.openai.com/en/articles/10128477-chatgpt-enterprise-edu-release-notes
  - Codex for every role, tool, and workflow, June 2, 2026: https://openai.com/index/codex-for-every-role-tool-workflow/
  - Codex is becoming a productivity tool for everyone, June 2, 2026: https://openai.com/index/codex-for-knowledge-work/
  - Introducing workspace agents in ChatGPT, April 22, 2026: https://openai.com/index/introducing-workspace-agents-in-chatgpt/
- Release/news date: June 5, 2026 for the strongest release-note update; June 2, 2026 for the Codex knowledge-work/plugin expansion.
- Capability summary: Workspace agents are generally available for ChatGPT Business, Enterprise, and Edu; admins get visibility and controls; builders can set app-action safeguards; agents can run shared workflows across tools, Slack, and apps. Codex expanded role-specific plugins, Sites, annotations, and knowledge-work workflows.
- Mechanism extracted: shared cloud agents, app/tool connectors, plugin bundles, admin/RBAC controls, app-action safeguards, workspace directories, Slack thread behavior, role-specific skills, agent-created internal apps/sites, Codex goal mode and plugin sharing.
- Overlap with pm-substrate: High overlap on enterprise agent workflow coordination, shared agents, tools, controls, and knowledge-work automation. Weak evidence for explicit operational-state validation.
- Threat level: High.
- Confidence: High for product availability and controls; Medium for any claim that OpenAI validates currentness/authority before actions.
- Why it matters: OpenAI is packaging agent creation and deployment for the same buyer/user motion pm-substrate targets. The differentiation must be deterministic evidence before action: original observation contracts, read-set validation, state-review artifacts, policy modes, and replayable provenance.

### Anthropic - Claude Cowork, Claude Code, Finance Agents, AWS Deployment Surface

- New sources:
  - Anthropic newsroom, June 3 and June 2, 2026 entries: https://www.anthropic.com/news
  - Anthropic at AWS Summit LA 2026 event page, scheduled June 10, 2026: https://www.anthropic.com/events/anthropic-at-aws-summit-la-2026
  - Agents for financial services, May 5, 2026: https://www.anthropic.com/news/finance-agents
  - The Briefing: Enterprise Agents, February 24, 2026: https://www.anthropic.com/events/the-briefing-enterprise-agents-virtual-event
- Release/news date: no new official 24-72 hour product release materially changed the state thesis; June 10, 2026 AWS event is upcoming and should be checked next run.
- Capability summary: Anthropic continues to position Claude across enterprise knowledge work, Claude Cowork, Claude Code, plugins, financial-services agent templates, connectors, subagents, long-running sessions, per-tool permissions, credential vaults, and audit logs.
- Mechanism extracted: skills/instructions, governed connectors, subagents, managed agents, long-running sessions, per-tool permissions, managed credential vaults, full audit log in Claude Console, user-in-loop review/approval.
- Overlap with pm-substrate: Medium-High on agent workflow templates and auditability. Lower on explicit current-state/action validation because the sources show connectors and audit logs, not original-observation review or read-set validation.
- Threat level: Medium-High.
- Confidence: Medium.
- Why it matters: Anthropic's financial-services templates overlap with ArrowHedge-style use cases and show an enterprise path for domain agents. pm-substrate should not compete on "finance agent template" alone; it should prove governed action validity from source authority, currentness, and replayable state-review artifacts.

### Microsoft and GitHub - Copilot App, Copilot CLI, VS Code Agents, Foundry Local

- New sources:
  - GitHub Copilot app: The agent-native desktop experience, June 2, 2026: https://github.blog/news-insights/product-news/github-copilot-app-the-agent-native-desktop-experience/
  - GitHub Copilot in Visual Studio Code, May releases, June 3, 2026: https://github.blog/changelog/2026-06-03-github-copilot-in-visual-studio-code-may-releases/
  - Copilot CLI refresh, June 2, 2026, with June 3 editor note: https://github.blog/changelog/2026-06-02-copilot-cli-improved-ui-rubber-duck-prompt-scheduling-and-voice-input/
  - Agentic Retrieval in Foundry Local release notes, June 2026: https://learn.microsoft.com/en-us/azure/azure-arc/agents-tools-foundry-local/release-notes
  - Microsoft 365 Copilot release notes, March-April 2026 for Copilot Studio/Viva agent reports and skill inference: https://learn.microsoft.com/en-us/microsoft-365/copilot/release-notes
- Release/news date: June 2-3, 2026 for GitHub; June 2026 for Foundry Local release notes.
- Capability summary: GitHub is building a desktop control center for agent-native software development, with isolated worktrees, My Work, canvases, plans, sessions, PRs, browser/terminal/deployment/dashboard/workflow state, code review, and app/runtime integration. VS Code agents add remote sessions, session sync, session preferences, AHP session-state synchronization, and Chronicle. Foundry Local adds Agentic Retrieval with an Agents Runtime API for threads, messages, runs, and SSE.
- Mechanism extracted: isolated worktrees, durable sessions, session sync to GitHub, canvases as bidirectional human-agent work surfaces, AHP, base-branch refresh before edits, agent history, prompt scheduling, rubber-duck review agent, thread/run APIs, edge RAG layers.
- Overlap with pm-substrate: High for coding-agent operational coordination and persistent work state. Still missing explicit evidence of state/currentness validation before each action, source authority, or review artifacts independent of Git/GitHub workflow.
- Threat level: High.
- Confidence: High.
- Why it matters: GitHub is directly taking the "agent work needs a state surface" position. pm-substrate should deepen cross-tool, non-code work validation and artifact evidence, while borrowing session-state and canvas ideas for eval visualization.

### Google, Google Workspace, Gemini, DeepMind, Google Cloud

- New sources:
  - Google Workspace: Gemini app chats/canvases/media shared through Drive, May 28, 2026 with end-user rollout starting June 3, 2026: https://workspaceupdates.googleblog.com/2026/04/share-chats-canvases-and-generated-media-from-the-Gemini-app-securely-via-Google-Drive.html
  - Google Workspace Intelligence with admin controls, April 22, 2026: https://workspaceupdates.googleblog.com/2026/04/introducing-workspace-intelligence-with-admin-controls.html
  - Google AI May 2026 roundup, June 5, 2026: https://blog.google/innovation-and-ai/technology/ai/google-ai-updates-may-2026/
  - Managed Agents in the Gemini API, May 19, 2026: https://blog.google/innovation-and-ai/technology/developers-tools/managed-agents-gemini-api/
  - Google DeepMind Co-Scientist, May 19, 2026: https://deepmind.google/blog/co-scientist-a-multi-agent-ai-partner-to-accelerate-research/
- Release/news date: June 5, 2026 roundup; June 3, 2026 rollout start for Drive sharing visibility; May 19, 2026 managed agents and Co-Scientist.
- Capability summary: Workspace Intelligence grounds Gemini in Workspace data with admin data-source controls and permission-respecting access. Gemini app artifacts can be shared via Drive. Managed Agents in the Gemini API provide cloud sandbox execution, resumable environments with files/state intact, custom AGENTS.md/SKILL.md definitions, and enterprise preview support. Co-Scientist shows multi-agent hypothesis generation, debate, ranking, and literature/database grounding.
- Mechanism extracted: Workspace-wide permissioned data grounding, Drive-governed sharing, managed agent environments, resumable session state, AGENTS/SKILL markdown definitions, supervisor and specialist agents, literature/database grounding, tournament/ranking loops.
- Overlap with pm-substrate: Medium-High. Google is strong on enterprise data grounding, managed agent infrastructure, and multi-agent research patterns. Sources do not show source-of-truth authority arbitration or pre-action validation beyond permission-aware grounding.
- Threat level: Medium-High.
- Confidence: High for source facts; Medium for operational-state equivalence.
- Why it matters: Google has the Workspace data substrate and managed-agent infrastructure. pm-substrate's differentiation must be that permissioned retrieval/sharing is not enough unless agent actions pass currentness, authority, workflow, and read-set checks.

### AWS - Amazon Bedrock AgentCore and Step Functions

- New sources:
  - AWS Step Functions adds AgentCore-powered agentic reasoning step, June 3, 2026: https://aws.amazon.com/about-aws/whats-new/2026/06/aws-step-functions-agentcore/
  - Amazon Bedrock AgentCore release notes: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html
  - Amazon Bedrock AgentCore Identity OBO token exchange, April 30, 2026: https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-bedrock-agentcore/
- Release/news date: June 3, 2026 for Step Functions integration.
- Capability summary: Step Functions can now insert AgentCore managed-harness reasoning steps into workflows; agents can run in sequence/parallel, use human approval steps, persist context across invocations via session id, and expose execution history plus CloudWatch links for agent turn details. AgentCore has policy, memory, evaluations, gateway, identity, VPC/security controls, MCP target support, and OBO token exchange.
- Mechanism extracted: deterministic workflow wrapper around agent reasoning, execution history, human approval, trace/audit details, session-id continuity, managed harness configs, model/tool overrides per invocation, identity delegation, policy-enforced access, evals and observability.
- Overlap with pm-substrate: High. AWS is closest on platform primitives for workflow plus agent runtime governance. The remaining gap is semantic-operational validation: current-state views, original observation contracts, read-set validation, action proposal review, canonical review artifacts, and policy modes specific to stale/authority/invariant classes.
- Threat level: High.
- Confidence: High.
- Why it matters: AWS may become the default enterprise substrate for agent execution. pm-substrate should treat AgentCore + Step Functions as the infrastructure benchmark and differentiate as the open/state-review layer above or alongside runtime orchestration.

### Atlassian - Rovo and Teamwork Graph

- New sources:
  - Rovo makes AI-native teamwork real for the enterprise, May 6, 2026: https://www.atlassian.com/blog/company-news/rovo-team-26
  - Atlassian Teamwork Graph: The context engine behind your AI everywhere, May 6, 2026: https://www.atlassian.com/blog/company-news/teamwork-graph-team-26
  - Atlassian Teamwork Graph product page: https://www.atlassian.com/platform/teamwork-graph
- Release/news date: May 6, 2026.
- Capability summary: Teamwork Graph maps people, goals, code, content, decisions, owners, freshness signals, and work relationships across Atlassian and connected SaaS apps; exposes CLI and MCP access; supports reads and writes; preserves permissions; powers Rovo agents and automations.
- Mechanism extracted: permissioned enterprise work graph, Forge connectors, MCP server, CLI, owner/source/decision relationships, freshness signals, graph writes, Rovo Studio governance with roles/approvals/versioning/insights, triggered automations.
- Overlap with pm-substrate: High and probably the closest direct work-state overlap reviewed. It is an operational context graph for humans and agents. It still appears closer to a permissioned work graph plus agent orchestration than to pre-action validity artifacts.
- Threat level: High.
- Confidence: High.
- Why it matters: Atlassian is competing for the "shared work context graph" center of gravity. pm-substrate should sharpen where it differs: generic profile-driven substrate, typed events/capabilities, explicit current-state validation, authority/invalidation, and review artifacts before action.

### Asana - Agentic Work Management

- New source:
  - Asana unveils operating system for human-agent teams, June 4, 2026: https://investors.asana.com/news-releases/news-release-details/asana-unveils-operating-system-human-agent-teams
- Release/news date: June 4, 2026.
- Capability summary: Asana announced a product suite for humans and agents working from the same plan, same context, and same governance. Asana Dash captures follow-ups from meetings, Slack threads, and email; turns them into structured work in the Work Graph; and connects users to AI Teammates.
- Mechanism extracted: work graph, shared plan, AI teammates, structured work conversion, personal chief-of-staff layer, governance framing, industry/service/client management apps coming soon.
- Overlap with pm-substrate: High concept overlap, Medium mechanism confidence. The source clearly targets human-agent operational coordination but does not expose detailed validation semantics.
- Threat level: High.
- Confidence: Medium.
- Why it matters: Asana is explicitly naming the work-management layer for human-agent teams. pm-substrate must turn its stronger mechanism into visible artifacts and evals before Asana-style product framing owns the category.

### Slack and Salesforce - Slackbot, Agentforce, MCP, Memory, Orchestration

- New source:
  - Slack Feature Drop: A Downpour of Done, May 13, 2026, with May/June 2026 GA targets: https://slack.com/blog/news/slack-feature-drop-april2026
- Release/news date: May 13, 2026; selected features target May and June 2026 GA.
- Capability summary: Slackbot roadmap includes creating/updating Salesforce records, MCP-based actions across apps, event-triggered automations, deep research, embedded AI handoff, memory, and later Agentforce/third-party/multi-agent orchestration.
- Mechanism extracted: conversational action surface, MCP client, event triggers, CRM writes, memory across conversations, embedded handoff, multi-agent orchestration.
- Overlap with pm-substrate: Medium-High. Slack is a major action surface with rich conversational context and MCP actions. It is not shown as an authority/currentness validator by itself.
- Threat level: Medium-High.
- Confidence: Medium.
- Why it matters: Slack is a likely front door for workspace agents. pm-substrate should define how a Slack-originated proposed action becomes a state-review artifact before writes to Salesforce, Jira, Asana, or internal systems.

### ServiceNow - Build Agent, AI Agent Studio, AI Control Tower

- New source:
  - ServiceNow Build Agent now works inside every major AI coding tool, governed by default, May 6, 2026: https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-Build-Agent-now-works-inside-every-major-AI-coding-tool-governed-by-default/default.aspx
- Release/news date: May 6, 2026.
- Capability summary: Build Agent is generally available in ServiceNow Studio, extends skills into Cursor, Windsurf, Claude Code, and GitHub Copilot, and routes generated applications through App Engine Management Center governance, approvals, release management, lifecycle controls, audit trails, tests, and AI Control Tower.
- Mechanism extracted: platform-native context, SDK skills in external coding agents, MCP Client, sandbox validation, deployment approvals, release management, audit trails, self-healing test loop, custom instructions, app-scope awareness.
- Overlap with pm-substrate: High for governed enterprise app/workflow development inside ServiceNow. Lower for general substrate breadth and explicit current-state review semantics.
- Threat level: High in ServiceNow-centered enterprises; Medium-High generally.
- Confidence: High.
- Why it matters: ServiceNow is positioning governance as the antidote to ungoverned AI-built apps. pm-substrate should not cede "governed by default"; it should demonstrate governance as typed events, authority, read-set validation, and replayable action-review evidence.

### Cursor / Anysphere - Cursor SDK, Agent Stores, Subagents, Enterprise Governance

- New source:
  - Cursor changelog, entries visible around June 3-4, 2026 and current top entry reviewed June 8, 2026: https://cursor.com/changelog
- Release/news date: June 3-4, 2026 for visible entries; current top entry did not expose its date in the page extract but was crawled June 8, 2026.
- Capability summary: Cursor SDK supports JSONL append-only agent/run stores, custom `LocalAgentStore`, optional Postgres-backed persistence, nested subagents, run correlation ids, safer checkpoint disposal, context-usage reports in canvases, enterprise organizations/teams/groups controls, and auto-review run mode.
- Mechanism extracted: persisted local agent metadata, diffable JSONL state, custom store interface, nested delegation, request ids, checkpoint preservation, context accounting, multi-team governance, classifier-based tool-call approval.
- Overlap with pm-substrate: Medium-High on agent-state persistence and coding action review. Weak on non-code operational currentness and authority.
- Threat level: Medium-High.
- Confidence: High for Cursor mechanics; Medium for broader enterprise operational-state threat.
- Why it matters: Cursor is closing some local durable-agent-state gaps that pm-substrate has not yet productized. Its JSONL/custom-store model is a useful reference for ArrowHedge persisted state-review artifacts.

### Cognition / Devin

- New sources:
  - Cognition homepage article listing, reviewed June 8, 2026: https://cognition.ai/
  - Cognition AI and Carahsoft public-sector partnership, June 3, 2026: https://www.globenewswire.com/news-release/2026/06/03/3306128/0/en/Cognition-AI-and-Carahsoft-Announce-Strategic-Partnership-to-Accelerate-AI-Driven-Software-Development-Security-and-Mainframe-Modernization-for-Federal-Agencies.html
- Release/news date: June 3-4, 2026 for partnership and official article list.
- Capability summary: Devin is positioned as an end-to-end autonomous software engineer for planning, coding, testing, and shipping; public-sector partnership makes the platform available through government procurement with FedRAMP High and zero-data-retention claims in the partner release.
- Mechanism extracted: compound AI architecture, right-model-for-task orchestration, autonomous planning/coding/testing/iteration, regulated-sector procurement and governance posture.
- Overlap with pm-substrate: Medium for AI coding productivity and governance posture. Limited evidence of operational-state mechanisms beyond code lifecycle.
- Threat level: Medium.
- Confidence: Medium because the strongest June 3 source is partner-issued rather than a technical product doc.
- Why it matters: Cognition/Devin is a credible coding-agent competitor, but current evidence does not show the operational-state layer pm-substrate is trying to prove.

## 3. New Sources Reviewed

| Source | Company/authors | Date | Link | Source type | Relevance |
| --- | --- | --- | --- | --- | --- |
| ChatGPT Enterprise & Edu release notes | OpenAI | 2026-06-05 | https://help.openai.com/en/articles/10128477-chatgpt-enterprise-edu-release-notes | Official release notes | Workspace agents GA, safeguards, admin usage, plugin sharing, Codex controls. |
| Codex for every role, tool, and workflow | OpenAI | 2026-06-02 | https://openai.com/index/codex-for-every-role-tool-workflow/ | Official product blog | Role plugins, app/tool/workflow bundles, Sites, annotations. |
| Codex is becoming a productivity tool for everyone | OpenAI | 2026-06-02 | https://openai.com/index/codex-for-knowledge-work/ | Official report announcement | Codex expanding into knowledge work and workflow automation. |
| Introducing workspace agents in ChatGPT | OpenAI | 2026-04-22 | https://openai.com/index/introducing-workspace-agents-in-chatgpt/ | Official product blog | Baseline for shared agents, schedules, Slack, tool workflows. |
| Anthropic newsroom | Anthropic | 2026-06-02 to 2026-06-03 entries | https://www.anthropic.com/news | Official news index | No new direct product-state release in 72 hours; watch partner/news surface. |
| Anthropic at AWS Summit LA 2026 | Anthropic | 2026-06-10 scheduled | https://www.anthropic.com/events/anthropic-at-aws-summit-la-2026 | Official event page | Upcoming context engineering and enterprise-agent sessions. |
| Agents for financial services | Anthropic | 2026-05-05 | https://www.anthropic.com/news/finance-agents | Official product blog | Finance templates, connectors, subagents, long-running sessions, audit logs. |
| GitHub Copilot app | GitHub | 2026-06-02 | https://github.blog/news-insights/product-news/github-copilot-app-the-agent-native-desktop-experience/ | Official product blog | Agent-native desktop, worktrees, canvases, workflow state. |
| GitHub Copilot in VS Code May releases | GitHub | 2026-06-03 | https://github.blog/changelog/2026-06-03-github-copilot-in-visual-studio-code-may-releases/ | Official changelog | Agents window, remote sessions, AHP, session sync/history. |
| Copilot CLI refresh | GitHub | 2026-06-02, editor note 2026-06-03 | https://github.blog/changelog/2026-06-02-copilot-cli-improved-ui-rubber-duck-prompt-scheduling-and-voice-input/ | Official changelog | Rubber-duck review agent, prompt scheduling, issue/PR tabs. |
| Agentic Retrieval in Foundry Local | Microsoft | 2026-06 | https://learn.microsoft.com/en-us/azure/azure-arc/agents-tools-foundry-local/release-notes | Official docs release notes | Threads/messages/runs/SSE agent runtime API at edge. |
| Gemini app sharing through Drive | Google Workspace | 2026-05-28, rollout 2026-06-03 | https://workspaceupdates.googleblog.com/2026/04/share-chats-canvases-and-generated-media-from-the-Gemini-app-securely-via-Google-Drive.html | Official Workspace update | Shared Gemini artifacts governed by Drive policies. |
| Workspace Intelligence with admin controls | Google Workspace | 2026-04-22 | https://workspaceupdates.googleblog.com/2026/04/introducing-workspace-intelligence-with-admin-controls.html | Official Workspace update | Real-time Workspace grounding with admin source controls. |
| Google AI May roundup | Google | 2026-06-05 | https://blog.google/innovation-and-ai/technology/ai/google-ai-updates-may-2026/ | Official roundup | Gemini agentic era, proactive helpers, Search information agents. |
| Managed Agents in Gemini API | Google / DeepMind | 2026-05-19 | https://blog.google/innovation-and-ai/technology/developers-tools/managed-agents-gemini-api/ | Official developer blog | Managed sandbox agents, resumable files/state, AGENTS.md/SKILL.md. |
| Co-Scientist | Google DeepMind | 2026-05-19 | https://deepmind.google/blog/co-scientist-a-multi-agent-ai-partner-to-accelerate-research/ | Official research/product blog | Supervisor/specialist multi-agent structure and evidence grounding. |
| Step Functions AgentCore reasoning step | AWS | 2026-06-03 | https://aws.amazon.com/about-aws/whats-new/2026/06/aws-step-functions-agentcore/ | Official launch note | Agent reasoning in deterministic workflows with audit/history/session. |
| Amazon Bedrock AgentCore release notes | AWS | 2025-07 through 2026-05 | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html | Official docs | Policy, memory, evals, MCP, gateway, identity, runtime controls. |
| AgentCore Identity OBO token exchange | AWS | 2026-04-30 | https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-bedrock-agentcore/ | Official launch note | Scoped on-behalf-of identity for agent access to protected resources. |
| Rovo makes AI-native teamwork real | Atlassian | 2026-05-06 | https://www.atlassian.com/blog/company-news/rovo-team-26 | Official blog | Rovo Studio, Teamwork Graph, governed agents/automations/apps. |
| Teamwork Graph context engine | Atlassian | 2026-05-06 | https://www.atlassian.com/blog/company-news/teamwork-graph-team-26 | Official blog | Permissioned work graph, CLI/MCP, owners, decisions, freshness signals. |
| Teamwork Graph product page | Atlassian | Reviewed 2026-06-08 | https://www.atlassian.com/platform/teamwork-graph | Official product page | Data intelligence layer, connectors, agent context, access checks. |
| Asana human-agent teams OS | Asana | 2026-06-04 | https://investors.asana.com/news-releases/news-release-details/asana-unveils-operating-system-human-agent-teams | Official investor release | Agentic Work Management, same plan/context/governance. |
| Slack Feature Drop | Slack / Salesforce | 2026-05-13 | https://slack.com/blog/news/slack-feature-drop-april2026 | Official product blog | Slackbot MCP actions, event automation, memory, handoff, orchestration. |
| ServiceNow Build Agent | ServiceNow | 2026-05-06 | https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-Build-Agent-now-works-inside-every-major-AI-coding-tool-governed-by-default/default.aspx | Official press release | Governed app/agent creation, deployment approvals, AI Control Tower. |
| Cursor changelog | Cursor / Anysphere | 2026-06-03 to 2026-06-04 visible entries; current page reviewed 2026-06-08 | https://cursor.com/changelog | Official changelog | JSONL/custom stores, nested subagents, run correlation, auto-review. |
| Cognition homepage | Cognition | 2026-06-02 to 2026-06-04 article list | https://cognition.ai/ | Official company page | Devin Desktop/productivity guarantee article watchlist. |
| Cognition/Carahsoft partnership | Carahsoft and Cognition AI | 2026-06-03 | https://www.globenewswire.com/news-release/2026/06/03/3306128/0/en/Cognition-AI-and-Carahsoft-Announce-Strategic-Partnership-to-Accelerate-AI-Driven-Software-Development-Security-and-Mainframe-Modernization-for-Federal-Agencies.html | Partner press release | Regulated/public-sector Devin availability and governance posture. |

## 4. Competitive Bridge Table

| Competitor capability | Underlying mechanism | pm-substrate equivalent or gap | Directness of threat | Evidence source | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| OpenAI workspace agents with safeguards and admin visibility | Shared agents, app actions, Slack, workspace directory, admin activity/usage, action safeguards | Equivalent surface: agent proposal/actions over tools. Gap: no explicit current-state view, original observation contract, read-set validation, or review hash visible. | High | OpenAI release notes 2026-06-05 | High | Show an OpenAI workspace agent action artifact that records original observation, current as-of view, authority check, read-set validation, and pre-action disposition. |
| Codex role-specific plugins and Sites | Packaged app connectors, skills, instructions, workflow bundles, workspace-internal apps | Equivalent surface: capability registry/skills/plugins. Gap: pm-substrate should make capability boundaries typed and evidence-backed. | Medium-High | OpenAI 2026-06-02 Codex product posts | High | A Codex plugin action with write access rejects stale/unauthorized source data based on deterministic policy, not prompt instructions. |
| GitHub Copilot app control center | Isolated worktrees, My Work, agent sessions, canvases, PR/review/deployment/workflow surfaces | Equivalent surface: stateful agent work items and review surfaces. Gap: pm-substrate broader cross-tool operational-state validation. | High | GitHub 2026-06-02 blog | High | Copilot canvas exposes machine-readable read-set/currentness/authority validation before merge/deploy, not just session history. |
| VS Code agents and Agent Host Protocol | Remote sessions, session sync, session preferences, AHP state sync, Chronicle history | Equivalent surface: continuity/session state. Gap: no business-state authority/invalidation artifact shown. | Medium-High | GitHub 2026-06-03 changelog | High | AHP synchronizes not only session UI state but authoritative read dependencies and stale-state invalidation across clients. |
| AWS Step Functions AgentCore reasoning step | Agent harness inside deterministic workflow; execution history; CloudWatch turn detail; session-id context; human approval | Equivalent surface: workflow runtime plus agent step. pm-substrate gap: integration with external runtime; AWS gap: explicit operational-state validity artifact. | High | AWS 2026-06-03 launch note | High | Step Functions blocks an agent step because its declared read set is stale or source authority changed since observation. |
| AgentCore Identity OBO token exchange | Scoped-down token with user and agent identity targeted to outbound resource | Similar to delegated authority in `StateReviewArtifact` provenance. pm-substrate needs policy modes and subject/read-set binding. | Medium-High | AWS 2026-04-30 launch note | High | OBO tokens are tied to action proposal subject/read-set and fail on tenant/subject/source mismatch. |
| Atlassian Teamwork Graph CLI/MCP | Permissioned graph of work, owners, decisions, freshness signals, connected apps; read/write via CLI/MCP | Closest equivalent: entity graph + events + capability registry + COP. Gap: pm-substrate action-review artifacts and profile portability. | High | Atlassian 2026-05-06 blogs/product page | High | Teamwork Graph write through MCP requires pre-action validation against current graph authority, workflow state, and original read set. |
| Asana Agentic Work Management | Human-agent shared plan, Work Graph, Dash follow-up capture, AI Teammates, governance | Equivalent product category. Mechanism detail still limited; pm-substrate stronger on falsifiable action validity. | High | Asana 2026-06-04 release | Medium | Asana publishes technical docs showing stale plan/owner/source invalidation before AI Teammate action. |
| Google Workspace Intelligence | Permission-aware grounding over Gmail, Chat, Calendar, Drive with admin data-source controls | Equivalent input grounding. Gap: retrieval/current context is not action validity or workflow authority. | Medium | Google Workspace 2026-04-22 update | High | Workspace Intelligence blocks an action because source was current for retrieval but no longer valid for mutation. |
| Gemini Managed Agents | Managed cloud sandbox, resumable files/state, AGENTS.md/SKILL.md, enterprise preview | Equivalent agent runtime/continuity. Gap: no explicit action review or source authority. | Medium-High | Google 2026-05-19 developer blog | High | Managed agent session resumes after state changes and must revalidate old files/read sets before action. |
| Slackbot MCP actions and memory | MCP client, event-triggered automations, CRM record writes, memory, handoff, multi-agent orchestration roadmap | Equivalent front-door action source. Gap: needs state-review artifact before writes. | Medium-High | Slack 2026-05-13 feature drop | Medium | Slackbot creates/updates Salesforce only after deterministic source authority/currentness review with human approval where needed. |
| ServiceNow Build Agent governed deployment | AI-native dev, platform context, approvals, release management, audit, tests, AI Control Tower | Equivalent governance story. Gap: mostly ServiceNow platform-specific; unclear read-set/action artifact before platform writes. | High in ServiceNow enterprises | ServiceNow 2026-05-06 release | High | Build Agent rejects an app/workflow change because live instance state changed after observation, with replayable evidence. |
| Cursor JSONL/custom agent store and nested subagents | Append-only agent/run metadata, custom stores, run ids, checkpoint preservation, nested delegation, auto-review classifier | Strong reference for persisted agent-state artifacts. Gap: currentness/authority is coding-session local, not operational-state validity. | Medium-High | Cursor changelog reviewed 2026-06-08 | High | Cursor persisted run resumes after base branch/tool permissions changed and requires explicit action proposal review before edit. |
| Anthropic finance agents | Templates with skills, connectors, subagents, long-running sessions, per-tool permissions, credential vault, audit log | Equivalent domain-agent path. Gap: audit does not equal pre-action validation; connector access does not equal authority. | Medium-High | Anthropic 2026-05-05 finance agents | Medium | Claude finance agent produces a machine-readable stale/authority/action review artifact before model or CRM update. |
| Cognition/Devin regulated coding agent | Autonomous plan/code/test/ship, compound model orchestration, public-sector procurement | Equivalent coding productivity threat. Gap: little visible operational-state mechanism. | Medium | Cognition/Carahsoft 2026-06-03 release | Medium | Devin publishes evidence that it validates source-of-truth/currentness/workflow preconditions before external system mutations. |

## 5. Claim Ledger

| Claim | Status | Evidence and correction |
| --- | --- | --- |
| Major AI vendors are still only shipping chat/RAG/memory. | Contradicted | OpenAI, GitHub, AWS, Atlassian, Asana, Slack, ServiceNow, Google, and Cursor all show agent-control, workflow, graph, governance, or session-state surfaces. |
| RAG/memory/session persistence equals operational state. | Downgraded | Google Workspace Intelligence, Gemini managed sessions, Slackbot memory, Cursor stores, and GitHub session sync improve context/continuity but do not prove currentness, authority, workflow validity, or action validation. |
| OpenAI is now directly competing for workspace agent orchestration. | Confirmed | June 5, 2026 release notes show workspace agents GA with safeguards/admin visibility; June 2 Codex posts expand workflow/tool plugins. |
| GitHub is building a stateful agent work surface, not just code autocomplete. | Confirmed | Copilot app, VS Code Agents window, session sync, remote sessions, AHP, worktrees, and canvases are explicit. |
| AWS is a serious governed-agent runtime/workflow competitor. | Confirmed | Step Functions + AgentCore combines deterministic workflow, agent reasoning, CloudWatch audit, session context, and human approvals. |
| Atlassian Teamwork Graph is the closest reviewed enterprise work-state analog. | Confirmed with caveat | It exposes work graph, owners/decisions/freshness/permissions/CLI/MCP/action. Caveat: no explicit original-observation/read-set/action-review artifact found. |
| Asana's "operating system for human-agent teams" proves a full operational-state layer. | Still speculative | Official source has strong category language and Work Graph references, but limited mechanism detail. |
| ServiceNow governance solves pm-substrate's action validity problem. | Revised / partial | ServiceNow has approvals, audit, lifecycle governance, tests, and platform context. This is governance, but not necessarily explicit current-state/read-set review. |
| Cursor's JSONL agent store is a direct implementation lesson for pm-substrate artifacts. | Confirmed as implementation inspiration | Append-only, diffable, custom-store state is directly useful for persisted `StateReviewArtifact` design. It is not sufficient by itself for operational authority. |
| No major company is trying to solve currentness, authority, provenance, workflow validity, and action validation together. | Revised | AWS, Atlassian, ServiceNow, and OpenAI touch several dimensions. None reviewed exposes the whole pm-substrate stack in one falsifiable mechanism. |

## 6. pm-substrate Implications

1. **Persisted artifacts moved from nice-to-have to urgent.**
   - Cursor's JSONL/custom-store release and AWS/GitHub audit/session surfaces make durable agent evidence table stakes.
   - Implement ArrowHedge JSON/JSONL `StateReviewArtifact` export/import before broadening research claims.

2. **Position against "agent control plane" directly.**
   - The category is no longer hypothetical. OpenAI, GitHub, AWS, Atlassian, Asana, ServiceNow, Google, and Slack are all telling buyers that agents need a place to run, share state, and act.
   - pm-substrate's narrower line: "a governed operational-state layer before valid action" is still differentiated, but only if artifacts/evals make it visible.

3. **Adopt a competitor-inspired artifact store design.**
   - Use append-only JSONL for review artifacts first.
   - Support deterministic canonical hash verification.
   - Add optional store abstraction later: file, Postgres, S3/object store.

4. **Do not compete on generic workspace context.**
   - Atlassian, Google, Slack, Microsoft, and OpenAI have much stronger distribution and data access.
   - Compete on validity semantics: source authority, original observation, read-set binding, stale-state invalidation, workflow position, and action proposal review.

5. **Make Slack/Jira/GitHub/Salesforce action-review fixtures concrete.**
   - The market is moving through Slack, GitHub, Jira, ServiceNow, Asana, and Salesforce.
   - Even if pm-substrate is local-lab first, eval scenarios should mimic these surfaces.

6. **Track AWS as infrastructure complement and competitor.**
   - AgentCore + Step Functions could host pm-substrate-style action-review steps.
   - It also competes as the enterprise governance layer if it adds state validation and policy modes.

7. **Strengthen product language around "review before mutation."**
   - Vendor sources talk about audit, governance, safeguards, and approval.
   - pm-substrate should translate its proof boundary into buyer-visible language: "every agent action comes with a replayable state review."

## 7. First-Market Risk Assessment

**Is any major company clearly trying to solve the same operational-state problem?**

Partially, yes. Atlassian, AWS, OpenAI, GitHub, Asana, ServiceNow, Google, and Slack are all moving into adjacent territory:

- Atlassian is closest on work-state graph and source/owner/decision context.
- AWS is closest on governed runtime plus workflow execution and audit.
- OpenAI is closest on shared workspace agents and action safeguards.
- GitHub is closest on coding-agent work state and review surfaces.
- Asana is closest on product/category framing for human-agent work management.
- ServiceNow is closest on governed enterprise app/agent lifecycle.
- Google is closest on Workspace data grounding and managed-agent infrastructure.
- Slack/Salesforce is closest on conversational action surfaces and MCP-triggered cross-app action.

**Are they solving only memory/RAG/context, or also currentness, authority, provenance, workflow validity, and action validation?**

They are solving more than memory/RAG, but still not the full pm-substrate proof boundary in the sources reviewed.

- Currentness: partially visible in Atlassian freshness signals, Workspace real-time grounding, GitHub base branch refresh, AWS workflow execution state, ServiceNow live instance context.
- Authority: partially visible in permissions, admin controls, OBO tokens, Drive/Workspace/Atlassian permissions, ServiceNow governance.
- Provenance/audit: visible in AWS CloudWatch/execution history, GitHub worktrees/canvases/history, Anthropic audit logs, ServiceNow audit trails, Cursor request ids/JSONL stores.
- Workflow validity: visible in AWS Step Functions, Asana plans, Atlassian automations, ServiceNow lifecycle controls, OpenAI/Slack workflows.
- Action validation: visible as safeguards, approval, auto-review, tests, and governance, but not as a vendor-documented equivalent to original observation contract + read-set validation + current-state review + review artifact.

**Does this change urgency, differentiation, or roadmap priority?**

Yes.

- Urgency increases. The market has moved into agent control planes and work-state graphs. Waiting to serialize and show review artifacts risks making pm-substrate look like research prose rather than an executable differentiator.
- Differentiation narrows but sharpens. The defensible wedge is not "agents need context." The wedge is "agents need governed, replayable, policy-checkable operational-state review before valid action."
- Roadmap priority changes: persisted state-review artifacts, artifact-derived evals, targeted policy modes, and cross-tool action-review fixtures should come before broad new research streams or generic UX.

## 8. Testing/Eval Implications

New competitor-inspired scenarios:

| Scenario | Competitor inspiration | Expected pm-substrate assertion |
| --- | --- | --- |
| Slack-to-CRM stale source write | Slackbot MCP actions; OpenAI workspace agents in Slack | Agent proposes CRM write from Slack context; review must fail or warn if the authoritative CRM/account source changed after observation. |
| Step Functions stale session reuse | AWS Step Functions + AgentCore session id | Agent resumes a session across workflow executions; review must revalidate read set and workflow position before next action. |
| GitHub/Cursor base branch drift | GitHub base branch refresh; Cursor JSONL stores | Agent resumes coding run after `main` changed; review must record base ref, changed files, and stale read dependencies before edit/PR. |
| Atlassian graph owner rewrite | Teamwork Graph CLI/MCP writes | External agent tries to update owner/decision relationship; review must validate source authority, permissions, and object role binding. |
| Asana shared-plan next action | Asana Agentic Work Management | AI teammate proposes next action from stale goal/priority; review must validate current goal owner, blocker, and workflow stage. |
| ServiceNow generated app deploy | ServiceNow Build Agent governance | AI-generated workflow deploys only after live instance state, app scope, policy, and approval state match the proposal. |
| Google Workspace shared artifact reuse | Gemini app Drive sharing and Workspace Intelligence | Agent uses shared conversation/canvas snapshot; review must treat it as derived evidence, not authoritative current state, unless source refs validate. |
| Anthropic finance agent nightly task | Claude finance agents | Long-running finance agent updates model or memo; review must validate filings/data-feed authority and freshness window. |

New metrics or buckets:

- `competitor_overlap_surface_count`
- `state_review_artifact_persisted_count`
- `agent_session_resume_revalidation_rate`
- `stale_session_reuse_rejection_rate`
- `external_mcp_action_review_rate`
- `graph_write_authority_mismatch_detection_rate`
- `shared_artifact_revalidation_rate`
- `human_approval_after_state_warning_rate`
- `vendor_claim_falsification_coverage`

Policy/eval assertions to add:

- A shared conversation, canvas, chat, or session transcript is never a binding source unless linked to current source refs.
- A resumed agent session must revalidate `validUntil`, `projectionVersion`, `workflowPosition`, subject, and authority before action.
- A graph/work-management write must name the authority source and object role.
- Human approval should be recorded as policy evidence, not as a substitute for source currentness.
- Agent/store persistence must preserve original observation, current evaluation, warnings, execution disposition, and canonical hash.

## 9. Open Questions For Next Run

1. OpenAI: inspect developer docs for workspace agent action safeguards, app actions, plugin sharing, and Codex Goal Mode to see whether action-level audit artifacts exist.
2. AWS: inspect AgentCore Policy, Memory, Evaluations, Gateway, and Step Functions documentation for any explicit read-set/write-set or stale-state validation.
3. Atlassian: inspect Teamwork Graph CLI and Rovo MCP docs for freshness, write authority, permission enforcement, and audit schema.
4. Asana: find technical docs for Agentic Work Management, Work Graph, AI Teammates, Dash, and governance.
5. Cursor: inspect SDK docs for `LocalAgentStore`, JSONL schema, run/request ids, checkpoints, and auto-review policy shape.
6. ServiceNow: inspect Build Agent/AEMC/AI Control Tower docs for deployment approval, tests, policy evidence, and generated app provenance.
7. Google: inspect Gemini Enterprise Agent Platform and Interactions API docs for session state, environment persistence, and action controls.
8. Anthropic: after the June 10 AWS Summit LA session, check whether "structured memory" and "sub-agent architectures" expose durable state or only context engineering practices.
9. Slack/Salesforce: verify actual GA status for Slackbot MCP actions, memory, event automations, embedded handoff, and Agentforce orchestration.
10. Cognition: open the June 2 "Windsurf is now Devin Desktop" and June 4 productivity guarantee posts for actual agent-state mechanisms if accessible.

## 10. Recommended Next Action

Implement the persisted ArrowHedge state-review artifact path now, borrowing the simplest useful competitor lessons:

1. JSONL append-only artifact corpus for generated `StateReviewArtifact` objects.
2. Canonical hash replay and import/export fidelity tests.
3. Fixture metadata for competitor-inspired surfaces: `slack_mcp_action`, `github_agent_session`, `aws_step_function_agent_step`, `atlassian_graph_write`, `asana_work_graph_action`, `servicenow_deploy`.
4. Temporal phase metadata from Arrowsmith v05.
5. Artifact-derived metrics rather than scenario-label metrics.

The strategic line for the next public claim should be:

> "Workspace AI vendors are building agent control planes. pm-substrate is the governed state-review layer that tells those agents whether their next action is still valid."

# v04 AI Competitive Intelligence - 2026-06-10

Date: 2026-06-10 UTC
Local run target: 2026-06-10 America/Chicago
Status: fourth numbered daily competitive-intelligence continuation
Prior version: `research/daily-ai-competitive-intelligence/v03-ai-competitive-intelligence-2026-06-09.md`
Paired agent-state baseline: `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md`

Repository sync and worktree note:

- Ran `git fetch origin main`, checked out `main`, and fast-forwarded from `d2cece8` to `7cc0a33` before reading or writing research.
- Upstream added `v03-ai-competitive-intelligence-2026-06-09.md`, `v06-agent-state-arrowsmith-2026-06-09.md`, `@pm/agent-state` artifact lifecycle primitives, ArrowHedge temporal fixtures, observed read-set comparison, DB/fixture equivalence, and invariant policy metrics.
- Git printed repeated `non-monotonic index` warnings for an AppleDouble-looking `.git/objects/pack/._pack-...idx` file, but fetch, fast-forward, status, and log inspection succeeded. No merge conflict was present before this write.

Required local context read:

1. `/Users/admin/.codex/automations/daily-ai-competitive-intelligence/memory.md`
2. `research/index.md`
3. `research/daily-ai-competitive-intelligence/index.md`
4. `research/daily-ai-competitive-intelligence/v03-ai-competitive-intelligence-2026-06-09.md`
5. `research/daily-arrowsmith-agent-state/index.md`
6. `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md`
7. `Changelog.md`
8. Implementation surfaces: `packages/agent-state/src/index.ts`, `packages/evals/src/metrics.ts`, `packages/capability-finance-research-ingest/src/arrowhedge.ts`, and focused tests around `StateReviewArtifact`, observed read sets, ArrowHedge corpus equivalence, temporal phases, and invariant policy.

Current pm-substrate comparison baseline:

> pm-substrate is the governed operational-state layer between statistical prediction and valid action. After the June 9 upstream changes, the local proof boundary is no longer "can we produce a durable review artifact?" It is: can foreign evidence from model providers, coding platforms, runtime traces, memories, policy systems, work graphs, and approvals be admitted into a replayable `StateReviewArtifact` without confusing that evidence with source authority?

## 1. Delta From Prior Version

v04 confirms v03's separation of evidence lanes and adds three sharper deltas.

1. **GitHub moved security validation from background platform behavior into an explicit agent command.** On 2026-06-10, GitHub announced a dedicated `/security-review` command in Copilot CLI public preview. This builds directly on the 2026-06-09 third-party coding-agent validation release. The mechanism is now user- or workflow-invoked pre-review evidence, not only automatic background checks.
2. **Google and AWS are publishing more explicit operational scaffolding for long-running agents.** Google's ADK long-running-agent guidance uses a state-machine pattern for human approval and returns control to the agent after approval. AWS AgentCore release notes now read like a managed agent substrate: registry, OBO identity, memory metadata, identity-authorizer improvements, trace search, replay, hook telemetry, file systems, batch evaluation, and harness behavior.
3. **Workspace platforms are exposing currentness and approval drift as concrete product mechanics.** Google Workspace's Drive alignment approval update allows changes to files while preserving approvals. That is useful workflow UX, but for pm-substrate it is a direct falsification fixture: "approved" does not necessarily mean "approved for this exact current content."

Corrected or sharpened claims from v03:

- "Security validation evidence" is now both a background GitHub platform check and an explicit Copilot CLI command path. It still does not prove original-observation, read-set, authority, or workflow validity.
- "Runtime/eval evidence" is too broad. AWS AgentCore now needs to be split into registry evidence, identity/OBO evidence, memory evidence, trace/replay evidence, eval evidence, and runtime filesystem/shell evidence.
- "Client-surface origin tracking" should include not only Xcode/Gemini and Codex/Copilot, but also Copilot CLI, Cursor SDK custom stores, Cursor auto-review, and nested subagents.
- "Approval state" is not automatically authoritative. Workspace approval features can preserve approval labels across content changes and must be reviewed against content hash, revision, and approval scope.

No source reviewed on 2026-06-10 exposed a portable equivalent to:

`CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + observed-read-set comparison + ActionProposalReview + replayable StateReviewArtifact + invariant policy disposition`.

## 2. Company-by-Company Watch

### OpenAI

- **Surface searched:** OpenAI blog/news, ChatGPT Enterprise/Edu release notes, API/Agents platform pages, Codex/agent builder related pages.
- **New or newly relevant sources:**
  - [Update to Agent Builder and Evals in the OpenAI Platform](https://help.openai.com/en/articles/12222679-update-to-agent-builder-and-evals-in-the-openai-platform), updated 2026-06-03.
  - [ChatGPT Enterprise and Edu release notes](https://help.openai.com/en/articles/10128477-chatgpt-enterprise-edu-release-notes), current page reviewed 2026-06-10; the retrieved top entry appears above the 2026-05-22 section and describes app templates for building apps connected to GitHub Enterprise, Snowflake, Databricks, and other tools.
  - [OpenAI Agents overview](https://platform.openai.com/docs/agents), reviewed 2026-06-10.
  - [Nextdoor Codex customer story](https://openai.com/index/nextdoor/), 2026-06-09, carried from v03.
- **Capability summary:** OpenAI is winding down the standalone Platform Agent Builder and Evals product by 2026-11-30 while steering builders toward the Agents SDK, platform docs, and ChatGPT Workspace Agents. Enterprise release notes keep moving app/tool distribution toward GitHub Enterprise, Snowflake, Databricks, and internal workflows.
- **Mechanism extracted:** OpenAI is consolidating around SDK/tool orchestration and ChatGPT enterprise app surfaces rather than maintaining the earlier hosted Agent Builder/Evals product. This is a distribution and developer-platform move, not a public operational-state artifact.
- **Overlap with pm-substrate:** High on tool/app distribution and agent client surfaces; Medium on eval/governance now that OpenAI is deprecating one hosted eval/builder path; Low on explicit source-authority/read-set proof.
- **Threat level:** High distribution/control-plane threat, unchanged.
- **Confidence:** Medium-high. The wind-down date is explicit; the undated top release-note item is treated as current-page evidence, not a precisely dated release.
- **Why it matters:** pm-substrate should not position against "agent builders" generically. OpenAI appears to be pushing agent construction into SDKs and enterprise workspaces, so the sharper differentiator is evidence admission and current-state review around whatever tool/app surface originates the action.

### Anthropic

- **Surface searched:** Anthropic news, Claude app release notes, API docs/model docs, Claude Code docs/changelog, MCP/tool-use references.
- **New or newly relevant sources:**
  - [Claude app release notes](https://support.claude.com/en/articles/12138966-release-notes), 2026-06-09 latest item reviewed 2026-06-10.
  - [Claude Fable 5 and Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5), 2026-06-09, carried from v03.
  - [Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview), 2026-06-09 availability carried from v03.
- **Capability summary:** No new 2026-06-10 Anthropic operational-state release was found. The live delta remains the Fable/Mythos model launch and Copilot/provider-policy evidence from v03.
- **Mechanism extracted:** Model/provider availability across Anthropic API, AWS Bedrock, Google Vertex AI, and Microsoft Foundry means the same agent workflow can cross policy surfaces. In GitHub Copilot, Claude Fable 5 requires explicit enterprise/admin enablement because of data retention for Anthropic safety classifiers.
- **Overlap with pm-substrate:** Medium on autonomy/coding capability; High as provider-policy evidence for action review.
- **Threat level:** Medium-high.
- **Confidence:** High for model launch/provider availability; Medium for downstream operational-state implications.
- **Why it matters:** Anthropic is a model/provider and tool-use competitor, but the immediate substrate implication is evidence fields for model provider, deployment surface, data retention, admin policy, and allowed data class.

### Microsoft and GitHub

- **Surface searched:** GitHub changelog/blog, Copilot docs and release notes, Microsoft 365 Copilot release notes, Copilot Studio docs/release plans, Semantic Kernel and Azure AI Foundry surfaces.
- **New or newly relevant sources:**
  - [Dedicated security review command now available in Copilot CLI](https://github.blog/changelog/2026-06-10-dedicated-security-review-command-now-available-in-copilot-cli/), 2026-06-10.
  - [Security validation for third-party coding agents](https://github.blog/changelog/2026-06-09-security-validation-for-third-party-coding-agents/), 2026-06-09.
  - [Claude Fable 5 is generally available for GitHub Copilot](https://github.blog/changelog/2026-06-09-claude-fable-5-is-generally-available-for-github-copilot/), 2026-06-09.
  - [Agent mode and tools availability for VS Code Stable](https://github.blog/changelog/2026-06-05-agent-mode-and-tools-availability-for-vs-code-stable/), 2026-06-05.
  - [Microsoft 365 Copilot release notes](https://learn.microsoft.com/en-us/microsoft-365-copilot/release-notes), 2026-06-02 current entry reviewed 2026-06-10.
  - [Microsoft Copilot Studio 2025 release wave 2 plan](https://learn.microsoft.com/en-us/dynamics365/release-plan/2025wave2/microsoft-copilot-studio/), published 2026-06-02.
- **Capability summary:** GitHub added an explicit Copilot CLI `/security-review` command that performs an AI-assisted review before opening a pull request or after changes. This sits on top of GitHub's general availability release for third-party coding-agent security validation. Microsoft 365 Copilot release notes add Work IQ in model-driven apps plus connectors including Aha, Asana, GitLab, Reddit, Stack Overflow, and ServiceNow. Copilot Studio's release plan includes multi-turn conversation evaluation, threat protection, a unified view, MCP-compliant tools, and invoking agents as workflow steps.
- **Mechanism extracted:** Microsoft/GitHub are converging on a governed developer-agent pipeline:
  - client origin: VS Code agent mode, Copilot CLI, Copilot Chat, Copilot extensions;
  - model/provider policy: Fable 5 admin enablement and retention implications;
  - validation: CodeQL, advisory, secret scanning, and explicit CLI review;
  - enterprise context: Work IQ and Graph connectors;
  - workflow embedding: Copilot Studio agent invocation as workflow steps.
- **Overlap with pm-substrate:** High on validation evidence, provider policy, connector/work graph state, and workflow-agent boundaries. Still missing portable source-authority, original-observation/read-set, and replayable action-review proof.
- **Threat level:** High.
- **Confidence:** High.
- **Why it matters:** GitHub is the clearest evidence that platform-owned validation around agent output is becoming normal. pm-substrate should admit those validation results as evidence while still proving the action was based on current, authorized state.

### Google, Gemini, DeepMind, Google Cloud, and Workspace

- **Surface searched:** Google Cloud AI blogs, Workspace Updates, Google AI/DeepMind model pages, Gemini developer updates, ADK docs.
- **New or newly relevant sources:**
  - [What's new with Google Cloud AI: June 2026](https://cloud.google.com/blog/products/ai-machine-learning/what-google-cloud-announced-in-ai-this-month), reviewed 2026-06-10; post covers monthly AI announcements.
  - [Human-in-the-Loop, Long-Running Agents with ADK](https://cloud.google.com/blog/topics/developers-practitioners/human-in-the-loop-long-running-agents-with-adk), 2026-05-12, foundational mechanism reviewed on 2026-06-10.
  - [Method: dlpPolicies.create](https://developers.google.com/workspace/drive/labels/reference/rest/v2/dlpPolicies/create) and [Method: dlpPolicies.update](https://developers.google.com/workspace/drive/labels/reference/rest/v2/dlpPolicies/update), current Workspace Drive Labels API docs reviewed 2026-06-10.
  - [Use Alignment Approvals for changes to files with pending and approved Drive Approvals](https://workspaceupdates.googleblog.com/2026/06/use-alignment-approvals-for-changes-to-files-with-pending-and-approved-drive-approvals.html), 2026-06-08.
  - [Bringing Gemini models to Apple developers](https://blog.google/innovation-and-ai/technology/developers-tools/bringing-gemini-models-to-apple-developers/), published 2026-06-08 and updated 2026-06-09, carried from v03.
- **Capability summary:** Google Cloud continues to present an integrated AI-agent platform across Vertex AI Agent Engine, Agent Designer, ADK, Agentspace, Gemini Enterprise, Colab Enterprise, and developer surfaces. The ADK long-running-agent post is the clearest mechanism: the agent begins work, reaches a human approval step, enters a wait state, receives the approval event, and resumes. Workspace adds DLP policy create/update methods and Drive alignment approvals that preserve approvals across file changes.
- **Mechanism extracted:** Google is exposing:
  - long-running agent state machines with pause/resume and human approval;
  - enterprise policy mutation APIs for DLP;
  - client-surface expansion into Apple/Xcode;
  - approval-currentness semantics where approval labels can survive document changes.
- **Overlap with pm-substrate:** High on workflow state, policy mutation, human approval, and client-surface origin; Medium-high on enterprise context; still not a public artifact-level proof of read-set validation or source-authority review.
- **Threat level:** Medium-high, with a High watch flag for approval-currentness and DLP-policy mutation fixtures.
- **Confidence:** High for Workspace/ADK docs; Medium-high for the broad Google Cloud platform-post synthesis.
- **Why it matters:** Google is close to the workflow side of the pm-substrate problem. The strongest pm-substrate counterposition is that pause/resume and approvals are not enough unless the content, policy, and source state are revalidated at the moment of action.

### AWS

- **Surface searched:** Bedrock AgentCore docs, AgentCore release notes, AWS AI/ML blog, AWS agent operations posts.
- **New or newly relevant sources:**
  - [Amazon Bedrock AgentCore release notes](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html), current docs reviewed 2026-06-10.
  - [AgentOps: From prototype to production - AWS AI Agent Marketplace, adoption, and evaluations](https://aws.amazon.com/blogs/machine-learning/agentops-from-prototype-to-production-aws-ai-agent-marketplace-adoption-and-evaluations/), 2026-06-01, reviewed as foundational mechanism on 2026-06-10.
- **Capability summary:** AgentCore release notes now cover AgentCore Registry, updated Gateway semantics, actor ID support for memory strategies, memory metadata injection, OBO identity, Cognito IDP support, improved authorizer validation, trace search/replay, hook telemetry, batch evaluation, user simulation, GovCloud, runtime file systems, interactive shells, payments, and custom headers.
- **Mechanism extracted:** AWS is building a managed agent substrate with distinct lanes for registry, gateway, memory, identity, policy, observability, eval, and runtime state. The AgentOps post adds adoption and evaluation framing around agent marketplaces and production monitoring.
- **Overlap with pm-substrate:** High on runtime/eval/governance infrastructure; Medium on memory/state and policy; no public proof that AgentCore evaluates original observation, observed read sets, source authority, and workflow validity before business mutation.
- **Threat level:** High.
- **Confidence:** Medium-high. Release-note page is official but current-page style requires careful date attribution per item.
- **Why it matters:** AWS is the closest infrastructure-level competitor for "agent operations." pm-substrate should avoid claiming runtime hosting as the differentiator. The differentiator is admission of evidence into governed operational-state review before valid action.

### ServiceNow

- **Surface searched:** ServiceNow newsroom/blog/product pages for AI Control Tower, Context Engine, Action Fabric, AI Agent Fabric, Workflow Data Fabric.
- **New or newly relevant sources:**
  - [ServiceNow opens its full system of action to every AI Agent in the enterprise](https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-opens-its-full-system-of-action-to-every-AI-Agent-in-the-enterprise/default.aspx), 2026-05-06, carried as active comparator.
  - [ServiceNow AI Control Tower](https://www.servicenow.com/products/ai-control-tower.html), product page reviewed 2026-06-10.
  - [ServiceNow Context Engine](https://www.servicenow.com/products/context-engine.html), product page reviewed 2026-06-10.
- **Capability summary:** No new June 10 ServiceNow operational-state source was found. ServiceNow remains the strongest direct enterprise-action comparator because it explicitly combines system-of-action access, AI Control Tower governance, Context Engine, identity/permissions, and MCP-style agent access.
- **Mechanism extracted:** ServiceNow's public mechanism is a governed enterprise action fabric, not an inspectable portable state-review artifact.
- **Overlap with pm-substrate:** High on enterprise action, governance, authority, and workflow context; unknown on original-observation review, observed read sets, replay hash, and portable artifact export.
- **Threat level:** High, unchanged.
- **Confidence:** Medium-high for overlap; Medium for artifact-level absence because public product pages may omit implementation details.
- **Why it matters:** ServiceNow is still the best falsification target for pm-substrate positioning. The falsifier remains public or customer-visible artifacts that prove currentness, authority, workflow validity, and pre-action review before arbitrary agent actions.

### Atlassian

- **Surface searched:** Atlassian blog/product pages for Teamwork Graph, Rovo, Strategy Collection, AI work, MCP/tool surfaces.
- **New or newly relevant sources:**
  - [We rebuilt Atlassian support by uniting AI with service teams. Here's what we learned](https://www.atlassian.com/blog/announcements/we-rebuilt-atlassian-support), page reviewed 2026-06-10; exact publication date was not visible in retrieved text.
  - [Atlassian Rovo](https://www.atlassian.com/software/rovo), product page reviewed 2026-06-10.
- **Capability summary:** Atlassian is pushing Teamwork Graph-backed agents, structured content, AI-supported documentation/code review, self-healing documentation, code health, Rovo orchestration, and Atlassian Design System MCP access.
- **Mechanism extracted:** Atlassian's graph is a shared work context with relationship and activity data. Rovo/agents can act over this context, and internal support workflows use agent-assisted structured content and evaluation.
- **Overlap with pm-substrate:** High on work graph and workspace state; Medium on eval/quality loops; still unclear on deterministic source authority and pre-action review artifacts.
- **Threat level:** Medium-high.
- **Confidence:** Medium because the strongest recent page did not expose a precise publication date in the fetched content.
- **Why it matters:** Atlassian owns a large work graph. pm-substrate should compare against graph writes and action validity, not just whether a graph exists.

### Asana

- **Surface searched:** Asana blog/resources/product pages for Agentic Work Management, AI Teammates, MCP, AI Connectors, workflow automation.
- **New or newly relevant sources:**
  - [How one researcher cut through 250+ AI work management vendor pitches](https://asana.com/resources/ai-work-management-vendor-analysis), 2026-06-09.
  - [Asana AI Teammates](https://asana.com/product/ai-teammates), product page reviewed 2026-06-10.
  - [Asana MCP](https://asana.com/product/mcp), product page reviewed 2026-06-10.
  - [Asana AI Connectors](https://asana.com/product/ai-connectors), product page reviewed 2026-06-10.
- **Capability summary:** Asana continues to frame Agentic Work Management as the coordination layer for AI teammates, workflow automation, work graphs, MCP access, and cross-tool connectors.
- **Mechanism extracted:** Asana's advantage is work-graph authority and user/workflow context. Its product language emphasizes pre-authorized AI teammates, connector-backed context, and coordinated work execution.
- **Overlap with pm-substrate:** Medium-high on PM/work coordination and agentic work management; unclear on replayable pre-action proof.
- **Threat level:** Medium-high.
- **Confidence:** Medium-high for category direction; Medium for mechanism detail.
- **Why it matters:** Asana is a first-market risk for product language around "AI work management." pm-substrate should keep positioning anchored in governed operational-state artifacts rather than generic work-management automation.

### Salesforce and Slack

- **Surface searched:** Salesforce/Slack blogs and release pages for Agentforce, Slackbot, MCP, CRM action surfaces, governance.
- **New or newly relevant sources:** No material June 10 source was found in this run beyond v02/v03 carry-forward watch items.
- **Capability summary:** Carry-forward posture remains: Salesforce/Slack are important because CRM and Slack are high-consequence action surfaces where MCP/actions can mutate customer and internal work state.
- **Mechanism extracted:** Agentforce/Slack action surfaces create tool/action paths; public evidence reviewed so far does not expose pm-substrate-equivalent state-review artifacts.
- **Overlap with pm-substrate:** High by action surface; Medium by public mechanism evidence.
- **Threat level:** Medium-high.
- **Confidence:** Medium.
- **Why it matters:** Slack/CRM writes should remain a fixture target for external evidence admission and action validation.

### Cursor / Anysphere

- **Surface searched:** Cursor changelog/docs, Cursor SDK, auto-review, agent stores, subagents, bugbot/PR review.
- **New or newly relevant sources:**
  - [Cursor changelog](https://cursor.com/changelog), official changelog reviewed 2026-06-10; recent entries include "Agent custom stores", "auto review on background agent", "custom tools in Cursor SDK", "nested sub-agents", and Background Agents updates.
  - [Cursor SDK](https://docs.cursor.com/en/sdk), docs reviewed 2026-06-10.
  - [Bugbot / Review PRs](https://docs.cursor.com/en/bugbot/review-prs), docs reviewed 2026-06-10.
- **Capability summary:** Cursor is moving from IDE agent to programmable agent platform: SDK custom tools, custom stores, auto-review, background agents, nested subagents, and PR review.
- **Mechanism extracted:** Cursor custom stores and custom tools are the freshest mechanism overlap. They imply pluggable persistence and tool authority inside coding-agent sessions. Auto-review and PR review add external validation evidence.
- **Overlap with pm-substrate:** High for coding-agent session state, custom store evidence, custom tool evidence, nested agent provenance, and review evidence; low on enterprise workflow authority outside code unless integrated.
- **Threat level:** High in coding-agent state; Medium-high overall.
- **Confidence:** Medium-high.
- **Why it matters:** Cursor is the strongest near-term coding-agent session-state comparator after GitHub. pm-substrate should model custom store entries as external evidence requiring admission, not as direct authority.

### Cognition, Replit, Sourcegraph, Windsurf/Codeium, JetBrains

- **Surface searched:** official blogs/changelogs for coding-agent releases, enterprise state, review, memory, and workspace surfaces.
- **New or newly relevant sources:**
  - [Cognition blog](https://cognition.ai/blog), latest official posts reviewed 2026-06-10.
  - [Replit blog](https://blog.replit.com/), reviewed 2026-06-10.
  - [Sourcegraph blog](https://sourcegraph.com/blog), reviewed 2026-06-10.
- **Capability summary:** No new primary June 10 source found that changes the v02/v03 posture. These vendors remain important coding-agent and productivity-tool competitors, especially where they expose review, persistent session, repository context, or deployment action paths.
- **Mechanism extracted:** Carry-forward mechanisms are coding-agent autonomy, long-running tasks, repository context, PR/deployment workflows, and tool execution. Public evidence reviewed in this run did not prove operational-state review artifacts.
- **Overlap with pm-substrate:** Medium to Medium-high by surface.
- **Threat level:** Medium-high for coding agents, unchanged.
- **Confidence:** Medium.
- **Why it matters:** Keep these on the watchlist, but prioritize GitHub/Cursor/AWS/Google/ServiceNow where public mechanism evidence is currently stronger.

## 3. New Sources Reviewed

| Title | Company / authors | Date | Link | Source type | Relevance |
| --- | --- | --- | --- | --- | --- |
| Dedicated security review command now available in Copilot CLI | GitHub | 2026-06-10 | https://github.blog/changelog/2026-06-10-dedicated-security-review-command-now-available-in-copilot-cli/ | Official changelog | Turns security validation into an explicit CLI command path. |
| Security validation for third-party coding agents | GitHub | 2026-06-09 | https://github.blog/changelog/2026-06-09-security-validation-for-third-party-coding-agents/ | Official changelog | Carry-forward external validation evidence for Claude/Codex-generated code. |
| Agent mode and tools availability for VS Code Stable | GitHub | 2026-06-05 | https://github.blog/changelog/2026-06-05-agent-mode-and-tools-availability-for-vs-code-stable/ | Official changelog | Client/tool origin surface for coding-agent actions. |
| Claude Fable 5 is generally available for GitHub Copilot | GitHub | 2026-06-09 | https://github.blog/changelog/2026-06-09-claude-fable-5-is-generally-available-for-github-copilot/ | Official changelog | Provider/model policy and data-retention evidence. |
| Update to Agent Builder and Evals in the OpenAI Platform | OpenAI Help | Updated 2026-06-03 | https://help.openai.com/en/articles/12222679-update-to-agent-builder-and-evals-in-the-openai-platform | Official help page | OpenAI winds down standalone Agent Builder/Evals and redirects toward SDK/platform paths. |
| ChatGPT Enterprise and Edu release notes | OpenAI Help | Reviewed 2026-06-10 | https://help.openai.com/en/articles/10128477-chatgpt-enterprise-edu-release-notes | Official release notes | Current enterprise app/tool distribution evidence; top item date not visible in retrieved text. |
| OpenAI Agents overview | OpenAI Platform | Reviewed 2026-06-10 | https://platform.openai.com/docs/agents | Official docs | Carry-forward SDK/tool orchestration comparator. |
| Claude app release notes | Anthropic | 2026-06-09 latest item | https://support.claude.com/en/articles/12138966-release-notes | Official release notes | Confirms Fable/Mythos live posture. |
| Microsoft 365 Copilot release notes | Microsoft | 2026-06-02 current item | https://learn.microsoft.com/en-us/microsoft-365-copilot/release-notes | Official release notes | Work IQ and connector expansion. |
| Microsoft Copilot Studio 2025 wave 2 plan | Microsoft | Published 2026-06-02 | https://learn.microsoft.com/en-us/dynamics365/release-plan/2025wave2/microsoft-copilot-studio/ | Official release plan | Evals, threat protection, MCP tools, workflow-step agent invocation. |
| What's new with Google Cloud AI: June 2026 | Google Cloud | Reviewed 2026-06-10 | https://cloud.google.com/blog/products/ai-machine-learning/what-google-cloud-announced-in-ai-this-month | Official blog | Broad Google agent platform and AI infra rollup. |
| Human-in-the-Loop, Long-Running Agents with ADK | Google Cloud | 2026-05-12 | https://cloud.google.com/blog/topics/developers-practitioners/human-in-the-loop-long-running-agents-with-adk | Official blog | Explicit state-machine pause/resume and approval mechanism. |
| Workspace Drive Labels DLP policy create/update methods | Google Workspace | Reviewed 2026-06-10 | https://developers.google.com/workspace/drive/labels/reference/rest/v2/dlpPolicies/create | Official API docs | Programmatic enterprise policy mutation evidence. |
| Alignment approvals for changed Drive files | Google Workspace | 2026-06-08 | https://workspaceupdates.googleblog.com/2026/06/use-alignment-approvals-for-changes-to-files-with-pending-and-approved-drive-approvals.html | Official Workspace update | Approval-currentness drift fixture: approvals can persist while content changes. |
| Amazon Bedrock AgentCore release notes | AWS | Reviewed 2026-06-10 | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html | Official docs | Registry, OBO identity, memory metadata, trace search/replay, eval, runtime state. |
| AgentOps: From prototype to production | AWS | 2026-06-01 | https://aws.amazon.com/blogs/machine-learning/agentops-from-prototype-to-production-aws-ai-agent-marketplace-adoption-and-evaluations/ | Official blog | Production agent operations and evaluation comparator. |
| ServiceNow opens its full system of action to every AI Agent | ServiceNow | 2026-05-06 | https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-opens-its-full-system-of-action-to-every-AI-Agent-in-the-enterprise/default.aspx | Official press release | Strongest direct governed-enterprise-action comparator. |
| Atlassian support with AI and service teams | Atlassian | Reviewed 2026-06-10 | https://www.atlassian.com/blog/announcements/we-rebuilt-atlassian-support | Official blog | Teamwork Graph/Rovo, structured content, self-healing docs/evals context. |
| Asana AI work management vendor analysis | Asana | 2026-06-09 | https://asana.com/resources/ai-work-management-vendor-analysis | Official resource | Agentic work-management positioning and first-market language risk. |
| Asana AI Teammates / MCP / AI Connectors | Asana | Reviewed 2026-06-10 | https://asana.com/product/ai-teammates | Official product pages | Work-graph, MCP, connector, preauthorized teammate surfaces. |
| Cursor changelog | Cursor | Reviewed 2026-06-10 | https://cursor.com/changelog | Official changelog | Custom stores, custom tools, auto-review, nested subagents, background agents. |
| Cursor SDK and Bugbot docs | Cursor | Reviewed 2026-06-10 | https://docs.cursor.com/en/sdk | Official docs | Programmable coding-agent platform and PR review evidence. |

## 4. Competitive Bridge Table

| Competitor capability | Underlying mechanism | pm-substrate equivalent or gap | Directness of threat | Evidence source | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| Copilot CLI `/security-review` | User/CLI-invoked AI security review before PR or after changes | External validation evidence; gap is source-authority/read-set/current-state review before code action | High | GitHub 2026-06-10 changelog | High | CLI review emits machine-readable artifact with current-state view, original observation, observed reads, policy, and replay hash. |
| Third-party coding-agent validation | CodeQL, dependency advisory, secret scanning on third-party agent PRs | Validation lane that should be admitted but not trusted as operational authority | High | GitHub 2026-06-09 changelog | High | Validation results block stale/unauthorized source use, not only security defects. |
| Copilot model/provider policy | Admin enablement, model picker, retention policy, billing | Artifact metadata for provider/model policy; current repo has `provider` but not full policy refs | High | GitHub Claude Fable 5 changelog | High | Copilot exposes retention/admin/ZDR/allowed-data metadata in action artifacts and blocks mismatches. |
| OpenAI Agent Builder/Evals wind-down | Product consolidation toward Agents SDK and Workspace Agents | Lowers hosted builder/eval comparator, raises SDK/client-origin tracking need | Medium | OpenAI Help 2026-06-03 | Medium-high | OpenAI replaces wind-down with a portable state-review/eval artifact in Agents SDK or Workspace Agents. |
| Google ADK long-running agent approval | State machine with wait state, human approval, resume | Workflow position and approval evidence; gap is revision/currentness validation at resume time | High | Google Cloud ADK post 2026-05-12 | High | Approval resume includes content hash, source refs, read-set revalidation, and policy disposition. |
| Google Drive alignment approvals | Preserve approvals while file changes through alignment approval | Approval-currentness drift fixture; approval state must bind to content/revision | High | Workspace Updates 2026-06-08 | High | Approval cannot be used unless artifact proves approved revision matches current revision or explicit scope covers the change. |
| Google Workspace DLP policy APIs | Programmatic policy create/update | Policy mutation evidence; gap is policy-version binding in action review | Medium-high | Workspace Drive Labels API docs | High | Agent action review records exact DLP policy version/as-of and blocks stale policy assumptions. |
| AWS AgentCore Registry/OBO/memory/traces/evals | Managed runtime lanes for registry, gateway, identity, memory, trace replay, eval harness | External evidence sources; gap is admission into `StateReviewArtifact` with authority/currentness checks | High | AWS AgentCore release notes | Medium-high | AgentCore emits pre-action artifact with original observation/read-set/current authority, not only runtime trace/eval. |
| ServiceNow Action Fabric/Context Engine/AI Control Tower | Enterprise system of action with governed context and agent access | Closest public product comparator; gap is portable artifact proof | High | ServiceNow 2026-05-06 press release and product pages | Medium-high | ServiceNow exposes replayable original-observation/read-set/action-review artifacts to external agents/customers. |
| Atlassian Teamwork Graph/Rovo | Shared work graph and AI agents over team artifacts | Work-graph source context; gap is deterministic authority/currentness validation | Medium-high | Atlassian blog/product pages | Medium | Rovo graph actions include read-set, source steward, workflow validity, and replay hash. |
| Asana Agentic Work Management | Work graph, AI teammates, MCP, connectors | PM-layer category threat; gap is inspectable state-review proof | Medium-high | Asana 2026-06-09 resource and product pages | Medium-high | Asana AI teammate action exposes portable action-review artifact and policy outcome. |
| Cursor custom stores/tools/subagents/auto-review | Programmable coding-agent state, tool extension, nested agents, review evidence | Custom-store evidence admission and nested-agent provenance; repo gap is external evidence admission | High for coding | Cursor changelog/docs reviewed 2026-06-10 | Medium-high | Cursor custom-store values carry source/tenant/freshness/authority metadata and are validated before actions. |

## 5. Claim Ledger

| Claim | v04 status | Evidence and correction |
| --- | --- | --- |
| GitHub security validation is now only background platform behavior. | Revised | GitHub added explicit `/security-review` in Copilot CLI on 2026-06-10, making the evidence lane directly invokable. |
| Security validation proves operational-state validity. | Still rejected | GitHub checks code/security outcomes; it does not prove original observation, source authority, workflow validity, tenant/subject binding, or observed read sets. |
| Runtime traces/evals are a single evidence type. | Revised | AWS AgentCore now needs separate lanes for registry, OBO identity, memory metadata, trace search/replay, hook telemetry, file systems, eval harness, and runtime shell evidence. |
| Approval state proves current valid action. | Downgraded | Google Drive alignment approvals show approvals can be preserved across content changes; action review must bind approval to content revision/hash and scope. |
| OpenAI hosted Agent Builder/Evals is a growing direct product threat. | Revised/downgraded | OpenAI is winding down those hosted platform products by 2026-11-30; threat shifts to Agents SDK, Codex, and ChatGPT Workspace Agents distribution. |
| Google ADK long-running agents solve workflow validity. | Downgraded | ADK provides a state-machine and approval pattern, but the source does not prove `asOf` source-authority/read-set revalidation at resume time. |
| Cursor custom stores are equivalent to operational state. | Downgraded | Custom stores may persist useful coding-agent state, but must be admitted as evidence with tenant, source, freshness, and authority metadata. |
| ServiceNow remains the strongest direct enterprise-action threat. | Confirmed | No fresher source displaced the May 2026 Action Fabric/Context Engine/AI Control Tower baseline. |
| pm-substrate's next implementation frontier is artifact lifecycle. | Contradicted by upstream code | Artifact lifecycle and first coverage primitives now exist. The next frontier is external evidence admission and policy-origin/currentness fixtures. |

## 6. pm-substrate Implications

1. **Add external validation evidence as a first-class evidence type.** GitHub's CLI and third-party-agent validation map cleanly to an `external_validation_result` fixture with validator id, invoked-by, target refs, status, finding classes, and timestamp. It should support but not override stale/source-authority warnings.
2. **Add approval-currentness binding.** Google Drive alignment approvals create a concrete fixture where an approval label survives a content change. A valid pm-substrate artifact should bind approval to content hash/revision, approval scope, approving actor, approvedAt, and changedAt.
3. **Split provider/client/runtime metadata into distinct fields.** Current `StateReviewArtifactMetadata` has `clientSurface` and `provider`. v04 sources suggest adding `providerSurface`, `modelId`, `dataRetentionPolicyRef`, `adminPolicyRef`, `clientCommand`, `runtimeRegistryRef`, `runtimeIdentityRef`, and `toolRuntime`.
4. **Model external policy mutation.** Google Workspace DLP policy APIs and Copilot provider policies imply policy should be versioned evidence. Fixtures should fail when an agent acts from an old DLP/model/provider policy version.
5. **Treat runtime traces as evidence after admission.** AWS AgentCore traces, replay, memory metadata, and eval harnesses are valuable, but they should enter artifacts as admitted evidence with source, subject, tenant, freshness, and consequence checks.
6. **Add custom-store and nested-agent provenance fixtures.** Cursor custom stores and nested subagents should be modeled as evidence producers where the store value or subagent output can be stale, unauthorized, or subject-mismatched.
7. **Keep ServiceNow as the artifact completeness comparator.** The highest-threat falsification test remains whether a major enterprise system of action exposes portable, replayable pre-action review artifacts.

## 7. First-Market Risk Assessment

**Is any major company clearly trying to solve the same operational-state problem?**

Partly, but no public source proves the full same problem. ServiceNow is closest in enterprise-action positioning. AWS is closest as a managed agent operations substrate. GitHub/Microsoft is closest in platform validation and developer-agent governance. Google is closest on workflow-state and approval mechanics. Cursor is closest on coding-agent session/custom-store mechanics. None publicly show the complete governed state-review boundary now present in `@pm/agent-state`.

**Are they solving only memory/RAG/context, or also currentness, authority, provenance, workflow validity, and action validation?**

- OpenAI: mostly SDK/tool distribution, enterprise app surfaces, Codex, and memory/context. No public portable action-validity artifact found.
- Anthropic: model/provider capability and tool-use surfaces. Provider policy matters, but operational-state authority remains outside the model.
- GitHub/Microsoft: security validation, provider policy, enterprise connectors, and workflow agents. Strong on validation and policy, incomplete on source-authority/currentness/read-set.
- Google: workflow state machines, DLP policy APIs, approval flows, client surfaces, and enterprise AI platform. Strong on workflow and policy mechanics, incomplete on durable pre-action review artifacts.
- AWS: runtime, identity, memory, registry, traces, evals, and operations. Strong on agent operations substrate, incomplete on current-state/action-validity proof.
- ServiceNow: broadest claim across context, governance, identity, and action. Still unproven at portable artifact level.
- Cursor: custom stores/tools/subagents/review in coding-agent sessions. Strong on session mechanics, incomplete on enterprise operational authority.

**Does this change urgency, differentiation, or roadmap priority?**

Yes. Urgency increases around external evidence admission and policy/currentness fixtures. Differentiation should move away from "we have state artifacts" because the repo now has a stronger primitive; it should move toward "we can admit foreign evidence without confusing it for authority, and can replay why an action was valid or only warned." Roadmap priority should shift to approval-currentness, external validation, provider-policy, runtime-trace, custom-store, and policy-mutation fixtures.

## 8. Testing/Eval Implications

New or sharpened scenarios:

1. **GitHub CLI security-review evidence passes while source state is stale.** Expected result: external validation evidence is admitted, but `freshness_window` or `source_authority` still warns/wouldBlock for high consequence.
2. **Third-party coding-agent PR has CodeQL clean result but used unauthorized issue/secret source.** Expected result: security evidence is supportive only; observed read-set/source-authority mismatch remains decisive.
3. **Copilot/Claude provider policy mismatch.** Sensitive source refs are proposed through a provider surface with invalid retention/admin/ZDR policy. Expected result: policy evidence warning or high-consequence wouldBlock.
4. **Google Drive alignment approval drift.** A file has approval preserved after content change. Expected result: approval evidence is denied or requires revalidation unless approved revision/hash/scope matches current content.
5. **Google ADK human approval resume after state drift.** Agent waits for approval while current state changes. Expected result: resume requires `asOf`/`evaluatedAt` review, fresh read set, and workflow-position validation.
6. **Workspace DLP policy version drift.** Agent reads old DLP policy, policy is updated, agent proposes action. Expected result: `projection_version` or policy-version invariant warning/wouldBlock.
7. **AgentCore trace replay vs action review.** Runtime trace says action succeeded, but source authority changed before action. Expected result: trace evidence cannot override failed state review.
8. **Cursor custom-store stale memory.** Coding agent custom store returns stale repo/task state. Expected result: custom-store value is external evidence and fails freshness/read-set comparison.
9. **Nested subagent provenance mismatch.** Parent agent proposes action based on subagent output without declared read refs. Expected result: observed-but-undeclared or declared-but-unobserved issue.
10. **ServiceNow/Asana/Atlassian graph write comparator.** Work-graph action cites a graph node but misses steward/owner or workflow gate. Expected result: source-authority/workflow-position invariant triggers.

New metrics or fields to consider:

- `external_validation_evidence_admitted`
- `external_validation_evidence_overridden_by_state_review`
- `approval_revision_mismatch_rate`
- `policy_version_drift_rate`
- `provider_policy_mismatch_rate`
- `runtime_trace_state_review_disagreement_rate`
- `custom_store_evidence_denial_rate`
- `nested_agent_undeclared_read_rate`
- `client_command_origin_coverage`
- `runtime_identity_ref_coverage`

## 9. Open Questions For Next Run

1. GitHub: Does Copilot CLI `/security-review` emit machine-readable artifacts, status checks, SARIF, or API-visible review metadata?
2. GitHub: Can third-party coding-agent validation results be queried and linked to PR provenance, agent identity, and model provider?
3. Microsoft: Which Copilot Studio wave 2 features have GA docs versus planned-only release-plan entries, especially multi-turn evaluation, threat protection, MCP tools, and workflow-step agent invocation?
4. Google: Do Drive alignment approvals expose revision ids, hashes, approval scope, or explicit reapproval requirements through APIs?
5. Google: Do ADK long-running-agent examples persist approval/revision state in a way that can be compared to current state at resume?
6. AWS: Which AgentCore release-note features are date-stamped GA versus preview, and do traces/evals/memory metadata have schemas that can be mapped into `ExternalStateEvidence`?
7. OpenAI: What replaces Agent Builder/Evals in Workspace Agents and Agents SDK for eval artifacts, if anything?
8. Cursor: Are custom stores typed and inspectable enough to become an external evidence fixture?
9. ServiceNow: Is there any public API/docs surface for AI Control Tower decisions, Action Fabric approvals, or Context Engine provenance?
10. Asana/Atlassian: Can MCP/work-graph actions expose read sets, source owners, and approval/workflow gates?

## 10. Recommended Next Action

Implement a narrow `ExternalStateEvidence` or `AdmittedStateEvidence` contract in `@pm/agent-state` with one fixture from this run: **approval-currentness drift**. Model a Google Drive-style alignment approval whose content revision changes after approval, then require state-review admission to bind approval id, approved revision/hash, current revision/hash, approving actor, approvedAt, changedAt, authority rule, and workflow position before action. This is a small, concrete bridge from competitor evidence into the current proof boundary and directly tests the "approval is evidence, not authority" claim.

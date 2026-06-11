# Daily AI Competitive Intelligence Index

Last updated: 2026-06-11
Scope: major AI companies, workspace AI, enterprise AI, agent platforms, AI coding/productivity tools, and competitors that may overlap with pm-substrate's operational-state thesis.

## Current Baseline

The first five versioned runs are complete. The live competitive pattern is that major vendors are expanding agent control planes, enterprise plugin/tool governance, shared workspace context, external validation, provider/model policy, client surfaces, long-running runtime state, approval/policy mechanics, and evaluation/analytics. None of the fresh 2026-06-09 to 2026-06-11 official sources proved a full governed operational-state layer with original-observation review, source authority, read-set validation, observed-read-set comparison, workflow validity, and durable state-review artifacts. ServiceNow remains the highest direct threat baseline because its May 2026 Action Fabric/Context Engine/AI Control Tower language most closely overlaps with `pm-substrate`, but the public evidence is still vendor/product positioning rather than inspectable artifact-review proof. The strongest confirmed recent delta is still June 10's evidence-lane split: GitHub exposes explicit Copilot CLI security review, Google exposes approval-currentness and policy-mutation mechanics, AWS exposes more agent-operations substrate pieces, and Cursor exposes custom stores/tools/subagents. June 11 added no stronger official contradiction, which keeps the implementation priority on durable replay of those evidence lanes.

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
| v03 | 2026-06-09 | `research/daily-ai-competitive-intelligence/v03-ai-competitive-intelligence-2026-06-09.md` | Fresh official-source continuation and task-tree bridge | Added June 9 official deltas for GitHub third-party coding-agent security validation, Claude Fable 5 provider/model policy, Anthropic model availability, OpenAI Codex adoption evidence, Google Gemini Apple/Xcode integration, and AWS AgentCore carry-forward runtime/eval pressure; converted the findings into a dated implementation/test task tree. |
| v04 | 2026-06-10 | `research/daily-ai-competitive-intelligence/v04-ai-competitive-intelligence-2026-06-10.md` | Evidence-lane and approval-currentness continuation | Added June 10 official deltas for Copilot CLI `/security-review`, OpenAI Agent Builder/Evals wind-down, Google ADK long-running approval state, Workspace DLP and Drive alignment approvals, AWS AgentCore registry/OBO/memory/trace/eval runtime lanes, Cursor custom stores/tools/subagents, and Asana/Atlassian work-graph watch updates; shifted implementation priority to external evidence admission and approval-currentness drift. |
| v05 | 2026-06-11 | `research/daily-ai-competitive-intelligence/v05-ai-competitive-intelligence-2026-06-11.md` | No-newer-source correction and durable replay closure | Re-checked the 24-72 hour official window and found no stronger post-v04 source; translated that quiet period into the right code move by committing and drift-testing the external-evidence admission JSONL replay corpus. |

## Top Deltas

1. OpenAI and GitHub are making agents/plugins/skills/app actions enterprise-manageable across Codex, ChatGPT, Copilot CLI, and VS Code.
2. Microsoft Copilot Studio is strengthening maker evaluation, analytics, connector recovery, sensitive-message handling, DLP, MCP manifests, and allowed-tool handling.
3. Google is expanding agent-ready execution and context surfaces through Colab CLI, Workspace Gmail-in-Drive grounding, Gemini Enterprise, and ADK long-running agent patterns.
4. AWS is pushing provider-neutral model/agent infrastructure through Bedrock, Startup Advisor, Kiro, OpenSearch Agent Skills, and multi-provider terms.
5. ServiceNow remains the strongest direct competitor-overlap baseline because it explicitly claims live governed enterprise context plus system-of-action execution, but no portable review-artifact proof was found.
6. The parallel v02 scan raised Atlassian, Asana, Cursor, Slack/Salesforce, and Cognition into the active watch set, mostly as partial work-graph, session-store, MCP-action, or coding-agent-state competitors rather than complete operational-state systems.
7. GitHub's June 9 third-party coding-agent security validation proves that external agent output validation is becoming platform behavior, but the evidence lane is security validation rather than operational-state authority.
8. Claude Fable 5's Copilot policy and data-retention requirements show that model/provider policy must become action-review evidence for sensitive workflows.
9. Gemini in Apple's Foundation Models framework and Xcode expands agent-capable client surfaces; this increases source/origin tracking pressure without proving currentness or workflow validity.
10. GitHub's June 10 Copilot CLI `/security-review` makes external validation an explicit command path, not only background platform behavior.
11. Google Drive alignment approvals create an approval-currentness fixture: approval state can be preserved while file content changes.
12. AWS AgentCore now needs to be tracked as multiple evidence lanes: registry, OBO identity, memory metadata, trace search/replay, hook telemetry, runtime filesystem/shell, and eval harness.
13. Cursor custom stores, custom tools, auto-review, and nested subagents make coding-agent session state a direct external-evidence-admission comparator.
14. The absence of a stronger June 11 official contradiction is itself useful: implementation priority should stay on replayable evidence handling, not on inventing a new competitor taxonomy.

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

### Added on 2026-06-09 v03

- GitHub third-party coding-agent security validation generally available: CodeQL, dependency advisory, and secret scanning validation now applies to third-party coding-agent output, including Claude and OpenAI Codex.
- GitHub Claude Fable 5 for Copilot plus Anthropic Fable/Mythos launch: model/provider policy, data retention, admin enablement, and multi-cloud model availability became concrete evidence fields.
- OpenAI Nextdoor Codex customer story: adoption evidence for enterprise Codex workflows, but not a new state-review mechanism.
- Google Gemini for Apple developers and DeepMind model-card updates: Gemini expands into Apple's Foundation Models framework and Xcode, reinforcing client-surface origin tracking.
- AWS AgentCore docs carry-forward: production traces, batch evals, user simulation, file systems, GovCloud, payments, custom headers, and interactive shells remain runtime/eval comparator evidence.

### Added on 2026-06-10 v04

- GitHub Copilot CLI `/security-review`: explicit AI-assisted security review command before PR creation or after code changes.
- OpenAI Agent Builder and Evals wind-down by 2026-11-30: direct hosted builder/eval threat downgraded; Agents SDK and Workspace Agents remain the active distribution watch.
- Google Cloud ADK long-running human-in-the-loop state-machine pattern: approval/wait/resume becomes a workflow-state comparator.
- Google Workspace Drive DLP policy create/update APIs and Drive alignment approvals: policy mutation and approval-currentness drift become concrete fixtures.
- AWS AgentCore release-note expansion: registry, OBO identity, memory metadata, trace search/replay, hook telemetry, batch eval, runtime file systems, interactive shells, and gateway/identity improvements become separate evidence lanes.
- Cursor custom stores, custom tools, auto-review, background agents, and nested subagents: coding-agent session state and external review evidence move higher on the comparator list.
- Asana Agentic Work Management and Atlassian Teamwork Graph/Rovo watch carried forward with 2026-06-09/10 source checks; no portable state-review artifact proof found.

### Added on 2026-06-11 v05

- Re-checked official vendor surfaces in the 24-72 hour window ending 2026-06-11 and found no stronger direct operational-state release than the already-confirmed June 10 evidence-lane split.
- GitHub Copilot CLI `/security-review` remained the highest-signal official source because it keeps external validation as an explicit invoked evidence lane.
- Repo-grounded correction: a dirty local external-evidence draft was superseded by upstream June 10 code, so today's correct closure was durable replay of that landed corpus rather than a duplicate second implementation.

## Current Highest Threats

| Threat | Vendor | Why it matters | Current assessment |
| --- | --- | --- | --- |
| High | ServiceNow | Claims live governed enterprise intelligence plus a system of action exposed to external agents through MCP, identity, audit, and role-scoped tools. | Strongest direct overlap, but still vendor-context evidence. |
| High | GitHub/Microsoft | Agent tasks API, enterprise-managed plugins, Copilot Studio evaluation/connectors/DLP, model policies, third-party coding-agent security validation, and Copilot CLI `/security-review` turn developer agents into governed enterprise workflows. | High distribution/control-plane risk plus explicit external validation evidence; no public durable state-review proof. |
| High | OpenAI | ChatGPT/Codex workspace agents, plugins, app templates, sessions, Sites, memory, Lockdown Mode, and enterprise adoption evidence create broad enterprise agent governance surfaces. | Strong client/control-plane pressure; memory and plugin sharing are not operational state. |
| Medium-high | Google | Workspace/Gemini/ADK/Colab plus Gemini in Apple developer surfaces make agent context and execution ubiquitous; ADK long-running agents and Drive approvals add explicit workflow/currentness mechanics. | Strong context/runtime/client-surface pressure; approval and policy-currentness need fixtures; full authority/currentness remains unproven. |
| High | AWS | Bedrock/Kiro/Startup Advisor/OpenSearch Agent Skills plus AgentCore registry, memory, traces, evals, identity/OBO, policy, gateway, file systems, and shells push provider-neutral agent infrastructure and model governance. | Strong runtime/eval/identity comparator; not yet an action-validity substrate. |
| Medium-high | Atlassian/Asana/Cursor | Teamwork Graph, Agentic Work Management, and Cursor custom store/session/subagent mechanics overlap with work-state, workflow, and durable agent-trace concerns. | Strong implementation and positioning signals; no public proof of pm-substrate-equivalent action validation. |

## Rejected, Weak, Or Downgraded Claims

- OpenAI up-to-date memory is not a governed operational-state layer.
- GitHub one-million-token context does not solve stale or unauthorized context.
- Google Gmail-in-Drive grounding is context aggregation, not source authority.
- Claude Fable/Mythos model launches are model/provider-policy and autonomy signals, not operational-state releases.
- ServiceNow has the closest claim but has not publicly shown portable original-observation/read-set/action-review artifacts.
- Enterprise plugin distribution increases reach; it does not by itself make actions safe.
- Approval labels are not automatically valid for current content; Google Drive alignment approvals show approval and content revision can diverge.
- Runtime traces, replay, and evals are evidence lanes, not source authority.
- Cursor custom stores are not operational state unless admitted with source, tenant, freshness, subject, and authority metadata.

## Current Implementation Implications

1. Keep the durable ArrowHedge `StateReviewArtifact` lifecycle as closed pure primitive; do not reopen it as research-only debt.
2. Add an external evidence admission contract for validation results, provider/model policy, runtime traces, memory/custom-store values, approval state, DLP/policy versions, and work-graph state.
3. Add approval-currentness fixtures for Drive-style alignment approvals: approval id, approved revision/hash, current revision/hash, approval scope, approving actor, approvedAt, changedAt, and workflow position.
4. Add client/plugin/provider/session metadata beyond the current artifact `clientSurface` and `provider`: `clientCommand`, `providerSurface`, `modelId`, `dataRetentionPolicyRef`, `adminPolicyRef`, `runtimeRegistryRef`, `runtimeIdentityRef`, and `toolRuntime`.
5. Add cross-source authority fixtures for email/file/PR/issue/project-ledger conflicts.
6. Add agent-task lifecycle fixtures for stale issue/PR state, plugin policy drift, connector lifecycle drift, DLP policy drift, and model/provider policy drift.
7. Keep ServiceNow as the comparator for "governed action artifact completeness."
8. Add competitor-inspired fixtures for Slack/CRM writes, GitHub/Cursor coding sessions, AWS workflow agent steps, Atlassian graph writes, Asana work-graph actions, ServiceNow deploys, and Google Workspace shared artifacts.
9. Add external validation evidence fixtures for third-party coding agents, starting with GitHub-style CodeQL, dependency advisory, secret-scanning results, and Copilot CLI `/security-review`.
10. Add provider/model policy evidence fields for data retention, ZDR status, admin enablement, provider surface, and allowed data class.
11. Add client-surface origin fields so Codex, Copilot app/CLI, Claude Code, Xcode/Gemini, Cursor, Slack, and AgentCore proposals can be compared without confusing client surface with authority.

## Current Implementation/Test Task Tree

```text
competitive-intelligence frontier after v04
|
+-- external validation evidence admission
|   |-- source: GitHub third-party coding-agent validation and Copilot CLI /security-review
|   `-- proof: external validation can support but not override stale/read-set/source-authority warnings
|
+-- model/provider policy evidence
|   |-- source: Claude Fable 5 Copilot retention/admin policy
|   `-- proof: sensitive source refs fail when provider policy is not allowed
|
+-- approval-currentness binding
|   |-- source: Google Drive alignment approvals
|   `-- proof: approval evidence is invalid or requires revalidation when current revision/hash differs from approved revision/hash
|
+-- external policy mutation evidence
|   |-- source: Google Workspace DLP policy create/update APIs
|   `-- proof: stale policy version or missing policy owner produces warning/wouldBlock before action
|
+-- client-surface origin tracking
|   |-- source: Gemini in Xcode/Foundation Models, Copilot app/CLI, Codex, Claude Code, Cursor SDK
|   `-- proof: origin surface is recorded without becoming authority
|
+-- runtime trace versus action-review comparison
|   |-- source: AWS AgentCore registry, OBO identity, memory metadata, traces/evals/shells
|   `-- proof: runtime trace evidence cannot override current-state review
|
+-- custom-store and nested-agent evidence
|   |-- source: Cursor custom stores, custom tools, auto-review, nested subagents
|   `-- proof: custom-store and subagent outputs are admitted as evidence, not direct authority
|
`-- daily publish closure
    |-- source: repeated research/fetch/push coordination gaps
    `-- proof: automation publishes clean sequential ledger and remote SHA equality
```

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

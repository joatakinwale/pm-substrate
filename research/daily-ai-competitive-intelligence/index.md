# Daily AI Competitive Intelligence Index

Last updated: 2026-06-07
Scope: major AI companies, workspace AI, enterprise AI, agent platforms, AI coding/productivity tools, and competitors that may overlap with pm-substrate's operational-state thesis.

## Current Baseline

The local Codex automation config was installed on 2026-06-07, and the first scheduled run is pending. Each run should compare vendor announcements against the pm-substrate claim that agents need governed operational state before valid action: current state, provenance, authority, invalidation, workflow validity, read-set/action review, and durable artifacts.

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
| Pending | 2026-06-07 | N/A | Local automation config installed | First run should create `v01-ai-competitive-intelligence-YYYY-MM-DD.md`. |

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

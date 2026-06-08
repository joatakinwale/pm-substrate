# pm-substrate Research Ledger

Last updated: 2026-06-08
Purpose: single shared ledger for research produced by humans, Codex runs, and scheduled automations.

This file is the cross-stream research current-state view. Chain-specific indexes still own detailed version history, but this ledger records the main claims, status changes, and implementation implications across all research streams.

## Run Protocol

Every research automation or manual research run must:

1. `git fetch origin main`.
2. Fast-forward or pull `main` before writing new research.
3. Inspect changed files from upstream, especially `research/`, `Changelog.md`, `packages/agent-state`, `packages/evals`, `packages/capability-finance-research-ingest`, `packages/continuity`, workflow, registry, graph, and event packages.
4. Read this ledger and the relevant chain-specific index.
5. Create a new versioned research file; never overwrite old versions.
6. Update the chain-specific index.
7. Update this ledger with new claims, corrected claims, downgraded claims, and implementation implications.
8. Update `Changelog.md` for material repo artifacts.
9. Run validation appropriate to the change.
10. Commit and push to `main`.

This protocol is itself an agent-state test: multiple actors are writing observations into one repo, and the repo must preserve provenance, reconcile parallel work, and expose current research state.

## Research Streams

| Stream | Index | Current status | Next action |
| --- | --- | --- | --- |
| Agent-state Arrowsmith | `research/daily-arrowsmith-agent-state/index.md` | Active. Pure state-review primitives and `StateReviewArtifact` exist; durable generated artifacts, temporal-misalignment fixture coverage, and DB/fixture equivalence are next. | Generate ArrowHedge state-review JSON/JSONL artifacts and derive metrics from them. |
| AI competitive intelligence | `research/daily-ai-competitive-intelligence/index.md` | Active. v01 found major vendors converging on agent control planes, work graphs, managed runtimes, session state, governance, and audit, but no reviewed source exposed pm-substrate's full pre-action `StateReviewArtifact` boundary. | Deepen OpenAI/GitHub/AWS/Atlassian docs and implement persisted ArrowHedge review artifacts so the differentiation is executable. |
| First-principles agent-state | `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md` | Precursor. Established model/prompt/memory state vs operational state. | Use as baseline framing for every agent-state comparison. |
| Cross-disciplinary state/interoperability | `research/cross-disciplinary-state-interoperability-arrowsmith_2026-06-03.md` | Foundational bridge. | Continue extracting mechanisms only when they map to executable substrate checks. |
| Local-lab eval bridge | `research/local-lab-state-bench-arrowsmith_2026-06-02.md` | Baseline/substrate paired eval framing exists. | Keep eval claims tied to executable events/artifacts, not scenario prose. |
| Workspace/agent-state landscape | `research/workspace-and-agent-state-landscape_2026-06-02.md` | Early landscape evidence. | Reconcile with daily competitive-intelligence findings. |

## Claim Ledger

| Claim ID | Claim | Status | Source entries | Implementation implication |
| --- | --- | --- | --- | --- |
| C001 | LLM weights, prompts, RAG, memory, and chat are not operational state. | Confirmed | First-principles agent-state; daily Arrowsmith v01-v04 | Keep current-state views and source authority outside model context. |
| C002 | Agent action should be treated as proposal before mutation. | Confirmed | Daily Arrowsmith v01-v04; local `@pm/agent-state` | Use `ActionProposalReview` before side effects. |
| C003 | Original observations must be evaluated against current state, not a freshly minted current contract. | Confirmed as primitive | Daily Arrowsmith v02; canonical v03; fetched `main` code | Keep original `ObservationContract` in proposal review and artifacts. |
| C004 | Subject identity is part of action validity. | Confirmed as primitive | Daily Arrowsmith v02; canonical v03; fetched `main` code | Preserve `subject_mismatch` validation and add multi-object role checks next. |
| C005 | `StateReviewArtifact` is the next proof boundary. | Revised | v02/v03 said create it; fetched `main` has pure primitive; v04 corrects to generated/replayed artifacts | Generate JSON/JSONL artifacts, replay them, and derive metrics from artifact evidence. |
| C006 | Warn-first means mutation blocking is implemented. | Contradicted | Daily Arrowsmith v01-v04; local code | Keep advisory vs blocking explicit; define invariant-class policy before external enforcement. |
| C007 | More agents reliably improve workflow outcomes. | Downgraded | BenchAgent in v04; CollabSim/ALMANAC in v03-local | Compare agents under normalized protocols and artifact traces. |
| C008 | Bigger retrieval or context solves stale state. | Downgraded | STALE, CAIS, memory sources | Retrieval can find evidence chains but still needs currentness, authority, and invalidation. |
| C009 | Project management maps to shared operational cognition. | Confirmed | PM/team cognition sources across v01-v04 | Add source steward, authority owner, escalation owner, handoff preconditions, and coordination metrics. |
| C010 | Research files are durable shared memory by themselves. | Downgraded | Local/remote v03 divergence resolved on 2026-06-07 | Enforce fetch/pull, ledger update, commit, and push discipline. |
| C011 | Temporal state drift has distinct observation-to-action, action-to-feedback, and feedback-to-observation phases. | Confirmed as eval direction | Daily Arrowsmith v05; TIDE temporal state misalignment | Classify ArrowHedge fixtures by temporal phase and avoid overclaiming read-set validation coverage. |
| C012 | Semantic agreement among agents is sufficient authority. | Downgraded | Daily Arrowsmith v05; H-CSC bridge | Treat semantic commit/abort as provenance/finality evidence only; keep source authority deterministic. |
| C013 | Memory belief clarity proves operational state validity. | Downgraded | Daily Arrowsmith v05; MMPO and LOCOMO-CONV | Use belief/memory diagnostics as supporting metrics, but require artifact-backed current-state review before action. |
| C014 | Major AI/workspace vendors are converging on agent control planes, not just chat/RAG. | Confirmed | Daily AI competitive intelligence v01 | Treat OpenAI, GitHub/Microsoft, AWS, Atlassian, Asana, ServiceNow, Google, Slack, Cursor, Anthropic, and Cognition as partial state/workflow competitors. |
| C015 | Current vendor agent-control products solve pm-substrate's operational-state problem end to end. | Downgraded / still speculative | Daily AI competitive intelligence v01 | Keep differentiation centered on original-observation review, read-set validation, subject binding, as-of review, replayable artifacts, and policy modes. |

## Current Implementation Frontier

1. Generate deterministic ArrowHedge state-review JSON/JSONL artifacts from existing pure primitives.
2. Derive `analyzeStateAssertions()`, `analyzeActionProposalReviews()`, and `analyzeStateReviewArtifacts()` inputs from generated artifacts.
3. Classify generated artifacts by temporal misalignment phase and invariant class.
4. Add DB/fixture equivalence for state-review artifact generation when `PM_DATABASE_URL` is available.
5. Define the first invariant-class blocking-policy matrix.
6. Link continuity checkpoints and handoff summaries to state-review artifact ids.
7. Add object-centric related refs and qualified roles for multi-object action validity.
8. Keep competitive-intelligence research tied to whether vendors solve currentness, authority, provenance, workflow validity, and pre-action review, not just memory/RAG.
9. Convert competitive-intelligence findings into competitor-inspired artifact fixtures for Slack/CRM writes, GitHub/Cursor coding sessions, AWS workflow agent steps, Atlassian graph writes, Asana work-graph actions, ServiceNow deploys, and Google Workspace shared artifacts.

## Ledger Entries

| Entry | Date | Source | Parent / prior state | Main delta | Follow-up |
| --- | --- | --- | --- | --- | --- |
| L001 | 2026-06-02 | `research/local-lab-state-bench-arrowsmith_2026-06-02.md` | Initial local-lab eval framing | Established paired baseline/substrate eval logic for stale memory, authority conflict, and workflow invalidation. | Keep paired claims tied to executable artifacts. |
| L002 | 2026-06-03 | `research/first-principles-agent-state-interoperability_2026-06-03.md` | L001 | Connected partial observability, belief state, semantic interoperability, object-centric event logs, shared mental models, and project communication. | Map every bridge to a falsifiable substrate check. |
| L003 | 2026-06-04 | `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md` | L002 | Located the first-principles gap between statistical prediction and current operational state. | Use as baseline thesis language. |
| L004 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` | L003 | Added observation contracts, stale-memory invalidation, stateful workflow grading, and PM shared-cognition bridges. | Implement current-state view and assertion metrics. |
| L005 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md` | L004 | Corrected tautological review path and emphasized subject/read-set binding and JSON artifacts. | Add original-observation review, subject mismatch, and generated artifacts. |
| L006 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-05.md` | L005, local branch | Added collaboration, memory execution state, action-state communication, tool-surface drift, and harness repair. | Preserved as superseded local branch artifact; folded into v04. |
| L007 | 2026-06-06 | `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md` | L005, remote `main` | Audited repo and marked subject mismatch, original-observation review, `evaluatedAt`, advisory/blocking mode, and evidence stages as closed pure primitives. | Shift to durable artifact replay and policy integration. |
| L008 | 2026-06-07 | `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md` | L006 + L007 | Canonical v04 marked `StateReviewArtifact`, ArrowHedge artifact generation, hash replay, and artifact metrics as closed pure primitives; this ledger commit added fetch/merge/push protocol around it. | Generate artifact corpus and enforce daily sync discipline. |
| L009 | 2026-06-08 | `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md` | L008 | Added temporal state misalignment phases, AdaPlanBench progressive constraints, semantic commit/abort limits, cross-step evidence aggregation, and PM accountability/common-understanding mechanisms. | Persist ArrowHedge state-review artifacts, derive eval metrics from artifacts, and classify temporal phases before policy blocking. |
| L010 | 2026-06-08 | `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` | AI competitive-intelligence baseline; L009 implementation frontier | First competitive-intelligence run escalated OpenAI, GitHub/Microsoft, AWS, Atlassian, Asana, ServiceNow, Google, Slack, Cursor, Anthropic, and Cognition as partial agent-control/work-state competitors; no source showed the full pm-substrate state-review boundary. | Inspect OpenAI/GitHub/AWS/Atlassian technical docs and implement persisted ArrowHedge JSON/JSONL review artifacts. |

## Open Watchlist

1. Deepen daily AI competitive intelligence into technical docs for OpenAI workspace agents/Codex, GitHub Copilot app/AHP, AWS AgentCore/Step Functions, Atlassian Teamwork Graph/Rovo MCP, Asana Work Graph, ServiceNow Build Agent/AEMC, Google Gemini managed agents, Slackbot MCP/Agentforce, Cursor SDK, and Anthropic Claude Code/Cowork.
2. Keep testing whether vendors solve currentness, authority, provenance, workflow validity, and pre-action review, or only session/context/workflow/audit around agents.
3. Generate ArrowHedge state-review artifacts and update this ledger with artifact replay evidence.
4. Add temporal-misalignment and progressive-constraint fixture metadata before claiming full stale-state coverage.
5. Treat future merge conflicts or stale local research as evidence for the substrate thesis and record how they were reconciled.

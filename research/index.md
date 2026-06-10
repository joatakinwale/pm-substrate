# pm-substrate Research Ledger

Last updated: 2026-06-10
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
| Agent-state Arrowsmith | `research/daily-arrowsmith-agent-state/index.md` | Active. v07 confirms durable state-review artifacts as implemented pure primitives and sharpens the frontier with shared verified context, observability-safe memory retention, MCP explicit state handles, long-horizon workflow consistency, and PM/high-reliability coordination mechanisms. | Add pure external evidence admission for MCP/tool/task handles, memory, monitoring, lineage, audit, attestation, GUI/professional workflow traces, world-model prediction, and PM handoff evidence. |
| AI competitive intelligence | `research/daily-ai-competitive-intelligence/index.md` | Active. v01 baseline-plus-delta run found fast vendor movement in agent control planes, context expansion, enterprise plugin/tool governance, and evaluation; v02 preserved a parallel broader scan covering Atlassian, Asana, Cursor, Slack/Salesforce, Cognition, and deeper OpenAI/GitHub/AWS signals; v03 added June 9 official deltas for third-party coding-agent validation, model/provider policy, client-surface expansion, and runtime/eval pressure; v04 added June 10 evidence-lane deltas for Copilot CLI security review, Google approval-currentness/policy mutation, AWS AgentCore registry/OBO/memory/trace/eval lanes, OpenAI Agent Builder/Evals wind-down, and Cursor custom stores/subagents. No fresh source proved portable governed operational-state review artifacts. | Implement external evidence admission starting with approval-currentness drift, then validation evidence, provider/model policy, policy-version drift, custom-store evidence, and runtime-trace comparison fixtures. |
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
| C005 | `StateReviewArtifact` is the next proof boundary. | Revised / mostly closed as pure primitive | v02/v03 said create it; v04/v05 moved to generated/replayed artifacts; v06 confirms durable artifact lifecycle and coverage primitives exist | Move beyond artifact lifecycle into external evidence admission and production side-effect policy. |
| C006 | Warn-first means mutation blocking is implemented. | Contradicted | Daily Arrowsmith v01-v04; local code | Keep advisory vs blocking explicit; define invariant-class policy before external enforcement. |
| C007 | More agents reliably improve workflow outcomes. | Downgraded | BenchAgent in v04; CollabSim/ALMANAC in v03-local | Compare agents under normalized protocols and artifact traces. |
| C008 | Bigger retrieval or context solves stale state. | Downgraded | STALE, CAIS, memory sources | Retrieval can find evidence chains but still needs currentness, authority, and invalidation. |
| C009 | Project management maps to shared operational cognition. | Confirmed | PM/team cognition sources across v01-v04 | Add source steward, authority owner, escalation owner, handoff preconditions, and coordination metrics. |
| C010 | Research files are durable shared memory by themselves. | Downgraded | Local/remote v03 divergence resolved on 2026-06-07 | Enforce fetch/pull, ledger update, commit, and push discipline. |
| C011 | Temporal state drift has distinct observation-to-action, action-to-feedback, and feedback-to-observation phases. | Confirmed as eval direction | Daily Arrowsmith v05; TIDE temporal state misalignment | Classify ArrowHedge fixtures by temporal phase and avoid overclaiming read-set validation coverage. |
| C012 | Semantic agreement among agents is sufficient authority. | Downgraded | Daily Arrowsmith v05; H-CSC bridge | Treat semantic commit/abort as provenance/finality evidence only; keep source authority deterministic. |
| C013 | Memory belief clarity proves operational state validity. | Downgraded | Daily Arrowsmith v05; MMPO and LOCOMO-CONV | Use belief/memory diagnostics as supporting metrics, but require artifact-backed current-state review before action. |
| C014 | Vendor agent control planes are converging on the same operational-state problem. | Partly confirmed | Competitive intelligence v01 | Treat OpenAI/GitHub/Microsoft/Google/AWS releases as urgency signals, but do not equate control planes with governed state. |
| C015 | Enterprise plugin/tool distribution makes agent actions safe. | Downgraded | Competitive intelligence v01; OpenAI/GitHub plugin releases | Add plugin/policy provenance to review artifacts; validate current policy before action. |
| C016 | More workspace context is equivalent to source authority. | Downgraded | Competitive intelligence v01; Google Workspace and OpenAI memory updates | Add cross-source authority conflict evals where email, files, PRs, and ledgers disagree. |
| C017 | ServiceNow is the closest current direct vendor threat to pm-substrate. | Confirmed as watch baseline | Competitive intelligence v01; ServiceNow May 2026 vendor context | Use ServiceNow as the governed-action comparator, but require portable artifact proof before marking Critical. |
| C018 | Coding-agent session stores and enterprise work graphs are implementation comparators for pm-substrate artifacts. | Confirmed as design input | Competitive intelligence v02; GitHub/Copilot, Cursor, Atlassian, Asana, AWS, Slack/Salesforce sources | Add competitor-inspired artifact fixtures for resumed agent sessions, graph writes, workflow-agent steps, shared artifacts, MCP actions, and generated-app deploys. |
| C019 | Durable state-review artifact lifecycle, observed read-set comparison, temporal phase coverage, DB/fixture equivalence, and invariant policy are no longer research-only gaps. | Confirmed as pure primitives | Changelog 2026-06-08; daily Arrowsmith v06 | Move next frontier to external evidence admission and keep external mutation blocking unclaimed. |
| C020 | External protocol task state, tool annotations, memory retrieval, world-model predictions, audit logs, lineage events, and PM handoff notes are evidence, not direct authority. | Confirmed as thesis refinement | Daily Arrowsmith v06; MCP, SentinelBench, memory-search, world-model, FHIR, OpenLineage, in-toto/SLSA, PM sources | Add an admission contract that validates source, subject, tenant, freshness, consequence, privacy, workflow, and policy alignment before action. |
| C021 | PM state artifacts should measure structured agreement, not just richer dashboard content. | Confirmed as PM bridge | Daily Arrowsmith v06; shared mental-model meta-analysis, human-AI situation-awareness, boundary objects, coordination theory | Add dependency-structure agreement, handoff-condition resolution, and team-SA alignment evals. |
| C022 | Third-party coding-agent security validation is external validation evidence, not operational-state authority. | Confirmed as competitive delta | Competitive intelligence v03; GitHub 2026-06-09 third-party coding-agent validation | Admit security validation results as evidence while still requiring current-state, read-set, source-authority, and workflow checks. |
| C023 | Model/provider policy and data-retention posture are action-review context. | Confirmed as competitive delta | Competitive intelligence v03; Claude Fable 5 in GitHub Copilot and Anthropic model availability | Add provider/model policy refs for data retention, ZDR status, admin enablement, provider surface, and allowed data class. |
| C024 | Client-surface expansion increases origin tracking pressure but does not prove valid action. | Confirmed as competitive delta | Competitive intelligence v03; Google Gemini Apple/Xcode integration and Codex/Copilot/Cursor carry-forward evidence | Record client surfaces and provider surfaces without treating them as authority. |
| C025 | Shared verified context helps multi-agent coordination only when writes are admitted and revalidated. | Confirmed as thesis refinement | Daily Arrowsmith v07; DeLM shared context, MCP state handles, SKILL.nb | Add external evidence admission before shared context entries become `StateRef`s or action-review inputs. |
| C026 | Memory retention requires observability, deletion, residue, and stale-risk metadata before operational use. | Confirmed as thesis refinement | Daily Arrowsmith v07; OSL-MR, ActiveMem, Deployment-Time Memorization, H2HMem, spatial-memory occlusion | Add memory evidence fields for source modality, retention policy, deletion residue risk, online-observable feature boundary, validUntil, and stale-information risk. |
| C027 | Long-horizon workflow success cannot be judged only by final output. | Confirmed as eval direction | Daily Arrowsmith v07; Workflow-GYM, T1-Bench, WeaveBench, ALEM, Emergence World, SKILL.nb | Add artifact run groups and assertions for workflow-stage omission, objective drift, error propagation, gate outcomes, and environment drift. |
| C028 | MCP explicit state handles are addressability, not authority. | Confirmed as protocol correction | Daily Arrowsmith v07; MCP 2025-11-25, 2026 roadmap, tool-annotation post, 2026-07-28 RC, SEP-2567 | Treat handles and annotations as untrusted external evidence requiring admission and revalidation. |
| C029 | Multi-agent consensus can hide reasoning/source disagreement. | Confirmed as downgraded bridge | Daily Arrowsmith v07; Consistency Illusion; sensemaking and SMM sources | Add grounded-claim/source/stance coverage before using consensus as evidence. |
| C030 | PM handoffs need typed expertise, authority, and escalation state. | Confirmed as PM bridge | Daily Arrowsmith v07; Faraj/Xiao, Bigley/Roberts, Lewis, Hsu et al., AHRQ transitions | Add handoff fixtures with expertise owner, source steward, escalation owner, unresolved risk, dependency refs, and valid next action. |
| C031 | Explicit security-review commands are validation evidence, not operational-state authority. | Confirmed as competitive delta | Competitive intelligence v04; GitHub 2026-06-10 Copilot CLI `/security-review` | Model invoked validation results separately from source-authority/read-set/current-state review. |
| C032 | Approval state must be bound to current content, revision, and scope. | Confirmed as new eval direction | Competitive intelligence v04; Google Drive alignment approvals | Add approval-currentness fixtures that compare approved revision/hash/scope to current revision/hash/scope before action. |
| C033 | Runtime traces, registry, OBO identity, memory metadata, and eval harnesses are separate evidence lanes. | Confirmed as thesis refinement | Competitive intelligence v04; AWS AgentCore release notes | Split external evidence admission by evidence type instead of treating "runtime governance" as one authority signal. |
| C034 | Hosted agent-builder/eval product availability is not the durable competitive boundary. | Revised | Competitive intelligence v04; OpenAI Agent Builder/Evals wind-down by 2026-11-30 | Keep comparing SDK/workspace-originated actions against artifacts rather than platform-builder feature lists. |
| C035 | Coding-agent custom stores and nested subagents are evidence producers, not source authority. | Confirmed as competitive delta | Competitive intelligence v04; Cursor changelog/docs | Add custom-store and subagent-output fixtures with source, tenant, freshness, subject, and observed-read-set validation. |

## Current Implementation Frontier

1. Add a pure external evidence admission contract for MCP/tool/task handles, memory, monitoring, lineage, audit, attestation, GUI/professional workflow traces, world-model prediction, and PM handoff evidence.
2. Add one MCP-like fixture that admits or rejects tool/task evidence without requiring a live MCP server, including annotation mismatch and explicit-state-handle revalidation.
3. Prototype memory-search observation evidence and denial reasons in the observed-read-set lane, including deletion residue and observability-safe retention metadata.
4. Add a clean accepted/current ArrowHedge artifact fixture as a positive metrics baseline.
5. Add a monitoring/no-op wait-condition fixture with reaction-time and premature-action metrics.
6. Add provenance-vs-authorization alignment fields or a policy outcome for actual source/parameter path vs authorized intent.
7. Decide whether OpenLineage/FHIR/in-toto vocabulary should be generic source-ref facets, examples, or adapter-specific mappings.
8. Add run-level artifact groups for trajectory-level failure hypotheses spanning multiple artifacts, agents, workflow stages, feedback observations, and handoffs.
9. Add role-specific projections over a stable state-review artifact invariant core.
10. Add PM distributed-state evals for dependency-structure agreement, expertise/source/escalation owner convergence, handoff-condition resolution, source/owner/blocker convergence, and valid next action.
11. Keep competitive-intelligence research tied to whether vendors solve currentness, authority, provenance, workflow validity, and pre-action review, not just memory/RAG/context/session/workflow/audit.
12. Add ServiceNow comparator fixtures for governed action completeness.
13. Add competitor-inspired fixtures for Slack/CRM writes, GitHub/Cursor coding sessions, AWS Step Functions agent steps, Atlassian graph writes, Asana work-graph actions, ServiceNow deploys, and Google Workspace shared artifacts.
14. Add external validation evidence fixtures for third-party coding agents, starting with GitHub-style CodeQL, dependency advisory, and secret-scanning outcomes.
15. Add model/provider policy evidence fields for retention, ZDR, admin enablement, provider surface, and allowed data class.
16. Add client-surface origin tracking for Codex, Copilot app, Claude Code, Cursor, Xcode/Gemini, Slack/Salesforce, and AgentCore.
17. Add approval-currentness fixtures where approval state diverges from current file/content revision.
18. Add policy-version drift fixtures for DLP/workspace/model-provider policies.
19. Add custom-store and nested-subagent evidence fixtures for coding-agent state.
20. Split runtime evidence admission into registry, identity/OBO, memory metadata, trace/replay, eval, filesystem/shell, and gateway evidence.

## Current Task Tree

```text
pm-substrate implementation frontier
|
+-- external evidence admission
|   |-- from: Arrowsmith v06-v07
|   `-- next proof: pure ExternalStateEvidence/EvidenceAdmissionReview with MCP handle, memory, workflow trace, and PM handoff fixtures
|
+-- memory admission metadata
|   |-- from: Arrowsmith v07
|   `-- next proof: deletion residue, observability-safe retention, source modality, and stale-information risk warnings
|
+-- workflow artifact run groups
|   |-- from: Arrowsmith v07
|   `-- next proof: stage omission, objective drift, error propagation, and gate outcome assertions across artifacts
|
+-- external validation evidence
|   |-- from: competitive intelligence v03
|   `-- next proof: third-party coding-agent validation evidence supports but cannot override state-review warnings
|
+-- model/provider policy evidence
|   |-- from: competitive intelligence v03
|   `-- next proof: retention/admin/ZDR policy mismatch blocks or warns for sensitive source refs
|
+-- approval-currentness evidence
|   |-- from: competitive intelligence v04
|   `-- next proof: approved revision/hash/scope mismatch produces warning or wouldBlock before action
|
+-- runtime evidence admission
|   |-- from: competitive intelligence v04
|   `-- next proof: registry/OBO identity/memory/trace/eval evidence is admitted but cannot override state-review failures
|
+-- custom-store and nested-agent evidence
|   |-- from: competitive intelligence v04
|   `-- next proof: store/subagent output must be fresh, declared, tenant-correct, and authority-bound before action
|
+-- client-surface origin tracking
|   |-- from: competitive intelligence v03
|   `-- next proof: client surface is recorded separately from source authority
|
+-- PM distributed-state evals
|   |-- from: Arrowsmith v06-v07
|   `-- next proof: expertise owner, source steward, escalation path, dependency agreement, and handoff-condition scenarios
|
`-- daily publish closure
    |-- from: Changelog 2026-06-09
    `-- next proof: automation run leaves local HEAD and origin/main equal with clean status, or records transport warnings
```

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
| L010 | 2026-06-08 | `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` | AI competitive-intelligence pending setup | First competitive-intelligence run found no fresh vendor proof of pm-substrate-equivalent operational-state artifacts; OpenAI/GitHub/Microsoft/Google/AWS are Medium to Medium-high control-plane threats, and ServiceNow is the highest direct overlap baseline. | Add artifact persistence plus client/plugin/provider/session metadata and cross-source authority evals. |
| L011 | 2026-06-08 | `research/daily-ai-competitive-intelligence/v02-ai-competitive-intelligence-2026-06-08.md` | L010 plus parallel local commit `bca9bda` reconciled with upstream `3a6d43f` | Preserved upstream v01 unchanged and added the local broader vendor scan as v02, escalating Atlassian, Asana, Cursor, Slack/Salesforce, and Cognition into the active watch set while keeping the complete `StateReviewArtifact` boundary unproven by vendors. | Continue from v02; inspect deeper technical docs for OpenAI/GitHub/AWS/Atlassian/Asana/Cursor/ServiceNow and implement persisted artifact fixtures. |
| L012 | 2026-06-08 | Code implementation: durable `StateReviewArtifact` lifecycle | L009 | Added canonical artifact metadata, deterministic JSON/JSONL export/import, replay hash validation, ArrowHedge corpus generation, continuity payload linkage, `state_review_artifact` eval refs, and artifact-derived eval metrics. | Expand corpus coverage, add DB/fixture equivalence, observed read-set capture, and invariant-class policy. |
| L013 | 2026-06-09 | `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md` | L009 plus L012 and later 2026-06-08 implementation commits | Corrected v05's stale implementation frontier, then added external evidence admission bridges from MCP tasks/tools, memory-search security, world models, monitoring benchmarks, provenance/authorization graphs, OpenLineage/FHIR/in-toto standards, and PM situation-awareness sources. | Add external evidence admission fixtures and PM dependency-structure agreement evals before claiming external mutation enforcement. |
| L014 | 2026-06-09 | `research/daily-ai-competitive-intelligence/v03-ai-competitive-intelligence-2026-06-09.md` | L011 plus L013 | Added official June 9 deltas for GitHub third-party coding-agent validation, Claude Fable 5 provider/model policy, Anthropic model availability, Google Gemini Apple/Xcode integration, OpenAI Codex adoption evidence, and AWS AgentCore runtime/eval pressure. | Add external validation evidence, model/provider policy, client-surface origin, and runtime-trace comparison fixtures. |
| L015 | 2026-06-10 | `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md` | L013 plus current code audit on `7cc0a33d` | Confirmed durable artifact/review primitives are implemented, then added shared verified context, observability-safe memory retention, deployment-time memorization, MCP explicit state handles, long-horizon workflow consistency, and PM/high-reliability coordination bridges. | Implement pure external evidence admission with MCP handle/annotation, memory deletion residue, workflow trace, clean ArrowHedge, and PM handoff fixtures. |
| L016 | 2026-06-10 | `research/daily-ai-competitive-intelligence/v04-ai-competitive-intelligence-2026-06-10.md` | L014 plus L015 and current code audit on `7cc0a33d` | Added June 10 evidence-lane deltas for GitHub Copilot CLI security review, OpenAI Agent Builder/Evals wind-down, Google ADK/Workspace approval-currentness and DLP policy mutation, AWS AgentCore registry/OBO/memory/trace/eval runtime lanes, Cursor custom stores/tools/subagents, and Asana/Atlassian watch updates. | Implement approval-currentness drift first, then external validation, provider-policy, runtime-evidence, and custom-store/subagent admission fixtures. |

## Open Watchlist

1. Continue daily AI competitive-intelligence monitoring for fresh primary evidence that vendors expose portable original-observation/read-set/action-review artifacts.
2. Inspect whether OpenAI, Anthropic, Microsoft, Google, AWS, ServiceNow, Atlassian, Asana, Cursor, Slack/Salesforce, or other major vendors are solving currentness, authority, provenance, workflow validity, and pre-action review, or only memory/RAG/context/session/workflow/audit.
3. Add external evidence admission fixtures for protocol/tool/task, memory, monitoring, lineage, audit, attestation, and PM handoff state.
4. Add clean accepted/current ArrowHedge artifact, MCP annotation/handle admission, memory deletion residue, workflow-stage omission, and PM handoff invalidation fixtures.
5. Add action-to-feedback and feedback-to-observation fixture cases beyond ArrowHedge before claiming full temporal-state coverage across surfaces.
6. Treat future merge conflicts, fetch failures, Git object warnings, or stale local research as evidence for the substrate thesis and record how they were reconciled.
7. Watch whether GitHub exposes machine-readable third-party-agent validation artifacts that can be admitted as external evidence.
8. Watch whether model providers expose retention/admin-policy metadata through APIs or action artifacts.
9. Re-check MCP release status before treating any 2026-07-28 release-candidate semantics as current protocol truth.
10. Watch whether Copilot CLI `/security-review` emits machine-readable artifacts or status refs.
11. Watch whether Google Drive approvals expose revision/hash/scope metadata sufficient for approval-currentness validation.
12. Watch whether AWS AgentCore trace/eval/memory/identity schemas can map into an external evidence admission contract.
13. Watch whether Cursor custom stores and nested subagents expose provenance/freshness metadata.

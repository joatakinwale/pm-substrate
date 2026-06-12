# pm-substrate Research Ledger

Last updated: 2026-06-12
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
| Agent-state Arrowsmith | `research/daily-arrowsmith-agent-state/index.md` | Active. v09 audited fast-forwarded `main` at `bb2c38d`, corrected v08's stale frontier after ArrowHedge state-review replay, write-binding replay, opt-in workflow gate, catalog verification, and the replay dashboard landed, and added bridges around memory evolution, executable tool wrappers, agentified evals, compiled corrections, memory compaction, environment engineering, runtime enforcement, and PM risk/status communication under uncertainty. | Promote the new fixture-backed verification catalog and transport-coverage slice into durable substrate stores and transport-wide runtime adoption, then continue live MCP revalidation, release budgets, policy-transition fixtures, judge recall, skill/compiled-rule evidence, and real PM handoff tests. |
| AI competitive intelligence | `research/daily-ai-competitive-intelligence/index.md` | Active. v01 baseline-plus-delta run found fast vendor movement in agent control planes, context expansion, enterprise plugin/tool governance, and evaluation; v02 preserved a parallel broader scan covering Atlassian, Asana, Cursor, Slack/Salesforce, Cognition, and deeper OpenAI/GitHub/AWS signals; v03 added June 9 official deltas for third-party coding-agent validation, model/provider policy, client-surface expansion, and runtime/eval pressure; v04 added June 10 evidence-lane deltas for Copilot CLI security review, Google approval-currentness/policy mutation, AWS AgentCore registry/OBO/memory/trace/eval lanes, OpenAI Agent Builder/Evals wind-down, and Cursor custom stores/subagents; v05 re-checked the 24-72 hour official window on June 11 and found no stronger contradiction, so the right next step stayed durable replay rather than new taxonomy; v06 added June 10-12 persistence/governance deltas for GitHub searchable sessions and Agentic Workflows, Google Vault Gemini retention/holds, AWS AgentCore persistent shells/workflow embedding, and OpenAI’s Ona acquisition for persistent Codex environments. | Keep vendor-runtime falsification tied to substrate-owned verification reuse: extend fixture-backed catalogs into durable stores, then continue live protocol/runtime checks against official technical docs. |
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
| C036 | A durable evidence lane needs committed replay artifacts, not only in-memory fixture passes. | Confirmed as pure-proof refinement | Daily Arrowsmith v08; competitive intelligence v05; 2026-06-11 committed admission-review corpus | Keep external-evidence claims tied to checked-in replay artifacts and extend the same standard to ArrowHedge on-disk corpora. |
| C037 | Agent privacy/release validity is trajectory-level, not per-output only. | Confirmed as research bridge | Agent-state Arrowsmith v08; OCELOT 2026-06-10 | Add release-budget fixtures with sink trust, data class, cumulative budget, release atoms, and declassification reason. |
| C038 | Fresh admitted evidence does not prove policy-transition conformance. | Confirmed as research bridge | Agent-state Arrowsmith v08; finite-state vs LLM action-policy paper 2026-06-10 | Add explicit policy-transition fixtures and metrics for prompt/model-induced action bias. |
| C039 | Automated judges need recall metrics for cross-turn state defects and gate-routing misses. | Confirmed as eval bridge | Agent-state Arrowsmith v08; Catching One in Five 2026-06-09 | Add state-defect recall and judge-routing miss metrics before relying on LLM judges for operational gates. |
| C040 | Skill documents are governance evidence when they influence action selection. | Confirmed as research bridge | Agent-state Arrowsmith v08; SkillAxe 2026-06-09 | Admit skill version, trigger, scope, owner, and fault-coverage metadata before skills silently expand valid action. |
| C041 | ArrowHedge state-review artifacts and write-binding attempts now have committed replay corpora. | Confirmed as pure/replay proof | Agent-state Arrowsmith v09; Changelog 2026-06-11 ArrowHedge corpus and write-binding replay entries | Keep drift tests as proof boundaries and use committed corpora as verification-catalog sources. |
| C042 | Opt-in workflow write binding can block selected writes, but not broad mutation governance. | Revised / partly confirmed | Agent-state Arrowsmith v09; `@pm/workflow` evidence binding and write-binding replay corpus | Measure transport coverage and durable catalog verification before claiming governed external mutation. |
| C043 | Executable tool wrappers can hide nested subcall read/write dependencies. | Confirmed as bridge | Agent-state Arrowsmith v09; HyperTool 2026-06-11 | Capture subcall read/write refs in observed read sets and evidence bindings. |
| C044 | Memory evolution and compaction are state-bearing evidence, not authority. | Confirmed as bridge | Agent-state Arrowsmith v09; EvoArena and MemRefine 2026-06-11 | Add patch, supersession, compaction, deletion-residue, and source-ref replay artifacts. |
| C045 | Compiled corrections and skills are governance evidence. | Confirmed as bridge | Agent-state Arrowsmith v09; TRACE 2026-06-11 plus SkillAxe carry-forward | Admit compiled rule/skill owner, trigger, scope, version, source, and fault coverage before runtime enforcement. |
| C046 | Runtime enforcement claims require monitorability/enforceability classification. | Confirmed as bridge | Agent-state Arrowsmith v09; Schneider, edit automata, Clark-Wilson, safety-progress runtime verification | Mark each invariant as pre-write enforceable, compensation-enforceable, monitorable-only, or offline-audit. |
| C047 | PM status, risk, and handoff updates are actions under uncertainty, not passive notes. | Confirmed as PM bridge | Agent-state Arrowsmith v09; shared mental-model project-team work, POMDP task updates, cognitive offloading | Review PM updates for source/owner agreement, risk capture, authority, stale status, and communication cost. |

## Current Implementation Frontier

Status note (2026-06-12): the previous 20-item frontier was implemented as pure tested primitives on 2026-06-10 in `@pm/agent-state` (`external-evidence.ts`), `@pm/evals` (`evidence-admission.ts`), and `@pm/capability-finance-research-ingest` (clean-current fixture). June 11 work committed replay corpora for evidence admission, ArrowHedge state-review artifacts, and write-binding attempts. The selected workflow runtime gate now blocks missing, incomplete, explicitly policy-blocked, and opt-in catalog-unverified evidence bindings before write-capable dispatch when `evidenceBindingMode: "require_for_writes"` is enabled. Today’s closure adds a fixture-backed verification catalog builder plus transport-coverage metrics; the stricter next proof is to promote those into durable stores and real transport-wide runtime adoption while capturing hidden subcall/memory/skill governance evidence before making broader mutation-governance claims.

Remaining frontier:

1. Expand the selected write-binding gate beyond the ArrowHedge replay/runtime fixture path: every write-capable capability transport must provide state-review artifact ids/hashes, evidence-admission review ids, and a policy disposition that is recomputed or verified against durable substrate stores before broad mutation-governance claims.
2. Promote the new fixture-backed `EvidenceBindingReferenceCatalog` sources from committed ArrowHedge state-review, evidence-admission, and write-binding JSONL into durable DB-backed or substrate-store-backed verification sources.
3. Expand the new transport coverage metrics beyond the fixture inventory so every real write-capable path is classified as `required_verified`, `advisory_only`, or `missing_provider`.
4. Exercise the MCP admission lane against a live MCP server (the fixture lane is pure; revalidation semantics against real handles/annotations are untested).
5. Run the write-binding corpus against a real DB-backed ArrowHedge workflow when `PM_DATABASE_URL` is available and compare it with the static JSONL replay stream.
6. Capture HyperTool-style nested tool subcall read/write refs so executable wrappers cannot hide dependencies from read-set validation.
7. Add memory evolution/compaction fixtures for patches, supersession, source refs, deletion residue, and compaction replay fidelity.
8. Add skill/compiled-rule governance fixtures for owner, trigger, scope, version, source, and fault coverage.
9. Run PM dependency-structure agreement (`comparePmHandoffAgreement`) over real multi-agent ArrowHedge runs, not synthetic facets, and add risk-capture/rediscovery/time-to-valid-action metrics.
10. Add trajectory release-budget fixtures before making privacy/release claims.
11. Add explicit policy-transition fixtures so admitted evidence cannot bypass workflow state machines or approval/escalation policy.
12. Add LLM-judge state-defect recall and judge-routing miss metrics.
13. Classify invariants by enforceability: pre-write enforceable, compensation-enforceable, monitorable-only, or offline-audit.
14. Track the rewrite-thesis instruments as ledger claims: ArrowHedge T1-T8 pass status and the 12 behavior metrics (time-to-plugin, substrate edit count, mapping coverage, etc.) — the plug-in half of the thesis has no research stream.
15. Competitive falsification attempts against vendor technical/SDK docs (ServiceNow dev portal, Atlassian Forge/Rovo, Asana developers) instead of press-release surfaces; add a plug-in-comparator scan (embedded iPaaS, schema-mapping vendors) against the zero-substrate-edit criterion.
16. ~~Update front-door docs (`README.md`, `docs/roadmap.md`, `docs/validation.md`) to the rewrite thesis so research and automation anchor on the current objective.~~ **Done 2026-06-10** — all four front-door docs rewritten (incl. `docs/architecture.md`); wedding-era packages removed from the workspace; validation re-anchored to ArrowHedge T1–T8 + 12 metrics (see Changelog "Wedding-era retirement").

## Current Task Tree

```text
pm-substrate implementation frontier (updated 2026-06-12, post-L020)
|
+-- external evidence admission ............ IMPLEMENTED (pure) 2026-06-10
|   `-- next proof: wire admission into capability/workflow write paths; live MCP revalidation
+-- memory admission metadata .............. IMPLEMENTED (pure) 2026-06-10
+-- workflow artifact run groups ........... IMPLEMENTED (pure) 2026-06-10
+-- external validation evidence ........... IMPLEMENTED (pure) 2026-06-10
+-- model/provider policy evidence ......... IMPLEMENTED (pure) 2026-06-10
+-- approval-currentness evidence .......... IMPLEMENTED (pure) 2026-06-10
+-- runtime evidence admission lanes ....... IMPLEMENTED (pure) 2026-06-10
+-- custom-store and nested-agent evidence . IMPLEMENTED (pure) 2026-06-10
+-- client-surface origin tracking ......... IMPLEMENTED (pure) 2026-06-10
+-- PM distributed-state evals ............. IMPLEMENTED (pure) 2026-06-10
|   `-- next proof: run comparePmHandoffAgreement over real multi-agent ArrowHedge runs
|
+-- selected runtime write binding ......... IMPLEMENTED (opt-in) 2026-06-11
|   |-- proof: workflow gate blocks missing, incomplete, and explicitly policy-blocked write bindings
|   `-- next proof: require the binding across every external write-capable transport
+-- golden fixture persistence ............. IMPLEMENTED 2026-06-11
|   |-- proof: admission corpus JSONL committed and replay-verified in tests
|   |-- proof: ArrowHedge state-review artifact JSONL committed and replay-verified in tests
|   `-- proof: write-binding replay JSONL committed and replay-verified in tests
+-- durable write-binding verification ..... IMPLEMENTED (fixture-backed) 2026-06-12
|   |-- proof: committed ArrowHedge/evidence-admission/write-binding JSONL now merge into EvidenceBindingReferenceCatalog
|   |-- proof: replay verification test preserves allowed, missing, incomplete, policy-blocked, and intentional hash-mismatch outcomes
|   `-- next proof: durable DB-backed or substrate-store-backed verification catalogs
+-- write-transport binding coverage ....... IMPLEMENTED (fixture-backed) 2026-06-12
|   |-- proof: coverage metrics now distinguish required_verified, advisory_only, and missing_provider write paths
|   `-- proof: fixture inventory includes a non-ArrowHedge agency write-capable transport
+-- nested tool read/write capture ......... NEW
|   `-- next proof: subcall refs for executable tool wrappers
+-- memory evolution/compaction artifacts .. NEW
|   `-- next proof: patch lineage, supersession, deletion residue, and compaction replay
+-- skill and compiled-rule governance ..... NEW
|   `-- next proof: owner/trigger/scope/version/source/fault-coverage evidence
+-- trajectory release budgets (NEW)
|   `-- next proof: cumulative disclosure fixtures with sink trust and declassification reason
+-- policy-transition conformance (NEW)
|   `-- next proof: fresh admitted evidence still cannot authorize invalid workflow transitions
+-- reviewer recall (NEW)
|   `-- next proof: state-defect recall and judge-routing miss metrics
+-- rewrite-thesis instruments (NEW)
|   `-- next proof: T1-T8 pass status and 12 behavior metrics tracked as ledger claims (plug-in half of thesis)
+-- front-door doc alignment (NEW)
|   `-- next proof: README/roadmap/validation describe the rewrite thesis
`-- daily publish closure
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
| L017 | 2026-06-10 | Code implementation: external evidence admission + contract v2 + fixture corpus (Changelog same date) | L015 + L016 frontier on `f9d95fe` | Implemented the full 20-item frontier as pure primitives: `ExternalStateEvidence`/`EvidenceAdmissionReview` with 22 evidence kinds and facet checks (approval-currentness, memory retention, provider policy, validation, workflow trace, PM handoff, OBO provenance-vs-authorization), `authorityStatus` fixed to `evidence_only`, observed-read-set bridging, 18-fixture deterministic admission corpus with metrics, artifact run groups, role projections, PM handoff agreement comparison, clean-current ArrowHedge baseline fixture, ObservationContract v2 binding warnings, and multi-object role preconditions. 38 new tests; full suite 279 passed; typecheck clean. | Wire admission into runtime write paths, persist golden JSONL fixtures, run PM agreement on real runs, track T1-T8 + 12 thesis metrics as claims, update front-door docs. |
| L018 | 2026-06-11 | Code implementation + daily continuation: committed evidence-admission replay corpus and Arrowsmith v08 | L017 plus v05/v08 audits on `bc716c8` and same-day rebase on `146ed07` | Verified remote `main`, reconciled a superseded dirty local external-evidence draft against the upstream June 10 landing, added `buildEvidenceAdmissionReviewCorpus()` + `serializeEvidenceAdmissionReviewsJsonl()`, committed `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl`, and added a drift test proving the committed corpus matches regenerated output. The final v08 also adds new bridges for trajectory leakage budgets, policy-transition drift, LLM-judge state-defect recall, skill-document governance, MCP handle semantics, and PM mental-model handoffs. Focused verification passed upstream: 41 tests and `tsc -b packages/evals`. | Consume admission reviews in runtime write paths, persist ArrowHedge on-disk corpus, add release-budget/policy-transition/judge-recall/skill fixtures, and push replay artifacts into broader CI. |
| L019 | 2026-06-12 | `research/daily-arrowsmith-agent-state/v09-agent-state-arrowsmith-2026-06-12.md` plus upstream code audit on `bb2c38d` | L018 plus June 11 ArrowHedge/write-binding/dashboard implementation landing | Fast-forwarded from `5bf4a67` to `bb2c38d`, corrected v08's stale frontier after ArrowHedge state-review corpus, write-binding replay corpus, opt-in workflow write-binding gate, catalog verifier, and replay dashboard landed. Added bridges from EvoArena, HyperTool, AgentBeats, TRACE correction enforcement, MemRefine, EurekAgent, EpiBench, runtime-enforcement foundations, shared mental-model project-team literature, POMDP task updates, and cognitive offloading. | Build durable verification catalogs/stores and transport coverage metrics; then continue live MCP, release-budget, policy-transition, judge-recall, skill/compiled-rule, memory-compaction, nested-tool, and real PM handoff proof. |
| L020 | 2026-06-12 | Competitive-intelligence v06 plus code implementation on `main` | L019 plus official 2026-06-10 to 2026-06-12 vendor review window | Added the June 12 competitive continuation, then converted the persistence/governance pressure from GitHub, Google, AWS, and OpenAI into a replay-corpora-backed `EvidenceBindingReferenceCatalog`, committed-corpus verification tests, and fixture-backed write-transport coverage metrics that include a non-ArrowHedge write path. | Promote fixture-backed verification catalogs into durable substrate stores, expand coverage metrics across all real write transports, and keep live runtime/session falsification ahead of new vendor taxonomy. |

## Open Watchlist

1. Continue daily AI competitive-intelligence monitoring for fresh primary evidence that vendors expose portable original-observation/read-set/action-review artifacts.
2. Inspect whether OpenAI, Anthropic, Microsoft, Google, AWS, ServiceNow, Atlassian, Asana, Cursor, Slack/Salesforce, or other major vendors are solving currentness, authority, provenance, workflow validity, and pre-action review, or only memory/RAG/context/session/workflow/audit.
3. Expand opt-in write binding across every external write transport and require durable catalog verification before claiming broad mutation enforcement.
4. Promote the new committed-corpus-backed verification catalogs into durable DB-backed or substrate-store-backed verification sources for state-review artifact ids/hashes, evidence-admission review ids, tenant/workflow binding, and rejected-evidence policy disposition.
5. Add trajectory release-budget, policy-transition conformance, and LLM-judge state-defect recall fixtures.
6. Treat future merge conflicts, fetch failures, Git object warnings, or stale local research as evidence for the substrate thesis and record how they were reconciled.
7. Watch whether GitHub exposes machine-readable third-party-agent validation artifacts that can be admitted as external evidence.
8. Watch whether model providers expose retention/admin-policy metadata through APIs or action artifacts.
9. Re-check MCP release status and SEP-2567 adoption in the dated spec before treating handle semantics as current protocol behavior.
10. Watch whether Copilot CLI `/security-review` emits machine-readable artifacts or status refs.
11. Watch whether Google Drive approvals expose revision/hash/scope metadata sufficient for approval-currentness validation.
12. Watch whether AWS AgentCore trace/eval/memory/identity schemas can map into an external evidence admission contract.
13. Watch whether Cursor custom stores and nested subagents expose provenance/freshness metadata.
14. Watch whether skill libraries expose version, trigger precision, scope, and fault-coverage metadata sufficient for substrate admission.
15. Watch whether executable tool wrappers expose nested subcall read/write refs or hide dependency edges behind a single outer call.
16. Watch whether memory-evolution and compaction systems expose source refs, supersession, deletion residue, and replayable patch histories.
17. Watch whether PM-oriented agent systems expose risk capture, source/owner agreement, escalation authority, and status-update cost as machine-readable evidence.

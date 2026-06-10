# Changelog

## 2026-06-10 - Daily AI competitive-intelligence v04

- Added `research/daily-ai-competitive-intelligence/v04-ai-competitive-intelligence-2026-06-10.md` as the fourth numbered daily competitive-intelligence continuation.
- Built on the fetched `main` state at `7cc0a33`, including the upstream `@pm/agent-state` artifact lifecycle closure and the concurrently present Arrowsmith v07 external-evidence frontier.
- Focused the fresh scan on official and primary-source deltas for GitHub Copilot CLI `/security-review`, OpenAI Agent Builder/Evals wind-down, Google Cloud ADK long-running approvals, Workspace Drive alignment approvals and DLP policy APIs, AWS AgentCore registry/OBO/memory/trace/eval runtime lanes, Cursor custom stores/tools/subagents, Asana Agentic Work Management, and Atlassian Teamwork Graph/Rovo.
- Kept the claim boundary strict: external validation, approval state, runtime traces, custom stores, work graphs, and policy APIs are evidence lanes, not replacements for current-state/read-set/source-authority/action-review artifacts.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with v04 source changes, claim deltas, threat updates, implementation implications, and a next action around approval-currentness drift.
- Sync note: initial `git fetch origin main` and fast-forward succeeded with repeated `non-monotonic index .git/objects/pack/._pack-...idx` warnings from AppleDouble pack-index files.

## 2026-06-10 - Daily agent-state Arrowsmith v07

- Added `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md` as the seventh numbered daily continuation.
- Confirmed against current code that `ActionProposalReview`, durable `StateReviewArtifact` JSON/JSONL export/import, hash replay, ArrowHedge temporal fixture corpora, artifact-derived metrics, observed read-set comparison, DB/fixture equivalence, continuity payload linkage, and invariant-class `wouldBlock` policy are implemented pure primitives.
- Added fresh June 8-10 bridge evidence from DeLM shared verified context, Workflow-GYM, T1-Bench, ActiveMem, observability-safe memory retention, deployment-time memorization, spatial-memory occlusion, H2HMem, SKILL.nb, ALEM, Emergence World, Consistency Illusion, and official MCP state-handle/tool-annotation sources.
- Added project-management and high-reliability bridges from Faraj/Xiao fast-response coordination, Bigley/Roberts incident command, Endsley situation awareness, Lewis transactive-memory measurement, Hsu et al. IS development TMS, and AHRQ handoff safety.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` so the current implementation frontier is pure external evidence admission: MCP/task/tool handles, memory retrieval/deletion residue, monitoring, lineage, audit, attestation, GUI/professional workflow traces, world-model predictions, and PM handoff artifacts must be admitted before action review can use them.
- Sync note: `git fetch --no-tags origin main` completed and `HEAD`, `origin/main`, and `FETCH_HEAD` all matched `7cc0a33dce5732b556cb323b6cf6dc3d4f80b487`, but Git emitted repeated `non-monotonic index .git/objects/pack/._pack-...idx` warnings from AppleDouble pack-index files.

## 2026-06-09 - Daily AI competitive-intelligence v03 and closure automation

- Added `research/daily-ai-competitive-intelligence/v03-ai-competitive-intelligence-2026-06-09.md` as the missing third numbered competitive-intelligence continuation.
- Focused the fresh scan on official 2026-06-08 to 2026-06-09 releases: GitHub third-party coding-agent security validation, Claude Fable 5 in GitHub Copilot, Anthropic Fable/Mythos availability, OpenAI Codex enterprise adoption evidence, Google Gemini Apple/Xcode integration, and AWS AgentCore runtime/eval carry-forward docs.
- Kept the claim boundary strict: third-party agent validation, provider/model policy, client surfaces, and runtime traces are evidence lanes, not replacements for pm-substrate current-state/read-set/source-authority/action-review artifacts.
- Added a dated implementation/test task tree for external validation evidence admission, model/provider policy evidence, client-surface origin tracking, runtime trace comparison, and daily publish closure.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with v03 source changes, claim deltas, implementation implications, and the current task tree.
- Installed the local Codex automation `pm-substrate-daily-research-publish-closure`, scheduled daily at 8:45 AM local time, to verify/fetch main, inspect uncommitted work, reconcile daily research, create the task tree, validate, commit, push, and re-check remote SHA.
- Repo transport note: a stale `git push --porcelain origin` process in this repo was blocking remote operations; after terminating it, `git ls-remote --heads origin main` verified remote `main` at `81d67a1cbfc7a00dcfd42c56c9249ca044f40278`, but full `git fetch --prune origin main` still hung and was terminated.

## 2026-06-09 - Daily agent-state Arrowsmith v06

- Added `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md` as the sixth numbered daily continuation, building directly from v05 and the same-day implementation commits on `main`.
- Audited the v05 watchlist against current code and corrected stale claims: durable `StateReviewArtifact` JSON/JSONL export/import, eval refs, observed read-set comparison, temporal misalignment fixtures, DB/fixture equivalence helpers, and invariant-class policy now exist as pure primitives.
- Shifted the active research frontier to external evidence admission: MCP/tool/task state, memory search, world-model predictions, monitoring events, lineage records, audit events, attestations, and PM handoff artifacts should be admitted as evidence before they influence valid action.
- Added new bridge evidence from text world models, SentinelBench, memory-search security, Agent libOS, AuthGraph, evidence tracing/provenance, AgentAtlas, VerifyMAS, MCP official docs, OpenLineage, FHIR Provenance/AuditEvent, in-toto/SLSA, human-AI situation awareness, shared mental-model measurement, boundary objects, and coordination theory.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` with v06 source changes, corrected/downgraded claims, implementation implications, metrics, and the next watchlist.
- Sync note: `git fetch origin main` and `git fetch --no-tags origin main` both failed with `fatal: mmap failed: Operation timed out`, but `git ls-remote origin refs/heads/main`, local `HEAD`, and local `origin/main` all matched `81d67a1cbfc7a00dcfd42c56c9249ca044f40278`, so no upstream merge delta or conflict was present before this research write.

## 2026-06-08 - Invariant-class policy matrix

- Added a pure `StateReviewInvariantClass` policy matrix in `@pm/agent-state` with explicit low/medium/high action consequences and advisory-vs-blocking recommendations.
- Kept `reviewProposedActionAgainstCurrentState()` default behavior advisory-only; policy evaluation is separate and reports `wouldBlock` recommendations without enforcing external mutations.
- Added eval artifact metrics for `policyWouldBlockArtifacts` and `wouldBlockByInvariantClass`, defaulting analysis to high-consequence policy while supporting explicit consequence and matrix inputs.
- Verification: TDD red pass failed on the missing policy evaluator and metric fields; green pass completed with focused agent-state/evals vitest coverage and both package typechecks.

## 2026-06-08 - ArrowHedge temporal fixture expansion

- Added deterministic ArrowHedge state-review artifact fixture cases for `observation_to_action`, `action_to_feedback`, and `feedback_to_observation`, each with distinct scenario ids, fixture metadata, eval ids, warning shapes, and invariant classes.
- Expanded ArrowHedge corpus and equivalence coverage so replayable JSONL, import validity, continuity payloads, warning codes, temporal phases, and invariant classes are checked across all three temporal misalignment phases.
- Added eval artifact phase coverage metrics with required, covered, missing, and coverage-rate fields while preserving the existing `artifactsByTemporalMisalignmentPhase` bucket counts.
- Verification: TDD red pass failed on the missing ArrowHedge fixture builder and missing metric coverage field; green pass completed with focused ArrowHedge/eval vitest coverage and both package typechecks.

## 2026-06-08 - Observed read-set capture

- Added pure observed-read-set comparison in `@pm/agent-state` so declared proposal read sets can be checked against tool/source reads without DB or runtime mutation enforcement.
- Warn-mode comparison now reports observed-but-undeclared refs, declared-but-unobserved refs, stale observed reads, authority mismatch, projection-version drift, and workflow-position drift.
- Threaded optional observed read-set samples and comparison output into `StateReviewArtifact` metadata while keeping v1 artifact imports backward-compatible when those fields are absent.
- Verification: red/green focused TDD pass on `packages/agent-state/src/index.test.ts`, plus `@pm/agent-state` typecheck.

## 2026-06-08 - ArrowHedge DB/fixture artifact equivalence

- Added an executable ArrowHedge `StateReviewArtifact` equivalence helper that compares canonical JSONL, import/replay hash validity, continuity ids/hashes, warning codes, temporal phase, and invariant classes across fixture and projected COP state.
- Added fixture-only coverage that runs without DB credentials, plus DB-gated integration coverage that compares the DB projection state against an in-memory fold when `PM_DATABASE_URL` is available.

## 2026-06-08 - StateReviewArtifact import hardening

- Hardened `StateReviewArtifact` import validation so malformed nested metadata, assertion, and warning shapes are rejected even when the canonical artifact hash is recomputed and replay hash validation passes.
- Scoped ArrowHedge `state_review_artifact` eval refs to their matching scenario instead of attaching artifact evidence to every substrate event in the suite.
- Review gates: fresh spec-compliance and code-quality subagents approved the Task A diff after focused verification.
- Verification: `pnpm vitest run packages/agent-state/src/index.test.ts packages/evals/src/arrowhedge.test.ts`, `pnpm -r --filter @pm/agent-state --filter @pm/evals run typecheck`, and `git diff --check`.

## 2026-06-08 - Superpowers plan stash repair

- Investigated `stash@{0}` and confirmed it contained only a deletion of the newer `docs/superpowers/plans/2026-05-27-three-axis-state-validation.md` plan, so applying it directly would lose the better copy.
- Canonicalized the plan as `docs/superpowers/plans/2026-05-27-three-axis-state-validation-pm-substrate.md`, removed the stale root-level duplicate, and added `docs/superpowers/plans/index.md`.

## 2026-06-08 - Durable StateReviewArtifact lifecycle

- Added canonical `StateReviewArtifact` metadata for temporal-misalignment phase, invariant class, scenario/fixture id, client surface, provider, session, workflow, and eval-event linkage.
- Added pure artifact persistence helpers in `@pm/agent-state`: deterministic JSON serialization, JSONL corpus export/import, replay hash verification, tamper reporting, and evidence-linked continuity payload generation from artifact id/hash.
- Added ArrowHedge state-review artifact corpus generation that emits replayable JSONL and continuity payloads from real proposal-review cases.
- Added `state_review_artifact` as a first-class eval reference kind, ArrowHedge eval substrate refs for artifact ids, and artifact-derived eval metrics for assertions, proposal reviews, hashes, temporal phases, and invariant classes.
- Verification: focused lifecycle suite passed across `@pm/agent-state`, ArrowHedge, and `@pm/evals`: 5 files / 47 tests.

## 2026-06-08 - Daily AI competitive-intelligence v02 reconciliation

- Resolved a same-day merge conflict after `origin/main` added `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` while a local competitive-intelligence run was active.
- Preserved upstream v01 unchanged and added the local broader vendor scan as `research/daily-ai-competitive-intelligence/v02-ai-competitive-intelligence-2026-06-08.md`.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with the reconciliation, expanded watchlist, implementation implications, and next sequential continuation point.

## 2026-06-08 - Daily AI competitive-intelligence v01

- Added `research/daily-ai-competitive-intelligence/v01-ai-competitive-intelligence-2026-06-08.md` as the first numbered competitive-intelligence continuation for `pm-substrate`.
- Reconciled the new upstream daily Arrowsmith v05 research before writing, preserving the current frontier: pure state-review primitives exist, while persisted/exported artifacts, artifact-to-eval linkage, observed read sets, temporal-phase fixtures, and targeted policy remain open.
- Compared fresh official-source changes from OpenAI, Anthropic, Microsoft/GitHub, Google, AWS, and ServiceNow against the operational-state thesis.
- Marked OpenAI/GitHub/Microsoft/Google/AWS as active Medium to Medium-high control-plane and context/runtime threats, while keeping ServiceNow as the highest direct overlap baseline because its Action Fabric/Context Engine/AI Control Tower positioning most closely matches governed enterprise action.
- Updated `research/daily-ai-competitive-intelligence/index.md` and `research/index.md` with v01 deltas, downgraded claims, implementation implications, and next-day watchlist items.

## 2026-06-08 - Daily agent-state Arrowsmith v05

- Added `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md` as the fifth numbered daily continuation, building on v04 rather than restarting the agent-state thesis.
- Audited the current repo and kept the active code frontier unchanged: pure `StateReviewArtifact`, ArrowHedge artifact construction, hash replay, and artifact metrics exist, while persisted/exported JSON artifacts, artifact-to-eval-event linkage, observed read sets, DB/fixture equivalence, and invariant-class policy remain open.
- Added recent bridge evidence from AdaPlanBench, TIDE temporal state misalignment, LOCOMO-CONV, H-CSC, TRACE, DuMate-DeepResearch, Tree-of-Experience, OPENPATH, and encrypted multi-agent control.
- Added foundational mechanisms from Chandy-Lamport snapshots, optimistic concurrency control, sagas, transactive memory, expertise coordination, organizational coordination, and common operational picture/common situational understanding research.
- Updated `research/daily-arrowsmith-agent-state/index.md` and `research/index.md` so the next code slice is deterministic ArrowHedge JSON state-review artifacts with temporal-misalignment fixture metadata before any mutation-blocking claim.

## 2026-06-07 — Research ledger and automation sync protocol

- Fetched and fast-forwarded from `origin/main` before continuing local research updates, bringing in the latest state-review artifact implementation and canonical 2026-06-06 v03 research.
- Reconciled the local daily Arrowsmith v04 research with the fetched `main` state: `StateReviewArtifact` is now treated as an implemented pure primitive, while generated JSON/JSONL artifacts, replay, DB/fixture equivalence, and policy integration remain the next proof boundary.
- Added `research/index.md` as the top-level research ledger across daily research streams, including run protocol, claim ledger, current implementation frontier, and ledger entries.
- Resolved the daily Arrowsmith index conflict by preserving the remote canonical v03 and v04, preserving the unsynced local v03 as a superseded local branch artifact, and moving synchronization requirements into the indexes and top-level ledger.
- Updated the daily research direction so automations must fetch/pull `main`, inspect new research/code, update the chain-specific index and top-level ledger, then commit and push back to `main`.

## 2026-06-05 — Daily agent-state Arrowsmith v03

- Added `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-05.md` as the third numbered daily continuation, building on v02 rather than restarting the agent-state thesis.
- Added new 24-72 hour bridges from CollabSim, ALMANAC, MAGE, MemGate, PACT, WebMCP tool-surface poisoning, HarnessFix, ToolMaze, TRIAD, and the self-correction role-label paper.
- Strengthened the implementation direction around replayable JSON state-review artifacts: `currentStateView`, original `observationContract`, assertion evaluation, read-set validation, `ActionProposalReview`, warning policy, source refs, fixture id, and eval maturity.
- Downgraded semantic-similarity memory, protocolized agent communication, tool metadata, and guardrail feedback as authority unless bound to substrate refs, freshness, source authority, lifecycle, and deterministic validation.
- Updated `research/daily-arrowsmith-agent-state/index.md` with the v03 version row, source changes, corrected claims, downgraded claims, metrics queue, and next-day implementation watchlist.

## 2026-06-02 — Codebase review and workspace/agent-state research kickoff

- Reviewed the pm-substrate architecture, validation framework, three-axis state-validation plan, state-failure taxonomy, agent-continuity ADRs, continuity/eval packages, workflow gates, event provenance, graph staleness helpers, and the existing external landscape research draft.
- Verified the codebase is a real substrate implementation rather than only thesis material: graph/events/registry/workflow/projections/profile/capability/continuity/eval packages compile and run against local Postgres.
- Installed dependencies, built the monorepo, started local Postgres, applied 16 migrations, seeded `tenant_dev`, and ran the full DB-backed suite: 43 test files and 320 tests passed.
- Noted review findings for the next work slice: clean-clone `pnpm test` fails until `pnpm build` creates package entry outputs; local tests skip most integration proof without `PM_DATABASE_URL`; continuity contradiction detection is intentionally simple and must evolve before it can prove robust authority-aware agent memory; the next decisive research step is paired baseline/substrate evals against stateful external benchmarks such as STATE-Bench.
- Started independent external verification of the workspace and agent-state problem space. Current source direction supports the substrate thesis: multi-agent failures are increasingly framed as coordination/state failures, memory benchmarks emphasize behavior under changing state, blackboard-style shared state is reappearing in LLM MAS research, and Palantir Ontology validates the enterprise shared-world-model pattern while leaving room for a lighter open/profile-driven substrate.

## 2026-06-02 — Local-lab paired evals and Arrowsmith bridge

- Added deterministic local-lab paired evals in `@pm/evals`: stale memory after source update, wrong source authority conflict, and invalid workflow step after plan mutation.
- Mapped the local-lab scenarios to STATE-Bench-style categories: `stateful`, `user_experience`, and `procedural_execution`, with separate memory-benchmark bridge labels for `knowledge_update`, `abstention`, and workflow rebase behavior.
- Added `db/migrations/0017_eval_events.sql` so `evals.eval_events` is created by the root migration runner instead of only package-local SQL.
- Added `pnpm evals:local-lab`, which emits paired baseline/substrate eval events and persists them when `PM_DATABASE_URL` is set.
- Ran the local-lab eval suite against Postgres after applying migration `0017`: 3 scenarios, 6 events, baseline failures 3, substrate failures 0, failure reduction 3, and 6 persisted `local_lab` eval rows.
- Added `research/local-lab-state-bench-arrowsmith_2026-06-02.md`, connecting the first local-lab eval categories to current peer-reviewed/venue-accepted memory-agent and MAS evaluation work.

## 2026-06-03 — First-principles agent-state and interoperability research

- Added `research/first-principles-agent-state-interoperability_2026-06-03.md`.
- Connected pm-substrate to first-principles state literature: partial observability/POMDPs, belief-state discipline, memory-agent benchmark competencies, multi-agent failure attribution, semantic interoperability, object-centric event logs, shared mental models, transactive memory, and project-success communication research.
- Clarified the strongest thesis wording: pm-substrate is an agentic operational-state substrate under partial observability, not merely an AI memory layer.
- Identified the next proof gaps: structured taxonomy fields on eval events, complete tool-onboarding adapter proof, shared-state dashboard scenario, attribution benchmark, and explicit MCP/A2A protocol positioning.

## 2026-06-03 — Cross-disciplinary state and interoperability research

- Added `research/cross-disciplinary-state-interoperability-arrowsmith_2026-06-03.md`.
- Compared pm-substrate's state/interoperability problem against control theory, robotics/SLAM, data assimilation, power systems, distributed consensus, CRDTs, Internet routing, software observability, healthcare, industrial automation, supply chain, cybersecurity, emergency response, aviation, systems engineering, biology, social insects, and swarm behavior.
- Extracted the shared solution pattern across mature disciplines: observations, current state or estimate, semantic contracts, authority policy, and feedback/reconciliation loops.
- Ranked the most transferable mechanisms for pm-substrate: estimator-style projection metadata, profile-driven adapters, CRDT-vs-gate event classification, trace-context capability attribution, common-operating-picture project surfaces, quorum gates, and substrate-as-environment coordination.

## 2026-06-03 — Eval taxonomy and coordination-class implementation

- Promoted local-lab benchmark labels from prose notes into structured `EvalEvent` fields: `stateBenchCategory`, `memoryBenchmarkBridge`, `mastCategory`, and `coordinationClass`.
- Added the first executable cross-disciplinary implementation hook from the research: coordination classes for append-only observations, convergent updates, authority-gated transitions, and derived projections.
- Persisted the new eval taxonomy fields as queryable columns via `db/migrations/0018_eval_event_taxonomy.sql` and the package-local eval migration.
- Updated local-lab paired evals and docs so future adapter, trace-attribution, CRDT-vs-gate, and common-operating-picture experiments can measure against structured metadata rather than notes parsing.
- Added `analyzeEvalEvents()` in `@pm/evals` to compute paired failure reduction, incomplete paired groups, taxonomy coverage, coordination-class outcomes, authority-gate pass rate, and convergent-update auto-resolution rate from emitted eval events.
- Wired `runLocalLabPairedEvals()` and `pnpm evals:local-lab` through the analyzer so the local-lab harness now reports executable coordination metrics, not just scenario counts.

## 2026-06-03 — Adapter state-proof implementation checkpoint

- Began the Real Tool Onboarding + Operational State Proof phase as code: `source rows → mapping validation → deterministic graph node inputs → typed adapter events`.
- Added `planEntityIngestion()` in `@pm/entity-mapping`, keeping the package dependency-light by structurally mirroring event-publish input instead of importing the event store.
- Made ingestion plans atomic: invalid profile mappings, unknown source entities, or missing deterministic entity IDs return validation issues and zero planned writes.
- Added focused TDD coverage for graph-ready node planning, typed `adapter.entity_mapped` event payloads, `idForRecord` deterministic ID generation, and missing-ID rejection.
- Review checkpoint: the planner preserves the existing hot-path rule that `applyMapping()` itself does not revalidate per row, while giving onboarding harnesses a single validated plan boundary before writes.
- Added a DB-backed adapter state-proof test for the agency profile: a validated mapping plan creates graph nodes and publishes `adapter.entity_mapped` events inside one Postgres transaction, verifies the event hash chain, and catches up a projection into shared adapter state.
- Research/review checkpoint: the executable proof now matches the cross-disciplinary pattern from the Arrowsmith pass — semantic contract, deterministic observation, append-only provenance, and derived projection — but still needs eval-event measurement so representation-loss claims are quantified.
- Added failure-class buckets to `analyzeEvalEvents()` so paired evals now report reductions for classes like `representation_loss`, not only global failure reduction or coordination-class metrics.
- Added `buildAdapterStateProofEvalPair()` in `@pm/evals` to emit a marketing-axis paired baseline/substrate eval for source-to-projection onboarding.
- Wired the DB-backed adapter state-proof test through the eval helper: the same graph nodes, adapter events, and projection name become substrate refs, and the analyzer verifies a `representation_loss` failure reduction of 1 for the adapter proof.

## 2026-06-03 — ArrowHedge adapter and Common Operating Picture phase

- Corrected the prior scope gap: the agency adapter proof was only the first spine, not the full ArrowHedge/high-consequence phase.
- Added the ArrowHedge finance adapter surface in `@pm/capability-finance-research-ingest`: strict source snapshot parsing, deterministic source-record IDs, finance-research entity mapping, semantic profile validation, graph edge planning, typed finance events, and an executor port that can create or update graph nodes, create edges, and publish events in one caller-managed transaction.
- Added the first ArrowHedge Common Operating Picture projection: typed finance events fold into per-ticker signal, risk, decision, authority-gate, stale-block, and state-disagreement state.
- Added ArrowHedge paired eval scenarios for `representation_loss`, `source_authority_conflict`, `stale_observation`, `workflow_invalidation`, and `capability_contract_violation`. The contract-violation substrate arm intentionally remains a measured failure until runtime payload JSON-schema validation is implemented at this boundary.
- Added adapter operational metrics in `@pm/evals`: `adapterTimeToFirstValidEventMs`, `mappingRejectionRate`, `stateDisagreementRate`, and authority-gated pass/fail counts/rate derived from eval events.
- Review checkpoint: the first implementation attempted a direct production import of `@pm/profile-finance-research` from the capability package. The registry isolation guard correctly rejected it, so the adapter now injects `ProfileDefinition` through the plan context and keeps the concrete profile import in tests only.
- Fixed the entity-mapping structural validator to accept lowercase hyphenated profile prefixes in edge types, matching the existing `finance-research` profile while preserving snake_case local edge names.
- Verification: focused ArrowHedge/entity-mapping/eval tests pass, root build passes, and non-DB `pnpm test` passes with 27 files / 196 tests and 143 Postgres-dependent tests skipped. DB-backed ArrowHedge COP proof exists but live execution is blocked in this shell because Docker/Postgres is not running (`Cannot connect to the Docker daemon`).

## 2026-06-03 — ArrowHedge runtime contract closure

- Closed the measured `capability_contract_violation` debt with executable payload-schema validation inside `@pm/capability-finance-research-ingest`, loading the package's existing `schemas/*.json` files as the runtime contract source.
- Filled ArrowHedge typed finance events with the canonical capability IDs their schemas require: `researchRunId`, `tickerId`, `decisionId`, `riskStateId`, `blockedEntityId`, and evidence document IDs where applicable, while preserving projection-facing adapter fields.
- Added a defensive executor gate so malformed typed finance payloads are rejected before graph/event writes are attempted, even if a caller mutates a valid plan.
- Updated the ArrowHedge eval suite so the contract-violation substrate arm now passes because runtime validation rejects malformed payloads before publication.
- Verification: focused ArrowHedge/eval tests pass, registry-isolation/metrics/ArrowHedge slice passes, root build passes, compiled package import passes, and non-DB `pnpm test` passes with 27 files / 198 tests and 143 Postgres-dependent tests skipped. DB-backed ArrowHedge COP proof remains blocked in this shell because `pnpm db:up` cannot connect to the local Docker daemon.

## 2026-06-04 — Agent-from-numbers first-principles research

- Added `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md`, decomposing an LLM agent from numbers, random variables, statistical learning, model weights, transformer inference, context, memory, tools, and agent loops up to multi-actor operational state.
- Identified the main state-origin finding: model weights are parametric state, prompts are transient inference state, memories are retrieval state, and the agent-state problem begins when any of those are treated as current, sufficient, authoritative operational state for action.
- Extended the Arrowsmith bridge set with statistical learning, POMDPs, Kalman/state estimation, RAG, ReAct, generative-agent memory, QuBE belief-state construction, memory-agent benchmarks, stale-memory benchmarks, and multi-agent failure taxonomies.
- Proposed falsifiable follow-up hypotheses around distribution-currentness mismatch, prompt-context-vs-belief-state tests, evidence-linked continuity, read-set validation, and Common Operating Picture reconciliation.
- Verification: `git diff --check` passed; document review confirmed the new research file is present and the worktree contains only the research note plus this changelog entry.

## 2026-06-05 — Daily agent-state Arrowsmith v01

- Added `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` as the first numbered daily continuation from the June 4 first-principles note.
- Added `research/daily-arrowsmith-agent-state/index.md` so future daily runs can continue from a single version index instead of restarting from unnumbered research files.
- Strengthened the substrate thesis with new 2026 bridges: STALE implicit memory invalidation, useful-memory consolidation regression, ContractBench observation contracts, STATE-Bench/Claw-Eval-Live stateful workflow grading, and PM shared-cognition/transactive-memory implications.
- Downgraded RAG-only, bigger-context, continuous-memory-rewrite, protocol-only, and chat-as-COP claims where sources do not support operational authority.
- Proposed the next measurable implementation spine: `current_state_view`, `observation_contract`, read-set validation, raw-episode preservation, and state/assertion-based eval metrics.

## 2026-06-05 — Agent-state current view and read-set implementation

- Added the pure `@pm/agent-state` package with reusable `CurrentStateView`, `StateRef`, `ProposedAction`, `ReadSetEntry`, warn-first `ReadSetValidationDecision`, and evidence-linked continuity payload contracts.
- Implemented deterministic read-set construction and warn-first validation for stale reads, missing required refs, authority drift, projection-version drift, workflow-position mismatch, tenant mismatch, action mismatch, and current-view conflicts.
- Extended ArrowHedge COP state so ticker projections retain source event IDs, graph entity IDs, evidence document refs, authorities, observation timestamps, risk freshness, and decision snapshot provenance.
- Added ArrowHedge `current_state_view` builders for ticker COP state, including source refs, risk freshness `validUntil`, authority rule, workflow position, conflict list, and action contracts for `portfolio.decision.accept`, `workflow.block`, and `risk.refresh`.
- Added the distribution-currentness mismatch eval path under `stale_observation`; the substrate arm now passes only when warn-first read-set validation emits the required warning before action, with no v1 mutation-blocking claim.
- Added the evidence-linked continuity payload convention test showing checkpoints can cite `sourceRefs`, `validUntil`, `supersedes`, `contradictedBy`, `authorityRule`, and `currentStateViewId` without changing continuity storage.
- Verification: focused tests pass for `@pm/agent-state`, ArrowHedge COP/current-state views, ArrowHedge evals, and continuity payload convention: 4 files / 15 tests.

## 2026-06-05 — Observation contracts and state assertion metrics

- Extended `@pm/agent-state` with `ObservationContract`, `StateAssertion`, and pure helpers to derive an observation contract from a `CurrentStateView` and evaluate it later against current state.
- Added assertion outcomes for required source refs, authority rule, freshness window, projection version, workflow position, declared conflicts, and declared missing sources.
- Added ArrowHedge observation reports: COP ticker state can now produce `currentStateView`, `observationContract`, and assertion `evaluation` in one typed report.
- Added `analyzeStateAssertions()` in `@pm/evals` so assertion output becomes measurable by total/pass/fail count, pass rate, and failed buckets by assertion code and severity.
- Verification: focused continuation tests pass for agent-state observation contracts, ArrowHedge observation reports, and eval assertion metrics: 3 files / 19 tests.

## 2026-06-05 — Action proposal review artifact

- Added `ActionProposalReview` in `@pm/agent-state`, combining the proposed action, current-state view, observation contract evaluation, read-set validation, normalized warnings, and explicit warn-first execution disposition.
- Added `reviewProposedActionAgainstCurrentState()` so action proposals can be reviewed through one pure pre-execution boundary while preserving the v1 rule that warnings do not block execution.
- Added `buildArrowHedgeProposalReview()` so ArrowHedge COP ticker state can produce a proposal-review artifact directly from a portfolio action proposal.
- Added `analyzeActionProposalReviews()` in `@pm/evals` to measure review validity, allowed/blocking disposition, warning count, and warnings by source, code, and severity.
- Verification: focused tests pass for action proposal reviews, ArrowHedge proposal-review generation, and proposal-review metrics: 3 files / 23 tests.

## 2026-06-05 — Proposal review hardening and proof maturity labels

- Added `subject_mismatch` read-set validation so an action cannot cite one current-state read-set while targeting another subject.
- Made proposal review explicitly advisory by default with `enforcementMode: "advisory"` and support for a future `"blocking"` mode, preserving warn-first v1 without implying mutation enforcement.
- Fixed the observation-contract tautology in the proposal-review path: callers can now pass the agent's original observation contract/read-set, and review compares that prior observation against the current state view.
- Added ArrowHedge `evaluatedAt`/as-of current-state evaluation so risk freshness, conflicts, and workflow position are computed at proposal time rather than only at latest event time.
- Added eval evidence maturity stages (`scaffolded_scenario`, `detected_warning`, `blocked_mutation`, `paired_behavioral_improvement`) and evidence-adjusted failure-reduction metrics so scaffolded/pass-by-spec scenarios remain visible without being counted as behavioral proof.
- Verification: focused agent-state, ArrowHedge, and eval tests pass after rebuilding package outputs; sequential package build and `git diff --check` pass. DB-backed integration execution remains an environment boundary when local Postgres is unavailable.

## 2026-06-06 — Daily agent-state Arrowsmith v03

- Added `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md` as the third numbered daily continuation.
- Audited v02 against the current repo and downgraded several v02 TODOs from open implementation gaps to closed pure primitives: `subject_mismatch`, original-observation proposal review, `evaluatedAt`, explicit advisory/blocking mode, and evidence maturity stages.
- Shifted the next research frontier to durable state-review artifacts: provenance/event envelopes, trace correlation, object-centric refs, artifact replay, benchmark audit, and invariant-class policy gating.
- Added project-management bridges from socio-technical congruence, transactive memory, ISO 21502, Team Situation Awareness, and human-AI mental-model work, with explicit limits on what each source proves.
- Updated `research/daily-arrowsmith-agent-state/index.md` with v03, corrected stale claims, new source changes, implementation implications, metrics, and the next-day watchlist.
- Verification: required-section scan and `git diff --check` pass. No code tests were run because this slice only changes research/changelog Markdown.

## 2026-06-06 — Research-to-runtime state-review artifacts

- Reviewed the full `research/` corpus for findings that required code, not documentation, and identified the active runtime gap: proposal reviews existed only as in-memory objects, while the newest Arrowsmith findings require durable, replayable, provenance-linked state-review artifacts.
- Added `StateReviewArtifact` logic in `@pm/agent-state`: deterministic artifact envelopes, trace context, related object roles, PROV-style links, canonical artifact fingerprinting, and replay hash verification around existing `ActionProposalReview` output.
- Added ArrowHedge `buildArrowHedgeStateReviewArtifact()` so finance COP proposal reviews can emit the artifact directly with ticker provenance and source-specific event metadata.
- Added eval metrics for state-review artifacts: hash verification rate, trace-link coverage, object-role coverage, warning buckets, advisory/blocking counts, and artifact source/type counts.
- Added focused tests for artifact construction, tamper detection, ArrowHedge artifact generation, and artifact metric summaries.
- Verification: `git diff --check` passes. TypeScript/Vitest runners in this shell hang even on unchanged packages and version/module-load checks, so compile/test execution is recorded as environment-blocked rather than passed.

## 2026-06-07 - Daily agent-state Arrowsmith v04

- Added `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md` as the fourth numbered daily continuation.
- Audited v03 against the current runtime code and downgraded artifact-shape TODOs from open research work to closed pure primitives: `StateReviewArtifact`, ArrowHedge artifact generation, canonical hash replay verification, related object roles, trace context, PROV-style links, and artifact metrics now exist.
- Shifted the active research frontier to artifact lifecycle and policy use: persisted/exported JSON artifacts, schema validation, artifact-derived eval events, continuity lineage, observed read-set capture, observation-contract integrity/binding fields, and targeted invariant-class blocking.
- Added new bridge evidence from S-Bus source/formals/benchmark artifacts, Claw-Eval-Live released task/fixture/grader/trace architecture, Silo-Bench coordination-reasoning metrics, the June 2026 agent provenance survey, HTTP/OAuth standards, coordination-requirement scalability, and team situation-awareness measurement.
- Updated `research/daily-arrowsmith-agent-state/index.md` with v04, source changes, corrected stale claims, new metrics, current implementation implications, next-day watchlist, and the fetch/reconcile/push collaboration protocol for future daily runs.

## 2026-06-07 - Daily AI competitive-intelligence automation

- Installed the local Codex automation config for `daily-ai-competitive-intelligence`, scheduled daily at 7:30 AM America/Chicago against `/Users/emmanuelakinwale/Desktop/pm-substrate`.
- Reconciled the newly fetched research-ledger commit from `origin/main`, which already created `research/daily-ai-competitive-intelligence/index.md` and `research/index.md`, rather than starting a duplicate research stream.
- Updated the competitive-intelligence index and top-level research ledger to record that the stream has a local automation config installed and that the first versioned run remains pending.

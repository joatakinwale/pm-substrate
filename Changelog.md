# Changelog

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

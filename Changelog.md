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

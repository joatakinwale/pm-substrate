# First-Principles Agent State And Business Interoperability Research

Date: 2026-06-03
Method: Research Arrowsmith open discovery
Status: thesis support and gap map

## Research Question

Are there peer-reviewed or primary research sources trying to solve the same underlying problem as pm-substrate: agents, people, teams, and tools fail because they act from partial, stale, conflicting, unauthoritative, or non-shared state?

Short answer: yes. The exact product shape is not common, but the first-principles components are converging from several directions.

## A/B/C Framing

- **A problem:** AI agents and business teams choose actions from local, stale, partial, or ungrounded views of a changing workspace.
- **B bridge concepts:** latent state, belief state, provenance, semantic contracts, shared blackboard, object-centric event log, shared mental model, transactive memory, failure attribution, source authority.
- **C literatures:** POMDP/state estimation, agent memory benchmarks, multi-agent failure taxonomies, semantic interoperability/data contracts, object-centric process mining, project-management communication and team cognition.

## Source Map

### Agent / AI State From First Principles

1. **A primer on partially observable Markov decision processes (POMDPs)**, peer-reviewed review article.
   - Source: https://research.monash.edu/en/publications/a-primer-on-partially-observable-markov-decision-processes-pomdps
   - Why it matters: POMDPs define the first-principles problem: the actor must choose sequential actions when true state is imperfectly observed.
   - Substrate read: an agent prompt is not state. It is an observation. The substrate should preserve observations, timestamps, authority, and uncertainty so the actor can choose a valid action.

2. **Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions**, ICLR 2026 poster.
   - Source: https://openreview.net/forum?id=DT7JyQC3MR
   - Why it matters: MemoryAgentBench argues memory agents need accurate retrieval, test-time learning, long-range understanding, and selective forgetting.
   - Substrate read: continuity is only useful if it updates, forgets/supersedes, and helps action under changed state.

3. **QuBE: Question-based Belief Enhancement for Agentic LLM Reasoning**, EMNLP 2024.
   - Source: https://aclanthology.org/2024.emnlp-main.1193/
   - Why it matters: agentic LLMs suffer reasoning derailment in partially observable environments when observations are incorporated indiscriminately.
   - Substrate read: the fix is not "more context"; it is better belief-state discipline around what was observed, what remains uncertain, and what should be queried.

4. **Why Do Multi-Agent LLM Systems Fail?**, MAST, OpenReview / 2025.
   - Source: https://openreview.net/forum?id=fAjbYBmonr
   - Why it matters: MAST identifies failures across system design, inter-agent misalignment, and task verification, with 1600+ annotated traces.
   - Substrate read: this is the agentic equivalent of cross-functional project failure. The failure is not only the intelligence of each actor; it is the coordination medium and verification structure.

5. **Which Agent Causes Task Failures and When?**, ICML 2025 spotlight poster.
   - Source: https://openreview.net/forum?id=GazlTYxZss
   - Why it matters: failure attribution across agent teams is hard; the best reported method still struggles to identify responsible steps.
   - Substrate read: event causality, workflow run ids, capability invocation ids, and provenance are not audit vanity. They are the evidence needed to debug multi-actor work.

6. **LLM-based Multi-Agent Blackboard System for Information Discovery in Data Science**, 2025.
   - Source: https://huggingface.co/papers/2510.01285
   - Why it matters: a shared blackboard lets agents volunteer based on the shared workspace rather than depend on rigid master-slave orchestration; reported gains are 13-57% over baselines.
   - Substrate read: pm-substrate is a governed, typed, durable blackboard for business operations, not just chat memory.

## Business Tool Interoperability Sources

1. **Semantic and LLM-Enhanced Data Integration for FAIR-Compliant B2B and B2G Ecosystems**, Procedia Computer Science 2025.
   - Source: https://www.sciencedirect.com/science/article/pii/S1877050925030005
   - Why it matters: combines ETL, Semantic Web, schema mapping, and LLM-assisted vocabulary suggestions for B2B/B2G data sharing.
   - Substrate read: onboarding a business tool should be adapter/mapping/contract-driven: map source records into profile entities, validate, then emit typed events.

2. **Using large language models for semantic interoperability: A systematic literature review**, ICT Express 2025.
   - Source: https://www.sciencedirect.com/science/article/pii/S240595952500092X
   - Why it matters: LLMs can assist schema alignment and knowledge integration, but security and reliability remain risks.
   - Substrate read: LLM mapping should be proposal-first, never silent authority. Deterministic profile validation must remain the gate.

3. **ISO/IEC 11179-1:2023 Metadata Registries**, international standard.
   - Source: https://www.iso.org/standard/78914.html
   - Why it matters: defines metadata registry framing for describing data and associating parts of data standards.
   - Substrate read: profiles and capability contracts are metadata-registry-like: they make business meaning inspectable and reusable.

4. **W3C PROV**, W3C provenance standard.
   - Source: https://www.w3.org/TR/prov-overview/
   - Why it matters: represents entities, activities, agents, derivation, and responsibility.
   - Substrate read: for agents and business tools, every important claim should answer "what source, what actor, what activity, what derivation?"

5. **OCEL 2.0 Specification**, object-centric event log standard.
   - Source: https://www.ocel-standard.org/specification/overview/
   - Why it matters: real processes involve multiple interacting objects, not one clean case id.
   - Substrate read: a project layer needs object-centric process state: project, client, invoice, contract, task, message, document, and resource can all be involved in one transition.

## Project Success / Communication Literature

1. **How do project managers' competencies impact project success? A systematic literature review**, PLOS One 2023.
   - Source: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0295417
   - Why it matters: communication, leadership, interpersonal relations, conflict management, and teamwork are associated with project success; communication shows strong relationship with stakeholder satisfaction and general project-success measures in several included studies.
   - Substrate read: the project layer should not merely store project tasks. It should maintain the shared operational state that lets teams communicate through evidence, current workflow, and source authority.

2. **The role of shared mental models in human-AI teams**, Theoretical Issues in Ergonomics Science 2022.
   - Source: https://www.tandfonline.com/doi/abs/10.1080/1463922X.2022.2061080
   - Why it matters: shared mental models are tied to improved team performance and are extended to human-AI teams.
   - Substrate read: pm-substrate is a machine-maintained shared mental model: not everything in people's heads, but enough current, admissible operational state for valid action.

3. **The dynamic impacts of shared leadership and the transactive memory system on team performance**, Journal of Business Research 2021.
   - Source: https://www.sciencedirect.com/science/article/pii/S0148296321001600
   - Why it matters: transactive memory systems mediate team performance over a project life cycle.
   - Substrate read: a business needs to know who knows what, which source owns which fact, and which event proves it. That is transactive memory made queryable.

## Arrowsmith Matrix

| A problem | B bridge | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agent acts on wrong world model | Belief state under partial observability | POMDP / QuBE | High | Agent-state failure is state-estimation failure, not just memory failure. | Every agent-facing read should carry observedAt, source, authority, and invalidation metadata. | `stale_action_rate`, `source_authority_violation_rate` | Agent with substrate reads still acts on invalidated state. |
| Agent memory stores stale or conflicting facts | Test-time learning / selective forgetting | MemoryAgentBench | High | Continuity checkpoints must support supersession, contradiction, and current-state rebase. | Add structured `supersedes`, `validUntil`, and contradiction refs to continuity. | `resume_success_rate`, `contradiction_rate` | Flat retrieval performs as well on knowledge-update scenarios. |
| Multi-agent work fails despite capable agents | System design / misalignment / verification | MAST / ICML failure attribution | High | The coordination substrate matters more than another prompt layer. | Persist actor, step, workflow, and causality for every capability invocation. | `failure_attribution_rate`, `replay_fidelity` | Failures cannot be attributed even with substrate events. |
| Tool onboarding creates one-off integration spaghetti | Semantic mapping and metadata contracts | LLM semantic integration, ISO 11179 | High | Tool connection should be map-to-profile + validate + emit, not bespoke sync code. | Build adapter authoring flow: infer mapping, review, validate, generate fixture tests. | `adapter_time_to_first_valid_event`, `mapping_rejection_rate` | New tool requires substrate package edits for normal data types. |
| Business processes cross many objects | Object-centric process logs | OCEL 2.0 | High | Project state must be object-centric, not one task list. | Model project flows as event transitions involving multiple graph nodes and edges. | `workflow_invalid_transition_rate`, `replay_fidelity` | Complex project flow cannot be replayed from object/event refs. |
| Projects fail from poor communication between teams | Shared mental model / transactive memory | Project success SLR, SMM, TMS | High | The PM layer is a shared operational mental model that reduces cross-team drift. | Show dashboards/checkpoints that answer "what do we know, who knows it, what changed?" | `state_disagreement_rate`, `mean_time_to_reconcile` | Teams still disagree on current state after substrate-backed workflow. |
| AI/tool protocols move calls but not shared world state | Shared blackboard | LLM blackboard MAS | Medium-high | MCP/A2A-style protocols need a shared state substrate below/alongside invocation. | Expose capabilities via protocols, but keep graph/events/workflow/provenance as source of truth. | `capability_contract_violation_rate`, `evidence_coverage` | Protocol-only implementation matches substrate on replay/authority tests. |

## Direct Answer To The User's Question

Yes: there are papers and standards attacking this from first principles, but they are scattered.

- The agent-state literature says the first principle is **state under partial observability**: an actor needs a belief/current-state estimate before valid action.
- The memory-agent literature says the hard part is **updating, forgetting, and using memory behaviorally**, not storing more text.
- The multi-agent literature says failures are often **coordination design, misalignment, and verification failures**, not merely model weakness.
- The interoperability literature says business tools need **semantic mappings, metadata contracts, and deterministic governance**, not another brittle integration.
- The project-management/team-cognition literature says project success depends on **communication, shared mental models, and transactive memory**.

pm-substrate's thesis is the intersection:

> A project-manager substrate is a shared, typed, evidence-backed operational world model. It lets business tools plug in through mappings/contracts, lets agents act from current authoritative state, and gives teams a shared reality so projects do not degrade into siloed local truth.

## Gaps This Reveals

1. **Structured category fields:** eval events currently encode some category mappings in notes. Add structured fields for external taxonomy labels.
2. **Adapter proof:** build one complete tool-onboarding path: source schema -> mapping proposal -> deterministic validation -> graph/events/projections.
3. **Shared-state dashboard:** prove the project-layer claim with a scenario where two teams begin with contradictory local truth and converge through substrate evidence.
4. **Attribution benchmark:** use substrate causality to identify which actor/tool/step caused a failed workflow; compare against trace-only debugging.
5. **Protocol positioning:** explicitly say MCP/A2A are invocation/communication protocols; pm-substrate is the shared operational state substrate they need.

## Product Recommendation

The next thesis artifact should rename the "AI memory" angle to:

**Agentic operational state under partial observability.**

That phrase ties the work to POMDPs, memory-agent benchmarks, multi-agent failure attribution, semantic interoperability, and project success literature. It is more defensible than claiming a generic "memory layer" and more precise than saying only "project management."

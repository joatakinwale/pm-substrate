# Arrowsmith State-Substrate Research Map

Status: research grounding
Date: 2026-06-01

## Claim Being Tested

The agent state problem is not only an AI-memory problem. In first-principles terms, it is the problem of an actor choosing an action from an incomplete, stale, lossy, conflicting, or unauthoritative estimate of the world.

That same primitive appears in partially observable decision theory, distributed systems, process mining, provenance, metadata standards, schema integration, state estimation, and human team cognition. The pm-substrate thesis becomes stronger if it can show that those domains converge on the same answer:

- state needs an authoritative model;
- observations need time, source, and uncertainty metadata;
- updates need explicit ordering and conflict rules;
- claims need provenance;
- actors need continuity that points back to evidence;
- evaluations need to measure behavior before and after the state layer is introduced.

This is why the agentic-substrate framing validates the original project-manager-layer thesis instead of replacing it. The original thesis says modern workspaces need a shared operational layer between tools and teams. The agentic extension says agents need the same layer because prompt memory, tool traces, and vector recall are not enough to coordinate durable work.

## Arrowsmith Method

This document uses the Arrowsmith / literature-based-discovery pattern: start with two literatures that are not always connected directly, then look for bridging concepts that explain why they belong together.

Foundational method source: Smalheiser and Swanson describe ARROWSMITH as a computer-assisted way to find plausible hypotheses by linking A-literature and C-literature through shared B-terms in MEDLINE titles and related literature sets. See [Using ARROWSMITH](https://pubmed.ncbi.nlm.nih.gov/9822851/) and [Rediscovering Don Swanson](https://pubmed.ncbi.nlm.nih.gov/29355246/).

For pm-substrate:

- A-literature: LLM agents, memory, multi-agent coordination, cross-session state.
- C-literature: reliable operational coordination across teams, tools, workflows, and distributed systems.
- B-terms: partial observability, belief state, event log, provenance, source authority, schema matching, metadata registry, transactive memory, consensus, state estimation, conflict resolution, workflow conformance.

## Source Quality Legend

- A: official standard, standards body, or primary project documentation.
- B: peer-reviewed journal/conference article or systematic review.
- C: workshop paper, preprint, or emerging benchmark from a credible research venue.
- D: vendor or industry source, useful for product-direction signal but not treated as proof.

## Cross-Domain Matrix

| Primitive | Evidence | What It Establishes | Substrate Implication | Eval Mapping |
| --- | --- | --- | --- | --- |
| Partial observability | B: [POMDP primer, Methods in Ecology and Evolution, 2021](https://research.monash.edu/en/publications/a-primer-on-partially-observable-markov-decision-processes-pomdps/) | Sequential decisions become harder when true state is imperfectly detected or model dynamics are unknown. | Agents should not receive "context" as if it were truth. Every action should state what was observed, when, from which source, and what remained unobserved. | `partial_observation`, `stale_observation` |
| Multi-agent partial state | B: [Multi-agent deep reinforcement learning survey, 2021](https://link.springer.com/article/10.1007/s10462-021-09996-w) | In realistic multi-agent settings, actors do not observe global state or other actors' internal knowledge. Communication and memory compensate, but introduce complexity. | Cross-functional state has to be shared through typed substrate records, not agent-to-agent chat alone. | `partial_observation`, `parallel_write_conflict`, `continuity_break` |
| Agent memory is structured state management | B: [Memory Matters, AAAI Symposium, 2024](https://ojs.aaai.org/index.php/AAAI-SS/article/view/27688); C: [Memory for Autonomous LLM Agents, 2026](https://arxiv.org/abs/2603.07670) | Modern agent memory requires separation of memory types, lifecycle management, metadata, retrieval, contradiction handling, and governance. | `@pm/continuity` should remain evidence-backed and typed. Agent memory must be derivative of graph/events/workflow, not a competing source of truth. | `memory_drift`, `continuity_break`, `contradiction_rate` |
| Long-horizon memory still fails | B: [LoCoMo, ACL 2024](https://aclanthology.org/2024.acl-long.747/); C: [MemAE, LCFM 2025](https://openreview.net/forum?id=ZgQ0t3zYTQ) | Long-context and RAG improve recall but still lag human performance; memory-agent benchmarks emphasize retrieval, test-time learning, long-range understanding, and conflict resolution. | Substrate validation must test behavior, not storage. A memory row only matters if the next agent avoids contradiction and acts from current authority. | `resume_success_rate`, `contradiction_rate`, `evidence_coverage` |
| Group memory is harder than personal memory | D: [Microsoft GroupMemBench, 2026](https://www.microsoft.com/en-us/research/publication/groupmembench-benchmarking-llm-agent-memory-in-multi-party-conversations/?lang=ja); C: [G-Memory, NeurIPS 2025 spotlight](https://openreview.net/forum?id=mmIAp3cVS0) | Workplace memory spans groups, channels, collaboration trajectories, and agent-specific roles. Flat memory misses collaboration structure. | The substrate should model actors, roles, workflow positions, evidence, and causation chains so group state can be reconstructed. | `source_authority_conflict`, `feedback_disconnection`, `continuity_break` |
| Ordered event log as durable state | B: [Raft, USENIX ATC 2014](https://www.usenix.org/node/184041.); B: [Improving observability in Event Sourcing systems, 2021](https://www.sciencedirect.com/science/article/pii/S0164121221001126) | Reliable systems often make state transitions explicit through logs, ordering, causality, and replay. Event sourcing research also links observability to preserving event relationships and runtime metadata. | The substrate event log is not just audit. It is the replayable memory of what happened, what caused it, and what was known at a point in time. | `replay_fidelity`, `stale_action_rate` |
| Convergent distributed state | B/C: [CRDT overview](https://arxiv.org/abs/1805.06358) | Replicas can be updated independently and still converge when update rules are mathematically defined. | Some collaborative state can converge automatically, but business authority still requires policy. CRDT-style convergence cannot decide which source is binding. | `parallel_write_conflict`, `mean_time_to_reconcile` |
| Provenance as admissible evidence | A: [W3C PROV Overview](https://www.w3.org/TR/prov-overview/) | Provenance standards define machine-processable ways to represent entities, activities, agents, derivation, and responsibility. | Every substrate claim should be able to cite events, graph nodes, workflow runs, documents, and checkpoints. Provenance is how memory becomes admissible. | `evidence_coverage`, `source_authority_violation_rate` |
| Object-centric workflow state | A/B: [OCEL 2.0 standard](https://www.ocel-standard.org/); B: [Partial-order process mining survey, 2022](https://link.springer.com/article/10.1007/s10115-022-01777-3) | Real processes involve multiple interacting objects and partial orders, not one neat case id. OCEL 2.0 supports object changes and relationships. | pm-substrate should treat projects as object-centric processes: campaign, asset, client, decision, risk state, task, and document can all be involved in one transition. | `workflow_invalidation`, `feedback_disconnection` |
| Semantic interoperability | A: [HL7 FHIR R5](https://hl7.org/fhir/R5/); A: [ISO/IEC 11179-1:2023](https://www.iso.org/standard/78914.html); B: [FHIR interoperability systematic review, 2022](https://pubmed.ncbi.nlm.nih.gov/35852842/) | Successful interoperability needs structural exchange formats, semantic binding, metadata, and governance across heterogeneous systems. | Profiles and capabilities should be declarative contracts. The substrate should not force each platform to rewrite itself; adapters translate into profile contracts and validators enforce meaning. | `representation_loss`, `source_authority_conflict` |
| Data contracts for plug-in boundaries | A: [Open Data Contract Standard](https://github.com/bitol-io/open-data-contract-standard) | Data contracts make structure, semantics, quality, and terms explicit between producers and consumers. | Capability descriptors and profile validators are the substrate equivalent of data contracts. They let a platform plug in through a contract instead of hard integration. | `capability_contract_violation_rate`, `evidence_coverage` |
| LLMs as schema-mapping assistants | B/C: [Schema Matching with LLMs, TaDA/VLDB workshop 2024](https://www.vldb.org/workshops/2024/proceedings/TaDA/TaDA.8.pdf); C: [Matchmaker, 2024](https://arxiv.org/abs/2410.24105); C: [Magneto, 2024](https://arxiv.org/abs/2412.08194) | LLMs can help identify semantic correspondences between schemas, but cost, context limits, reliability, and ambiguity remain constraints. | AI is useful as adaptive I/O: propose mappings from CSV, JSON, database schemas, documents, or APIs into substrate profile inputs. The accepted mapping still needs deterministic validation, provenance, and review. | `representation_loss`, `capability_contract_violation` |
| Human teams already have the same problem | B: [Transactive memory systems and team performance, 2021](https://www.sciencedirect.com/science/article/pii/S0148296321001600); B: [Communication in Transactive Memory Systems, 2021](https://researchwith.stevens.edu/en/publications/communication-in-transactive-memory-systems-a-review-and-multidim/); B: [Shared mental models in human-AI teams, 2022](https://www.tandfonline.com/doi/abs/10.1080/1463922X.2022.2061080) | Teams coordinate by knowing who knows what, trusting expertise, sharing mental models, and updating knowledge through communication. | The substrate is a machine transactive-memory system: source authority, actor identity, evidence, workflow position, and continuity make "who knows what, and why" queryable. | `source_authority_conflict`, `continuity_break`, `feedback_disconnection` |
| Physical state estimation | B: [Power-system state estimation survey, IEEE Transactions on Smart Grid, 2024](https://www.osti.gov/pages/biblio/1985306); C: [Uncertainty representations under partial observability, 2024](https://arxiv.org/abs/2409.16824) | Critical infrastructure estimates hidden state from multiple noisy data sources and must represent uncertainty. | The substrate should not pretend every projection is equally fresh or certain. Reads need freshness, uncertainty, and source confidence metadata where domain risk justifies it. | `stale_observation`, `state_disagreement_rate` |
| Resilient multi-agent coordination | B: [Resilient consensus control survey, 2023](https://www.mdpi.com/1424-8220/23/6/2904) | Multi-agent systems face instability from complexity, open networks, and adversarial or faulty signals; consensus requires explicit resilience assumptions. | Agent platforms need attack/fault models: malicious source, stale source, spoofed actor, invalid permission, bad retry, hallucinated tool output. | `capability_contract_violation`, `source_authority_conflict` |
| Emerging agent-memory benchmarks | D: [Microsoft STATE-Bench, 2026](https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/) | Industry is moving toward direct measurement of agent memory improvement. This is a signal, not peer-reviewed proof. | pm-substrate should maintain its own paired-run evals so its claims do not depend on a vendor benchmark alone. | all classes via `@pm/evals` |

## Core Synthesis

The simplest version of the problem is this:

> State is the minimum sufficient representation an actor needs to choose a valid next action.

For an LLM agent, the "state" used for action may be scattered across prompt context, retrieved memories, tool outputs, hidden model weights, current files, workflow engines, databases, and human instructions. That is why agent state failure often looks like intelligence failure. The model may be reasoning well over the wrong state.

For a cross-functional workspace, the same thing happens across people and tools. Marketing has one state, finance has another, operations has another, the project manager has a summary, and the system-of-record has something else. Work fails when the actor with decision authority cannot see the current, relevant, admissible state.

The substrate should therefore avoid becoming a second state system by making this boundary explicit:

- Source systems retain their operational facts until integrated.
- The substrate records typed events, entity graph references, workflow state, provenance, freshness, authority, and continuity.
- Agent memory is a view over substrate evidence, not an authority layer.
- AI can propose mappings, summaries, and actions, but deterministic substrate gates validate before mutation.

## What This Changes in the Thesis

The wording should move from "agentic substate" to "agentic state substrate" or "agentic substrate extension." "Substate" sounds like a separate lower layer, which creates the two-state confusion. The stronger framing is:

> pm-substrate is the project-manager layer. Agentic state is a validation surface on top of the same project-manager layer.

This validates the original baseline because the same primitives support both:

- human and tool interoperability;
- agent memory and resumption;
- cross-functional source authority;
- workflow gates;
- evidence-backed claims;
- pluggable domains through profiles and capability contracts.

If the agentic layer required a different graph, event model, workflow engine, or registry, that would weaken the original paper. If it uses the same substrate primitives and only adds continuity/evals above them, it strengthens the paper.

## Implementation Implications

The research points to these next implementation areas.

1. State reads need metadata.

Every agent-facing read should expose at least: `sourceRef`, `observedAt`, `validAt` or `validUntil` when known, `authorityRule`, `projectionVersion`, and `readSnapshotId`. Without this, stale and partial observations cannot be measured.

2. Mutations need read-set causality.

Capability invocations should record the state snapshot or source refs that justified the action. The substrate can then reject writes when a required source changed after the read.

3. Memory needs evidence links and contradiction checks.

Continuity checkpoints should continue to point to events, graph nodes, workflow runs, documents, and decisions. A checkpoint without evidence is a note. A checkpoint with evidence is admissible memory.

4. AI mapping should be proposal-first.

LLMs can be used as adaptive I/O for CSV, JSON, database schemas, documents, and APIs, but the output should become a proposed mapping with confidence, source samples, and deterministic validation. The substrate should not silently accept inferred schema meaning.

5. Heartbeats should be alignment events, not millions of independent cron jobs.

A heartbeat should be a scheduled state-alignment cycle that performs projection catch-up, stale-read detection, conflict scans, continuity rebase, and eval emission. It should not stop everyone globally unless a scenario declares a coordination barrier. The research analogy is event-triggered control: update when the state change or risk threshold requires it.

6. The eval schema should become the measurement contract.

Every research claim above should map to an `EvalEvent`. The taxonomy should stay finite until a scenario genuinely cannot fit; then the miss becomes a theory-gap finding.

## Metrics To Watch

| Metric | What It Proves Or Falsifies |
| --- | --- |
| `state_disagreement_rate` | Whether multiple actors/tools are converging on the same authoritative state. |
| `stale_action_rate` | Whether actors act after their evidence became invalid. |
| `source_authority_violation_rate` | Whether the wrong source wins when sources conflict. |
| `evidence_coverage` | Whether actions and claims are backed by inspectable records. |
| `contradiction_rate` | Whether continuity memory conflicts with current substrate truth. |
| `resume_success_rate` | Whether amnesiac agents can continue from substrate state alone. |
| `replay_fidelity` | Whether event history can reconstruct what the system knew at time T. |
| `workflow_invalid_transition_rate` | Whether plans/actions are rebased against current workflow state. |
| `capability_contract_violation_rate` | Whether deterministic gates catch invalid inputs before mutation. |
| `mean_time_to_reconcile` | How quickly conflicting state becomes resolved or explicitly blocked. |

## Risks And Gaps

1. Complexity is real, but not unsolvable in one stroke.

The full state of a cross-functional organization cannot be exhaustively represented or model-checked. The tractable goal is not "represent everything"; it is "represent enough authoritative state for safe next actions, detect when that is not enough, and block or escalate."

2. Observation can perturb work.

In physics, measurement can disturb the system being measured. In organizations, measurement can change incentives, attention, and timing. The substrate should treat observation as an event when it matters: who read what, when, under what authority, and whether that read enabled a mutation.

3. Standards do not eliminate local meaning.

FHIR and ISO metadata registries show that common structures help, but semantic interoperability still requires governance, terminology, mappings, and local rules. The same will be true for pm-substrate profiles.

4. AI-assisted I/O can create false confidence.

LLMs can map schemas and summarize state, but they can also collapse meaning, invent correspondences, or hide uncertainty. That is why AI mapping belongs before deterministic validation, not after it.

5. A second state layer is the main architecture risk.

If agent memory starts deciding authority independently from graph/events/workflow, the substrate has failed. Agent memory must be a derived, evidence-backed continuity layer.

## Testbed Fit

The three-axis validation plan is well aligned with this research.

| Axis | Why It Matters | Primary Failure Pressure |
| --- | --- | --- |
| ArrowHedgeLabs finance agents | High consequence, time-sensitive, multi-source decisions with risk gates. | stale state, source authority conflict, workflow invalidation, contract violation |
| PluggedInSocial / agency marketing agents | Human feedback, brand authority, content approval, multi-role workflow. | feedback disconnection, representation loss, workflow invalidation, continuity break |
| Local LLM/module lab | Controlled environment where failures can be deliberately induced and replayed. | partial observation, memory drift, parallel write conflict, contradiction |

The validation program should run each scenario in paired baseline/substrate arms. If the substrate arm does not reduce failure rates or improve recovery/resume metrics, the state theory is weakened. If it does, the original PM-layer thesis gains empirical support.

## Working Conclusion

The substrate does not solve state by making a bigger memory. It solves state by making the operational state boundary explicit:

- what happened;
- who did it;
- what source was observed;
- what changed afterward;
- which source is authoritative;
- which workflow state is valid;
- which action was allowed;
- which claim can be proven;
- which memory is stale.

That is the bridge between the original JOAT Labs project-manager layer and the agentic-state problem. The project-manager layer is the shared world model for cross-functional work. Agents are simply the newest, most fragile actors trying to operate over that world model.

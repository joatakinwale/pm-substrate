# Design the Interactions First: pm-substrate and the Project-Management Layer for Agentic Workspaces

**Author:** Emmanuel Akinwale, JOAT Labs  
**Date:** June 6, 2026  
**Status:** Unified repo thesis paper

## Abstract

Modern organizations do not suffer from a shortage of software. They suffer from a shortage of coherent operational state. Businesses already use capable tools for sales, finance, planning, communication, documents, analytics, and delivery. The breakdown happens between those tools: state is copied, context is lost, ownership is unclear, and each system maintains a partial local model of work.

The arrival of AI agents makes this problem more urgent. Large language models can generate plans and call tools, but a model call is not a system of record, a prompt is not a workspace, and retrieved memory is not authority. Agents are bounded perception-action systems. They act from partial observations, compressed representations, uncertain beliefs, and delayed feedback. Without a governed operational substrate, agents inherit the same fragmentation that already makes modern SaaS work brittle.

This thesis argues that pm-substrate is the project-management layer for agentic workspaces. It formalizes the operational-state function of project management: maintaining shared goals, valid next actions, owners, blockers, dependencies, evidence, authority, and continuity across humans, tools, workflows, and AI agents. Its central design law is simple: no agent's local state is authoritative unless it is reconciled with substrate state.

## 1. The Strategic Problem: The System Is the Strategy

The modern workspace has been optimized around components. Every function has a specialized application, and many of those applications are excellent inside their own boundaries. Yet the operating experience is still fragmented because the value of work does not live inside any one component. It lives in the interactions between components.

This is the systems insight behind JOAT Labs. A business is not a CRM, a project tracker, a document store, an inbox, a calendar, and a finance system placed beside one another. A business is the coordinated behavior that emerges when those capabilities exchange meaning at the right time, under the right authority, with the right permissions, and in the right workflow position.

The dominant software response has been to add more interfaces, more integrations, and now more AI features to existing silos. That response treats the workspace as a shelf of tools. pm-substrate treats the workspace as a system of bounded actors whose local models must be reconciled into shared operational state.

## 2. Project Management as Institutional State Governance

A project manager is often described as the person who schedules meetings, tracks tasks, and follows up with owners. That is too small. At a deeper level, project management is the organizational discipline for maintaining shared state under partial observation and change.

A project manager keeps the current objective visible, translates between specialized teams, records decisions, watches dependencies, detects blockers, manages risks, clarifies ownership, and determines which next actions are valid. These are all state functions. They answer questions such as: What is true now? Who owns it? Which source is binding? What changed? Which step is next? What is blocked? What evidence supports the decision?

This is why the project-management layer is the correct metaphor for the modern workspace. The tools a business uses are like departments in a cross-functional team. Each department can be excellent and still fail as a whole if their state does not synchronize. pm-substrate is the missing project manager for tools, workflows, people, and agents.

## 3. What an Agent Is, Structurally

An agent is not first a chatbot or an automation. At the lowest useful level, an agent is a bounded system coupled to an environment through perception, internal representation, action, and feedback.

The environment has some state. The agent receives partial observations from that environment. The agent maintains an internal model or belief. It updates that model as observations arrive. It selects an action according to a goal, policy, or objective. The action changes the environment or the agent's future observations. Feedback then arrives, sometimes immediately and sometimes late.

This structure exists before artificial intelligence. People, departments, software services, robots, and LLM-based agents all fit the same pattern. The agent-state problem is therefore not a narrow LLM implementation issue. It is the old coordination problem of bounded actors acting from incomplete local models.

## 4. From Numbers to Agentic State

A large language model begins as numbers: token IDs, embeddings, tensors, matrix operations, and learned parameters. Statistical learning turns those numbers into a function that predicts outputs from inputs. A transformer language model turns prior tokens into a probability distribution over next tokens.

That mechanism is powerful, but it is not operational state. Model weights are parametric state: a compressed record of historical training and fine-tuning data. Prompt context is inference state: a temporary working window for one call or run. Retrieval and memory are retrieval state: external records brought into context, often without full lifecycle governance. None of these is automatically current, authoritative, complete, or safe to mutate against.

The agent-state failure begins when a statistical predictor is promoted into an actor without giving it a governed current-state layer between prediction and action. The model can reason well and still act badly if its context is stale, missing, conflicting, or non-authoritative.

## 5. State Taxonomy

The word state is overloaded, so the thesis must separate its meanings. Reality state is what is actually true in the environment. Observed state is what an actor can see. Represented state is how observations are encoded. Belief state is what the actor thinks is true. Operational state is the current actionable configuration of work. Authoritative state is the state the institution accepts as binding. Historical state is the event sequence that explains how current state came to be. Projected state is a derived view built from authoritative records.

pm-substrate does not claim to govern all of reality. It governs operational, authoritative, historical, and projected workspace state. That distinction matters. The substrate is not the agent's entire world model. It is the governed operating reality against which work actions are validated.

**State Layers in Agentic Work**

| State type | Where it lives | Why it is insufficient |
| --- | --- | --- |
| Parametric state | Model weights | Historical statistical compression, not current authority. |
| Inference state | Prompt, activations, context window | Temporary, finite, order-sensitive, and not durable. |
| Retrieval state | Documents, vector memory, summaries | Can be stale, conflicting, or missing source authority. |
| Operational state | Events, graph, workflows, projections | Only useful when governed, validated, and current. |

## 6. The Core Thesis

Modern workspace failure is a multi-agent state coherence problem. Each human, tool, workflow, and AI agent acts from a local model. Failures occur when those local models diverge and no shared substrate determines which facts are current, which sources are authoritative, and which actions are valid.

Project management is the human discipline that has historically handled this problem. It maintains institutional state across specialists. pm-substrate formalizes that project-management state function in software for agentic workspaces.

The shortest version is: pm-substrate is not a bigger memory for agents. It is the missing state-estimation, authority, and project-management layer between statistical prediction and operational action.

## 7. What pm-substrate Is

pm-substrate is a tenant-scoped operational substrate for coordinating work across humans, tools, workflows, and AI agents. It is not a point-to-point integration script and not a single vertical application. It is the shared state layer that allows specialized systems to coordinate through declared contracts instead of private assumptions.

Its minimal primitive set includes actors, entities, relationships, events, capabilities, policies, workflow state, evidence, projections, commitments, and continuity records. Together, these primitives turn scattered observations into governed operational state.

The design law is: no agent's local state is authoritative unless it is reconciled with substrate state. Agent memory can propose. Agent belief can explain. Agent plans can recommend. But authoritative project state changes only through substrate transitions.

**pm-substrate Primitive Map**

| Agent-state need | pm-substrate primitive |
| --- | --- |
| Environment state | Entity graph |
| State changes | Append-only event log |
| Possible actions | Capability registry |
| Valid process | Workflow runtime |
| Allowed actions | Policies and validation rules |
| Observed facts | Evidence-linked projections |
| Agent continuity | Continuity ledger |
| Feedback | Workflow outcomes and emitted events |

## 8. Authority Promotion: From Observation to Operational Reality

A substrate needs a promotion ladder. Otherwise, shared state becomes a slogan rather than a control boundary.

The ladder is: observation, evidence, proposed fact, validated fact, authoritative transition, projection update, and continuity update. A human, tool, or agent observes something. The observation is recorded with source, time, actor, and provenance. The system interprets the evidence as a candidate statement about an entity or workflow. Schema, permission, freshness, and conflict checks pass. An event is appended to the log. Derived views and workflow states are recomputed. Unresolved work, decisions, and evidence are preserved for future agents.

This is the route from local perception to institutional state. It is also the route that prevents a model's confident output from becoming an unvalidated mutation.

## 9. Agent Action Lifecycle

In pm-substrate, the LLM is a proposal engine. It can interpret, summarize, plan, and recommend. But a proposed action is not the same as an authorized mutation.

The action lifecycle is: build a current_state_view, ask the model for a proposal, record the proposal's read set and observation contract, validate the proposal against current substrate state, warn or block based on enforcement mode, execute only through a capability boundary, and append evidence-backed events for what happened.

This lifecycle turns agent behavior into project-management behavior. The agent must show what it relied on, whether those reads are still fresh, whether the workflow position still permits the action, whether the authority rule matches, and whether the action subject matches the current state view.

## 10. Evaluation Strategy

The thesis must be falsifiable. If pm-substrate does real work, agents should complete changing cross-tool workflows with lower stale-action rate, lower state-disagreement rate, lower rework, and higher evidence coverage than agents using chat history plus raw tool access.

The current evaluation families are stale observation, source authority conflict, workflow invalidation, representation loss, memory drift, capability contract violation, and continuity break. The implementation deliberately separates scaffolded scenarios from stronger evidence stages: detected warning, blocked mutation, and paired behavioral improvement.

That evidence maturity ladder matters. A scenario that merely says the substrate should pass is not proof. A system that emits a deterministic warning is stronger. A mutation gate that blocks a bad action is stronger still. A paired behavioral improvement in an executable workflow is the strongest version for the current project.

**Evidence Maturity Ladder**

| Stage | Meaning |
| --- | --- |
| Scaffolded scenario | A designed case that explains the failure class but does not prove behavior. |
| Detected warning | The substrate deterministically surfaces stale, missing, conflicted, or non-authoritative state. |
| Blocked mutation | A gate prevents a bad transition from mutating project state. |
| Paired behavioral improvement | The substrate arm outperforms a baseline in an executable paired workflow. |

## 11. Current Implementation Evidence

The repository already implements the first concrete spine of the thesis. It includes typed events, graph state, workflow state, projection state, continuity concepts, capability contracts, eval metrics, and an agent-state package.

The agent-state implementation defines CurrentStateView, StateRef, ReadSetEntry, ProposedAction, ObservationContract, and ActionProposalReview. It can warn when read-set refs are stale, required sources are missing, authority differs, projection versions changed, workflow positions conflict, current views contain conflicts, or a proposed action targets a subject different from the current-state view.

The ArrowHedge adapter gives the thesis a high-consequence tool surface. Source records are parsed, validated against profile/entity mapping, emitted as typed events, folded into a Common Operating Picture, transformed into a current-state view, and reviewed before action. That path tests the actual substrate strategy: source records -> semantic mapping -> typed events -> graph/projection -> current-state view -> proposal review -> eval metrics.

## 12. Why This Is Not iPaaS, Workflow Automation, or RAG

iPaaS and workflow automation usually begin from connections: when this happens in one app, do that in another. pm-substrate begins from shared operational state. It asks which entity this is about, which source owns the fact, whether the downstream action is still valid, what changed since the trigger fired, and what history can be replayed.

RAG is also insufficient by itself. Retrieval can bring information into context, but retrieval is not governance. It does not automatically provide authority, freshness, workflow validity, permissions, contradiction handling, or mutation safety.

The same is true of larger context windows. More context increases capacity, not authority. A bigger prompt can still contain stale, conflicting, or non-binding information. pm-substrate exists because the problem is not just memory. The problem is governed operational state.

## 13. Strategic Implications for JOAT Labs

The JOAT Labs strategy is not to compete feature-by-feature with existing tools. The strategy is to own the interaction layer that makes tools and agents behave as one coherent workspace. The system is the strategy.

The substrate becomes the durable center of the product: not because every user wants to see a database or event log, but because every reliable agentic workflow depends on the substrate's guarantees. Users experience it as fewer repeated explanations, fewer stale handoffs, clearer owners, stronger continuity, and safer automation.

The product wedge should therefore be a visible Common Operating Picture plus validation gates for real workflows. The deep architecture can be sophisticated, but the user-facing promise is simple: many bounded actors can work from one coherent operating reality.

## 14. Roadmap

The next phase is to move from warning artifacts into stronger execution evidence. First, expand the Common Operating Picture so it becomes the primary state surface for humans and agents. Second, wire advisory proposal reviews into a real workflow or capability mutation path. Third, add blocking-mode gates for selected high-consequence transitions. Fourth, run paired evals that measure behavior, not just detection. Fifth, connect continuity records so agent resumes are evidence-linked rather than transcript-dependent.

The long-term research program should continue to combine project-management research, multi-agent systems, state estimation, distributed systems, workflow theory, and LLM agent evaluation. The substrate thesis is strongest when it refuses to live in only one discipline.

## Conclusion

The next era of workspace software will not be won by adding isolated AI features to isolated tools. That path multiplies fragmented state. The next era will be won by systems that make humans, tools, workflows, and agents interoperable at the level where work actually happens: entities, events, authority, permissions, workflows, evidence, commitments, and continuity.

An agent should not be treated as a magic worker with memory. It is a bounded perception-action system operating under partial observation. It needs a governed operational substrate to act safely over time.

That is the role of pm-substrate. It is the project-management layer for agentic workspaces: the system that keeps bounded actors aligned around shared state while preserving authority, causality, permission, and accountability. The principle is simple: design the interactions first.

## References

- Ackoff, R. L. On Systems Thinking. W. Edwards Deming Institute summary.
- Bertalanffy, L. von. General System Theory: Foundations, Development, Applications. 1968.
- Brown, T. et al. Language Models are Few-Shot Learners. 2020.
- Fisher, D. A. An Emergent Perspective on Interoperation in Systems of Systems. SEI/CMU, 2006.
- Kaelbling, L. P., Littman, M. L., and Cassandra, A. R. Planning and acting in partially observable stochastic domains. 1998.
- Kalman, R. E. A New Approach to Linear Filtering and Prediction Problems. 1960.
- Lewis, P. et al. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. 2020.
- Maier, M. W. Architecting Principles for Systems-of-Systems. 1998.
- Meadows, D. H. Thinking in Systems: A Primer. 2008.
- MuleSoft / Salesforce. Connectivity Benchmark Reports, 2025-2026.
- Park, J. S. et al. Generative Agents: Interactive Simulacra of Human Behavior. 2023.
- Senge, P. M. The Fifth Discipline. 1990 / 2006.
- Sutton, R. S. and Barto, A. G. Reinforcement Learning: An Introduction. 2020.
- Trist, E. L. and Bamforth, K. W. Some Social and Psychological Consequences of the Longwall Method of Coal-Getting. 1951.
- Vaswani, A. et al. Attention Is All You Need. 2017.
- Yao, S. et al. ReAct: Synergizing Reasoning and Acting in Language Models. 2023.
- JOAT Labs source documents: The System Is the Strategy; Design the Interactions First; Agent From Numbers To State.

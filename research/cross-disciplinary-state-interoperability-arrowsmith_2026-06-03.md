# Cross-Disciplinary State And Interoperability Arrowsmith

Date: 2026-06-03
Method: Research Arrowsmith open discovery
Status: cross-domain mechanism map

## Research Question

What other disciplines have faced the same primitive problem as pm-substrate: many actors, tools, sensors, or agents each hold partial, stale, local, incompatible, or unauthoritative views of reality, yet must coordinate safe action?

Short answer: many mature disciplines solved bounded versions of this problem. They did not solve it by storing more context. They solved it by separating observations, state estimates, semantic contracts, authority, and feedback loops.

## A/B/C Framing

- **A problem:** pm-substrate needs agents, tools, people, and departments to act from current, admissible, shared operational state instead of siloed local truth.
- **B bridge concepts:** state estimation, observability, uncertainty, consensus, convergence, authoritative source policy, provenance, semantic profile, event vocabulary, context propagation, common operating picture, quorum, stigmergy, feedback control, replay, reconciliation.
- **C disciplines:** control theory, physics, robotics, weather and geoscience, power systems, distributed systems, Internet routing, software observability, healthcare, industrial automation, supply chain, cybersecurity, emergency response, aviation, systems engineering, biology, social insects, and swarm behavior.

## Core Finding

Across disciplines, the recurring solution shape is a five-layer state stack:

1. **Observation layer:** timestamped measurements, events, messages, or traces.
2. **State layer:** current estimated or committed state, often with uncertainty or freshness.
3. **Semantic layer:** shared model, vocabulary, profile, schema, or ontology.
4. **Authority layer:** rules for which source, replica, actor, quorum, or policy can decide.
5. **Feedback layer:** reconciliation, replay, error correction, contradiction handling, and escalation.

That is the cross-disciplinary version of pm-substrate's thesis. The substrate should not become a bigger memory. It should become the governed state stack for business operations.

## Source Map

### State Estimation, Physics, Control, And Robotics

1. **Kalman, "A New Approach to Linear Filtering and Prediction Problems"**, ASME Journal of Basic Engineering, 1960.
   - Source: https://people.math.harvard.edu/archive/116_fall_03/handouts/Kalman1960.pdf
   - Mechanism: infer hidden state from noisy measurements with a recursive estimator.
   - Substrate read: a projection is not raw truth. It is an estimate from observations, with a model, freshness, and error assumptions.

2. **Evensen, "The Ensemble Kalman Filter: theoretical formulation and practical implementation"**, Ocean Dynamics, 2003.
   - Source: https://www.ecmwf.int/en/elibrary/74424-ensemble-kalman-filter-theoretical-formulation-and-practical-implementation
   - Mechanism: continuously combine model forecasts and observations to update the best current estimate.
   - Substrate read: project state should be periodically rebased from source systems and events, not treated as a static summary.

3. **Durrant-Whyte and Bailey, "Simultaneous Localization and Mapping: Part I"**, IEEE Robotics and Automation Magazine, 2006.
   - Source: https://ieeexplore.ieee.org/document/1638022
   - Mechanism: a robot estimates both its own pose and the map while neither is fully known.
   - Substrate read: an agent and workspace co-evolve. The agent's belief, the graph, and source records need loop-closure-like reconciliation when new evidence arrives.

4. **Power-system state estimation and Common Information Model (CIM)**.
   - Sources: https://www.osti.gov/pages/biblio/1985306 and https://cimug.ucaiug.org/
   - Mechanism: estimate grid state from noisy meters while using shared utility models for data exchange.
   - Substrate read: high-consequence operations need both state estimation and semantic interoperability. One without the other is not enough.

### Distributed Systems, Networks, And Software Bugs

5. **Raft consensus**, USENIX ATC 2014.
   - Source: https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
   - Mechanism: replicas agree on an ordered log of state transitions.
   - Substrate read: some project state must be strongly ordered through workflow/capability gates, especially when authority or money changes.

6. **CRDTs**, convergent replicated data types.
   - Source: https://arxiv.org/abs/1805.06358
   - Mechanism: independent replicas can update and converge when merge rules are mathematically defined.
   - Substrate read: not every parallel write needs locking. The substrate should classify which events can converge and which require authority gates.

7. **BGP-4**, Internet inter-domain routing.
   - Source: https://datatracker.ietf.org/doc/html/rfc4271
   - Mechanism: autonomous systems exchange reachability and path attributes under local policy.
   - Substrate read: cross-tool business state may not have one global truth. It may need policy-aware authority: which source is binding for this tenant, workflow, and decision?

8. **OpenTelemetry and W3C Trace Context**, software observability and distributed debugging.
   - Sources: https://opentelemetry.io/docs/concepts/context-propagation/ and https://www.w3.org/TR/trace-context/
   - Mechanism: propagate context across service boundaries so causality can be reconstructed.
   - Substrate read: every capability invocation should carry workflow/run/source refs. Trace context is not authority, but it is essential for failure attribution.

### Interoperability-Heavy Industries

9. **HL7 FHIR**, healthcare interoperability.
   - Source: https://hl7.org/fhir/R5/
   - Mechanism: resources, profiles, extensions, terminology binding, and implementation guides let systems exchange patient/clinical data with shared semantics.
   - Substrate read: pm-substrate profiles should work like implementation guides: shared primitives plus domain profiles, validators, and local extensions.

10. **OPC UA**, industrial automation interoperability.
    - Source: https://opcfoundation.org/about/opc-technologies/opc-ua/
    - Mechanism: a platform-independent information model and service architecture for industrial devices and software.
    - Substrate read: tool onboarding should expose both capabilities and an inspectable information model, not just API calls.

11. **GS1 EPCIS 2.0**, supply-chain visibility events.
    - Source: https://ref.gs1.org/standards/epcis/2.0.1/
    - Mechanism: standardized event data for what happened, when, where, why, and to which object.
    - Substrate read: project events should preserve object identity and business meaning, not just append generic activity rows.

12. **STIX/TAXII**, cybersecurity threat-intelligence interoperability.
    - Source: https://www.oasis-open.org/2021/06/23/stix-v2-1-and-taxii-v2-1-oasis-standards-are-published/
    - Mechanism: separate the threat-content model from the transport/exchange protocol.
    - Substrate read: MCP/A2A-style protocols are transport/invocation layers. pm-substrate must own the content/state model beneath or beside them.

13. **SysML v2 / Model-Based Systems Engineering (MBSE)**.
    - Source: https://www.omg.org/spec/SysML/
    - Mechanism: connect requirements, structure, behavior, verification, and analysis through shared system models.
    - Substrate read: the project-manager layer should connect tasks, requirements, capabilities, risks, documents, evidence, and validation results in one graph.

### Common Operating Picture, Aviation, And Emergency Response

14. **Common Operating Picture (COP)**, emergency/military coordination.
    - Source: https://www.dhs.gov/publication/common-operating-picture
    - Mechanism: give many actors a shared situational view for time-sensitive coordination.
    - Substrate read: dashboards should be operational state surfaces, not BI reports. They should answer what is current, what changed, who owns it, and what is blocked.

15. **ADS-B**, aviation surveillance.
    - Source: https://www.faa.gov/air_traffic/technology/adsb
    - Mechanism: aircraft broadcast position and related state so other systems can build shared situational awareness.
    - Substrate read: state-sharing beats request-only coordination when actors need to avoid conflict in real time.

### Biology, Social Animals, And Swarms

16. **Honeybee quorum sensing during nest-site selection**.
    - Source: https://cir.nii.ac.jp/crid/1363670321175637120
    - Mechanism: a swarm commits after enough scouts support a site, not after one signal.
    - Substrate read: high-risk project actions may need evidence quorum gates: enough independent source refs before committing.

17. **Bacterial quorum sensing**.
    - Source: https://journals.asm.org/doi/10.1128/mBio.00013-15
    - Mechanism: cells coordinate population-level behavior by sensing shared signal concentration.
    - Substrate read: local agents can act safely when shared-state signals cross explicit thresholds; threshold design matters.

18. **Stigmergy in social insects and swarm systems**.
    - Source: https://link.springer.com/referenceworkentry/10.1007/978-1-4419-1428-6_384
    - Mechanism: agents coordinate indirectly by modifying a shared environment.
    - Substrate read: the substrate is more like an environment than a chat channel. Actors should coordinate through durable state changes.

19. **Boids / flocking**, Reynolds 1987.
    - Source: https://dl.acm.org/doi/10.1145/37402.37406
    - Mechanism: local rules can produce coherent group motion.
    - Substrate read: local heuristics help low-risk coordination, but they do not provide semantic authority. Useful analogy, weak authority model.

## Arrowsmith Matrix

| Discipline | A-equivalent problem | B bridge mechanism | Evidence strength | What they solved | Substrate implication | Metric to test | Falsifier / limit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Control / physics | Hidden system state from noisy measurements | Kalman-style recursive state estimation | High | Best current state estimate, not raw observation worship | Projections need observation refs, freshness, model version, and uncertainty/confidence where risk matters | `stale_action_rate`, `projection_confidence_coverage` | Raw latest-event context performs as well under noisy/stale scenarios |
| Weather / geoscience | Model forecast and observation disagree | Data assimilation / forecast rebase | High | Continuous correction of a living model | Scheduled and event-triggered project-state rebase cycles | `mean_time_to_reconcile`, `resume_success_rate` | Rebase adds latency without improving state-disagreement outcomes |
| Robotics / SLAM | Actor does not know map or its own position | Joint map/pose estimation and loop closure | High | Local observations become a corrected map | Agent belief, workspace graph, and entity identity need reconciliation after new evidence | `entity_duplicate_rate`, `replay_fidelity` | New evidence cannot repair mistaken graph identity |
| Power systems | Many noisy meters describe one grid | State estimation plus CIM model exchange | High | Current operating state over an interoperable model | Combine canonical profiles with estimator/projection metadata | `adapter_time_to_first_valid_event`, `state_disagreement_rate` | Profile mapping passes but projected state remains unusable for decisions |
| Distributed consensus | Replicas disagree on committed state | Ordered replicated log | High | A small set of state transitions becomes authoritative | Use strong gates for irreversible, financial, permission, or workflow transitions | `parallel_write_conflict`, `workflow_invalid_transition_rate` | Strong ordering is required for nearly all events, making the substrate too slow |
| CRDTs | Replicas update independently | Convergent merge rules | High | Some collaborative state converges without central locking | Classify events into convergent vs authority-gated categories | `conflict_auto_resolution_rate` | Business semantics make most merges policy-dependent |
| Internet routing | Networks exchange partial reachability under local policy | Path-vector routes, attributes, policy | Medium-high | Policy-aware convergence, not global truth | Authority rules should be tenant/workflow/source-specific | `source_authority_violation_rate` | Local policies create unreconcilable contradictions without escalation |
| Software observability | Causality disappears across service boundaries | Trace/context propagation | High | Failure attribution across distributed calls | Capability calls need trace/workflow/source context refs | `failure_attribution_rate`, `evidence_coverage` | Trace refs show call path but not enough state to explain failure |
| Healthcare | Many systems describe the same patient differently | FHIR resources, profiles, terminology binding | High | Bounded semantic exchange with validation and extensions | Profiles should be implementation-guide-like, with validators and local extension points | `mapping_rejection_rate`, `representation_loss_rate` | Valid profile data still loses decision-critical semantics |
| Industrial automation | Vendor devices and software need shared meaning | OPC UA information models and services | High | Interoperable machine-readable capability/state models | Tool connectors should expose inspectable information models plus operations | `capability_contract_violation_rate` | APIs are connected but the information model is too shallow |
| Supply chain | Cross-org objects need visibility | EPCIS what/when/where/why event vocabulary | High | Object-centered event sharing | Project events should be object-centric visibility events | `object_event_completeness`, `replay_fidelity` | Project state cannot be replayed from object/event refs |
| Cybersecurity | Organizations exchange threat state | STIX content model plus TAXII transport | High | Separates state/content semantics from exchange protocol | Treat MCP/A2A as transport/invocation; substrate owns state model | `protocol_only_replay_gap` | Protocol-only implementation matches substrate on authority/replay tests |
| MBSE / systems engineering | Requirements, design, behavior, and verification drift | Shared model connecting artifacts | Medium-high | Traceability across system lifecycle | Project layer should link task, requirement, evidence, risk, and verification graph nodes | `requirement_trace_coverage` | Graph links become documentation, not operational gates |
| Emergency response / COP | Many teams need shared situational awareness | Common operating picture | Medium-high | Shared current view for coordinated action | Dashboards should be operational state surfaces with source and block status | `state_disagreement_rate`, `decision_latency` | Dashboard improves visibility but not action correctness |
| Aviation / ADS-B | Actors need live position/state awareness | Broadcast state to shared surveillance network | High for aviation, medium as analogy | Near-real-time shared situational state | Some state should be broadcast/subscribed, not only requested | `stale_read_rate`, `notification_to_action_latency` | Broadcast creates noise without reducing stale actions |
| Honeybee swarms | Group commits under local evidence | Quorum threshold | Medium as biological analogy | Commit after enough independent evidence | High-risk transitions can require evidence quorum | `quorum_gate_false_pass_rate` | Quorum slows decisions but does not reduce bad commits |
| Bacterial quorum sensing | Population coordinates through shared signal | Thresholded shared environmental signal | Medium as biological analogy | Local actors infer group state from signal concentration | Shared substrate signals can drive autonomous agent behavior | `threshold_decision_accuracy` | Signals are too coarse for semantically rich business actions |
| Social insects / stigmergy | Agents coordinate without direct messaging | Shared environment encodes work state | Medium-high as coordination analogy | Durable shared medium beats direct pairwise chatter | Agents should coordinate through graph/events/workflow, not only chat | `agent_chat_dependency_rate` | Direct chat performs as well as substrate-mediated coordination |
| Flocking / animal groups | Coherent motion from local rules | Alignment, separation, cohesion heuristics | Low-medium | Low-risk local coordination | Use only for UI/agent heuristics, not authority | `local_coordination_success_rate` | Local rules create herding around wrong state |

## Ranked Findings

### 1. The most transferable answer is state estimation, not memory.

Physics, control, robotics, weather, and power systems all assume the true state is hidden or partially observed. They build estimators that preserve measurement source, model assumptions, uncertainty, and correction loops.

**pm-substrate implication:** agent continuity should be derivative of observed events and authoritative projections. Reads should make freshness and source authority explicit. In high-risk domains, projections should also carry confidence or uncertainty metadata.

### 2. Interoperability-heavy fields solve with profiles, vocabularies, and validators.

Healthcare, industrial automation, supply chain, cybersecurity, utility systems, and systems engineering do not rely on one universal database. They use shared resources, profiles, information models, event vocabularies, transport protocols, terminology bindings, and validators.

**pm-substrate implication:** the "connect any business tool" promise should be phrased as profile-driven interoperability: infer or author a mapping, validate it deterministically, emit typed events, and preserve provenance.

### 3. Distributed systems show which state must be ordered and which can converge.

Raft/Paxos-like systems solved strong agreement for critical transitions. CRDTs solved independent update convergence for carefully designed data types. Neither answer applies everywhere.

**pm-substrate implication:** build a coordination classification: authority-gated events, convergent events, append-only observations, and derived projections. That is more honest than saying "we handle parallel work" in general.

### 4. Software debugging proves context propagation is necessary but insufficient.

OpenTelemetry and Trace Context show that cross-boundary causality must travel with calls. But trace context explains "what called what"; it does not decide which business fact is true.

**pm-substrate implication:** capability invocations need trace/workflow/source refs for attribution, but authority remains in graph/events/workflow/profile gates.

### 5. Biology and animals validate substrate-as-environment, not substrate-as-chat.

Social insects, bacterial quorum sensing, and stigmergy show that coordination can emerge when actors read and modify a shared environment. The strong lesson is not that businesses should copy ants or bacteria. The lesson is that durable shared signals beat pairwise messages when many actors coordinate.

**pm-substrate implication:** agents should coordinate by writing and reading typed substrate state. Chat is a communication surface; the substrate is the environment.

### 6. Common operating picture disciplines explain the product layer.

Emergency response and aviation show why a shared state surface matters. A dashboard is not just analytics when people act from it. It is part of the control loop.

**pm-substrate implication:** the project layer should become an operational common operating picture: current state, source proof, ownership, blocked transitions, and next valid actions.

## Mechanisms To Borrow

1. **Observation refs on every important projection** from control and data assimilation.
2. **State rebase cycles** from weather/geoscience and robotics loop closure.
3. **Strong ordering for irreversible transitions** from consensus systems.
4. **Convergent merge rules for safe collaborative fields** from CRDTs.
5. **Policy-aware authority** from BGP and utility operations.
6. **Trace/workflow context propagation** from OpenTelemetry.
7. **Profiles, implementation guides, and validators** from FHIR, OPC UA, EPCIS, STIX, and CIM.
8. **Object-centric visibility events** from EPCIS and process mining.
9. **Common operating picture surfaces** from emergency response and aviation.
10. **Evidence quorum gates** from honeybee/bacterial quorum systems.
11. **Substrate-as-environment coordination** from stigmergy.

## Experiments And Metrics

1. **Estimator projection experiment**
   - Add `observedAt`, `sourceRefs`, `projectionModel`, `validUntil`, and optional confidence metadata to one projection path.
   - Metric: `stale_action_rate`, `projection_confidence_coverage`.
   - Falsifier: actors still act on stale state at the same rate.

2. **CRDT-vs-gate classification**
   - Classify substrate event types as append-only observation, convergent update, authority-gated transition, or derived projection.
   - Metric: `parallel_write_conflict`, `conflict_auto_resolution_rate`.
   - Falsifier: most events cannot be classified without bespoke policy.

3. **FHIR/OPC/EPCIS-style adapter proof**
   - Pick one outside tool and run source schema -> mapping proposal -> deterministic validation -> typed event emission -> projection.
   - Metric: `adapter_time_to_first_valid_event`, `mapping_rejection_rate`, `representation_loss_rate`.
   - Falsifier: successful connection still loses decision-critical meaning.

4. **Trace-context capability attribution**
   - Propagate workflow run id, capability invocation id, source refs, and actor id through every local-lab call.
   - Metric: `failure_attribution_rate`.
   - Falsifier: traces cannot identify the actor/tool/step responsible for a failed workflow.

5. **Common operating picture scenario**
   - Two teams start with conflicting local truth; the substrate reconciles current state, proof, owner, and next valid action.
   - Metric: `state_disagreement_rate`, `mean_time_to_reconcile`.
   - Falsifier: teams still disagree after the substrate-backed surface is used.

6. **Quorum-gated high-risk transition**
   - Require independent evidence refs before a financial/legal/client-facing workflow transition.
   - Metric: `quorum_gate_false_pass_rate`, `decision_latency`.
   - Falsifier: quorum slows the workflow without reducing bad commits.

## Weak Or Rejected Bridges

1. **Blockchain as universal answer**
   - Useful pieces: append-only records, provenance, shared verification.
   - Weakness: business state still needs semantic meaning, authority, privacy, and correction. A ledger alone does not solve interoperability.

2. **Free energy principle / broad predictive-processing language**
   - Useful pieces: actors maintain models under uncertainty.
   - Weakness: too broad for immediate product decisions unless turned into measurable state-estimation gates.

3. **Animal flocking as business authority**
   - Useful pieces: local coordination.
   - Weakness: it lacks semantic truth, evidence, permissions, and source authority. Good analogy for low-risk heuristics, bad architecture for project truth.

4. **Protocol-only interoperability**
   - Useful pieces: calls and messages move.
   - Weakness: protocols do not by themselves define what facts mean, who owns them, when they expire, or how contradictions are resolved.

## Product Recommendation

Describe pm-substrate as:

> A governed operational-state fabric for business and agentic work.

Its borrowed cross-disciplinary stack should be:

1. **Observe:** capture source events, tool outputs, documents, traces, and actor claims.
2. **Normalize:** map them into profiles, vocabularies, and object-centric event forms.
3. **Authorize:** decide which source, actor, policy, quorum, or workflow state can make a fact binding.
4. **Estimate/project:** maintain current operational state with freshness and confidence where required.
5. **Coordinate:** expose next valid actions, common operating picture views, and capability contracts.
6. **Reconcile:** replay, compare, rebase, invalidate, and escalate when state diverges.

That is the answer other disciplines converge on: not one database, not one protocol, not one memory, but a governed loop from observation to shared actionable state.

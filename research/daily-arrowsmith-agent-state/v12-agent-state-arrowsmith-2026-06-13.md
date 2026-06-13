# v12 Agent-State Arrowsmith - 2026-06-13

Date: 2026-06-13 UTC
Local run clock: 2026-06-13 America/Chicago
Status: twelfth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v11-agent-state-arrowsmith-2026-06-12.md`

Repository sync note: this run checked remote `main` before editing. `git ls-remote origin refs/heads/main`, local `HEAD`, and local `origin/main` all resolved to `00693bb5d8efd04c3f6beb441bc72faeb186d35d`; no merge conflict or fast-forward was needed. Two fetch/status commands hung in this desktop shell and were interrupted after refs were independently confirmed, so this version does not claim a successful network fetch command transcript beyond the resolved remote SHA parity.

## 1. Version Header

v12 continues v11 rather than restarting the thesis. v11 closed a replay/catalog implementation slice: deterministic admission certificate ids/digests, tenant/workflow alignment, validity windows, policy version, revocation epoch, execution identity, artifact hash checks, and committed-row replay recomputation now exist for the ArrowHedge write-binding corpus. v12 audits that closure against new June 2026 memory-security, workflow-verification, multimodal-memory, protocol, credential, observability, and PM/team-cognition sources. The strongest new conclusion is that certificate-bound replay is necessary but still insufficient: durable authority requires a substrate-owned certificate/status store, target-side receipt evidence, memory-write and memory-read influence admission, and final-state verification after action.

## 2. One-Paragraph Delta From Previous Version

v11 correctly narrowed the certificate frontier to replay/catalog proof and did not overclaim production signing, live revocation, DB-backed stores, target-side delivery confirmation, all-transport adoption, memory-control-flow review, or PM protocol-burden measurement. v12 keeps that boundary and adds five source-backed changes. First, June 2026 memory-poisoning work strengthens the claim that memory writes are external evidence admissions, not benign personalization. Second, memory-control-flow and multimodal-memory benchmarks make memory reads an action-routing influence that needs explicit classification. Third, Lean4Agent and HarnessFix strengthen trajectory-level verification and fault localization, but they verify/model workflows under assumptions rather than proving current operational state. Fourth, W3C Verifiable Credentials, Bitstring Status List, and Data Integrity specifications provide stronger vocabulary for issuer/proof/status/revocation fields than the current fixture certificate, while also proving that status checking is a separate runtime dependency. Fifth, project-management and human-AI teaming sources reinforce that substrate PM value is shared, calibrated, updateable operational cognition with measurable coordination burden, not more ceremony.

## 3. Research Question

After certificate-bound replay has landed for committed write-binding fixtures, what is the next defensible research-to-code frontier for pm-substrate if existing LLMs, memories, protocols, tools, and PM handoffs remain statistical or external evidence channels rather than authoritative operational state?

## 4. A/B/C Framing

**A-literature/problem.** LLM agents, agent memory, multi-agent coordination, workflow agents, RAG, tool use, formal workflow verification, stateful enterprise benchmarks, and agent security.

**B bridge concepts.** Memory write admission, memory-read control influence, certificate status, revocation epoch, delivery receipt, trajectory verification, final-state checking, source authority, provenance, state handles, target-side confirmation, shared mental model, transactive memory, coordination burden.

**C literatures/domains.** Memory-poisoning/security benchmarks, formal methods for workflows, trace-guided harness repair, verifiable credentials and revocation standards, OpenTelemetry semantic events, MCP protocol evolution, multimodal conversational-memory benchmarks, project management, human-AI teaming, team cognition, organizational memory.

Open discovery result: the strongest bridge is **status-bearing operational evidence**. A replay certificate without a durable status source is like a credential without issuer and revocation checking: useful as a deterministic fixture, not yet authority.

Closed discovery checks from v11:

1. Certificate-bound replay verification is partially closed in code; durable certificate/status stores remain open.
2. Tenant/workflow binding is strengthened by the v11 bug fix; target-side delivery confirmation remains open.
3. Stored verdicts are rejected as proof; recomputation against catalog is the right test shape.
4. Memory-control-flow review remains open and is strengthened by June 2026 security papers.
5. PM burden/role-utility metrics remain open and are strengthened by human-AI teaming evidence.

## 5. Source Map

| Source | Date | Type | Finding strength | What it supports | Limit |
| --- | --- | --- | --- | --- | --- |
| Local `v11` research, `Changelog.md`, and current repo refs at `00693bb5` | 2026-06-12/13 | Primary local repo evidence | High | Certificate-aware replay/catalog verification is implemented and scoped. | Does not prove live stores, target receipts, or all-transport enforcement. |
| [From Untrusted Input to Trusted Memory: A Systematic Study of Memory Poisoning Attacks in LLM Agents](https://arxiv.org/abs/2606.04329) | 2026-06-03 | Primary preprint / benchmark proposal | High for risk taxonomy, Medium until peer reviewed | Persistent memory writes can create long-lived behavior influence; memory admission must validate source, channel, authority, and later use. | Attack results may depend on agent frameworks and memory policies. |
| [From Storage to Steering: Memory Control Flow Attacks on LLM Agents](https://arxiv.org/abs/2603.15125) | 2026-03-16; v3 surfaced 2026-06 | Primary preprint | High for memory-as-control bridge | Retrieved memory can reorder tool/control flow, so memory use needs influence classification. | Does not define a substrate implementation. |
| [Lean4Agent: Formal Modeling and Verification for Agent Workflow and Trajectory](https://arxiv.org/abs/2606.06523) | 2026-06-02 | Primary preprint | Medium-high | Workflow assumptions and trajectory semantics can be modeled and checked; current pm-substrate policy transitions should become explicit programs/specs. | Formal verification is only as strong as the modeled assumptions and source truth. |
| [From Failed Trajectories to Reliable LLM Agents](https://arxiv.org/abs/2606.06324) | 2026-06 | Primary preprint | Medium | Trace-normalized failure localization supports artifact-run groups and harness-layer diagnosis. | Repairing a harness is not equivalent to proving operational state. |
| [M3Exam: Benchmarking Multimodal Memory for Realistic User-Agent Interactions](https://arxiv.org/abs/2606.07402) | 2026-06-05 | Primary preprint / benchmark | Medium | Accumulating multimodal context has grounding, cross-session, and efficiency gaps; raw-source-on-demand strengthens source-preservation. | Benchmark is memory quality, not authority governance. |
| [H2HMem: A Multimodal Memory Benchmark for Agents in Human-Human Interactions](https://arxiv.org/abs/2606.09461) | 2026-06-08 | Primary preprint / benchmark | Medium | Multi-party, multimodal memory includes conflicting speakers, deixis, and session reasoning; PM handoffs need participant/source roles. | Does not directly test project-write validity. |
| [STATE-Bench GitHub repository](https://github.com/microsoft/STATE-Bench) and [Microsoft release post](https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/) | 2026-05 | Benchmark repo / official project docs | Medium-high | Stateful enterprise tasks and agent-learning tracks are useful eval shapes for memory and skills. | Benchmark success does not replace source-authority validation. |
| [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/), [Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/), and [Bitstring Status List v1.0](https://www.w3.org/TR/vc-bitstring-status-list/) | 2025 W3C recommendations | Standards | High for credential/status vocabulary | Issuer, holder/verifier, proof, status, and revocation semantics map cleanly to durable admission certificates. | VC standards do not decide pm-substrate policy or state truth. |
| [MCP SEP-2260](https://modelcontextprotocol.io/seps/2260-Require-Server-requests-to-be-associated-with-Client-requests), [SEP-2567](https://modelcontextprotocol.io/seps/2567-sessionless-mcp), and [SEP-2577](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging) | 2026 | Official protocol proposals | Medium | Protocol evolution is making correlation/state explicit and deprecating some implicit surfaces; handles remain evidence, not authority. | Draft/proposal status means implementation behavior may drift. |
| [OpenTelemetry semantic conventions for events](https://opentelemetry.io/docs/specs/semconv/general/events/) and [semantic conventions overview](https://opentelemetry.io/docs/concepts/semantic-conventions/) | Current docs, event semconv development | Official docs | Medium | Target-side receipts and runtime confirmations should use consistent event names, timestamps, severity, and attributes. | Observability events are correlation evidence, not authorization. |
| [National Academies human-AI teaming processes chapter](https://www.nationalacademies.org/read/26355/chapter/5) and [Google Research: AI agents within transactive memory theory](https://research.google/pubs/teamwork-makes-the-dream-work-framing-ai-agents-within-transactive-memory-theory/) | 2022 report; current research page | Review / project page | Medium | Shared mental models and transactive memory support PM claims about who knows what, source ownership, and calibrated delegation. | Review/theory sources need direct workflow metrics before product claims. |

## 6. Prior-Version Claim Audit

| v11 claim or open item | v12 status | Correction or continuation |
| --- | --- | --- |
| Replay/catalog certificates now verify digest, policy version, revocation epoch, execution identity, validity window, tenant/workflow, artifact hash, and review coverage. | Confirmed as local implementation claim | Keep as replay proof; do not call it production certificate authority. |
| Durable DB/substrate-store authority remains open. | Strengthened | VC/status-list standards make this more concrete: a verifier needs durable issuer/status material and revocation semantics, not just a fixture ref. |
| Target-side delivery confirmation is open. | Strengthened | OpenTelemetry event semantics and cross-channel failure framing suggest target receipts should be admitted as separate evidence events. |
| Memory-control-flow and memory influence review are open. | Strengthened | Memory poisoning and MCFA papers make both memory writes and memory reads action-affecting control surfaces. |
| PM protocol-burden metrics are open. | Strengthened | Human-AI teaming and TMS sources support measuring calibrated delegation, shared understanding, and burden rather than assuming scaffolding helps. |
| Stored validation fields are receipts, not proof. | Confirmed | v12 keeps recomputation as the standard and extends it to future target receipts and memory influence decisions. |

## 7. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A fixture certificate can be copied without durable authority | Credential status and revocation | W3C VC Data Integrity / Bitstring Status List | High for vocabulary, Medium for direct mapping | Admission certificates should be verified against a substrate-owned status store with issuer, policy version, revocation epoch, and validity. | Add a durable certificate/status catalog fixture or DB-backed table before expanding claims. | `durable_certificate_status_verification_rate`, `revoked_certificate_escape_count` | A revoked or stale certificate still authorizes a write. | Certificate logs can expose operational metadata; require tenant scoping and redaction. |
| Dispatch success is mistaken for delivery | Target-side receipt | OpenTelemetry events / cross-channel delivery | Medium | A write should not become shared state until the target channel emits an admissible receipt. | Add target-receipt evidence kind for scheduled, memory, subagent, and PM handoff writes. | `target_receipt_coverage`, `silent_delivery_failure_rate` | Dispatch-only and receipt-backed paths show equal final-state consistency. | Receipt telemetry can leak target identities or sensitive content. |
| Memory writes persist untrusted input | Memory-write admission | MPBench / memory poisoning | High for risk | Memory writes should pass evidence admission and carry source, channel, intended use, expiry, and review status. | Add memory-write fixture rows with poisoned, stale, and clean memories. | `memory_write_admission_rejection_rate`, `poisoned_memory_persistence_rate` | Poisoned memory is admitted and later steers a valid action. | Over-filtering memory can erase legitimate user preferences or minority signals. |
| Memory reads reorder tools | Memory-read influence classification | MCFA / control-flow attacks | High for bridge | Retrieved memory used as an instruction or tool-routing signal must be reviewed differently from memory used as factual evidence. | Add `memoryInfluenceKind` and write-binding checks for fact, preference, instruction, policy, and tool-routing uses. | `memory_steered_tool_rate`, `memory_control_override_block_rate` | Memory changes tool order without an influence warning. | The system should not silently profile users through memory influence fields. |
| Locally valid tool steps compose into invalid workflows | Trajectory semantics | Lean4Agent / formal workflow verification | Medium-high | Action reviews should include explicit workflow transition specs, assumptions, and postconditions where feasible. | Add policy-transition fixtures that verify current evidence plus invalid next transition. | `policy_transition_program_pass_rate`, `invalid_transition_block_rate` | A formally invalid transition passes because evidence facts are fresh. | Formal specs can create false confidence if business assumptions are incomplete. |
| Failed agent traces produce broad repairs | Harness-aware trajectory provenance | HarnessFix | Medium | Artifact run groups should localize failures to evidence, policy, memory, tool, or delivery layers before code changes. | Add run-group failure classification over ArrowHedge replay corpora. | `failure_layer_localization_rate`, `broad_repair_attempt_rate` | Failure triage still cannot identify the responsible layer. | Attribution should stay system-level by default, not blame individual operators. |
| Multimodal PM memory loses speaker/source truth | Participant/source-role memory | H2HMem / M3Exam | Medium | PM handoff memory should preserve participant, modality, source artifact, and conflict status instead of flattening into a summary. | Add PM handoff memory fixtures with speaker/source conflicts and modal source refs. | `participant_source_role_coverage`, `handoff_conflict_preservation_rate` | Flattened summary performs as well on conflict-sensitive handoffs. | Meeting memory can expose sensitive participant statements. |
| More PM scaffolding is assumed helpful | Calibrated shared mental model / TMS | Human-AI teaming and transactive-memory literature | Medium | PM substrate should measure whether handoff structure improves risk capture and time-to-valid-action net of burden. | Run protocol-burden metrics on real automation traces. | `protocol_burden_cost`, `risk_capture_delta`, `handoff_rework_rate` | Added scaffold increases work without better agreement or outcomes. | Excessive monitoring can reduce autonomy and psychological safety. |

## 8. New Or Changed Hypotheses

1. **High: Admission certificates need status authority.** Inference: v11's deterministic certificates are the correct replay shape, but W3C credential/status standards imply the next code step should verify against durable issuer/status material, not just JSONL fixtures.
2. **High: Memory writes are external evidence admissions.** MPBench-style memory poisoning strengthens the existing memory trust-boundary claim: memory creation must carry source, channel, intended use, expiry, and denial/warning reasons.
3. **High: Memory reads can be control inputs.** MCFA turns the memory problem from "is the retrieved fact current?" into "did this retrieved item alter action ordering, tool choice, or policy interpretation?"
4. **Medium-high: Target receipts are distinct from dispatch events.** Delivery confirmation should become an `ExternalStateEvidenceKind` or write-binding receipt lane; dispatch logs alone should remain downgraded.
5. **Medium-high: Policy-transition verification should be explicit.** Lean4Agent-style workflow semantics should inspire small typed transition specs for pm-substrate, but not a broad formal-methods rewrite.
6. **Medium: Multimodal/multi-party memory benchmarks strengthen PM handoff state.** Participant/source/modality conflicts should survive into handoff artifacts.
7. **Medium: PM scaffolding must earn its keep.** Human-AI teaming and TMS sources justify PM substrate metrics, but only if role utility and protocol burden are measured.

## 9. Project-Management Implications

PM substrate value is still strongest when framed as shared operational cognition, not a prettier task list. v12 adds four PM implications:

1. **Handoff receipts.** A PM handoff update should include target-side receipt or acknowledgement before it becomes shared state. "Sent" is not "admitted."
2. **Memory provenance for team knowledge.** Transactive memory asks "who knows what"; pm-substrate should answer "which source/actor/channel established this, when, and under which authority?"
3. **Participant-aware meeting memory.** Multi-party memory benchmarks strengthen the need to preserve speaker, role, modality, disagreement, and unresolved-risk fields instead of collapsing meeting output into a summary.
4. **Protocol burden budget.** Daily automations, agent handoffs, and PM escalations should measure rework, rediscovery cost, risk capture, and time-to-valid-action so governance does not become performative overhead.

## 10. Implementation Implications For pm-substrate

1. **Durable certificate/status catalog.** Add a substrate-owned store shape for admission certificates with issuer, proof/digest, subject artifact, evidence review ids, policy version, revocation epoch, validity window, tenant/workflow, status, and checked-at metadata. Start with fixture-backed import/export if DB proof is too large for one slice.
2. **Target-side receipt evidence.** Add an external evidence kind for target receipts from memory stores, scheduled tasks, delegated agents, PM handoff channels, or outbound tools. Write binding should distinguish dispatch proof from receipt proof.
3. **Memory-write admission fixtures.** Add fixtures for clean memory, poisoned memory, stale memory, hidden-instruction memory, and user preference memory. Measure admitted/denied/warned outcomes.
4. **Memory-read influence metadata.** Add fields that classify retrieved memory as fact, preference, instruction, tool-routing hint, policy-like rule, or summary. Bind high-consequence writes to whether memory influence was reviewed.
5. **Policy-transition mini-specs.** Add small deterministic transition fixtures before adopting heavy formal tooling: current fact valid but transition invalid; transition valid but evidence stale; transition valid and evidence current.
6. **Run-group failure localization.** Use existing artifact run groups to label failure layer: evidence admission, state review, policy transition, certificate/status, delivery receipt, memory influence, target final state.
7. **PM burden metrics on real traces.** Apply role-utility/protocol-burden metrics to this automation or ArrowHedge multi-agent traces before increasing handoff ceremony.

## 11. Rejected, Weak, Or Stale Bridges

| Bridge or claim | Status | Reason |
| --- | --- | --- |
| v11 certificates are production authority. | Reject | They are deterministic replay/catalog refs without signed production issuer, durable status store, or live revocation check. |
| VC standards solve admission authority. | Weak | They provide credential/status vocabulary; pm-substrate still needs policy, subject, tenant, workflow, and current-state checks. |
| Memory benchmark accuracy proves safe memory. | Downgraded | Benchmarks measure recall/reasoning/efficiency; memory poisoning/control-flow risks require adversarial and workflow tests. |
| Formal workflow verification proves source truth. | Downgraded | Formal checks prove modeled assumptions; source currentness and authority remain substrate evidence questions. |
| OpenTelemetry event receipt is authorization. | Reject | Telemetry can prove an event was observed by a target channel; it does not decide whether the write was valid. |
| PM scaffolding improves outcomes by default. | Downgraded | Human-AI teaming evidence is mixed; burden, quality, diversity, and rework must be measured. |
| Multimodal memory is automatically better PM memory. | Weak | Raw modality can help, but privacy, speaker conflict, source refs, and final-state validity still need governance. |

## 12. Metrics And Eval Scenarios To Add

- `durable_certificate_status_verification_rate`
- `revoked_certificate_escape_count`
- `certificate_status_checked_at_coverage`
- `target_receipt_coverage`
- `dispatch_without_receipt_rate`
- `receipt_to_final_state_consistency`
- `memory_write_admission_rejection_rate`
- `poisoned_memory_persistence_rate`
- `memory_influence_kind_coverage`
- `memory_steered_tool_rate`
- `memory_control_override_block_rate`
- `policy_transition_program_pass_rate`
- `invalid_transition_block_rate`
- `failure_layer_localization_rate`
- `participant_source_role_coverage`
- `handoff_conflict_preservation_rate`
- `protocol_burden_cost`
- `risk_capture_delta`
- `handoff_rework_rate`

Eval scenarios:

1. **Revoked certificate replay.** A committed write-binding row carries a previously valid certificate whose status store now marks it revoked; expected block.
2. **Dispatch-only false success.** A write-capable action dispatches but the target channel emits no receipt; expected pending/not-admitted shared state.
3. **Poisoned memory write.** A hidden instruction is written through a memory channel; expected denied or admitted only as quarantined evidence.
4. **Memory-read control override.** A retrieved memory changes tool order or bypasses a required review; expected influence warning/block.
5. **Fresh fact, invalid transition.** Evidence is current and authoritative, but the requested workflow transition violates policy; expected block.
6. **Multi-party PM handoff conflict.** Two participants make conflicting claims in a meeting artifact; expected handoff artifact preserves source roles and unresolved conflict.
7. **Protocol burden trace.** Compare a structured PM handoff automation run against a minimal baseline for risk capture, time-to-valid-action, and rework.

## 13. Next-Day Watchlist

1. Choose the next code slice: durable certificate/status catalog, target-side receipt evidence, or memory-write/influence admission. Best current bet: memory-write/influence admission if the goal is a small high-risk fixture family; durable certificate/status catalog if the goal is to continue v11 directly.
2. Inspect `@pm/workflow` and `@pm/evals` for the smallest store-like abstraction that can load certificate status without pulling in DB dependencies.
3. Decide whether target receipts belong in `ExternalStateEvidenceKind`, `InvocationEvidenceBinding`, or both.
4. Add memory influence taxonomy before adding broad memory fixtures so fact/preference/instruction/tool-routing are not conflated.
5. Re-check primary code/data availability for MPBench, MEMFLOW, Lean4Agent, HarnessFix, M3Exam, H2HMem, and STATE-Bench.
6. Keep MCP draft/proposal language date-stamped; do not treat deprecations or state-handle designs as final deployed behavior unless official spec pages confirm them.
7. Run PM burden metrics on an existing automation transcript if a durable trace source is easy to load.
8. Preserve claim boundary in dashboard/product copy: replay monitor and selected write gate now; full live governance later.

## 14. Source Inventory With Links And Dates

New or newly strengthened in v12:

- From Untrusted Input to Trusted Memory: A Systematic Study of Memory Poisoning Attacks in LLM Agents, arXiv preprint, 2026-06-03: https://arxiv.org/abs/2606.04329. Source type: primary preprint/benchmark proposal. Finding strength: High for risk taxonomy, Medium until peer review and code/data inspection.
- From Storage to Steering: Memory Control Flow Attacks on LLM Agents, arXiv preprint, 2026-03-16; v3 surfaced in June 2026 search: https://arxiv.org/abs/2603.15125. Source type: primary preprint. Finding strength: High for memory-as-control bridge.
- Lean4Agent: Formal Modeling and Verification for Agent Workflow and Trajectory, arXiv preprint, 2026-06-02: https://arxiv.org/abs/2606.06523. Source type: primary preprint. Finding strength: Medium-high for workflow semantics, not source truth.
- From Failed Trajectories to Reliable LLM Agents, arXiv preprint, 2026-06: https://arxiv.org/abs/2606.06324. Source type: primary preprint. Finding strength: Medium for failure-localization bridge.
- M3Exam: Benchmarking Multimodal Memory for Realistic User-Agent Interactions, arXiv preprint, 2026-06-05: https://arxiv.org/abs/2606.07402. Source type: primary preprint/benchmark. Finding strength: Medium.
- H2HMem: A Multimodal Memory Benchmark for Agents in Human-Human Interactions, arXiv preprint, 2026-06-08: https://arxiv.org/abs/2606.09461. Source type: primary preprint/benchmark. Finding strength: Medium.
- STATE-Bench official GitHub repo, Microsoft, May/June 2026: https://github.com/microsoft/STATE-Bench. Source type: benchmark repo / official project docs. Finding strength: Medium-high for eval-shape reuse.
- Introducing STATE-Bench official Microsoft Open Source Blog, 2026-05-19: https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/. Source type: official project docs. Finding strength: Medium.
- W3C Verifiable Credentials Data Model v2.0, W3C Recommendation, 2025: https://www.w3.org/TR/vc-data-model-2.0/. Source type: standard. Finding strength: High for issuer/holder/verifier vocabulary.
- W3C Verifiable Credential Data Integrity 1.0, W3C Recommendation, 2025: https://www.w3.org/TR/vc-data-integrity/. Source type: standard. Finding strength: High for proof/integrity vocabulary.
- W3C Bitstring Status List v1.0, W3C Recommendation, 2025: https://www.w3.org/TR/vc-bitstring-status-list/. Source type: standard. Finding strength: High for status/revocation vocabulary.
- MCP SEP-2260, Require Server requests to be associated with Client requests, 2026: https://modelcontextprotocol.io/seps/2260-Require-Server-requests-to-be-associated-with-Client-requests. Source type: official protocol proposal. Finding strength: Medium.
- MCP SEP-2567, Sessionless MCP via Explicit State Handles, 2026: https://modelcontextprotocol.io/seps/2567-sessionless-mcp. Source type: official protocol proposal. Finding strength: Medium.
- MCP SEP-2577, Deprecate Roots, Sampling, and Logging, 2026: https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging. Source type: official protocol proposal. Finding strength: Low-medium until final spec status is confirmed.
- OpenTelemetry Semantic Conventions for Events, current docs, development status: https://opentelemetry.io/docs/specs/semconv/general/events/. Source type: official docs. Finding strength: Medium for receipt event vocabulary.
- OpenTelemetry Semantic Conventions overview, current docs: https://opentelemetry.io/docs/concepts/semantic-conventions/. Source type: official docs. Finding strength: Medium.
- National Academies, Human-AI Teaming Processes and Effectiveness, 2022: https://www.nationalacademies.org/read/26355/chapter/5. Source type: review/report. Finding strength: Medium for shared mental model and calibrated teaming.
- Google Research, Teamwork Makes the Dream Work: Framing AI agents within transactive memory theory, current research page: https://research.google/pubs/teamwork-makes-the-dream-work-framing-ai-agents-within-transactive-memory-theory/. Source type: research project/page. Finding strength: Medium for PM/TMS framing, pending paper details.

Carried forward from v11 and still active:

- Local replay/catalog certificate implementation in `@pm/workflow` and `@pm/evals`: source type primary local repo evidence; strength High for replay proof, not production authority.
- Agent-state Arrowsmith v10/v11 source sets on certificate-bound admission, target-side delivery, memory-control-flow, AgentOps, MAS role utility, and PM scaffolding burden.

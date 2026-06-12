# v10 Agent-State Arrowsmith - 2026-06-12

Date: 2026-06-12 UTC
Local run clock: 2026-06-12 America/Chicago
Status: tenth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v09-agent-state-arrowsmith-2026-06-12.md`

Repository sync note: this run started on `main`, fetched `origin/main`, and confirmed local `HEAD` and `origin/main` both at `76e8e2f30747822b7070b71b8df31431bd9d1c28`. No merge conflict was present. The automation memory file for `research-pm-substrate` did not exist yet, so continuity was taken from the repo ledgers, `Changelog.md`, and the long-term memory pointer to the canonical v08/v09 chain.

## 1. Delta From Prior Version

v09 recommended durable write-binding verification catalogs and write-transport coverage metrics. That recommendation is now partially closed by the latest `main`: `@pm/evals` can build an `EvidenceBindingReferenceCatalog` from committed ArrowHedge state-review, evidence-admission, and write-binding JSONL corpora; focused tests verify the intentional allowed, missing, incomplete, policy-blocked, and hash-mismatch outcomes; and write-transport coverage metrics distinguish `required_verified`, `advisory_only`, and `missing_provider`, including a non-ArrowHedge agency write path. v10 therefore shifts the frontier away from "make fixture-backed verification catalogs" and toward certificate/admission validity, cross-channel delivery confirmation, memory-control-flow risk, state-based real-environment evaluation, evidence-first diagnosis, and PM collaboration protocols that improve quality without turning every status update into noisy process.

## 2. Research Question

How should pm-substrate evolve after fixture-backed write-binding verification exists, so that statistical predictors promoted into actors can only perform valid actions when evidence, delivery channel, memory influence, policy transition, human/agent handoff, and runtime certificate are current, scoped, replayable, and falsifiable?

## 3. A/B/C Framing

- **A literature:** LLM agents, memory, tool use, multi-agent orchestration, workflow/runtime agents, state-based agent benchmarks, AgentOps, interactive diagnosis, and agent infrastructure governance.
- **B bridge concepts:** admission certificate, evidence digest, revocation epoch, channel confirmation, memory-control-flow, state-based verification, anomaly lifecycle, hypothesis uncertainty, scaffolding, task-oriented communication, delegation, diversity collapse, write-transport coverage, and durable catalog authority.
- **C literatures:** distributed systems admission control, runtime authorization, operations/SRE, security assurance, clinical/engineering diagnosis, project management, human-AI teamwork, team cognition, and real-environment benchmark design.

## 4. Source Map

| Source | Date | Type | Claim discipline | pm-substrate use |
| --- | --- | --- | --- | --- |
| Sovereign Assurance Boundary: Certificate-Bound Admission for Agentic Infrastructure | 2026-06-10 | Primary arXiv preprint | Medium-high; new preprint, not peer reviewed | Strongens the write-binding frontier: proposals should become scoped, signed/revocable admission artifacts before infrastructure APIs execute. |
| Channel Fracture: Three Instances of Cross-Boundary Silent Delivery Reliability Failures in Multi-Agent Systems | 2026-06-03, v2/v3 visible June window | Primary arXiv preprint | Medium; production case study style, needs independent replication | Adds channel-confirmation as a falsifier: a scheduled/cross-agent write is not delivered until the target channel proves receipt in the same operational path. |
| LLM-as-an-Investigator: Evidence-First Reasoning for Robust Interactive Problem Diagnosis | 2026-06-11 | Primary arXiv preprint / code-linked | Medium; benchmark/code-linked but new | Supports "ask discriminating questions before action" as a policy for ambiguous PM and operational state. |
| The Illusion of Multi-Agent Advantage | 2026-06-11 | Primary arXiv preprint / benchmark | Medium-high; systematic comparison, new | Downgrades "more agents" again; multi-agent architecture must prove marginal utility and role/decomposition fit. |
| STAGE-Claw: Automated State-based Agent Benchmarking for Realistic Scenarios | 2026-06-09 | Primary arXiv preprint / benchmark | Medium-high; state-based benchmark, 40 tasks | Supports final-state and verification-program evals over prose-only task completion. |
| Agent System Operations: Categorization, Challenges, and Future Directions | 2026-06-01 | Review / survey preprint | Medium; useful taxonomy, not a direct proof | Maps pm-substrate monitoring into anomaly detection, root-cause localization, and resolution rather than dashboard display only. |
| From Storage to Steering: Memory Control Flow Attacks on LLM Agents | 2026-03-16 | Primary arXiv preprint / security eval | Medium-high; strong threat mechanism, current model claims may drift | Strengthens the warning that memory retrieval can steer tool choice and must be admitted as a control input. |
| Externalization in LLM Agents: A Unified Review of Memory, Skills, Protocols and Harness Engineering | 2026-04-09 | Review preprint | Medium; synthesis, not benchmark proof | Gives vocabulary for pm-substrate as harness infrastructure, while preserving the boundary that externalization is not authority. |
| Collaborating with AI Agents: Field Experiments on Teamwork, Productivity, and Performance | revised 2026-02-05 | Primary arXiv field experiment | Medium-high for ad-production setting; domain-specific | Adds PM metric caution: AI collaboration can increase throughput and text quality while changing communication, delegation, and output diversity. |
| Scaffolding Human-AI Collaboration: A Field Experiment on Behavioral Protocols and Cognitive Reframing | 2026-04 | Primary field experiment / Microsoft Research page | Medium; includes design limitations | Shows collaboration protocols can hurt output when overstructured; pm-substrate should measure protocol burden and quality, not assume more scaffolding is good. |

## 5. Prior-Version Claim Audit

| v09 claim | v10 audit status | Correction |
| --- | --- | --- |
| Durable verification catalogs/stores are the next code slice. | Modified / partially closed | Fixture-backed catalog construction from committed replay corpora is implemented and tested; durable DB/substrate-store-backed catalog verification remains open. |
| Write-transport coverage metrics should be added. | Modified / partially closed | Fixture-backed coverage exists and includes a non-ArrowHedge path; real transport inventory and runtime enforcement across all write paths remain unproven. |
| Full mutation governance remains unclaimed. | Still High | No source or code audit justifies broader wording yet. The strongest honest claim is opt-in verified write binding plus fixture-backed catalog/coverage proof. |
| Executable tool wrappers hide read/write dependencies. | Strengthened | Channel Fracture and memory-control-flow attacks generalize the problem: outer execution success can hide failed delivery or memory-steered tool control. |
| PM handoff quality requires risk/owner/source agreement. | Strengthened but qualified | Field experiments show AI collaboration changes communication/delegation and may improve some outputs while reducing diversity or suffering from over-scaffolding. Metrics must include quality, risk, diversity, and protocol cost. |
| Agentified judges need state-defect recall. | Still Medium-high | STAGE-Claw and state-based verification strengthen executable final-state checks; judge-only gates remain downgraded. |

## 6. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixture-backed write binding can still overclaim production authority | Certificate-bound admission and revocation epoch | SAB / runtime authorization | Medium-high | A write attempt should receive a scoped admission certificate only after state-review artifact, evidence-admission ids, policy version, identity, revocation epoch, and validity window verify. | Add `admission_certificate` replay rows before broad mutation-governance claims; later map to signed broker checks. | `admission_certificate_verification_rate`; `revocation_epoch_miss_rate` | A high-consequence write executes with stale/revoked policy but passes fixture catalog verification. | Cryptographic language can create false confidence if certificates bind weak evidence. |
| Cross-agent scheduled writes can silently fail despite correct dispatch | Channel confirmation / inverse verification | Channel Fracture / orchestration reliability | Medium | Delivery to memory, task, or handoff channels is not valid until the target channel confirms receipt with the same authority path. | Add delivery-confirmation evidence and dead-letter rows for scheduled/cron/subagent memory or PM handoff writes. | `channel_confirmation_coverage`; `silent_delivery_failure_rate` | Scheduler reports success while target memory/handoff artifact lacks a confirmed target-side receipt. | Silent failures can mislead operators into believing coordination happened. |
| Memory is not only storage; it can steer tool control flow | Memory-control-flow | MCFA/MemFlow security | Medium-high | Memory retrieval should be treated as a control input with source, trigger, tool-influence, and override checks. | Add memory-influence facets to evidence admission and write binding; distinguish recalled fact from recalled control instruction. | `memory_steered_tool_rate`; `memory_control_override_block_rate` | A memory row changes tool choice against current user/workflow instruction without warning or review. | Persistent manipulation can survive across tasks and users. |
| Ambiguous operational requests can produce premature action | Evidence-first hypothesis management | Interactive diagnosis | Medium | Ambiguous PM/action requests should remain in investigation mode until discriminating evidence closes uncertainty. | Add action-review reason `insufficient_discriminating_evidence`; optional clarification proposal artifact before write. | `clarification_before_write_rate`; `premature_diagnosis_block_rate` | Agent acts on the user's initial hypothesis when source evidence leaves multiple live explanations. | Over-questioning can increase friction; metric must balance delay and risk. |
| More agents can add cost without functional utility | Marginal utility of decomposition | MAS advantage benchmark | Medium-high | Multi-agent workflows should justify each role by evidence contribution, conflict reduction, or verified parallelism. | Add role-utility metrics to multi-agent runs: unique source contribution, duplicate work, conflict resolution, cost per valid action. | `agent_role_utility_rate`; `coordination_cost_per_valid_action` | A multi-agent run costs more than a single-agent baseline and adds no unique verified evidence or faster valid action. | Complexity can hide accountability gaps. |
| Realistic agent evals need state verification, not task prose | Final-state verification program | STAGE-Claw / real-environment benchmarks | Medium-high | pm-substrate evals should grade state transitions and verification programs, not only artifacts or final text. | Add eval scenarios that assert DB/projection/event-log final state for write-bound runs. | `state_verification_program_pass_rate`; `artifact_to_final_state_consistency` | Replay artifacts look valid but final environment state is wrong. | Real-environment evals may leak or mutate user data if not sandboxed. |
| Replay dashboards do not equal operations | AgentOps lifecycle | Agent System Operations | Medium | The dashboard should mature into monitor -> anomaly -> root cause -> resolution, with replay provenance at every step. | Add anomaly class, root-cause candidate, resolution action, and evidence refs to dashboard/replay data. | `anomaly_root_cause_link_rate`; `resolution_evidence_coverage` | Dashboard reports health while write-binding anomalies lack root-cause/resolution traces. | Operator trust depends on showing uncertainty and gaps. |
| Human-AI PM collaboration can improve throughput while changing quality/diversity | Teamwork mechanism and scaffolding cost | Field experiments / PM-HCI | Medium-high | PM handoff review must measure risk capture, output quality, diversity, delegation, and process cost together. | Run `comparePmHandoffAgreement` on real traces and add diversity/rework/protocol-burden fields. | `pm_risk_capture_rate`; `handoff_rework_rate`; `protocol_burden_cost` | Structured handoff protocol reduces quality or increases rework versus a lighter protocol. | Over-scaffolding can suppress human judgment or diversity. |

## 7. New Or Changed Hypotheses

1. **High:** Fixture-backed catalog verification is a necessary replay proof but not a sufficient production authority proof. Durable stores need certificate-like admission records with policy version, revocation epoch, execution identity, and validity window.
2. **High:** Cross-channel delivery is an operational-state problem. A dispatch, cron run, or subagent message does not update shared state unless the target channel emits target-side confirmation that can be replayed.
3. **Medium-high:** Memory retrieval should be modeled as a control-flow influence, not just evidence retrieval, when it changes tool selection, scope, or action ordering.
4. **Medium-high:** Multi-agent architectures should earn their complexity with marginal utility metrics; otherwise single-agent baselines plus substrate checks may be safer and cheaper.
5. **Medium:** PM collaboration protocols need a "burden budget." More structure can improve state quality in high-risk handoffs but harm output quality or throughput when it becomes ceremony.

## 8. Project-Management Implications

PM state updates should be treated as actions under uncertainty, but v10 adds restraint: not every collaboration improvement comes from adding process. The Pairit field experiment suggests human-AI teams can shift toward more task-oriented communication and delegation while also producing more homogeneous outputs. Microsoft Research's scaffolding field experiment shows structured behavioral protocols can reduce output quality and production in some settings, while cognitive reframing can help top-end quality under caveats. For pm-substrate, the implication is not "force more handoff forms"; it is "make handoffs evidence-bearing and measurable." Real PM traces should measure risk capture, owner/source agreement, valid next action, rediscovery cost, rework, diversity collapse, and protocol burden.

## 9. Implementation Implications For pm-substrate

1. Keep `EvidenceBindingReferenceCatalog` fixture-backed proof, but add a durable-store design note or type sketch for admission certificates: evidence digest, policy version, tenant, workflow, execution identity, revocation epoch, validity window, and replay hash.
2. Add channel-delivery confirmation fixtures for scheduled/subagent/memory/PM handoff writes: sender says delivered, target confirms or fails, and the write binding consumes target-side confirmation.
3. Add memory-control-flow admission facets: retrieved memory used as fact, retrieved memory used as instruction, retrieved memory changed tool choice, and current user/workflow override status.
4. Add multi-agent role-utility metrics before expanding orchestration: unique evidence contribution, duplicate work, disagreement resolved, cost per valid action, and single-agent baseline comparison.
5. Add state-based verification scenarios that compare replay artifacts against final DB/projection/event-log state, not only JSONL self-consistency.
6. Extend dashboard/replay data toward AgentOps lifecycle fields: anomaly class, root-cause candidate, resolution action, and unresolved evidence gaps.
7. Run real PM handoff agreement on this daily research automation or ArrowHedge multi-agent traces, then include protocol-burden and rework measurements.

## 10. Rejected, Weak, Or Stale Bridges

| Bridge | Status | Reason |
| --- | --- | --- |
| Fixture-backed catalog equals durable production authority | Reject | It proves replay consistency over committed corpora, not live DB/source freshness, revocation, or all-transport enforcement. |
| Dispatch success equals delivery success | Reject | Channel Fracture supplies a concrete failure class where scheduled cross-agent delivery silently fails. |
| Memory retrieval is passive context | Reject | MCFA shows memory can steer tool control flow; operational review must model influence. |
| More agents are automatically safer or stronger | Reject | The Illusion of Multi-Agent Advantage directly challenges automatic MAS value and cost efficiency. |
| More PM scaffolding always improves collaboration | Reject | Field evidence is mixed; protocol burden and quality must be measured. |
| AgentOps survey taxonomy proves pm-substrate implementation maturity | Low | It is useful vocabulary; implementation proof still requires executable anomaly/root-cause/resolution artifacts. |

## 11. Metrics And Eval Scenarios To Add

- `admission_certificate_verification_rate`
- `revocation_epoch_miss_rate`
- `channel_confirmation_coverage`
- `silent_delivery_failure_rate`
- `memory_steered_tool_rate`
- `memory_control_override_block_rate`
- `clarification_before_write_rate`
- `premature_diagnosis_block_rate`
- `agent_role_utility_rate`
- `coordination_cost_per_valid_action`
- `state_verification_program_pass_rate`
- `artifact_to_final_state_consistency`
- `anomaly_root_cause_link_rate`
- `resolution_evidence_coverage`
- `protocol_burden_cost`
- `handoff_rework_rate`
- `output_diversity_collapse_rate`

Eval scenarios:

1. **Revoked certificate write:** a binding verifies against fixture catalog but policy version or revocation epoch is stale. Expected: block before write.
2. **Cron memory delivery fracture:** scheduler reports success but target memory channel emits no target-side confirmation. Expected: delivery warning or dead-letter, no admitted state update.
3. **Memory-steered tool misuse:** retrieved memory instructs an agent to use a tool outside current workflow scope. Expected: memory-control warning and write denial for high-consequence action.
4. **Ambiguous PM action request:** user gives a plausible but incomplete root cause. Expected: investigation/clarification proposal instead of write.
5. **Multi-agent bloat:** three-agent flow duplicates work and adds no unique evidence relative to single-agent baseline. Expected: role-utility metric fails.
6. **Artifact/final-state divergence:** replay artifact says action was allowed, but DB/projection final state does not match expected transition. Expected: state-verification failure.
7. **Over-scaffolded handoff:** handoff protocol captures all fields but slows resolution and increases rework. Expected: protocol-burden warning, not automatic pass.

## 12. Next-Day Watchlist

1. Promote fixture-backed verification catalog into a durable-store design with admission certificate fields and revocation semantics.
2. Inventory real write transports, not just fixture samples, and classify each as `required_verified`, `advisory_only`, or `missing_provider`.
3. Add channel-confirmation fixtures for scheduled/subagent/memory/handoff delivery.
4. Add memory-control-flow fixtures that distinguish memory-as-fact from memory-as-instruction.
5. Add state-based final environment verification for at least one write-bound ArrowHedge path when DB credentials are available.
6. Run `comparePmHandoffAgreement` over a real automation trace and add protocol-burden/rework fields.
7. Continue checking primary source/code availability for SAB, Channel Fracture, STAGE-Claw, MCFA/MemFlow, LLM-as-Investigator, and MAS advantage.

## 13. Source Inventory With Links And Dates

- Sovereign Assurance Boundary: Certificate-Bound Admission for Agentic Infrastructure. Jun He, Deying Yu. 2026-06-10. Primary arXiv preprint. https://arxiv.org/abs/2606.11632
- Channel Fracture: Three Instances of Cross-Boundary Silent Delivery Reliability Failures in Multi-Agent Systems. Levent/Dexing Liu. 2026-06-03. Primary arXiv preprint. https://arxiv.org/abs/2606.04896
- LLM-as-an-Investigator: Evidence-First Reasoning for Robust Interactive Problem Diagnosis. Fabrizio Marozzo, Pietro Lio. 2026-06-11. Primary arXiv preprint / code-linked. https://arxiv.org/html/2606.13220v1
- The Illusion of Multi-Agent Advantage. Prathyusha Jwalapuram et al. 2026-06-11. Primary arXiv preprint / benchmark. https://arxiv.org/pdf/2606.13003
- STAGE-Claw: Automated State-based Agent Benchmarking for Realistic Scenarios. Sirui Liang et al. 2026-06-09. Primary arXiv preprint / benchmark. https://arxiv.org/abs/2606.10394
- Agent System Operations: Categorization, Challenges, and Future Directions. Zexin Wang et al. 2026-06-01. Review preprint. https://arxiv.org/abs/2606.01581
- From Storage to Steering: Memory Control Flow Attacks on LLM Agents. Zhenlin Xu et al. 2026-03-16. Primary arXiv preprint / security eval. https://arxiv.org/abs/2603.15125
- Externalization in LLM Agents: A Unified Review of Memory, Skills, Protocols and Harness Engineering. Chenyu Zhou et al. 2026-04-09. Review preprint. https://arxiv.org/abs/2604.08224
- Collaborating with AI Agents: Field Experiments on Teamwork, Productivity, and Performance. Harang Ju, Sinan Aral. Submitted 2025-03-23, revised 2026-02-05. Primary arXiv field experiment. https://arxiv.org/abs/2503.18238
- Scaffolding Human-AI Collaboration: A Field Experiment on Behavioral Protocols and Cognitive Reframing. Alex Farach, Alexia Cambon, Lev Tankelevitch, Connie Hsueh, Rebecca Janssen. 2026-04. Primary field experiment / Microsoft Research page. https://www.microsoft.com/en-us/research/publication/human-ai-collaboration-field-experiment/

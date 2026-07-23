# v13 Agent-State Arrowsmith - 2026-06-15

Date: 2026-06-15 UTC
Local run clock: 2026-06-15 America/Chicago
Status: thirteenth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v12-agent-state-arrowsmith-2026-06-13.md`

Repository sync note: this run started with `git fetch origin main`. Local `HEAD`, local `origin/main`, and remote `main` all resolved to `e9ff479a9b460841a8dc506911fb1990f9e6dd49` before publication work. The worktree already contained a v13 draft and related memory-evidence implementation edits; this run audited and completed them rather than creating a duplicate same-day version.

## 1. Version Header

v13 continues v12 instead of restarting the thesis. v12 said the next executable frontier was durable certificate/status verification, target-side receipt evidence, or memory-write and memory-read influence admission. This run chooses the memory frontier and closes the pure-contract portion: `@pm/agent-state` now distinguishes memory writes from memory retrievals, classifies recalled memory as fact, preference, instruction, tool-routing, policy-like rule, or summary, and warns when control-influencing memory lacks override-status metadata or is already overridden by current workflow/user state. `@pm/evals` now carries replay fixtures and metrics for hidden-instruction writes, clean preference writes, and overridden tool-routing memory.

## 2. One-Paragraph Delta From Previous Version

v12 was correct that memory writes and memory reads were still being conflated. The June 2026 memory-poisoning and memory-control-flow sources make the risk concrete: a memory item can enter as an untrusted write, persist, and later steer tool choice or workflow order. The strongest research-to-code move was therefore not another certificate note; it was to make memory evidence typed before it can quietly steer action. The implemented closure is intentionally scoped: this is pure admission and replay proof, not runtime blocking of every memory-backed write, not durable memory status or deletion verification, not target-side receipt proof, and not final-state confirmation. But it does close the v12 taxonomy gap that made memory-as-fact, memory-as-preference, memory-as-instruction, and memory-as-tool-routing too easy to collapse.

## 3. Research Question

What is the smallest honest code slice that turns v12's memory-security findings into executable substrate behavior without overclaiming broad mutation governance, model retraining, or durable production authority?

## 4. A/B/C Framing

**A-literature/problem.** LLM agents, persistent agent memory, RAG, tool-use agents, multi-agent workflows, runtime agents, and enterprise coding/PM agents.

**B bridge concepts.** Memory-write admission, control-flow influence, source channel, intended use, override status, stale observation, persistent instruction, retrieval state, workflow invalidation, source authority, target receipt, shared mental model, transactive memory, and protocol burden.

**C literatures/domains.** Memory-poisoning security, memory-control-flow attacks, agent runtime/platform docs, reliability reports, verifiable memory/credential status, human-AI teaming, team cognition, project coordination, and organizational memory.

Open discovery result: the strongest bridge today is **memory as an operational influence surface**. Memory is not merely a retrieval store; it is a write channel and a later control input. pm-substrate should admit and type both sides before action review uses the recalled item.

Closed discovery checks from v12:

1. Memory-write admission is now partly closed as a pure contract and replay fixture family.
2. Memory-read influence classification is now partly closed as a pure contract and replay metric.
3. Durable certificate/status authority remains open.
4. Target-side receipt evidence remains open.
5. Policy-transition mini-specs and final-state verification remain open.
6. PM protocol-burden metrics remain open, but the memory taxonomy sharpens the PM "who/source/channel/role" fields those metrics should inspect.

## 5. Source Map

| Source | Date | Type | Finding strength | What it supports | Limit |
| --- | --- | --- | --- | --- | --- |
| Local repo audit at `e9ff479a9b460841a8dc506911fb1990f9e6dd49` plus v13 diffs in `@pm/agent-state` / `@pm/evals` | 2026-06-15 | Primary local repo evidence | High | The executable invariant is memory-write/read classification plus replay fixtures. | Local proof only until committed/pushed; runtime write binding remains open. |
| [From Untrusted Input to Trusted Memory: A Systematic Study of Memory Poisoning Attacks in LLM Agents](https://arxiv.org/abs/2606.04329) | 2026-06-03 | Primary preprint / benchmark proposal | High for risk taxonomy, Medium until peer reviewed | Memory writes are admission surfaces; write channels and aggressive memory policies can create persistent behavioral influence. | Preprint; does not define the pm-substrate contract. |
| [From Storage to Steering: Memory Control Flow Attacks on LLM Agents](https://arxiv.org/abs/2603.15125) | 2026-03-16 | Primary preprint | High for control-flow bridge, Medium until peer reviewed | Memory retrieval can affect tool choice and workflow order, so recalled memory needs influence classification. | Attack results depend on frameworks and tasks; not a production governance design. |
| [Copilot code review: New configurations and controls](https://github.blog/changelog/2026-06-12-copilot-code-review-new-configurations-and-controls/) | 2026-06-12 | Official vendor changelog | Medium | Agent/code-review control planes are adding configuration, runner, content-exclusion, and instruction controls. | Configurability is not operational-state authority. |
| [GitHub availability report: May 2026](https://github.blog/news-insights/company-news/github-availability-report-may-2026/) | 2026-06-11 | Official availability report | Medium | Persistent cloud-agent/session infrastructure remains fallible; runtime persistence is not final-state proof. | Reliability reports do not define write-validity policy. |
| [OpenAI to acquire Ona](https://openai.com/index/openai-to-acquire-ona/) | 2026-06-11 | Official company post | Medium | Secure persistent agent environments are becoming mainstream, increasing the need for typed admitted evidence. | Persistence does not solve currentness, authority, or target receipt. |
| [Amazon Bedrock AgentCore release notes](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html) | observed 2026-06-15 | Official docs | Medium | Runtime, Memory, Browser, and Code Interpreter are separate platform surfaces and evidence lanes. | Platform capability evidence, not artifact-review proof. |
| [National Academies human-AI teaming processes chapter](https://www.nationalacademies.org/read/26355/chapter/5) | 2022 | Review/report | Medium | Shared mental models include taskwork, teamwork, teammate, and system models; PM state should expose role/source/currentness. | Review source; product value still needs measured workflow outcomes. |
| [Google Research: Teamwork Makes the Dream Work](https://research.google/pubs/teamwork-makes-the-dream-work-framing-ai-agents-within-transactive-memory-theory/) | current page observed 2026-06-15 | Research project/page | Medium | Transactive memory is a useful framing for AI agents as knowledge sources. | Project page, not an implementation proof. |

## 6. Prior-Version Claim Audit

| v12 claim or open item | v13 status | Correction or continuation |
| --- | --- | --- |
| Memory writes are external evidence admissions. | Partly closed in code | `memory_write` is now a first-class evidence kind with required write-admission metadata. |
| Memory reads can be control-flow influence. | Partly closed in code | `memory_retrieval` now classifies influence as fact, preference, instruction, tool-routing, policy-like rule, or summary. |
| Memory influence should bind high-consequence writes. | Narrowed | Admission/replay now emits warnings and metrics; broad runtime enforcement remains open. |
| Durable certificate/status verification is open. | Still open | v13 does not change the certificate frontier. |
| Target-side receipt evidence is open. | Still open | v13 does not change the receipt frontier. |
| PM handoff memory must preserve participant/source roles and burden metrics. | Strengthened but not closed | Memory source channel, intended use, influence kind, and override status become reusable PM handoff-memory fields. |
| Persistent agent runtime state increases urgency. | Strengthened | OpenAI/Ona, AgentCore, and GitHub reliability/control-plane docs are context signals only; they do not prove substrate authority. |

## 7. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Untrusted memory writes become trusted future context | Memory-write admission | MPBench / memory poisoning | High for risk, Medium until peer reviewed | Memory writes should be admitted with source channel, intended use, influence role, override status, freshness, and review outcome. | Add `memory_write` evidence kind and replay fixtures for poisoned, hidden-instruction, clean preference, and stale memories. | `memory_write_metadata_coverage`, `poisoned_memory_admission_escape_count` | A hidden-instruction memory write can become clean admitted evidence without warning. | Over-filtering can erase legitimate user preferences; provenance may reveal sensitive user context. |
| Retrieved memory changes tool order | Control-flow influence | MCFA / MEMFLOW | High for bridge | Memory retrieval used as instruction/tool-routing/policy should trigger stronger review than memory used as a factual note. | Add `influenceKind` and override-status warnings for control-influencing memory. | `memory_influence_kind_coverage`, `memory_control_override_warning_rate` | Memory changes tool order without an influence warning. | Influence metadata can become profiling data; minimize and tenant-scope it. |
| Current workflow overrides stale remembered instruction | Override status | Agent memory security + workflow governance | Medium-high | Recalled control memory should never outrank current user/workflow state without explicit active status. | Warn on missing override status; warn on `user_overridden`, `workflow_overridden`, or `superseded`. | `overridden_control_memory_warning_rate`, `override_escape_count` | A workflow-overridden memory still drives action without review. | Bad override handling can frustrate users who expect stable preferences. |
| Persistent agent environments are mistaken for authority | Persistence vs operational state | OpenAI Ona, AgentCore, GitHub availability | Medium | Long-running environments need admitted evidence and final-state proof, not just durable sessions. | Keep platform/runtime sources as evidence lanes; do not promote session memory into `CurrentStateView`. | `runtime_state_admission_rate`, `session_state_authority_downgrade_count` | Persistent session state alone predicts valid writes with no source failures. | Runtime telemetry may expose customer code, org metadata, or operational habits. |
| Vendor control knobs are treated as policy proof | Configured control plane | GitHub Copilot controls | Medium | Content exclusion/custom instructions are provider policy evidence, not substrate source authority. | Bind control-plane config to provider-policy evidence and current revision/scope. | `provider_policy_revision_coverage`, `control_plane_scope_drift_count` | A provider config change invalidates a review but goes undetected. | Config capture can leak repository policy and security posture. |
| Team memory collapses source roles | Transactive memory/source-channel roles | Human-AI teaming / TMS | Medium | PM memory should say who/which source/channel established a remembered claim and whether it is active, superseded, or overridden. | Reuse memory facets for PM handoff memories and meeting summaries. | `participant_source_role_coverage`, `handoff_memory_override_coverage` | Flattened summary equals typed source roles on conflict-sensitive handoffs. | Meeting-memory governance must protect dissent, privacy, and sensitive participant statements. |
| More PM protocol becomes ceremony | Protocol burden | Human-AI teaming and PM coordination | Medium | Memory governance should be measured by better risk capture and fewer invalid actions, not by artifact count. | Add burden metrics before expanding runtime gates. | `protocol_burden_cost`, `risk_capture_delta`, `handoff_rework_rate` | New memory taxonomy increases work without reducing invalid actions or rework. | Excess monitoring can reduce autonomy and psychological safety. |

## 8. New Or Changed Hypotheses

1. **High: Memory writes need admission metadata before reuse.** The v13 contract adds `sourceChannel` and `intendedUse` so a remembered item can be distinguished as observation, summary, preference, rule, decision, or derived projection.
2. **High: Memory reads need influence metadata before high-consequence use.** `influenceKind` separates fact, preference, instruction, tool-routing, policy-like rule, and summary because the risk profile differs by use.
3. **High: Control-influencing memory needs override status.** Memory used as instruction, tool routing, or policy should declare whether it is active, user-overridden, workflow-overridden, or superseded.
4. **Medium-high: Pure admission is the right first closure.** The current slice intentionally stops before write-binding consumption so tests can prove the taxonomy without creating false broad-governance claims.
5. **Medium: Persistent agent environments make the memory boundary more urgent.** OpenAI/Ona and AgentCore are market/context signals that long-running agents will have more persistent state surfaces; they do not change the proof requirement.
6. **Medium: PM handoff memory should reuse the same source-channel/influence model.** Team knowledge needs source, channel, intended use, and override status to avoid stale or flattened coordination state.

## 9. Project-Management Implications

PM substrate value still lives in shared operational cognition, not richer notes. v13 adds a sharper rule: team memory is only useful when the substrate can say what kind of remembered item it is and whether it still applies.

1. **Source-channel PM memory.** Meeting notes, status updates, code-review comments, and automation memory should preserve the source channel rather than flatten into a generic summary.
2. **Intended-use PM memory.** A preference, risk note, decision, rule, and derived projection should not be treated as equivalent PM state.
3. **Override-aware handoffs.** A remembered "use tool X" or "skip review Y" must yield to current workflow/user state unless explicitly revalidated.
4. **Burden measurement.** The taxonomy is justified only if it improves risk capture, time-to-valid-action, or handoff rework compared with a lighter baseline.

## 10. Implementation Implications For pm-substrate

This run converted the strongest open v12 memory finding into code:

1. Added `memory_write` as a distinct `ExternalStateEvidenceKind`.
2. Extended `MemoryEvidenceFacet` with `sourceChannel`, `intendedUse`, `influenceKind`, and `overrideStatus`.
3. Added admission warnings for missing memory-write metadata, missing influence classification, missing override status for control-influencing memory, and recalled control memory that has already been overridden.
4. Extended the replay corpus with hidden-instruction memory write, clean preference memory write, and overridden tool-routing memory retrieval.
5. Extended replay metrics with `memoryWriteCount`, `memoryControlInfluenceCount`, and `memoryInfluenceKinds`.

Implementation/Test Task Tree (2026-06-15):

```text
memory write admission metadata ........ IMPLEMENTED (pure)
memory read influence taxonomy ......... IMPLEMENTED (pure)
memory replay corpus + metrics ......... IMPLEMENTED (pure)
durable memory status / revocation ..... OPEN
write-binding consumption of memory .... OPEN
target-side receipt evidence ........... OPEN
PM protocol-burden measurement ......... OPEN
```

Verification run for this completion:

- `pnpm exec tsc -p packages/agent-state/tsconfig.json --noEmit --pretty false`
- `pnpm --filter @pm/evals typecheck`
- `pnpm vitest run packages/agent-state/src/external-evidence.test.ts --reporter=basic`
- `pnpm vitest run packages/evals/src/evidence-admission.test.ts --reporter=basic`

## 11. Rejected, Weak, Or Stale Bridges

| Bridge or claim | Status | Reason |
| --- | --- | --- |
| Memory taxonomy equals safe runtime memory. | Reject | v13 only proves pure admission/replay warnings, not store currentness, deletion fidelity, or write binding. |
| Memory retrieval is passive context. | Reject | MCFA makes retrieved memory a possible control-flow input. |
| Persistent cloud-agent environments provide operational state. | Downgraded | Persistence is a capability; authority still requires source, freshness, workflow, and target-state checks. |
| Vendor control-plane knobs are substrate policy. | Weak | Content exclusion and custom instructions are provider-policy evidence, not deterministic substrate authority. |
| PM summaries are adequate team memory. | Downgraded | Conflict-sensitive handoffs need source/channel/role/override fields, not just prose. |
| All memory-control issues should block immediately. | Weak | Some evidence should warn first until consequence, source, and workflow policy are bound to runtime write paths. |

## 12. Metrics And Eval Scenarios To Add

New metrics added in code:

- `memoryWriteCount`
- `memoryControlInfluenceCount`
- `memoryInfluenceKinds`

Metrics still to add:

- `memory_write_metadata_coverage`
- `poisoned_memory_admission_escape_count`
- `memory_influence_kind_coverage`
- `memory_control_override_warning_rate`
- `override_escape_count`
- `memory_backed_write_binding_coverage`
- `memory_deletion_status_checked_at_coverage`
- `target_receipt_coverage`
- `dispatch_without_receipt_rate`
- `participant_source_role_coverage`
- `protocol_burden_cost`
- `risk_capture_delta`
- `handoff_rework_rate`

Eval scenarios:

1. **Hidden-instruction memory write.** A memory write embeds a future instruction but lacks intended-use or override metadata; expected warning or block depending on consequence.
2. **Clean preference memory write.** A user preference with source channel, intended use, influence kind, and active override status is admitted.
3. **Workflow-overridden tool-routing memory.** A recalled memory recommends a tool path now superseded by workflow state; expected warning.
4. **Poisoned memory denial.** A malicious memory write tries to become policy-like rule evidence; expected rejection once a denial lane is added.
5. **Memory-backed high-consequence write.** A write binding consumes a control-influencing memory review; expected verified binding before dispatch.
6. **PM handoff memory conflict.** A meeting summary conflicts with a later owner decision; expected source-role and override preservation.

## 13. Next-Day Watchlist

1. Decide whether memory influence review belongs directly in `InvocationEvidenceBinding` or only in admitted evidence consumed by that binding.
2. Add poisoned-memory denial cases, not only warn-first control-surface cases.
3. Extend memory evolution/compaction lineage beyond write/read classification.
4. Add target-side receipt evidence before memory write success can become admitted shared state.
5. Re-check MPBench/MEMFLOW code/data availability and peer-review status.
6. Run PM burden metrics on an existing automation transcript or ArrowHedge replay trace.
7. Keep durable certificate/status catalog on the frontier; v13 did not close it.

## 14. Source Inventory With Links And Dates

New or strengthened in v13:

- From Untrusted Input to Trusted Memory: A Systematic Study of Memory Poisoning Attacks in LLM Agents, arXiv preprint, 2026-06-03: https://arxiv.org/abs/2606.04329. Source type: primary preprint/benchmark proposal. Finding strength: High for risk taxonomy, Medium until peer review and code/data inspection.
- From Storage to Steering: Memory Control Flow Attacks on LLM Agents, arXiv preprint, 2026-03-16: https://arxiv.org/abs/2603.15125. Source type: primary preprint. Finding strength: High for memory-as-control bridge, Medium until peer review.
- Copilot code review: New configurations and controls, GitHub changelog, 2026-06-12: https://github.blog/changelog/2026-06-12-copilot-code-review-new-configurations-and-controls/. Source type: official vendor changelog. Finding strength: Medium for provider-control-plane pressure.
- GitHub availability report: May 2026, GitHub Blog, 2026-06-11: https://github.blog/news-insights/company-news/github-availability-report-may-2026/. Source type: official availability report. Finding strength: Medium for persistent runtime/final-state caution.
- OpenAI to acquire Ona, OpenAI, 2026-06-11: https://openai.com/index/openai-to-acquire-ona/. Source type: official company post. Finding strength: Medium as market/runtime context.
- Amazon Bedrock AgentCore release notes, AWS docs, observed 2026-06-15: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html. Source type: official docs. Finding strength: Medium for evidence-lane separation.
- National Academies, Human-AI Teaming Processes and Effectiveness, 2022: https://www.nationalacademies.org/read/26355/chapter/5. Source type: review/report. Finding strength: Medium for shared mental-model and calibrated teaming.
- Google Research, Teamwork Makes the Dream Work: Framing AI agents within transactive memory theory, observed 2026-06-15: https://research.google/pubs/teamwork-makes-the-dream-work-framing-ai-agents-within-transactive-memory-theory/. Source type: research project/page. Finding strength: Medium for PM/TMS framing.

Carried forward and still active:

- v12 W3C VC/Data Integrity/Bitstring Status List sources remain active for durable certificate/status work.
- v12 MCP and OpenTelemetry sources remain active for state handles, correlation, and target-side receipt evidence.
- v10-v12 PM and human-AI teaming sources remain active for protocol-burden and role-utility measurement.

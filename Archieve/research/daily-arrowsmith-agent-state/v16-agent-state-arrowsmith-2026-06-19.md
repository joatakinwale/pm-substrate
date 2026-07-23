# v16 Agent-State Arrowsmith - 2026-06-19

Date: 2026-06-19 UTC
Local run clock: 2026-06-19 07:35:12 CDT
Status: sixteenth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v15-agent-state-arrowsmith-2026-06-16.md`

Repository sync note: this run read the automation memory, ran `git fetch origin main`, then `git pull --ff-only origin main`. Local `HEAD`, `origin/main`, and `FETCH_HEAD` all resolved to `bf7d021bcadf93ad536f161d440d62fb2f7ff6bc` before writing. The worktree already contained uncommitted June 18 ArrowHedge live-bridge, live-dashboard, and substrate-enforcement changes; this run treats them as local repo evidence and does not claim they are published `main` behavior.

## 1. Delta From Prior Version

v15 identified status-currentness as the next authority boundary for replay certificates, target receipts, MCP task handles, and PM handoff acknowledgements. v16 keeps that claim, but the local June 18 ArrowHedge bridge work exposes a sharper precondition: **a blocking review must become a terminal action outcome, not merely a warning or another event beside an accepted action**.

The key correction came from the dashboard-data audit. The live seeded ArrowHedge experiment found stale actions that the substrate could identify, but the pre-fix event builder could emit both `portfolio.decision.accepted` and `workflow.blocked.stale_state` for the same stale-but-agreeing decision. That means "stale block event exists" was not equivalent to "mutation was prevented." The local source diff now adds `!isStale(snapshot)` to the acceptance guard, but because the change is uncommitted it remains evidence for today's research boundary, not a closed published primitive.

Today's research adds recent runtime-compliance, semantic agent-context, shared-workspace, and human-in-the-loop sources. Together they say the same thing: governance claims must be checked **inside the execution path**, with a modeled context and explicit transition/terminal-state semantics. Offline traces, dashboard counts, status refs, and human approvals are evidence; they become protection only when they control the action boundary.

## 2. New Sources Reviewed

| Source | Authors | Year/date | Link | Source type | Relevance |
| --- | --- | --- | --- | --- | --- |
| Runtime Compliance Verification for AI Agents | Nafiseh Kahani, Masoud Barati, Diana Addae | 2026-06-17 | https://arxiv.org/pdf/2606.19242 | arXiv preprint / primary research | Proposes C-Trace for checking agent execution traces against temporal and resource constraints. Supports run-time compliance artifacts and escalation from post-hoc trace review to pre-action monitors. |
| Searching for Synergy in Shared Workspace Human-AI Collaboration | Nachiket Kotalwar, Rohini Das, Carolyn Rose | 2026-06-16 | https://arxiv.org/html/2606.18413v1 | arXiv preprint / primary research | Shows shared workspace benefits depend on task type and interface scaffolding. PM value cannot be inferred from "shared state" alone; agreement, role clarity, and burden must be measured. |
| Formal Modeling of LLM Agents' Context: A Semantic Approach | Nan Guan | 2026-06-15 v2 | https://arxiv.org/html/2606.06523v2 | arXiv preprint / primary research | Models agent context semantically and warns against treating unstructured context as sufficient. Supports explicit `currentStateView`, observation contract, and transition-state modeling. |
| From Agent Traces to Trust | Jezabel Shaw, Sean Zdenek, Merve Hickok, Louis Rosenberg | 2026-06 | https://arxiv.org/html/2606.04990v2 | survey / arXiv preprint | Strengthens trace provenance and audit vocabulary but does not make traces an enforcement boundary by themselves. |
| Managing Uncertainty in LLM-based Multi-Agent System Operation | Man Zhang, Tao Yue, Yihua He | 2026-02-26 | https://arxiv.org/abs/2602.23005 | arXiv preprint / primary research | Treats uncertainty as a system/runtime concern across coordination, data pipelines, HITL, and control logic. Maps directly to uncertainty status fields and runtime adaptation. |
| ArrowHedgeLab <-> pm-substrate Live Bridge & Experiment Design | local repo / Joat | 2026-06-18 | `research/arrowhedge-live-substrate-bridge_2026-06-18.md` | local implementation/design evidence | Provides a seeded A-vs-B experiment where raw agents take stale actions and substrate COP detects/blocks them, with the limitation that seeded ticks are not yet a full live `run_hedge_fund()` proof. |
| Dashboard data audit | local repo / Joat | 2026-06-18 | `research/dashboard-data-audit-2026-06-18.md` | local audit evidence | Reveals the critical accepted-plus-blocked overlap. Forces the research claim to distinguish detected warning, emitted block event, and actual terminal enforcement. |
| Live Dashboard Backend + Visualization Redesign | local repo / Joat | 2026-06-18 | `research/dashboard-live-backend-design_2026-06-18.md` | local design evidence | Splits "what agents wanted" from "what substrate allowed/blocked." Supports dashboard metric provenance and mutually exclusive decision-funnel tests. |

## 3. Older Sources Added

| Source | Authors | Year/date | Link | Source type | Mechanism extracted |
| --- | --- | --- | --- | --- | --- |
| ToolGate: Contract-Grounded and Verified Tool Execution for LLMs | Yanming Liu et al. | 2026-01-08 | https://arxiv.org/abs/2601.04688 | arXiv preprint / primary research | Hoare-style preconditions and postconditions gate tool invocation and state commits. This is the closest mechanism to "block event must suppress action." |
| Formalising Human-in-the-Loop: Computational Reductions, Failure Modes, and Legal-Moral Responsibility | Maurice Chiodo et al. | 2025 | https://arxiv.org/abs/2505.10426 | arXiv preprint / primary research | HITL is not one mechanism; endpoint review, interactive oversight, and monitoring have different responsibility and safety properties. PM handoff/approval needs to say which kind it is. |
| Managing Uncertainty in LLM-based Multi-Agent System Operation | Man Zhang, Tao Yue, Yihua He | 2026-02-26 | https://arxiv.org/abs/2602.23005 | arXiv preprint / primary research | Adds lifecycle language: uncertainty must be represented, identified, evolved, and adapted at runtime. |
| From Agent Traces to Trust | Shaw et al. | 2026-06 | https://arxiv.org/html/2606.04990v2 | survey / arXiv preprint | Trace schemas and provenance are necessary for audit and diagnosis, but traces require policy/effect interpretation before they can prove protection. |

## 4. Arrowsmith Bridge Table

| Agent-state problem | Bridge concept | Source discipline | Supporting papers | Implementation implication | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| Stale decision emits both accepted and blocked events | Terminal outcome partition | Databases, workflow verification, runtime compliance | Local dashboard audit; ToolGate; C-Trace | Add an executable decision-outcome partition: for one action id, exactly one terminal outcome may be accepted, rejected, blocked, held, or escalated. | High | A stale-but-agreeing ArrowHedge snapshot can still produce both accepted and blocked terminal events. |
| Compliance is found after the run, not before action | Runtime compliance monitor | Runtime verification / MAS operations | C-Trace; Managing Uncertainty | Status/currentness checks should attach to action review and dispatch, not only dashboard/audit replay. | Medium-high | Post-hoc trace audit catches the same stale actions before side effects with no in-path check. |
| Context window is treated as current state | Semantic context model | Formal semantics / agent context | Formal Modeling of LLM Agents' Context | Keep `currentStateView` and `ObservationContract` as typed context models; never treat a prompt transcript as the state model. | Medium-high | A transcript-only agent matches typed context validation on stale, authority, projection drift, and terminal partition fixtures. |
| Shared workspace improves coordination in some tasks but adds burden in others | Structured shared workspace and scaffolding | Human-AI collaboration / PM | Shared Workspace Human-AI Collaboration; HITL formalization | PM substrate should measure role clarity, action ownership, stale status, and burden, not only expose richer shared dashboards. | Medium | PM dashboard/shared workspace exposure improves every task without role/status scaffolding or burden measurement. |
| A receipt/certificate/status ref is reused after conditions change | Decision-time status currentness | Credential/status standards and runtime assurance | v15 W3C status sources; C-Trace; Managing Uncertainty | Keep `EvidenceStatusCheck` as next pure type, but require it to feed the terminal decision envelope. | High | Revoked/stale status refs can support writes without increasing final-state inconsistency. |
| Dashboard metrics imply protection when they are only counts | Metric provenance and semantic partition | Observability / PM COP | Local dashboard audit; From Agent Traces to Trust | Dashboard numbers need query provenance and lifecycle semantics: proposed -> terminal outcome must reconcile. | High | Dashboard labels remain correct when accepted + blocked exceeds proposed for the same decision set. |
| Human approval or handoff is treated as safety | Oversight mode classification | HITL / project management | HITL formalization; Shared Workspace paper | PM handoff artifacts should classify approval mode, status authority, escalation owner, and expiration before they gate actions. | Medium | A generic acknowledgement performs as well as typed handoff status under stale/superseded owner fixtures. |

## 5. Claim Ledger

| Claim | Status | v16 evidence and correction |
| --- | --- | --- |
| Evidence status must be checked at decision time. | Confirmed | v15 still stands. v16 adds that status checks must feed a terminal decision envelope, not just an artifact or dashboard row. |
| A stale-block event means mutation blocking occurred. | Revised / contradicted for pre-fix local ArrowHedge live bridge | The dashboard audit found accepted-plus-blocked overlap before the local guard fix. A block record can be advisory unless the accept path is suppressed. |
| The June 18 live bridge proves the thesis end to end. | Downgraded | It is strong seeded evidence and found a real defect, but the run uses seeded ticks and uncommitted source changes; full live `run_hedge_fund()` proof with API-backed agents remains open. |
| Dashboard pass/fail rates are proof of valid action governance. | Downgraded | Metrics are only proof if they are query-traced and lifecycle-partitioned. `gateFailures` and `staleBlocks` can double-present the same event. |
| `EvidenceStatusCheck` is still the next pure status primitive. | Confirmed with scope change | Add it, but attach it to action outcome review/write binding and terminal event emission. |
| More shared workspace/context automatically improves PM coordination. | Downgraded | Shared-workspace evidence is task- and interface-sensitive. pm-substrate must measure role clarity, owner convergence, rework, and burden. |
| Runtime compliance can be external to the agent loop. | Downgraded | C-Trace-style post-hoc checks help audit, but protection requires in-path monitorability/enforceability classification. |
| Context semantic modeling strengthens current-state views. | Confirmed | Formal context modeling supports typed operational context over raw transcript/context-window state. |
| Human-in-the-loop approval is one uniform safety control. | Downgraded | HITL mechanisms differ. Endpoint approval, continuous monitoring, and interactive oversight need distinct substrate fields and responsibility boundaries. |

## 6. Implementation Implications

1. **Add a terminal decision envelope before broad status stores.**
   - Candidate name: `ActionOutcomeReview` or `ActionExecutionGate`.
   - Inputs: `ActionProposalReview`, `EvidenceStatusCheck[]`, policy disposition, target receipt requirement, final selected terminal outcome.
   - Invariant: for a stable action/decision id, exactly one terminal outcome is emitted.

2. **Keep `EvidenceStatusCheck`, but make it executable.**
   - Fields from v15 still apply: status authority, purpose, checkedAt, validFrom/validUntil, status ref/list, revocation/suspension/refresh, stale policy, privacy/correlation note.
   - New v16 attachment point: status checks should be consumed by the terminal decision envelope and write-binding verifier.

3. **Codify ArrowHedge terminal partition tests.**
   - Stale-but-agreeing decision: proposed + blocked, not accepted.
   - Clean accepted decision: proposed + accepted, no block.
   - Hold/no-op: proposed or observed according to lifecycle definition, but not counted as accepted or blocked.

4. **Make dashboard metrics query-traceable.**
   - Rename projection counters so they do not overclaim validity.
   - Present stale blocks as a cause/breakdown of gate failures, not an independent problem count.
   - Add provenance for each KPI query and assert funnel reconciliation.

5. **Promote local live bridge only after commit and replay normalization.**
   - The local June 18 bridge is valuable evidence, but research ledgers should mark it as uncommitted until published.
   - Old tenants with pre-fix accepted-plus-blocked events should be labeled pre-fix or excluded from current dashboard claims.

## 7. Testing/Eval Implications

New or sharpened scenarios:

| Scenario | Expected assertion | Metric |
| --- | --- | --- |
| Stale-but-agreeing ArrowHedge decision | `portfolio.decision.accepted` is not emitted; `workflow.blocked.stale_state` is terminal. | `terminal_outcome_partition_violation_count` |
| Clean accepted ArrowHedge decision | Exactly one accepted terminal event and zero block events. | `decision_funnel_reconciliation_rate` |
| Dashboard stale blocks | `staleBlocks` appears as a gate-failure cause; no double-counted KPI interpretation. | `gate_failure_cause_coverage` |
| Status check revoked before dispatch | Terminal outcome is blocked or escalated according to consequence policy. | `revoked_status_escape_count` |
| Receipt applied but final state disagrees | Receipt is not final-state proof; final-state assertion fails. | `receipt_to_final_state_consistency` |
| PM handoff acknowledged then superseded | Acknowledgement is stale and cannot support write without refresh/escalation. | `handoff_supersession_caught_rate` |
| Shared workspace with role ambiguity | PM/agent actors fail agreement metrics until owner/source/escalation fields are explicit. | `role_clarity_delta`, `protocol_burden_cost` |

Assertions to add or preserve:

- A block-class event must either suppress the action event or explicitly carry `enforcementMode: "advisory"` so dashboards cannot overread it.
- Decision lifecycle tests must partition by stable decision/action id, not by event type totals alone.
- Metrics derived from COP projections must declare whether they count raw events, consumed projection records, terminal decisions, or validation verdicts.
- `EvidenceStatusCheck` replay rows must prove valid, revoked, suspended, refresh-required, stale, failed, superseded, authority-mismatch, and privacy/correlation cases before durable store work.

## 8. Open Questions For Next Run

1. Should the terminal envelope live in `@pm/agent-state` beside `ActionProposalReview`, or in `@pm/workflow` beside write binding?
2. Does the existing `ActionProposalReview.execution` field need to become a first-class terminal lifecycle object, or should the terminal outcome be a separate post-review artifact?
3. How should old live tenants that contain pre-fix accepted-plus-blocked decisions be marked so dashboards do not present them as current substrate behavior?
4. Can the live ArrowHedge endpoint generate a committed replay corpus comparable to the existing fixture JSONL corpora?
5. Should status checks be mandatory only for write-capable actions, or also for high-consequence read/summary/handoff actions?
6. How should PM burden be sampled in live runs without turning status tracking into surveillance?
7. Can the seeded ArrowHedge experiment be repeated with at least 30 ticks and then with the real `run_hedge_fund()` call path?

## 9. Recommended Next Code Slice

Implement a small terminal-outcome partition layer around ArrowHedge decisions before building the durable status store:

1. Add a pure helper that derives terminal outcome per decision id from proposal, stale-state check, state disagreement, status checks, and acceptance intent.
2. Add tests for stale-but-agreeing, clean accepted, disagreement-blocked, and hold cases.
3. Assert `accepted + blocked + rejected + held == proposed` for the fixture/live dashboard rollup.
4. Thread the new outcome into dashboard metrics with query provenance and cause breakdowns.
5. Then attach `EvidenceStatusCheck` to that same envelope and expand the replay matrix.

Do not use the June 18 local bridge as a published proof until the relevant source, docs, and experiment output are committed and the old pre-fix tenants are clearly labeled or retired.

## Source Inventory With Links And Dates

New in v16:

- Runtime Compliance Verification for AI Agents, arXiv:2606.19242, submitted 2026-06-17: https://arxiv.org/pdf/2606.19242.
- Searching for Synergy in Shared Workspace Human-AI Collaboration, arXiv:2606.18413, submitted 2026-06-16: https://arxiv.org/html/2606.18413v1.
- Formal Modeling of LLM Agents' Context: A Semantic Approach, arXiv:2606.06523v2, observed 2026-06-19: https://arxiv.org/html/2606.06523v2.
- From Agent Traces to Trust, arXiv:2606.04990v2, observed 2026-06-19: https://arxiv.org/html/2606.04990v2.
- Managing Uncertainty in LLM-based Multi-Agent System Operation, arXiv:2602.23005, submitted 2026-02-26: https://arxiv.org/abs/2602.23005.
- ToolGate: Contract-Grounded and Verified Tool Execution for LLMs, arXiv:2601.04688, submitted 2026-01-08: https://arxiv.org/abs/2601.04688.
- Formalising Human-in-the-Loop, arXiv:2505.10426v2, revised 2025-09-25: https://arxiv.org/abs/2505.10426.
- Local repo evidence: `research/arrowhedge-live-substrate-bridge_2026-06-18.md`, `research/dashboard-data-audit-2026-06-18.md`, `research/dashboard-live-backend-design_2026-06-18.md`, and the uncommitted diff in `packages/capability-finance-research-ingest/src/arrowhedge.ts`.

Carried forward:

- v15 W3C Bitstring Status List, VC Overview, OpenTelemetry events, MCP stateless/tasks, STAGE-Claw, STATE-Bench, PABU, Belief Memory, and PM/human-AI teaming sources remain active.
- v14 target-receipt evidence and v13 memory-influence evidence remain scoped to pure/replay primitives unless the live bridge and write transports consume them in a terminal enforcement path.

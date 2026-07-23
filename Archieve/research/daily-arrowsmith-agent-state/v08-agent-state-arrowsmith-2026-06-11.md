# v08 Agent-State Arrowsmith - 2026-06-11

Date: 2026-06-11 UTC
Local run clocks: upstream replay-corpus run targeted 2026-06-11 America/Chicago; continuation reconciliation ran 2026-06-11 09:03:05 CDT
Status: eighth numbered daily continuation, reconciled after same-day upstream v08/code landing
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md`
Paired competitive-intelligence state: `research/daily-ai-competitive-intelligence/v05-ai-competitive-intelligence-2026-06-11.md`

Repository sync note: this run started by protecting dirty local root changes in stash `automation-pre-ff-research-pm-substrate-2026-06-11`, removing a stale zero-byte `.git/HEAD.lock` from June 9 after `lsof` showed no owner, and fast-forwarding to `bc716c85addd2209108fbcfce75ad0fcb053f7b8`. During validation, `origin/main` advanced to `146ed07` with a same-day v08 and evidence-admission replay-corpus implementation. The final v08 reconciles that upstream work with the fresh Arrowsmith scan instead of creating a duplicate version.

## 1. Version Header

v08 continues v07 rather than restarting the thesis. It treats the June 10 and June 11 code on `main` as new evidence: external evidence admission, ObservationContract v2 bindings, multi-object roles, run groups, PM handoff agreement, deterministic fixture metrics, and a committed evidence-admission JSONL replay corpus are now implemented pure primitives. The research frontier therefore moves from "create admission" and "persist admission fixtures" to evidence-action binding, trajectory release budgets, explicit policy-transition conformance, reviewer recall for cross-turn state defects, live MCP/runtime revalidation, skill-document governance, and real-run PM handoff agreement.

## 2. One-Paragraph Delta From Previous Version

v07 correctly identified external evidence admission as the next mechanism, but that slice is now closed in pure code and partially closed as durable replay evidence: `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` is committed and drift-tested against regenerated reviews. v08 downgrades stale claims that MCP handles, memory retrievals, PM handoffs, approval records, provider policies, workflow traces, custom stores, or subagent outputs lack a substrate admission lane, and it also narrows the golden-artifact gap to ArrowHedge on-disk state-review artifacts rather than admission reviews. The open gap is stricter: admitted evidence still does not prove action-policy conformance, privacy-safe release across a trajectory, live MCP revalidation, runtime mutation blocking, skill governance, or reviewer recall for cross-turn state defects. New June 10 sources sharpen that gap: OCELOT argues privacy leakage is trajectory-level and budgeted; a finite-state social-simulation paper shows LLM action selectors can drift from explicit reference policies; a production transaction-agent judge study shows LLM judges miss cross-turn state and guardrail failures; SkillAxe shows skill documents need trigger/instruction/fault-coverage evaluation before being trusted; and MCP SEP-2567 remains useful addressability evidence while still leaving handles as ordinary tool data rather than authority.

## 3. Research Question

If pm-substrate now admits and replays external evidence as evidence-only, what additional substrate checks are needed before an existing LLM agent can validly act under partial observability, explicit policy constraints, privacy budgets, workflow state, and project handoff obligations?

## 4. A/B/C Framing

- A literature: LLM agents, multi-agent coordination, tool use, agent memory, workflow agents, skills, LLM judges, transaction agents, model/prompt/memory state, MCP tools/tasks/handles.
- B bridge concepts: evidence admission, committed replay corpus, policy conformance, finite-state reference policy, cumulative leakage budget, trajectory-level privacy, reviewer recall, cross-turn state defect, skill trigger precision, action-bias drift, protocol handle revalidation, handoff agreement, run-group localization.
- C literatures: privacy and information-flow control, social simulation / finite-state modeling, production QA and measurement, software skill libraries, distributed systems handles, process control, project handoff, team cognition, shared mental models, transactive memory, human-AI collaboration.

## 5. Source Map

| Source | Date | Type | Finding status | What it can support | What it cannot support |
| --- | --- | --- | --- | --- | --- |
| Evidence-admission replay corpus implementation, `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` and `packages/evals/src/evidence-admission.test.ts` | 2026-06-11 | Repo primary implementation artifact | High | Evidence-admission reviews are now committed and drift-tested as replayable corpus artifacts. | Does not prove runtime write-path enforcement or live MCP behavior. |
| OCELOT: Inference-Leakage Budgets for Privacy-Preserving LLM Agents, https://arxiv.org/abs/2606.12341 | 2026-06-10 | Primary arXiv preprint / not peer-reviewed | Medium-high | Privacy in agentic tool trajectories is cumulative and sink-dependent; a deterministic verifier plus ledger-like budget is a strong bridge for substrate release budgets. | Does not prove pm-substrate production privacy guarantees. |
| Should LLM Agents Decide in Social Simulations?, https://arxiv.org/abs/2606.12369 | 2026-06-10 | Primary arXiv preprint / not peer-reviewed | Medium | LLM action selection can drift from explicit finite-state/Markov reference policies and introduce prompt/model-dependent action bias. | Synthetic OSN simulation does not prove all operational agents violate policy. |
| Catching One in Five, https://arxiv.org/abs/2606.10315 | 2026-06-09 | Primary arXiv preprint / production study / not peer-reviewed | Medium-high | LLM-as-judge gates can miss cross-turn state, guardrail, recovery, and cart/confirm-state defects because the rubric/gate is miswired. | Single production domain; does not invalidate all automated judges. |
| SkillAxe, https://arxiv.org/abs/2606.10546 | 2026-06-09 | Primary arXiv preprint / benchmark method / not peer-reviewed | Medium | Skill documents need evaluation around trigger precision, instruction compliance, fault attribution, and solution-path coverage. | Does not make skill self-refinement an authority layer. |
| MCP latest specification, https://modelcontextprotocol.io/specification/2025-11-25 | Latest page shows 2025-11-25 as current on 2026-06-11 | Official docs / standard | High | MCP is stateful, tool annotations are untrusted unless from a trusted server, and protocol docs explicitly leave enforcement to implementors. | MCP does not supply business-state authority or substrate validation. |
| MCP roadmap, https://modelcontextprotocol.io/development/roadmap | Last updated 2026-03-05 | Official roadmap | High for roadmap, Medium for implementation timing | Tasks lifecycle still has operational gaps around retry and result expiry; enterprise readiness calls out audit and observability gaps. | Roadmap items are directional, not shipped guarantees. |
| SEP-2567 Sessionless MCP via Explicit State Handles, https://modelcontextprotocol.io/seps/2567-sessionless-mcp | 2026 | Official SEP | High | Corrects stale release-candidate wording: explicit-state-handle work is represented in an official SEP, but handles remain ordinary strings and explicit handle marking is future work. | Does not make handles authoritative state. |
| Humans' ALMANAC, https://arxiv.org/abs/2606.06388 | 2026-06-04 | Primary arXiv preprint / dataset / not peer-reviewed | Medium | Human collaboration needs action-level mental-model annotations around self-reasoning, partner intent, and shared goals. | Does not prove project-state correctness without executable substrate checks. |
| Development of Mental Models in Human-AI Collaboration, https://arxiv.org/abs/2510.08104 | 2025-10-09 | Conceptual arXiv paper / review-like | Low-medium | Human-AI collaboration changes domain, processing, and complementarity mental models through data context, transparency, and feedback. | Conceptual only; not direct implementation proof. |

## 6. Prior-Version Claim Audit

| v07 claim or frontier | v08 audit | Status |
| --- | --- | --- |
| Add `ExternalStateEvidence`, `EvidenceAdmissionReview`, and `AdmittedStateEvidence`. | `packages/agent-state/src/external-evidence.ts` now defines external evidence kinds, facets, reviews, evidence-only authority, admission decisions, observed-read-set bridging, and PM handoff agreement. | High / closed as pure primitive |
| Extend artifact metadata with external-evidence admission fields. | `StateReviewArtifact` metadata now supports `runGroupId` and `evidenceAdmissions`, with import validation. | High / closed as pure primitive |
| Add MCP-like, memory, workflow, approval, provider-policy, PM handoff, custom-store, and subagent fixtures. | `packages/evals/src/evidence-admission.ts` has an 18-fixture deterministic admission corpus and metrics. | High / closed as pure primitive |
| Persist admission reviews as golden artifacts. | Upstream same-day work added `buildEvidenceAdmissionReviewCorpus()`, `serializeEvidenceAdmissionReviewsJsonl()`, a checked-in JSONL corpus, and a drift test. | High / closed for admission reviews |
| Persisted/golden JSON artifacts remain entirely open. | No longer true for evidence-admission reviews; still true for a canonical on-disk ArrowHedge state-review artifact corpus. | Medium-high / modified |
| Keep external mutation blocking unclaimed. | Still true. Evidence admission remains advisory/pure unless runtime write paths consume it. | High / still open |
| MCP 2026-07-28 release-candidate semantics are future/draft. | Needs correction. The current official spec page still says 2025-11-25 latest, while SEP-2567 exists as an official SEP. Its key limitation remains: handles are ordinary strings and explicit handle marking is future work. | Medium / modified |
| Memory retention needs deletion, observability, and residue metadata. | Implemented as memory evidence facets and warning codes, but no trajectory-level deletion/leakage budget exists. | High / partially closed |
| Workflow consistency needs artifact run groups. | Run groups exist as pure eval grouping, but runtime-generated multi-artifact runs and workflow-stage enforcement remain open. | High / partially closed |
| PM handoffs need typed expertise/source/escalation fields. | Implemented as PM handoff evidence facets and agreement comparison, but only synthetic fixtures prove it. | High / partially closed |

## 7. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Evidence can be admitted and replayed but still leak sensitive facts across a tool trajectory. | Posterior-risk / inference-leakage budget | OCELOT; privacy / information-flow control | Medium-high | `EvidenceAdmissionReview` needs optional release-budget context before evidence is disclosed to sinks or used in externally visible actions. | Add pure `EvidenceReleaseReview` or extend admission policy with sink trust, data class, cumulative budget, and declassification reason. | `trajectory_leakage_budget_exceeded_rate`, `least_disclosing_release_rate` | Per-evidence privacy checks catch the same cumulative leakage failures as trajectory budgets. | Privacy claims must be fail-closed; do not imply cryptographic privacy from heuristic classifiers. |
| An agent can follow admitted evidence but drift from an explicit action policy. | Finite-state/reference-policy conformance | Social simulation finite-state vs LLM policy paper; control/process modeling | Medium | Valid action needs comparison to an explicit substrate policy automaton, not only evidence freshness/authority. | Add fixture where LLM-proposed action deviates from allowed finite-state transition despite fresh evidence. | `policy_transition_deviation_rate`, `prompt_induced_action_bias_rate` | State-review `allowedActions` catches all policy drift without an explicit transition model. | Avoid overfitting business policy to brittle FSMs; use them where policy is truly stateful and explicit. |
| Automated reviewers miss cross-turn operational defects. | Reviewer recall / rubric routing for state failures | Production transaction-agent LLM judge study | Medium-high | Evals must measure defect recall by state-failure class, not just pass/fail or judge agreement. | Add state-defect taxonomy to eval metrics: cart/state lockout, confirm-gate lockout, stale referent, recovery/escalation failure. | `state_defect_recall`, `judge_routing_miss_rate` | Existing assertion metrics catch human-labeled cross-turn defects at high recall without taxonomy changes. | Poor gates can create false confidence; report sensitivity/unknowns. |
| Skill files/instructions become hidden operational state. | Skill trigger precision and instruction compliance | SkillAxe; skill libraries / agent frameworks | Medium | Skills should be admitted or versioned as policy/context evidence when they influence action. | Add `skill_document` evidence kind or represent skills as `custom_store_record` with trigger, version, owner, and fault-coverage metadata. | `skill_trigger_false_positive_rate`, `skill_version_drift_warning_rate` | Skills can change pass rate without affecting action validity or state failures. | Self-refined skills should not silently expand authority or scope. |
| MCP handles are useful but opaque state carriers. | Ordinary string handle vs declared state handle | MCP SEP-2567; distributed-system handles | High | Treat handles as addressability tokens requiring revalidation, expiry, source, scope, and cleanup metadata. | Keep current MCP admission lane; add handle relationship metadata only as optional observed evidence until protocol declares it. | `handle_revalidation_rate`, `expired_handle_use_rate` | Live MCP handles can be safely reused without substrate revalidation in stale/expired scenarios. | Tool descriptions can mislead agents into over-trusting handles. |
| PM handoff evidence is synthetic in current tests. | Action-level mental model / partner intent / shared goal | ALMANAC; human collaboration / team cognition | Medium | Real PM handoff runs should compare actor intent, expected next action, shared goal, and source owner across artifacts. | Run `comparePmHandoffAgreement` over real multi-agent ArrowHedge or research-publish runs. | `handoff_goal_alignment_rate`, `partner_intent_resolution_rate` | Synthetic handoff agreement metrics predict no real downstream validity or rediscovery reduction. | Mental-model labels can become surveillance if tied to people without consent. |
| Runtime admission can remain disconnected from mutations. | Read-admit-review-write binding | OCC, sagas, workflow/runtime agents, pm-substrate code | High as design inference | Admission reviews should be consumed by workflow/capability write paths before side effects, still initially warn-first. | Add runtime integration test proving proposed writes carry admission review ids and policy disposition. | `write_without_admission_review_rate`, `admission_to_write_link_rate` | Runtime writes already cannot occur without evidence review in all capability paths. | Blocking policies can create false blocks; keep advisory vs enforcement explicit. |

## 8. New Or Changed Hypotheses

1. **High:** The next substrate layer is not more evidence admission or admission replay; it is evidence-action binding. A valid mutation should reference the admission reviews and state-review artifact that justified it.
2. **Medium-high:** Privacy for agentic PM systems should be measured over trajectories, not individual evidence items. OCELOT is not proof for pm-substrate, but it adds a strong mechanism for cumulative release-budget fixtures.
3. **Medium:** Explicit workflow policies need a transition-conformance lane. Fresh, authoritative evidence can still lead to an invalid action if the proposed transition is outside the current workflow automaton.
4. **Medium-high:** LLM judges should be treated as low-recall unless evals measure recall against known state-failure classes. Agreement with humans is insufficient when the operational gate routes defects to irrelevant rubric buckets.
5. **Medium:** Skill documents are state-bearing artifacts when they influence trigger selection or action scope. They should carry version, trigger, owner, and fault-coverage metadata before being treated as reusable agent policy.
6. **Medium:** PM mental-model alignment should be tested on real handoff artifacts, not only synthetic handoff facets.

## 9. Project-Management Implications

Project-management state is now less like a dashboard and more like a controlled handoff ledger. v08 adds three PM implications:

1. Handoff quality should be measured by whether the next actor can identify the current source steward, expertise owner, escalation route, valid next action, and shared goal without rediscovery.
2. Reviewer quality should be measured by recall of project-state defects: stale blocker, stale owner, stale approval, missing escalation, wrong workflow phase, and invalid next action.
3. AI skill/instruction libraries used by project agents are governance objects. They need trigger/version/scope metadata because they can quietly change what work an agent believes it is allowed to do.

## 10. Implementation Implications For pm-substrate

1. Add runtime evidence-action binding: every high-consequence workflow/capability write should carry `stateReviewArtifactId`, `evidenceAdmissionReviewIds`, policy disposition, and evaluated-at time.
2. Add a pure release-budget fixture family before runtime privacy claims: sink, trust level, data class, cumulative budget, release atoms, and declassification reason.
3. Add explicit policy-transition fixtures: current workflow phase + allowed transition + proposed action + reason, with warnings when admitted evidence supports a business fact but not the transition.
4. Add LLM-judge recall metrics to `@pm/evals`: state-defect class, human/fixture ground truth, judge label, gate route, detected/undetected.
5. Persist a canonical ArrowHedge on-disk artifact corpus so both the action-review lane and the evidence-admission lane have committed replay artifacts.
6. Exercise MCP admission against one live/local MCP server or fixture server to validate handle expiry, annotation trust, task-result revalidation, and cleanup metadata.
7. Treat skill documents as external evidence where they influence action selection; start with fixtures rather than a new broad abstraction.
8. Run PM handoff agreement over real multi-agent or automation runs and compare against downstream rediscovery/time-to-valid-action.
9. Keep invariant policy as advisory until a runtime enforcement boundary exists and false-block metrics are available.

## 11. Rejected, Weak, Or Stale Bridges

| Bridge | Status | Reason |
| --- | --- | --- |
| External evidence admission is still unimplemented. | Stale | It is implemented as pure primitives on `main`; remaining gap is runtime binding and live proof. |
| Evidence-admission reviews are only in-memory fixtures. | Stale | They now have a committed JSONL corpus and drift test. |
| All persisted/golden JSON artifact work is closed. | Weak / stale overreach | Evidence-admission review replay is closed; a canonical on-disk ArrowHedge artifact corpus remains open. |
| MCP explicit state handles are only future/draft release-candidate semantics. | Modified / stale wording | Official SEP-2567 exists, but it still leaves handle identity as ordinary tool data and explicit handle marking as future work. |
| LLM-as-judge agreement is sufficient eval quality. | Downgraded | The transaction-agent study shows state/guardrail defects can be routed away from operational gates. |
| Skill self-refinement can be trusted as governance. | Downgraded | SkillAxe improves skills in benchmarks, but governance still needs trigger/scope/version admission. |
| Finite-state policies are too rigid for PM workflows. | Weak, not rejected | Some PM policies are flexible, but approval, handoff, escalation, and workflow transitions often have explicit state machines worth testing. |
| Privacy is handled by redaction per evidence item. | Downgraded | OCELOT strengthens the bridge that leakage is cumulative and trajectory-dependent. |

## 12. Metrics And Eval Scenarios To Add

- `write_without_admission_review_rate`
- `admission_to_write_link_rate`
- `trajectory_leakage_budget_exceeded_rate`
- `least_disclosing_release_rate`
- `policy_transition_deviation_rate`
- `prompt_induced_action_bias_rate`
- `state_defect_recall`
- `judge_routing_miss_rate`
- `skill_trigger_false_positive_rate`
- `skill_version_drift_warning_rate`
- `handle_revalidation_rate`
- `expired_handle_use_rate`
- `handoff_goal_alignment_rate`
- `partner_intent_resolution_rate`
- `time_to_valid_action_after_handoff`

New eval scenarios:

1. Admitted evidence leads to a proposed write, but the write omits admission-review ids.
2. Multiple harmless disclosures cumulatively reveal a protected PM/client secret to a low-trust sink.
3. Fresh approval evidence supports the fact that a memo was approved, but the workflow phase no longer permits the action.
4. LLM judge labels a stale-owner or stale-blocker defect as "tone" or "personalization" and misses the operational gate.
5. Skill document trigger fires on a task outside its declared scope after a skill update.
6. MCP handle is syntactically valid but expired, from a different tenant, or no longer bound to the same server-side object.
7. Real PM handoff run shows correct source owner but wrong shared goal or invalid next action.

## 13. Next-Day Watchlist

1. Inspect whether `@pm/workflow`, `@pm/registry`, or capability packages can consume `EvidenceAdmissionReview` ids before writes with a minimal pure/runtime boundary.
2. Persist a canonical ArrowHedge on-disk state-review artifact corpus alongside the now-committed admission-review JSONL corpus.
3. Look for primary sources or official repos for OCELOT, the transaction-agent judge study, and finite-state social-simulation code/data.
4. Re-check MCP docs for explicit handle/annotation lifecycle updates and whether SEP-2567 is reflected in the dated spec.
5. Search PM/team-cognition literature for operational measures of handoff rediscovery cost, shared-goal alignment, and intent repair.
6. Search security/privacy literature for practical cumulative disclosure budgets that can be represented without training a new model.
7. Audit whether the local stash from this run contains user work that should be separately reconciled; do not apply it automatically during research continuation.

## 14. Source Inventory With Links And Dates

- Evidence-admission replay corpus, committed 2026-06-11, repo primary artifact: `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl`.
- Evidence-admission drift test and serializer, committed 2026-06-11, repo primary code: `packages/evals/src/evidence-admission.test.ts` and `packages/evals/src/evidence-admission.ts`.
- OCELOT: Inference-Leakage Budgets for Privacy-Preserving LLM Agents, Jin Xie and Songze Li, submitted 2026-06-10, primary arXiv preprint, not peer-reviewed: https://arxiv.org/abs/2606.12341.
- Should LLM Agents Decide in Social Simulations? Comparing Finite-State and LLM-Based Decision Policies, Alejandro Buitrago Lopez, Javier Pastor-Galindo, Jose A. Ruiperez-Valiente, submitted 2026-06-10, primary arXiv preprint, not peer-reviewed: https://arxiv.org/abs/2606.12369.
- Catching One in Five: LLM-as-Judge Blind Spots in Production Multi-Turn Transaction Agents, Sawyer Zhang, Alexander Wang, Sophie Lei, submitted 2026-06-09, primary arXiv preprint / production study, not peer-reviewed: https://arxiv.org/abs/2606.10315.
- SkillAxe: Sharpening LLM-Authored Agent Skills Through Evaluation-Guided Self-Refinement, Srishti Gautam, Arjun Radhakrishna, Sumit Gulwani, submitted 2026-06-09, primary arXiv preprint, not peer-reviewed: https://arxiv.org/abs/2606.10546.
- Model Context Protocol specification 2025-11-25, official docs, latest page observed 2026-06-11: https://modelcontextprotocol.io/specification/2025-11-25.
- Model Context Protocol roadmap, official docs, last updated 2026-03-05: https://modelcontextprotocol.io/development/roadmap.
- SEP-2567 Sessionless MCP via Explicit State Handles, official SEP, observed 2026-06-11: https://modelcontextprotocol.io/seps/2567-sessionless-mcp.
- Humans' ALMANAC: A Human Collaboration Dataset of Action-Level Mental Model Annotations for Agent Collaboration, Jiaju Chen et al., submitted 2026-06-04, primary arXiv preprint / dataset, not peer-reviewed: https://arxiv.org/abs/2606.06388.
- Development of Mental Models in Human-AI Collaboration: A Conceptual Framework, Joshua Holstein and Gerhard Satzger, submitted 2025-10-09, conceptual arXiv paper: https://arxiv.org/abs/2510.08104.

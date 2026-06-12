# v09 Agent-State Arrowsmith - 2026-06-12

Date: 2026-06-12 UTC
Local run clock: 2026-06-12 America/Chicago
Status: ninth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v08-agent-state-arrowsmith-2026-06-11.md`

Repository sync note: this run started from local `HEAD` `5bf4a6715aa0eefb8f8e0d16b582edc97f480bb6`, fetched `origin/main`, observed repeated AppleDouble pack-index warnings for `.git/objects/pack/._pack-2dcf13c47f36ca6851d8feab5e2c3396c6eacb3c.idx`, and fast-forwarded to `bb2c38d3b385f3ccd559df5e72d6701fbc7c6bd0`. The fetched upstream delta materially changed the v08 frontier: the ArrowHedge on-disk state-review corpus, write-binding replay corpus, opt-in workflow evidence-binding gate, catalog verification hook, and replay dashboard are now present in code. v09 therefore does not repeat the old "persist ArrowHedge corpus" recommendation as open work.

Required context read:

1. All Markdown docs under `research/`, including the competitive-intelligence stream.
2. `research/daily-arrowsmith-agent-state/index.md`.
3. `research/daily-arrowsmith-agent-state/v08-agent-state-arrowsmith-2026-06-11.md`.
4. `research/index.md`.
5. `Changelog.md`.
6. Current implementation surfaces around `@pm/agent-state`, ArrowHedge COP/artifacts, `@pm/evals`, `@pm/workflow` evidence binding, continuity payloads, registry isolation, and the new substrate replay dashboard.

Current strongest thesis:

> pm-substrate has crossed from pure review artifacts into an opt-in pre-write binding boundary: state-review artifacts, evidence-admission reviews, and write-binding replay records are now committed replay corpora, and selected write-capable workflow dispatch can block missing, incomplete, policy-blocked, or catalog-unverified bindings. The frontier is no longer "make observation reports executable artifacts." It is "make every external write transport prove a verified, current, policy-conformant, privacy-bounded, skill-aware state-review binding before side effects, then measure whether real handoffs and live protocol handles improve behavior."

## 1. Delta From Prior Version

v08 ended with five open implementation implications: runtime evidence-action binding, ArrowHedge on-disk artifact replay, release budgets, policy-transition fixtures, judge recall, skill governance, live MCP revalidation, and real-run PM handoff agreement. After fast-forwarding to `origin/main`, two of those are now partially or fully closed:

- **ArrowHedge on-disk artifact replay is implemented.** `packages/evals/fixtures/arrowhedge-state-review-artifacts.v1.jsonl` is committed, `buildArrowHedgeCanonicalStateReviewArtifactCorpus()` exists, and the drift test regenerates and compares the corpus.
- **Runtime evidence-action binding is partially implemented.** `@pm/workflow` now has `evidenceBindingMode: "require_for_writes"`, `InvocationEvidenceBinding`, `EvidenceBindingProvider`, `EvidenceBindingVerifier`, structural validation, explicit policy-block handling, and catalog verification. `@pm/evals` now has `write-binding-replay.v1.jsonl` and metrics over allowed, missing, incomplete, policy-blocked, and unverified bindings.
- **The claim boundary is stricter, not weaker.** The code now blocks selected write-capable workflow dispatch when the opt-in gate is enabled, but broad production mutation governance remains unclaimed until durable verification stores and all external write transports consume the binding gate.
- **A dashboard now exists as a replay monitor.** `@pm/substrate-dashboard` reads committed replay streams; it is a useful common-operating-picture surface for artifact review, not yet live operational telemetry.

New research from the June 11 arXiv window adds six mechanisms that should shape the next slice:

1. **Memory evolution is itself state.** EvoArena/EvoMem shows dynamic environments require structured update histories; memory patches improve evidence capture but do not establish authority.
2. **Executable tool wrappers hide read/write dependencies.** HyperTool-style MCP code blocks improve multi-step tool use by collapsing subcalls into one outer tool call, which makes observed read-set capture and subcall provenance more important.
3. **Agent evaluation is becoming protocolized and agentified.** AgentBeats uses A2A/MCP-style standardized assessment with judge agents, increasing the need for state-defect recall and judge-routing metrics before eval gates are trusted.
4. **Corrections can be compiled into runtime rules.** TRACE for coding agents supports turning repeated user corrections into enforcement checks, but those rules become governance artifacts that need skill/version/scope/source admission.
5. **Memory compaction is a control surface.** MemRefine supports budgeted memory compression, but LLM-guided delete/merge decisions must preserve source refs, supersession, deletion residue, and replayability.
6. **Environment engineering is the reliability layer.** EurekAgent frames permissions, artifacts, budgets, and human supervision as the agent environment. pm-substrate is already moving in that direction; the next proof is to make budgets and policy transitions executable.

Project-management additions sharpen the handoff lane:

- AI-only sprint planning can reduce planning cost while degrading risk capture and increasing rework; PM agents need risk/handoff reviews, not just faster plans.
- POMDP/MOMDP task-completion announcement research shows project communication under uncertainty is a control problem: stale or too-frequent updates both create cost.
- Shared mental models in multidisciplinary project teams form through explicit planning and critical incidents; under uncertainty, agreement about process/roles/capacities can matter more than shared task facts.

## 2. New Sources Reviewed

| Source | Authors | Date | Link | Source type | Relevance |
| --- | --- | --- | --- | --- | --- |
| EvoArena: Tracking Memory Evolution for Robust LLM Agents in Dynamic Environments | Jundong Xu et al. | 2026-06-11 | https://arxiv.org/abs/2606.13681 | Primary arXiv preprint / benchmark | Dynamic terminal/software/social updates; patch-based memory evolution. Mechanism: update history is a first-class artifact, not a overwritten summary. |
| HyperTool: Beyond Step-Wise Tool Calls for Tool-Augmented Agents | Yaxin Du et al. | 2026-06-11 | https://arxiv.org/abs/2606.13663 | Primary arXiv preprint | MCP-style executable tool interface collapses multi-tool subroutines into one call. Mechanism: tool granularity can obscure read/write sets unless subcalls are logged and bound. |
| AgentBeats: Agentifying Agent Assessment for Openness, Standardization, and Reproducibility | Xiaoyuan Liu et al. | 2026-06-11 | https://arxiv.org/abs/2606.13608 | Primary arXiv preprint / large field study | Standardized A2A/MCP-like assessment and judge agents. Mechanism: evaluation surfaces are protocolized actors and need recall/gate-routing checks. |
| Getting Better at Working With You: Compiling User Corrections into Runtime Enforcement for Coding Agents | Yujun Zhou et al. | 2026-06-11 | https://arxiv.org/abs/2606.13174 | Primary arXiv preprint / code-linked | User corrections become atomic runtime rules. Mechanism: memory alone does not ensure compliance; compiled rules are governance evidence needing scope/version admission. |
| MemRefine: LLM-Guided Compression for Long-Term Agent Memory | Minjae Kim et al. | 2026-06-11 | https://arxiv.org/abs/2606.13177 | Primary arXiv preprint | Budgeted memory compression with LLM judge decisions. Mechanism: compaction decisions require provenance and replay if memory later informs action. |
| EurekAgent: Agent Environment Engineering is All You Need For Autonomous Scientific Discovery | Amy Xin et al. | 2026-06-11 | https://arxiv.org/abs/2606.13662 | Primary arXiv preprint / code-linked | Environment engineering across permissions, artifacts, budgets, and HITL. Mechanism: reliable agents depend on substrate-like environment constraints, not prompt intelligence alone. |
| EpiBench: Verifiable Evaluation of AI Agents on Epigenomics Analysis | Harihara Muralidharan et al. | 2026-06-11 | https://arxiv.org/abs/2606.13602 | Primary arXiv preprint / benchmark | Deterministically gradable workflow-state decisions; many agents compute useful intermediates but fail domain judgment. Mechanism: intermediate artifacts are not enough without correct stage-specific decision gates. |
| Beyond Runtime Enforcement: Shield Synthesis as Defensibility Analysis for Adversarial Networks | Achraf Hsain, Sultan Almuhammadi | 2026-06-11 | https://arxiv.org/abs/2606.13621 | Primary arXiv preprint | Safety shields as design-time certificates, not only runtime action restrictions. Mechanism: policy automata can expose where a workflow is defensible before deploying a blocking gate. |
| Multi-Agent Reinforcement Learning from Delayed Marketplace Feedback for Objective-Weight Adaptation in Three-Sided Dispatch | Haochen Wu, Yi Hou, Shiguang Xie | 2026-06-11 | https://arxiv.org/abs/2606.13604 | Primary arXiv preprint / production logistics study | Delayed world feedback and constrained operational safeguards. Mechanism: action-to-feedback drift needs replayable link between action, delayed outcome, and policy update. |

## 3. Older Sources Added

| Source | Authors | Year | Link | Mechanism extracted |
| --- | --- | --- | --- | --- |
| Enforceable Security Policies | Fred B. Schneider | 2000 | https://doi.org/10.1145/353323.353382 | Execution monitors can enforce only certain classes of policies over observable actions. pm-substrate implication: write-binding gates should declare which invariants they can observe/enforce and which remain audit-only. |
| Edit Automata: Enforcement Mechanisms for Run-time Security Policies | Jay Ligatti, Lujo Bauer, David Walker | 2005 | https://users.ece.cmu.edu/~lbauer/papers/editauto.pdf | Runtime monitors may truncate, suppress, insert, or edit action streams. pm-substrate implication: future policy modes should distinguish block, refresh, compensate, quarantine, and audit instead of only `wouldBlock`. |
| A Comparison of Commercial and Military Computer Security Policies | David D. Clark, David R. Wilson | 1987 | https://doi.org/10.1109/SP.1987.10001 | Business integrity is enforced through well-formed transactions, certified transformation procedures, constrained/unconstrained data, audit, and separation of duty. pm-substrate implication: action proposals should enter write paths as unconstrained data converted to constrained state only by verified workflow/capability procedures. |
| Runtime Verification of Safety-Progress Properties | Yliès Falcone et al. | 2010 | https://hal.science/hal-00420487v1 | Runtime verification/enforcement depends on monitorability and enforceability of property classes. pm-substrate implication: mark each invariant as monitorable-only, enforceable-before-write, enforceable-by-compensation, or offline-audit. |
| The measurement of team mental models: We have no shared schema | Susan Mohammed, Richard Klimoski, John R. Rentsch | 2000 | https://doi.org/10.1177/109442810032001 | SMM measurement needs explicit representation and comparison methods. pm-substrate implication: PM handoff agreement must compare source/owner/dependency/next-action structure, not rely on prose summaries. |
| The Influence and Development of Shared Mental Models in Multidisciplinary Project Teams | Reimer Bierhals, Petra Kohler, Petra Badke-Schaub | 2007 | https://www.designsociety.org/download-publication/25585/the_influence_and_development_of_shared_mental_models_in_multidisciplinary_project_teams | Shared understanding develops through explicit planning or critical incidents; process and role/capacity models matter under uncertainty. pm-substrate implication: incident-triggered re-review and role/authority agreement should be measured. |
| Cognitive Offloading in Agile Teams: How Artificial Intelligence Reshapes Risk Assessment and Planning Quality | Adriana Caraeni, Alexander Shick, Andrew Lan | 2026 | https://arxiv.org/abs/2604.13814 | AI-only planning can improve speed/cost but degrade risk capture and increase rework. pm-substrate implication: require risk/ambiguity handoff review before AI-generated plans become workflow state. |
| Optimizing Task Completion Time Updates Using POMDPs | Duncan Eddy et al. | 2026 | https://arxiv.org/abs/2603.12340 | Project status communication is a sequential decision under partial observability. pm-substrate implication: status/handoff updates should have belief/currentness metadata and a cost-aware reannouncement policy. |
| CHOIR: A Chatbot-mediated Organizational Memory Leveraging Communication in University Research Labs | Sangwook Lee et al. | 2026 | https://arxiv.org/abs/2509.20512 | Organizational memory from chat has privacy-awareness and documentation-gap tensions. pm-substrate implication: private questions and missing-document signals are evidence, but memory updates need visibility and authority policy. |

## 4. Arrowsmith Bridge Table

| Agent-state problem | Bridge concept | Source discipline | Supporting papers | Implementation implication | Confidence | Falsification test |
| --- | --- | --- | --- | --- | --- | --- |
| Write-capable dispatch can receive self-attested artifact/evidence ids | Well-formed transaction / reference monitor | Commercial integrity, runtime enforcement | Clark-Wilson; Schneider; local `@pm/workflow` evidence binding | Make every external write transport call a certified transformation procedure that verifies artifact id/hash, admission ids, tenant, workflow, and policy disposition against a durable catalog. | High | A write-capable external transport mutates state with missing or catalog-unverified binding and no dead-letter/block record. |
| Tool wrappers can collapse many subcalls into one model-visible call | Subcall provenance / observed read-set capture | Tool-use agents, MCP-style execution | HyperTool; S-Bus; local observed read-set comparison | Require executable tool wrappers to emit subcall read/write refs into the observed-read-set lane and write-binding catalog. | High | HyperTool-style wrapper reads stale or unauthorized source data inside a subcall; outer call appears valid and no observed-read warning occurs. |
| Dynamic environments make memory overwrite unsafe | Memory evolution lineage | Agent memory benchmarks | EvoArena/EvoMem; STALE; MemRefine | Store memory updates as patch/evolution artifacts with supersedes/contradictedBy/sourceRefs; never replace original state evidence with compressed memory. | High | Memory patch/compaction changes the premise used by an action but replay cannot reconstruct the original source or invalidation path. |
| User corrections become hidden policy state | Compiled rule / skill governance | Coding-agent runtime enforcement, skill evaluation | TRACE correction enforcement; SkillAxe; Schneider | Treat compiled correction rules and skills as admitted governance evidence with owner, trigger, scope, version, source correction refs, and failure coverage. | Medium-high | A new skill/correction rule blocks or permits an action outside its scope and no skill-version/scope warning appears. |
| Agentified judges can miss state defects while standardizing evals | Judge recall / gate routing | Agent evaluation, production QA | AgentBeats; Catching One in Five; EpiBench | Add state-defect recall and judge-routing metrics before a judge result can become a policy-blocking input. | Medium-high | LLM judge reports high agreement but misses stale owner, stale approval, wrong workflow phase, or missing escalation defects in labeled fixtures. |
| Runtime blocking may enforce the wrong property or overclaim coverage | Monitorability/enforceability class | Runtime verification, safety-progress properties | Falcone et al.; Schneider; edit automata | Annotate each invariant class with enforcement capability: pre-write block, refresh-required, compensation-only, audit-only, or not monitorable from current evidence. | High | Docs claim mutation governance for an invariant that the runtime cannot observe before the write. |
| Privacy and budget constraints span trajectories | Budgeted environment control | Environment engineering, privacy budgets, memory compaction | EurekAgent; OCELOT; MemRefine | Add release-budget records to artifact run groups: sink trust, data class, cumulative budget, compaction decisions, declassification reason. | Medium-high | Per-evidence checks pass while a sequence of disclosures or memory compactions leaks protected state to a low-trust sink. |
| Workflow-policy validity differs from evidence currentness | Policy automaton / shield certificate | Formal methods, social simulation, workflow | Shield synthesis; finite-state vs LLM policy; local write-binding policy disposition | Add policy-transition fixtures that compare proposed action to explicit workflow state machine and store transition-certificate ids in binding records. | Medium-high | Fresh admitted evidence supports a fact but action violates workflow transition; write-binding gate allows it because evidence is current. |
| PM agents plan faster but lose risk and ambiguity context | Risk-capture handoff review | Project management, team cognition | Cognitive Offloading in Agile Teams; Bierhals et al.; Mohammed et al. | Add PM handoff/risk review over real runs: risk captured, ambiguity escalated, owner/steward agreed, next action valid. | Medium | AI-generated plan has artifact bindings but misses known risk/ambiguity and downstream rework is not detected. |
| Project status updates can be harmful when stale or too frequent | Belief-state communication policy | Project control, POMDP/MOMDP | Task completion update POMDP; COP/CSU sources | Treat status/handoff announcements as actions requiring state-review: current belief, update cost, last announced state, stakeholder impact. | Medium | Agents repeatedly announce stale or noisy status without source/currentness warnings and no reannouncement-cost metric changes. |

## 5. Claim Ledger

| Claim | Status | v09 evidence and correction |
| --- | --- | --- |
| ArrowHedge state-review artifacts still need a committed on-disk corpus. | Contradicted / closed | Fast-forwarded code includes `packages/evals/fixtures/arrowhedge-state-review-artifacts.v1.jsonl` and a drift test. |
| Runtime evidence-action binding is wholly unimplemented. | Revised / partially closed | `@pm/workflow` has opt-in write binding and catalog verification. Broad mutation governance remains unclaimed. |
| Write-binding replay is only a design idea. | Contradicted / closed as replay lane | `packages/evals/fixtures/write-binding-replay.v1.jsonl` and `@pm/evals` metrics now exist. |
| Evidence-binding can be self-attested safely. | Downgraded | The newest hash-mismatch row proves self-attestation must be verified against substrate-owned catalogs or stores. |
| A replay dashboard proves live COP monitoring. | Downgraded | `@pm/substrate-dashboard` is a real replay monitor over committed corpora, but not live operational telemetry yet. |
| Memory evolution and compression improve agent reliability. | Revised | EvoArena/EvoMem and MemRefine strengthen memory-evolution/compaction mechanisms; they do not supply authority, policy validity, or source currentness. |
| Executable tool wrappers improve tool use without new state risks. | Downgraded | HyperTool improves multi-step tool execution but hides subcall dependencies unless provenance/read-set capture is required. |
| Judge agents can safely replace deterministic eval gates once standardized. | Downgraded | AgentBeats strengthens standardized evaluation, but v08/v09 judge-recall evidence requires state-defect recall before gate use. |
| Compiled user corrections are just memory. | Contradicted | TRACE shows corrections can become runtime enforcement rules; that makes them skill/policy artifacts needing admission. |
| PM handoff quality can be inferred from artifact completeness alone. | Downgraded | PM/team-cognition sources require measuring risk capture, role/source agreement, process/owner model alignment, and rediscovery/rework. |

## 6. Implementation Implications

1. **Promote write-binding from selected gate to transport-wide invariant.**
   - Every external write-capable workflow/capability transport should provide an `InvocationEvidenceBinding`.
   - The binding should be verified against durable stores for state-review artifact id/hash, evidence-admission review ids, tenant, workflow/run, current-state view, and policy disposition.
   - Keep the public claim bounded until all write transports opt in.

2. **Add durable verification catalogs, not only fixture catalogs.**
   - The current catalog verifier is a correct pure boundary.
   - Next proof should load catalog refs from committed replay corpora and, when available, DB-backed artifact/evidence stores.

3. **Capture subcall read/write refs for executable tool wrappers.**
   - HyperTool-style code block tools need a `subtoolInvocationRefs` or observed-read-set stream.
   - The outer tool result should not hide inner reads from stale/authority validation.

4. **Add memory evolution/compaction artifacts.**
   - Memory updates should be patch records with `supersedes`, `contradictedBy`, `sourceRefs`, compaction decision, decision source, and replay hash.
   - LLM-guided memory deletion/merge/preserve choices are evidence, not authority.

5. **Model compiled corrections and skills as governance evidence.**
   - Add a `skill_document` or `compiled_rule` evidence kind only if it carries trigger, source correction, owner, scope, version, and fault coverage.
   - Route rule/skill warnings into the write-binding policy disposition before action.

6. **Classify invariants by enforcement capability.**
   - Add a table or type that marks each invariant as `pre_write_block`, `refresh_required`, `compensate`, `audit_only`, or `unmonitorable_from_current_refs`.
   - This prevents overclaiming runtime enforcement when the property is only observable after the fact.

7. **Add release-budget and policy-transition replay rows.**
   - Release budget rows should cover cumulative sink/data-class leakage, compaction residue, and declassification reason.
   - Policy-transition rows should cover fresh evidence paired with invalid workflow phase, stale approval, or missing escalation.

8. **Run PM handoff agreement on real traces.**
   - Use actual automation/research or multi-agent ArrowHedge runs.
   - Compare source steward, expertise owner, escalation owner, shared goal, valid next action, risk capture, and time-to-valid-action after handoff.

9. **Keep the replay dashboard honest.**
   - Treat it as a COP over committed replay streams.
   - A later live monitor must prove source freshness, subscription health, DB-backed stores, and write-binding verification status in real time.

## 7. Testing/Eval Implications

New scenarios:

1. **Catalog-backed write binding.** A complete binding is present, but the artifact hash does not match the catalog. Expected: `blocked_unverified_binding`.
2. **Transport without binding.** A non-ArrowHedge write-capable capability dispatches with `evidenceBindingMode: "require_for_writes"` and no provider. Expected: dead-letter with `evidence_binding_missing`.
3. **HyperTool hidden stale read.** One outer executable tool call performs inner reads from stale source refs. Expected: observed-read-set mismatch and write binding denial until subcall refs are exposed.
4. **Memory patch supersession.** Memory evolution patch supersedes a prior risk premise. Expected: action using old premise warns through `superseded_memory_patch`.
5. **Memory compaction residue.** LLM judge merges/deletes memory rows used by a future action. Expected: replay still recovers source refs or warns on unverifiable compaction.
6. **Compiled correction out of scope.** A user correction skill blocks or permits an unrelated action. Expected: skill scope/trigger warning and no authority expansion.
7. **Judge-routing miss.** Agentified judge labels a stale-owner defect under a non-operational category. Expected: `judge_routing_miss_rate` increments.
8. **Invalid transition with fresh evidence.** Evidence is current and admitted, but workflow phase disallows the proposed action. Expected: policy-transition block in write binding.
9. **Release-budget overflow.** Multiple individually allowed disclosures cumulatively exceed sink/data-class budget. Expected: policy disposition `wouldBlock=true` before write/external send.
10. **AI plan risk omission.** AI-generated plan has artifact bindings but omits known risk or escalation owner. Expected: PM handoff agreement and risk-capture metrics flag the gap.

Metrics to add or sharpen:

- `write_binding_catalog_verification_rate`
- `write_transport_binding_coverage`
- `unverified_binding_block_rate`
- `subtool_read_set_coverage`
- `hidden_subcall_dependency_rate`
- `memory_patch_replay_fidelity`
- `memory_compaction_source_ref_coverage`
- `compiled_rule_scope_violation_rate`
- `skill_policy_binding_rate`
- `invariant_enforcement_capability_coverage`
- `policy_transition_deviation_rate`
- `release_budget_exceeded_rate`
- `judge_state_defect_recall`
- `pm_risk_capture_rate`
- `handoff_time_to_valid_action`
- `status_reannouncement_stability`

Assertions to preserve:

- Advisory mode remains advisory; only explicit blocking policy and opt-in write-binding mode should block dispatch.
- Rejected external evidence can be recorded, but any binding that relies on it must produce a blocking disposition for high-consequence writes.
- Replay corpora should regenerate deterministically and fail drift tests when source artifacts change.
- Dashboard views should not imply live governance until fed by live stores/subscriptions.

## 8. Open Questions For Next Run

1. Which workflow/capability write transports still bypass `evidenceBindingMode: "require_for_writes"`?
2. Should durable verification catalogs live in `@pm/evals`, `@pm/workflow`, or a substrate-level store package that both replay and runtime code can query?
3. How should HyperTool-style nested tool invocations expose subcall read/write refs without making tool wrappers unusably verbose?
4. Should memory compaction be modeled as a new `ExternalStateEvidenceKind`, a continuity checkpoint variant, or a state-review artifact run-group event?
5. What is the smallest `skill_document` / `compiled_rule` evidence shape that covers TRACE and SkillAxe without creating a broad policy engine too early?
6. Which invariant classes are only monitorable after execution and therefore should never be represented as pre-write blocks?
7. Can release-budget fixtures be implemented with deterministic data-class/sink labels before any privacy model is added?
8. How should project status announcements and PM handoffs be represented as actions requiring review rather than passive dashboard updates?
9. Can `comparePmHandoffAgreement` be run over this daily research automation itself, using fetch/rebase/write/push artifacts as the handoff trace?
10. What primary vendor technical docs expose enough machine-readable artifacts to falsify the claim that pm-substrate remains differentiated on pre-action state review?

## 9. Recommended Next Code Slice

Implement **durable write-binding verification stores and transport coverage metrics**.

Smallest practical slice:

1. Add a fixture-backed verification-catalog builder that reads the committed ArrowHedge state-review artifact JSONL, evidence-admission JSONL, and write-binding JSONL into `EvidenceBindingReferenceCatalog`.
2. Add a drift test proving every write-binding replay row with a non-null binding verifies against that catalog, except intentionally unverified rows such as the hash-mismatch fixture.
3. Add a metric for write-transport binding coverage: which write-capable workflow/capability paths run with `require_for_writes`, which only support advisory binding, and which have no binding provider.
4. Add one non-ArrowHedge write-capable fixture path to prove the gate is not profile-specific.
5. Keep mutation-governance language bounded: "opt-in verified write binding exists" is now true; "all external mutations are governed" remains false until every transport uses a durable verifier.

This code slice follows directly from the research delta: v08's artifact and binding primitives are now real, so the next falsifiable proof is not another artifact type. It is coverage and verification of the boundary before any side-effecting workflow claims production governance.

## Source Inventory Added In v09

- EvoArena: https://arxiv.org/abs/2606.13681
- HyperTool: https://arxiv.org/abs/2606.13663
- AgentBeats: https://arxiv.org/abs/2606.13608
- TRACE correction enforcement for coding agents: https://arxiv.org/abs/2606.13174
- MemRefine: https://arxiv.org/abs/2606.13177
- EurekAgent: https://arxiv.org/abs/2606.13662
- EpiBench: https://arxiv.org/abs/2606.13602
- Shield synthesis as defensibility analysis: https://arxiv.org/abs/2606.13621
- Delayed marketplace feedback for dispatch: https://arxiv.org/abs/2606.13604
- Schneider, Enforceable Security Policies: https://doi.org/10.1145/353323.353382
- Ligatti/Bauer/Walker, Edit Automata: https://users.ece.cmu.edu/~lbauer/papers/editauto.pdf
- Clark-Wilson integrity model: https://doi.org/10.1109/SP.1987.10001
- Runtime Verification of Safety-Progress Properties: https://hal.science/hal-00420487v1
- Mohammed/Klimoski/Rentsch, team mental model measurement: https://doi.org/10.1177/109442810032001
- Bierhals/Kohler/Badke-Schaub, shared mental models in multidisciplinary project teams: https://www.designsociety.org/download-publication/25585/the_influence_and_development_of_shared_mental_models_in_multidisciplinary_project_teams
- Cognitive Offloading in Agile Teams: https://arxiv.org/abs/2604.13814
- Optimizing Task Completion Time Updates Using POMDPs: https://arxiv.org/abs/2603.12340
- CHOIR organizational memory: https://arxiv.org/abs/2509.20512

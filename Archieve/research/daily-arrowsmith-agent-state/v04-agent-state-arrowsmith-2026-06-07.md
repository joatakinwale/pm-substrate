# v04 Agent-State Arrowsmith - 2026-06-07

Date: 2026-06-07
Method: Arrowsmith A-B-C continuation, prior-version claim audit, repo-grounded runtime check, primary-source/source-repo search
Status: fourth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md`

Local context read in order:

1. `research/daily-arrowsmith-agent-state/index.md`
2. `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md`
3. `Changelog.md`
4. Current implementation surfaces for the v03 open slice:
   - `packages/agent-state/src/index.ts`
   - `packages/agent-state/src/index.test.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.ts`
   - `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
   - `packages/evals/src/metrics.ts`
   - `packages/evals/src/metrics.test.ts`

Current strongest thesis:

> pm-substrate is the governed operational-state layer between statistical prediction and valid action. The repo has now crossed another boundary: `ActionProposalReview` can be wrapped as a deterministic `StateReviewArtifact` with event envelope, trace context, related object roles, PROV-style links, canonical hash, replay verification, ArrowHedge generation, and artifact metrics. The next proof boundary is not "invent the artifact." It is to make artifacts a first-class evidence stream: persisted/exported, schema-validated, redacted, linked to eval events and continuity checkpoints, and used by an invariant-class policy that blocks only the action classes whose stale reads, expired observations, authority drift, or subject/tenant mismatches are genuinely unsafe.

## 1. Delta From Previous Version

v03 was right that durable, provenance-linked state-review artifacts were the next frontier, but that claim is now partly stale. The current repo already includes `StateReviewArtifact`, ArrowHedge artifact generation, hash verification, trace/object-role metrics, and tests for tamper detection. v04 therefore moves the frontier forward: the open gap is durable artifact lifecycle and enforcement use, not artifact shape. New source discovery strengthens this shift. S-Bus supplies an implemented read-set reconstruction/commit-safety analogue; Claw-Eval-Live and Silo-Bench strengthen artifact-derived and coordination-cost evaluation; a new June 2026 provenance survey validates trace/provenance as a process-accountability research direction; and HTTP/OAuth standards sharpen observation contracts into preconditions, proof-of-possession, delegation, and signature-expiry fields. Project-management research adds a caution: coordination metrics must be scalable and disagreement-measured, not just visualized.

## 2. Research Question

When LLM agents are statistical predictors promoted into actors, how should pm-substrate transform observations, reads, memories, workflow position, project coordination context, and proposed side effects into replayable, source-authoritative operational state that can be safely allowed, blocked, refreshed, or handed off?

## 3. A/B/C Framing

**A-literature/problem.** LLM agents, tool use, memory/RAG, workflow agents, multi-agent coordination, state-review artifacts, and the current pm-substrate `StateReviewArtifact` primitive.

**B-bridge concepts.** Read-set reconstruction, HTTP preconditions, proof-of-possession, observation-contract integrity, trace/provenance, execution evidence, artifact replay, coordination-reasoning gap, shared file systems, coordination requirements, team situation awareness, transactive memory, and invariant-class enforcement.

**C-literatures/domains.** Distributed systems/OCC, HTTP conditional requests, OAuth/HTTP security standards, agent provenance/observability, live workflow benchmarks, multi-agent distributed-computation benchmarks, project coordination research, team situation awareness, and human-AI teaming.

Open discovery result: the strongest new bridge is **preconditioned evidence streams**. Mature operational systems do not merely record after-the-fact traces; they make action conditional on previously observed state, signed/valid artifacts, actor/delegation binding, and fresh read-set validation.

Closed discovery result from v03: `StateReviewArtifact` is no longer a proposed schema. It exists as a pure runtime artifact with hash verification and metrics. Persisted/golden artifacts, schema/runtime validation, trace joining across packages, continuity linkage, and invariant-class enforcement remain open.

## 4. Source Map

| Source | Type | Date | Finding strength | How it changes v04 | Limit |
| --- | --- | --- | --- | --- | --- |
| Local pm-substrate implementation and changelog | Primary local repo evidence | 2026-06-06/07 | High | Moves v03 artifact-shape TODOs to closed pure primitives. | No proof yet of persistence, DB-backed artifact emission, generated golden files, or side-effect enforcement. |
| S-Bus paper and source repo | Primary arXiv preprint plus source repo | 2026-05-16, repo inspected 2026-06-07 | High for read-set bridge, Medium for product transfer | Strengthens automatic read-set reconstruction and commit-time stale-read rejection as directly relevant to agent state. | Preprint; repo says no production hardening, no HMAC/TLS/multi-tenant/rate limiting; natural-language semantics not fully solved. |
| Claw-Eval-Live site and repo | Benchmark docs/source repo | v1.0 Apr 2026, repo inspected 2026-06-07 | Medium-high | Shows released task/fixture/mock-service/grader/trace structure for live workflow evals. | Use methodology, not leaderboard claims; market-signal weighting is benchmark design, not state correctness proof. |
| Silo-Bench paper and source repo | Accepted paper plus source repo | v2 Apr 2026, repo inspected 2026-06-07 | Medium | Adds coordination-reasoning gap: agents may communicate enough but fail to synthesize distributed state. | Algorithmic distributed tasks, not enterprise PM workflows. |
| From Agent Traces to Trust | Review/survey arXiv preprint | 2026-06-03 | Medium-high for research direction | Directly supports trace/provenance, process accountability, recovery-oriented eval, and privacy-aware audit as open agent-reliability issues. | Review/survey, not an empirical validation of pm-substrate. |
| RFC 9110 HTTP Semantics | Standard | 2022 | High for precondition vocabulary | `If-Match`/conditional request semantics sharpen read-set validation into an action precondition pattern. | Resource-level HTTP conditionals do not cover multi-object semantic authority by themselves. |
| RFC 9449 OAuth DPoP | Standard | 2023 | High for proof-of-possession bridge | Observation contracts need holder/request binding, nonce/time-window, and token hash concepts for high-consequence tool artifacts. | OAuth token binding is not a general workflow validity policy. |
| RFC 9421 HTTP Message Signatures | Standard | 2024 | High for signature-expiry/integrity vocabulary | Sharpens artifact integrity fields: signed components, created/expires parameters, verifier semantics. | Signature validity does not prove business-state currentness. |
| RFC 8693 OAuth Token Exchange | Standard | 2020 | Medium-high | Delegation/actor claims map to `actedOnBehalfOf`, authority chain, and proposal provenance. | Token exchange is security infrastructure, not PM coordination. |
| ContractBench | Primary arXiv preprint | 2026-05-17 | Medium-high | Keeps observation-contract validity/integrity as a first-class eval target. | Direct code/data URL was not found through primary pages in this run; treat source-repo visibility as open. |
| STALE | Primary arXiv preprint | 2026-05-07 | High for stale-memory framing | Confirms memory systems must handle implicit invalidation, premise resistance, and policy adaptation. | Code/data were not located today; paper is a preprint. |
| MemoryArena | Stanford working paper/arXiv pointer | 2026-02-18 | Medium | Reinforces memory-as-action loop, not recall-only memory. | Not specifically an authority/read-set artifact benchmark. |
| HearthNet | CAIS 2026 demo-track arXiv preprint | v2 2026-04-28 | Medium | Actuation leases and base-commit freshness checks remain a useful action-gate analogy. | Smart-home physical-control prototype, not enterprise workflow proof. |
| Coordination requirements scalability | Primary empirical SE paper | 2012 | Medium-high | PM/COP tooling must scale coordination-requirement presentation across time windows, not show an unbounded dependency graph. | Software-development team study, not LLM-agent study. |
| Team Situation Awareness measurement | Primary human-factors paper | 2000 | Medium | Shared state should be evaluated by cross-actor agreement at salient events, not dashboard presence. | Military simulation; transfer to PM agents must be tested. |
| In Search of Socio-Technical Congruence | Primary empirical SE paper | 2021 | Medium | Downgrades overclaim that congruence metrics automatically predict bugs/churn. | The paper finds no statistical relationship for selected quality measures; does not reject coordination metrics for handoffs/rework. |

## 5. Prior-Version Claim Audit

| v03 claim or open item | v04 status | Correction or continuation |
| --- | --- | --- |
| Promote `ActionProposalReview` into a durable `StateReviewArtifact`. | Stale/resolved as pure primitive | `StateReviewArtifact`, `buildStateReviewArtifact()`, canonical hash, trace context, related objects, provenance links, and tamper verification now exist in `@pm/agent-state`. |
| Add ArrowHedge state-review artifact generation. | Stale/resolved as pure primitive | `buildArrowHedgeStateReviewArtifact()` emits an artifact with ArrowHedge source and ticker provenance. |
| Add state-review artifact metrics. | Stale/resolved as metric primitive | `analyzeStateReviewArtifacts()` reports hash verification, trace coverage, object-role coverage, warning buckets, advisory/blocking counts, and source/type buckets. |
| Persist ArrowHedge reports/proposal reviews as JSON artifacts. | Still open | No checked-in golden JSON or generated artifact output path was found. Tests still operate in memory. |
| Draft minimal schema and choose package ownership. | Modified | Runtime TypeScript contract now lives in `@pm/agent-state`; open question is external JSON schema/export format and compatibility checking. |
| Trace correlation should connect reads, reviews, and writes. | Partly closed | Artifact has optional trace context and metrics count coverage; no end-to-end trace join across capability invocation, source read, projection, review, and downstream write was found. |
| Object-centric refs should be added. | Partly closed | Artifact related objects include primary/action subjects, source refs, read-set refs, warning refs, and ArrowHedge ticker symbol. Multi-object mismatch fixtures remain open. |
| Blocking policy should be invariant-class targeted. | Still open | Pure blocking mode exists, but no policy matrix maps issue codes/action classes to `block`, `refresh_required`, `escalate`, or `advisory`. |
| Continuity checkpoints should cite state-review artifacts. | Still open | Evidence-linked continuity payloads can cite current-state view refs, but no review artifact id linkage was found. |
| Benchmark outcomes should be artifact-derived. | Still open | Artifact metrics exist, but eval events are not yet generated from persisted artifact assertions/traces. |
| Socio-technical congruence should guide PM coordination metrics. | Modified/downgraded | Keep as useful, but 2021 longitudinal work warns not to claim universal prediction of bugs/churn. Test handoff/rework/owner-resolution outcomes directly. |

## 6. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Artifact construction exists but is not yet an evidence stream | Persisted state-review event/artifact lifecycle | Local repo, Claw-Eval-Live, Agent Traces to Trust | High local, Medium external | Review artifacts should become exported/replayable eval inputs, not only in-memory test values. | Add artifact writer/reader plus JSON schema validation under `artifacts/evals/arrowhedge/` or `packages/evals/fixtures`. | `persisted_artifact_count`, `artifact_schema_validation_rate`, `review_replay_fidelity` | In-memory artifacts catch all regressions and persisted artifacts add no debugging/eval value. | Artifact stores can leak sensitive state; define redaction and retention. |
| Agents read mutable state without declaring every dependency | Automatic read-set reconstruction | S-Bus DeliveryLog/ORI, HTTP preconditions | High for mechanism | pm-substrate should eventually reconstruct read sets from substrate/tool reads, not rely only on agent-declared refs. | Add optional read-observation collector keyed by trace/run/agent; compare declared vs observed read sets. | `observed_read_set_coverage`, `undeclared_read_dependency_rate`, `stale_read_rejection_rate` | Explicit read sets perform equivalently under hidden-dependency fixtures. | Automatic observation can become surveillance; scope to operational validity and redact. |
| Single-object `subject` misses multi-object state changes | Object roles plus conditional mutation preconditions | OCEL, RFC 9110, S-Bus, local related objects | Medium-high | Mutations should assert expected versions/currentness for all material object roles. | Extend proposals with `relatedReadSet` or role-qualified preconditions for ticker, risk, decision, evidence, owner, workflow. | `multi_object_precondition_coverage`, `wrong_object_action_rate` | Primary subject plus source refs catch all multi-object drift in fixtures. | Too many role refs can freeze adaptive work; require materiality rules. |
| Observation contracts are currently mostly freshness/source assertions | Token/request binding and signature integrity | RFC 9449 DPoP, RFC 9421, ContractBench | High for standards, Medium for benchmark transfer | High-consequence tool artifacts should carry validity window, integrity hash/signature, allowed use, and holder/request binding where available. | Extend `ObservationContract` v2 fields: `integrityHash`, `signatureInput`, `holderBinding`, `allowedUse`, `issuer`, `sourceInvocationId`, `redactionPolicy`. | `expired_artifact_use_rate`, `artifact_integrity_failure_rate`, `holder_binding_failure_rate` | Freshness/source refs alone catch all ContractBench-style failures. | Secret-bearing artifacts require strict redaction and non-persistence defaults. |
| Trace context alone is not accountability | Evidence tracing and execution provenance | Agent Traces to Trust, W3C PROV, Trace Context | Medium-high | State-review artifacts should support claim/action-level provenance: which evidence supported which warning or allow/block decision. | Add warning-to-evidence links and artifact-to-eval-event IDs; keep `artifactHash` as replay anchor. | `warning_evidence_link_rate`, `orphan_warning_rate`, `triage_time_to_root_cause` | Reviewers can diagnose every failure from raw trace alone with equal speed. | Provenance can overstate certainty; expose inferred vs direct links. |
| Live workflow benchmarks can drift from real work | Refreshable benchmark/task snapshot with observable evidence | Claw-Eval-Live | Medium | pm-substrate evals should preserve snapshot metadata and source of task demand, but grade from fixtures/audit state. | Add eval metadata: `benchmarkSnapshotId`, `taskFamily`, `fixtureVersion`, `graderVersion`, `artifactIds`. | `fixture_drift_detection_rate`, `grader_artifact_dependency_rate`, `snapshot_reproducibility_rate` | Static handcrafted tasks detect the same regression classes over time. | Demand-weighted tasks can bias what gets optimized; keep rejected/underrepresented tasks visible. |
| More agents can communicate yet still fail to integrate distributed state | Coordination-reasoning gap | Silo-Bench | Medium | PM substrate should not measure only message volume; it should measure convergence on correct shared operational state. | Add distributed-state integration evals where agents have partial project/evidence shards and must converge on current blocker/owner/valid action. | `shared_state_correctness`, `communication_density`, `coordination_cost_per_correct_action` | More communication or shared files alone reliably improves correctness. | Communication metrics can incentivize chatter; pair with correctness and cost. |
| High-consequence side effects need targeted blocks | Invariant-class policy | OCC/coordination avoidance, RFC 9110, HearthNet | High for principle | Blocking should be attached to invariant classes/action consequence, not every warning. | Define policy table for `tenant_mismatch`, `subject_mismatch`, `authority_mismatch`, `stale_external_side_effect`, `missing_required_ref`, `workflow_position_mismatch`. | `false_allow_rate`, `false_block_rate`, `refresh_then_success_rate`, `override_rate` | Advisory-only and targeted blocking have indistinguishable harm/rework rates. | False blocks can delay legitimate work; support explanation and escalation. |
| Project dashboards can overload or mislead | Scalable coordination requirements | de Souza/Costa/Cataldo 2012 | Medium-high | COP should rank coordination needs by active time window, material dependency, owner gap, and action consequence. | Add `CoordinationRequirement` records with time window, dependency refs, owner/source, freshness, and required participants. | `coordination_requirement_precision`, `dependency_owner_resolution_time`, `handoff_rework_rate` | Unfiltered full graph performs as well for handoff and blocker resolution. | Coordination analytics can become worker surveillance; avoid personal scoring. |
| Shared understanding is assumed rather than measured | Team situation awareness congruence | Entin and Entin 2000, shared mental models | Medium | PM state should be evaluated by whether agents/humans agree on salient current facts and valid next actions after updates. | Add paired survey/eval prompts before/after artifact/COP exposure: binding source, owner, blocker, changed fact, allowed action. | `shared_state_convergence_rate`, `salient_event_agreement`, `mental_model_disagreement_count` | Dashboard exposure yields no better agreement than transcript-only control. | Polished displays can produce overconfidence; show uncertainty and missing sources. |
| Socio-technical congruence may be overclaimed | Negative/nuanced empirical result | Mauerer et al. 2021 | Medium | Use congruence as a diagnostic, not a universal project-success predictor. | Evaluate against handoff rework, wrong-owner escalation, and stale-dependency decisions before claiming productivity/quality effects. | `coordination_metric_predictive_value`, `wrong_owner_escalation_rate` | Congruence metrics show no relation to any pm-substrate outcome. | Avoid blaming individuals for systemic dependency structure. |
| Memory benchmarks often separate recall from action | Memory-action loop | STALE, MemoryArena | Medium-high | Continuity summaries should be projections over artifacts and observations, then tested by downstream action validity. | Link continuity checkpoint payloads to artifact ids and invalidation status. | `stale_memory_intervention_rate`, `artifact_linked_checkpoint_rate`, `policy_adaptation_success_rate` | Memory-only agents match artifact-linked continuity under implicit invalidation scenarios. | Memory retention must honor expiry/deletion policies. |

## 7. New Or Changed Hypotheses

1. **High: The minimum next implementation is artifact lifecycle, not artifact construction.** Inference from local code: `StateReviewArtifact` exists, but persistence/export/schema/eval linkage do not.
2. **High: Observed read-set reconstruction should become a second read-set lane.** S-Bus suggests declared read sets are not enough for heterogeneous agents; pm-substrate can compare declared vs observed substrate/tool reads.
3. **High: Observation contracts need integrity and holder/request binding, not only freshness.** ContractBench, DPoP, and HTTP Message Signatures all point to expiry plus byte/signature/request binding as separate failure axes.
4. **Medium-high: Artifact-derived evals should grade evidence changes, not scenario labels.** Claw-Eval-Live and the new provenance survey strengthen process evidence as the scoring basis.
5. **Medium: Multi-agent PM state should be tested for distributed-state integration.** Silo-Bench shows communication can be sufficient while synthesis fails; pm-substrate should test convergence on operational state, not message volume.
6. **Medium: Coordination metrics must be outcome-bounded.** Socio-technical congruence remains useful, but v04 downgrades any broad claim that it predicts general project quality without repo-specific evidence.

## 8. Project-Management Implications

The PM substrate should treat "project state" as a shared operational-state problem, not a richer task list. The important questions are: what changed, whose/source's state is binding, which dependencies create coordination requirements, who needs to know before action, what is stale, what is blocked, and which next actions remain valid.

Coordination-requirement research adds a product constraint: full dependency graphs will become unreadable or unactionable at scale. pm-substrate should rank and filter by active time window, object role, source authority, action consequence, and handoff risk.

Team situation awareness suggests an eval shape. At salient project events, multiple agents or humans should answer the same current-state questions. The metric is agreement with the binding state and with each other after seeing substrate evidence, not how good the dashboard looks.

Transactive-memory and authority metadata still matter, but v04 sharpens the ethical boundary: owner/source metadata should resolve authority and handoffs, not score individuals. Coordination analytics must be scoped to work validity and team learning.

## 9. Implementation Implications For pm-substrate

1. **Add persisted artifact export/import.**
   - Emit deterministic JSON artifacts from ArrowHedge proposal reviews.
   - Validate with an external JSON schema or schema-check helper.
   - Store generated artifacts under a stable eval path and keep fixtures human-readable.

2. **Link artifacts to eval events.**
   - Add `stateReviewArtifactIds` or `evidenceArtifactRefs` to eval event metadata.
   - Compute `detected_warning`, `blocked_mutation`, and future `paired_behavioral_improvement` from artifact assertions/warnings where possible.

3. **Add observed read-set capture.**
   - Start package-light: a trace/run-local collector that records substrate/source/projection reads.
   - Compare collector output with `ProposedAction.readSet`.
   - Add warnings for undeclared material reads before moving to blocking.

4. **Design `ObservationContract` v2.**
   - Candidate fields: `issuer`, `issuedBy`, `sourceInvocationId`, `integrityHash`, `signatureInput`, `holderBinding`, `allowedUse`, `validUntil`, `redactionPolicy`, `secretBoundary`, `revocationRef`.
   - Keep v1 compatibility and do not force OAuth-specific fields on non-token observations.

5. **Define invariant-class enforcement.**
   - Proposed first policy:
     - Block: tenant mismatch, subject mismatch on mutation, authority mismatch on mutation, missing required ref for mutation.
     - Refresh required: stale read or expired observation for external side-effect actions.
     - Escalate: workflow position mismatch on irreversible actions.
     - Advisory: declared conflicts for low-consequence analysis actions.

6. **Add multi-object mismatch fixtures.**
   - A portfolio decision cites the correct ticker but wrong risk-state/evidence role.
   - A workflow action has the right primary subject but stale owner/source-of-truth ref.
   - A shared project handoff has a valid task id but invalid dependency owner.

7. **Connect continuity checkpoints to artifacts.**
   - Continuity summaries should cite the artifact id/hash that justified the remembered state, plus supersession/contradiction refs.

8. **Add PM coordination evals.**
   - Measure owner resolution, dependency handoff, stale blocker detection, and shared-state convergence under partial project updates.

## 10. Rejected, Weak, Or Stale Bridges

1. **Stale: `StateReviewArtifact` as merely proposed.** It is implemented as a pure primitive. The open work is lifecycle, schema/export, eval linkage, persistence, and policy use.
2. **Weak: Trace context equals provenance.** Trace context gives correlation; provenance needs evidence/action/claim relations and replayable artifacts.
3. **Weak: S-Bus proves semantic workflow validity.** S-Bus is strong for observable read-set/structural conflict prevention, but its repo explicitly limits production hardening and semantic correspondence.
4. **Weak: Claw-Eval-Live leaderboard values as product proof.** Use its task/fixture/grader/trace architecture, not its moving model ranking, as the transferable bridge.
5. **Weak: Silo-Bench directly measures PM coordination.** It measures distributed algorithmic coordination; pm-substrate must create PM-specific distributed-state fixtures.
6. **Downgraded: Socio-technical congruence predicts broad quality outcomes.** It is still useful as coordination-diagnostic framing, but empirical results are mixed.
7. **Reject: More communication or shared files solve distributed agent state.** Silo-Bench points the other way: integration can fail after information exchange.
8. **Reject: Memory recall benchmarks prove operational memory.** MemoryArena and STALE both push toward memory-in-action and invalidation.
9. **Still weak: Protocol-only interoperability.** HTTP/OAuth standards sharpen preconditions and artifact binding, but domain authority and project state remain application-level.

## 11. Metrics And Eval Scenarios To Add

New or sharpened metrics:

- `persisted_artifact_count`
- `artifact_schema_validation_rate`
- `artifact_export_import_fidelity`
- `artifact_to_eval_event_link_rate`
- `observed_read_set_coverage`
- `undeclared_read_dependency_rate`
- `multi_object_precondition_coverage`
- `holder_binding_failure_rate`
- `signature_integrity_failure_rate`
- `warning_evidence_link_rate`
- `orphan_warning_rate`
- `fixture_drift_detection_rate`
- `grader_artifact_dependency_rate`
- `shared_state_correctness`
- `communication_density`
- `coordination_cost_per_correct_action`
- `coordination_requirement_precision`
- `salient_event_agreement`
- `coordination_metric_predictive_value`
- `artifact_linked_checkpoint_rate`

Eval scenarios:

1. **Artifact lifecycle replay.** Generate an ArrowHedge artifact, write it to JSON, validate schema, import it, verify hash, compute metrics, then mutate warning/source/ref fields and confirm the hash/schema/eval result changes.
2. **Declared vs observed read set.** Simulate an agent that reads a risk source through a substrate read collector but omits it from `ProposedAction.readSet`. The review should warn on undeclared material dependency.
3. **HTTP-precondition analogue.** Proposal carries expected projection version/authority/object refs; a concurrent update advances one related object. Mutation must refresh or block according to policy.
4. **Observation-contract v2 fixture.** Tool artifact has valid freshness but corrupted integrity hash, and another has intact bytes but expired validity. Metrics must distinguish both failures.
5. **DPoP-style holder binding.** Proposal uses a token/artifact under the wrong actor or request binding. The artifact should warn/block without exposing the secret.
6. **Multi-object role mismatch.** Correct primary ticker, wrong risk-state/evidence/decision role. Subject-only validation should fail to catch it; role-qualified preconditions should catch it.
7. **Artifact-derived eval outcome.** Change only a scenario label while keeping artifact evidence constant; result should not change. Change artifact warning/assertion evidence; result should change.
8. **Distributed-state PM integration.** Several agents receive partial project shards. Measure whether substrate artifacts improve agreement on binding source, owner, blocker, and valid next action.
9. **Coordination-requirement filtering.** Compare full graph vs ranked active coordination requirements for handoff resolution time and wrong-owner escalation.
10. **Continuity artifact lineage.** A successor agent receives a continuity summary with and without artifact id/hash lineage; measure stale-memory intervention and rediscovery time.

## 12. Next-Day Watchlist

1. Draft and/or implement the persisted `StateReviewArtifact` JSON fixture/export path.
2. Decide whether artifact JSON schema lives in `@pm/agent-state`, `@pm/evals`, or package-level fixtures.
3. Add eval-event linkage fields for state-review artifact ids/hashes.
4. Prototype observed read-set capture and declared-vs-observed comparison.
5. Search for ContractBench and STALE official code/data repos again; do not cite source availability until primary links are located.
6. Inspect S-Bus companion repos (`sbus-experiments`, `sbus-formals`) if deeper read-set reconstruction design is needed.
7. Convert observation-contract v2 fields into a compatibility proposal, not a breaking change.
8. Define the first invariant-class policy matrix and test advisory vs targeted blocking.
9. Add at least one PM distributed-state integration eval inspired by Silo-Bench but grounded in project handoff/owner/source state.
10. Verify whether DB-backed ArrowHedge projection can emit the same state-review artifact as pure fixtures when Postgres is available.

## 13. Source Inventory With Links And Dates

New or newly strengthened in v04:

- Local pm-substrate repo implementation, 2026-06-06/07. Source type: primary local evidence. Files: `packages/agent-state/src/index.ts`, `packages/agent-state/src/index.test.ts`, `packages/capability-finance-research-ingest/src/arrowhedge.ts`, `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`, `packages/evals/src/metrics.ts`, `packages/evals/src/metrics.test.ts`, `Changelog.md`. Finding strength: High for current implementation state.
- S-Bus paper: https://arxiv.org/abs/2605.17076, 2026-05-16. Source type: primary arXiv preprint, not peer reviewed. Finding strength: High for read-set reconstruction bridge.
- S-Bus source repo: https://github.com/sajjadanwar0/sbus, inspected 2026-06-07. Source type: source repo. Finding strength: High for implementation artifact, Medium for production transfer because repo limits production-hardening claims.
- S-Bus benchmarks dataset: https://huggingface.co/datasets/sajjadanwar0/sbus-benchmarks, inspected 2026-06-07. Source type: benchmark dataset. Finding strength: Medium; deeper dataset audit remains open.
- Claw-Eval-Live official site: https://claw-eval-live.github.io/, current v1.0 Apr 2026. Source type: benchmark docs. Finding strength: Medium-high for task/trace/grader architecture.
- Claw-Eval-Live source repo: https://github.com/Claw-Eval-Live/Claw-Eval-Live, inspected 2026-06-07. Source type: source repo/benchmark repo. Finding strength: Medium-high for released tasks, fixtures, mock services, grader scripts, and trace CLI.
- Silo-Bench paper: https://arxiv.org/abs/2603.01045, submitted 2026-03-01, revised 2026-04-13, accepted ACL 2026. Source type: primary paper/benchmark. Finding strength: Medium for distributed coordination bridge.
- Silo-Bench source repo: https://github.com/jwyjohn/acl26-silo-bench, inspected 2026-06-07. Source type: source repo. Finding strength: Medium for metrics and benchmark design.
- From Agent Traces to Trust: https://arxiv.org/abs/2606.04990, submitted 2026-06-03. Source type: review/survey arXiv preprint, not peer reviewed. Finding strength: Medium-high for provenance/trace research direction.
- RFC 9110 HTTP Semantics: https://httpwg.org/specs/rfc9110.html, 2022. Source type: standard. Finding strength: High for conditional request/precondition vocabulary.
- RFC 9449 OAuth 2.0 DPoP: https://www.ietf.org/rfc/rfc9449.html, 2023. Source type: standard. Finding strength: High for proof-of-possession/holder-binding vocabulary.
- RFC 9421 HTTP Message Signatures: https://www.ietf.org/rfc/rfc9421.html, 2024. Source type: standard. Finding strength: High for signed-component and signature-expiry vocabulary.
- RFC 8693 OAuth 2.0 Token Exchange: https://www.ietf.org/rfc/rfc8693.html, 2020. Source type: standard. Finding strength: Medium-high for delegation/actor-chain vocabulary.
- MemoryArena: https://digitaleconomy.stanford.edu/publication/memoryarena-benchmarking-agent-memory-in-interdependent-multi-session-agentic-tasks/, 2026-02-18. Source type: working paper/project page with arXiv link. Finding strength: Medium for memory-action loop framing.
- de Souza, Costa, and Cataldo, Analyzing the scalability of coordination requirements of a distributed software project: https://link.springer.com/article/10.1007/s13173-012-0067-5, 2012. Source type: primary empirical SE paper. Finding strength: Medium-high for coordination-requirement scaling.
- Entin and Entin, Assessing Team Situation Awareness in Simulated Military Missions: https://doi.org/10.1177/154193120004400120, 2000. Source type: primary human-factors paper. Finding strength: Medium for shared-state agreement metric.
- Mauerer et al., In Search of Socio-Technical Congruence: https://arxiv.org/abs/2105.08198, 2021. Source type: primary empirical SE paper. Finding strength: Medium for downgrading broad congruence-outcome claims.

Carried forward and audited today:

- ContractBench: https://arxiv.org/abs/2605.17281, 2026-05-17. Source type: primary arXiv preprint, not peer reviewed. Finding strength: Medium-high for observation-contract validity/integrity. Direct official code/data URL not located in this run; keep as source gap.
- STALE: https://arxiv.org/abs/2605.06527, 2026-05-07. Source type: primary arXiv preprint, not peer reviewed. Finding strength: High for implicit stale-memory invalidation. Direct official code/data URL not located in this run.
- HearthNet: https://arxiv.org/abs/2604.09618, submitted 2026-03-16, revised 2026-04-28, CAIS 2026 demo track. Source type: primary arXiv preprint/demo paper. Finding strength: Medium for actuation lease and base-commit freshness analogy.
- W3C PROV-DM: https://www.w3.org/TR/prov-dm/, W3C Recommendation, 2013-04-30. Source type: standard. Finding strength: High for provenance vocabulary.
- W3C Trace Context: https://www.w3.org/TR/trace-context/, W3C Recommendation, 2021-11-23. Source type: standard. Finding strength: High for correlation vocabulary.
- CloudEvents specification: https://github.com/cloudevents/spec, v1.0.2 released 2022-02-06; CNCF graduated 2024-01-25. Source type: official specification. Finding strength: High for event envelope metadata.
- OCEL 2.0: https://www.ocel-standard.org/ and https://arxiv.org/abs/2403.01975, 2024. Source type: standard/specification. Finding strength: Medium-high for object-centric process records.

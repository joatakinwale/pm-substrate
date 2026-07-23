# v15 Agent-State Arrowsmith - 2026-06-16

Date: 2026-06-16 UTC
Local run clock: 2026-06-16 America/Chicago
Status: fifteenth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v14-agent-state-arrowsmith-2026-06-16.md`

Repository sync note: this run started with `git fetch origin main`, then verified local `HEAD`, local `origin/main`, and remote `main` all resolved to `ae3db140668fef2bd158f0078817d368693c9ea2`. The repo already contained same-day `v14`, so this continuation is intentionally `v15`, not a duplicate `v14`.

## 1. Version Header

v15 continues v14 instead of restarting the thesis. v14 converted the target-receipt bridge into a pure replay primitive. The remaining nearby frontier is status freshness: a receipt, certificate, task handle, or event record is still not operational authority unless the substrate can check its current status, revocation/suspension meaning, observation time, and decision-time validity.

## 2. One-Paragraph Delta From Previous Version

v14 separated dispatch from target-side receipt. v15 tightens the next boundary: even receipt-backed or certificate-backed evidence can go stale, be suspended, be revoked, be refreshed, or be represented through changing telemetry conventions. W3C credential-status work provides the strongest bridge because it separates the original credential issuer from the status authority, supports revocation/suspension/refresh/message semantics, and explicitly warns that status tracking has privacy/correlation risk. The implementation implication is narrower than "build production credentials": pm-substrate should first add a durable status-check contract around existing replay certificates and target receipts, with `checkedAt`, status authority, freshness window, purpose, and privacy risk fields before promoting evidence to valid action.

## 3. Research Question

What evidence-status contract is needed so pm-substrate can decide whether a previously admitted certificate or target receipt is still current enough to support a write-capable action?

## 4. A/B/C Framing

**A-literature/problem.** LLM agents, workflow agents, external evidence admission, replay certificates, target receipts, tool/task state, agent traces, memory, RAG, and PM handoff state.

**B bridge concepts.** Status authority, revocation, suspension, refresh, checked-at time, observed timestamp, explicit state handle, durable task state, belief state under partial observability, final-state verifier, provenance graph, protocol burden, and privacy-preserving status lookup.

**C literatures/domains.** Verifiable credentials and status lists, OpenTelemetry event semantics, MCP stateless/tasks proposals, state-based agent benchmarks, POMDP/belief-state agent memory, runtime verification, enterprise assurance, project coordination, transactive memory, and human-AI teaming.

Open discovery result: the strongest bridge today is **status-currentness as a separate evidence check**. A valid-looking artifact should not be re-used indefinitely just because it was admitted once.

Closed discovery checks from v14:

1. Target receipt as a distinct evidence kind is partly closed in pure/replay code.
2. Durable live receipt/status stores remain open.
3. Final-state verification remains open.
4. Durable certificate/status stores remain open.
5. MCP explicit handles and tasks strengthen addressability, but still do not grant authority.
6. PM handoff acknowledgement should reuse status-currentness semantics before shared-state promotion.

## 5. Source Map

| Source | Date | Type | Finding strength | What it supports | Limit |
| --- | --- | --- | --- | --- | --- |
| Local repo audit at `ae3db140668fef2bd158f0078817d368693c9ea2` | 2026-06-16 | Primary local repo evidence | High | `target_receipt` is already a pure/replay primitive; status stores remain open. | This run did not change runtime code. |
| [W3C Bitstring Status List v1.0](https://www.w3.org/TR/vc-bitstring-status-list/) | 2025-02-27 recommendation, observed 2026-06-16 | Standard | High | Status purpose, status authority, validity period, and privacy/correlation risks belong in status checks. | VC status vocabulary is a bridge, not a requirement to adopt W3C credentials wholesale. |
| [W3C Verifiable Credentials Overview](https://www.w3.org/TR/vc-overview/) | 2026-06-10 note, observed 2026-06-16 | Standard / overview | Medium | Credential structure, schema, securing credentials, and status-list family provide durable evidence vocabulary. | Non-normative overview; use normative specs for implementation details. |
| [OpenTelemetry semantic conventions for events](https://opentelemetry.io/docs/specs/semconv/general/events/) and [span-events deprecation note](https://opentelemetry.io/blog/2026/deprecating-span-events/) | current docs and 2026-03 blog | Official docs | Medium | Receipt/status events need stable names, timestamps, attributes, and migration-aware representation. | Observability format is not authority or policy validity. |
| [MCP draft stateless overview](https://modelcontextprotocol.io/specification/draft/basic) and [SEP-2663 Tasks Extension](https://modelcontextprotocol.io/seps/2663-tasks-extension) | 2026 draft/SEP, observed 2026-06-16 | Official specs/proposals | Medium | Explicit identifiers and task state machines make deferred status addressable. | Handles and task IDs remain evidence inputs, not trusted current state. |
| [STAGE-Claw](https://arxiv.org/html/2606.10394v1) | 2026-06 arXiv preprint, not peer-reviewed | Benchmark / preprint | Medium | Final-state verification should compare persistent system-state changes, not only emitted artifacts. | Benchmark scale is small and synthetic relative to enterprise operations. |
| [STATE-Bench](https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/) | 2026-05-19 | Benchmark / official project blog | Medium | Repeated-run reliability and final-state scoring are production-readiness metrics for stateful agents. | Vendor/project context; use the linked repo for primary benchmark details before implementation. |
| [PABU](https://arxiv.org/html/2602.09138v1) and [Belief Memory](https://arxiv.org/html/2605.05583v1) | 2026-02 and 2026-05 arXiv preprints, not peer-reviewed | Primary research preprints | Medium | Partial observability makes full history or deterministic memory an unsafe proxy for latent operational state. | Their learned belief methods are not required for pm-substrate's runtime/status infrastructure. |
| [Toward Pre-Deployment Assurance for Enterprise AI Agents](https://arxiv.org/html/2606.04037v1) and [ProbGuard](https://arxiv.org/html/2508.00500v3) | 2026-06 and 2025/2026 arXiv preprints, not peer-reviewed | Primary research preprints | Low-Medium | Simulation, runtime monitoring, and bounded verification form a rigor ladder. | Domain transfer to PM/workflow tools is unproven. |
| [Collaborating with AI Agents](https://arxiv.org/html/2503.18238v3), [Google TMS framing](https://research.google/pubs/teamwork-makes-the-dream-work-framing-ai-agents-within-transactive-memory-theory/), and [human-AI teaming complementarity framework](https://mj-lab.mgh.harvard.edu/wp-content/uploads/2026/03/Gonzalez_et_al_2026.pdf) | 2025-2026 | Primary/review/vendor research | Medium | PM value depends on calibrated shared models, role knowledge, attention, memory, and protocol burden. | Field and framework claims are context-sensitive; do not overgeneralize to all teams. |

## 6. Prior-Version Claim Audit

| v14 claim or open item | v15 status | Correction or continuation |
| --- | --- | --- |
| Target receipts are distinct from dispatch. | Still confirmed | v15 does not reopen the receipt lane; it asks whether receipt status is still current. |
| Durable live receipt/status stores remain open. | Strengthened | W3C status vocabulary and MCP task state both support a dedicated status lookup contract. |
| Final-state verification remains open. | Strengthened | STAGE-Claw and STATE-Bench support state-based final checks after writes. |
| Persistent runtime/session state is evidence, not authority. | Strengthened | MCP statelessness explicitly warns against treating connection/session continuity as state authority. |
| PM handoff acknowledgement can reuse receipt metadata. | Modified | Handoffs also need status-currentness: acknowledged, failed, superseded, stale, or escalated. |
| Any status-rich credential is production authority. | Rejected | Status lists are a design bridge; pm-substrate still needs substrate-owned policy and authority mapping. |

## 7. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Previously admitted evidence is reused after it becomes stale | Status currentness | W3C status lists + local replay certificates | High | Every replay certificate or target receipt used for a write should carry a status check at decision time. | Add a durable `EvidenceStatusCheck` contract with status authority, status purpose, checkedAt, validFrom/validUntil, and stale policy. | `evidence_status_checked_rate`, `stale_status_reuse_count` | Reusing old admitted evidence without status checks produces equal final-state consistency and no stale failures. | Status checks can expose sensitive workflow progress or credential correlation. |
| A certificate issuer is assumed to control revocation/status | Status authority separation | W3C Bitstring Status List | High | pm-substrate should distinguish evidence issuer from evidence status authority. | Add fields for `issuer`, `statusAuthority`, `statusListRef`, and authority mismatch warnings. | `status_authority_mismatch_count` | Issuer-only validation catches all revoked/suspended evidence. | Separate authority surfaces can create governance ambiguity if not visible to users. |
| Task handles and durable task IDs are treated as task truth | Addressability vs authority | MCP stateless draft + Tasks Extension | Medium | Explicit handles make status lookup possible, but a handle is not the task's current state. | Treat task IDs as refs that require admitted status/result lookup before action. | `handle_without_status_count`, `task_status_lookup_coverage` | Handles alone predict task result/currentness as well as explicit status lookups. | Unguessable IDs and polling can still leak operational timing. |
| Receipt/status telemetry changes representation over time | Event representation stability | OpenTelemetry events + span-event migration | Medium | Receipt/status evidence should be modeled as domain events with stable names/attributes and observed timestamps. | Define event-shape requirements before relying on telemetry as receipt/status input. | `status_event_schema_drift_count`, `observed_timestamp_gap_ms` | Representation drift has no effect on replay or dashboard correctness. | Rich event attributes can over-collect target, tenant, and user details. |
| Agents produce correct-looking artifacts but fail to change environment state | Final-state verification | STAGE-Claw + STATE-Bench | Medium | Write-capable actions should be scored against refreshed persistent state, not only receipt artifacts. | Add final-state fixture family after receipt-backed writes. | `final_state_after_receipt_consistency_rate`, `state_mutation_false_positive_rate` | Artifact-only evaluation matches state-based evaluation across tasks. | State snapshots may include private operational data beyond the action's scope. |
| Agent memory/belief is treated as deterministic state | Uncertainty under partial observability | PABU + Belief Memory | Medium | Memory and belief should be recorded as uncertain evidence, not authoritative current state. | Keep memory reads/writes in evidence admission; add confidence/uncertainty only as advisory metadata, not authority. | `belief_confidence_overclaim_rate`, `memory_as_authority_warning_count` | Deterministic memory conclusions remain valid under noisy/partial observations. | Confidence displays can create false certainty if users over-trust them. |
| PM handoff status becomes surveillance rather than coordination | Burden and complementarity | Human-AI teaming + TMS literature | Medium | Status checks should reduce silent failure/rework without increasing monitoring burden or trust erosion. | Add PM burden and rework metrics before requiring acknowledgement/status for every handoff. | `protocol_burden_cost`, `silent_handoff_failure_rate`, `rework_after_status_check_rate` | Required status checks increase burden without reducing missed handoffs or rework. | Handoff status tracking can become people-monitoring if scoped poorly. |

## 8. New Or Changed Hypotheses

1. **High: Evidence status must be checked at decision time.** A certificate or receipt that was valid when produced can be invalid, suspended, stale, superseded, or too privacy-sensitive to reuse later.
2. **High: Status authority is separate from evidence issuer.** The substrate should not assume the same actor that created evidence also controls its current status.
3. **Medium-high: Explicit state handles are lookup keys, not state.** MCP-style handles and task IDs improve addressability but still need admitted status/result lookup.
4. **Medium-high: Receipt-backed writes need final-state verification.** An applied receipt is stronger than dispatch but still weaker than observing the target system after the write.
5. **Medium: Belief-state research supports substrate separation.** Learned belief and memory systems can help agents act under partial observability, but pm-substrate should not require model training to enforce currentness/status checks.
6. **Medium: PM status governance must have a burden budget.** More acknowledgements and status checks are useful only when they reduce silent failures, rework, and role confusion.

## 9. Project-Management Implications

The PM layer should stop treating "sent," "acknowledged," "done," or "accepted" as timeless labels. Each label needs a status source, status purpose, checked-at time, owner, and expiration/supersession rule.

1. **Status is a PM coordination object.** A handoff can be acknowledged, later superseded, escalated, or invalidated.
2. **Role knowledge must be explicit.** Transactive-memory framing implies the system should expose who knows, who owns, who can revoke or change status, and who must act next.
3. **Shared mental models require freshness.** A team can have a shared but outdated model; pm-substrate should surface stale shared state as a coordination risk.
4. **Burden stays first-class.** Status checks that feel like surveillance or busywork should be measured and scoped to high-consequence workflows.

## 10. Implementation Implications For pm-substrate

This run is research-only. It does not claim a new runtime primitive. The strongest next implementation slice is a small status-check contract around existing evidence-binding/certificate/receipt objects.

Implementation/Test Task Tree (2026-06-16 v15):

```text
status-currentness contract ............. NEXT
|-- durable EvidenceStatusCheck type ..... OPEN
|-- replay certificate status check ...... OPEN
|-- target receipt status check .......... OPEN
|-- failed/stale receipt denial fixtures . OPEN
|-- final-state verification fixtures .... OPEN
`-- PM burden/rework metrics ............. OPEN

already closed before v15:
|-- memory evidence taxonomy ............. IMPLEMENTED (pure/replay)
|-- target receipt evidence kind ......... IMPLEMENTED (pure/replay)
`-- dispatch-only receipt downgrade ...... IMPLEMENTED (pure/replay)
```

Recommended next code shape:

1. Add pure status-check types first, not a DB store first.
2. Feed status checks into the existing evidence-binding/catalog verifier.
3. Add replay rows for valid, revoked, suspended, expired, stale, failed-receipt, and superseded-receipt cases.
4. Only after replay semantics are stable, promote status checks into a durable store or live lookup adapter.

## 11. Rejected, Weak, Or Stale Bridges

| Bridge or claim | Status | Reason |
| --- | --- | --- |
| A target receipt is final-state proof. | Reject | Receipts can say target-side application happened without proving refreshed world state matches intended state. |
| W3C VC status means pm-substrate must become a VC platform. | Reject | The useful bridge is status semantics, authority separation, validity windows, and privacy warnings. |
| MCP task IDs are durable operational truth. | Reject | Task IDs are explicit references; current task status still needs lookup/admission. |
| Belief-state models replace substrate status checks. | Reject | Belief states estimate hidden state; pm-substrate needs operational evidence checks around existing tools. |
| More PM acknowledgements always improve coordination. | Weak | Human-AI teaming evidence is mixed and burden-sensitive. Measure rework reduction and trust impact. |
| Telemetry events are stable enough by default. | Stale/weak | OpenTelemetry's span-event migration shows representation can change; schema drift needs explicit handling. |

## 12. Metrics And Eval Scenarios To Add

Metrics to add:

- `evidence_status_checked_rate`
- `stale_status_reuse_count`
- `revoked_certificate_block_rate`
- `suspended_certificate_warning_count`
- `status_authority_mismatch_count`
- `status_lookup_latency_ms`
- `status_event_schema_drift_count`
- `handle_without_status_count`
- `final_state_after_receipt_consistency_rate`
- `state_mutation_false_positive_rate`
- `protocol_burden_cost`
- `rework_after_status_check_rate`

Eval scenarios:

1. **Valid status at decision time.** A replay certificate is checked against a current valid status source; expected allow.
2. **Revoked evidence.** A previously admitted certificate is revoked before write dispatch; expected block.
3. **Suspended evidence.** A certificate is temporarily suspended; expected warning or block depending on consequence policy.
4. **Refresh-required status.** Status says updated evidence is available; expected stale/superseded warning.
5. **Status authority mismatch.** Evidence issuer and status authority differ unexpectedly; expected warning.
6. **Task handle without status.** A durable task ID is present but no current task status/result is admitted; expected warning/block for writes.
7. **Receipt failed after dispatch.** Target receipt status is failed; expected block before shared-state promotion.
8. **Receipt stale at decision time.** Receipt exists but checkedAt/validUntil is outside policy; expected stale-status warning.
9. **Final-state mismatch after applied receipt.** Receipt says applied but refreshed state disagrees; expected final-state failure.
10. **PM handoff superseded.** Acknowledgement exists but later status supersedes owner/blocker; expected stale handoff warning.

## 13. Next-Day Watchlist

1. Implement the smallest pure `EvidenceStatusCheck` type and test matrix.
2. Decide how status checks attach to `InvocationEvidenceBinding`, target receipts, and replay certificates.
3. Add failed, stale, revoked, suspended, and refresh-required replay cases.
4. Add status authority mismatch warnings before durable DB work.
5. Start final-state verification fixtures only after status semantics are stable.
6. Add a PM handoff status fixture with acknowledgement, supersession, and escalation.
7. Keep vendor/runtime developments as context unless they provide primary docs, source repos, or benchmark artifacts.

## 14. Source Inventory With Links And Dates

New or strengthened in v15:

- W3C Bitstring Status List v1.0, W3C Recommendation, 2025-02-27, observed 2026-06-16: https://www.w3.org/TR/vc-bitstring-status-list/. Source type: standard. Finding strength: High for status purpose, revocation/suspension/refresh, status authority, validity period, and privacy/correlation warnings.
- W3C Verifiable Credentials Overview, W3C Group Note, 2026-06-10, observed 2026-06-16: https://www.w3.org/TR/vc-overview/. Source type: standard overview. Finding strength: Medium for credential/status ecosystem vocabulary.
- OpenTelemetry semantic conventions for events, current docs observed 2026-06-16: https://opentelemetry.io/docs/specs/semconv/general/events/. Source type: official docs. Finding strength: Medium for event naming, timestamps, attributes, and observed timestamp discipline.
- OpenTelemetry "Deprecating Span Events API," 2026-03-06, observed 2026-06-16: https://opentelemetry.io/blog/2026/deprecating-span-events/. Source type: official docs/blog. Finding strength: Medium for telemetry representation migration risk.
- MCP draft basic overview, observed 2026-06-16: https://modelcontextprotocol.io/specification/draft/basic. Source type: official draft spec. Finding strength: Medium for statelessness and explicit identifier discipline.
- MCP SEP-2663 Tasks Extension, 2026-04/05 proposal, observed 2026-06-16: https://modelcontextprotocol.io/seps/2663-tasks-extension. Source type: official SEP. Finding strength: Medium for durable task state machines and deferred status/result retrieval.
- STAGE-Claw, arXiv:2606.10394, 2026-06 preprint, not peer-reviewed: https://arxiv.org/html/2606.10394v1. Source type: benchmark/preprint. Finding strength: Medium for persistent final-state verification.
- Microsoft STATE-Bench project blog, 2026-05-19: https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/. Source type: benchmark/project context. Finding strength: Medium for repeated-run reliability and final-state scoring.
- PABU, arXiv:2602.09138, 2026-02 preprint, not peer-reviewed: https://arxiv.org/html/2602.09138v1. Source type: primary research preprint. Finding strength: Medium for partial observability and progress-aware belief state framing.
- Belief Memory, arXiv:2605.05583, 2026-05 preprint, not peer-reviewed: https://arxiv.org/html/2605.05583v1. Source type: primary research preprint. Finding strength: Medium for uncertainty-preserving memory under partial observability.
- Toward Pre-Deployment Assurance for Enterprise AI Agents, arXiv:2606.04037, 2026-06 preprint, not peer-reviewed: https://arxiv.org/html/2606.04037v1. Source type: primary research preprint. Finding strength: Low-Medium for assurance rigor ladder.
- ProbGuard, arXiv:2508.00500v3, 2025/2026 preprint, not peer-reviewed: https://arxiv.org/html/2508.00500v3. Source type: primary research preprint. Finding strength: Low-Medium for runtime monitoring and abstract state predicates.
- Collaborating with AI Agents, arXiv:2503.18238v3, 2025/2026 preprint, not peer-reviewed: https://arxiv.org/html/2503.18238v3. Source type: primary research preprint. Finding strength: Medium for shared mental models, workspaces, and teamwork cost.
- Google Research "Teamwork makes the dream work," observed 2026-06-16: https://research.google/pubs/teamwork-makes-the-dream-work-framing-ai-agents-within-transactive-memory-theory/. Source type: vendor research page. Finding strength: Medium as PM/TMS framing, not implementation proof.
- Gonzalez et al., "Toward a science of human-AI teaming for decision making," 2026 PDF observed 2026-06-16: https://mj-lab.mgh.harvard.edu/wp-content/uploads/2026/03/Gonzalez_et_al_2026.pdf. Source type: review/framework. Finding strength: Medium for complementarity, role partitioning, attention, memory, and continuous evaluation.

Carried forward and still active:

- v12-v14 W3C credential, OpenTelemetry, MCP, memory-control, memory-poisoning, receipt, and PM human-AI teaming sources remain active.
- v14's target-receipt implementation proof remains scoped to pure/replay primitives, not durable live stores or final-state verification.

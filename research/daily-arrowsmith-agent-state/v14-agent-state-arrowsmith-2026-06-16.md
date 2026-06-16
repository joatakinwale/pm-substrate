# v14 Agent-State Arrowsmith - 2026-06-16

Date: 2026-06-16 UTC
Local run clock: 2026-06-16 America/Chicago
Status: fourteenth numbered daily continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v13-agent-state-arrowsmith-2026-06-15.md`

Repository sync note: this run started by checking Git health, local `HEAD`, local `origin/main`, and remote `main`. All three resolved to `d84052df7f5a7b9af6b4a5c0023b200ee3d67bbe` before publication work. Same-day frontier review included the June 15 commits on `main` (`07b7f7d`, `97a0f19`, `e3b6f73`, `d84052d`) so the new continuation would not restate already-landed memory or replay fixes as open work.

## 1. Version Header

v14 continues v13 instead of restarting the thesis. v13 chose the memory frontier from v12 and closed the pure memory-admission slice. That left three nearby executable seams: durable certificate/status stores, target-side receipt evidence, and policy/final-state verification. This run chooses the receipt seam and closes the next honest pure primitive: external evidence can now say "this is a target receipt," and the admission layer can distinguish dispatch-only telemetry from actual target-side application evidence.

## 2. One-Paragraph Delta From Previous Version

v13 correctly said persistent runtime and memory surfaces increase urgency without granting authority. The fresh June 14-16 official window sharpens that with telemetry language: GitHub's June 15 update explicitly says server-side telemetry can confirm active users without yet carrying the richer per-interaction dimensions that client telemetry provides. That is the exact shape of the receipt problem. A system can know "something happened" while still lacking the target-side detail needed to treat the event as valid shared state. The strongest research-to-code move was therefore to add a typed `target_receipt` evidence lane and make dispatch-only "receipts" warn instead of quietly reading as delivery proof.

## 3. Research Question

What is the smallest honest code slice that turns v12's target-side receipt claim into executable substrate behavior without pretending we already have durable live receipt stores or final-state verification?

## 4. A/B/C Framing

**A-literature/problem.** Persistent agent runtimes, workflow automation, long-running tool sessions, telemetry aggregation, cloud coding agents, and PM handoff/update channels.

**B bridge concepts.** Dispatch, acknowledgement, delivery, application, target receipt, correlation id, receipt metadata, final-state observation, telemetry coverage, source authority, and shared-state promotion.

**C literatures/domains.** OpenTelemetry event semantics, workflow/runtime platform docs, delivery/receipt failure framing, observability, human-AI teaming, PM coordination, and operational telemetry design.

Open discovery result: the strongest bridge today is **receipt evidence as a distinct admission lane**. Telemetry, dispatch logs, and resumed sessions are useful evidence, but target-side confirmation still needs its own typed contract before a write can be treated as shared state.

Closed discovery checks from v13:

1. Target-side receipt now has a first-class evidence kind and replay fixture family.
2. Dispatch-only signals are now downgraded from receipt proof in code.
3. Durable live receipt/status stores remain open.
4. Final-state verification after action remains open.
5. Certificate/status stores remain open.
6. PM handoff acknowledgement can now reuse the same receipt lane later.

## 5. Source Map

| Source | Date | Type | Finding strength | What it supports | Limit |
| --- | --- | --- | --- | --- | --- |
| Local repo audit at `d84052df7f5a7b9af6b4a5c0023b200ee3d67bbe` plus new `@pm/agent-state` / `@pm/evals` receipt diffs | 2026-06-16 | Primary local repo evidence | High | The executable invariant is now target receipt typing plus replay metrics. | Local proof only until committed/pushed; live transports still open. |
| [Copilot usage metrics now include more of your active users](https://github.blog/changelog/2026-06-15-copilot-usage-metrics-now-include-more-of-your-active-users/) | 2026-06-15 | Official vendor changelog | High for telemetry-gap framing | Server-side signals can confirm activity while richer per-surface detail is still absent. | Reporting/analytics evidence, not write-validity policy. |
| [Amazon Bedrock AgentCore release notes](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html) | observed 2026-06-16 | Official docs | Medium | Persistent shells, workflow embedding, and stateful gateway sessions widen runtime continuity and receipt pressure. | Platform capability evidence, not target-state proof. |
| [OpenAI News](https://openai.com/news/) including "Introducing the OpenAI Partner Network" | observed 2026-06-16; item dated 2026-06-14 | Official company news index | Medium | Governance/distribution surfaces keep widening around agent action. | Partner/channel growth is not a state-review primitive. |
| [OpenTelemetry semantic conventions for events](https://opentelemetry.io/docs/specs/semconv/general/events/) and [semantic conventions overview](https://opentelemetry.io/docs/concepts/semantic-conventions/) | current docs carried from v12 | Official docs | Medium | Receipt events should keep consistent event names, timestamps, and attributes. | Correlation vocabulary is not authorization or final-state proof. |

## 6. Prior-Version Claim Audit

| v13 claim or open item | v14 status | Correction or continuation |
| --- | --- | --- |
| Target-side receipt evidence is open. | Partly closed in code | `target_receipt` is now a first-class evidence kind with metadata and replay fixtures. |
| Dispatch success is not delivery proof. | Strengthened and partly closed | Dispatch-only receipts now warn instead of reading as admitted confirmation. |
| Persistent runtime state increases urgency, not authority. | Strengthened | GitHub server-side telemetry proves the shape of the gap: coverage can improve before detail/currentness is sufficient. |
| Durable certificate/status verification is open. | Still open | v14 does not change the certificate frontier. |
| Final-state verification is open. | Still open | v14 stops at receipt admission, not post-write world-state confirmation. |
| PM handoff acknowledgement needs typed receipt. | Strengthened | Receipt metadata now provides a reusable lane for later PM handoff acknowledgements. |

## 7. Arrowsmith Matrix

| A problem or claim | B bridge concept | C source/domain | Evidence strength | Hypothesis for pm-substrate | Implementation implication | Metric to test | Falsifier | Risk/ethics note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dispatch logs get mistaken for delivery | Target receipt vs dispatch | OpenTelemetry + Channel Fracture + current official runtime docs | High for bridge | A dispatch event should not be treated as admitted shared state until target-side receipt status is explicit. | Add `target_receipt` evidence kind and warn on `dispatched`/`acknowledged` pseudo-receipts. | `dispatch_only_receipt_count`, `target_receipt_coverage` | Dispatch-only and receipt-backed paths show equal final-state consistency. | Receipt telemetry can expose sensitive targets, channels, or workflow identities. |
| Telemetry coverage rises before detail coverage | Server-side telemetry incompleteness | GitHub June 15 changelog | High | The substrate should separate high-level confirmation from detailed target-surface proof. | Keep target receipt metadata typed instead of promoting raw server-side confirmation to authority. | `target_receipt_statuses`, `receipt_detail_coverage` | Server-only signals prove the same operational validity as full per-surface details. | Analytics data can be over-trusted because it looks global and quantitative. |
| Persistent runtime/workflow sessions feel like durable truth | Session continuity vs applied state | AWS AgentCore release notes | Medium | Runtime/session persistence should produce evidence inputs, not bypass receipt/current-state review. | Reuse receipt lane before shared-state promotion from runtime tools, memory stores, or delegated workflows. | `runtime_receipt_reuse_rate` | Persistent runtime state predicts valid action with no receipt failures. | Session metadata may leak operator habits, tenant names, or infrastructure layout. |
| PM handoffs are marked "sent" without acknowledgement | Typed acknowledgement | PM/team coordination | Medium | Handoff updates should gain target acknowledgement before they become shared operational state. | Reuse `target_receipt` later for PM handoff channels and acknowledgement events. | `handoff_receipt_coverage`, `silent_handoff_failure_rate` | Sent-only and acknowledged handoffs produce the same rework/risk profile. | Acknowledgement tracking can become surveillance if not scoped carefully. |

## 8. New Or Changed Hypotheses

1. **High: Target receipt needs its own evidence kind.** A dispatch log, gateway log, or server-side activity signal is not semantically equivalent to target-side acknowledgement or application.
2. **High: Dispatch-only receipts should warn, not silently admit.** `dispatched` and `acknowledged` are useful evidence but incomplete proof.
3. **Medium-high: Receipt metadata is part of required evidence.** `channel`, `correlatedDispatchId`, and `receiptStatus` are the minimum replay/correlation fields.
4. **Medium: Final-state verification is still a stricter lane than receipt.** `applied` plus `finalStateObserved` is stronger than dispatch, but v14 still does not claim world-state correctness after action.
5. **Medium: PM acknowledgement can share the same lane later.** Handoff and workflow channels should reuse receipt semantics rather than inventing PM-only delivery words.

## 9. Project-Management Implications

PM substrate value still lives in shared operational cognition, not richer activity feeds. v14 adds a stricter rule: "sent" is a transport fact, not a coordination fact.

1. **Acknowledged handoffs over sent updates.** PM state should distinguish dispatch from acknowledgement.
2. **Correlation over prose.** A receipt should point back to the triggering dispatch id or artifact rather than rely on narrative matching.
3. **Receipt before promotion.** Shared state should not promote outbound update success until the target channel confirms it.
4. **Burden still matters.** Adding receipt metadata is justified only if it reduces silent failure and rework.

## 10. Implementation Implications For pm-substrate

This run converted the strongest open v12 receipt finding into code:

1. Added `target_receipt` as a distinct `ExternalStateEvidenceKind`.
2. Added a `TargetReceiptEvidenceFacet` carrying `channel`, `correlatedDispatchId`, `receiptStatus`, `receiptId`, `targetSurface`, and `finalStateObserved`.
3. Added admission warnings for missing target-receipt metadata and for dispatch-only / acknowledgement-only pseudo-receipts.
4. Extended the replay corpus with dispatch-only and clean applied receipt fixtures.
5. Extended replay metrics with `targetReceiptCount`, `dispatchOnlyReceiptCount`, and `targetReceiptStatuses`.

Implementation/Test Task Tree (2026-06-16):

```text
target receipt evidence lane ........... IMPLEMENTED (pure)
dispatch-only receipt downgrade ........ IMPLEMENTED (pure)
receipt replay corpus + metrics ........ IMPLEMENTED (pure)
durable live receipt/status store ...... OPEN
final-state verification after action .. OPEN
certificate/status store verification .. OPEN
PM protocol-burden measurement ......... OPEN
```

Verification run for this completion:

- `pnpm vitest run packages/agent-state/src/external-evidence.test.ts --reporter=basic`
- `pnpm vitest run packages/evals/src/evidence-admission.test.ts --reporter=basic`
- `pnpm --filter @pm/agent-state build`
- `pnpm --filter @pm/evals build`

## 11. Rejected, Weak, Or Stale Bridges

| Bridge or claim | Status | Reason |
| --- | --- | --- |
| Server-side telemetry is delivery proof. | Reject | Coverage can improve before target-surface detail and receipt status are known. |
| Persistent sessions equal valid operational state. | Reject | Runtime continuity is evidence, not authority or target confirmation. |
| Any receipt means final-state correctness. | Reject | Receipt is stronger than dispatch, but weaker than confirmed final-state verification. |
| PM "sent" updates are coordinated state. | Downgraded | Handoff coordination needs acknowledgement or receipt, not outbound intent alone. |
| All receipt problems should block immediately. | Weak | v14 adds typed warnings and replay metrics first; live runtime policy can come later. |

## 12. Metrics And Eval Scenarios To Add

New metrics added in code:

- `targetReceiptCount`
- `dispatchOnlyReceiptCount`
- `targetReceiptStatuses`

Metrics still to add:

- `target_receipt_coverage`
- `silent_delivery_failure_rate`
- `receipt_detail_coverage`
- `final_state_after_receipt_consistency_rate`
- `handoff_receipt_coverage`
- `dispatch_without_receipt_rate`
- `protocol_burden_cost`

Eval scenarios:

1. **Dispatch-only pseudo-receipt.** A transport reports success but target application is unconfirmed; expected warning.
2. **Applied target receipt.** Target channel confirms application with correlation metadata; expected clean admission.
3. **Missing receipt metadata.** A receipt lacks channel or correlated dispatch id; expected required-evidence warning.
4. **Failed target receipt.** A target reports failure after dispatch; future expected warning or block depending on consequence policy.
5. **PM handoff acknowledgement.** A handoff is sent and later acknowledged by the receiving owner; expected receipt-backed promotion of shared state.

## 13. Next-Day Watchlist

1. Decide whether target receipts should feed directly into `InvocationEvidenceBinding` or remain admitted evidence consumed by later binding checks.
2. Add failed-receipt and stale-receipt denial cases, not only dispatch-only warnings.
3. Reuse the receipt lane for PM handoff acknowledgement and delegated-agent completion paths.
4. Add durable receipt/status lookup before claiming live runtime coverage.
5. Return to durable certificate/status stores once receipt replay is published.
6. Start a small final-state verification fixture family that compares receipt-backed writes against refreshed current state.

## 14. Source Inventory With Links And Dates

New or strengthened in v14:

- Copilot usage metrics now include more of your active users, GitHub changelog, 2026-06-15: https://github.blog/changelog/2026-06-15-copilot-usage-metrics-now-include-more-of-your-active-users/. Source type: official vendor changelog. Finding strength: High for telemetry-coverage-vs-detail framing.
- OpenAI News index including "Introducing the OpenAI Partner Network," observed 2026-06-16, item dated 2026-06-14: https://openai.com/news/. Source type: official company news index. Finding strength: Medium for governance/distribution-surface growth.
- Amazon Bedrock AgentCore release notes, observed 2026-06-16: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html. Source type: official docs. Finding strength: Medium for persistent runtime/session/workflow pressure.

Carried forward and still active:

- v12 OpenTelemetry event sources remain active for receipt-event naming, timestamps, and attributes.
- v12-v13 PM and human-AI teaming sources remain active for acknowledgement, burden, and handoff-state measurement.

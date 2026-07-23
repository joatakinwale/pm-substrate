# Agent-State Arrowsmith v21: Workflow Outcome Envelope Boundary

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v20-write-transport-outcome-envelope-coverage-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ22 from v20.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ22: What is the smallest workflow/runtime boundary that can create an `ActionOutcomeEnvelope` and verify evidence binding atomically before dispatch, without requiring profile or capability-package edits after adapter boundaries exist? | The smallest boundary is the last runtime gate before effectful invocation. Schneider's state-machine approach says service state changes should be the deterministic result of admitted requests. Clark-Wilson says operational integrity comes from well-formed transactions, not arbitrary subject writes. Herlihy/Wing linearizability requires a single operation effect point. Kung/Robinson OCC permits private work only if validation happens before commit. In this repo, `PostgresWorkflowRuntime` already owns that boundary for write-capable workflow dispatch. | Added a dependency-light workflow `InvocationActionOutcomeEnvelope` and `buildInvocationActionOutcomeEnvelope()`. `PostgresWorkflowRuntime` now creates a blocked envelope for failed evidence-binding validation/verification and an accepted envelope before dispatch for admitted write-capable invocations under `evidenceBindingMode: "require_for_writes"`. The dispatcher context now carries `actionOutcomeEnvelope`. Write-transport outcome-envelope provider coverage moved from 0/4 to 4/4 in the fixture inventory. | RQ23: How should runtime-generated workflow outcome envelopes be promoted into full `@pm/agent-state` `ActionOutcomeEnvelope` refs and EvalEvents without duplicating terminal claims across packages? |

Active question set leaving this run: RQ12-RQ20, RQ23.

## Sources

- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach," ACM Computing Surveys, 1990: https://dl.acm.org/doi/10.1145/98163.98167
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy, 1987: https://ieeexplore.ieee.org/document/6234899
- Maurice P. Herlihy and Jeannette M. Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS, 1990: https://dl.acm.org/doi/10.1145/78969.78972
- H. T. Kung and John T. Robinson, "On Optimistic Methods for Concurrency Control," ACM TODS, 1981: https://dl.acm.org/doi/10.1145/319566.319567

## Implementation Delta

1. `@pm/workflow` now exposes `InvocationActionOutcomeEnvelope`, `InvocationActionTerminalOutcome`, and `buildInvocationActionOutcomeEnvelope()`.
2. `InvocationContext` now carries `actionOutcomeEnvelope` for admitted write-capable dispatches.
3. `PostgresWorkflowRuntime` generates blocked envelopes for `evidence_binding_missing`, `evidence_binding_incomplete`, `evidence_policy_blocked`, and `evidence_binding_unverified` before dead-lettering.
4. `PostgresWorkflowRuntime` generates accepted envelopes before calling the dispatcher when evidence binding is valid.
5. `@pm/evals` write-transport coverage now reports `outcomeEnvelopeCoverageRate = 1` for the four workflow-routed fixture transports.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Runtime boundary exists for workflow-routed write-capable dispatch and the fixture coverage now marks `arrowhedge.portfolio.accept` as outcome-envelope-covered. Still needs full ArrowHedge live run / replay records carrying these envelope refs. |
| Axis B marketing | Still blocked. Runtime coverage helps `agency.lead.promote` fixture transport, but PluggedInSocial or accepted authoritative agency fixtures remain missing. |
| Axis C local lab | Mechanism-level boundary exists in `@pm/workflow`; dynamic local lab still needs live Postgres/Ollama scenario execution and EvalEvents linked to runtime-generated envelope refs. |

## Next Action Queue

1. Answer RQ23 by defining one source of truth for workflow-generated envelopes vs full `@pm/agent-state` envelopes.
2. Promote workflow envelope ids into Axis A write-binding replay records and EvalEvents.
3. Add a small replay fixture where a blocked workflow write produces a blocked runtime outcome envelope and no dispatcher call.
4. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are explicitly accepted.

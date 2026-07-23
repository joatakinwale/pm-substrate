# Agent-State Arrowsmith v22: Workflow Envelope Promotion

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v21-workflow-outcome-envelope-boundary-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ23 from v21.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ23: How should runtime-generated workflow outcome envelopes be promoted into full `@pm/agent-state` `ActionOutcomeEnvelope` refs and EvalEvents without duplicating terminal claims across packages? | The workflow envelope should remain the runtime terminal source, and the agent-state envelope should be a proof wrapper that cites it as substrate evidence. Schneider's state-machine approach and Herlihy/Wing linearizability both require one deterministic operation effect point. Clark-Wilson integrity policy separates well-formed transactions from arbitrary subject writes. Kung/Robinson OCC permits private work, but only the validated commit boundary determines the accepted outcome. Therefore a second package must not recompute or contradict the terminal result; it can only promote the terminal record into a replayable proof packet with the evidence and substrate refs required by evals. | Added `promoteWorkflowInvocationOutcomeEnvelope()` in `@pm/agent-state`, added `action_outcome_envelope` as a `StateRefKind`, and made ArrowHedge write-binding replay records carry canonical `ActionOutcomeEnvelope` objects promoted from workflow runtime envelopes. The replay fixture now includes accepted/blocked terminal proof packets and metrics count accepted vs blocked envelopes. | RQ24: How should promoted runtime outcome envelopes be persisted and replayed as substrate refs so Axis A/C EvalEvents and amnesiac resume recover terminal outcomes from substrate state rather than JSONL duplication or chat context? |

Active question set leaving this run: RQ12-RQ20, RQ24.

## Sources

- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach," ACM Computing Surveys, 1990: https://dl.acm.org/doi/10.1145/98163.98167
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy, 1987: https://ieeexplore.ieee.org/document/6234899
- Maurice P. Herlihy and Jeannette M. Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS, 1990: https://dl.acm.org/doi/10.1145/78969.78972
- H. T. Kung and John T. Robinson, "On Optimistic Methods for Concurrency Control," ACM TODS, 1981: https://dl.acm.org/doi/10.1145/319566.319567

## Implementation Delta

1. `@pm/agent-state` now exposes `promoteWorkflowInvocationOutcomeEnvelope()` for converting a workflow runtime envelope into a canonical `ActionOutcomeEnvelope`.
2. Promotion refuses to turn an invalid workflow evidence decision into an accepted terminal outcome.
3. Promotion refuses accepted outcomes with blocking causes and blocked outcomes without a cause when the workflow evidence decision was otherwise valid.
4. Promoted envelopes cite the workflow runtime envelope as an `action_outcome_envelope` substrate ref and also cite the workflow run, capability invocation, and state-review artifact where available.
5. `@pm/evals` ArrowHedge write-binding replay records now include promoted action outcome envelopes, committed in `packages/evals/fixtures/write-binding-replay.v1.jsonl`.
6. Write-binding replay metrics now count total, accepted, and blocked action outcome envelopes.

## Falsification Criteria

This slice fails if:

1. A workflow runtime envelope with invalid evidence can be promoted to an accepted `ActionOutcomeEnvelope`.
2. A promoted accepted envelope can carry blocking causes.
3. A promoted blocked envelope can hide the workflow gate cause.
4. Replay records can no longer verify outcome hashes after regeneration.
5. ArrowHedge replay metrics count allowed/blocked write decisions but do not count terminal envelopes.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Improved. ArrowHedge write-binding replay records now carry canonical promoted `ActionOutcomeEnvelope` proof packets for allowed, unverified, missing, incomplete, and policy-blocked write attempts. This is still replay/fixture proof, not a live ArrowHedge DB run. |
| Axis B marketing | Still blocked. PluggedInSocial is not restored/cloned and no accepted authoritative agency fixtures have been provided, so the whole solution remains unverified. |
| Axis C local lab | Improved only at the mechanism boundary. The promotion helper and workflow runtime envelope tests cover the package seam, but dynamic local lab EvalEvents still need persisted promoted envelope refs and live replay recovery. |

## Next Action Queue

1. Answer RQ24 by defining the durable storage/replay shape for promoted workflow outcome envelopes.
2. Store promoted envelope refs in Axis A/C EvalEvents instead of relying on generated replay JSONL alone.
3. Add amnesiac resume coverage that recovers terminal outcomes from substrate refs after chat state is discarded.
4. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are explicitly accepted.

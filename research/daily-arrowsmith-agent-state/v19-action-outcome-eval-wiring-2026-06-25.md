# Agent-State Arrowsmith v19: Outcome Envelope Eval Wiring

Date: 2026-06-25
Status: research-to-eval continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v18-action-outcome-loop-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ11-RQ20 from v18.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ11: Can terminal outcome partitioning be enforced across DB/runtime transports, not only pure arrays? | Yes, but only if every operational side effect is downstream of the same admission discipline. Schneider's state-machine approach makes service state a deterministic function of ordered accepted requests. Clark-Wilson integrity policy requires well-formed transactions rather than arbitrary subject writes. Herlihy/Wing linearizability supplies the single operation effect point. Kung/Robinson OCC shows private/speculative work can be allowed only when a validation boundary exists before commit. | Added first-class `action_outcome_envelope` eval refs, wired them into Axis A ArrowHedge terminal-partition paired events, added Axis C substrate-arm outcome refs, and added an Axis B blocked event builder. This is eval proof wiring, not runtime transport enforcement. | RQ21: Which concrete write-capable pm-substrate transports still lack a required `ActionOutcomeEnvelope` before side effects? |

Active question set leaving this run: RQ12-RQ21.

## Sources

- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach," ACM Computing Surveys, 1990: https://dl.acm.org/doi/10.1145/98163.98167
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy, 1987: https://ieeexplore.ieee.org/document/6234899
- Maurice P. Herlihy and Jeannette M. Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS, 1990: https://dl.acm.org/doi/10.1145/78969.78972
- H. T. Kung and John T. Robinson, "On Optimistic Methods for Concurrency Control," ACM TODS, 1981: https://dl.acm.org/doi/10.1145/319566.319567

## Implementation Delta

1. `EvalEvidenceRef.kind` now admits `action_outcome_envelope`.
2. Axis A `buildArrowHedgeStateEvalSuite()` includes `arrowhedge-terminal-outcome-partition`, a paired finance scenario that fails substrate if no outcome envelope is supplied.
3. Axis C scaffolded local-lab substrate arms cite outcome-envelope refs so the pass is tied to terminal-normal-form evidence, not only continuity checkpoints.
4. Axis B has a machine-checkable blocked event builder that records the missing PluggedInSocial clone / missing authoritative fixtures blocker.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Improved from pure primitive to paired eval evidence wiring for the terminal-partition scenario. Still not a live ArrowHedge runtime proof. |
| Axis B marketing | Blocked and machine-recorded. `/Volumes/WD_BLACK/JoatLabs/PluggedInSocial` is missing and authoritative fixtures have not been accepted. |
| Axis C local lab | Scaffolded eval events now cite `ActionOutcomeEnvelope`; dynamic local lab still requires live Postgres/Ollama execution for behavioral proof. |

## Next Action Queue

1. Answer RQ21 by inventorying write-capable transports and classifying outcome-envelope coverage.
2. Add `ActionOutcomeEnvelope` production through ArrowHedge write-binding/replay records.
3. Add `EvidenceStatusCheck` so evidence lease/status fields become executable.
4. Decide Axis B source: restore PluggedInSocial or accept authoritative agency fixtures.
5. Start expanding the 10 failure classes x 3 axes scenario matrix with outcome-envelope refs where terminal behavior is part of the pass/fail proof.

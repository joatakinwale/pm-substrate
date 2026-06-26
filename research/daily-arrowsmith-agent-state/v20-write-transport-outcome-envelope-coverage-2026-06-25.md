# Agent-State Arrowsmith v20: Write-Transport Outcome Envelope Coverage

Date: 2026-06-25
Status: research-to-eval continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v19-action-outcome-eval-wiring-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ21 from v19.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ21: Which concrete write-capable pm-substrate transports still lack a required `ActionOutcomeEnvelope` before side effects? | The relevant enforcement papers answer this structurally: Schneider's state-machine approach requires all service mutations to pass through the same ordered request boundary; Clark-Wilson requires well-formed transactions rather than arbitrary writes; Herlihy/Wing identifies one operation effect point; Kung/Robinson OCC permits private work only if a validation boundary precedes commit. Therefore every write-capable transport lacking an outcome-envelope provider before side effects remains outside the terminal-normal-form proof. | Extended `@pm/evals` write-transport coverage samples and metrics with `requiresActionOutcomeEnvelope`, `hasActionOutcomeEnvelopeProvider`, `outcomeEnvelopeCoverageRate`, and missing transport ids. Current fixture inventory shows 4/4 write-capable transports require envelopes and 0/4 have providers: `arrowhedge.portfolio.accept`, `agency.lead.promote`, `research.memo.publish`, and `crm.note.sync`. Also reconciled stale ArrowHedge artifact hashes in the write-binding replay corpus against the committed state-review artifact corpus. | RQ22: What is the smallest workflow/runtime boundary that can create an `ActionOutcomeEnvelope` and verify evidence binding atomically before dispatch, without requiring profile or capability-package edits after adapter boundaries exist? |

Active question set leaving this run: RQ12-RQ20, RQ22.

## Sources

- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach," ACM Computing Surveys, 1990: https://dl.acm.org/doi/10.1145/98163.98167
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy, 1987: https://ieeexplore.ieee.org/document/6234899
- Maurice P. Herlihy and Jeannette M. Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS, 1990: https://dl.acm.org/doi/10.1145/78969.78972
- H. T. Kung and John T. Robinson, "On Optimistic Methods for Concurrency Control," ACM TODS, 1981: https://dl.acm.org/doi/10.1145/319566.319567

## Implementation Delta

1. `WriteTransportBindingCoverageSample` now records whether a write transport requires an `ActionOutcomeEnvelope` and whether a provider exists.
2. `analyzeWriteTransportBindingCoverage()` now reports outcome-envelope required, covered, missing, coverage rate, and missing transport ids.
3. The fixture inventory now makes the current runtime gap explicit: evidence-binding coverage can be partially verified while outcome-envelope coverage remains 0%.
4. The write-binding replay corpus now matches the committed ArrowHedge state-review artifact hashes, restoring replay-catalog consistency.

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Terminal-partition eval events exist and write-transport metrics identify `arrowhedge.portfolio.accept` as missing a pre-dispatch outcome-envelope provider. |
| Axis B marketing | Still blocked. The fixture inventory includes `agency.lead.promote`, but that is not a replacement for PluggedInSocial or accepted authoritative agency fixtures. |
| Axis C local lab | Scaffolded substrate events cite outcome envelopes, but runtime transport coverage remains fixture-based and not a live local-lab dispatch proof. |

## Next Action Queue

1. Answer RQ22 by locating the minimal workflow/runtime boundary for atomic evidence-binding verification plus outcome-envelope creation.
2. Add an outcome-envelope provider contract to the write-capable dispatch path.
3. Generate `ActionOutcomeEnvelope` refs from ArrowHedge write-binding replay records.
4. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are explicitly accepted.

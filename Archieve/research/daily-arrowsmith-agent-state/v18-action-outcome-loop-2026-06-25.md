# Agent-State Arrowsmith v18: Action Outcome Closed Loop

Date: 2026-06-25
Status: research-to-code continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v17-reality-quality-arrowsmith-2026-06-24.md`

## Scope

This run starts the requested closed research-to-implementation loop for the first v17 candidate:

```text
terminal action normal form
+ local-view obstruction artifacts
+ evidence lease/status checks
+ conflict algebra
```

The implementation target is `ActionOutcomeEnvelope`, scoped as a pure primitive in `@pm/agent-state`. This is not a verified three-axis solution yet. Axis B remains blocked until PluggedInSocial is restored/cloned or authoritative agency fixtures are accepted.

## Starting Ten Questions

These are the ten unanswered questions kept active at loop start.

1. What invariant prevents one stable action id from having both accepted and blocked terminal outcomes?
2. How should a substrate validate that an action's read/evidence set is still current at write time?
3. When local agent/tool/department views disagree, when should the substrate refuse a global projection instead of summarizing?
4. Which conflicts are safely mergeable, and which require authority-gated terminal outcomes?
5. What makes evidence current enough to support a write: `validUntil`, a lease, a status check, or something else?
6. How do evidence refs remain replayable instead of becoming uninspectable notes?
7. How can role projections serve different users without hiding invariant blockers?
8. How should agents execute multi-step plans without treating future steps as already valid?
9. Where is the boundary between AI proposal text and admitted operational mutation?
10. What proof lets an amnesiac agent resume from substrate state instead of chat?

## Peer-Reviewed Answers And Replacement Questions

| Eliminated question | Peer-reviewed answer | Bridge into pm-substrate | Replacement question |
| --- | --- | --- | --- |
| Q1: one terminal outcome per action id | Herlihy and Wing define linearizability as an operation appearing to take effect at one point between invocation and response. Winskel event structures model causality plus conflict between events. Together they imply terminal outcomes for one action id should be one conflict set with one linearization/admission point. | Add `ActionOutcomeEnvelope` with `actionId`, terminal outcome, evidence/proposal refs, hash, and a partition validator that rejects a second different terminal outcome for the same action id. | RQ11: Can terminal outcome partitioning be enforced across DB/runtime transports, not only pure arrays? |
| Q2: current read/evidence validation | Kung and Robinson's optimistic concurrency control lets private work proceed, then validates before commit. Cahill/Rohm/Fekete's serializable snapshot isolation detects dependency patterns that cannot fit a serial order. | Treat agent action as speculative until admission validates read set, evidence admissions, and status checks against current operational state. | RQ12: What minimal read-set metadata is required for all write-capable pm-substrate transports? |
| Q3: obstruction instead of summary | Abramsky and Brandenburger show compatible local sections may fail to glue into a global section; contextuality is an obstruction to global assignment. | Model role/tool views as local sections over a subject. If required overlaps disagree, emit `LocalViewObstructionArtifact`, not a synthesized summary. | RQ13: Which overlap fields are mandatory per domain profile and which can remain advisory? |
| Q4: mergeable vs authority-gated conflicts | Shapiro et al. formalize CRDT convergence for data types with mathematically safe merge rules. Dynamo exposes divergent versions and uses application-assisted reconciliation. | Introduce conflict classes: commutative, quotientable, freshness conflict, authority conflict, invariant violation, terminal-outcome conflict, missing evidence. | RQ14: Can conflict class be inferred from profile metadata, or must each capability declare it? |
| Q5: evidence currentness | Gray and Cheriton leases show time-bounded cache authority; Spanner's commit protocol uses bounded uncertainty around timestamps. Static `validUntil` is insufficient without status authority and checked-at semantics. | Evidence that supports writes needs decision-time currentness metadata: status authority, checkedAt, validity window, stale policy, and refresh requirement. | RQ15: Should evidence status checks be mandatory for high-consequence reads as well as writes? |
| Q6: replayable evidence refs | Buneman/Khanna/Tan distinguish where data came from and why it appears in a result. Event-sourced observability work shows logs become useful when event relationships and tracing metadata survive. | Keep evidence refs and substrate refs as typed objects, with content hashes where possible, so replay can reconstruct why an outcome was admitted or blocked. | RQ16: Which evidence refs need content-addressed hashes before they can support production writes? |
| Q7: role projections preserving blockers | Star and Griesemer's boundary objects preserve identity across social worlds while allowing local use. Transactive-memory measurement work treats role/source knowledge as a coordination object. | Role projections may adapt wording, but must preserve action id, subject, terminal outcome, evidence refs, and blocking conflicts. | RQ17: What projection-drift metric catches role-specific language that implies different allowed actions? |
| Q8: multi-step plans under changing state | Garcia/Prett/Morari's MPC survey describes repeatedly solving control actions from current state under constraints. The plan is recalculated as feedback arrives. | Use receding-horizon agent execution: observe current state, propose one next action, admit/hold/block, execute/receipt, refresh, then replan. | RQ18: How many steps ahead can pm-substrate safely cache before current-state refresh is required? |
| Q9: proposal vs mutation boundary | Schneider's state-machine approach makes service state a deterministic result of ordered requests; Clark-Wilson integrity policy separates well-formed transactions from arbitrary subject writes. | AI output is always a proposal. Mutation requires a substrate admission boundary with policy, evidence, workflow, and terminal outcome fields. | RQ19: Which existing pm-substrate capabilities still allow operational side effects without an outcome envelope? |
| Q10: amnesiac resume proof | Raft and state-machine replication use ordered committed logs as the source for recovery. LoCoMo shows long-context/RAG memory improves recall but still lags on long-range temporal/causal dynamics. | Resume should recover from action outcome envelopes, state-review artifacts, events, workflow state, and continuity checkpoints, not chat transcripts. | RQ20: What minimal proof packet lets a new agent explain a prior blocked action without prior chat? |

## Source Inventory

Peer-reviewed sources used for this run:

- Maurice P. Herlihy and Jeannette M. Wing, "Linearizability: A Correctness Condition for Concurrent Objects," ACM TOPLAS, 1990: https://dl.acm.org/doi/10.1145/78969.78972
- Glynn Winskel, "Event Structures," LNCS / Advances in Petri Nets, 1987: https://link.springer.com/chapter/10.1007/3-540-17906-2_31
- H. T. Kung and John T. Robinson, "On Optimistic Methods for Concurrency Control," ACM TODS, 1981: https://dl.acm.org/doi/10.1145/319566.319567
- Michael J. Cahill, Uwe Roehm, and Alan D. Fekete, "Serializable Isolation for Snapshot Databases," ACM SIGMOD, 2008: https://dl.acm.org/doi/10.1145/1620585.1620587
- Samson Abramsky and Adam Brandenburger, "The Sheaf-Theoretic Structure of Non-Locality and Contextuality," New Journal of Physics, 2011: https://doi.org/10.1088/1367-2630/13/11/113036
- Marc Shapiro, Nuno Preguica, Carlos Baquero, and Marek Zawirski, "Conflict-Free Replicated Data Types," SSS 2011: https://link.springer.com/chapter/10.1007/978-3-642-24550-3_29
- Giuseppe DeCandia et al., "Dynamo: Amazon's Highly Available Key-value Store," SOSP 2007: https://dl.acm.org/doi/10.1145/1323293.1294281
- Cary G. Gray and David R. Cheriton, "Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency," SOSP 1989: https://dl.acm.org/doi/10.1145/74851.74870
- James C. Corbett et al., "Spanner: Google's Globally-Distributed Database," OSDI 2012: https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett
- Peter Buneman, Sanjeev Khanna, and Wang-Chiew Tan, "Why and Where: A Characterization of Data Provenance," ICDT 2001: https://link.springer.com/chapter/10.1007/3-540-44503-X_20
- Luca Alongi et al., "Event-Sourced, Observable Software Architectures: An Experience Report," Software: Practice and Experience, 2022: https://onlinelibrary.wiley.com/doi/full/10.1002/spe.3116
- Susan Leigh Star and James R. Griesemer, "Institutional Ecology, `Translations' and Boundary Objects," Social Studies of Science, 1989: https://journals.sagepub.com/doi/10.1177/030631289019003001
- Kyle Lewis, "Measuring Transactive Memory Systems in the Field," Journal of Applied Psychology, 2003: https://doi.org/10.1037/0021-9010.88.4.587
- Carlos E. Garcia, David M. Prett, and Manfred Morari, "Model Predictive Control: Theory and Practice - A Survey," Automatica, 1989: https://doi.org/10.1016/0005-1098(89)90002-2
- Fred B. Schneider, "Implementing Fault-Tolerant Services Using the State Machine Approach," ACM Computing Surveys, 1990: https://dl.acm.org/doi/10.1145/98163.98167
- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy, 1987: https://ieeexplore.ieee.org/document/6234899
- Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm," USENIX ATC, 2014: https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
- Adyasha Maharana et al., "Evaluating Very Long-Term Conversational Memory of LLM Agents," ACL 2024: https://aclanthology.org/2024.acl-long.747/

## Bridge Hypothesis

An agent action becomes substrate state only when it is reduced to a unique terminal action normal form. The normal form must preserve the evidence/proposal refs needed for replay, reject stale or conflicting support for accepted writes, and expose local-view obstructions rather than hiding them in summaries or role projections.

## Falsification Criteria Before Coding

1. The same `actionId` can be both `accepted` and `blocked`.
2. A high-consequence accepted outcome can cite stale admitted evidence without being blocked.
3. Two incompatible local views can be summarized as a global projection.
4. A role projection can hide the blocking conflict or terminal outcome.
5. A new/amnesiac agent cannot recover the terminal outcome from substrate refs.

## Code Slice

Implement in `@pm/agent-state`:

- `ActionOutcomeEnvelope`
- terminal outcome partition validation
- high-consequence stale evidence blocking
- local-view overlap evaluation and obstruction artifacts
- role projection over the terminal outcome invariant core
- substrate-ref recovery helper

## Axis Status

| Axis | Status after this slice |
| --- | --- |
| Axis C local lab | Partially supported by pure primitive and existing `stale-observation` scenario; full dynamic run still depends on local Postgres/Ollama. |
| Axis A finance | Not fully verified in this slice; next step is ArrowHedge stale-risk/stale-price paired evals using `ActionOutcomeEnvelope` refs. |
| Axis B marketing | Blocked for full verification until PluggedInSocial is restored/cloned or authoritative agency fixtures are accepted. |

## Next Action Queue

1. Wire `ActionOutcomeEnvelope` into ArrowHedge state-review/write-binding fixtures.
2. Generate 30 scenario families across the ten failure classes and three axes.
3. Run paired Axis A baseline/substrate events with `pairedRunGroup`.
4. Decide whether Axis B uses a restored PluggedInSocial clone or accepted authoritative agency fixtures.
5. Add `EvidenceStatusCheck` and status-currentness replay cases.
6. Measure `token_cost_per_valid_admitted_action` against baseline, not only stale-action prevention.

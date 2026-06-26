# Failure-mode audit — staleness + authorization (2026-06-25)

Question (Emmanuel): for each stage we build, are we hunting the holes the
implementation's *logic* misses against its *objective* — scaffolding that
looks like the full logic but isn't, advisory-not-enforced gates, etc.?

Grounded in real code at `/Volumes/WD_BLACK/JoatLabs/pm-substrate`. Tests green:
`packages/graph/src/staleness*.test.ts` = 14/14.

## H1 — CRITICAL: freshness contract is exported but called by ZERO production code

`freshnessGate` / `requireFresh` / `StaleReadError` (graph/src/staleness.ts) are
the enforcement layer that fixes the 2026-06-18 advisory hole. Grep for real
callers (excluding tests, dist, the definition, and the index re-export):

```
freshnessGate|requireFresh|StaleReadError  ->  only packages/graph/src/index.ts (re-export)
```

So the contract is **built and unit-tested, but not yet wired into any
capability/workflow that authorizes action.** It is currently the same
"scaffolding that looks like full logic" pattern it was written to kill — just
one layer up. The defect from 06-18 (stale-but-agreeing decision goes
operational) is NOT yet closed in the live capabilities; it's only closeable.

Fix: at every action-authorization boundary that reads risk/dependency state
(start with `capability-finance-research-ingest` arrowhedge accept gate), replace
the read+act path with `requireFresh(readStalenessOf(node), MAX)` or branch on
`freshnessGate`. Until a production caller exists, the protection is theoretical.

## H2 — HIGH: the lab's "substrate refused" does not exercise the substrate's gate

`local-agent-lab/src/scenarios/stale-observation.ts admit()` decides staleness
inline: `stale = actedPos < headPos`. The taxonomy scenarios likewise carry
their own `refusedReason` and block inline. **None call `freshnessGate` /
`requireFresh`.** So the green A/B result (Arm A fail, Arm B blocked,
behaviorDiverged=true) proves *a* gate works — a gate the scenario reimplements —
not that the substrate's shipped contract works. The lab is currently a
behavioral mock of the gate, not an integration test of it.

Fix: route the lab's substrate-arm `admit` through the real
`freshnessGate`/`requireFresh` so the lab fails if the contract regresses. That
turns the lab from "proves the idea" into "proves THIS code."

## H3 — MEDIUM: enforcement guard only catches floating bare `isStale(` statements

`staleness-enforcement.test.ts` flags lines that START with `isStale(`. It will
NOT catch the more likely real regression:
- `const stale = isStale(s, MAX);` then later code ignores `stale` — passes the guard, still advisory.
- ad-hoc inline math `Date.now() - new Date(node.updatedAt).getTime() > MAX` that never calls `isStale` at all — invisible to the guard.
- a caller that computes `freshnessGate(...)` and then ignores the denied branch (TS won't force the branch unless the denied type has no usable value path the caller touches).

The guard reduces one regression shape; it does not enforce "every action-auth
read is gated." That requires the positive form: a lint/type rule that an
action-authorizing read MUST flow through the contract. Stronger move: make the
read API itself return a type that cannot authorize action without passing
through `freshnessGate` (capability-by-construction), not a convention a guard
polices after the fact.

## H4 — MEDIUM: `requireFresh` throws, but no dead-letter path is wired

The doc-comment says a thrown `StaleReadError` "should propagate to the
dead-letter path (non-retryable)." No production code catches/classifies it yet
(see H1 — no caller at all). When H1 is wired, verify the workflow runtime
treats `StaleReadError` as non-retryable, or KeepAlive/retry loops will hammer a
read that can never become fresh.

## H5 — LOW: clock injection good in helpers, absent at the boundary

`readStalenessOf` takes an injectable `clock` (good — testable, deterministic).
But the eventual production callers will likely call with the default
`new Date()`, reintroducing wall-clock nondeterminism and clock-skew exposure
the `Math.max(0, …)` clamp only partially hides (future-dated rows read as
age 0 = "perfectly fresh", which is wrong — a future timestamp is a data fault,
not freshness). Consider: future-dated `updatedAt` should be a `missing_read`/
fault, not silently clamped to fresh.

## What "checking for failure modes at each stage" should mean (process)

For each stage S we ship, before calling it done:
1. State S's objective in one line (what reality quality it enforces).
2. Name the scaffolding-vs-logic gap: is the logic CALLED by something real, or only defined+tested? (H1 is this gap.)
3. Name the advisory-vs-enforced gap: can a caller compute the check and ignore it? (H3.)
4. Name the mock-vs-integration gap: does the proof exercise THIS code or a re-implementation? (H2.)
5. Name the failure-propagation gap: when it refuses, where does the refusal go? (H4.)
6. Adversarial input: clock skew, future dates, missing reads, concurrent writes. (H5.)

This audit IS step-each for the staleness stage. Authorization
(ActionOutcomeEnvelope / proposal-review gate) needs the same pass next.

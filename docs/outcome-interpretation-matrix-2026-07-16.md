# Proposed outcome-interpretation matrix (preregister before the first run)

**Status: PROPOSED.** This matrix binds nothing until its exact bytes are
anchored via `pnpm witness:anchor` (Rekor / public git tag / OSF) **before the
first behavioral cell executes** — including the qualification triplet. Its
entire value is that the interpretation of every possible result pattern is
fixed in advance; written after seeing data, it is worthless (external review
2026-07-15: "Preregister, in advance, which result pattern counts as a product
win versus a claim-narrowing").

## Arms and notation

`N` = native (no durable state) · `H` = sham (full ledger write, neutral
constant read — the placebo) · `K` = plain durable KV (persistence without
governance) · `S` = substrate (`PostgresContinuityLedger` with the full
boundary).

"`>`" below means the preregistered paired, task-clustered comparison at the
preregistered effect size (Holm over control comparisons, task bootstrap,
positive lower bound), on the endpoint structure of
[`state-effect-endpoint-amendment-2026-07-15.md`](./state-effect-endpoint-amendment-2026-07-15.md)
(strict-score non-inferiority guard, then state-effect superiority). "≈" means
the comparison does not reject. Economics caps apply to every pattern; an
economics breach makes any "win" pattern report as capped, not won.

On **qualification and procedural-holdout data these interpretations are
directional only** (the phases are non-confirmatory by protocol and can
authorize nothing); on a powered confirmatory run they are binding.

## The matrix

| # | Pattern | Reading | Consequence |
|---|---|---|---|
| P1 | `S > max(N,H)` **and** `S > K` | Substrate-specific benefit beyond generic persistence — the only pattern that supports the full product claim | Claim survives as preregistered; proceed toward D7 eligibility machinery |
| P2 | `S ≈ K > max(N,H)` | "Give the agent any durable persistence" — durable state helps; the substrate's governance adds nothing measurable *on these tasks* | Claim **narrows**: the benefit belongs to durable state, not to the substrate. Not hidden, not spun. The substrate must then win where K structurally cannot (integrity verification, tamper recovery, multi-agent conflict, scoped identity) — dimensions the current Sentinel tasks mostly do not exercise. Consequence: re-aim at tasks that exercise them or accept the narrowed claim. *(The external review predicts this is the most probable Sentinel outcome.)* |
| P3 | `K > S ≳ max(N,H)` | Persistence helps but the substrate's mediation costs outcomes relative to raw persistence | Claim narrowed severely; a raw-verified `S`-vs-`K` behavioral deficit is an Arrowsmith trigger (smallest general repair, ablation, exact rerun) |
| P4 | `S ≈ K ≈ N ≈ H` | State persistence does not move these tasks at this power | Honest null. Kill the claim on this benchmark or re-aim; do not add repeats to chase it (perfectly correlated repeats add no information) |
| P5 | `S < max(N,H)` on the strict-score guard | Substrate blocked its way to fewer completions | **Claim dead on this benchmark** at this step; no state-effect result can rescue it (fixed-sequence order). Arrowsmith only if the deficit traces to a raw-verified substrate behavioral failure, not a harness defect |
| P6 | `H` materially ≠ `N` (either direction) | The placebo moved outcomes — the equal-overhead design leaked something | **Instrument finding, not a claim finding.** Halt outcome interpretation; investigate arm-blinding/timing/context leaks; no pattern above may be read until the leak is explained and closed |
| P7 | `S > max(N,H)` but `S ≈ K`, with `K` breaching economics caps while `S` stays within | Substrate matches raw persistence at bounded cost | Narrowed efficiency claim only if preregistered as such before the run; otherwise report as P2 |

Ambiguity rule: if more than one row matches, the **least favorable matching
row wins** (P6 dominates all; then P5, P4, P3, P2, P7, P1). No post-hoc
subgroup, task-family, or repeat-level re-slicing may promote a pattern to a
more favorable row; predeclared corner analyses may only demote.

## What this matrix does not do

It does not change endpoints, thresholds, guardrails, eligibility literals, or
decision authority (hard requirement 11: automation may at most report
conditional eligibility; an authenticated owner separately authorizes any
consequence). It only removes the freedom to reinterpret patterns after seeing
them.

## Adoption

1. Owner reviews rows P1–P7 and the ambiguity rule; edits are free until
   witnessing.
2. `pnpm witness:anchor -- --label interpretation-matrix docs/outcome-interpretation-matrix-2026-07-16.md`
   plus tag push / OSF, **before** the excluded smoke.
3. Referenced from the next plan version alongside the endpoint amendment.

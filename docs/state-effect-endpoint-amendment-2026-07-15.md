# Proposed analysis-plan amendment: strict score as guard, state effect as claim

**Status: PROPOSED.** This document is a draft amendment, not a
preregistration. It binds nothing until it is written into the next plan
version, its exact bytes are anchored via `pnpm witness:anchor` (Rekor / public
git tag / OSF) *before* any confirmatory execution, and the owner authorizes
that plan version. It reads no benchmark outcome and cannot authorize a run.

## Why (the D6-B observation)

In the ToolSandbox derivative, native and sham duplicated the target side
effect while substrate blocked the duplicate — and Apple's strict score was
**1.0 in every arm**. Strict task completion is structurally blind to
collateral-state damage, which is precisely the dimension pm-substrate claims
to improve. Under the current headline endpoint ("complete more of the
benchmark's own tasks"), honest nulls are the likely output of the program even
where the mechanism works (external review 2026-07-15; the status doc's own
step-2 note already says the duplicate-send blind spot "requires a separate
state-effect metric").

STATE-Bench can see this class of benefit: its deterministic scorer for
state-mutating tasks compares the final environment state to ground truth, so
a duplicated write *is* a scored failure there (verified against the Microsoft
announcement and upstream docs). ToolSandbox cannot, without a derived metric.

## The amendment

Replace the single primary endpoint with a fixed-sequence pair, both computed
from the benchmark's own environment and both preregistered with exact
thresholds before execution:

1. **Non-inferiority guard (tested first): the benchmark's unchanged strict
   score.** Substrate must not block its way to fewer completions: the paired
   task-level strict-score deficit of substrate versus **each** of native and
   sham must be bounded by a preregistered non-inferiority margin
   `delta_NI` (one-sided, per control). If the guard fails, the claim is dead
   at this step; no state-effect result can rescue it.
2. **Superiority claim (tested only if the guard passes): a preregistered
   state-effect endpoint derived from benchmark-owned environment state.**
   - STATE-Bench: the official deterministic final-state comparison already
     is this endpoint; no derived metric is needed.
   - ToolSandbox/Sentinel: a collateral-state-effect count defined over the
     environment's own message/state log (e.g., duplicated externally visible
     side effects per task), specified by exact query *before* the run.
   Substrate must beat **max(native, sham)** at the preregistered effect size
   with the same paired, task-clustered machinery the plan already uses (Holm
   over the two control comparisons, task bootstrap, positive lower bound).

Fixed-sequence (gatekeeping) testing means the pair spends no extra alpha:
endpoint 2 is tested at full level only when endpoint 1 passes.

## What this amendment does NOT change

- **Oracle independence (hard requirement 8).** The state-effect endpoint is
  computed from the benchmark's environment records, never from the substrate
  gate predicate, its events, receipts, or blocks. If the endpoint cannot be
  computed without importing the gate's view of the world, it is invalid.
- **Anti-degenerate controls (hard requirement 10).** A block-all mutant must
  fail the guard; an allow-all mutant must fail the superiority endpoint;
  expected-allow and no-op controls stay mandatory.
- **Economics caps.** The ≤$10/≤300s absolute and ≤1.25× per-control caps are
  untouched.
- **Eligibility machinery.** All producer schemas keep literal-`false`
  eligibility; this amendment changes what *would* be claimed, not when a
  claim becomes possible.

## Open parameters (owner decisions at preregistration, not defaults)

- `delta_NI`, the non-inferiority margin: set from qualification-phase
  variability, not invented; a margin wider than the qualification-observed
  standard error of the paired strict-score difference needs written
  justification.
- The exact state-effect query per adapter (STATE-Bench needs none).
- The preregistered state-effect effect size and its power calculation —
  which must survive the same audit machinery that rejected the 19×3/0.10
  declaration, at the pilot ICC's upper confidence limit.

## Order of adoption

1. Phase 3 qualification + procedural holdout runs complete (non-confirmatory)
   and yield the empirical repeat ICC.
2. This amendment is finalized with the open parameters filled in, written
   into the next plan version, and its bytes witnessed externally.
3. Only then may a powered confirmatory run be scheduled against it.

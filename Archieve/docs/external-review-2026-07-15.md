# External validation review — 2026-07-15

*Transcribed into the repo from the received copy (encoding artifacts in the
transport repaired; content otherwise verbatim). The point-by-point
verification and the response plan are in
[`external-review-response-2026-07-15.md`](./external-review-response-2026-07-15.md);
the adopted plan and disagreements are recorded as `decision` checkpoints in
the continuity ledger.*

Independent review of the pm-substrate public-benchmark validation program, produced by
four separately tasked reviewer agents plus cross-checks: (A) an adversarial fabrication
audit of the Sentinel production harness (executed the test suites, read the full runner
and verifier), (B) an evidence/ledger cross-check that recomputed every claimed hash and
partially re-executed the power replay, (C) a methodology + direction critique with web
verification of the benchmarks, and (D) a second, independent fact-check of (C)'s
benchmark-source claims against primary sources. Scope: branch
`joatakinwale/public-benchmark-validation` including the uncommitted working tree, the
live continuity ledger, ROADMAP.md, docs/objective-falsification.md, and
docs/public-benchmark-status-2026-07-13.md.

---

## 1. Anti-fabrication audit — the agents are not faking the work

**Verdict: CLEAN, with named trust seams to fix before eligibility ever opens.**

- **The harness cannot report success at all today.** Every
  `evidenceEligible`/`materialBenefit`-class field in the producer schemas is a
  literal-`false` TypeScript type; the raw batch verifier hard-codes `valid: false` on
  every structurally complete path ("…not a valid proof until an independent post-run
  witness binds the exact block/cell/raw heads"), and the verifier CLI always exits
  non-zero. A harness that is structurally incapable of going green cannot be faking
  green.
- **No escape hatches found.** No env var, flag, or fallback flips eligibility; all
  traced failure paths are fail-closed (partial block → all four cells failed, no
  retries; service-stop failure → `infrastructureComplete: false`; verifier throw →
  invalid empty result). Outcome smuggling is denylisted and tested
  (`FORBIDDEN_OUTCOME_KEYS` + serialization test).
- **The sham arm is a true placebo, not a strawman.** `sham` performs the full
  `PostgresContinuityLedger` write + chain verification identically to `substrate`; the
  only difference is at read (`visibleState` returns a byte-identical neutral constant).
  All arms get the same 512-char neutral first-read context, fixed-width summaries,
  padded responses, and release exactly at the 250 ms deadline so latency cannot leak
  the arm; the agent never receives arm identity (asserted in tests).
- **Evidence artifacts verified by recomputation, not trust.** The power-redesign
  canonical audit hash `9c5a9bc6…` was independently recomputed — exact match; the
  50-task catalog manifest `48e1695b…` was independently recomputed from the documented
  formula — exact match (50 tasks; 19 relative / 21 absolute / 10 no-op; upstream
  scenario hash spot-checked against the pinned `sentinel_environments@0faca33c`
  checkout); **3 of the 56 power cells were re-executed from scratch and reproduced
  exactly**; the "frozen bytes" of commit `707cb…` are byte-identical to the working
  tree; commit messages match their diffs (no aspirational messages).
- **No efficacy overclaim anywhere.** Grep sweeps for
  proves/outperforms/lift/efficacy/material-benefit across docs, READMEs, and packages
  find only negations and gate definitions. "Completed replacement cells: 0" is
  consistent with disk (no result artifacts exist). D6-B is uniformly framed as a
  bounded mechanism result plus an oracle blind spot, not task-level efficacy. The
  written record **systematically under-claims** relative to the artifacts — the rare
  direction for the error to run.
- **Tests are real where it matters.** Real git subprocesses (including a hostile
  PATH/git-config attack test that passes), real Postgres under SERIALIZABLE, real
  loopback HTTP and SIGKILL crash-children, real SHA-256 over real bytes with
  double-traversal TOCTOU checks, real permission sealing; the raw-verifier CLI test
  spawns the actual subprocess. The runner unit tests stub services via the DI seam but
  the runner's own orchestration (fs, hashing, manifest chains) runs for real, and those
  services have their own real tests.

**Trust seams (documented, not hidden — but they become live the moment `valid` stops
being hard-coded `false`):**

1. The external-commitment observation is fetched and retained by the **producer**; the
   raw verifier replays retained bytes and never re-fetches. A producer could fabricate
   the observation body; only a human dereferencing the preserved locator would catch it.
2. Custodian/authority "independence" is string comparison on self-declared owner IDs.
3. `analyzeSentinelRawMeasurements` accepts caller-supplied
   `powerArtifactExternallyVerified`/`economicsArtifactExternallyVerified` booleans; the
   in-repo caller pins them `false`, but nothing stops a different caller.
4. `describe.skip` silently drops all continuity-arm sidecar tests when
   `PM_DATABASE_URL` is absent — a silent coverage gate.
5. The "independent 56-cell replay" is independent **implementation** (Python stdlib
   re-implementation), not an independent **party**: same agent pipeline, same commit,
   same machine. N-version redundancy, not third-party verification. The docs' own
   requirement #11 already refuses to let such labels carry decision authority, but the
   word "independent" invites over-reading.

**State-of-work finding — the working tree is RED.** 18 test failures across 2 files
from an in-flight schema migration: the runner-test fixture still builds a **v2**
runtime closure while `sentinel-production-plan.ts` now demands the v3 closure
(14-key git block) — 15/16 runner tests fail; and `sentinel-production-raw-runtime.ts`
still expects artifacts schema **v3** while the closure/evidence now emit **v4** — so a
batch produced by the new runner would currently be **rejected by its own raw
verifier**. Fail-closed and loud, not fabrication — but the branch is not green, and
repo rules require reverting to green or fixing before anything else.

Other hygiene: ledger checkpoints 1435/1436 are duplicate open decisions (1436, the
"Supersedes the immediately prior shell-truncated summary" one, is operative); 1435
should be closed to clear the standing contradiction flag. `parseBlockManifest`
discards its `expectedRuntimePrevious` parameter (dead; the chain is enforced
elsewhere). Stage-gate applications and procedure admissions both show **zero**
recorded activity — that slice of "governance as API" is still unexercised.

---

## 2. The evaluation methodology — strong design, partly the wrong battlefield

**Benchmark realness — verified twice against primary sources.**

- **ToolSandbox** (Apple): real ([arXiv 2408.04682](https://arxiv.org/abs/2408.04682),
  [apple/ToolSandbox](https://github.com/apple/ToolSandbox)); the cellular/message
  state-dependency scenario is the benchmark's canonical hardest category; usage here
  matches its documented purpose, and the derivative (lost tool response + SIGKILL) is
  scrupulously labeled derivative.
- **STATE-Bench** (Microsoft): real
  ([microsoft/STATE-Bench](https://github.com/microsoft/STATE-Bench), announced
  2026-05-19), 450 tasks, Agent Learning Track with 150 held-out test tasks, official
  pass@1/pass^5 protocol. Two caveats: it is ~2 months old with no external results
  history yet, and — importantly — the claimed "exact external blocker"
  (`STATE_BENCH_EVAL_ENDPOINT/DEPLOYMENTS/API_KEY`) is **self-provisionable**: the
  locked GPT-5.4 evaluator is a deployment you rent. That is a funding/setup task, not
  an external gatekeeper; the status doc's framing quietly overstates it.
- **SentinelBench** (Microsoft Research): real
  ([arXiv 2606.05342](https://arxiv.org/abs/2606.05342),
  [microsoft/sentinel_environments](https://github.com/microsoft/sentinel_environments),
  110 scenario JSONs across 10 micro-environments; 20 no-op tasks; `speed_factor` max
  4.0; 720 s timeline; **no paper agent in the release** — the ledger got all of this
  exactly right, including the speed-4 falsification).
- **Framing inflation to fix:** "real, publicly documented agent-state failure
  scenarios" suggests documented production incidents. What exists is purpose-built
  synthetic benchmarks whose papers document that agents exhibit state failures on
  them. Honest phrasing: "public benchmarks designed to expose agent-state failure."
  The detail-level evidence handling is more honest than the headline phrase.

**Design assessment.**

- The four-arm structure (native / sham / plain-KV / substrate) is near
  publication-grade; sham kills the overhead confound and plain-KV is the killer
  control, honestly boxed (`includedInPrimaryNativeShamClaim: false`; a tie "narrows the
  claim; it is not hidden"). The primary claim requires substrate > max(native, sham)
  with economics caps (substrate ≤ 1.25× both controls).
- **But the most probable Sentinel outcome is `substrate ≈ plain-KV > native ≈ sham`** —
  i.e., "give the agent any persistence." Sentinel tasks are single-agent monitoring
  tasks; the dimensions where substrate should beat plain KV (integrity verification,
  multi-agent conflict, tamper recovery, scoped identity) are mostly not exercised
  there. Preregister, in advance, which result pattern counts as a product win versus a
  claim-narrowing.
- **Power:** rejecting the 19×3 / true-lift=0.10 declaration was mathematically correct
  (you can never have 80% power to observe ≥ δ when the true effect is δ) but
  foreseeable at design time. The remaining blocker — cover ICC 0.25 and 1 — is
  **unsatisfiable as stated**: at ICC = 1 repeats carry zero information, and 19 binary
  paired clusters cannot detect even 0.35 through max-of-two-controls + Holm +
  bootstrap at 80% power. No prose justification fixes this; data does. The standard
  answer is an **internal pilot**: the qualification triplet and the frozen 12-task
  procedural holdout — which the protocol already permits running — yield an empirical
  ICC estimate; sign the power calculation at estimated-ICC-plus-margin.
- **D6-B is the program's most important finding and its deepest risk.** Substrate
  blocked a duplicate side effect; Apple's strict score was 1.0 in every arm. Strict
  task completion is structurally blind to collateral-state damage — precisely the
  dimension pm-substrate improves. If the north star stays literally "complete more of
  the benchmark's own tasks," honest nulls are the likely output of the entire program.
  STATE-Bench's deterministic scorer **compares final environment state to ground
  truth** (verified from the primary source) — a duplicated write there *is* a scored
  failure. Amendment to make: benchmark strict score as a **non-inferiority guard**
  (substrate must not block its way to fewer completions) plus a preregistered
  state-effect endpoint as the **superiority claim** — both computed from the
  benchmark's own environment, keeping oracle independence intact.
- **Verification machinery is over-engineered by roughly an order of magnitude** for
  the evidence stakes. What convinces a skeptical outsider: third-party-timestamped
  preregistration (OSF / public git tag / Sigstore Rekor — free, an afternoon), pinned
  upstreams, published raw logs, one-command replay, one independent person re-running
  it. Ed25519 receipt chains signed inside an ecosystem one person controls add near
  zero external credibility — the D7 notes admit this. Use an existing external
  witness; do not build a witness service.

---

## 3. Objective and direction — the rigor is real; instrument worship is now dominant

The falsification-first posture is genuinely exceptional: pre-outcome self-falsification
of the adapter-owned-memory design, the speed-4 unreachability, the no-op liveness hole,
and the program's own invalid power declaration — plus a run register that preserves
every failure. Nothing smells of result-cooking. That is the strength.

The imbalance is the weakness, and it is stark:

- **Zero behavioral outcome observations across the entire program**, after ~153 ledger
  checkpoints (all created in an eight-day sprint), 36 standing decisions, and 46
  lessons. All 7 open work items are "Execute X"; recently *closed* items are all
  hardening items.
- The four `public-eval-*` packages total **~85–92k lines of TypeScript** — larger than
  the 85k-line provenance tower this repo excised as its named failure mode. The
  treatment under test (`packages/continuity`, the `PostgresContinuityLedger`) is
  ~2.1k lines: an instrument-to-treatment ratio of roughly **43:1**. The product core
  (`agent-state-core`) is ~8–11k lines; the measurement apparatus is ~7–8× the product.
- The tower **already regrew once this month** ("Excise packages/agent-state:
  unconsumed 85k-line tower regrowth," closed 07-11), and the live DB still carries 119
  `agent_state` tables. The growth habit has migrated from provenance formalism to
  verification formalism. By hard requirement 6's own standard — every primitive needs
  a runtime consumer — verifier machinery whose only consumer is an experiment that has
  never run is ceremonial consumption.
- The experiment has been blocked at various points by **API credits (429
  insufficient_quota)** and by **self-provisionable Azure credentials** — hundreds of
  dollars — while thousands of engineer-hours flowed into verifier hardening. That is
  the sharpest opportunity-cost signal in the repo.

**Recommendations, in order:**

1. **Fix or revert the red working tree first** (repo rule): migrate the runner-test
   fixture to the v3 closure and the raw verifier to artifacts v4 so producer and
   verifier agree, and get the branch green.
2. **This week, run what the protocol already permits:** the MicroHub qualification
   triplet + the frozen 12-task procedural holdout, all four arms, 3 repeats, speed 1.
   ~180 cells ≈ 36 sequential hours (parallelizable), roughly **$200–600** at the
   paper's own per-task economics. Explicitly non-confirmatory under the repo's rules.
   Yields the program's first behavioral data, real-world harness debugging, and the
   **empirical ICC that dissolves the power blocker**.
3. **External witnessing in an afternoon, not a milestone:** OSF registration or public
   git tag + Sigstore Rekor entry of the preregistration hash before the run and the
   raw-root hashes after. Cancel the custom raw-head witness service.
4. **Fund and run the ToolSandbox non-scripted triplet** — the blocker is literally API
   credits.
5. **Re-aim the powered confirmatory at STATE-Bench** (150 held-out tasks, official
   pass^5, deterministic final-state scoring that can actually see the D6-B class of
   benefit); demote Sentinel to qualification + corner battery, which is all its
   19-relative-task universe can statistically support.
6. **Standing rule until the next outcome cell completes: no new verification code.**
   The gating test for any future verifier feature: did a completed run's failure, or a
   named external skeptic, demand this check? If neither, it doesn't get built.
7. Hygiene: close ledger checkpoint 1435 (superseded duplicate); fix the "publicly
   documented failures" phrasing; note that stage-gate/procedure-admission governance
   paths have zero recorded activity while "Governance is friction for humans, API for
   agents" is the claim under test.

**Bottom line.** The validation agents are not faking the work — the audit found the
opposite failure mode: machinery so honest it cannot yet say anything at all. The
objective is falsifiable and the control design is excellent, but the headline outcome
measure (strict completion) likely cannot express the product's value while STATE-Bench's
state-diff scoring can. The program's credibility problem is no longer rigor; it is that
after two falsified designs and ~90k lines of instrument, it has produced zero data
while its remaining blockers are mostly self-imposed or purchasable. Run the experiment.

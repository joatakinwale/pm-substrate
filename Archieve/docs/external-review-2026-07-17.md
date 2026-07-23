# External re-review and capstone experiment design — 2026-07-17

Follow-up to [`external-review-2026-07-15.md`](./external-review-2026-07-15.md).
Method: a three-agent recheck (delta-since-review verification, adversarial review of
the new dashboard page, full CI-gate run) plus an adversarial statistical/thesis-committee
critique of the proposed experiment design. Every factual claim below cites file:line or
a command output captured this session.

---

## Part 1 — What changed since 07-15, verified

**The 07-15 concerns were not addressed in code.** Per-file diffstat counts for all nine
modified Sentinel sources are identical to review time (totals 1617+/727− across 9
files), and line-level inspection confirms both defect classes unchanged:

- **Defect A (closure v2 vs v3).** The fixture in
  `packages/public-eval-corners/src/sentinel-production-runner.test.ts:91-92` still
  builds `closureSchemaVersion: "…sentinel-runtime-closure.v2"` while
  `sentinel-production-plan.ts:1246-1250` demands the 14-key `runtime.git` block and
  `:1411-1413` requires the `…v3` schema/derivation strings. Effect: 15/16 runner tests
  fail (`runtime.git keys are not exact`), and the same migration breaks 5 tests in
  `sentinel-production-plan.test.ts` (plan verification returns `valid: false` on
  v2-shaped fixtures) — visible only in a full-suite run.
- **Defect B (artifacts v3 vs v4).**
  `sentinel-production-raw-runtime.ts:285` still accepts only
  `…runtime-closure-artifacts.v3` while `sentinel-runtime-closure.ts:158` emits and
  `sentinel-production-runner-evidence.ts:351` requires `…v4`. Effect: 3/23 closure
  tests fail, and a batch produced by the current runner would be **rejected by its own
  raw verifier**.

**The only new work is a dashboard "Validation Review" page**:
`packages/substrate-dashboard/src/review-report-page.ts` (686 lines) +
`review-report-page.test.ts`, routed via `main.ts` (+10/−2: new `"review"` view, nav
link, mount branch). Nothing else changed: no new evidence/run artifacts anywhere, and
the continuity ledger has **zero checkpoints since the 07-15 handoff** (still 155; the
duplicate open decision at seq 1435/1436 is still unresolved). A regenerated
`__pycache__` shows the Python power verifier was re-run locally — benign.

## Part 2 — Gate-by-gate verification (run this session)

| Gate | Result |
|---|---|
| `pnpm build` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm validate-contracts --strict` | PASS |
| `pnpm validate:budgets` | PASS |
| `pnpm validate:zero-edit` | PASS |
| `pnpm validate:arrowsmith-primitives` | PASS |
| `PM_DATABASE_URL=… pnpm test` (full suite) | **FAIL — 24 failed / 1409 passed / 21 skipped across 151 files** |

The 24 failures decompose exactly: 15 (runner.test, Defect A) + 5 (plan.test, Defect A
blast radius) + 3 (runtime-closure.test, Defect B) + 1 flake —
`production-state-sidecar.test.ts` "survives SIGKILL after an acknowledged plain-kv
write" timed out at 5022 ms against a 5000 ms budget under full-suite load; it passed in
isolation on 07-15 and is a timing margin, not a correctness regression (raise
`testTimeout` for that case).

**Readiness verdict: NOT ready to execute the experiment.** The repo's own rule is
"commit everything green." Fix recipe (2–4 days, already mid-flight in the working
tree):

1. Migrate the runner.test and plan.test fixtures to closure v3 (add the 14-key
   `runtime.git` block; update schema/derivation strings).
2. Update `sentinel-production-raw-runtime.ts` to accept artifacts v4 (the producer
   side is the newer, stricter side; the verifier catches up), with its tests.
3. Raise the sidecar SIGKILL test timeout (5 s → 15 s).
4. Re-run the four files, then the full gate suite; commit green.
5. Ledger hygiene: close/supersede decision seq 1435 (the shell-truncated duplicate of
   seq 1436) to clear the standing contradiction flag.

## Part 3 — Review of the new dashboard page

Verdict: **security-clean and honest; one architectural defect.**

- Sound: all interpolation sinks pass through `esc()` (escaping verified by a real
  `<script>`-payload test); no fetches, no file reads, no parameter-driven paths;
  routing whitelists literal hashes; badge classes are typed unions, the rubric bar is
  clamped; 7/7 tests pass and package `tsc --noEmit` is clean; `mountReviewReport` is
  genuinely routed (`main.ts:5, 127, 318-322`); content does not overstate evidence
  (fabrication verdict scoped, "Outcome evidence produced" scored 10/100, overall
  56.2% with "no eligible outcome data exists yet").
- **Defect (architectural):** the entire report is a hardcoded `REVIEW_REPORT` const
  (`review-report-page.ts:75-466`) compiled into the bundle — not derived from the
  admitted log (self-admitted at `:9-10`, `:464`). A frozen point-in-time narrative on
  a live dashboard will silently go stale: it asserts "the working tree is currently
  red" (`:89`, `:297-301`) forever, and `generatedAt` (`:76`) is never rendered — the
  header date is hardcoded at `:582`. This is the exact hand-maintained-prose drift the
  report itself warns about (FP-7).
- Recommendations: admit the review as a ledger artifact and render via the server
  proxy (substrate-native), or at minimum render `generatedAt` from the payload and add
  a prominent "snapshot as of <date>" banner; strengthen the cosmetic
  `"efficacy proven"` absence test (`test:34`) with a positive machine-checkable
  assertion; note the page ships trust-seam details on an unauthenticated `0.0.0.0`
  dashboard (pre-existing posture, but now with more disclosure).

## Part 4 — Capstone experiment design (critic-hardened)

The design below was adversarially reviewed by a statistics/PM-committee critic; its
corrections are incorporated. The prior draft's non-inferiority co-primary (5 pp margin,
n=150: power 0.28 — decorative), Holm-across-primaries structure, 3-cluster bootstrap,
2–3-week Stage-2 timeline, and $500–1000 budget did **not** survive review.

### Thesis framing: Design Science Research

Frame the thesis as **Design Science Research** (Hevner; Peffers' DSRM). Artifact: a
PM-state governance substrate (admission-gated continuity ledger). Theory grounding a PM
committee expects: **agency theory** (the AI agent is a literal agent; the admission
gate is a monitoring/bonding mechanism — derive H1 from it), **organizational control
theory** (Ouchi; Kirsch — the substrate is formal behavior control; sham vs substrate is
outcome- vs behavior-control), **stage-gate theory** (Cooper), **project governance**
(Müller; ISO 21505; PRINCE2 management-by-exception). Evaluation strands:

1. **Instrument-qualification pilot** (Sentinel) — reportable regardless of direction;
2. **Confirmatory benchmark strand** (STATE-Bench) — one chapter, not the load-bearing
   wall;
3. **Dogfood case study** — the project's own 155-checkpoint hash-chained ledger,
   analyzed as a *coded case study* (code the decision/lesson checkpoints; show
   governance events altering the project trajectory), not cited as a count.

Three findings are **already banked** and publishable regardless of any future result:
the falsified adapter-owned 27-cell design, the falsified 19×3 power declaration, and
the ToolSandbox strict-score blind spot (substrate blocked a duplicate side effect;
oracle scored 1.0 in all arms). With preregistered manipulation checks (below), the
thesis cannot be sunk by a null.

### Stage 0 — Readiness (2–4 days)

Fix Defects A/B; all gates green; commit. Close ledger seq 1435. Freeze the protocol
document. **OSF-preregister** the Stage-1 protocol (hash of protocol + frozen analysis
script); public git tag. No custom witness service — external witnessing via OSF/tag
(optionally a Sigstore Rekor entry) only.

### Stage 1 — Pilot / instrument qualification (~1 week, ~$200–900)

Sentinel MicroHub relative/absolute/no-op triplet + the frozen 12-task cross-application
procedural holdout; 4 arms (native / sham / plain-KV / substrate) × 3 repeats, speed 1,
block-randomized. Preregistered as non-confirmatory. Outputs: first end-to-end outcome
data; empirical ICC and variance estimates; collateral/cost/latency distributions;
harness debugging against reality. Wall clock: up to ~36 h serial at speed 1 (720 s
timelines) — plan for it. Cost ceiling per the repo's own economics: $10/cell hard cap.

### Stage 2 — Confirmatory strand (STATE-Bench Agent Learning Track)

**Why STATE-Bench:** 150 held-out test tasks; a deterministic scorer compares final
environment state to ground truth for stateful tasks — it can *see* the
collateral-state benefit that ToolSandbox's strict score is blind to; official
pass@1/pass^5 protocol (`--num-runs 5`).

**Honest scale.** The repo's own D6-C status says the instrumented executor for
official runs does not exist yet ("No official trajectory has run"); building the full
raw-evidence executor is 2–4 weeks alone, and full confirmation (150 tasks × 3 arms ×
5 runs = 2,250 trajectories at ~$1–3 all-in each) is **$2.3k–6.8k** plus pilot and
qualification. Two preregistered variants — pick one *before* Stage 1 ends:

- **Full program:** 9–14 weeks, ~$4–10k total, all three domains, 3 arms (plain-KV as
  a 4th if budget allows).
- **Descoped thesis variant (recommended for a solo capstone):** one preregistered
  domain (50 tasks × 3 arms × 5 runs = 750 trajectories, ~$1–2.5k, ~6–8 weeks total
  program), executed at *conformance grade* (upstream runner + sidecar, OSF-registered)
  with the power consequence stated up front: minimum detectable paired lift ≈ 17 pp;
  explicitly labeled pilot-grade confirmation.

**Analysis structure (serial gatekeeping — not NI + Holm):**

- **Primary:** deterministic state-correctness superiority, substrate vs **both**
  controls (intersection-union: substrate must beat native AND sham, each paired test;
  simultaneous bootstrap interval against the in-draw maximum control — copy the
  Sentinel rule from `docs/objective-falsification.md` verbatim), at full α=.05.
- **Guardrail (not a powered test):** pass@1 strict completion reported as a paired
  difference with 95% CI; preregistered harm flag if the CI lower bound is below
  −10 pp. (A powered 5 pp non-inferiority test needs n≈628 pairs; n=150 gives power
  0.28 — do not pretend otherwise.)
- **Secondary:** substrate vs plain-KV (attribution: governance beyond mere
  persistence; a tie is preregistered claim-narrowing); pass^5 reliability; cost and
  latency per strict success (the most PM-native numbers — feature them); ledger
  blocked-action analysis (diagnostic only).
- **Statistics hygiene:** domain is a fixed stratum (CMH-style stratified McNemar or
  domain fixed-effects conditional logistic) — a cluster bootstrap over 3 domains is
  void. Discordance/power assumptions updated from the STATE-Bench *qualification
  (train) phase*, not from Sentinel pilot ICC (it does not transfer). State the
  minimum detectable effect prominently (≈9.8 pp at 20% discordance, n=150; ≈17 pp at
  n=50) and pre-commit the interpretation of a null in the dead zone.
- **Manipulation checks (preregistered, gating):** retrieval occurred; retrieved
  learning relevance; trajectory cites retrieved content. These make any null
  interpretable ("governance doesn't help" vs "the agent never read the learnings").
- **Sham arm hygiene:** fixed byte-budget sidecar payloads in **all** arms (pad and
  hard-truncate to one budget — no length leakage, no treatment clipping); preregister
  a sham-vs-native no-deficit sanity check — if sham shows a significant deficit
  (nocebo/distraction), the sham contrast is quarantined and native becomes the
  operative control.
- **Dress rehearsal go/no-go:** full end-to-end rehearsal on train-split tasks with a
  preregistered gate (e.g., infrastructure-failure rate < 2%) before touching held-out
  tasks — under one-attempt/no-replacement, a mid-batch harness bug otherwise forces a
  phase rerun and infra flakes bias toward null.

**Fallback if STATE-Bench provisioning fails** (the GPT-5.4 judge endpoint is
self-provisionable but subject to Azure quota lead time): a second Sentinel pilot — not
a "powered confirmation." The Sentinel claim threshold is 0.10 (0.35 is the planning
alternative), only 19 of the 50 catalog tasks carry the comparison, and a ~15-task
pilot cannot bound ICC tightly enough to satisfy the repo's own gate; do not relabel it.

### Evidence-grade honesty (put this section in the thesis)

This thesis produces **OSF-preregistered, producer-run** evidence: registration before
each stage; raw-root hashes appended to OSF after; public git tags; frozen analysis
code. The repo's own eligibility bar — independent-party signer, post-run raw-head
witness, distinct-model replication, owner authorization — is deliberately **declared
future work**. The repo's `convert-to-public-attempt` machinery fails closed by design;
the thesis must state why it reports results the project's own certifier does not yet
certify, before an examiner discovers it. Model scope: claims are "on this model"
(single model family); no second-model replication is promised.

### Limitations for the committee

Construct: synthetic benchmarks operationalize "project reliability" — argue the
mapping explicitly. Internal: arm-*unlabeled* agent (not "blinded" — an agent cannot be
blinded to content it retrieves), equal-overhead sham, padding, deadline-released
responses. Statistical: clustering, preregistered MDE, all-outcomes-reportable.
External: one model, purpose-built benchmarks; parametric-contamination risk
(STATE-Bench train trajectories are public and may be in pretraining — biases toward
null; acknowledge). Per-endpoint scoring provenance: specify which scores are
deterministic vs LLM-judged; pin the judge deployment and decoding parameters.

---

## Bottom line

The re-review changes nothing about the 07-15 fabrication verdict (still clean; the new
dashboard page is security-sound and honest to a fault), but the program is **not
ready**: the same two schema splits keep 23 tests red (plus one flaky timeout), the
ledger is untouched since the last review, and the only new artifact is a page that
memorializes the audit instead of fixing what it found. The fix is small and specified
above. The experiment, right-sized for a solo PM capstone, is: **fix → OSF-preregister →
Sentinel pilot → one-domain STATE-Bench confirmatory strand at conformance grade —
framed as Design Science Research with the falsification methodology and the dogfood
case study as guaranteed-reportable contributions.** Run it.

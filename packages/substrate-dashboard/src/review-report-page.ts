/**
 * Validation Review page. Renders the 2026-07-15 independent audit of the
 * public-benchmark validation program (D6-B..D7): whether the validation
 * agents faked work, where the implementation diverges from the stated
 * objective, and what must change before efficacy evidence can exist.
 *
 * Pure renderer over a frozen, typed report payload — deterministic HTML
 * from data, unit-testable without a browser, matching the control-plane
 * page pattern. The report content is a point-in-time audit artifact; it is
 * NOT derived from the admitted log and makes no efficacy claim itself.
 */

export type ReviewSeverity = "critical" | "high" | "medium" | "low";
export type MatrixStatus =
  | "verified"
  | "partial"
  | "not-demonstrated"
  | "missing";
export type VerificationResult =
  | "confirmed-rerun"
  | "confirmed-static"
  | "confirmed-external"
  | "unverified";

export interface ReviewVerificationRow {
  readonly claim: string;
  readonly method: string;
  readonly result: VerificationResult;
}

export interface ReviewMatrixRow {
  readonly objective: string;
  readonly implementation: string;
  readonly status: MatrixStatus;
  readonly evidence: string;
}

export interface ReviewFinding {
  readonly id: string;
  readonly title: string;
  readonly severity: ReviewSeverity;
  readonly body: string;
  readonly evidence: string;
}

export interface ReviewFix {
  readonly rank: number;
  readonly title: string;
  readonly detail: string;
}

export interface ReviewRubricRow {
  readonly area: string;
  readonly weightPct: number;
  readonly score: number;
  readonly rationale: string;
}

export interface ReviewReport {
  readonly generatedAt: string;
  readonly scope: string;
  readonly method: string;
  readonly integrityVerdict: string;
  readonly integrityConfidencePct: number;
  readonly executiveSummary: readonly string[];
  readonly verification: readonly ReviewVerificationRow[];
  readonly matrix: readonly ReviewMatrixRow[];
  readonly falsePositives: readonly ReviewFinding[];
  readonly gaps: readonly ReviewFinding[];
  readonly fixes: readonly ReviewFix[];
  readonly rubric: readonly ReviewRubricRow[];
  readonly limitations: readonly string[];
}

export const REVIEW_REPORT: ReviewReport = {
  generatedAt: "2026-07-15T00:00:00.000Z",
  scope:
    "packages/public-eval-{toolsandbox,state-bench,corners,analysis}, packages/continuity, docs/objective-falsification.md, docs/public-benchmark-status-2026-07-13.md, docs/evidence/public-proof-run-register-2026-07-13.json, ROADMAP.md D6-A..D7, git history, and the uncommitted working tree.",
  method:
    "Four independently tasked forensic reader agents (one per eval package/verifier surface) plus direct cross-checks by the auditing session: load-bearing citations re-read at source, headline numbers re-executed from compiled code, manifest hashes recomputed from fixtures, upstream benchmark pins dereferenced against live GitHub, and the working-tree schema mismatch verified statically. A separate prior review (docs/external-review-2026-07-15.md) was treated as a claim source to verify, not as evidence.",
  integrityVerdict:
    "NOT FAKED. No fabricated result, hardcoded score, self-blessing fixture, or eligibility escape hatch was found anywhere in the validation surface. The harness is fail-closed by construction: every efficacy/eligibility field is a literal false, the D7 report can only emit not_eligible, and adverse results (an OpenAI 429 quota failure, a substrate-arm 0.25 scoring bug) are preserved in the committed run register. The written record under-claims relative to the artifacts — the rare direction for the error to run.",
  integrityConfidencePct: 95,
  executiveSummary: [
    "The validation agents are not faking the work. Five independent lines of evidence converge: (1) the architecture is structurally incapable of reporting success today (literal-false eligibility fields; decision.ts:1039,1046 hard-emit not_eligible); (2) headline numbers reproduce exactly when re-executed — this audit independently re-ran the power falsification (0.511210781855188) and recomputed the 50-task manifest (48e1695b…, 19/21/10 roles); (3) all three upstream benchmark pins dereference to real public commits (apple/ToolSandbox@165848b9, microsoft/STATE-Bench@fd980728, microsoft/sentinel_environments@0faca33c); (4) the committed evidence register preserves failures verbatim, including the 429 quota abort and the pre-repair substrate 0.25 score; (5) verifier test suites are adversarial (forged keys, fake session labels, tampered chains all rejected by executed tests).",
    "The program's real problem is the inverse of fabrication: after two pre-outcome design falsifications and ~84,700 lines of evaluation instrument (vs ~1,960 lines of treatment under test — a 43:1 ratio), zero eligible outcome observations exist. Sentinel completed cells: 0. STATE-Bench official trajectories: 0 of 2,250. The only executed triplet used a deterministic scripted probe, not a live model, and its raw bytes lived in /private/tmp and are gone — only hashes survive in the register.",
    "The single most consequential scientific finding (D6-B) is double-edged: native and sham duplicated a message send after a lost-response restart while substrate blocked the retry, yet Apple's strict oracle scored 1.0 in every arm. This is honest and correctly labeled an oracle blind spot — but it means the program's frozen primary endpoint (strict task completion) is structurally blind to the exact benefit the substrate demonstrates. Left unamended, the most likely output of the entire program is a string of honest nulls.",
    "One causal-design weakness needs fixing before the derivative result is quotable: the duplicate-block is gated on the literal arm label (arm === \"substrate\", public-eval-toolsandbox/src/index.ts:568-573), not on what the arm's own recalled state shows. The comparison therefore demonstrates \"blocking blocks when enabled for one arm,\" not an arm-blind mechanism. The fix is small: derive the gate from recall-visible state so the same code path runs in every arm and the asymmetry emerges from state visibility alone.",
    "The working tree is currently red mid-migration (runner-test fixture builds closure v2 while the plan demands v3; raw-runtime expects artifacts v3 while the closure emits v4 — verified statically at plan.ts:562 vs runner.test.ts:91 and raw-runtime.ts:285 vs runtime-closure.ts:1498). Fail-closed and loud, not fabrication — but the repo's own rule is revert-to-green first.",
  ],
  verification: [
    {
      claim: "Power falsification maximum 0.511210781855188 (ROADMAP D6-D)",
      method:
        "Re-executed packages/public-eval-corners/dist/sentinel-production-power-audit-cli.js in a clean Linux sandbox",
      result: "confirmed-rerun",
    },
    {
      claim: "50-task universe manifest 48e1695b… with 19 relative / 21 absolute / 10 no-op",
      method:
        "Recomputed sha256 over sorted taskId+scenarioSha256 lines from fixtures/sentinel-powered-catalog.json",
      result: "confirmed-rerun",
    },
    {
      claim: "Upstream pins are real public artifacts",
      method:
        "Dereferenced apple/ToolSandbox@165848b9, microsoft/STATE-Bench@fd980728 (v0.8.0 leaderboard), microsoft/sentinel_environments@0faca33c (SentinelBench, arXiv 2606.05342) on live GitHub",
      result: "confirmed-external",
    },
    {
      claim: "D7 report can only emit not_eligible; 6 receipt classes / 31 checks",
      method:
        "Source re-read: decision.ts:965-967,1039,1046 (only assignments); schema.ts:13-20; evidence-semantics.ts:10-56 (6+2+5+5+8+5=31); passing-bundle fixture still asserts not_eligible (decision.test.ts:130-157)",
      result: "confirmed-static",
    },
    {
      claim: "Duplicate-block gated on arm === \"substrate\"",
      method: "Source re-read: public-eval-toolsandbox/src/index.ts:568-573",
      result: "confirmed-static",
    },
    {
      claim: "v232 idempotency repair is runtime-consumed and retested",
      method:
        "Source re-read: matched_runner.py:78-86,274,310 (digest in real runner); sidecar.ts:37 (128-char limit); sidecar.test.ts:486-540 (136-char → 400, digest → 200, live sidecar)",
      result: "confirmed-static",
    },
    {
      claim: "Working tree red from v2/v3/v4 schema migration",
      method:
        "Static grep: plan demands closure v3 (plan.ts:562) vs test fixture v2 (runner.test.ts:91); raw-runtime expects artifacts v3 (raw-runtime.ts:285) vs closure emits v4 (runtime-closure.ts:158,1498). Vitest not runnable in audit sandbox (darwin-native rollup); CI does run DB-gated tests (ci.yml:30)",
      result: "confirmed-static",
    },
    {
      claim:
        "Ledger-resident claims (153 checkpoints, duplicate open decision 1435/1436, zero stage-gate activity)",
      method:
        "Live Postgres ledger unreachable from the audit sandbox; taken from the prior review and Changelog mirror only",
      result: "unverified",
    },
  ],
  matrix: [
    {
      objective: "Stress-test against real, publicly documented agent-state failure scenarios",
      implementation:
        "Three real public benchmarks pinned by URL+revision+license with recomputed corpus hashes (ToolSandbox, STATE-Bench, SentinelBench)",
      status: "verified",
      evidence:
        "toolsandbox index.ts:73-137; state-bench index.ts:336-360; corners catalog revision 0faca33c; all three dereferenced on live GitHub. Caveat: these are synthetic benchmarks designed to expose state failures, not documented production incidents — the headline phrasing overstates.",
    },
    {
      objective: "Matched native control",
      implementation:
        "Unmodified baseline: no HTTP boundary, real provider subprocess, arm-independent fault trigger",
      status: "verified",
      evidence: "matched_runner.py:329-331,389-393,498-503 — native is not crippled.",
    },
    {
      objective: "Equal-overhead sham control",
      implementation:
        "Same sidecar calls, writes, token/response shape; fixed-width irrelevant state (paddingRef/paddingValue); Sentinel sham performs identical PostgresContinuityLedger writes, decoy at read",
      status: "partial",
      evidence:
        "toolsandbox index.ts:421-427,719-725; production-state-sidecar.ts:634-660,714. Limit: in the ToolSandbox derivative the sham cannot block by construction, so overhead is controlled but blocking capability is not arm-blind (see FP-1).",
    },
    {
      objective: "Plain durable-KV arm (memory-vs-substrate attribution)",
      implementation:
        "Genuine minimal hash-chained NDJSON store behind the same 512-wide state API; tamper test executed",
      status: "verified",
      evidence:
        "production-state-sidecar.ts:602-632; tamper rejection test at production-state-sidecar.test.ts:600-611. Present only in Sentinel; ToolSandbox triplet has no plain-KV arm.",
    },
    {
      objective: "Substrate arm uses the production treatment",
      implementation: "Real @pm/continuity PostgresContinuityLedger (advisory locks, full-chain verify)",
      status: "verified",
      evidence: "production-state-sidecar.ts:34-37,643,704-711; continuity/src/postgres.ts:50-238.",
    },
    {
      objective: "Independent benchmark-owned oracle (gate cannot score itself)",
      implementation:
        "Vendored upstream Apple evaluator spawned from a verified clean checkout; scoring modules import no gate code; internalBlocksAffectTaskSuccess pinned false",
      status: "verified",
      evidence:
        "replay_oracle.py:208-221,327-349,523; oracle-replay.ts:1965 (spawnSync); grep of gate predicates excludes both oracle modules; index.ts:337-340.",
    },
    {
      objective: "Demonstrate the failure under matched arms (derivative: lost response + restart)",
      implementation:
        "Real loopback authenticated sidecar, real OS process-group SIGKILL/reap/fresh spawn, cross-checked frames; agent is a deterministic scripted probe; raw bytes not archived",
      status: "partial",
      evidence:
        "provider_process.py:186-277 (scripted), 688-779 (real SIGKILL); run register duplicateTargetSideEffectCountByArm native/sham 1, substrate 0; rawArtifactDurability: session-local /private/tmp.",
    },
    {
      objective: "Test whether pm-substrate improves the benchmark's real outcome",
      implementation:
        "Zero eligible efficacy attempts anywhere; strict score 1.0 in all arms on the only executed triplet (oracle blind to duplicate side effects)",
      status: "not-demonstrated",
      evidence:
        "Register: eligiblePublicEvalAttemptArtifacts 0; STATE-Bench officialScoredTrajectories 0/2250; Sentinel completed cells 0; centralMeasurementGap field admits the blind spot.",
    },
    {
      objective: "Arrowsmith: research smallest general repair for an observed gap",
      implementation:
        "Observed HTTP-400 (136-char idempotency key) → domain-separated bounded digest in the real runner → exact-case live-sidecar regression committed → derivative rerun retained the adverse oracle result",
      status: "verified",
      evidence:
        "matched_runner.py:78-86; sidecar.ts:37,742-751; sidecar.test.ts:486-540; register firstFailure (substrate 0.25) and preFinalRepairRetest preserved. Caveat: the original failing run survives as hash+narrative only (mechanism-level repair, no held-out lift).",
    },
    {
      objective: "Aggressively exclude false positives",
      implementation:
        "Executed anti-degenerate tests (treatment-aware oracle rejected, constant-outcome wrapper ineligible, dirty-source refusal with no output), guardrail mutation tests, anti-cherry-pick selection checks, two designs self-falsified pre-outcome",
      status: "verified",
      evidence:
        "corners index.test.ts:832-932; power-audit.test.ts:151-242; analyze.test.ts:308-467; MicroHub 27-cell exclusion and the 19×3 power self-falsification are recorded against interest.",
    },
    {
      objective: "Statistical power and preregistration before confirmatory spend",
      implementation:
        "Exact-binomial falsification + Monte-Carlo redesign with Holm/sign-flip/cluster-bootstrap, independently replayed in Python; preregistration preflight requires out-of-band trust-policy hash",
      status: "partial",
      evidence:
        "Both headline numbers re-verified by this audit. Blocker: ICC 0.25/1 coverage is unsatisfiable as stated (at ICC=1 repeats carry no information); needs empirical ICC or more independent tasks. run-preflight.ts:93-119 is real but planning-time only.",
    },
    {
      objective: "Clean-room replication and separate decision authority (D7)",
      implementation:
        "Ed25519 receipt verification with recomputation; producer/verifier separation by string identity within one trust domain; no external witness; owner authorization required and unreachable",
      status: "partial",
      evidence:
        "decision.ts:987 (string compare), 785-791 (operator-supplied policy hash); no committed keys (verified); continuity full-chain verify real (verify.ts:105-222) but local pre-publication rewrite undetectable — docs admit both.",
    },
  ],
  falsePositives: [
    {
      id: "FP-1",
      title: "Derivative block is arm-labeled, not arm-blind",
      severity: "high",
      body: "duplicateTargetWrite fires only when arm === \"substrate\". Both arms accumulate the same terminal-receipt state, but only substrate consults it, so \"native and sham duplicated while substrate blocked\" partly restates the configuration. It qualifies the mechanism (real state, real block, oracle-independent) but cannot support an arm-blind causal reading until the gate is derived from recall-visible state through one shared code path.",
      evidence: "public-eval-toolsandbox/src/index.ts:568-581; index.test.ts:283-365.",
    },
    {
      id: "FP-2",
      title: "Primary endpoint cannot see the demonstrated benefit",
      severity: "critical",
      body: "Apple's strict score stayed 1.0 in all arms while native and sham each retained a duplicate real-world side effect. The frozen north-star metric (benchmark's own strict completion) is structurally blind to collateral-state damage — precisely the dimension the substrate improves. As frozen, the program is most likely to produce honest nulls regardless of the substrate's true value. STATE-Bench's deterministic final-state scoring can see this class of benefit; the endpoint hierarchy should be amended by preregistration, not post hoc.",
      evidence: "Register centralMeasurementGap; ROADMAP D6-B; objective-falsification.md outcome hierarchy.",
    },
    {
      id: "FP-3",
      title: "\"Independent\" replay is N-version, not third-party",
      severity: "medium",
      body: "The 56-cell Python stdlib re-implementation genuinely re-verifies the power artifact, but same operator, same machine, same commit. The label \"independent\" invites over-reading; requirement #11 already refuses to let it carry decision authority — keep the wording aligned.",
      evidence: "scripts/sentinel-production-power-independent-verifier.py; power-audit.test.ts:200-242.",
    },
    {
      id: "FP-4",
      title: "Trust anchoring is a parameter boundary, not a second party",
      severity: "high",
      body: "Verifier-owner independence is a string inequality on self-declared IDs; one committed test key signs producer and all six verifier receipts in the passing fixture; the \"out-of-band\" trust-policy hash is whatever the operator types into an env var. Mechanically fail-closed today (nothing can go green), but these seams become live the moment eligibility becomes reachable.",
      evidence: "decision.ts:969-987; cli.ts:128-130; docs/public-benchmark-status-2026-07-13.md:147-153 (self-admitted).",
    },
    {
      id: "FP-5",
      title: "Register entries look verified but their raw bytes are gone",
      severity: "high",
      body: "The headline/derivative triplet's raw roots were session-local /private/tmp directories; only hashes and narrative survive in the committed register. \"Raw-cross-verified\" was true at capture time and is now unreproducible from the repo — the V3 raw verifier has nothing committed to run against.",
      evidence: "docs/evidence/public-proof-run-register-2026-07-13.json:89,113,158 (rawArtifactDurability self-disclosure).",
    },
    {
      id: "FP-6",
      title: "\"Publicly documented failures\" phrasing inflates the premise",
      severity: "low",
      body: "What exists is purpose-built public benchmarks whose papers document that agents exhibit state failures on them — not documented production incidents. The detail-level evidence handling is more honest than the headline phrase; align the phrase.",
      evidence: "ROADMAP north star vs benchmark papers (arXiv 2408.04682, 2606.05342).",
    },
    {
      id: "FP-7",
      title: "Narrative counts drift from artifact counts",
      severity: "low",
      body: "Status doc says the pinned upstream suite passed 150/1-skip; the register says 148 passed, 1 live-skipped (+11 adapter). Cosmetic, but it shows prose is hand-maintained rather than regenerated from artifacts — the same failure mode that produces bigger drifts later.",
      evidence: "public-benchmark-status-2026-07-13.md:118 vs run register stateBenchQualification.",
    },
  ],
  gaps: [
    {
      id: "G-1",
      title: "Zero outcome data across the entire program",
      severity: "critical",
      body: "Sentinel replacement cells completed: 0. STATE-Bench official trajectories: 0 of 2,250. ToolSandbox non-scripted triplet: never run (blocked on API credits; the one live attempt died on a 429 before the first action). The objective's core question — does the substrate improve real outcomes — is unanswered after the full instrument build-out.",
      evidence: "Run register all sections; ROADMAP D6-C/D6-D status lines.",
    },
    {
      id: "G-2",
      title: "Working tree is red mid-migration (producer/verifier schema split)",
      severity: "high",
      body: "Runner tests fixture v2 vs plan-required closure v3; raw-runtime accepts artifacts v3 while the closure emits v4 — a batch produced by the current runner would be rejected by its own raw verifier. Repo rule: revert to green or fix before further work.",
      evidence: "plan.ts:562/1411 vs runner.test.ts:91; raw-runtime.ts:285 vs runtime-closure.ts:158,1498 (verified statically by this audit).",
    },
    {
      id: "G-3",
      title: "No durable archival of raw run evidence",
      severity: "high",
      body: "Content-addressed writes with exclusive-create exist at runtime, but nothing preserves the bytes: no committed artifact store, no external object storage, no post-run raw-head witness. Every completed run so far is hash-only history.",
      evidence: "Register rawArtifactDurability; D7 memo external-witness requirement.",
    },
    {
      id: "G-4",
      title: "External witness/anchor unbuilt while free options exist",
      severity: "high",
      body: "The append-only post-run witness the docs require does not need to be built: OSF registration or a public git tag plus a Sigstore Rekor entry for the preregistration hash before the run and raw roots after would satisfy it in an afternoon. Custom witness infrastructure would repeat the tower failure mode.",
      evidence: "objective-falsification.md research basis (Rekor/in-toto/OSF already cited).",
    },
    {
      id: "G-5",
      title: "Power blocker is unsatisfiable as stated",
      severity: "medium",
      body: "The redesign passes only at listed ICC 0 and 0.10 and fails at 0.25 and 1 — but at ICC=1 repeats carry zero information, so \"cover the whole range\" can never be signed with 19 relative tasks. The protocol already permits the qualification triplet and the 12-task procedural holdout; running them yields an empirical ICC to power against (estimate plus margin), or add independent relative tasks.",
      evidence: "sentinel-production-power-audit.ts:684-822; ROADMAP D6-D power paragraph.",
    },
    {
      id: "G-6",
      title: "Upstream byte-binding is skipped by default",
      severity: "medium",
      body: "The 50-task manifest recomputes from the fixture by default; the test that binds scenarioSha256 to real Microsoft bytes runs only when PM_SENTINEL_PINNED_CHECKOUT is set (it.skip otherwise). Local and CI runs never validate the fixture against upstream content.",
      evidence: "sentinel-production-catalog.test.ts:88-96.",
    },
    {
      id: "G-7",
      title: "DB-gated arm tests skip silently in local runs",
      severity: "low",
      body: "Without PM_DATABASE_URL the real-ledger sham/substrate sidecar tests skip via describe-gating. CI does set the variable (ci.yml:30), so this is a local-development visibility gap, not a coverage hole — but a loud skip-count summary would prevent false local confidence.",
      evidence: "production-state-sidecar.test.ts:39-40; .github/workflows/ci.yml:30.",
    },
    {
      id: "G-8",
      title: "Instrument-to-treatment ratio ~43:1 echoes the excised tower",
      severity: "medium",
      body: "~84,700 lines of public-eval instrument vs ~1,960 lines of continuity treatment. The repo excised an 85k-line unconsumed provenance tower this month; verification formalism is regrowing in its place. By hard requirement 6's own standard, verifier machinery whose only consumer is an experiment that has never run is ceremonial consumption.",
      evidence: "Line counts recomputed by this audit; commit cb68153 (tower excision).",
    },
    {
      id: "G-9",
      title: "Governance surfaces under test have no recorded activity",
      severity: "medium",
      body: "Stage-gate applications and procedure admissions reportedly show zero admitted events while \"governance as API\" is a claim under test. Unverified by this audit (ledger unreachable from the sandbox) — verify via pnpm dev:status and either exercise these paths or descope the claim.",
      evidence: "Prior review §1; control-plane governance counters.",
    },
    {
      id: "G-10",
      title: "No plain-KV arm in the ToolSandbox derivative",
      severity: "medium",
      body: "The memory-vs-substrate attribution control exists only in Sentinel. The one demonstrated mechanism (duplicate suppression after restart) is exactly the kind of benefit a plain durable KV might also deliver; without that arm the ToolSandbox result cannot attribute the block to substrate-specific semantics.",
      evidence: "objective-falsification.md four-arm requirement vs three-arm toolsandbox index.ts:81.",
    },
  ],
  fixes: [
    {
      rank: 1,
      title: "Restore green",
      detail:
        "Migrate the runner-test fixture to closure v3 and raw-runtime to artifacts v4 so producer and verifier agree; commit. The repo's own protocol forbids building on a red tree.",
    },
    {
      rank: 2,
      title: "Amend the endpoint hierarchy by preregistration",
      detail:
        "Keep the benchmark's strict score as a non-inferiority guard (substrate must not block its way to fewer completions) and add a preregistered state-effect endpoint (duplicate side effects, collateral changes, computed from the benchmark's own environment) as the superiority claim. Do it before any confirmatory run; STATE-Bench's final-state scoring already expresses this class of benefit.",
    },
    {
      rank: 3,
      title: "Make the derivative gate arm-blind and add plain-KV",
      detail:
        "Derive the duplicate-block from recall-visible state through one shared code path (sham recalls padding, so it naturally cannot block) instead of arm === \"substrate\"; add the plain-KV arm to the ToolSandbox derivative; rerun the exact triplet.",
    },
    {
      rank: 4,
      title: "Run what the protocol already permits, this week",
      detail:
        "MicroHub qualification triplet plus the frozen 12-task procedural holdout, four arms, speed 1 (~$200-600 at the paper's economics). Explicitly non-confirmatory. Yields the program's first behavioral data, real harness debugging, and the empirical ICC that dissolves the power blocker (G-5).",
    },
    {
      rank: 5,
      title: "External witnessing in an afternoon; archive raw bytes",
      detail:
        "OSF or public git tag + Sigstore Rekor for the preregistration hash before and raw/block heads after each run; push raw run trees to durable content-addressed storage and commit the roots. Cancel any plan to build a custom witness service.",
    },
    {
      rank: 6,
      title: "Fund and run the non-scripted ToolSandbox triplet",
      detail:
        "The blocker is literally API credits (429 insufficient_quota preserved in the register). A live-model run with archived raw bytes converts D6-B from mechanism qualification toward evidence.",
    },
    {
      rank: 7,
      title: "Freeze verification code",
      detail:
        "Standing rule until the next outcome cell completes: no new verifier features unless a completed run's failure or a named external skeptic demanded the check. This is hard requirement 6 applied to the instrument itself.",
    },
    {
      rank: 8,
      title: "Hygiene batch",
      detail:
        "Regenerate status-doc counts from the register; fix the \"publicly documented failures\" phrasing; close the duplicate open decision checkpoint (1435/1436); wire PM_SENTINEL_PINNED_CHECKOUT byte-binding into CI or vendor the scenario hashes' provenance; surface local skip counts loudly.",
    },
  ],
  rubric: [
    {
      area: "Objective definition & falsifiability",
      weightPct: 10,
      score: 95,
      rationale:
        "Causal, falsifiable, guardrailed claim with an executable protocol and a 16-row failure-mode table; two designs already self-falsified pre-outcome.",
    },
    {
      area: "Benchmark selection & pinning",
      weightPct: 10,
      score: 90,
      rationale:
        "Three real public benchmarks pinned by revision/license with recomputed hashes; deduction for the \"publicly documented incidents\" framing and default-skipped byte-binding.",
    },
    {
      area: "Control & arm design",
      weightPct: 15,
      score: 80,
      rationale:
        "Four-arm Sentinel design is near publication-grade with real production treatment; deductions for the arm-labeled derivative gate and missing plain-KV arm in the executed slice.",
    },
    {
      area: "Anti-false-positive machinery",
      weightPct: 15,
      score: 85,
      rationale:
        "Executed adversarial tests, mutants, anti-cherry-pick, fail-closed eligibility everywhere; deductions for single-trust-domain seams that go live if eligibility opens.",
    },
    {
      area: "Outcome evidence produced",
      weightPct: 25,
      score: 10,
      rationale:
        "Zero eligible attempts; one scripted-probe mechanism triplet with non-durable raw bytes; the objective's core question is unanswered.",
    },
    {
      area: "Evidence durability & reproducibility",
      weightPct: 15,
      score: 40,
      rationale:
        "Deterministic recomputable planning artifacts (verified by re-execution) offset by vanished run bytes, red working tree, and uncommitted WIP.",
    },
    {
      area: "Independent verification & decision authority",
      weightPct: 10,
      score: 45,
      rationale:
        "Real signatures, recomputation, and honest not_eligible; but identity is string-level, the trust hash is operator-supplied, and no external witness exists.",
    },
  ],
  limitations: [
    "The live continuity ledger (Postgres on the owner's machine) was unreachable from the audit sandbox; ledger-resident claims are marked unverified and should be checked with pnpm dev:status.",
    "Vitest could not execute in the audit sandbox (host-platform-native rollup binaries); the red-tree finding is static-analysis-confirmed and should be reconfirmed with pnpm test on the owner's machine.",
    "This audit read the prior docs/external-review-2026-07-15.md but independently re-verified every claim it relied on; two of its claims (ledger duplicate checkpoint, zero stage-gate activity) could not be independently confirmed from the sandbox.",
    "This report is a point-in-time artifact (working tree as of 2026-07-15) and makes no efficacy claim; it is diagnostic content, not admitted-log-derived evidence.",
  ],
};

const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function computeOverallScore(rubric: readonly ReviewRubricRow[]): number {
  const totalWeight = rubric.reduce((sum, row) => sum + row.weightPct, 0);
  if (totalWeight === 0) return 0;
  const weighted = rubric.reduce((sum, row) => sum + row.weightPct * row.score, 0);
  return weighted / totalWeight;
}

const SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_LABEL: Record<MatrixStatus, string> = {
  verified: "Verified",
  partial: "Partial",
  "not-demonstrated": "Not demonstrated",
  missing: "Missing",
};

const RESULT_LABEL: Record<VerificationResult, string> = {
  "confirmed-rerun": "Confirmed by re-execution",
  "confirmed-static": "Confirmed at source",
  "confirmed-external": "Confirmed against external source",
  unverified: "Unverified",
};

function severityBadge(severity: ReviewSeverity): string {
  return `<span class="rv-badge rv-sev-${severity}">${SEVERITY_LABEL[severity]}</span>`;
}

function statusBadge(status: MatrixStatus): string {
  return `<span class="rv-badge rv-status-${status}">${STATUS_LABEL[status]}</span>`;
}

function resultBadge(result: VerificationResult): string {
  return `<span class="rv-badge rv-result-${result}">${RESULT_LABEL[result]}</span>`;
}

function renderFinding(finding: ReviewFinding): string {
  return `
    <article class="rv-finding" data-finding="${esc(finding.id)}">
      <header>
        <strong>${esc(finding.id)} · ${esc(finding.title)}</strong>
        ${severityBadge(finding.severity)}
      </header>
      <p>${esc(finding.body)}</p>
      <p class="rv-evidence">Evidence: ${esc(finding.evidence)}</p>
    </article>
  `;
}

function severityCounts(findings: readonly ReviewFinding[]): Record<ReviewSeverity, number> {
  const counts: Record<ReviewSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

export function renderReviewReportHtml(report: ReviewReport): string {
  const overall = computeOverallScore(report.rubric);
  const overallLabel = `${overall.toFixed(1)}%`;
  const allFindings = [...report.falsePositives, ...report.gaps];
  const counts = severityCounts(allFindings);
  return `
    <section class="rv-page" data-page="validation-review">
      <style>
        .rv-page{max-width:1080px;margin:0 auto;padding:24px 28px 64px;display:flex;flex-direction:column;gap:24px}
        .rv-page h2{margin:0 0 4px}
        .rv-page h3{margin:0 0 8px}
        .rv-page .kicker{margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
        .rv-meta{font-size:13px;opacity:.75;line-height:1.5}
        .rv-banner{border:1px solid rgba(96,200,140,.45);background:rgba(64,160,110,.12);border-radius:10px;padding:16px 18px}
        .rv-banner strong{display:block;margin-bottom:6px}
        .rv-strip{display:flex;flex-wrap:wrap;gap:12px}
        .rv-stat{border:1px solid rgba(128,128,128,.3);border-radius:10px;padding:10px 14px;min-width:130px}
        .rv-stat span{display:block;font-size:12px;opacity:.7}
        .rv-stat strong{font-size:20px}
        .rv-section{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:18px 20px}
        .rv-section > p{line-height:1.55}
        .rv-table{width:100%;border-collapse:collapse;font-size:13.5px}
        .rv-table th,.rv-table td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid rgba(128,128,128,.2);line-height:1.45}
        .rv-table th{font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:.7}
        .rv-badge{display:inline-block;border-radius:999px;padding:2px 10px;font-size:11.5px;font-weight:600;white-space:nowrap}
        .rv-sev-critical{background:rgba(220,70,70,.18);color:#e05252;border:1px solid rgba(220,70,70,.45)}
        .rv-sev-high{background:rgba(235,150,60,.16);color:#d8862e;border:1px solid rgba(235,150,60,.45)}
        .rv-sev-medium{background:rgba(220,190,70,.16);color:#b09a2e;border:1px solid rgba(220,190,70,.4)}
        .rv-sev-low{background:rgba(120,160,220,.14);color:#6d93cf;border:1px solid rgba(120,160,220,.4)}
        .rv-status-verified,.rv-result-confirmed-rerun,.rv-result-confirmed-static,.rv-result-confirmed-external{background:rgba(96,200,140,.16);color:#3fa06e;border:1px solid rgba(96,200,140,.4)}
        .rv-status-partial{background:rgba(235,150,60,.16);color:#d8862e;border:1px solid rgba(235,150,60,.45)}
        .rv-status-not-demonstrated,.rv-status-missing,.rv-result-unverified{background:rgba(220,70,70,.14);color:#e05252;border:1px solid rgba(220,70,70,.4)}
        .rv-finding{border:1px solid rgba(128,128,128,.25);border-radius:10px;padding:12px 14px;margin-bottom:10px}
        .rv-finding header{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:6px}
        .rv-finding p{margin:4px 0;line-height:1.5}
        .rv-evidence{font-size:12.5px;opacity:.7}
        .rv-fix{display:flex;gap:12px;align-items:baseline;border-bottom:1px solid rgba(128,128,128,.18);padding:8px 0}
        .rv-fix strong.rv-rank{flex:0 0 26px;font-size:15px;opacity:.8}
        .rv-rubric-row{display:grid;grid-template-columns:230px 1fr 60px;gap:12px;align-items:center;padding:6px 0}
        .rv-rubric-bar{height:8px;border-radius:4px;background:rgba(128,128,128,.2);overflow:hidden}
        .rv-rubric-bar i{display:block;height:100%;background:linear-gradient(90deg,#4f8fd9,#3fa06e)}
        .rv-overall{display:flex;align-items:baseline;gap:14px;margin-top:10px}
        .rv-overall strong{font-size:34px}
        .rv-limitations li{line-height:1.5;margin-bottom:6px}
        .rv-summary li{line-height:1.6;margin-bottom:10px}
      </style>

      <header data-section="header">
        <p class="kicker">Validation Review · 2026-07-15</p>
        <h2>Unbiased audit: is the public-proof program real, and does it meet its objective?</h2>
        <p class="rv-meta"><strong>Scope:</strong> ${esc(report.scope)}</p>
        <p class="rv-meta"><strong>Method:</strong> ${esc(report.method)}</p>
      </header>

      <div class="rv-banner" data-section="integrity-verdict">
        <strong>Fabrication verdict: ${esc(report.integrityVerdict.split(".")[0] ?? "")}.</strong>
        <p>${esc(report.integrityVerdict)}</p>
        <p class="rv-meta">Evidence-integrity confidence: ${report.integrityConfidencePct}% (residual: ledger and live-test claims unverifiable from the audit sandbox).</p>
      </div>

      <div class="rv-strip" data-section="counts">
        <div class="rv-stat"><span>Critical findings</span><strong>${counts.critical}</strong></div>
        <div class="rv-stat"><span>High</span><strong>${counts.high}</strong></div>
        <div class="rv-stat"><span>Medium</span><strong>${counts.medium}</strong></div>
        <div class="rv-stat"><span>Low</span><strong>${counts.low}</strong></div>
        <div class="rv-stat"><span>Objective attainment</span><strong>${esc(overallLabel)}</strong></div>
      </div>

      <section class="rv-section" data-section="executive-summary">
        <h3>Executive summary</h3>
        <ul class="rv-summary">
          ${report.executiveSummary.map((item) => `<li>${esc(item)}</li>`).join("")}
        </ul>
      </section>

      <section class="rv-section" data-section="verification">
        <h3>What this audit independently re-verified</h3>
        <table class="rv-table">
          <thead><tr><th>Claim</th><th>Verification method</th><th>Result</th></tr></thead>
          <tbody>
            ${report.verification
              .map(
                (row) =>
                  `<tr><td>${esc(row.claim)}</td><td>${esc(row.method)}</td><td>${resultBadge(row.result)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>

      <section class="rv-section" data-section="traceability">
        <h3>Objective vs implementation traceability</h3>
        <table class="rv-table">
          <thead><tr><th>Objective element</th><th>Implementation</th><th>Status</th><th>Evidence &amp; caveats</th></tr></thead>
          <tbody>
            ${report.matrix
              .map(
                (row) =>
                  `<tr><td>${esc(row.objective)}</td><td>${esc(row.implementation)}</td><td>${statusBadge(row.status)}</td><td>${esc(row.evidence)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>

      <section class="rv-section" data-section="false-positives">
        <h3>False positives (looks satisfied, is not)</h3>
        ${report.falsePositives.map(renderFinding).join("")}
      </section>

      <section class="rv-section" data-section="gaps">
        <h3>Implementation gaps</h3>
        ${report.gaps.map(renderFinding).join("")}
      </section>

      <section class="rv-section" data-section="fixes">
        <h3>Recommended fixes (prioritized)</h3>
        ${report.fixes
          .map(
            (fix) =>
              `<div class="rv-fix"><strong class="rv-rank">${fix.rank}</strong><div><strong>${esc(fix.title)}.</strong> ${esc(fix.detail)}</div></div>`,
          )
          .join("")}
      </section>

      <section class="rv-section" data-section="assessment">
        <h3>Overall assessment</h3>
        ${report.rubric
          .map(
            (row) =>
              `<div class="rv-rubric-row"><span>${esc(row.area)} <em>(${row.weightPct}%)</em></span><div class="rv-rubric-bar"><i style="width:${Math.max(0, Math.min(100, row.score))}%"></i></div><strong>${row.score}</strong></div>
               <p class="rv-evidence">${esc(row.rationale)}</p>`,
          )
          .join("")}
        <div class="rv-overall">
          <strong>${esc(overallLabel)}</strong>
          <span>weighted objective attainment — the instrument is excellent and honest; the objective itself (demonstrated outcome benefit on a public benchmark) remains unmet because no eligible outcome data exists yet.</span>
        </div>
      </section>

      <section class="rv-section" data-section="limitations">
        <h3>Audit limitations &amp; provenance</h3>
        <ul class="rv-limitations">
          ${report.limitations.map((item) => `<li>${esc(item)}</li>`).join("")}
        </ul>
      </section>
    </section>
  `;
}

export function mountReviewReport(root: HTMLElement): void {
  root.innerHTML = renderReviewReportHtml(REVIEW_REPORT);
}

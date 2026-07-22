# Public benchmark program status — 2026-07-13

## Decision

**The public causal benefit of pm-substrate remains unproven.** All six roadmap
items received concrete implementation, research, or verification work, but
that is not six completed proof steps. ToolSandbox now has fresh raw
cross-verified headline and lost-response triplets over a real authenticated
sidecar and provider-process restart. They use deterministic
`PmScriptedStateProbe`, however, and both eligibility assessments correctly
remain false. STATE-Bench now has phase-safe train/test planning, exact per-cell
commands, and a command-bound raw contract but no verifiable official
execution; the corner harness has no real matched-agent result; and D7 v4 marks
all current signed structured assertions
diagnostic-only and `not_eligible`. PluggedInSocial and ArrowHedge therefore
remain frozen.

### 2026-07-14 Sentinel audit correction

The previously described 27-cell Sentinel runtime is not queued for causal
execution. An adversarial pre-outcome audit excluded it: useful memory was an
adapter-owned task-specific `Map`; speed factor 4 did not scale the nested
MicroHub star trajectory and made both positive tasks unreachable; the no-op
oracle could reward immediate exit; and the release does not contain the exact
Microsoft paper agent/configuration/raw logs. These are design failures, not
observed substrate gaps, so they do not trigger Arrowsmith.

The replacement runs at published speed 1 with a task-agnostic agent and four
arms: no durable state, continuity-backed sham, plain durable KV, and production
continuity. MicroHub is qualification-only. A frozen 12-task cross-application
set is procedural holdout validation, not powered confirmation. No replacement
cell has produced benefit evidence. Before any outcome, the confirmatory
content universe was frozen to every one of the 50 scenarios in the five untouched
environments MicroChat, MicroDin, MicroFy, MicroGram, and MicroLendar (19
relative, 21 absolute, 10 no-op), manifest `48e1695b…`. That does not make the
design powered. The replayable pre-outcome audit now rejects the proposed
19-relative-task × 3-repeat declaration: under its independent-binomial,
equal-control-rate planning model with true lift equal to the 0.10 claim
threshold, the necessary probability of observing at least 0.10 over both
controls is at most `0.511210781855188` over the declared 9,001-point baseline
grid. Both Holm rejections, the positive task bootstrap bound, raw completeness,
and clean-control/economics gates can only reduce that probability. A subsequent
pre-outcome redesign separated the 0.10 claim threshold from a 0.35 planning
alternative and replayed the complete Holm/bootstrap/guardrail rule. An
independent Python implementation reproduced all 56 cells (audit
`9c5a9bc6…`, replay receipt `bea82b26…`). Worst simultaneous lower bounds are
0.9190 at listed ICC 0 and 0.8705 at listed ICC 0.10, but 0.7724 at ICC 0.25 and
0.3267 at ICC 1. The passing endpoints do not cover an interval and the model
assumptions remain unverified, so powered execution remains unsigned and
blocked. This is an evaluation-design failure, not an Arrowsmith trigger.

Full content hashes for the executed qualifications, failed provider batch,
and continuity repair are preserved in
[`evidence/public-proof-run-register-2026-07-13.json`](./evidence/public-proof-run-register-2026-07-13.json).

This distinction is deliberate:

- implemented means a bounded runner/verifier/research artifact and its tests
  exist, including an explicit refusal where required evidence is unavailable;
- qualified means upstream source/oracle plumbing ran successfully;
- deterministically executed means a scripted probe exercised the real
  benchmark/runtime mechanism but did not measure public-agent behavior;
- behaviorally executed means non-scripted matched agents reached the task with
  provider identity, usage, cost, and latency retained;
- conditionally evidence-eligible requires sealed confirmation,
  distinct-model replication, adapter-specific derivation of 31 structured
  observations from bound raw records, and all
  six externally authenticated verification receipts; proven additionally
  requires a separate authenticated owner decision over the exact report hash.

## Project evaluation

| Dimension | Assessment | Why |
|---|---|---|
| PM-layer/product thesis | Coherent, still falsifiable | A protocol sidecar that makes current project state and admission explicit is a plausible mechanism; the roadmap now states a causal task-outcome claim rather than treating governance activity as value |
| Core engineering/conformance | Strong | Typed boundaries, replay, migration isolation, zero-edit checks, and the focused ToolSandbox hardening suite make accidental regressions visible; the live continuity fork and bounded-key `400` also proved dogfooding can expose real defects |
| Evaluation integrity | Improving, not decision-grade | ToolSandbox V3 closes its known detached-summary exploit. The Sentinel audits then caught adapter-owned memory, impossible accelerated trajectories, no-op liveness, baseline-identity, plain-KV attribution, response-only browser evidence, incomplete runtime closure, and an invalid 80% power declaration before provider spend. The production replacement and external trust boundary are not yet complete |
| Public causal evidence | Qualification only | One fully retained deterministic ToolSandbox headline triplet and derivative reached the public oracle. They show a mechanism can suppress an exact duplicate, but a scripted probe is not agent efficacy. Sentinel has no accepted matched behavioral result |
| Generalization/replication | Absent | There is no confirmatory set, second model/benchmark result, or clean independent reproduction |
| Business readiness | Intentionally unevaluated | The two apps are frozen; even a future public result would justify only a separately scoped transfer test, not demand, revenue, or investment-performance claims |

The project is therefore credible as a **mechanism prototype with unusually
explicit falsification controls**, but not yet as a proven agent-state product.
Its largest risk is continuing to improve evidence infrastructure faster than
it produces the first eligible behavioral observation. The next milestone is
not another abstraction: it is a preregistered non-scripted public-agent result
with retained economics and an externally trusted replay path, followed by
confirmation and replication.

## Final ToolSandbox qualification

The final manifest is
`bd3285e471ed35d0440ab3b57105d43703456cc51d5e676b8a4bde3287ccbb2b`.
Every arm is bound to starting context
`62717eafc44807b3b6729f8c5b5f0f47fbeffba30093c421d90689ac30da2d04`
after normalizing only 11 exact timestamp values, and to runtime closure
`a71ae2d14d807449b5864f28985a195b27fb9bb62aa41fe55e10068a24d3f869`.

| Track | Exact hashes | Upstream outcome | State-effect outcome |
|---|---|---|---|
| Unchanged headline | batch `7ad2c0e8…`; raw verification `36318957…`; eligibility `9a631ee3…` | Native, sham, and substrate strict score `1.0` | No restart and no duplicate target effect in any arm |
| Lost-response derivative | batch `0043af27…`; raw verification `673963f0…`; eligibility `c7624df3…` | Native, sham, and substrate strict score `1.0` | Actual process-group `SIGKILL`, reap, and fresh-process retry in every arm; native/sham retry succeeded with one duplicate target effect each; substrate retry was blocked with zero duplicates |

This exposed a benchmark-level measurement gap: Apple's strict score remained
`1.0` for the two duplicate control sends. Official task success and replayed
state-effect safety must therefore be reported separately. The verifier does
not assume that substrate blocks or controls allow; it retains observed
counterevidence and validates the actual block representation, including
`review.valid=false`. Seventy-five focused tests passed during hardening, then
a 30-test final regression subset passed.

## Six-step execution register

| Step | Implementation | What actually ran | Proof status / next gate |
|---|---|---|---|
| 1. Evidence integrity reset | Local labs are `mechanism_conformance_only`; exact pair identity, expected-allow checks, allow-all/block-all mutants, deterministic top-ranked task selection, immutable arm interventions, initial environment, randomized order, signed preregistration/attempt-time bindings, versioned structured assertions, and fixed guardrails ship | Live Ollama suite `suite_6cf46d7e-a3fe-46ce-a5dc-4fc57f2a8ed8`: 22 scenarios/22 exact pairs; expected-block 12/12; expected-allow 10/10; both mutants rejected. Analysis/decision adversarial suite: 30/30 | Conformance and gate integrity only. Internally consistent signed facts remain diagnostic-only and `not_eligible`; no local result can establish public efficacy or authorize KEEP |
| 2. ToolSandbox slice | Pinned `apple/ToolSandbox@165848b9…`; matched-batch/raw-verification v3; verifier-selected Apple oracle replay; raw provider/trajectory/sidecar/state cross-binding; authenticated HTTP sidecar; runtime closure; pinned starting context; real OS-process restart; outcome-neutral replay | Preserved history: quota-failed v1 batch, then a deterministic derivative that exposed a 136-character idempotency-key `400`, then pre-final repair retest `90a8e03a…`. Final headline `7ad2c0e8…` and derivative `0043af27…` both scored `1.0` in every arm. In the derivative, native/sham duplicated the target side effect and substrate did not | Strong qualification/mechanism evidence for one known scenario, not efficacy. Eligibility remains false for missing provider usage/cost/latency, trusted oracle runtime/environment, non-scripted public-agent execution, and independent trust anchor. The upstream score's duplicate-send blind spot requires a separate state-effect metric |
| 3. STATE-Bench held-out proof | Pinned `microsoft/STATE-Bench@fd980728…`; deterministic 20/80 train qualification/extraction partition; exact 150-task test confirmation and replication inventories; five stochastic repeat identities; randomized arm schedule; v3 bound configs; exact 2,250-command phase plans; oracle-field redaction; one-attempt policy; external preregistration preflight; command-bound raw transport/retry/treatment/state schema; score conversion refuses by design | STATE adversarial suite: 62/62; pinned upstream plus adapter Python suite: 150 passed, 1 credential-dependent skip. Official scored trajectories: 0 | Planning and schemas are controls, not execution. No instrumented executor captures runner/agent/simulator/judge transports, independently replays state, or derives official scores from raw judge bytes. Official credentials and external command/trust pins are absent; local “perfect” JSON cannot substitute |
| 4. Independent corner battery | Four source-pinned adapters plus the generic matched-arm protocol. The first Sentinel implementation added Chromium/provider/state/process capture, but its causal design is now excluded. The replacement uses one task-agnostic agent, speed 1, strict liveness, and no-state/sham/plain-KV/production-continuity arms | Production hardening covers fixed-shape responses, real post-ack `SIGKILL` durability, isolation, concurrent append, independent backend replay, chained browser bytes, provider usage, exact process/environment/collateral evidence, economics, and transitive runtime closure. The raw verifier independently reconstructs those records and fails closed without a post-run raw-head witness. The original power declaration is falsified; the 56-cell redesign replay is conditional only. Completed accepted Sentinel cells: 0 | MicroHub can qualify only. The 12-task procedural holdout cannot emit material benefit. Powered execution remains blocked until dependence is justified across an accepted range or more independent tasks are added, and until pre/post external anchors exist. Complete raw execution, clean replay, and replication still gate efficacy |
| 5. Failure-driven Arrowsmith loop | v230 repaired an observed continuity fork; v231 repaired the false-KEEP authority boundary; v232 repaired the observed ToolSandbox bounded-idempotency composition failure without weakening the sidecar's limit or request-byte conflict check | Continuity concurrency ablation passed; fabricated signed D7 facts remain ineligible; v232 preserves the failing `d9cf73c3…` batch and final derivative shows the bounded digest survives restart and suppresses the exact duplicate | Integrity and mechanism evidence, not public benefit. A general substrate repair still requires a non-scripted behavioral failure trace, minimal consumed primitive, ablation, exact rerun, and clean controls |
| 6. Replicate and decide | Task-clustered analysis uses predeclared independent tasks/repeats, 10,000 bootstrap draws, simultaneous ≥0.10 lift over both controls, positive lower bound, ≥0.5 reliability, zero deterministic false blocks/collateral, ≤$10 and ≤720s per cell, and substrate cost ≤1.25× each control. Repeats remain clustered and cannot self-supply independent task count. Future eligibility additionally requires raw-derived facts and independent pre/post receipts | The exact 19×3 redesign and independent replay are retained but conditional; no live outcome was read. The generated memo remains `unproven` | Current automation remains `not_eligible`. No independent post-run raw-head witness, eligible confirmation, replication, or owner authorization exists |

## Exact external blockers

1. **ToolSandbox efficacy:** the old provider-backed `429 insufficient_quota`
   batch remains preserved history. V3 has now qualified the real sidecar,
   process restart, provider/trajectory bridge, and Apple oracle replay with a
   deterministic probe. A public-efficacy run still requires a funded
   non-scripted provider, retained usage/cost/latency, a trusted oracle replay
   runtime/environment, and an independent verifier signature anchored outside
   the producer bundle.
2. **STATE-Bench:** two different kinds of blocker, not one. (a) *Purchasable,
   not gatekept:* the locked official evaluator is self-provisioned — upstream's
   `docs/setup/eval-client.md` has the submitter configure their own GPT-5.4
   deployment via `STATE_BENCH_EVAL_ENDPOINT`, `STATE_BENCH_EVAL_DEPLOYMENTS`,
   and `STATE_BENCH_EVAL_API_KEY` in `.env`; no Microsoft-issued credential
   exists to wait for. This is a funding/setup task. A generic API key is still
   not substituted for the locked evaluator, and the declared
   `STATE_BENCH_AGENT_*` runtime identities remain undeclared until that
   deployment exists. (b) *Engineering:* the repository does not yet contain
   the instrumented executor/transport capture required to turn its verified
   command plan and raw schema into independently replayable attempts.
3. **Corner execution:** the legacy Sentinel real-browser/model path is excluded
   from causal use. The production four-arm replacement still needs a clean
   excluded smoke. Its 50-task catalog is frozen. The 19×3/10-point declaration
   is mathematically ineligible, and the replayed 0.35-alternative redesign is
   only conditional on unverified repeat/task assumptions. Full accepted-range
   justification or additional untouched independent tasks, plus externally
   anchored completed raw roots and clean independent replay, must exist before
   any efficacy result can count.
4. **Trust and decision authority:** the repository has no externally witnessed
   preregistration, owner-configured trust root, adapter-specific producer and
   reviewer that derive the v2 semantic facts from real benchmark records,
   authenticated organizational principals, or owner credential that can
   authorize a report hash. The generic D7 gate validates internally consistent,
   procedure-versioned fact schemas, but it cannot prove those external facts
   came from the subject. It therefore marks every current bundle ineligible.
5. **Replication:** because there is no eligible confirmatory artifact set,
   independent verification and distinct-model replication cannot yet produce
   even a conditionally eligible D7 report.

## Next executable sequence

1. Treat ToolSandbox v3 as the qualification baseline. Externally preregister
   a non-scripted public-agent manifest, provision the provider, retain verified
   usage/cost/latency, establish a trusted oracle runtime and independent trust
   anchor, then run unchanged headline and derivative triplets. Preserve every
   prior failure and report upstream score separately from state-effect safety.
2. Implement the missing STATE-Bench executor around the verified 2,250-command
   plan: sanitize inherited environment, refuse existing output cells, retain
   every task/provider retry and terminal failure, capture exact
   runner/agent/simulator/judge bytes and actual model/economics, attest
   treatment uptake, and independently replay state and derive official scores.
   Then provision locked credentials, externally pin preregistration/trust and
   command-plan hashes, seal the learning artifact, and execute without
   post-result exclusions.
3. Commit and clean-room verify the production Sentinel runtime. At speed 1,
   run the MicroHub triplet as qualification only, then the frozen 12-task
   procedural holdout across all four arms without replacement or outcome
   inspection. Use its predeclared economics/infrastructure facts—not its score—
   to validate procedure and economics only. Keep the already content-frozen
   50-task catalog separate from power: use the retained conditional redesign
   only after independently justifying its accepted dependence range, otherwise
   add untouched independent tasks and re-power. Externally anchor the phase
   before execution and bind every completed attempt/raw root afterward before
   raw-replaying the complete universe.
4. Feed only an observed public failure into the Arrowsmith loop. Implement the
   smallest general, runtime-consumed repair; ablate it; rerun the exact case
   and clean controls.
5. Before execution, anchor the preregistration and trust policy in an owner/CI
   channel outside the bundle. Produce six Ed25519-signed, adapter-specific
   receipts covering all 31 observations from a clean checkout, with
   adapter-specific procedures that derive their facts from the bound raw
   records; replicate; then run
   `pnpm public-eval:decide path/to/decision-bundle.json path/to/trust-policy.json
   "$PM_PUBLIC_EVAL_TRUST_POLICY_SHA256"`. If conditionally eligible, archive
   the report and request a separate authenticated owner authorization over its
   exact hash. The memo itself cannot unfreeze apps.

Until those gates pass, the correct conclusion is **evaluation infrastructure
hardened, deterministic public qualification complete for one ToolSandbox
scenario, behavioral execution incomplete, causal claim unproven**.

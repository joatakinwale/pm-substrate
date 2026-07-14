# Public benchmark program status — 2026-07-13

## Decision

**The public causal benefit of pm-substrate remains unproven.** All six roadmap
items received concrete implementation, research, or verification work, but
that is not six completed proof steps. ToolSandbox now has fresh raw
cross-verified headline and lost-response triplets over a real authenticated
sidecar and provider-process restart. They use deterministic
`PmScriptedStateProbe`, however, and both eligibility assessments correctly
remain false. STATE-Bench still has procedure/output-shape conformance but no
verifiable official execution; the corner harness has no real matched-agent
result; and D7 v4 marks all current signed structured assertions
diagnostic-only and `not_eligible`. PluggedInSocial and ArrowHedge therefore
remain frozen.

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
| Evaluation integrity | Improving, not decision-grade | V3 closes the known v2 detached-summary exploit by replaying Apple's pinned oracle, provider frames, sidecar lifecycle, runtime closure, trajectory/state effects, restart successor, and pinned starting context. The verifier is outcome-neutral, but its runtime and signatures are not independently trusted, and D7 adapter-specific semantic evidence remains incomplete |
| Public causal evidence | Qualification only | One fully retained deterministic headline triplet and one derivative triplet reached the public oracle. They show the mechanism can suppress an exact duplicate, but a scripted probe is not agent-efficacy evidence and the upstream task score showed no arm difference |
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
| 3. STATE-Bench held-out proof | Pinned `microsoft/STATE-Bench@fd980728…`; exact 300-file train byte/procedure provenance; native and sham/substrate parity through the core observation/contract path; exact output inventory; score-shaped output conversion refuses by design | Adapter adversarial suite: 11/11; full pinned upstream Python suite: 148 passed, 1 live skipped. Official scored trajectories: 0 | Current `official_output_shape_and_procedure_conformance_only` receipt is ineligible. Requires 2,250 official trajectories plus raw runner, agent-provider, simulator and judge bytes, request IDs, usage, cost, and latency; local “perfect” JSON cannot substitute |
| 4. Independent corner battery | Four source-pinned adapters plus a matched-arm protocol with one shared runner/config/model, typed treatment deltas, recomputed matching proof, and a fresh arm-blind oracle view | Harness adversarial suite: 24/24. Oracle qualifications: MAB (`399b2534…`), tau2 (`89c5fa85…`), Sentinel (`3a80a27…`), AppWorld (`febefba7…`); no behavioral triplet ran | Every locally produced plan/receipt/verifier result is analysis-ineligible because no independent oracle-invocation proof format/verifier exists. Neutral temp views are not OS sandboxes; future independent review/provider receipts must also rule out host/order/covert-channel leakage |
| 5. Failure-driven Arrowsmith loop | v230 repaired an observed continuity fork; v231 repaired the false-KEEP authority boundary; v232 repaired the observed ToolSandbox bounded-idempotency composition failure without weakening the sidecar's limit or request-byte conflict check | Continuity concurrency ablation passed; fabricated signed D7 facts remain ineligible; v232 preserves the failing `d9cf73c3…` batch and final derivative shows the bounded digest survives restart and suppresses the exact duplicate | Integrity and mechanism evidence, not public benefit. A general substrate repair still requires a non-scripted behavioral failure trace, minimal consumed primitive, ablation, exact rerun, and clean controls |
| 6. Replicate and decide | Task-clustered analysis uses ≥20 deterministic top-ranked tasks/decision phase, 3 seeds/task, 10,000 bootstrap draws, simultaneous ≥0.10 lift over both controls, positive lower bound, ≥0.5 reliability, zero deterministic false blocks/collateral, ≤$10/≤300s absolute and ≤1.25× per-control economics. Future eligibility additionally requires adapter-specific derivation of all 31 facts from bound raw records plus six signed receipts | Analysis/decision suite: 30/30. The generated memo reports `unproven` | Current v4 automation always emits `not_eligible`, with structured assertions diagnostic-only and `ownerAuthorizationRequired=true`. No raw-derived semantic evidence, external preregistration/trust anchor, confirmation, replication, or owner authorization exists |

## Exact external blockers

1. **ToolSandbox efficacy:** the old provider-backed `429 insufficient_quota`
   batch remains preserved history. V3 has now qualified the real sidecar,
   process restart, provider/trajectory bridge, and Apple oracle replay with a
   deterministic probe. A public-efficacy run still requires a funded
   non-scripted provider, retained usage/cost/latency, a trusted oracle replay
   runtime/environment, and an independent verifier signature anchored outside
   the producer bundle.
2. **STATE-Bench:** `STATE_BENCH_EVAL_ENDPOINT`,
   `STATE_BENCH_EVAL_DEPLOYMENTS`, `STATE_BENCH_EVAL_API_KEY`, and the declared
   `STATE_BENCH_AGENT_*` runtime identities are unavailable. A generic API key
   is not substituted for the locked official evaluator.
3. **Corner execution:** no matched model/provider run or independently
   verified OS-isolated oracle execution exists. The local harness cannot prove
   its own semantic parity or absence of covert leakage.
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
2. Instrument the official STATE-Bench runner to retain independently
   verifiable provider/simulator/judge receipts, provision the locked
   credentials, seal the learning artifact, then execute the predeclared 2,250
   trajectories without post-result exclusions.
3. Execute the four corner triplets with provider-resolved model/config/usage
   evidence, independent harness/oracle review, and stronger process isolation.
   Keep untouched headline scores separate from fault injection.
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

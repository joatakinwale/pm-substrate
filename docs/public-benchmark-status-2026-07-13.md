# Public benchmark program status — 2026-07-13

## Decision

**The public causal benefit of pm-substrate remains unproven.** All six roadmap
items received concrete implementation, research, or verification work, but
that is not six completed proof steps. Several new boundaries intentionally
emit no eligible evidence: ToolSandbox is a direct-core adapter without a real
sidecar/provider receipt bridge; STATE-Bench has procedure/output-shape
conformance but no verifiable official execution; the corner harness has no
real matched-agent result; and D7 v4 marks all current signed structured
assertions diagnostic-only and `not_eligible`. PluggedInSocial and ArrowHedge
therefore remain frozen.

Full content hashes for the executed qualifications, failed provider batch,
and continuity repair are preserved in
[`evidence/public-proof-run-register-2026-07-13.json`](./evidence/public-proof-run-register-2026-07-13.json).

This distinction is deliberate:

- implemented means a bounded runner/verifier/research artifact and its tests
  exist, including an explicit refusal where required evidence is unavailable;
- qualified means upstream source/oracle plumbing ran successfully;
- executed means real matched agents reached the benchmark task;
- conditionally evidence-eligible requires sealed confirmation,
  distinct-model replication, adapter-specific derivation of 31 structured
  observations from bound raw records, and all
  six externally authenticated verification receipts; proven additionally
  requires a separate authenticated owner decision over the exact report hash.

## Project evaluation

| Dimension | Assessment | Why |
|---|---|---|
| PM-layer/product thesis | Coherent, still falsifiable | A protocol sidecar that makes current project state and admission explicit is a plausible mechanism; the roadmap now states a causal task-outcome claim rather than treating governance activity as value |
| Core engineering/conformance | Strong | Typed boundaries, replay, migration isolation, zero-edit checks, and 1,059 repository tests make accidental regressions visible; the live continuity fork also proved dogfooding can expose a real defect |
| Evaluation integrity | Improving, not decision-grade | Matching, provenance, transition replay, blind-oracle handling, preregistration, and authority separation are substantially stronger, but adapter-specific semantic evidence and externally rooted organizational identities are not complete |
| Public causal evidence | Absent | No eligible native/sham/substrate public task triplet has reached the outcome oracle, so the effect size, failure modes, and repair target are all unknown |
| Generalization/replication | Absent | There is no confirmatory set, second model/benchmark result, or clean independent reproduction |
| Business readiness | Intentionally unevaluated | The two apps are frozen; even a future public result would justify only a separately scoped transfer test, not demand, revenue, or investment-performance claims |

The project is therefore credible as a **mechanism prototype with unusually
explicit falsification controls**, but not yet as a proven agent-state product.
Its largest risk is continuing to improve evidence infrastructure faster than
it produces the first eligible behavioral observation. The next milestone is
not another abstraction: it is one fully retained, independently replayable
public triplet that either shows a substrate/control difference or gives the
Arrowsmith loop a concrete failure to repair.

## Six-step execution register

| Step | Implementation | What actually ran | Proof status / next gate |
|---|---|---|---|
| 1. Evidence integrity reset | Local labs are `mechanism_conformance_only`; exact pair identity, expected-allow checks, allow-all/block-all mutants, deterministic top-ranked task selection, immutable arm interventions, initial environment, randomized order, signed preregistration/attempt-time bindings, versioned structured assertions, and fixed guardrails ship | Live Ollama suite `suite_6cf46d7e-a3fe-46ce-a5dc-4fc57f2a8ed8`: 22 scenarios/22 exact pairs; expected-block 12/12; expected-allow 10/10; both mutants rejected. Analysis/decision adversarial suite: 30/30 | Conformance and gate integrity only. Internally consistent signed facts remain diagnostic-only and `not_eligible`; no local result can establish public efficacy or authorize KEEP |
| 2. ToolSandbox slice | Pinned `apple/ToolSandbox@165848b9…` runner plus raw-verification v2; upstream-only oracle; transition/state replay rejects self-consistent forged traces; execution classification is hash-bound; current D7 converter fails closed | One old v1 three-arm derivative batch, order substrate → native → sham. Every arm stopped before the first action on provider `429 insufficient_quota`; scheduled fault not reached. v2 focused tests: 16/16 | Old batch is rejected as D7 evidence. Current path is a direct core peripheral adapter, not HTTP/MCP sidecar; restart is same-process role reinstantiation, not OS-process restart. Missing provider bytes/IDs/usage/cost/latency, exact task/oracle bytes, real-sidecar receipt, and independent anchor mean zero eligible attempts |
| 3. STATE-Bench held-out proof | Pinned `microsoft/STATE-Bench@fd980728…`; exact 300-file train byte/procedure provenance; native and sham/substrate parity through the core observation/contract path; exact output inventory; score-shaped output conversion refuses by design | Adapter adversarial suite: 11/11; full pinned upstream Python suite: 148 passed, 1 live skipped. Official scored trajectories: 0 | Current `official_output_shape_and_procedure_conformance_only` receipt is ineligible. Requires 2,250 official trajectories plus raw runner, agent-provider, simulator and judge bytes, request IDs, usage, cost, and latency; local “perfect” JSON cannot substitute |
| 4. Independent corner battery | Four source-pinned adapters plus a matched-arm protocol with one shared runner/config/model, typed treatment deltas, recomputed matching proof, and a fresh arm-blind oracle view | Harness adversarial suite: 24/24. Oracle qualifications: MAB (`399b2534…`), tau2 (`89c5fa85…`), Sentinel (`3a80a27…`), AppWorld (`febefba7…`); no behavioral triplet ran | Every locally produced plan/receipt/verifier result is analysis-ineligible because no independent oracle-invocation proof format/verifier exists. Neutral temp views are not OS sandboxes; future independent review/provider receipts must also rule out host/order/covert-channel leakage |
| 5. Failure-driven Arrowsmith loop | v230 repaired an observed dogfood continuity fork through advisory serialization, graph-head rules, deterministic sequence, append-only merge, and adversarial replay. v231 repaired the false-KEEP authority boundary using preregistration, external assessment, and owner decision as separate authorities | 24-writer concurrency ablation and live-ledger repair pass; fake merges and killed transactions reject correctly. A fully signed D7 fixture with 363 attempts but fabricated self-consistent `1/1` facts is now explicitly ineligible | Both are integrity/method evidence, not public benefit. The D6-E causal repair remains blocked until a public behavioral failure trace exposes a general primitive gap |
| 6. Replicate and decide | Task-clustered analysis uses ≥20 deterministic top-ranked tasks/decision phase, 3 seeds/task, 10,000 bootstrap draws, simultaneous ≥0.10 lift over both controls, positive lower bound, ≥0.5 reliability, zero deterministic false blocks/collateral, ≤$10/≤300s absolute and ≤1.25× per-control economics. Future eligibility additionally requires adapter-specific derivation of all 31 facts from bound raw records plus six signed receipts | Analysis/decision suite: 30/30. The generated memo reports `unproven` | Current v4 automation always emits `not_eligible`, with structured assertions diagnostic-only and `ownerAuthorizationRequired=true`. No raw-derived semantic evidence, external preregistration/trust anchor, confirmation, replication, or owner authorization exists |

## Exact external blockers

1. **ToolSandbox:** the configured OpenAI account returned `429
   insufficient_quota` for every randomized arm before the benchmark could
   exercise the task or injected fault. This is a provider-execution blocker,
   not a substrate failure or success. Even a funded rerun remains ineligible
   until the real sidecar protocol, actual process restart, and provider/raw
   receipt bridge are implemented and independently verified.
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

1. Complete ToolSandbox's real HTTP/MCP sidecar and provider/raw-evidence bridge,
   replace role reinstantiation with an OS-process restart, fund the provider,
   externally preregister a new manifest, then run the unchanged headline and
   derivative triplets. Preserve the quota-failed attempts.
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
hardened, public execution incomplete, causal claim unproven**.

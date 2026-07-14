# STATE-Bench public adapter

This peripheral package binds pm-substrate to the official STATE-Bench Agent
Learning Track without changing benchmark tasks, environments, tools,
simulator, judge, or scoring. It pins:

- repository: `microsoft/STATE-Bench`
- revision: `fd980728da482af21f0d33406aea0ac499645125`
- license: MIT
- package version: `0.8.0`
- protocol: `state_bench_v0.8.0_gpt54`
- protocol SHA-256:
  `e4a97cab2b2ed31ec180f671f4b5e5760c00cf30cc56d4cf717481e7a0d29a0c`

The adapter now implements a phase-safe planning and verification protocol. It
does **not** implement raw provider transport capture, and no official
STATE-Bench efficacy run has been completed or made eligible through this
package. Plans, seals, bound configs, preflights, output-shape checks, and raw
bundle verification are evidence-integrity controls; they are not behavioral
evidence by themselves.

## Evidence boundary

The PM-layer claim is causal: the substrate arm must improve the benchmark's
own strict task outcome over matched native and sham controls. Retrieval calls,
audit rows, blocks, receipts, and internally consistent JSON are mechanism
diagnostics only. They cannot substitute for the unchanged official oracle.

The package currently exposes three deliberately limited evidence classes:

- `adapter_conformance_only` proves that the pinned loader and retrieval seam
  accept the adapter.
- `official_output_shape_and_procedure_conformance_only` reopens a complete
  decision-phase output tree and recomputes its caller-authored score fields.
  It does not prove that the declared providers, models, simulator, or judge
  produced those bytes.
- `state_bench_raw_execution_evidence` verifies a strict raw-evidence bundle.
  A producer-local bundle remains ineligible. An externally authenticated
  bundle can establish authenticated raw evidence, but conversion to a
  `PublicEvalAttemptArtifact` remains intentionally closed.

`convert-to-public-attempt` therefore always fails closed. There is no eligible
official result yet.

## Phase-safe protocol

| Phase | Task source | Fixed scope | Evidence status |
|---|---|---:|---|
| Technical qualification | Deterministically selected train tasks | 20 tasks per domain, 60 task clusters total | Always ineligible for efficacy or a decision |
| Qualification learning extraction | Remaining train trajectories | 80 tasks per domain, disjoint from the 20 qualification tasks | Provenance input only; not an outcome |
| Confirmation | Complete official test split | 50 tasks per domain × 3 arms × 5 repeats = 2,250 trajectory slots | Decision evidence only after preregistration and raw verification |
| Replication | The same complete test split with a distinct model ID and digest | Another 2,250 trajectory slots | Required before a keep decision |

The confirmation and replication manifests each contain 150 task clusters.
The statistical unit is the task cluster, stratified by domain—not 2,250
independent observations. The five labels `run-index-1` through `run-index-5`
are stochastic repeat identities used for pairing. STATE-Bench exposes no
sampling seed, so these labels must never be described as provider seeds.

Qualification and decision planning are intentionally separate:

1. A `pm-state-bench-qualification-plan.v1` deterministically partitions each
   100-task train domain into 20 qualification tasks and 80 extraction tasks.
2. Qualification may tune the harness and establish technical feasibility. It
   may not inspect or establish efficacy on the test split.
3. After qualification, a
   `pm-state-bench-decision-manifest-bridge.v1` creates a generic public-eval
   manifest containing no qualification entries and exactly all 150 test
   tasks, once for confirmation and once for replication.
4. Decision execution is refused until an external Ed25519 preregistration
   receipt verifies against a trust policy whose expected hash is pinned
   outside the result bundle.

If test outcomes are inspected and then used to repair or tune the system, the
test phase is no longer confirmatory. Repeating it does not restore the
held-out claim; use another benchmark, split, or genuinely untouched
replication axis.

## Treatment arms

- **Native:** upstream `StateBenchAgent`; no retrieval tool, learning artifact,
  or sidecar. Native raw evidence must show zero retrievals and no sidecar
  observation audit.
- **Sham:** `PmSubstrateAgent` through the same sidecar shape and retrieval
  boundary as substrate, but with three disjoint, irrelevant train learnings.
- **Substrate:** the same boundary with the three highest-ranked applicable
  train learnings.

The qualification plan and decision bridge bind distinct intervention hashes,
implementation revisions, and equal sham/substrate sidecar-shape expectations.
The Python adapter discards upstream's oracle-bearing `task_summary`,
`state_requirements`, and `task_requirements` runtime fields and retains only
`task_id` and `domain`. Eligible evidence would still require an attested exact
adapter/runtime closure proving that this is the code that ran.

## Important upstream traps

The pinned upstream command defaults are unsafe for this protocol:

- `run_batch.py` defaults to `--split all`, which runs all 150 tasks in a
  domain—100 train plus 50 test.
- `compute_metrics.py` also defaults to `--split all`.
- `run_batch.py` defaults to three worker retry attempts, while decision phases
  bind one task attempt and one provider attempt per planned cell.
- Upstream rejects exact `--tasks` selection with `--split train` or
  `--split test`; its parser accepts exact tasks only when the split value stays
  at `all`. The command plan therefore binds one verified task ID per cell and
  emits `--tasks <id> --split all`. In that exact-task form, `all` is a
  parser-compatibility sentinel—not authority to select train plus test.
- Upstream run indices are not sampling seeds, and reported model names are not
  cryptographic proof of the provider's actual model or deployment.

Never rely on the split name or upstream default as the task-selection
authority. Qualification uses only the exact 20 train IDs in its bound config;
confirmation and replication use only the exact 50 test IDs per domain. The
package emits and verifies a deterministic per-cell command plan, but it does
not execute that plan or instrument the upstream/provider transports. A manual
`run_batch.py` invocation remains conformance work, not eligible execution.

## Build and verify the pinned checkout

Keep the upstream checkout clean. The verifier permits only the exact packaged
`agents/pm_substrate_agent.py` as an untracked file; keep virtual environments,
credentials, outputs, artifacts, and audit logs outside the checkout.

```bash
pnpm --filter @pm/public-eval-state-bench build

node packages/public-eval-state-bench/dist/cli.js verify-checkout \
  --checkout /path/to/STATE-Bench
```

`verify-checkout` reopens the Git checkout, protocol, split manifests, task
definitions, initial environments, and all 300 public train trajectories.

## 1. Create the deterministic qualification plan

Prepare a qualification input before extracting learnings or running any task.
The following is a complete shape example; replace every `SHA256_OF_*` token
with the lowercase SHA-256 of the actual frozen component, model resolution, or
intervention. Placeholder hashes are intentionally not accepted by the CLI.

```json
{
  "planId": "state_bench_qualification_001",
  "experimentId": "state_bench_public_proof_001",
  "producerIdentity": "joat_labs",
  "frozenAt": "2026-07-14T01:00:00.000Z",
  "selectionSeed": "state-bench-train-partition-001",
  "qualificationTasksPerDomain": 20,
  "execution": {
    "agentModel": {
      "modelId": "exact-qualification-model-id",
      "modelDigest": "SHA256_OF_RESOLVED_QUALIFICATION_MODEL",
      "reasoningLevel": "high"
    },
    "components": {
      "systemPromptHash": "SHA256_OF_SYSTEM_PROMPT",
      "toolsHash": "SHA256_OF_TOOLS",
      "simulatorHash": "SHA256_OF_SIMULATOR",
      "judgeHash": "SHA256_OF_JUDGE",
      "decodingHash": "SHA256_OF_DECODING_CONFIG",
      "runnerHash": "SHA256_OF_RUNNER",
      "adapterHash": "SHA256_OF_ADAPTER"
    },
    "arms": {
      "native": {
        "interventionHash": "SHA256_OF_NATIVE_INTERVENTION",
        "implementationRevision": "SHA256_OF_NATIVE_IMPLEMENTATION",
        "sidecarShapeHash": "SHA256_OF_NO_SIDECAR_SHAPE",
        "expectedToolCalls": 0,
        "expectedPromptTokens": 0,
        "expectedAddedLatencyMs": 0
      },
      "sham": {
        "interventionHash": "SHA256_OF_SHAM_INTERVENTION",
        "implementationRevision": "SHA256_OF_SHAM_IMPLEMENTATION",
        "sidecarShapeHash": "SHA256_OF_MATCHED_SIDECAR_SHAPE",
        "expectedToolCalls": 1,
        "expectedPromptTokens": 200,
        "expectedAddedLatencyMs": 10
      },
      "substrate": {
        "interventionHash": "SHA256_OF_SUBSTRATE_INTERVENTION",
        "implementationRevision": "SHA256_OF_SUBSTRATE_IMPLEMENTATION",
        "sidecarShapeHash": "SHA256_OF_MATCHED_SIDECAR_SHAPE",
        "expectedToolCalls": 1,
        "expectedPromptTokens": 200,
        "expectedAddedLatencyMs": 10
      }
    },
    "repeatLabels": ["qualification-repeat-1"],
    "armRandomizationSeed": "qualification-arm-order-001",
    "policy": {
      "maxTaskAttemptsPerCell": 1,
      "maxProviderAttemptsPerCall": 1,
      "failedCellsCountAsStrictFailure": true,
      "replacementAttempts": "forbidden",
      "stoppingRule": "complete_fixed_schedule_or_invalidate",
      "outcomeInspection": "after_phase_complete",
      "workers": 1,
      "maximumTotalCostUsd": 1000,
      "maximumWallClockMs": 86400000
    }
  }
}
```

Create, independently re-open, and inspect the plan and its arm-randomized
attempt schedule:

```bash
node packages/public-eval-state-bench/dist/cli.js create-qualification-plan \
  --checkout /path/to/STATE-Bench \
  --input /path/to/qualification-input.json \
  > /path/to/qualification-plan.json

node packages/public-eval-state-bench/dist/cli.js verify-qualification-plan \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json

node packages/public-eval-state-bench/dist/cli.js qualification-schedule \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  > /path/to/qualification-schedule.json
```

With the one repeat in the example, the plan contains 60 task clusters and 180
arm cells. Adding repeat labels increases technical cost but never changes the
qualification phase's ineligible status.

## 2. Extract and seal train-only learnings

For qualification, learning artifacts may cite only the 80 extraction
trajectories selected for the same domain. The 20 reserved qualification tasks
and every test task are forbidden sources. Verify that boundary explicitly:

```bash
node packages/public-eval-state-bench/dist/cli.js \
  verify-qualification-artifact-sources \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --artifact /path/to/qualification-learnings.json
```

After technical qualification is complete, a separately sealed decision
artifact may use the complete 100-task train split. It still may not cite test
tasks.

Seal the artifact against the pinned checkout:

```bash
node packages/public-eval-state-bench/dist/cli.js seal-artifact \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  > /path/to/learnings.seal.json

node packages/public-eval-state-bench/dist/cli.js verify-artifact \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json
```

Freeze the extractor source, prompt, tools, decoding config, and model or
deterministic extractor identity before extraction:

```bash
node packages/public-eval-state-bench/dist/cli.js create-extraction-manifest \
  --manifest-id state-bench-learning-extraction-v1 \
  --declared-at 2026-07-14T01:05:00.000Z \
  --extractor-kind model \
  --extractor-source-revision <git-revision> \
  --extractor-source /path/to/extractor-source \
  --model-id <exact-model-id> \
  --model-digest <64-lowercase-hex> \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  > /path/to/extraction.pipeline.json

node packages/public-eval-state-bench/dist/cli.js verify-extraction-manifest \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json
```

For a deterministic extractor, replace `--model-id` and `--model-digest` with
`--deterministic-extractor-id`. Retain each unmodified extractor output and
record it in artifact-entry order:

```bash
node packages/public-eval-state-bench/dist/cli.js record-extraction \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --learning-id <learning-id> \
  --sequence 1 \
  --recorded-at 2026-07-14T01:06:00.000Z \
  --raw-output /path/to/raw-extractor-output \
  > /path/to/raw-records/0001-<learning-id>.json

node packages/public-eval-state-bench/dist/cli.js seal-extraction \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records \
  > /path/to/extraction.provenance.json

node packages/public-eval-state-bench/dist/cli.js verify-extraction \
  --checkout /path/to/STATE-Bench \
  --artifact /path/to/learnings.json \
  --seal /path/to/learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records \
  --extraction-provenance /path/to/extraction.provenance.json
```

These checks prove declared file identity, citation membership, and receipt
recomputation. They do not prove that an external extractor process was
physically isolated from undeclared files or that its free-text derivation is
semantically correct.

## 3. Create the separate decision manifest bridge

Create the bridge only after freezing the technical qualification plan. Its
input binds a confirmatory model, a distinct replication model, all non-model
components, matched arm treatments, fixed limits, and six verifier identities.
Both model ID and digest must differ between confirmation and replication.

The complete accepted shape is represented by
`src/decision-manifest.test.ts`. The key fields are:

```json
{
  "frozenAt": "2026-07-14T02:00:00.000Z",
  "harnessRevision": "SHA256_OF_HARNESS_REVISION",
  "substrateRevision": "SHA256_OF_SUBSTRATE_REVISION",
  "selectionSeed": "complete-official-test-universe",
  "armRandomizationSeed": "decision-arm-order-001",
  "confirmatoryModel": {
    "modelId": "exact-confirmatory-model-a",
    "modelDigest": "SHA256_OF_RESOLVED_CONFIRMATORY_MODEL_A",
    "reasoningLevel": "high"
  },
  "replicationModel": {
    "modelId": "exact-replication-model-b",
    "modelDigest": "SHA256_OF_RESOLVED_REPLICATION_MODEL_B",
    "reasoningLevel": "high"
  },
  "decisionComponents": {
    "systemPromptHash": "SHA256_OF_SYSTEM_PROMPT",
    "toolsHash": "SHA256_OF_TOOLS",
    "simulatorHash": "SHA256_OF_SIMULATOR",
    "judgeHash": "SHA256_OF_JUDGE",
    "decodingHash": "SHA256_OF_DECODING_CONFIG",
    "runnerHash": "SHA256_OF_EXPLICIT_TEST_NO_RETRY_RUNNER"
  },
  "decisionLearningArtifactSealHash": "SHA256_OF_DECISION_ARTIFACT_SEAL",
  "decisionLearningExtractionProvenanceReceiptHash": "SHA256_OF_DECISION_EXTRACTION_RECEIPT",
  "arms": {
    "native": {
      "stateMode": "native",
      "interventionHash": "SHA256_OF_NATIVE_INTERVENTION",
      "implementationRevision": "SHA256_OF_NATIVE_IMPLEMENTATION",
      "sidecarShapeHash": "SHA256_OF_NO_SIDECAR_SHAPE",
      "expectedToolCalls": 0,
      "expectedPromptTokens": 0,
      "expectedAddedLatencyMs": 0
    },
    "sham": {
      "stateMode": "irrelevant_sham",
      "interventionHash": "SHA256_OF_SHAM_INTERVENTION",
      "implementationRevision": "SHA256_OF_SHAM_IMPLEMENTATION",
      "sidecarShapeHash": "SHA256_OF_MATCHED_SIDECAR_SHAPE",
      "expectedToolCalls": 1,
      "expectedPromptTokens": 200,
      "expectedAddedLatencyMs": 10
    },
    "substrate": {
      "stateMode": "pm_substrate",
      "interventionHash": "SHA256_OF_SUBSTRATE_INTERVENTION",
      "implementationRevision": "SHA256_OF_SUBSTRATE_IMPLEMENTATION",
      "sidecarShapeHash": "SHA256_OF_MATCHED_SIDECAR_SHAPE",
      "expectedToolCalls": 1,
      "expectedPromptTokens": 200,
      "expectedAddedLatencyMs": 10
    }
  },
  "decisionVerification": {
    "attempt_set": {"verifierId": "state_attempt_set", "sourceRevision": "SHA256_OF_VERIFIER_SOURCE"},
    "oracle_independence": {"verifierId": "state_oracle", "sourceRevision": "SHA256_OF_VERIFIER_SOURCE"},
    "split_leakage": {"verifierId": "state_split", "sourceRevision": "SHA256_OF_VERIFIER_SOURCE"},
    "anti_degenerate_controls": {"verifierId": "state_controls", "sourceRevision": "SHA256_OF_VERIFIER_SOURCE"},
    "restart_dynamic_state": {"verifierId": "state_restart", "sourceRevision": "SHA256_OF_VERIFIER_SOURCE"},
    "clean_checkout": {"verifierId": "state_checkout", "sourceRevision": "SHA256_OF_VERIFIER_SOURCE"}
  },
  "bootstrapSeed": "state-bench-bootstrap-001",
  "executionLimits": {
    "maximumTotalCostUsd": 20000,
    "maximumWallClockMs": 604800000
  }
}
```

As above, replace every `SHA256_OF_*` placeholder with a real lowercase digest.
Then create and re-open the bridge:

```bash
node packages/public-eval-state-bench/dist/cli.js create-decision-manifest \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --input /path/to/decision-input.json \
  > /path/to/decision-manifest.json

node packages/public-eval-state-bench/dist/cli.js verify-decision-manifest \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json
```

The resulting generic manifest has an eligible universe of exactly the 150
test-task content hashes, a selection count of 150, 150 confirmatory entries,
and 150 replication entries. It remains
`requires_external_preregistration_before_execution`.

## 4. Externally preregister before decision execution

Use `@pm/public-eval-analysis` to create an Ed25519 trust policy and signed
preregistration receipt for the bridge's embedded `analysisManifest`. The
preregistration authority owner must differ from the experiment producer. Pin
the resulting policy hash in owner-controlled CI, configuration, or another
channel outside the result bundle.

```bash
node packages/public-eval-analysis/dist/cli.js trust-policy \
  /path/to/trust-policy-input.json \
  > /path/to/trust-policy.json

node packages/public-eval-analysis/dist/cli.js preregister \
  /path/to/preregistration-input.json \
  /secure/path/to/authority-ed25519-private-key.pem \
  > /path/to/preregistration-receipt.json

export PM_PUBLIC_EVAL_TRUST_POLICY_SHA256=<owner-pinned-policy-sha256>
```

The signing key must not be committed to this repository. See
`../public-eval-analysis/README.md` for the trust-policy and receipt schemas.
Self-signing with a caller-selected policy does not establish independent
authority.

## 5. Derive bound v3 run configs

Do not hand-author a `pm-state-bench-run-config.v3`. The binding command derives
its model, split, exact task IDs, run labels, arm intervention, schedule,
component, execution-policy, and runtime-closure hashes from the phase plan.
Legacy v2 configs are rejected.

Qualification native input:

```json
{
  "phase": "qualification",
  "arm": "native",
  "domain": "travel",
  "preregistrationReceiptHash": null,
  "artifactSealHash": null,
  "extractionProvenanceHash": null
}
```

```bash
node packages/public-eval-state-bench/dist/cli.js create-bound-config \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --input /path/to/qualification-native-travel-binding.json \
  > /path/to/qualification-native-travel.config.json
```

For qualification sham or substrate, keep the phase and domain but supply the
verified qualification artifact seal and extraction-provenance receipt hashes.

Decision substrate input:

```json
{
  "phase": "confirmatory",
  "arm": "substrate",
  "domain": "customer_support",
  "preregistrationReceiptHash": "SHA256_OF_VERIFIED_PREREGISTRATION_RECEIPT"
}
```

```bash
node packages/public-eval-state-bench/dist/cli.js create-bound-config \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json \
  --input /path/to/confirmatory-substrate-customer-support-binding.json \
  > /path/to/confirmatory-substrate-customer-support.config.json

node packages/public-eval-state-bench/dist/cli.js verify-bound-config \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json \
  --config /path/to/confirmatory-substrate-customer-support.config.json
```

Decision inputs never accept caller-selected artifact hashes. The bridge derives
the frozen decision artifact seal and extraction-provenance receipt for sidecar
arms and derives `null` for native. Replication changes only `phase` to
`replication`; the bridge derives the distinct replication model. Create one
config per phase, arm, and domain.

## 6. Run the execution preflight

Qualification preflight deliberately returns
`technical_qualification_ineligible` and forbids decision-authority inputs:

```bash
node packages/public-eval-state-bench/dist/cli.js preflight-execution \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --config /path/to/qualification-native-travel.config.json
```

Confirmation and replication require the bridge, receipt, trust policy, and
the out-of-band expected policy hash:

```bash
node packages/public-eval-state-bench/dist/cli.js preflight-execution \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json \
  --preregistration-receipt /path/to/preregistration-receipt.json \
  --trust-policy /path/to/trust-policy.json \
  --trust-policy-hash "$PM_PUBLIC_EVAL_TRUST_POLICY_SHA256" \
  --config /path/to/confirmatory-substrate-customer-support.config.json
```

A successful decision preflight reports
`externally_preregistered_execution_ready`. That means only that the declared
execution is authorized to start. It is not evidence eligibility and does not
prove that an attempt ran.

## 7. Freeze the exact per-cell command plan

Create one input containing all nine verified configs for exactly one phase,
plus an absolute output root outside the checkout and the loopback retrieval
endpoint used by the two sidecar arms:

```json
{
  "runConfigs": [
    "THE_9_FULL_BOUND_CONFIG_OBJECTS_FOR_ONE_PHASE"
  ],
  "outputRoot": "/outside/checkout/state-bench/confirmatory",
  "retrievalUrl": "http://127.0.0.1:4319"
}
```

The array contains config objects, not filenames or the placeholder string
shown above. The CLI preflights every config, requires one config for each
arm/domain coordinate, reconstructs the frozen randomized schedule, and emits
one command per task/repeat/arm cell:

```bash
node packages/public-eval-state-bench/dist/cli.js \
  create-execution-command-plan \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json \
  --preregistration-receipt /path/to/preregistration-receipt.json \
  --trust-policy /path/to/trust-policy.json \
  --trust-policy-hash "$PM_PUBLIC_EVAL_TRUST_POLICY_SHA256" \
  --input /path/to/confirmatory-command-input.json \
  > /path/to/confirmatory-command-plan.json

node packages/public-eval-state-bench/dist/cli.js \
  verify-execution-command-plan \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json \
  --preregistration-receipt /path/to/preregistration-receipt.json \
  --trust-policy /path/to/trust-policy.json \
  --trust-policy-hash "$PM_PUBLIC_EVAL_TRUST_POLICY_SHA256" \
  --input /path/to/confirmatory-command-input.json \
  --command-plan /path/to/confirmatory-command-plan.json
```

For a decision phase the plan contains exactly 2,250 commands. Each command
binds the exact task ID, repeat identity, arm order, config hash, intervention,
secret-free sidecar identity environment, argv, output path, and command hash.
The plan deliberately does not contain credentials. It also does not launch a
process, sanitize inherited environment variables, reject an already populated
output cell, disable hidden provider-client retries, or capture transports.
Those are executor obligations and remain open.

## Retrieval sidecar for conformance runs

Copy the packaged Python adapter byte-for-byte to the pinned checkout as
`agents/pm_substrate_agent.py`. Native uses upstream `StateBenchAgent` and must
not start a sidecar. A sidecar decision run requires the same preflight inputs:

```bash
node packages/public-eval-state-bench/dist/cli.js serve \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json \
  --preregistration-receipt /path/to/preregistration-receipt.json \
  --trust-policy /path/to/trust-policy.json \
  --trust-policy-hash "$PM_PUBLIC_EVAL_TRUST_POLICY_SHA256" \
  --artifact /path/to/decision-learnings.json \
  --seal /path/to/decision-learnings.seal.json \
  --pipeline-manifest /path/to/extraction.pipeline.json \
  --extractor-source /path/to/extractor-source \
  --prompt /path/to/prompt \
  --tools /path/to/tools.json \
  --decoding /path/to/decoding.json \
  --raw-records /path/to/raw-records \
  --extraction-provenance /path/to/extraction.provenance.json \
  --config /path/to/confirmatory-substrate-customer-support.config.json \
  --run-index 1 \
  --audit-log /outside/checkout/audits/run1.jsonl \
  --port 4319
```

Use the printed config hash/run identity to set the adapter's non-secret
identity variables:

```text
PM_STATE_BENCH_EXPERIMENT_ID
PM_STATE_BENCH_CONFIG_SHA256
PM_STATE_BENCH_RUN_ID
PM_STATE_BENCH_MODEL_ID
PM_STATE_BENCH_RETRIEVAL_URL
```

The sidecar authenticates retrieval identity and writes an immutable local
audit chain. It does not capture the official runner or provider transports and
does not make a manual upstream invocation eligible.

## Decision output conformance

`collect-output` applies only to confirmation and replication. Qualification
requires a separate technical receipt path and is intentionally rejected by
the official held-out collector.

For each decision arm/domain, the output root must contain only `run1` through
`run5`, `metrics.json`, and `failures.json`. Each run must contain exactly the
50 bound test tasks. `failures.json` is required even when empty:

```json
{"schemaVersion":"pm-state-bench-failures.v1","records":[]}
```

Native collection, with decision preflight:

```bash
node packages/public-eval-state-bench/dist/cli.js collect-output \
  --checkout /path/to/STATE-Bench \
  --qualification-plan /path/to/qualification-plan.json \
  --decision-manifest /path/to/decision-manifest.json \
  --preregistration-receipt /path/to/preregistration-receipt.json \
  --trust-policy /path/to/trust-policy.json \
  --trust-policy-hash "$PM_PUBLIC_EVAL_TRUST_POLICY_SHA256" \
  --results /outside/checkout/results/confirmatory/native/travel \
  --config /path/to/confirmatory-native-travel.config.json \
  > /path/to/confirmatory-native-travel.output-receipt.json
```

Sham/substrate collection also requires `--audit-root`, `--artifact`, `--seal`,
`--pipeline-manifest`, `--extractor-source`, `--prompt`, `--tools`,
`--decoding`, `--raw-records`, and `--extraction-provenance`. Re-run the same
arguments with `verify-output` and add:

```text
--receipt /path/to/output-receipt.json
```

The collector reopens 250 trajectories for one arm/domain, checks the exact
task/run/config/model identities, verifies sidecar audit correspondence, and
recomputes aggregate fields. These are still caller-authored trajectory fields;
output conformance is not proof that the provider, simulator, or judge calls
occurred.

## Raw evidence contract and verification

The package defines a strict `pm-state-bench-raw-evidence.v1` verifier. A valid
bundle must retain, among other fields:

- the exact planned phase, split, tasks, repeats, arm treatments, role runtime
  identities, and no-selective-stopping retry policy;
- the exact execution-command-plan roots/count and, for every raw attempt, the
  corresponding command sequence, cell ID, and command hash;
- one runtime closure per arm, including runner, lockfile, runtime-module, and
  sidecar-adapter bytes when that arm has an adapter;
- every planned cell and every retry in one append-only attempt chain;
- terminal failures as strict false, without replacement or dropped cells;
- exact base64 request/response bytes and hashes, provider request IDs, actual
  model/deployment/configuration identities, timestamps, latency, usage, cost,
  and failure bytes for runner, agent, simulator, and judge role captures;
- initial and final environment snapshots, state diff, every tool-call byte,
  and a producer-local replay ledger whose declared recomputed snapshot hash
  matches the captured final snapshot;
- native treatment uptake with zero retrievals and no sidecar audit; and
- every sham/substrate attempt with at least one exact sidecar request/response
  plus an observation-boundary audit tied to the exact subsequent agent
  exchange.

Verify a producer-local bundle:

```bash
node packages/public-eval-state-bench/dist/cli.js verify-raw-evidence \
  --bundle /path/to/state-bench.raw-evidence.json
```

If structurally valid, this reports
`producer_local_capture_ineligible`. That producer-local replay binding is not
an independently executed clean replay. To establish independent raw authority,
supply both an independently controlled Ed25519 policy and the separately
reopened execution command plan, with both expected hashes pinned out of band:

```bash
export PM_STATE_BENCH_RAW_TRUST_POLICY_SHA256=<externally-pinned-policy-sha256>
export PM_STATE_BENCH_COMMAND_PLAN_SHA256=<externally-pinned-command-plan-sha256>

node packages/public-eval-state-bench/dist/cli.js verify-raw-evidence \
  --bundle /path/to/state-bench.raw-evidence.json \
  --external-trust-policy /path/to/state-bench-raw-trust-policy.json \
  --expected-policy-hash "$PM_STATE_BENCH_RAW_TRUST_POLICY_SHA256" \
  --execution-command-plan /path/to/confirmatory-command-plan.json \
  --expected-command-plan-hash "$PM_STATE_BENCH_COMMAND_PLAN_SHA256"
```

Successful external authentication can report
`independently_authenticated_raw_evidence`, but
`publicEvalAttemptEligible` remains `false`. Authentication proves who attested
to the captured bundle and that its complete cell inventory binds the separately
pinned commands; it does not independently rerun the tools, derive official
judge scores from response bytes, prove causal lift, or authorize a decision.

Critically, this repository currently supplies the verifier contract—not the
instrumented runner/provider capture implementation that would produce these
records. Hand-authored fixtures, mocks, synthetic perfect scores, local judges,
or a self-selected trust policy are not substitutes. Eligible evidence still
requires real capture, independent replay/verification, task-clustered matched
analysis, confirmation, distinct-model replication, and separate owner
authorization of the final report hash.

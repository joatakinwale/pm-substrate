# Public eval corners

This peripheral package pins source provenance, checks adapter semantics, and
provides a fail-closed matched-arm evidence harness for four public agent-state
corner evaluations:

- MemoryAgentBench FactConsolidation `sh_6k` and `mh_6k`
- tau2 airline task `32`
- AppWorld task `22cc237_2`
- SentinelBench MicroHub relative, no-op, and absolute star monitoring

The package includes one narrowly scoped, real-browser Sentinel qualification
agent but no credentials and no claim that the substrate improves behavior.
Other live agent and oracle commands are supplied by an external experiment
manifest. The harness executes them and preserves raw evidence without
interpreting the oracle outcome. The existing JSON fixtures are original,
PM-authored synthetic examples. They contain no upstream task records, answers,
prompts, databases, or protected AppWorld material.

There are three intentionally separate evidence classes:

- `qualify` is an adapter/oracle-plumbing diagnostic. Its receipt is always
  non-gating.
- `protocol-conformance` exercises the harness with PM-authored fixture commands.
  It is always ineligible for efficacy analysis, even if every command exits 0.
- `behavioral-efficacy-candidate` requests the live matched-arm protocol and
  requires an exact pinned, clean upstream checkout plus an upstream-owned
  oracle binding. The name does not admit the resulting local receipt as
  efficacy evidence. A caller-supplied wrapper can bundle upstream source bytes
  without invoking them, so every current plan and receipt remains
  `eligibleForIndependentAnalysis: false` and `decisionGating: false`.

AppWorld's protected bundles have an additional encrypted-public-redistribution
requirement. This package records only the public code revision, data version,
task identifier, and oracle limitation; it never copies decrypted material.

After building, the CLI exposes every runtime operation exported by the package:

```bash
node dist/cli.js list
node dist/cli.js manifest --corner tau2-airline-32
node dist/cli.js qualification-plan --corner tau2-airline-32
node dist/cli.js verify-source --corner tau2-airline-32 --checkout /path/to/tau2
node dist/cli.js verify-files --spec /path/to/synthetic-file-spec.json
node dist/cli.js validate-label --input /path/to/label.json
node dist/cli.js conformance --input fixtures/sentinel-stars.synthetic.json
node dist/cli.js diagnose-appworld --input /path/to/synthetic-projection.json
node dist/cli.js qualify --corner memoryagentbench-factconsolidation-6k \
  --checkout /path/to/memoryagentbench \
  --external mab-conflict-parquet=/path/to/memory_conflict.parquet \
  --output-dir /tmp/pm-public-eval/mab
node dist/cli.js qualify --corner tau2-airline-32 --checkout /path/to/tau2 \
  --output-dir /tmp/pm-public-eval/tau2
node dist/cli.js qualify --corner sentinel-microhub-stars \
  --checkout /path/to/sentinelbench \
  --output-dir /tmp/pm-public-eval/sentinel
node dist/cli.js qualify --corner appworld-22cc237_2 \
  --checkout /path/to/appworld \
  --runner-option appworldDataRoot=/tmp/appworld-data \
  --allow-protected-local --output-dir /tmp/pm-public-eval/appworld
node dist/cli.js behavioral-plan --input /tmp/public-corners-batch.json
node dist/cli.js run-behavioral-batch --input /tmp/public-corners-batch.json
node dist/cli.js verify-behavioral-batch \
  --receipt /tmp/public-corners-run/pm-behavioral-batch-<sha256>.json
node dist/cli.js verify-behavioral-batch \
  --receipt /tmp/public-corners-run/pm-behavioral-batch-<sha256>.json \
  --allow-ineligible-conformance
```

Source verification requires the pinned Git checkout and every external file
declared by the selected manifest. Missing sources, wrong remotes, wrong
revisions, path escapes, and hash mismatches fail closed.

`qualify` invokes the pinned upstream loader/evaluator through an isolated
wrapper and writes stdout, stderr, hashes, and a `pm-derived-diagnostic`
receipt outside the Git workspace. These receipts are always non-gating and
cannot be promoted to behavioral-efficacy evidence. AppWorld additionally
requires `--runner-option appworldDataRoot=/tmp/... --allow-protected-local`;
the explicit opt-in permits local bundle unpacking but never redistribution.
Use `qualification-plan` to inspect the exact `uv` wrapper command and local
data requirements before execution.

The Sentinel qualification binds three unchanged upstream scenarios as a
control set: relative-threshold contact after the condition, no contact for the
no-op task plus rejection of a false contact, and the absolute-threshold
expected-allow control. The absolute control must pass after its authored
threshold and reject a premature contact. This is still manual-clock oracle
qualification, not a browser-agent efficacy result.

## Sentinel causal stress test

The original `pm-sentinel-live` 27-cell MicroHub design is retained only as
excluded harness history. It cannot establish attribution: the useful baseline
lived in an adapter-owned in-memory `Map`, all arms used the substrate core only
for evidence admission, the discard arm was not Microsoft's unpublished paper
agent, and a plain KV store was never tested. Its speed-factor-4 schedule also
made the pinned positive star trajectories unreachable, while the upstream
no-op evaluator could pass an agent that exited immediately. No result from
that design may be promoted.

The production replacement is fail-closed and uses:

- the exact pinned Microsoft source at
  `0faca33cc58ea62e97a928b67cd3beec7176b408` and published speed factor `1`;
- one task-agnostic real-Chromium agent with a fresh stateless model call at
  each decision and no scenario JSON, SQL, trigger time, task ID, or arm label;
- four identical fixed-width state interfaces: `native` discards, `sham`
  performs continuity work but returns irrelevant state, `plain-kv` persists
  useful state in a minimal durable file, and `substrate` uses the production
  `PostgresContinuityLedger` with full-chain verification;
- raw browser, provider, state, process, upstream-oracle, cost, and timing
  evidence, plus strict no-op liveness through the 630-second horizon;
- zero retries, no task replacement, and block randomization by task and repeat.

MicroHub's relative/absolute/no-op triplet is qualification-only. The frozen
12-task procedural holdout spans MicroHood, MicroMail, MicroScholar, and
MicroTube and has sorted task/hash manifest
`f24feec519f0eb90bebaefd8d2c4c72cab9b208e6e6f2ec6629f49adeb9b2576`.
It contains only four independent relative tasks, so it may validate execution
and controls but may never emit material benefit. A later powered-confirmatory
phase must externally freeze a larger untouched task catalog, its sample-size
justification, task-clustered analysis, and multiplicity rule before execution.
That catalog is now pre-outcome frozen to all 50 scenarios in the five untouched
environments MicroChat, MicroDin, MicroFy, MicroGram, and MicroLendar: 19
relative, 21 absolute, and 10 no-op tasks; sorted task/hash manifest
`48e1695b0728000c8f8e738f9d72273861bf6216e4c609935650a09067d87bc6`.

Provider failures, timeouts, missing artifacts, deliberate early termination,
and every terminal error stay attached to the declared cell. Infrastructure
incompleteness blocks a conclusion and never authorizes a replacement. A
substrate win over native and sham shows that useful durable state mattered;
substrate-specific attribution additionally requires a declared contrast over
plain KV on integrity, isolation, conflict, or recovery behavior.

## Behavioral matched-arm protocol

One input predeclares every experiment choice before a command runs:

- corner, pinned task, trial ID, seed, and deterministic randomization seed;
- exactly `native`, `sham`, and `substrate` for every task/seed pair;
- one shared runner executable/supporting-code identity, one shared
  non-treatment config, and one model provider/ID/revision/digest per trial;
- three fixed, typed treatment deltas. They can select only native state, the
  sham no-op boundary, or `@pm/agent-state-core`; they cannot carry another
  executable, model, config, prompt, or arbitrary parameter;
- one common oracle command, its pinned upstream source ID, and the relative
  arm-blind filename `oracle-outcome.json`.

`behavioral-plan` validates those identities, the selected task, source hashes,
Git revision/remote, and checkout cleanliness without executing the batch. A
successful `run-behavioral-batch` then writes `predeclared-plan.json` before the
first arm starts. Arm order is a deterministic SHA-256 ordering over the
predeclared randomization seed, trial, task, seed, and arm.

The shared runner runs without a shell in each empty arm output directory. Its
only arm-specific configuration is `PM_PUBLIC_EVAL_ARM` plus a generated,
hashed `treatment.json`; runner/config/model identities are otherwise the same.
It must emit `scoring-input.json` with exactly `schemaVersion` and `taskOutput`
at the top level.

The oracle never runs in an arm directory. For each score, the harness creates
a fresh randomly named temporary directory containing only a neutral
`task-output.json` copy. The oracle receives only the neutral input/output paths
and `PM_PUBLIC_EVAL_PHASE=oracle`; it does not receive the arm, treatment,
runner config, plan, task/seed, batch output root, or an arm-labeled working
directory. After the oracle exits, the harness archives its input, stdout,
stderr, and raw outcome under the arm evidence directory. The declared
upstream source file must be in the oracle command's hashed supporting-file
inventory. This proves only which bytes were bundled with the command, not that
the wrapper invoked those bytes. The plan and receipt therefore carry a
content-resolved `oracleInvocationVerification` boundary with the command
identity, source ID/path/hash, status `not-independently-verified`, a null proof
receipt, and `eligibilityEffect: blocks-independent-analysis`. The harness
imports the outcome bytes without mapping any field to success.

The receipt contains hashes and relative paths, not stdout, stderr, task data,
or outcome content. Each attempt inventories every regular file under its arm
root, including raw agent/oracle stdout and stderr and the raw oracle outcome.
Any non-zero command, missing outcome, source/config/command drift, dirty Git
checkout, symlink, path escape, non-shared runner/config/model, unregistered
treatment delta, treatment-aware oracle argument/environment, or incomplete arm triplet
stops the batch without producing a completed receipt.

`verify-behavioral-batch` is deliberately not a receipt-hash-only check. It
reopens the predeclared plan, executable/support/config files, current pinned
source, every inventoried artifact, the four raw logs, the outcome bytes, and
the persisted content-addressed receipt. It also recomputes arm ordering and
requires the raw file inventory to be exact. It recomputes a matching proof
from the shared runner/config/model identities, exact arm set, and registered
treatment hashes; no unconditional “matched arms” assertion is accepted. A verified receipt remains an
unsigned, analysis-ineligible local execution record. The verifier deliberately
returns `eligibleForIndependentAnalysis: false` even for a clean
`behavioral-efficacy-candidate` run. Admission requires a future independently
specified and verified invocation-proof receipt, followed by independent
oracle/split/control verification and replication; this package does not yet
accept or mint that proof.

The CLI treats verification as an evidence gate by default: structural validity
with `eligibleForIndependentAnalysis: false` exits nonzero. Only an operator who
explicitly passes `--allow-ineligible-conformance` gets a green exit for the
structural check, and the printed `cliEvidenceGate` records that override. This
prevents CI from silently promoting a locally self-consistent or constant-oracle
receipt into evidence.

The minimum live input shape is:

```json
{
  "schemaVersion": "pm.public-eval-corners.behavioral-batch-input.v1",
  "evidenceClass": "behavioral-efficacy-candidate",
  "batchId": "tau2-confirmatory-001",
  "cornerId": "tau2-airline-32",
  "randomizationSeed": "registered-before-run",
  "outputRoot": "/tmp/pm-public-eval/tau2-confirmatory-001",
  "source": {
    "mode": "pinned-upstream",
    "checkoutPath": "/tmp/tau2-pinned"
  },
  "oracle": {
    "owner": "upstream",
    "sourceId": "tau2-db-evaluator",
    "command": {
      "executable": { "path": "/absolute/python", "sha256": "<sha256>" },
      "arguments": ["/absolute/oracle-adapter.py"],
      "supportingFiles": [
        { "path": "/absolute/oracle-adapter.py", "sha256": "<sha256>" },
        { "path": "/tmp/tau2-pinned/src/tau2/evaluator/evaluator_env.py", "sha256": "<pinned-sha256>" }
      ],
      "environmentKeys": []
    },
    "outcomeRelativePath": "oracle-outcome.json",
    "outcomeMediaType": "application/json"
  },
  "trials": [
    {
      "trialId": "airline-32-seed-001",
      "taskId": "airline:32",
      "seed": "seed-001",
      "runner": "<one shared command object>",
      "config": "<one shared hashed config object>",
      "model": "<one shared model identity>",
      "treatments": {
        "native": { "schemaVersion": "pm.public-eval-corners.treatment-delta.v1", "arm": "native", "agentStateTreatment": "native", "boundaryProvider": "runner-native" },
        "sham": { "schemaVersion": "pm.public-eval-corners.treatment-delta.v1", "arm": "sham", "agentStateTreatment": "sham", "boundaryProvider": "pm-sham-noop" },
        "substrate": { "schemaVersion": "pm.public-eval-corners.treatment-delta.v1", "arm": "substrate", "agentStateTreatment": "substrate", "boundaryProvider": "@pm/agent-state-core" }
      }
    }
  ]
}
```

The abbreviated string placeholders above are explanatory only; the CLI
rejects them. Each config object is
`{"configId":"...","path":"/absolute/file","sha256":"..."}` and each
model identity is
`{"provider":"...","modelId":"...","revision":"...","digest":"..."}`.

Arm blindness is a process and filesystem-boundary check, not an OS security
sandbox or proof of semantic neutrality. A malicious shared runner could encode
the treatment in `taskOutput`, a malicious oracle could inspect unrelated host
state or infer invocation order, and a constant-output wrapper can list a pinned
upstream file in `supportingFiles` without importing or executing it. The local
receipt cannot prove which code path produced the outcome. Live admission
therefore stays blocked pending independent invocation verification, code
review/oracle receipts, provider-resolved model and usage receipts,
clean-checkout reproduction, and replication.

For AppWorld live execution, `source.allowProtectedLocal` must be `true` and
`source.protectedDataRoot` must be outside both the repository checkout and this
Git workspace. Output roots are also required to be outside the workspace.
These controls authorize local evaluation only. They never authorize copying,
committing, or redistributing decrypted AppWorld material.

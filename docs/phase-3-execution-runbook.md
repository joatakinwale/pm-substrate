# Phase 3 execution runbook — from funded to first behavioral data

Operational checklist for the owner. Nothing here changes protocol; it
sequences what the plan, the status doc, and the runner code already require.
Every step below was verified against the code on 2026-07-16; entry points are
real (`package.json` bins in `packages/public-eval-corners`).

## 0. What money actually buys (the only purchasable blockers)

| Item | For | Notes |
|---|---|---|
| Anthropic API credits | Sentinel agent + ToolSandbox non-scripted triplet | Pinned model `claude-sonnet-4-5-20250929` (`sentinel-general-provider-proxy.ts`); qualification+holdout ≈ 180 cells ≈ $200–600 at the paper's per-task economics |
| Azure GPT-5.4 deployment | STATE-Bench locked evaluator | Self-provisioned per upstream `docs/setup/eval-client.md`: `STATE_BENCH_EVAL_ENDPOINT` / `STATE_BENCH_EVAL_DEPLOYMENTS` / `STATE_BENCH_EVAL_API_KEY` in `.env`. No Microsoft credential exists to wait for |

## 1. Witness the pre-run artifacts (before ANY cell, including the smoke)

```bash
pnpm witness:anchor -- --label interpretation-matrix docs/outcome-interpretation-matrix-2026-07-16.md
pnpm witness:anchor -- --label endpoint-amendment docs/state-effect-endpoint-amendment-2026-07-15.md
pnpm witness:anchor -- --label preregistration <path-to-preregistration.json>
```

Then actually push the tags / upload the cosign bundles / freeze the OSF
registration — the dry run only prints the commands.

## 2. Author the signed pre-run artifacts (owner + second party, by design)

The runner fail-closes without these (`verifySentinelProductionRunInputs`,
`sentinel-production-runner.ts`); none can be produced by the executing agent:

1. **Preregistration** conforming to `sentinel-production-plan.ts` (owner
   objective, phase, catalog binding, analysis seed).
2. **Ed25519 signature** whose `authority.ownerId` **differs from** the
   producer ID (checked at `sentinel-production-plan.ts:1775`).
3. **Out-of-band trust anchor** (expected preregistration hash, authority ID,
   authority key hash) delivered outside the result bundle.
4. **External commitment**: uncredentialed HTTPS locator on an independent
   append-only medium, custodian owner ≠ producer AND ≠ signer
   (`sentinel-production-runner.ts:711-713`), committed after signing and
   before `runStartedAt`.

## 3. Prepare the runtime

- Four **fresh, disjoint** checkouts of
  `microsoft/sentinel_environments@0faca33cc58ea62e97a928b67cd3beec7176b408`,
  one per arm (`assertFreshDisjointRoots` rejects nesting/reuse).
- Runtime closure paths per `sentinel-runtime-closure.ts` (Python
  installed-distributions manifest, bound paths, inspection receipts).
- `ANTHROPIC_API_KEY` for the provider proxy (`api.anthropic.com`).
- Postgres reachable for the continuity/plain-KV/sham arms
  (`PM_DATABASE_URL`).

## 4. Run, in protocol order

```bash
# 4a. Excluded-environment smoke (MicroHub — excluded from the powered universe)
pnpm --filter @pm/public-eval-corners build
node packages/public-eval-corners/dist/sentinel-production-excluded-smoke-cli.js <invocation.json>

# 4b. Raw verification of the smoke batch (expects valid:false + rawComplete:true;
#     the CLI exits non-zero BY DESIGN — read the report, not the exit code)
node packages/public-eval-corners/dist/sentinel-production-raw-verifier-cli.js <batch-root>
```

The invocation JSON's exact keys are enforced by
`sentinel-production-excluded-smoke-cli.ts`: `schemaVersion`,
`preregistrationPath`, `signaturePath`, `trustAnchorPath`,
`externalCommitmentPath`, `runtimePathsPath`, `checkouts` (one path per arm),
`batchRoot`, `attemptRegistryRoot`, `taskId`, `repeatId`.

Then:

- **4c. MicroHub qualification triplet** (relative / absolute / no-op), all
  four arms, 3 repeats, speed 1 — via `runSentinelProductionBatch`
  (`sentinel-production-runner.ts:1979`; a batch CLI wrapper around it is the
  one piece of *execution* code still missing — building it pays the
  `evalPackageTotals` ratchet toll visibly and is authorized by the plan as
  execution, not verification).
- **4d. Frozen 12-task procedural holdout**, same shape. No replacement, no
  outcome inspection during execution.
- Neither phase may emit a material-benefit claim (protocol; the schemas make
  it impossible anyway).

## 5. After the data exists

1. Witness the raw-root hashes (`pnpm witness:anchor -- --label raw-roots ...`).
2. Estimate the repeat ICC from qualification + holdout cells.
3. Re-run the power audit with the ICC **upper confidence limit**
   (`node packages/public-eval-corners/dist/sentinel-production-power-audit-cli.js --output ...`);
   sign and witness the new calculation bytes.
4. If the simultaneous lower bound clears 0.80 within the frozen 19-task
   universe → schedule the powered confirmatory against the witnessed
   endpoint amendment + interpretation matrix. If not → the redesign doc's
   own branch: add independent relative tasks, or take option A of the
   recorded `decision-needed:` re-aim.

## Also runnable today, independently (blocker is only credits)

The ToolSandbox non-scripted public-agent triplet (status doc, blocker 1):
externally preregister the manifest, fund the provider, retain
usage/cost/latency, run unchanged headline + derivative triplets.

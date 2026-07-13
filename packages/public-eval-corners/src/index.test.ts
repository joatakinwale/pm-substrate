import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import * as runtimeModule from "./index.js";
import {
  publicEvalCorners,
  type ArtifactLabelEnvelope,
  type BehavioralBatchInput,
  type BehavioralCommandInput,
  type BehavioralTreatmentDelta,
  type PublicEvalCornerId,
} from "./index.js";
import {
  planBehavioralBatch as planBehavioralBatchRuntime,
  runBehavioralBatch as runBehavioralBatchRuntime,
  verifyBehavioralBatch as verifyBehavioralBatchRuntime,
  type BehavioralServices,
} from "./behavioral.js";

const TEMP_PATHS: string[] = [];

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")) as unknown;
}

function syntheticLabel(
  overrides: Partial<ArtifactLabelEnvelope> = {},
): ArtifactLabelEnvelope {
  return {
    schemaVersion: "pm.public-eval-artifact-label.v1",
    artifactId: "synthetic-label-v1",
    cornerId: "tau2-airline-32",
    label: "pm-synthetic-conformance",
    claimScope: "adapter-conformance",
    distribution: "package-synthetic",
    containsUpstreamTaskData: false,
    containsProtectedContent: false,
    nonGating: true,
    ...overrides,
  };
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeFixture(path: string, bytes: string): string {
  writeFileSync(path, bytes);
  return digest(bytes);
}

function conformanceBehavioralInput(): {
  readonly root: string;
  readonly scriptPath: string;
  readonly oraclePath: string;
  readonly input: BehavioralBatchInput;
} {
  const root = mkdtempSync(join(tmpdir(), "pm-corners-behavioral-"));
  TEMP_PATHS.push(root);
  const sourceRoot = join(root, "source");
  const configRoot = join(root, "configs");
  mkdirSync(sourceRoot);
  mkdirSync(configRoot);
  const scriptPath = join(sourceRoot, "synthetic-runner.mjs");
  const oraclePath = join(sourceRoot, "synthetic-oracle.mjs");
  const runnerScript = `
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const env = process.env;
if (env.PM_PUBLIC_EVAL_PHASE !== "agent") throw new Error("runner only supports agent phase");
const config = readFileSync(env.PM_PUBLIC_EVAL_CONFIG_PATH, "utf8");
JSON.parse(readFileSync(env.PM_PUBLIC_EVAL_TREATMENT_PATH, "utf8"));
writeFileSync(env.PM_PUBLIC_EVAL_SCORING_INPUT_PATH, JSON.stringify({
  schemaVersion: "pm.public-eval-corners.scoring-input.v1",
  taskOutput: {
    syntheticNotice: "PM-authored protocol fixture; no upstream task data or efficacy claim.",
    completed: true,
    configSha256: createHash("sha256").update(config).digest("hex")
  }
}) + "\\n");
process.stdout.write("synthetic shared-runner conformance only\\n");
`;
  const oracleScript = `
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const env = process.env;
for (const forbidden of ["PM_PUBLIC_EVAL_ARM", "PM_PUBLIC_EVAL_TREATMENT_PATH", "PM_PUBLIC_EVAL_CONFIG_PATH", "PM_PUBLIC_EVAL_PLAN_PATH", "PM_PUBLIC_EVAL_ARM_OUTPUT_ROOT"]) {
  if (env[forbidden] !== undefined) throw new Error("oracle received treatment context: " + forbidden);
}
if (readdirSync(process.cwd()).join(",") !== "task-output.json") throw new Error("oracle view is not neutral");
const raw = readFileSync(env.PM_PUBLIC_EVAL_ORACLE_INPUT_PATH);
const parsed = JSON.parse(raw);
writeFileSync(env.PM_PUBLIC_EVAL_ORACLE_OUTCOME_PATH, JSON.stringify({
    syntheticNotice: "PM-authored protocol fixture; no upstream task data or efficacy claim.",
    oracleFixture: true,
    completed: parsed.taskOutput.completed === true,
    taskOutputSha256: createHash("sha256").update(raw).digest("hex")
}) + "\\n");
process.stdout.write("synthetic arm-blind oracle conformance only\\n");
`;
  const scriptHash = writeFixture(scriptPath, runnerScript);
  const oracleHash = writeFixture(oraclePath, oracleScript);
  const executable = { path: process.execPath, sha256: digest(readFileSync(process.execPath)) };
  const runner: BehavioralCommandInput = {
    executable,
    arguments: [scriptPath],
    supportingFiles: [{ path: scriptPath, sha256: scriptHash }],
    environmentKeys: [],
  };
  const oracleCommand: BehavioralCommandInput = {
    executable,
    arguments: [oraclePath],
    supportingFiles: [{ path: oraclePath, sha256: oracleHash }],
    environmentKeys: [],
  };
  const model = {
    provider: "synthetic-provider",
    modelId: "synthetic-model",
    revision: "conformance-v1",
    digest: digest("synthetic model descriptor; not weights or efficacy"),
  } as const;
  const configPath = join(configRoot, "shared.json");
  const configBytes = `${JSON.stringify({ synthetic: true, treatmentFree: true })}\n`;
  const configHash = writeFixture(configPath, configBytes);
  const treatments: Readonly<Record<"native" | "sham" | "substrate", BehavioralTreatmentDelta>> = {
    native: {
      schemaVersion: "pm.public-eval-corners.treatment-delta.v1",
      arm: "native",
      agentStateTreatment: "native",
      boundaryProvider: "runner-native",
    },
    sham: {
      schemaVersion: "pm.public-eval-corners.treatment-delta.v1",
      arm: "sham",
      agentStateTreatment: "sham",
      boundaryProvider: "pm-sham-noop",
    },
    substrate: {
      schemaVersion: "pm.public-eval-corners.treatment-delta.v1",
      arm: "substrate",
      agentStateTreatment: "substrate",
      boundaryProvider: "@pm/agent-state-core",
    },
  };
  return {
    root,
    scriptPath,
    oraclePath,
    input: {
      schemaVersion: "pm.public-eval-corners.behavioral-batch-input.v1",
      evidenceClass: "protocol-conformance",
      batchId: "synthetic-protocol-batch",
      cornerId: "tau2-airline-32",
      randomizationSeed: "predeclared-order-seed",
      outputRoot: join(root, "output"),
      timeoutMs: 10_000,
      source: {
        mode: "protocol-conformance",
        rootPath: sourceRoot,
        expectedFiles: [
          {
            sourceId: "synthetic-oracle-fixture",
            relativePath: "synthetic-oracle.mjs",
            sha256: oracleHash,
          },
        ],
        syntheticNotice:
          "PM-authored protocol fixture; no upstream task data or efficacy claim.",
      },
      oracle: {
        owner: "pm-conformance-fixture",
        sourceId: "synthetic-oracle-fixture",
        command: oracleCommand,
        outcomeRelativePath: "oracle-outcome.json",
        outcomeMediaType: "application/json",
      },
      trials: [
        {
          trialId: "synthetic-trial-001",
          taskId: "airline:32",
          seed: "seed-001",
          runner,
          config: { configId: "synthetic-shared-config", path: configPath, sha256: configHash },
          model,
          treatments,
        },
      ],
    },
  };
}

afterEach(() => {
  for (const path of TEMP_PATHS.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("immutable public benchmark manifests", () => {
  it("pins the four requested corners and content-addresses every manifest", () => {
    const envelopes = publicEvalCorners.listManifests();
    expect(envelopes.map(({ manifest }) => manifest.cornerId)).toEqual([
      "memoryagentbench-factconsolidation-6k",
      "tau2-airline-32",
      "appworld-22cc237_2",
      "sentinel-microhub-stars",
    ]);
    for (const envelope of envelopes) {
      expect(envelope.manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(envelope.manifest.adapterStatus).toBe("source-and-conformance-only");
      expect(envelope.manifest.artifactPolicy.generatedArtifactsAreNonGating).toBe(true);
      expect(Object.isFrozen(envelope)).toBe(true);
      expect(Object.isFrozen(envelope.manifest)).toBe(true);
      expect(Object.isFrozen(envelope.manifest.sources)).toBe(true);
    }
  });

  it("records exact upstream revisions, task ids, and AppWorld redistribution constraints", () => {
    expect(
      publicEvalCorners.getManifest("memoryagentbench-factconsolidation-6k").manifest
        .upstream.revision,
    ).toBe("455306dcabc3842526eb83cd4e225e5d486c5c5d");
    expect(publicEvalCorners.getManifest("tau2-airline-32").manifest.tasks).toEqual([
      { taskId: "airline:32", role: "two separately committed reservation transitions" },
    ]);
    const appWorld = publicEvalCorners.getManifest("appworld-22cc237_2").manifest;
    expect(appWorld.upstream.revision).toBe("a072b7a86e7c1d5b1d7175659d750ebb9b79f10a");
    expect(appWorld.upstream.license.additionalTerms).toContain("encrypted");
    expect(appWorld.artifactPolicy.prohibitedPackageContent).toContain("decrypted bundles");
    expect(
      publicEvalCorners.getManifest("sentinel-microhub-stars").manifest.tasks.map(({ taskId }) => taskId),
    ).toEqual(["microhub-stars-relative-passive", "microhub-stars-noop"]);
  });

  it("has a single runtime export and makes every operation reachable from the CLI", () => {
    expect(Object.keys(runtimeModule)).toEqual(["publicEvalCorners"]);
    const cliSource = readFileSync(new URL("./cli.ts", import.meta.url), "utf8");
    for (const operation of Object.keys(publicEvalCorners)) {
      expect(cliSource).toContain(`publicEvalCorners.${operation}`);
    }
  });
});

describe("source and hash verification", () => {
  it("accepts a matching synthetic file and rejects hash drift", () => {
    const root = mkdtempSync(join(tmpdir(), "pm-public-eval-files-"));
    TEMP_PATHS.push(root);
    const bytes = "PM-authored source verifier fixture\n";
    writeFileSync(join(root, "fixture.txt"), bytes);
    const expectedHash = createHash("sha256").update(bytes).digest("hex");
    const valid = publicEvalCorners.verifyFileSet({
      rootPath: root,
      expectedFiles: [
        { sourceId: "synthetic-source", relativePath: "fixture.txt", sha256: expectedHash },
      ],
    });
    expect(valid.valid).toBe(true);
    expect(valid.files[0]?.actualSha256).toBe(expectedHash);

    const drifted = publicEvalCorners.verifyFileSet({
      rootPath: root,
      expectedFiles: [
        { sourceId: "synthetic-source", relativePath: "fixture.txt", sha256: "0".repeat(64) },
      ],
    });
    expect(drifted.valid).toBe(false);
    expect(drifted.issues).toContain("synthetic-source: SHA-256 mismatch");
  });

  it("fails closed on root escapes and absent pinned checkouts", () => {
    const root = mkdtempSync(join(tmpdir(), "pm-public-eval-root-"));
    TEMP_PATHS.push(root);
    const escaped = publicEvalCorners.verifyFileSet({
      rootPath: root,
      expectedFiles: [
        { sourceId: "synthetic-escape", relativePath: "../outside.txt", sha256: "0".repeat(64) },
      ],
    });
    expect(escaped.valid).toBe(false);
    expect(escaped.issues[0]).toContain("escapes verification root");

    const missing = publicEvalCorners.verifyPinnedSource({
      cornerId: "tau2-airline-32",
      checkoutPath: join(root, "missing-checkout"),
    });
    expect(missing.valid).toBe(false);
    expect(missing.repository.valid).toBe(false);
    expect(missing.issues).toContain("Git revision does not match manifest");
  });
});

describe("local qualification wrappers", () => {
  it("publishes exact non-efficacy command plans for every corner", () => {
    for (const { manifest } of publicEvalCorners.listManifests()) {
      const plan = publicEvalCorners.getQualificationPlan(manifest.cornerId);
      expect(plan.cornerId).toBe(manifest.cornerId);
      expect(plan.commandTemplate[0]).toBe("uv");
      expect(plan.upstreamOracleInvoked).toBe(true);
      expect(plan.qualificationScope).toBe("adapter-and-oracle-plumbing-only");
      expect(plan.efficacyClaimed).toBe(false);
    }
    expect(
      publicEvalCorners.getQualificationPlan("appworld-22cc237_2").protectedLocalAccess,
    ).toBe("explicit-opt-in");
    expect(
      publicEvalCorners.getQualificationPlan("memoryagentbench-factconsolidation-6k")
        .requiredExternalSourceIds,
    ).toEqual(["mab-conflict-parquet"]);
  });

  it("records source blockers in an external, non-gating receipt without spawning", () => {
    const root = mkdtempSync(join(tmpdir(), "pm-public-eval-qualification-"));
    TEMP_PATHS.push(root);
    const receipt = publicEvalCorners.runQualification({
      cornerId: "tau2-airline-32",
      checkoutPath: join(root, "missing-checkout"),
      outputDirectory: join(root, "receipt"),
    });
    expect(receipt.status).toBe("blocked");
    expect(receipt.efficacyClaimed).toBe(false);
    expect(receipt.blockers).toContain("pinned source verification failed");
    expect(receipt.runner.exitCode).toBeNull();
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(publicEvalCorners.validateArtifactLabel(receipt.artifactLabel).valid).toBe(true);
  });

  it("refuses to put raw qualification outputs inside the Git workspace", () => {
    expect(() =>
      publicEvalCorners.runQualification({
        cornerId: "tau2-airline-32",
        checkoutPath: "/tmp/missing-tau2",
        outputDirectory: fileURLToPath(new URL("../qualification-output", import.meta.url)),
      }),
    ).toThrow(/outside the Git workspace/u);
  });
});

describe("matched-arm behavioral evidence protocol", () => {
  it("predeclares and runs an exact triplet while keeping synthetic commands non-gating", () => {
    const fixture = conformanceBehavioralInput();
    const planned = publicEvalCorners.planBehavioralBatch(fixture.input);
    expect(planned.valid).toBe(true);
    expect(planned.plan?.evidenceClass).toBe("protocol-conformance");
    expect(planned.plan?.eligibleForIndependentAnalysis).toBe(false);
    expect(planned.plan?.trials[0]?.armOrder).toHaveLength(3);

    const receipt = publicEvalCorners.runBehavioralBatch(fixture.input);
    expect(receipt.efficacyClaimed).toBe(false);
    expect(receipt.decisionGating).toBe(false);
    expect(receipt.upstreamOutcomesInterpreted).toBe(false);
    expect(receipt.eligibleForIndependentAnalysis).toBe(false);
    expect(receipt.trials[0]?.attempts.map(({ arm }) => arm)).toEqual(
      receipt.plan.trials[0]?.armOrder,
    );
    expect(receipt.trials[0]?.attempts).toHaveLength(3);
    expect(new Set(receipt.trials[0]?.attempts.map((attempt) => attempt.command.commandIdentitySha256)).size).toBe(1);
    expect(new Set(receipt.trials[0]?.attempts.map((attempt) => attempt.sharedConfigIdentitySha256)).size).toBe(1);
    expect(receipt.trials[0]?.matchingProof.proofHash).toMatch(/^[a-f0-9]{64}$/u);
    for (const attempt of receipt.trials[0]?.attempts ?? []) {
      expect(attempt.rawArtifacts.map(({ path }) => path)).toEqual(
        expect.arrayContaining([
          attempt.command.stdoutPath,
          attempt.command.stderrPath,
          attempt.oracle.stdoutPath,
          attempt.oracle.stderrPath,
          attempt.oracle.scoringInputPath,
          attempt.oracle.outcomePath,
        ]),
      );
      const outcome = JSON.parse(
        readFileSync(join(receipt.outputRoot, attempt.oracle.outcomePath), "utf8"),
      ) as Record<string, unknown>;
      expect(outcome.syntheticNotice).toBe(
        "PM-authored protocol fixture; no upstream task data or efficacy claim.",
      );
      expect(outcome).not.toHaveProperty("success");
      expect(outcome).not.toHaveProperty("arm");
      const blindedInput = JSON.parse(
        readFileSync(join(receipt.outputRoot, attempt.oracle.scoringInputPath), "utf8"),
      ) as Record<string, unknown>;
      expect(Object.keys(blindedInput).sort()).toEqual(["schemaVersion", "taskOutput"]);
      expect(attempt.oracle.neutralView).toBe("ephemeral-arm-blind");
    }
    const verified = publicEvalCorners.verifyBehavioralBatch(receipt);
    expect(verified.valid).toBe(true);
    expect(verified.eligibleForIndependentAnalysis).toBe(false);
    expect(verified.reopenedArtifactCount).toBeGreaterThanOrEqual(18);
  });

  it("reopens raw bytes and rejects outcome tampering or unlisted output artifacts", () => {
    const first = conformanceBehavioralInput();
    const receipt = publicEvalCorners.runBehavioralBatch(first.input);
    const outcomePath = receipt.trials[0]?.attempts[0]?.oracle.outcomePath;
    expect(outcomePath).toBeDefined();
    writeFileSync(join(receipt.outputRoot, outcomePath as string), "{\"tampered\":true}\n");
    const tampered = publicEvalCorners.verifyBehavioralBatch(receipt);
    expect(tampered.valid).toBe(false);
    expect(tampered.issues.join(" ")).toMatch(/raw artifact inventory|raw byte hash/u);

    const second = conformanceBehavioralInput();
    const cleanReceipt = publicEvalCorners.runBehavioralBatch(second.input);
    writeFileSync(join(cleanReceipt.outputRoot, "unlisted.txt"), "not predeclared\n");
    const unlisted = publicEvalCorners.verifyBehavioralBatch(cleanReceipt);
    expect(unlisted.valid).toBe(false);
    expect(unlisted.issues).toContain("unexpected top-level output artifact unlisted.txt");
  });

  it("recomputes matching instead of trusting a substrate-arm equality assertion", () => {
    const fixture = conformanceBehavioralInput();
    const receipt = publicEvalCorners.runBehavioralBatch(fixture.input);
    const forged = structuredClone(receipt) as unknown as Record<string, unknown>;
    const trial = (forged.trials as Array<Record<string, unknown>>)[0];
    if (!trial) throw new Error("receipt trial missing");
    const substrate = (trial.attempts as Array<Record<string, unknown>>).find(
      (attempt) => attempt.arm === "substrate",
    );
    if (!substrate) throw new Error("substrate attempt missing");
    (substrate.command as Record<string, unknown>).commandIdentitySha256 = digest(
      "better substrate runner",
    );
    substrate.sharedConfigIdentitySha256 = digest("better substrate config");
    const verified = publicEvalCorners.verifyBehavioralBatch(forged);
    expect(verified.valid).toBe(false);
    expect(verified.issues.join(" ")).toContain(
      "substrate differs outside the registered treatment delta",
    );
  });

  it("rejects a better substrate executable/config and treatment-aware oracle", () => {
    const fixture = conformanceBehavioralInput();
    const perArmBackdoor = structuredClone(fixture.input) as unknown as Record<string, unknown>;
    const trial = (perArmBackdoor.trials as Array<Record<string, unknown>>)[0];
    if (!trial) throw new Error("fixture trial missing");
    trial.arms = {
      native: { command: trial.runner, config: trial.config, model: trial.model },
      sham: { command: trial.runner, config: trial.config, model: trial.model },
      substrate: {
        command: {
          ...(trial.runner as Record<string, unknown>),
          arguments: [fixture.scriptPath, "--better-substrate-executable"],
        },
        config: {
          ...(trial.config as Record<string, unknown>),
          configId: "better-substrate-config",
        },
        model: trial.model,
      },
    };
    const backdoorPlan = publicEvalCorners.planBehavioralBatch(
      perArmBackdoor as unknown as BehavioralBatchInput,
    );
    expect(backdoorPlan.valid).toBe(false);
    expect(backdoorPlan.issues.join(" ")).toContain(
      "one shared runner/config/model and treatment deltas only",
    );

    const treatmentBackdoor = structuredClone(fixture.input) as unknown as Record<string, unknown>;
    const treatmentTrial = (treatmentBackdoor.trials as Array<Record<string, unknown>>)[0];
    if (!treatmentTrial) throw new Error("fixture trial missing");
    const substrate = (treatmentTrial.treatments as Record<string, Record<string, unknown>>)
      .substrate;
    if (!substrate) throw new Error("substrate treatment missing");
    substrate.configPath = "/tmp/better-substrate-config.json";
    const treatmentPlan = publicEvalCorners.planBehavioralBatch(
      treatmentBackdoor as unknown as BehavioralBatchInput,
    );
    expect(treatmentPlan.valid).toBe(false);
    expect(treatmentPlan.issues.join(" ")).toContain("registered substrate treatment delta");

    const treatmentAwareOracle = structuredClone(fixture.input);
    treatmentAwareOracle.oracle.command = {
      ...treatmentAwareOracle.oracle.command,
      arguments: [...treatmentAwareOracle.oracle.command.arguments, "--arm=substrate"],
    };
    const oraclePlan = publicEvalCorners.planBehavioralBatch(treatmentAwareOracle);
    expect(oraclePlan.valid).toBe(false);
    expect(oraclePlan.issues.join(" ")).toContain("may not disclose arm, treatment");

    const runtimeAware = conformanceBehavioralInput();
    const maliciousOracle = `
import { writeFileSync } from "node:fs";
if (!process.env.PM_PUBLIC_EVAL_ARM) process.exit(41);
writeFileSync(process.env.PM_PUBLIC_EVAL_ORACLE_OUTCOME_PATH, "{}\\n");
`;
    const maliciousHash = writeFixture(runtimeAware.oraclePath, maliciousOracle);
    const sourceFile = runtimeAware.input.source.mode === "protocol-conformance"
      ? runtimeAware.input.source.expectedFiles[0]
      : undefined;
    if (!sourceFile) throw new Error("conformance oracle source missing");
    (sourceFile as { sha256: string }).sha256 = maliciousHash;
    const supportingFile = runtimeAware.input.oracle.command.supportingFiles[0];
    if (!supportingFile) throw new Error("oracle supporting file missing");
    (supportingFile as { sha256: string }).sha256 = maliciousHash;
    expect(() => publicEvalCorners.runBehavioralBatch(runtimeAware.input)).toThrow(
      /oracle command failed/u,
    );
  });

  it("rejects wrong oracle ownership and AppWorld without protected-local controls", () => {
    const fixture = conformanceBehavioralInput();

    const wrongOwner = structuredClone(fixture.input) as unknown as Record<string, unknown>;
    (wrongOwner.oracle as Record<string, unknown>).owner = "upstream";
    const ownerPlan = publicEvalCorners.planBehavioralBatch(
      wrongOwner as unknown as BehavioralBatchInput,
    );
    expect(ownerPlan.valid).toBe(false);
    expect(ownerPlan.issues.join(" ")).toContain("oracle.owner=pm-conformance-fixture");

    const appWorld = structuredClone(fixture.input) as unknown as BehavioralBatchInput;
    (appWorld as { evidenceClass: string }).evidenceClass = "behavioral-efficacy-candidate";
    (appWorld as { cornerId: string }).cornerId = "appworld-22cc237_2";
    (appWorld as { source: unknown }).source = {
      mode: "pinned-upstream",
      checkoutPath: join(fixture.root, "fake-appworld"),
    };
    const appWorldPlan = publicEvalCorners.planBehavioralBatch(appWorld);
    expect(appWorldPlan.valid).toBe(false);
    expect(appWorldPlan.issues.join(" ")).toContain("allowProtectedLocal=true");
  });

  it("fails before command execution when the pinned source is not exact and clean", () => {
    const fixture = conformanceBehavioralInput();
    const fakeCheckout = join(fixture.root, "fake-tau2");
    const evaluatorPath = join(fakeCheckout, "src/tau2/evaluator/evaluator_env.py");
    mkdirSync(join(fakeCheckout, "src/tau2/evaluator"), { recursive: true });
    const evaluatorHash = writeFixture(evaluatorPath, "# synthetic non-upstream evaluator\n");
    const candidate = structuredClone(fixture.input) as unknown as BehavioralBatchInput;
    (candidate as { evidenceClass: string }).evidenceClass = "behavioral-efficacy-candidate";
    (candidate as { source: unknown }).source = {
      mode: "pinned-upstream",
      checkoutPath: fakeCheckout,
    };
    const oracle = candidate.oracle as {
      owner: string;
      sourceId: string;
      command: BehavioralCommandInput;
    };
    oracle.owner = "upstream";
    oracle.sourceId = "tau2-db-evaluator";
    oracle.command = {
      ...oracle.command,
      supportingFiles: [
        ...oracle.command.supportingFiles,
        { path: evaluatorPath, sha256: evaluatorHash },
      ],
    };
    const planned = publicEvalCorners.planBehavioralBatch(candidate);
    expect(planned.valid).toBe(false);
    expect(planned.issues).toContain("source verification failed");
    expect(() => publicEvalCorners.runBehavioralBatch(candidate)).toThrow(
      /behavioral batch plan refused/u,
    );
    expect(existsSync(candidate.outputRoot)).toBe(false);
  });

  it("keeps a constant wrapper ineligible even when it bundles pinned oracle bytes", () => {
    const fixture = conformanceBehavioralInput();
    const fakeCheckout = join(fixture.root, "clean-pinned-tau2");
    const evaluatorPath = join(fakeCheckout, "src/tau2/evaluator/evaluator_env.py");
    mkdirSync(join(fakeCheckout, "src/tau2/evaluator"), { recursive: true });
    const evaluatorHash = writeFixture(
      evaluatorPath,
      "# content-resolved stand-in for the pinned upstream evaluator\n",
    );
    execFileSync("git", ["init", "-q", fakeCheckout]);
    execFileSync("git", ["-C", fakeCheckout, "config", "user.name", "PM test"]);
    execFileSync("git", ["-C", fakeCheckout, "config", "user.email", "pm-test@example.invalid"]);
    execFileSync("git", ["-C", fakeCheckout, "add", "."]);
    execFileSync("git", ["-C", fakeCheckout, "commit", "-q", "-m", "fixture"]);

    const constantWrapper = `
import { writeFileSync } from "node:fs";
writeFileSync(
  process.env.PM_PUBLIC_EVAL_ORACLE_OUTCOME_PATH,
  JSON.stringify({ constant: true }) + "\\n",
);
`;
    const wrapperHash = writeFixture(fixture.oraclePath, constantWrapper);
    const candidate = structuredClone(fixture.input) as unknown as BehavioralBatchInput;
    (candidate as { evidenceClass: string }).evidenceClass =
      "behavioral-efficacy-candidate";
    (candidate as { source: unknown }).source = {
      mode: "pinned-upstream",
      checkoutPath: fakeCheckout,
    };
    const oracle = candidate.oracle as {
      owner: string;
      sourceId: string;
      command: BehavioralCommandInput;
    };
    oracle.owner = "upstream";
    oracle.sourceId = "tau2-db-evaluator";
    oracle.command = {
      ...oracle.command,
      supportingFiles: [
        { path: fixture.oraclePath, sha256: wrapperHash },
        { path: evaluatorPath, sha256: evaluatorHash },
      ],
    };

    const services: BehavioralServices = {
      getManifest: (cornerId) => publicEvalCorners.getManifest(cornerId),
      verifyPinnedSource: (() => ({
        schemaVersion: "pm.test-pinned-source-verification.v1",
        valid: true,
      })) as BehavioralServices["verifyPinnedSource"],
      verifyFileSet: (request) => publicEvalCorners.verifyFileSet(request),
    };
    const planned = planBehavioralBatchRuntime(candidate, services);
    expect(planned.valid).toBe(true);
    expect(planned.plan?.oracle.invocationVerification).toMatchObject({
      status: "not-independently-verified",
      sourceId: "tau2-db-evaluator",
      sourcePath: evaluatorPath,
      sourceSha256: evaluatorHash,
      invocationProofReceipt: null,
      eligibilityEffect: "blocks-independent-analysis",
    });
    expect(planned.plan?.eligibleForIndependentAnalysis).toBe(false);

    const receipt = runBehavioralBatchRuntime(candidate, services);
    expect(receipt.oracleInvocationVerification.status).toBe(
      "not-independently-verified",
    );
    expect(receipt.eligibleForIndependentAnalysis).toBe(false);
    const verified = verifyBehavioralBatchRuntime(receipt, services);
    expect(verified.valid).toBe(true);
    expect(verified.eligibleForIndependentAnalysis).toBe(false);
  });
});

describe("original versus derivative labeling", () => {
  it("accepts external upstream references, packaged synthetic fixtures, and local diagnostics", () => {
    const upstream: ArtifactLabelEnvelope = {
      schemaVersion: "pm.public-eval-artifact-label.v1",
      artifactId: "upstream-reference-v1",
      cornerId: "memoryagentbench-factconsolidation-6k",
      label: "upstream-original",
      claimScope: "source-integrity",
      distribution: "external-reference",
      containsUpstreamTaskData: true,
      containsProtectedContent: false,
      nonGating: true,
    };
    expect(publicEvalCorners.validateArtifactLabel(upstream).valid).toBe(true);
    expect(publicEvalCorners.validateArtifactLabel(syntheticLabel()).valid).toBe(true);
    expect(
      publicEvalCorners.validateArtifactLabel({
        ...syntheticLabel(),
        artifactId: "appworld-duplicate-diagnostic-v1",
        cornerId: "appworld-22cc237_2",
        label: "pm-derived-diagnostic",
        claimScope: "oracle-diagnostic",
        distribution: "local-derived",
        derivation: "Synthetic mapping-projection versus record-multiplicity comparison.",
      }).valid,
    ).toBe(true);
  });

  it("rejects efficacy promotion and protected AppWorld content", () => {
    const efficacy = publicEvalCorners.validateArtifactLabel({
      ...syntheticLabel(),
      claimScope: "behavioral-efficacy",
    });
    expect(efficacy.valid).toBe(false);
    expect(efficacy.issues.join(" ")).toContain("cannot label or promote behavioral-efficacy");

    const protectedAppWorld = publicEvalCorners.validateArtifactLabel({
      ...syntheticLabel(),
      cornerId: "appworld-22cc237_2",
      containsProtectedContent: true,
    });
    expect(protectedAppWorld.valid).toBe(false);
    expect(protectedAppWorld.issues.join(" ")).toContain("protected AppWorld content");
  });
});

describe("synthetic corner conformance", () => {
  const fixtures: readonly [string, PublicEvalCornerId][] = [
    ["mab-factconsolidation.synthetic.json", "memoryagentbench-factconsolidation-6k"],
    ["tau2-airline-32.synthetic.json", "tau2-airline-32"],
    ["appworld-22cc237_2.synthetic.json", "appworld-22cc237_2"],
    ["sentinel-stars.synthetic.json", "sentinel-microhub-stars"],
  ];

  it.each(fixtures)("passes adapter semantics for %s", (file, cornerId) => {
    const raw = fixture(file) as Record<string, unknown>;
    expect(raw.containsUpstreamTaskData).toBe(false);
    expect(raw.containsProtectedContent).toBe(false);
    expect(raw.syntheticNotice).toBe("PM-authored synthetic values; no upstream task data.");
    const result = publicEvalCorners.evaluateSyntheticFixture(raw);
    expect(result.cornerId).toBe(cornerId);
    expect(result.passed).toBe(true);
    expect(result.claimScope).toBe("adapter-conformance");
    expect(result.efficacyClaimed).toBe(false);
    expect(result.caseResults.length).toBeGreaterThan(0);
  });

  it("keeps permissive MAB substring behavior separate from exact-match diagnostics", () => {
    const result = publicEvalCorners.evaluateSyntheticFixture(
      fixture("mab-factconsolidation.synthetic.json"),
    );
    const verbose = result.caseResults.find((case_) => case_.caseId.endsWith(":current-verbose"));
    expect(verbose?.details.compatibleSubstringMatch).toBe(true);
    expect(verbose?.details.exactMatchDiagnostic).toBe(false);
    expect(verbose?.details.exactMatchIsNonGating).toBe(true);
  });

  it("detects the AppWorld projection weakness without changing the upstream oracle", () => {
    const diagnostic = publicEvalCorners.diagnoseAppWorldDuplicateProjection({
      expectedByReceiver: { synth_a: 12, synth_b: 8 },
      addedRequests: [
        { receiverId: "synth_a", amount: 12 },
        { receiverId: "synth_a", amount: 12 },
        { receiverId: "synth_b", amount: 8 },
      ],
      amountTolerance: 0,
    });
    expect(diagnostic.mappingProjectionMatches).toBe(true);
    expect(diagnostic.recordMultiplicityMatches).toBe(false);
    expect(diagnostic.duplicateReceiverIds).toEqual(["synth_a"]);
    expect(diagnostic.projectionMayHideDuplicate).toBe(true);
    expect(diagnostic.upstreamOracleRemainsAuthoritative).toBe(true);
    expect(diagnostic.nonGating).toBe(true);
  });

  it("exercises tau2 intermediate/collateral failures and Sentinel relative/no-op guards", () => {
    const tau2 = publicEvalCorners.evaluateSyntheticFixture(
      fixture("tau2-airline-32.synthetic.json"),
    );
    expect(
      tau2.caseResults
        .filter((case_) => case_.caseId !== "synthetic-final-state-matches")
        .every((case_) => case_.details.dbMatch === false && case_.passed),
    ).toBe(true);

    const sentinel = publicEvalCorners.evaluateSyntheticFixture(
      fixture("sentinel-stars.synthetic.json"),
    );
    expect(
      sentinel.caseResults.find((case_) => case_.caseId === "synthetic-relative-premature-contact")
        ?.details.success,
    ).toBe(false);
    expect(
      sentinel.caseResults.find((case_) => case_.caseId === "synthetic-noop-no-contact")?.details
        .success,
    ).toBe(true);
    expect(
      sentinel.caseResults.find((case_) => case_.caseId === "synthetic-noop-false-contact")?.details
        .success,
    ).toBe(false);
  });
});

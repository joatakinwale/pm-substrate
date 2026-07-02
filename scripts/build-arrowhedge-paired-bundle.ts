import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildArrowHedgePairedExperimentBatchReport,
  buildArrowHedgePairedExperimentBundleFromIntegrationRuns,
  buildArrowHedgePairedExperimentBundle,
  verifyArrowHedgePairedExperimentBundle,
  type ArrowHedgeIntegrationFetch,
  type ArrowHedgePairedExperimentBatchReport,
  type ArrowHedgeIntegrationRunEnvelope,
  type ArrowHedgePairedExperimentArmMetrics,
  type ArrowHedgePairedExperimentBundle,
  type ArrowHedgePairedExperimentBundleVerification,
} from "../packages/capability-finance-research-ingest/src/arrowhedge-integration.js";

export interface WriteArrowHedgePairedBundleFilesInput {
  readonly experimentId: string;
  readonly baselineEnvelopePath: string;
  readonly substrateEnvelopePath: string;
  readonly outputDir: string;
  readonly baselineMetricsPath?: string;
  readonly substrateMetricsPath?: string;
  readonly generatedAt?: string;
}

export interface WriteArrowHedgePairedBundleFilesResult {
  readonly bundle: ArrowHedgePairedExperimentBundle;
  readonly verification: ArrowHedgePairedExperimentBundleVerification;
  readonly outputPaths: {
    readonly baselineEnvelope: string;
    readonly substrateEnvelope: string;
    readonly pairedReport: string;
    readonly manifest: string;
    readonly pairedBundle: string;
  };
}

export interface WriteArrowHedgePairedBundleFromIntegrationInput {
  readonly experimentId: string;
  readonly integrationBaseUrl: string;
  readonly outputDir: string;
  readonly baselineRunId: number;
  readonly substrateRunId: number;
  readonly bearerToken?: string;
  readonly generatedAt?: string;
  readonly baselineFlowId?: number;
  readonly substrateFlowId?: number;
  readonly baselineBacktestRunId?: number;
  readonly substrateBacktestRunId?: number;
  readonly baselineMode?: string;
  readonly substrateMode?: string;
  readonly baselineMetricsPath?: string;
  readonly substrateMetricsPath?: string;
  readonly fetchFn?: ArrowHedgeIntegrationFetch;
}

export interface ArrowHedgePairedBundleBatchPlan {
  readonly schemaVersion?: "arrowhedge.paired-bundle-batch-plan.v1";
  readonly integrationBaseUrl: string;
  readonly bearerToken?: string;
  readonly generatedAt?: string;
  readonly experiments: readonly {
    readonly experimentId: string;
    readonly generatedAt?: string;
    readonly baseline: {
      readonly runId: number;
      readonly flowId?: number;
      readonly backtestRunId?: number;
      readonly mode?: string;
      readonly metrics?: ArrowHedgePairedExperimentArmMetrics;
    };
    readonly substrate: {
      readonly runId: number;
      readonly flowId?: number;
      readonly backtestRunId?: number;
      readonly mode?: string;
      readonly metrics?: ArrowHedgePairedExperimentArmMetrics;
    };
  }[];
}

export interface WriteArrowHedgePairedBundleBatchFromIntegrationInput {
  readonly planPath: string;
  readonly outputDir: string;
  readonly bearerToken?: string;
  readonly fetchFn?: ArrowHedgeIntegrationFetch;
}

export interface WriteArrowHedgePairedBundleBatchFromIntegrationResult {
  readonly report: ArrowHedgePairedExperimentBatchReport;
  readonly bundles: readonly ArrowHedgePairedExperimentBundle[];
  readonly outputPaths: {
    readonly batchReport: string;
    readonly bundleDirs: readonly string[];
  };
}

export interface VerifyArrowHedgePairedBundleDirectoryResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly bundle?: ArrowHedgePairedExperimentBundle;
  readonly verification?: ArrowHedgePairedExperimentBundleVerification;
}

const metricNumberFields = new Set([
  "startingEquity",
  "endingEquity",
  "realizedPnl",
  "returnPct",
]);

const metricCountFields = new Set([
  "decisionCount",
  "acceptedDecisionCount",
  "blockedDecisionCount",
  "staleBlockCount",
  "invalidActionBlockCount",
  "falsePositiveBlockCount",
  "falseNegativeBlockCount",
]);

const metricStringArrayFields = new Set(["eventIds", "blockedEventIds"]);

const metricFields = new Set([
  ...metricNumberFields,
  ...metricCountFields,
  ...metricStringArrayFields,
  "rawDecisionSha256",
]);

export function writeArrowHedgePairedBundleFiles(
  input: WriteArrowHedgePairedBundleFilesInput,
): WriteArrowHedgePairedBundleFilesResult {
  const baselineEnvelope = readJsonFile<ArrowHedgeIntegrationRunEnvelope>(
    input.baselineEnvelopePath,
  );
  const substrateEnvelope = readJsonFile<ArrowHedgeIntegrationRunEnvelope>(
    input.substrateEnvelopePath,
  );
  const baselineMetrics = readMetricsFile(
    input.baselineMetricsPath,
    "baselineMetrics",
  );
  const substrateMetrics = readMetricsFile(
    input.substrateMetricsPath,
    "substrateMetrics",
  );
  const bundle = buildArrowHedgePairedExperimentBundle({
    experimentId: input.experimentId,
    ...(input.generatedAt === undefined ? {} : { generatedAt: input.generatedAt }),
    baseline: {
      envelope: baselineEnvelope,
      ...(baselineMetrics === undefined ? {} : { metrics: baselineMetrics }),
    },
    substrate: {
      envelope: substrateEnvelope,
      ...(substrateMetrics === undefined ? {} : { metrics: substrateMetrics }),
    },
  });
  const verification = verifyArrowHedgePairedExperimentBundle(bundle);
  if (!verification.valid) {
    throw new Error(
      `generated paired bundle failed verification: ${verification.issues.join("; ")}`,
    );
  }
  const outputPaths = writePairedBundleArtifacts(input.outputDir, bundle);

  return {
    bundle,
    verification,
    outputPaths,
  };
}

export async function writeArrowHedgePairedBundleFromIntegration(
  input: WriteArrowHedgePairedBundleFromIntegrationInput,
): Promise<WriteArrowHedgePairedBundleFilesResult> {
  const baselineMetrics = readMetricsFile(
    input.baselineMetricsPath,
    "baselineMetrics",
  );
  const substrateMetrics = readMetricsFile(
    input.substrateMetricsPath,
    "substrateMetrics",
  );
  const result = await buildArrowHedgePairedExperimentBundleFromIntegrationRuns({
    experimentId: input.experimentId,
    integrationBaseUrl: input.integrationBaseUrl,
    ...(input.bearerToken === undefined ? {} : { bearerToken: input.bearerToken }),
    ...(input.fetchFn === undefined ? {} : { fetchFn: input.fetchFn }),
    ...(input.generatedAt === undefined ? {} : { generatedAt: input.generatedAt }),
    baseline: {
      runId: input.baselineRunId,
      ...(input.baselineFlowId === undefined ? {} : { flowId: input.baselineFlowId }),
      ...(input.baselineBacktestRunId === undefined
        ? {}
        : { backtestRunId: input.baselineBacktestRunId }),
      ...(input.baselineMode === undefined ? {} : { substrateMode: input.baselineMode }),
      ...(baselineMetrics === undefined ? {} : { metrics: baselineMetrics }),
    },
    substrate: {
      runId: input.substrateRunId,
      ...(input.substrateFlowId === undefined ? {} : { flowId: input.substrateFlowId }),
      ...(input.substrateBacktestRunId === undefined
        ? {}
        : { backtestRunId: input.substrateBacktestRunId }),
      ...(input.substrateMode === undefined ? {} : { substrateMode: input.substrateMode }),
      ...(substrateMetrics === undefined ? {} : { metrics: substrateMetrics }),
    },
  });

  if (!result.bundle || !result.verification?.valid) {
    throw new Error(
      `paired integration bundle failed: ${result.issues.join("; ")}`,
    );
  }
  const outputPaths = writePairedBundleArtifacts(input.outputDir, result.bundle);
  return {
    bundle: result.bundle,
    verification: result.verification,
    outputPaths,
  };
}

export async function writeArrowHedgePairedBundleBatchFromIntegration(
  input: WriteArrowHedgePairedBundleBatchFromIntegrationInput,
): Promise<WriteArrowHedgePairedBundleBatchFromIntegrationResult> {
  const plan = readBatchPlan(input.planPath);
  const bundles: ArrowHedgePairedExperimentBundle[] = [];
  const bundleDirs: string[] = [];
  for (const experiment of plan.experiments) {
    const outputDir = join(input.outputDir, sanitizePathSegment(experiment.experimentId));
    const bearerToken = input.bearerToken ?? plan.bearerToken;
    const generatedAt = experiment.generatedAt ?? plan.generatedAt;
    const result = await buildArrowHedgePairedExperimentBundleFromIntegrationRuns({
      experimentId: experiment.experimentId,
      integrationBaseUrl: plan.integrationBaseUrl,
      ...(bearerToken === undefined ? {} : { bearerToken }),
      ...(input.fetchFn === undefined ? {} : { fetchFn: input.fetchFn }),
      ...(generatedAt === undefined ? {} : { generatedAt }),
      baseline: {
        runId: experiment.baseline.runId,
        ...(experiment.baseline.flowId === undefined
          ? {}
          : { flowId: experiment.baseline.flowId }),
        ...(experiment.baseline.backtestRunId === undefined
          ? {}
          : { backtestRunId: experiment.baseline.backtestRunId }),
        ...(experiment.baseline.mode === undefined
          ? {}
          : { substrateMode: experiment.baseline.mode }),
        ...(experiment.baseline.metrics === undefined
          ? {}
          : { metrics: experiment.baseline.metrics }),
      },
      substrate: {
        runId: experiment.substrate.runId,
        ...(experiment.substrate.flowId === undefined
          ? {}
          : { flowId: experiment.substrate.flowId }),
        ...(experiment.substrate.backtestRunId === undefined
          ? {}
          : { backtestRunId: experiment.substrate.backtestRunId }),
        ...(experiment.substrate.mode === undefined
          ? {}
          : { substrateMode: experiment.substrate.mode }),
        ...(experiment.substrate.metrics === undefined
          ? {}
          : { metrics: experiment.substrate.metrics }),
      },
    });
    if (!result.bundle || !result.verification?.valid) {
      throw new Error(
        `batch experiment ${experiment.experimentId} failed: ${result.issues.join("; ")}`,
      );
    }
    writePairedBundleArtifacts(outputDir, result.bundle);
    bundles.push(result.bundle);
    bundleDirs.push(outputDir);
  }

  const report = buildArrowHedgePairedExperimentBatchReport({
    bundles,
    generatedAt: plan.generatedAt,
  });
  mkdirSync(input.outputDir, { recursive: true });
  const batchReport = join(input.outputDir, "batch-report.json");
  writeJsonFile(batchReport, report);
  return {
    report,
    bundles,
    outputPaths: {
      batchReport,
      bundleDirs,
    },
  };
}

export function verifyArrowHedgePairedBundleDirectory(input: {
  readonly bundleDir: string;
}): VerifyArrowHedgePairedBundleDirectoryResult {
  const issues: string[] = [];
  let manifest: ArrowHedgePairedExperimentBundle["manifest"] | undefined;
  try {
    manifest = readJsonFile<ArrowHedgePairedExperimentBundle["manifest"]>(
      join(input.bundleDir, "manifest.json"),
    );
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }

  const baselineArtifactName =
    manifest?.artifacts[0]?.name ?? "baseline-envelope.json";
  const substrateArtifactName =
    manifest?.artifacts[1]?.name ?? "substrate-envelope.json";
  const reportArtifactName = manifest?.artifacts[2]?.name ?? "paired-report.json";

  try {
    const baselineEnvelope = readJsonFile<ArrowHedgeIntegrationRunEnvelope>(
      join(input.bundleDir, baselineArtifactName),
    );
    const substrateEnvelope = readJsonFile<ArrowHedgeIntegrationRunEnvelope>(
      join(input.bundleDir, substrateArtifactName),
    );
    const report = readJsonFile<ArrowHedgePairedExperimentBundle["report"]>(
      join(input.bundleDir, reportArtifactName),
    );
    if (manifest === undefined) {
      return {
        valid: false,
        issues,
      };
    }

    const bundle: ArrowHedgePairedExperimentBundle = {
      schemaVersion: "arrowhedge.paired-experiment-bundle.v1",
      manifest,
      baselineEnvelope,
      substrateEnvelope,
      report,
    };
    const verification = verifyArrowHedgePairedExperimentBundle(bundle);
    const combinedIssues = [...issues, ...verification.issues];
    return {
      valid: combinedIssues.length === 0,
      issues: combinedIssues,
      bundle,
      verification,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [
        ...issues,
        error instanceof Error ? error.message : String(error),
      ],
    };
  }
}

function writePairedBundleArtifacts(
  outputDir: string,
  bundle: ArrowHedgePairedExperimentBundle,
): WriteArrowHedgePairedBundleFilesResult["outputPaths"] {
  const outputPaths = {
    baselineEnvelope: join(outputDir, "baseline-envelope.json"),
    substrateEnvelope: join(outputDir, "substrate-envelope.json"),
    pairedReport: join(outputDir, "paired-report.json"),
    manifest: join(outputDir, "manifest.json"),
    pairedBundle: join(outputDir, "paired-bundle.json"),
  };

  mkdirSync(outputDir, { recursive: true });
  writeJsonFile(outputPaths.baselineEnvelope, bundle.baselineEnvelope);
  writeJsonFile(outputPaths.substrateEnvelope, bundle.substrateEnvelope);
  writeJsonFile(outputPaths.pairedReport, bundle.report);
  writeJsonFile(outputPaths.manifest, bundle.manifest);
  writeJsonFile(outputPaths.pairedBundle, bundle);
  return outputPaths;
}

function readMetricsFile(
  path: string | undefined,
  label: "baselineMetrics" | "substrateMetrics",
): ArrowHedgePairedExperimentArmMetrics | undefined {
  if (path === undefined) return undefined;
  return readPairedMetrics(readJsonFile<unknown>(path), label);
}

function readBatchPlan(path: string): ArrowHedgePairedBundleBatchPlan {
  const value = readJsonFile<unknown>(path);
  if (!isRecord(value)) {
    throw new Error("batch plan must be an object");
  }
  const integrationBaseUrl = value["integrationBaseUrl"];
  if (typeof integrationBaseUrl !== "string" || integrationBaseUrl.trim() === "") {
    throw new Error("batch plan integrationBaseUrl must be a non-empty string");
  }
  const experimentsValue = value["experiments"];
  if (!Array.isArray(experimentsValue) || experimentsValue.length === 0) {
    throw new Error("batch plan experiments must be a non-empty array");
  }
  return {
    ...(value["schemaVersion"] === undefined
      ? {}
      : { schemaVersion: "arrowhedge.paired-bundle-batch-plan.v1" as const }),
    integrationBaseUrl,
    ...(typeof value["bearerToken"] === "string"
      ? { bearerToken: value["bearerToken"] }
      : {}),
    ...(typeof value["generatedAt"] === "string"
      ? { generatedAt: value["generatedAt"] }
      : {}),
    experiments: experimentsValue.map((item, index) =>
      readBatchPlanExperiment(item, index),
    ),
  };
}

function readBatchPlanExperiment(
  value: unknown,
  index: number,
): ArrowHedgePairedBundleBatchPlan["experiments"][number] {
  if (!isRecord(value)) {
    throw new Error(`batch plan experiments[${index}] must be an object`);
  }
  const experimentId = value["experimentId"];
  if (typeof experimentId !== "string" || experimentId.trim() === "") {
    throw new Error(`batch plan experiments[${index}].experimentId must be a non-empty string`);
  }
  return {
    experimentId,
    ...(typeof value["generatedAt"] === "string"
      ? { generatedAt: value["generatedAt"] }
      : {}),
    baseline: readBatchPlanArm(value["baseline"], `experiments[${index}].baseline`),
    substrate: readBatchPlanArm(value["substrate"], `experiments[${index}].substrate`),
  };
}

function readBatchPlanArm(
  value: unknown,
  path: string,
): ArrowHedgePairedBundleBatchPlan["experiments"][number]["baseline"] {
  if (!isRecord(value)) {
    throw new Error(`batch plan ${path} must be an object`);
  }
  const runId = integerField(value, "runId", `batch plan ${path}.runId`);
  return {
    runId,
    ...optionalIntegerField(value, "flowId"),
    ...optionalIntegerField(value, "backtestRunId"),
    ...(typeof value["mode"] === "string" ? { mode: value["mode"] } : {}),
    ...(value["metrics"] === undefined
      ? {}
      : {
          metrics: readPairedMetrics(
            value["metrics"],
            path.endsWith(".baseline") ? "baselineMetrics" : "substrateMetrics",
          ),
        }),
  };
}

function integerField(
  record: Record<string, unknown>,
  field: string,
  path: string,
): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${path} must be an integer`);
  }
  return value;
}

function optionalIntegerField<TField extends string>(
  record: Record<string, unknown>,
  field: TField,
): Record<TField, number> | Record<string, never> {
  const value = record[field];
  if (value === undefined) return {};
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`);
  }
  return { [field]: value } as Record<TField, number>;
}

function readPairedMetrics(
  value: unknown,
  label: "baselineMetrics" | "substrateMetrics",
): ArrowHedgePairedExperimentArmMetrics {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  const issues: string[] = [];
  const metrics: Record<string, unknown> = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (!metricFields.has(field)) {
      issues.push(`${label}.${field} is not supported`);
      continue;
    }
    if (metricNumberFields.has(field)) {
      if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
        issues.push(`${label}.${field} must be a finite number`);
        continue;
      }
      metrics[field] = fieldValue;
      continue;
    }
    if (metricCountFields.has(field)) {
      if (
        typeof fieldValue !== "number" ||
        !Number.isInteger(fieldValue) ||
        fieldValue < 0
      ) {
        issues.push(`${label}.${field} must be a non-negative integer`);
        continue;
      }
      metrics[field] = fieldValue;
      continue;
    }
    if (metricStringArrayFields.has(field)) {
      if (
        !Array.isArray(fieldValue) ||
        fieldValue.some((item) => typeof item !== "string" || item.trim() === "")
      ) {
        issues.push(`${label}.${field} must be an array of non-empty strings`);
        continue;
      }
      metrics[field] = fieldValue;
      continue;
    }
    if (typeof fieldValue !== "string" || fieldValue.trim() === "") {
      issues.push(`${label}.${field} must be a non-empty string`);
      continue;
    }
    metrics[field] = fieldValue;
  }

  if (issues.length > 0) {
    throw new Error(issues.join("; "));
  }
  return metrics as ArrowHedgePairedExperimentArmMetrics;
}

function readJsonFile<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to read JSON ${path}: ${message}`);
  }
}

function writeJsonFile(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArgs(argv: readonly string[]):
  | { readonly command: "write"; readonly input: WriteArrowHedgePairedBundleFilesInput }
  | { readonly command: "from-integration"; readonly input: WriteArrowHedgePairedBundleFromIntegrationInput }
  | { readonly command: "verify"; readonly bundleDir: string } {
  const [command, ...rest] = argv;
  const args = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(usage());
    }
    args.set(key, value);
  }

  if (command === "write") {
    const experimentId = args.get("--experiment-id");
    const baselineEnvelopePath = args.get("--baseline-envelope");
    const substrateEnvelopePath = args.get("--substrate-envelope");
    const outputDir = args.get("--out");
    if (!experimentId || !baselineEnvelopePath || !substrateEnvelopePath || !outputDir) {
      throw new Error(usage());
    }
    return {
      command,
      input: {
        experimentId,
        baselineEnvelopePath,
        substrateEnvelopePath,
        outputDir,
        ...(args.has("--baseline-metrics")
          ? { baselineMetricsPath: args.get("--baseline-metrics")! }
          : {}),
        ...(args.has("--substrate-metrics")
          ? { substrateMetricsPath: args.get("--substrate-metrics")! }
          : {}),
        ...(args.has("--generated-at")
          ? { generatedAt: args.get("--generated-at")! }
          : {}),
      },
    };
  }

  if (command === "from-integration") {
    const experimentId = args.get("--experiment-id");
    const integrationBaseUrl = args.get("--base-url");
    const outputDir = args.get("--out");
    const baselineRunId = numberArg(args, "--baseline-run-id");
    const substrateRunId = numberArg(args, "--substrate-run-id");
    if (!experimentId || !integrationBaseUrl || !outputDir || baselineRunId === undefined || substrateRunId === undefined) {
      throw new Error(usage());
    }
    return {
      command,
      input: {
        experimentId,
        integrationBaseUrl,
        outputDir,
        baselineRunId,
        substrateRunId,
        ...(args.has("--bearer-token")
          ? { bearerToken: args.get("--bearer-token")! }
          : {}),
        ...(args.has("--generated-at")
          ? { generatedAt: args.get("--generated-at")! }
          : {}),
        ...optionalNumberArg(args, "--baseline-flow-id", "baselineFlowId"),
        ...optionalNumberArg(args, "--substrate-flow-id", "substrateFlowId"),
        ...optionalNumberArg(args, "--baseline-backtest-run-id", "baselineBacktestRunId"),
        ...optionalNumberArg(args, "--substrate-backtest-run-id", "substrateBacktestRunId"),
        ...(args.has("--baseline-mode")
          ? { baselineMode: args.get("--baseline-mode")! }
          : {}),
        ...(args.has("--substrate-mode")
          ? { substrateMode: args.get("--substrate-mode")! }
          : {}),
        ...(args.has("--baseline-metrics")
          ? { baselineMetricsPath: args.get("--baseline-metrics")! }
          : {}),
        ...(args.has("--substrate-metrics")
          ? { substrateMetricsPath: args.get("--substrate-metrics")! }
          : {}),
      },
    };
  }

  if (command === "verify") {
    const bundleDir = args.get("--bundle-dir");
    if (!bundleDir) {
      throw new Error(usage());
    }
    return { command, bundleDir };
  }

  throw new Error(usage());
}

function numberArg(args: ReadonlyMap<string, string>, key: string): number | undefined {
  const value = args.get(key);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be an integer`);
  }
  return parsed;
}

function optionalNumberArg<TField extends string>(
  args: ReadonlyMap<string, string>,
  key: string,
  field: TField,
): Record<TField, number> | Record<string, never> {
  const parsed = numberArg(args, key);
  return parsed === undefined ? {} : ({ [field]: parsed } as Record<TField, number>);
}

function usage(): string {
  return [
    "usage:",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts write --experiment-id <id> --baseline-envelope <path> --substrate-envelope <path> --out <dir> [--baseline-metrics <path>] [--substrate-metrics <path>] [--generated-at <iso>]",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts from-integration --experiment-id <id> --base-url <url> --baseline-run-id <id> --substrate-run-id <id> --out <dir> [--bearer-token <token>] [--baseline-flow-id <id>] [--substrate-flow-id <id>] [--baseline-backtest-run-id <id>] [--substrate-backtest-run-id <id>] [--baseline-mode <mode>] [--substrate-mode <mode>] [--baseline-metrics <path>] [--substrate-metrics <path>] [--generated-at <iso>]",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts verify --bundle-dir <dir>",
  ].join("\n");
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === "write") {
    const result = writeArrowHedgePairedBundleFiles(parsed.input);
    console.log(
      JSON.stringify(
        {
          valid: result.verification.valid,
          ready: result.bundle.report.ready,
          marketWinClaimAllowed: result.bundle.report.marketWinClaimAllowed,
          claimIssues: result.bundle.report.claimIssues,
          manifestPath: result.outputPaths.manifest,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (parsed.command === "from-integration") {
    const result = await writeArrowHedgePairedBundleFromIntegration(parsed.input);
    console.log(
      JSON.stringify(
        {
          valid: result.verification.valid,
          ready: result.bundle.report.ready,
          marketWinClaimAllowed: result.bundle.report.marketWinClaimAllowed,
          claimIssues: result.bundle.report.claimIssues,
          manifestPath: result.outputPaths.manifest,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = verifyArrowHedgePairedBundleDirectory({
    bundleDir: parsed.bundleDir,
  });
  console.log(
    JSON.stringify(
      {
        valid: result.valid,
        issues: result.issues,
        marketWinClaimAllowed:
          result.bundle?.report.marketWinClaimAllowed ?? false,
      },
      null,
      2,
    ),
  );
  process.exitCode = result.valid ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

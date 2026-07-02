import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildArrowHedgePairedExperimentBundle,
  verifyArrowHedgePairedExperimentBundle,
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

  const outputPaths = {
    baselineEnvelope: join(input.outputDir, "baseline-envelope.json"),
    substrateEnvelope: join(input.outputDir, "substrate-envelope.json"),
    pairedReport: join(input.outputDir, "paired-report.json"),
    manifest: join(input.outputDir, "manifest.json"),
    pairedBundle: join(input.outputDir, "paired-bundle.json"),
  };

  mkdirSync(input.outputDir, { recursive: true });
  writeJsonFile(outputPaths.baselineEnvelope, bundle.baselineEnvelope);
  writeJsonFile(outputPaths.substrateEnvelope, bundle.substrateEnvelope);
  writeJsonFile(outputPaths.pairedReport, bundle.report);
  writeJsonFile(outputPaths.manifest, bundle.manifest);
  writeJsonFile(outputPaths.pairedBundle, bundle);

  return {
    bundle,
    verification,
    outputPaths,
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

function readMetricsFile(
  path: string | undefined,
  label: "baselineMetrics" | "substrateMetrics",
): ArrowHedgePairedExperimentArmMetrics | undefined {
  if (path === undefined) return undefined;
  return readPairedMetrics(readJsonFile<unknown>(path), label);
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

  if (command === "verify") {
    const bundleDir = args.get("--bundle-dir");
    if (!bundleDir) {
      throw new Error(usage());
    }
    return { command, bundleDir };
  }

  throw new Error(usage());
}

function usage(): string {
  return [
    "usage:",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts write --experiment-id <id> --baseline-envelope <path> --substrate-envelope <path> --out <dir> [--baseline-metrics <path>] [--substrate-metrics <path>] [--generated-at <iso>]",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts verify --bundle-dir <dir>",
  ].join("\n");
}

function main(): void {
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
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

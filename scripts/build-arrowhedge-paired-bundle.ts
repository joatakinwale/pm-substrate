import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildArrowHedgeRunEnvelopeFromIntegrationSnapshot,
  compareArrowHedgeIntegrationRunEnvelopePair,
  deriveArrowHedgePairedExperimentArmMetricsFromIntegrationSnapshot,
  fetchArrowHedgeIntegrationSnapshot,
  validateArrowHedgeIntegrationSnapshot,
  buildArrowHedgePairedExperimentBatchReport,
  buildArrowHedgePairedExperimentBundleFromIntegrationRuns,
  buildArrowHedgePairedExperimentBundle,
  verifyArrowHedgePairedExperimentBundle,
  type ArrowHedgeIntegrationFetch,
  type ArrowHedgeIntegrationFlowRun,
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

export interface DiscoverArrowHedgePairedBatchPlanFromIntegrationInput {
  readonly integrationBaseUrl: string;
  readonly outputDir: string;
  readonly bearerToken?: string;
  readonly generatedAt?: string;
  readonly runIds?: readonly number[];
  readonly fetchFn?: ArrowHedgeIntegrationFetch;
}

export interface ArrowHedgePairedBatchPlanDiscoveryReport {
  readonly schemaVersion: "arrowhedge.paired-batch-plan-discovery-report.v1";
  readonly generatedAt: string;
  readonly backtestRunCount: number;
  readonly labeledBaselineCount: number;
  readonly labeledSubstrateCount: number;
  readonly plannedExperimentCount: number;
  readonly planPath: string;
  readonly issues: readonly string[];
  readonly skippedRuns: readonly {
    readonly runId: number;
    readonly reason: string;
  }[];
  readonly candidates: readonly {
    readonly baselineRunId: number;
    readonly substrateRunId: number;
    readonly ready: boolean;
    readonly issues: readonly string[];
  }[];
}

export interface DiscoverArrowHedgePairedBatchPlanFromIntegrationResult {
  readonly plan: ArrowHedgePairedBundleBatchPlan;
  readonly report: ArrowHedgePairedBatchPlanDiscoveryReport;
  readonly outputPaths: {
    readonly plan: string;
    readonly report: string;
  };
}

export interface RunArrowHedgePairedExperimentFromIntegrationInput {
  readonly planPath: string;
  readonly outputDir: string;
  readonly bearerToken?: string;
  readonly fetchFn?: ArrowHedgeIntegrationFetch;
}

export interface ArrowHedgePairedRunPlan {
  readonly schemaVersion?: "arrowhedge.paired-run-plan.v1";
  readonly integrationBaseUrl: string;
  readonly flowId: number;
  readonly experimentId: string;
  readonly bearerToken?: string;
  readonly generatedAt?: string;
  readonly request: Record<string, unknown>;
  readonly baseline?: {
    readonly mode?: string;
    readonly requestOverrides?: Record<string, unknown>;
  };
  readonly substrate?: {
    readonly mode?: string;
    readonly requestOverrides?: Record<string, unknown>;
  };
}

export interface ArrowHedgePairedRunReport {
  readonly schemaVersion: "arrowhedge.paired-run-report.v1";
  readonly generatedAt: string;
  readonly integrationBaseUrl: string;
  readonly flowId: number;
  readonly experimentId: string;
  readonly baseline: ArrowHedgePairedRunArmReport;
  readonly substrate: ArrowHedgePairedRunArmReport;
  readonly discovery: ArrowHedgePairedBatchPlanDiscoveryReport;
}

export interface ArrowHedgePairedRunArmReport {
  readonly role: "baseline" | "substrate";
  readonly mode: string;
  readonly runId: number;
  readonly flowId: number;
  readonly status: string;
  readonly backtestDayCount: number;
}

export interface RunArrowHedgePairedExperimentFromIntegrationResult {
  readonly report: ArrowHedgePairedRunReport;
  readonly discovery: DiscoverArrowHedgePairedBatchPlanFromIntegrationResult;
  readonly outputPaths: {
    readonly runReport: string;
    readonly plan: string;
    readonly discoveryReport: string;
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

export async function discoverArrowHedgePairedBatchPlanFromIntegration(
  input: DiscoverArrowHedgePairedBatchPlanFromIntegrationInput,
): Promise<DiscoverArrowHedgePairedBatchPlanFromIntegrationResult> {
  const inventory = await fetchArrowHedgeIntegrationSnapshot({
    integrationBaseUrl: input.integrationBaseUrl,
    ...(input.bearerToken === undefined ? {} : { bearerToken: input.bearerToken }),
    ...(input.fetchFn === undefined ? {} : { fetchFn: input.fetchFn }),
  });
  const inventoryValidation = validateArrowHedgeIntegrationSnapshot(inventory);
  if (!inventoryValidation.ready) {
    throw new Error(
      `integration inventory failed validation: ${inventoryValidation.issues.join("; ")}`,
    );
  }

  const discoveredBacktestRunIds = uniqueNumbers(
    inventory.backtests.backtests.map((backtest) => backtest.run_id),
  );
  const backtestRunIds = uniqueNumbers(
    input.runIds === undefined ? discoveredBacktestRunIds : input.runIds,
  );
  const flowIds = uniqueNumbers(
    inventory.backtests.backtests
      .filter((backtest) => backtestRunIds.includes(backtest.run_id))
      .map((backtest) => backtest.flow_id),
  );
  const snapshot = await fetchArrowHedgeIntegrationSnapshot({
    integrationBaseUrl: input.integrationBaseUrl,
    ...(input.bearerToken === undefined ? {} : { bearerToken: input.bearerToken }),
    ...(input.fetchFn === undefined ? {} : { fetchFn: input.fetchFn }),
    flowIds,
    runIds: backtestRunIds,
    backtestRunIds,
  });
  const validation = validateArrowHedgeIntegrationSnapshot(snapshot);
  if (!validation.ready) {
    throw new Error(
      `integration details failed validation: ${validation.issues.join("; ")}`,
    );
  }

  const skippedRuns: ArrowHedgePairedBatchPlanDiscoveryReport["skippedRuns"] = [];
  const arms = backtestRunIds.flatMap((runId) => {
    const run = snapshot.runDetails.find((candidate) => candidate.id === runId);
    if (run === undefined) {
      skippedRuns.push({ runId, reason: "missing run details" });
      return [];
    }
    const mode = inferArrowHedgeRunMode(run);
    if (mode === undefined) {
      skippedRuns.push({ runId, reason: "missing substrate mode label" });
      return [];
    }
    const role = modeRole(mode);
    if (role === "unknown") {
      skippedRuns.push({
        runId,
        reason: `unsupported substrate mode label: ${mode}`,
      });
      return [];
    }
    const envelope = buildArrowHedgeRunEnvelopeFromIntegrationSnapshot({
      snapshot,
      runId,
      substrateMode: mode,
    });
    if (!envelope.valid || envelope.envelope === undefined) {
      skippedRuns.push({
        runId,
        reason: `invalid envelope: ${envelope.issues.join("; ")}`,
      });
      return [];
    }
    return [
      {
        run,
        runId,
        mode,
        role,
        envelope: envelope.envelope,
        metrics: deriveArrowHedgePairedExperimentArmMetricsFromIntegrationSnapshot(
          snapshot,
          runId,
        ),
      },
    ];
  });
  const baselines = arms.filter((arm) => arm.role === "baseline");
  const substrates = arms.filter((arm) => arm.role === "substrate");
  const candidates: ArrowHedgePairedBatchPlanDiscoveryReport["candidates"] = [];
  const experiments: ArrowHedgePairedBundleBatchPlan["experiments"] = [];
  for (const baseline of baselines) {
    for (const substrate of substrates) {
      const gate = compareArrowHedgeIntegrationRunEnvelopePair({
        baseline: baseline.envelope,
        substrate: substrate.envelope,
      });
      candidates.push({
        baselineRunId: baseline.runId,
        substrateRunId: substrate.runId,
        ready: gate.ready,
        issues: gate.issues,
      });
      if (!gate.ready) continue;
      experiments.push({
        experimentId: `exp_arrowhedge_${baseline.runId}_${substrate.runId}`,
        baseline: {
          runId: baseline.runId,
          flowId: baseline.run.flow_id,
          backtestRunId: baseline.runId,
          mode: baseline.mode,
          metrics: baseline.metrics,
        },
        substrate: {
          runId: substrate.runId,
          flowId: substrate.run.flow_id,
          backtestRunId: substrate.runId,
          mode: substrate.mode,
          metrics: substrate.metrics,
        },
      });
    }
  }

  const plan: ArrowHedgePairedBundleBatchPlan = {
    schemaVersion: "arrowhedge.paired-bundle-batch-plan.v1",
    integrationBaseUrl: input.integrationBaseUrl,
    ...(input.bearerToken === undefined ? {} : { bearerToken: input.bearerToken }),
    ...(input.generatedAt === undefined ? {} : { generatedAt: input.generatedAt }),
    experiments,
  };
  const issues = [
    ...(backtestRunIds.length === 0 ? ["no backtest runs found"] : []),
    ...(baselines.length === 0 ? ["no baseline/off/observe runs found"] : []),
    ...(substrates.length === 0 ? ["no blocking/substrate runs found"] : []),
    ...(experiments.length === 0 && backtestRunIds.length > 0
      ? ["no readiness-admitted baseline/substrate pairs found"]
      : []),
  ];
  const outputPaths = {
    plan: join(input.outputDir, "paired-batch-plan.json"),
    report: join(input.outputDir, "plan-discovery-report.json"),
  };
  const report: ArrowHedgePairedBatchPlanDiscoveryReport = {
    schemaVersion: "arrowhedge.paired-batch-plan-discovery-report.v1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    backtestRunCount: backtestRunIds.length,
    labeledBaselineCount: baselines.length,
    labeledSubstrateCount: substrates.length,
    plannedExperimentCount: experiments.length,
    planPath: outputPaths.plan,
    issues,
    skippedRuns,
    candidates,
  };

  mkdirSync(input.outputDir, { recursive: true });
  writeJsonFile(outputPaths.plan, plan);
  writeJsonFile(outputPaths.report, report);
  return {
    plan,
    report,
    outputPaths,
  };
}

export async function runArrowHedgePairedExperimentFromIntegration(
  input: RunArrowHedgePairedExperimentFromIntegrationInput,
): Promise<RunArrowHedgePairedExperimentFromIntegrationResult> {
  const plan = readPairedRunPlan(input.planPath);
  const bearerToken = input.bearerToken ?? plan.bearerToken;
  const generatedAt = plan.generatedAt ?? new Date().toISOString();
  const baseline = await runArrowHedgeBacktestArm({
    plan,
    role: "baseline",
    mode: plan.baseline?.mode ?? "off",
    requestOverrides: plan.baseline?.requestOverrides,
    ...(bearerToken === undefined ? {} : { bearerToken }),
    ...(input.fetchFn === undefined ? {} : { fetchFn: input.fetchFn }),
  });
  const substrate = await runArrowHedgeBacktestArm({
    plan,
    role: "substrate",
    mode: plan.substrate?.mode ?? "blocking",
    requestOverrides: plan.substrate?.requestOverrides,
    ...(bearerToken === undefined ? {} : { bearerToken }),
    ...(input.fetchFn === undefined ? {} : { fetchFn: input.fetchFn }),
  });
  const discovery = await discoverArrowHedgePairedBatchPlanFromIntegration({
    integrationBaseUrl: plan.integrationBaseUrl,
    outputDir: join(input.outputDir, "discovery"),
    generatedAt,
    runIds: [baseline.runId, substrate.runId],
    ...(bearerToken === undefined ? {} : { bearerToken }),
    ...(input.fetchFn === undefined ? {} : { fetchFn: input.fetchFn }),
  });
  const report: ArrowHedgePairedRunReport = {
    schemaVersion: "arrowhedge.paired-run-report.v1",
    generatedAt,
    integrationBaseUrl: plan.integrationBaseUrl,
    flowId: plan.flowId,
    experimentId: plan.experimentId,
    baseline,
    substrate,
    discovery: discovery.report,
  };
  mkdirSync(input.outputDir, { recursive: true });
  const runReport = join(input.outputDir, "paired-run-report.json");
  writeJsonFile(runReport, report);
  return {
    report,
    discovery,
    outputPaths: {
      runReport,
      plan: discovery.outputPaths.plan,
      discoveryReport: discovery.outputPaths.report,
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

async function runArrowHedgeBacktestArm(input: {
  readonly plan: ArrowHedgePairedRunPlan;
  readonly role: "baseline" | "substrate";
  readonly mode: string;
  readonly bearerToken?: string;
  readonly requestOverrides?: Record<string, unknown>;
  readonly fetchFn?: ArrowHedgeIntegrationFetch;
}): Promise<ArrowHedgePairedRunArmReport> {
  const fetchFn = arrowHedgeFetch(input.fetchFn);
  const requestData = buildPairedRunRequestData({
    plan: input.plan,
    role: input.role,
    mode: input.mode,
    requestOverrides: input.requestOverrides,
  });
  const headers = arrowHedgeJsonHeaders(input.bearerToken);
  const created = await arrowHedgeRequestJson<{
    readonly id: number;
    readonly flow_id: number;
    readonly status: string;
  }>({
    fetchFn,
    url: arrowHedgeAppUrl(
      input.plan.integrationBaseUrl,
      `/flows/${input.plan.flowId}/runs/`,
    ),
    method: "POST",
    headers,
    body: { request_data: requestData },
  });
  const runId = integerValue(created["id"], "created flow run id");
  const flowId = integerValue(created["flow_id"], "created flow run flow_id");
  await arrowHedgeRequestJson<unknown>({
    fetchFn,
    url: arrowHedgeAppUrl(
      input.plan.integrationBaseUrl,
      `/flows/${input.plan.flowId}/runs/${runId}`,
    ),
    method: "PUT",
    headers,
    body: { status: "IN_PROGRESS" },
  });

  try {
    const streamText = await arrowHedgeRequestText({
      fetchFn,
      url: arrowHedgeAppUrl(input.plan.integrationBaseUrl, "/hedge-fund/backtest"),
      method: "POST",
      headers,
      body: requestData,
    });
    const backtest = parseArrowHedgeBacktestSse(streamText);
    const saved = await arrowHedgeRequestJson<{
      readonly status: string;
    }>({
      fetchFn,
      url: arrowHedgeAppUrl(
        input.plan.integrationBaseUrl,
        `/flows/${input.plan.flowId}/runs/${runId}`,
      ),
      method: "PUT",
      headers,
      body: {
        status: "COMPLETE",
        results: {
          backtest: {
            results: backtest.days,
            performance_metrics: backtest.finalData.performance_metrics ?? {},
            final_portfolio: backtest.finalData.final_portfolio ?? {},
            total_days: backtest.finalData.total_days ?? backtest.days.length,
            ...(backtest.finalData.provenance === undefined
              ? {}
              : { provenance: backtest.finalData.provenance }),
          },
          pairedExperiment: {
            experimentId: input.plan.experimentId,
            arm: input.role,
            substrateMode: input.mode,
          },
        },
      },
    });
    return {
      role: input.role,
      mode: input.mode,
      runId,
      flowId,
      status: typeof saved["status"] === "string" ? saved["status"] : "COMPLETE",
      backtestDayCount: backtest.days.length,
    };
  } catch (error) {
    await arrowHedgeRequestJson<unknown>({
      fetchFn,
      url: arrowHedgeAppUrl(
        input.plan.integrationBaseUrl,
        `/flows/${input.plan.flowId}/runs/${runId}`,
      ),
      method: "PUT",
      headers,
      body: {
        status: "ERROR",
        error_message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

function buildPairedRunRequestData(input: {
  readonly plan: ArrowHedgePairedRunPlan;
  readonly role: "baseline" | "substrate";
  readonly mode: string;
  readonly requestOverrides?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...input.plan.request,
    ...(input.requestOverrides ?? {}),
    substrate_mode: input.mode,
    pm_substrate_mode: input.mode,
    paired_experiment_id: input.plan.experimentId,
    paired_experiment_arm: input.role,
  };
}

function parseArrowHedgeBacktestSse(text: string): {
  readonly days: readonly Record<string, unknown>[];
  readonly finalData: Record<string, unknown>;
} {
  const days: Record<string, unknown>[] = [];
  let finalData: Record<string, unknown> | undefined;
  for (const event of parseSseEvents(text)) {
    const payload = recordOrThrow(event.data, `SSE ${event.event} data`);
    if (event.event === "progress" && payload["agent"] === "backtest") {
      const analysis = payload["analysis"];
      if (typeof analysis !== "string" || analysis.trim() === "") continue;
      const parsed = JSON.parse(analysis) as unknown;
      days.push(recordOrThrow(parsed, "backtest progress analysis"));
      continue;
    }
    if (event.event === "complete") {
      finalData = recordOrThrow(payload["data"], "backtest complete data");
      continue;
    }
    if (event.event === "error") {
      const message = typeof payload["message"] === "string"
        ? payload["message"]
        : "ArrowHedge backtest stream returned an error";
      throw new Error(message);
    }
  }
  if (finalData === undefined) {
    throw new Error("ArrowHedge backtest stream did not include a complete event");
  }
  if (days.length === 0) {
    throw new Error("ArrowHedge backtest stream did not include backtest day results");
  }
  return { days, finalData };
}

function parseSseEvents(text: string): readonly {
  readonly event: string;
  readonly data: unknown;
}[] {
  return text
    .split(/\r?\n\r?\n/)
    .flatMap((block) => {
      const lines = block.split(/\r?\n/);
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLines = lines.filter((line) => line.startsWith("data:"));
      if (eventLine === undefined || dataLines.length === 0) return [];
      const event = eventLine.slice("event:".length).trim();
      const dataText = dataLines
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");
      return [{ event, data: JSON.parse(dataText) }];
    });
}

async function arrowHedgeRequestJson<T>(input: {
  readonly fetchFn: ArrowHedgeIntegrationFetch;
  readonly url: string;
  readonly method: "POST" | "PUT";
  readonly headers: Record<string, string>;
  readonly body: unknown;
}): Promise<T> {
  const response = await input.fetchFn(input.url, {
    method: input.method,
    headers: input.headers,
    body: JSON.stringify(input.body),
  });
  if (!response.ok) {
    throw new Error(
      `${input.method} ${input.url} failed: ${response.status} ${response.statusText ?? ""} ${await response.text()}`.trim(),
    );
  }
  return response.json() as Promise<T>;
}

async function arrowHedgeRequestText(input: {
  readonly fetchFn: ArrowHedgeIntegrationFetch;
  readonly url: string;
  readonly method: "POST";
  readonly headers: Record<string, string>;
  readonly body: unknown;
}): Promise<string> {
  const response = await input.fetchFn(input.url, {
    method: input.method,
    headers: input.headers,
    body: JSON.stringify(input.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${input.method} ${input.url} failed: ${response.status} ${response.statusText ?? ""} ${text}`.trim(),
    );
  }
  return text;
}

function arrowHedgeFetch(
  fetchFn: ArrowHedgeIntegrationFetch | undefined,
): ArrowHedgeIntegrationFetch {
  const resolved =
    fetchFn ?? (globalThis as unknown as { fetch?: ArrowHedgeIntegrationFetch }).fetch;
  if (resolved === undefined) {
    throw new Error("No fetch implementation available for ArrowHedge runner");
  }
  return resolved;
}

function arrowHedgeJsonHeaders(
  bearerToken: string | undefined,
): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    ...(bearerToken === undefined ? {} : { authorization: `Bearer ${bearerToken}` }),
  };
}

function arrowHedgeAppUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const appBase = trimmed.endsWith("/integration/v1")
    ? trimmed.slice(0, -"/integration/v1".length)
    : trimmed;
  return `${appBase}${path}`;
}

function integerValue(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${path} must be an integer`);
  }
  return value;
}

function recordOrThrow(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
}

function uniqueNumbers(values: readonly number[]): readonly number[] {
  return [...new Set(values)];
}

function inferArrowHedgeRunMode(
  run: ArrowHedgeIntegrationFlowRun,
): string | undefined {
  const request = isRecord(run.requestData) ? run.requestData : undefined;
  const results = isRecord(run.results) ? run.results : undefined;
  return normalizeRunMode(
    stringField(request, "substrate_mode") ??
      stringField(request, "substrateMode") ??
      stringField(request, "pm_substrate_mode") ??
      stringField(request, "pmSubstrateMode") ??
      stringField(results, "substrate_mode") ??
      stringField(results, "substrateMode") ??
      stringField(results, "pm_substrate_mode") ??
      stringField(results, "pmSubstrateMode"),
  );
}

function normalizeRunMode(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  return normalized.length === 0 ? undefined : normalized;
}

function modeRole(mode: string): "baseline" | "substrate" | "unknown" {
  if (["off", "observe", "baseline", "without_substrate"].includes(mode)) {
    return "baseline";
  }
  if (["blocking", "substrate", "with_substrate"].includes(mode)) {
    return "substrate";
  }
  return "unknown";
}

function stringField(
  record: Record<string, unknown> | undefined,
  field: string,
): string | undefined {
  const value = record?.[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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

function readPairedRunPlan(path: string): ArrowHedgePairedRunPlan {
  const value = readJsonFile<unknown>(path);
  if (!isRecord(value)) {
    throw new Error("paired run plan must be an object");
  }
  const integrationBaseUrl = value["integrationBaseUrl"];
  if (typeof integrationBaseUrl !== "string" || integrationBaseUrl.trim() === "") {
    throw new Error("paired run plan integrationBaseUrl must be a non-empty string");
  }
  const experimentId = value["experimentId"];
  if (typeof experimentId !== "string" || experimentId.trim() === "") {
    throw new Error("paired run plan experimentId must be a non-empty string");
  }
  const request = value["request"];
  if (!isRecord(request)) {
    throw new Error("paired run plan request must be an object");
  }
  return {
    ...(value["schemaVersion"] === undefined
      ? {}
      : { schemaVersion: "arrowhedge.paired-run-plan.v1" as const }),
    integrationBaseUrl,
    experimentId,
    flowId: integerField(value, "flowId", "paired run plan flowId"),
    ...(typeof value["bearerToken"] === "string"
      ? { bearerToken: value["bearerToken"] }
      : {}),
    ...(typeof value["generatedAt"] === "string"
      ? { generatedAt: value["generatedAt"] }
      : {}),
    request,
    ...readPairedRunPlanArm(value, "baseline"),
    ...readPairedRunPlanArm(value, "substrate"),
  };
}

function readPairedRunPlanArm(
  value: Record<string, unknown>,
  field: "baseline" | "substrate",
): Pick<ArrowHedgePairedRunPlan, typeof field> | Record<string, never> {
  const arm = value[field];
  if (arm === undefined) return {};
  if (!isRecord(arm)) {
    throw new Error(`paired run plan ${field} must be an object`);
  }
  const requestOverrides = arm["requestOverrides"];
  if (requestOverrides !== undefined && !isRecord(requestOverrides)) {
    throw new Error(`paired run plan ${field}.requestOverrides must be an object`);
  }
  return {
    [field]: {
      ...(typeof arm["mode"] === "string" ? { mode: arm["mode"] } : {}),
      ...(requestOverrides === undefined ? {} : { requestOverrides }),
    },
  } as Pick<ArrowHedgePairedRunPlan, typeof field>;
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

function sanitizePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArgs(argv: readonly string[]):
  | { readonly command: "write"; readonly input: WriteArrowHedgePairedBundleFilesInput }
  | { readonly command: "from-integration"; readonly input: WriteArrowHedgePairedBundleFromIntegrationInput }
  | { readonly command: "batch-from-integration"; readonly input: WriteArrowHedgePairedBundleBatchFromIntegrationInput }
  | { readonly command: "discover-plan-from-integration"; readonly input: DiscoverArrowHedgePairedBatchPlanFromIntegrationInput }
  | { readonly command: "run-paired-from-integration"; readonly input: RunArrowHedgePairedExperimentFromIntegrationInput }
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

  if (command === "batch-from-integration") {
    const planPath = args.get("--plan");
    const outputDir = args.get("--out");
    if (!planPath || !outputDir) {
      throw new Error(usage());
    }
    return {
      command,
      input: {
        planPath,
        outputDir,
        ...(args.has("--bearer-token")
          ? { bearerToken: args.get("--bearer-token")! }
          : {}),
      },
    };
  }

  if (command === "discover-plan-from-integration") {
    const integrationBaseUrl = args.get("--base-url");
    const outputDir = args.get("--out");
    if (!integrationBaseUrl || !outputDir) {
      throw new Error(usage());
    }
    return {
      command,
      input: {
        integrationBaseUrl,
        outputDir,
        ...(args.has("--run-ids")
          ? { runIds: parseNumberList(args.get("--run-ids")!) }
          : {}),
        ...(args.has("--bearer-token")
          ? { bearerToken: args.get("--bearer-token")! }
          : {}),
        ...(args.has("--generated-at")
          ? { generatedAt: args.get("--generated-at")! }
          : {}),
      },
    };
  }

  if (command === "run-paired-from-integration") {
    const planPath = args.get("--plan");
    const outputDir = args.get("--out");
    if (!planPath || !outputDir) {
      throw new Error(usage());
    }
    return {
      command,
      input: {
        planPath,
        outputDir,
        ...(args.has("--bearer-token")
          ? { bearerToken: args.get("--bearer-token")! }
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

function parseNumberList(value: string): readonly number[] {
  const numbers = value.split(",").map((item) => {
    const parsed = Number.parseInt(item.trim(), 10);
    if (!Number.isFinite(parsed)) {
      throw new Error("--run-ids must be a comma-separated list of integers");
    }
    return parsed;
  });
  if (numbers.length === 0) {
    throw new Error("--run-ids must include at least one integer");
  }
  return numbers;
}

function usage(): string {
  return [
    "usage:",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts write --experiment-id <id> --baseline-envelope <path> --substrate-envelope <path> --out <dir> [--baseline-metrics <path>] [--substrate-metrics <path>] [--generated-at <iso>]",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts from-integration --experiment-id <id> --base-url <url> --baseline-run-id <id> --substrate-run-id <id> --out <dir> [--bearer-token <token>] [--baseline-flow-id <id>] [--substrate-flow-id <id>] [--baseline-backtest-run-id <id>] [--substrate-backtest-run-id <id>] [--baseline-mode <mode>] [--substrate-mode <mode>] [--baseline-metrics <path>] [--substrate-metrics <path>] [--generated-at <iso>]",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts batch-from-integration --plan <path> --out <dir> [--bearer-token <token>]",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts discover-plan-from-integration --base-url <url> --out <dir> [--run-ids <id,id>] [--bearer-token <token>] [--generated-at <iso>]",
    "  tsx scripts/build-arrowhedge-paired-bundle.ts run-paired-from-integration --plan <path> --out <dir> [--bearer-token <token>]",
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

  if (parsed.command === "batch-from-integration") {
    const result = await writeArrowHedgePairedBundleBatchFromIntegration(
      parsed.input,
    );
    console.log(
      JSON.stringify(
        {
          schemaVersion: result.report.schemaVersion,
          experimentCount: result.report.experimentCount,
          marketWinClaimAllowedCount:
            result.report.marketWinClaimAllowedCount,
          claimDeniedCount: result.report.claimDeniedCount,
          issueCount: result.report.issueCount,
          batchReportPath: result.outputPaths.batchReport,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (parsed.command === "discover-plan-from-integration") {
    const result = await discoverArrowHedgePairedBatchPlanFromIntegration(
      parsed.input,
    );
    console.log(
      JSON.stringify(
        {
          schemaVersion: result.report.schemaVersion,
          backtestRunCount: result.report.backtestRunCount,
          labeledBaselineCount: result.report.labeledBaselineCount,
          labeledSubstrateCount: result.report.labeledSubstrateCount,
          plannedExperimentCount: result.report.plannedExperimentCount,
          issueCount: result.report.issues.length,
          skippedRunCount: result.report.skippedRuns.length,
          planPath: result.outputPaths.plan,
          reportPath: result.outputPaths.report,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (parsed.command === "run-paired-from-integration") {
    const result = await runArrowHedgePairedExperimentFromIntegration(
      parsed.input,
    );
    console.log(
      JSON.stringify(
        {
          schemaVersion: result.report.schemaVersion,
          experimentId: result.report.experimentId,
          baselineRunId: result.report.baseline.runId,
          substrateRunId: result.report.substrate.runId,
          plannedExperimentCount:
            result.discovery.report.plannedExperimentCount,
          discoveryIssueCount: result.discovery.report.issues.length,
          runReportPath: result.outputPaths.runReport,
          planPath: result.outputPaths.plan,
          discoveryReportPath: result.outputPaths.discoveryReport,
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

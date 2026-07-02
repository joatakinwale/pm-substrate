import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  discoverArrowHedgePairedBatchPlanFromIntegration,
  runArrowHedgePairedExperimentFromIntegration,
  writeArrowHedgePairedBundleBatchFromIntegration,
  writeArrowHedgePairedBundleFromIntegration,
  verifyArrowHedgePairedBundleDirectory,
  writeArrowHedgePairedBundleFiles,
} from "../../../scripts/build-arrowhedge-paired-bundle.js";
import type {
  ArrowHedgeIntegrationFetch,
  ArrowHedgeIntegrationFetchResponse,
} from "./arrowhedge-integration.js";

const baseEnvelope = {
  schemaVersion: "arrowhedge.run-envelope.v1",
  runId: "run_paired_bundle_001",
  surface: "backtest",
  substrateMode: "observe",
  observedAt: "2026-06-03T14:00:00.000Z",
  scope: {
    startDate: "2026-05-01",
    endDate: "2026-06-03",
    tickers: ["AAPL"],
  },
  graph: {
    nodes: [{ id: "agent:ben_graham_agent", kind: "analyst" }],
    edges: [],
  },
  modelConfig: { model: "gpt-4.1", temperature: 0.1 },
  portfolio: {
    cash: 250000,
    equity: 1000000,
    margin_requirement: 0.25,
    margin_used: 0.11,
  },
  signals: [
    {
      id: "sig_ben_graham_AAPL",
      ticker: "AAPL",
      agentId: "ben_graham_agent",
      signal: "bullish",
      confidence: 0.74,
    },
  ],
  riskStates: [
    {
      ticker: "AAPL",
      currentPrice: 189.25,
      remainingPositionLimit: 50000,
      maxShares: 120,
      bindingConstraint: "position_limit",
    },
  ],
  decisions: [
    {
      id: "dec_run_paired_bundle_001_AAPL",
      ticker: "AAPL",
      action: "buy",
      quantity: 100,
      confidence: 0.76,
      reasoning: "AAPL passed the risk gate.",
      accepted: true,
      allowedActions: { hold: 0, buy: 120 },
    },
  ],
  evidence: [
    {
      id: "ev_source_prices_AAPL",
      sourceArtifactId: "financialdatasets.ai:prices:AAPL:abc",
      sha256: "a".repeat(64),
      mimeType: "application/json",
      filename: "aapl-prices.json",
      sourceUri: "arrowhedge://source-artifacts/AAPL",
      ticker: "AAPL",
    },
  ],
};

describe("build-arrowhedge-paired-bundle script", () => {
  it("writes and verifies a replayable paired experiment bundle directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-paired-bundle-"));
    const input = writeInputFiles(dir);
    const result = writeArrowHedgePairedBundleFiles({
      experimentId: "exp_script_arrowhedge_001",
      generatedAt: "2026-06-03T14:05:00.000Z",
      baselineEnvelopePath: input.baselineEnvelopePath,
      substrateEnvelopePath: input.substrateEnvelopePath,
      baselineMetricsPath: input.baselineMetricsPath,
      substrateMetricsPath: input.substrateMetricsPath,
      outputDir: join(dir, "bundle"),
    });

    expect(result.verification.valid).toBe(true);
    expect(result.bundle.report.marketWinClaimAllowed).toBe(true);
    expect(result.bundle.report.market.deltas).toEqual({
      endingEquity: 2500,
      realizedPnl: 2500,
      returnPct: 0.0025,
    });
    expect(readJson(result.outputPaths.manifest)).toMatchObject({
      schemaVersion: "arrowhedge.paired-experiment-manifest.v1",
      experimentId: "exp_script_arrowhedge_001",
      marketWinClaimAllowed: true,
    });
    expect(readJson(result.outputPaths.pairedReport)).toMatchObject({
      schemaVersion: "arrowhedge.paired-experiment-report.v1",
      marketWinClaimAllowed: true,
      claimIssues: [],
    });

    const directoryVerification = verifyArrowHedgePairedBundleDirectory({
      bundleDir: join(dir, "bundle"),
    });
    expect(directoryVerification).toMatchObject({
      valid: true,
      issues: [],
    });
  });

  it("detects a tampered paired report in a written bundle directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-paired-bundle-"));
    const input = writeInputFiles(dir);
    const result = writeArrowHedgePairedBundleFiles({
      experimentId: "exp_script_arrowhedge_tampered",
      generatedAt: "2026-06-03T14:05:00.000Z",
      baselineEnvelopePath: input.baselineEnvelopePath,
      substrateEnvelopePath: input.substrateEnvelopePath,
      baselineMetricsPath: input.baselineMetricsPath,
      substrateMetricsPath: input.substrateMetricsPath,
      outputDir: join(dir, "bundle"),
    });
    const report = readJson(result.outputPaths.pairedReport) as {
      market: { deltas: { realizedPnl: number } };
    };
    report.market.deltas.realizedPnl = 999999;
    writeFileSync(
      result.outputPaths.pairedReport,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );

    const directoryVerification = verifyArrowHedgePairedBundleDirectory({
      bundleDir: join(dir, "bundle"),
    });

    expect(directoryVerification.valid).toBe(false);
    expect(directoryVerification.issues).toEqual(
      expect.arrayContaining([
        "manifest reportSha256 does not match report",
        "report content does not match recomputed paired experiment report",
      ]),
    );
  });

  it("rejects malformed metric evidence before writing a bundle", () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-paired-bundle-"));
    const input = writeInputFiles(dir);
    writeFileSync(
      input.substrateMetricsPath,
      JSON.stringify({ falsePositiveBlockCount: "0" }),
      "utf8",
    );

    expect(() =>
      writeArrowHedgePairedBundleFiles({
        experimentId: "exp_script_arrowhedge_bad_metrics",
        baselineEnvelopePath: input.baselineEnvelopePath,
        substrateEnvelopePath: input.substrateEnvelopePath,
        substrateMetricsPath: input.substrateMetricsPath,
        outputDir: join(dir, "bundle"),
      }),
    ).toThrow(
      "substrateMetrics.falsePositiveBlockCount must be a non-negative integer",
    );
  });

  it("writes a verified bundle directly from ArrowHedge integration run ids", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-paired-bundle-"));
    const input = writeInputFiles(dir);
    const calls: string[] = [];
    const responses = integrationResponses();
    const fetchFn: ArrowHedgeIntegrationFetch = async (url) => {
      calls.push(url);
      return jsonResponse(
        responses.get(url) ?? { error: "not found" },
        responses.has(url) ? 200 : 404,
      );
    };

    const result = await writeArrowHedgePairedBundleFromIntegration({
      experimentId: "exp_script_arrowhedge_from_integration",
      integrationBaseUrl: "https://arrow.example",
      generatedAt: "2026-06-03T14:05:00.000Z",
      baselineRunId: 11,
      substrateRunId: 11,
      baselineFlowId: 7,
      substrateFlowId: 7,
      baselineMetricsPath: input.baselineMetricsPath,
      substrateMetricsPath: input.substrateMetricsPath,
      outputDir: join(dir, "integration-bundle"),
      fetchFn,
    });

    expect(result.verification.valid).toBe(true);
    expect(result.bundle.report.marketWinClaimAllowed).toBe(true);
    expect(calls).toEqual(
      expect.arrayContaining([
        "https://arrow.example/integration/v1/capabilities",
        "https://arrow.example/integration/v1/runs/11",
        "https://arrow.example/integration/v1/runs/11/events",
        "https://arrow.example/integration/v1/runs/11/source-artifacts",
        "https://arrow.example/integration/v1/backtests/11",
        "https://arrow.example/integration/v1/backtests/11/days",
      ]),
    );
    expect(
      verifyArrowHedgePairedBundleDirectory({
        bundleDir: join(dir, "integration-bundle"),
      }),
    ).toMatchObject({ valid: true, issues: [] });
  });

  it("writes a batch report across multiple ArrowHedge integration pairs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-paired-batch-"));
    const planPath = join(dir, "batch-plan.json");
    writeJson(planPath, {
      schemaVersion: "arrowhedge.paired-bundle-batch-plan.v1",
      integrationBaseUrl: "https://arrow.example",
      generatedAt: "2026-06-03T14:10:00.000Z",
      experiments: [
        {
          experimentId: "exp_batch_allowed",
          baseline: {
            runId: 11,
            flowId: 7,
            metrics: {
              endingEquity: 1000000,
              realizedPnl: 0,
              returnPct: 0,
              falsePositiveBlockCount: 0,
              falseNegativeBlockCount: 0,
            },
          },
          substrate: {
            runId: 11,
            flowId: 7,
            metrics: {
              endingEquity: 1002500,
              realizedPnl: 2500,
              returnPct: 0.0025,
              falsePositiveBlockCount: 0,
              falseNegativeBlockCount: 0,
            },
          },
        },
        {
          experimentId: "exp_batch_denied",
          baseline: {
            runId: 11,
            flowId: 7,
            metrics: {
              endingEquity: 1000000,
              realizedPnl: 0,
              returnPct: 0,
              falsePositiveBlockCount: 0,
              falseNegativeBlockCount: 0,
            },
          },
          substrate: {
            runId: 11,
            flowId: 7,
            metrics: {
              endingEquity: 999000,
              realizedPnl: -1000,
              returnPct: -0.001,
              falsePositiveBlockCount: 1,
              falseNegativeBlockCount: 0,
            },
          },
        },
      ],
    });
    const responses = integrationResponses();
    const fetchFn: ArrowHedgeIntegrationFetch = async (url) =>
      jsonResponse(
        responses.get(url) ?? { error: "not found" },
        responses.has(url) ? 200 : 404,
      );

    const result = await writeArrowHedgePairedBundleBatchFromIntegration({
      planPath,
      outputDir: join(dir, "batch"),
      fetchFn,
    });

    expect(result.outputPaths.bundleDirs).toHaveLength(2);
    expect(result.report).toMatchObject({
      schemaVersion: "arrowhedge.paired-experiment-batch-report.v1",
      generatedAt: "2026-06-03T14:10:00.000Z",
      experimentCount: 2,
      validBundleCount: 2,
      readyCount: 2,
      marketWinClaimAllowedCount: 1,
      claimDeniedCount: 1,
      market: {
        metricsAvailableCount: 2,
        substrateOutperformedCount: 1,
        deltaSums: {
          endingEquity: 1500,
          realizedPnl: 1500,
          returnPct: 0.0015,
        },
      },
      governance: {
        gates: {
          falsePositiveBlocksZeroCount: 1,
          falseNegativeBlocksZeroCount: 2,
        },
      },
    });
    expect(result.report.issues).toEqual(
      expect.arrayContaining([
        {
          experimentId: "exp_batch_denied",
          issue: "substrate arm did not outperform baseline on supplied market metrics",
        },
        {
          experimentId: "exp_batch_denied",
          issue: "substrate false-positive blocks must be zero",
        },
      ]),
    );
    expect(readJson(result.outputPaths.batchReport)).toMatchObject({
      schemaVersion: "arrowhedge.paired-experiment-batch-report.v1",
      marketWinClaimAllowedCount: 1,
      claimDeniedCount: 1,
    });
    expect(
      verifyArrowHedgePairedBundleDirectory({
        bundleDir: join(dir, "batch", "exp_batch_allowed"),
      }),
    ).toMatchObject({ valid: true, issues: [] });
  });

  it("discovers only labeled and readiness-admitted ArrowHedge integration pairs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-plan-discovery-"));
    const responses = integrationDiscoveryResponses();
    const fetchFn: ArrowHedgeIntegrationFetch = async (url) =>
      jsonResponse(
        responses.get(url) ?? { error: "not found" },
        responses.has(url) ? 200 : 404,
      );

    const result = await discoverArrowHedgePairedBatchPlanFromIntegration({
      integrationBaseUrl: "https://arrow.example",
      generatedAt: "2026-06-03T14:20:00.000Z",
      outputDir: join(dir, "discovery"),
      fetchFn,
    });

    expect(result.plan.experiments).toEqual([
      expect.objectContaining({
        experimentId: "exp_arrowhedge_11_12",
        baseline: expect.objectContaining({
          runId: 11,
          flowId: 7,
          backtestRunId: 11,
          mode: "off",
        }),
        substrate: expect.objectContaining({
          runId: 12,
          flowId: 7,
          backtestRunId: 12,
          mode: "blocking",
        }),
      }),
    ]);
    expect(result.report).toMatchObject({
      schemaVersion: "arrowhedge.paired-batch-plan-discovery-report.v1",
      generatedAt: "2026-06-03T14:20:00.000Z",
      backtestRunCount: 3,
      labeledBaselineCount: 1,
      labeledSubstrateCount: 1,
      plannedExperimentCount: 1,
      issues: [],
      skippedRuns: [{ runId: 13, reason: "missing substrate mode label" }],
      candidates: [
        {
          baselineRunId: 11,
          substrateRunId: 12,
          ready: true,
          issues: [],
        },
      ],
    });
    expect(readJson(result.outputPaths.plan)).toMatchObject({
      schemaVersion: "arrowhedge.paired-bundle-batch-plan.v1",
      experiments: [
        {
          experimentId: "exp_arrowhedge_11_12",
          baseline: { runId: 11, mode: "off" },
          substrate: { runId: 12, mode: "blocking" },
        },
      ],
    });
    expect(readJson(result.outputPaths.report)).toMatchObject({
      schemaVersion: "arrowhedge.paired-batch-plan-discovery-report.v1",
      plannedExperimentCount: 1,
    });
  });

  it("runs external labeled ArrowHedge paired backtests before scoped discovery", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-paired-runner-"));
    const planPath = join(dir, "paired-run-plan.json");
    writeJson(planPath, {
      schemaVersion: "arrowhedge.paired-run-plan.v1",
      integrationBaseUrl: "https://arrow.example",
      generatedAt: "2026-06-03T14:30:00.000Z",
      flowId: 7,
      experimentId: "exp_arrowhedge_runner_001",
      request: {
        tickers: ["AAPL"],
        start_date: "2026-05-01",
        end_date: "2026-06-03",
        initial_capital: 1000000,
        margin_requirement: 0.25,
        graph_nodes: [{ id: "warren_buffett_ab12cd", type: "agent" }],
        graph_edges: [],
      },
      baseline: { mode: "off" },
      substrate: { mode: "blocking" },
    });
    const responses = integrationDiscoveryResponses();
    const createdRequests: Record<string, unknown>[] = [];
    const updates: { readonly runId: number; readonly body: Record<string, unknown> }[] = [];
    const fetchFn: ArrowHedgeIntegrationFetch = async (url, init) => {
      if (url === "https://arrow.example/flows/7/runs/" && init?.method === "POST") {
        const body = JSON.parse(init.body ?? "{}") as {
          request_data: Record<string, unknown>;
        };
        createdRequests.push(body.request_data);
        return jsonResponse({
          id: body.request_data["substrate_mode"] === "off" ? 11 : 12,
          flow_id: 7,
          status: "IDLE",
        });
      }
      const updateMatch = url.match(
        /^https:\/\/arrow\.example\/flows\/7\/runs\/(\d+)$/,
      );
      if (updateMatch && init?.method === "PUT") {
        const body = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
        updates.push({ runId: Number(updateMatch[1]), body });
        return jsonResponse({
          id: Number(updateMatch[1]),
          flow_id: 7,
          status: body["status"],
        });
      }
      if (url === "https://arrow.example/hedge-fund/backtest" && init?.method === "POST") {
        return textResponse(backtestSseText());
      }
      return jsonResponse(
        responses.get(url) ?? { error: "not found" },
        responses.has(url) ? 200 : 404,
      );
    };

    const result = await runArrowHedgePairedExperimentFromIntegration({
      planPath,
      outputDir: join(dir, "runner-output"),
      fetchFn,
    });

    expect(createdRequests).toEqual([
      expect.objectContaining({
        substrate_mode: "off",
        pm_substrate_mode: "off",
        paired_experiment_id: "exp_arrowhedge_runner_001",
        paired_experiment_arm: "baseline",
      }),
      expect.objectContaining({
        substrate_mode: "blocking",
        pm_substrate_mode: "blocking",
        paired_experiment_id: "exp_arrowhedge_runner_001",
        paired_experiment_arm: "substrate",
      }),
    ]);
    expect(updates).toEqual(
      expect.arrayContaining([
        { runId: 11, body: { status: "IN_PROGRESS" } },
        { runId: 12, body: { status: "IN_PROGRESS" } },
        expect.objectContaining({
          runId: 11,
          body: expect.objectContaining({
            status: "COMPLETE",
            results: expect.objectContaining({
              backtest: expect.objectContaining({
                results: [
                  expect.objectContaining({
                    date: "2026-06-03",
                    decisions: { AAPL: { action: "buy", quantity: 100 } },
                  }),
                ],
                performance_metrics: { total_return: 0.0025 },
                final_portfolio: { cash: 1002500 },
                total_days: 1,
              }),
            }),
          }),
        }),
        expect.objectContaining({
          runId: 12,
          body: expect.objectContaining({ status: "COMPLETE" }),
        }),
      ]),
    );
    expect(result.report).toMatchObject({
      schemaVersion: "arrowhedge.paired-run-report.v1",
      experimentId: "exp_arrowhedge_runner_001",
      baseline: { runId: 11, mode: "off", backtestDayCount: 1 },
      substrate: { runId: 12, mode: "blocking", backtestDayCount: 1 },
      discovery: {
        backtestRunCount: 2,
        plannedExperimentCount: 1,
        skippedRuns: [],
      },
    });
    expect(readJson(result.outputPaths.plan)).toMatchObject({
      experiments: [
        {
          experimentId: "exp_arrowhedge_11_12",
          baseline: { runId: 11, mode: "off" },
          substrate: { runId: 12, mode: "blocking" },
        },
      ],
    });
  });
});

function writeInputFiles(dir: string): {
  readonly baselineEnvelopePath: string;
  readonly substrateEnvelopePath: string;
  readonly baselineMetricsPath: string;
  readonly substrateMetricsPath: string;
} {
  const baselineEnvelopePath = join(dir, "baseline-envelope-input.json");
  const substrateEnvelopePath = join(dir, "substrate-envelope-input.json");
  const baselineMetricsPath = join(dir, "baseline-metrics.json");
  const substrateMetricsPath = join(dir, "substrate-metrics.json");
  writeJson(baselineEnvelopePath, {
    ...baseEnvelope,
    substrateMode: "observe",
  });
  writeJson(substrateEnvelopePath, {
    ...baseEnvelope,
    substrateMode: "blocking",
  });
  writeJson(baselineMetricsPath, {
    endingEquity: 1000000,
    realizedPnl: 0,
    returnPct: 0,
    falsePositiveBlockCount: 0,
    falseNegativeBlockCount: 0,
  });
  writeJson(substrateMetricsPath, {
    endingEquity: 1002500,
    realizedPnl: 2500,
    returnPct: 0.0025,
    blockedDecisionCount: 1,
    staleBlockCount: 1,
    falsePositiveBlockCount: 0,
    falseNegativeBlockCount: 0,
    blockedEventIds: ["evt_block_stale_decision"],
  });
  return {
    baselineEnvelopePath,
    substrateEnvelopePath,
    baselineMetricsPath,
    substrateMetricsPath,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function jsonResponse(
  body: unknown,
  status = 200,
): ArrowHedgeIntegrationFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function textResponse(
  body: string,
  status = 200,
): ArrowHedgeIntegrationFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    async json() {
      return JSON.parse(body) as unknown;
    },
    async text() {
      return body;
    },
  };
}

function backtestSseText(): string {
  return [
    sseEvent("start", { type: "start" }),
    sseEvent("progress", {
      type: "progress",
      agent: "backtest",
      ticker: null,
      status: "Completed 2026-06-03 - Portfolio: $1,002,500.00",
      timestamp: null,
      analysis: JSON.stringify({
        date: "2026-06-03",
        portfolio_value: 1002500,
        cash: 250000,
        decisions: { AAPL: { action: "buy", quantity: 100 } },
        executed_trades: { AAPL: 100 },
        analyst_signals: {
          warren_buffett: { AAPL: { signal: "bullish", confidence: 0.74 } },
        },
        current_prices: { AAPL: 189.25 },
      }),
    }),
    sseEvent("complete", {
      type: "complete",
      data: {
        performance_metrics: { total_return: 0.0025 },
        final_portfolio: { cash: 1002500 },
        total_days: 1,
      },
    }),
  ].join("");
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function integrationResponses(): Map<string, unknown> {
  const sourceArtifact = {
    id: `financialdatasets.ai:prices:AAPL_2026-05-01_2026-06-03:${"c1".repeat(32)}`,
    schemaVersion: "arrowhedgelab.integration.source-artifact.v1",
    provider: "financialdatasets.ai",
    kind: "prices",
    cache_key: "AAPL_2026-05-01_2026-06-03",
    ticker: "AAPL",
    request: {
      ticker: "AAPL",
      start_date: "2026-05-01",
      end_date: "2026-06-03",
    },
    observed: {
      date_field: "time",
      min_observed_at: "2026-05-01",
      max_observed_at: "2026-06-03",
    },
    row_count: 2,
    sha256: "c1".repeat(32),
  };
  return new Map<string, unknown>([
    [
      "https://arrow.example/integration/v1/capabilities",
      {
        schemaVersion: "arrowhedgelab.integration.capabilities.v1",
        adapterVersion: "integration.v1",
        app: { name: "ai-hedge-fund", version: "2026.6.17" },
        redaction: { apiKeys: "presence_only", rawSecrets: "never" },
        surfaces: [
          "/integration/v1/capabilities",
          "/integration/v1/agents",
          "/integration/v1/graphs/effective",
          "/integration/v1/data/cache/summary",
          "/integration/v1/data/source-artifacts",
          "/integration/v1/flows",
          "/integration/v1/flows/{id}",
          "/integration/v1/flows/{id}/runs",
          "/integration/v1/runs/{id}",
          "/integration/v1/runs/{id}/events",
          "/integration/v1/runs/{id}/source-artifacts",
          "/integration/v1/backtests",
          "/integration/v1/backtests/{id}",
          "/integration/v1/backtests/{id}/days",
          "/integration/v1/config/models",
          "/integration/v1/config/api-keys",
        ],
      },
    ],
    [
      "https://arrow.example/integration/v1/agents",
      {
        schemaVersion: "arrowhedgelab.integration.agents.v1",
        agents: [
          {
            key: "risk_management",
            stable_id: "arrowhedgelab.agent.risk_management",
          },
          {
            key: "portfolio_manager",
            stable_id: "arrowhedgelab.agent.portfolio_manager",
          },
        ],
      },
    ],
    [
      "https://arrow.example/integration/v1/graphs/effective",
      {
        schemaVersion: "arrowhedgelab.integration.effective-graph.v1",
        nodes: [{ id: "warren_buffett_ab12cd", base_agent_key: "warren_buffett" }],
        edges: [],
        validation: { issues: [] },
      },
    ],
    [
      "https://arrow.example/integration/v1/data/cache/summary",
      {
        schemaVersion: "arrowhedgelab.integration.cache-summary.v1",
        records: [
          {
            kind: "prices",
            cache_key: "AAPL_2026-05-01_2026-06-03",
            row_count: 2,
            sha256: "a".repeat(64),
          },
        ],
      },
    ],
    [
      "https://arrow.example/integration/v1/data/source-artifacts",
      {
        schemaVersion: "arrowhedgelab.integration.source-artifacts.v1",
        provider: "financialdatasets.ai",
        count: 1,
        artifacts: [sourceArtifact],
      },
    ],
    [
      "https://arrow.example/integration/v1/flows",
      {
        schemaVersion: "arrowhedgelab.integration.flows.v1",
        count: 1,
        flows: [
          {
            schemaVersion: "arrowhedgelab.integration.flow.v1",
            id: 7,
            hashes: { nodesSha256: "b".repeat(64) },
          },
        ],
      },
    ],
    [
      "https://arrow.example/integration/v1/flows/7",
      {
        schemaVersion: "arrowhedgelab.integration.flow.v1",
        id: 7,
        nodes: [{ id: "warren_buffett_ab12cd", type: "agent" }],
        edges: [],
        data: { tickers: ["AAPL"] },
        hashes: { nodesSha256: "b".repeat(64) },
      },
    ],
    [
      "https://arrow.example/integration/v1/backtests",
      {
        schemaVersion: "arrowhedgelab.integration.backtests.v1",
        count: 1,
        backtests: [
          {
            schemaVersion: "arrowhedgelab.integration.backtest.v1",
            id: 11,
            run_id: 11,
            flow_id: 7,
            day_count: 1,
            first_date: "2026-05-01",
            last_date: "2026-06-03",
            hashes: { daysSha256: "7".repeat(64) },
          },
        ],
      },
    ],
    [
      "https://arrow.example/integration/v1/config/models",
      {
        schemaVersion: "arrowhedgelab.integration.model-config.v1",
        defaults: { model_name: "gpt-4.1", provider: "OpenAI" },
        models: [
          {
            display_name: "GPT 4.1",
            model_name: "gpt-4.1",
            provider: "OpenAI",
            source: "api_models",
          },
        ],
        providers: [{ name: "OpenAI", models: [] }],
        hashes: { modelsSha256: "1".repeat(64) },
      },
    ],
    [
      "https://arrow.example/integration/v1/config/api-keys",
      {
        schemaVersion: "arrowhedgelab.integration.api-key-summary.v1",
        redaction: { apiKeys: "presence_only", rawSecrets: "never" },
        apiKeys: [{ provider: "OPENAI_API_KEY", has_key: true }],
      },
    ],
    [
      "https://arrow.example/integration/v1/runs/11",
      {
        schemaVersion: "arrowhedgelab.integration.flow-run.v1",
        id: 11,
        flow_id: 7,
        status: "COMPLETE",
        completed_at: "2026-06-03T14:00:00.000Z",
        requestData: {
          tickers: ["AAPL"],
          start_date: "2026-05-01",
          end_date: "2026-06-03",
        },
        results: {},
      },
    ],
    [
      "https://arrow.example/integration/v1/runs/11/events",
      {
        schemaVersion: "arrowhedgelab.integration.run-events.v1",
        run_id: 11,
        flow_id: 7,
        count: 1,
        events: [
          {
            id: "flow-run-11-1-flow_run.results_recorded",
            sequence: 1,
            type: "flow_run.results_recorded",
            occurred_at: "2026-06-03T14:00:00.000Z",
            payload: { run_id: 11 },
            payload_sha256: "5".repeat(64),
          },
        ],
      },
    ],
    [
      "https://arrow.example/integration/v1/runs/11/source-artifacts",
      {
        schemaVersion: "arrowhedgelab.integration.run-source-artifacts.v1",
        run_id: 11,
        flow_id: 7,
        request: {
          tickers: ["AAPL"],
          start_date: "2026-05-01",
          end_date: "2026-06-03",
        },
        count: 1,
        artifacts: [sourceArtifact],
      },
    ],
    [
      "https://arrow.example/integration/v1/backtests/11",
      {
        schemaVersion: "arrowhedgelab.integration.backtest.v1",
        id: 11,
        run_id: 11,
        flow_id: 7,
        day_count: 1,
        first_date: "2026-05-01",
        last_date: "2026-06-03",
        performance_metrics: { total_return: 0.0025 },
        final_portfolio: { cash: 1002500 },
        portfolioValues: [{ Date: "2026-06-03", "Portfolio Value": 1002500 }],
        hashes: { daysSha256: "7".repeat(64) },
      },
    ],
    [
      "https://arrow.example/integration/v1/backtests/11/days",
      {
        schemaVersion: "arrowhedgelab.integration.backtest-days.v1",
        run_id: 11,
        flow_id: 7,
        count: 1,
        days: [
          {
            sequence: 1,
            date: "2026-06-03",
            cash: 250000,
            decisions: { AAPL: { action: "buy", quantity: 100 } },
            executed_trades: { AAPL: 100 },
            analyst_signals: {
              warren_buffett: { AAPL: { signal: "bullish", confidence: 0.74 } },
            },
            current_prices: { AAPL: 189.25 },
            sha256: "a1".repeat(32),
          },
        ],
      },
    ],
  ]);
}

function integrationDiscoveryResponses(): Map<string, unknown> {
  const responses = integrationResponses();
  const run11 = responses.get(
    "https://arrow.example/integration/v1/runs/11",
  ) as Record<string, unknown>;
  const requestData = run11["requestData"] as Record<string, unknown>;
  responses.set("https://arrow.example/integration/v1/runs/11", {
    ...run11,
    requestData: {
      ...requestData,
      substrate_mode: "off",
    },
  });
  const backtests = responses.get(
    "https://arrow.example/integration/v1/backtests",
  ) as { readonly backtests: readonly Record<string, unknown>[] };
  responses.set("https://arrow.example/integration/v1/backtests", {
    schemaVersion: "arrowhedgelab.integration.backtests.v1",
    count: 3,
    backtests: [
      backtests.backtests[0],
      integrationBacktestSummary(12, "8".repeat(64)),
      integrationBacktestSummary(13, "9".repeat(64)),
    ],
  });
  addIntegrationRunResponses(responses, {
    runId: 12,
    substrateMode: "blocking",
    completedAt: "2026-06-03T14:01:00.000Z",
    daysSha256: "8".repeat(64),
    daySha256: "b1".repeat(32),
    eventSha256: "6".repeat(64),
  });
  addIntegrationRunResponses(responses, {
    runId: 13,
    completedAt: "2026-06-03T14:02:00.000Z",
    daysSha256: "9".repeat(64),
    daySha256: "c1".repeat(32),
    eventSha256: "7".repeat(64),
  });
  return responses;
}

function integrationBacktestSummary(
  runId: number,
  daysSha256: string,
): Record<string, unknown> {
  return {
    schemaVersion: "arrowhedgelab.integration.backtest.v1",
    id: runId,
    run_id: runId,
    flow_id: 7,
    day_count: 1,
    first_date: "2026-05-01",
    last_date: "2026-06-03",
    hashes: { daysSha256 },
  };
}

function addIntegrationRunResponses(
  responses: Map<string, unknown>,
  input: {
    readonly runId: number;
    readonly completedAt: string;
    readonly daysSha256: string;
    readonly daySha256: string;
    readonly eventSha256: string;
    readonly substrateMode?: string;
  },
): void {
  const run11Sources = responses.get(
    "https://arrow.example/integration/v1/runs/11/source-artifacts",
  ) as { readonly artifacts: readonly unknown[] };
  const requestData = {
    tickers: ["AAPL"],
    start_date: "2026-05-01",
    end_date: "2026-06-03",
    ...(input.substrateMode === undefined
      ? {}
      : { substrate_mode: input.substrateMode }),
  };
  responses.set(`https://arrow.example/integration/v1/runs/${input.runId}`, {
    schemaVersion: "arrowhedgelab.integration.flow-run.v1",
    id: input.runId,
    flow_id: 7,
    status: "COMPLETE",
    completed_at: input.completedAt,
    requestData,
    results: {},
  });
  responses.set(
    `https://arrow.example/integration/v1/runs/${input.runId}/events`,
    {
      schemaVersion: "arrowhedgelab.integration.run-events.v1",
      run_id: input.runId,
      flow_id: 7,
      count: 1,
      events: [
        {
          id: `flow-run-${input.runId}-1-flow_run.results_recorded`,
          sequence: 1,
          type: "flow_run.results_recorded",
          occurred_at: input.completedAt,
          payload: { run_id: input.runId },
          payload_sha256: input.eventSha256,
        },
      ],
    },
  );
  responses.set(
    `https://arrow.example/integration/v1/runs/${input.runId}/source-artifacts`,
    {
      schemaVersion: "arrowhedgelab.integration.run-source-artifacts.v1",
      run_id: input.runId,
      flow_id: 7,
      request: {
        tickers: ["AAPL"],
        start_date: "2026-05-01",
        end_date: "2026-06-03",
      },
      count: run11Sources.artifacts.length,
      artifacts: run11Sources.artifacts,
    },
  );
  responses.set(
    `https://arrow.example/integration/v1/backtests/${input.runId}`,
    {
      ...integrationBacktestSummary(input.runId, input.daysSha256),
      performance_metrics: { total_return: 0.0025 },
      final_portfolio: { cash: 1002500 },
      portfolioValues: [{ Date: "2026-06-03", "Portfolio Value": 1002500 }],
    },
  );
  responses.set(
    `https://arrow.example/integration/v1/backtests/${input.runId}/days`,
    {
      schemaVersion: "arrowhedgelab.integration.backtest-days.v1",
      run_id: input.runId,
      flow_id: 7,
      count: 1,
      days: [
        {
          sequence: 1,
          date: "2026-06-03",
          cash: 250000,
          decisions: { AAPL: { action: "buy", quantity: 100 } },
          executed_trades: { AAPL: 100 },
          analyst_signals: {
            warren_buffett: {
              AAPL: { signal: "bullish", confidence: 0.74 },
            },
          },
          current_prices: { AAPL: 189.25 },
          sha256: input.daySha256,
        },
      ],
    },
  );
}

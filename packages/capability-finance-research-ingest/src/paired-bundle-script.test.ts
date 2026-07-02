import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
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

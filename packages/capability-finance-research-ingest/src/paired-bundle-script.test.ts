import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  verifyArrowHedgePairedBundleDirectory,
  writeArrowHedgePairedBundleFiles,
} from "../../../scripts/build-arrowhedge-paired-bundle.js";

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

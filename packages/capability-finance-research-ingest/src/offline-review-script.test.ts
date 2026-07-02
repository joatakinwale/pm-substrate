import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { reviewArrowHedgeEnvelopeFile } from "../../../scripts/review-arrowhedge-envelope-offline.js";

describe("review-arrowhedge-envelope-offline script", () => {
  it("writes a substrate-style offline review response for a saved envelope", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arrowhedge-offline-review-"));
    const envelopePath = join(dir, "envelope.json");
    const outPath = join(dir, "substrate-response.json");
    writeFileSync(
      envelopePath,
      JSON.stringify({
        schemaVersion: "arrowhedge.run-envelope.v1",
        runId: "run_script_review_001",
        surface: "backtest",
        substrateMode: "blocking",
        observedAt: "2026-06-03T14:00:00.000Z",
        scope: {
          startDate: "2026-05-01",
          endDate: "2026-06-03",
          tickers: ["AAPL"],
        },
        graph: { nodes: [], edges: [] },
        modelConfig: { model: "gpt-4.1" },
        portfolio: {
          cash: 250000,
          equity: 1000000,
          margin_requirement: 0.25,
          margin_used: 0.11,
        },
        signals: [
          {
            id: "sig_aapl",
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
            freshnessExpiresAt: "2026-06-03T14:10:00.000Z",
          },
        ],
        decisions: [
          {
            ticker: "AAPL",
            action: "buy",
            quantity: 121,
            confidence: 0.76,
            reasoning: "Over limit.",
            allowedActions: { hold: 0, buy: 120 },
          },
        ],
        evidence: [],
      }),
      "utf8",
    );

    const result = await reviewArrowHedgeEnvelopeFile({
      envelopePath,
      outPath,
      tenantId: "tnt_script_review",
      adapterStartedAt: "2026-06-03T13:59:58.500Z",
    });
    const saved = JSON.parse(readFileSync(outPath, "utf8")) as typeof result;

    expect(saved).toEqual(result);
    expect(saved.valid).toBe(true);
    expect(saved.expanded).toEqual({ snapshots: 1, tickers: ["AAPL"] });
    expect(saved.ingested.blockedEventIds).toEqual([
      "evt_run_script_review_001_0_3_workflow_blocked_invalid_action",
    ]);
    expect(saved.cop.tickers["AAPL"]).toMatchObject({
      invalidActionBlocks: 1,
      authorityGate: { passes: 0, failures: 1 },
    });
  });
});

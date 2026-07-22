import { describe, expect, it } from "vitest";

import {
  renderTokenKpisEmptyHtml,
  renderTokenKpisHtml,
  type TokenKpiMetrics,
  type TokenKpiRunSummary,
} from "./token-kpis-page.js";

const runs: TokenKpiRunSummary[] = [
  {
    runLabel: "capstone-baseline-2026-07-16",
    lastRecordedAt: "2026-07-17 16:12:54",
    attemptEvents: 76,
    providers: ["openrouter"],
    models: ["openai/gpt-4o-mini"],
  },
  {
    runLabel: "smoke-2026-07-16",
    lastRecordedAt: "2026-07-17 16:07:05",
    attemptEvents: 52,
    providers: ["openrouter"],
    models: ["openai/gpt-4o-mini"],
  },
];

const fixture: TokenKpiMetrics = {
  generatedAt: "2026-07-17T16:20:00.000Z",
  runLabel: "capstone-baseline-2026-07-16",
  providers: ["openrouter"],
  models: ["openai/gpt-4o-mini"],
  totals: { promptTokens: 5000, completionTokens: 1200, totalTokens: 6200, costCredits: 0.00186 },
  rows: [
    {
      scenario: "stale-observation",
      mode: "no_substrate",
      expectedAdmission: "block",
      failureClass: "stale_observation",
      tasks: 2,
      attempts: 4,
      retries: 2,
      terminalFailures: 0,
      finalSuccesses: 2,
      tokensTotal: 956,
      tokensWasted: 479,
      costCredits: 0.000167,
    },
    {
      scenario: "stale-observation-expected-allow",
      mode: "substrate",
      expectedAdmission: "allow",
      failureClass: "stale_observation",
      tasks: 2,
      attempts: 2,
      retries: 0,
      terminalFailures: 0,
      finalSuccesses: 2,
      tokensTotal: 240,
      tokensWasted: 0,
      costCredits: 0.000042,
    },
  ],
  c7BaselineRetryRate: 1,
  c8SubstrateRetryRate: 1,
  c9MeanTokensPerWastedAttempt: 122.9,
  c9ByMode: { no_substrate: 122.8, substrate: 122.9 },
  allowControlRetryRate: 0,
  corruptAdmissions: { no_substrate: 12, substrate: 0 },
  causeCounts: { other: 12, none: 48, stale_read: 10, contract_violation: 2 },
};

describe("token KPIs page renderer", () => {
  it("renders the workbook cells in capstone vocabulary with their guards", () => {
    const html = renderTokenKpisHtml(fixture, runs);
    expect(html).toContain("Retry rate — validation OFF");
    expect(html).toContain("Retry rate — validation ON");
    expect(html).toContain("C7");
    expect(html).toContain("C8");
    expect(html).toContain("C9");
    expect(html).toContain("100.0%");
    expect(html).toContain("122.9");
    // the differentiator and its guard rails
    expect(html).toContain("Wrong-state writes shipped");
    expect(html).toContain("12 → 0");
    expect(html).toContain("shipped the wrong\n      state 12 times");
    expect(html).toContain("stale_read");
    expect(html).toContain("Deny-mutant guard");
    // cost + tokens
    expect(html).toContain("0.001860");
    expect(html).toContain("6,200".replace(",", ",")); // compactNumber path renders 6,200
  });

  it("marks allow-controls, keeps run picker on the current label, and escapes content", () => {
    const html = renderTokenKpisHtml(fixture, runs);
    expect(html).toContain("(allow-control)");
    expect(html).toContain('value="capstone-baseline-2026-07-16" selected');
    expect(html).toContain('value="smoke-2026-07-16"');
    expect(html).toContain("validation OFF");
    expect(html).toContain("validation ON");
    expect(html).not.toContain("<script");
  });

  it("renders zero-cost runs as free/local and an instructive empty state", () => {
    const freeRun: TokenKpiMetrics = {
      ...fixture,
      totals: { ...fixture.totals, costCredits: null },
    };
    expect(renderTokenKpisHtml(freeRun, runs)).toContain("free (local)");
    const empty = renderTokenKpisEmptyHtml();
    expect(empty).toContain("No A/B runs recorded yet");
    expect(empty).toContain("pnpm capstone:token-ab");
  });
});

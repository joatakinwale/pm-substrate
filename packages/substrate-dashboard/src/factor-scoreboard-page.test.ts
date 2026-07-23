import { describe, expect, it } from "vitest";

import {
  CANONICAL_FAILURE_CLASSES,
  FACTOR_DEFS,
  FACTOR_IDS,
  computeFactorScoreboard,
  factorForFailureClass,
  renderFactorScoreboardEmptyHtml,
  renderFactorScoreboardHtml,
  type FactorScoreboardRow,
} from "./factor-scoreboard-page.js";

const row = (over: Partial<FactorScoreboardRow>): FactorScoreboardRow => ({
  scenario: "stale-price-refresh",
  mode: "no_substrate",
  expectedAdmission: "block",
  failureClass: "stale_observation",
  tasks: 3,
  attempts: 6,
  retries: 3,
  terminalFailures: 1,
  finalSuccesses: 2,
  tokensTotal: 900,
  tokensWasted: 400,
  ...over,
});

describe("failure-class → factor mapping", () => {
  it("maps every canonical taxonomy class to exactly one of the six factors", () => {
    expect(CANONICAL_FAILURE_CLASSES).toHaveLength(10);
    for (const cls of CANONICAL_FAILURE_CLASSES) {
      const factor = factorForFailureClass(cls);
      expect(factor, `class ${cls} must map to a factor`).not.toBeNull();
      expect(FACTOR_IDS).toContain(factor);
    }
    const mapped = FACTOR_DEFS.flatMap((d) => d.classes);
    expect([...mapped].sort()).toEqual([...CANONICAL_FAILURE_CLASSES].sort());
  });

  it("returns null (theory gap), never a bucket, for unknown classes", () => {
    expect(factorForFailureClass("mystery_class")).toBeNull();
  });
});

describe("computeFactorScoreboard", () => {
  const rows: FactorScoreboardRow[] = [
    row({}),
    row({ mode: "substrate", attempts: 4, retries: 1, terminalFailures: 0, tokensTotal: 600, tokensWasted: 120 }),
    row({ scenario: "fresh-price-allow", expectedAdmission: "allow", retries: 0, tokensWasted: 0 }),
    row({ scenario: "fork-on-shared-head", failureClass: "parallel_write_conflict" }),
    row({ scenario: "weird-<script>-case", failureClass: "mystery_class" }),
  ];
  const board = computeFactorScoreboard(rows);

  it("always returns all six factors in stable order", () => {
    expect(board.factors.map((f) => f.def.id)).toEqual([...FACTOR_IDS]);
  });

  it("folds per-arm totals and coverage for the stale-observation factor", () => {
    const f2 = board.factors.find((f) => f.def.id === "stale-observation");
    expect(f2).toBeDefined();
    expect(f2!.covered).toBe(true);
    expect(f2!.hazardScenarios).toBe(1);
    expect(f2!.allowControls).toBe(1);
    expect(f2!.byMode.no_substrate.attempts).toBe(12); // hazard 6 + allow-control 6
    expect(f2!.byMode.no_substrate.tokensWasted).toBe(400);
    expect(f2!.byMode.substrate.attempts).toBe(4);
    expect(f2!.byMode.substrate.retries).toBe(1);
  });

  it("flags uncovered factors and counts coverage", () => {
    const f6 = board.factors.find((f) => f.def.id === "authority-drift");
    expect(f6!.covered).toBe(false);
    expect(board.coveredCount).toBe(2); // stale-observation + parallel-write
    expect(board.hazardScenarioTotal).toBe(2);
    expect(board.allowControlTotal).toBe(1);
  });

  it("surfaces unknown classes as a theory gap with their scenarios", () => {
    expect(board.unmappedClasses).toEqual([
      { failureClass: "mystery_class", scenarios: ["weird-<script>-case"] },
    ]);
  });
});

describe("state-factors page renderer", () => {
  const rows: FactorScoreboardRow[] = [
    row({}),
    row({ mode: "substrate" }),
    row({ scenario: "<script>alert(1)</script>", failureClass: "mystery_class" }),
  ];
  const board = computeFactorScoreboard(rows);
  const meta = {
    runLabel: "capstone-baseline-2026-07-16",
    generatedAt: "2026-07-22T12:00:00.000Z",
    providers: ["openrouter"],
    models: ["openai/gpt-4o-mini"],
    corruptAdmissions: { no_substrate: 12, substrate: 0 },
  };
  const runs = [
    { runLabel: "capstone-baseline-2026-07-16", lastRecordedAt: "2026-07-17T16:12:54.971Z", models: ["openai/gpt-4o-mini"] },
  ];

  it("renders all six factor cards, coverage tiles, and the honesty label", () => {
    const html = renderFactorScoreboardHtml(meta, board, runs);
    for (const id of FACTOR_IDS) expect(html).toContain(`data-factor="${id}"`);
    expect(html).toContain("Conformance diagnostics — not efficacy.");
    expect(html).toContain("1/6");
    expect(html).toContain("12 → 0");
    expect(html).toContain("no hazard scenario in this run");
    expect(html).toContain("v233 H-F6a"); // next step visible only while uncovered
    expect(html).toContain('data-factor="theory-gap"');
    expect(html).toContain("report:token-usage");
  });

  it("escapes untrusted scenario names", () => {
    const html = renderFactorScoreboardHtml(meta, board, runs);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("covered factors hide the next-step nudge and show the arm table", () => {
    const covered = computeFactorScoreboard([
      row({ scenario: "raci-breach", failureClass: "capability_contract_violation" }),
    ]);
    const html = renderFactorScoreboardHtml(meta, covered, runs);
    expect(html).not.toContain("v233 H-F6a");
    expect(html).toContain("validation OFF");
    expect(html).toContain("validation ON");
  });

  it("renders a teaching empty state", () => {
    const html = renderFactorScoreboardEmptyHtml();
    expect(html).toContain("No A/B runs recorded yet");
    expect(html).toContain("pnpm capstone:token-ab");
  });
});

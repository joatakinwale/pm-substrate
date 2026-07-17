import { describe, expect, it } from "vitest";

import { renderBenchmarksHtml, type BenchmarksPayload } from "./benchmarks-page.js";

const fixture: BenchmarksPayload = {
  recordedAt: "2026-07-14T00:36:40.000Z",
  claimBoundary: "Digest and failure register only.",
  labScenarios: [
    { scenarioId: "stale-observation", failureClass: "stale_observation" },
    { scenarioId: "memory-drift", failureClass: "memory_drift" },
  ],
  benchmarks: [
    {
      id: "toolsandbox",
      level: "mechanism-qualified",
      headline: "All arms strict 1.0; only substrate blocked the duplicate.",
      arms: [
        { arm: "native", strictScore: 1, duplicateSideEffects: 1, disposition: "re-sent (duplicate)" },
        { arm: "sham", strictScore: 1, duplicateSideEffects: 1, disposition: "re-sent (duplicate)" },
        { arm: "substrate", strictScore: 1, duplicateSideEffects: 0, disposition: "blocked the duplicate" },
      ],
      blockedOn: ["A funded non-scripted public-agent run"],
    },
    {
      id: "statebench",
      level: "conformance-only",
      headline: "Adapter conformance passes; zero official trajectories.",
      stats: [{ label: "Official scored trajectories", value: "0 / 2250" }],
      blockedOn: ["The self-provisioned GPT-5.4 locked evaluator"],
    },
  ],
};

describe("benchmarks page renderer", () => {
  it("renders the four-arm comparison and the strict-vs-collateral insight", () => {
    const html = renderBenchmarksHtml(fixture);
    expect(html).toContain("Agent-state benchmarks");
    expect(html).toContain("ToolSandbox");
    expect(html).toContain("Apple");
    // arms + collateral contrast
    expect(html).toContain("duplicate side effects");
    expect(html).toContain("blocked the duplicate");
    expect(html).toContain("only <strong>substrate</strong> left zero duplicate side effects");
    // honesty rails
    expect(html).toContain("Reading this honestly");
    expect(html).toContain("What blocks an efficacy verdict");
    expect(html).toContain("Mechanism qualified");
    expect(html).toContain("Conformance only");
  });

  it("names STATE-Bench's scorer as the one that CAN see state damage", () => {
    const html = renderBenchmarksHtml(fixture);
    expect(html).toContain("Deterministic final-state diff");
    expect(html).toContain("sees state damage ✓");
    expect(html).toContain("blind to state damage");
  });

  it("surfaces the local lab failure classes as the controlled complement", () => {
    const html = renderBenchmarksHtml(fixture);
    expect(html).toContain("Local Agent Lab");
    expect(html).toContain("stale observation");
    expect(html).toContain("memory drift");
    expect(html).not.toContain("<script");
  });
});

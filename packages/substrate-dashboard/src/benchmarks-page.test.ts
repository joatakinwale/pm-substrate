import { describe, expect, it } from "vitest";

import { renderBenchmarksHtml, type BenchmarksPayload } from "./benchmarks-page.js";

const fixture: BenchmarksPayload = {
  recordedAt: "2026-07-14T00:36:40.000Z",
  claimBoundary: "Digest and failure register only.",
  labScenarios: [
    { scenarioId: "stale-observation", failureClass: "stale_observation" },
    { scenarioId: "memory-drift", failureClass: "memory_drift" },
  ],
  labVerdicts: [
    {
      scenarioId: "stale-observation",
      failureClass: "stale_observation",
      stateBenchCategory: "stateful",
      coordinationClass: "authority_gated_transition",
      expectedAdmission: "block",
      baselineResult: "fail",
      substrateResult: "blocked",
    },
    {
      scenarioId: "stale-observation-expected-allow",
      failureClass: "stale_observation",
      stateBenchCategory: "stateful",
      coordinationClass: "authority_gated_transition",
      expectedAdmission: "allow",
      baselineResult: "pass",
      substrateResult: "pass",
    },
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
  it("renders the visual strict-vs-state-damage contrast with SVG chart mounts", () => {
    const html = renderBenchmarksHtml(fixture);
    expect(html).toContain("Agent-state reliability");
    expect(html).toContain("ToolSandbox");
    expect(html).toContain("Apple");
    // real SVG charts (drawn at hydrate), not CSS-div bars
    expect(html).toContain('data-bm-chart="strict"');
    expect(html).toContain('data-bm-chart="dup"');
    expect(html).toContain("Benchmark's strict score");
    expect(html).toContain("Actual state damage");
    expect(html).toContain("Only <strong>substrate</strong> kept state clean");
    // honesty rails (demoted to a details-on-demand chip)
    expect(html).toContain("not an efficacy claim");
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

  it("opens with an overview glance band (numbers + meters), then the status matrix", () => {
    const html = renderBenchmarksHtml(fixture);
    // overview-first: KPI glance band with preattentive meters, before detail
    expect(html).toContain("bm-glance");
    expect(html).toContain("Hazards caught");
    expect(html).toContain("State leaks");
    expect(html).toContain("bm-kpi-meter");
    // the glance band precedes the benchmark cards (overview → detail)
    expect(html.indexOf("bm-glance")).toBeLessThan(html.indexOf("bm-cards"));
    // status matrix cells (teal/red + icon + word, never colour-alone)
    expect(html).toContain("✗ fail");
    expect(html).toContain("✓ blocked");
    expect(html).toContain("bm-cell-fail");
    expect(html).toContain("bm-cell-blocked");
    // honesty demoted to details-on-demand, not an always-open banner
    expect(html).toContain("<details class=\"bm-honesty\">");
    expect(html).not.toContain("<script");
  });

  it("shows an actionable empty state when no paired runs exist", () => {
    const html = renderBenchmarksHtml({ ...fixture, labVerdicts: [] });
    expect(html).toContain("No paired eval runs recorded yet");
    expect(html).toContain("pnpm evals:local-lab");
  });
});

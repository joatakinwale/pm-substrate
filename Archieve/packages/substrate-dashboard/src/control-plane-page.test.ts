import { describe, expect, it } from "vitest";

import {
  renderControlPlaneHtml,
  type ControlPlanePayload,
} from "./control-plane-page.js";

const fixture: ControlPlanePayload = {
  tenantId: "tenant_dev",
  scope: "pm-substrate-dev",
  generatedAt: "2026-07-03T01:00:00.000Z",
  beingDone: {
    openWork: [{ title: "D5 anchors", summary: "Implement app surfaces." }],
    lastHandoff: { title: "handoff x", summary: "Next: dashboard page." },
  },
  governance: {
    eventsByType: [{ type: "pm.work.dispatched", count: 2 }],
    stageGateApplications: 1,
    procedureAdmissions: 3,
    mcpActionsBlocked: 1,
    workDispatched: 2,
  },
  costs: { totalTokens: 349500, labeledSessions: 4 },
  integration: {
    adaptersRegistered: 2,
    syncUpserted: 5,
    syncRejected: 1,
    executorDispatched: 3,
    executorRefused: 1,
    executorFailed: 0,
  },
  results: {
    decisions: [{ title: "Loop protocol", summary: "Never stop between items." }],
    claimsUnderTest: [{ title: "Governance is API", summary: "Test via labs." }],
  },
  optimized: {
    closedWork: [{ title: "MCP surface", closedAt: "2026-07-03T00:00:00Z" }],
    lessons: [{ title: "Unconsumed formalism spirals", summary: "v62-v229." }],
  },
  integrity: { checkpointCount: 30, chainValid: true, chainErrors: [] },
};

describe("control-plane page renderer (D4)", () => {
  it("renders all five questions plus integrity deterministically", () => {
    const html = renderControlPlaneHtml(fixture);
    for (const q of [
      "being-done",
      "governance",
      "costs",
      "integration",
      "results",
      "optimized",
      "integrity",
    ]) {
      expect(html).toContain(`data-q="${q}"`);
    }
    expect(html).toContain("D5 anchors");
    expect(html).toContain("Last handoff · handoff x");
    expect(html).toContain("<dt>MCP actions blocked</dt><dd>1</dd>");
    expect(html).toContain("<dt>Adapters registered</dt><dd>2</dd>");
    expect(html).toContain("<dt>Executor dispatched</dt><dd>3</dd>");
    expect(html).toContain("<dt>Executor refused</dt><dd>1</dd>");
    expect(html).toContain("<dt>Executor failed</dt><dd>0</dd>");
    expect(html).toContain("349.5K");
    expect(html).toContain("cp-bar-row");
    expect(html).toContain("Loop protocol");
    expect(html).toContain("Unconsumed formalism spirals");
    expect(html).toContain("✓ Valid");
  });

  it("escapes untrusted text and handles empty sections", () => {
    const html = renderControlPlaneHtml({
      ...fixture,
      beingDone: {
        openWork: [{ title: "<script>alert(1)</script>", summary: "x" }],
        lastHandoff: null,
      },
      optimized: { closedWork: [], lessons: [] },
      integrity: { checkpointCount: 0, chainValid: false, chainErrors: ["e1"] },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("nothing closed yet");
    expect(html).toContain("✕ Broken");
    expect(html).toContain("Chain integrity errors");
  });
});

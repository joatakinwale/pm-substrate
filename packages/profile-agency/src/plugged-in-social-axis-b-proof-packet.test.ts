import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";
import { FAILURE_CLASSES } from "../../evals/src/schema.js";
import {
  buildMarketingAxisBCorePairedScenarios,
  buildMarketingAxisBLiveIntegrationSuite,
} from "../../evals/src/marketing.js";
import { buildThreeAxisProofPacket } from "../../evals/src/three-axis-proof-packet.js";

import {
  buildPluggedInSocialAxisBNextActionAdapterResult,
  type PluggedInSocialClientReportSnapshot,
} from "./plugged-in-social-axis-b-adapter.js";
import { readPluggedInSocialSourceManifest } from "./plugged-in-social-manifest.js";

const report: PluggedInSocialClientReportSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  project_id: "33333333-3333-4333-8333-333333333333",
  title: "Summer pipeline report",
  status: "generated",
  period_start: "2026-06-24",
  period_end: "2026-07-01",
  pdf_generated_at: "2026-07-01T17:45:00.000Z",
  metrics_observed_at: "2026-07-01T17:30:00.000Z",
  metrics_snapshot: {
    total_reach: 400,
    avg_engagement_rate: 7.3,
    qualified_leads_generated: 18,
    total_ad_spend_cents: 12_500,
  },
};

describe("PluggedInSocial Axis B proof packet integration", () => {
  it("verifies live Axis B coverage without overclaiming the three-axis packet", () => {
    const observedAt = timestamp("2026-07-01T19:15:00.000Z");
    const tenant = tenantId("tnt_plugged_in_social_axis_b_packet");
    const manifest = readPluggedInSocialSourceManifest({
      workspaceRoot: process.cwd(),
    });
    const adapterResult = buildPluggedInSocialAxisBNextActionAdapterResult({
      tenantId: tenant,
      manifest,
      report,
      decidedAt: observedAt,
      stateReviewArtifactHash: "e".repeat(64),
    });
    const corePairs = buildMarketingAxisBCorePairedScenarios({
      tenantId: tenant,
      observedAt,
      evidenceRefs: adapterResult.evidenceRefs,
      substrateRefs: adapterResult.substrateRefs,
    });

    const suite = buildMarketingAxisBLiveIntegrationSuite({
      tenantId: tenant,
      observedAt,
      manifest,
      nextActionAdapterResult: adapterResult,
      pairedScenarios: corePairs,
    });
    const packet = buildThreeAxisProofPacket({
      generatedAt: observedAt,
      events: suite.events,
      sources: [suite.source],
    });

    expect(suite.source).toMatchObject({
      sourceId: "axis-b-plugged-in-social-live",
      axis: "marketing",
      eventCount: 2 + FAILURE_CLASSES.length * 2,
    });
    expect(suite.events.slice(0, 2).map((event) => event.result)).toEqual([
      "pass",
      "pass",
    ]);
    expect(suite.events.slice(2).map((event) => event.result)).toEqual(
      FAILURE_CLASSES.flatMap(() => ["fail", "pass"]),
    );
    expect(packet.status).toBe("unverified");
    expect(packet.blockedAxes).toEqual([]);
    expect(packet.verifiedAxes).toEqual(["marketing"]);
    expect(packet.unverifiedAxes).toEqual(["finance", "local_lab"]);
    expect(packet.report.byAxis.marketing.blockedFailureClasses).toEqual([]);
    expect(packet.report.byAxis.marketing.verifiedFailureClasses).toEqual(
      FAILURE_CLASSES,
    );
    expect(packet.report.byAxis.marketing.missingFailureClasses).toEqual([]);
    expect(packet.report.byAxis.marketing.complete).toBe(true);
    expect(packet.report.byAxis.marketing.verified).toBe(true);
    expect(packet.report.byCell.marketing.workflow_invalidation).toMatchObject({
      covered: true,
      verified: true,
      terminalProofBackedPairs: 1,
    });
  });
});

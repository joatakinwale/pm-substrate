import { existsSync } from "node:fs";

/** Live-tree tests skip when the (now external) PluggedInSocial checkout is absent. */
const PLUGGED_IN_SOCIAL_AVAILABLE = existsSync(
  process.env["PM_PLUGGED_IN_SOCIAL_DIR"] ?? "./plugged_in_social",
);

import { describe, expect, it } from "vitest";
import { FAILURE_CLASSES } from "@pm/evals";
import { tenantId, timestamp } from "@pm/types";

import {
  buildPluggedInSocialIntegrationAudit,
  type PluggedInSocialClientReportSnapshot,
} from "./index.js";
import { PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES } from "./plugged-in-social-manifest.js";

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

describe("PluggedInSocial integration audit", () => {
  it.skipIf(!PLUGGED_IN_SOCIAL_AVAILABLE)("returns a single substrate-consumable proof summary for the live marketing loop", () => {
    const audit = buildPluggedInSocialIntegrationAudit({
      tenantId: tenantId("tnt_plugged_in_social_audit"),
      observedAt: timestamp("2026-07-01T19:15:00.000Z"),
      report,
      stateReviewArtifactHash: "a".repeat(64),
      workspaceRoot: process.cwd(),
    });

    expect(audit.sourceId).toBe("plugged_in_social");
    expect(audit.ready).toBe(true);
    expect(audit.blockers).toEqual([]);
    expect(audit.manifest.readiness.complete).toBe(true);
    expect(audit.closedLoopStages.map((stage) => stage.stage)).toEqual([
      "intake",
      "strategy",
      "content",
      "approval",
      "scheduling",
      "publishing",
      "metrics",
      "report",
      "next_action",
    ]);
    expect(audit.closedLoopStages.every((stage) => stage.present)).toBe(true);

    expect(audit.withoutSubstrate.governed).toBe(false);
    expect(audit.withoutSubstrate.failureClassesCovered).toEqual([]);
    expect(audit.withSubstrate.governed).toBe(true);
    expect(audit.withSubstrate.requiredGovernanceGates).toEqual(
      PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES,
    );
    expect(audit.withSubstrate.verifiedFailureClasses).toEqual(FAILURE_CLASSES);
    expect(audit.withSubstrate.evidenceRefs).toEqual(
      expect.arrayContaining([
        "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111",
        "plugged_in_social:test:closed-loop-runtime-fixture",
      ]),
    );

    expect(audit.axisB.source.eventCount).toBe(2 + FAILURE_CLASSES.length * 2);
    expect(audit.axisB.events.map((event) => event.result).slice(0, 2)).toEqual([
      "pass",
      "pass",
    ]);
    expect(audit.axisB.proofPacket.verifiedAxes).toEqual(["marketing"]);
    expect(audit.axisB.proofPacket.unverifiedAxes).toEqual([
      "finance",
      "local_lab",
    ]);
    expect(audit.axisB.proofPacket.report.byAxis.marketing.verified).toBe(true);
  });
});

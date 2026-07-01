import { describe, expect, it } from "vitest";
import { verifyActionOutcomeEnvelopeHash } from "@pm/agent-state";
import { tenantId, timestamp } from "@pm/types";

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
  metrics_snapshot: {
    total_reach: 400,
    avg_engagement_rate: 7.3,
    qualified_leads_generated: 18,
    total_ad_spend_cents: 12_500,
  },
};

describe("PluggedInSocial Axis B next-action adapter", () => {
  it("maps a generated ClientReport row into an accepted substrate next-action proposal", () => {
    const result = buildPluggedInSocialAxisBNextActionAdapterResult({
      tenantId: tenantId("tnt_plugged_in_social_axis_b"),
      workspaceRoot: process.cwd(),
      report,
      decidedAt: timestamp("2026-07-01T18:00:00.000Z"),
      stateReviewArtifactHash: "c".repeat(64),
    });

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.sourcePath).toBe("./plugged_in_social");
    expect(result.proposal).toMatchObject({
      recommendedAction: "launch_followup_campaign",
      confidence: 1,
    });
    expect(result.proposal.envelope).toMatchObject({
      terminalOutcome: "accepted",
      blockingCauses: [],
    });
    expect(result.evidenceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111",
        }),
        expect.objectContaining({
          kind: "source_record",
          id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111:metrics_snapshot",
        }),
      ]),
    );
    expect(result.substrateRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "action_outcome_envelope" }),
        expect.objectContaining({
          kind: "document",
          id: "pm_substrate:profile-agency:next-action-proposal",
        }),
      ]),
    );
    expect(verifyActionOutcomeEnvelopeHash(result.proposal.envelope).valid).toBe(
      true,
    );
  });

  it("blocks Axis B readiness when required manifest gates are missing", () => {
    const manifest = readPluggedInSocialSourceManifest({
      workspaceRoot: process.cwd(),
    });
    const result = buildPluggedInSocialAxisBNextActionAdapterResult({
      tenantId: tenantId("tnt_plugged_in_social_axis_b_blocked"),
      manifest: {
        ...manifest,
        governance: {
          ...manifest.governance,
          sharedPayloadContract: false,
        },
      },
      report,
      decidedAt: timestamp("2026-07-01T18:00:00.000Z"),
      stateReviewArtifactHash: "d".repeat(64),
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toContain(
      "missing governance gate: sharedPayloadContract",
    );
  });
});

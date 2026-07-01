import { describe, expect, it } from "vitest";
import { stateRef, verifyActionOutcomeEnvelopeHash } from "@pm/agent-state";
import { tenantId, timestamp } from "@pm/types";

import {
  buildAgencyMarketingNextActionProposal,
  type AgencyMarketingNextActionProposalInput,
} from "./next-action-proposal.js";

const tenant = tenantId("tnt_agency_next_action");
const campaign = stateRef(
  "graph_node",
  "campaign_summer_pipeline_001",
  "Summer pipeline campaign",
);
const reportRef = stateRef(
  "document",
  "client_report_summer_pipeline_001",
  "Summer pipeline report",
);
const metricsRef = stateRef(
  "source_record",
  "pluggedinsocial:analytics_daily:summer_pipeline_001",
  "PluggedInSocial analytics row",
);

function input(
  overrides: Partial<AgencyMarketingNextActionProposalInput> = {},
): AgencyMarketingNextActionProposalInput {
  return {
    tenantId: tenant,
    sourceAdapter: "plugged_in_social",
    campaign,
    stateReviewArtifactHash: "b".repeat(64),
    decidedAt: timestamp("2026-07-01T18:00:00.000Z"),
    report: {
      reportRef,
      reportHash: "report_hash_summer_pipeline_v1",
      generatedAt: timestamp("2026-07-01T17:45:00.000Z"),
      sourceRefs: [metricsRef],
    },
    metrics: {
      observedAt: timestamp("2026-07-01T17:30:00.000Z"),
      sampleSize: 240,
      qualifiedLeads: 18,
      engagementRate: 0.073,
      conversionRate: 0.041,
      sourceRefs: [metricsRef],
    },
    ...overrides,
  };
}

describe("agency marketing next-action proposal boundary", () => {
  it("admits a next-action proposal when report and metrics evidence are fresh", () => {
    const proposal = buildAgencyMarketingNextActionProposal(input());

    expect(proposal).toMatchObject({
      tenantId: tenant,
      recommendedAction: "launch_followup_campaign",
      campaign,
      reportRef,
    });
    expect(proposal.rationale).toContain(
      "qualified leads and conversion rate support a follow-up campaign",
    );
    expect(proposal.evidenceRefs).toEqual(
      expect.arrayContaining([reportRef, metricsRef]),
    );
    expect(proposal.envelope).toMatchObject({
      tenantId: tenant,
      terminalOutcome: "accepted",
      blockingCauses: [],
      subject: campaign,
      evidenceRefs: expect.arrayContaining([reportRef, metricsRef]),
    });
    expect(proposal.envelope.actionId).toContain(
      "marketing.next_action.propose:launch_followup_campaign",
    );
    expect(verifyActionOutcomeEnvelopeHash(proposal.envelope).valid).toBe(true);
  });

  it("blocks the proposal when the report and metrics evidence are stale", () => {
    const proposal = buildAgencyMarketingNextActionProposal(
      input({
        decidedAt: timestamp("2026-07-01T18:00:00.000Z"),
        report: {
          ...input().report,
          generatedAt: timestamp("2026-06-28T18:00:00.000Z"),
        },
        metrics: {
          ...input().metrics,
          observedAt: timestamp("2026-06-28T18:00:00.000Z"),
        },
      }),
    );

    expect(proposal.recommendedAction).toBe("launch_followup_campaign");
    expect(proposal.envelope.terminalOutcome).toBe("blocked");
    expect(proposal.envelope.blockingCauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "status_check",
          code: "report_stale",
        }),
        expect.objectContaining({
          source: "status_check",
          code: "metrics_stale",
        }),
      ]),
    );
    expect(verifyActionOutcomeEnvelopeHash(proposal.envelope).valid).toBe(true);
  });

  it("blocks the proposal when source evidence is not bound to the report and metrics", () => {
    const proposal = buildAgencyMarketingNextActionProposal(
      input({
        report: {
          ...input().report,
          sourceRefs: [],
        },
        metrics: {
          ...input().metrics,
          sourceRefs: [],
        },
      }),
    );

    expect(proposal.envelope.terminalOutcome).toBe("blocked");
    expect(proposal.envelope.blockingCauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "policy",
          code: "source_evidence_missing",
        }),
      ]),
    );
    expect(verifyActionOutcomeEnvelopeHash(proposal.envelope).valid).toBe(true);
  });
});

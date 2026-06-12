import { describe, expect, it } from "vitest";
import { buildDashboardData, parseJsonl } from "./data.js";

describe("substrate dashboard data", () => {
  it("parses newline-delimited artifact rows", () => {
    expect(parseJsonl<{ a: number }>('{"a":1}\n\n{"a":2}\n')).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  it("derives honest replay metrics without inventing write-binding rows", () => {
    const data = buildDashboardData(
      [
        {
          artifactHash: "a".repeat(64),
          artifactId: "artifact_clean",
          eventEnvelope: {
            source: "arrowhedge/test",
            subject: "projection:test",
            time: "2026-06-03T14:05:00.000Z",
            type: "pm.agent_state.action_proposal_reviewed.v1",
          },
          generatedAt: "2026-06-03T14:05:00.000Z",
          metadata: {
            temporalMisalignmentPhase: "none",
            invariantClasses: [],
          },
          review: {
            currentStateView: {
              viewId: "view_a",
              subject: { kind: "projection", id: "p1" },
              sourceRefs: [],
              conflicts: [],
            },
            execution: {
              allowed: true,
              blocking: false,
              enforcementMode: "advisory",
            },
            proposedAction: {
              actionType: "risk.refresh",
              proposedAt: "2026-06-03T14:05:00.000Z",
              proposedBy: "agent:test",
            },
            valid: true,
            warnings: [],
          },
        },
      ],
      [
        {
          reviewId: "ev1:admission_review",
          tenantId: "tenant",
          evidence: {
            evidenceId: "ev1",
            kind: "mcp_tool_handle",
            source: "mcp://tool",
            subject: { kind: "projection", id: "p1" },
            observedAt: "2026-06-10T15:55:00.000Z",
          },
          evaluatedAt: "2026-06-10T16:00:00.000Z",
          decision: "admitted",
          authorityStatus: "evidence_only",
          issues: [],
          invariantClasses: [],
        },
      ],
    );

    expect(data.metrics.find((metric) => metric.id === "replay")?.value).toBe(
      "100%",
    );
    expect(data.flow).toMatchObject({
      observations: 1,
      stateReviews: 1,
      admittedEvidence: 1,
      rejectedEvidence: 0,
      writeBindings: null,
    });
  });
});

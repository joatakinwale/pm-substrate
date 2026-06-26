import { describe, expect, it } from "vitest";
import { buildDashboardData, parseJsonl } from "./data.js";

describe("substrate dashboard data", () => {
  it("parses newline-delimited artifact rows", () => {
    expect(parseJsonl<{ a: number }>('{"a":1}\n\n{"a":2}\n')).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  it("derives honest replay metrics from committed write-binding rows", () => {
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
      [
        {
          recordId: "wb_allowed",
          schemaVersion: "pm.write_binding_replay.v1",
          generatedAt: "2026-06-11T16:00:00.000Z",
          tenantId: "tenant",
          workflowRunId: "workflow_1",
          workflowId: "wf_1",
          workflowName: "portfolio-decision-accept",
          workflowVersion: 1,
          nodeId: "accept",
          capability: "portfolio/accept",
          capabilityWrites: true,
          triggerEventId: "evt_decision_ready",
          actionType: "portfolio.decision.accept",
          actionConsequence: "high",
          bindingMode: "require_for_writes",
          currentStateView: {
            viewId: "view_a",
            subject: { kind: "projection", id: "p1" },
          },
          stateReviewArtifact: {
            artifactId: "artifact_clean",
            artifactHash: "a".repeat(64),
          },
          evidenceAdmissionReviews: [
            {
              reviewId: "ev1:admission_review",
              evidenceId: "ev1",
              decision: "admitted",
              authorityStatus: "evidence_only",
              invariantClasses: [],
            },
          ],
          invocationEvidenceBinding: {
            stateReviewArtifactId: "artifact_clean",
            evidenceAdmissionReviewIds: ["ev1:admission_review"],
            policyDisposition: {
              evaluatedAt: "2026-06-11T16:00:00.000Z",
              consequence: "high",
              wouldBlock: false,
              mode: "advisory",
            },
          },
          validation: { valid: true },
          decision: "allowed",
          warningCodes: [],
          invariantClasses: [],
          temporalMisalignmentPhase: "none",
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
      writeBindings: 1,
    });
    expect(data.metrics.find((metric) => metric.id === "binding")).toMatchObject({
      value: "1",
      detail: "1 allowed, 0 blocked",
      tone: "good",
    });
  });
});

import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";
import {
  buildReadSetFromCurrentStateView,
  buildStateReviewArtifact,
  importStateReviewArtifactsJsonl,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifactsJsonl,
  stateRef,
  type CurrentStateView,
  type ProposedAction,
  type StateReviewArtifact,
} from "@pm/agent-state";

import {
  analyzeEvidenceAdmissionFixtureResults,
  buildEvidenceAdmissionFixtureCorpus,
  groupStateReviewArtifactsByRunGroup,
  projectStateReviewArtifactForRole,
  runEvidenceAdmissionFixtures,
} from "./evidence-admission.js";

describe("evidence admission fixture corpus", () => {
  const fixtures = buildEvidenceAdmissionFixtureCorpus();
  const results = runEvidenceAdmissionFixtures(fixtures);

  it("covers every frontier evidence lane with at least one fixture", () => {
    const kinds = new Set(fixtures.map((fixture) => fixture.evidence.kind));
    for (const kind of [
      "mcp_tool_handle",
      "tool_annotation",
      "memory_retrieval",
      "monitoring_event",
      "approval_record",
      "provider_policy",
      "external_validation",
      "custom_store_record",
      "subagent_output",
      "identity_on_behalf_of",
      "workflow_trace",
      "pm_handoff",
      "gateway_request",
      "audit_event",
      "runtime_trace",
      "lineage_record",
      "attestation",
    ]) {
      expect(kinds, `missing fixture for evidence kind ${kind}`).toContain(kind);
    }
  });

  it("every fixture passes: decision and issue codes match expectations exactly", () => {
    for (const result of results) {
      expect(
        result.passed,
        `${result.fixtureId} expected ${result.expectedDecision} ` +
          `(missing: ${result.missingExpectedIssueCodes.join(",") || "none"}; ` +
          `unexpected: ${result.unexpectedIssueCodes.join(",") || "none"})`,
      ).toBe(true);
    }
  });

  it("includes a clean positive baseline and both rejection lanes", () => {
    const byId = new Map(results.map((result) => [result.fixtureId, result]));
    expect(byId.get("arrowhedge-clean-current-evidence")?.review.decision).toBe(
      "admitted",
    );
    expect(byId.get("cross-tenant-rejection")?.review.decision).toBe("rejected");
    expect(byId.get("future-dated-evidence-rejection")?.review.decision).toBe(
      "rejected",
    );
  });

  it("never grants authority through admission", () => {
    expect(
      results.every((result) => result.review.authorityStatus === "evidence_only"),
    ).toBe(true);
  });

  it("derives corpus metrics including PM handoff and monitoring lanes", () => {
    const metrics = analyzeEvidenceAdmissionFixtureResults(results, fixtures);

    expect(metrics.totalFixtures).toBe(fixtures.length);
    expect(metrics.passedFixtures).toBe(fixtures.length);
    expect(metrics.fixturePassRate).toBe(1);
    expect(metrics.decisions.rejected).toBe(2);
    expect(metrics.allEvidenceOnly).toBe(true);
    expect(metrics.pmHandoffCount).toBe(1);
    expect(metrics.pmHandoffIncompleteCount).toBe(1);
    expect(metrics.prematureActionCount).toBe(1);
    expect(metrics.issueCodeCounts["approval_revision_mismatch"]).toBe(1);
    expect(metrics.wouldBlockAtHighConsequence).toBeGreaterThan(0);
    expect(metrics.invariantClassCounts["freshness_window"]).toBeGreaterThan(0);
  });
});

const t = tenantId("tnt_run_groups");
const subjectRef = stateRef("projection", "arrowhedge_cop:AMD", "AMD COP");
const signalRef = stateRef("event", "evt_signal_amd");

const view = (overrides: Partial<CurrentStateView> = {}): CurrentStateView => ({
  tenantId: t,
  viewId: "view_amd",
  subject: subjectRef,
  observedAt: timestamp("2026-06-10T14:00:00.000Z"),
  validUntil: timestamp("2026-06-10T14:10:00.000Z"),
  authorityRule: "arrowhedge:backtest:bt_amd",
  sourceRefs: [signalRef],
  missingSources: [],
  conflicts: [],
  allowedActions: [
    {
      actionType: "portfolio.decision.accept",
      label: "Accept",
      requiredRefs: [signalRef],
    },
  ],
  ...overrides,
});

const action = (overrides: Partial<ProposedAction> = {}): ProposedAction => ({
  tenantId: t,
  actionType: "portfolio.decision.accept",
  subject: subjectRef,
  payload: {},
  readSet: buildReadSetFromCurrentStateView(view(), "arrowhedge:backtest:bt_amd"),
  proposedBy: "agent:dexter",
  proposedAt: timestamp("2026-06-10T14:05:00.000Z"),
  ...overrides,
});

const artifactInGroup = (
  runGroupId: string,
  overrides: {
    readonly actionOverrides?: Partial<ProposedAction>;
    readonly viewOverrides?: Partial<CurrentStateView>;
    readonly artifactId?: string;
  } = {},
): StateReviewArtifact => {
  const review = reviewProposedActionAgainstCurrentState(
    action(overrides.actionOverrides ?? {}),
    view(overrides.viewOverrides ?? {}),
  );
  return buildStateReviewArtifact(review, {
    ...(overrides.artifactId !== undefined
      ? { artifactId: overrides.artifactId }
      : {}),
    metadata: { runGroupId },
  });
};

describe("state-review artifact run groups", () => {
  it("groups artifacts by runGroupId and detects propagated warnings across artifacts", () => {
    const staleView: Partial<CurrentStateView> = {
      validUntil: timestamp("2026-06-10T14:01:00.000Z"),
    };
    const staleAction: Partial<ProposedAction> = {
      proposedAt: timestamp("2026-06-10T14:05:00.000Z"),
      readSet: buildReadSetFromCurrentStateView(
        view(staleView),
        "arrowhedge:backtest:bt_amd",
      ),
    };
    const artifacts = [
      artifactInGroup("run_alpha", { artifactId: "a1" }),
      artifactInGroup("run_alpha", {
        artifactId: "a2",
        viewOverrides: staleView,
        actionOverrides: staleAction,
      }),
      artifactInGroup("run_alpha", {
        artifactId: "a3",
        viewOverrides: staleView,
        actionOverrides: staleAction,
      }),
      artifactInGroup("run_beta", { artifactId: "b1" }),
    ];

    const groups = groupStateReviewArtifactsByRunGroup(artifacts);
    expect(groups).toHaveLength(2);

    const alpha = groups.find((group) => group.runGroupId === "run_alpha");
    expect(alpha?.artifactCount).toBe(3);
    expect(alpha?.invalidArtifactCount).toBe(2);
    expect(alpha?.propagatedWarningCodes).toContain("stale_read_ref");
    expect(alpha?.agents).toEqual(["agent:dexter"]);

    const beta = groups.find((group) => group.runGroupId === "run_beta");
    expect(beta?.artifactCount).toBe(1);
    expect(beta?.propagatedWarningCodes).toHaveLength(0);
  });

  it("ignores artifacts without a runGroupId", () => {
    const review = reviewProposedActionAgainstCurrentState(action(), view());
    const ungrouped = buildStateReviewArtifact(review);
    expect(groupStateReviewArtifactsByRunGroup([ungrouped])).toHaveLength(0);
  });

  it("run-grouped artifacts survive JSONL round-trip", () => {
    const artifacts = [
      artifactInGroup("run_gamma", { artifactId: "g1" }),
      artifactInGroup("run_gamma", { artifactId: "g2" }),
    ];
    const imported = importStateReviewArtifactsJsonl(
      serializeStateReviewArtifactsJsonl(artifacts),
    );
    expect(imported.every((result) => result.valid)).toBe(true);
    const reimported = imported
      .map((result) => result.artifact)
      .filter((artifact): artifact is StateReviewArtifact => artifact !== undefined);
    const groups = groupStateReviewArtifactsByRunGroup(reimported);
    expect(groups[0]?.artifactCount).toBe(2);
  });
});

describe("role-specific artifact projections", () => {
  const artifact = artifactInGroup("run_roles", { artifactId: "r1" });
  const roles = ["risk_officer", "project_manager", "auditor"] as const;

  it("preserves the identical invariant core across all roles", () => {
    const [first, ...rest] = roles.map((role) =>
      projectStateReviewArtifactForRole(artifact, role),
    );
    for (const projection of rest) {
      expect(projection.core).toEqual(first!.core);
    }
    expect(first!.core.artifactId).toBe("r1");
    expect(first!.core.artifactHash).toBe(artifact.artifactHash);
  });

  it("gives each role a distinct lens", () => {
    const risk = projectStateReviewArtifactForRole(artifact, "risk_officer");
    const pm = projectStateReviewArtifactForRole(artifact, "project_manager");
    const audit = projectStateReviewArtifactForRole(artifact, "auditor");

    expect(risk.view["policyAtHighConsequence"]).toBeDefined();
    expect(pm.view["runGroupId"]).toBe("run_roles");
    expect(audit.view["provenance"]).toBeDefined();
    expect(risk.view["provenance"]).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import { FAILURE_CLASSES, validateEvalEvent } from "./schema.js";
import {
  buildMarketingAxisBBlockedEval,
  buildMarketingAxisBCorePairedScenarios,
  buildMarketingAxisBIntegrationReadinessEval,
  buildMarketingAxisBNextActionAdapterEval,
  buildMarketingAxisBPairedScenario,
  MARKETING_AXIS_B_REQUIRED_ANCHORS,
  type MarketingAxisBSourceManifestLike,
  readMarketingAxisBAnchorAvailability,
} from "./marketing.js";
import { analyzeThreeAxisCoverage } from "./three-axis-coverage.js";

describe("marketing Axis B blocker eval", () => {
  it("emits a blocked eval when PluggedInSocial or authoritative fixtures are unavailable", () => {
    const event = buildMarketingAxisBBlockedEval({
      tenantId: tenantId("tnt_axis_b_blocked"),
      observedAt: timestamp("2026-06-25T04:00:00.000Z"),
    });

    expect(event.axis).toBe("marketing");
    expect(event.result).toBe("blocked");
    expect(event.evidenceRefs).toHaveLength(0);
    expect(event.substrateRefs).toHaveLength(0);
    expect(event.notes).toContain("./plugged_in_social");
    expect(event.notes).toContain("No authoritative agency fixtures");
    expect(validateEvalEvent(event)).toEqual({ valid: true, issues: [] });
  });

  it("declares live PluggedInSocial and pm-substrate anchors for Axis B", () => {
    expect(MARKETING_AXIS_B_REQUIRED_ANCHORS.map((anchor) => anchor.id)).toEqual([
      "plugged_in_social.agent_instructions",
      "plugged_in_social.virtual_agency_public_api",
      "plugged_in_social.virtual_agency_internal_api",
      "plugged_in_social.virtual_agency_orchestration",
      "plugged_in_social.virtual_agency_worker",
      "plugged_in_social.virtual_agency_worker_config",
      "plugged_in_social.shared_queue_contract",
      "plugged_in_social.queue_producer_config",
      "plugged_in_social.deploy_script",
      "plugged_in_social.agent_inbox_ui",
      "plugged_in_social.virtual_agency_ledger_migration",
      "pm_substrate.profile_agency",
      "pm_substrate.publication_terminal",
      "pm_substrate.next_action_proposal",
      "pm_substrate.plugged_in_social_axis_b_adapter",
      "pm_substrate.marketing_eval",
    ]);
  });

  it("passes readiness when the real PluggedInSocial anchors are present", () => {
    const availability = readMarketingAxisBAnchorAvailability({
      workspaceRoot: process.cwd(),
    });
    expect(availability.missing).toEqual([]);

    const event = buildMarketingAxisBIntegrationReadinessEval({
      tenantId: tenantId("tnt_axis_b_live"),
      observedAt: timestamp("2026-07-01T12:00:00.000Z"),
      availability,
    });

    expect(event.axis).toBe("marketing");
    expect(event.result).toBe("pass");
    expect(event.evidenceStage).toBe("live_run");
    expect(event.evidenceRefs.map((ref) => ref.id)).toContain(
      "plugged_in_social.virtual_agency_worker",
    );
    expect(event.substrateRefs.map((ref) => ref.id)).toContain(
      "pm_substrate.publication_terminal",
    );
    expect(event.notes).toContain("Axis B live integration anchors present");
    expect(validateEvalEvent(event)).toEqual({ valid: true, issues: [] });
  });

  it("blocks readiness when metrics evidence does not unlock analytics dispatch", () => {
    const manifest: MarketingAxisBSourceManifestLike = {
      sourcePath: "./plugged_in_social",
      readiness: {
        complete: false,
        missing: ["missing governance gate: metricsReadyAnalyticsDispatch"],
      },
      evidenceRefs: [],
      substrateRefs: [],
      closedLoopStages: [
        { stage: "intake", present: true },
        { stage: "strategy", present: true },
        { stage: "content", present: true },
        { stage: "approval", present: true },
        { stage: "scheduling", present: true },
        { stage: "publishing", present: true },
        { stage: "metrics", present: false },
        { stage: "report", present: true },
        { stage: "next_action", present: true },
      ],
    };

    const event = buildMarketingAxisBIntegrationReadinessEval({
      tenantId: tenantId("tnt_axis_b_metrics_ready_gate"),
      observedAt: timestamp("2026-07-01T19:00:00.000Z"),
      manifest,
    });

    expect(event.result).toBe("blocked");
    expect(event.evidenceStage).toBe("detected_warning");
    expect(event.notes).toContain(
      "missing governance gate: metricsReadyAnalyticsDispatch",
    );
    expect(event.notes).toContain("closed-loop stages incomplete: metrics");
    expect(validateEvalEvent(event)).toEqual({ valid: true, issues: [] });
  });

  it("builds a paired Axis B workflow-invalidation scenario with terminal proof", () => {
    const pair = buildMarketingAxisBPairedScenario({
      tenantId: tenantId("tnt_axis_b_workflow_pair"),
      observedAt: timestamp("2026-07-01T19:20:00.000Z"),
      scenarioId: "publish-after-client-approval-revoked",
      failureClass: "workflow_invalidation",
      baselineTerminalOutcome: "accepted",
      substrateTerminalOutcome: "blocked",
      evidenceRefs: [
        {
          kind: "source_record",
          id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111",
          label: "PluggedInSocial ClientReport row",
        },
      ],
      substrateRefs: [
        {
          kind: "document",
          id: "pm_substrate:profile-agency:publication-terminal",
          label: "Agency publication terminal",
        },
      ],
    });

    expect(pair.pairedRunGroup).toBe(
      "pair_axis_b_publish-after-client-approval-revoked",
    );
    expect(pair.events.map((event) => event.runArm)).toEqual([
      "baseline",
      "substrate",
    ]);
    expect(pair.events.map((event) => event.result)).toEqual(["fail", "pass"]);
    expect(pair.events.map((event) => event.operationalTerminalOutcome)).toEqual([
      "accepted",
      "blocked",
    ]);
    expect(
      pair.events.every((event) =>
        event.substrateRefs.some((ref) => ref.kind === "action_outcome_envelope"),
      ),
    ).toBe(true);
    expect(pair.summary).toMatchObject({
      scenarioId: "publish-after-client-approval-revoked",
      failureClass: "workflow_invalidation",
      baselineResult: "fail",
      substrateResult: "pass",
      improvement: 1,
    });
    expect(pair.events.map(validateEvalEvent)).toEqual([
      { valid: true, issues: [] },
      { valid: true, issues: [] },
    ]);

    const report = analyzeThreeAxisCoverage(pair.events);
    expect(report.byCell.marketing.workflow_invalidation).toMatchObject({
      covered: true,
      verified: true,
      protectivePairs: 1,
      scenarioPassPairs: 1,
      terminalProofBackedPairs: 1,
    });
  });

  it("builds the core paired Axis B governance scenarios across all failure classes", () => {
    const scenarios = buildMarketingAxisBCorePairedScenarios({
      tenantId: tenantId("tnt_axis_b_core_pairs"),
      observedAt: timestamp("2026-07-01T19:30:00.000Z"),
      evidenceRefs: [
        {
          kind: "source_record",
          id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111",
          label: "PluggedInSocial ClientReport row",
        },
      ],
      substrateRefs: [
        {
          kind: "document",
          id: "pm_substrate:profile-agency:publication-terminal",
          label: "Agency publication terminal",
        },
        {
          kind: "document",
          id: "pm_substrate:profile-agency:next-action-proposal",
          label: "Agency next-action proposal",
        },
      ],
    });

    expect(scenarios.map((scenario) => scenario.summary.failureClass)).toEqual(
      FAILURE_CLASSES,
    );
    expect(scenarios.flatMap((scenario) => scenario.events).map(validateEvalEvent)).toEqual(
      Array.from({ length: FAILURE_CLASSES.length * 2 }, () => ({
        valid: true,
        issues: [],
      })),
    );

    const report = analyzeThreeAxisCoverage(
      scenarios.flatMap((scenario) => scenario.events),
    );
    expect(report.byAxis.marketing.verifiedFailureClasses).toEqual(FAILURE_CLASSES);
    expect(report.byAxis.marketing.complete).toBe(true);
    expect(report.byAxis.marketing.verified).toBe(true);
    expect(report.byAxis.marketing.missingFailureClasses).toEqual([]);
  });

  it("passes the live next-action adapter eval when the adapter admits an accepted proposal", () => {
    const event = buildMarketingAxisBNextActionAdapterEval({
      tenantId: tenantId("tnt_axis_b_next_action"),
      observedAt: timestamp("2026-07-01T18:00:00.000Z"),
      adapterResult: {
        sourcePath: "./plugged_in_social",
        ready: true,
        terminalOutcome: "accepted",
        actionId: "tnt_axis_b_next_action:agency:plugged_in_social:next",
        evidenceRefs: [
          {
            kind: "source_record",
            id: "plugged_in_social:client_reports:11111111-1111-4111-8111-111111111111",
            label: "PluggedInSocial ClientReport row",
          },
        ],
        substrateRefs: [
          {
            kind: "action_outcome_envelope",
            id: "agency_next_action_outcome_abc123",
            label: "Agency marketing next-action proposal outcome",
          },
        ],
        issues: [],
      },
    });

    expect(event.result).toBe("pass");
    expect(event.operationalTerminalOutcome).toBe("accepted");
    expect(event.evidenceStage).toBe("live_run");
    expect(event.notes).toContain("Axis B next-action adapter accepted");
    expect(validateEvalEvent(event)).toEqual({ valid: true, issues: [] });
  });

  it("blocks the live next-action adapter eval when adapter readiness is false", () => {
    const event = buildMarketingAxisBNextActionAdapterEval({
      tenantId: tenantId("tnt_axis_b_next_action_blocked"),
      observedAt: timestamp("2026-07-01T18:05:00.000Z"),
      adapterResult: {
        sourcePath: "./plugged_in_social",
        ready: false,
        terminalOutcome: "blocked",
        evidenceRefs: [],
        substrateRefs: [
          {
            kind: "action_outcome_envelope",
            id: "agency_next_action_outcome_blocked",
            label: "Blocked agency marketing next-action proposal outcome",
          },
        ],
        issues: ["missing governance gate: sharedPayloadContract"],
      },
    });

    expect(event.result).toBe("blocked");
    expect(event.operationalTerminalOutcome).toBe("blocked");
    expect(event.notes).toContain(
      "missing governance gate: sharedPayloadContract",
    );
    expect(validateEvalEvent(event)).toEqual({ valid: true, issues: [] });
  });
});

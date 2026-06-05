import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import {
  buildObservationContractFromCurrentStateView,
  buildReadSetFromCurrentStateView,
  evaluateObservationContract,
  reviewProposedActionAgainstCurrentState,
  stateRef,
  validateProposedActionReadSet,
  type CurrentStateView,
  type ProposedAction,
} from "./index.js";

const t = tenantId("tnt_agent_state");
const signalRef = stateRef("event", "evt_signal", "analyst.signal.created");
const riskRef = stateRef("event", "evt_risk", "risk.state.validated");
const decisionRef = stateRef("event", "evt_decision", "portfolio.decision.proposed");

const baseView = (overrides: Partial<CurrentStateView> = {}): CurrentStateView => ({
  tenantId: t,
  viewId: "view_aapl",
  subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
  observedAt: timestamp("2026-06-03T14:00:00.000Z"),
  validUntil: timestamp("2026-06-03T14:10:00.000Z"),
  authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
  projectionVersion: 1,
  workflowPosition: "decision_pending",
  sourceRefs: [signalRef, riskRef, decisionRef],
  missingSources: [],
  conflicts: [],
  allowedActions: [
    {
      actionType: "portfolio.decision.accept",
      label: "Accept portfolio decision",
      requiredRefs: [signalRef, riskRef, decisionRef],
      requiredWorkflowPosition: "decision_pending",
    },
  ],
  ...overrides,
});

const actionFrom = (
  view: CurrentStateView,
  overrides: Partial<ProposedAction> = {},
): ProposedAction => ({
  tenantId: view.tenantId,
  actionType: "portfolio.decision.accept",
  subject: view.subject,
  payload: { decisionId: "dec_aapl_buy_120" },
  readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
  proposedBy: "agent:portfolio-manager",
  proposedAt: timestamp("2026-06-03T14:05:00.000Z"),
  ...overrides,
});

describe("@pm/agent-state read-set validation", () => {
  it("builds read-set entries from every current-state source ref", () => {
    expect(buildReadSetFromCurrentStateView(baseView(), "authority:test")).toEqual([
      {
        ref: signalRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
      {
        ref: riskRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
      {
        ref: decisionRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
    ]);
  });

  it("accepts a current allowed action with complete refs", () => {
    expect(validateProposedActionReadSet(actionFrom(baseView()), baseView())).toEqual({
      valid: true,
      mode: "warn",
      issues: [],
    });
  });

  it("warns when a proposed action subject differs from the current-state subject", () => {
    const view = baseView();

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          subject: stateRef("projection", "arrowhedge_cop:MSFT", "MSFT COP"),
        }),
        view,
      ).issues,
    ).toMatchObject([
      {
        code: "subject_mismatch",
        path: "/subject",
      },
    ]);
  });

  it("warns without blocking when read-set refs are stale", () => {
    const view = baseView();

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
        }),
        view,
      ),
    ).toMatchObject({
      valid: false,
      mode: "warn",
      issues: [
        { code: "stale_read_ref", path: "/readSet/0/validUntil" },
        { code: "stale_read_ref", path: "/readSet/1/validUntil" },
        { code: "stale_read_ref", path: "/readSet/2/validUntil" },
      ],
    });
  });

  it("warns for missing required refs, authority drift, projection drift, workflow mismatch, and current conflicts", () => {
    const view = baseView({
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "decision risk snapshot no longer matches current risk state",
        },
      ],
    });
    const readSet = buildReadSetFromCurrentStateView(baseView(), "other-authority")
      .filter((entry) => entry.ref.id !== riskRef.id);

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          readSet,
        }),
        view,
      ).issues.map((issue) => issue.code),
    ).toEqual([
      "current_view_conflict",
      "missing_read_ref",
      "authority_mismatch",
      "authority_mismatch",
      "projection_version_mismatch",
      "projection_version_mismatch",
      "workflow_position_mismatch",
    ]);
  });

  it("builds an observation contract from a current-state view", () => {
    expect(
      buildObservationContractFromCurrentStateView(
        baseView({
          missingSources: ["risk_state_refresh"],
          conflicts: [
            {
              conflictType: "stale_observation",
              refs: [riskRef],
              message: "risk state expired",
            },
          ],
        }),
      ),
    ).toEqual({
      tenantId: t,
      contractId: "view_aapl:observation_contract",
      subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
      issuedAt: "2026-06-03T14:00:00.000Z",
      observedAt: "2026-06-03T14:00:00.000Z",
      validUntil: "2026-06-03T14:10:00.000Z",
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      projectionVersion: 1,
      workflowPosition: "decision_pending",
      requiredSourceRefs: [signalRef, riskRef, decisionRef],
      declaredMissingSources: ["risk_state_refresh"],
      declaredConflictCount: 1,
    });
  });

  it("evaluates observation contracts into state assertions", () => {
    const contract = buildObservationContractFromCurrentStateView(baseView());
    const changedView = baseView({
      authorityRule: "arrowhedge:paper_quote:latest",
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      sourceRefs: [signalRef, decisionRef],
      missingSources: ["risk_state"],
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "risk snapshot no longer matches",
        },
      ],
    });

    expect(
      evaluateObservationContract(
        contract,
        changedView,
        timestamp("2026-06-03T14:11:00.000Z"),
      ).assertions.map((assertion) => ({
        code: assertion.code,
        passed: assertion.passed,
      })),
    ).toEqual([
      { code: "required_source_refs_present", passed: false },
      { code: "authority_rule_matches", passed: false },
      { code: "freshness_window_current", passed: false },
      { code: "projection_version_matches", passed: false },
      { code: "workflow_position_matches", passed: false },
      { code: "conflicts_declared", passed: false },
      { code: "missing_sources_declared", passed: false },
    ]);
  });

  it("reviews a proposed action as a warn-first pre-execution artifact", () => {
    const view = baseView();

    expect(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    ).toMatchObject({
      tenantId: t,
      reviewId: "view_aapl:portfolio.decision.accept:proposal_review",
      mode: "warn",
      valid: true,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "advisory",
        reason: "advisory_warn_first_v1",
        warningCount: 0,
      },
      readSetValidation: {
        valid: true,
        issues: [],
      },
      observationEvaluation: {
        valid: true,
        currentStateViewId: "view_aapl",
      },
      warnings: [],
    });
  });

  it("keeps stale proposed actions warn-first while surfacing read-set and observation warnings", () => {
    const view = baseView();

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );

    expect(review).toMatchObject({
      mode: "warn",
      valid: false,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "advisory",
        reason: "advisory_warn_first_v1",
      },
    });
    expect(review.warnings.map((warning) => warning.source)).toEqual([
      "read_set",
      "read_set",
      "read_set",
      "observation_contract",
    ]);
    expect(review.warnings.map((warning) => warning.code)).toEqual([
      "stale_read_ref",
      "stale_read_ref",
      "stale_read_ref",
      "freshness_window_current",
    ]);
  });

  it("can switch to blocking mode without changing the default advisory contract", () => {
    const view = baseView();

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        enforcementMode: "blocking",
      },
    );

    expect(review.execution).toMatchObject({
      allowed: false,
      blocking: true,
      enforcementMode: "blocking",
      reason: "blocking_policy_failed",
    });
  });

  it("reviews an action against the original observation contract instead of the current view", () => {
    const originalView = baseView();
    const originalContract =
      buildObservationContractFromCurrentStateView(originalView);
    const changedView = baseView({
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      sourceRefs: [signalRef, decisionRef],
      missingSources: ["risk_state"],
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "risk snapshot no longer matches",
        },
      ],
    });

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(originalView, {
        observationContract: originalContract,
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      changedView,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        observationContract: originalContract,
      },
    );

    expect(review.observationContract).toEqual(originalContract);
    expect(review.valid).toBe(false);
    expect(review.execution).toMatchObject({
      allowed: true,
      blocking: false,
      enforcementMode: "advisory",
      reason: "advisory_warn_first_v1",
    });
    expect(
      review.observationEvaluation.assertions
        .filter((assertion) => !assertion.passed)
        .map((assertion) => assertion.code),
    ).toEqual([
      "required_source_refs_present",
      "freshness_window_current",
      "projection_version_matches",
      "workflow_position_matches",
      "conflicts_declared",
      "missing_sources_declared",
    ]);
    expect(review.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "current_view_conflict",
        "missing_read_ref",
        "stale_read_ref",
        "projection_version_mismatch",
        "workflow_position_mismatch",
        "required_source_refs_present",
        "freshness_window_current",
      ]),
    );
  });
});

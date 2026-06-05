import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import {
  buildReadSetFromCurrentStateView,
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
});

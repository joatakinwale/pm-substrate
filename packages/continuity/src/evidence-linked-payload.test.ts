import { describe, expect, it } from "vitest";
import {
  stateRef,
  type EvidenceLinkedContinuityPayload,
} from "@pm/agent-state";
import { eventId, tenantId, timestamp } from "@pm/types";

import type { RecordCheckpointInput } from "./interfaces.js";

describe("evidence-linked continuity payload convention", () => {
  it("allows a checkpoint payload to cite the current state view and evidence refs", () => {
    const payload: EvidenceLinkedContinuityPayload = {
      sourceRefs: [
        stateRef("event", "evt_signal", "analyst.signal.created"),
        stateRef("event", "evt_risk", "risk.state.validated"),
        stateRef("document", "doc_price_window", "aapl-price-window.json"),
      ],
      validUntil: timestamp("2026-06-03T14:10:00.000Z"),
      supersedes: ["checkpoint_prev_aapl"],
      contradictedBy: ["evt_risk_refresh"],
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      currentStateViewId: "arrowhedge_cop:AAPL:current_state_view",
    };

    const checkpoint: RecordCheckpointInput = {
      tenantId: tenantId("tnt_continuity_state_view"),
      agentId: "agent:portfolio-manager",
      scope: "arrowhedge:AAPL",
      kind: "claim",
      title: "AAPL accept proposal read state",
      summary:
        "Agent proposal was evaluated against ArrowHedge current_state_view before action.",
      evidenceEventIds: [eventId("evt_signal"), eventId("evt_risk")],
      decisionRefs: ["dec_aapl_buy_120"],
      payload,
    };

    expect(checkpoint.payload).toMatchObject({
      currentStateViewId: "arrowhedge_cop:AAPL:current_state_view",
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      validUntil: "2026-06-03T14:10:00.000Z",
      supersedes: ["checkpoint_prev_aapl"],
      contradictedBy: ["evt_risk_refresh"],
    });
    expect(checkpoint.payload?.["sourceRefs"]).toEqual([
      { kind: "event", id: "evt_signal", label: "analyst.signal.created" },
      { kind: "event", id: "evt_risk", label: "risk.state.validated" },
      { kind: "document", id: "doc_price_window", label: "aapl-price-window.json" },
    ]);
  });
});

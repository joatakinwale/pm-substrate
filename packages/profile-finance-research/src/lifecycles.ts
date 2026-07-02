import type { LifecycleDef } from "@pm/types";

export const RESEARCH_RUN_LIFECYCLE: LifecycleDef = {
  states: [
    "planned",
    "collecting",
    "analyzing",
    "risk_validating",
    "deciding",
    "completed",
    "blocked",
    "cancelled",
  ],
  initial: "planned",
  terminal: ["completed", "blocked", "cancelled"],
  transitions: [
    { from: ["planned"], to: "collecting", trigger: "research_run.collection_started" },
    { from: ["collecting"], to: "analyzing", trigger: "research_run.analysis_started" },
    { from: ["analyzing"], to: "risk_validating", trigger: "risk.state.validation_started" },
    { from: ["risk_validating"], to: "deciding", trigger: "portfolio.decision.proposed" },
    { from: ["deciding"], to: "completed", trigger: "portfolio.decision.accepted" },
    {
      from: ["collecting", "analyzing", "risk_validating", "deciding"],
      to: "blocked",
      trigger: "workflow.blocked.stale_state",
    },
    {
      from: ["collecting", "analyzing", "risk_validating", "deciding"],
      to: "blocked",
      trigger: "workflow.blocked.invalid_action",
    },
    {
      from: ["planned", "collecting", "analyzing", "risk_validating", "deciding"],
      to: "cancelled",
      trigger: "research_run.cancelled",
    },
  ],
};

export const BACKTEST_RUN_LIFECYCLE: LifecycleDef = {
  states: ["configured", "running", "analyzing", "completed", "failed", "cancelled"],
  initial: "configured",
  terminal: ["completed", "failed", "cancelled"],
  transitions: [
    { from: ["configured"], to: "running", trigger: "backtest.started" },
    { from: ["running"], to: "analyzing", trigger: "backtest.analysis_started" },
    { from: ["analyzing"], to: "completed", trigger: "backtest.completed" },
    { from: ["running", "analyzing"], to: "failed", trigger: "backtest.failed" },
    { from: ["configured", "running", "analyzing"], to: "cancelled", trigger: "backtest.cancelled" },
  ],
};

import type { EdgeTypeDef } from "@pm/types";

export const BACKTEST_HAS_RESEARCH_RUN: EdgeTypeDef = {
  name: "backtest_has_research_run",
  fromTypes: ["BacktestRun"],
  toTypes: ["ResearchRun"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const RESEARCH_RUN_TRACKS_TICKER: EdgeTypeDef = {
  name: "research_run_tracks_ticker",
  fromTypes: ["ResearchRun"],
  toTypes: ["Ticker"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

export const RESEARCH_RUN_HAS_SIGNAL: EdgeTypeDef = {
  name: "research_run_has_signal",
  fromTypes: ["ResearchRun"],
  toTypes: ["AnalystSignal"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const SIGNAL_FOR_TICKER: EdgeTypeDef = {
  name: "signal_for_ticker",
  fromTypes: ["AnalystSignal"],
  toTypes: ["Ticker"],
  fromCardinality: "exactly:1",
  toCardinality: "unbounded",
};

export const SIGNAL_SUPPORTED_BY_EVIDENCE: EdgeTypeDef = {
  name: "signal_supported_by_evidence",
  fromTypes: ["AnalystSignal"],
  toTypes: ["EvidenceDocument"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

export const RESEARCH_RUN_HAS_RISK_STATE: EdgeTypeDef = {
  name: "research_run_has_risk_state",
  fromTypes: ["ResearchRun"],
  toTypes: ["RiskState"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const RISK_STATE_FOR_TICKER: EdgeTypeDef = {
  name: "risk_state_for_ticker",
  fromTypes: ["RiskState"],
  toTypes: ["Ticker"],
  fromCardinality: "exactly:1",
  toCardinality: "unbounded",
};

export const RISK_STATE_SUPPORTED_BY_EVIDENCE: EdgeTypeDef = {
  name: "risk_state_supported_by_evidence",
  fromTypes: ["RiskState"],
  toTypes: ["EvidenceDocument"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

export const RESEARCH_RUN_HAS_PORTFOLIO_STATE: EdgeTypeDef = {
  name: "research_run_has_portfolio_state",
  fromTypes: ["ResearchRun"],
  toTypes: ["PortfolioState"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const RESEARCH_RUN_HAS_DECISION: EdgeTypeDef = {
  name: "research_run_has_decision",
  fromTypes: ["ResearchRun"],
  toTypes: ["PortfolioDecision"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const DECISION_FOR_TICKER: EdgeTypeDef = {
  name: "decision_for_ticker",
  fromTypes: ["PortfolioDecision"],
  toTypes: ["Ticker"],
  fromCardinality: "exactly:1",
  toCardinality: "unbounded",
};

export const DECISION_USES_RISK_STATE: EdgeTypeDef = {
  name: "decision_uses_risk_state",
  fromTypes: ["PortfolioDecision"],
  toTypes: ["RiskState"],
  fromCardinality: "at-most:1",
  toCardinality: "unbounded",
};

export const DECISION_USES_SIGNAL: EdgeTypeDef = {
  name: "decision_uses_signal",
  fromTypes: ["PortfolioDecision"],
  toTypes: ["AnalystSignal"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

export const EDGE_CATALOG = {
  backtest_has_research_run: BACKTEST_HAS_RESEARCH_RUN,
  research_run_tracks_ticker: RESEARCH_RUN_TRACKS_TICKER,
  research_run_has_signal: RESEARCH_RUN_HAS_SIGNAL,
  signal_for_ticker: SIGNAL_FOR_TICKER,
  signal_supported_by_evidence: SIGNAL_SUPPORTED_BY_EVIDENCE,
  research_run_has_risk_state: RESEARCH_RUN_HAS_RISK_STATE,
  risk_state_for_ticker: RISK_STATE_FOR_TICKER,
  risk_state_supported_by_evidence: RISK_STATE_SUPPORTED_BY_EVIDENCE,
  research_run_has_portfolio_state: RESEARCH_RUN_HAS_PORTFOLIO_STATE,
  research_run_has_decision: RESEARCH_RUN_HAS_DECISION,
  decision_for_ticker: DECISION_FOR_TICKER,
  decision_uses_risk_state: DECISION_USES_RISK_STATE,
  decision_uses_signal: DECISION_USES_SIGNAL,
} as const satisfies Readonly<Record<string, EdgeTypeDef>>;

import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

export const FINANCE_RESEARCH_EVENT_TYPES = [
  "analyst.signal.created",
  "risk.state.validated",
  "portfolio.decision.proposed",
  "portfolio.decision.accepted",
  "workflow.blocked.stale_state",
] as const;

export type FinanceResearchEventType = (typeof FINANCE_RESEARCH_EVENT_TYPES)[number];

const emit = (
  type: FinanceResearchEventType,
  schemaPath: string,
  affectsEntities: readonly string[],
) => ({
  schema: {
    type,
    version: { major: 1, minor: 0, patch: 0 },
    schemaPath,
  },
  affectsEntities,
});

/**
 * Capability descriptor for finance-research.ingest.
 *
 * Day 1 scope is intentionally only the declared contract. The ArrowHedge
 * adapter will call this boundary from Python during Axis A; substrate core
 * packages should not learn finance-specific event names.
 */
export const FINANCE_RESEARCH_INGEST_CAPABILITY = {
  id: "cap_finance_research_ingest_v1" as CapabilityId,
  name: "finance-research.ingest",
  version: 1,
  readsInterfaces: [
    {
      interface: "Engagement",
      fields: ["title", "scopeStart", "scopeEnd", "state"],
      cardinality: "exactly-one",
      required: true,
    },
    {
      interface: "Event",
      fields: ["kind", "occurredAt"],
      cardinality: "many",
      required: true,
    },
    {
      interface: "Resource",
      fields: ["name", "kind", "symbol", "cash", "equity"],
      cardinality: "many",
      required: false,
    },
    {
      interface: "Document",
      fields: ["sha256", "mimeType", "filename", "freshnessExpiresAt"],
      cardinality: "many",
      required: false,
    },
  ],
  writesInterfaces: [
    {
      interface: "Event",
      fields: ["kind", "occurredAt"],
      ownership: "contributor",
    },
    {
      interface: "Resource",
      fields: ["name", "kind"],
      ownership: "contributor",
    },
    {
      interface: "Document",
      fields: ["sha256", "mimeType", "filename"],
      ownership: "contributor",
    },
  ],
  readsEdges: [
    "finance-research/backtest_has_research_run",
    "finance-research/research_run_tracks_ticker",
    "finance-research/research_run_has_signal",
    "finance-research/research_run_has_risk_state",
    "finance-research/research_run_has_portfolio_state",
    "finance-research/research_run_has_decision",
  ],
  writesEdges: [
    "finance-research/research_run_has_signal",
    "finance-research/signal_for_ticker",
    "finance-research/signal_supported_by_evidence",
    "finance-research/research_run_has_risk_state",
    "finance-research/risk_state_for_ticker",
    "finance-research/risk_state_supported_by_evidence",
    "finance-research/research_run_has_portfolio_state",
    "finance-research/research_run_has_decision",
    "finance-research/decision_for_ticker",
    "finance-research/decision_uses_risk_state",
    "finance-research/decision_uses_signal",
  ],
  emits: [
    emit(
      "analyst.signal.created",
      "schemas/analyst-signal-created.v1.json",
      ["AnalystSignal", "Ticker", "EvidenceDocument"],
    ),
    emit(
      "risk.state.validated",
      "schemas/risk-state-validated.v1.json",
      ["RiskState", "Ticker", "PortfolioState"],
    ),
    emit(
      "portfolio.decision.proposed",
      "schemas/portfolio-decision-proposed.v1.json",
      ["PortfolioDecision", "Ticker"],
    ),
    emit(
      "portfolio.decision.accepted",
      "schemas/portfolio-decision-accepted.v1.json",
      ["PortfolioDecision", "RiskState"],
    ),
    emit(
      "workflow.blocked.stale_state",
      "schemas/workflow-blocked-stale-state.v1.json",
      ["ResearchRun", "RiskState", "PortfolioDecision"],
    ),
  ],
  subscribesTo: [],
  requiredPermissions: ["finance-research.ingest.write"],
  description:
    "Ingests ArrowHedgeLabs research, risk, portfolio, decision, and stale-state events into the finance-research profile for Axis A state-coherence validation. Research/education only; it must not route or produce real trades.",
} as const satisfies Capability;

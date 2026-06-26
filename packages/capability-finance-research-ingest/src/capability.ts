import type { Capability } from "@pm/registry";
import type {
  CapabilityId,
  TerminalAdmissionProviderManifest,
  TerminalAdmissionProviderRef,
} from "@pm/types";

export const FINANCE_RESEARCH_EVENT_TYPES = [
  "analyst.signal.created",
  "risk.state.validated",
  "portfolio.decision.proposed",
  "portfolio.decision.accepted",
  "workflow.blocked.stale_state",
] as const;

export type FinanceResearchEventType = (typeof FINANCE_RESEARCH_EVENT_TYPES)[number];

export const FINANCE_RESEARCH_TERMINAL_ADMISSION_PROVIDER = {
  providerId: "finance-research.arrowhedge.action-outcome-envelope.v1",
  kind: "action_outcome_envelope",
  contractVersion: { major: 1, minor: 0, patch: 0 },
  packageName: "@pm/capability-finance-research-ingest",
  exportName: "buildArrowHedgeActionOutcomeEnvelope",
  profiles: ["finance-research"],
  actionTypes: [
    "portfolio.decision.accept",
    "workflow.block",
    "risk.refresh",
  ],
  evidenceRefKinds: ["source_record", "document"],
  substrateRefKinds: [
    "action_outcome_envelope",
    "state_review_artifact",
    "projection",
  ],
} as const satisfies TerminalAdmissionProviderRef;

export const FINANCE_RESEARCH_TERMINAL_ADMISSION_PROVIDER_MANIFEST = {
  ...FINANCE_RESEARCH_TERMINAL_ADMISSION_PROVIDER,
  availability: "available",
} as const satisfies TerminalAdmissionProviderManifest;

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
      terminalAdmissionProviders: [FINANCE_RESEARCH_TERMINAL_ADMISSION_PROVIDER],
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
    {
      schema: {
        type: "analyst.signal.created",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/analyst-signal-created.v1.json",
      },
      affectsEntities: ["AnalystSignal", "Ticker", "EvidenceDocument"],
    },
    {
      schema: {
        type: "risk.state.validated",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/risk-state-validated.v1.json",
      },
      affectsEntities: ["RiskState", "Ticker", "PortfolioState"],
    },
    {
      schema: {
        type: "portfolio.decision.proposed",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/portfolio-decision-proposed.v1.json",
      },
      affectsEntities: ["PortfolioDecision", "Ticker"],
    },
    {
      schema: {
        type: "portfolio.decision.accepted",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/portfolio-decision-accepted.v1.json",
      },
      affectsEntities: ["PortfolioDecision", "RiskState"],
    },
    {
      schema: {
        type: "workflow.blocked.stale_state",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/workflow-blocked-stale-state.v1.json",
      },
      affectsEntities: ["ResearchRun", "RiskState", "PortfolioDecision"],
    },
  ],
  subscribesTo: [],
  requiredPermissions: ["finance-research.ingest.write"],
  description:
    "Ingests ArrowHedgeLabs research, risk, portfolio, decision, and stale-state events into the finance-research profile for Axis A state-coherence validation. Research/education only; it must not route or produce real trades.",
} as const satisfies Capability;

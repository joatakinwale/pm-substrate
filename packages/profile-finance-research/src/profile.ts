import type { EntityTypeDef, ProfileDefinition } from "@pm/types";

import { EDGE_CATALOG } from "./edges.js";
import {
  BACKTEST_RUN_LIFECYCLE,
  RESEARCH_RUN_LIFECYCLE,
} from "./lifecycles.js";

const ENTITY_TYPES: Readonly<Record<string, EntityTypeDef>> = {
  Ticker: {
    concrete: "Ticker",
    tier1: "Resource",
    requiredFields: ["name", "kind", "symbol", "assetClass", "currency"],
    optionalFields: ["exchange", "externalRef"],
    schemaVersion: 1,
  },
  ResearchRun: {
    concrete: "ResearchRun",
    tier1: "Engagement",
    requiredFields: ["title", "scopeStart", "scopeEnd", "state"],
    optionalFields: ["strategy", "modelLock", "seed"],
    schemaVersion: 1,
  },
  BacktestRun: {
    concrete: "BacktestRun",
    tier1: "Engagement",
    requiredFields: ["title", "scopeStart", "scopeEnd", "state", "datasetRef", "seed"],
    optionalFields: [],
    schemaVersion: 1,
  },
  AnalystSignal: {
    concrete: "AnalystSignal",
    tier1: "Event",
    requiredFields: ["kind", "occurredAt", "agentId", "signal", "confidence"],
    optionalFields: ["evidenceWindowStart", "evidenceWindowEnd", "sourceSnapshotId"],
    schemaVersion: 1,
  },
  RiskState: {
    concrete: "RiskState",
    tier1: "Event",
    requiredFields: [
      "kind",
      "occurredAt",
      "currentPrice",
      "remainingPositionLimit",
      "maxShares",
    ],
    optionalFields: ["volatility", "bindingConstraint", "sourceSnapshotId"],
    schemaVersion: 1,
  },
  PortfolioState: {
    concrete: "PortfolioState",
    tier1: "Resource",
    requiredFields: ["name", "kind", "cash", "equity", "marginRequirement", "marginUsed"],
    optionalFields: ["sourceSnapshotId"],
    schemaVersion: 1,
  },
  PortfolioDecision: {
    concrete: "PortfolioDecision",
    tier1: "Event",
    requiredFields: [
      "kind",
      "occurredAt",
      "action",
      "quantity",
      "confidence",
      "reasoning",
      "accepted",
    ],
    optionalFields: ["rejectionReason"],
    schemaVersion: 1,
  },
  EvidenceDocument: {
    concrete: "EvidenceDocument",
    tier1: "Document",
    requiredFields: ["sha256", "mimeType", "filename"],
    optionalFields: ["sourceUri", "retrievedAt", "freshnessExpiresAt"],
    schemaVersion: 1,
  },
};

export const FINANCE_RESEARCH_PROFILE: ProfileDefinition = {
  name: "finance-research",
  version: 1,
  description:
    "Finance research profile for ArrowHedgeLabs Axis A validation. Models backtest-scoped research runs, analyst signals, risk snapshots, portfolio states, decisions, and evidence documents without introducing real trading primitives.",
  entityTypes: ENTITY_TYPES,
  edgeTypes: EDGE_CATALOG,
  lifecycles: {
    ResearchRun: RESEARCH_RUN_LIFECYCLE,
    BacktestRun: BACKTEST_RUN_LIFECYCLE,
  },
  identityPrimacy: "ResearchRun",
};

import type { BusinessEvent, Document, Engagement, Resource } from "@pm/types";

/**
 * Finance research profile concrete entity types for Axis A.
 *
 * The profile intentionally models research/backtest operational state, not
 * brokerage or production trading state. ArrowHedgeLabs remains a
 * research/education sandbox; no entity here represents a real order route.
 */

export type AssetClass = "equity" | "etf" | "index" | "crypto" | "cash" | "other";

export interface Ticker
  extends Resource {
  readonly identity: Readonly<{
    name: string;
    kind: "ticker";
    symbol: string;
    assetClass: AssetClass;
    exchange: string | null;
    currency: string;
    externalRef?: string | null;
  }>;
}

export type ResearchRunState =
  | "planned"
  | "collecting"
  | "analyzing"
  | "risk_validating"
  | "deciding"
  | "completed"
  | "blocked"
  | "cancelled";

export interface ResearchRun
  extends Engagement {
  readonly identity: Readonly<{
    title: string;
    scopeStart: string | null;
    scopeEnd: string | null;
    state: ResearchRunState;
    strategy: string | null;
    modelLock: string | null;
    seed: string | null;
  }>;
}

export type BacktestRunState =
  | "configured"
  | "running"
  | "analyzing"
  | "completed"
  | "failed"
  | "cancelled";

export interface BacktestRun
  extends Engagement {
  readonly identity: Readonly<{
    title: string;
    scopeStart: string | null;
    scopeEnd: string | null;
    state: BacktestRunState;
    datasetRef: string;
    seed: string;
  }>;
}

export type AnalystSignalValue =
  | "bullish"
  | "bearish"
  | "neutral"
  | "buy"
  | "sell"
  | "hold";

export interface AnalystSignal
  extends BusinessEvent {
  readonly identity: Readonly<{
    kind: "analyst_signal";
    occurredAt: string;
    agentId: string;
    signal: AnalystSignalValue;
    confidence: number;
    evidenceWindowStart: string | null;
    evidenceWindowEnd: string | null;
    sourceSnapshotId: string | null;
  }>;
}

export interface RiskState
  extends BusinessEvent {
  readonly identity: Readonly<{
    kind: "risk_state";
    occurredAt: string;
    currentPrice: number;
    remainingPositionLimit: number;
    maxShares: number;
    volatility: number | null;
    bindingConstraint: string | null;
    sourceSnapshotId: string | null;
  }>;
}

export interface PortfolioState
  extends Resource {
  readonly identity: Readonly<{
    name: string;
    kind: "portfolio_state";
    cash: number;
    equity: number;
    marginRequirement: number;
    marginUsed: number;
    sourceSnapshotId: string | null;
  }>;
}

export type PortfolioDecisionAction = "buy" | "sell" | "short" | "cover" | "hold";

export interface PortfolioDecision
  extends BusinessEvent {
  readonly identity: Readonly<{
    kind: "portfolio_decision";
    occurredAt: string;
    action: PortfolioDecisionAction;
    quantity: number;
    confidence: number;
    reasoning: string;
    accepted: boolean;
    rejectionReason: string | null;
  }>;
}

export interface EvidenceDocument
  extends Document {
  readonly identity: Readonly<{
    sha256: string;
    mimeType: string;
    filename: string;
    sourceUri: string | null;
    retrievedAt: string | null;
    freshnessExpiresAt: string | null;
  }>;
}

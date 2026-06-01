import { describe, expect, it } from "vitest";

import type {
  BusinessEvent,
  Document,
  Engagement,
  ProfileEntity,
  Resource,
} from "@pm/types";

import type {
  AnalystSignal,
  BacktestRun,
  EvidenceDocument,
  PortfolioDecision,
  PortfolioState,
  ResearchRun,
  RiskState,
  Ticker,
} from "./entities.js";
import { EDGE_CATALOG } from "./edges.js";
import {
  BACKTEST_RUN_LIFECYCLE,
  RESEARCH_RUN_LIFECYCLE,
} from "./lifecycles.js";
import { FINANCE_RESEARCH_PROFILE } from "./profile.js";

type Assert<T extends true> = T;
type IsAssignable<A, B> = A extends B ? true : false;

type _Ticker_isResource = Assert<IsAssignable<Ticker, Resource>>;
type _PortfolioState_isResource = Assert<IsAssignable<PortfolioState, Resource>>;
type _ResearchRun_isEngagement = Assert<IsAssignable<ResearchRun, Engagement>>;
type _BacktestRun_isEngagement = Assert<IsAssignable<BacktestRun, Engagement>>;
type _AnalystSignal_isBusinessEvent = Assert<IsAssignable<AnalystSignal, BusinessEvent>>;
type _RiskState_isBusinessEvent = Assert<IsAssignable<RiskState, BusinessEvent>>;
type _PortfolioDecision_isBusinessEvent = Assert<
  IsAssignable<PortfolioDecision, BusinessEvent>
>;
type _EvidenceDocument_isDocument = Assert<IsAssignable<EvidenceDocument, Document>>;
type _ResearchRun_isProfileEntity = Assert<
  IsAssignable<ResearchRun, ProfileEntity<Record<string, unknown>>>
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Refs =
  | _Ticker_isResource
  | _PortfolioState_isResource
  | _ResearchRun_isEngagement
  | _BacktestRun_isEngagement
  | _AnalystSignal_isBusinessEvent
  | _RiskState_isBusinessEvent
  | _PortfolioDecision_isBusinessEvent
  | _EvidenceDocument_isDocument
  | _ResearchRun_isProfileEntity;

describe("FINANCE_RESEARCH_PROFILE definition self-consistency", () => {
  it("declares the Axis A concrete entity set", () => {
    expect(Object.keys(FINANCE_RESEARCH_PROFILE.entityTypes).sort()).toEqual([
      "AnalystSignal",
      "BacktestRun",
      "EvidenceDocument",
      "PortfolioDecision",
      "PortfolioState",
      "ResearchRun",
      "RiskState",
      "Ticker",
    ]);
  });

  it("uses ResearchRun as the identity spine", () => {
    expect(FINANCE_RESEARCH_PROFILE.identityPrimacy).toBe("ResearchRun");
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["ResearchRun"]).toBeDefined();
  });

  it("maps concrete entities to stable Tier-1 primitives", () => {
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["Ticker"]?.tier1).toBe("Resource");
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["ResearchRun"]?.tier1).toBe("Engagement");
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["BacktestRun"]?.tier1).toBe("Engagement");
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["AnalystSignal"]?.tier1).toBe("Event");
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["RiskState"]?.tier1).toBe("Event");
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["PortfolioDecision"]?.tier1).toBe("Event");
    expect(FINANCE_RESEARCH_PROFILE.entityTypes["EvidenceDocument"]?.tier1).toBe("Document");
  });

  it("keeps required and optional fields disjoint", () => {
    for (const [name, def] of Object.entries(FINANCE_RESEARCH_PROFILE.entityTypes)) {
      const required = new Set(def.requiredFields);
      for (const optional of def.optionalFields) {
        expect(
          required.has(optional),
          `${name}: field "${optional}" is both required and optional`,
        ).toBe(false);
      }
    }
  });

  it("declares edges that only reference known concrete entity types", () => {
    const concrete = new Set(Object.keys(FINANCE_RESEARCH_PROFILE.entityTypes));
    for (const [name, edge] of Object.entries(EDGE_CATALOG)) {
      for (const fromType of edge.fromTypes) {
        expect(concrete.has(fromType), `${name}: unknown fromType ${fromType}`).toBe(true);
      }
      for (const toType of edge.toTypes) {
        expect(concrete.has(toType), `${name}: unknown toType ${toType}`).toBe(true);
      }
    }
  });

  it("declares replay-relevant research and backtest lifecycles", () => {
    expect(RESEARCH_RUN_LIFECYCLE.initial).toBe("planned");
    expect(RESEARCH_RUN_LIFECYCLE.terminal).toEqual(["completed", "blocked", "cancelled"]);
    expect(BACKTEST_RUN_LIFECYCLE.initial).toBe("configured");
    expect(BACKTEST_RUN_LIFECYCLE.terminal).toEqual(["completed", "failed", "cancelled"]);
  });
});

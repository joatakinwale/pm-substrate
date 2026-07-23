import { describe, expect, it } from "vitest";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import {
  toEdgeCardinality,
  validateEntityMappingAgainstProfile,
} from "./semantic.js";

const financeMapping = {
  profile: "finance-research",
  mappingVersion: 1 as const,
  entities: {
    ResearchRunSource: {
      tier1: "Engagement",
      concrete: "ResearchRun",
      identityFields: ["title", "scopeStart", "scopeEnd", "state"],
      optionalFields: ["strategy", "modelLock", "seed"],
      schemaVersion: 1,
      edges: {
        signal: {
          target: "AnalystSignalSource",
          type: "finance-research/research_run_has_signal",
          cardinality: "many",
        },
        decision: {
          target: "PortfolioDecisionSource",
          type: "finance-research/research_run_has_decision",
          cardinality: "many",
        },
      },
    },
    TickerSource: {
      tier1: "Resource",
      concrete: "Ticker",
      identityFields: ["name", "kind", "symbol", "assetClass", "currency"],
      optionalFields: ["exchange", "externalRef"],
      schemaVersion: 1,
    },
    AnalystSignalSource: {
      tier1: "Event",
      concrete: "AnalystSignal",
      identityFields: ["kind", "occurredAt", "agentId", "signal", "confidence"],
      optionalFields: ["evidenceWindowStart", "evidenceWindowEnd", "sourceSnapshotId"],
      schemaVersion: 1,
      edges: {
        ticker: {
          target: "TickerSource",
          type: "finance-research/signal_for_ticker",
          cardinality: "exactly_one",
        },
        evidence: {
          target: "EvidenceDocumentSource",
          type: "finance-research/signal_supported_by_evidence",
          cardinality: "many",
        },
      },
    },
    EvidenceDocumentSource: {
      tier1: "Document",
      concrete: "EvidenceDocument",
      identityFields: ["sha256", "mimeType", "filename"],
      optionalFields: ["sourceUri", "retrievedAt", "freshnessExpiresAt"],
      schemaVersion: 1,
    },
    PortfolioDecisionSource: {
      tier1: "Event",
      concrete: "PortfolioDecision",
      identityFields: [
        "kind",
        "occurredAt",
        "action",
        "quantity",
        "confidence",
        "reasoning",
        "accepted",
      ],
      schemaVersion: 1,
      edges: {
        riskState: {
          target: "RiskStateSource",
          type: "finance-research/decision_uses_risk_state",
          cardinality: "zero_or_one",
        },
      },
    },
    RiskStateSource: {
      tier1: "Event",
      concrete: "RiskState",
      identityFields: [
        "kind",
        "occurredAt",
        "currentPrice",
        "remainingPositionLimit",
        "maxShares",
      ],
      optionalFields: ["volatility", "bindingConstraint", "sourceSnapshotId"],
      schemaVersion: 1,
    },
  },
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("validateEntityMappingAgainstProfile (G11 phase 2)", () => {
  it("accepts a structurally valid mapping that resolves against FINANCE_RESEARCH_PROFILE", () => {
    const r = validateEntityMappingAgainstProfile(financeMapping, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("returns structural issues without cascading semantic noise", () => {
    const m = clone(financeMapping);
    // @ts-expect-error testing invalid shape
    m.entities.ResearchRunSource.tier1 = "Patient";
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/ResearchRunSource/tier1")).toBe(true);
  });

  it("rejects profile name mismatch", () => {
    const m = clone(financeMapping);
    m.profile = "agency";
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/profile")).toBe(true);
  });

  it("rejects raw Tier-1 mappings when profile semantic validation is requested", () => {
    const m = clone(financeMapping);
    m.profile = null;
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.message.includes("raw Tier-1"))).toBe(true);
  });

  it("rejects concrete entity types not declared by the profile", () => {
    const m = clone(financeMapping);
    (m.entities as Record<string, unknown>)["MadeUp"] = {
      tier1: "Resource",
      concrete: "MadeUp",
      identityFields: ["name"],
      schemaVersion: 1,
    };
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/MadeUp/concrete")).toBe(true);
  });

  it("rejects Tier-1 mismatch with profile entity definition", () => {
    const m = clone(financeMapping);
    m.entities.TickerSource.tier1 = "Document";
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/TickerSource/tier1")).toBe(true);
  });

  it("rejects schemaVersion mismatch with profile entity definition", () => {
    const m = clone(financeMapping);
    m.entities.TickerSource.schemaVersion = 2;
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/TickerSource/schemaVersion")).toBe(true);
  });

  it("rejects mappings that omit profile-required identity fields", () => {
    const m = clone(financeMapping);
    m.entities.AnalystSignalSource.identityFields = [
      "kind",
      "agentId",
      "signal",
      "confidence",
    ];
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find(
      (i) => i.path === "/entities/AnalystSignalSource/identityFields",
    );
    expect(issue?.message).toContain("occurredAt");
  });

  it("rejects edge type prefix mismatch", () => {
    const m = clone(financeMapping);
    m.entities.AnalystSignalSource.edges!.ticker.type = "agency/signal_for_ticker";
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path.endsWith("/type"))).toBe(true);
  });

  it("rejects edge types not declared by the profile", () => {
    const m = clone(financeMapping);
    m.entities.AnalystSignalSource.edges!.ticker.type = "finance-research/invented_edge";
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find(
      (i) => i.path === "/entities/AnalystSignalSource/edges/ticker/type",
    );
    expect(issue?.message).toContain("not declared");
  });

  it("rejects edge from/to endpoint mismatches", () => {
    const m = clone(financeMapping);
    m.entities.AnalystSignalSource.edges!.ticker.target = "EvidenceDocumentSource";
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find(
      (i) => i.path === "/entities/AnalystSignalSource/edges/ticker/target",
    );
    expect(issue?.message).toContain("declared to-types");
  });

  it("rejects edge cardinality mismatch with the profile fromCardinality", () => {
    const m = clone(financeMapping);
    m.entities.PortfolioDecisionSource.edges!.riskState.cardinality = "many";
    const r = validateEntityMappingAgainstProfile(m, FINANCE_RESEARCH_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find(
      (i) => i.path === "/entities/PortfolioDecisionSource/edges/riskState/cardinality",
    );
    expect(issue?.message).toContain("zero_or_one");
  });

  it("maps profile CardinalityConstraint to mapping EdgeCardinality", () => {
    expect(toEdgeCardinality("unbounded")).toBe("many");
    expect(toEdgeCardinality("exactly:1")).toBe("exactly_one");
    expect(toEdgeCardinality("exactly:2")).toBe("exactly_two");
    expect(toEdgeCardinality("at-most:1")).toBe("zero_or_one");
    expect(toEdgeCardinality("at-least:1")).toBe("one_or_more");
    expect(() => toEdgeCardinality("at-most:3")).toThrow(/unsupported/);
  });
});

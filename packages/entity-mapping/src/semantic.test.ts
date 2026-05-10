import { describe, expect, it } from "vitest";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import {
  toEdgeCardinality,
  validateEntityMappingAgainstProfile,
} from "./semantic.js";

const weddingMapping = {
  profile: "wedding",
  mappingVersion: 1 as const,
  entities: {
    Wedding: {
      tier1: "Engagement",
      concrete: "Wedding",
      identityFields: ["title", "eventDate", "venue", "operationalState"],
      optionalFields: ["scopeStart", "scopeEnd"],
      schemaVersion: 1,
      edges: {
        principals: {
          target: "Couple",
          type: "wedding/has_principal",
          cardinality: "exactly_two",
        },
        guests: {
          target: "Guest",
          type: "wedding/has_guest",
          cardinality: "many",
        },
      },
    },
    Couple: {
      tier1: "Counterparty",
      concrete: "Couple",
      identityFields: ["name"],
      optionalFields: ["email", "phone", "externalRef", "side"],
      schemaVersion: 1,
    },
    Guest: {
      tier1: "Counterparty",
      concrete: "Guest",
      identityFields: ["name", "rsvpState"],
      optionalFields: ["email", "phone", "externalRef"],
      schemaVersion: 1,
    },
    Vendor: {
      tier1: "Counterparty",
      concrete: "Vendor",
      identityFields: ["name", "category"],
      schemaVersion: 1,
      edges: {
        budgetCategory: {
          target: "BudgetCategory",
          type: "wedding/vendor_budget_category",
          cardinality: "zero_or_one",
        },
      },
    },
    BudgetCategory: {
      tier1: "Resource",
      concrete: "BudgetCategory",
      identityFields: ["name", "kind", "allocatedMinor", "currency", "actualSpentMinor"],
      schemaVersion: 1,
    },
  },
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("validateEntityMappingAgainstProfile (G11 phase 2)", () => {
  it("accepts a structurally valid mapping that resolves against WEDDING_PROFILE", () => {
    const r = validateEntityMappingAgainstProfile(weddingMapping, WEDDING_PROFILE);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("returns structural issues without cascading semantic noise", () => {
    const m = clone(weddingMapping);
    // @ts-expect-error testing invalid shape
    m.entities.Wedding.tier1 = "Patient";
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/Wedding/tier1")).toBe(true);
  });

  it("rejects profile name mismatch", () => {
    const m = clone(weddingMapping);
    m.profile = "agency";
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/profile")).toBe(true);
  });

  it("rejects raw Tier-1 mappings when profile semantic validation is requested", () => {
    const m = clone(weddingMapping);
    m.profile = null;
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.message.includes("raw Tier-1"))).toBe(true);
  });

  it("rejects concrete entity types not declared by the profile", () => {
    const m = clone(weddingMapping);
    (m.entities as Record<string, unknown>)["MadeUp"] = {
      tier1: "Resource",
      concrete: "MadeUp",
      identityFields: ["name"],
      schemaVersion: 1,
    };
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/MadeUp/concrete")).toBe(true);
  });

  it("rejects Tier-1 mismatch with profile entity definition", () => {
    const m = clone(weddingMapping);
    m.entities.Vendor.tier1 = "Resource";
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/Vendor/tier1")).toBe(true);
  });

  it("rejects schemaVersion mismatch with profile entity definition", () => {
    const m = clone(weddingMapping);
    m.entities.Vendor.schemaVersion = 2;
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/Vendor/schemaVersion")).toBe(true);
  });

  it("rejects mappings that omit profile-required identity fields", () => {
    const m = clone(weddingMapping);
    m.entities.Wedding.identityFields = ["title", "venue", "operationalState"];
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find((i) => i.path === "/entities/Wedding/identityFields");
    expect(issue?.message).toContain("eventDate");
  });

  it("rejects edge type prefix mismatch", () => {
    const m = clone(weddingMapping);
    m.entities.Wedding.edges!.guests.type = "agency/has_guest";
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path.endsWith("/type"))).toBe(true);
  });

  it("rejects edge types not declared by the profile", () => {
    const m = clone(weddingMapping);
    m.entities.Wedding.edges!.guests.type = "wedding/invented_edge";
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find((i) => i.path === "/entities/Wedding/edges/guests/type");
    expect(issue?.message).toContain("not declared");
  });

  it("rejects edge from/to endpoint mismatches", () => {
    const m = clone(weddingMapping);
    m.entities.Vendor.edges!.budgetCategory.target = "Guest";
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find((i) => i.path === "/entities/Vendor/edges/budgetCategory/target");
    expect(issue?.message).toContain("declared to-types");
  });

  it("rejects edge cardinality mismatch with the profile fromCardinality", () => {
    const m = clone(weddingMapping);
    m.entities.Wedding.edges!.principals.cardinality = "many";
    const r = validateEntityMappingAgainstProfile(m, WEDDING_PROFILE);
    expect(r.valid).toBe(false);
    const issue = r.issues.find((i) => i.path === "/entities/Wedding/edges/principals/cardinality");
    expect(issue?.message).toContain("exactly_two");
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

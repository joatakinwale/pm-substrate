/**
 * Tests for the structural entity-mapping validator (G11 phase 1).
 *
 * No DB. No profile lookups. Pure-function exercising of the schema.
 */

import { describe, expect, it } from "vitest";
import { validateEntityMapping } from "./validate.js";

/** A complete, valid Stevie-shaped agency mapping fragment used as the
 *  golden fixture; tests mutate copies of it to assert specific failures. */
const goldenAgency = {
  profile: "agency",
  mappingVersion: 1 as const,
  description: "Stevie marketing platform — agency profile mapping",
  entities: {
    Organization: {
      tier1: "Counterparty",
      concrete: "Organization",
      identityFields: ["name", "slug", "planTier"],
      optionalFields: ["logoUrl", "brandColor"],
      schemaVersion: 1,
      sourceRef: "Stevie::Organization",
    },
    User: {
      tier1: "Counterparty",
      concrete: "User",
      identityFields: ["email", "displayName"],
      optionalFields: ["phone", "timezone"],
      schemaVersion: 1,
      sourceRef: "Stevie::User",
    },
    Lead: {
      tier1: "Counterparty",
      concrete: "Lead",
      identityFields: ["email", "name", "source"],
      optionalFields: ["phone", "notes"],
      schemaVersion: 1,
      edges: {
        assignedTo: {
          target: "User",
          type: "agency/lead_assigned_to_user",
          cardinality: "zero_or_one",
          sourceRef: "Lead.assigned_user",
          description: "Sales rep responsible for this lead",
        },
      },
      sourceRef: "Stevie::Lead",
    },
    LeadScoringConfig: {
      tier1: "Resource",
      concrete: "LeadScoringConfig",
      identityFields: ["name", "scoringRubric"],
      schemaVersion: 1,
    },
  },
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("validateEntityMapping (G11 phase 1)", () => {
  it("accepts the golden agency mapping", () => {
    const r = validateEntityMapping(goldenAgency);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("rejects non-object input loudly", () => {
    expect(validateEntityMapping(42).valid).toBe(false);
    expect(validateEntityMapping(null).valid).toBe(false);
    expect(validateEntityMapping([1, 2]).valid).toBe(false);
    expect(validateEntityMapping("a string").valid).toBe(false);
  });

  it("rejects unknown mappingVersion", () => {
    const m = clone(goldenAgency);
    (m as Record<string, unknown>)["mappingVersion"] = 2;
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/mappingVersion")).toBe(true);
  });

  it("rejects empty profile string (use null for raw Tier-1)", () => {
    const m = clone(goldenAgency);
    (m as Record<string, unknown>)["profile"] = "";
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/profile")).toBe(true);
  });

  it("accepts null profile (raw Tier-1)", () => {
    const m: unknown = {
      profile: null,
      mappingVersion: 1,
      entities: {
        Customer: {
          tier1: "Counterparty",
          concrete: "Customer",
          identityFields: ["email"],
          schemaVersion: 1,
        },
      },
    };
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(true);
  });

  it("rejects entities that aren't an object", () => {
    const m: unknown = { profile: "agency", mappingVersion: 1, entities: [] };
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities")).toBe(true);
  });

  it("rejects empty entities map", () => {
    const m: unknown = { profile: "agency", mappingVersion: 1, entities: {} };
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities")).toBe(true);
  });

  it("rejects unknown Tier-1 type", () => {
    const m = clone(goldenAgency);
    // @ts-expect-error — testing rejection
    m.entities.Lead.tier1 = "Patient";
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path === "/entities/Lead/tier1")).toBe(true);
  });

  it("accepts source-app keys that differ from profile concrete type names", () => {
    const m = clone(goldenAgency);
    m.entities.Organization.concrete = "ClientOrg";
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("rejects empty identityFields", () => {
    const m = clone(goldenAgency);
    m.entities.Lead.identityFields = [];
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    expect(
      r.issues.some((i) => i.path === "/entities/Lead/identityFields"),
    ).toBe(true);
  });

  it("accepts empty identityFields when fieldMap supplies profile identity aliases", () => {
    const m = clone(goldenAgency);
    m.entities.Lead.identityFields = [];
    // @ts-expect-error fixture mutation for new optional property
    m.entities.Lead.fieldMap = { name: "full_name" };
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("rejects duplicate identityFields", () => {
    const m = clone(goldenAgency);
    m.entities.Lead.identityFields = ["email", "email"];
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    const i = r.issues.find((x) => x.path === "/entities/Lead/identityFields");
    expect(i?.message).toMatch(/duplicate/);
  });

  it("rejects optionalFields that overlap identityFields", () => {
    const m = clone(goldenAgency);
    m.entities.Lead.optionalFields = ["phone", "email"]; // email is required
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    const i = r.issues.find((x) => x.path === "/entities/Lead/optionalFields");
    expect(i?.message).toMatch(/disjoint/);
  });

  it("rejects schemaVersion < 1 or non-integer", () => {
    const m1 = clone(goldenAgency);
    m1.entities.Lead.schemaVersion = 0;
    expect(validateEntityMapping(m1).valid).toBe(false);

    const m2 = clone(goldenAgency);
    // @ts-expect-error — testing rejection
    m2.entities.Lead.schemaVersion = 1.5;
    expect(validateEntityMapping(m2).valid).toBe(false);
  });

  it("rejects edge target that doesn't reference another mapped entity", () => {
    const m = clone(goldenAgency);
    m.entities.Lead.edges!.assignedTo.target = "DanglingType";
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    const i = r.issues.find(
      (x) => x.path === "/entities/Lead/edges/assignedTo/target",
    );
    expect(i?.message).toMatch(/not declared in entities/);
  });

  it("rejects edge type not matching <profile>/<snake_case> shape", () => {
    const m = clone(goldenAgency);
    // CamelCase + missing slash
    m.entities.Lead.edges!.assignedTo.type = "AgencyLeadAssignedToUser";
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    const i = r.issues.find(
      (x) => x.path === "/entities/Lead/edges/assignedTo/type",
    );
    expect(i?.message).toMatch(/<profile>/);
  });

  it("rejects unknown edge cardinality", () => {
    const m = clone(goldenAgency);
    // @ts-expect-error — testing rejection
    m.entities.Lead.edges!.assignedTo.cardinality = "exactly_three";
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    const i = r.issues.find(
      (x) => x.path === "/entities/Lead/edges/assignedTo/cardinality",
    );
    expect(i?.message).toMatch(/expected one of/);
  });

  it("collects multiple issues in a single pass (validator never short-circuits on user data)", () => {
    const m = clone(goldenAgency);
    // @ts-expect-error
    m.entities.Lead.tier1 = "Patient";
    m.entities.Lead.identityFields = [];
    m.entities.Lead.edges!.assignedTo.target = "Nonexistent";
    const r = validateEntityMapping(m);
    expect(r.valid).toBe(false);
    expect(r.issues.length).toBeGreaterThanOrEqual(3);
  });
});

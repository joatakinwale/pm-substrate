/**
 * Pure-function tests for the ingestion adapter (G11 phase 3).
 *
 * No DB. Structural assignability against `@pm/graph` is proven by
 * `apply.integration.test.ts` in `packages/profile-agency`.
 */

import { describe, expect, it } from "vitest";
import {
  applyEdgeMapping,
  applyMapping,
  EntityMappingApplyError,
} from "./apply.js";
import type { EntityMapping } from "./schema.js";

const tenantId = "tnt_test" as const;

const agencyFixture: EntityMapping = {
  profile: "agency",
  mappingVersion: 1,
  entities: {
    Lead: {
      tier1: "Counterparty",
      concrete: "Lead",
      identityFields: ["email", "phone", "source"],
      fieldMap: {
        name: "full_name",
        qualificationStatus: "qualification_status",
        externalRef: "id",
      },
      schemaVersion: 1,
      sourceRef: "backend.app.models.lead.Lead",
      edges: {
        assignedTo: {
          target: "AgencyUser",
          type: "agency/lead_assigned_to_user",
          cardinality: "zero_or_one",
        },
      },
    },
    AgencyUser: {
      tier1: "Resource",
      concrete: "AgencyUser",
      identityFields: ["email", "role"],
      fieldMap: { name: "full_name" },
      schemaVersion: 1,
    },
    Organization: {
      tier1: "Counterparty",
      concrete: "ClientOrg",
      identityFields: ["name"],
      fieldMap: { externalRef: "id" },
      optionalFields: ["domain"],
      schemaVersion: 1,
    },
  },
};

describe("applyMapping (G11 phase 3)", () => {
  it("constructs a node input with raw identityFields", () => {
    const input = applyMapping(
      agencyFixture,
      "Organization",
      { name: "Acme Co", id: "org_42", domain: "acme.com" },
      { tenantId },
    );

    expect(input).toEqual({
      tenantId: "tnt_test",
      profile: { tier1: "Counterparty", profile: "agency", concrete: "ClientOrg" },
      identity: { name: "Acme Co", externalRef: "org_42" },
      schemaVersion: 1,
    });
  });

  it("resolves fieldMap aliases (source col → profile field) and identityFields together", () => {
    const input = applyMapping(
      agencyFixture,
      "Lead",
      {
        id: "ld_1",
        full_name: "Jane Doe",
        email: "jane@example.com",
        phone: "+15551234",
        source: "inbound_form",
        qualification_status: "qualified",
      },
      { tenantId },
    );

    expect(input.identity).toEqual({
      email: "jane@example.com",
      phone: "+15551234",
      source: "inbound_form",
      name: "Jane Doe",
      qualificationStatus: "qualified",
      externalRef: "ld_1",
    });
    expect(input.profile).toEqual({ tier1: "Counterparty", profile: "agency", concrete: "Lead" });
    expect(input.schemaVersion).toBe(1);
  });

  it("omits identity fields that are absent from the source row but preserves nulls", () => {
    const input = applyMapping(
      agencyFixture,
      "Lead",
      {
        email: "j@x.com",
        // phone deliberately absent
        source: null, // null must pass through
        id: "ld_2",
        full_name: null, // null on a fieldMap'd field must pass through too
      },
      { tenantId },
    );

    expect(input.identity).toEqual({
      email: "j@x.com",
      source: null,
      externalRef: "ld_2",
      name: null,
    });
    expect("phone" in input.identity).toBe(false);
  });

  it("passes a caller-supplied id when provided", () => {
    const input = applyMapping(
      agencyFixture,
      "Organization",
      { name: "Acme", id: "org_x" },
      { tenantId, id: "00000000-0000-4000-8000-000000000001" },
    );
    expect(input.id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("does not emit an id key when ctx.id is omitted", () => {
    const input = applyMapping(
      agencyFixture,
      "Organization",
      { name: "Acme" },
      { tenantId },
    );
    expect("id" in input).toBe(false);
  });

  it("throws when the requested sourceName is not in the mapping", () => {
    expect(() =>
      applyMapping(agencyFixture, "Unknown", {}, { tenantId }),
    ).toThrow(EntityMappingApplyError);
  });

  it("preserves the raw-Tier-1 profile when mapping.profile is null", () => {
    const rawMap: EntityMapping = {
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
    const input = applyMapping(
      rawMap,
      "Customer",
      { email: "a@b.com" },
      { tenantId },
    );
    expect(input.profile).toEqual({ tier1: "Counterparty", profile: null, concrete: "Customer" });
  });
});

describe("applyEdgeMapping (G11 phase 3)", () => {
  it("constructs an edge input from a declared edge", () => {
    const edge = applyEdgeMapping(
      agencyFixture,
      "Lead",
      "assignedTo",
      { fromId: "ent_lead", toId: "ent_user" },
      { tenantId },
    );
    expect(edge).toEqual({
      tenantId: "tnt_test",
      type: "agency/lead_assigned_to_user",
      fromId: "ent_lead",
      toId: "ent_user",
      attrs: {},
    });
  });

  it("passes through caller-supplied attrs", () => {
    const edge = applyEdgeMapping(
      agencyFixture,
      "Lead",
      "assignedTo",
      { fromId: "ent_lead", toId: "ent_user" },
      { tenantId, attrs: { assignedAt: "2026-05-11T10:00:00Z" } },
    );
    expect(edge.attrs).toEqual({ assignedAt: "2026-05-11T10:00:00Z" });
  });

  it("throws when sourceName is missing", () => {
    expect(() =>
      applyEdgeMapping(
        agencyFixture,
        "Unknown",
        "assignedTo",
        { fromId: "a", toId: "b" },
        { tenantId },
      ),
    ).toThrow(EntityMappingApplyError);
  });

  it("throws when edge key is not declared on the source entity", () => {
    expect(() =>
      applyEdgeMapping(
        agencyFixture,
        "Lead",
        "nonexistentEdge",
        { fromId: "a", toId: "b" },
        { tenantId },
      ),
    ).toThrow(EntityMappingApplyError);
  });
});

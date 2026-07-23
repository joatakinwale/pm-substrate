import { describe, expect, it } from "vitest";
import { AGENCY_PROFILE } from "@pm/profile-agency";
import { entityId, tenantId, timestamp, type EntityId } from "@pm/types";

import {
  ADAPTER_ENTITY_MAPPED_EVENT_TYPE,
  ADAPTER_ENTITY_MAPPED_PAYLOAD_SCHEMA,
  planEntityIngestion,
  type EntityMapping,
} from "./index.js";

const agencyMapping: EntityMapping = {
  profile: "agency",
  mappingVersion: 1,
  entities: {
    Organization: {
      tier1: "Counterparty",
      concrete: "ClientOrg",
      identityFields: ["name"],
      fieldMap: { externalRef: "id" },
      schemaVersion: 1,
    },
    Project: {
      tier1: "Engagement",
      concrete: "Project",
      identityFields: [],
      fieldMap: {
        title: "name",
        projectType: "project_type",
        operationalState: "status",
      },
      schemaVersion: 1,
    },
  },
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("planEntityIngestion", () => {
  it("plans graph-ready nodes and typed adapter events after semantic validation", () => {
    const tenant = tenantId("tnt_adapter_plan");
    const occurredAt = timestamp("2026-06-03T15:00:00.000Z");
    const id = entityId("00000000-0000-4000-8000-000000000101");

    const plan = planEntityIngestion(agencyMapping, AGENCY_PROFILE, [
      {
        sourceName: "Organization",
        sourceRecordId: "org_acme",
        id,
        observedAt: occurredAt,
        row: { id: "org_acme", name: "Acme Co", website: "https://acme.example" },
      },
    ], {
      tenantId: tenant,
      emittedBy: "adapter:stevie-agency",
      authority: "mapping:agency:v1",
    });

    expect(plan.valid).toBe(true);
    expect(plan.issues).toEqual([]);
    expect(plan.items).toHaveLength(1);

    const item = plan.items[0]!;
    expect(item.sourceName).toBe("Organization");
    expect(item.sourceRecordId).toBe("org_acme");
    expect(item.node).toEqual({
      tenantId: tenant,
      id,
      profile: {
        tier1: "Counterparty",
        profile: "agency",
        concrete: "ClientOrg",
      },
      identity: {
        name: "Acme Co",
        externalRef: "org_acme",
      },
      schemaVersion: 1,
    });
    expect(item.event).toEqual({
      tenantId: tenant,
      type: ADAPTER_ENTITY_MAPPED_EVENT_TYPE,
      entityId: id,
      emittedBy: "adapter:stevie-agency",
      authority: "mapping:agency:v1",
      payloadSchema: ADAPTER_ENTITY_MAPPED_PAYLOAD_SCHEMA,
      occurredAt,
      payload: {
        mappingProfile: "agency",
        mappingVersion: 1,
        sourceName: "Organization",
        sourceRecordId: "org_acme",
        concrete: "ClientOrg",
        tier1: "Counterparty",
        schemaVersion: 1,
        identityKeys: ["externalRef", "name"],
        identity: {
          name: "Acme Co",
          externalRef: "org_acme",
        },
      },
    });
  });

  it("returns validation issues and no planned writes when the mapping misses the profile contract", () => {
    const mapping = clone(agencyMapping);
    mapping.entities.Project.fieldMap = {
      title: "name",
      projectType: "project_type",
    };

    const plan = planEntityIngestion(mapping, AGENCY_PROFILE, [
      {
        sourceName: "Project",
        id: entityId("00000000-0000-4000-8000-000000000202"),
        row: { name: "Brand refresh", project_type: "branding", status: "kickoff" },
      },
    ], {
      tenantId: tenantId("tnt_adapter_bad_mapping"),
      emittedBy: "adapter:stevie-agency",
    });

    expect(plan.valid).toBe(false);
    expect(plan.items).toEqual([]);
    expect(plan.issues).toContainEqual({
      path: "/entities/Project/identityFields",
      message: 'missing profile-required identity field "operationalState"',
    });
  });

  it("uses idForRecord to make source rows deterministic before graph writes", () => {
    const ids: EntityId[] = [
      entityId("00000000-0000-4000-8000-000000000301"),
      entityId("00000000-0000-4000-8000-000000000302"),
    ];

    const plan = planEntityIngestion(agencyMapping, AGENCY_PROFILE, [
      {
        sourceName: "Project",
        sourceRecordId: "project_brand",
        row: { name: "Brand refresh", project_type: "branding", status: "kickoff" },
      },
      {
        sourceName: "Project",
        sourceRecordId: "project_social",
        row: { name: "Social launch", project_type: "social", status: "active" },
      },
    ], {
      tenantId: tenantId("tnt_adapter_id_gen"),
      emittedBy: "adapter:stevie-agency",
      idForRecord: (_record, index) => ids[index]!,
    });

    expect(plan.valid).toBe(true);
    expect(plan.items.map((item) => item.node.id)).toEqual(ids);
    expect(plan.items.map((item) => item.event.entityId)).toEqual(ids);
  });

  it("rejects records that do not provide deterministic entity IDs", () => {
    const plan = planEntityIngestion(agencyMapping, AGENCY_PROFILE, [
      {
        sourceName: "Organization",
        sourceRecordId: "org_without_id",
        row: { id: "org_without_id", name: "No ID LLC" },
      },
    ], {
      tenantId: tenantId("tnt_adapter_missing_id"),
      emittedBy: "adapter:stevie-agency",
    });

    expect(plan.valid).toBe(false);
    expect(plan.items).toEqual([]);
    expect(plan.issues).toContainEqual({
      path: "/records/0/id",
      message: "expected deterministic entity id from record.id or idForRecord",
    });
  });
});

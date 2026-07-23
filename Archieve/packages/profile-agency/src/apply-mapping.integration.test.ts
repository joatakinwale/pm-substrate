/**
 * G11 phase 3 integration test: drive a real Postgres graph write through
 * `applyMapping` + `applyEdgeMapping` against AGENCY_PROFILE.
 *
 * Lives in profile-agency, not entity-mapping, so the substrate-side
 * packages (graph, profile-registry) stay out of entity-mapping's
 * dependency closure. The mapping adapter's output is *structurally*
 * assignable to `@pm/graph` inputs; this test proves it at runtime,
 * end-to-end with profile validation enforced.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  applyEdgeMapping,
  applyMapping,
  type EntityMapping,
} from "@pm/entity-mapping";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import type { TenantId } from "@pm/types";

import { AGENCY_PROFILE } from "./profile.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const stevieAgencyMapping: EntityMapping = {
  profile: "agency",
  mappingVersion: 1,
  entities: {
    Organization: {
      tier1: "Counterparty",
      concrete: "ClientOrg",
      identityFields: ["name"],
      fieldMap: { externalRef: "id" },
      schemaVersion: 1,
      edges: {
        projects: {
          target: "Project",
          type: "agency/client_has_project",
          cardinality: "many",
        },
      },
    },
    Lead: {
      tier1: "Counterparty",
      concrete: "Lead",
      identityFields: ["email", "phone", "source", "qualificationStatus"],
      fieldMap: { name: "full_name", externalRef: "id" },
      schemaVersion: 1,
    },
    Project: {
      tier1: "Engagement",
      concrete: "Project",
      // No raw identityFields — every Project field comes via fieldMap
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

describeIfDb("G11 phase 3 — applyMapping drives a real graph write", () => {
  let pool: pg.Pool;
  let profileRegistry: PostgresProfileRegistry;
  let graph: PostgresGraph;
  const tenants: TenantId[] = [];

  const makeTenant = async (suffix: string): Promise<TenantId> => {
    const id = `tnt_g11p3_${suffix}_${randomUUID().slice(0, 6)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    await profileRegistry.install(id, AGENCY_PROFILE);
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
  });

  afterAll(async () => {
    for (const t of tenants) {
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("creates a ClientOrg node from an Organization row via applyMapping", async () => {
    const tenantId = await makeTenant("org");
    const row = { id: "org_acme_1", name: "Acme Co", domain: "acme.com" };
    const input = applyMapping(stevieAgencyMapping, "Organization", row, {
      tenantId,
    });

    expect(input.profile).toEqual({
      tier1: "Counterparty",
      profile: "agency",
      concrete: "ClientOrg",
    });
    expect(input.identity).toMatchObject({
      name: "Acme Co",
      externalRef: "org_acme_1",
    });

    const result = await graph.createNode(input);
    expect(result.created).toBe(true);
    expect(result.node.profile.concrete).toBe("ClientOrg");

    const read = await graph.getNode(tenantId, result.node.id);
    expect(read?.identity).toMatchObject({
      name: "Acme Co",
      externalRef: "org_acme_1",
    });
  });

  it("creates a Project node when every identity field comes via fieldMap", async () => {
    const tenantId = await makeTenant("proj");
    const row = {
      id: "proj_1",
      name: "Brand refresh",
      project_type: "branding",
      status: "kickoff",
    };
    const input = applyMapping(stevieAgencyMapping, "Project", row, {
      tenantId,
    });

    expect(input.identity).toEqual({
      title: "Brand refresh",
      projectType: "branding",
      operationalState: "kickoff",
    });

    const { node } = await graph.createNode(input);
    expect(node.profile.concrete).toBe("Project");
  });

  it("creates an edge from a declared mapping edge", async () => {
    const tenantId = await makeTenant("edge");

    const orgNode = (
      await graph.createNode(
        applyMapping(
          stevieAgencyMapping,
          "Organization",
          { id: "org_widget", name: "Widget Inc" },
          { tenantId },
        ),
      )
    ).node;

    const projNode = (
      await graph.createNode(
        applyMapping(
          stevieAgencyMapping,
          "Project",
          {
            id: "proj_widget",
            name: "Widget social push",
            project_type: "social",
            status: "kickoff",
          },
          { tenantId },
        ),
      )
    ).node;

    const edgeInput = applyEdgeMapping(
      stevieAgencyMapping,
      "Organization",
      "projects",
      { fromId: orgNode.id, toId: projNode.id },
      { tenantId },
    );

    const edge = await graph.createEdge(edgeInput);
    expect(edge.type).toBe("agency/client_has_project");
    expect(edge.fromId).toBe(orgNode.id);
    expect(edge.toId).toBe(projNode.id);
  });

  it("rejects writes that omit profile-required identity fields", async () => {
    const tenantId = await makeTenant("badlead");
    // Lead.qualificationStatus is required; deliberately drop it from the row.
    const row = {
      id: "ld_bad",
      full_name: "Bad Lead",
      email: "bad@x.com",
      phone: "+15550000",
      source: "form",
      // qualificationStatus deliberately absent
    };
    const input = applyMapping(stevieAgencyMapping, "Lead", row, { tenantId });
    expect("qualificationStatus" in input.identity).toBe(false);

    await expect(graph.createNode(input)).rejects.toThrow();
  });
});

/**
 * Pinning tests for the @pm/graph validator wiring.
 *
 * Validates that when the graph is constructed with a ProfileValidator
 * factory, profile-illegal writes are rejected at the graph layer — not
 * silently accepted. This closes the bypass identified at the end of P1:
 * before this commit, validator.validateNode() was opt-in, so callers
 * could skip it accidentally.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  PostgresProfileRegistry,
  ProfileValidationError,
} from "@pm/profile-registry";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import type { ProfileBinding, TenantId } from "@pm/types";
import { PostgresGraph } from "./postgres.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresGraph validator wiring", () => {
  let pool: pg.Pool;
  let profileRegistry: PostgresProfileRegistry;
  let graph: PostgresGraph;
  let tenantId: TenantId;

  const WEDDING: ProfileBinding = {
    tier1: "Engagement", profile: "wedding", concrete: "Wedding",
  };
  const COUPLE: ProfileBinding = {
    tier1: "Counterparty", profile: "wedding", concrete: "Couple",
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    profileRegistry = new PostgresProfileRegistry(pool);
    tenantId = `tnt_gv_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, WEDDING_PROFILE);

    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("rejects createNode missing required profile fields", async () => {
    await expect(
      graph.createNode({
        tenantId,
        profile: WEDDING,
        identity: { title: "T" }, // missing eventDate, venue, operationalState
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("rejects createNode with unknown concrete type", async () => {
    await expect(
      graph.createNode({
        tenantId,
        profile: { tier1: "Engagement", profile: "wedding", concrete: "Wedding3" },
        identity: {},
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("accepts a well-formed Wedding node", async () => {
    const w = await graph.createNode({
      tenantId,
      profile: WEDDING,
      identity: {
        title: "Test Wedding",
        eventDate: "2026-09-01",
        venue: "Beach",
        operationalState: "planning",
      },
      schemaVersion: 1,
    });
    expect(w.id).toMatch(/^ent_/);
  });

  it("rejects createEdge that would exceed has_principal exactly:2", async () => {
    const w = await graph.createNode({
      tenantId, profile: WEDDING,
      identity: {
        title: "Edge Test", eventDate: "2026-10-01", venue: "X",
        operationalState: "planning",
      },
      schemaVersion: 1,
    });
    const c1 = await graph.createNode({
      tenantId, profile: COUPLE, identity: { name: "P1" }, schemaVersion: 1,
    });
    const c2 = await graph.createNode({
      tenantId, profile: COUPLE, identity: { name: "P2" }, schemaVersion: 1,
    });
    const c3 = await graph.createNode({
      tenantId, profile: COUPLE, identity: { name: "P3" }, schemaVersion: 1,
    });

    await graph.createEdge({
      tenantId, type: "wedding/has_principal",
      fromId: w.id, toId: c1.id, attrs: {},
    });
    await graph.createEdge({
      tenantId, type: "wedding/has_principal",
      fromId: w.id, toId: c2.id, attrs: {},
    });
    // Third would push from-count to 3 — must reject.
    await expect(
      graph.createEdge({
        tenantId, type: "wedding/has_principal",
        fromId: w.id, toId: c3.id, attrs: {},
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("rejects createEdge with from-type not in the declared from-types", async () => {
    const w = await graph.createNode({
      tenantId, profile: WEDDING,
      identity: {
        title: "FromType", eventDate: "2026-10-01", venue: "X",
        operationalState: "planning",
      },
      schemaVersion: 1,
    });
    const c = await graph.createNode({
      tenantId, profile: COUPLE, identity: { name: "P" }, schemaVersion: 1,
    });
    // has_principal is declared as Wedding -> Couple. Reverse the direction.
    await expect(
      graph.createEdge({
        tenantId, type: "wedding/has_principal",
        fromId: c.id, toId: w.id, attrs: {},
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("rejects updateNode that drops a required field", async () => {
    const w = await graph.createNode({
      tenantId, profile: WEDDING,
      identity: {
        title: "Update Test", eventDate: "2026-10-01", venue: "X",
        operationalState: "planning",
      },
      schemaVersion: 1,
    });
    await expect(
      graph.updateNode({
        tenantId,
        id: w.id,
        identity: { title: "Only Title" }, // dropped required fields
        expectedSchemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("permits raw Tier-1 writes (no profile binding) regardless of installed profiles", async () => {
    // Layered ontology rule: raw Tier-1 stays usable even when profiles are
    // installed. The validator passes profile=null through with no checks.
    const n = await graph.createNode({
      tenantId,
      profile: { tier1: "Counterparty", profile: null, concrete: "Counterparty" },
      identity: {},
      schemaVersion: 1,
    });
    expect(n.profile.profile).toBeNull();
  });
});

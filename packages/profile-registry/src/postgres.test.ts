/**
 * Integration tests for PostgresProfileRegistry + SnapshotValidator.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { ProfileBinding, TenantId } from "@pm/types";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import {
  PostgresProfileRegistry,
  ProfileValidationError,
} from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresProfileRegistry", () => {
  let pool: pg.Pool;
  let reg: PostgresProfileRegistry;
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_pr_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    reg = new PostgresProfileRegistry(pool);
  });

  afterAll(async () => {
    for (const t of tenants) {
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("install + get round-trips a ProfileDefinition", async () => {
    const tenantId = await makeTenant();
    await reg.install(tenantId, WEDDING_PROFILE);
    const back = await reg.get(tenantId, "wedding");
    expect(back?.name).toBe("wedding");
    expect(back?.entityTypes.Wedding?.tier1).toBe("Engagement");
  });

  it("install is idempotent on (tenantId, name)", async () => {
    const tenantId = await makeTenant();
    await reg.install(tenantId, WEDDING_PROFILE);
    await reg.install(tenantId, { ...WEDDING_PROFILE, version: 2 });
    const list = await reg.list(tenantId);
    expect(list.length).toBe(1);
  });

  it("uninstall removes the installation", async () => {
    const tenantId = await makeTenant();
    await reg.install(tenantId, WEDDING_PROFILE);
    await reg.uninstall(tenantId, "wedding");
    expect(await reg.get(tenantId, "wedding")).toBeNull();
  });

  describe("validator (wedding profile installed)", () => {
    let tenantId: TenantId;

    beforeAll(async () => {
      tenantId = await makeTenant();
      await reg.install(tenantId, WEDDING_PROFILE);
    });

    const wedding = (
      identity: Record<string, unknown> = {
        title: "T", eventDate: "2026-09-01", venue: "V", operationalState: "planning",
      },
    ): ProfileBinding => ({
      tier1: "Engagement", profile: "wedding", concrete: "Wedding",
    });

    it("accepts a well-formed Wedding node", async () => {
      const v = await reg.validator(tenantId);
      v.validateNode({
        tenantId,
        profile: wedding(),
        identity: { title: "T", eventDate: "2026-09-01", venue: "V", operationalState: "planning" },
        schemaVersion: 1,
      });
    });

    it("rejects a Wedding missing required fields", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateNode({
          tenantId,
          profile: wedding(),
          identity: { title: "T" }, // missing eventDate, venue, operationalState
          schemaVersion: 1,
        }),
      ).toThrow(ProfileValidationError);
    });

    it("rejects a concrete type whose tier1 doesn't match the profile", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateNode({
          tenantId,
          profile: { tier1: "Counterparty", profile: "wedding", concrete: "Wedding" },
          identity: { title: "T", eventDate: "x", venue: "V", operationalState: "planning" },
          schemaVersion: 1,
        }),
      ).toThrow(ProfileValidationError);
    });

    it("rejects an unknown concrete type", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateNode({
          tenantId,
          profile: { tier1: "Engagement", profile: "wedding", concrete: "Wedding3" },
          identity: {},
          schemaVersion: 1,
        }),
      ).toThrow(/unknown concrete type/);
    });

    it("permits raw Tier-1 writes regardless of profile installation", async () => {
      const v = await reg.validator(tenantId);
      // No throw expected — raw Tier-1 has no profile-declared shape.
      v.validateNode({
        tenantId,
        profile: { tier1: "Engagement", profile: null, concrete: "Engagement" },
        identity: {},
        schemaVersion: 1,
      });
    });

    it("validateEdge: rejects unknown profile-prefixed edge type", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateEdge({
          tenantId, type: "wedding/invented_edge",
          fromConcrete: "Wedding", toConcrete: "Couple",
          existingFromCount: 0, existingToCount: 0,
        }),
      ).toThrow(/unknown edge type/);
    });

    it("validateEdge: rejects from/to type mismatch", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateEdge({
          tenantId, type: "wedding/has_principal",
          fromConcrete: "Vendor", toConcrete: "Couple",
          existingFromCount: 0, existingToCount: 0,
        }),
      ).toThrow(/cannot start at Vendor/);
    });

    it("validateEdge: enforces exactly:2 on has_principal", async () => {
      const v = await reg.validator(tenantId);
      // First two are fine.
      v.validateEdge({
        tenantId, type: "wedding/has_principal",
        fromConcrete: "Wedding", toConcrete: "Couple",
        existingFromCount: 0, existingToCount: 0,
      });
      v.validateEdge({
        tenantId, type: "wedding/has_principal",
        fromConcrete: "Wedding", toConcrete: "Couple",
        existingFromCount: 1, existingToCount: 0,
      });
      // Third would push existingFromCount+1=3 > 2.
      expect(() =>
        v.validateEdge({
          tenantId, type: "wedding/has_principal",
          fromConcrete: "Wedding", toConcrete: "Couple",
          existingFromCount: 2, existingToCount: 0,
        }),
      ).toThrow(/exactly:2/);
    });

    it("validateEdge: permits unprefixed (raw) edge types without lookup", async () => {
      const v = await reg.validator(tenantId);
      // No throw — raw edges flow through (substrate stores the type as-is).
      v.validateEdge({
        tenantId, type: "involves",
        fromConcrete: "Engagement", toConcrete: "Counterparty",
        existingFromCount: 0, existingToCount: 0,
      });
    });
  });
});

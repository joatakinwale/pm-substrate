/**
 * Integration tests for PostgresProfileRegistry + SnapshotValidator.
 *
 * Fixtures use the finance-research profile (the ArrowHedge agent-state
 * validation artifact).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { ProfileBinding, TenantId } from "@pm/types";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
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
    await reg.install(tenantId, FINANCE_RESEARCH_PROFILE);
    const back = await reg.get(tenantId, "finance-research");
    expect(back?.name).toBe("finance-research");
    expect(back?.entityTypes.ResearchRun?.tier1).toBe("Engagement");
  });

  it("install is idempotent on (tenantId, name)", async () => {
    const tenantId = await makeTenant();
    await reg.install(tenantId, FINANCE_RESEARCH_PROFILE);
    await reg.install(tenantId, { ...FINANCE_RESEARCH_PROFILE, version: 2 });
    const list = await reg.list(tenantId);
    expect(list.length).toBe(1);
  });

  it("uninstall removes the installation", async () => {
    const tenantId = await makeTenant();
    await reg.install(tenantId, FINANCE_RESEARCH_PROFILE);
    await reg.uninstall(tenantId, "finance-research");
    expect(await reg.get(tenantId, "finance-research")).toBeNull();
  });

  describe("validator (finance-research profile installed)", () => {
    let tenantId: TenantId;

    beforeAll(async () => {
      tenantId = await makeTenant();
      await reg.install(tenantId, FINANCE_RESEARCH_PROFILE);
    });

    const researchRun = (): ProfileBinding => ({
      tier1: "Engagement", profile: "finance-research", concrete: "ResearchRun",
    });
    const researchRunIdentity = {
      title: "AAPL breakout research",
      scopeStart: "2026-05-01",
      scopeEnd: "2026-06-03",
      state: "configured",
    };

    it("accepts a well-formed ResearchRun node", async () => {
      const v = await reg.validator(tenantId);
      v.validateNode({
        tenantId,
        profile: researchRun(),
        identity: researchRunIdentity,
        schemaVersion: 1,
      });
    });

    it("rejects a ResearchRun missing required fields", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateNode({
          tenantId,
          profile: researchRun(),
          identity: { title: "T" }, // missing scopeStart, scopeEnd, state
          schemaVersion: 1,
        }),
      ).toThrow(ProfileValidationError);
    });

    it("rejects a concrete type whose tier1 doesn't match the profile", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateNode({
          tenantId,
          profile: { tier1: "Counterparty", profile: "finance-research", concrete: "ResearchRun" },
          identity: researchRunIdentity,
          schemaVersion: 1,
        }),
      ).toThrow(ProfileValidationError);
    });

    it("rejects an unknown concrete type", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateNode({
          tenantId,
          profile: { tier1: "Engagement", profile: "finance-research", concrete: "ResearchRun3" },
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
          tenantId, type: "finance-research/invented_edge",
          fromConcrete: "AnalystSignal", toConcrete: "Ticker",
          existingFromCount: 0, existingToCount: 0,
        }),
      ).toThrow(/unknown edge type/);
    });

    it("validateEdge: rejects from/to type mismatch", async () => {
      const v = await reg.validator(tenantId);
      expect(() =>
        v.validateEdge({
          tenantId, type: "finance-research/signal_for_ticker",
          fromConcrete: "Ticker", toConcrete: "Ticker",
          existingFromCount: 0, existingToCount: 0,
        }),
      ).toThrow(/cannot start at Ticker/);
    });

    it("validateEdge: enforces exactly:1 on signal_for_ticker", async () => {
      const v = await reg.validator(tenantId);
      // The first edge from a signal is fine.
      v.validateEdge({
        tenantId, type: "finance-research/signal_for_ticker",
        fromConcrete: "AnalystSignal", toConcrete: "Ticker",
        existingFromCount: 0, existingToCount: 0,
      });
      // A second would push existingFromCount+1=2 > 1.
      expect(() =>
        v.validateEdge({
          tenantId, type: "finance-research/signal_for_ticker",
          fromConcrete: "AnalystSignal", toConcrete: "Ticker",
          existingFromCount: 1, existingToCount: 0,
        }),
      ).toThrow(/exactly:1/);
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

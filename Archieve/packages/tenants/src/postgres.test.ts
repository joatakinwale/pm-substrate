import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { TenantId } from "@pm/types";
import {
  InvalidTenantIdError,
  PostgresTenantDirectory,
  TenantConflictError,
  TenantNotFoundError,
} from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresTenantDirectory", () => {
  let pool: pg.Pool;
  let tenants: PostgresTenantDirectory;
  const created: TenantId[] = [];

  const id = (): TenantId => `tnt_dir_${randomUUID().slice(0, 8)}` as TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenants = new PostgresTenantDirectory(pool);
  });

  afterAll(async () => {
    for (const t of created) {
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("creates and reads a tenant without raw SQL callers", async () => {
    const tenantId = id();
    created.push(tenantId);
    const t = await tenants.create({
      id: tenantId,
      displayName: "Acme Ops",
      metadata: { source: "test", externalCustomerId: "cus_123" },
    });
    expect(t.id).toBe(tenantId);
    expect(t.displayName).toBe("Acme Ops");
    expect(t.metadata).toMatchObject({ source: "test", externalCustomerId: "cus_123" });
    expect(t.archivedAt).toBeNull();

    const back = await tenants.require(tenantId);
    expect(back.displayName).toBe("Acme Ops");
  });

  it("rejects duplicate tenant ids", async () => {
    const tenantId = id();
    created.push(tenantId);
    await tenants.create({ id: tenantId, displayName: "One" });
    await expect(tenants.create({ id: tenantId, displayName: "Two" })).rejects.toThrow(TenantConflictError);
  });

  it("updates metadata, archives, hides archived rows by default, and restores", async () => {
    const tenantId = id();
    created.push(tenantId);
    await tenants.create({ id: tenantId, displayName: "Before" });

    const updated = await tenants.update(tenantId, {
      displayName: "After",
      metadata: { plan: "pilot" },
    });
    expect(updated.displayName).toBe("After");
    expect(updated.metadata).toEqual({ plan: "pilot" });

    const archived = await tenants.archive(tenantId);
    expect(archived.archivedAt).toBeTruthy();

    const active = await tenants.list();
    expect(active.map((t) => t.id)).not.toContain(tenantId);

    const all = await tenants.list({ includeArchived: true });
    expect(all.map((t) => t.id)).toContain(tenantId);

    const restored = await tenants.restore(tenantId);
    expect(restored.archivedAt).toBeNull();
  });

  it("rejects malformed tenant ids and missing tenants", async () => {
    await expect(tenants.create({ id: "Bad Tenant" as TenantId, displayName: "Bad" })).rejects.toThrow(InvalidTenantIdError);
    await expect(tenants.require("tnt_missing_999" as TenantId)).rejects.toThrow(TenantNotFoundError);
  });
});

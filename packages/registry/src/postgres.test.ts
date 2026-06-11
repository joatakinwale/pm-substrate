/**
 * Integration tests for PostgresRegistry against the running dev DB.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { CapabilityId, TenantId } from "@pm/types";
import type { Capability } from "./interfaces.js";
import { PostgresRegistry } from "./postgres.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const cap = (
  name: string,
  version = 1,
  overrides: Partial<Capability> = {},
): Capability => ({
  id: `cap_${randomUUID()}` as CapabilityId,
  name,
  version,
  readsInterfaces: [],
  writesInterfaces: [],
  readsEdges: [],
  writesEdges: [],
  emits: [],
  subscribesTo: [],
  requiredPermissions: [],
  description: "",
  ...overrides,
});

describeIfDb("PostgresRegistry", () => {
  let pool: pg.Pool;
  let registry: PostgresRegistry;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    registry = new PostgresRegistry(pool);
    tenantId = `tnt_test_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("registers and retrieves a capability", async () => {
    const c = cap("agency/planner", 1, {
      emits: ["task.created", "task.completed"],
      subscribesTo: ["contract.*"],
      description: "Planner",
    });
    await registry.register(tenantId, c);

    const back = await registry.get(tenantId, "agency/planner");
    expect(back?.name).toBe("agency/planner");
    expect(back?.version).toBe(1);
    expect(back?.emits).toEqual(["task.created", "task.completed"]);
    expect(back?.subscribesTo).toEqual(["contract.*"]);
  });

  it("register is idempotent on (tenant, name, version)", async () => {
    const c = cap("agency/calendar", 1, { description: "first" });
    await registry.register(tenantId, c);
    await registry.register(tenantId, { ...c, description: "second" });
    const back = await registry.get(tenantId, "agency/calendar");
    expect(back?.description).toBe("second");

    const r = await pool.query<{ count: string }>(
      `SELECT count(*)::text FROM registry.capabilities
        WHERE tenant_id = $1 AND name = $2`,
      [tenantId, "agency/calendar"],
    );
    expect(r.rows[0]?.count).toBe("1");
  });

  it("multiple versions coexist; get() returns the highest", async () => {
    await registry.register(tenantId, cap("agency/comms", 1, { description: "v1" }));
    await registry.register(tenantId, cap("agency/comms", 2, { description: "v2" }));
    await registry.register(tenantId, cap("agency/comms", 3, { description: "v3" }));

    const latest = await registry.get(tenantId, "agency/comms");
    expect(latest?.version).toBe(3);
    expect(latest?.description).toBe("v3");

    const v1 = await registry.getVersion(tenantId, "agency/comms", 1);
    expect(v1?.description).toBe("v1");
  });

  it("list() returns latest version of each name", async () => {
    await registry.register(tenantId, cap("agency/x", 1));
    await registry.register(tenantId, cap("agency/x", 2));
    await registry.register(tenantId, cap("agency/y", 1));
    const list = await registry.list(tenantId);
    const xs = list.filter((c) => c.name === "agency/x");
    expect(xs.length).toBe(1);
    expect(xs[0]?.version).toBe(2);
    expect(list.find((c) => c.name === "agency/y")?.version).toBe(1);
  });

  it("subscribersOf() respects glob patterns", async () => {
    // Use a unique namespace prefix so this test doesn't see capabilities
    // registered by other tests in the same beforeAll-shared tenant.
    const ns = `glob_${randomUUID().slice(0, 6)}`;
    await registry.register(tenantId, cap(`${ns}/exact`, 1, {
      subscribesTo: ["contract.signed"],
    }));
    await registry.register(tenantId, cap(`${ns}/namespace`, 1, {
      subscribesTo: ["contract.*"],
    }));
    await registry.register(tenantId, cap(`${ns}/verb`, 1, {
      subscribesTo: ["*.signed"],
    }));
    await registry.register(tenantId, cap(`${ns}/unrelated`, 1, {
      subscribesTo: ["task.created"],
    }));

    const subs = await registry.subscribersOf(tenantId, "contract.signed");
    const names = subs
      .map((c) => c.name)
      .filter((n) => n.startsWith(`${ns}/`))
      .sort();
    expect(names).toEqual([
      `${ns}/exact`,
      `${ns}/namespace`,
      `${ns}/verb`,
    ]);
  });

  it("unregister() removes all versions", async () => {
    await registry.register(tenantId, cap("agency/temp", 1));
    await registry.register(tenantId, cap("agency/temp", 2));
    await registry.unregister(tenantId, "agency/temp");
    expect(await registry.get(tenantId, "agency/temp")).toBeNull();
  });
});

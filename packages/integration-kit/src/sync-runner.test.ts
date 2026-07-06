import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import type { EntityMapping } from "@pm/entity-mapping";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import type { TenantId } from "@pm/types";

import {
  SYNC_REJECTED_EVENT_TYPE,
  SYNC_UPSERTED_EVENT_TYPE,
  runEntityMappingSync,
  syncNodeId,
  uuidV5,
} from "./sync-runner.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

/** Neutral fixture app: a tiny CRM nobody rewrote to meet the substrate. */
const FIXTURE_MAPPING: EntityMapping = {
  profile: null,
  mappingVersion: 1,
  description: "orbit_crm fixture — raw Tier-1 mapping, no profile",
  entities: {
    Customer: {
      tier1: "Counterparty",
      concrete: "Counterparty",
      identityFields: ["name"],
      fieldMap: { external_email: "email" },
      schemaVersion: 1,
    },
    Order: {
      tier1: "Engagement",
      concrete: "Engagement",
      identityFields: ["title", "status"],
      schemaVersion: 1,
    },
  },
};

const FIXTURE_RECORDS = [
  {
    sourceName: "Customer",
    externalId: "cust-1",
    row: { name: "Ada Lovelace", email: "ada@orbit.example" },
  },
  {
    sourceName: "Customer",
    externalId: "cust-2",
    row: { name: "Grace Hopper", email: "grace@orbit.example" },
  },
  {
    sourceName: "Order",
    externalId: "ord-9",
    row: { title: "Q3 retainer", status: "open" },
  },
] as const;

describe("sync identity (pure)", () => {
  it("uuidV5 is deterministic and RFC-4122 shaped", () => {
    const a = uuidV5("tenant/app/Customer/cust-1", "3c1a2f60-9e4b-5d78-8a2c-f0b1d4e6c9a7");
    const b = uuidV5("tenant/app/Customer/cust-1", "3c1a2f60-9e4b-5d78-8a2c-f0b1d4e6c9a7");
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("node identity separates tenants, apps, sources, and ids", () => {
    const t = "tnt_x" as TenantId;
    const base = syncNodeId(t, "orbit_crm", "Customer", "cust-1");
    expect(syncNodeId(t, "orbit_crm", "Customer", "cust-1")).toBe(base);
    expect(syncNodeId(t, "orbit_crm", "Customer", "cust-2")).not.toBe(base);
    expect(syncNodeId(t, "other_app", "Customer", "cust-1")).not.toBe(base);
    expect(syncNodeId("tnt_y" as TenantId, "orbit_crm", "Customer", "cust-1")).not.toBe(base);
  });
});

describeIfDb("entity-mapping sync-runner (fixture app, zero rewrites)", () => {
  let pool: pg.Pool;
  let graph: PostgresGraph;
  let events: PostgresEventStore;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_sync_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    graph = new PostgresGraph(pool);
    events = new PostgresEventStore(pool);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("first sync creates every mapped node with provenance events", async () => {
    const result = await runEntityMappingSync(
      { graph, events },
      {
        tenantId,
        appName: "orbit_crm",
        mapping: FIXTURE_MAPPING,
        records: [...FIXTURE_RECORDS],
        syncedBy: "sync-runner-test",
      },
    );
    expect(result).toMatchObject({ created: 3, updated: 0, unchanged: 0 });
    expect(result.rejected).toHaveLength(0);

    const node = await graph.getNode(
      tenantId,
      result.nodeIds["Customer:cust-1"] as never,
    );
    expect(node?.identity).toEqual({
      name: "Ada Lovelace",
      external_email: "ada@orbit.example",
    });
    expect(node?.profile.tier1).toBe("Counterparty");

    const upserts = await events.read({
      tenantId,
      typePattern: SYNC_UPSERTED_EVENT_TYPE,
    });
    expect(upserts).toHaveLength(3);
    expect(upserts.every((e) => (e.payload as { op: string }).op === "created")).toBe(true);
  });

  it("re-sync of identical records is a complete no-op (idempotent)", async () => {
    const result = await runEntityMappingSync(
      { graph, events },
      {
        tenantId,
        appName: "orbit_crm",
        mapping: FIXTURE_MAPPING,
        records: [...FIXTURE_RECORDS],
        syncedBy: "sync-runner-test",
      },
    );
    expect(result).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
    const upserts = await events.read({
      tenantId,
      typePattern: SYNC_UPSERTED_EVENT_TYPE,
    });
    expect(upserts).toHaveLength(3); // unchanged emits nothing new
  });

  it("a changed source row updates exactly that node", async () => {
    const mutated = FIXTURE_RECORDS.map((r) =>
      r.externalId === "ord-9"
        ? { ...r, row: { title: "Q3 retainer", status: "closed" } }
        : r,
    );
    const result = await runEntityMappingSync(
      { graph, events },
      {
        tenantId,
        appName: "orbit_crm",
        mapping: FIXTURE_MAPPING,
        records: mutated,
        syncedBy: "sync-runner-test",
      },
    );
    expect(result).toMatchObject({ created: 0, updated: 1, unchanged: 2 });

    const node = await graph.getNode(
      tenantId,
      result.nodeIds["Order:ord-9"] as never,
    );
    expect(node?.identity["status"]).toBe("closed");
  });

  it("unmappable records are rejected on the log; the rest still sync", async () => {
    const result = await runEntityMappingSync(
      { graph, events },
      {
        tenantId,
        appName: "orbit_crm",
        mapping: FIXTURE_MAPPING,
        records: [
          {
            sourceName: "Invoice", // not declared in the mapping
            externalId: "inv-1",
            row: { amount: 100 },
          },
          {
            sourceName: "Customer",
            externalId: "cust-3",
            row: { name: "Katherine Johnson", email: "kj@orbit.example" },
          },
        ],
        syncedBy: "sync-runner-test",
      },
    );
    expect(result).toMatchObject({ created: 1, updated: 0, unchanged: 0 });
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toMatch(/not declared in mapping/);

    const rejections = await events.read({
      tenantId,
      typePattern: SYNC_REJECTED_EVENT_TYPE,
    });
    expect(rejections).toHaveLength(1);
  });

  it("rejects a malformed mapping document outright", async () => {
    await expect(
      runEntityMappingSync(
        { graph, events },
        {
          tenantId,
          appName: "orbit_crm",
          mapping: { profile: null, mappingVersion: 1, entities: {} } as EntityMapping,
          records: [],
          syncedBy: "sync-runner-test",
        },
      ),
    ).rejects.toThrow(/entity mapping invalid/);
  });
});

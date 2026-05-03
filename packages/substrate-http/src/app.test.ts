/**
 * Integration tests for the substrate HTTP layer.
 *
 * Exercise: profile install → capability register → node create → edge
 * create (cardinality enforced) → event publish → event read → projection
 * catch-up. The same cross-tool flow that drives the wedding scenario,
 * exercised end-to-end through HTTP.
 *
 * No domain semantics in these tests. Every assertion is about substrate
 * behavior over HTTP, not wedding behavior. (Wedding-specific tests live
 * with the wedding capability packages.)
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { Hono } from "hono";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresProjectionRunner } from "@pm/projections";
import { PostgresRegistry } from "@pm/registry";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import { auditProjection, AUDIT_CAPABILITY } from "@pm/capability-audit";
import type { TenantId } from "@pm/types";
import { createSubstrateApp } from "./app.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("substrate HTTP", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let profileRegistry: PostgresProfileRegistry;
  let capRegistry: PostgresRegistry;
  let projections: PostgresProjectionRunner;
  let app: Hono;

  const tenants: TenantId[] = [];
  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_http_${randomUUID().slice(0, 8)}` as TenantId;
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
    events = new PostgresEventStore(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
    capRegistry = new PostgresRegistry(pool);
    projections = new PostgresProjectionRunner(pool, events);
    await projections.register(auditProjection);

    app = createSubstrateApp({
      profileRegistry,
      capabilityRegistry: capRegistry,
      graph,
      events,
      projections,
    });
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.state WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.cursors WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  // Convenience: invoke the app via its fetch handler.
  const call = async (
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> => {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { "content-type": "application/json" };
    }
    return app.fetch(new Request(`http://test${path}`, init));
  };

  it("GET /healthz returns ok", async () => {
    const r = await call("GET", "/healthz");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
  });

  it("install profile + list + get + delete", async () => {
    const tenantId = await makeTenant();
    let r = await call("POST", `/tenants/${tenantId}/profiles`, WEDDING_PROFILE);
    expect(r.status).toBe(200);

    r = await call("GET", `/tenants/${tenantId}/profiles`);
    const list = (await r.json()) as { profiles: Array<{ name: string }> };
    expect(list.profiles.map((p) => p.name)).toContain("wedding");

    r = await call("GET", `/tenants/${tenantId}/profiles/wedding`);
    expect(r.status).toBe(200);
    const got = (await r.json()) as { name: string };
    expect(got.name).toBe("wedding");

    r = await call("DELETE", `/tenants/${tenantId}/profiles/wedding`);
    expect(r.status).toBe(200);

    r = await call("GET", `/tenants/${tenantId}/profiles/wedding`);
    expect(r.status).toBe(404);
  });

  it("register capability + subscribersOf", async () => {
    const tenantId = await makeTenant();
    let r = await call("POST", `/tenants/${tenantId}/capabilities`, AUDIT_CAPABILITY);
    expect(r.status).toBe(200);

    r = await call(
      "GET",
      `/tenants/${tenantId}/capabilities/subscribers/contract.signed`,
    );
    expect(r.status).toBe(200);
    const subs = (await r.json()) as { subscribers: Array<{ name: string }> };
    expect(subs.subscribers.map((s) => s.name)).toContain("common/audit-log");
  });

  it("create node + edge enforces profile cardinality (HTTP-level)", async () => {
    const tenantId = await makeTenant();
    await call("POST", `/tenants/${tenantId}/profiles`, WEDDING_PROFILE);

    // Create a Wedding + 3 Couples
    const mk = async (binding: { tier1: string; profile: string; concrete: string }, identity: Record<string, unknown>) => {
      const r = await call("POST", `/tenants/${tenantId}/nodes`, {
        profile: binding,
        identity,
        schemaVersion: 1,
      });
      expect(r.status).toBe(200);
      const node = (await r.json()) as { id: string };
      return node.id;
    };
    const wid = await mk(
      { tier1: "Engagement", profile: "wedding", concrete: "Wedding" },
      { title: "T", eventDate: "2026-08-01", venue: "X", operationalState: "planning" },
    );
    const c1 = await mk(
      { tier1: "Counterparty", profile: "wedding", concrete: "Couple" },
      { name: "P1" },
    );
    const c2 = await mk(
      { tier1: "Counterparty", profile: "wedding", concrete: "Couple" },
      { name: "P2" },
    );
    const c3 = await mk(
      { tier1: "Counterparty", profile: "wedding", concrete: "Couple" },
      { name: "P3" },
    );

    // First two has_principal edges succeed.
    let r = await call("POST", `/tenants/${tenantId}/edges`, {
      type: "wedding/has_principal", fromId: wid, toId: c1, attrs: {},
    });
    expect(r.status).toBe(200);
    r = await call("POST", `/tenants/${tenantId}/edges`, {
      type: "wedding/has_principal", fromId: wid, toId: c2, attrs: {},
    });
    expect(r.status).toBe(200);

    // Third must be rejected with 422 (ProfileValidationError → 422).
    r = await call("POST", `/tenants/${tenantId}/edges`, {
      type: "wedding/has_principal", fromId: wid, toId: c3, attrs: {},
    });
    expect(r.status).toBe(422);
    const err = (await r.json()) as { error: string };
    expect(err.error).toMatch(/exactly:2/);
  });

  it("publish events + read + getById", async () => {
    const tenantId = await makeTenant();
    let r = await call("POST", `/tenants/${tenantId}/events`, {
      type: "test.created",
      entityId: "ent_x",
      emittedBy: "cap.test",
      payloadSchema: "test.created/v1",
      payload: { foo: "bar" },
    });
    expect(r.status).toBe(200);
    const ev = (await r.json()) as { id: string; type: string };
    expect(ev.id).toMatch(/^evt_/);

    r = await call("GET", `/tenants/${tenantId}/events?typePattern=test.*`);
    expect(r.status).toBe(200);
    const list = (await r.json()) as { events: Array<{ id: string }> };
    expect(list.events.find((e) => e.id === ev.id)).toBeTruthy();

    r = await call("GET", `/tenants/${tenantId}/events/${ev.id}`);
    expect(r.status).toBe(200);
    const single = (await r.json()) as { id: string; payload: { foo: string } };
    expect(single.payload).toEqual({ foo: "bar" });
  });

  it("projection catch-up + getState end-to-end through HTTP", async () => {
    const tenantId = await makeTenant();
    await call("POST", `/tenants/${tenantId}/capabilities`, AUDIT_CAPABILITY);

    // Publish 3 events.
    for (const t of ["thing.a", "thing.b", "thing.a"]) {
      await call("POST", `/tenants/${tenantId}/events`, {
        type: t,
        entityId: "ent_proj",
        emittedBy: "cap.test",
        payloadSchema: `${t}/v1`,
        payload: {},
      });
    }

    let r = await call("POST", `/tenants/${tenantId}/projections/common%2Faudit-log/catch-up`);
    expect(r.status).toBe(200);

    r = await call("GET", `/tenants/${tenantId}/projections/common%2Faudit-log/state`);
    expect(r.status).toBe(200);
    const wrap = (await r.json()) as {
      state: { count: number; byType: Record<string, number> };
    };
    expect(wrap.state.count).toBe(3);
    expect(wrap.state.byType).toEqual({ "thing.a": 2, "thing.b": 1 });
  });

  it("returns 404 for unknown node + 422 for bad profile write", async () => {
    const tenantId = await makeTenant();
    await call("POST", `/tenants/${tenantId}/profiles`, WEDDING_PROFILE);

    let r = await call("GET", `/tenants/${tenantId}/nodes/ent_nope`);
    expect(r.status).toBe(404);

    // Missing required fields on a Wedding.
    r = await call("POST", `/tenants/${tenantId}/nodes`, {
      profile: { tier1: "Engagement", profile: "wedding", concrete: "Wedding" },
      identity: { title: "Only Title" },
      schemaVersion: 1,
    });
    expect(r.status).toBe(422);
  });

  it("returns 409 for optimistic concurrency conflict", async () => {
    const tenantId = await makeTenant();
    // Use a raw Tier-1 node so we don't need a profile installed.
    let r = await call("POST", `/tenants/${tenantId}/nodes`, {
      profile: { tier1: "Counterparty", profile: null, concrete: "Counterparty" },
      identity: { name: "v1" },
      schemaVersion: 1,
    });
    expect(r.status).toBe(200);
    const node = (await r.json()) as { id: string };

    // First update with version 1 → succeeds.
    r = await call("PATCH", `/tenants/${tenantId}/nodes/${node.id}`, {
      identity: { name: "v2" },
      expectedSchemaVersion: 1,
    });
    expect(r.status).toBe(200);

    // Second update still claiming version 1 → 409.
    r = await call("PATCH", `/tenants/${tenantId}/nodes/${node.id}`, {
      identity: { name: "stale" },
      expectedSchemaVersion: 1,
    });
    expect(r.status).toBe(409);
  });
});

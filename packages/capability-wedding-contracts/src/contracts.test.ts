/**
 * Integration tests for the wedding/contracts capability.
 *
 * Exercises:
 *   - Lifecycle enforcement against the wedding profile (state-machine).
 *   - Atomic graph mutation + event publish per transition.
 *   - Concurrent transition serialization (FOR UPDATE).
 *   - Refusal of illegal transitions with ProfileValidationError.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import {
  PostgresProfileRegistry,
  ProfileValidationError,
} from "@pm/profile-registry";
import { PostgresRegistry } from "@pm/registry";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import type { TenantId } from "@pm/types";
import { WEDDING_CONTRACTS_CAPABILITY, WeddingContracts } from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("wedding/contracts capability", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let capRegistry: PostgresRegistry;
  let profileRegistry: PostgresProfileRegistry;
  let svc: WeddingContracts;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    graph = new PostgresGraph(pool);
    capRegistry = new PostgresRegistry(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    tenantId = `tnt_wc_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, WEDDING_PROFILE);
    await capRegistry.register(tenantId, WEDDING_CONTRACTS_CAPABILITY);
    const validator = await profileRegistry.validator(tenantId);
    svc = new WeddingContracts({
      pool, graph, events, validator,
      emittedBy: "wedding/contracts",
    });
  });

  afterAll(async () => {
    await events.close();
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("draft() creates a Contract and emits wedding.contract.drafted", async () => {
    const id = await svc.draft({
      tenantId, amountMinor: 250000, currency: "USD",
      effectiveDate: "2026-08-01",
    });
    const node = await graph.getNode(tenantId, id);
    expect(node?.identity.state).toBe("draft");
    expect(node?.profile.concrete).toBe("Contract");

    const evs = await events.read({
      tenantId, typePattern: "wedding.contract.drafted", entityId: id,
    });
    expect(evs.length).toBe(1);
    expect(evs[0]?.payload).toMatchObject({ amountMinor: 250000, currency: "USD" });
  });

  it("walks the legal lifecycle: draft → sent → signed → in_progress → completed", async () => {
    const id = await svc.draft({
      tenantId, amountMinor: 100, currency: "USD", effectiveDate: "2026-08-01",
    });
    await svc.send(tenantId, id);
    await svc.sign(tenantId, id);
    await svc.startWork(tenantId, id);
    await svc.complete(tenantId, id);

    const node = await graph.getNode(tenantId, id);
    expect(node?.identity.state).toBe("completed");

    const evs = await events.read({
      tenantId, typePattern: "wedding.contract.*", entityId: id,
    });
    const types = evs.map((e) => e.type);
    expect(types).toEqual([
      "wedding.contract.drafted",
      "wedding.contract.sent",
      "wedding.contract.signed",
      "wedding.contract.work_started",
      "wedding.contract.completed",
    ]);
  });

  it("rejects illegal transitions with ProfileValidationError", async () => {
    const id = await svc.draft({
      tenantId, amountMinor: 100, currency: "USD", effectiveDate: "2026-08-01",
    });
    // Skip "sent" — try to sign a draft directly.
    await expect(svc.sign(tenantId, id)).rejects.toBeInstanceOf(ProfileValidationError);
    // State must be unchanged.
    const node = await graph.getNode(tenantId, id);
    expect(node?.identity.state).toBe("draft");
  });

  it("cancel works from any non-terminal state", async () => {
    const id = await svc.draft({
      tenantId, amountMinor: 100, currency: "USD", effectiveDate: "2026-08-01",
    });
    await svc.send(tenantId, id);
    await svc.cancel(tenantId, id);
    const node = await graph.getNode(tenantId, id);
    expect(node?.identity.state).toBe("cancelled");

    // From terminal "cancelled" → cancel should reject (cancelled isn't in
    // any transition's `from` list).
    await expect(svc.cancel(tenantId, id)).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("transition writes graph + event in one tx (atomicity)", async () => {
    const id = await svc.draft({
      tenantId, amountMinor: 100, currency: "USD", effectiveDate: "2026-08-01",
    });
    await svc.send(tenantId, id);

    // The 'sent' state and the 'wedding.contract.sent' event must both be
    // visible OR both absent. If the graph says 'sent' but no event was
    // published, atomicity is broken. Verified by checking both.
    const node = await graph.getNode(tenantId, id);
    const evs = await events.read({
      tenantId, typePattern: "wedding.contract.sent", entityId: id,
    });
    expect(node?.identity.state).toBe("sent");
    expect(evs.length).toBe(1);
    expect(evs[0]?.payload).toMatchObject({ from: "draft", to: "sent" });
  });

  it("concurrent transitions on the same contract serialize via FOR UPDATE", async () => {
    const id = await svc.draft({
      tenantId, amountMinor: 100, currency: "USD", effectiveDate: "2026-08-01",
    });
    // Both attempt to send. One succeeds, the other observes "sent" and
    // tries an illegal draft → sent transition (sent → sent isn't legal),
    // raising ProfileValidationError. Net: exactly one wins.
    const settled = await Promise.allSettled([
      svc.send(tenantId, id),
      svc.send(tenantId, id),
    ]);
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    const rejected = settled.filter((s) => s.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const node = await graph.getNode(tenantId, id);
    expect(node?.identity.state).toBe("sent");
  });
});

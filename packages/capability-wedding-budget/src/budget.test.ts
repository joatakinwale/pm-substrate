/**
 * Integration tests for the wedding.budget capability.
 *
 * Covers:
 *   1. Happy path: payment_recorded → correct BudgetCategory.actualSpentMinor
 *      update + wedding.budget.actual_spent_updated event emitted.
 *   2. Idempotency: same paymentId delivered twice → rollup applied once,
 *      no double-count.
 *   3. No-vendor-link: contract has no vendor edge → warning logged, no
 *      rollup, no error thrown.
 *   4. Atomicity: if event publish fails, both the graph UPDATE and the
 *      applied_payments INSERT are rolled back.
 *
 * Graph setup (shared across tests 1, 2, 4):
 *   Vendor ──(wedding/vendor_budget_category)──► BudgetCategory
 *   Contract ──(wedding/contract_vendor)──► Vendor
 *
 * Test 3 creates an isolated contract with no outgoing vendor edge.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresRegistry } from "@pm/registry";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import type { EntityId, TenantId } from "@pm/types";
import { WEDDING_BUDGET_CAPABILITY, BudgetRollupHandler } from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("wedding.budget capability", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let capRegistry: PostgresRegistry;
  let profileRegistry: PostgresProfileRegistry;
  let handler: BudgetRollupHandler;
  let tenantId: TenantId;

  // Shared entity IDs (created in beforeAll, reused across tests).
  let vendorId: EntityId;
  let budgetCategoryId: EntityId;
  let contractId: EntityId; // Has vendor edge → used in tests 1, 2, 4.

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    graph = new PostgresGraph(pool); // No validatorFactory — raw mode for speed.
    capRegistry = new PostgresRegistry(pool);
    profileRegistry = new PostgresProfileRegistry(pool);

    tenantId = `tnt_wb_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, WEDDING_PROFILE);
    await capRegistry.register(tenantId, WEDDING_BUDGET_CAPABILITY);

    handler = new BudgetRollupHandler({
      pool,
      graph,
      events,
      emittedBy: "wedding.budget.test",
    });

    // Create a Vendor entity.
    const vendorNode = await graph.createNode({
      tenantId,
      profile: { tier1: "Counterparty", profile: "wedding", concrete: "Vendor" },
      identity: {
        name: "Gourmet Catering Co.",
        category: "catering",
      },
      schemaVersion: 1,
    });
    vendorId = vendorNode.id;

    // Create a BudgetCategory entity. actualSpentMinor starts at 0.
    const bcNode = await graph.createNode({
      tenantId,
      profile: { tier1: "Resource", profile: "wedding", concrete: "BudgetCategory" },
      identity: {
        name: "Catering",
        kind: "budget_category",
        allocatedMinor: 1_000_000, // $10,000.00
        currency: "USD",
        actualSpentMinor: 0,
      },
      schemaVersion: 1,
    });
    budgetCategoryId = bcNode.id;

    // Create a Contract entity.
    const contractNode = await graph.createNode({
      tenantId,
      profile: { tier1: "Transaction", profile: "wedding", concrete: "Contract" },
      identity: {
        state: "signed",
        amountMinor: 500_000,
        currency: "USD",
        effectiveDate: "2026-07-01",
      },
      schemaVersion: 1,
    });
    contractId = contractNode.id;

    // Wire: Contract → Vendor (the "VendorAssignment" edge).
    await graph.createEdge({
      tenantId,
      type: "wedding/contract_vendor",
      fromId: contractId,
      toId: vendorId,
      attrs: {},
    });

    // Wire: Vendor → BudgetCategory (the rollup topology edge).
    await graph.createEdge({
      tenantId,
      type: "wedding/vendor_budget_category",
      fromId: vendorId,
      toId: budgetCategoryId,
      attrs: {},
    });
  });

  afterAll(async () => {
    await events.close();
    await pool.query(`DELETE FROM budget.applied_payments WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Happy path
  // ---------------------------------------------------------------------------
  it("payment_recorded → increments actualSpentMinor and emits actual_spent_updated", async () => {
    const paymentId = `pay_${randomUUID().slice(0, 8)}`;
    const amount = 250_000; // $2,500.00

    await handler.handle(tenantId, {
      contractId,
      amount,
      paymentId,
      recordedAt: new Date().toISOString(),
    });

    // BudgetCategory.actualSpentMinor must be exactly `amount` (started at 0).
    const bc = await graph.getNode(tenantId, budgetCategoryId);
    expect(bc?.identity["actualSpentMinor"]).toBe(amount);

    // The outbound event must have been emitted with the correct payload.
    const evs = await events.read({
      tenantId,
      typePattern: "wedding.budget.actual_spent_updated",
      entityId: budgetCategoryId,
    });
    // We look at the most recent event (there may be one from this test only).
    const thisEv = evs.find((e) => e.payload["sourcePaymentId"] === paymentId);
    expect(thisEv).toBeDefined();
    expect(thisEv?.payload).toMatchObject({
      budgetCategoryId,
      delta: amount,
      newTotal: amount,
      sourcePaymentId: paymentId,
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Idempotency — same paymentId delivered twice
  // ---------------------------------------------------------------------------
  it("replaying the same paymentId does not double-count", async () => {
    // Read baseline (may include increment from Test 1).
    const bcBefore = await graph.getNode(tenantId, budgetCategoryId);
    const spentBefore = bcBefore?.identity["actualSpentMinor"] as number;

    const paymentId = `pay_idem_${randomUUID().slice(0, 8)}`;
    const amount = 100_000; // $1,000.00

    // First delivery — should succeed.
    await handler.handle(tenantId, {
      contractId,
      amount,
      paymentId,
      recordedAt: new Date().toISOString(),
    });

    // Second delivery with identical paymentId — must be a no-op.
    await handler.handle(tenantId, {
      contractId,
      amount,
      paymentId,
      recordedAt: new Date().toISOString(),
    });

    // actualSpentMinor increased by exactly `amount` once, not twice.
    const bcAfter = await graph.getNode(tenantId, budgetCategoryId);
    expect(bcAfter?.identity["actualSpentMinor"]).toBe(spentBefore + amount);

    // Only one actual_spent_updated event with this sourcePaymentId.
    const evs = await events.read({
      tenantId,
      typePattern: "wedding.budget.actual_spent_updated",
      entityId: budgetCategoryId,
    });
    const matching = evs.filter((e) => e.payload["sourcePaymentId"] === paymentId);
    expect(matching.length).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 3: No-vendor-link — contract with no outgoing vendor edge
  // ---------------------------------------------------------------------------
  it("contract with no vendor edge logs warning and skips rollup without throwing", async () => {
    // Create an orphan contract — no edges.
    const orphanNode = await graph.createNode({
      tenantId,
      profile: { tier1: "Transaction", profile: "wedding", concrete: "Contract" },
      identity: {
        state: "draft",
        amountMinor: 10_000,
        currency: "USD",
        effectiveDate: "2026-09-01",
      },
      schemaVersion: 1,
    });

    const bcBefore = await graph.getNode(tenantId, budgetCategoryId);
    const spentBefore = bcBefore?.identity["actualSpentMinor"] as number;

    // Must not throw.
    await expect(
      handler.handle(tenantId, {
        contractId: orphanNode.id,
        amount: 99_999,
        paymentId: `pay_orphan_${randomUUID().slice(0, 8)}`,
        recordedAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();

    // BudgetCategory unchanged.
    const bcAfter = await graph.getNode(tenantId, budgetCategoryId);
    expect(bcAfter?.identity["actualSpentMinor"]).toBe(spentBefore);
  });

  // ---------------------------------------------------------------------------
  // Test 4: Atomicity — if event publish fails, graph UPDATE rolls back too
  // ---------------------------------------------------------------------------
  it("if event publish fails, the graph rollup and applied_payments insert both roll back", async () => {
    const bcBefore = await graph.getNode(tenantId, budgetCategoryId);
    const spentBefore = bcBefore?.identity["actualSpentMinor"] as number;

    const atomicPaymentId = `pay_atom_${randomUUID().slice(0, 8)}`;
    const amount = 9_999_999; // Deliberately large — should never appear in totals.

    // Inject a failing event publisher. Throws after receiving the publishWith call,
    // simulating a constraint violation or network loss mid-transaction.
    const failingEvents = {
      publish: async (): Promise<never> => {
        throw new Error("simulated events.publish failure");
      },
      publishWith: async (): Promise<never> => {
        throw new Error("simulated events.publishWith failure");
      },
    };

    const failingHandler = new BudgetRollupHandler({
      pool,
      graph,
      events: failingEvents as unknown as import("@pm/events").EventPublisher,
      emittedBy: "wedding.budget.atomicity-test",
    });

    // The handler must propagate the error from publishWith.
    await expect(
      failingHandler.handle(tenantId, {
        contractId,
        amount,
        paymentId: atomicPaymentId,
        recordedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("simulated events.publishWith failure");

    // The graph node must be unchanged — the UPDATE was rolled back.
    const bcAfter = await graph.getNode(tenantId, budgetCategoryId);
    expect(bcAfter?.identity["actualSpentMinor"]).toBe(spentBefore);

    // The applied_payments row must not exist — the INSERT was rolled back.
    const res = await pool.query<{ payment_id: string }>(
      `SELECT payment_id FROM budget.applied_payments
        WHERE tenant_id = $1 AND payment_id = $2`,
      [tenantId, atomicPaymentId],
    );
    expect(res.rowCount).toBe(0);
  });
});

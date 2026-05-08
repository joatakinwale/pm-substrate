/**
 * G5.3 — Capability independence under provider drop.
 *
 * Closes G5 item 3 from pm-substrate-research-gap-audit-2026-05-05.md:
 *   "Negative test: uninstall/drop comms provider mid-flow; others continue."
 *
 * The audit phrasing names a "comms provider" because that was the abstract
 * example. In this codebase the same architectural rule is exercised with
 * the two real Tier-2 capabilities the wedding profile already ships:
 * @pm/capability-wedding-contracts and @pm/capability-wedding-budget.
 *
 * Claim under test: capabilities are independent. Unregistering one
 * capability mid-flow must not affect (a) other capabilities, (b) the
 * substrate, (c) prior events emitted by the unregistered capability.
 *
 * If unregistering capability A breaks capability B, or corrupts the
 * substrate, then capability A and B were not actually decoupled \u2014
 * they shared an implicit dependency through the registry, event log,
 * or graph that the architecture forbids.
 *
 * Scenario:
 *   1. Tenant provisioned with the wedding profile + both wedding
 *      capabilities (wedding.contracts and wedding.budget) registered.
 *   2. Run a contract lifecycle: draft \u2192 sign. Emits two events
 *      (wedding.contract.drafted, wedding.contract.signed).
 *   3. Run a budget rollup. Emits wedding.budget.actual_spent_updated.
 *   4. Unregister wedding.contracts. The capability descriptor is gone
 *      from registry.capabilities; the contracts service code itself
 *      still exists in process memory but the registry no longer
 *      acknowledges it.
 *   5. Run another budget rollup. Must work identically to step 3 \u2014
 *      same graph mutation, same event emission. The dropped capability
 *      cannot affect this one.
 *   6. Audit invariants:
 *      - registry.list returns only wedding.budget.
 *      - event log retains every event emitted before unregister
 *        (history is append-only; unregister does not vacuum).
 *      - the wedding.budget runtime is unchanged: same handler instance,
 *        same observable behavior.
 *      - the substrate primitives (graph, events) accept arbitrary
 *        typed events even for unregistered capabilities \u2014 the registry
 *        is a workflow concern, not a write gate on the event log.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresRegistry } from "@pm/registry";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import {
  WEDDING_CONTRACTS_CAPABILITY,
  WeddingContracts,
} from "@pm/capability-wedding-contracts";
import type { EntityId, TenantId } from "@pm/types";
import { WEDDING_BUDGET_CAPABILITY, BudgetRollupHandler } from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("G5.3 \u2014 capability independence under provider drop", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let capRegistry: PostgresRegistry;
  let profileRegistry: PostgresProfileRegistry;
  let budgetHandler: BudgetRollupHandler;
  let contracts: WeddingContracts;
  let tenantId: TenantId;

  let vendorId: EntityId;
  let budgetCategoryId: EntityId;
  let contractWithVendorId: EntityId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
    capRegistry = new PostgresRegistry(pool);

    tenantId = `tnt_g53_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, WEDDING_PROFILE);

    // Both capabilities registered up front.
    await capRegistry.register(tenantId, WEDDING_BUDGET_CAPABILITY);
    await capRegistry.register(tenantId, WEDDING_CONTRACTS_CAPABILITY);

    budgetHandler = new BudgetRollupHandler({
      pool,
      graph,
      events,
      emittedBy: "wedding.budget.test",
    });
    const validator = await profileRegistry.validator(tenantId);
    contracts = new WeddingContracts({
      pool,
      graph,
      events,
      validator,
      emittedBy: "wedding.contracts.test",
    });

    // Build a Vendor + BudgetCategory + topology so the budget rollup
    // has somewhere to land. The test contract used in step 5 lives
    // here too.
    const { node: vendorNode } = await graph.createNode({
      tenantId,
      profile: { tier1: "Counterparty", profile: "wedding", concrete: "Vendor" },
      identity: { name: "Sundown Florals", category: "florals" },
      schemaVersion: 1,
    });
    vendorId = vendorNode.id;

    const { node: bcNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Resource",
        profile: "wedding",
        concrete: "BudgetCategory",
      },
      identity: {
        name: "Florals",
        kind: "budget_category",
        allocatedMinor: 500_000,
        currency: "USD",
        actualSpentMinor: 0,
      },
      schemaVersion: 1,
    });
    budgetCategoryId = bcNode.id;

    // Persistent contract used by the budget rollups (independent of the
    // contracts service \u2014 we just need the graph topology).
    const { node: contractNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Transaction",
        profile: "wedding",
        concrete: "Contract",
      },
      identity: {
        state: "signed",
        amountMinor: 200_000,
        currency: "USD",
        effectiveDate: "2026-09-01",
      },
      schemaVersion: 1,
    });
    contractWithVendorId = contractNode.id;

    await graph.createEdge({
      tenantId,
      type: "wedding/contract_vendor",
      fromId: contractWithVendorId,
      toId: vendorId,
      attrs: {},
    });
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
    await pool.query(
      `DELETE FROM budget.applied_payments WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(
      `DELETE FROM events.subscriptions WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(
      `DELETE FROM registry.capabilities WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(
      `DELETE FROM profiles.installations WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("dropping one capability mid-flow does not affect the other or the substrate", async () => {
    // ---- Pre-flight: both capabilities are registered ----
    const preList = await capRegistry.list(tenantId);
    const preNames = preList.map((c) => c.name).sort();
    expect(preNames).toEqual(["wedding.budget", "wedding/contracts"]);

    // ---- Step 1: contracts flow (uses wedding-contracts capability) ----
    const draftedContractId = await contracts.draft({
      tenantId,
      amountMinor: 800_000,
      currency: "USD",
      effectiveDate: "2026-09-01",
    });
    await contracts.send(tenantId, draftedContractId);
    await contracts.sign(tenantId, draftedContractId);

    const contractEvents = await events.read({
      tenantId,
      typePattern: "wedding.contract.%",
    });
    const contractEventTypes = contractEvents
      .map((e) => e.type)
      .filter((t) => t.startsWith("wedding.contract."))
      .sort();
    expect(contractEventTypes).toContain("wedding.contract.drafted");
    expect(contractEventTypes).toContain("wedding.contract.signed");

    // ---- Step 2: first budget rollup, both capabilities registered ----
    await budgetHandler.handle(tenantId, {
      contractId: contractWithVendorId,
      amount: 100_000,
      paymentId: "g53_pay_pre",
      recordedAt: "2026-05-06T15:00:00Z",
    });

    const bcAfter1 = await graph.getNode(tenantId, budgetCategoryId);
    expect(bcAfter1?.identity["actualSpentMinor"]).toBe(100_000);

    const budgetEvents1 = await events.read({
      tenantId,
      typePattern: "wedding.budget.actual_spent_updated",
      entityId: budgetCategoryId,
    });
    expect(budgetEvents1.length).toBe(1);

    // Snapshot the event log size + contracts capability version before drop.
    const preDropEventCount = (
      await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM events.events WHERE tenant_id = $1`,
        [tenantId],
      )
    ).rows[0]!.count;
    const preDropContractsCap = await capRegistry.get(
      tenantId,
      "wedding/contracts",
    );
    expect(preDropContractsCap).not.toBeNull();

    // ---- Step 3: drop wedding/contracts ----
    await capRegistry.unregister(tenantId, "wedding/contracts");

    // Registry must reflect the drop.
    const postDropContractsCap = await capRegistry.get(
      tenantId,
      "wedding/contracts",
    );
    expect(postDropContractsCap).toBeNull();

    const postList = await capRegistry.list(tenantId);
    const postNames = postList.map((c) => c.name).sort();
    expect(postNames).toEqual(["wedding.budget"]);

    // ---- Step 4: budget rollup still works after drop ----
    await budgetHandler.handle(tenantId, {
      contractId: contractWithVendorId,
      amount: 50_000,
      paymentId: "g53_pay_post",
      recordedAt: "2026-05-06T15:01:00Z",
    });

    const bcAfter2 = await graph.getNode(tenantId, budgetCategoryId);
    expect(bcAfter2?.identity["actualSpentMinor"]).toBe(150_000); // 100k + 50k

    const budgetEvents2 = await events.read({
      tenantId,
      typePattern: "wedding.budget.actual_spent_updated",
      entityId: budgetCategoryId,
    });
    expect(budgetEvents2.length).toBe(2); // step 2 + step 4

    // ---- Step 5: prior contract events survive the drop ----
    // Unregistering a capability is a registry operation, not an event-log
    // operation. The append-only log must retain history regardless.
    const postDropContractEvents = await events.read({
      tenantId,
      typePattern: "wedding.contract.%",
    });
    const postDropContractTypes = postDropContractEvents
      .map((e) => e.type)
      .filter((t) => t.startsWith("wedding.contract."))
      .sort();
    expect(postDropContractTypes).toEqual(contractEventTypes);

    // ---- Step 6: substrate accepts events for the unregistered type ----
    // The event log is type-agnostic. The registry decides which capabilities
    // are *active*, not which event types are *valid*. Re-emitting a
    // wedding.contract.* event after the drop must succeed at the substrate
    // level (no handler will fire, but the write is accepted). This guards
    // against a regression where unregister becomes a hidden write-gate
    // \u2014 which would mean the registry has secretly grown coupling to
    // the event log.
    await events.publish({
      tenantId,
      type: "wedding.contract.synthetic_replay",
      entityId: draftedContractId,
      emittedBy: "g53.test",
      payloadSchema: "test/v1",
      payload: { note: "post-drop synthetic event \u2014 substrate must accept" },
    });

    const finalEventCount = (
      await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM events.events WHERE tenant_id = $1`,
        [tenantId],
      )
    ).rows[0]!.count;
    expect(parseInt(finalEventCount, 10)).toBeGreaterThan(
      parseInt(preDropEventCount, 10),
    );

    // ---- Step 7: budget rollup remains idempotent across the drop ----
    // Re-deliver the post-drop payment; must still be a no-op (the
    // applied_payments unique constraint owned by the budget capability
    // does not depend on the registry state of any other capability).
    await budgetHandler.handle(tenantId, {
      contractId: contractWithVendorId,
      amount: 50_000,
      paymentId: "g53_pay_post",
      recordedAt: "2026-05-06T15:02:00Z",
    });
    const bcAfter3 = await graph.getNode(tenantId, budgetCategoryId);
    expect(bcAfter3?.identity["actualSpentMinor"]).toBe(150_000); // unchanged

    const budgetEvents3 = await events.read({
      tenantId,
      typePattern: "wedding.budget.actual_spent_updated",
      entityId: budgetCategoryId,
    });
    expect(budgetEvents3.length).toBe(2); // unchanged from step 4
  });
});

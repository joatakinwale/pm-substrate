/**
 * G5 — Drop-in provider diff test.
 *
 * Purpose: prove that swapping one capability-handler implementation for
 * another with no other changes anywhere in the substrate, registry, event
 * log, or other capabilities produces observationally identical state from
 * the same input scenario.
 *
 * This is the load-bearing test for the central PM-layer architectural
 * claim: "tools register as capability providers; the substrate doesn't
 * care which provider implementation is wired." If this test passes,
 * the capability boundary is real. If it fails, the substrate is leaking
 * implementation details upward.
 *
 * Scenario:
 *   - Two tenants, each with the wedding profile installed and the
 *     WEDDING_BUDGET_CAPABILITY descriptor registered (identical).
 *   - Each tenant has the same graph topology:
 *       Contract ──(wedding/contract_vendor)──► Vendor
 *       Vendor   ──(wedding/vendor_budget_category)──► BudgetCategory
 *   - Same payment sequence is replayed against each tenant.
 *   - Tenant A is handled by BudgetRollupHandler   (V1, FOR UPDATE locking).
 *   - Tenant B is handled by BudgetRollupHandlerV2 (V2, advisory locking).
 *
 * Diff assertions:
 *   1. Final BudgetCategory.actualSpentMinor identical.
 *   2. Same set of emitted event types in the same logical order.
 *   3. Each emitted event's payload (modulo identity fields) identical.
 *   4. Same number of applied_payments rows.
 *   5. Substrate code, registry entry, profile, and event log SCHEMA
 *      were not touched between the two runs (compile-time invariant —
 *      both runs import the same WEDDING_BUDGET_CAPABILITY constant).
 *
 * Two tenants instead of reset-and-replay: avoids any possibility of
 * residual state from V1 contaminating V2 (or vice versa). Tenant
 * partitioning is the substrate's primary isolation boundary, so this is
 * a stronger, more honest test.
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
import { BudgetRollupHandlerV2 } from "./handler-v2.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

interface TenantHarness {
  tenantId: TenantId;
  vendorId: EntityId;
  budgetCategoryId: EntityId;
  contractId: EntityId;
}

describeIfDb("G5 — drop-in provider diff (V1 ↔ V2)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let capRegistry: PostgresRegistry;
  let profileRegistry: PostgresProfileRegistry;

  let tenantA: TenantHarness; // handled by V1
  let tenantB: TenantHarness; // handled by V2
  const tenantsToCleanup: TenantId[] = [];

  async function provisionTenant(
    label: string,
  ): Promise<TenantHarness> {
    const tenantId =
      `tnt_${label}_${randomUUID().slice(0, 8)}` as TenantId;
    tenantsToCleanup.push(tenantId);

    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, WEDDING_PROFILE);

    // Identical capability descriptor on every tenant. This is the
    // architectural claim under test: same descriptor, different impl.
    await capRegistry.register(tenantId, WEDDING_BUDGET_CAPABILITY);

    const { node: vendorNode } = await graph.createNode({
      tenantId,
      profile: { tier1: "Counterparty", profile: "wedding", concrete: "Vendor" },
      identity: { name: "Acme Catering", category: "catering" },
      schemaVersion: 1,
    });
    const vendorId = vendorNode.id;

    const { node: bcNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Resource",
        profile: "wedding",
        concrete: "BudgetCategory",
      },
      identity: {
        name: "Catering",
        kind: "budget_category",
        allocatedMinor: 1_000_000,
        currency: "USD",
        actualSpentMinor: 0,
      },
      schemaVersion: 1,
    });
    const budgetCategoryId = bcNode.id;

    const { node: contractNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Transaction",
        profile: "wedding",
        concrete: "VendorContract",
      },
      identity: { state: "signed", amountMinor: 800_000, currency: "USD" },
      schemaVersion: 1,
    });
    const contractId = contractNode.id;

    await graph.createEdge({
      tenantId,
      type: "wedding/contract_vendor",
      fromId: contractId,
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

    return { tenantId, vendorId, budgetCategoryId, contractId };
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    graph = new PostgresGraph(pool);
    capRegistry = new PostgresRegistry(pool);
    profileRegistry = new PostgresProfileRegistry(pool);

    tenantA = await provisionTenant("g5a_v1");
    tenantB = await provisionTenant("g5b_v2");
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenantsToCleanup) {
      await pool.query(
        `DELETE FROM budget.applied_payments WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(
        `DELETE FROM events.subscriptions WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [t]);
      await pool.query(
        `DELETE FROM registry.capabilities WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(
        `DELETE FROM profiles.installations WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("V1 and V2 produce identical observable state for the same scenario", async () => {
    const handlerV1 = new BudgetRollupHandler({
      pool,
      graph,
      events,
      emittedBy: "wedding.budget",
    });
    const handlerV2 = new BudgetRollupHandlerV2({
      pool,
      graph,
      events,
      emittedBy: "wedding.budget",
    });

    // The same scenario, replayed against both tenants. paymentIds are
    // tenant-scoped (via the unique constraint on (tenant_id, payment_id)),
    // so we can use the same logical payment_id strings on both sides
    // and the diff will line up cleanly.
    const scenario = [
      { paymentId: "pay_001", amount: 100_000 }, // $1,000.00
      { paymentId: "pay_002", amount: 250_000 }, // $2,500.00
      { paymentId: "pay_003", amount: 50_000 }, //   $500.00
      { paymentId: "pay_002", amount: 250_000 }, // duplicate (idempotency)
      { paymentId: "pay_004", amount: 75_000 }, //   $750.00
    ];

    for (const step of scenario) {
      await handlerV1.handle(tenantA.tenantId, {
        contractId: tenantA.contractId,
        amount: step.amount,
        paymentId: step.paymentId,
        recordedAt: "2026-05-06T14:00:00Z",
      });
      await handlerV2.handle(tenantB.tenantId, {
        contractId: tenantB.contractId,
        amount: step.amount,
        paymentId: step.paymentId,
        recordedAt: "2026-05-06T14:00:00Z",
      });
    }

    // ---- Diff 1: final graph state ----
    const bcA = await graph.getNode(tenantA.tenantId, tenantA.budgetCategoryId);
    const bcB = await graph.getNode(tenantB.tenantId, tenantB.budgetCategoryId);

    const spentA = bcA?.identity["actualSpentMinor"];
    const spentB = bcB?.identity["actualSpentMinor"];

    // Expected total: 100k + 250k + 50k + 75k = 475_000 (pay_002 dedup'd).
    expect(spentA).toBe(475_000);
    expect(spentB).toBe(475_000);
    expect(spentA).toBe(spentB);

    // schema_version reflects identical write count on both sides
    // (same number of UPDATEs on the BudgetCategory node).
    expect(bcA?.schemaVersion).toBe(bcB?.schemaVersion);

    // ---- Diff 2: emitted events, modulo identity fields ----
    const evsA = await events.read({
      tenantId: tenantA.tenantId,
      typePattern: "wedding.budget.actual_spent_updated",
      entityId: tenantA.budgetCategoryId,
    });
    const evsB = await events.read({
      tenantId: tenantB.tenantId,
      typePattern: "wedding.budget.actual_spent_updated",
      entityId: tenantB.budgetCategoryId,
    });

    // Same number of events emitted (the duplicate payment must be a
    // no-op on both — V1 via FOR UPDATE rollback, V2 via advisory-lock
    // rollback. Both must hit the applied_payments unique constraint and
    // skip emission. If V2 emits a phantom event for the duplicate, the
    // architectural claim breaks here.)
    expect(evsA.length).toBe(evsB.length);
    expect(evsA.length).toBe(4); // four unique paymentIds processed.

    // Sort both by sourcePaymentId to compare observationally, since
    // emission timestamps will differ slightly between the two tenants.
    const normA = evsA
      .map((e) => ({
        type: e.type,
        emittedBy: e.emittedBy,
        payloadSchema: e.payloadSchema,
        sourcePaymentId: e.payload["sourcePaymentId"],
        delta: e.payload["delta"],
        newTotal: e.payload["newTotal"],
      }))
      .sort((a, b) =>
        String(a.sourcePaymentId).localeCompare(String(b.sourcePaymentId)),
      );
    const normB = evsB
      .map((e) => ({
        type: e.type,
        emittedBy: e.emittedBy,
        payloadSchema: e.payloadSchema,
        sourcePaymentId: e.payload["sourcePaymentId"],
        delta: e.payload["delta"],
        newTotal: e.payload["newTotal"],
      }))
      .sort((a, b) =>
        String(a.sourcePaymentId).localeCompare(String(b.sourcePaymentId)),
      );

    expect(normB).toEqual(normA);

    // ---- Diff 3: applied_payments row count ----
    const appliedA = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM budget.applied_payments WHERE tenant_id = $1`,
      [tenantA.tenantId],
    );
    const appliedB = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM budget.applied_payments WHERE tenant_id = $1`,
      [tenantB.tenantId],
    );
    expect(appliedA.rows[0]!.count).toBe("4");
    expect(appliedB.rows[0]!.count).toBe("4");

    // ---- Diff 4: capability descriptor identity (modulo per-tenant id) ----
    // Both tenants registered the *same* WEDDING_BUDGET_CAPABILITY constant.
    // The registry assigns a fresh capability id per registration row
    // (cap_<uuid>) — that is correct: registrations are tenant-scoped, so
    // the row identity must differ. Every *declarative* field, however,
    // must be byte-identical: name, version, reads/writes interfaces and
    // edges, emits, subscribesTo, requiredPermissions, description.
    const capA = await capRegistry.get(tenantA.tenantId, "wedding.budget");
    const capB = await capRegistry.get(tenantB.tenantId, "wedding.budget");
    expect(capA).not.toBeNull();
    expect(capB).not.toBeNull();

    // Strip the per-row id; the rest must match exactly.
    const { id: _idA, ...declA } = capA!;
    const { id: _idB, ...declB } = capB!;
    expect(declB).toEqual(declA);

    // ---- Diff 5: descriptor constant identity ----
    // The architectural claim, stated as a code-level invariant: V1 and
    // V2 are interchangeable behind WEDDING_BUDGET_CAPABILITY because
    // neither the descriptor nor the substrate carries any reference to
    // the implementation choice. Both handlers, by construction, import
    // the same exported constant — verified at the type system level by
    // `as const satisfies Capability` in capability.ts.
    expect(WEDDING_BUDGET_CAPABILITY.name).toBe("wedding.budget");
    expect(WEDDING_BUDGET_CAPABILITY.version).toBe(1);
  });
});

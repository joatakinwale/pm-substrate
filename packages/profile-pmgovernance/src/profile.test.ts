import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry, ProfileValidationError } from "@pm/profile-registry";
import type { EntityId, TenantId } from "@pm/types";

import { PM_GOVERNANCE_PROFILE } from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("pm-governance profile: RACI + stage gates on the real substrate", () => {
  let pool: pg.Pool;
  let graph: PostgresGraph;
  let profileRegistry: PostgresProfileRegistry;
  let tenantId: TenantId;
  let initiativeId: EntityId;
  let workItemId: EntityId;
  let roleAId: EntityId;
  let roleBId: EntityId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    profileRegistry = new PostgresProfileRegistry(pool);
    tenantId = `tnt_pmgov_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, PM_GOVERNANCE_PROFILE);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });

    const initiative = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Engagement",
        profile: "pmgovernance",
        concrete: "Initiative",
      },
      identity: {
        title: "Governed launch",
        scopeStart: "2026-07-01T00:00:00.000Z",
        scopeEnd: null,
        state: "active",
      },
      schemaVersion: 1,
    });
    initiativeId = initiative.node.id;

    const workItem = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Engagement",
        profile: "pmgovernance",
        concrete: "WorkItem",
      },
      identity: {
        title: "Ship landing page",
        scopeStart: null,
        scopeEnd: null,
        state: "todo",
        priority: "p1",
      },
      schemaVersion: 1,
    });
    workItemId = workItem.node.id;

    const mkRole = async (name: string) =>
      (
        await graph.createNode({
          tenantId,
          profile: {
            tier1: "Resource",
            profile: "pmgovernance",
            concrete: "AgentRole",
          },
          identity: { name, kind: "agent" },
          schemaVersion: 1,
        })
      ).node.id;
    roleAId = await mkRole("agent-alpha");
    roleBId = await mkRole("agent-beta");

    await graph.createEdge({
      tenantId,
      type: "pmgovernance/part_of",
      fromId: workItemId,
      toId: initiativeId,
      attrs: {},
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("enforces single accountability: a second RACI 'A' edge is refused at write time", async () => {
    await graph.createEdge({
      tenantId,
      type: "pmgovernance/accountable_to",
      fromId: workItemId,
      toId: roleAId,
      attrs: {},
    });
    await expect(
      graph.createEdge({
        tenantId,
        type: "pmgovernance/accountable_to",
        fromId: workItemId,
        toId: roleBId,
        attrs: {},
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("allows unbounded RACI 'R' edges (responsible_for)", async () => {
    await graph.createEdge({
      tenantId,
      type: "pmgovernance/responsible_for",
      fromId: roleAId,
      toId: workItemId,
      attrs: {},
    });
    await graph.createEdge({
      tenantId,
      type: "pmgovernance/responsible_for",
      fromId: roleBId,
      toId: workItemId,
      attrs: {},
    });
    const edges = await graph.outgoingEdges(
      tenantId,
      roleAId,
      "pmgovernance/responsible_for",
    );
    expect(edges.length).toBeGreaterThan(0);
  });

  it("enforces stage-gate lifecycle legality via the profile validator", async () => {
    const validator = await profileRegistry.validator(tenantId);
    const binding = { tier1: "Engagement", profile: "pmgovernance", concrete: "WorkItem" } as const;
    // legal: in_review -> done
    expect(() =>
      validator.validateLifecycleTransition({
        tenantId,
        profile: binding,
        currentState: "in_review",
        proposedState: "done",
      }),
    ).not.toThrow();
    // illegal: todo -> done (skipping the gate)
    expect(() =>
      validator.validateLifecycleTransition({
        tenantId,
        profile: binding,
        currentState: "todo",
        proposedState: "done",
      }),
    ).toThrow();
  });

  it("rejects a WorkItem node missing required identity fields", async () => {
    await expect(
      graph.createNode({
        tenantId,
        profile: {
          tier1: "Engagement",
          profile: "pmgovernance",
          concrete: "WorkItem",
        },
        identity: { title: "incomplete" },
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  buildActionOutcomeEnvelope,
  stateRef,
  type ActionOutcomeEnvelope,
} from "@pm/agent-state-core";
import { PostgresEventStore } from "@pm/events";
import type { TenantId, Timestamp } from "@pm/types";

import {
  EXECUTOR_DISPATCHED_EVENT_TYPE,
  executeAdmittedAction,
} from "./executor-bridge.js";
import { buildLiquidWriteTransport } from "./liquid-executor.js";
import type { LiquidMcpClient } from "./liquid-source.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const now = (): Timestamp => new Date().toISOString() as Timestamp;

function envelope(
  tenantId: TenantId,
  outcome: "accepted" | "blocked",
): ActionOutcomeEnvelope {
  return buildActionOutcomeEnvelope({
    tenantId,
    actionId: `act_${randomUUID().slice(0, 8)}`,
    subject: stateRef("projection", "liquid_exec_subject", "fixture"),
    proposalReviewId: `rev_${randomUUID().slice(0, 8)}`,
    stateReviewArtifactHash: "hash_fixture",
    requestedTerminalOutcome: "accepted",
    decidedAt: now(),
    decidedBy: "liquid-exec-test",
    ...(outcome === "blocked"
      ? {
          blockingCauses: [
            {
              source: "proposal_review",
              code: "stale_basis",
              message: "fixture",
              refs: [],
            },
          ],
        }
      : {}),
  });
}

function fakeSidecar(opts?: { failExecute?: boolean }): {
  client: LiquidMcpClient;
  calls: { name: string; arguments: Record<string, unknown> }[];
} {
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];
  return {
    calls,
    client: {
      async callTool(params) {
        calls.push(params);
        if (params.name === "liquid_connect") {
          return {
            structuredContent: { status: "connected", adapter_id: "adp_db" },
          };
        }
        if (params.name === "liquid_execute") {
          return opts?.failExecute
            ? { isError: true, content: [{ type: "text", text: "write refused" }] }
            : {
                structuredContent: { success: true, op: "insert", affected_rows: 1 },
              };
        }
        throw new Error(`unexpected tool ${params.name}`);
      },
    },
  };
}

describeIfDb("liquid executor target (lane L4)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_lexe_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    events = new PostgresEventStore(pool);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  const target = {
    name: "orbit_db",
    endpoint: "postgresql://reader@db.internal/shop",
  };

  it("a blocked envelope never reaches the sidecar", async () => {
    const { client, calls } = fakeSidecar();
    const result = await executeAdmittedAction(events, {
      tenantId,
      envelope: envelope(tenantId, "blocked"),
      target,
      executedBy: "liquid-exec-test",
      transport: buildLiquidWriteTransport(client, {
        url: target.endpoint,
        targetModel: { email: "str", total_cents: "int" },
        endpoint: "/public/orders",
        op: "insert",
      }),
    });
    expect(result).toEqual({ executed: false, reason: "not_accepted" });
    expect(calls).toHaveLength(0);
  });

  it("an accepted envelope writes once through liquid_execute, deduped on replay", async () => {
    const { client, calls } = fakeSidecar();
    const env = envelope(tenantId, "accepted");
    const transport = buildLiquidWriteTransport(client, {
      url: target.endpoint,
      targetModel: { email: "str", total_cents: "int" },
      endpoint: "/public/orders",
      op: "insert",
    });
    const first = await executeAdmittedAction(events, {
      tenantId,
      envelope: env,
      target,
      executedBy: "liquid-exec-test",
      body: {
        values: { email: "a@b.example", total_cents: 9900 },
      },
      transport,
    });
    expect(first).toMatchObject({ executed: true, reason: "dispatched" });
    expect(first.httpStatus).toBeUndefined(); // non-HTTP leg
    const exec = calls.find((c) => c.name === "liquid_execute");
    expect(exec?.arguments).toEqual({
      adapter_id: "adp_db",
      op: "insert",
      endpoint: "/public/orders",
      values: { email: "a@b.example", total_cents: 9900 },
    });

    const replay = await executeAdmittedAction(events, {
      tenantId,
      envelope: env,
      target,
      executedBy: "liquid-exec-test",
      transport,
    });
    expect(replay).toEqual({ executed: false, reason: "already_dispatched" });
    expect(calls.filter((c) => c.name === "liquid_execute")).toHaveLength(1);

    const receipts = await events.read({
      tenantId,
      typePattern: EXECUTOR_DISPATCHED_EVENT_TYPE,
    });
    expect(receipts).toHaveLength(1);
  });

  it("a refused write records failure and stays retryable", async () => {
    const failing = fakeSidecar({ failExecute: true });
    const env = envelope(tenantId, "accepted");
    const result = await executeAdmittedAction(events, {
      tenantId,
      envelope: env,
      target,
      executedBy: "liquid-exec-test",
      body: { values: { email: "x@y.example" } },
      transport: buildLiquidWriteTransport(failing.client, {
        url: target.endpoint,
        targetModel: { email: "str" },
        op: "insert",
      }),
    });
    expect(result).toMatchObject({ executed: false, reason: "endpoint_error" });

    const healthy = fakeSidecar();
    const retried = await executeAdmittedAction(events, {
      tenantId,
      envelope: env,
      target,
      executedBy: "liquid-exec-test",
      body: { values: { email: "x@y.example" } },
      transport: buildLiquidWriteTransport(healthy.client, {
        url: target.endpoint,
        targetModel: { email: "str" },
        op: "insert",
      }),
    });
    expect(retried).toMatchObject({ executed: true, reason: "dispatched" });
  });
});

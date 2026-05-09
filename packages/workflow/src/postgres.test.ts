/**
 * Integration tests for PostgresWorkflowRuntime against the running dev DB.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type {
  CapabilityId,
  EventId,
  TenantId,
  WorkflowId,
} from "@pm/types";
import { PostgresEventStore } from "@pm/events";
import { PostgresRegistry } from "@pm/registry";
import { PostgresWorkflowRuntime } from "./postgres.js";
import { WorkflowValidationError } from "./errors.js";
import type {
  InvocationContext,
  InvocationDispatcher,
  InvocationResult,
  WorkflowDoc,
} from "./interfaces.js";
import type {
  PermissionAuthorizer,
  PermissionCheck,
  PermissionDecision,
} from "./permissions.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

class RecordingDispatcher implements InvocationDispatcher {
  readonly calls: InvocationContext[] = [];
  readonly responses = new Map<string, InvocationResult>();

  setResponse(capability: string, response: InvocationResult): void {
    this.responses.set(capability, response);
  }

  async invoke(ctx: InvocationContext): Promise<InvocationResult> {
    this.calls.push(ctx);
    return (
      this.responses.get(ctx.capability) ?? {
        success: true,
        result: { ok: true },
      }
    );
  }
}

class RecordingAuthorizer implements PermissionAuthorizer {
  readonly calls: PermissionCheck[] = [];
  decision: PermissionDecision = { allowed: true };

  async authorize(ctx: PermissionCheck): Promise<PermissionDecision> {
    this.calls.push(ctx);
    return this.decision;
  }
}

describeIfDb("PostgresWorkflowRuntime", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let registry: PostgresRegistry;

  const tenants: TenantId[] = [];
  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_test_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    tenants.push(id);
    return id;
  };

  const registerCap = async (
    tenantId: TenantId,
    name: string,
    requiredPermissions: readonly string[] = [],
  ): Promise<void> => {
    await registry.register(tenantId, {
      id: `cap_${randomUUID()}` as CapabilityId,
      name,
      version: 1,
      readsInterfaces: [], writesInterfaces: [],
      readsEdges: [], writesEdges: [],
      emits: [], subscribesTo: [], requiredPermissions,
      description: "",
    });
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    registry = new PostgresRegistry(pool);
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM workflow.run_steps WHERE run_id IN (SELECT id FROM workflow.runs WHERE tenant_id = $1)`, [t]);
      await pool.query(`DELETE FROM workflow.runs WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM workflow.workflows WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("install rejects workflows referencing unknown capabilities", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({
      pool, registry, events, dispatcher,
    });

    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "test", version: 1,
      nodes: [
        { nodeId: "trig", kind: "trigger", on: "x.created" },
        { nodeId: "do", kind: "invoke", capability: "missing/cap", inputs: {} },
      ],
      edges: [{ from: "trig", to: "do" }],
    };
    await expect(runtime.install(doc)).rejects.toBeInstanceOf(WorkflowValidationError);
  });

  it("install rejects duplicate node IDs and dangling edges", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "test/cap");

    const dupNodes: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "dup", version: 1,
      nodes: [
        { nodeId: "n", kind: "trigger", on: "x" },
        { nodeId: "n", kind: "invoke", capability: "test/cap", inputs: {} },
      ],
      edges: [],
    };
    await expect(runtime.install(dupNodes)).rejects.toBeInstanceOf(WorkflowValidationError);

    const dangling: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "dangle", version: 1,
      nodes: [{ nodeId: "n", kind: "trigger", on: "x" }],
      edges: [{ from: "n", to: "missing" }],
    };
    await expect(runtime.install(dangling)).rejects.toBeInstanceOf(WorkflowValidationError);
  });

  it("install rejects workflows whose edges form a cycle (G8.1)", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "test/cap");

    const cyclic: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId,
      name: "cyclic",
      version: 1,
      nodes: [
        { nodeId: "trig", kind: "trigger", on: "x.created" },
        { nodeId: "a", kind: "invoke", capability: "test/cap", inputs: {} },
        { nodeId: "b", kind: "invoke", capability: "test/cap", inputs: {} },
      ],
      edges: [
        { from: "trig", to: "a" },
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    };
    await expect(runtime.install(cyclic)).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    await expect(runtime.install(cyclic)).rejects.toThrow(/cycle/);
  });

  it("install is idempotent for the same (tenant,name,version,doc) (G8.2)", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "test/cap");
    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId,
      name: "idem",
      version: 1,
      nodes: [
        { nodeId: "trig", kind: "trigger", on: "x.created" },
        { nodeId: "a", kind: "invoke", capability: "test/cap", inputs: {} },
      ],
      edges: [{ from: "trig", to: "a" }],
    };
    await runtime.install(doc);
    // Same doc, second install — must succeed silently and leave the row enabled.
    await runtime.install(doc);
    const r = await pool.query(
      `SELECT enabled, doc FROM workflow.workflows
        WHERE tenant_id=$1 AND name=$2 AND version=$3`,
      [tenantId, "idem", 1],
    );
    expect(r.rowCount).toBe(1);
    expect(r.rows[0]!.enabled).toBe(true);
  });

  it("install rejects mutating an existing (tenant,name,version) with a different doc (G8.2)", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "test/cap");
    const v1: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId,
      name: "immut",
      version: 1,
      nodes: [
        { nodeId: "trig", kind: "trigger", on: "x.created" },
        { nodeId: "a", kind: "invoke", capability: "test/cap", inputs: {} },
      ],
      edges: [{ from: "trig", to: "a" }],
    };
    await runtime.install(v1);
    // Same name+version, different doc (extra node). Must reject.
    const v1Mutated: WorkflowDoc = {
      ...v1,
      id: `wf_${randomUUID()}` as WorkflowId,
      nodes: [
        ...v1.nodes,
        { nodeId: "b", kind: "invoke", capability: "test/cap", inputs: {} },
      ],
      edges: [...v1.edges, { from: "a", to: "b" }],
    };
    await expect(runtime.install(v1Mutated)).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    await expect(runtime.install(v1Mutated)).rejects.toThrow(/immutable/);
    // Bumping the version is the legal path.
    const v2: WorkflowDoc = { ...v1Mutated, version: 2 };
    await expect(runtime.install(v2)).resolves.toBeUndefined();
  });

  it("runs are pinned to the workflow version + doc snapshot at creation (G8.2)", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "test/cap");
    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId,
      name: "pinned",
      version: 7,
      nodes: [
        { nodeId: "trig", kind: "trigger", on: "x.created" },
        { nodeId: "a", kind: "invoke", capability: "test/cap", inputs: {} },
      ],
      edges: [{ from: "trig", to: "a" }],
    };
    await runtime.install(doc);
    // Emit a triggering event.
    const ev = await events.publish({
      tenantId,
      type: "x.created",
      entityId: "ent_x_1",
      emittedBy: "test/harness",
      payloadSchema: "x.created/v1",
      payload: { hello: "world" },
    });
    await runtime.onEvent(tenantId, ev.id);
    // Inspect the run row.
    const r = await pool.query(
      `SELECT workflow_version, workflow_doc
         FROM workflow.runs
        WHERE tenant_id=$1 AND workflow_id=$2`,
      [tenantId, doc.id],
    );
    expect(r.rowCount).toBe(1);
    expect(r.rows[0]!.workflow_version).toBe(7);
    // workflow_doc snapshot must equal the installed doc.
    expect(r.rows[0]!.workflow_doc).toMatchObject({
      name: "pinned",
      version: 7,
    });
    expect((r.rows[0]!.workflow_doc as WorkflowDoc).nodes.length).toBe(2);
  });

  it("walks the DAG and records run + steps when an event matches a trigger", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });

    await registerCap(tenantId, "calendar/confirm");
    await registerCap(tenantId, "comms/notify");

    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "contract-flow", version: 1,
      nodes: [
        { nodeId: "trig", kind: "trigger", on: "contract.signed" },
        {
          nodeId: "confirm", kind: "invoke",
          capability: "calendar/confirm",
          inputs: { vendorId: "$trigger.payload.vendorId" },
        },
        {
          nodeId: "notify", kind: "invoke",
          capability: "comms/notify",
          inputs: { confirmedAt: "$nodes.confirm.confirmedAt" },
        },
      ],
      edges: [
        { from: "trig", to: "confirm" },
        { from: "confirm", to: "notify" },
      ],
    };
    await runtime.install(doc);

    dispatcher.setResponse("calendar/confirm", {
      success: true, result: { confirmedAt: "2026-05-03T19:00:00Z" },
    });

    const ev = await events.publish({
      tenantId,
      type: "contract.signed",
      entityId: "ent_contract",
      emittedBy: "cap.contracts",
      payloadSchema: "contract.signed/v1",
      payload: { vendorId: "ent_vendor_42" },
    });
    await runtime.onEvent(tenantId, ev.id);

    expect(dispatcher.calls.map((c) => c.capability)).toEqual([
      "calendar/confirm", "comms/notify",
    ]);
    expect(dispatcher.calls[0]?.inputs).toEqual({ vendorId: "ent_vendor_42" });
    expect(dispatcher.calls[1]?.inputs).toEqual({ confirmedAt: "2026-05-03T19:00:00Z" });

    const runs = await pool.query(
      `SELECT status FROM workflow.runs WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(runs.rows[0]?.status).toBe("completed");

    const steps = await pool.query(
      `SELECT node_id, status FROM workflow.run_steps
       WHERE run_id IN (SELECT id FROM workflow.runs WHERE tenant_id = $1)
       ORDER BY node_id`,
      [tenantId],
    );
    const map = Object.fromEntries(
      steps.rows.map((r: { node_id: string; status: string }) => [r.node_id, r.status]),
    );
    expect(map.confirm).toBe("completed");
    expect(map.notify).toBe("completed");
  });

  it("authorizes each invoke node before dispatch", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const authorizer = new RecordingAuthorizer();
    const runtime = new PostgresWorkflowRuntime({
      pool, registry, events, dispatcher, authorizer,
    });
    await registerCap(tenantId, "secure/cap", ["secure.write"]);

    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "auth-allow", version: 1,
      nodes: [
        { nodeId: "t", kind: "trigger", on: "secure.fire" },
        { nodeId: "n", kind: "invoke", capability: "secure/cap", inputs: {} },
      ],
      edges: [{ from: "t", to: "n" }],
    };
    await runtime.install(doc);

    const ev = await events.publish({
      tenantId, type: "secure.fire", entityId: "e",
      emittedBy: "agent.runtime", payloadSchema: "v1", payload: {},
    });
    await runtime.onEvent(tenantId, ev.id);

    expect(authorizer.calls).toHaveLength(1);
    expect(authorizer.calls[0]).toMatchObject({
      tenantId,
      workflowName: "auth-allow",
      workflowVersion: 1,
      nodeId: "n",
      capability: "secure/cap",
      requiredPermissions: ["secure.write"],
    });
    expect(dispatcher.calls.map((c) => c.capability)).toEqual(["secure/cap"]);
  });

  it("fails the step and does not dispatch when authorization denies", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const authorizer = new RecordingAuthorizer();
    authorizer.decision = { allowed: false, reason: "missing secure.write" };
    const runtime = new PostgresWorkflowRuntime({
      pool, registry, events, dispatcher, authorizer,
    });
    await registerCap(tenantId, "secure/cap", ["secure.write"]);

    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "auth-deny", version: 1,
      nodes: [
        { nodeId: "t", kind: "trigger", on: "secure.fire" },
        { nodeId: "n", kind: "invoke", capability: "secure/cap", inputs: {} },
      ],
      edges: [{ from: "t", to: "n" }],
    };
    await runtime.install(doc);

    const ev = await events.publish({
      tenantId, type: "secure.fire", entityId: "e",
      emittedBy: "agent.runtime", payloadSchema: "v1", payload: {},
    });
    await runtime.onEvent(tenantId, ev.id);

    expect(authorizer.calls).toHaveLength(1);
    expect(dispatcher.calls).toEqual([]);

    const run = await pool.query<{ status: string }>(
      `SELECT status FROM workflow.runs WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(run.rows[0]?.status).toBe("failed");

    const step = await pool.query<{ status: string; result: Record<string, unknown> }>(
      `SELECT status, result FROM workflow.run_steps
        WHERE run_id IN (SELECT id FROM workflow.runs WHERE tenant_id = $1)
          AND node_id = 'n'`,
      [tenantId],
    );
    expect(step.rows[0]?.status).toBe("failed");
    expect(step.rows[0]?.result).toMatchObject({
      error: "permission_denied",
      reason: "missing secure.write",
      requiredPermissions: ["secure.write"],
    });
  });

  it("is idempotent: same trigger event re-delivered does not re-run", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "noop/cap");

    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "idem", version: 1,
      nodes: [
        { nodeId: "t", kind: "trigger", on: "ping.fired" },
        { nodeId: "n", kind: "invoke", capability: "noop/cap", inputs: {} },
      ],
      edges: [{ from: "t", to: "n" }],
    };
    await runtime.install(doc);

    const ev = await events.publish({
      tenantId, type: "ping.fired", entityId: "e",
      emittedBy: "x", payloadSchema: "v1", payload: {},
    });

    await runtime.onEvent(tenantId, ev.id);
    await runtime.onEvent(tenantId, ev.id);
    await runtime.onEvent(tenantId, ev.id);

    expect(dispatcher.calls.length).toBe(1);
    const r = await pool.query<{ c: string }>(
      `SELECT count(*)::text c FROM workflow.runs WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(r.rows[0]?.c).toBe("1");
  });

  it("stops a run and marks it failed when a capability returns success=false", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "step/a");
    await registerCap(tenantId, "step/b");
    await registerCap(tenantId, "step/c");

    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "fail", version: 1,
      nodes: [
        { nodeId: "t", kind: "trigger", on: "x.go" },
        { nodeId: "a", kind: "invoke", capability: "step/a", inputs: {} },
        { nodeId: "b", kind: "invoke", capability: "step/b", inputs: {} },
        { nodeId: "c", kind: "invoke", capability: "step/c", inputs: {} },
      ],
      edges: [
        { from: "t", to: "a" },
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    };
    await runtime.install(doc);

    dispatcher.setResponse("step/b", { success: false, result: {}, error: "boom" });

    const ev = await events.publish({
      tenantId, type: "x.go", entityId: "e",
      emittedBy: "x", payloadSchema: "v1", payload: {},
    });
    await runtime.onEvent(tenantId, ev.id);

    expect(dispatcher.calls.map((c) => c.capability)).toEqual(["step/a", "step/b"]);

    const r = await pool.query(
      `SELECT status FROM workflow.runs WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(r.rows[0]?.status).toBe("failed");
  });

  it("conditional `when` skips downstream nodes when expression is falsy", async () => {
    const tenantId = await makeTenant();
    const dispatcher = new RecordingDispatcher();
    const runtime = new PostgresWorkflowRuntime({ pool, registry, events, dispatcher });
    await registerCap(tenantId, "first/cap");
    await registerCap(tenantId, "guarded/cap");

    const doc: WorkflowDoc = {
      id: `wf_${randomUUID()}` as WorkflowId,
      tenantId, name: "guard", version: 1,
      nodes: [
        { nodeId: "t", kind: "trigger", on: "g.fire" },
        { nodeId: "first", kind: "invoke", capability: "first/cap", inputs: {} },
        { nodeId: "guarded", kind: "invoke", capability: "guarded/cap", inputs: {} },
      ],
      edges: [
        { from: "t", to: "first" },
        { from: "first", to: "guarded", when: "$nodes.first.shouldRun" },
      ],
    };
    await runtime.install(doc);

    dispatcher.setResponse("first/cap", { success: true, result: { shouldRun: false } });

    const ev = await events.publish({
      tenantId, type: "g.fire", entityId: "e",
      emittedBy: "x", payloadSchema: "v1", payload: {},
    });
    await runtime.onEvent(tenantId, ev.id);

    expect(dispatcher.calls.map((c) => c.capability)).toEqual(["first/cap"]);

    const steps = await pool.query<{ node_id: string; status: string }>(
      `SELECT node_id, status FROM workflow.run_steps
        WHERE run_id IN (SELECT id FROM workflow.runs WHERE tenant_id = $1)`,
      [tenantId],
    );
    const map = Object.fromEntries(steps.rows.map((r) => [r.node_id, r.status]));
    expect(map.guarded).toBe("skipped");
  });
});

/**
 * Integration tests for the substrate HTTP layer.
 *
 * Exercise: profile install → capability register → node create → edge
 * create (cardinality enforced) → event publish → event read → projection
 * catch-up. The same cross-tool flow that drives the ArrowHedge agent-state
 * scenario, exercised end-to-end through HTTP.
 *
 * No domain semantics in these tests. Every assertion is about substrate
 * behavior over HTTP, not finance behavior. (Finance-specific tests live
 * with @pm/capability-finance-research-ingest.)
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
import { PostgresTenantDirectory } from "@pm/tenants";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import { auditProjection, AUDIT_CAPABILITY } from "@pm/capability-audit";
import { stateRef } from "@pm/agent-state-core";
import {
  PostgresProcedureAdmissionStore,
  ProcedureAdmissionRuntime,
  type ProcedureRunnerPort,
} from "@pm/procedure-admission";
import type { TenantId } from "@pm/types";
import { createSubstrateApp } from "./app.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("substrate HTTP", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let tenantsDirectory: PostgresTenantDirectory;
  let profileRegistry: PostgresProfileRegistry;
  let capRegistry: PostgresRegistry;
  let projections: PostgresProjectionRunner;
  let procedureAdmissionRuntime: ProcedureAdmissionRuntime;
  let app: Hono;

  const tenants: TenantId[] = [];
  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_http_${randomUUID().slice(0, 8)}` as TenantId;
    await tenantsDirectory.create({ id, displayName: id });
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    tenantsDirectory = new PostgresTenantDirectory(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
    capRegistry = new PostgresRegistry(pool);
    projections = new PostgresProjectionRunner(pool, events);
    await projections.register(auditProjection);
    const procedureRunner: ProcedureRunnerPort = {
      runnerKind: "pi_harness",
      async run(invocation) {
        const stale =
          typeof invocation.input === "object" &&
          invocation.input !== null &&
          (invocation.input as { stale?: unknown }).stale === true;
        return {
          status: "succeeded",
          completedAt: "2026-07-02T21:03:00.000Z",
          outputHash: "sha256:http-procedure-output",
          outputEvidence: [
            {
              ref: stateRef("document", "doc_http_procedure_output"),
              evidenceHash: "sha256:http-procedure-output-evidence",
              observedAt: "2026-07-02T21:03:00.000Z",
              validUntil: "2026-07-02T22:00:00.000Z",
            },
          ],
          runnerEvidence: [
            {
              ref: stateRef("event", "evt_http_pi_harness_runner"),
              evidenceHash: "sha256:http-pi-harness-runner",
              observedAt: "2026-07-02T21:03:00.000Z",
              validUntil: stale
                ? "2026-07-02T21:00:00.000Z"
                : "2026-07-02T22:00:00.000Z",
            },
          ],
        };
      },
    };
    procedureAdmissionRuntime = new ProcedureAdmissionRuntime({
      store: new PostgresProcedureAdmissionStore(pool),
      runners: [procedureRunner],
      admittedBy: "substrate-http.procedure-admission",
    });

    app = createSubstrateApp({
      tenants: tenantsDirectory,
      profileRegistry,
      capabilityRegistry: capRegistry,
      graph,
      events,
      projections,
      procedureAdmissionRuntime,
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
      await pool.query(`DELETE FROM procedure_admission.admission_records WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM procedure_admission.definitions WHERE tenant_id = $1`, [t]);
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

  it("G9: onboards, updates, archives, and restores a tenant through HTTP", async () => {
    const tenantId = `tnt_http_onboard_${randomUUID().slice(0, 8)}` as TenantId;
    tenants.push(tenantId);

    let r = await call("POST", "/tenants", {
      id: tenantId,
      displayName: "Acme Operations",
      metadata: { source: "api", externalCustomerId: "cus_test" },
    });
    expect(r.status).toBe(201);
    let body = (await r.json()) as { tenant: { id: string; displayName: string; metadata: Record<string, unknown>; archivedAt: string | null } };
    expect(body.tenant.id).toBe(tenantId);
    expect(body.tenant.metadata).toMatchObject({ source: "api" });
    expect(body.tenant.archivedAt).toBeNull();

    r = await call("GET", `/tenants/${tenantId}`);
    expect(r.status).toBe(200);

    r = await call("PATCH", `/tenants/${tenantId}`, {
      displayName: "Acme Ops Updated",
      metadata: { source: "api", plan: "pilot" },
    });
    expect(r.status).toBe(200);
    body = (await r.json()) as typeof body;
    expect(body.tenant.displayName).toBe("Acme Ops Updated");
    expect(body.tenant.metadata).toMatchObject({ plan: "pilot" });

    r = await call("POST", `/tenants/${tenantId}/archive`);
    expect(r.status).toBe(200);
    body = (await r.json()) as typeof body;
    expect(body.tenant.archivedAt).toBeTruthy();

    r = await call("GET", "/tenants");
    const active = (await r.json()) as { tenants: Array<{ id: string }> };
    expect(active.tenants.map((t) => t.id)).not.toContain(tenantId);

    r = await call("GET", "/tenants?includeArchived=true");
    const all = (await r.json()) as { tenants: Array<{ id: string }> };
    expect(all.tenants.map((t) => t.id)).toContain(tenantId);

    r = await call("POST", `/tenants/${tenantId}/restore`);
    expect(r.status).toBe(200);
    body = (await r.json()) as typeof body;
    expect(body.tenant.archivedAt).toBeNull();
  });

  it("install profile + list + get + delete", async () => {
    const tenantId = await makeTenant();
    let r = await call("POST", `/tenants/${tenantId}/profiles`, FINANCE_RESEARCH_PROFILE);
    expect(r.status).toBe(200);

    r = await call("GET", `/tenants/${tenantId}/profiles`);
    const list = (await r.json()) as { profiles: Array<{ name: string }> };
    expect(list.profiles.map((p) => p.name)).toContain("finance-research");

    r = await call("GET", `/tenants/${tenantId}/profiles/finance-research`);
    expect(r.status).toBe(200);
    const got = (await r.json()) as { name: string };
    expect(got.name).toBe("finance-research");

    r = await call("DELETE", `/tenants/${tenantId}/profiles/finance-research`);
    expect(r.status).toBe(200);

    r = await call("GET", `/tenants/${tenantId}/profiles/finance-research`);
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
    await call("POST", `/tenants/${tenantId}/profiles`, FINANCE_RESEARCH_PROFILE);

    // Create an AnalystSignal + 2 Tickers
    const mk = async (binding: { tier1: string; profile: string; concrete: string }, identity: Record<string, unknown>) => {
      const r = await call("POST", `/tenants/${tenantId}/nodes`, {
        profile: binding,
        identity,
        schemaVersion: 1,
      });
      expect(r.status).toBe(201);
      const node = (await r.json()) as { id: string };
      return node.id;
    };
    const sid = await mk(
      { tier1: "Event", profile: "finance-research", concrete: "AnalystSignal" },
      {
        kind: "analyst_signal",
        occurredAt: "2026-06-03T14:00:00.000Z",
        agentId: "agent:analyst_momentum",
        signal: "bullish",
        confidence: 0.8,
      },
    );
    const t1 = await mk(
      { tier1: "Resource", profile: "finance-research", concrete: "Ticker" },
      { name: "AAPL ticker", kind: "ticker", symbol: "AAPL", assetClass: "equity", currency: "USD" },
    );
    const t2 = await mk(
      { tier1: "Resource", profile: "finance-research", concrete: "Ticker" },
      { name: "MSFT ticker", kind: "ticker", symbol: "MSFT", assetClass: "equity", currency: "USD" },
    );

    // The first signal_for_ticker edge succeeds.
    let r = await call("POST", `/tenants/${tenantId}/edges`, {
      type: "finance-research/signal_for_ticker", fromId: sid, toId: t1, attrs: {},
    });
    expect(r.status).toBe(200);

    // A second must be rejected with 422 (ProfileValidationError → 422):
    // a signal targets exactly one ticker.
    r = await call("POST", `/tenants/${tenantId}/edges`, {
      type: "finance-research/signal_for_ticker", fromId: sid, toId: t2, attrs: {},
    });
    expect(r.status).toBe(422);
    const err = (await r.json()) as { error: string };
    expect(err.error).toMatch(/exactly:1/);
  });

  it("publish events + read + getById + verify chain", async () => {
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

    r = await call("GET", `/tenants/${tenantId}/events/verify-chain`);
    expect(r.status).toBe(200);
    const verify = (await r.json()) as { report: { valid: boolean; checked: number } };
    expect(verify.report.valid).toBe(true);
    expect(verify.report.checked).toBeGreaterThanOrEqual(1);
  });

  it("registers and executes a procedure through HTTP while replay remains the operational state", async () => {
    const tenantId = await makeTenant();
    let r = await call("POST", `/tenants/${tenantId}/procedures/definitions`, {
      procedureId: "proc_http_pi_harness",
      version: 1,
      name: "HTTP Pi Harness procedure",
      authorityScope: "pmgovernance/http-procedure-admission",
      runnerKind: "pi_harness",
      inputContractHash: "sha256:http-procedure-input-contract",
      outputContractHash: "sha256:http-procedure-output-contract",
      allowedUse: ["pm.stage_gate.validate"],
      createdAt: "2026-07-02T21:00:00.000Z",
    });
    expect(r.status).toBe(201);
    const registered = (await r.json()) as {
      definition: { definitionHash: string };
    };
    expect(registered.definition.definitionHash).toMatch(/^[a-f0-9]{64}$/);

    r = await call(
      "POST",
      `/tenants/${tenantId}/procedures/proc_http_pi_harness/versions/1/runs`,
      {
        runId: "run_http_pi_harness_001",
        requestedBy: "agent:http-test",
        inputHash: "sha256:http-procedure-input",
        inputEvidence: [
          {
            ref: stateRef("document", "doc_http_procedure_input"),
            evidenceHash: "sha256:http-procedure-input-evidence",
            observedAt: "2026-07-02T21:01:00.000Z",
            validUntil: "2026-07-02T22:00:00.000Z",
          },
        ],
        startedAt: "2026-07-02T21:02:00.000Z",
        evaluatedAt: "2026-07-02T21:03:00.000Z",
      },
    );
    expect(r.status).toBe(201);
    const admitted = (await r.json()) as {
      record: { sequence: number; admissionHash: string };
      replay: { admittedRuns: Array<{ runId: string }>; currentHeadHash: string };
    };
    expect(admitted.record.sequence).toBe(1);
    expect(admitted.replay.admittedRuns.map((run) => run.runId)).toEqual([
      "run_http_pi_harness_001",
    ]);
    expect(admitted.replay.currentHeadHash).toBe(
      admitted.record.admissionHash,
    );

    r = await call(
      "GET",
      `/tenants/${tenantId}/procedures/proc_http_pi_harness/versions/1/replay?evaluatedAt=2026-07-02T21:03:00.000Z`,
    );
    expect(r.status).toBe(200);
    const replayed = (await r.json()) as {
      replay: { admittedRuns: Array<{ runId: string }> };
    };
    expect(replayed.replay.admittedRuns.map((run) => run.runId)).toEqual([
      "run_http_pi_harness_001",
    ]);
  });

  it("refuses stale procedure runner evidence through HTTP before admission", async () => {
    const tenantId = await makeTenant();
    let r = await call("POST", `/tenants/${tenantId}/procedures/definitions`, {
      procedureId: "proc_http_pi_harness_stale",
      version: 1,
      name: "HTTP stale Pi Harness procedure",
      authorityScope: "pmgovernance/http-procedure-admission-stale",
      runnerKind: "pi_harness",
      inputContractHash: "sha256:http-procedure-stale-input-contract",
      outputContractHash: "sha256:http-procedure-stale-output-contract",
      allowedUse: ["pm.stage_gate.validate"],
      createdAt: "2026-07-02T21:00:00.000Z",
    });
    expect(r.status).toBe(201);

    r = await call(
      "POST",
      `/tenants/${tenantId}/procedures/proc_http_pi_harness_stale/versions/1/runs`,
      {
        runId: "run_http_pi_harness_stale",
        requestedBy: "agent:http-test",
        inputHash: "sha256:http-procedure-stale-input",
        input: { stale: true },
        inputEvidence: [
          {
            ref: stateRef("document", "doc_http_procedure_stale_input"),
            evidenceHash: "sha256:http-procedure-stale-input-evidence",
            observedAt: "2026-07-02T21:01:00.000Z",
            validUntil: "2026-07-02T22:00:00.000Z",
          },
        ],
        startedAt: "2026-07-02T21:02:00.000Z",
        evaluatedAt: "2026-07-02T21:03:00.000Z",
      },
    );
    expect(r.status).toBe(422);
    const body = (await r.json()) as {
      cause: { issues: Array<{ code: string }> };
    };
    expect(body.cause.issues.map((issue) => issue.code)).toContain(
      "stale_runner_evidence",
    );
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
    await call("POST", `/tenants/${tenantId}/profiles`, FINANCE_RESEARCH_PROFILE);

    let r = await call("GET", `/tenants/${tenantId}/nodes/ent_nope`);
    expect(r.status).toBe(404);

    // Missing required fields on a ResearchRun.
    r = await call("POST", `/tenants/${tenantId}/nodes`, {
      profile: { tier1: "Engagement", profile: "finance-research", concrete: "ResearchRun" },
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
    expect(r.status).toBe(201);
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

  // ---------------------------------------------------------------------------
  // P2.3a: POST /nodes caller-supplied UUID idempotency
  // ---------------------------------------------------------------------------

  it("P2.3a: POST /nodes with explicit id returns 201 on first call", async () => {
    const tenantId = await makeTenant();
    const callerUUID = randomUUID();
    const r = await call("POST", `/tenants/${tenantId}/nodes`, {
      id: callerUUID,
      profile: { tier1: "Counterparty", profile: null, concrete: "Counterparty" },
      identity: { name: "idempotent-v1" },
      schemaVersion: 1,
    });
    expect(r.status).toBe(201);
    const node = (await r.json()) as { id: string };
    expect(node.id).toBe(callerUUID);
  });

  it("P2.3a: POST /nodes with duplicate id + matching type returns 200 with existing node", async () => {
    const tenantId = await makeTenant();
    const callerUUID = randomUUID();
    const profile = { tier1: "Counterparty", profile: null, concrete: "Counterparty" };

    // First call → 201
    await call("POST", `/tenants/${tenantId}/nodes`, {
      id: callerUUID,
      profile,
      identity: { name: "first" },
      schemaVersion: 1,
    });

    // Second call with same id + same profile → 200, original node returned
    const r2 = await call("POST", `/tenants/${tenantId}/nodes`, {
      id: callerUUID,
      profile,
      identity: { name: "should-not-overwrite" },
      schemaVersion: 1,
    });
    expect(r2.status).toBe(200);
    const node2 = (await r2.json()) as { id: string; identity: Record<string, unknown> };
    expect(node2.id).toBe(callerUUID);
    // Original identity preserved
    expect(node2.identity["name"]).toBe("first");
  });

  it("P2.3a: POST /nodes with duplicate id + mismatched type returns 409", async () => {
    const tenantId = await makeTenant();
    const callerUUID = randomUUID();

    // Insert as Counterparty
    await call("POST", `/tenants/${tenantId}/nodes`, {
      id: callerUUID,
      profile: { tier1: "Counterparty", profile: null, concrete: "Counterparty" },
      identity: {},
      schemaVersion: 1,
    });

    // Try to insert same id as Engagement → 409 NodeConflictError
    const r2 = await call("POST", `/tenants/${tenantId}/nodes`, {
      id: callerUUID,
      profile: { tier1: "Engagement", profile: null, concrete: "Engagement" },
      identity: {},
      schemaVersion: 1,
    });
    expect(r2.status).toBe(409);
    const body = (await r2.json()) as { cause: { kind: string } };
    expect(body.cause.kind).toBe("node_conflict");
  });

  it("P2.3a: POST /nodes with invalid UUID string returns 400", async () => {
    const tenantId = await makeTenant();
    const r = await call("POST", `/tenants/${tenantId}/nodes`, {
      id: "not-a-uuid-at-all",
      profile: { tier1: "Counterparty", profile: null, concrete: "Counterparty" },
      identity: {},
      schemaVersion: 1,
    });
    expect(r.status).toBe(400);
    const body = (await r.json()) as { cause: { kind: string } };
    expect(body.cause.kind).toBe("invalid_id");
  });

  it("P2.3a: same UUID in two tenants creates two distinct nodes", async () => {
    const tenantId1 = await makeTenant();
    const tenantId2 = await makeTenant();
    const sharedUUID = randomUUID();
    const profile = { tier1: "Counterparty", profile: null, concrete: "Counterparty" };

    // Tenant 1 creates a node with the UUID → 201
    const r1 = await call("POST", `/tenants/${tenantId1}/nodes`, {
      id: sharedUUID,
      profile,
      identity: { tenant: "t1" },
      schemaVersion: 1,
    });
    expect(r1.status).toBe(201);

    // Tenant 1 can read it back
    const get1 = await call("GET", `/tenants/${tenantId1}/nodes/${sharedUUID}`);
    expect(get1.status).toBe(200);

    // Tenant 2 cannot see tenant 1's node — 404
    const get2 = await call("GET", `/tenants/${tenantId2}/nodes/${sharedUUID}`);
    expect(get2.status).toBe(404);
  });
});

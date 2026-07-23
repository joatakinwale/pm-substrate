import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resetDashboardServerStateForTests,
  server,
  setLocalAgentLabLoaderForTests,
} from "./server.mjs";
import {
  resetIntegrationWorkbenchForTests,
  setLiquidClientFactoryForTests,
} from "./integration-workbench.mjs";

const REAL_DATABASE_URL = process.env.PM_DATABASE_URL;

const scenario = {
  scenarioId: "stale-observation",
  failureClass: "stale_observation",
  realityQualities: [5, 6, 7, 9, 10],
};

function makeFakeLabModule() {
  let eventId = 0;

  class FakeLabSessionRunner {
    constructor(cfg) {
      this.cfg = cfg;
      this.listeners = new Set();
      this.mode = "ab_pair";
      this.nextAgentNumber = 0;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    stop() {
      this.stopped = true;
    }

    run(request) {
      this.request = request;
      this.mode = request.mode ?? "ab_pair";
      this.sessionId = this.cfg.idFactory("session");
      this.nextAgentNumber = Number(request.agentCount ?? 1);
      this.emit("session_created", {
        message: `Local agent lab session created for ${request.scenario.scenarioId}.`,
        payload: {
          objective: request.objective,
          mode: this.mode,
          agentCount: this.nextAgentNumber,
        },
      });
      return new Promise((resolve) => {
        this.finish = () =>
          resolve({
            sessionId: this.sessionId,
            title: request.title ?? request.scenario.scenarioId,
            objective: request.objective,
            scenarioId: request.scenario.scenarioId,
            failureClass: request.scenario.failureClass,
            mode: this.mode,
            status: this.stopped ? "stopped" : "completed",
            model: "fake",
            agents: this.agents ?? [],
            events: [],
            substrateProtectedCount: 0,
            unsafeAdmittedCount: 0,
            unsafeBlockedCount: 0,
          });
      });
    }

    inject(injection) {
      const agentId = `${this.sessionId}:agent:1`;
      this.emit("injection_created", {
        agentId,
        message: `Injection ${injection.id} created.`,
        payload: injection,
      });
      this.emit("injection_applied", {
        agentId,
        arm: "no_substrate",
        message: `Injection ${injection.id} applied to no_substrate.`,
        payload: { ...injection, appliedValue: 999 },
      });
      this.emit("arm_diverged", {
        agentId,
        message: "Agent 1 diverged across substrate arms.",
        payload: {
          noSubstrateResult: "fail",
          substrateResult: "blocked",
        },
      });
    }

    mutate(mutation) {
      this.emit("mutation_created", {
        agentId: `${this.sessionId}:agent:1`,
        message: `Mutation ${mutation.id} created.`,
        payload: mutation,
      });
    }

    addAgent() {
      const agentNumber = this.nextAgentNumber + 1;
      this.nextAgentNumber = agentNumber;
      const agentId = `${this.sessionId}:agent:${agentNumber}`;
      const agent = {
        agentId,
        label: `Agent ${agentNumber}`,
        arms: {},
        behaviorDiverged: false,
      };
      this.emit("agent_started", {
        agentId,
        message: `Operator added Agent ${agentNumber}.`,
        payload: { agentNumber, label: agent.label, source: "operator_add_agent" },
      });
      for (const arm of armsForMode(this.mode)) {
        const armRun = {
          arm,
          result: arm === "substrate" ? "blocked" : "fail",
          actedValue: 100,
          admitted: arm !== "substrate",
          tokens: 0,
          admittedTransitions: 1,
          chainValid: true,
        };
        agent.arms[arm] = armRun;
        this.emit("arm_started", {
          agentId,
          arm,
          message: `${arm} arm started.`,
        });
        this.emit("arm_completed", {
          agentId,
          arm,
          result: armRun.result,
          message: `${arm} arm completed.`,
          payload: armRun,
        });
      }
      this.emit("agent_completed", {
        agentId,
        message: `Agent ${agentNumber} completed.`,
        payload: agent,
      });
      this.agents = [...(this.agents ?? []), agent];
      return agent;
    }

    emit(type, extra = {}) {
      const event = {
        id: `event_${++eventId}`,
        type,
        sessionId: this.sessionId,
        scenarioId: scenario.scenarioId,
        failureClass: scenario.failureClass,
        occurredAt: "2026-07-01T00:00:00.000Z",
        message: extra.message ?? type,
        ...extra,
      };
      for (const listener of this.listeners) listener(event);
    }
  }

  return {
    LabSessionRunner: FakeLabSessionRunner,
    scenarioById: (id) => (id === scenario.scenarioId ? scenario : undefined),
    SCENARIOS: [scenario],
  };
}

function armsForMode(mode) {
  if (mode === "substrate") return ["substrate"];
  if (mode === "no_substrate") return ["no_substrate"];
  return ["no_substrate", "substrate"];
}

async function listen() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer() {
  if (!server.listening) return;
  server.closeIdleConnections?.();
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeAllConnections?.();
  });
}

async function postJson(base, path, body = {}) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, body: await res.json() };
}

async function getJson(base, path) {
  const res = await fetch(`${base}${path}`);
  return { res, body: await res.json() };
}

async function readSseUntil(response, predicate) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing response body");
  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";

  const readLoop = async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return events;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
        if (dataLine) {
          const event = JSON.parse(dataLine.slice("data: ".length));
          events.push(event);
          if (predicate(event, events)) {
            await reader.cancel();
            return events;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  };

  return Promise.race([
    readLoop(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timed out waiting for SSE event")), 1_000),
    ),
  ]);
}

describe.sequential("substrate dashboard live session API", () => {
  const originalDatabaseUrl = process.env.PM_DATABASE_URL;

  beforeEach(() => {
    process.env.PM_DATABASE_URL = "postgres://unused";
    resetDashboardServerStateForTests();
    setLocalAgentLabLoaderForTests(async () => makeFakeLabModule());
  });

  afterEach(async () => {
    await closeServer();
    resetDashboardServerStateForTests();
    if (originalDatabaseUrl === undefined) {
      delete process.env.PM_DATABASE_URL;
    } else {
      process.env.PM_DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("delivers dashboard injections into the live runner and streams observable divergence", async () => {
    const base = await listen();
    const started = await postJson(base, "/api/sessions", {
      scenarioId: scenario.scenarioId,
      objective: "Induce divergence from the dashboard.",
      mode: "ab_pair",
      agentCount: 1,
    });
    expect(started.res.status).toBe(202);
    const sessionId = started.body.session.id;

    const abort = new AbortController();
    const stream = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/stream`, {
      signal: abort.signal,
    });
    const streamEvents = readSseUntil(
      stream,
      (event) => event.type === "arm_diverged",
    );

    const injected = await postJson(
      base,
      `/api/sessions/${encodeURIComponent(sessionId)}/injections`,
      {
        prompt: "AAPL=999",
        mutationDescription: "",
      },
    );
    expect(injected.res.status).toBe(202);
    expect(injected.body.session.summaryMetrics.pendingInjections).toBe(0);
    expect(injected.body.session.summaryMetrics.injectionAppliedCount).toBe(1);
    expect(injected.body.session.summaryMetrics.divergenceCount).toBe(1);

    const events = await streamEvents;
    abort.abort();
    expect(events.map((event) => event.type)).toContain("injection_created");
    expect(events.map((event) => event.type)).toContain("injection_applied");
    expect(events.map((event) => event.type)).toContain("arm_diverged");
  });

  it("starts live-added agents, updates metrics, and streams their selected substrate arm", async () => {
    const base = await listen();
    const started = await postJson(base, "/api/sessions", {
      scenarioId: scenario.scenarioId,
      objective: "Add a live substrate agent.",
      mode: "substrate",
      agentCount: 1,
    });
    expect(started.res.status).toBe(202);
    const sessionId = started.body.session.id;

    const abort = new AbortController();
    const stream = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/stream`, {
      signal: abort.signal,
    });
    const streamEvents = readSseUntil(stream, (_event, events) => {
      return (
        events.some(
          (event) =>
            event.type === "agent_started" &&
            event.payload?.source === "operator_add_agent",
        ) && events.some((event) => event.type === "agent_completed")
      );
    });

    const added = await postJson(
      base,
      `/api/sessions/${encodeURIComponent(sessionId)}/agents`,
    );
    expect(added.res.status).toBe(202);
    expect(added.body.session.agentCount).toBe(2);
    expect(added.body.session.summaryMetrics.activeAgents).toBe(0);

    const events = await streamEvents;
    abort.abort();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "arm_started",
        arm: "substrate",
        agentId: added.body.agent.agentId,
      }),
    );
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: "arm_started",
        arm: "no_substrate",
        agentId: added.body.agent.agentId,
      }),
    );

    const detail = await getJson(base, `/api/sessions/${encodeURIComponent(sessionId)}`);
    expect(detail.body.agents).toContainEqual(
      expect.objectContaining({
        agentId: added.body.agent.agentId,
        arms: expect.objectContaining({
          substrate: expect.objectContaining({ result: "blocked" }),
        }),
      }),
    );
  });

  it("builds local-agent-lab before dashboard developer scripts that need the server", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    for (const script of ["prebuild", "predev", "preserve", "pretest"]) {
      expect(packageJson.scripts[script]).toContain("@pm/local-agent-lab");
      expect(packageJson.scripts[script]).toContain("build");
    }
  });
});

const validMapping = () => ({
  profile: null,
  mappingVersion: 1,
  entities: {
    Customer: {
      tier1: "Counterparty",
      concrete: "Counterparty",
      identityFields: ["name"],
      optionalFields: ["email"],
      schemaVersion: 1,
    },
  },
});

function makeFakeLiquidClient(rows) {
  const calls = [];
  return {
    calls,
    async callTool({ name, arguments: args }) {
      calls.push({ name, args });
      if (name === "liquid_connect") {
        return {
          structuredContent: { status: "connected", adapter_id: "fake_adapter" },
        };
      }
      if (name === "liquid_fetch") {
        return { structuredContent: { records: rows.length, data: rows } };
      }
      throw new Error(`unexpected liquid tool: ${name}`);
    },
    async close() {},
  };
}

describe.sequential("dashboard integration workbench API (no DB required)", () => {
  const originalDatabaseUrl = process.env.PM_DATABASE_URL;

  afterEach(async () => {
    await closeServer();
    resetIntegrationWorkbenchForTests();
    if (originalDatabaseUrl === undefined) {
      delete process.env.PM_DATABASE_URL;
    } else {
      process.env.PM_DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("validates a mapping without publishing events", async () => {
    const base = await listen();
    const response = await postJson(base, "/api/integrations/orbit/mappings/validate", {
      mapping: validMapping(),
    });

    expect(response.res.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      validation: { valid: true, issues: [] },
    });
    expect(response.body.mappingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reports validation issues for an invalid mapping", async () => {
    const base = await listen();
    const response = await postJson(base, "/api/integrations/orbit/mappings/validate", {
      mapping: { profile: null, mappingVersion: 1, entities: {} },
    });

    expect(response.res.status).toBe(200);
    expect(response.body.ok).toBe(false);
    expect(response.body.validation.valid).toBe(false);
    expect(
      response.body.validation.issues.map((issue) => issue.message).join("; "),
    ).toMatch(/expected at least one entity entry/);
  });

  it("refuses invalid mapping proposals before they reach the event log", async () => {
    const base = await listen();
    const response = await postJson(base, "/api/integrations/orbit/mappings/propose", {
      mapping: { profile: null, mappingVersion: 1, entities: {} },
      origin: "manual",
      reason: "empty map should be rejected",
    });

    expect(response.res.status).toBe(400);
    expect(response.body.error).toMatch(/expected at least one entity entry/);
  });

  it("returns JSON 503, never index.html, when the database is not configured", async () => {
    delete process.env.PM_DATABASE_URL;
    const base = await listen();
    const response = await getJson(base, "/api/integrations/orbit/mappings");

    expect(response.res.status).toBe(503);
    expect(response.res.headers.get("content-type")).toContain("application/json");
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toMatch(/PM_DATABASE_URL/);
  });

  it("rejects wrong methods on integration routes", async () => {
    const base = await listen();
    const response = await getJson(base, "/api/integrations/orbit/mappings/validate");
    expect(response.res.status).toBe(405);
  });
});

const describeIfDb = REAL_DATABASE_URL ? describe.sequential : describe.sequential.skip;

describeIfDb("dashboard integration workbench API (admitted-log backed)", () => {
  beforeEach(() => {
    process.env.PM_DATABASE_URL = REAL_DATABASE_URL;
  });

  afterEach(async () => {
    await closeServer();
    resetIntegrationWorkbenchForTests();
    process.env.PM_DATABASE_URL = REAL_DATABASE_URL;
  });

  it("propose -> approve lifecycle folds from the admitted log", async () => {
    const base = await listen();
    const appName = `wb_app_${randomUUID().slice(0, 8)}`;

    const proposed = await postJson(base, `/api/integrations/${appName}/mappings/propose`, {
      mapping: validMapping(),
      reason: "workbench test",
    });
    expect(proposed.res.status).toBe(200);
    expect(proposed.body.proposed).toBe(true);
    const hash = proposed.body.mappingHash;
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const pendingState = await getJson(base, `/api/integrations/${appName}/mappings`);
    expect(pendingState.res.status).toBe(200);
    expect(pendingState.body.approvedHash).toBeNull();
    expect(pendingState.body.pending).toContainEqual(
      expect.objectContaining({ mappingHash: hash, origin: "manual" }),
    );

    const approved = await postJson(
      base,
      `/api/integrations/${appName}/mappings/${hash}/approve`,
      { reason: "looks right" },
    );
    expect(approved.res.status).toBe(200);
    expect(approved.body.approvedHash).toBe(hash);
    expect(approved.body.pending).toHaveLength(0);
  });

  it("reject closes a pending proposal without approving anything", async () => {
    const base = await listen();
    const appName = `wb_app_${randomUUID().slice(0, 8)}`;

    const proposed = await postJson(base, `/api/integrations/${appName}/mappings/propose`, {
      mapping: validMapping(),
    });
    const hash = proposed.body.mappingHash;

    const rejected = await postJson(
      base,
      `/api/integrations/${appName}/mappings/${hash}/reject`,
      { reason: "not yet" },
    );
    expect(rejected.res.status).toBe(200);
    expect(rejected.body.approvedHash).toBeNull();
    expect(rejected.body.pending).toHaveLength(0);
  });

  it("refuses decisions on hashes that are not pending", async () => {
    const base = await listen();
    const appName = `wb_app_${randomUUID().slice(0, 8)}`;
    const response = await postJson(
      base,
      `/api/integrations/${appName}/mappings/deadbeefdeadbeef/approve`,
      {},
    );
    expect(response.res.status).toBe(409);
    expect(response.body.error).toMatch(/no pending proposal/);
  });

  it("sync preview is always a dry run and reports the approval verdict honestly", async () => {
    const base = await listen();
    const appName = `wb_app_${randomUUID().slice(0, 8)}`;
    const rows = [
      { id: "1", name: "Ada", email: "ada@example.test" },
      { id: "2", name: "Grace", email: "grace@example.test" },
    ];
    setLiquidClientFactoryForTests(async () => makeFakeLiquidClient(rows));

    // Unapproved mapping: the preview must report the refusal verdict, write
    // nothing, and still show the data effects — even if the caller lies
    // about dryRun.
    const unapproved = await postJson(base, `/api/integrations/${appName}/sync/preview`, {
      mapping: validMapping(),
      url: "https://example.invalid/customers",
      sourceName: "Customer",
      externalIdField: "id",
      dryRun: false,
    });
    expect(unapproved.res.status).toBe(200);
    expect(unapproved.body.dryRun).toBe(true);
    expect(unapproved.body.mappingApproved).toBe(false);
    expect(unapproved.body.created).toBe(2);

    // Approve, then preview again: verdict flips, still a dry run.
    const proposed = await postJson(base, `/api/integrations/${appName}/mappings/propose`, {
      mapping: validMapping(),
    });
    await postJson(
      base,
      `/api/integrations/${appName}/mappings/${proposed.body.mappingHash}/approve`,
      {},
    );
    const approvedPreview = await postJson(base, `/api/integrations/${appName}/sync/preview`, {
      mapping: validMapping(),
      url: "https://example.invalid/customers",
      sourceName: "Customer",
      externalIdField: "id",
    });
    expect(approvedPreview.res.status).toBe(200);
    expect(approvedPreview.body.dryRun).toBe(true);
    expect(approvedPreview.body.mappingApproved).toBe(true);
    expect(approvedPreview.body.created).toBe(2);
  });

  it("records Liquid discovery as a pending proposal, not an approved mapping", async () => {
    const base = await listen();
    const appName = `wb_app_${randomUUID().slice(0, 8)}`;

    const discovered = await postJson(base, "/api/integrations/liquid/discover", {
      appName,
      url: "https://example.invalid/customers",
      sourceName: "Customer",
      tier1: "Counterparty",
      concrete: "Counterparty",
      externalIdField: "id",
      fields: ["id", "name"],
    });

    expect(discovered.res.status).toBe(200);
    expect(discovered.body.mappingHash).toMatch(/^[a-f0-9]{64}$/);
    expect(discovered.body.approved).toBe(false);
    expect(discovered.body.origin).toBe("liquid_discovery");

    const state = await getJson(base, `/api/integrations/${appName}/mappings`);
    expect(state.body.approvedHash).toBeNull();
    expect(state.body.pending).toContainEqual(
      expect.objectContaining({
        mappingHash: discovered.body.mappingHash,
        origin: "liquid_discovery",
      }),
    );
  });

  it("refuses liquid discovery with an unknown tier1 primitive", async () => {
    const base = await listen();
    const response = await postJson(base, "/api/integrations/liquid/discover", {
      appName: `wb_app_${randomUUID().slice(0, 8)}`,
      sourceName: "Customer",
      tier1: "NotAPrimitive",
      externalIdField: "id",
      fields: ["id"],
    });
    expect(response.res.status).toBe(400);
    expect(response.body.error).toMatch(/tier1 must be one of/);
  });
});

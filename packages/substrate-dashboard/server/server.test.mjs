import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resetDashboardServerStateForTests,
  server,
  setLocalAgentLabLoaderForTests,
} from "./server.mjs";

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

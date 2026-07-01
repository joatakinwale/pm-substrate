#!/usr/bin/env node
/**
 * Dependency-free static + live-API server for the ArrowHedgeLab / Substrate
 * dashboard.
 *
 * Routes:
 *   GET /api/health     -> aggregator + substrate reachability
 *   GET /api/dashboard  -> live two-domain snapshot (arrowhedge + substrate)
 *   GET /*              -> built dist/ static files (SPA fallback to index.html)
 *
 * Live data comes from the running substrate HTTP server (SUBSTRATE_BASE_URL,
 * default :4100) via ./aggregator.mjs. When substrate is unreachable the
 * snapshot returns { live:false, error } and the frontend shows the offline
 * banner + falls back to its bundled fixture corpus.
 *
 * Binds 0.0.0.0 (no host allowlist) so the Tailscale MagicDNS name is reachable
 * from Emmanuel's phone. Read-only: serves files + GETs; never mutates.
 *
 * Env:
 *   SUBSTRATE_DASHBOARD_DIST  dist dir
 *   SUBSTRATE_BASE_URL        substrate server (default http://127.0.0.1:4100)
 *   PORT                      listen port (default 4178)
 *   SNAPSHOT_CACHE_MS         min ms between live polls (default 4000)
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { buildSnapshot } from "./aggregator.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST =
  process.env.SUBSTRATE_DASHBOARD_DIST ?? join(HERE, "..", "dist");
const LOCAL_AGENT_LAB_DIST = new URL(
  "../../local-agent-lab/dist/index.js",
  import.meta.url,
);
const PORT = parseInt(process.env.PORT ?? "4178", 10);
const CACHE_MS = Number(process.env.SNAPSHOT_CACHE_MS ?? "4000");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

let cache = { at: 0, snapshot: null };
const labSessions = new Map();
const sessionStreams = new Map();
const activeRunners = new Map();

async function loadLocalAgentLab() {
  try {
    return await import(LOCAL_AGENT_LAB_DIST.href);
  } catch (err) {
    throw new Error(
      `local-agent-lab build is required for lab sessions: ${err?.message ?? String(err)}`,
    );
  }
}

async function getSnapshot() {
  const now = Date.now();
  if (cache.snapshot && now - cache.at < CACHE_MS) return cache.snapshot;
  const snapshot = await buildSnapshot();
  cache = { at: now, snapshot };
  return snapshot;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache",
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sendMethodNotAllowed(res) {
  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

function summarizeScenario(scenario) {
  return {
    scenarioId: scenario.scenarioId,
    failureClass: scenario.failureClass,
    realityQualities: scenario.realityQualities,
  };
}

function summarizeSession(record) {
  return {
    id: record.id,
    title: record.title,
    objective: record.objective,
    scenarioId: record.scenarioId,
    failureClass: record.failureClass,
    mode: record.mode,
    status: record.status,
    agentCount: record.agentCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    latestActivity: record.latestActivity,
    summaryMetrics: record.summaryMetrics,
    error: record.error ?? null,
  };
}

function getSession(id) {
  return labSessions.get(id) ?? null;
}

function broadcastSessionEvent(sessionId, event) {
  const streams = sessionStreams.get(sessionId);
  if (!streams) return;
  const payload = `event: session-event\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of streams) res.write(payload);
}

function createRecordEvent(record, type, message, extra = {}) {
  return {
    id: `event_${randomUUID()}`,
    type,
    sessionId: record.id,
    scenarioId: record.scenarioId,
    failureClass: record.failureClass,
    occurredAt: new Date().toISOString(),
    message,
    ...extra,
  };
}

function appendRecordEvent(record, event) {
  updateRecordFromEvent(record, event);
  broadcastSessionEvent(record.id, event);
}

function updateRecordFromEvent(record, event) {
  record.events.push(event);
  record.updatedAt = event.occurredAt;
  record.latestActivity = event.message;
  if (event.type === "agent_stopped") {
    record.summaryMetrics.activeAgents = Math.max(0, record.summaryMetrics.activeAgents - 1);
  }
  if (event.type === "injection_created") record.summaryMetrics.pendingInjections += 1;
  if (event.type === "mutation_created") record.summaryMetrics.pendingMutations += 1;
  if (event.type === "action_refused") record.summaryMetrics.unsafeBlockedCount += 1;
  if (event.type === "action_admitted" && event.arm === "no_substrate") {
    record.summaryMetrics.unsafeAdmittedCount += 1;
  }
  if (event.type === "arm_diverged") record.summaryMetrics.divergenceCount += 1;
  if (event.type === "mutation_applied") {
    record.summaryMetrics.mutationAppliedCount += 1;
    record.summaryMetrics.pendingMutations = Math.max(0, record.summaryMetrics.pendingMutations - 1);
  }
  if (event.type === "injection_applied") {
    record.summaryMetrics.injectionAppliedCount += 1;
    record.summaryMetrics.pendingInjections = Math.max(0, record.summaryMetrics.pendingInjections - 1);
  }
}

async function startLabSession(body) {
  const { LabSessionRunner, scenarioById } = await loadLocalAgentLab();
  const databaseUrl = process.env.PM_DATABASE_URL;
  if (!databaseUrl) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "PM_DATABASE_URL is required to run local-agent-lab sessions.",
      },
    };
  }

  const scenario = scenarioById(String(body.scenarioId ?? "stale-observation"));
  if (!scenario) {
    return {
      status: 400,
      body: { ok: false, error: `unknown scenarioId: ${body.scenarioId}` },
    };
  }

  const id = `lab_session_${randomUUID()}`;
  const now = new Date().toISOString();
  const mode = body.mode === "substrate" || body.mode === "no_substrate" ? body.mode : "ab_pair";
  const agentCount = Math.max(1, Math.min(12, Number(body.agentCount ?? 1)));
  const record = {
    id,
    title: String(body.title ?? scenario.scenarioId),
    objective: String(body.objective ?? "Test PM substrate state coherence."),
    scenarioId: scenario.scenarioId,
    failureClass: scenario.failureClass,
    mode,
    status: "running",
    agentCount,
    createdAt: now,
    updatedAt: now,
    latestActivity: "Session queued.",
    summaryMetrics: {
      activeAgents: agentCount,
      blockedAgents: 0,
      pendingInjections: Array.isArray(body.injections) ? body.injections.length : 0,
      pendingMutations: Array.isArray(body.mutations) ? body.mutations.length : 0,
      injectionAppliedCount: 0,
      mutationAppliedCount: 0,
      unsafeBlockedCount: 0,
      unsafeAdmittedCount: 0,
      divergenceCount: 0,
      substrateProtectedCount: 0,
    },
    events: [],
    agents: [],
  };
  labSessions.set(id, record);

  const idFactory = () => {
    let first = true;
    return (prefix) => {
      if (prefix === "session" && first) {
        first = false;
        return id;
      }
      return `${prefix}_${randomUUID()}`;
    };
  };
  const runner = new LabSessionRunner({
    databaseUrl,
    idFactory: idFactory(),
  });
  activeRunners.set(id, runner);
  runner.subscribe((event) => {
    updateRecordFromEvent(record, event);
    broadcastSessionEvent(id, event);
  });

  void runner
    .run({
      title: record.title,
      objective: record.objective,
      scenario,
      mode,
      agentCount,
      injections: Array.isArray(body.injections) ? body.injections : [],
      mutations: Array.isArray(body.mutations) ? body.mutations : [],
    })
    .then((result) => {
      activeRunners.delete(id);
      record.status = result.status;
      record.updatedAt = new Date().toISOString();
      record.latestActivity = "Session completed.";
      record.agents = result.agents;
      record.summaryMetrics = {
        ...record.summaryMetrics,
        activeAgents: 0,
        blockedAgents: result.unsafeBlockedCount,
        pendingInjections: 0,
        pendingMutations: 0,
        unsafeBlockedCount: result.unsafeBlockedCount,
        unsafeAdmittedCount: result.unsafeAdmittedCount,
        substrateProtectedCount: result.substrateProtectedCount,
      };
      broadcastSessionEvent(id, {
        id: `event_${randomUUID()}`,
        type: "session_completed",
        sessionId: id,
        scenarioId: scenario.scenarioId,
        failureClass: scenario.failureClass,
        occurredAt: record.updatedAt,
        message: "Session result stored.",
      });
    })
    .catch((err) => {
      activeRunners.delete(id);
      record.status = "failed";
      record.error = err?.message ?? String(err);
      record.updatedAt = new Date().toISOString();
      record.latestActivity = `Session failed: ${record.error}`;
      broadcastSessionEvent(id, {
        id: `event_${randomUUID()}`,
        type: "session_failed",
        sessionId: id,
        scenarioId: scenario.scenarioId,
        failureClass: scenario.failureClass,
        occurredAt: record.updatedAt,
        message: record.latestActivity,
        payload: { error: record.error },
      });
    });

  return { status: 202, body: { ok: true, session: summarizeSession(record) } };
}

function stopLabSession(id) {
  const record = getSession(id);
  if (!record) return { status: 404, body: { ok: false, error: "session not found" } };
  const runner = activeRunners.get(id);
  const at = new Date().toISOString();
  if (runner) {
    runner.stop("operator stopped session");
    record.status = "stopped";
    record.summaryMetrics.activeAgents = 0;
    appendRecordEvent(
      record,
      createRecordEvent(record, "session_stopped", "Operator requested session stop.", {
        occurredAt: at,
      }),
    );
  }
  return { status: 200, body: { ok: true, session: summarizeSession(record) } };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFileRefs(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeString(item)).filter(Boolean);
  return normalizeString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function recordHasAgent(record, agentId) {
  if (!agentId) return true;
  return (
    record.agents.some((agent) => agent.agentId === agentId) ||
    record.events.some((event) => event.agentId === agentId)
  );
}

function injectIntoSession(id, body) {
  const record = getSession(id);
  if (!record) return { status: 404, body: { ok: false, error: "session not found" } };

  const targetAgentId = normalizeString(body.targetAgentId ?? body.agentId) || undefined;
  if (targetAgentId && !recordHasAgent(record, targetAgentId)) {
    return { status: 400, body: { ok: false, error: "target agent not found in session" } };
  }

  const prompt = normalizeString(body.prompt ?? body.text);
  const fileRefs = normalizeFileRefs(body.fileRefs);
  const targetArm = normalizeString(body.targetArm ?? body.armTarget) || "both";
  const mutationDescription = normalizeString(
    body.mutationDescription ?? body.mutation?.description,
  );
  const mutationType =
    normalizeString(body.mutationType ?? body.mutation?.type) || "changed_working_condition";
  const events = [];

  if (prompt || fileRefs.length > 0) {
    const injection = {
      id: normalizeString(body.id) || `inj_${randomUUID()}`,
      type: fileRefs.length > 0 ? "file_context" : "prompt_task",
      prompt,
      fileRefs,
      targetAgentId,
      targetArm,
      createdAt: new Date().toISOString(),
    };
    events.push(
      createRecordEvent(record, "injection_created", "Operator queued a prompt/context injection.", {
        ...(targetAgentId ? { agentId: targetAgentId } : {}),
        payload: injection,
      }),
    );
    events.push(
      createRecordEvent(record, "injection_applied", "Operator injection entered the session stream.", {
        ...(targetAgentId ? { agentId: targetAgentId } : {}),
        payload: injection,
      }),
    );
  }

  if (mutationDescription) {
    const mutation = {
      id: normalizeString(body.mutationId) || `mut_${randomUUID()}`,
      type: mutationType,
      description: mutationDescription,
      targetAgentId,
      targetArm,
      createdAt: new Date().toISOString(),
    };
    events.push(
      createRecordEvent(record, "mutation_created", "Operator queued a constrained lab mutation.", {
        ...(targetAgentId ? { agentId: targetAgentId } : {}),
        payload: mutation,
      }),
    );
    events.push(
      createRecordEvent(record, "mutation_applied", "Operator lab mutation was applied to the test session.", {
        ...(targetAgentId ? { agentId: targetAgentId } : {}),
        payload: mutation,
      }),
    );
  }

  if (events.length === 0) {
    return {
      status: 400,
      body: { ok: false, error: "provide a prompt, fileRefs, or mutationDescription" },
    };
  }

  for (const event of events) appendRecordEvent(record, event);
  return {
    status: 202,
    body: { ok: true, session: summarizeSession(record), events },
  };
}

function stopAgent(agentId) {
  for (const record of labSessions.values()) {
    if (!recordHasAgent(record, agentId)) continue;
    appendRecordEvent(
      record,
      createRecordEvent(record, "agent_stopped", `Operator requested stop for ${agentId}.`, {
        agentId,
      }),
    );
    return { status: 200, body: { ok: true, session: summarizeSession(record) } };
  }
  return { status: 404, body: { ok: false, error: "agent not found" } };
}

function addAgentToSession(id) {
  const record = getSession(id);
  if (!record) return { status: 404, body: { ok: false, error: "session not found" } };
  const nextAgentNumber = record.agentCount + 1;
  const agent = {
    agentId: `${record.id}:agent:${nextAgentNumber}`,
    label: `Agent ${nextAgentNumber}`,
    arms: {},
    behaviorDiverged: false,
  };
  record.agentCount = nextAgentNumber;
  record.summaryMetrics.activeAgents += 1;
  record.agents.push(agent);
  appendRecordEvent(
    record,
    createRecordEvent(record, "agent_started", `Operator added Agent ${nextAgentNumber}.`, {
      agentId: agent.agentId,
      payload: { source: "operator_add_agent" },
    }),
  );
  return { status: 202, body: { ok: true, session: summarizeSession(record), agent } };
}

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const method = req.method ?? "GET";

  // --- API ---
  if (pathname === "/api/lab/scenarios") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    try {
      const { SCENARIOS } = await loadLocalAgentLab();
      return sendJson(res, 200, {
        ok: true,
        scenarios: SCENARIOS.map(summarizeScenario),
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
  }
  if (pathname === "/api/sessions") {
    if (method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        sessions: [...labSessions.values()].map(summarizeSession),
      });
    }
    if (method === "POST") {
      try {
        const result = await startLabSession(await readJsonBody(req));
        return sendJson(res, result.status, result.body);
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err?.message ?? String(err) });
      }
    }
    return sendMethodNotAllowed(res);
  }
  const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    if (method === "POST") return sendMethodNotAllowed(res);
    if (method !== "GET") return sendMethodNotAllowed(res);
    const record = getSession(sessionMatch[1]);
    if (!record) return sendJson(res, 404, { ok: false, error: "session not found" });
    return sendJson(res, 200, {
      ok: true,
      session: summarizeSession(record),
      events: record.events,
      agents: record.agents,
    });
  }
  const sessionStopMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/stop$/);
  if (sessionStopMatch) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    const result = stopLabSession(sessionStopMatch[1]);
    return sendJson(res, result.status, result.body);
  }
  const sessionInjectionMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/injections$/);
  if (sessionInjectionMatch) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    try {
      const result = injectIntoSession(sessionInjectionMatch[1], await readJsonBody(req));
      return sendJson(res, result.status, result.body);
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err?.message ?? String(err) });
    }
  }
  const sessionAddAgentMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/agents$/);
  if (sessionAddAgentMatch) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    const result = addAgentToSession(sessionAddAgentMatch[1]);
    return sendJson(res, result.status, result.body);
  }
  const agentStopMatch = pathname.match(/^\/api\/agents\/([^/]+)\/stop$/);
  if (agentStopMatch) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    const result = stopAgent(agentStopMatch[1]);
    return sendJson(res, result.status, result.body);
  }
  const sessionStreamMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/stream$/);
  if (sessionStreamMatch) {
    if (method !== "GET") return sendMethodNotAllowed(res);
    const record = getSession(sessionStreamMatch[1]);
    if (!record) return sendJson(res, 404, { ok: false, error: "session not found" });
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    for (const event of record.events) {
      res.write(`event: session-event\ndata: ${JSON.stringify(event)}\n\n`);
    }
    let streams = sessionStreams.get(record.id);
    if (!streams) {
      streams = new Set();
      sessionStreams.set(record.id, streams);
    }
    streams.add(res);
    req.on("close", () => streams.delete(res));
    return;
  }
  if (pathname === "/api/health") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    try {
      const snap = await getSnapshot();
      return sendJson(res, 200, {
        ok: true,
        live: snap.live,
        substrateBase: snap.substrateBase,
        tenants: snap.tenants.length,
        labSessions: labSessions.size,
        generatedAt: snap.generatedAt,
        error: snap.error ?? null,
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
  }
  if (pathname === "/api/dashboard") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    try {
      const snap = await getSnapshot();
      return sendJson(res, 200, snap);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
  }

  // --- static ---
  try {
    let filePath = normalize(join(DIST, pathname));
    if (!filePath.startsWith(normalize(DIST))) {
      res.writeHead(403).end("forbidden");
      return;
    }
    try {
      const s = await stat(filePath);
      if (s.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      if (!extname(filePath)) filePath = join(DIST, "index.html");
    }
    const body = await readFile(filePath);
    const ext = extname(filePath);
    // HTML must never be stale (it points at the hashed JS/CSS bundles). Hashed
    // assets are content-addressed so they're safe to cache hard.
    const isHtml = ext === ".html" || filePath.endsWith("index.html");
    const cacheControl = isHtml
      ? "no-store, no-cache, must-revalidate, max-age=0"
      : "public, max-age=31536000, immutable";
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": cacheControl,
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `dashboard: static=${DIST} api=/api/dashboard substrate=${process.env.SUBSTRATE_BASE_URL ?? "http://127.0.0.1:4100"} on http://0.0.0.0:${PORT}`,
  );
});

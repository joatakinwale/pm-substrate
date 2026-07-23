#!/usr/bin/env node
/**
 * Dependency-free static + API server for the pm-substrate dashboard:
 * Local Agent Lab sessions, control-plane proxy, and the integration
 * workbench (D5-D).
 *
 * Routes:
 *   GET  /api/health              -> server + lab reachability
 *   GET  /api/lab/scenarios       -> registered lab scenarios
 *   /api/sessions...              -> lab session lifecycle + SSE streams
 *   GET  /api/control-plane       -> proxy to substrate-http (D4)
 *   /api/integrations/...         -> governed mapping workbench (D5-D)
 *   GET  /*                       -> built dist/ static files (SPA fallback)
 *
 * Binds 0.0.0.0 (no host allowlist) so the Tailscale MagicDNS name is reachable
 * from Emmanuel's phone.
 *
 * Env:
 *   SUBSTRATE_DASHBOARD_DIST  dist dir
 *   SUBSTRATE_BASE_URL        substrate server (default http://127.0.0.1:4100)
 *   PM_DATABASE_URL           required for lab sessions + workbench writes
 *   PORT                      listen port (default 4178)
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST =
  process.env.SUBSTRATE_DASHBOARD_DIST ?? join(HERE, "..", "dist");
const LOCAL_AGENT_LAB_PACKAGE = "@pm/local-agent-lab";
const PORT = parseInt(process.env.PORT ?? "4178", 10);

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

const labSessions = new Map();
const sessionStreams = new Map();
const activeRunners = new Map();

/** Lazy shared pool for the Token KPIs fold (PM_DATABASE_URL). */
let tokenUsagePool = null;
function getTokenUsagePool() {
  if (!tokenUsagePool) {
    tokenUsagePool = new pg.Pool({ connectionString: process.env.PM_DATABASE_URL });
  }
  return tokenUsagePool;
}

const RUN_REGISTER_PATH =
  process.env.PM_RUN_REGISTER_PATH ??
  join(HERE, "..", "..", "..", "docs", "evidence", "public-proof-run-register-2026-07-13.json");

/**
 * Per-scenario A/B verdicts from the paired local-lab eval ledger
 * (evals.eval_events). Latest run per (scenario, arm); pivoted into one row
 * with the baseline (validation OFF) and substrate (validation ON) verdicts.
 * Empty when no DB / no runs — the renderer shows how to populate it.
 */
async function buildLabVerdicts() {
  if (!process.env.PM_DATABASE_URL) return [];
  let rows;
  try {
    const pool = getTokenUsagePool();
    // Lab eval evidence is keyed by axis, not tenant — each paired run gets a
    // hermetic ephemeral tenant (tnt_lab_*). Latest verdict per scenario/arm
    // across all of them.
    const res = await pool.query(
      `SELECT DISTINCT ON (scenario_id, run_arm)
         scenario_id, failure_class, run_arm, result,
         state_bench_category, coordination_class,
         event->>'expectedAdmission' AS expected_admission
       FROM evals.eval_events
       WHERE axis = 'local_lab' AND run_arm IS NOT NULL
       ORDER BY scenario_id, run_arm, observed_at DESC, id DESC`,
    );
    rows = res.rows;
  } catch {
    return [];
  }
  const byScenario = new Map();
  for (const r of rows) {
    const entry = byScenario.get(r.scenario_id) ?? {
      scenarioId: r.scenario_id,
      failureClass: r.failure_class,
      stateBenchCategory: r.state_bench_category ?? null,
      coordinationClass: r.coordination_class ?? null,
      expectedAdmission:
        r.expected_admission ??
        (String(r.scenario_id).endsWith("-expected-allow") ? "allow" : "block"),
      baselineResult: null,
      substrateResult: null,
    };
    if (r.run_arm === "baseline") entry.baselineResult = r.result;
    if (r.run_arm === "substrate") entry.substrateResult = r.result;
    byScenario.set(r.scenario_id, entry);
  }
  return [...byScenario.values()].sort(
    (a, b) =>
      a.failureClass.localeCompare(b.failureClass) ||
      a.scenarioId.localeCompare(b.scenarioId),
  );
}

/**
 * Normalize the pinned run register into the benchmark comparison payload.
 * The register is the source of truth; the arm rows and blockers below are
 * lifted verbatim from it so the dashboard cannot overstate what ran.
 */
async function buildBenchmarksPayload() {
  const raw = JSON.parse(await readFile(RUN_REGISTER_PATH, "utf8"));

  const ts = raw.toolSandboxFinalDeterministicQualification ?? {};
  const derivative = ts.lostResponseDerivative ?? {};
  const dScore = derivative.strictScoreByArm ?? {};
  const dDup = derivative.duplicateTargetSideEffectCountByArm ?? {};
  const dDisp = derivative.postRestartRetryDispositionByArm ?? {};
  const toolsandboxArms = ["native", "sham", "substrate"].map((arm) => ({
    arm,
    strictScore: dScore[arm] ?? null,
    duplicateSideEffects: dDup[arm] ?? null,
    disposition:
      dDisp[arm] === "blocked"
        ? "blocked the duplicate"
        : dDisp[arm] === "executed_succeeded"
          ? "re-sent (duplicate)"
          : (dDisp[arm] ?? undefined),
  }));

  const sb = raw.stateBenchQualification ?? {};
  const sentinelCorner = (raw.cornerQualifications ?? []).find((c) =>
    String(c.cornerId ?? "").startsWith("sentinel"),
  );
  const otherCorners = (raw.cornerQualifications ?? []).filter(
    (c) => !String(c.cornerId ?? "").startsWith("sentinel"),
  );

  let labScenarios = [];
  try {
    const lab = await defaultLoadLocalAgentLab();
    labScenarios = (lab.SCENARIOS ?? []).map((s) => ({
      scenarioId: s.scenarioId,
      failureClass: s.failureClass,
    }));
  } catch {
    labScenarios = [];
  }

  const labVerdicts = await buildLabVerdicts();

  return {
    recordedAt: raw.recordedAt ?? "",
    claimBoundary: raw.claimBoundary ?? "",
    labScenarios,
    labVerdicts,
    benchmarks: [
      {
        id: "toolsandbox",
        level: "mechanism-qualified",
        headline:
          "On the lost-response + hard-restart derivative, all four arms scored a perfect strict 1.0 — but native and sham each re-sent the message after restart, while the substrate blocked the duplicate. The mechanism is qualified; stochastic public-agent efficacy is not yet measured.",
        arms: toolsandboxArms,
        stats: [
          { label: "Scenario", value: "send_message · cellular-off · multi-turn" },
          { label: "Restart", value: "SIGKILL process group → fresh process" },
          { label: "Upstream", value: String(ts.upstreamRevision ?? "").slice(0, 12) },
        ],
        blockedOn: [
          "A funded non-scripted public-agent run (the scripted probe qualifies the mechanism only; the last live attempt died on OpenAI 429 insufficient_quota before any action)",
          "Retained provider usage / cost / latency receipts",
          "An independently trusted oracle runtime + external trust anchor",
        ],
      },
      {
        id: "statebench",
        level: "conformance-only",
        headline:
          "Adapter and procedure conformance passes, but zero official scored trajectories exist yet. STATE-Bench is the re-aim target precisely because its deterministic final-state scorer CAN see the collateral-state damage ToolSandbox's strict oracle misses.",
        stats: [
          { label: "Pinned upstream tests", value: String(sb.pinnedUpstreamTestResult ?? "–") },
          { label: "Adapter tests", value: String(sb.adapterFocusedTestResult ?? "–") },
          {
            label: "Official scored trajectories",
            value: `${sb.officialScoredTrajectories ?? 0} / ${sb.requiredOfficialScoredTrajectories ?? "–"}`,
          },
        ],
        blockedOn: [
          "The self-provisioned GPT-5.4 locked evaluator (endpoint / deployment / key) — a funding + setup task, not an external gatekeeper",
          ...(sb.missingEvidenceClasses ?? []).map((m) => `Missing receipt: ${String(m).replaceAll("_", " ")}`),
        ],
      },
      {
        id: "sentinel",
        level: sentinelCorner ? "conformance-only" : "not-run",
        headline: sentinelCorner
          ? "MicroHub qualification is source-pinned and cross-verified, but zero behavioral cells have run. Sentinel qualifies the mechanism and corner battery; its 19-relative-task universe is too small to carry the powered confirmatory alone."
          : "Not yet run in this register.",
        stats: [
          {
            label: "Behavioral cells executed",
            value: String((raw.cornerBehavioralHarness ?? {}).behavioralTripletsExecuted ?? 0),
          },
          {
            label: "Harness conformance",
            value: String((raw.cornerBehavioralHarness ?? {}).focusedTestResult ?? "–"),
          },
          { label: "MicroHub qualification", value: sentinelCorner ? "source-verified" : "–" },
        ],
        blockedOn: [
          "A redesigned, externally verified power calculation (the 19×3 / 0.10 declaration is mathematically ineligible under its own planning model)",
          "Externally anchored attempt roots + a clean independent replay",
        ],
      },
      {
        id: "corner",
        level: otherCorners.length > 0 ? "conformance-only" : "not-run",
        headline:
          otherCorners.length > 0
            ? `${otherCorners.length} corner benchmarks are source-pinned and hash-verified (${otherCorners
                .map((c) => c.cornerId)
                .join(", ")}). Every one carries efficacyClaimed=false by construction — they widen coverage, they do not assert benefit.`
            : "No corner benchmarks recorded.",
        stats: otherCorners.map((c) => ({
          label: String(c.cornerId ?? ""),
          value: c.efficacyClaimed ? "efficacy claimed" : "pinned · no efficacy claim",
        })),
      },
    ],
  };
}

async function defaultLoadLocalAgentLab() {
  try {
    return await import(LOCAL_AGENT_LAB_PACKAGE);
  } catch (err) {
    throw new Error(
      `local-agent-lab build is required for lab sessions: ${err?.message ?? String(err)}`,
    );
  }
}

let loadLocalAgentLabImpl = defaultLoadLocalAgentLab;

export function setLocalAgentLabLoaderForTests(loader) {
  loadLocalAgentLabImpl = loader;
}

export function resetDashboardServerStateForTests() {
  for (const runner of activeRunners.values()) {
    runner.stop?.("test reset");
  }
  labSessions.clear();
  sessionStreams.clear();
  activeRunners.clear();
  loadLocalAgentLabImpl = defaultLoadLocalAgentLab;
}

async function loadLocalAgentLab() {
  return loadLocalAgentLabImpl();
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

function agentNumberFromId(agentId) {
  const match = String(agentId).match(/:agent:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function ensureRecordAgent(record, event) {
  if (!event.agentId) return null;
  let agent = record.agents.find((candidate) => candidate.agentId === event.agentId);
  if (agent) return agent;
  const agentNumber =
    Number(event.payload?.agentNumber ?? agentNumberFromId(event.agentId) ?? record.agents.length + 1);
  agent = {
    agentId: event.agentId,
    label: String(event.payload?.label ?? `Agent ${agentNumber}`),
    arms: {},
    behaviorDiverged: false,
  };
  record.agents.push(agent);
  return agent;
}

function mergeAgentResult(record, agentResult) {
  if (!agentResult?.agentId) return;
  let agent = record.agents.find((candidate) => candidate.agentId === agentResult.agentId);
  if (!agent) {
    agent = {
      agentId: agentResult.agentId,
      label: String(agentResult.label ?? `Agent ${record.agents.length + 1}`),
      arms: {},
      behaviorDiverged: false,
    };
    record.agents.push(agent);
  }
  agent.label = String(agentResult.label ?? agent.label);
  agent.arms = { ...agent.arms, ...(agentResult.arms ?? {}) };
  agent.behaviorDiverged = Boolean(agentResult.behaviorDiverged);
}

function updateRecordFromEvent(record, event) {
  record.events.push(event);
  record.updatedAt = event.occurredAt;
  record.latestActivity = event.message;
  if (event.type === "session_stopped") record.status = "stopped";
  if (event.type === "session_completed") record.status = "completed";
  if (event.type === "session_failed") record.status = "failed";
  if (event.type === "agent_started") {
    const agent = ensureRecordAgent(record, event);
    const agentNumber = Number(event.payload?.agentNumber ?? agentNumberFromId(event.agentId));
    if (Number.isFinite(agentNumber)) {
      record.agentCount = Math.max(record.agentCount, agentNumber);
    }
    if (agent) record.summaryMetrics.activeAgents += 1;
  }
  if (event.type === "agent_completed") {
    mergeAgentResult(record, event.payload);
    record.summaryMetrics.activeAgents = Math.max(0, record.summaryMetrics.activeAgents - 1);
  }
  if (event.type === "agent_stopped") {
    record.summaryMetrics.activeAgents = Math.max(0, record.summaryMetrics.activeAgents - 1);
  }
  if (event.type === "arm_completed") {
    const agent = ensureRecordAgent(record, event);
    if (agent && event.arm) {
      agent.arms[event.arm] = event.payload ?? {
        arm: event.arm,
        result: event.result,
      };
    }
  }
  if (event.type === "injection_created") record.summaryMetrics.pendingInjections += 1;
  if (event.type === "mutation_created") record.summaryMetrics.pendingMutations += 1;
  if (event.type === "action_refused") record.summaryMetrics.unsafeBlockedCount += 1;
  if (event.type === "oracle_verdict" && event.result === "fail") {
    record.summaryMetrics.unsafeAdmittedCount += 1;
  }
  if (event.type === "arm_diverged") {
    record.summaryMetrics.divergenceCount += 1;
    const agent = ensureRecordAgent(record, event);
    if (agent) agent.behaviorDiverged = true;
    if (
      event.payload?.noSubstrateResult === "fail" &&
      event.payload?.substrateResult !== "fail"
    ) {
      record.summaryMetrics.substrateProtectedCount += 1;
    }
  }
  if (event.type === "mutation_applied") {
    record.summaryMetrics.mutationAppliedCount += 1;
    if (event.payload?.id) {
      record.summaryMetrics.pendingMutations = Math.max(0, record.summaryMetrics.pendingMutations - 1);
    }
  }
  if (event.type === "injection_applied") {
    record.summaryMetrics.injectionAppliedCount += 1;
    if (event.payload?.id) {
      record.summaryMetrics.pendingInjections = Math.max(0, record.summaryMetrics.pendingInjections - 1);
    }
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
      activeAgents: 0,
      blockedAgents: 0,
      pendingInjections: 0,
      pendingMutations: 0,
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
      record.latestActivity =
        result.status === "stopped" ? "Session stopped." : "Session completed.";
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
        type: result.status === "stopped" ? "session_stopped" : "session_completed",
        sessionId: id,
        scenarioId: scenario.scenarioId,
        failureClass: scenario.failureClass,
        occurredAt: record.updatedAt,
        message:
          result.status === "stopped"
            ? "Stopped session result stored."
            : "Session result stored.",
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

function normalizeTargetArm(value) {
  const arm = normalizeString(value);
  if (arm === "substrate" || arm === "no_substrate") return arm;
  return "both";
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
  const runner = activeRunners.get(id);
  if (!runner) {
    return { status: 409, body: { ok: false, error: "session is not running" } };
  }

  const targetAgentId = normalizeString(body.targetAgentId ?? body.agentId) || undefined;
  if (targetAgentId && !recordHasAgent(record, targetAgentId)) {
    return { status: 400, body: { ok: false, error: "target agent not found in session" } };
  }

  const prompt = normalizeString(body.prompt ?? body.text);
  const fileRefs = normalizeFileRefs(body.fileRefs);
  const targetArm = normalizeTargetArm(body.targetArm ?? body.armTarget);
  const mutationDescription = normalizeString(
    body.mutationDescription ?? body.mutation?.description,
  );
  const mutationType =
    normalizeString(body.mutationType ?? body.mutation?.type) || "changed_working_condition";
  const beforeEventCount = record.events.length;
  let delivered = false;

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
    try {
      runner.inject(injection);
    } catch (err) {
      return { status: 409, body: { ok: false, error: err?.message ?? String(err) } };
    }
    delivered = true;
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
    try {
      runner.mutate(mutation);
    } catch (err) {
      return { status: 409, body: { ok: false, error: err?.message ?? String(err) } };
    }
    delivered = true;
  }

  if (!delivered) {
    return {
      status: 400,
      body: { ok: false, error: "provide a prompt, fileRefs, or mutationDescription" },
    };
  }

  const events = record.events.slice(beforeEventCount);
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
  const runner = activeRunners.get(id);
  if (!runner) return { status: 409, body: { ok: false, error: "session is not running" } };
  let agent;
  try {
    agent = runner.addAgent();
  } catch (err) {
    return { status: 409, body: { ok: false, error: err?.message ?? String(err) } };
  }
  return { status: 202, body: { ok: true, session: summarizeSession(record), agent } };
}

export const server = createServer(async (req, res) => {
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
  if (pathname === "/api/control-plane") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    // D4: proxy the substrate control-plane endpoint (five questions from the
    // admitted log). Tenant/scope come from env; substrate from SUBSTRATE_BASE_URL.
    const base = process.env.SUBSTRATE_BASE_URL ?? "http://127.0.0.1:4100";
    const tenant = process.env.PM_DEV_TENANT_ID ?? "tenant_dev";
    const scope = process.env.PM_DEV_SCOPE ?? "pm-substrate-dev";
    const agent = process.env.PM_DEV_AGENT_ID ?? "joat-dev";
    try {
      const upstream = await fetch(
        `${base}/tenants/${encodeURIComponent(tenant)}/control-plane?scope=${encodeURIComponent(scope)}&agentId=${encodeURIComponent(agent)}`,
      );
      const body = await upstream.text();
      res.writeHead(upstream.status, { "content-type": "application/json" });
      return res.end(body);
    } catch (err) {
      return sendJson(res, 502, {
        error: `substrate control-plane unreachable at ${base}: ${String(err)}`,
      });
    }
  }
  if (pathname === "/api/health") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    return sendJson(res, 200, {
      ok: true,
      substrateBase: process.env.SUBSTRATE_BASE_URL ?? "http://127.0.0.1:4100",
      databaseConfigured: Boolean(process.env.PM_DATABASE_URL),
      labSessions: labSessions.size,
    });
  }

  // --- Agent-state benchmark comparison ---
  // Normalizes the signed public-proof run register (a pinned evidence
  // artifact) into the four-arm comparison the dashboard shows. Read-only;
  // never asserts efficacy — the register's own claimBoundary rides along.
  if (pathname === "/api/benchmarks") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    try {
      const payload = await buildBenchmarksPayload();
      return sendJson(res, 200, payload);
    } catch (err) {
      return sendJson(res, 500, { error: `benchmark register unavailable: ${String(err)}` });
    }
  }

  // --- Token KPIs (capstone monitoring & control) ---
  // Reads admitted eval.token.usage events via the SAME fold the CLI uses
  // (@pm/local-agent-lab computeTokenUsage), so dashboard numbers can never
  // drift from the runner's/report's.
  if (pathname === "/api/token-usage/runs" || pathname === "/api/token-usage") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    if (!process.env.PM_DATABASE_URL) {
      return sendJson(res, 503, { error: "PM_DATABASE_URL is required for token KPIs." });
    }
    try {
      const lab = await defaultLoadLocalAgentLab();
      const pool = getTokenUsagePool();
      const tenantId = process.env.PM_DEV_TENANT_ID ?? "tenant_dev";
      if (pathname === "/api/token-usage/runs") {
        const runs = await lab.listTokenUsageRuns(pool, { tenantId });
        return sendJson(res, 200, { tenantId, runs });
      }
      const label = new URL(req.url ?? "/", "http://localhost").searchParams.get("label");
      if (!label) return sendJson(res, 400, { error: "label query parameter is required" });
      const metrics = await lab.computeTokenUsage(pool, { tenantId, runLabel: label });
      return sendJson(res, 200, metrics);
    } catch (err) {
      return sendJson(res, 500, { error: `token KPIs unavailable: ${String(err)}` });
    }
  }

  // --- integration workbench (D5-D) ---
  // JSON only; no integration route may fall through to index.html. All
  // writes go through the admitted log via @pm/integration-kit; sync is
  // exposed as dry-run preview only.
  const mappingStateMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/mappings$/);
  const mappingValidateMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/mappings\/validate$/);
  const mappingProposeMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/mappings\/propose$/);
  const mappingDecisionMatch = pathname.match(
    /^\/api\/integrations\/([^/]+)\/mappings\/([^/]+)\/(approve|reject)$/,
  );
  const syncPreviewMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/sync\/preview$/);
  const liquidDiscoverMatch = pathname.match(/^\/api\/integrations\/liquid\/discover$/);

  if (
    mappingStateMatch ||
    mappingValidateMatch ||
    mappingProposeMatch ||
    mappingDecisionMatch ||
    syncPreviewMatch ||
    liquidDiscoverMatch
  ) {
    let workbench;
    try {
      workbench = await import("./integration-workbench.mjs");
    } catch (err) {
      return sendJson(res, 503, {
        ok: false,
        error: `integration workbench unavailable: ${err?.message ?? String(err)}`,
      });
    }
    try {
      if (mappingValidateMatch) {
        if (method !== "POST") return sendMethodNotAllowed(res);
        const result = await workbench.validateMapping(await readJsonBody(req));
        return sendJson(res, result.status, result.body);
      }
      if (mappingProposeMatch) {
        if (method !== "POST") return sendMethodNotAllowed(res);
        const body = await readJsonBody(req);
        const validationResult = await workbench.validateMapping(body);
        if (!validationResult.body.ok) {
          return sendJson(res, 400, {
            ok: false,
            error: validationResult.body.validation.issues
              .map((issue) => issue.message)
              .join("; "),
            validation: validationResult.body.validation,
          });
        }
        const deps = workbench.createIntegrationWorkbench();
        if (!deps.available) return sendJson(res, 503, { ok: false, error: deps.error });
        const result = await workbench.proposeMapping(deps, mappingProposeMatch[1], body);
        return sendJson(res, result.status, result.body);
      }
      const deps = workbench.createIntegrationWorkbench();
      if (!deps.available) return sendJson(res, 503, { ok: false, error: deps.error });
      if (liquidDiscoverMatch) {
        if (method !== "POST") return sendMethodNotAllowed(res);
        const result = await workbench.liquidDiscoverProposal(deps, await readJsonBody(req));
        return sendJson(res, result.status, result.body);
      }
      if (mappingStateMatch) {
        if (method !== "GET") return sendMethodNotAllowed(res);
        const result = await workbench.getMappingState(deps, mappingStateMatch[1]);
        return sendJson(res, result.status, result.body);
      }
      if (mappingDecisionMatch) {
        if (method !== "POST") return sendMethodNotAllowed(res);
        const result = await workbench.decideMapping(
          deps,
          mappingDecisionMatch[1],
          mappingDecisionMatch[2],
          mappingDecisionMatch[3],
          await readJsonBody(req),
        );
        return sendJson(res, result.status, result.body);
      }
      if (syncPreviewMatch) {
        if (method !== "POST") return sendMethodNotAllowed(res);
        const result = await workbench.previewLiquidSync(
          deps,
          syncPreviewMatch[1],
          await readJsonBody(req),
        );
        return sendJson(res, result.status, result.body);
      }
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

export function startDashboardServer(port = PORT, host = "0.0.0.0") {
  return server.listen(port, host, () => {
    const address = server.address();
    const actualPort =
      typeof address === "object" && address !== null ? address.port : port;
    console.log(
      `dashboard: static=${DIST} substrate=${process.env.SUBSTRATE_BASE_URL ?? "http://127.0.0.1:4100"} on http://${host}:${actualPort}`,
    );
  });
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  startDashboardServer();
}

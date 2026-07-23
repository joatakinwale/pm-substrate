/**
 * Integration Workbench API (D5-D) — the dashboard's human adoption surface
 * over the EXISTING governed integration kit. Every write here goes through
 * the admitted log (pm.mapping.proposed/approved/rejected); sync is exposed
 * as dry-run preview ONLY — the dashboard never performs a live Liquid sync,
 * and Liquid discovery produces pending proposals, never approvals.
 *
 * Reads/writes flow through @pm/integration-kit and @pm/events; this module
 * adds zero new authority. Deterministic substrate boundary stays intact.
 */

import pg from "pg";

import { asEntityMapping, validateEntityMapping } from "@pm/entity-mapping";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import {
  approveEntityMapping,
  entityMappingHash,
  getMappingApprovalState,
  proposeEntityMapping,
  rejectEntityMapping,
  syncFromLiquid,
} from "@pm/integration-kit";

const tenantId = () => process.env.PM_DEV_TENANT_ID ?? "tenant_dev";
const agentId = () => process.env.PM_DEV_AGENT_ID ?? "joat-dev";

const TIER1_PRIMITIVES = [
  "Counterparty",
  "Engagement",
  "Transaction",
  "Resource",
  "Communication",
  "Document",
  "Event",
];

let sharedPool = null;

async function defaultLiquidClientFactory(liquidCmd) {
  const [command, ...cmdArgs] = (liquidCmd ?? "uvx liquid-mcp").split(/\s+/);
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport, getDefaultEnvironment } = await import(
    "@modelcontextprotocol/sdk/client/stdio.js"
  );
  // The SDK spawns stdio servers with a SAFELIST env, not the parent env —
  // forward exactly the variables the Liquid sidecar documents.
  const sidecarEnv = { ...getDefaultEnvironment() };
  for (const key of [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "LIQUID_LLM_PROVIDER",
    "LIQUID_LLM_MODEL",
    "LIQUID_LLM_BASE_URL",
    "LIQUID_ALLOW_WRITES",
  ]) {
    const value = process.env[key];
    if (value !== undefined) sidecarEnv[key] = value;
  }
  const client = new Client({
    name: "substrate-dashboard-workbench",
    version: "0.1.0",
  });
  await client.connect(
    new StdioClientTransport({ command, args: cmdArgs, env: sidecarEnv }),
  );
  return client;
}

let liquidClientFactory = defaultLiquidClientFactory;

export function setLiquidClientFactoryForTests(factory) {
  liquidClientFactory = factory ?? defaultLiquidClientFactory;
}

export function resetIntegrationWorkbenchForTests() {
  liquidClientFactory = defaultLiquidClientFactory;
  if (sharedPool) {
    void sharedPool.end().catch(() => {});
    sharedPool = null;
  }
}

export function createIntegrationWorkbench({
  databaseUrl = process.env.PM_DATABASE_URL,
} = {}) {
  if (!databaseUrl) {
    return {
      available: false,
      error: "PM_DATABASE_URL is required for integration workbench routes.",
    };
  }
  if (!sharedPool) {
    sharedPool = new pg.Pool({ connectionString: databaseUrl });
  }
  return {
    available: true,
    pool: sharedPool,
    events: new PostgresEventStore(sharedPool),
    graph: new PostgresGraph(sharedPool),
  };
}

const badRequest = (error, extra = {}) => ({
  status: 400,
  body: { ok: false, error, ...extra },
});

function checkMappingBody(body) {
  const raw = body?.mapping;
  const validation = validateEntityMapping(raw);
  if (!validation.valid) return { validation };
  const mapping = asEntityMapping(raw);
  return { mapping, mappingHash: entityMappingHash(mapping), validation };
}

export async function getMappingState(deps, appName) {
  const state = await getMappingApprovalState(deps.events, tenantId(), appName);
  return {
    status: 200,
    body: {
      ok: true,
      appName,
      approvedHash: state.approvedHash ?? null,
      approvedBy: state.approvedBy ?? null,
      approvedMapping: state.approvedMapping ?? null,
      pending: state.pending.map((p) => ({
        mappingHash: p.mappingHash,
        origin: p.origin,
        proposedBy: p.proposedBy,
        proposedAt: p.proposedAt,
        reason: p.reason ?? null,
        mapping: p.mapping,
      })),
    },
  };
}

export async function validateMapping(body) {
  const checked = checkMappingBody(body);
  return {
    status: 200,
    body: {
      ok: checked.validation.valid,
      ...(checked.mappingHash ? { mappingHash: checked.mappingHash } : {}),
      validation: checked.validation,
    },
  };
}

export async function proposeMapping(deps, appName, body) {
  const checked = checkMappingBody(body);
  if (!checked.validation.valid) {
    return badRequest(
      checked.validation.issues.map((i) => i.message).join("; "),
      { validation: checked.validation },
    );
  }
  const origin = body.origin === "liquid_discovery" ? "liquid_discovery" : "manual";
  const result = await proposeEntityMapping(deps.events, {
    tenantId: tenantId(),
    appName,
    mapping: checked.mapping,
    proposedBy: agentId(),
    origin,
    ...(body.reason ? { reason: String(body.reason) } : {}),
  });
  return { status: 200, body: { ok: true, appName, ...result } };
}

export async function decideMapping(deps, appName, mappingHash, decision, body = {}) {
  const decide = decision === "approve" ? approveEntityMapping : rejectEntityMapping;
  try {
    await decide(deps.events, {
      tenantId: tenantId(),
      appName,
      mappingHash,
      decidedBy: agentId(),
      ...(body.reason ? { reason: String(body.reason) } : {}),
    });
  } catch (err) {
    return { status: 409, body: { ok: false, error: err?.message ?? String(err) } };
  }
  return getMappingState(deps, appName);
}

/**
 * Dry-run ONLY: the dashboard previews what a governed Liquid sync would do
 * (including whether the approval gate would refuse it). Zero graph writes,
 * zero sync events — enforced by hard-coding dryRun here, not trusting the
 * request body.
 */
export async function previewLiquidSync(deps, appName, body) {
  const checked = checkMappingBody(body);
  if (!checked.validation.valid) {
    return badRequest(
      checked.validation.issues.map((i) => i.message).join("; "),
      { validation: checked.validation },
    );
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.trim() : "";
  const externalIdField =
    typeof body.externalIdField === "string" ? body.externalIdField.trim() : "";
  if (!url || !sourceName || !externalIdField) {
    return badRequest("url, sourceName, and externalIdField are required");
  }
  let client;
  try {
    client = await liquidClientFactory(body.liquidCmd);
  } catch (err) {
    return {
      status: 502,
      body: { ok: false, error: `liquid sidecar unavailable: ${err?.message ?? String(err)}` },
    };
  }
  try {
    const result = await syncFromLiquid(deps, client, {
      tenantId: tenantId(),
      appName,
      mapping: checked.mapping,
      url,
      sourceName,
      externalIdField,
      ...(typeof body.endpoint === "string" && body.endpoint ? { endpoint: body.endpoint } : {}),
      syncedBy: agentId(),
      dryRun: true,
    });
    return { status: 200, body: { ok: true, appName, dryRun: true, ...result } };
  } catch (err) {
    return { status: 502, body: { ok: false, error: err?.message ?? String(err) } };
  } finally {
    await client.close?.().catch?.(() => {});
  }
}

/**
 * Liquid-assisted "no config" lane: build a conservative starter mapping from
 * operator choices (tier1/concrete/externalIdField are ALWAYS the operator's
 * call — this path never infers business semantics) and record it as a
 * PENDING pm.mapping.proposed with origin liquid_discovery. Never approved
 * here; never synced here.
 */
export function buildStarterMapping({ sourceName, tier1, concrete, externalIdField, fields }) {
  const optionalFields = fields.filter((field) => field !== externalIdField);
  return {
    profile: null,
    mappingVersion: 1,
    entities: {
      [sourceName]: {
        tier1,
        concrete,
        identityFields: [externalIdField],
        ...(optionalFields.length > 0 ? { optionalFields } : {}),
        schemaVersion: 1,
      },
    },
    description: `Liquid-assisted starter mapping for ${sourceName}`,
  };
}

export async function liquidDiscoverProposal(deps, body) {
  const appName = typeof body.appName === "string" ? body.appName.trim() : "";
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.trim() : "";
  const externalIdField =
    typeof body.externalIdField === "string" ? body.externalIdField.trim() : "";
  const tier1 = typeof body.tier1 === "string" ? body.tier1.trim() : "";
  const concrete =
    typeof body.concrete === "string" && body.concrete.trim() ? body.concrete.trim() : tier1;
  const fields = Array.isArray(body.fields)
    ? body.fields.map((f) => String(f).trim()).filter(Boolean)
    : [];
  if (!appName || !sourceName || !externalIdField) {
    return badRequest("appName, sourceName, and externalIdField are required");
  }
  if (!TIER1_PRIMITIVES.includes(tier1)) {
    return badRequest(`tier1 must be one of: ${TIER1_PRIMITIVES.join(", ")}`);
  }
  if (fields.length === 0) {
    return badRequest("fields is required (populate it from Liquid discovery)");
  }
  const mapping = buildStarterMapping({
    sourceName,
    tier1,
    concrete,
    externalIdField,
    fields,
  });
  const validation = validateEntityMapping(asEntityMapping(mapping));
  if (!validation.valid) {
    return badRequest(validation.issues.map((i) => i.message).join("; "), { validation });
  }
  const result = await proposeEntityMapping(deps.events, {
    tenantId: tenantId(),
    appName,
    mapping,
    proposedBy: agentId(),
    origin: "liquid_discovery",
    reason:
      typeof body.reason === "string" && body.reason
        ? body.reason
        : `Starter mapping for ${sourceName} from ${body.url ?? "operator input"}`,
  });
  return {
    status: 200,
    body: {
      ok: true,
      appName,
      mappingHash: result.mappingHash,
      proposed: result.proposed,
      approved: false,
      origin: "liquid_discovery",
      mapping,
    },
  };
}

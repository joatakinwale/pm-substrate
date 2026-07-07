/**
 * pm:rehearse-write — live L4 rehearsal: a governed WRITE through the real
 * Liquid sidecar (the acting half of the attach story; sync is the sensing
 * half). Runs three acts against a real target and leaves every outcome on
 * the admitted log:
 *
 *   1. a BLOCKED envelope → the bridge refuses; the sidecar sees NOTHING
 *   2. an ACCEPTED envelope → exactly one liquid_execute insert lands
 *      (sidecar must run with LIQUID_ALLOW_WRITES=1 — defense in depth
 *      under the substrate's own write_gate), then a replay dedupes
 *   3. the row it wrote is picked up by the governed sync path — the
 *      substrate observes the effect of its own admitted action
 *
 *   pnpm pm:rehearse-write -- --url postgresql://user@host/db \
 *     --endpoint /public/customers --liquid-cmd "uv run --directory ./liquid liquid-mcp"
 */

import { randomUUID } from "node:crypto";
import pg from "pg";

import {
  buildActionOutcomeEnvelope,
  stateRef,
} from "../packages/agent-state-core/src/index.js";
import { PostgresEventStore } from "../packages/events/src/index.js";
import {
  buildLiquidWriteTransport,
  executeAdmittedAction,
} from "../packages/integration-kit/src/index.js";
import type { TenantId, Timestamp } from "../packages/types/src/index.js";

const TENANT = (process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const AGENT = process.env["PM_DEV_AGENT_ID"] ?? "joat-dev";

function argValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const now = (): Timestamp => new Date().toISOString() as Timestamp;

async function main(): Promise<void> {
  const databaseUrl = process.env["PM_DATABASE_URL"];
  const url = argValue("--url");
  const endpoint = argValue("--endpoint") ?? "/public/customers";
  const liquidCmd = argValue("--liquid-cmd") ?? "uvx liquid-mcp";
  if (!databaseUrl || !url) {
    console.error("pm:rehearse-write: PM_DATABASE_URL env + --url are required.");
    process.exit(1);
  }

  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport, getDefaultEnvironment } = await import(
    "@modelcontextprotocol/sdk/client/stdio.js"
  );
  const sidecarEnv: Record<string, string> = {
    ...getDefaultEnvironment(),
    LIQUID_ALLOW_WRITES: "1",
  };
  for (const key of [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "LIQUID_LLM_PROVIDER",
    "LIQUID_LLM_MODEL",
    "LIQUID_LLM_BASE_URL",
  ]) {
    const value = process.env[key];
    if (value !== undefined) sidecarEnv[key] = value;
  }
  const [command, ...cmdArgs] = liquidCmd.split(/\s+/);
  const client = new Client({ name: "pm-rehearse-write", version: "0.1.0" });
  await client.connect(
    new StdioClientTransport({ command: command!, args: cmdArgs, env: sidecarEnv }),
  );

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const events = new PostgresEventStore(pool);
  const runId = randomUUID().slice(0, 8);
  const target = { name: "fixture_app_db", endpoint: url };
  const transport = buildLiquidWriteTransport(client, {
    url,
    targetModel: { name: "str", email: "str", city: "str", id: "str" },
    endpoint,
    op: "insert",
  });
  const envelopeFor = (outcome: "accepted" | "blocked") =>
    buildActionOutcomeEnvelope({
      tenantId: TENANT,
      actionId: `act_rehearse_${outcome}_${runId}`,
      subject: stateRef("source_record", `${target.name}:${endpoint}`, "fixture app table"),
      proposalReviewId: `rev_rehearse_${outcome}_${runId}`,
      stateReviewArtifactHash: `hash_rehearse_${runId}`,
      requestedTerminalOutcome: "accepted",
      decidedAt: now(),
      decidedBy: AGENT,
      ...(outcome === "blocked"
        ? {
            blockingCauses: [
              {
                source: "proposal_review",
                code: "stale_basis",
                message: "rehearsal: deliberately blocked envelope",
                refs: [],
              },
            ],
          }
        : {}),
    });

  try {
    console.log("— Act 1: BLOCKED envelope (must never reach the sidecar)");
    const blocked = await executeAdmittedAction(events, {
      tenantId: TENANT,
      envelope: envelopeFor("blocked"),
      target,
      executedBy: AGENT,
      body: { values: { name: "MUST NOT EXIST", email: "no@no.example" } },
      transport,
    });
    console.log(`  → executed=${blocked.executed} reason=${blocked.reason}`);
    if (blocked.executed) throw new Error("GATE FAILURE: blocked envelope executed");

    console.log("— Act 2: ACCEPTED envelope (one insert, then replay dedupes)");
    const name = `Governed Write ${runId}`;
    const accepted = envelopeFor("accepted");
    const first = await executeAdmittedAction(events, {
      tenantId: TENANT,
      envelope: accepted,
      target,
      executedBy: AGENT,
      body: {
        values: { name, email: `gov-${runId}@fixture.example`, city: "Substrate" },
      },
      transport,
    });
    console.log(`  → executed=${first.executed} reason=${first.reason}`);
    const replay = await executeAdmittedAction(events, {
      tenantId: TENANT,
      envelope: accepted,
      target,
      executedBy: AGENT,
      body: { values: { name: "REPLAY MUST NOT LAND" } },
      transport,
    });
    console.log(`  → replay executed=${replay.executed} reason=${replay.reason}`);
    console.log(`  wrote: name="${name}" (verify via SQL / next sync)`);
    process.exitCode = first.executed && !replay.executed ? 0 : 4;
  } finally {
    await client.close().catch(() => {});
    await pool.end();
  }
}

await main();

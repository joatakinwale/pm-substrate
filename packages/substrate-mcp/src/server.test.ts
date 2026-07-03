import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { TenantId } from "@pm/types";

import {
  ACTION_EVENT_TYPE,
  PROPOSAL_EVENT_TYPE,
  SUBSTRATE_MCP_TOOL_NAMES,
  buildSubstrateMcpServer,
} from "./server.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

type ToolResult = {
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  content?: { type: string; text?: string }[];
};

describeIfDb("substrate-mcp: the five tools over a real substrate", () => {
  let pool: pg.Pool;
  let client: Client;
  let tenantId: TenantId;
  const scope = `mcp-test-${randomUUID().slice(0, 8)}`;

  const call = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> =>
    (await client.callTool({ name, arguments: args })) as ToolResult;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_mcp_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    const server = buildSubstrateMcpServer({
      pool,
      tenantId,
      agentId: "mcp-test-agent",
      scope,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.1" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    await client.close().catch(() => {});
    await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("exposes exactly the five roadmap tools", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(
      [...SUBSTRATE_MCP_TOOL_NAMES].sort(),
    );
  });

  it("checkpoint → resume: the ledger, not chat history, carries state", async () => {
    const rec = await call("substrate_checkpoint", {
      kind: "decision",
      title: "MCP surface is the front door",
      summary: "Agents mount the substrate with a config line.",
      scope,
    });
    expect(rec.isError).toBeFalsy();
    const resume = await call("substrate_resume", { scope });
    const sc = resume.structuredContent as {
      chainValid: boolean;
      decisions: { title: string }[];
    };
    expect(sc.chainValid).toBe(true);
    expect(sc.decisions.map((d) => d.title)).toContain(
      "MCP surface is the front door",
    );
  });

  it("observe → propose (fresh basis) → admit: accepted and executed", async () => {
    const obs = (await call("substrate_observe", { scope }))
      .structuredContent as {
      view: { readSet: unknown[]; subject: unknown };
      contract: Record<string, unknown>;
    };
    expect(obs.view.readSet.length).toBeGreaterThan(0);

    const proposal = (
      await call("substrate_propose", {
        actionType: "record_checkpoint",
        subject: { kind: "projection", id: `dev_scope:${scope}` },
        payload: {
          kind: "work",
          title: "Governed write through the gate",
          summary: "Recorded via propose→admit, not directly.",
          status: "open",
        },
        contract: obs.contract,
        readSet: obs.view.readSet,
        scope,
      })
    ).structuredContent as {
      proposalId: string;
      valid: boolean;
      artifactHash: string;
    };
    expect(proposal.valid).toBe(true);

    const admit = (
      await call("substrate_admit", {
        proposalId: proposal.proposalId,
        decidedBy: "human:test",
      })
    ).structuredContent as {
      terminalOutcome: string;
      executed: boolean;
      artifactHashValid: boolean;
    };
    expect(admit.artifactHashValid).toBe(true);
    expect(admit.terminalOutcome).toBe("accepted");
    expect(admit.executed).toBe(true);

    // The executed checkpoint is now real ledger state…
    const resume = (await call("substrate_resume", { scope }))
      .structuredContent as { openWork: { title: string }[] };
    expect(resume.openWork.map((w) => w.title)).toContain(
      "Governed write through the gate",
    );
    // …and the proposal + action events are in the admitted log.
    const evs = await pool.query<{ type: string }>(
      `SELECT type FROM events.events WHERE tenant_id = $1 AND type = ANY($2)`,
      [tenantId, [PROPOSAL_EVENT_TYPE, ACTION_EVENT_TYPE]],
    );
    expect(evs.rows.map((r) => r.type)).toEqual(
      expect.arrayContaining([PROPOSAL_EVENT_TYPE, ACTION_EVENT_TYPE]),
    );
  });

  it("stale basis is warned at propose and BLOCKED at admit (no execution)", async () => {
    // Basis A: observe now.
    const stale = (await call("substrate_observe", { scope }))
      .structuredContent as {
      view: { readSet: unknown[] };
      contract: Record<string, unknown>;
    };

    // The world moves: a new checkpoint supersedes the ledger head.
    await call("substrate_checkpoint", {
      kind: "decision",
      title: `World moved ${randomUUID().slice(0, 6)}`,
      summary: "Head advanced after the agent observed.",
      scope,
    });

    // Propose from the stale basis (warn-first: recorded, with warnings).
    const proposal = (
      await call("substrate_propose", {
        actionType: "record_checkpoint",
        subject: { kind: "projection", id: `dev_scope:${scope}` },
        payload: {
          kind: "work",
          title: "Should never execute",
          summary: "Built on a superseded basis.",
        },
        contract: stale.contract,
        readSet: stale.view.readSet,
        scope,
      })
    ).structuredContent as { proposalId: string; warningCount: number };
    expect(proposal.warningCount).toBeGreaterThan(0);

    // Admit re-reviews in enforce mode against the CURRENT head → blocked.
    const admit = (
      await call("substrate_admit", {
        proposalId: proposal.proposalId,
        decidedBy: "human:test",
      })
    ).structuredContent as {
      terminalOutcome: string;
      executed: boolean;
      blockingCauses: { code: string }[];
    };
    expect(admit.terminalOutcome).toBe("blocked");
    expect(admit.executed).toBe(false);
    expect(admit.blockingCauses.length).toBeGreaterThan(0);

    // Nothing executed: the work item is not in the ledger.
    const resume = (await call("substrate_resume", { scope }))
      .structuredContent as { openWork: { title: string }[] };
    expect(resume.openWork.map((w) => w.title)).not.toContain(
      "Should never execute",
    );
  });
});

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type { TenantId } from "@pm/types";

import { startSubstrateMcpHttpServer } from "./http.js";
import { SUBSTRATE_MCP_TOOL_NAMES } from "./server.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("substrate-mcp streamable-HTTP transport (bearer auth)", () => {
  let pool: pg.Pool;
  let server: Server;
  let tenantId: TenantId;
  const token = `tok_${randomUUID()}${randomUUID()}`;
  const port = 18790 + Math.floor(Math.random() * 1000);
  const url = new URL(`http://127.0.0.1:${port}/mcp`);

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_mcph_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    server = await startSubstrateMcpHttpServer({
      pool,
      tenantId,
      agentId: "mcp-http-test",
      scope: "mcp-http-test",
      bearerToken: token,
      port,
    });
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("rejects requests without the bearer token (401)", async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong token (401) and never leaks tool data", async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer wrong-token-wrong-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain("substrate_");
  });

  it("serves the five tools over authenticated streamable HTTP", async () => {
    const client = new Client({ name: "http-test-client", version: "0.0.1" });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(
      [...SUBSTRATE_MCP_TOOL_NAMES].sort(),
    );
    const rec = (await client.callTool({
      name: "substrate_checkpoint",
      arguments: {
        kind: "decision",
        title: "HTTP transport live",
        summary: "Recorded over authenticated streamable HTTP.",
        scope: "mcp-http-test",
      },
    })) as { isError?: boolean };
    expect(rec.isError).toBeFalsy();
    const resume = (await client.callTool({
      name: "substrate_resume",
      arguments: { scope: "mcp-http-test" },
    })) as { structuredContent?: { decisions: { title: string }[] } };
    expect(
      resume.structuredContent?.decisions.map((d) => d.title),
    ).toContain("HTTP transport live");
    await client.close();
  });

  it("refuses to start with a weak or missing token", async () => {
    expect(() =>
      startSubstrateMcpHttpServer({ pool, bearerToken: "short", port: port + 1 }),
    ).toThrow(/never open by default/);
  });
});

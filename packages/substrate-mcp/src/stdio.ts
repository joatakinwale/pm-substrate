#!/usr/bin/env node
/**
 * stdio entry point — mount the substrate in any MCP-capable harness:
 *
 *   claude mcp add pm-substrate -- node packages/substrate-mcp/dist/stdio.js
 *
 * Env: PM_DATABASE_URL (required), PM_DEV_TENANT_ID, PM_DEV_AGENT_ID,
 * PM_DEV_SCOPE. stdio trust boundary = the OS user; the HTTP transport with
 * bearer-token auth is the recorded follow-up work item.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pg from "pg";

import { buildSubstrateMcpServer } from "./server.js";

const databaseUrl = process.env["PM_DATABASE_URL"];
if (!databaseUrl) {
  console.error("pm-substrate-mcp: PM_DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const server = buildSubstrateMcpServer({ pool });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("pm-substrate-mcp: stdio server ready");

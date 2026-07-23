/**
 * Streamable-HTTP transport for the substrate MCP surface (D2 follow-up).
 *
 * Remote/mount-anywhere counterpart to stdio: stateless JSON mode (a fresh
 * McpServer + transport per request — proposals already survive statelessly
 * as artifact events, so no session affinity is needed) behind mandatory
 * bearer-token auth. The server REFUSES to start without a token: the HTTP
 * surface is never open by default.
 *
 *   PM_MCP_TOKEN=… PM_DATABASE_URL=… pnpm mcp:http   # listens on :8790/mcp
 */

import { createServer, type Server } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import pg from "pg";

import { buildSubstrateMcpServer, type SubstrateMcpDeps } from "./server.js";

export interface SubstrateMcpHttpOptions extends SubstrateMcpDeps {
  readonly bearerToken: string;
  readonly port?: number;
  readonly path?: string;
}

const tokenMatches = (header: string | undefined, token: string): boolean => {
  if (!header?.startsWith("Bearer ")) return false;
  const presented = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(token);
  return (
    presented.length === expected.length &&
    timingSafeEqual(presented, expected)
  );
};

/** Start the HTTP MCP endpoint. Returns the listening node:http server. */
export function startSubstrateMcpHttpServer(
  options: SubstrateMcpHttpOptions,
): Promise<Server> {
  const { bearerToken, port = 8790, path = "/mcp", ...deps } = options;
  if (!bearerToken || bearerToken.length < 16) {
    throw new Error(
      "substrate-mcp http: bearerToken (min 16 chars) is required — the HTTP surface is never open by default.",
    );
  }

  const httpServer = createServer(async (req, res) => {
    try {
      if (new URL(req.url ?? "/", "http://x").pathname !== path) {
        res.writeHead(404).end();
        return;
      }
      if (!tokenMatches(req.headers.authorization, bearerToken)) {
        res
          .writeHead(401, { "content-type": "application/json" })
          .end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      // Stateless JSON mode: fresh server + transport per request.
      const server = buildSubstrateMcpServer(deps);
      // Stateless mode: no session ids. Cast: the SDK's option/transport types
      // conflict with exactOptionalPropertyTypes; runtime behavior is verified
      // by http.test.ts (auth + full client flow over this transport).
      const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      } as never);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport as never);
      await transport.handleRequest(req, res);
    } catch (error) {
      if (!res.headersSent) {
        res
          .writeHead(500, { "content-type": "application/json" })
          .end(JSON.stringify({ error: String(error) }));
      }
    }
  });

  return new Promise((resolve) => {
    httpServer.listen(port, "127.0.0.1", () => resolve(httpServer));
  });
}

/* c8 ignore start — thin CLI shell over the tested server factory */
export async function runHttpEntry(): Promise<void> {
  const databaseUrl = process.env["PM_DATABASE_URL"];
  const token = process.env["PM_MCP_TOKEN"];
  if (!databaseUrl || !token) {
    console.error(
      "substrate-mcp http: PM_DATABASE_URL and PM_MCP_TOKEN are required.",
    );
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const port = Number(process.env["PM_MCP_PORT"] ?? 8790);
  await startSubstrateMcpHttpServer({ pool, bearerToken: token, port });
  console.error(`pm-substrate-mcp: http server ready on 127.0.0.1:${port}/mcp`);
}
/* c8 ignore stop */

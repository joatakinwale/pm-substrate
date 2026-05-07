#!/usr/bin/env tsx
/**
 * @pm/substrate-http-demo — sample server entry point.
 *
 * Demonstrates @pm/substrate-http wired with the wedding profile and the
 * wedding-budget capability. This is the demo bootstrap that docker-compose
 * and `pnpm db:reset` run against. It is NOT part of the substrate library;
 * @pm/substrate-http itself is profile-agnostic and contains no references
 * to any specific profile or capability.
 *
 * Closes ADR-0012 (substrate-http demo wiring extracted from the library).
 *
 * Wires Postgres adapters → substrate packages → Hono app → Node HTTP server.
 *
 * Environment variables:
 *   PM_DATABASE_URL   Postgres connection string (required)
 *   PORT              Port to listen on (default: 4000)
 *
 * Usage:
 *   tsx packages/substrate-http-demo/src/server.ts
 *   node --import=tsx packages/substrate-http-demo/src/server.ts
 *   # Or via the built dist:
 *   node packages/substrate-http-demo/dist/server.js
 */

import { createServer } from "node:http";
import type { EntityId } from "@pm/types";
import { env, exit } from "node:process";

import pg from "pg";

import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresProjectionRunner } from "@pm/projections";
import { PostgresRegistry } from "@pm/registry";
import { BudgetRollupHandler } from "@pm/capability-wedding-budget";

import { createSubstrateApp } from "@pm/substrate-http";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DATABASE_URL = env["PM_DATABASE_URL"];
if (!DATABASE_URL) {
  console.error(
    "PM_DATABASE_URL is required. Set it to your Postgres connection string.",
  );
  exit(1);
}

const PORT = parseInt(env["PORT"] ?? "4000", 10);

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const events = new PostgresEventStore(pool);
const profileRegistry = new PostgresProfileRegistry(pool);
const graph = new PostgresGraph(pool, {
  validatorFactory: (t) => profileRegistry.validator(t),
});
const capabilityRegistry = new PostgresRegistry(pool);
const projections = new PostgresProjectionRunner(pool, events);
const budgetRollup = new BudgetRollupHandler({
  pool,
  graph,
  events,
  emittedBy: "pm-substrate-http/wedding.budget",
});

const app = createSubstrateApp({
  profileRegistry,
  capabilityRegistry,
  graph,
  events,
  projections,
  domainEventHandlers: {
    "wedding.contract.payment_recorded": async (input) => {
      await budgetRollup.handle(input.tenantId, {
        contractId: String(input.payload["contractId"]) as EntityId,
        amount: Number(input.payload["amount"]),
        recordedAt: String(input.payload["recordedAt"]),
        paymentId: String(input.payload["paymentId"]),
      });
    },
  },
});

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  // Convert Node IncomingMessage → Fetch Request for Hono.
  const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const init: RequestInit = {
    method: req.method ?? "GET",
    headers: req.headers as Record<string, string>,
  };
  if (body?.length) {
    init.body = body;
  }
  const fetchReq = new Request(url, init);

  const fetchRes = await app.fetch(fetchReq);

  res.writeHead(fetchRes.status, Object.fromEntries(fetchRes.headers));
  const resBody = await fetchRes.arrayBuffer();
  res.end(Buffer.from(resBody));
});

server.listen(PORT, () => {
  console.log(`pm-substrate-http listening on http://0.0.0.0:${PORT}`);
  console.log(`  /healthz → { status: "ok" }`);
  console.log(`  /tenants/:tenantId/... → graph, events, profiles, capabilities`);
});

// Graceful shutdown.
const shutdown = () => {
  console.log("Shutting down pm-substrate-http...");
  server.close(() => {
    pool.end().then(() => {
      console.log("Pool closed. Goodbye.");
      exit(0);
    });
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

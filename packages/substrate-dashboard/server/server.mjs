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

import { buildSnapshot } from "./aggregator.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST =
  process.env.SUBSTRATE_DASHBOARD_DIST ?? join(HERE, "..", "dist");
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

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);

  // --- API ---
  if (pathname === "/api/health") {
    try {
      const snap = await getSnapshot();
      return sendJson(res, 200, {
        ok: true,
        live: snap.live,
        substrateBase: snap.substrateBase,
        tenants: snap.tenants.length,
        generatedAt: snap.generatedAt,
        error: snap.error ?? null,
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
  }
  if (pathname === "/api/dashboard") {
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
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-cache",
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

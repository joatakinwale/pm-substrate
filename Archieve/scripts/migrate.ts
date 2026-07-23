#!/usr/bin/env tsx
/**
 * scripts/migrate.ts
 *
 * Day-1 migration runner with a two-tier migration set (refactor plan §2.2):
 *
 *   db/migrations/             — REQUIRED core set (graph, events, registry,
 *                                workflow, projections, profiles, tenants,
 *                                continuity, evals, capability tables).
 *                                Always applied.
 *   db/migrations-provenance/  — the quarantined agent_state provenance tower
 *                                (witness ledgers, authority transitions,
 *                                quorum certificates, epoch seals, pruning
 *                                tombstones). Applied ONLY when
 *                                PM_ENABLE_AGENT_STATE_PROVENANCE=1.
 *
 * Within each tier, files apply in lexicographic order; the core tier always
 * applies before the provenance tier. Each file's SHA-256 is recorded in
 * substrate.applied_migrations; if a previously-applied migration's checksum
 * changes, the runner aborts (file content is immutable once applied).
 * Ledger rows for files that are not present on disk (e.g. a database created
 * with the provenance tier, later migrated without the flag) are left alone.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { argv, env, exit } from "node:process";

import pg from "pg";
const { Client } = pg;

const ROOT = resolve(import.meta.dirname, "..");
const CORE_MIGRATIONS_DIR = resolve(ROOT, "db", "migrations");
const PROVENANCE_MIGRATIONS_DIR = resolve(ROOT, "db", "migrations-provenance");

export const provenanceEnabled = (e: Record<string, string | undefined>) =>
  e["PM_ENABLE_AGENT_STATE_PROVENANCE"] === "1";

/** Discover the migration files to apply, in order. Exported for tests. */
export const discoverMigrationFiles = (
  e: Record<string, string | undefined> = env,
): readonly { dir: string; filename: string }[] => {
  const tiers = [CORE_MIGRATIONS_DIR];
  if (provenanceEnabled(e) && existsSync(PROVENANCE_MIGRATIONS_DIR)) {
    tiers.push(PROVENANCE_MIGRATIONS_DIR);
  }
  return tiers.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".sql") && !f.startsWith("._"))
      .sort()
      .map((filename) => ({ dir, filename })),
  );
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const main = async () => {
  const databaseUrl = env["PM_DATABASE_URL"];
  if (!databaseUrl) {
    console.error(
      "PM_DATABASE_URL is not set. Copy .env.example to .env and source it.",
    );
    exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  // Bootstrap the bookkeeping table directly. Migration 0001 also creates it,
  // but we need to query it before applying 0001 — circular without a small bootstrap.
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS substrate;
    CREATE TABLE IF NOT EXISTS substrate.applied_migrations (
      filename     TEXT PRIMARY KEY,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum_sha256 TEXT NOT NULL
    );
  `);

  const applied = new Map<string, string>();
  const r = await client.query<{ filename: string; checksum_sha256: string }>(
    `SELECT filename, checksum_sha256 FROM substrate.applied_migrations`,
  );
  for (const row of r.rows) applied.set(row.filename, row.checksum_sha256);

  const files = discoverMigrationFiles();
  if (!provenanceEnabled(env)) {
    console.log(
      "provenance tier disabled (set PM_ENABLE_AGENT_STATE_PROVENANCE=1 to apply db/migrations-provenance)",
    );
  }

  let applied_count = 0;
  for (const { dir, filename } of files) {
    const path = resolve(dir, filename);
    const sql = readFileSync(path, "utf-8");
    const checksum = sha256(sql);
    const prior = applied.get(filename);

    if (prior && prior !== checksum) {
      console.error(
        `migration ${filename} has been modified after apply (sha mismatch). aborting.`,
      );
      await client.end();
      exit(1);
    }
    if (prior) continue;

    if (argv.includes("--dry-run")) {
      console.log(`would apply ${filename}`);
      continue;
    }

    console.log(`applying ${filename}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO substrate.applied_migrations (filename, checksum_sha256) VALUES ($1, $2)`,
        [filename, checksum],
      );
      await client.query("COMMIT");
      applied_count++;
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`  failed: ${(e as Error).message}`);
      await client.end();
      exit(1);
    }
  }

  await client.end();
  console.log(
    applied_count === 0
      ? "no migrations to apply"
      : `applied ${applied_count} migration(s)`,
  );
};

main().catch((e) => {
  console.error(e);
  exit(1);
});

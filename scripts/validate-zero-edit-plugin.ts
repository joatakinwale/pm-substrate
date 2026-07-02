#!/usr/bin/env tsx
/**
 * scripts/validate-zero-edit-plugin.ts — Phase 1 anti-fixation gate.
 *
 * The plug-in claim: a platform onboards through new mapping/profile/
 * capability files with ZERO substrate-package edits. The executable form:
 *
 *   A. The substrate runtime core must not import (or depend on) any
 *      profile-* or capability-* package. The substrate names no profile.
 *   B. No package may deep-import another workspace package's internals
 *      (`@pm/x/src/...` or a relative `../../<pkg>/src/...`) — plug-ins can
 *      only use public entry points, so plugging in never requires editing
 *      substrate sources.
 *   C. Profiles and capabilities must not import @pm/substrate-http — the
 *      HTTP surface consumes them (via extraRoutes), never the reverse.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { exit } from "node:process";

const ROOT = resolve(import.meta.dirname, "..");
const PKGS = resolve(ROOT, "packages");

const RUNTIME_CORE = new Set([
  "types",
  "graph",
  "events",
  "registry",
  "workflow",
  "projections",
  "profile-registry",
  "tenants",
  "continuity",
  "procedure-admission",
  "capability-kit",
  "substrate-http",
  "agent-state-core",
]);

const isPlugin = (pkg: string) =>
  pkg.startsWith("profile-") && pkg !== "profile-registry"
    ? true
    : pkg.startsWith("capability-") && pkg !== "capability-kit";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith("._"))
      return [];
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) return walk(p);
    return entry.endsWith(".ts") ? [p] : [];
  });

const failures: string[] = [];
const pkgs = readdirSync(PKGS).filter((p) =>
  statSync(join(PKGS, p)).isDirectory(),
);

for (const pkg of pkgs) {
  let srcFiles: string[] = [];
  try {
    srcFiles = walk(join(PKGS, pkg, "src"));
  } catch {
    continue;
  }
  const manifest = JSON.parse(
    readFileSync(join(PKGS, pkg, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const deps = Object.keys(manifest.dependencies ?? {});

  // Rule A — runtime core stays plug-in-free.
  if (RUNTIME_CORE.has(pkg)) {
    for (const dep of deps) {
      const short = dep.replace("@pm/", "");
      if (isPlugin(short)) {
        failures.push(
          `packages/${pkg}: runtime-core package depends on plug-in ${dep} (anti-fixation violation).`,
        );
      }
    }
  }

  for (const file of srcFiles) {
    const rel = relative(ROOT, file);
    const text = readFileSync(file, "utf8");
    const isTest = file.endsWith(".test.ts");

    if (RUNTIME_CORE.has(pkg) && !isTest) {
      for (const m of text.matchAll(
        /from ["']@pm\/((?:profile|capability)-[a-z0-9-]+)["']/g,
      )) {
        const short = m[1]!;
        if (isPlugin(short)) {
          failures.push(
            `${rel}: runtime-core source imports plug-in @pm/${short} (anti-fixation violation).`,
          );
        }
      }
    }

    // Rule B — no deep imports of another package's internals.
    for (const m of text.matchAll(
      /from ["'](@pm\/[a-z0-9-]+\/src\/[^"']+|(?:\.\.\/)+(?:packages\/)?[a-z0-9-]+\/src\/[^"']+)["']/g,
    )) {
      // Relative imports within the SAME package are fine; catch only paths
      // that climb out of the package and into a sibling's src.
      const spec = m[1]!;
      const climbsToSibling =
        spec.startsWith("@pm/") ||
        /(?:\.\.\/){2,}(?:packages\/)?[a-z0-9-]+\/src\//.test(spec);
      if (climbsToSibling) {
        failures.push(
          `${rel}: deep-imports another package's internals ("${spec}") — public entry points only.`,
        );
      }
    }

    // Rule C — plug-ins never import the HTTP surface.
    if (isPlugin(pkg) && /from ["']@pm\/substrate-http["']/.test(text)) {
      failures.push(
        `${rel}: plug-in imports @pm/substrate-http — the HTTP surface consumes plug-ins, never the reverse.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`validate-zero-edit-plugin: ${failures.length} violation(s)\n`);
  for (const f of failures) console.error(`  - ${f}`);
  exit(1);
}
console.log(
  `validate-zero-edit-plugin: OK (${pkgs.length} packages; runtime core is plug-in-free, no deep imports, no reverse HTTP coupling)`,
);

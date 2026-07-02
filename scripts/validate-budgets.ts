#!/usr/bin/env tsx
/**
 * scripts/validate-budgets.ts — guardrails against the drift mechanism
 * (refactor plan §5). CI-enforced; run via `pnpm validate:budgets`.
 *
 * Rules:
 *   1. FILE BUDGET — no src file may exceed the budget (src 2,000 / test
 *      4,000 lines). The quarantined provenance tower is grandfathered at a
 *      FROZEN size ratchet: it may shrink, never grow.
 *   2. NAME DEPTH — no exported identifier outside the quarantine may exceed
 *      63 characters (the Postgres identifier ceiling the old tower crashed
 *      into; executable form of the v229 recursion-stop rule).
 *   3. RUNTIME-CORE ISOLATION — the substrate runtime core must not import
 *      @pm/agent-state-provenance (or the deleted @pm/agent-state), and no
 *      package other than the quarantine itself may import the quarantine.
 *   4. NO export * — @pm/agent-state-core's surface is explicit; wildcard
 *      re-exports are how surfaces silently balloon.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { exit } from "node:process";

const ROOT = resolve(import.meta.dirname, "..");
const PKGS = resolve(ROOT, "packages");

const SRC_BUDGET = 2_000;
const TEST_BUDGET = 4_000;

/**
 * Ratchet state (scripts/guardrail-ratchet.json): adoption-day violations are
 * frozen — files may shrink but never grow; allowed deep names may be removed
 * but never added. Anything not in the ratchet is a hard failure.
 */
const RATCHET = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "guardrail-ratchet.json"), "utf8"),
) as {
  frozenFiles: Record<string, number>;
  allowedDeepNames: string[];
};
const FROZEN: Record<string, number> = RATCHET.frozenFiles;
const ALLOWED_DEEP_NAMES = new Set(RATCHET.allowedDeepNames);

/** Packages whose exported names skip the 63-char rule (quarantine only). */
const NAME_RULE_EXEMPT_PKGS = new Set(["agent-state-provenance"]);

/** The substrate runtime core (plan §0): must stay provenance-free. */
const RUNTIME_CORE = [
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
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith("._"))
      return [];
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) return walk(p);
    return entry.endsWith(".ts") ? [p] : [];
  });

const failures: string[] = [];
const files = readdirSync(PKGS)
  .filter((p) => statSync(join(PKGS, p)).isDirectory())
  .flatMap((pkg) => {
    const src = join(PKGS, pkg, "src");
    try {
      return walk(src).map((f) => ({ pkg, path: f }));
    } catch {
      return [];
    }
  });

for (const { pkg, path } of files) {
  const rel = relative(ROOT, path);
  const text = readFileSync(path, "utf8");
  const lineCount = text.split("\n").length;
  const isTest = path.endsWith(".test.ts");

  // Rule 1 — budgets & frozen ratchet.
  const frozen = FROZEN[rel];
  if (frozen !== undefined) {
    if (lineCount > frozen) {
      failures.push(
        `${rel}: ${lineCount} lines exceeds its FROZEN ratchet of ${frozen}. ` +
          `The quarantined tower may shrink, never grow.`,
      );
    }
  } else if (lineCount > (isTest ? TEST_BUDGET : SRC_BUDGET)) {
    failures.push(
      `${rel}: ${lineCount} lines exceeds the ${isTest ? "test" : "src"} budget ` +
        `(${isTest ? TEST_BUDGET : SRC_BUDGET}). Split the file or the package.`,
    );
  }

  // Rule 2 — exported-name depth (skip quarantine + tests).
  if (!isTest && !NAME_RULE_EXEMPT_PKGS.has(pkg)) {
    for (const m of text.matchAll(
      /^export (?:async )?(?:function|interface|type|const|class|enum)\s+([A-Za-z0-9_]+)/gm,
    )) {
      const name = m[1]!;
      if (name.length > 63 && !ALLOWED_DEEP_NAMES.has(name)) {
        failures.push(
          `${rel}: exported name "${name}" is ${name.length} chars (> 63, the ` +
            `Postgres identifier ceiling). v229 recursion-stop rule.`,
        );
      }
    }
  }

  // Rule 3 — isolation.
  const importsProvenance =
    /from ["']@pm\/agent-state-provenance["']/.test(text) ||
    /from ["']@pm\/agent-state["']/.test(text);
  if (importsProvenance && pkg !== "agent-state-provenance") {
    failures.push(
      `${rel}: imports the quarantined provenance tower (or the deleted ` +
        `@pm/agent-state). Only @pm/agent-state-core is a legal dependency.`,
    );
  }

  // Rule 4 — no wildcard re-exports in agent-state-core's public surface.
  if (pkg === "agent-state-core" && !isTest) {
    for (const m of text.matchAll(/^export \* from ["']([^"']+)["']/gm)) {
      if (m[1] !== "./external-evidence.js") {
        failures.push(
          `${rel}: wildcard re-export of "${m[1]}" — the core surface must be explicit.`,
        );
      }
    }
  }
}

// Rule 3b — runtime-core package.json isolation.
for (const pkg of RUNTIME_CORE) {
  try {
    const manifest = JSON.parse(
      readFileSync(join(PKGS, pkg, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    for (const dep of Object.keys(manifest.dependencies ?? {})) {
      if (dep === "@pm/agent-state-provenance" || dep === "@pm/agent-state") {
        failures.push(
          `packages/${pkg}/package.json: runtime-core package depends on ${dep}.`,
        );
      }
    }
  } catch {
    /* package absent — fine */
  }
}

if (failures.length > 0) {
  console.error(`validate-budgets: ${failures.length} violation(s)\n`);
  for (const f of failures) console.error(`  - ${f}`);
  exit(1);
}
console.log(
  `validate-budgets: OK (${files.length} files; budgets, name-depth, isolation, explicit-surface)`,
);

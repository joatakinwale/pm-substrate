#!/usr/bin/env tsx
/**
 * validate-contracts.ts — G6 / ADR-0013 migration guard.
 *
 * Scans capability descriptors and reports whether they still use legacy
 * string-array contract declarations. During the migration window, default
 * mode reports warnings and exits 0. Strict mode exits non-zero if any V1
 * declarations remain.
 *
 * This is intentionally source-based instead of import-based: capability
 * packages may have runtime dependencies (DB, handler deps) that shouldn't be
 * loaded just to inspect their descriptors. The final strict gate is a cheap
 * static check over `src/capability.ts` files.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const strict = process.argv.includes("--strict");

interface Finding {
  readonly file: string;
  readonly field: string;
  readonly kind: "legacy-string-array";
  readonly detail: string;
}

const capabilityFiles = (): string[] => {
  const packagesDir = join(ROOT, "packages");
  return readdirSync(packagesDir)
    .filter((name) => name.startsWith("capability-"))
    .map((name) => join(packagesDir, name, "src", "capability.ts"))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    })
    .sort();
};

const extractArrayLiteral = (source: string, field: string): string | null => {
  const marker = `${field}: [`;
  const start = source.indexOf(marker);
  if (start === -1) return null;

  const arrayStart = source.indexOf("[", start);
  if (arrayStart === -1) return null;

  let depth = 0;
  for (let i = arrayStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) return source.slice(arrayStart, i + 1);
    }
  }
  return null;
};

const hasTopLevelStringLiteralEntry = (arrayLiteral: string): boolean => {
  // Detect top-level array entries that begin with a string literal, without
  // flagging strings nested inside typed object entries (e.g.
  // `{ schema: { type: "analyst.signal.created" } }`). This is intentionally a
  // tiny scanner, not a TypeScript parser.
  let depth = 0;
  let inString: '"' | "'" | "`" | null = null;
  let escaped = false;
  let atEntryStart = true;

  for (let i = 0; i < arrayLiteral.length; i++) {
    const ch = arrayLiteral[i]!;

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      if (depth === 1 && atEntryStart) return true;
      inString = ch;
      continue;
    }

    if (ch === "[" || ch === "{") {
      depth++;
      atEntryStart = ch === "[" && depth === 1;
      continue;
    }
    if (ch === "]" || ch === "}") {
      depth--;
      atEntryStart = false;
      continue;
    }
    if (depth === 1 && ch === ",") {
      atEntryStart = true;
      continue;
    }
    if (depth === 1 && /\S/.test(ch)) {
      // Top-level entry starts with something other than a quote (typed object,
      // identifier, spread, etc.). Treat it as non-legacy for this migration
      // guard; typecheck catches invalid descriptors.
      atEntryStart = false;
    }
  }

  return false;
};

const scanFile = (file: string): Finding[] => {
  const source = readFileSync(file, "utf8");
  const findings: Finding[] = [];

  for (const field of ["emits", "subscribesTo", "readsInterfaces", "writesInterfaces"] as const) {
    const arr = extractArrayLiteral(source, field);
    if (!arr) continue;
    if (hasTopLevelStringLiteralEntry(arr)) {
      findings.push({
        file: relative(ROOT, file),
        field,
        kind: "legacy-string-array",
        detail: `${field} still contains string literal entries; migrate to typed contracts per ADR-0013`,
      });
    }
  }
  return findings;
};

const files = capabilityFiles();
const findings = files.flatMap(scanFile);

console.log(`validate-contracts: scanned ${files.length} capability descriptor(s)`);

if (findings.length === 0) {
  console.log("validate-contracts: all capability contracts are typed ✅");
  process.exit(0);
}

for (const f of findings) {
  console.log(`${strict ? "ERROR" : "WARN"}: ${f.file} :: ${f.field} :: ${f.detail}`);
}

if (strict) {
  console.error(
    `validate-contracts: ${findings.length} legacy contract declaration(s) remain; --strict rejects V1 declarations`,
  );
  process.exit(1);
}

console.log(
  `validate-contracts: ${findings.length} legacy contract declaration(s) remain (allowed during migration window; use --strict after phase 3)`,
);

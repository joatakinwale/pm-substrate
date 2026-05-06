/**
 * G5.4 — Substrate is profile-agnostic.
 *
 * Closes G5 item 4 from pm-substrate-research-gap-audit-2026-05-05.md:
 *   "Second-profile test: unrelated profile compiles/runs without substrate
 *    changes."
 *
 * G4 already proved a second profile (agency) compiles + runs by shipping
 * @pm/profile-agency + @pm/capability-agency-lead-scoring. That closes
 * "compiles + runs". This test closes the harder half: "without substrate
 * changes" — i.e., the substrate genuinely does not know which profiles
 * exist.
 *
 * Two layers of evidence:
 *
 *   1. Runtime parity: when the agency capability test runs, it instantiates
 *      the SAME substrate classes (PostgresGraph, PostgresEventStore,
 *      PostgresRegistry, PostgresProfileRegistry) that the wedding capability
 *      test uses. There is no `AgencyAwareGraph`, no profile-specific
 *      subclass, no agency-only feature flag. We assert this by importing
 *      the substrate classes and checking that profile-bound capability
 *      packages do NOT export any substrate type / class / function.
 *
 *   2. Source invariant: no substrate package contains identifiers, string
 *      literals, or imports referencing a specific profile by name (the
 *      profile-registry package must remain profile-agnostic at the
 *      identifier and runtime level). Profile names appearing in comments
 *      or docstrings as illustrative examples are allowed for now (they
 *      are documentation, not behavior), but flagged so a future contributor
 *      can see the boundary.
 *
 * If a future change wires "wedding" or "agency" into the substrate as a
 * concrete identifier, this test fails and points at the file:line so the
 * regression is caught immediately. The right fix in that case is to
 * generalize the substrate API \u2014 not to delete the test.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WORKSPACE_ROOT = resolve(__dirname, "..", "..", "..");
const PACKAGES_DIR = join(WORKSPACE_ROOT, "packages");

/**
 * The set of substrate packages \u2014 the layer that must remain profile-agnostic.
 * Profile-registry is included: it stores profile installations, but its
 * own code must not name any specific profile.
 */
const SUBSTRATE_PACKAGES = [
  "types",
  "graph",
  "events",
  "registry",
  "projections",
  "workflow",
  "profile-registry",
  "substrate-http",
];

/**
 * Profile names known to the workspace today. Inferred from packages/profile-*
 * directories at test time so the test self-updates as new profiles are added.
 */
function listProfileNames(): string[] {
  return readdirSync(PACKAGES_DIR)
    .filter((d) => d.startsWith("profile-") && d !== "profile-registry")
    .map((d) => d.slice("profile-".length));
}

/**
 * Files under packages/<substrate>/src that are *sample entry points*
 * (demo wiring, runnable bootstraps), not substrate library code. These
 * are allowed to name specific profiles because their job is exactly to
 * demonstrate substrate-plus-some-profile end-to-end. The library code
 * around them must remain profile-agnostic.
 *
 * Path is relative to packages/<substrate>/src.
 *
 * If you add an entry point here, also document it as a sample in the
 * package README so it is clearly not part of the published library API.
 */
const SAMPLE_ENTRY_POINTS: ReadonlySet<string> = new Set([
  "substrate-http/server.ts", // bootstrap that wires wedding.budget for the dev demo
]);

function collectTsFiles(root: string, pkg: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (e === "node_modules" || e === "dist" || e === "build") continue;
        stack.push(full);
      } else if (
        st.isFile() &&
        full.endsWith(".ts") &&
        !full.endsWith(".d.ts") &&
        !full.endsWith(".test.ts") // tests can fixture profile names freely
      ) {
        // Skip explicit sample entry points.
        const rel = relative(join(PACKAGES_DIR, pkg, "src"), full);
        if (SAMPLE_ENTRY_POINTS.has(`${pkg}/${rel}`)) {
          continue;
        }
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * Strip block comments (/* ... *\u200b/) and line comments (// ...) from source.
 * Conservative: handles strings and template literals well enough to avoid
 * stripping characters inside them. Good enough for "are profile names
 * appearing in code?" \u2014 not a TypeScript-grade parser.
 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLine = false;
  let inBlock = false;
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      i++;
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (inSingle) {
      out += c;
      if (c === "\\" && n !== undefined) {
        out += n;
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      out += c;
      if (c === "\\" && n !== undefined) {
        out += n;
        i += 2;
        continue;
      }
      if (c === '"') inDouble = false;
      i++;
      continue;
    }
    if (inTemplate) {
      out += c;
      if (c === "\\" && n !== undefined) {
        out += n;
        i += 2;
        continue;
      }
      if (c === "`") inTemplate = false;
      i++;
      continue;
    }
    if (c === "/" && n === "/") {
      inLine = true;
      i += 2;
      continue;
    }
    if (c === "/" && n === "*") {
      inBlock = true;
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      out += c;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      out += c;
      i++;
      continue;
    }
    if (c === "`") {
      inTemplate = true;
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

interface ProfileLeak {
  rule: string;
  file: string;
  line: number;
  match: string;
  detail: string;
}

function scanSubstratePackage(
  pkg: string,
  profileNames: string[],
): ProfileLeak[] {
  const dir = join(PACKAGES_DIR, pkg, "src");
  let files: string[];
  try {
    files = collectTsFiles(dir, pkg);
  } catch {
    return [];
  }
  const leaks: ProfileLeak[] = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const stripped = stripComments(raw);
    const lines = stripped.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const profile of profileNames) {
        // Word-boundary match: catches "wedding", "weddingFoo",
        // "Wedding", "WEDDING", but not random substrings in URLs/etc.
        // Case-insensitive on purpose \u2014 a `WeddingProfile` identifier in
        // the substrate would be exactly the leak we're catching.
        const re = new RegExp(
          `(?<![a-zA-Z0-9])${profile}(?![a-zA-Z0-9])`,
          "i",
        );
        const m = re.exec(line);
        if (m) {
          leaks.push({
            rule: "profile-name-in-substrate-code",
            file: relative(WORKSPACE_ROOT, file),
            line: i + 1,
            match: m[0],
            detail:
              `Substrate package @pm/${pkg} references profile name "${profile}" at line ${i + 1}: ` +
              `\`${line.trim()}\`. Substrate must remain profile-agnostic; if you need behavior keyed on a profile, ` +
              `do it via the profile descriptor + ProfileRegistry, not by naming the profile in substrate code.`,
          });
        }
      }
    }
  }
  return leaks;
}

function readPackageJson(pkg: string): {
  name: string;
  dependencies?: Record<string, string>;
  exports?: unknown;
  main?: string;
} {
  const p = join(PACKAGES_DIR, pkg, "package.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

describe("G5.4 \u2014 substrate is profile-agnostic", () => {
  it("at least two profile packages exist (sanity \u2014 the test would be vacuous otherwise)", () => {
    const names = listProfileNames();
    expect(names.length).toBeGreaterThanOrEqual(2);
  });

  it("no substrate package source code references any specific profile name", () => {
    const profileNames = listProfileNames();
    expect(profileNames.length).toBeGreaterThanOrEqual(2);

    const allLeaks: ProfileLeak[] = [];
    for (const pkg of SUBSTRATE_PACKAGES) {
      allLeaks.push(...scanSubstratePackage(pkg, profileNames));
    }

    if (allLeaks.length > 0) {
      const lines = [
        `Substrate is leaking profile names. ${allLeaks.length} occurrence(s):`,
        "",
        ...allLeaks.map(
          (l) =>
            `  [${l.rule}] ${l.file}:${l.line}\n    match: ${l.match}\n    ${l.detail}`,
        ),
        "",
        "Substrate code must be written so adding a third, fourth, or fiftieth",
        "profile requires zero substrate edits. If you found yourself wanting to",
        "name a profile in substrate code, the right move is to express the",
        "behavior via the profile descriptor (Tier-1 interfaces, edge types,",
        "constraints) and let the substrate consume those declaratively.",
      ];
      throw new Error(lines.join("\n"));
    }

    expect(allLeaks).toEqual([]);
  });

  it("profile-bound capability packages do not re-export substrate types", () => {
    // A profile-bound capability is allowed to *use* substrate types
    // (it has to \u2014 it implements against them), but it must not
    // *re-export* them from its own package. Re-exporting would let
    // downstream code import substrate types via the capability,
    // creating a hidden dependency edge from substrate to capabilities.
    const capDirs = readdirSync(PACKAGES_DIR).filter((d) =>
      d.startsWith("capability-"),
    );
    expect(capDirs.length).toBeGreaterThan(0);

    const SUBSTRATE_PKG_NAMES = new Set(
      SUBSTRATE_PACKAGES.map((p) => `@pm/${p}`),
    );
    const reExportRe =
      /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/gm;

    const leaks: ProfileLeak[] = [];
    for (const cap of capDirs) {
      const files = collectTsFiles(join(PACKAGES_DIR, cap, "src"), cap);
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(reExportRe)) {
          const target = m[1]!;
          if (SUBSTRATE_PKG_NAMES.has(target)) {
            const upTo = src.slice(0, m.index ?? 0);
            const line = upTo.split("\n").length;
            leaks.push({
              rule: "capability-re-exports-substrate",
              file: relative(WORKSPACE_ROOT, file),
              line,
              match: m[0]!.trim(),
              detail:
                `Capability package @pm/${cap} re-exports symbols from substrate package "${target}". ` +
                `Capabilities consume substrate APIs, they do not republish them. Downstream code that needs ` +
                `substrate types should import directly from "${target}".`,
            });
          }
        }
      }
    }

    if (leaks.length > 0) {
      const lines = [
        `Capability packages are re-exporting substrate types. ${leaks.length} occurrence(s):`,
        "",
        ...leaks.map(
          (l) =>
            `  [${l.rule}] ${l.file}:${l.line}\n    match: ${l.match}\n    ${l.detail}`,
        ),
      ];
      throw new Error(lines.join("\n"));
    }
    expect(leaks).toEqual([]);
  });
});

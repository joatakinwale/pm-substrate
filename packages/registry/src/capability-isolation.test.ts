/**
 * G5 — Registry "god-object" isolation test.
 *
 * Closes G5 item 8 from pm-substrate-research-gap-audit-2026-05-05.md:
 *   "Registry god-object test: providers cannot import each other or share
 *    private utility paths."
 *
 * The architectural claim under test: capability-* packages are siblings,
 * not friends. The registry is the *only* runtime coupling point between
 * capabilities; at the source level, no capability package may import
 * another capability package, nor may it reach into another package's
 * private (`src/`) paths via relative imports.
 *
 * If this invariant erodes, the substrate slowly turns into the very
 * spaghetti the PM layer claims to eliminate: hidden cross-capability
 * dependencies become a god-object that owns "how things actually work
 * together" \u2014 exactly the integration nightmare we're meant to replace.
 *
 * This is a static, no-DB test. It scans the workspace at test time and
 * fails loudly with the offending file/line on any violation.
 *
 * Allowed dependencies for a `capability-*` package:
 *   - Substrate primitives: @pm/types, @pm/graph, @pm/events, @pm/registry,
 *     @pm/projections, @pm/workflow
 *   - @pm/profile-registry (for tenant-scoped profile installation)
 *   - At most ONE profile package: @pm/profile-<name> matching the
 *     capability's own profile prefix.
 *   - Anything outside the @pm scope (pg, node:*, vitest, etc.)
 *
 * Forbidden:
 *   - Any other @pm/capability-* package.
 *   - Any other @pm/profile-* package (an agency capability cannot import
 *     the finance-research profile, etc.).
 *   - Relative imports that escape the package's own directory tree
 *     (e.g., "../../profile-agency/src/internal-thing.js").
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Resolve the workspace root from this test's location:
//   packages/registry/src/capability-isolation.test.ts \u2192 ../../..
const WORKSPACE_ROOT = resolve(__dirname, "..", "..", "..");
const PACKAGES_DIR = join(WORKSPACE_ROOT, "packages");

const SUBSTRATE_PACKAGES = new Set([
  "@pm/types",
  "@pm/graph",
  "@pm/events",
  "@pm/registry",
  "@pm/projections",
  "@pm/workflow",
  "@pm/profile-registry",
  // @pm/capability-kit is the substrate-side authoring helper for capabilities
  // (G10 / ADR-0019). It is named with the `capability-` prefix because it
  // belongs to the same conceptual surface, but it is NOT itself a capability
  // — capabilities depend ON it. Treat it as a substrate primitive for
  // isolation purposes.
  "@pm/capability-kit",
]);

/**
 * Package directory names that match the `capability-*` glob but are NOT
 * registered capabilities for isolation purposes — they are substrate-side
 * helpers that capability authors *depend on*. Keep this list tight; the
 * default for a `capability-foo` directory is still "a capability."
 */
const NON_CAPABILITY_HELPERS = new Set([
  "capability-kit",
]);

interface ImportSite {
  file: string; // path relative to workspace root
  line: number;
  spec: string;
}

interface CapabilityPackage {
  dir: string; // absolute
  name: string; // e.g., capability-agency-lead-scoring
  pkgName: string; // e.g., @pm/capability-agency-lead-scoring
  /** The profile prefix this capability is bound to, or null for non-profile-bound. */
  profilePrefix: string | null;
  declaredDeps: Set<string>;
  files: string[]; // absolute paths to .ts files (excluding test files)
}

function listCapabilityPackages(): CapabilityPackage[] {
  const entries = readdirSync(PACKAGES_DIR);
  const out: CapabilityPackage[] = [];
  for (const name of entries) {
    if (!name.startsWith("capability-")) continue;
    if (NON_CAPABILITY_HELPERS.has(name)) continue;
    const dir = join(PACKAGES_DIR, name);
    const pkgPath = join(dir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name: string;
      dependencies?: Record<string, string>;
    };
    // Infer the profile prefix from the capability's directory name:
    //   capability-agency-lead-scoring \u2192 agency
    //   capability-audit            \u2192 null (profile-agnostic)
    const rest = name.slice("capability-".length);
    const firstSeg = rest.split("-")[0];
    const profilePrefix = isKnownProfile(firstSeg) ? firstSeg : null;

    out.push({
      dir,
      name,
      pkgName: pkg.name,
      profilePrefix,
      declaredDeps: new Set(Object.keys(pkg.dependencies ?? {})),
      files: collectTsFiles(join(dir, "src")),
    });
  }
  return out;
}

function isKnownProfile(seg: string | undefined): boolean {
  if (!seg) return false;
  // A "profile package" is any packages/profile-<seg> dir.
  try {
    const profileDir = join(PACKAGES_DIR, `profile-${seg}`);
    return statSync(profileDir).isDirectory();
  } catch {
    return false;
  }
}

function collectTsFiles(root: string): string[] {
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
        !full.endsWith(".test.ts") &&
        !full.endsWith(".d.ts")
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

const IMPORT_RE =
  /^\s*(?:import|export)\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']/gm;

function extractImports(absPath: string): ImportSite[] {
  const src = readFileSync(absPath, "utf8");
  const sites: ImportSite[] = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1]!;
    const upTo = src.slice(0, m.index ?? 0);
    const line = upTo.split("\n").length;
    sites.push({
      file: relative(WORKSPACE_ROOT, absPath),
      line,
      spec,
    });
  }
  return sites;
}

interface Violation {
  rule: string;
  file: string;
  line: number;
  spec: string;
  detail: string;
}

function checkPackage(
  cap: CapabilityPackage,
  allCaps: CapabilityPackage[],
): Violation[] {
  const violations: Violation[] = [];
  const otherCapPkgNames = new Set(
    allCaps.filter((c) => c.name !== cap.name).map((c) => c.pkgName),
  );

  for (const file of cap.files) {
    const sites = extractImports(file);
    for (const site of sites) {
      const spec = site.spec;

      // ---- Rule 1: no cross-capability package imports ----
      if (otherCapPkgNames.has(spec)) {
        violations.push({
          rule: "no-cross-capability-import",
          file: site.file,
          line: site.line,
          spec,
          detail: `${cap.pkgName} imports ${spec}. Capability packages must communicate only through registered events + the substrate event log, never via direct module imports.`,
        });
        continue;
      }

      // ---- Rule 2: only the matching profile package, if any ----
      if (spec.startsWith("@pm/profile-") && spec !== "@pm/profile-registry") {
        const importedProfile = spec.slice("@pm/profile-".length);
        if (cap.profilePrefix === null) {
          violations.push({
            rule: "no-profile-import-from-profile-agnostic-capability",
            file: site.file,
            line: site.line,
            spec,
            detail: `${cap.pkgName} is not bound to a profile (no profile prefix in its name) but imports ${spec}. Profile-agnostic capabilities (e.g., capability-audit) must not depend on any specific profile.`,
          });
        } else if (importedProfile !== cap.profilePrefix) {
          violations.push({
            rule: "no-cross-profile-import",
            file: site.file,
            line: site.line,
            spec,
            detail: `${cap.pkgName} (profile=${cap.profilePrefix}) imports ${spec} (profile=${importedProfile}). A capability bound to one profile cannot import another profile's package.`,
          });
        }
      }

      // ---- Rule 3: declared dependency in package.json ----
      // Only enforce on @pm/* imports (third-party scope is hoisted/permissive).
      if (
        spec.startsWith("@pm/") &&
        !cap.declaredDeps.has(spec) &&
        spec !== cap.pkgName
      ) {
        violations.push({
          rule: "undeclared-workspace-dep",
          file: site.file,
          line: site.line,
          spec,
          detail: `${cap.pkgName} imports ${spec} without listing it in dependencies of its package.json. Add it explicitly so the workspace dependency graph stays honest.`,
        });
      }

      // ---- Rule 4: no relative imports escaping the package directory ----
      if (spec.startsWith(".")) {
        const resolved = resolve(dirname(file), spec);
        const insideOwnPkg =
          resolved === cap.dir || resolved.startsWith(cap.dir + "/");
        if (!insideOwnPkg) {
          violations.push({
            rule: "no-cross-package-relative-import",
            file: site.file,
            line: site.line,
            spec,
            detail: `${cap.pkgName} uses a relative import that resolves outside its own package (${resolved}). Cross-package access must go through a public package entry, never private paths.`,
          });
        }
      }
    }
  }

  return violations;
}

describe("G5 \u2014 capability isolation (registry god-object test)", () => {
  it("no capability package imports another capability or escapes profile boundaries", () => {
    const caps = listCapabilityPackages();
    expect(caps.length).toBeGreaterThan(0); // sanity: tests would silently pass otherwise

    const allViolations: Violation[] = [];
    for (const cap of caps) {
      allViolations.push(...checkPackage(cap, caps));
    }

    if (allViolations.length > 0) {
      const lines = [
        `Capability isolation invariant violated. ${allViolations.length} issue(s):`,
        "",
        ...allViolations.map(
          (v) =>
            `  [${v.rule}] ${v.file}:${v.line}\n    spec: ${v.spec}\n    ${v.detail}`,
        ),
        "",
        "If a capability genuinely needs information another capability owns, the",
        "right fix is: subscribe to that capability's published events, or read",
        "the relevant graph projection \u2014 not import its source.",
      ];
      throw new Error(lines.join("\n"));
    }

    expect(allViolations).toEqual([]);
  });

  it("at least one capability package exists with declared deps (sanity)", () => {
    const caps = listCapabilityPackages();
    const withDeps = caps.filter((c) => c.declaredDeps.size > 0);
    expect(withDeps.length).toBeGreaterThan(0);
  });
});

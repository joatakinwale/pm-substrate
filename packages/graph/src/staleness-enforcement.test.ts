/**
 * Staleness enforcement guard (Emmanuel-approved 2026-06-24).
 *
 * Origin: `staleness.ts` helpers COMPUTE staleness but enforce nothing — every
 * caller must remember to gate. That is the "advisory not enforced" hole that
 * let stale-but-agreeing decisions become operational (defect 2026-06-18). The
 * freshness CONTRACT (`freshnessGate` / `requireFresh`) makes "if stale, it
 * cannot authorize action" (reality quality #7) structural. This guard stops a
 * future caller from silently regressing back to advisory `isStale`.
 *
 * Rule: in the ACTION-AUTHORIZATION packages (capabilities + workflow), a call
 * to `isStale(...)` whose boolean result FLOATS — i.e. it is a statement on its
 * own, not consumed by `if` / `return` / `!` / `&&` / `||` / `? :` / `const x =`
 * — is a finding. The freshness contract should be used instead. `isStale`
 * itself stays available for advisory/telemetry use (e.g. dashboards), so the
 * guard only fires on the layers that AUTHORIZE ACTION.
 *
 * If this guard fails, do NOT delete it. Replace the floating `isStale` with
 * `freshnessGate(...)`/`requireFresh(...)` so the stale read cannot authorize
 * action.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WORKSPACE_ROOT = resolve(__dirname, "..", "..", "..");
const PACKAGES_DIR = join(WORKSPACE_ROOT, "packages");

/** Packages whose code authorizes operational action — staleness must gate. */
function actionAuthorizationPackages(): string[] {
  const dirs = readdirSync(PACKAGES_DIR).filter((d) => {
    try {
      return statSync(join(PACKAGES_DIR, d)).isDirectory();
    } catch {
      return false;
    }
  });
  return dirs.filter(
    (d) => d.startsWith("capability-") || d === "workflow",
  );
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
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (e === "node_modules" || e === "dist" || e === "build") continue;
        stack.push(full);
      } else if (
        st.isFile() &&
        full.endsWith(".ts") &&
        !full.endsWith(".d.ts") &&
        !full.endsWith(".test.ts")
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

/** Strip // line and /* block *\/ comments so matches are on real code. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

interface Finding {
  file: string;
  line: number;
  text: string;
}

/**
 * A floating `isStale(...)` call: the trimmed line STARTS with `isStale(`
 * (a bare call statement). Consumed forms start with `if (`, `return `,
 * `const `, `!`, `(`, `=`, `&&`, etc., so they do not match. Conservative by
 * design: catches the dangerous shape (compute-then-ignore) without
 * false-positiving on legitimate gated use.
 */
function scanFloatingIsStale(pkg: string): Finding[] {
  const dir = join(PACKAGES_DIR, pkg, "src");
  const findings: Finding[] = [];
  for (const file of collectTsFiles(dir)) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (/^isStale\s*\(/.test(line)) {
        findings.push({
          file: relative(WORKSPACE_ROOT, file),
          line: i + 1,
          text: line,
        });
      }
    });
  }
  return findings;
}

describe("staleness enforcement guard", () => {
  it("sanity: at least one action-authorization package exists", () => {
    expect(actionAuthorizationPackages().length).toBeGreaterThan(0);
  });

  it("no floating isStale() in capability/workflow code (use the freshness contract)", () => {
    const all: Finding[] = [];
    for (const pkg of actionAuthorizationPackages()) {
      all.push(...scanFloatingIsStale(pkg));
    }
    if (all.length > 0) {
      const msg = [
        `Floating isStale() found in action-authorization code (${all.length}):`,
        "",
        ...all.map((f) => `  ${f.file}:${f.line}\n    ${f.text}`),
        "",
        "A bare isStale(...) computes staleness then discards it — the advisory",
        "hole. Replace with freshnessGate(...) (typed decision you must branch",
        "on) or requireFresh(...) (throws on stale), so a stale read cannot",
        "authorize action. Do not delete this guard.",
      ];
      throw new Error(msg.join("\n"));
    }
    expect(all).toEqual([]);
  });
});

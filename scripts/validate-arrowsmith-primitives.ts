#!/usr/bin/env tsx
/**
 * validate-arrowsmith-primitives.ts
 *
 * Static guard for the v229 primitive back-map. It keeps future
 * agent-state Arrowsmith slices from silently adding another recursive
 * proof/admission/witness layer without declaring which substrate primitive
 * family they strengthen, replace, or falsify.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DAILY_DIR = join(ROOT, "research", "daily-arrowsmith-agent-state");

const primitiveFamilies = [
  "state_identity",
  "admission_calculus",
  "recovery_cut",
  "policy_compiler",
  "authority_topology",
  "obstruction_evidence",
  "settlement_finality",
  "replay_semantics",
  "new_primitive_required",
] as const;

type PrimitiveFamily = (typeof primitiveFamilies)[number];

interface Finding {
  readonly file: string;
  readonly detail: string;
}

const findings: Finding[] = [];

const addFinding = (file: string, detail: string): void => {
  findings.push({ file: relative(ROOT, file), detail });
};

const read = (path: string): string => readFileSync(path, "utf8");

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const requireContains = (file: string, source: string, needle: string, detail: string): void => {
  if (!source.includes(needle)) addFinding(file, detail);
};

const v229Path = join(
  DAILY_DIR,
  "v229-substrate-primitive-backmap-2026-07-01.md",
);
const dailyIndexPath = join(DAILY_DIR, "index.md");
const topLedgerPath = join(ROOT, "research", "index.md");
const changelogPath = join(ROOT, "Changelog.md");

for (const required of [v229Path, dailyIndexPath, topLedgerPath, changelogPath]) {
  if (!isFile(required)) {
    addFinding(required, "required primitive back-map ledger file is missing");
  }
}

if (isFile(v229Path)) {
  const v229 = read(v229Path);
  for (const family of primitiveFamilies) {
    requireContains(
      v229Path,
      v229,
      `\`${family}\``,
      `v229 primitive back-map does not declare primitive_family ${family}`,
    );
  }
  requireContains(
    v229Path,
    v229,
    "## Recursion Stop Rule",
    "v229 primitive back-map must include the recursion stop rule",
  );
  requireContains(
    v229Path,
    v229,
    "## Back-Map of v62-v228",
    "v229 primitive back-map must include the v62-v228 range map",
  );
}

if (isFile(dailyIndexPath)) {
  const dailyIndex = read(dailyIndexPath);
  requireContains(
    dailyIndexPath,
    dailyIndex,
    "v229 update:",
    "daily Arrowsmith index must mention the v229 primitive back-map update",
  );
  requireContains(
    dailyIndexPath,
    dailyIndex,
    "Use v229 primitive back-map as the admission rule",
    "daily Arrowsmith implementation implications must use v229 as an admission rule",
  );
}

if (isFile(topLedgerPath)) {
  requireContains(
    topLedgerPath,
    read(topLedgerPath),
    "Latest consolidation slice v229",
    "top-level research ledger must point Agent-state Arrowsmith at v229 consolidation",
  );
}

if (isFile(changelogPath)) {
  requireContains(
    changelogPath,
    read(changelogPath),
    "2026-07-01 - Substrate primitive back-map",
    "changelog must record the v229 substrate primitive back-map",
  );
}

const versionedResearchFiles = readdirSync(DAILY_DIR)
  .map((name) => join(DAILY_DIR, name))
  .filter(isFile)
  .filter((path) => /\/v\d+-.+\.md$/.test(path))
  .sort();

const primitiveFamilyRegex = (family: PrimitiveFamily): RegExp =>
  new RegExp(`primitive_family\\s*:\\s*${family}\\b`);

for (const file of versionedResearchFiles) {
  const match = /\/v(\d+)-.+\.md$/.exec(file);
  if (!match) continue;
  const version = Number(match[1]);
  if (!Number.isFinite(version) || version < 230) continue;

  const source = read(file);
  const declaredFamilies = primitiveFamilies.filter((family) =>
    primitiveFamilyRegex(family).test(source),
  );

  if (declaredFamilies.length === 0) {
    addFinding(
      file,
      "future Arrowsmith slices v230+ must declare primitive_family before adding substrate mechanisms",
    );
    continue;
  }

  if (declaredFamilies.includes("new_primitive_required")) {
    requireContains(
      file,
      source,
      "Why existing primitive families are insufficient",
      "new_primitive_required must explain why the eight primitive families are insufficient",
    );
    requireContains(
      file,
      source,
      "Falsification",
      "new_primitive_required must include falsification criteria before implementation",
    );
  }
}

console.log(
  `validate-arrowsmith-primitives: scanned ${versionedResearchFiles.length} versioned agent-state research file(s)`,
);

if (findings.length === 0) {
  console.log("validate-arrowsmith-primitives: primitive back-map guard passed");
  process.exit(0);
}

for (const finding of findings) {
  console.error(`ERROR: ${finding.file} :: ${finding.detail}`);
}

console.error(
  `validate-arrowsmith-primitives: ${findings.length} primitive back-map issue(s) found`,
);
process.exit(1);

#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSentinelProductionPowerRedesignAudit,
  verifySentinelProductionPowerRedesignAudit,
} from "./sentinel-production-power-audit.js";

function outputPath(argv: readonly string[]): string | null {
  if (argv.length === 0) return null;
  if (argv.length !== 2 || argv[0] !== "--output" || argv[1]?.length === 0) {
    throw new Error("usage: pm-sentinel-power-audit [--output <artifact.json>]");
  }
  return resolve(argv[1] as string);
}

/** Generate only the frozen, authoritative calculation; reduced runs are test APIs, not CLI modes. */
export function runSentinelProductionPowerAuditCli(argv = process.argv.slice(2)): void {
  const destination = outputPath(argv);
  const artifact = createSentinelProductionPowerRedesignAudit();
  const issues = verifySentinelProductionPowerRedesignAudit(artifact);
  if (issues.length > 0) throw new Error(`generated power artifact failed verification: ${issues.join("; ")}`);
  const bytes = `${JSON.stringify(artifact, null, 2)}\n`;
  if (destination === null) process.stdout.write(bytes);
  else writeFileSync(destination, bytes, { encoding: "utf8", flag: "wx" });
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  runSentinelProductionPowerAuditCli();
}

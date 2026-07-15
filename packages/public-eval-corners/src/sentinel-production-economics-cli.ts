#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditSentinelProductionEconomics,
  verifySentinelProductionEconomicsReport,
} from "./sentinel-production-economics.js";

function parseJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
}

function writeArtifact(value: unknown, destination: string | null): void {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (destination === null) process.stdout.write(bytes);
  else writeFileSync(resolve(destination), bytes, { encoding: "utf8", flag: "wx" });
}

/** Runtime consumer for the deterministic economics audit and retained-report verifier. */
export function runSentinelProductionEconomicsCli(argv = process.argv.slice(2)): void {
  const [command, inputPath, outputFlag, outputPath] = argv;
  if (
    (command !== "audit" && command !== "verify") || inputPath === undefined ||
    (outputFlag !== undefined && outputFlag !== "--output") ||
    (outputFlag === "--output" && outputPath === undefined) || argv.length > 4
  ) {
    throw new Error(
      "usage: sentinel-production-economics-cli <audit|verify> <input.json> [--output <artifact.json>]",
    );
  }
  const input = parseJson(inputPath);
  if (command === "audit") {
    const result = auditSentinelProductionEconomics(input);
    writeArtifact(result, outputPath ?? null);
    if (!result.guardrails.allGuardrailsPassed) process.exitCode = 1;
  } else {
    const result = verifySentinelProductionEconomicsReport(input);
    writeArtifact(result, outputPath ?? null);
    if (!result.valid) process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) runSentinelProductionEconomicsCli();

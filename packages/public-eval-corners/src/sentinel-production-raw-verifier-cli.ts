#!/usr/bin/env node
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SentinelExternalTrustAnchor } from "./sentinel-production-plan.js";
import { verifySentinelProductionRawBatch } from "./sentinel-production-raw-batch.js";

interface CliOptions {
  readonly batchRoot: string;
  readonly trustAnchorPath: string;
  readonly outputPath: string | null;
}

function options(argv: readonly string[]): CliOptions {
  let batchRoot: string | null = null;
  let trustAnchorPath: string | null = null;
  let outputPath: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--batch-root", "--trust-anchor", "--output"].includes(flag ?? "") || value === undefined) {
      throw new Error(
        "usage: pm-sentinel-production-verify --batch-root <directory> --trust-anchor <out-of-band.json> [--output <report.json>]",
      );
    }
    if (flag === "--batch-root") batchRoot = value;
    else if (flag === "--trust-anchor") trustAnchorPath = value;
    else outputPath = value;
    index += 1;
  }
  if (batchRoot === null || trustAnchorPath === null) {
    throw new Error(
      "usage: pm-sentinel-production-verify --batch-root <directory> --trust-anchor <out-of-band.json> [--output <report.json>]",
    );
  }
  return {
    batchRoot: resolve(batchRoot),
    trustAnchorPath: resolve(trustAnchorPath),
    outputPath: outputPath === null ? null : resolve(outputPath),
  };
}

function readTrustAnchor(path: string): SentinelExternalTrustAnchor {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("out-of-band trust anchor is not a regular file");
  return JSON.parse(readFileSync(path, "utf8")) as SentinelExternalTrustAnchor;
}

function main(): void {
  const cli = options(process.argv.slice(2));
  const result = verifySentinelProductionRawBatch({
    batchRoot: cli.batchRoot,
    trustAnchor: readTrustAnchor(cli.trustAnchorPath),
  });
  const report = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-raw-verifier-cli-report.v1",
    valid: result.valid,
    rawComplete: result.rawComplete,
    evidenceEligible: result.evidenceEligible,
    attemptTimeRawRootExternallyAnchored: result.attemptTimeRawRootExternallyAnchored,
    analysisEligible: result.analysisEligible,
    materialBenefit: result.materialBenefit,
    preregistrationSha256: result.preregistrationSha256,
    phase: result.phase,
    declaredBlockCount: result.declaredBlockCount,
    verifiedBlockCount: result.verifiedBlockCount,
    declaredCellCount: result.declaredCellCount,
    verifiedCellCount: result.verifiedCellCount,
    cells: result.cells.map((cell) => ({
      cellId: cell.cell.cellId,
      arm: cell.cell.arm,
      taskId: cell.cell.taskId,
      repeatId: cell.cell.repeatId,
      rawComplete: cell.rawComplete,
      providerOperationCount: cell.provider.operations.length,
      stateOperationCount: cell.state.operations.length,
      attemptDurationMs: cell.supervisor.attemptDurationMs,
      issues: cell.issues,
    })),
    measurements: result.measurements,
    economics: result.economics,
    analysis: result.analysis,
    issues: result.issues,
  };
  const bytes = `${JSON.stringify(report, null, 2)}\n`;
  if (cli.outputPath === null) process.stdout.write(bytes);
  else writeFileSync(cli.outputPath, bytes, { flag: "wx", mode: 0o400 });
  if (!result.valid) process.exitCode = 1;
}

try { main(); }
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}

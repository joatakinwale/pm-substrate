#!/usr/bin/env node
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

import type { SentinelExternalTrustAnchor } from "./sentinel-production-plan.js";
import { verifySentinelProductionRawBatch } from "./sentinel-production-verifier.js";

const TRUST_ANCHOR_MAX_BYTES = 64 * 1024;

interface CliOptions {
  readonly batchRoot: string;
  readonly trustAnchorPath: string;
  readonly outputPath: string | null;
}

interface PhysicalBatchBoundary {
  readonly path: string;
}

function usage(): Error {
  return new Error(
    "usage: pm-sentinel-production-verify --batch-root <directory> --trust-anchor <out-of-band.json> [--output <report.json>]",
  );
}

function options(argv: readonly string[]): CliOptions {
  let batchRoot: string | null = null;
  let trustAnchorPath: string | null = null;
  let outputPath: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--batch-root", "--trust-anchor", "--output"].includes(flag ?? "") || value === undefined) {
      throw usage();
    }
    if (flag === "--batch-root") batchRoot = value;
    else if (flag === "--trust-anchor") trustAnchorPath = value;
    else outputPath = value;
    index += 1;
  }
  if (batchRoot === null || trustAnchorPath === null) throw usage();
  return {
    batchRoot: resolve(batchRoot),
    trustAnchorPath: resolve(trustAnchorPath),
    outputPath: outputPath === null ? null : resolve(outputPath),
  };
}

function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameStableFile(left: BigIntStats, right: BigIntStats): boolean {
  return sameIdentity(left, right) &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs;
}

function sameStableDirectory(left: BigIntStats, right: BigIntStats): boolean {
  return sameIdentity(left, right) &&
    left.mode === right.mode;
}

function containedBy(parent: string, child: string): boolean {
  const candidate = relative(parent, child);
  return candidate === "" ||
    (candidate !== ".." && !candidate.startsWith("../") && !isAbsolute(candidate));
}

function canonicalBatchRoot(path: string): PhysicalBatchBoundary {
  try {
    const stat = lstatSync(path, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(path) !== path) {
      throw new Error("batch root is not a canonical physical directory");
    }
    return { path };
  } catch (error) {
    if (error instanceof Error && error.message === "batch root is not a canonical physical directory") throw error;
    throw new Error("batch root is not a canonical physical directory");
  }
}

function readTrustAnchor(
  path: string,
  batch: PhysicalBatchBoundary,
): SentinelExternalTrustAnchor {
  let descriptor: number | null = null;
  try {
    if (realpathSync(path) !== path || containedBy(batch.path, path)) {
      throw new Error("out-of-band trust anchor is not a disjoint canonical physical file");
    }
    const pathBefore = lstatSync(path, { bigint: true });
    if (
      !pathBefore.isFile() || pathBefore.isSymbolicLink() || pathBefore.nlink !== 1n ||
      pathBefore.size <= 0n || pathBefore.size > BigInt(TRUST_ANCHOR_MAX_BYTES)
    ) throw new Error("out-of-band trust anchor is not a bounded single-link regular file");

    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    if (!descriptorBefore.isFile() || !sameStableFile(pathBefore, descriptorBefore)) {
      throw new Error("out-of-band trust anchor changed while opening");
    }
    const bytes = Buffer.alloc(TRUST_ANCHOR_MAX_BYTES + 1);
    let byteLength = 0;
    while (byteLength < bytes.byteLength) {
      const read = readSync(descriptor, bytes, byteLength, bytes.byteLength - byteLength, null);
      if (read === 0) break;
      byteLength += read;
    }
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(path, { bigint: true });
    if (
      byteLength === 0 || byteLength > TRUST_ANCHOR_MAX_BYTES ||
      BigInt(byteLength) !== descriptorBefore.size ||
      !sameStableFile(descriptorBefore, descriptorAfter) ||
      !sameStableFile(descriptorAfter, pathAfter) ||
      realpathSync(path) !== path
    ) throw new Error("out-of-band trust anchor changed while reading");
    try {
      return JSON.parse(bytes.subarray(0, byteLength).toString("utf8")) as SentinelExternalTrustAnchor;
    } catch {
      throw new Error("out-of-band trust anchor is not valid JSON");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("out-of-band trust anchor")) throw error;
    throw new Error("out-of-band trust anchor could not be read safely");
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function assertStableParent(path: string, expected: BigIntStats): void {
  const actual = lstatSync(path, { bigint: true });
  if (
    !actual.isDirectory() || actual.isSymbolicLink() ||
    !sameStableDirectory(expected, actual) || realpathSync(path) !== path
  ) throw new Error("output parent changed during the exclusive write");
}

function writeExclusiveReport(
  path: string,
  bytes: string,
  batch: PhysicalBatchBoundary,
  trustAnchorPath: string,
): void {
  const originalCwd = process.cwd();
  let parentDescriptor: number | null = null;
  let outputDescriptor: number | null = null;
  let outputName: string | null = null;
  let createdOutput: BigIntStats | null = null;
  try {
    const parent = dirname(path);
    const name = basename(path);
    const parentStat = lstatSync(parent, { bigint: true });
    if (
      name === "." || name === ".." || name.includes("\0") ||
      !parentStat.isDirectory() || parentStat.isSymbolicLink() || realpathSync(parent) !== parent
    ) throw new Error("output parent is not an existing canonical physical directory");
    const physicalPath = resolve(parent, name);
    if (
      physicalPath !== path || containedBy(batch.path, physicalPath) ||
      physicalPath === trustAnchorPath || pathEntryExists(physicalPath)
    ) throw new Error("output must be absent and physically disjoint from evidence inputs");

    parentDescriptor = openSync(parent, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedParent = fstatSync(parentDescriptor, { bigint: true });
    if (!openedParent.isDirectory() || !sameStableDirectory(parentStat, openedParent)) {
      throw new Error("output parent changed before the exclusive write");
    }
    assertStableParent(parent, openedParent);

    // A relative open from a verified cwd is the Node equivalent of binding
    // creation to the already-identified parent directory. Renaming the parent
    // and replacing its old path with a symlink cannot redirect this write.
    process.chdir(parent);
    const enteredParent = lstatSync(".", { bigint: true });
    if (!enteredParent.isDirectory() || !sameStableDirectory(openedParent, enteredParent)) {
      throw new Error("output parent changed before entering the exclusive write boundary");
    }
    outputName = name;
    outputDescriptor = openSync(
      name,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o400,
    );
    const openedOutput = fstatSync(outputDescriptor, { bigint: true });
    createdOutput = openedOutput;
    const linkedOutput = lstatSync(name, { bigint: true });
    if (
      !openedOutput.isFile() || openedOutput.isSymbolicLink() || openedOutput.nlink !== 1n ||
      (openedOutput.mode & 0o777n) !== 0o400n ||
      !sameIdentity(openedOutput, linkedOutput)
    ) throw new Error("output exclusive file identity is invalid");
    assertStableParent(parent, openedParent);

    const content = Buffer.from(bytes, "utf8");
    let offset = 0;
    while (offset < content.byteLength) {
      offset += writeSync(outputDescriptor, content, offset, content.byteLength - offset);
    }
    fsyncSync(outputDescriptor);
    const finalOutput = fstatSync(outputDescriptor, { bigint: true });
    const finalLink = lstatSync(name, { bigint: true });
    if (
      !sameIdentity(openedOutput, finalOutput) || !sameIdentity(finalOutput, finalLink) ||
      finalOutput.size !== BigInt(content.byteLength) || finalOutput.nlink !== 1n
    ) throw new Error("output changed during the exclusive write");
    assertStableParent(parent, openedParent);
    fsyncSync(parentDescriptor);
  } catch (error) {
    if (outputName !== null && createdOutput !== null) {
      try {
        const linked = lstatSync(outputName, { bigint: true });
        if (sameIdentity(createdOutput, linked)) unlinkSync(outputName);
      } catch {
        // Failure leaves no falsely successful report; cleanup is best effort.
      }
    }
    if (error instanceof Error && error.message.startsWith("output")) throw error;
    throw new Error("output report could not be written safely");
  } finally {
    if (outputDescriptor !== null) closeSync(outputDescriptor);
    if (parentDescriptor !== null) closeSync(parentDescriptor);
    try {
      process.chdir(originalCwd);
    } catch {
      // The CLI exits immediately and performs no later filesystem operation.
    }
  }
}

function main(): void {
  const cli = options(process.argv.slice(2));
  const batch = canonicalBatchRoot(cli.batchRoot);
  const result = verifySentinelProductionRawBatch({
    batchRoot: batch.path,
    trustAnchor: readTrustAnchor(cli.trustAnchorPath, batch),
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
  const bytes = JSON.stringify(report, null, 2) + "\n";
  if (cli.outputPath === null) process.stdout.write(bytes);
  else writeExclusiveReport(cli.outputPath, bytes, batch, cli.trustAnchorPath);
  if (!result.valid) process.exitCode = 1;
}

try { main(); }
catch (error) {
  process.stderr.write((error instanceof Error ? error.message : "raw verifier failed") + "\n");
  process.exitCode = 2;
}

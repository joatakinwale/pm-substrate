import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

function contains(parent: string, child: string): boolean {
  const candidate = relative(parent, child);
  return candidate === "" ||
    (candidate !== ".." && !candidate.startsWith("../") && !isAbsolute(candidate));
}

function assertPosixOutputParent(parent: string): void {
  const parentStat = lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error("execution output parent must be a regular directory");
  }
  const probeRoot = resolve(parent, `.pm-sentinel-posix-probe-${randomBytes(12).toString("hex")}`);
  const probeFile = resolve(probeRoot, "mode-probe");
  const linkedFile = resolve(probeRoot, "hard-link-probe");
  try {
    mkdirSync(probeRoot, { mode: 0o700 });
    chmodSync(probeRoot, 0o700);
    writeFileSync(probeFile, "posix-evidence-boundary\n", { flag: "wx", mode: 0o600 });
    chmodSync(probeFile, 0o400);
    linkSync(probeFile, linkedFile);
    const directoryMode = lstatSync(probeRoot).mode & 0o777;
    const fileStat = lstatSync(probeFile);
    const linkedStat = lstatSync(linkedFile);
    if (
      directoryMode !== 0o700 || (fileStat.mode & 0o777) !== 0o400 ||
      fileStat.ino !== linkedStat.ino || fileStat.nlink < 2
    ) throw new Error("execution output parent lacks required POSIX mode or hard-link semantics");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`execution output parent failed POSIX semantics probe: ${message}`);
  } finally {
    try {
      chmodSync(probeRoot, 0o700);
      if (existsSync(probeFile)) chmodSync(probeFile, 0o600);
      if (existsSync(linkedFile)) chmodSync(linkedFile, 0o600);
      rmSync(probeRoot, { recursive: true, force: true });
    } catch {
      // A cleanup residue is deliberately visible at the caller-selected boundary.
    }
  }
}

function canonicalFreshOutputRoot(path: string, label: string): string {
  if (!isAbsolute(path) || resolve(path) !== path) {
    throw new Error(`${label} must be a canonical absolute path`);
  }
  if (existsSync(path)) throw new Error(`${label} must be fresh`);
  const parent = dirname(path);
  const parentReal = realpathSync(parent);
  if (parentReal !== parent) {
    throw new Error(`${label} parent must be an existing canonical non-symlink path`);
  }
  if (basename(path) === "." || basename(path) === "..") {
    throw new Error(`${label} basename is invalid`);
  }
  assertPosixOutputParent(parent);
  return resolve(parentReal, basename(path));
}

export function assertSentinelFreshDisjointRoots(
  checkouts: readonly string[],
  batchRoot: string,
  registryRoot: string,
): void {
  const batch = canonicalFreshOutputRoot(batchRoot, "batchRoot");
  const registry = canonicalFreshOutputRoot(registryRoot, "attemptRegistryRoot");
  if (contains(batch, registry) || contains(registry, batch)) {
    throw new Error("batch and attempt registry roots overlap");
  }
  for (const checkout of checkouts) {
    if (
      contains(checkout, batch) || contains(checkout, registry) ||
      contains(batch, checkout) || contains(registry, checkout)
    ) throw new Error("execution roots overlap a benchmark checkout");
  }
}

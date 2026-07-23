#!/usr/bin/env tsx
/**
 * Run generic external-app boundary checks and write a revision-pinned D6
 * artifact. Every --check value is `<stable-name>::<shell command>`.
 *
 * Example:
 *   pnpm pm:boundary -- --app orbit_crm --app-dir ../orbit_crm \
 *     --out artifacts/orbit-boundary.json \
 *     --fingerprint-path server --fingerprint-path web \
 *     --check 'contract::pnpm --dir ../orbit_crm test:integration-contract'
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildBoundaryConformanceArtifact,
  type BoundaryConformanceCheckObservation,
} from "../packages/integration-kit/src/index.js";

interface CheckSpec {
  readonly name: string;
  readonly command: string;
}

interface Args {
  readonly appId: string;
  readonly appDir: string;
  readonly outPath: string;
  readonly observedAt: string;
  readonly fingerprintPaths: readonly string[];
  readonly checks: readonly CheckSpec[];
}

const ROOT = resolve(import.meta.dirname, "..");

function valuesFor(flag: string, argv: readonly string[]): readonly string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag) {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${flag} requires a value`);
      values.push(value);
      index += 1;
    }
  }
  return values;
}

function one(flag: string, argv: readonly string[]): string | undefined {
  const values = valuesFor(flag, argv);
  if (values.length > 1) throw new Error(`${flag} may only be provided once`);
  return values[0];
}

function parseArgs(argv: readonly string[]): Args {
  const appId = one("--app", argv);
  const appDir = one("--app-dir", argv);
  const outPath = one("--out", argv);
  if (!appId || !appDir || !outPath) {
    throw new Error(
      "pm:boundary requires --app <id> --app-dir <git-checkout> --out <artifact.json> and at least one --check <name>::<command>",
    );
  }
  const checks = valuesFor("--check", argv).map((value) => {
    const separator = value.indexOf("::");
    if (separator <= 0 || separator === value.length - 2) {
      throw new Error(
        `invalid --check ${JSON.stringify(value)}; expected name::command`,
      );
    }
    return {
      name: value.slice(0, separator),
      command: value.slice(separator + 2),
    };
  });
  if (checks.length === 0) {
    throw new Error("pm:boundary requires at least one --check");
  }
  const observedAt = one("--observed-at", argv) ?? new Date().toISOString();
  return {
    appId,
    appDir: resolve(appDir),
    outPath: resolve(outPath),
    observedAt,
    fingerprintPaths: valuesFor("--fingerprint-path", argv),
    checks,
  };
}

function git(dir: string, args: readonly string[]): Buffer {
  const result = spawnSync("git", ["-C", dir, ...args], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `git -C ${dir} ${args.join(" ")} failed: ${result.stderr.toString("utf8").trim()}`,
    );
  }
  return result.stdout;
}

const SOURCE_TREE_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".playwright-cli",
  ".pytest_cache",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "node_modules",
  "output",
  "var",
  "venv",
]);

function sourceTreePaths(root: string, current: string): readonly string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (
      entry.name === ".DS_Store" ||
      entry.name.startsWith("._") ||
      entry.name.endsWith(".pyc") ||
      entry.name.endsWith(".tsbuildinfo")
    ) {
      continue;
    }
    if (entry.isDirectory() && SOURCE_TREE_IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      paths.push(...sourceTreePaths(root, absolute));
    } else {
      paths.push(relative(root, absolute));
    }
  }
  return paths;
}

function describeSourceTree(
  label: string,
  dir: string,
  requestedPaths: readonly string[],
): string {
  const fingerprintPaths = (requestedPaths.length === 0 ? ["."] : requestedPaths)
    .map((path) => path.replace(/\/$/, ""))
    .sort();
  const paths = new Set<string>();
  for (const requested of fingerprintPaths) {
    const absolute = resolve(dir, requested);
    const relativePath = relative(dir, absolute);
    if (relativePath.startsWith("..") || resolve(dir, relativePath) !== absolute) {
      throw new Error(`--fingerprint-path escapes --app-dir: ${requested}`);
    }
    if (!existsSync(absolute)) {
      throw new Error(`--fingerprint-path does not exist: ${requested}`);
    }
    const stat = lstatSync(absolute);
    if (stat.isDirectory()) {
      for (const path of sourceTreePaths(dir, absolute)) paths.add(path);
    } else {
      paths.add(relativePath);
    }
  }
  const hash = createHash("sha256");
  hash.update(`pm-source-tree-v1\0${fingerprintPaths.join("\0")}\0`);
  for (const path of [...paths].sort()) {
    const absolute = resolve(dir, path);
    const stat = lstatSync(absolute);
    hash.update(`\0${path}\0${stat.mode}\0`);
    hash.update(stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute));
  }
  return `${label}@tree-sha256:${hash.digest("hex")};scope:${fingerprintPaths.join(",")}`;
}

function describeWorktree(
  label: string,
  dir: string,
  fingerprintPaths: readonly string[] = [],
): string {
  let head: string;
  try {
    head = git(dir, ["rev-parse", "HEAD"]).toString("utf8").trim();
  } catch {
    return describeSourceTree(label, dir, fingerprintPaths);
  }
  const status = git(dir, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  if (status.length === 0) return `${label}@${head}`;

  const paths = git(dir, ["ls-files", "-co", "--exclude-standard", "-z"])
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0)
    .sort();
  const hash = createHash("sha256").update(status);
  for (const path of paths) {
    const absolute = resolve(dir, path);
    if (!existsSync(absolute)) {
      hash.update(`\0${path}\0deleted\0`);
      continue;
    }
    const stat = lstatSync(absolute);
    hash.update(`\0${path}\0${stat.mode}\0`);
    if (stat.isSymbolicLink()) {
      hash.update(readlinkSync(absolute));
    } else if (stat.isFile()) {
      hash.update(readFileSync(absolute));
    } else {
      hash.update("non-file");
    }
  }
  return `${label}@${head}+dirty-sha256:${hash.digest("hex")}`;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function runCheck(spec: CheckSpec): BoundaryConformanceCheckObservation {
  const started = Date.now();
  const result = spawnSync("zsh", ["-lc", spec.command], {
    cwd: ROOT,
    env: process.env,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout ?? Buffer.alloc(0);
  const stderr = result.stderr ?? Buffer.alloc(0);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  if (result.error !== undefined) process.stderr.write(`${result.error.message}\n`);
  return {
    name: spec.name,
    command: spec.command,
    exitCode: result.status,
    signal: result.signal,
    durationMs: Date.now() - started,
    stdoutBytes: stdout.byteLength,
    stdoutSha256: sha256(stdout),
    stderrBytes: stderr.byteLength,
    stderrSha256: sha256(stderr),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2).filter((item) => item !== "--"));
  const artifact = buildBoundaryConformanceArtifact({
    appId: args.appId,
    observedAt: args.observedAt,
    appRevision: describeWorktree(
      args.appId,
      args.appDir,
      args.fingerprintPaths,
    ),
    substrateRevision: describeWorktree("pm-substrate", ROOT),
    checks: args.checks.map(runCheck),
  });
  mkdirSync(dirname(args.outPath), { recursive: true });
  writeFileSync(args.outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const relativeOut = relative(ROOT, args.outPath);
  const refPath = relativeOut.startsWith("..") ? args.outPath : relativeOut;
  const artifactRef = `artifact:${refPath}#sha256:${artifact.contentHash}`;
  console.log(
    JSON.stringify({
      ready: artifact.ready,
      blockers: artifact.blockers,
      appRevision: artifact.appRevision,
      substrateRevision: artifact.substrateRevision,
      boundaryConformanceRef: artifactRef,
    }),
  );
  if (!artifact.ready) process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

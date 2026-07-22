import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  parseSentinelProductionLocalDiagnosticInvocation,
  parseSentinelProductionLocalDiagnosticPrepareInvocation,
  readSentinelDiagnosticJsonFile,
  redactSentinelDiagnosticError,
} from "./sentinel-production-excluded-smoke-contracts.js";
import { prepareSentinelProductionLocalDiagnostic } from "./sentinel-production-excluded-smoke-cli.js";
import {
  sentinelProductionJsonSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import type {
  SentinelRuntimeClosureDerivation,
  SentinelRuntimeClosurePaths,
} from "./sentinel-runtime-closure.js";

const roots: string[] = [];

function removable(path: string): void {
  const stat = lstatSync(path);
  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    chmodSync(path, 0o700);
    for (const child of readdirSync(path)) removable(resolve(path, child));
  } else if (!stat.isSymbolicLink()) chmodSync(path, 0o600);
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    if (lstatOrNull(root) !== null) removable(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function lstatOrNull(path: string): ReturnType<typeof lstatSync> | null {
  try { return lstatSync(path); } catch { return null; }
}

function root(): string {
  const value = mkdtempSync(resolve(realpathSync(tmpdir()), "sentinel-diagnostic-cli-"));
  roots.push(value);
  return value;
}

function failClosed() {
  return {
    trustMode: "local-untrusted-diagnostic" as const,
    independent: false as const,
    batchComplete: false as const,
    evidenceEligible: false as const,
    analysisEligible: false as const,
    materialBenefit: false as const,
  };
}

function prepareValue(base: string) {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-prepare.v1",
    ...failClosed(),
    runtimePathsPath: resolve(base, "source-runtime-paths.json"),
    outputRoot: resolve(base, "prepared"),
    checkouts: {
      native: resolve(base, "native"),
      sham: resolve(base, "sham"),
      "plain-kv": resolve(base, "plain"),
      substrate: resolve(base, "substrate"),
    },
    batchRoot: resolve(base, "batch"),
    attemptRegistryRoot: resolve(base, "registry"),
    registration: {
      registrationId: "local-diagnostic-registration",
      registeredAt: "2026-07-14T20:00:00.000Z",
      producerId: "local-diagnostic-producer",
      repeatIds: ["repeat-01", "repeat-02", "repeat-03"],
      randomizationSeed: "local-diagnostic-randomization",
      bootstrapSeed: "local-diagnostic-bootstrap",
      rawBatchVerifierId: "raw-verifier-v1",
    },
    selectedTaskId: "microhub-stars-relative-passive",
    selectedRepeatId: "repeat-01",
  };
}

describe("Sentinel local diagnostic CLI contracts", () => {
  it("parses only the exact fail-closed invocation schema", () => {
    const base = root();
    const value = {
      schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-invocation.v1",
      ...failClosed(),
      preregistrationPath: resolve(base, "preregistration.json"),
      expectedPreregistrationSha256: "1".repeat(64),
      runtimePathsPath: resolve(base, "runtime-paths.json"),
      runtimePathsSha256: "2".repeat(64),
      expectedScheduleSha256: "3".repeat(64),
      checkouts: {
        native: resolve(base, "native"), sham: resolve(base, "sham"),
        "plain-kv": resolve(base, "plain"), substrate: resolve(base, "substrate"),
      },
      batchRoot: resolve(base, "batch"),
      attemptRegistryRoot: resolve(base, "registry"),
      selectedBlock: {
        blockSequence: 2,
        taskId: "microhub-stars-relative-passive",
        repeatId: "repeat-01",
        cellIds: ["cell:1", "cell:2", "cell:3", "cell:4"],
      },
    };
    expect(parseSentinelProductionLocalDiagnosticInvocation(value)).toEqual(value);
    expect(() => parseSentinelProductionLocalDiagnosticInvocation({
      ...value,
      independent: true,
    })).toThrow(/fail-closed/iu);
    expect(() => parseSentinelProductionLocalDiagnosticInvocation({
      ...value,
      externalCommitmentPath: resolve(base, "forbidden.json"),
    })).toThrow(/keys are not exact/iu);
  });

  it("reads bounded regular files without following a file or parent symlink", () => {
    const base = root();
    const file = resolve(base, "value.json");
    writeFileSync(file, "{\"ok\":true}\n");
    expect(readSentinelDiagnosticJsonFile(file, 1024, "value").value).toEqual({ ok: true });
    expect(() => readSentinelDiagnosticJsonFile(file, 4, "value")).toThrow(/size ceiling/iu);
    const alias = resolve(base, "alias.json");
    symlinkSync(file, alias);
    expect(() => readSentinelDiagnosticJsonFile(alias, 1024, "alias")).toThrow(/symbolic link/iu);
    const realDirectory = resolve(base, "real");
    mkdirSync(realDirectory);
    writeFileSync(resolve(realDirectory, "nested.json"), "{}\n");
    const directoryAlias = resolve(base, "directory-alias");
    symlinkSync(realDirectory, directoryAlias);
    expect(() => readSentinelDiagnosticJsonFile(
      resolve(directoryAlias, "nested.json"),
      1024,
      "nested",
    )).toThrow(/symbolic link/iu);
  });

  it("atomically emits a secret-free plan and hashed runnable invocation", () => {
    const base = root();
    const parsed = parseSentinelProductionLocalDiagnosticPrepareInvocation(prepareValue(base));
    Object.values(parsed.checkouts).forEach((path) => mkdirSync(path));
    const closure = {
      substrateRevision: "1".repeat(40),
      verifierScriptSha256: "2".repeat(64),
      closureSha256: "3".repeat(64),
    } as SentinelRuntimeClosure;
    const artifacts = { derivationSha256: "4".repeat(64) } as
      SentinelRuntimeClosureDerivation["artifacts"];
    const derivation = { closure, artifacts } as SentinelRuntimeClosureDerivation;
    const runtimePaths = { fixture: true } as unknown as SentinelRuntimeClosurePaths;
    const result = prepareSentinelProductionLocalDiagnostic(parsed, runtimePaths, {
      deriveRuntimeClosure: () => derivation,
    });
    expect(result).toMatchObject({
      ...failClosed(),
      outputRoot: parsed.outputRoot,
      preregistrationSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      scheduleSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      invocationSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(lstatSync(parsed.outputRoot).mode & 0o777).toBe(0o500);
    const invocationText = readFileSync(result.invocationPath, "utf8");
    expect(invocationText).not.toMatch(/signature|trustAnchor|externalCommitment|secret/iu);
    const invocation = parseSentinelProductionLocalDiagnosticInvocation(
      JSON.parse(invocationText) as unknown,
    );
    expect(sentinelProductionJsonSha256(invocation)).toBe(result.invocationSha256);
    expect(invocation.expectedPreregistrationSha256).toBe(result.preregistrationSha256);
    expect(invocation.expectedScheduleSha256).toBe(result.scheduleSha256);
    expect(invocation.selectedBlock.cellIds).toHaveLength(4);
    expect(() => prepareSentinelProductionLocalDiagnostic(parsed, runtimePaths, {
      deriveRuntimeClosure: () => derivation,
    })).toThrow(/fresh/iu);
  });

  it("redacts exact and recognizable outer secrets", () => {
    const database = "postgres://user:super-secret@127.0.0.1/db";
    const key = "sk-ant-api03-secretsecret";
    const message = redactSentinelDiagnosticError(
      new Error(`failed ${database} ${key}\nsecond line`),
      [database, key],
    );
    expect(message).not.toContain("super-secret");
    expect(message).not.toContain("secretsecret");
    expect(message).not.toContain("\n");
  });

  it("refuses to prepare diagnostic files inside a benchmark checkout", () => {
    const base = root();
    const value = prepareValue(base);
    const parsed = parseSentinelProductionLocalDiagnosticPrepareInvocation({
      ...value,
      outputRoot: resolve(value.checkouts.native, "prepared"),
    });
    Object.values(parsed.checkouts).forEach((path) => mkdirSync(path));
    expect(() => prepareSentinelProductionLocalDiagnostic(
      parsed,
      {} as SentinelRuntimeClosurePaths,
      { deriveRuntimeClosure: () => { throw new Error("must not derive"); } },
    )).toThrow(/overlaps.*checkout/iu);
  });
});

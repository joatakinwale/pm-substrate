import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  executeSentinelProductionRunInvocation,
  parseSentinelProductionRunInvocation,
  redactSentinelProductionRunError,
  type SentinelProductionRunInvocation,
} from "./sentinel-production-runner-cli.js";
import type { SentinelProductionRunInput } from "./sentinel-production-runner.js";

const invocation = (): SentinelProductionRunInvocation => ({
  schemaVersion: "pm.public-eval-corners.sentinel-production-run-invocation.v1",
  preregistrationPath: "/proof/preregistration.json",
  signaturePath: "/proof/signature.json",
  trustAnchorPath: "/proof/trust-anchor.json",
  externalCommitmentPath: "/proof/external-commitment.json",
  runtimePathsPath: "/proof/runtime-paths.json",
  checkouts: {
    native: "/checkouts/native",
    sham: "/checkouts/sham",
    "plain-kv": "/checkouts/plain-kv",
    substrate: "/checkouts/substrate",
  },
  batchRoot: "/runs/batch",
  attemptRegistryRoot: "/runs/attempts",
});

describe("sentinel production runner CLI boundary", () => {
  it("accepts only the nine secret-free outer keys and exact four-arm checkout keys", () => {
    const parsed = parseSentinelProductionRunInvocation(invocation());
    expect(Object.keys(parsed).sort()).toEqual([
      "attemptRegistryRoot",
      "batchRoot",
      "checkouts",
      "externalCommitmentPath",
      "preregistrationPath",
      "runtimePathsPath",
      "schemaVersion",
      "signaturePath",
      "trustAnchorPath",
    ]);
    expect(Object.keys(parsed.checkouts).sort()).toEqual([
      "native",
      "plain-kv",
      "sham",
      "substrate",
    ]);

    expect(() => parseSentinelProductionRunInvocation({
      ...invocation(),
      databaseUrl: "postgres://must-not-be-accepted",
    })).toThrow(/keys are not exact/iu);
    expect(() => parseSentinelProductionRunInvocation({
      ...invocation(),
      checkouts: { ...invocation().checkouts, placebo: "/checkouts/placebo" },
    })).toThrow(/checkouts keys are not exact/iu);
  });

  it("rejects non-canonical paths and malformed outer input", () => {
    expect(() => parseSentinelProductionRunInvocation({
      ...invocation(),
      batchRoot: "/runs/../runs/batch",
    })).toThrow(/canonical absolute path/iu);
    expect(() => parseSentinelProductionRunInvocation({
      ...invocation(),
      schemaVersion: "pm.public-eval-corners.sentinel-production-run-invocation.v2",
    })).toThrow(/unsupported/iu);
    expect(() => parseSentinelProductionRunInvocation(null)).toThrow(/must be an object/iu);
  });

  it("reads bounded references and maps one invocation to exactly one production run", async () => {
    const values = new Map<string, unknown>([
      ["/proof/preregistration.json", { kind: "preregistration" }],
      ["/proof/signature.json", { kind: "signature" }],
      ["/proof/trust-anchor.json", { kind: "trust-anchor" }],
      ["/proof/external-commitment.json", { kind: "external-commitment" }],
      ["/proof/runtime-paths.json", { kind: "runtime-paths" }],
    ]);
    const readJsonFile = vi.fn((path: string) => ({
      value: values.get(path),
      bytes: Buffer.from("{}"),
      sha256: "0".repeat(64),
    }));
    const calls: SentinelProductionRunInput[] = [];
    const runBatch = vi.fn(async (input: SentinelProductionRunInput) => {
      calls.push(input);
      return { schemaVersion: "test-result.v1" };
    });
    const result = await executeSentinelProductionRunInvocation(invocation(), {
      environment: {
        PM_DATABASE_URL: "postgres://pm:password@localhost/pm",
        ANTHROPIC_API_KEY: "sk-ant-test-secret",
      },
      readJsonFile,
      runBatch,
    });

    expect(result).toEqual({ schemaVersion: "test-result.v1" });
    expect(readJsonFile).toHaveBeenCalledTimes(5);
    expect(readJsonFile.mock.calls.every((call) => Number(call[1]) > 0)).toBe(true);
    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      preregistration: { kind: "preregistration" },
      signature: { kind: "signature" },
      trustAnchor: { kind: "trust-anchor" },
      externalCommitment: { kind: "external-commitment" },
      runtime: { paths: { kind: "runtime-paths" } },
      checkouts: invocation().checkouts,
      batchRoot: "/runs/batch",
      attemptRegistryRoot: "/runs/attempts",
      databaseUrl: "postgres://pm:password@localhost/pm",
      anthropicApiKey: "sk-ant-test-secret",
    });
  });

  it("requires both credentials from the environment before reading or running", async () => {
    const readJsonFile = vi.fn();
    const runBatch = vi.fn();
    await expect(executeSentinelProductionRunInvocation(invocation(), {
      environment: { ANTHROPIC_API_KEY: "sk-ant-present" },
      readJsonFile,
      runBatch,
    })).rejects.toThrow(/PM_DATABASE_URL is required/iu);
    await expect(executeSentinelProductionRunInvocation(invocation(), {
      environment: { PM_DATABASE_URL: "postgres://present" },
      readJsonFile,
      runBatch,
    })).rejects.toThrow(/ANTHROPIC_API_KEY is required/iu);
    expect(readJsonFile).not.toHaveBeenCalled();
    expect(runBatch).not.toHaveBeenCalled();
  });

  it("redacts both environment secrets and credential-shaped fallback text", () => {
    const databaseUrl = "postgres://pm:private-password@localhost/pm";
    const anthropicApiKey = "sk-ant-private-api-key";
    const message = redactSentinelProductionRunError(
      new Error(`${databaseUrl}\n${anthropicApiKey}\rsk-ant-anothersecret123`),
      { PM_DATABASE_URL: databaseUrl, ANTHROPIC_API_KEY: anthropicApiKey },
    );
    expect(message).not.toContain("private-password");
    expect(message).not.toContain("private-api-key");
    expect(message).not.toContain("anothersecret123");
    expect(message).not.toMatch(/[\r\n]/u);
    expect(message).toContain("[REDACTED]");
  });

  it("fails closed at the process boundary without creating roots or echoing secrets", () => {
    const root = realpathSync(mkdtempSync(resolve(
      realpathSync(tmpdir()),
      "pm-sentinel-production-cli-",
    )));
    const batchRoot = resolve(root, "batch");
    const attemptRegistryRoot = resolve(root, "attempts");
    const invocationPath = resolve(root, "invocation.json");
    const sourcePath = fileURLToPath(new URL("./sentinel-production-runner-cli.ts", import.meta.url));
    const databaseUrl = "postgres://pm:subprocess-secret@localhost/pm";
    const anthropicApiKey = "sk-ant-subprocess-secret";
    const base = {
      ...invocation(),
      batchRoot,
      attemptRegistryRoot,
    };
    try {
      writeFileSync(invocationPath, JSON.stringify({
        ...base,
        anthropicApiKey,
        databaseUrl,
      }));
      const malformed = spawnSync(
        process.execPath,
        ["--import", "tsx", sourcePath, invocationPath],
        {
          cwd: resolve(fileURLToPath(new URL("../../..", import.meta.url))),
          encoding: "utf8",
          env: { ...process.env, PM_DATABASE_URL: databaseUrl, ANTHROPIC_API_KEY: anthropicApiKey },
        },
      );
      expect(malformed.status).not.toBe(0);
      expect(malformed.stdout).toBe("");
      expect(malformed.stderr).toMatch(/keys are not exact/iu);
      expect(malformed.stderr).not.toContain(databaseUrl);
      expect(malformed.stderr).not.toContain(anthropicApiKey);
      expect(existsSync(batchRoot)).toBe(false);
      expect(existsSync(attemptRegistryRoot)).toBe(false);

      writeFileSync(invocationPath, JSON.stringify(base));
      const {
        PM_DATABASE_URL: _databaseUrl,
        ANTHROPIC_API_KEY: _anthropicApiKey,
        ...environmentWithoutCredentials
      } = process.env;
      const missingEnvironment = spawnSync(
        process.execPath,
        ["--import", "tsx", sourcePath, invocationPath],
        {
          cwd: resolve(fileURLToPath(new URL("../../..", import.meta.url))),
          encoding: "utf8",
          env: environmentWithoutCredentials,
        },
      );
      expect(missingEnvironment.status).not.toBe(0);
      expect(missingEnvironment.stdout).toBe("");
      expect(missingEnvironment.stderr).toMatch(/PM_DATABASE_URL is required/iu);
      expect(existsSync(batchRoot)).toBe(false);
      expect(existsSync(attemptRegistryRoot)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);
});

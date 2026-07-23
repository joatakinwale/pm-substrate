import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI = resolve(import.meta.dirname, "..", "dist", "sentinel-production-batch-cli.js");

function runCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv = {},
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { PATH: process.env["PATH"] ?? "", ...env },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function invocationBody(): Record<string, unknown> {
  const root = mkdtempSync(join(tmpdir(), "sentinel-batch-cli-"));
  const absolute = (name: string): string => resolve(root, name);
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-batch-invocation.v1",
    preregistrationPath: absolute("preregistration.json"),
    signaturePath: absolute("signature.json"),
    trustAnchorPath: absolute("trust-anchor.json"),
    externalCommitmentPath: absolute("external-commitment.json"),
    runtimePathsPath: absolute("runtime-paths.json"),
    checkouts: {
      native: absolute("checkout-native"),
      sham: absolute("checkout-sham"),
      "plain-kv": absolute("checkout-plain-kv"),
      substrate: absolute("checkout-substrate"),
    },
    batchRoot: absolute("batch"),
    attemptRegistryRoot: absolute("attempts"),
  };
}

function writeInvocation(body: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-batch-cli-invocation-"));
  const path = join(dir, "invocation.json");
  writeFileSync(path, JSON.stringify(body));
  return path;
}

describe("sentinel production batch CLI (fail-closed transport)", () => {
  it("rejects missing or extra arguments with usage", () => {
    const none = runCli([]);
    expect(none.status).toBe(1);
    expect(none.stderr).toContain("usage: pm-sentinel-production-batch");
    const extra = runCli(["/a.json", "/b.json"]);
    expect(extra.status).toBe(1);
    expect(extra.stderr).toContain("usage: pm-sentinel-production-batch");
  });

  it("rejects a non-canonical invocation path", () => {
    const result = runCli(["relative/invocation.json"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must be a canonical absolute path");
  });

  it("rejects smuggled keys, task/repeat selection keys, and wrong schema", () => {
    const smuggled = runCli([writeInvocation({ ...invocationBody(), extra: true })]);
    expect(smuggled.status).toBe(1);
    expect(smuggled.stderr).toContain("batch invocation keys are not exact");

    // The smoke CLI's diagnostic selection must not be accepted by the full
    // batch transport: a batch runs the complete declared schedule only.
    const selection = runCli([
      writeInvocation({ ...invocationBody(), taskId: "task", repeatId: "repeat" }),
    ]);
    expect(selection.status).toBe(1);
    expect(selection.stderr).toContain("batch invocation keys are not exact");

    const wrongSchema = runCli([
      writeInvocation({
        ...invocationBody(),
        schemaVersion:
          "pm.public-eval-corners.sentinel-production-excluded-smoke-invocation.v1",
      }),
    ]);
    expect(wrongSchema.status).toBe(1);
    expect(wrongSchema.stderr).toContain("unsupported batch invocation schemaVersion");
  });

  it("requires PM_DATABASE_URL and ANTHROPIC_API_KEY before touching any input file", () => {
    const path = writeInvocation(invocationBody());
    const noDatabase = runCli([path]);
    expect(noDatabase.status).toBe(1);
    expect(noDatabase.stderr).toContain("PM_DATABASE_URL is required");
    const noProvider = runCli([path], { PM_DATABASE_URL: "postgres://example/db" });
    expect(noProvider.status).toBe(1);
    expect(noProvider.stderr).toContain("ANTHROPIC_API_KEY is required");
  });
});

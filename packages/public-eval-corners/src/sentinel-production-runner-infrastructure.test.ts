import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SENTINEL_PRODUCTION_REPOSITORY,
  buildSentinelRuntimeSanitizedEnvironment,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import { inspectSentinelProductionCheckout } from "./sentinel-production-runner-infrastructure.js";

const SYSTEM_GIT = "/usr/bin/git";
const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(root: string, arguments_: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function plannedRuntime(): SentinelRuntimeClosure {
  const environment = buildSentinelRuntimeSanitizedEnvironment(process.execPath);
  const environmentSha256 = sentinelProductionJsonSha256(environment);
  return {
    executionEnvironment: {
      schemaVersion: "pm.public-eval-corners.sentinel-sanitized-environment.v2",
      values: environment,
      environmentSha256,
      inheritsHostEnvironment: false,
    },
    git: {
      version: "git version closure-bound-test-fixture",
      executablePath: SYSTEM_GIT,
      executableSha256: sentinelProductionSha256(readFileSync(SYSTEM_GIT)),
      invocationEnvironmentSha256: environmentSha256,
    },
    node: { requestedPath: process.execPath },
    upstream: {},
  } as SentinelRuntimeClosure;
}

function hiddenIndexCheckout(flag: "--assume-unchanged" | "--skip-worktree"): string {
  const root = mkdtempSync(resolve(tmpdir(), "pm-sentinel-checkout-index-"));
  roots.push(root);
  git(root, ["init"]);
  git(root, ["config", "user.email", "sentinel-test@example.invalid"]);
  git(root, ["config", "user.name", "Sentinel Test"]);
  git(root, ["remote", "add", "origin", SENTINEL_PRODUCTION_REPOSITORY]);
  mkdirSync(resolve(root, "server"));
  writeFileSync(resolve(root, "server", "server.py"), "ORIGINAL = True\n");
  git(root, ["add", "server/server.py"]);
  git(root, ["commit", "-m", "fixture"]);
  git(root, ["update-index", flag, "server/server.py"]);
  writeFileSync(resolve(root, "server", "server.py"), "SUBSTITUTED = True\n");
  expect(git(root, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
  return root;
}

describe("Sentinel production checkout preflight", () => {
  it.each(["--skip-worktree", "--assume-unchanged"] as const)(
    "rejects a status-clean checkout hidden by %s",
    (flag) => {
      const result = inspectSentinelProductionCheckout(
        hiddenIndexCheckout(flag),
        [],
        plannedRuntime(),
      );
      expect(result).toMatchObject({
        valid: false,
        issues: ["checkout has skip-worktree or assume-unchanged index flags"],
      });
    },
  );

  it("ignores a hostile ambient PATH and Git config while executing the closure-bound Git", () => {
    const checkout = hiddenIndexCheckout("--skip-worktree");
    const hostileRoot = mkdtempSync(resolve(tmpdir(), "pm-sentinel-hostile-git-"));
    roots.push(hostileRoot);
    const marker = resolve(hostileRoot, "ambient-git-ran");
    const wrapper = resolve(hostileRoot, "git");
    const config = resolve(hostileRoot, "config");
    writeFileSync(
      wrapper,
      `#!/bin/sh\nprintf invoked > "${marker}"\nexec ${SYSTEM_GIT} "$@"\n`,
      { mode: 0o700 },
    );
    chmodSync(wrapper, 0o700);
    writeFileSync(config, "[invalid\n", { mode: 0o600 });
    vi.stubEnv("PATH", `${hostileRoot}:${process.env.PATH ?? ""}`);
    vi.stubEnv("GIT_CONFIG_GLOBAL", config);
    vi.stubEnv("GIT_CONFIG_COUNT", "1");
    vi.stubEnv("GIT_CONFIG_KEY_0", "alias.status");
    vi.stubEnv("GIT_CONFIG_VALUE_0", "!exit 0");

    const result = inspectSentinelProductionCheckout(checkout, [], plannedRuntime());

    expect(result).toMatchObject({
      valid: false,
      issues: ["checkout has skip-worktree or assume-unchanged index flags"],
    });
    expect(existsSync(marker)).toBe(false);
  });

  it.each(["PATH", "GIT_CONFIG"] as const)(
    "rejects a closure that signs an unsanitized %s before executing Git",
    (variable) => {
      const checkout = hiddenIndexCheckout("--assume-unchanged");
      const runtime = plannedRuntime();
      const values = variable === "PATH"
        ? { ...runtime.executionEnvironment.values, PATH: "/hostile/bin" }
        : { ...runtime.executionEnvironment.values, GIT_CONFIG: "/hostile/config" };
      const environmentSha256 = sentinelProductionJsonSha256(values);
      const poisoned = {
        ...runtime,
        executionEnvironment: {
          ...runtime.executionEnvironment,
          values,
          environmentSha256,
        },
        git: {
          ...runtime.git,
          invocationEnvironmentSha256: environmentSha256,
        },
      } as SentinelRuntimeClosure;

      const result = inspectSentinelProductionCheckout(checkout, [], poisoned);

      expect(result).toMatchObject({
        valid: false,
        repositoryUrl: null,
        revision: null,
        sourceTreeHash: null,
        issues: ["checkout Git environment is not the exact signed sanitized environment"],
      });
    },
  );

  it("rejects Git bytes that do not match the closure-bound executable identity", () => {
    const checkout = hiddenIndexCheckout("--skip-worktree");
    const runtime = plannedRuntime();
    const result = inspectSentinelProductionCheckout(checkout, [], {
      ...runtime,
      git: { ...runtime.git, executableSha256: "0".repeat(64) },
    });

    expect(result).toMatchObject({
      valid: false,
      repositoryUrl: null,
      revision: null,
      sourceTreeHash: null,
      issues: ["checkout Git executable is not the closure-bound executable"],
    });
  });
});

import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  runAndVerifyToolSandboxOracleReplay,
  type ToolSandboxOracleReplayProcessResult,
  type ToolSandboxOracleReplayTestOnlyDependencies,
} from "./oracle-replay.js";

const PREFIX = "PM_TOOL_SANDBOX_ORACLE_REPLAY=";
const SCENARIO =
  "send_message_with_contact_content_cellular_off_multiple_user_turn";
const STARTING_CONTEXT = {
  normalizationRuleId:
    "pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1",
  normalizedContextSha256:
    "62717eafc44807b3b6729f8c5b5f0f47fbeffba30093c421d90689ac30da2d04",
  volatileTimestampValueCount: 11,
} as const;
const SCRIPT_PATH = fileURLToPath(
  new URL("../upstream/replay_oracle.py", import.meta.url),
);
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite test value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStringify(entry)}`)
      .join(",")}}`;
  }
  throw new Error("unsupported test value");
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256Bytes(Buffer.from(canonicalStringify(value), "utf8"));
}

function perfectResultSummary(): Record<string, unknown> {
  return {
    per_scenario_results: [
      {
        name: SCENARIO,
        categories: ["STATE_DEPENDENCY"],
        traceback: null,
        exception_type: null,
        milestone_similarity: 1,
        minefield_similarity: 0,
        similarity: 1,
        turn_count: 14,
        milestone_mapping: {
          "0": [5, 1],
          "1": [7, 1],
          "2": [10, 1],
          "3": [12, 1],
        },
        minefield_mapping: {},
      },
    ],
    category_aggregated_results: {
      STATE_DEPENDENCY: { similarity: 1, turn_count: 14 },
    },
    git_sha: "165848b9a78cead7ca7fe7c89c688b58e6501219",
  };
}

function perfectOracle(): Record<string, unknown> {
  return {
    maxTurnCount: 30,
    metrics: {
      milestoneSimilarity: 1,
      minefieldSimilarity: 0,
      similarity: 1,
      turnCount: 14,
    },
    milestoneMapping: {
      "0": [5, 1],
      "1": [7, 1],
      "2": [10, 1],
      "3": [12, 1],
    },
    minefieldMapping: {},
    strictTaskSuccessRule: {
      inputs: {
        allMilestonesExact: true,
        allMilestonesPresent: true,
        expectedMilestoneCount: 4,
        expectedMinefieldCount: 0,
        milestoneSimilarity: 1,
        minefieldSimilarity: 0,
        noMinefieldMatches: true,
        observedMilestoneCount: 4,
        observedMinefieldCount: 0,
        similarity: 1,
      },
      result: true,
      ruleId: "pm.public-eval.toolsandbox-strict-task-success.v1",
    },
  };
}

function failingOracle(): Record<string, unknown> {
  return {
    maxTurnCount: 30,
    metrics: {
      milestoneSimilarity: 0.5,
      minefieldSimilarity: 0,
      similarity: 0.5,
      turnCount: 8,
    },
    milestoneMapping: {
      "0": [5, 1],
      "1": [6, 1],
      "2": [7, 0],
      "3": [8, 0],
    },
    minefieldMapping: {},
    strictTaskSuccessRule: {
      inputs: {
        allMilestonesExact: false,
        allMilestonesPresent: true,
        expectedMilestoneCount: 4,
        expectedMinefieldCount: 0,
        milestoneSimilarity: 0.5,
        minefieldSimilarity: 0,
        noMinefieldMatches: true,
        observedMilestoneCount: 4,
        observedMinefieldCount: 0,
        similarity: 0.5,
      },
      result: false,
      ruleId: "pm.public-eval.toolsandbox-strict-task-success.v1",
    },
  };
}

interface Harness {
  readonly checkoutPath: string;
  readonly contextPath: string;
  readonly summaryPath: string;
}

function harness(): Harness {
  const root = mkdtempSync(join(tmpdir(), "pm-toolsandbox-oracle-"));
  roots.push(root);
  const checkoutPath = join(root, "checkout");
  mkdirSync(checkoutPath);
  const contextPath = join(root, "execution_context.json");
  const summaryPath = join(root, "result_summary.json");
  writeFileSync(contextPath, '{"retained":"execution-context"}\n');
  writeFileSync(summaryPath, `${JSON.stringify(perfectResultSummary(), null, 2)}\n`);
  return { checkoutPath, contextPath, summaryPath };
}

function receiptFor(
  contextPath: string,
  oracle: Record<string, unknown>,
): Record<string, unknown> {
  const context = readFileSync(contextPath);
  const script = readFileSync(SCRIPT_PATH);
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-oracle-replay.v2",
    benchmark: {
      repositoryUrl: "https://github.com/apple/ToolSandbox",
      revision: "165848b9a78cead7ca7fe7c89c688b58e6501219",
      scenario: SCENARIO,
      treeHash: "060c6eb2a9d4370c56586d4340401d87fa155eda",
    },
    bindings: {
      executionContextByteLength: context.byteLength,
      executionContextSha256: sha256Bytes(context),
      replayScriptByteLength: script.byteLength,
      replayScriptSha256: sha256Bytes(script),
    },
    startingContext: { ...STARTING_CONTEXT },
    oracle,
  };
  return { ...body, receiptHash: sha256Json(body) };
}

function resign(receipt: Record<string, unknown>): Record<string, unknown> {
  const body = { ...receipt };
  delete body["receiptHash"];
  return { ...body, receiptHash: sha256Json(body) };
}

function successfulProcess(stdout: string): ToolSandboxOracleReplayProcessResult {
  return {
    status: 0,
    stdout: Buffer.from(stdout, "utf8"),
    stderr: Buffer.alloc(0),
  };
}

function dependenciesFor(
  receipt: Record<string, unknown>,
): ToolSandboxOracleReplayTestOnlyDependencies {
  return {
    invoke: () => successfulProcess(`${PREFIX}${canonicalStringify(receipt)}\n`),
  };
}

function verify(
  fixture: Harness,
  dependencies: ToolSandboxOracleReplayTestOnlyDependencies,
) {
  return runAndVerifyToolSandboxOracleReplay(
    {
      pythonExecutable: process.execPath,
      checkoutPath: fixture.checkoutPath,
      executionContextPath: fixture.contextPath,
      resultSummaryPath: fixture.summaryPath,
    },
    dependencies,
  );
}

describe("runAndVerifyToolSandboxOracleReplay", () => {
  it("returns ordered mismatch reasons when a replayed failure contradicts a perfect raw summary", () => {
    const fixture = harness();
    const receipt = receiptFor(fixture.contextPath, failingOracle());

    const verification = verify(fixture, dependenciesFor(receipt));

    expect(verification.verified).toBe(false);
    expect(verification.mismatchReasons).toEqual([
      "reported_similarity_differs_from_replay",
      "reported_milestone_similarity_differs_from_replay",
      "reported_turn_count_differs_from_replay",
      "reported_milestone_mapping_differs_from_replay",
      "reported_strict_task_success_differs_from_replay",
    ]);
  });

  it("verifies an exact raw-summary and clean-oracle replay match", () => {
    const fixture = harness();
    const receipt = receiptFor(fixture.contextPath, perfectOracle());

    const verification = verify(fixture, dependenciesFor(receipt));

    expect(verification.verified).toBe(true);
    expect(verification.schemaVersion).toBe(
      "pm.public-eval.toolsandbox-oracle-replay-verification.v2",
    );
    expect(verification.mismatchReasons).toEqual([]);
    expect(verification.receipt.receiptHash).toBe(receipt["receiptHash"]);
    expect(verification.receipt.startingContext).toEqual(STARTING_CONTEXT);
    expect(verification.bindings.resultSummary.sha256).toBe(
      sha256Bytes(readFileSync(fixture.summaryPath)),
    );
    expect(verification.invocation.stdoutSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(verification.invocation.stderrSha256).toBe(
      sha256Bytes(Buffer.alloc(0)),
    );
    expect(verification.invocation.invocationHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(verification.invocation.environment).toEqual({
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin",
      PYTHONHASHSEED: "0",
      PYTHONNOUSERSITE: "1",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONUTF8: "1",
    });
    expect(verification.bindings.pythonRuntime.nativeBinaryFormatVerified).toBe(
      true,
    );
    expect(verification.verificationHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("rejects a forged receipt hash", () => {
    const fixture = harness();
    const receipt = receiptFor(fixture.contextPath, perfectOracle());
    receipt["receiptHash"] = "0".repeat(64);

    expect(() => verify(fixture, dependenciesFor(receipt))).toThrow(
      /receiptHash does not recompute/u,
    );
  });

  it.each([
    [
      "normalization rule field",
      (receipt: Record<string, unknown>) => {
        const startingContext = receipt["startingContext"] as Record<
          string,
          unknown
        >;
        startingContext["normalizationRuleId"] =
          "pm.public-eval.toolsandbox-starting-context.attacker.v1";
      },
      /normalizationRuleId is unsupported/u,
    ],
    [
      "normalized context hash",
      (receipt: Record<string, unknown>) => {
        const startingContext = receipt["startingContext"] as Record<
          string,
          unknown
        >;
        startingContext["normalizedContextSha256"] = "f".repeat(64);
      },
      /normalizedContextSha256 does not match the pinned scenario/u,
    ],
    [
      "volatile timestamp count",
      (receipt: Record<string, unknown>) => {
        const startingContext = receipt["startingContext"] as Record<
          string,
          unknown
        >;
        startingContext["volatileTimestampValueCount"] = 10;
      },
      /volatileTimestampValueCount does not match the pinned scenario/u,
    ],
    [
      "receipt schema",
      (receipt: Record<string, unknown>) => {
        receipt["schemaVersion"] = "pm.public-eval.toolsandbox-oracle-replay.v1";
      },
      /schemaVersion must equal pm\.public-eval\.toolsandbox-oracle-replay\.v2/u,
    ],
  ] as const)("rejects a re-signed %s mutation", (_label, mutate, message) => {
    const fixture = harness();
    const receipt = receiptFor(fixture.contextPath, perfectOracle());
    mutate(receipt);

    expect(() => verify(fixture, dependenciesFor(resign(receipt)))).toThrow(
      message,
    );
  });

  it("rejects a re-signed unexpected starting-context field", () => {
    const fixture = harness();
    const receipt = receiptFor(fixture.contextPath, perfectOracle());
    const startingContext = receipt["startingContext"] as Record<string, unknown>;
    startingContext["unregisteredNormalization"] = true;

    expect(() => verify(fixture, dependenciesFor(resign(receipt)))).toThrow(
      /startingContext has missing or unexpected fields/u,
    );
  });

  it.each([
    ["execution context", "executionContextSha256", /supplied execution context/u],
    ["replay script", "replayScriptSha256", /invoked replay script/u],
  ] as const)("rejects a validly hashed receipt bound to the wrong %s", (_label, key, message) => {
    const fixture = harness();
    const receipt = receiptFor(fixture.contextPath, perfectOracle());
    const bindings = receipt["bindings"] as Record<string, unknown>;
    bindings[key] = "f".repeat(64);
    const rebound = resign(receipt);

    expect(() => verify(fixture, dependenciesFor(rebound))).toThrow(message);
  });

  it("rejects multiple prefixed replay receipts", () => {
    const fixture = harness();
    const receipt = receiptFor(fixture.contextPath, perfectOracle());
    const line = `${PREFIX}${canonicalStringify(receipt)}\n`;

    expect(() =>
      verify(fixture, {
        invoke: () => successfulProcess(`${line}${line}`),
      }),
    ).toThrow(/exactly one prefixed receipt/u);
  });

  it("rejects an executable script wrapper before it can impersonate Python", () => {
    const fixture = harness();
    const wrapper = join(fixture.checkoutPath, "fake-python");
    writeFileSync(wrapper, "#!/bin/sh\nexit 0\n");
    chmodSync(wrapper, 0o700);

    expect(() =>
      runAndVerifyToolSandboxOracleReplay(
        {
          pythonExecutable: wrapper,
          checkoutPath: fixture.checkoutPath,
          executionContextPath: fixture.contextPath,
          resultSummaryPath: fixture.summaryPath,
        },
        dependenciesFor(receiptFor(fixture.contextPath, perfectOracle())),
      ),
    ).toThrow(/native executable, not a script wrapper/u);
  });
});

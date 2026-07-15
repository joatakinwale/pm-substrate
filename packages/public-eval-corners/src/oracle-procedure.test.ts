import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  getOracleProcedureBinding,
  validateBoundOracleOutcome,
  validateOracleProcedureBinding,
  type OracleProcedureManifest,
} from "./oracle-procedure.js";

type JsonRecord = Record<string, unknown>;

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as JsonRecord)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error("unsupported test fixture value");
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

const sentinelManifest: OracleProcedureManifest = {
  cornerId: "sentinel-microhub-stars",
  tasks: [
    { taskId: "microhub-stars-relative-passive" },
    { taskId: "microhub-stars-noop" },
    { taskId: "microhub-stars-absolute-passive" },
  ],
  sources: [
    {
      sourceId: "sentinel-stars-relative",
      path: "scenarios/microhub/stars-relative-passive.json",
      sha256: "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
    },
    {
      sourceId: "sentinel-eval-harness",
      path: "server/eval_harness.py",
      sha256: "c05a1a8512512d323c4ae039e5f847e87f9d9cf4cad617deb7ed3741b1f575a7",
    },
    {
      sourceId: "sentinel-server",
      path: "server/server.py",
      sha256: "30fc6fd2afcab651fb58eb54862c7e6f7b2e82a503e911a6a14df2c3024ed165",
    },
  ],
};

function sentinelOutcome(): JsonRecord {
  const binding = getOracleProcedureBinding(
    "sentinel-microhub-stars",
    "microhub-stars-relative-passive",
  );
  const rawInputs = binding.requiredRawInputRoles.map((role, index) => ({
    role,
    path: `raw/${index}-${role}.json`,
    sha256: createHash("sha256").update(`${role}-bytes`).digest("hex"),
    byteLength: 100 + index,
  }));
  const rawInputRootSha256 = sha256Json(rawInputs);
  const result = {
    success: true,
    detail: "eval_sql returned 1",
    evaluation_time: 610,
    condition_at: 587.31,
    contact_get_time: 600,
    contact_post_time: 601,
    contact_message: "threshold reached",
  };
  const resultSha256 = sha256Json(result);
  return {
    schemaVersion: "pm.public-eval-corners.bound-oracle-outcome.v1",
    cornerId: binding.cornerId,
    taskId: binding.taskId,
    procedureId: binding.procedureId,
    bindingSha256: binding.bindingSha256,
    rawInputs,
    rawInputRootSha256,
    evaluatorInvocation: {
      schemaVersion: "pm.public-eval-corners.oracle-entrypoint-trace.v1",
      status: "locally-captured-unverified",
      bindingSha256: binding.bindingSha256,
      primary: {
        sourceId: binding.evaluatorSource.sourceId,
        sourcePath: binding.evaluatorSource.path,
        sourceSha256: binding.evaluatorSource.sha256,
        entrypoint: binding.entrypoint,
        invocationCount: 1,
      },
      dynamic: null,
      rawInputRootSha256,
      resultSha256,
    },
    result,
    resultSha256,
    independentlyVerified: false,
    eligibleForIndependentAnalysis: false,
  };
}

function validationContext(outcome: JsonRecord): {
  readonly expectedTaskId: string;
  readonly expectedRawInputs: readonly {
    readonly role: string;
    readonly path: string;
    readonly sha256: string;
    readonly byteLength: number;
  }[];
} {
  return {
    expectedTaskId: outcome.taskId as string,
    expectedRawInputs: structuredClone(outcome.rawInputs) as {
      readonly role: string;
      readonly path: string;
      readonly sha256: string;
      readonly byteLength: number;
    }[],
  };
}

function procedureFixture(
  cornerId: Parameters<typeof getOracleProcedureBinding>[0],
  taskId: string,
  result: unknown,
): {
  readonly manifest: OracleProcedureManifest;
  readonly outcome: JsonRecord;
  readonly context: ReturnType<typeof validationContext>;
} {
  const binding = getOracleProcedureBinding(cornerId, taskId);
  const rawInputs = binding.requiredRawInputRoles.map((role, index) => ({
    role,
    path: `raw/${index}-${role}.json`,
    sha256: createHash("sha256").update(`${cornerId}/${taskId}/${role}`).digest("hex"),
    byteLength: 200 + index,
  }));
  const rawInputRootSha256 = sha256Json(rawInputs);
  const resultSha256 = sha256Json(result);
  const dynamicRaw = binding.dynamicEntrypoint === null
    ? null
    : rawInputs.find(({ role }) => role === binding.dynamicEntrypoint?.rawInputRole);
  const outcome: JsonRecord = {
    schemaVersion: "pm.public-eval-corners.bound-oracle-outcome.v1",
    cornerId,
    taskId,
    procedureId: binding.procedureId,
    bindingSha256: binding.bindingSha256,
    rawInputs,
    rawInputRootSha256,
    evaluatorInvocation: {
      schemaVersion: "pm.public-eval-corners.oracle-entrypoint-trace.v1",
      status: "locally-captured-unverified",
      bindingSha256: binding.bindingSha256,
      primary: {
        sourceId: binding.evaluatorSource.sourceId,
        sourcePath: binding.evaluatorSource.path,
        sourceSha256: binding.evaluatorSource.sha256,
        entrypoint: binding.entrypoint,
        invocationCount: 1,
      },
      dynamic: binding.dynamicEntrypoint === null ? null : {
        rawInputRole: binding.dynamicEntrypoint.rawInputRole,
        sourceSha256: dynamicRaw?.sha256,
        entrypoint: binding.dynamicEntrypoint.entrypoint,
        invocationCount: 1,
      },
      rawInputRootSha256,
      resultSha256,
    },
    result,
    resultSha256,
    independentlyVerified: false,
    eligibleForIndependentAnalysis: false,
  };
  return {
    manifest: {
      cornerId,
      tasks: [{ taskId }],
      sources: [binding.evaluatorSource],
    },
    outcome,
    context: validationContext(outcome),
  };
}

describe("exact public-corner oracle procedure binding", () => {
  it("accepts only the registered evaluator source and entrypoint", () => {
    const binding = getOracleProcedureBinding(
      "sentinel-microhub-stars",
      "microhub-stars-relative-passive",
    );
    expect(
      validateOracleProcedureBinding(
        sentinelManifest,
        "microhub-stars-relative-passive",
        binding,
      ),
    ).toMatchObject({
      valid: true,
      eligibleForIndependentAnalysis: false,
      bindingSha256: binding.bindingSha256,
      issues: [],
    });
  });

  it("rejects another pinned manifest source masquerading as the oracle", () => {
    const binding = structuredClone(
      getOracleProcedureBinding(
        "sentinel-microhub-stars",
        "microhub-stars-relative-passive",
      ),
    );
    binding.evaluatorSource = {
      sourceId: "sentinel-eval-harness",
      path: "server/eval_harness.py",
      sha256: "c05a1a8512512d323c4ae039e5f847e87f9d9cf4cad617deb7ed3741b1f575a7",
    };
    const checked = validateOracleProcedureBinding(
      sentinelManifest,
      "microhub-stars-relative-passive",
      binding,
    );
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("not the registered binding");
  });

  it("rejects the right source with the wrong callable", () => {
    const binding = structuredClone(
      getOracleProcedureBinding(
        "sentinel-microhub-stars",
        "microhub-stars-relative-passive",
      ),
    );
    binding.entrypoint = "server.eval_harness:run_scenario";
    const checked = validateOracleProcedureBinding(
      sentinelManifest,
      "microhub-stars-relative-passive",
      binding,
    );
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("not the registered binding");
  });

  it("accepts a strict local derivation but keeps it ineligible", () => {
    const outcome = sentinelOutcome();
    const checked = validateBoundOracleOutcome(
      outcome,
      sentinelManifest,
      validationContext(outcome),
    );
    expect(checked).toMatchObject({
      valid: true,
      eligibleForIndependentAnalysis: false,
      issues: [],
    });
  });

  it.each([
    {
      cornerId: "memoryagentbench-factconsolidation-6k" as const,
      taskId: "factconsolidation_mh_6k",
      result: {
        exact_match: false,
        f1: 0.4,
        rougeL_f1: 0.5,
        rougeL_recall: 0.6,
        rougeLsum_f1: 0.5,
        rougeLsum_recall: 0.6,
        substring_exact_match: true,
      },
    },
    {
      cornerId: "tau2-airline-32" as const,
      taskId: "airline:32",
      result: { reward_info: { reward: 1, db_check: { db_match: true } } },
    },
    {
      cornerId: "appworld-22cc237_2" as const,
      taskId: "22cc237_2",
      result: {
        test_tracker: {
          success: false,
          difficulty: 2,
          num_tests: 2,
          passes: [{ requirement: "first requirement", label: null }],
          failures: [{ requirement: "second requirement", label: "no_op_fail", trace: "assertion" }],
        },
      },
    },
  ])("validates the strict $cornerId outcome schema without promoting it", ({ cornerId, taskId, result }) => {
    const fixture = procedureFixture(cornerId, taskId, result);
    expect(
      validateBoundOracleOutcome(
        fixture.outcome,
        fixture.manifest,
        fixture.context,
      ),
    ).toMatchObject({ valid: true, eligibleForIndependentAnalysis: false, issues: [] });
  });

  it("rejects a constant empty oracle result", () => {
    const outcome = sentinelOutcome();
    const context = validationContext(outcome);
    outcome.result = {};
    outcome.resultSha256 = sha256Json(outcome.result);
    (outcome.evaluatorInvocation as JsonRecord).resultSha256 = outcome.resultSha256;
    const checked = validateBoundOracleOutcome(outcome, sentinelManifest, context);
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("must contain exactly");
  });

  it("rejects bundled evaluator bytes that were not invoked", () => {
    const outcome = sentinelOutcome();
    const context = validationContext(outcome);
    const invocation = outcome.evaluatorInvocation as JsonRecord;
    (invocation.primary as JsonRecord).invocationCount = 0;
    const checked = validateBoundOracleOutcome(outcome, sentinelManifest, context);
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("exactly one evaluator call");
  });

  it("rejects a constant wrapper trace naming the wrong entrypoint", () => {
    const outcome = sentinelOutcome();
    const context = validationContext(outcome);
    const invocation = outcome.evaluatorInvocation as JsonRecord;
    (invocation.primary as JsonRecord).entrypoint = "constant_wrapper:evaluate";
    const checked = validateBoundOracleOutcome(outcome, sentinelManifest, context);
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("wrong entrypoint");
  });

  it("rejects outcome promotion without an independent execution authority", () => {
    const outcome = sentinelOutcome();
    const context = validationContext(outcome);
    outcome.independentlyVerified = true;
    outcome.eligibleForIndependentAnalysis = true;
    const checked = validateBoundOracleOutcome(outcome, sentinelManifest, context);
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("may not claim independent eligibility");
  });

  it("rejects oracle-selected raw state identities", () => {
    const outcome = sentinelOutcome();
    const context = validationContext(outcome);
    const rawInputs = outcome.rawInputs as JsonRecord[];
    rawInputs[2]!.sha256 = "f".repeat(64);
    outcome.rawInputRootSha256 = sha256Json(rawInputs);
    const invocation = outcome.evaluatorInvocation as JsonRecord;
    invocation.rawInputRootSha256 = outcome.rawInputRootSha256;
    const checked = validateBoundOracleOutcome(outcome, sentinelManifest, context);
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("do not match harness-retained bytes");
  });

  it("rejects a valid outcome envelope for a different manifest task", () => {
    const outcome = sentinelOutcome();
    const context = validationContext(outcome);
    outcome.taskId = "microhub-stars-noop";
    const checked = validateBoundOracleOutcome(outcome, sentinelManifest, context);
    expect(checked.valid).toBe(false);
    expect(checked.issues.join(" ")).toContain("harness-selected corner/task");
  });
});

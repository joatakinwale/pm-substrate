import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { publicEvalExpectedArmOrder } from "@pm/public-eval-analysis";
import { afterEach, describe, expect, it } from "vitest";

import type { StateBenchDecisionManifestBridge } from "./decision-manifest.js";
import { createStateBenchExecutionCommandPlanner } from "./execution-command-plan.js";
import type { StateBenchRunConfig } from "./execution-plan.js";
import type {
  StateBenchQualificationArm,
  StateBenchQualificationAttemptCell,
  StateBenchQualificationDomain,
  StateBenchQualificationPlan,
} from "./qualification-plan.js";

const HASH = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const REVISION = "d".repeat(40);
const ARMS = ["native", "sham", "substrate"] as const;
const DOMAINS = [
  "travel",
  "customer_support",
  "shopping_assistant",
] as const;
const tempRoots: string[] = [];

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function checkout(): string {
  const root = mkdtempSync(join(tmpdir(), "state-command-plan-"));
  tempRoots.push(root);
  return root;
}

function qualificationPlan(): StateBenchQualificationPlan {
  return {
    planHash: HASH,
    benchmark: {
      repositoryUrl: "https://github.com/microsoft/STATE-Bench.git",
      revision: REVISION,
    },
  } as unknown as StateBenchQualificationPlan;
}

function runConfig(
  phase: StateBenchRunConfig["phase"],
  arm: StateBenchQualificationArm,
  domain: StateBenchQualificationDomain,
  taskIds: readonly string[],
  repeatLabels: readonly string[],
  attemptScheduleHash: string,
): StateBenchRunConfig {
  const sidecar = arm !== "native";
  return {
    schemaVersion: "pm-state-bench-run-config.v3",
    experimentId: "state-command-fixture",
    phase,
    qualificationPlanHash: phase === "qualification" ? HASH : null,
    analysisManifestHash: phase === "qualification" ? null : HASH_B,
    preregistrationReceiptHash: phase === "qualification" ? null : HASH_C,
    phasePartitionHash: HASH,
    arm,
    armInterventionHash: sha256(`intervention:${arm}`),
    domain,
    agentModel: {
      modelId: phase === "replication" ? "model-replication" : "model-primary",
      modelDigest: phase === "replication" ? HASH_C : HASH_B,
      reasoningLevel: "high",
    },
    agentClass: sidecar ? "PmSubstrateAgent" : "StateBenchAgent",
    split: phase === "qualification" ? "train" : "test",
    numRuns: repeatLabels.length,
    taskIds,
    taskSetHash: sha256(canonical({ domain, phase, taskIds })),
    taskInventoryRootHash: HASH,
    runLabels: repeatLabels,
    repeatScheduleHash: sha256(canonical(repeatLabels)),
    attemptScheduleHash,
    nonModelConfigHash: HASH,
    executionPolicyHash: HASH_B,
    runtimeClosureHash: HASH_C,
    retryPolicy: { maxTaskAttempts: 1, maxProviderAttempts: 1 },
    retrieveLearningsTopK: sidecar ? 3 : null,
    artifactSealHash: sidecar ? HASH_B : null,
    extractionProvenanceHash: sidecar ? HASH_C : null,
  };
}

function qualificationSchedule(
  repeats: readonly string[],
): readonly StateBenchQualificationAttemptCell[] {
  let sequence = 0;
  return DOMAINS.flatMap((domain) =>
    repeats.flatMap((repeatLabel, repeatIndex) => {
      const order = repeatIndex % 2 === 0
        ? ARMS
        : (["substrate", "native", "sham"] as const);
      return order.map((arm, armOrderPosition) => {
        sequence += 1;
        return {
          sequence,
          cellId: `state-command-fixture:qualification:${domain}:task-${domain}:${repeatLabel}:${arm}`,
          domain,
          taskId: `task-${domain}`,
          canonicalTaskHash: sha256(`task:${domain}`),
          repeatIndex,
          repeatLabel,
          arm,
          armOrderPosition,
        };
      });
    }),
  );
}

function fixturePlanner(
  configs: readonly StateBenchRunConfig[],
  schedule: readonly StateBenchQualificationAttemptCell[],
  bridge: StateBenchDecisionManifestBridge | null = null,
) {
  const allowed = new Set(configs.map((config) => canonical(config)));
  return createStateBenchExecutionCommandPlanner({
    sha256,
    canonical,
    parseRunConfig: (value) => value as StateBenchRunConfig,
    verifyBoundRunConfig: (_checkout, _qualification, _bridge, value) =>
      allowed.has(canonical(value))
        ? { valid: true, issues: [] }
        : { valid: false, issues: ["fixture binding mismatch"] },
    loadQualificationPlan: () => qualificationPlan(),
    qualificationAttemptSchedule: () => schedule,
    loadDecisionManifestBridge: () => {
      if (bridge === null) throw new Error("fixture decision bridge is absent");
      return bridge;
    },
    officialRunId: (config, runIndex) =>
      `${config.experimentId}:${config.phase}:${config.arm}:${config.domain}:${config.runLabels[runIndex - 1]}`,
  });
}

function configSet(
  phase: StateBenchRunConfig["phase"],
  taskIds: Readonly<Record<StateBenchQualificationDomain, readonly string[]>>,
  repeats: readonly string[],
  scheduleHash: string,
): readonly StateBenchRunConfig[] {
  return DOMAINS.flatMap((domain) =>
    ARMS.map((arm) =>
      runConfig(phase, arm, domain, taskIds[domain], repeats, scheduleHash),
    ),
  );
}

function decisionBridge(
  phase: "confirmatory" | "replication",
  repeats: readonly string[],
): StateBenchDecisionManifestBridge {
  const taskPlan = DOMAINS.flatMap((domain) =>
    Array.from({ length: 50 }, (_, index) => `task-${String(index + 1).padStart(2, "0")}`).map((taskId, taskIndex) => ({
      taskId: `${phase}:${domain}:${taskId}`,
      canonicalTaskId: `state:${domain}:${taskId}`,
      benchmarkTaskLocator: `${domain}/${taskId}.json`,
      benchmarkTaskContentHash: sha256(`benchmark:${domain}:${taskId}`),
      taskContentHash: sha256(`task:${domain}:${taskId}`),
      variant: "original" as const,
      mutationHash: null,
      phase,
      predeclaredSeeds: repeats,
      selectionDigest: sha256(`selection:${domain}:${taskId}`),
      eligibleUniverseMembershipProof: {
        inventoryIndex: taskIndex,
        inventoryRootHash: HASH,
        benchmarkTaskContentHash: sha256(`benchmark:${domain}:${taskId}`),
      },
      initialEnvironmentSnapshotHash: HASH,
      status: "included" as const,
    })),
  );
  return {
    protocolBinding: {
      split: "test",
      tasksPerDomain: 50,
      upstreamTaskSelection: {
        selectionMode: "exact_verified_test_task_id_per_cell",
        exactTaskOption: "--tasks",
        parserSplitSentinel: ["--split", "all"],
        parserSplitSentinelSemantics:
          "upstream_parser_compatibility_only_not_train_plus_test_dataset_selection",
        directSplitSelection:
          "forbidden_upstream_rejects_tasks_with_split_train_or_test",
        testInventoryAuthority:
          "verified_qualification_plan_test_inventory_exactly_50_tasks_per_domain",
      },
    },
    analysisManifest: {
      manifestHash: HASH_B,
      experimentId: "state-command-fixture",
      execution: {
        randomization: {
          algorithm: "sha256-arm-order-v1",
          seed: "fixture-arm-seed",
        },
      },
      taskPlan,
    },
  } as unknown as StateBenchDecisionManifestBridge;
}

function decisionScheduleHash(
  bridge: StateBenchDecisionManifestBridge,
  phase: "confirmatory" | "replication",
): string {
  const tasks = bridge.analysisManifest.taskPlan
    .filter((task) => task.status === "included" && task.phase === phase)
    .sort((left, right) => left.taskId < right.taskId ? -1 : left.taskId > right.taskId ? 1 : 0);
  const cells = tasks.flatMap((task) =>
    task.predeclaredSeeds.flatMap((repeatLabel, repeatIndex) =>
      publicEvalExpectedArmOrder(
        bridge.analysisManifest,
        task,
        repeatIndex,
      ).map((arm, armOrderPosition) => ({
        taskId: task.taskId,
        repeatIndex,
        repeatLabel,
        arm,
        armOrderPosition,
      })),
    ),
  );
  return sha256(canonical({
    schemaVersion: "pm-state-bench-decision-attempt-schedule.v1",
    phase,
    cells,
  }));
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("STATE-Bench execution command planner", () => {
  it("emits one exact, schedule-ordered upstream argv per qualification cell", () => {
    const repeats = ["repeat-1", "repeat-2"];
    const schedule = qualificationSchedule(repeats);
    const scheduleHash = sha256(canonical({ schedule }));
    const tasks = Object.fromEntries(
      DOMAINS.map((domain) => [domain, [`task-${domain}`]]),
    ) as unknown as Record<StateBenchQualificationDomain, readonly string[]>;
    const configs = configSet("qualification", tasks, repeats, scheduleHash);
    const planner = fixturePlanner(configs, schedule);
    const root = checkout();
    const outputRoot = checkout();
    const plan = planner.createPlan(root, qualificationPlan(), null, {
      runConfigs: [...configs].reverse(),
      outputRoot,
      retrievalUrl: "http://127.0.0.1:4319/retrieve",
    });

    expect(plan.commandCount).toBe(18);
    expect(plan.commands.map((command) => command.cellId)).toEqual(
      schedule.map((cell) => cell.cellId),
    );
    for (const command of plan.commands) {
      const option = (name: string) => command.argv[command.argv.indexOf(name) + 1];
      expect(option("--tasks")).toBe(command.taskId);
      expect(option("--split")).toBe("all");
      expect(option("--num-runs")).toBe("1");
      expect(option("--num-runs-idx-start")).toBe(String(command.repeatIndex + 1));
      expect(option("--num-workers")).toBe("1");
      expect(option("--retry-attempts")).toBe("1");
      expect(command.argv.slice(0, 3)).toEqual(["run", "--frozen", "python"]);
      expect(command.argv).not.toContain(command.expectedSplit);
      expect(command.argv.filter((entry) => entry === command.taskId)).toHaveLength(1);
      expect(command.commandHash).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(
      plan.commands.find((command) => command.arm === "native")!.argv,
    ).not.toContain("--agent-class");
    expect(
      plan.commands.find((command) => command.arm === "native")!.environment,
    ).toEqual({});
    expect(
      plan.commands.find((command) => command.arm === "substrate")!.argv,
    ).toContain("PmSubstrateAgent");
    const substrate = plan.commands.find((command) => command.arm === "substrate")!;
    expect(substrate.environment).toEqual({
      PM_STATE_BENCH_EXPERIMENT_ID: "state-command-fixture",
      PM_STATE_BENCH_CONFIG_SHA256: substrate.runConfigHash,
      PM_STATE_BENCH_RUN_ID: substrate.runId,
      PM_STATE_BENCH_MODEL_ID: "model-primary",
      PM_STATE_BENCH_RETRIEVAL_URL: "http://127.0.0.1:4319/retrieve",
    });
    expect(substrate.runId).toBe(
      `state-command-fixture:qualification:substrate:${substrate.domain}:${substrate.repeatLabel}`,
    );
    expect(substrate.environmentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(plan.optionContract.incompatibility).toBe(
      "upstream_rejects_tasks_with_split_train_or_test",
    );
    expect(plan.optionContract.providerRetryCaveat).toContain("provider_clients_may_retry");
  });

  it("derives a decision plan from the exact manifest arm order and bound schedule hash", () => {
    const phase = "confirmatory" as const;
    const repeats = [
      "run-index-1",
      "run-index-2",
      "run-index-3",
      "run-index-4",
      "run-index-5",
    ];
    const bridge = decisionBridge(phase, repeats);
    const scheduleHash = decisionScheduleHash(bridge, phase);
    const decisionTaskIds = Array.from(
      { length: 50 },
      (_, index) => `task-${String(index + 1).padStart(2, "0")}`,
    );
    const tasks = Object.fromEntries(
      DOMAINS.map((domain) => [domain, decisionTaskIds]),
    ) as unknown as Record<StateBenchQualificationDomain, readonly string[]>;
    const configs = configSet(phase, tasks, repeats, scheduleHash);
    const planner = fixturePlanner(configs, [], bridge);
    const plan = planner.createPlan(checkout(), qualificationPlan(), bridge, {
      runConfigs: configs,
      outputRoot: checkout(),
      retrievalUrl: "http://127.0.0.1:4319/retrieve",
    });

    expect(plan.commandCount).toBe(2250);
    expect(plan.attemptScheduleHash).toBe(scheduleHash);
    expect(plan.phase).toBe("confirmatory");
    expect(plan.commands.every((command) => command.expectedSplit === "test")).toBe(true);
    expect(plan.commands.every((command) => command.argv.includes("--tasks"))).toBe(true);
    expect(plan.commands.every((command) => command.argv.includes("all"))).toBe(true);
    expect(new Set(plan.commands.map((command) => command.cellId)).size).toBe(2250);

    const mixedReceipt = configs.map((config, index) =>
      index === 0
        ? { ...config, preregistrationReceiptHash: HASH }
        : config,
    );
    expect(() =>
      fixturePlanner(mixedReceipt, [], bridge).createPlan(
        checkout(),
        qualificationPlan(),
        bridge,
        {
          runConfigs: mixedReceipt,
          outputRoot: checkout(),
          retrievalUrl: "http://127.0.0.1:4319/retrieve",
        },
      ),
    ).toThrow("mixes phase partition, manifest, preregistration, model, policy, schedule, or runtime bindings");
  });

  it("refuses decision bridges that claim direct split selection or alter the parser sentinel", () => {
    const phase = "confirmatory" as const;
    const repeats = [
      "run-index-1",
      "run-index-2",
      "run-index-3",
      "run-index-4",
      "run-index-5",
    ];
    const baseline = decisionBridge(phase, repeats);
    const scheduleHash = decisionScheduleHash(baseline, phase);
    const decisionTaskIds = Array.from(
      { length: 50 },
      (_, index) => `task-${String(index + 1).padStart(2, "0")}`,
    );
    const tasks = Object.fromEntries(
      DOMAINS.map((domain) => [domain, decisionTaskIds]),
    ) as unknown as Record<StateBenchQualificationDomain, readonly string[]>;
    const configs = configSet(phase, tasks, repeats, scheduleHash);
    const input = {
      runConfigs: configs,
      outputRoot: checkout(),
      retrievalUrl: "http://127.0.0.1:4319/retrieve",
    };

    const directSplit = structuredClone(baseline) as unknown as {
      protocolBinding: { upstreamTaskSelection: { selectionMode: string } };
    };
    directSplit.protocolBinding.upstreamTaskSelection.selectionMode = "direct_split_test";
    expect(() =>
      fixturePlanner(
        configs,
        [],
        directSplit as unknown as StateBenchDecisionManifestBridge,
      ).createPlan(checkout(), qualificationPlan(), directSplit, input),
    ).toThrow("must bind exact verified test task IDs per cell");

    const changedSentinel = structuredClone(baseline) as unknown as {
      protocolBinding: { upstreamTaskSelection: { parserSplitSentinel: string[] } };
    };
    changedSentinel.protocolBinding.upstreamTaskSelection.parserSplitSentinel = [
      "--split",
      "test",
    ];
    expect(() =>
      fixturePlanner(
        configs,
        [],
        changedSentinel as unknown as StateBenchDecisionManifestBridge,
      ).createPlan(checkout(), qualificationPlan(), changedSentinel, input),
    ).toThrow("must bind exact verified test task IDs per cell");
  });

  it("is deterministic across config input order and reopens only the exact receipt", () => {
    const repeats = ["repeat-1"];
    const schedule = qualificationSchedule(repeats);
    const scheduleHash = sha256(canonical({ schedule }));
    const tasks = Object.fromEntries(
      DOMAINS.map((domain) => [domain, [`task-${domain}`]]),
    ) as unknown as Record<StateBenchQualificationDomain, readonly string[]>;
    const configs = configSet("qualification", tasks, repeats, scheduleHash);
    const planner = fixturePlanner(configs, schedule);
    const root = checkout();
    const input = {
      runConfigs: configs,
      outputRoot: checkout(),
      retrievalUrl: "http://127.0.0.1:4319/retrieve",
    };
    const plan = planner.createPlan(root, qualificationPlan(), null, input);
    const reversed = planner.createPlan(root, qualificationPlan(), null, {
      ...input,
      runConfigs: [...configs].reverse(),
    });

    expect(reversed).toEqual(plan);
    expect(
      planner.verifyPlan(root, qualificationPlan(), null, input, plan),
    ).toEqual({ valid: true, issues: [] });
    const edited = structuredClone(plan) as unknown as Record<string, unknown>;
    edited["commandRootHash"] = HASH_C;
    expect(
      planner.verifyPlan(root, qualificationPlan(), null, input, edited),
    ).toEqual({
      valid: false,
      issues: [
        "execution command plan is incomplete, stale, or not derived from the bound configs",
      ],
    });
  });

  it("rejects unverified, incomplete, and schedule-divergent config sets", () => {
    const repeats = ["repeat-1"];
    const schedule = qualificationSchedule(repeats);
    const scheduleHash = sha256(canonical({ schedule }));
    const tasks = Object.fromEntries(
      DOMAINS.map((domain) => [domain, [`task-${domain}`]]),
    ) as unknown as Record<StateBenchQualificationDomain, readonly string[]>;
    const configs = configSet("qualification", tasks, repeats, scheduleHash);
    const planner = fixturePlanner(configs, schedule);
    const root = checkout();
    const tampered = structuredClone(configs) as StateBenchRunConfig[];
    tampered[0] = { ...tampered[0]!, armInterventionHash: HASH_C };
    expect(() =>
      planner.createPlan(root, qualificationPlan(), null, {
        runConfigs: tampered,
        outputRoot: checkout(),
        retrievalUrl: "http://127.0.0.1:4319/retrieve",
      }),
    ).toThrow("is not a verified bound config");
    expect(() =>
      planner.createPlan(root, qualificationPlan(), null, {
        runConfigs: configs.slice(1),
        outputRoot: checkout(),
        retrievalUrl: "http://127.0.0.1:4319/retrieve",
      }),
    ).toThrow("exactly one bound run config for every domain/arm coordinate");

    const divergent = qualificationSchedule(repeats).map((cell, index) =>
      index === 0 ? { ...cell, taskId: "not-bound" } : cell,
    );
    expect(() =>
      fixturePlanner(configs, divergent).createPlan(
        root,
        qualificationPlan(),
        null,
        {
          runConfigs: configs,
          outputRoot: checkout(),
          retrievalUrl: "http://127.0.0.1:4319/retrieve",
        },
      ),
    ).toThrow("cell task is absent from its bound config");
  });

  it("rejects ambient paths, remote sidecars, and mixed set-level evidence bindings", () => {
    const repeats = ["repeat-1"];
    const schedule = qualificationSchedule(repeats);
    const scheduleHash = sha256(canonical({ schedule }));
    const tasks = Object.fromEntries(
      DOMAINS.map((domain) => [domain, [`task-${domain}`]]),
    ) as unknown as Record<StateBenchQualificationDomain, readonly string[]>;
    const configs = [...configSet("qualification", tasks, repeats, scheduleHash)];
    const planner = fixturePlanner(configs, schedule);
    const root = checkout();
    expect(() =>
      planner.createPlan(root, qualificationPlan(), null, {
        runConfigs: configs,
        outputRoot: "relative-output",
        retrievalUrl: "http://127.0.0.1:4319/retrieve",
      }),
    ).toThrow("outputRoot must be an absolute path");
    expect(() =>
      planner.createPlan(root, qualificationPlan(), null, {
        runConfigs: configs,
        outputRoot: join(root, "outputs"),
        retrievalUrl: "http://127.0.0.1:4319/retrieve",
      }),
    ).toThrow("outputRoot must be outside the verified upstream checkout");
    expect(() =>
      planner.createPlan(root, qualificationPlan(), null, {
        runConfigs: configs,
        outputRoot: checkout(),
        retrievalUrl: "https://example.com/retrieve",
      }),
    ).toThrow("retrievalUrl must be http://127.0.0.1");

    const mixed = configs.map((config, index) =>
      index === 2 ? { ...config, artifactSealHash: HASH } : config,
    );
    expect(() =>
      fixturePlanner(mixed, schedule).createPlan(
        root,
        qualificationPlan(),
        null,
        {
          runConfigs: mixed,
          outputRoot: checkout(),
          retrievalUrl: "http://127.0.0.1:4319/retrieve",
        },
      ),
    ).toThrow("mixes sidecar artifact/extraction bindings");
  });
});

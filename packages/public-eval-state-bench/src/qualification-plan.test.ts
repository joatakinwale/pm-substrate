import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { stateBenchLearningAdapter } from "./index.js";
import {
  createStateBenchQualificationPlanning,
  type StateBenchQualificationDomain,
  type StateBenchQualificationPlanInput,
} from "./qualification-plan.js";

const PINNED_CHECKOUT = process.env["PM_STATE_BENCH_CHECKOUT"];
const integrationIt = PINNED_CHECKOUT === undefined ? it.skip : it;

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("undefined is not canonical JSON");
  return encoded;
}

const planning = createStateBenchQualificationPlanning({
  manifest: {
    upstreamUrl: stateBenchLearningAdapter.manifest.upstreamUrl,
    upstreamRevision: stateBenchLearningAdapter.manifest.upstreamRevision,
    packageVersion: stateBenchLearningAdapter.manifest.packageVersion,
    officialProtocolId: stateBenchLearningAdapter.manifest.officialProtocolId,
    protocolFileSha256: stateBenchLearningAdapter.manifest.protocolFileSha256,
    splitVersion: stateBenchLearningAdapter.manifest.splitVersion,
  },
  domains: stateBenchLearningAdapter.manifest.domains,
  assertVerifiedCheckout(path: string): string {
    const root = resolve(path);
    const result = stateBenchLearningAdapter.verifyCheckout(root);
    if (!result.valid) throw new Error(result.issues.join("; "));
    return root;
  },
  loadSplitManifest(root: string, domain: StateBenchQualificationDomain) {
    const value = JSON.parse(
      readFileSync(
        join(root, "state_bench", "domains", domain, "splits", "train_test.json"),
        "utf8",
      ),
    ) as { splits: { train: string[]; test: string[] } };
    return {
      train: [...value.splits.train].sort(),
      test: [...value.splits.test].sort(),
    };
  },
  sha256,
  canonical,
});

function digest(label: string): string {
  return sha256(label);
}

function input(): StateBenchQualificationPlanInput {
  const sharedShape = digest("equal-sidecar-shape");
  return {
    planId: "state_bench_qualification_001",
    experimentId: "state_bench_public_proof_001",
    producerIdentity: "joat_labs",
    frozenAt: "2026-07-14T01:00:00.000Z",
    selectionSeed: "state-bench-train-partition-001",
    qualificationTasksPerDomain: 20,
    execution: {
      agentModel: {
        modelId: "qualification-agent-model",
        modelDigest: digest("qualification-agent-model-resolved"),
        reasoningLevel: "high",
      },
      components: {
        systemPromptHash: digest("system"),
        toolsHash: digest("tools"),
        simulatorHash: digest("simulator"),
        judgeHash: digest("judge"),
        decodingHash: digest("decoding"),
        runnerHash: digest("runner"),
        adapterHash: digest("adapter"),
      },
      arms: {
        native: {
          interventionHash: digest("native-intervention"),
          implementationRevision: digest("native-revision"),
          sidecarShapeHash: digest("native-no-sidecar"),
          expectedToolCalls: 0,
          expectedPromptTokens: 0,
          expectedAddedLatencyMs: 0,
        },
        sham: {
          interventionHash: digest("sham-intervention"),
          implementationRevision: digest("sham-revision"),
          sidecarShapeHash: sharedShape,
          expectedToolCalls: 1,
          expectedPromptTokens: 200,
          expectedAddedLatencyMs: 10,
        },
        substrate: {
          interventionHash: digest("substrate-intervention"),
          implementationRevision: digest("substrate-revision"),
          sidecarShapeHash: sharedShape,
          expectedToolCalls: 1,
          expectedPromptTokens: 200,
          expectedAddedLatencyMs: 10,
        },
      },
      repeatLabels: ["repeat-1"],
      armRandomizationSeed: "qualification-arm-order-001",
      policy: {
        maxTaskAttemptsPerCell: 1,
        maxProviderAttemptsPerCall: 1,
        failedCellsCountAsStrictFailure: true,
        replacementAttempts: "forbidden",
        stoppingRule: "complete_fixed_schedule_or_invalidate",
        outcomeInspection: "after_phase_complete",
        workers: 1,
        maximumTotalCostUsd: 1_000,
        maximumWallClockMs: 86_400_000,
      },
    },
  };
}

describe("STATE-Bench train-only qualification planning", () => {
  integrationIt("partitions train into disjoint 20-task qualification and 80-task extraction sets", () => {
    const plan = planning.createQualificationPlan(PINNED_CHECKOUT!, input());
    expect(plan.authorityStatus).toBe("ineligible_for_efficacy_or_decision");
    expect(plan.execution.plannedTaskClusters).toBe(60);
    expect(plan.execution.plannedAttemptCells).toBe(180);
    for (const domain of stateBenchLearningAdapter.manifest.domains) {
      const entry = plan.domains[domain];
      expect(entry.trainInventory.tasks).toHaveLength(100);
      expect(entry.testInventory.tasks).toHaveLength(50);
      expect(entry.qualification.taskIds).toHaveLength(20);
      expect(entry.extraction.taskIds).toHaveLength(80);
      expect(
        entry.qualification.taskIds.filter((taskId) => entry.extraction.taskIds.includes(taskId)),
      ).toEqual([]);
      expect(
        entry.qualification.taskIds.filter((taskId) =>
          entry.testInventory.tasks.some((task) => task.taskId === taskId),
        ),
      ).toEqual([]);
    }
    expect(planning.verifyQualificationPlan(PINNED_CHECKOUT!, plan)).toEqual({
      valid: true,
      issues: [],
    });
    const schedule = planning.qualificationAttemptSchedule(PINNED_CHECKOUT!, plan);
    expect(schedule).toHaveLength(180);
    expect(new Set(schedule.map((cell) => cell.cellId)).size).toBe(180);
  });

  integrationIt("rejects post-hoc task substitution and selective schedule edits", () => {
    const plan = planning.createQualificationPlan(PINNED_CHECKOUT!, input());
    const substituted = structuredClone(plan);
    substituted.domains.travel.qualification.taskIds[0] =
      substituted.domains.travel.testInventory.tasks[0]!.taskId;
    expect(
      planning.verifyQualificationPlan(PINNED_CHECKOUT!, substituted).issues.join(" "),
    ).toMatch(/does not recompute/u);

    const scheduleEdited = structuredClone(plan);
    scheduleEdited.execution.attemptScheduleHash = digest("caller-selected-order");
    expect(
      planning.verifyQualificationPlan(PINNED_CHECKOUT!, scheduleEdited).issues.join(" "),
    ).toMatch(/does not recompute/u);
  });

  integrationIt("forbids qualification or test trajectories in the learning artifact", () => {
    const plan = planning.createQualificationPlan(PINNED_CHECKOUT!, input());
    const domain = "travel" as const;
    const allowed = plan.domains[domain].extraction.taskIds[0]!;
    expect(() =>
      planning.assertQualificationArtifactSources(PINNED_CHECKOUT!, plan, {
        entries: [
          {
            domain,
            sourceTrajectories: [
              `datasets/train_task_trajectories/${domain}/${allowed}.json`,
            ],
          },
        ],
      }),
    ).not.toThrow();
    const reserved = plan.domains[domain].qualification.taskIds[0]!;
    expect(() =>
      planning.assertQualificationArtifactSources(PINNED_CHECKOUT!, plan, {
        entries: [
          {
            domain,
            sourceTrajectories: [
              `datasets/train_task_trajectories/${domain}/${reserved}.json`,
            ],
          },
        ],
      }),
    ).toThrow(/reserved qualification or held-out source/u);
  });

  it("rejects hidden retry, replacement, and unequal sham treatment policies before checkout access", () => {
    const retries = input() as unknown as Record<string, unknown>;
    const execution = retries["execution"] as Record<string, unknown>;
    const policy = execution["policy"] as Record<string, unknown>;
    policy["maxTaskAttemptsPerCell"] = 3;
    expect(() => planning.createQualificationPlan("/not-used", retries as never)).toThrow(
      /hidden retries/u,
    );

    const unequal = input();
    const mutated = structuredClone(unequal);
    mutated.execution.arms.sham.expectedAddedLatencyMs = 11;
    expect(() => planning.createQualificationPlan("/not-used", mutated)).toThrow(
      /sham\/substrate expectedAddedLatencyMs must match/u,
    );
  });
});

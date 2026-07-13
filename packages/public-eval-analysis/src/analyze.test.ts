import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { analyzePublicEval } from "./analyze.js";
import {
  PUBLIC_EVAL_ARMS,
  createPublicEvalAnalysisManifest,
  createPublicEvalAttemptArtifact,
  hashPublicEvalJson,
  publicEvalArmBindingHash,
  publicEvalExecutionBindingHash,
  publicEvalExpectedArmOrder,
  publicEvalSelectionDigest,
  type PublicEvalAnalysisManifest,
  type PublicEvalAnalysisManifestInput,
  type PublicEvalArm,
  type PublicEvalAttemptArtifact,
  type PublicEvalAttemptArtifactInput,
  type PublicEvalAttemptOutcome,
  type PublicEvalTaskPlanEntry,
} from "./schema.js";

const FROZEN_AT = "2026-07-13T12:00:00.000Z";
const COMPLETED_AT = "2026-07-13T13:00:00.000Z";

describe("public eval analysis", () => {
  it("keeps qualification, confirmatory, and replication evidence separate", () => {
    const manifest = manifestFixture([
      included("qualification-probe", "qualification", 2),
      ...includedPhase("confirm", "confirmatory", 20, 3),
      ...includedPhase("replicate", "replication", 20, 3, "confirm"),
    ], {
      minimumStrictCompletionLift: 0.5,
      minimumReliableTaskSuccessRate: 1,
      requirePositiveCiLowerBound: true,
      maximumCostUsdPerStrictSuccess: 10,
      maximumLatencyMsPerStrictSuccess: 1_000,
      maximumCostPerStrictSuccessRatio: 1.25,
      maximumLatencyPerStrictSuccessRatio: 1.25,
    });
    const attempts = attemptsFor(manifest, ({ task, arm }) => {
      if (task.phase === "qualification") {
        return outcome(arm !== "substrate");
      }
      const taskIndex = Number(task.taskId.split("-").at(-1));
      return outcome(arm === "substrate" || taskIndex < 10);
    });

    const first = analyze(manifest, attempts);
    const second = analyze(manifest, attempts);

    expect(first.phases.qualification?.decision).toEqual({
      eligible: false,
      status: "not_eligible",
      reasons: [
        "qualification evidence is exploratory and cannot decide confirmation",
      ],
    });
    expect(first.phases.confirmatory?.decision.status).toBe("passed");
    expect(first.phases.replication?.decision.status).toBe("passed");
    expect(first.confirmatoryPassed).toBe(true);
    expect(first.replicationPassed).toBe(true);
    expect(first.pairedAnalysisCriteriaPassed).toBe(true);
    expect(first.evidenceSeparation).toEqual({
      qualificationUsedForConfirmatoryDecision: false,
      confirmatoryUsedForReplicationDecision: false,
    });
    expect(first.phases.confirmatory?.primary.pairedBootstrap).toEqual(
      second.phases.confirmatory?.primary.pairedBootstrap,
    );
  });

  it("clusters bootstrap and primary lift by task, not repeated attempts", () => {
    const manifest = manifestFixture([
      included("many-repeats", "confirmatory", 20),
      included("one-repeat", "confirmatory", 1),
    ]);
    const attempts = attemptsFor(manifest, ({ task, arm }) => {
      const substrateSuccess = task.taskId === "many-repeats";
      return outcome(arm === "substrate" ? substrateSuccess : !substrateSuccess);
    });

    const report = analyze(manifest, attempts).phases.confirmatory!;

    expect(report.arms.substrate.rawAttemptSuccessRate).toBe(20 / 21);
    expect(report.arms.substrate.taskClusteredStrictCompletionRate).toBe(0.5);
    expect(report.arms.sham.rawAttemptSuccessRate).toBe(1 / 21);
    expect(report.arms.sham.taskClusteredStrictCompletionRate).toBe(0.5);
    expect(report.primary.lift).toBe(0);
    expect(report.primary.pairedBootstrap).toMatchObject({
      unit: "task",
      clusterCount: 2,
    });
  });

  it("chooses sham when it is the stronger control", () => {
    const manifest = manifestFixture([
      included("control-choice", "confirmatory", 2),
    ]);
    const attempts = attemptsFor(manifest, ({ repeatIndex, arm }) =>
      outcome(
        arm === "substrate" || (arm === "sham" && repeatIndex === 0),
      ),
    );

    const report = analyze(manifest, attempts).phases.confirmatory!;

    expect(report.arms.native.taskClusteredStrictCompletionRate).toBe(0);
    expect(report.arms.sham.taskClusteredStrictCompletionRate).toBe(0.5);
    expect(report.strongerControl).toBe("sham");
    expect(report.primary.strongerControlRate).toBe(0.5);
    expect(report.primary.lift).toBe(0.5);
  });

  it("does not turn block counts into success and reports null unit costs at zero success", () => {
    const manifest = manifestFixture([
      included("block-all", "confirmatory", 3),
    ]);
    const attempts = attemptsFor(manifest, ({ arm }) =>
      arm === "substrate"
        ? outcome(false, {
            blockedActionCount: 50,
            falseBlockedActionCount: 1,
            costUsd: 7,
            latencyMs: 900,
          })
        : outcome(true),
    );

    const report = analyze(manifest, attempts).phases.confirmatory!;
    const substrate = report.arms.substrate;

    expect(substrate.strictSuccesses).toBe(0);
    expect(substrate.blockedActionCount).toBe(150);
    expect(substrate.taskClusteredStrictCompletionRate).toBe(0);
    expect(substrate.costUsdPerStrictSuccess).toBeNull();
    expect(substrate.latencyMsPerStrictSuccess).toBeNull();
    expect(substrate.guardrailsPassed).toBe(false);
    expect(report.decision.status).toBe("failed");
  });

  it("fails an allow-all degeneration through collateral-write guardrails", () => {
    const manifest = manifestFixture(
      [included("allow-all", "confirmatory", 2)],
      {
        minimumStrictCompletionLift: 0.1,
        minimumReliableTaskSuccessRate: 0.5,
        requirePositiveCiLowerBound: true,
        maximumCostUsdPerStrictSuccess: 10,
        maximumLatencyMsPerStrictSuccess: 1_000,
        maximumCostPerStrictSuccessRatio: 1.25,
        maximumLatencyPerStrictSuccessRatio: 1.25,
      },
    );
    const attempts = attemptsFor(manifest, ({ arm }) =>
      arm === "substrate"
        ? outcome(false, { collateralWriteCount: 1 })
        : outcome(false),
    );

    const report = analyze(manifest, attempts).phases.confirmatory!;

    expect(report.primary.lift).toBe(0);
    expect(report.arms.substrate.collateralWriteCount).toBe(2);
    expect(report.arms.substrate.guardrailsPassed).toBe(false);
    expect(report.decision).toMatchObject({
      status: "failed",
      reasons: expect.arrayContaining([
        "substrate false-block or collateral-write guardrail failed",
      ]),
    });
  });

  it("requires all predeclared repeats for reliable task success", () => {
    const manifest = manifestFixture([
      included("reliable", "confirmatory", 3),
      included("flaky", "confirmatory", 3),
    ]);
    const attempts = attemptsFor(manifest, ({ task, repeatIndex, arm }) =>
      outcome(
        arm === "substrate" &&
          (task.taskId === "reliable" || repeatIndex < 2),
      ),
    );

    const metrics = analyze(manifest, attempts).phases.confirmatory!.arms.substrate;

    expect(metrics.strictSuccesses).toBe(5);
    expect(metrics.reliableTasks).toBe(1);
    expect(metrics.reliableTaskSuccessRate).toBe(0.5);
    expect(metrics.allPredeclaredRepeatsSucceeded).toBe(false);
  });

  it("fails a substrate whose cost or latency per strict success exceeds frozen ceilings", () => {
    const manifest = manifestFixture(
      [included("expensive", "confirmatory", 2)],
      {
        minimumStrictCompletionLift: 0.1,
        minimumReliableTaskSuccessRate: 1,
        requirePositiveCiLowerBound: true,
        maximumCostUsdPerStrictSuccess: 2,
        maximumLatencyMsPerStrictSuccess: 200,
        maximumCostPerStrictSuccessRatio: 1.25,
        maximumLatencyPerStrictSuccessRatio: 1.25,
      },
    );
    const attempts = attemptsFor(manifest, ({ arm }) =>
      outcome(true, {
        costUsd: arm === "substrate" ? 3 : 1,
        latencyMs: arm === "substrate" ? 300 : 100,
      }),
    );

    const report = analyze(manifest, attempts).phases.confirmatory!;

    expect(report.unitEconomics).toMatchObject({
      costPerStrictSuccessRatio: 3,
      latencyPerStrictSuccessRatio: 3,
      relativeComparisonAvailable: true,
    });
    expect(report.decision.status).toBe("failed");
    expect(report.decision.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cost per strict success"),
        expect.stringContaining("latency per strict success"),
      ]),
    );
  });

  it("rejects duplicate arms, missing arms, and mismatched pairing identity", () => {
    const manifest = manifestFixture([
      included("pairing", "confirmatory", 1),
    ]);
    const attempts = attemptsFor(manifest, () => outcome(true));

    expect(() => analyze(manifest, [...attempts, attempts[0]!])).toThrow(
      /duplicate attemptId/,
    );
    expect(() => analyze(manifest, attempts.slice(0, 2))).toThrow(
      /requires exactly native\/sham\/substrate/,
    );

    const substrateIndex = attempts.findIndex(
      (attempt) => attempt.arm === "substrate",
    );
    const mismatched = [...attempts];
    mismatched[substrateIndex] = reissue(attempts[substrateIndex]!, {
      executionBindingHash: digest("different-execution-binding"),
    });
    expect(() => analyze(manifest, mismatched)).toThrow(
      /arm or execution binding mismatch/,
    );

    const mismatchedGroup = [...attempts];
    mismatchedGroup[substrateIndex] = reissue(attempts[substrateIndex]!, {
      attemptGroupId: "group_wrong",
    });
    expect(() => analyze(manifest, mismatchedGroup)).toThrow(
      /attemptGroupId mismatch/,
    );

    const wrongModel = [...attempts];
    wrongModel[substrateIndex] = reissue(attempts[substrateIndex]!, {
      modelId: "post-hoc-model-substitution",
    });
    expect(() => analyze(manifest, wrongModel)).toThrow(
      /model does not match frozen phase model/,
    );

    const wrongSeed = [...attempts];
    wrongSeed[substrateIndex] = reissue(attempts[substrateIndex]!, {
      seed: "post-hoc-seed",
    });
    expect(() => analyze(manifest, wrongSeed)).toThrow(
      /seed does not match frozen schedule/,
    );

    const wrongDigest = [...attempts];
    wrongDigest[substrateIndex] = reissue(attempts[substrateIndex]!, {
      modelDigest: digest("different-model-binary"),
    });
    expect(() => analyze(manifest, wrongDigest)).toThrow(
      /model\/config digest does not match frozen phase/,
    );
  });

  it("requires replication to use a model distinct from confirmation", () => {
    const valid = manifestFixture([
      included("confirm", "confirmatory", 1),
      included("replicate", "replication", 1, "confirm"),
    ]);
    const { schemaVersion: _schema, manifestHash: _hash, ...input } = valid;

    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        execution: {
          ...input.execution,
          modelIds: {
            ...input.execution.modelIds,
            replication: input.execution.modelIds.confirmatory,
          },
        },
      }),
    ).toThrow(/replication model id and digest distinct/);
  });

  it("cannot promote a one-task one-seed pilot into confirmation or replication", () => {
    const manifest = manifestFixture([
      included("tiny-confirm", "confirmatory", 1),
      included("tiny-replication", "replication", 1, "tiny-confirm"),
    ]);
    const attempts = attemptsFor(manifest, ({ arm }) =>
      outcome(arm === "substrate"),
    );

    const report = analyze(manifest, attempts);

    expect(report.confirmatoryPassed).toBe(false);
    expect(report.replicationPassed).toBe(false);
    expect(report.pairedAnalysisCriteriaPassed).toBe(false);
    expect(report.phases.confirmatory?.decision.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("minimum is 20"),
        expect.stringContaining("minimum is 3"),
      ]),
    );
  });

  it("cannot disguise one canonical task as twenty independent task IDs", () => {
    const aliased = Array.from({ length: 20 }, (_, index) =>
      included(`alias-${index}`, "confirmatory", 3, "same-canonical-task"),
    );

    expect(() => manifestFixture(aliased)).toThrow(
      /duplicate canonical task identities/,
    );
  });

  it("rejects a manifest that weakens the fixed public decision policy", () => {
    const valid = manifestFixture([included("probe", "qualification", 1)]);
    const { schemaVersion: _schema, manifestHash: _hash, ...input } = valid;

    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        successCriteria: {
          ...input.successCriteria,
          minimumStrictCompletionLift: 0,
        },
      }),
    ).toThrow(/minimumStrictCompletionLift must be in \[0.1, 1\]/);
    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        successCriteria: {
          ...input.successCriteria,
          maximumCostPerStrictSuccessRatio: 2,
        },
      }),
    ).toThrow(/maximumCostPerStrictSuccessRatio must be <= 1.25/);
    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        successCriteria: {
          ...input.successCriteria,
          maximumLatencyPerStrictSuccessRatio: 2,
        },
      }),
    ).toThrow(/maximumLatencyPerStrictSuccessRatio must be <= 1.25/);
    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        benchmark: { ...input.benchmark, revision: "main" },
      }),
    ).toThrow(/must be a 40- or 64-character lowercase content revision/);
    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        benchmark: {
          ...input.benchmark,
          repositoryUrl: "http://example.com/mutable.git",
        },
      }),
    ).toThrow(/credential-free HTTPS URL/);
    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        execution: {
          ...input.execution,
          nonModelConfigHashes: {
            ...input.execution.nonModelConfigHashes,
            qualification: digest("opaque-config-claim"),
          },
        },
      }),
    ).toThrow(/does not match its component hashes/);
  });

  it("rejects an attempt-group identity reused across task cells", () => {
    const manifest = manifestFixture([
      included("first-cell", "confirmatory", 1),
      included("second-cell", "confirmatory", 1),
    ]);
    const attempts = [...attemptsFor(manifest, () => outcome(true))];
    const firstGroup = attempts[0]!.attemptGroupId;
    for (let index = 3; index < 6; index += 1) {
      attempts[index] = reissue(attempts[index]!, {
        attemptGroupId: firstGroup,
      });
    }

    expect(() => analyze(manifest, attempts)).toThrow(
      /attemptGroupId .* is reused across/,
    );
  });

  it("refuses post-result exclusion and manifest replacement", () => {
    const original = manifestFixture([
      included("keep", "confirmatory", 1),
      included("drop-after-seeing-result", "confirmatory", 1),
    ]);
    const originalAttempts = attemptsFor(original, () => outcome(true));
    const revised = manifestFixture([
      included("keep", "confirmatory", 1),
      {
        ...included(
          "drop-after-seeing-result",
          "confirmatory",
          1,
        ),
        status: "excluded_pre_run",
        exclusionReason: "claimed after outcome",
      },
    ]);

    expect(() => analyze(revised, originalAttempts)).toThrow(
      /post-result manifest edits and exclusions are refused/,
    );

    const excludedArtifact = artifactFor(
      revised,
      revised.taskPlan[1]!,
      0,
      "native",
      outcome(true),
    );
    const keepAttempts = attemptsFor(revised, () => outcome(true));
    expect(() => analyze(revised, [...keepAttempts, excludedArtifact])).toThrow(
      /post-result exclusion refusal/,
    );
  });

  it("uses benchmark content identity instead of caller aliases", () => {
    const source = included("source", "confirmatory", 3, "source-content");
    const aliases = Array.from({ length: 20 }, (_, index) => ({
      ...included(`alias-${index}`, "confirmatory", 3, `label-${index}`),
      benchmarkTaskContentHash: source.benchmarkTaskContentHash,
      taskContentHash: source.taskContentHash,
    }));

    expect(() => manifestFixture(aliases)).toThrow(
      /duplicate canonical task identities/,
    );
  });

  it("rejects valid eligible members when they are not the deterministic top-ranked subset", () => {
    const valid = manifestFixture([
      included("selected-by-caller", "confirmatory", 1),
    ]);
    const { schemaVersion: _schema, manifestHash: _hash, ...input } = valid;
    const includedHash = valid.taskPlan[0]!.benchmarkTaskContentHash;
    const higherRankedHash = digest("eligible-but-not-selected");
    const universe = [includedHash, higherRankedHash].sort();
    const selectionSeed = selectionSeedFor(
      universe,
      [higherRankedHash],
      "adversarial-selection",
    );
    const rootHash = hashPublicEvalJson({
      schemaVersion: "pm.public-eval.eligible-universe.v1",
      taskContentHashes: universe,
    });
    const taskPlan = input.taskPlan.map((task) => ({
      ...task,
      selectionDigest: publicEvalSelectionDigest(
        selectionSeed,
        task.benchmarkTaskContentHash,
      ),
      eligibleUniverseMembershipProof: {
        inventoryIndex: universe.indexOf(task.benchmarkTaskContentHash),
        inventoryRootHash: rootHash,
        benchmarkTaskContentHash: task.benchmarkTaskContentHash,
      },
    }));

    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        benchmark: {
          ...input.benchmark,
          eligibleUniverse: {
            rootHash,
            taskContentHashes: universe,
            selectionAlgorithm: "sha256-rank-v1",
            selectionSeed,
            selectionCount: 1,
          },
        },
        taskPlan,
      }),
    ).toThrow(/deterministic top-ranked 1 eligible-universe tasks/);
  });

  it("freezes zero deterministic guardrails and minimum public reliability", () => {
    const valid = manifestFixture([included("policy", "qualification", 1)]);
    const { schemaVersion: _schema, manifestHash: _hash, ...input } = valid;

    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        guardrails: { ...input.guardrails, maxCollateralWritesPerAttempt: 1 },
      }),
    ).toThrow(/requires zero false blocks and collateral writes/);
    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        successCriteria: {
          ...input.successCriteria,
          minimumReliableTaskSuccessRate: 0,
        },
      }),
    ).toThrow(/minimumReliableTaskSuccessRate must be in \[0.5, 1\]/);
    expect(() =>
      createPublicEvalAnalysisManifest({
        ...input,
        successCriteria: {
          ...input.successCriteria,
          maximumCostUsdPerStrictSuccess: 11,
        },
      }),
    ).toThrow(/maximumCostUsdPerStrictSuccess must be <= 10/);
  });

  it("reselects the maximum control inside every task bootstrap draw", () => {
    const substrate = [3, 2, 2, 1, 2, 3, 3, 0, 2, 3, 1, 3, 3, 3, 2, 3, 3, 3, 3, 0];
    const native = [3, 2, 3, 0, 2, 3, 3, 0, 3, 3, 1, 3, 0, 0, 2, 0, 1, 2, 3, 1];
    const sham = [2, 1, 2, 1, 1, 3, 1, 0, 3, 1, 1, 3, 3, 3, 2, 2, 3, 2, 1, 1];
    const manifest = manifestFixture(
      includedPhase("selection", "confirmatory", 20, 3),
    );
    const attempts = attemptsFor(manifest, ({ task, repeatIndex, arm }) => {
      const index = Number(task.taskId.split("-").at(-1));
      const successes =
        arm === "substrate" ? substrate[index]! : arm === "native" ? native[index]! : sham[index]!;
      return outcome(repeatIndex < successes);
    });
    const report = analyze(manifest, attempts).phases.confirmatory!;

    expect(report.primary.lift).toBeCloseTo(0.15);
    expect(report.primary.pairedBootstrap.low).toBeLessThanOrEqual(0);
  });
});

function manifestFixture(
  taskPlan: readonly PublicEvalTaskPlanEntry[],
  successCriteria: PublicEvalAnalysisManifestInput["successCriteria"] = {
    minimumStrictCompletionLift: 0.1,
    minimumReliableTaskSuccessRate: 0.5,
    requirePositiveCiLowerBound: true,
    maximumCostUsdPerStrictSuccess: 10,
    maximumLatencyMsPerStrictSuccess: 1_000,
    maximumCostPerStrictSuccessRatio: 1.25,
    maximumLatencyPerStrictSuccessRatio: 1.25,
  },
): PublicEvalAnalysisManifest {
  const qualificationComponents = components("qualification");
  const decisionComponents = components("decision");
  const universe = [...new Set(taskPlan.map((task) => task.benchmarkTaskContentHash))].sort();
  const confirmatorySelection = taskPlan
    .filter(
      (task) => task.phase === "confirmatory" && task.status === "included",
    )
    .map((task) => task.benchmarkTaskContentHash);
  const replicationSelection = taskPlan
    .filter(
      (task) => task.phase === "replication" && task.status === "included",
    )
    .map((task) => task.benchmarkTaskContentHash);
  const selected = [
    ...new Set(
      confirmatorySelection.length > 0
        ? confirmatorySelection
        : replicationSelection,
    ),
  ].sort();
  const selectionSeed = selectionSeedFor(
    universe,
    selected,
    "fixture-heldout-selection",
  );
  const universeRoot = hashPublicEvalJson({
    schemaVersion: "pm.public-eval.eligible-universe.v1",
    taskContentHashes: universe,
  });
  const hardenedTaskPlan = taskPlan.map((task) => ({
    ...task,
    selectionDigest: publicEvalSelectionDigest(
      selectionSeed,
      task.benchmarkTaskContentHash,
    ),
    eligibleUniverseMembershipProof: {
      inventoryIndex: universe.indexOf(task.benchmarkTaskContentHash),
      inventoryRootHash: universeRoot,
      benchmarkTaskContentHash: task.benchmarkTaskContentHash,
    },
  }));
  return createPublicEvalAnalysisManifest({
    experimentId: "experiment_public_eval",
    producerIdentity: "pm_eval_producer",
    benchmark: {
      benchmarkId: "benchmark_fixture",
      repositoryUrl: "https://example.com/public/benchmark-fixture.git",
      revision: digest("revision-1"),
      licenseSpdx: "MIT",
      splitId: "heldout-test",
      corpusHash: digest("fixture-corpus"),
      eligibleUniverse: {
        rootHash: universeRoot,
        taskContentHashes: universe,
        selectionAlgorithm: "sha256-rank-v1",
        selectionSeed,
        selectionCount: selected.length,
      },
    },
    execution: {
      harnessRevision: digest("fixture-harness"),
      substrateRevision: digest("fixture-substrate"),
      replicationAxis: "model",
      modelIds: {
        qualification: "fixture-model-primary",
        confirmatory: "fixture-model-primary",
        replication: "fixture-model-replication",
      },
      modelDigests: {
        qualification: digest("fixture-model-primary"),
        confirmatory: digest("fixture-model-primary"),
        replication: digest("fixture-model-replication"),
      },
      nonModelConfigHashes: {
        qualification: configHash(qualificationComponents),
        confirmatory: configHash(decisionComponents),
        replication: configHash(decisionComponents),
      },
      nonModelComponents: {
        qualification: qualificationComponents,
        confirmatory: decisionComponents,
        replication: decisionComponents,
      },
      arms: armPlans(),
      randomization: {
        algorithm: "sha256-arm-order-v1",
        seed: "fixture-arm-order",
      },
    },
    decisionVerification: {
      attempt_set: verifier("attempt-set"),
      oracle_independence: verifier("oracle-independence"),
      split_leakage: verifier("split-leakage"),
      anti_degenerate_controls: verifier("anti-degenerate"),
      restart_dynamic_state: verifier("restart-dynamic"),
      clean_checkout: verifier("clean-checkout"),
    },
    frozenAt: FROZEN_AT,
    taskPlan: hardenedTaskPlan,
    guardrails: {
      maxFalseBlockedActionsPerAttempt: 0,
      maxCollateralWritesPerAttempt: 0,
    },
    bootstrap: {
      iterations: 10_000,
      confidenceLevel: 0.95,
      seed: "deterministic-test-seed",
    },
    successCriteria,
  });
}

function selectionSeedFor(
  universe: readonly string[],
  selected: readonly string[],
  prefix: string,
): string {
  const expected = [...selected].sort();
  for (let index = 0; index < 100_000; index += 1) {
    const seed = `${prefix}-${index}`;
    const actual = [...universe]
      .sort((left, right) => {
        const leftRank = publicEvalSelectionDigest(seed, left);
        const rightRank = publicEvalSelectionDigest(seed, right);
        return leftRank < rightRank ? -1 : leftRank > rightRank ? 1 : 0;
      })
      .slice(0, expected.length)
      .sort();
    if (JSON.stringify(actual) === JSON.stringify(expected)) return seed;
  }
  throw new Error("test fixture could not derive deterministic selection seed");
}

function included(
  taskId: string,
  phase: "qualification" | "confirmatory" | "replication",
  predeclaredRepeats: number,
  canonicalTaskId: string = taskId,
): PublicEvalTaskPlanEntry {
  return {
    taskId,
    canonicalTaskId,
    benchmarkTaskLocator: `task/${canonicalTaskId}`,
    benchmarkTaskContentHash: digest(`benchmark-task:${canonicalTaskId}`),
    taskContentHash: digest(`benchmark-task:${canonicalTaskId}`),
    variant: "original",
    mutationHash: null,
    phase,
    predeclaredSeeds: Array.from(
      { length: predeclaredRepeats },
      (_, index) => `seed-${index}`,
    ),
    selectionDigest: digest("filled-by-manifest-fixture"),
    eligibleUniverseMembershipProof: {
      inventoryIndex: 0,
      inventoryRootHash: digest("filled-by-manifest-fixture"),
      benchmarkTaskContentHash: digest(`benchmark-task:${canonicalTaskId}`),
    },
    initialEnvironmentSnapshotHash: digest(`environment:${canonicalTaskId}`),
    status: "included",
  };
}

function includedPhase(
  prefix: string,
  phase: "confirmatory" | "replication",
  taskCount: number,
  repeats: number,
  canonicalPrefix: string = prefix,
): readonly PublicEvalTaskPlanEntry[] {
  return Array.from({ length: taskCount }, (_, index) =>
    included(`${prefix}-${index}`, phase, repeats, `${canonicalPrefix}-${index}`),
  );
}

function attemptsFor(
  manifest: PublicEvalAnalysisManifest,
  select: (input: {
    readonly task: Extract<PublicEvalTaskPlanEntry, { status: "included" }>;
    readonly repeatIndex: number;
    readonly arm: PublicEvalArm;
  }) => PublicEvalAttemptOutcome,
): readonly PublicEvalAttemptArtifact[] {
  return manifest.taskPlan.flatMap((task) => {
    if (task.status !== "included") return [];
    return Array.from({ length: task.predeclaredSeeds.length }, (_, repeatIndex) =>
      PUBLIC_EVAL_ARMS.map((arm) =>
        artifactFor(
          manifest,
          task,
          repeatIndex,
          arm,
          select({ task, repeatIndex, arm }),
        ),
      ),
    ).flat();
  });
}

function artifactFor(
  manifest: PublicEvalAnalysisManifest,
  task: PublicEvalTaskPlanEntry,
  repeatIndex: number,
  arm: PublicEvalArm,
  selectedOutcome: PublicEvalAttemptOutcome,
): PublicEvalAttemptArtifact {
  const armOrderPosition = publicEvalExpectedArmOrder(
    manifest,
    task,
    repeatIndex,
  ).indexOf(arm);
  const startedAt = new Date(
    Date.parse(COMPLETED_AT) + armOrderPosition * 1_000,
  ).toISOString();
  return createPublicEvalAttemptArtifact({
    manifestHash: manifest.manifestHash,
    experimentId: manifest.experimentId,
    benchmarkId: manifest.benchmark.benchmarkId,
    benchmarkRevision: manifest.benchmark.revision,
    harnessRevision: manifest.execution.harnessRevision,
    substrateRevision: manifest.execution.substrateRevision,
    modelId: manifest.execution.modelIds[task.phase],
    modelDigest: manifest.execution.modelDigests[task.phase],
    nonModelConfigHash: manifest.execution.nonModelConfigHashes[task.phase],
    phase: task.phase,
    taskId: task.taskId,
    repeatIndex,
    seed: task.predeclaredSeeds[repeatIndex]!,
    arm,
    armInterventionHash: manifest.execution.arms[arm].interventionHash,
    armBindingHash: publicEvalArmBindingHash(
      manifest,
      task,
      repeatIndex,
      arm,
    ),
    armOrderPosition,
    initialEnvironmentSnapshotHash: task.initialEnvironmentSnapshotHash,
    attemptGroupId: `group_${task.taskId}_${repeatIndex}`,
    attemptId: `attempt_${task.taskId}_${repeatIndex}_${arm}`,
    executionBindingHash: publicEvalExecutionBindingHash(
      manifest,
      task,
      repeatIndex,
    ),
    startedAt,
    completedAt: new Date(Date.parse(startedAt) + 500).toISOString(),
    rawArtifactRootHash: digest(
      `raw:${task.taskId}:${task.predeclaredSeeds[repeatIndex]}:${arm}`,
    ),
    usageReceiptHash: digest(
      `usage:${task.taskId}:${task.predeclaredSeeds[repeatIndex]}:${arm}`,
    ),
    outcome: selectedOutcome,
  });
}

function outcome(
  strictTaskSuccess: boolean,
  overrides: Partial<PublicEvalAttemptOutcome> = {},
): PublicEvalAttemptOutcome {
  return {
    strictTaskSuccess,
    oracleReceiptHash: digest(`oracle:${strictTaskSuccess}`),
    blockedActionCount: 0,
    falseBlockedActionCount: 0,
    collateralWriteCount: 0,
    costUsd: 1,
    latencyMs: 100,
    ...overrides,
  };
}

function reissue(
  artifact: PublicEvalAttemptArtifact,
  overrides: Partial<PublicEvalAttemptArtifactInput>,
): PublicEvalAttemptArtifact {
  const { schemaVersion: _schema, artifactHash: _hash, ...input } = artifact;
  return createPublicEvalAttemptArtifact({ ...input, ...overrides });
}

function analyze(
  manifest: PublicEvalAnalysisManifest,
  attempts: readonly PublicEvalAttemptArtifact[],
) {
  return analyzePublicEval({
    schemaVersion: "pm.public-eval.analysis-input.v1",
    manifest,
    attempts,
  });
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function components(label: string) {
  return {
    systemPromptHash: digest(`${label}:system-prompt`),
    toolsHash: digest(`${label}:tools`),
    simulatorHash: digest(`${label}:simulator`),
    judgeHash: digest(`${label}:judge`),
    decodingHash: digest(`${label}:decoding`),
    runnerHash: digest(`${label}:runner`),
  };
}

function configHash(value: ReturnType<typeof components>): string {
  return hashPublicEvalJson({
    schemaVersion: "pm.public-eval.non-model-config.v1",
    ...value,
  });
}

function armPlans(): PublicEvalAnalysisManifest["execution"]["arms"] {
  const sharedSidecar = digest("fixture-equal-overhead-sidecar");
  return {
    native: {
      stateMode: "native",
      interventionHash: digest("arm:native"),
      implementationRevision: digest("arm:native:implementation"),
      sidecarShapeHash: digest("arm:native:no-sidecar"),
      expectedToolCalls: 0,
      expectedPromptTokens: 0,
      expectedAddedLatencyMs: 0,
    },
    sham: {
      stateMode: "irrelevant_sham",
      interventionHash: digest("arm:sham"),
      implementationRevision: digest("arm:sham:implementation"),
      sidecarShapeHash: sharedSidecar,
      expectedToolCalls: 1,
      expectedPromptTokens: 128,
      expectedAddedLatencyMs: 25,
    },
    substrate: {
      stateMode: "pm_substrate",
      interventionHash: digest("arm:substrate"),
      implementationRevision: digest("arm:substrate:implementation"),
      sidecarShapeHash: sharedSidecar,
      expectedToolCalls: 1,
      expectedPromptTokens: 128,
      expectedAddedLatencyMs: 25,
    },
  };
}

function verifier(label: string): {
  readonly verifierId: string;
  readonly sourceRevision: string;
} {
  return {
    verifierId: `verifier_${label.replaceAll("-", "_")}`,
    sourceRevision: digest(`verifier:${label}`),
  };
}

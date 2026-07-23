import { createHash } from "node:crypto";

import {
  PUBLIC_EVAL_ARMS,
  PUBLIC_EVAL_PHASES,
  parsePublicEvalAnalysisManifest,
  parsePublicEvalAttemptArtifact,
  publicEvalArmBindingHash,
  publicEvalExecutionBindingHash,
  publicEvalExpectedArmOrder,
  type PublicEvalAnalysisManifest,
  type PublicEvalArm,
  type PublicEvalAttemptArtifact,
  type PublicEvalPhase,
  type PublicEvalTaskPlanEntry,
} from "./schema.js";

export interface PublicEvalAnalysisInput {
  readonly schemaVersion: "pm.public-eval.analysis-input.v1";
  readonly manifest: unknown;
  readonly attempts: readonly unknown[];
}

export interface PublicEvalArmMetrics {
  readonly attempts: number;
  readonly strictSuccesses: number;
  readonly rawAttemptSuccessRate: number;
  /** Mean of per-task success rates, so tasks—not repeats—carry equal weight. */
  readonly taskClusteredStrictCompletionRate: number;
  readonly reliableTasks: number;
  readonly reliableTaskSuccessRate: number;
  readonly allPredeclaredRepeatsSucceeded: boolean;
  readonly blockedActionCount: number;
  readonly falseBlockedActionCount: number;
  readonly collateralWriteCount: number;
  readonly falseBlockViolatingAttemptIds: readonly string[];
  readonly collateralViolatingAttemptIds: readonly string[];
  readonly guardrailsPassed: boolean;
  readonly totalCostUsd: number;
  readonly totalLatencyMs: number;
  /** Total arm cost/latency divided only by benchmark strict successes. */
  readonly costUsdPerStrictSuccess: number | null;
  readonly latencyMsPerStrictSuccess: number | null;
}

export interface TaskClusteredPairedBootstrap {
  readonly unit: "task";
  readonly clusterCount: number;
  readonly iterations: number;
  readonly confidenceLevel: number;
  readonly seed: string;
  readonly low: number;
  readonly high: number;
}

export interface PublicEvalPhaseDecision {
  readonly eligible: boolean;
  readonly status: "passed" | "failed" | "not_eligible";
  readonly reasons: readonly string[];
}

export interface PublicEvalUnitEconomics {
  readonly substrateCostUsdPerStrictSuccess: number | null;
  readonly strongerControlCostUsdPerStrictSuccess: number | null;
  readonly costPerStrictSuccessRatio: number | null;
  readonly substrateLatencyMsPerStrictSuccess: number | null;
  readonly strongerControlLatencyMsPerStrictSuccess: number | null;
  readonly latencyPerStrictSuccessRatio: number | null;
  /** Ratios are intentionally absent when either arm has no strict success. */
  readonly relativeComparisonAvailable: boolean;
}

export interface PublicEvalControlComparison {
  readonly control: "native" | "sham";
  readonly strictCompletionLift: number;
  readonly reliableTaskSuccessLift: number;
  readonly unitEconomics: PublicEvalUnitEconomics;
}

export interface PublicEvalPhaseReport {
  readonly phase: PublicEvalPhase;
  readonly taskCount: number;
  readonly predeclaredRepeatCells: number;
  readonly exactArmTriples: number;
  readonly arms: Readonly<Record<PublicEvalArm, PublicEvalArmMetrics>>;
  /** Better observed task-clustered strict completion of native and sham. */
  readonly strongerControl: "native" | "sham";
  readonly comparisons: Readonly<
    Record<"native" | "sham", PublicEvalControlComparison>
  >;
  readonly primary: {
    readonly metric: "task_clustered_strict_completion_lift";
    readonly substrateRate: number;
    readonly strongerControlRate: number;
    readonly lift: number;
    readonly pairedBootstrap: TaskClusteredPairedBootstrap;
  };
  readonly reliableTaskSuccessLift: number;
  readonly unitEconomics: PublicEvalUnitEconomics;
  readonly decision: PublicEvalPhaseDecision;
}

export interface PublicEvalAnalysisReport {
  readonly schemaVersion: "pm.public-eval.analysis-report.v1";
  readonly experimentId: string;
  readonly manifestHash: string;
  readonly benchmark: PublicEvalAnalysisManifest["benchmark"];
  readonly evidenceSeparation: {
    readonly qualificationUsedForConfirmatoryDecision: false;
    readonly confirmatoryUsedForReplicationDecision: false;
  };
  readonly pairing: {
    readonly exact: true;
    readonly includedTasks: number;
    readonly excludedPreRunTasks: number;
    readonly exactTaskRepeatTriples: number;
    readonly expectedAttemptArtifacts: number;
    readonly admittedAttemptArtifacts: number;
  };
  readonly phases: Readonly<
    Record<PublicEvalPhase, PublicEvalPhaseReport | null>
  >;
  readonly confirmatoryPassed: boolean;
  readonly replicationPassed: boolean;
  /** Statistical/guardrail result only; D7 still requires independent evidence verification. */
  readonly pairedAnalysisCriteriaPassed: boolean;
}

const MINIMUM_ELIGIBLE_TASK_CLUSTERS = 20;
const MINIMUM_SEEDS_PER_ELIGIBLE_TASK = 3;

interface ExactAttemptTriple {
  readonly task: Extract<PublicEvalTaskPlanEntry, { readonly status: "included" }>;
  readonly repeatIndex: number;
  readonly attempts: Readonly<Record<PublicEvalArm, PublicEvalAttemptArtifact>>;
}

export function analyzePublicEval(
  rawInput: PublicEvalAnalysisInput,
): PublicEvalAnalysisReport {
  const input = parseAnalysisInput(rawInput);
  const manifest = parsePublicEvalAnalysisManifest(input.manifest);
  const attempts = input.attempts.map(parsePublicEvalAttemptArtifact);
  const triples = validateAndPair(manifest, attempts);
  const includedTasks = manifest.taskPlan.filter(
    (task): task is Extract<PublicEvalTaskPlanEntry, { status: "included" }> =>
      task.status === "included",
  );
  const phases = Object.fromEntries(
    PUBLIC_EVAL_PHASES.map((phase) => [
      phase,
      analyzePhase(
        phase,
        manifest,
        includedTasks.filter((task) => task.phase === phase),
        triples.filter((triple) => triple.task.phase === phase),
      ),
    ]),
  ) as Record<PublicEvalPhase, PublicEvalPhaseReport | null>;
  const confirmatoryPassed = phases.confirmatory?.decision.status === "passed";
  const replicationPassed = phases.replication?.decision.status === "passed";

  return {
    schemaVersion: "pm.public-eval.analysis-report.v1",
    experimentId: manifest.experimentId,
    manifestHash: manifest.manifestHash,
    benchmark: manifest.benchmark,
    evidenceSeparation: {
      qualificationUsedForConfirmatoryDecision: false,
      confirmatoryUsedForReplicationDecision: false,
    },
    pairing: {
      exact: true,
      includedTasks: includedTasks.length,
      excludedPreRunTasks: manifest.taskPlan.length - includedTasks.length,
      exactTaskRepeatTriples: triples.length,
      expectedAttemptArtifacts: triples.length * PUBLIC_EVAL_ARMS.length,
      admittedAttemptArtifacts: attempts.length,
    },
    phases,
    confirmatoryPassed,
    replicationPassed,
    pairedAnalysisCriteriaPassed: confirmatoryPassed && replicationPassed,
  };
}

function parseAnalysisInput(value: unknown): PublicEvalAnalysisInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("analysis input must be an object");
  }
  const root = value as Record<string, unknown>;
  const keys = Object.keys(root).sort();
  const expected = ["attempts", "manifest", "schemaVersion"];
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    throw new Error("analysis input permits only schemaVersion, manifest, and attempts");
  }
  if (root["schemaVersion"] !== "pm.public-eval.analysis-input.v1") {
    throw new Error("analysis input schemaVersion must be pm.public-eval.analysis-input.v1");
  }
  if (!Array.isArray(root["attempts"])) {
    throw new Error("analysis input attempts must be an array");
  }
  return {
    schemaVersion: "pm.public-eval.analysis-input.v1",
    manifest: root["manifest"],
    attempts: root["attempts"],
  };
}

function validateAndPair(
  manifest: PublicEvalAnalysisManifest,
  attempts: readonly PublicEvalAttemptArtifact[],
): readonly ExactAttemptTriple[] {
  const taskById = new Map(manifest.taskPlan.map((task) => [task.taskId, task]));
  const seenAttemptIds = new Set<string>();
  const cellByAttemptGroupId = new Map<string, string>();
  const byCell = new Map<string, PublicEvalAttemptArtifact[]>();

  for (const attempt of attempts) {
    if (attempt.manifestHash !== manifest.manifestHash) {
      throw new Error(
        `attempt ${attempt.attemptId} manifestHash does not bind the analyzed manifest; ` +
          "post-result manifest edits and exclusions are refused",
      );
    }
    if (attempt.experimentId !== manifest.experimentId) {
      throw new Error(`attempt ${attempt.attemptId} experimentId mismatch`);
    }
    if (
      attempt.benchmarkId !== manifest.benchmark.benchmarkId ||
      attempt.benchmarkRevision !== manifest.benchmark.revision
    ) {
      throw new Error(`attempt ${attempt.attemptId} benchmark identity mismatch`);
    }
    if (
      attempt.harnessRevision !== manifest.execution.harnessRevision ||
      attempt.substrateRevision !== manifest.execution.substrateRevision
    ) {
      throw new Error(`attempt ${attempt.attemptId} runtime revision mismatch`);
    }
    if (Date.parse(attempt.startedAt) <= Date.parse(manifest.frozenAt)) {
      throw new Error(`attempt ${attempt.attemptId} did not start after manifest freeze`);
    }
    if (seenAttemptIds.has(attempt.attemptId)) {
      throw new Error(`duplicate attemptId ${attempt.attemptId}`);
    }
    seenAttemptIds.add(attempt.attemptId);

    const task = taskById.get(attempt.taskId);
    if (task === undefined) {
      throw new Error(`attempt ${attempt.attemptId} references unpredeclared task ${attempt.taskId}`);
    }
    if (task.status === "excluded_pre_run") {
      throw new Error(
        `post-result exclusion refusal: excluded task ${task.taskId} has outcome artifact ${attempt.attemptId}`,
      );
    }
    if (attempt.phase !== task.phase) {
      throw new Error(`attempt ${attempt.attemptId} phase does not match task plan`);
    }
    if (attempt.modelId !== manifest.execution.modelIds[task.phase]) {
      throw new Error(
        `attempt ${attempt.attemptId} model does not match frozen phase model`,
      );
    }
    if (attempt.repeatIndex >= task.predeclaredSeeds.length) {
      throw new Error(
        `attempt ${attempt.attemptId} repeatIndex exceeds predeclared repeats`,
      );
    }
    if (attempt.seed !== task.predeclaredSeeds[attempt.repeatIndex]) {
      throw new Error(`attempt ${attempt.attemptId} seed does not match frozen schedule`);
    }
    if (
      attempt.modelDigest !== manifest.execution.modelDigests[task.phase] ||
      attempt.nonModelConfigHash !==
        manifest.execution.nonModelConfigHashes[task.phase]
    ) {
      throw new Error(
        `attempt ${attempt.attemptId} model/config digest does not match frozen phase`,
      );
    }
    const expectedOrder = publicEvalExpectedArmOrder(
      manifest,
      task,
      attempt.repeatIndex,
    );
    if (
      attempt.armInterventionHash !==
        manifest.execution.arms[attempt.arm].interventionHash ||
      attempt.armOrderPosition !== expectedOrder.indexOf(attempt.arm) ||
      attempt.initialEnvironmentSnapshotHash !==
        task.initialEnvironmentSnapshotHash ||
      attempt.executionBindingHash !==
        publicEvalExecutionBindingHash(manifest, task, attempt.repeatIndex) ||
      attempt.armBindingHash !==
        publicEvalArmBindingHash(manifest, task, attempt.repeatIndex, attempt.arm)
    ) {
      throw new Error(`attempt ${attempt.attemptId} arm or execution binding mismatch`);
    }
    const key = cellKey(task.phase, task.taskId, attempt.repeatIndex);
    const existingGroupCell = cellByAttemptGroupId.get(attempt.attemptGroupId);
    if (existingGroupCell !== undefined && existingGroupCell !== key) {
      throw new Error(
        `attemptGroupId ${attempt.attemptGroupId} is reused across ${existingGroupCell} and ${key}`,
      );
    }
    cellByAttemptGroupId.set(attempt.attemptGroupId, key);
    const cell = byCell.get(key) ?? [];
    cell.push(attempt);
    byCell.set(key, cell);
  }

  const triples: ExactAttemptTriple[] = [];
  for (const task of manifest.taskPlan) {
    if (task.status !== "included") continue;
    for (
      let repeatIndex = 0;
      repeatIndex < task.predeclaredSeeds.length;
      repeatIndex += 1
    ) {
      const key = cellKey(task.phase, task.taskId, repeatIndex);
      const cell = byCell.get(key) ?? [];
      if (cell.length !== PUBLIC_EVAL_ARMS.length) {
        throw new Error(
          `${key} requires exactly native/sham/substrate; found ${cell.length} artifact(s)`,
        );
      }
      const attemptsByArm = Object.fromEntries(
        PUBLIC_EVAL_ARMS.map((arm) => {
          const matches = cell.filter((attempt) => attempt.arm === arm);
          if (matches.length !== 1) {
            throw new Error(`${key} requires exactly one ${arm} artifact`);
          }
          return [arm, matches[0]!];
        }),
      ) as Record<PublicEvalArm, PublicEvalAttemptArtifact>;
      const groupIds = new Set(cell.map((attempt) => attempt.attemptGroupId));
      if (groupIds.size !== 1) {
        throw new Error(`${key} attemptGroupId mismatch across arms`);
      }
      const bindings = new Set(cell.map((attempt) => attempt.executionBindingHash));
      if (bindings.size !== 1) {
        throw new Error(`${key} executionBindingHash mismatch across arms`);
      }
      const ordered = [...cell].sort(
        (left, right) => left.armOrderPosition - right.armOrderPosition,
      );
      if (
        new Set(ordered.map((attempt) => attempt.armOrderPosition)).size !==
          PUBLIC_EVAL_ARMS.length ||
        ordered.some(
          (attempt, index) =>
            index > 0 &&
            Date.parse(attempt.startedAt) <=
              Date.parse(ordered[index - 1]!.startedAt),
        )
      ) {
        throw new Error(`${key} did not execute in its frozen arm order`);
      }
      triples.push({ task, repeatIndex, attempts: attemptsByArm });
    }
  }
  if (triples.length * PUBLIC_EVAL_ARMS.length !== attempts.length) {
    throw new Error("attempt artifacts do not exactly equal the predeclared task-repeat cells");
  }
  return triples;
}

function analyzePhase(
  phase: PublicEvalPhase,
  manifest: PublicEvalAnalysisManifest,
  tasks: readonly Extract<PublicEvalTaskPlanEntry, { status: "included" }>[],
  triples: readonly ExactAttemptTriple[],
): PublicEvalPhaseReport | null {
  if (tasks.length === 0) return null;
  const arms = Object.fromEntries(
    PUBLIC_EVAL_ARMS.map((arm) => [
      arm,
      armMetrics(arm, tasks, triples, manifest),
    ]),
  ) as Record<PublicEvalArm, PublicEvalArmMetrics>;
  const strongerControl = selectStrongerControl(arms);
  const taskRates = tasks.map((task) => ({
    substrate: taskSuccessRate(task, "substrate", triples),
    native: taskSuccessRate(task, "native", triples),
    sham: taskSuccessRate(task, "sham", triples),
  }));
  const comparisons = Object.fromEntries(
    (["native", "sham"] as const).map((control) => [
      control,
      {
        control,
        strictCompletionLift:
          arms.substrate.taskClusteredStrictCompletionRate -
          arms[control].taskClusteredStrictCompletionRate,
        reliableTaskSuccessLift:
          arms.substrate.reliableTaskSuccessRate -
          arms[control].reliableTaskSuccessRate,
        unitEconomics: compareUnitEconomics(arms.substrate, arms[control]),
      },
    ]),
  ) as Record<"native" | "sham", PublicEvalControlComparison>;
  const lift = Math.min(
    comparisons.native.strictCompletionLift,
    comparisons.sham.strictCompletionLift,
  );
  const pairedBootstrap = bootstrapAgainstMaxControl(
    taskRates,
    manifest.bootstrap,
    `${phase}:max-control`,
  );
  const reliableTaskSuccessLift = Math.min(
    comparisons.native.reliableTaskSuccessLift,
    comparisons.sham.reliableTaskSuccessLift,
  );
  const unitEconomics = compareUnitEconomics(
    arms.substrate,
    arms[strongerControl],
  );
  const decision = phaseDecision(
    phase,
    lift,
    pairedBootstrap,
    reliableTaskSuccessLift,
    arms.substrate,
    comparisons,
    tasks,
    manifest,
  );

  return {
    phase,
    taskCount: tasks.length,
    predeclaredRepeatCells: triples.length,
    exactArmTriples: triples.length,
    arms,
    strongerControl,
    comparisons,
    primary: {
      metric: "task_clustered_strict_completion_lift",
      substrateRate: arms.substrate.taskClusteredStrictCompletionRate,
      strongerControlRate:
        arms[strongerControl].taskClusteredStrictCompletionRate,
      lift,
      pairedBootstrap,
    },
    reliableTaskSuccessLift,
    unitEconomics,
    decision,
  };
}

function selectStrongerControl(
  arms: Readonly<Record<PublicEvalArm, PublicEvalArmMetrics>>,
): "native" | "sham" {
  const native = arms.native;
  const sham = arms.sham;
  if (
    native.taskClusteredStrictCompletionRate !==
    sham.taskClusteredStrictCompletionRate
  ) {
    return native.taskClusteredStrictCompletionRate >
      sham.taskClusteredStrictCompletionRate
      ? "native"
      : "sham";
  }
  if (native.reliableTaskSuccessRate !== sham.reliableTaskSuccessRate) {
    return native.reliableTaskSuccessRate > sham.reliableTaskSuccessRate
      ? "native"
      : "sham";
  }
  const nativeCost = native.costUsdPerStrictSuccess ?? Number.POSITIVE_INFINITY;
  const shamCost = sham.costUsdPerStrictSuccess ?? Number.POSITIVE_INFINITY;
  if (nativeCost !== shamCost) return nativeCost < shamCost ? "native" : "sham";
  const nativeLatency =
    native.latencyMsPerStrictSuccess ?? Number.POSITIVE_INFINITY;
  const shamLatency = sham.latencyMsPerStrictSuccess ?? Number.POSITIVE_INFINITY;
  if (nativeLatency !== shamLatency) {
    return nativeLatency < shamLatency ? "native" : "sham";
  }
  return "native";
}

function compareUnitEconomics(
  substrate: PublicEvalArmMetrics,
  strongerControl: PublicEvalArmMetrics,
): PublicEvalUnitEconomics {
  const costComparable =
    substrate.costUsdPerStrictSuccess !== null &&
    strongerControl.costUsdPerStrictSuccess !== null &&
    strongerControl.costUsdPerStrictSuccess > 0;
  const latencyComparable =
    substrate.latencyMsPerStrictSuccess !== null &&
    strongerControl.latencyMsPerStrictSuccess !== null &&
    strongerControl.latencyMsPerStrictSuccess > 0;
  return {
    substrateCostUsdPerStrictSuccess: substrate.costUsdPerStrictSuccess,
    strongerControlCostUsdPerStrictSuccess:
      strongerControl.costUsdPerStrictSuccess,
    costPerStrictSuccessRatio: costComparable
      ? substrate.costUsdPerStrictSuccess! /
        strongerControl.costUsdPerStrictSuccess!
      : null,
    substrateLatencyMsPerStrictSuccess: substrate.latencyMsPerStrictSuccess,
    strongerControlLatencyMsPerStrictSuccess:
      strongerControl.latencyMsPerStrictSuccess,
    latencyPerStrictSuccessRatio: latencyComparable
      ? substrate.latencyMsPerStrictSuccess! /
        strongerControl.latencyMsPerStrictSuccess!
      : null,
    relativeComparisonAvailable: costComparable && latencyComparable,
  };
}

function armMetrics(
  arm: PublicEvalArm,
  tasks: readonly Extract<PublicEvalTaskPlanEntry, { status: "included" }>[],
  triples: readonly ExactAttemptTriple[],
  manifest: PublicEvalAnalysisManifest,
): PublicEvalArmMetrics {
  const attempts = triples.map((triple) => triple.attempts[arm]);
  const strictSuccesses = attempts.filter(
    (attempt) => attempt.outcome.strictTaskSuccess,
  ).length;
  const taskRates = tasks.map((task) => taskSuccessRate(task, arm, triples));
  const reliableTasks = taskRates.filter((rate) => rate === 1).length;
  const falseBlockViolatingAttemptIds = attempts
    .filter(
      (attempt) =>
        attempt.outcome.falseBlockedActionCount >
        manifest.guardrails.maxFalseBlockedActionsPerAttempt,
    )
    .map((attempt) => attempt.attemptId)
    .sort();
  const collateralViolatingAttemptIds = attempts
    .filter(
      (attempt) =>
        attempt.outcome.collateralWriteCount >
        manifest.guardrails.maxCollateralWritesPerAttempt,
    )
    .map((attempt) => attempt.attemptId)
    .sort();
  const totalCostUsd = sum(attempts, (attempt) => attempt.outcome.costUsd);
  const totalLatencyMs = sum(attempts, (attempt) => attempt.outcome.latencyMs);

  return {
    attempts: attempts.length,
    strictSuccesses,
    rawAttemptSuccessRate: strictSuccesses / attempts.length,
    taskClusteredStrictCompletionRate: mean(taskRates),
    reliableTasks,
    reliableTaskSuccessRate: reliableTasks / tasks.length,
    allPredeclaredRepeatsSucceeded: strictSuccesses === attempts.length,
    blockedActionCount: sum(
      attempts,
      (attempt) => attempt.outcome.blockedActionCount,
    ),
    falseBlockedActionCount: sum(
      attempts,
      (attempt) => attempt.outcome.falseBlockedActionCount,
    ),
    collateralWriteCount: sum(
      attempts,
      (attempt) => attempt.outcome.collateralWriteCount,
    ),
    falseBlockViolatingAttemptIds,
    collateralViolatingAttemptIds,
    guardrailsPassed:
      falseBlockViolatingAttemptIds.length === 0 &&
      collateralViolatingAttemptIds.length === 0,
    totalCostUsd,
    totalLatencyMs,
    costUsdPerStrictSuccess:
      strictSuccesses === 0 ? null : totalCostUsd / strictSuccesses,
    latencyMsPerStrictSuccess:
      strictSuccesses === 0 ? null : totalLatencyMs / strictSuccesses,
  };
}

function taskSuccessRate(
  task: Extract<PublicEvalTaskPlanEntry, { status: "included" }>,
  arm: PublicEvalArm,
  triples: readonly ExactAttemptTriple[],
): number {
  const taskAttempts = triples
    .filter((triple) => triple.task.taskId === task.taskId)
    .map((triple) => triple.attempts[arm]);
  if (taskAttempts.length !== task.predeclaredSeeds.length) {
    throw new Error(`internal pairing error for task ${task.taskId}/${arm}`);
  }
  return taskAttempts.filter((attempt) => attempt.outcome.strictTaskSuccess).length /
    taskAttempts.length;
}

function bootstrapAgainstMaxControl(
  taskRates: readonly {
    readonly substrate: number;
    readonly native: number;
    readonly sham: number;
  }[],
  config: PublicEvalAnalysisManifest["bootstrap"],
  salt: string,
): TaskClusteredPairedBootstrap {
  const seed = `${config.seed}:${salt}`;
  const random = mulberry32(seedUint32(seed));
  const draws: number[] = [];
  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    let substrateTotal = 0;
    let nativeTotal = 0;
    let shamTotal = 0;
    for (let cluster = 0; cluster < taskRates.length; cluster += 1) {
      const index = Math.floor(random() * taskRates.length);
      const rates = taskRates[index]!;
      substrateTotal += rates.substrate;
      nativeTotal += rates.native;
      shamTotal += rates.sham;
    }
    draws.push(
      (substrateTotal - Math.max(nativeTotal, shamTotal)) / taskRates.length,
    );
  }
  draws.sort((left, right) => left - right);
  const tail = (1 - config.confidenceLevel) / 2;
  return {
    unit: "task",
    clusterCount: taskRates.length,
    iterations: config.iterations,
    confidenceLevel: config.confidenceLevel,
    seed,
    low: quantile(draws, tail),
    high: quantile(draws, 1 - tail),
  };
}

function phaseDecision(
  phase: PublicEvalPhase,
  lift: number,
  ci: TaskClusteredPairedBootstrap,
  reliableTaskSuccessLift: number,
  substrate: PublicEvalArmMetrics,
  comparisons: Readonly<
    Record<"native" | "sham", PublicEvalControlComparison>
  >,
  tasks: readonly Extract<PublicEvalTaskPlanEntry, { status: "included" }>[],
  manifest: PublicEvalAnalysisManifest,
): PublicEvalPhaseDecision {
  if (phase === "qualification") {
    return {
      eligible: false,
      status: "not_eligible",
      reasons: ["qualification evidence is exploratory and cannot decide confirmation"],
    };
  }
  const reasons: string[] = [];
  if (tasks.length < MINIMUM_ELIGIBLE_TASK_CLUSTERS) {
    reasons.push(
      `eligible phase has ${tasks.length} independent task clusters; ` +
        `minimum is ${MINIMUM_ELIGIBLE_TASK_CLUSTERS}`,
    );
  }
  const minimumSeeds = Math.min(
    ...tasks.map((task) => task.predeclaredSeeds.length),
  );
  if (minimumSeeds < MINIMUM_SEEDS_PER_ELIGIBLE_TASK) {
    reasons.push(
      `eligible phase has a task with ${minimumSeeds} seed(s); ` +
        `minimum is ${MINIMUM_SEEDS_PER_ELIGIBLE_TASK}`,
    );
  }
  if (lift < manifest.successCriteria.minimumStrictCompletionLift) {
    reasons.push(
      `strict completion lift ${lift} is below ${manifest.successCriteria.minimumStrictCompletionLift}`,
    );
  }
  if (
    manifest.successCriteria.requirePositiveCiLowerBound &&
    ci.low <= 0
  ) {
    reasons.push(`task-clustered paired CI lower bound ${ci.low} is not positive`);
  }
  if (
    substrate.reliableTaskSuccessRate <
    manifest.successCriteria.minimumReliableTaskSuccessRate
  ) {
    reasons.push(
      `reliable task success ${substrate.reliableTaskSuccessRate} is below ` +
        `${manifest.successCriteria.minimumReliableTaskSuccessRate}`,
    );
  }
  if (reliableTaskSuccessLift <= 0) {
    reasons.push(
      `reliable task success lift ${reliableTaskSuccessLift} is not positive`,
    );
  }
  if (!substrate.guardrailsPassed) {
    reasons.push("substrate false-block or collateral-write guardrail failed");
  }
  if (substrate.costUsdPerStrictSuccess === null) {
    reasons.push("substrate cost per strict success is unavailable because it produced no strict success");
  } else {
    if (
      substrate.costUsdPerStrictSuccess >
      manifest.successCriteria.maximumCostUsdPerStrictSuccess
    ) {
      reasons.push(
        `substrate cost per strict success ${substrate.costUsdPerStrictSuccess} exceeds ` +
          `${manifest.successCriteria.maximumCostUsdPerStrictSuccess}`,
      );
    }
  }
  if (substrate.latencyMsPerStrictSuccess === null) {
    reasons.push("substrate latency per strict success is unavailable because it produced no strict success");
  } else {
    if (
      substrate.latencyMsPerStrictSuccess >
      manifest.successCriteria.maximumLatencyMsPerStrictSuccess
    ) {
      reasons.push(
        `substrate latency per strict success ${substrate.latencyMsPerStrictSuccess} exceeds ` +
          `${manifest.successCriteria.maximumLatencyMsPerStrictSuccess}`,
      );
    }
  }
  for (const control of ["native", "sham"] as const) {
    const comparison = comparisons[control];
    if (
      comparison.strictCompletionLift <
      manifest.successCriteria.minimumStrictCompletionLift
    ) {
      reasons.push(
        `strict completion lift versus ${control} ${comparison.strictCompletionLift} is below ` +
          `${manifest.successCriteria.minimumStrictCompletionLift}`,
      );
    }
    if (comparison.reliableTaskSuccessLift <= 0) {
      reasons.push(
        `reliable task success lift versus ${control} ${comparison.reliableTaskSuccessLift} is not positive`,
      );
    }
    if (!comparison.unitEconomics.relativeComparisonAvailable) {
      reasons.push(`${control} unit-economics comparison is unavailable`);
      continue;
    }
    if (
      comparison.unitEconomics.costPerStrictSuccessRatio! >
      manifest.successCriteria.maximumCostPerStrictSuccessRatio
    ) {
      reasons.push(
        `substrate/${control} cost per strict success ratio ` +
          `${comparison.unitEconomics.costPerStrictSuccessRatio} exceeds ` +
          `${manifest.successCriteria.maximumCostPerStrictSuccessRatio}`,
      );
    }
    if (
      comparison.unitEconomics.latencyPerStrictSuccessRatio! >
      manifest.successCriteria.maximumLatencyPerStrictSuccessRatio
    ) {
      reasons.push(
        `substrate/${control} latency per strict success ratio ` +
          `${comparison.unitEconomics.latencyPerStrictSuccessRatio} exceeds ` +
          `${manifest.successCriteria.maximumLatencyPerStrictSuccessRatio}`,
      );
    }
  }
  return {
    eligible: true,
    status: reasons.length === 0 ? "passed" : "failed",
    reasons,
  };
}

function cellKey(
  phase: PublicEvalPhase,
  taskId: string,
  repeatIndex: number,
): string {
  return `${phase}:${taskId}:repeat-${repeatIndex}`;
}

function seedUint32(seed: string): number {
  return Number.parseInt(
    createHash("sha256").update(seed).digest("hex").slice(0, 8),
    16,
  ) >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: readonly number[], probability: number): number {
  if (sorted.length === 0) throw new Error("cannot compute empty bootstrap quantile");
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const fraction = position - lower;
  return sorted[lower]! * (1 - fraction) + sorted[upper]! * fraction;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error("cannot compute empty mean");
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sum<T>(values: readonly T[], select: (value: T) => number): number {
  return values.reduce((total, value) => total + select(value), 0);
}

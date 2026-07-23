import { createHash } from "node:crypto";

export const PUBLIC_EVAL_ARMS = ["native", "sham", "substrate"] as const;
export type PublicEvalArm = (typeof PUBLIC_EVAL_ARMS)[number];

export const PUBLIC_EVAL_PHASES = [
  "qualification",
  "confirmatory",
  "replication",
] as const;
export type PublicEvalPhase = (typeof PUBLIC_EVAL_PHASES)[number];

export const PUBLIC_EVAL_VERIFICATION_KINDS = [
  "attempt_set",
  "oracle_independence",
  "split_leakage",
  "anti_degenerate_controls",
  "restart_dynamic_state",
  "clean_checkout",
] as const;
export type PublicEvalVerificationKind =
  (typeof PUBLIC_EVAL_VERIFICATION_KINDS)[number];

export const PUBLIC_EVAL_TASK_VARIANTS = ["original", "derivative"] as const;
export type PublicEvalTaskVariant = (typeof PUBLIC_EVAL_TASK_VARIANTS)[number];

interface PublicEvalTaskPlanFields {
  readonly taskId: string;
  readonly canonicalTaskId: string;
  readonly benchmarkTaskLocator: string;
  /** Hash of the immutable, benchmark-owned source task. */
  readonly benchmarkTaskContentHash: string;
  /** Exact executed task bytes; differs only for an explicitly labeled derivative. */
  readonly taskContentHash: string;
  readonly variant: PublicEvalTaskVariant;
  readonly mutationHash: string | null;
  readonly phase: PublicEvalPhase;
  readonly predeclaredSeeds: readonly string[];
  readonly selectionDigest: string;
  readonly eligibleUniverseMembershipProof: {
    readonly inventoryIndex: number;
    readonly inventoryRootHash: string;
    readonly benchmarkTaskContentHash: string;
  };
  readonly initialEnvironmentSnapshotHash: string;
}

export type PublicEvalTaskPlanEntry =
  | (PublicEvalTaskPlanFields & {
      readonly status: "included";
    })
  | (PublicEvalTaskPlanFields & {
      readonly status: "excluded_pre_run";
      readonly exclusionReason: string;
    });

export interface PublicEvalAnalysisManifest {
  readonly schemaVersion: "pm.public-eval.analysis-manifest.v3";
  readonly experimentId: string;
  /** Identity of the organization/process that produced the experiment. */
  readonly producerIdentity: string;
  readonly benchmark: {
    readonly benchmarkId: string;
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly licenseSpdx: string;
    readonly splitId: string;
    readonly corpusHash: string;
    readonly eligibleUniverse: {
      readonly rootHash: string;
      readonly taskContentHashes: readonly string[];
      readonly selectionAlgorithm: "sha256-rank-v1";
      readonly selectionSeed: string;
      /** Exact number of deterministically ranked tasks admitted per decision phase. */
      readonly selectionCount: number;
    };
  };
  /** Frozen runtime identity. This single-benchmark analyzer replicates by model. */
  readonly execution: {
    readonly harnessRevision: string;
    readonly substrateRevision: string;
    readonly replicationAxis: "model";
    readonly modelIds: Readonly<Record<PublicEvalPhase, string>>;
    readonly modelDigests: Readonly<Record<PublicEvalPhase, string>>;
    /** Hash of prompt, tools, decoding, simulator, judge, and runner config. */
    readonly nonModelConfigHashes: Readonly<Record<PublicEvalPhase, string>>;
    readonly nonModelComponents: Readonly<
      Record<
        PublicEvalPhase,
        {
          readonly systemPromptHash: string;
          readonly toolsHash: string;
          readonly simulatorHash: string;
          readonly judgeHash: string;
          readonly decodingHash: string;
          readonly runnerHash: string;
        }
      >
    >;
    readonly arms: Readonly<
      Record<
        PublicEvalArm,
        {
          readonly stateMode: "native" | "irrelevant_sham" | "pm_substrate";
          readonly interventionHash: string;
          readonly implementationRevision: string;
          readonly sidecarShapeHash: string;
          readonly expectedToolCalls: number;
          readonly expectedPromptTokens: number;
          readonly expectedAddedLatencyMs: number;
        }
      >
    >;
    readonly randomization: {
      readonly algorithm: "sha256-arm-order-v1";
      readonly seed: string;
    };
  };
  /** Adapter-specific verifiers are selected before any outcome is observed. */
  readonly decisionVerification: Readonly<
    Record<
      PublicEvalVerificationKind,
      { readonly verifierId: string; readonly sourceRevision: string }
    >
  >;
  readonly frozenAt: string;
  readonly taskPlan: readonly PublicEvalTaskPlanEntry[];
  readonly guardrails: {
    readonly maxFalseBlockedActionsPerAttempt: number;
    readonly maxCollateralWritesPerAttempt: number;
  };
  readonly bootstrap: {
    readonly iterations: number;
    readonly confidenceLevel: number;
    readonly seed: string;
  };
  readonly successCriteria: {
    readonly minimumStrictCompletionLift: number;
    readonly minimumReliableTaskSuccessRate: number;
    readonly requirePositiveCiLowerBound: boolean;
    /** Absolute ceilings prevent a zero-success control from hiding unusable economics. */
    readonly maximumCostUsdPerStrictSuccess: number;
    readonly maximumLatencyMsPerStrictSuccess: number;
    /** Relative ceilings apply when both substrate and the stronger control succeed. */
    readonly maximumCostPerStrictSuccessRatio: number;
    readonly maximumLatencyPerStrictSuccessRatio: number;
  };
  readonly manifestHash: string;
}

export type PublicEvalAnalysisManifestInput = Omit<
  PublicEvalAnalysisManifest,
  "schemaVersion" | "manifestHash"
>;

export interface PublicEvalAttemptOutcome {
  /** Only this benchmark-owned oracle result counts as task success. */
  readonly strictTaskSuccess: boolean;
  readonly oracleReceiptHash: string;
  /** Diagnostic governance counts. They are never converted into successes. */
  readonly blockedActionCount: number;
  readonly falseBlockedActionCount: number;
  readonly collateralWriteCount: number;
  readonly costUsd: number;
  readonly latencyMs: number;
}

export interface PublicEvalAttemptArtifact {
  readonly schemaVersion: "pm.public-eval.attempt-outcome.v2";
  readonly manifestHash: string;
  readonly experimentId: string;
  readonly benchmarkId: string;
  readonly benchmarkRevision: string;
  readonly harnessRevision: string;
  readonly substrateRevision: string;
  readonly modelId: string;
  readonly modelDigest: string;
  readonly nonModelConfigHash: string;
  readonly phase: PublicEvalPhase;
  readonly taskId: string;
  readonly repeatIndex: number;
  readonly seed: string;
  readonly arm: PublicEvalArm;
  readonly armInterventionHash: string;
  readonly armBindingHash: string;
  readonly armOrderPosition: number;
  readonly initialEnvironmentSnapshotHash: string;
  /** Same for native/sham/substrate in one exact task-repeat trio. */
  readonly attemptGroupId: string;
  /** Globally unique receipt identity; different for every arm. */
  readonly attemptId: string;
  /** Hash of all execution inputs that must remain identical across arms. */
  readonly executionBindingHash: string;
  readonly startedAt: string;
  readonly completedAt: string;
  /** Merkle/content root of adapter-owned raw trajectory and environment files. */
  readonly rawArtifactRootHash: string;
  /** Content hash of provider/token/latency usage material checked by the verifier. */
  readonly usageReceiptHash: string;
  readonly outcome: PublicEvalAttemptOutcome;
  readonly artifactHash: string;
}

export type PublicEvalAttemptArtifactInput = Omit<
  PublicEvalAttemptArtifact,
  "schemaVersion" | "artifactHash"
>;

const MANIFEST_SCHEMA = "pm.public-eval.analysis-manifest.v3" as const;
const ATTEMPT_SCHEMA = "pm.public-eval.attempt-outcome.v2" as const;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const IMMUTABLE_REVISION = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const ARMS = new Set<string>(PUBLIC_EVAL_ARMS);
const PHASES = new Set<string>(PUBLIC_EVAL_PHASES);
const MINIMUM_BOOTSTRAP_ITERATIONS = 10_000;
const MINIMUM_CONFIDENCE_LEVEL = 0.95;
const PROTOCOL_MINIMUM_STRICT_COMPLETION_LIFT = 0.1;
const PROTOCOL_MINIMUM_RELIABLE_TASK_SUCCESS_RATE = 0.5;
const PROTOCOL_MAXIMUM_RELATIVE_ECONOMICS_RATIO = 1.25;
const PROTOCOL_MAXIMUM_COST_USD_PER_STRICT_SUCCESS = 10;
const PROTOCOL_MAXIMUM_LATENCY_MS_PER_STRICT_SUCCESS = 300_000;

export function createPublicEvalAnalysisManifest(
  input: PublicEvalAnalysisManifestInput,
): PublicEvalAnalysisManifest {
  const payload = jsonSnapshot({
    schemaVersion: MANIFEST_SCHEMA,
    ...input,
  }) as Omit<PublicEvalAnalysisManifest, "manifestHash">;
  return parsePublicEvalAnalysisManifest({
    ...payload,
    manifestHash: sha256Json(payload),
  });
}

export function createPublicEvalAttemptArtifact(
  input: PublicEvalAttemptArtifactInput,
): PublicEvalAttemptArtifact {
  const payload = jsonSnapshot({
    schemaVersion: ATTEMPT_SCHEMA,
    ...input,
  }) as Omit<PublicEvalAttemptArtifact, "artifactHash">;
  return parsePublicEvalAttemptArtifact({
    ...payload,
    artifactHash: sha256Json(payload),
  });
}

export function publicEvalSelectionDigest(
  selectionSeed: string,
  benchmarkTaskContentHash: string,
): string {
  return sha256Json({
    schemaVersion: "pm.public-eval.task-selection.v1",
    algorithm: "sha256-rank-v1",
    selectionSeed,
    benchmarkTaskContentHash,
  });
}

export function publicEvalExpectedArmOrder(
  manifest: PublicEvalAnalysisManifest,
  task: PublicEvalTaskPlanEntry,
  repeatIndex: number,
): readonly PublicEvalArm[] {
  const seed = task.predeclaredSeeds[repeatIndex];
  if (seed === undefined) throw new Error(`repeatIndex is invalid for ${task.taskId}`);
  return [...PUBLIC_EVAL_ARMS].sort((left, right) =>
    codeUnitCompare(
      sha256Json({
        algorithm: manifest.execution.randomization.algorithm,
        randomizationSeed: manifest.execution.randomization.seed,
        taskContentHash: task.taskContentHash,
        seed,
        arm: left,
      }),
      sha256Json({
        algorithm: manifest.execution.randomization.algorithm,
        randomizationSeed: manifest.execution.randomization.seed,
        taskContentHash: task.taskContentHash,
        seed,
        arm: right,
      }),
    ),
  );
}

export function publicEvalExecutionBindingHash(
  manifest: PublicEvalAnalysisManifest,
  task: PublicEvalTaskPlanEntry,
  repeatIndex: number,
): string {
  return sha256Json({
    schemaVersion: "pm.public-eval.execution-binding.v2",
    manifestHash: manifest.manifestHash,
    benchmarkTaskContentHash: task.benchmarkTaskContentHash,
    taskContentHash: task.taskContentHash,
    variant: task.variant,
    mutationHash: task.mutationHash,
    phase: task.phase,
    repeatIndex,
    seed: task.predeclaredSeeds[repeatIndex],
    modelId: manifest.execution.modelIds[task.phase],
    modelDigest: manifest.execution.modelDigests[task.phase],
    nonModelConfigHash: manifest.execution.nonModelConfigHashes[task.phase],
    initialEnvironmentSnapshotHash: task.initialEnvironmentSnapshotHash,
    armOrder: publicEvalExpectedArmOrder(manifest, task, repeatIndex),
  });
}

export function publicEvalArmBindingHash(
  manifest: PublicEvalAnalysisManifest,
  task: PublicEvalTaskPlanEntry,
  repeatIndex: number,
  entryArm: PublicEvalArm,
): string {
  return sha256Json({
    schemaVersion: "pm.public-eval.arm-binding.v1",
    executionBindingHash: publicEvalExecutionBindingHash(
      manifest,
      task,
      repeatIndex,
    ),
    arm: entryArm,
    armPlan: manifest.execution.arms[entryArm],
    armOrderPosition: publicEvalExpectedArmOrder(
      manifest,
      task,
      repeatIndex,
    ).indexOf(entryArm),
  });
}

export function parsePublicEvalAnalysisManifest(
  value: unknown,
): PublicEvalAnalysisManifest {
  const root = record(value, "manifest");
  exactKeys(root, [
    "schemaVersion",
    "experimentId",
    "producerIdentity",
    "benchmark",
    "execution",
    "decisionVerification",
    "frozenAt",
    "taskPlan",
    "guardrails",
    "bootstrap",
    "successCriteria",
    "manifestHash",
  ], "manifest");
  literal(root["schemaVersion"], MANIFEST_SCHEMA, "manifest.schemaVersion");
  const experimentId = portableId(root["experimentId"], "manifest.experimentId");
  const producerIdentity = portableId(
    root["producerIdentity"],
    "manifest.producerIdentity",
  );
  const benchmark = parseBenchmark(root["benchmark"]);
  const execution = parseExecution(root["execution"]);
  const decisionVerification = parseDecisionVerification(
    root["decisionVerification"],
  );
  const frozenAt = timestamp(root["frozenAt"], "manifest.frozenAt");
  const taskPlan = parseTaskPlan(root["taskPlan"], benchmark);
  validatePhaseTaskSeparation(taskPlan);
  validateDeterministicDecisionSelection(taskPlan, benchmark);
  const guardrails = parseGuardrails(root["guardrails"]);
  const bootstrap = parseBootstrap(root["bootstrap"]);
  const successCriteria = parseSuccessCriteria(root["successCriteria"]);
  const manifestHash = sha(root["manifestHash"], "manifest.manifestHash");
  const parsed: PublicEvalAnalysisManifest = {
    schemaVersion: MANIFEST_SCHEMA,
    experimentId,
    producerIdentity,
    benchmark,
    execution,
    decisionVerification,
    frozenAt,
    taskPlan,
    guardrails,
    bootstrap,
    successCriteria,
    manifestHash,
  };
  const expectedHash = sha256Json(withoutKey(parsed, "manifestHash"));
  if (manifestHash !== expectedHash) {
    throw new Error(
      `manifest.manifestHash mismatch: ${manifestHash} != ${expectedHash}`,
    );
  }
  return deepFreeze(parsed);
}

function validatePhaseTaskSeparation(
  taskPlan: readonly PublicEvalTaskPlanEntry[],
): void {
  const included = taskPlan.filter((task) => task.status === "included");
  for (const entryPhase of PUBLIC_EVAL_PHASES) {
    const canonicalIds = included
      .filter((task) => task.phase === entryPhase)
      .map((task) => task.benchmarkTaskContentHash);
    if (new Set(canonicalIds).size !== canonicalIds.length) {
      throw new Error(
        `${entryPhase} contains duplicate canonical task identities`,
      );
    }
  }
  const qualificationIds = new Set(
    included
      .filter((task) => task.phase === "qualification")
      .map((task) => task.benchmarkTaskContentHash),
  );
  const decisionIds = new Set(
    included
      .filter((task) => task.phase !== "qualification")
      .map((task) => task.benchmarkTaskContentHash),
  );
  const leaked = [...qualificationIds].filter((id) => decisionIds.has(id));
  if (leaked.length > 0) {
    throw new Error(
      `qualification tasks leak into held-out decision phases: ${leaked.sort().join(", ")}`,
    );
  }

  const confirmatory = included.filter((task) => task.phase === "confirmatory");
  const replication = included.filter((task) => task.phase === "replication");
  if (confirmatory.length === 0 || replication.length === 0) return;
  const confirmByCanonical = new Map(
    confirmatory.map((task) => [task.benchmarkTaskContentHash, task]),
  );
  const replicateByCanonical = new Map(
    replication.map((task) => [task.benchmarkTaskContentHash, task]),
  );
  const confirmIds = [...confirmByCanonical.keys()].sort();
  const replicateIds = [...replicateByCanonical.keys()].sort();
  if (JSON.stringify(confirmIds) !== JSON.stringify(replicateIds)) {
    throw new Error(
      "model replication must use the exact confirmatory canonical task set",
    );
  }
  for (const canonicalTaskId of confirmIds) {
    const confirmTask = confirmByCanonical.get(canonicalTaskId)!;
    const replicateTask = replicateByCanonical.get(canonicalTaskId)!;
    const confirmSeeds = confirmTask.predeclaredSeeds;
    const replicateSeeds = replicateTask.predeclaredSeeds;
    if (
      confirmTask.taskContentHash !== replicateTask.taskContentHash ||
      confirmTask.variant !== replicateTask.variant ||
      confirmTask.mutationHash !== replicateTask.mutationHash ||
      confirmTask.initialEnvironmentSnapshotHash !==
        replicateTask.initialEnvironmentSnapshotHash
    ) {
      throw new Error(
        `model replication task content or environment differs for ${canonicalTaskId}`,
      );
    }
    if (JSON.stringify(confirmSeeds) !== JSON.stringify(replicateSeeds)) {
      throw new Error(
        `model replication seed schedule differs for ${canonicalTaskId}`,
      );
    }
  }
}

function validateDeterministicDecisionSelection(
  taskPlan: readonly PublicEvalTaskPlanEntry[],
  benchmark: PublicEvalAnalysisManifest["benchmark"],
): void {
  const universe = benchmark.eligibleUniverse;
  const expected = [...universe.taskContentHashes]
    .map((benchmarkTaskContentHash) => ({
      benchmarkTaskContentHash,
      rank: publicEvalSelectionDigest(
        universe.selectionSeed,
        benchmarkTaskContentHash,
      ),
    }))
    .sort((left, right) => {
      const byRank = codeUnitCompare(left.rank, right.rank);
      return byRank === 0
        ? codeUnitCompare(
            left.benchmarkTaskContentHash,
            right.benchmarkTaskContentHash,
          )
        : byRank;
    })
    .slice(0, universe.selectionCount)
    .map((entry) => entry.benchmarkTaskContentHash)
    .sort(codeUnitCompare);

  for (const entryPhase of ["confirmatory", "replication"] as const) {
    const declared = taskPlan.filter((task) => task.phase === entryPhase);
    if (declared.length === 0) continue;
    const included = declared
      .filter((task) => task.status === "included")
      .map((task) => task.benchmarkTaskContentHash)
      .sort(codeUnitCompare);
    if (JSON.stringify(included) !== JSON.stringify(expected)) {
      throw new Error(
        `${entryPhase} included tasks must equal the deterministic top-ranked ` +
          `${universe.selectionCount} eligible-universe tasks`,
      );
    }
  }
}

export function parsePublicEvalAttemptArtifact(
  value: unknown,
): PublicEvalAttemptArtifact {
  const root = record(value, "attempt");
  exactKeys(root, [
    "schemaVersion",
    "manifestHash",
    "experimentId",
    "benchmarkId",
    "benchmarkRevision",
    "harnessRevision",
    "substrateRevision",
    "modelId",
    "modelDigest",
    "nonModelConfigHash",
    "phase",
    "taskId",
    "repeatIndex",
    "seed",
    "arm",
    "armInterventionHash",
    "armBindingHash",
    "armOrderPosition",
    "initialEnvironmentSnapshotHash",
    "attemptGroupId",
    "attemptId",
    "executionBindingHash",
    "startedAt",
    "completedAt",
    "rawArtifactRootHash",
    "usageReceiptHash",
    "outcome",
    "artifactHash",
  ], "attempt");
  literal(root["schemaVersion"], ATTEMPT_SCHEMA, "attempt.schemaVersion");
  const parsed: PublicEvalAttemptArtifact = {
    schemaVersion: ATTEMPT_SCHEMA,
    manifestHash: sha(root["manifestHash"], "attempt.manifestHash"),
    experimentId: portableId(root["experimentId"], "attempt.experimentId"),
    benchmarkId: portableId(root["benchmarkId"], "attempt.benchmarkId"),
    benchmarkRevision: nonEmpty(root["benchmarkRevision"], "attempt.benchmarkRevision"),
    harnessRevision: sha(root["harnessRevision"], "attempt.harnessRevision"),
    substrateRevision: sha(root["substrateRevision"], "attempt.substrateRevision"),
    modelId: nonEmpty(root["modelId"], "attempt.modelId"),
    modelDigest: sha(root["modelDigest"], "attempt.modelDigest"),
    nonModelConfigHash: sha(
      root["nonModelConfigHash"],
      "attempt.nonModelConfigHash",
    ),
    phase: phase(root["phase"], "attempt.phase"),
    taskId: portableId(root["taskId"], "attempt.taskId"),
    repeatIndex: integer(root["repeatIndex"], "attempt.repeatIndex", 0),
    seed: nonEmpty(root["seed"], "attempt.seed"),
    arm: arm(root["arm"], "attempt.arm"),
    armInterventionHash: sha(
      root["armInterventionHash"],
      "attempt.armInterventionHash",
    ),
    armBindingHash: sha(root["armBindingHash"], "attempt.armBindingHash"),
    armOrderPosition: integer(
      root["armOrderPosition"],
      "attempt.armOrderPosition",
      0,
    ),
    initialEnvironmentSnapshotHash: sha(
      root["initialEnvironmentSnapshotHash"],
      "attempt.initialEnvironmentSnapshotHash",
    ),
    attemptGroupId: portableId(
      root["attemptGroupId"],
      "attempt.attemptGroupId",
    ),
    attemptId: portableId(root["attemptId"], "attempt.attemptId"),
    executionBindingHash: sha(
      root["executionBindingHash"],
      "attempt.executionBindingHash",
    ),
    startedAt: timestamp(root["startedAt"], "attempt.startedAt"),
    completedAt: timestamp(root["completedAt"], "attempt.completedAt"),
    rawArtifactRootHash: sha(
      root["rawArtifactRootHash"],
      "attempt.rawArtifactRootHash",
    ),
    usageReceiptHash: sha(
      root["usageReceiptHash"],
      "attempt.usageReceiptHash",
    ),
    outcome: parseOutcome(root["outcome"]),
    artifactHash: sha(root["artifactHash"], "attempt.artifactHash"),
  };
  if (Date.parse(parsed.completedAt) < Date.parse(parsed.startedAt)) {
    throw new Error(`attempt ${parsed.attemptId} completed before it started`);
  }
  if (parsed.armOrderPosition >= PUBLIC_EVAL_ARMS.length) {
    throw new Error(`attempt ${parsed.attemptId} armOrderPosition is invalid`);
  }
  const expectedHash = sha256Json(withoutKey(parsed, "artifactHash"));
  if (parsed.artifactHash !== expectedHash) {
    throw new Error(
      `attempt.artifactHash mismatch for ${parsed.attemptId}: ` +
        `${parsed.artifactHash} != ${expectedHash}`,
    );
  }
  return deepFreeze(parsed);
}

function parseBenchmark(value: unknown): PublicEvalAnalysisManifest["benchmark"] {
  const item = record(value, "manifest.benchmark");
  exactKeys(
    item,
    [
      "benchmarkId",
      "repositoryUrl",
      "revision",
      "licenseSpdx",
      "splitId",
      "corpusHash",
      "eligibleUniverse",
    ],
    "manifest.benchmark",
  );
  const eligibleUniverse = parseEligibleUniverse(item["eligibleUniverse"]);
  return {
    benchmarkId: portableId(item["benchmarkId"], "manifest.benchmark.benchmarkId"),
    repositoryUrl: httpsUrl(
      item["repositoryUrl"],
      "manifest.benchmark.repositoryUrl",
    ),
    revision: immutableRevision(
      item["revision"],
      "manifest.benchmark.revision",
    ),
    licenseSpdx: portableId(
      item["licenseSpdx"],
      "manifest.benchmark.licenseSpdx",
    ),
    splitId: portableId(item["splitId"], "manifest.benchmark.splitId"),
    corpusHash: sha(item["corpusHash"], "manifest.benchmark.corpusHash"),
    eligibleUniverse,
  };
}

function parseExecution(value: unknown): PublicEvalAnalysisManifest["execution"] {
  const item = record(value, "manifest.execution");
  exactKeys(
    item,
    [
      "harnessRevision",
      "substrateRevision",
      "replicationAxis",
      "modelIds",
      "modelDigests",
      "nonModelConfigHashes",
      "nonModelComponents",
      "arms",
      "randomization",
    ],
    "manifest.execution",
  );
  literal(item["replicationAxis"], "model", "manifest.execution.replicationAxis");
  const models = record(item["modelIds"], "manifest.execution.modelIds");
  exactKeys(models, PUBLIC_EVAL_PHASES, "manifest.execution.modelIds");
  const modelIds = Object.fromEntries(
    PUBLIC_EVAL_PHASES.map((entryPhase) => [
      entryPhase,
      nonEmpty(models[entryPhase], `manifest.execution.modelIds.${entryPhase}`),
    ]),
  ) as Record<PublicEvalPhase, string>;
  const modelDigests = phaseShaRecord(
    item["modelDigests"],
    "manifest.execution.modelDigests",
  );
  const nonModelConfigHashes = phaseShaRecord(
    item["nonModelConfigHashes"],
    "manifest.execution.nonModelConfigHashes",
  );
  const nonModelComponents = parseNonModelComponents(
    item["nonModelComponents"],
  );
  const arms = parseArmPlans(item["arms"]);
  const randomization = parseRandomization(item["randomization"]);
  for (const entryPhase of PUBLIC_EVAL_PHASES) {
    const expectedConfigHash = sha256Json({
      schemaVersion: "pm.public-eval.non-model-config.v1",
      ...nonModelComponents[entryPhase],
    });
    if (nonModelConfigHashes[entryPhase] !== expectedConfigHash) {
      throw new Error(
        `manifest.execution.nonModelConfigHashes.${entryPhase} does not match its component hashes`,
      );
    }
  }
  if (
    modelIds.confirmatory === modelIds.replication ||
    modelDigests.confirmatory === modelDigests.replication
  ) {
    throw new Error(
      "manifest execution requires a replication model id and digest distinct from confirmation",
    );
  }
  if (nonModelConfigHashes.confirmatory !== nonModelConfigHashes.replication) {
    throw new Error(
      "model replication requires identical non-model configuration for confirmation and replication",
    );
  }
  return {
    harnessRevision: sha(
      item["harnessRevision"],
      "manifest.execution.harnessRevision",
    ),
    substrateRevision: sha(
      item["substrateRevision"],
      "manifest.execution.substrateRevision",
    ),
    replicationAxis: "model",
    modelIds,
    modelDigests,
    nonModelConfigHashes,
    nonModelComponents,
    arms,
    randomization,
  };
}

function parseEligibleUniverse(
  value: unknown,
): PublicEvalAnalysisManifest["benchmark"]["eligibleUniverse"] {
  const item = record(value, "manifest.benchmark.eligibleUniverse");
  exactKeys(
    item,
    [
      "rootHash",
      "taskContentHashes",
      "selectionAlgorithm",
      "selectionSeed",
      "selectionCount",
    ],
    "manifest.benchmark.eligibleUniverse",
  );
  if (!Array.isArray(item["taskContentHashes"]) || item["taskContentHashes"].length === 0) {
    throw new Error("manifest.benchmark.eligibleUniverse.taskContentHashes must be non-empty");
  }
  const taskContentHashes = item["taskContentHashes"].map((entry, index) =>
    sha(entry, `manifest.benchmark.eligibleUniverse.taskContentHashes/${index}`),
  );
  const sorted = [...taskContentHashes].sort(codeUnitCompare);
  if (
    new Set(taskContentHashes).size !== taskContentHashes.length ||
    JSON.stringify(taskContentHashes) !== JSON.stringify(sorted)
  ) {
    throw new Error(
      "manifest.benchmark.eligibleUniverse.taskContentHashes must be unique and code-unit sorted",
    );
  }
  literal(
    item["selectionAlgorithm"],
    "sha256-rank-v1",
    "manifest.benchmark.eligibleUniverse.selectionAlgorithm",
  );
  const rootHash = sha(
    item["rootHash"],
    "manifest.benchmark.eligibleUniverse.rootHash",
  );
  const expectedRoot = sha256Json({
    schemaVersion: "pm.public-eval.eligible-universe.v1",
    taskContentHashes,
  });
  if (rootHash !== expectedRoot) {
    throw new Error("manifest.benchmark.eligibleUniverse.rootHash mismatch");
  }
  const selectionCount = integer(
    item["selectionCount"],
    "manifest.benchmark.eligibleUniverse.selectionCount",
    0,
  );
  if (selectionCount > taskContentHashes.length) {
    throw new Error(
      "manifest.benchmark.eligibleUniverse.selectionCount exceeds the universe",
    );
  }
  return {
    rootHash,
    taskContentHashes,
    selectionAlgorithm: "sha256-rank-v1",
    selectionSeed: nonEmpty(
      item["selectionSeed"],
      "manifest.benchmark.eligibleUniverse.selectionSeed",
    ),
    selectionCount,
  };
}

function parseArmPlans(
  value: unknown,
): PublicEvalAnalysisManifest["execution"]["arms"] {
  const plans = record(value, "manifest.execution.arms");
  exactKeys(plans, PUBLIC_EVAL_ARMS, "manifest.execution.arms");
  const modes = {
    native: "native",
    sham: "irrelevant_sham",
    substrate: "pm_substrate",
  } as const;
  const parsed = Object.fromEntries(
    PUBLIC_EVAL_ARMS.map((entryArm) => {
      const path = `manifest.execution.arms.${entryArm}`;
      const plan = record(plans[entryArm], path);
      exactKeys(
        plan,
        [
          "stateMode",
          "interventionHash",
          "implementationRevision",
          "sidecarShapeHash",
          "expectedToolCalls",
          "expectedPromptTokens",
          "expectedAddedLatencyMs",
        ],
        path,
      );
      literal(plan["stateMode"], modes[entryArm], `${path}.stateMode`);
      return [
        entryArm,
        {
          stateMode: modes[entryArm],
          interventionHash: sha(plan["interventionHash"], `${path}.interventionHash`),
          implementationRevision: sha(
            plan["implementationRevision"],
            `${path}.implementationRevision`,
          ),
          sidecarShapeHash: sha(plan["sidecarShapeHash"], `${path}.sidecarShapeHash`),
          expectedToolCalls: integer(plan["expectedToolCalls"], `${path}.expectedToolCalls`, 0),
          expectedPromptTokens: integer(
            plan["expectedPromptTokens"],
            `${path}.expectedPromptTokens`,
            0,
          ),
          expectedAddedLatencyMs: nonNegativeFinite(
            plan["expectedAddedLatencyMs"],
            `${path}.expectedAddedLatencyMs`,
          ),
        },
      ];
    }),
  ) as PublicEvalAnalysisManifest["execution"]["arms"];
  if (new Set(PUBLIC_EVAL_ARMS.map((entryArm) => parsed[entryArm].interventionHash)).size !== 3) {
    throw new Error("manifest execution requires distinct arm intervention hashes");
  }
  for (const key of [
    "sidecarShapeHash",
    "expectedToolCalls",
    "expectedPromptTokens",
    "expectedAddedLatencyMs",
  ] as const) {
    if (parsed.sham[key] !== parsed.substrate[key]) {
      throw new Error(`sham and substrate ${key} must match for equal overhead`);
    }
  }
  return parsed;
}

function parseRandomization(
  value: unknown,
): PublicEvalAnalysisManifest["execution"]["randomization"] {
  const item = record(value, "manifest.execution.randomization");
  exactKeys(item, ["algorithm", "seed"], "manifest.execution.randomization");
  literal(
    item["algorithm"],
    "sha256-arm-order-v1",
    "manifest.execution.randomization.algorithm",
  );
  return {
    algorithm: "sha256-arm-order-v1",
    seed: nonEmpty(item["seed"], "manifest.execution.randomization.seed"),
  };
}

function parseNonModelComponents(
  value: unknown,
): PublicEvalAnalysisManifest["execution"]["nonModelComponents"] {
  const phases = record(value, "manifest.execution.nonModelComponents");
  exactKeys(
    phases,
    PUBLIC_EVAL_PHASES,
    "manifest.execution.nonModelComponents",
  );
  const componentKeys = [
    "systemPromptHash",
    "toolsHash",
    "simulatorHash",
    "judgeHash",
    "decodingHash",
    "runnerHash",
  ] as const;
  return Object.fromEntries(
    PUBLIC_EVAL_PHASES.map((entryPhase) => {
      const path = `manifest.execution.nonModelComponents.${entryPhase}`;
      const components = record(phases[entryPhase], path);
      exactKeys(components, componentKeys, path);
      return [
        entryPhase,
        Object.fromEntries(
          componentKeys.map((key) => [
            key,
            sha(components[key], `${path}.${key}`),
          ]),
        ),
      ];
    }),
  ) as PublicEvalAnalysisManifest["execution"]["nonModelComponents"];
}

function parseDecisionVerification(
  value: unknown,
): PublicEvalAnalysisManifest["decisionVerification"] {
  const item = record(value, "manifest.decisionVerification");
  exactKeys(
    item,
    PUBLIC_EVAL_VERIFICATION_KINDS,
    "manifest.decisionVerification",
  );
  return Object.fromEntries(
    PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => {
      const verifier = record(
        item[kind],
        `manifest.decisionVerification.${kind}`,
      );
      exactKeys(
        verifier,
        ["verifierId", "sourceRevision"],
        `manifest.decisionVerification.${kind}`,
      );
      return [
        kind,
        {
          verifierId: portableId(
            verifier["verifierId"],
            `manifest.decisionVerification.${kind}.verifierId`,
          ),
          sourceRevision: sha(
            verifier["sourceRevision"],
            `manifest.decisionVerification.${kind}.sourceRevision`,
          ),
        },
      ];
    }),
  ) as PublicEvalAnalysisManifest["decisionVerification"];
}

function phaseShaRecord(
  value: unknown,
  path: string,
): Readonly<Record<PublicEvalPhase, string>> {
  const entries = record(value, path);
  exactKeys(entries, PUBLIC_EVAL_PHASES, path);
  return Object.fromEntries(
    PUBLIC_EVAL_PHASES.map((entryPhase) => [
      entryPhase,
      sha(entries[entryPhase], `${path}.${entryPhase}`),
    ]),
  ) as Record<PublicEvalPhase, string>;
}

function parseTaskPlan(
  value: unknown,
  benchmark: PublicEvalAnalysisManifest["benchmark"],
): readonly PublicEvalTaskPlanEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("manifest.taskPlan must be a non-empty array");
  }
  const seen = new Set<string>();
  let included = 0;
  const entries = value.map((raw, index): PublicEvalTaskPlanEntry => {
    const path = `manifest.taskPlan/${index}`;
    const item = record(raw, path);
    const status = enumValue(
      item["status"],
      new Set<"included" | "excluded_pre_run">([
        "included",
        "excluded_pre_run",
      ]),
      `${path}.status`,
    );
    const commonKeys = [
      "taskId",
      "canonicalTaskId",
      "benchmarkTaskLocator",
      "benchmarkTaskContentHash",
      "taskContentHash",
      "variant",
      "mutationHash",
      "phase",
      "predeclaredSeeds",
      "selectionDigest",
      "eligibleUniverseMembershipProof",
      "initialEnvironmentSnapshotHash",
      "status",
    ];
    exactKeys(
      item,
      status === "included"
        ? commonKeys
        : [...commonKeys, "exclusionReason"],
      path,
    );
    const taskId = portableId(item["taskId"], `${path}.taskId`);
    if (seen.has(taskId)) {
      throw new Error(`manifest.taskPlan duplicates taskId ${taskId}`);
    }
    seen.add(taskId);
    const benchmarkTaskContentHash = sha(
      item["benchmarkTaskContentHash"],
      `${path}.benchmarkTaskContentHash`,
    );
    const taskContentHash = sha(item["taskContentHash"], `${path}.taskContentHash`);
    const entryVariant = enumValue(
      item["variant"],
      new Set(PUBLIC_EVAL_TASK_VARIANTS),
      `${path}.variant`,
    );
    let mutationHash: string | null;
    if (entryVariant === "original") {
      if (item["mutationHash"] !== null || taskContentHash !== benchmarkTaskContentHash) {
        throw new Error(`${path} original task must preserve benchmark bytes and null mutationHash`);
      }
      mutationHash = null;
    } else {
      mutationHash = sha(item["mutationHash"], `${path}.mutationHash`);
      if (taskContentHash === benchmarkTaskContentHash) {
        throw new Error(`${path} derivative task must change the executed task content`);
      }
    }
    const proof = record(
      item["eligibleUniverseMembershipProof"],
      `${path}.eligibleUniverseMembershipProof`,
    );
    exactKeys(
      proof,
      ["inventoryIndex", "inventoryRootHash", "benchmarkTaskContentHash"],
      `${path}.eligibleUniverseMembershipProof`,
    );
    const inventoryIndex = integer(
      proof["inventoryIndex"],
      `${path}.eligibleUniverseMembershipProof.inventoryIndex`,
      0,
    );
    if (
      proof["inventoryRootHash"] !== benchmark.eligibleUniverse.rootHash ||
      proof["benchmarkTaskContentHash"] !== benchmarkTaskContentHash ||
      benchmark.eligibleUniverse.taskContentHashes[inventoryIndex] !==
        benchmarkTaskContentHash
    ) {
      throw new Error(`${path} eligible-universe membership proof mismatch`);
    }
    const selectionDigest = sha(item["selectionDigest"], `${path}.selectionDigest`);
    const expectedSelectionDigest = publicEvalSelectionDigest(
      benchmark.eligibleUniverse.selectionSeed,
      benchmarkTaskContentHash,
    );
    if (selectionDigest !== expectedSelectionDigest) {
      throw new Error(`${path}.selectionDigest mismatch`);
    }
    const common: PublicEvalTaskPlanFields = {
      taskId,
      canonicalTaskId: portableId(
        item["canonicalTaskId"],
        `${path}.canonicalTaskId`,
      ),
      benchmarkTaskLocator: nonEmpty(
        item["benchmarkTaskLocator"],
        `${path}.benchmarkTaskLocator`,
      ),
      benchmarkTaskContentHash,
      taskContentHash,
      variant: entryVariant,
      mutationHash,
      phase: phase(item["phase"], `${path}.phase`),
      predeclaredSeeds: uniqueNonEmptyStrings(
        item["predeclaredSeeds"],
        `${path}.predeclaredSeeds`,
      ),
      selectionDigest,
      eligibleUniverseMembershipProof: {
        inventoryIndex,
        inventoryRootHash: benchmark.eligibleUniverse.rootHash,
        benchmarkTaskContentHash,
      },
      initialEnvironmentSnapshotHash: sha(
        item["initialEnvironmentSnapshotHash"],
        `${path}.initialEnvironmentSnapshotHash`,
      ),
    };
    if (status === "included") {
      included += 1;
      return { ...common, status };
    }
    return {
      ...common,
      status,
      exclusionReason: nonEmpty(item["exclusionReason"], `${path}.exclusionReason`),
    };
  });
  if (included === 0) throw new Error("manifest.taskPlan includes no runnable tasks");
  return entries;
}

function uniqueNonEmptyStrings(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }
  const parsed = value.map((entry, index) =>
    nonEmpty(entry, `${path}/${index}`),
  );
  if (new Set(parsed).size !== parsed.length) {
    throw new Error(`${path} must contain unique seeds`);
  }
  return parsed;
}

function parseGuardrails(
  value: unknown,
): PublicEvalAnalysisManifest["guardrails"] {
  const item = record(value, "manifest.guardrails");
  exactKeys(item, [
    "maxFalseBlockedActionsPerAttempt",
    "maxCollateralWritesPerAttempt",
  ], "manifest.guardrails");
  const maxFalseBlockedActionsPerAttempt = integer(
      item["maxFalseBlockedActionsPerAttempt"],
      "manifest.guardrails.maxFalseBlockedActionsPerAttempt",
      0,
    );
  const maxCollateralWritesPerAttempt = integer(
      item["maxCollateralWritesPerAttempt"],
      "manifest.guardrails.maxCollateralWritesPerAttempt",
      0,
    );
  if (
    maxFalseBlockedActionsPerAttempt !== 0 ||
    maxCollateralWritesPerAttempt !== 0
  ) {
    throw new Error(
      "public deterministic evaluation requires zero false blocks and collateral writes",
    );
  }
  return {
    maxFalseBlockedActionsPerAttempt,
    maxCollateralWritesPerAttempt,
  };
}

function parseBootstrap(value: unknown): PublicEvalAnalysisManifest["bootstrap"] {
  const item = record(value, "manifest.bootstrap");
  exactKeys(item, ["iterations", "confidenceLevel", "seed"], "manifest.bootstrap");
  const confidenceLevel = finite(item["confidenceLevel"], "manifest.bootstrap.confidenceLevel");
  if (confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error("manifest.bootstrap.confidenceLevel must be in (0, 1)");
  }
  if (confidenceLevel < MINIMUM_CONFIDENCE_LEVEL) {
    throw new Error(
      `manifest.bootstrap.confidenceLevel must be >= ${MINIMUM_CONFIDENCE_LEVEL}`,
    );
  }
  return {
    iterations: integer(
      item["iterations"],
      "manifest.bootstrap.iterations",
      MINIMUM_BOOTSTRAP_ITERATIONS,
    ),
    confidenceLevel,
    seed: nonEmpty(item["seed"], "manifest.bootstrap.seed"),
  };
}

function parseSuccessCriteria(
  value: unknown,
): PublicEvalAnalysisManifest["successCriteria"] {
  const item = record(value, "manifest.successCriteria");
  exactKeys(item, [
    "minimumStrictCompletionLift",
    "minimumReliableTaskSuccessRate",
    "requirePositiveCiLowerBound",
    "maximumCostUsdPerStrictSuccess",
    "maximumLatencyMsPerStrictSuccess",
    "maximumCostPerStrictSuccessRatio",
    "maximumLatencyPerStrictSuccessRatio",
  ], "manifest.successCriteria");
  const lift = finite(
    item["minimumStrictCompletionLift"],
    "manifest.successCriteria.minimumStrictCompletionLift",
  );
  const reliable = finite(
    item["minimumReliableTaskSuccessRate"],
    "manifest.successCriteria.minimumReliableTaskSuccessRate",
  );
  if (lift < PROTOCOL_MINIMUM_STRICT_COMPLETION_LIFT || lift > 1) {
    throw new Error(
      `minimumStrictCompletionLift must be in [${PROTOCOL_MINIMUM_STRICT_COMPLETION_LIFT}, 1]`,
    );
  }
  if (reliable < PROTOCOL_MINIMUM_RELIABLE_TASK_SUCCESS_RATE || reliable > 1) {
    throw new Error(
      `minimumReliableTaskSuccessRate must be in [${PROTOCOL_MINIMUM_RELIABLE_TASK_SUCCESS_RATE}, 1]`,
    );
  }
  const maximumCostUsdPerStrictSuccess = nonNegativeFinite(
    item["maximumCostUsdPerStrictSuccess"],
    "manifest.successCriteria.maximumCostUsdPerStrictSuccess",
  );
  const maximumLatencyMsPerStrictSuccess = nonNegativeFinite(
    item["maximumLatencyMsPerStrictSuccess"],
    "manifest.successCriteria.maximumLatencyMsPerStrictSuccess",
  );
  const maximumCostPerStrictSuccessRatio = nonNegativeFinite(
    item["maximumCostPerStrictSuccessRatio"],
    "manifest.successCriteria.maximumCostPerStrictSuccessRatio",
  );
  const maximumLatencyPerStrictSuccessRatio = nonNegativeFinite(
    item["maximumLatencyPerStrictSuccessRatio"],
    "manifest.successCriteria.maximumLatencyPerStrictSuccessRatio",
  );
  const requirePositiveCiLowerBound = bool(
    item["requirePositiveCiLowerBound"],
    "manifest.successCriteria.requirePositiveCiLowerBound",
  );
  if (!requirePositiveCiLowerBound) {
    throw new Error("requirePositiveCiLowerBound must be true for public decisions");
  }
  if (
    maximumCostPerStrictSuccessRatio >
    PROTOCOL_MAXIMUM_RELATIVE_ECONOMICS_RATIO
  ) {
    throw new Error(
      `maximumCostPerStrictSuccessRatio must be <= ${PROTOCOL_MAXIMUM_RELATIVE_ECONOMICS_RATIO}`,
    );
  }
  if (
    maximumCostUsdPerStrictSuccess >
    PROTOCOL_MAXIMUM_COST_USD_PER_STRICT_SUCCESS
  ) {
    throw new Error(
      `maximumCostUsdPerStrictSuccess must be <= ${PROTOCOL_MAXIMUM_COST_USD_PER_STRICT_SUCCESS}`,
    );
  }
  if (
    maximumLatencyMsPerStrictSuccess >
    PROTOCOL_MAXIMUM_LATENCY_MS_PER_STRICT_SUCCESS
  ) {
    throw new Error(
      `maximumLatencyMsPerStrictSuccess must be <= ${PROTOCOL_MAXIMUM_LATENCY_MS_PER_STRICT_SUCCESS}`,
    );
  }
  if (
    maximumLatencyPerStrictSuccessRatio >
    PROTOCOL_MAXIMUM_RELATIVE_ECONOMICS_RATIO
  ) {
    throw new Error(
      `maximumLatencyPerStrictSuccessRatio must be <= ${PROTOCOL_MAXIMUM_RELATIVE_ECONOMICS_RATIO}`,
    );
  }
  return {
    minimumStrictCompletionLift: lift,
    minimumReliableTaskSuccessRate: reliable,
    requirePositiveCiLowerBound,
    maximumCostUsdPerStrictSuccess,
    maximumLatencyMsPerStrictSuccess,
    maximumCostPerStrictSuccessRatio,
    maximumLatencyPerStrictSuccessRatio,
  };
}

function parseOutcome(value: unknown): PublicEvalAttemptOutcome {
  const item = record(value, "attempt.outcome");
  exactKeys(item, [
    "strictTaskSuccess",
    "oracleReceiptHash",
    "blockedActionCount",
    "falseBlockedActionCount",
    "collateralWriteCount",
    "costUsd",
    "latencyMs",
  ], "attempt.outcome");
  const blockedActionCount = integer(
    item["blockedActionCount"],
    "attempt.outcome.blockedActionCount",
    0,
  );
  const falseBlockedActionCount = integer(
    item["falseBlockedActionCount"],
    "attempt.outcome.falseBlockedActionCount",
    0,
  );
  if (falseBlockedActionCount > blockedActionCount) {
    throw new Error(
      "attempt.outcome.falseBlockedActionCount cannot exceed blockedActionCount",
    );
  }
  return {
    strictTaskSuccess: bool(
      item["strictTaskSuccess"],
      "attempt.outcome.strictTaskSuccess",
    ),
    oracleReceiptHash: sha(
      item["oracleReceiptHash"],
      "attempt.outcome.oracleReceiptHash",
    ),
    blockedActionCount,
    falseBlockedActionCount,
    collateralWriteCount: integer(
      item["collateralWriteCount"],
      "attempt.outcome.collateralWriteCount",
      0,
    ),
    costUsd: nonNegativeFinite(item["costUsd"], "attempt.outcome.costUsd"),
    latencyMs: nonNegativeFinite(item["latencyMs"], "attempt.outcome.latencyMs"),
  };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const expected = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new Error(`${path}.${key} is not allowed`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new Error(`${path}.${key} is required`);
  }
}

function nonEmpty(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function httpsUrl(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  let url: URL;
  try {
    url = new URL(parsed);
  } catch {
    throw new Error(`${path} must be an absolute URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      `${path} must be a credential-free HTTPS URL without query or fragment`,
    );
  }
  return parsed;
}

function portableId(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  if (!ID.test(parsed)) throw new Error(`${path} is not a portable identifier`);
  return parsed;
}

function immutableRevision(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  if (!IMMUTABLE_REVISION.test(parsed)) {
    throw new Error(`${path} must be a 40- or 64-character lowercase content revision`);
  }
  return parsed;
}

function sha(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be lowercase SHA-256`);
  return parsed;
}

function timestamp(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  const epoch = Date.parse(parsed);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== parsed) {
    throw new Error(`${path} must be a normalized ISO-8601 timestamp`);
  }
  return parsed;
}

function integer(value: unknown, path: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function nonNegativeFinite(value: unknown, path: string): number {
  const parsed = finite(value, path);
  if (parsed < 0) throw new Error(`${path} must be >= 0`);
  return parsed;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be boolean`);
  return value;
}

function literal<T extends string>(value: unknown, expected: T, path: string): T {
  if (value !== expected) throw new Error(`${path} must equal ${expected}`);
  return expected;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  path: string,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`${path} has unsupported value ${JSON.stringify(value)}`);
  }
  return value as T;
}

function arm(value: unknown, path: string): PublicEvalArm {
  return enumValue(value, ARMS as ReadonlySet<PublicEvalArm>, path);
}

function phase(value: unknown, path: string): PublicEvalPhase {
  return enumValue(value, PHASES as ReadonlySet<PublicEvalPhase>, path);
}

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalStringify(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot hash non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => codeUnitCompare(left, right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStringify(entry)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot hash unsupported JSON value ${typeof value}`);
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

/** Shared content hash for decision receipts; consumed by the decision gate. */
export function hashPublicEvalJson(value: unknown): string {
  return sha256Json(value);
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function jsonSnapshot(value: unknown): unknown {
  return JSON.parse(canonicalStringify(value)) as unknown;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

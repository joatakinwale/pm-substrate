import type { StateBenchArm, StateBenchDomain } from "./index.js";

export type StateBenchPhase =
  | "qualification"
  | "confirmatory"
  | "replication";

export interface StateBenchRunConfig {
  readonly schemaVersion: "pm-state-bench-run-config.v3";
  readonly experimentId: string;
  readonly phase: StateBenchPhase;
  readonly qualificationPlanHash: string | null;
  readonly analysisManifestHash: string | null;
  readonly preregistrationReceiptHash: string | null;
  readonly phasePartitionHash: string;
  readonly arm: StateBenchArm;
  readonly armInterventionHash: string;
  readonly domain: StateBenchDomain;
  readonly agentModel: {
    readonly modelId: string;
    readonly modelDigest: string;
    readonly reasoningLevel: "low" | "medium" | "high" | null;
  };
  readonly agentClass: "StateBenchAgent" | "PmSubstrateAgent";
  readonly split: "train" | "test";
  readonly numRuns: number;
  readonly taskIds: readonly string[];
  readonly taskSetHash: string;
  readonly taskInventoryRootHash: string;
  /** Pairing labels only. They do not claim control of provider sampling. */
  readonly runLabels: readonly string[];
  readonly repeatScheduleHash: string;
  readonly attemptScheduleHash: string;
  readonly nonModelConfigHash: string;
  readonly executionPolicyHash: string;
  readonly runtimeClosureHash: string;
  readonly retryPolicy: {
    readonly maxTaskAttempts: number;
    readonly maxProviderAttempts: number;
  };
  readonly retrieveLearningsTopK: 3 | null;
  readonly artifactSealHash: string | null;
  readonly extractionProvenanceHash: string | null;
}

interface StateBenchExecutionPlanDependencies {
  readonly sha256: (bytes: string | Buffer) => string;
  readonly canonical: (value: unknown) => string;
  readonly isObject: (
    value: unknown,
  ) => value is Readonly<Record<string, unknown>>;
  readonly exactKeys: (
    value: Readonly<Record<string, unknown>>,
    allowed: readonly string[],
    path: string,
  ) => void;
  readonly safeId: (value: unknown, path: string) => string;
  readonly shaValue: (value: unknown, path: string) => string;
  readonly domainValue: (value: unknown, path: string) => StateBenchDomain;
  readonly readJson: (path: string) => unknown;
  readonly assertVerifiedCheckout: (path: string) => string;
  readonly loadSplitManifest: (
    root: string,
    domain: StateBenchDomain,
  ) => {
    readonly train: readonly string[];
    readonly test: readonly string[];
  };
}

const CONFIG_KEYS = [
  "schemaVersion",
  "experimentId",
  "phase",
  "qualificationPlanHash",
  "analysisManifestHash",
  "preregistrationReceiptHash",
  "phasePartitionHash",
  "arm",
  "armInterventionHash",
  "domain",
  "agentModel",
  "agentClass",
  "split",
  "numRuns",
  "taskIds",
  "taskSetHash",
  "taskInventoryRootHash",
  "runLabels",
  "repeatScheduleHash",
  "attemptScheduleHash",
  "nonModelConfigHash",
  "executionPolicyHash",
  "runtimeClosureHash",
  "retryPolicy",
  "retrieveLearningsTopK",
  "artifactSealHash",
  "extractionProvenanceHash",
] as const;

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function positiveInteger(value: unknown, path: string, maximum: number): number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > maximum
  ) {
    throw new Error(`${path} must be an integer from 1 through ${maximum}`);
  }
  return value as number;
}

export function createStateBenchExecutionPlan(
  dependencies: StateBenchExecutionPlanDependencies,
) {
  const {
    sha256,
    canonical,
    isObject,
    exactKeys,
    safeId,
    shaValue,
    domainValue,
    readJson,
    assertVerifiedCheckout,
    loadSplitManifest,
  } = dependencies;

  function nullableSha(value: unknown, path: string): string | null {
    return value === null ? null : shaValue(value, path);
  }

  function idArray(
    value: unknown,
    path: string,
    requireSorted = true,
  ): readonly string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${path} must be a non-empty array`);
    }
    const parsed = value.map((entry, index) =>
      safeId(entry, `${path}[${index}]`),
    );
    if (new Set(parsed).size !== parsed.length) {
      throw new Error(`${path} must not contain duplicates`);
    }
    if (
      requireSorted &&
      canonical(parsed) !== canonical([...parsed].sort(codeUnitCompare))
    ) {
      throw new Error(`${path} must be code-unit sorted`);
    }
    return parsed;
  }

  function taskSetHash(
    domain: StateBenchDomain,
    split: "train" | "test",
    taskIds: readonly string[],
  ): string {
    return sha256(
      canonical({
        schemaVersion: "pm-state-bench-task-set.v1",
        domain,
        split,
        taskIds,
      }),
    );
  }

  function repeatScheduleHash(runLabels: readonly string[]): string {
    return sha256(
      canonical({
        schemaVersion: "pm-state-bench-repeat-schedule.v1",
        repeatLabels: runLabels,
      }),
    );
  }

  function parseRunConfig(value: unknown): StateBenchRunConfig {
    if (!isObject(value)) throw new Error("run config must be an object");
    exactKeys(value, CONFIG_KEYS, "run config");
    if (value.schemaVersion !== "pm-state-bench-run-config.v3") {
      throw new Error("unsupported run config schemaVersion");
    }
    if (
      value.phase !== "qualification" &&
      value.phase !== "confirmatory" &&
      value.phase !== "replication"
    ) {
      throw new Error(
        "run config phase must be qualification, confirmatory, or replication",
      );
    }
    const phase = value.phase;
    if (
      value.arm !== "native" &&
      value.arm !== "sham" &&
      value.arm !== "substrate"
    ) {
      throw new Error("run config arm must be native, sham, or substrate");
    }
    const arm = value.arm;
    const domain = domainValue(value.domain, "domain");
    if (!isObject(value.agentModel)) throw new Error("agentModel must be an object");
    exactKeys(
      value.agentModel,
      ["modelId", "modelDigest", "reasoningLevel"],
      "agentModel",
    );
    const reasoningLevel = value.agentModel.reasoningLevel;
    if (
      reasoningLevel !== null &&
      reasoningLevel !== "low" &&
      reasoningLevel !== "medium" &&
      reasoningLevel !== "high"
    ) {
      throw new Error(
        "agentModel.reasoningLevel must be low, medium, high, or null",
      );
    }
    const qualificationPlanHash = nullableSha(
      value.qualificationPlanHash,
      "qualificationPlanHash",
    );
    const analysisManifestHash = nullableSha(
      value.analysisManifestHash,
      "analysisManifestHash",
    );
    const preregistrationReceiptHash = nullableSha(
      value.preregistrationReceiptHash,
      "preregistrationReceiptHash",
    );
    if (phase === "qualification") {
      if (
        qualificationPlanHash === null ||
        analysisManifestHash !== null ||
        preregistrationReceiptHash !== null
      ) {
        throw new Error(
          "qualification requires qualificationPlanHash and forbids decision manifest/preregistration hashes",
        );
      }
    } else if (
      qualificationPlanHash !== null ||
      analysisManifestHash === null ||
      preregistrationReceiptHash === null
    ) {
      throw new Error(
        "decision phases require analysisManifestHash and preregistrationReceiptHash and forbid qualificationPlanHash",
      );
    }
    const expectedSplit = phase === "qualification" ? "train" : "test";
    if (value.split !== expectedSplit) {
      throw new Error(`${phase} phase requires ${expectedSplit} split`);
    }
    const numRuns = positiveInteger(value.numRuns, "numRuns", 5);
    if (phase !== "qualification" && numRuns !== 5) {
      throw new Error("confirmatory and replication phases require exactly 5 runs");
    }
    const taskIds = idArray(value.taskIds, "taskIds");
    const expectedTaskCount = phase === "qualification" ? 100 : 50;
    if (
      (phase === "qualification" && taskIds.length > expectedTaskCount) ||
      (phase !== "qualification" && taskIds.length !== expectedTaskCount)
    ) {
      throw new Error(
        phase === "qualification"
          ? "qualification taskIds cannot exceed the 100-task train split"
          : `${phase} taskIds must contain exactly the 50-task held-out domain split`,
      );
    }
    const suppliedTaskSetHash = shaValue(value.taskSetHash, "taskSetHash");
    const expectedTaskSetHash = taskSetHash(domain, expectedSplit, taskIds);
    if (suppliedTaskSetHash !== expectedTaskSetHash) {
      throw new Error("taskSetHash does not match domain, split, and exact taskIds");
    }
    const runLabels = idArray(value.runLabels, "runLabels", false);
    if (runLabels.length !== numRuns) {
      throw new Error("runLabels length must equal numRuns");
    }
    const suppliedRepeatScheduleHash = shaValue(
      value.repeatScheduleHash,
      "repeatScheduleHash",
    );
    if (suppliedRepeatScheduleHash !== repeatScheduleHash(runLabels)) {
      throw new Error(
        "repeatScheduleHash does not match the ordered logical runLabels",
      );
    }
    if (!isObject(value.retryPolicy)) {
      throw new Error("retryPolicy must be an object");
    }
    exactKeys(
      value.retryPolicy,
      ["maxTaskAttempts", "maxProviderAttempts"],
      "retryPolicy",
    );
    const retryPolicy = {
      maxTaskAttempts: positiveInteger(
        value.retryPolicy.maxTaskAttempts,
        "retryPolicy.maxTaskAttempts",
        10,
      ),
      maxProviderAttempts: positiveInteger(
        value.retryPolicy.maxProviderAttempts,
        "retryPolicy.maxProviderAttempts",
        10,
      ),
    };
    if (
      phase !== "qualification" &&
      (retryPolicy.maxTaskAttempts !== 1 ||
        retryPolicy.maxProviderAttempts !== 1)
    ) {
      throw new Error(
        "confirmatory and replication retry policies must retain one task and provider attempt per planned cell",
      );
    }
    const sidecar = arm !== "native";
    const expectedAgentClass = sidecar
      ? "PmSubstrateAgent"
      : "StateBenchAgent";
    if (value.agentClass !== expectedAgentClass) {
      throw new Error(`${arm} arm requires agentClass ${expectedAgentClass}`);
    }
    if (value.retrieveLearningsTopK !== (sidecar ? 3 : null)) {
      throw new Error(`${arm} arm has an invalid retrieval top_k treatment`);
    }
    const artifactSealHash = nullableSha(
      value.artifactSealHash,
      "artifactSealHash",
    );
    const extractionProvenanceHash = nullableSha(
      value.extractionProvenanceHash,
      "extractionProvenanceHash",
    );
    if (sidecar && artifactSealHash === null) {
      throw new Error(`${arm} arm requires artifactSealHash`);
    }
    if (sidecar && extractionProvenanceHash === null) {
      throw new Error(`${arm} arm requires extractionProvenanceHash`);
    }
    if (
      !sidecar &&
      (artifactSealHash !== null || extractionProvenanceHash !== null)
    ) {
      throw new Error(
        "native arm cannot bind learning artifact or extraction provenance seals",
      );
    }
    return {
      schemaVersion: "pm-state-bench-run-config.v3",
      experimentId: safeId(value.experimentId, "experimentId"),
      phase,
      qualificationPlanHash,
      analysisManifestHash,
      preregistrationReceiptHash,
      phasePartitionHash: shaValue(
        value.phasePartitionHash,
        "phasePartitionHash",
      ),
      arm,
      armInterventionHash: shaValue(
        value.armInterventionHash,
        "armInterventionHash",
      ),
      domain,
      agentModel: {
        modelId: safeId(value.agentModel.modelId, "agentModel.modelId"),
        modelDigest: shaValue(
          value.agentModel.modelDigest,
          "agentModel.modelDigest",
        ),
        reasoningLevel,
      },
      agentClass: expectedAgentClass,
      split: expectedSplit,
      numRuns,
      taskIds,
      taskSetHash: suppliedTaskSetHash,
      taskInventoryRootHash: shaValue(
        value.taskInventoryRootHash,
        "taskInventoryRootHash",
      ),
      runLabels,
      repeatScheduleHash: suppliedRepeatScheduleHash,
      attemptScheduleHash: shaValue(
        value.attemptScheduleHash,
        "attemptScheduleHash",
      ),
      nonModelConfigHash: shaValue(
        value.nonModelConfigHash,
        "nonModelConfigHash",
      ),
      executionPolicyHash: shaValue(
        value.executionPolicyHash,
        "executionPolicyHash",
      ),
      runtimeClosureHash: shaValue(
        value.runtimeClosureHash,
        "runtimeClosureHash",
      ),
      retryPolicy,
      retrieveLearningsTopK: sidecar ? 3 : null,
      artifactSealHash,
      extractionProvenanceHash,
    };
  }

  function loadRunConfig(path: string): StateBenchRunConfig {
    return parseRunConfig(readJson(path));
  }

  function officialTaskIds(
    checkoutPath: string,
    domain: StateBenchDomain,
  ): readonly string[] {
    const root = assertVerifiedCheckout(checkoutPath);
    return loadSplitManifest(root, domainValue(domain, "domain")).test;
  }

  function runConfigSha256(config: StateBenchRunConfig): string {
    return sha256(canonical(parseRunConfig(config)));
  }

  function officialRunId(
    config: StateBenchRunConfig,
    runIndex: number,
  ): string {
    const parsed = parseRunConfig(config);
    if (
      !Number.isInteger(runIndex) ||
      runIndex < 1 ||
      runIndex > parsed.numRuns
    ) {
      throw new Error(
        `runIndex must be an integer from 1 through ${parsed.numRuns}`,
      );
    }
    return safeId(
      `${parsed.experimentId}:${parsed.phase}:${parsed.arm}:${parsed.domain}:${parsed.runLabels[runIndex - 1]}`,
      "runId",
    );
  }

  return Object.freeze({
    parseRunConfig,
    loadRunConfig,
    officialTaskIds,
    runConfigSha256,
    officialRunId,
  });
}

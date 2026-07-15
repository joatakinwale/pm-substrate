import {
  publicEvalExpectedArmOrder,
  type PublicEvalTaskPlanEntry,
} from "@pm/public-eval-analysis";

import type { StateBenchDecisionManifestBridge } from "./decision-manifest.js";
import type {
  StateBenchPhase,
  StateBenchRunConfig,
} from "./execution-plan.js";
import type {
  StateBenchQualificationArm,
  StateBenchQualificationDomain,
  StateBenchQualificationPlan,
} from "./qualification-plan.js";

interface StateBenchQualificationRunBindingInput {
  readonly phase: "qualification";
  readonly arm: StateBenchQualificationArm;
  readonly domain: StateBenchQualificationDomain;
  readonly preregistrationReceiptHash: null;
  readonly artifactSealHash: string | null;
  readonly extractionProvenanceHash: string | null;
}

interface StateBenchDecisionRunBindingInput {
  readonly phase: Exclude<StateBenchPhase, "qualification">;
  readonly arm: StateBenchQualificationArm;
  readonly domain: StateBenchQualificationDomain;
  readonly preregistrationReceiptHash: string;
}

export type StateBenchRunBindingInput =
  | StateBenchQualificationRunBindingInput
  | StateBenchDecisionRunBindingInput;

export interface StateBenchRunBindingVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

interface StateBenchRunBindingDependencies {
  readonly loadQualificationPlan: (
    checkoutPath: string,
    value: unknown,
  ) => StateBenchQualificationPlan;
  readonly loadDecisionManifestBridge: (
    checkoutPath: string,
    qualificationPlanValue: unknown,
    value: unknown,
  ) => StateBenchDecisionManifestBridge;
  readonly parseRunConfig: (value: unknown) => StateBenchRunConfig;
  readonly sha256: (bytes: string | Buffer) => string;
  readonly canonical: (value: unknown) => string;
}

const ARMS = ["native", "sham", "substrate"] as const;
const DOMAINS = ["travel", "customer_support", "shopping_assistant"] as const;

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function taskSetHash(
  sha256: StateBenchRunBindingDependencies["sha256"],
  canonical: StateBenchRunBindingDependencies["canonical"],
  domain: StateBenchQualificationDomain,
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

function repeatScheduleHash(
  sha256: StateBenchRunBindingDependencies["sha256"],
  canonical: StateBenchRunBindingDependencies["canonical"],
  repeatLabels: readonly string[],
): string {
  return sha256(
    canonical({
      schemaVersion: "pm-state-bench-repeat-schedule.v1",
      repeatLabels,
    }),
  );
}

function decisionTaskDomain(task: PublicEvalTaskPlanEntry): StateBenchQualificationDomain {
  const parts = task.canonicalTaskId.split(":");
  const domain = parts[1];
  if (!DOMAINS.includes(domain as StateBenchQualificationDomain)) {
    throw new Error(`decision task has invalid STATE-Bench domain: ${task.canonicalTaskId}`);
  }
  return domain as StateBenchQualificationDomain;
}

export function createStateBenchRunBinding(
  dependencies: StateBenchRunBindingDependencies,
) {
  const {
    loadQualificationPlan,
    loadDecisionManifestBridge,
    parseRunConfig,
    sha256,
    canonical,
  } = dependencies;

  function decisionAttemptScheduleHash(
    bridge: StateBenchDecisionManifestBridge,
    phase: "confirmatory" | "replication",
  ): string {
    const tasks = bridge.analysisManifest.taskPlan
      .filter((task) => task.status === "included" && task.phase === phase)
      .sort((left, right) => codeUnitCompare(left.taskId, right.taskId));
    const cells = tasks.flatMap((task) =>
      task.predeclaredSeeds.flatMap((repeatLabel, repeatIndex) => {
        const order = publicEvalExpectedArmOrder(
          bridge.analysisManifest,
          task,
          repeatIndex,
        );
        return order.map((arm, armOrderPosition) => ({
          taskId: task.taskId,
          repeatIndex,
          repeatLabel,
          arm,
          armOrderPosition,
        }));
      }),
    );
    return sha256(
      canonical({
        schemaVersion: "pm-state-bench-decision-attempt-schedule.v1",
        phase,
        cells,
      }),
    );
  }

  function createRunConfig(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    input: StateBenchRunBindingInput,
  ): StateBenchRunConfig {
    if (!ARMS.includes(input.arm) || !DOMAINS.includes(input.domain)) {
      throw new Error("run binding arm or domain is invalid");
    }
    const qualificationPlan = loadQualificationPlan(
      checkoutPath,
      qualificationPlanValue,
    );
    const sidecar = input.arm !== "native";
    if (input.phase === "qualification") {
      if (
        sidecar
          ? input.artifactSealHash === null || input.extractionProvenanceHash === null
          : input.artifactSealHash !== null || input.extractionProvenanceHash !== null
      ) {
        throw new Error(
          sidecar
            ? "sham/substrate qualification binding requires artifact and extraction provenance hashes"
            : "native qualification binding forbids artifact and extraction provenance hashes",
        );
      }
      if (decisionBridgeValue !== null || input.preregistrationReceiptHash !== null) {
        throw new Error("qualification run binding forbids decision/preregistration inputs");
      }
      const domainPlan = qualificationPlan.domains[input.domain];
      const taskIds = [...domainPlan.qualification.taskIds].sort();
      const runLabels = [...qualificationPlan.execution.repeatLabels];
      return parseRunConfig({
        schemaVersion: "pm-state-bench-run-config.v3",
        experimentId: qualificationPlan.experimentId,
        phase: "qualification",
        qualificationPlanHash: qualificationPlan.planHash,
        analysisManifestHash: null,
        preregistrationReceiptHash: null,
        phasePartitionHash: qualificationPlan.planHash,
        arm: input.arm,
        armInterventionHash:
          qualificationPlan.execution.arms[input.arm].interventionHash,
        domain: input.domain,
        agentModel: qualificationPlan.execution.agentModel,
        agentClass: sidecar ? "PmSubstrateAgent" : "StateBenchAgent",
        split: "train",
        numRuns: runLabels.length,
        taskIds,
        taskSetHash: taskSetHash(sha256, canonical, input.domain, "train", taskIds),
        taskInventoryRootHash: domainPlan.trainInventory.rootHash,
        runLabels,
        repeatScheduleHash: repeatScheduleHash(sha256, canonical, runLabels),
        attemptScheduleHash: qualificationPlan.execution.attemptScheduleHash,
        nonModelConfigHash: qualificationPlan.execution.nonModelConfigHash,
        executionPolicyHash: qualificationPlan.execution.executionPolicyHash,
        runtimeClosureHash:
          qualificationPlan.execution.expectedRuntimeClosureHash,
        retryPolicy: {
          maxTaskAttempts:
            qualificationPlan.execution.policy.maxTaskAttemptsPerCell,
          maxProviderAttempts:
            qualificationPlan.execution.policy.maxProviderAttemptsPerCall,
        },
        retrieveLearningsTopK: sidecar ? 3 : null,
        artifactSealHash: input.artifactSealHash,
        extractionProvenanceHash: input.extractionProvenanceHash,
      });
    }

    if (
      Object.hasOwn(input, "artifactSealHash") ||
      Object.hasOwn(input, "extractionProvenanceHash")
    ) {
      throw new Error(
        "decision run binding derives learning artifact and extraction provenance hashes from the preregistered bridge and forbids caller-supplied values",
      );
    }
    if (decisionBridgeValue === null || input.preregistrationReceiptHash === null) {
      throw new Error("decision run binding requires bridge and preregistration receipt hash");
    }
    const bridge = loadDecisionManifestBridge(
      checkoutPath,
      qualificationPlan,
      decisionBridgeValue,
    );
    const phase = input.phase;
    const domainPlan = qualificationPlan.domains[input.domain];
    const phaseTasks = bridge.analysisManifest.taskPlan
      .filter((task) => task.status === "included" && task.phase === phase)
      .filter((task) => decisionTaskDomain(task) === input.domain);
    const taskIds = phaseTasks
      .map((task) => task.canonicalTaskId.slice(`state:${input.domain}:`.length))
      .sort();
    const runLabels = [...bridge.protocolBinding.repeatLabels];
    const model = phase === "confirmatory"
      ? bridge.decisionInput.confirmatoryModel
      : bridge.decisionInput.replicationModel;
    return parseRunConfig({
      schemaVersion: "pm-state-bench-run-config.v3",
      experimentId: bridge.analysisManifest.experimentId,
      phase,
      qualificationPlanHash: null,
      analysisManifestHash: bridge.analysisManifest.manifestHash,
      preregistrationReceiptHash: input.preregistrationReceiptHash,
      phasePartitionHash: qualificationPlan.planHash,
      arm: input.arm,
      armInterventionHash:
        bridge.analysisManifest.execution.arms[input.arm].interventionHash,
      domain: input.domain,
      agentModel: model,
      agentClass: sidecar ? "PmSubstrateAgent" : "StateBenchAgent",
      split: "test",
      numRuns: 5,
      taskIds,
      taskSetHash: taskSetHash(sha256, canonical, input.domain, "test", taskIds),
      taskInventoryRootHash: domainPlan.testInventory.rootHash,
      runLabels,
      repeatScheduleHash: repeatScheduleHash(sha256, canonical, runLabels),
      attemptScheduleHash: decisionAttemptScheduleHash(bridge, phase),
      nonModelConfigHash:
        bridge.analysisManifest.execution.nonModelConfigHashes[phase],
      executionPolicyHash: bridge.protocolBinding.executionPolicyHash,
      runtimeClosureHash: bridge.protocolBinding.expectedRuntimeClosureHash,
      retryPolicy: { maxTaskAttempts: 1, maxProviderAttempts: 1 },
      retrieveLearningsTopK: sidecar ? 3 : null,
      artifactSealHash: sidecar
        ? bridge.decisionInput.decisionLearningArtifactSealHash
        : null,
      extractionProvenanceHash: sidecar
        ? bridge.decisionInput.decisionLearningExtractionProvenanceReceiptHash
        : null,
    });
  }

  function verifyRunConfigBinding(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    value: unknown,
  ): StateBenchRunBindingVerification {
    try {
      const parsed = parseRunConfig(value);
      const expected = parsed.phase === "qualification"
        ? createRunConfig(
            checkoutPath,
            qualificationPlanValue,
            decisionBridgeValue,
            {
              phase: "qualification",
              arm: parsed.arm,
              domain: parsed.domain,
              preregistrationReceiptHash: null,
              artifactSealHash: parsed.artifactSealHash,
              extractionProvenanceHash: parsed.extractionProvenanceHash,
            },
          )
        : createRunConfig(
            checkoutPath,
            qualificationPlanValue,
            decisionBridgeValue,
            {
              phase: parsed.phase,
              arm: parsed.arm,
              domain: parsed.domain,
              preregistrationReceiptHash: parsed.preregistrationReceiptHash!,
            },
          );
      if (canonical(parsed) !== canonical(expected)) {
        throw new Error("run config is not exactly derived from its bound STATE-Bench plan");
      }
      return { valid: true, issues: [] };
    } catch (error) {
      return {
        valid: false,
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  return Object.freeze({
    createRunConfig,
    verifyRunConfigBinding,
    decisionAttemptScheduleHash,
  });
}

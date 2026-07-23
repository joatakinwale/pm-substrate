import {
  createPublicEvalAnalysisManifest,
  hashPublicEvalJson,
  parsePublicEvalAnalysisManifest,
  publicEvalSelectionDigest,
  type PublicEvalAnalysisManifest,
  type PublicEvalAnalysisManifestInput,
} from "@pm/public-eval-analysis";

import type {
  StateBenchQualificationDomain,
  StateBenchQualificationPlan,
} from "./qualification-plan.js";

export interface StateBenchDecisionManifestInput {
  readonly frozenAt: string;
  readonly harnessRevision: string;
  readonly substrateRevision: string;
  readonly selectionSeed: string;
  readonly armRandomizationSeed: string;
  readonly confirmatoryModel: {
    readonly modelId: string;
    readonly modelDigest: string;
    readonly reasoningLevel: "low" | "medium" | "high" | null;
  };
  readonly replicationModel: {
    readonly modelId: string;
    readonly modelDigest: string;
    readonly reasoningLevel: "low" | "medium" | "high" | null;
  };
  readonly decisionComponents: {
    readonly systemPromptHash: string;
    readonly toolsHash: string;
    readonly simulatorHash: string;
    readonly judgeHash: string;
    readonly decodingHash: string;
    readonly runnerHash: string;
  };
  readonly decisionLearningArtifactSealHash: string;
  readonly decisionLearningExtractionProvenanceReceiptHash: string;
  readonly arms: PublicEvalAnalysisManifest["execution"]["arms"];
  readonly decisionVerification: PublicEvalAnalysisManifest["decisionVerification"];
  readonly bootstrapSeed: string;
  readonly executionLimits: {
    readonly maximumTotalCostUsd: number;
    readonly maximumWallClockMs: number;
  };
}

export interface StateBenchDecisionUpstreamTaskSelectionBinding {
  readonly selectionMode: "exact_verified_test_task_id_per_cell";
  readonly exactTaskOption: "--tasks";
  readonly parserSplitSentinel: readonly ["--split", "all"];
  readonly parserSplitSentinelSemantics:
    "upstream_parser_compatibility_only_not_train_plus_test_dataset_selection";
  readonly directSplitSelection:
    "forbidden_upstream_rejects_tasks_with_split_train_or_test";
  readonly testInventoryAuthority:
    "verified_qualification_plan_test_inventory_exactly_50_tasks_per_domain";
}

export interface StateBenchDecisionManifestBridge {
  readonly schemaVersion: "pm-state-bench-decision-manifest-bridge.v1";
  readonly evidenceClass: "state_bench_full_test_decision_plan";
  readonly authorityStatus: "requires_external_preregistration_before_execution";
  readonly qualificationPlanHash: string;
  readonly decisionInput: StateBenchDecisionManifestInput;
  readonly protocolBinding: {
    readonly split: "test";
    readonly upstreamTaskSelection: StateBenchDecisionUpstreamTaskSelectionBinding;
    readonly domains: readonly ["travel", "customer_support", "shopping_assistant"];
    readonly tasksPerDomain: 50;
    readonly repeatLabels: readonly [
      "run-index-1",
      "run-index-2",
      "run-index-3",
      "run-index-4",
      "run-index-5",
    ];
    readonly repeatSemantics:
      "stochastic_repeat_identity_only_upstream_exposes_no_sampling_seed";
    readonly taskClustersPerPhase: 150;
    readonly armTriplesPerPhase: 750;
    readonly finalTrajectorySlotsPerPhase: 2250;
    readonly inferenceUnit: "task_cluster_stratified_by_domain";
    readonly outcomeInspectionBeforePhaseCompletion: "forbidden";
    readonly failedPlannedCells: "strict_failure_no_replacement";
    readonly maxTaskAttemptsPerCell: 1;
    readonly maxProviderAttemptsPerCall: 1;
    readonly workers: 1;
    readonly executionPolicyHash: string;
    readonly expectedRuntimeClosureHash: string;
  };
  readonly oracleAccessBoundary: {
    readonly upstreamRuntimeExposesOracleFieldsToCustomAgents: true;
    readonly allowedAdapterRuntimeContextFields: readonly ["task_id", "domain"];
    readonly forbiddenAdapterRuntimeContextFields: readonly [
      "task_summary",
      "state_requirements",
      "task_requirements",
    ];
    readonly exactAdapterAndRuntimeClosureAttestationRequired: true;
  };
  readonly analysisManifest: PublicEvalAnalysisManifest;
  readonly unresolvedEligibilityRequirements: readonly [
    "external_preregistration_receipt_and_out_of_band_trust_policy",
    "raw_runner_agent_simulator_and_judge_transport_evidence",
    "actual_provider_model_identity_request_ids_usage_cost_latency_exact_bytes",
    "all_failed_task_and_provider_attempts_retained",
    "initial_final_environment_snapshots_and_independent_tool_replay",
    "independent_oracle_runtime_and_adapter_runtime_closure_attestation",
  ];
  readonly bridgeHash: string;
}

export interface StateBenchDecisionManifestVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

interface StateBenchDecisionManifestDependencies {
  readonly loadQualificationPlan: (
    checkoutPath: string,
    value: unknown,
  ) => StateBenchQualificationPlan;
  readonly sha256: (bytes: string | Buffer) => string;
  readonly canonical: (value: unknown) => string;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
const DOMAINS = ["travel", "customer_support", "shopping_assistant"] as const;
const PHASES = ["confirmatory", "replication"] as const;
const REPEAT_LABELS = [
  "run-index-1",
  "run-index-2",
  "run-index-3",
  "run-index-4",
  "run-index-5",
] as const;
const BRIDGE_SCHEMA = "pm-state-bench-decision-manifest-bridge.v1" as const;

function upstreamTaskSelectionBinding(): StateBenchDecisionUpstreamTaskSelectionBinding {
  return {
    selectionMode: "exact_verified_test_task_id_per_cell",
    exactTaskOption: "--tasks",
    parserSplitSentinel: ["--split", "all"],
    parserSplitSentinelSemantics:
      "upstream_parser_compatibility_only_not_train_plus_test_dataset_selection",
    directSplitSelection:
      "forbidden_upstream_rejects_tasks_with_split_train_or_test",
    testInventoryAuthority:
      "verified_qualification_plan_test_inventory_exactly_50_tasks_per_domain",
  };
}

function object(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${path} must contain exactly ${expected.join(", ")}`);
  }
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function safeId(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!SAFE_ID.test(parsed)) throw new Error(`${path} must be a safe identifier`);
  return parsed;
}

function sha(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be lowercase SHA-256`);
  return parsed;
}

function timestamp(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (Number.isNaN(Date.parse(parsed)) || new Date(parsed).toISOString() !== parsed) {
    throw new Error(`${path} must be an exact UTC ISO-8601 timestamp`);
  }
  return parsed;
}

function parseDecisionInput(value: unknown): StateBenchDecisionManifestInput {
  const root = object(value, "decisionInput");
  exactKeys(
    root,
    [
      "frozenAt",
      "harnessRevision",
      "substrateRevision",
      "selectionSeed",
      "armRandomizationSeed",
      "confirmatoryModel",
      "replicationModel",
      "decisionComponents",
      "decisionLearningArtifactSealHash",
      "decisionLearningExtractionProvenanceReceiptHash",
      "arms",
      "decisionVerification",
      "bootstrapSeed",
      "executionLimits",
    ],
    "decisionInput",
  );
  const parseModel = (
    raw: unknown,
    path: string,
  ): StateBenchDecisionManifestInput["confirmatoryModel"] => {
    const model = object(raw, path);
    exactKeys(model, ["modelId", "modelDigest", "reasoningLevel"], path);
    if (
      model.reasoningLevel !== null &&
      model.reasoningLevel !== "low" &&
      model.reasoningLevel !== "medium" &&
      model.reasoningLevel !== "high"
    ) {
      throw new Error(`${path}.reasoningLevel is invalid`);
    }
    return {
      modelId: safeId(model.modelId, `${path}.modelId`),
      modelDigest: sha(model.modelDigest, `${path}.modelDigest`),
      reasoningLevel: model.reasoningLevel,
    };
  };
  const components = object(root.decisionComponents, "decisionInput.decisionComponents");
  const componentKeys = [
    "systemPromptHash",
    "toolsHash",
    "simulatorHash",
    "judgeHash",
    "decodingHash",
    "runnerHash",
  ] as const;
  exactKeys(components, componentKeys, "decisionInput.decisionComponents");
  const parsedComponents = Object.fromEntries(
    componentKeys.map((key) => [
      key,
      sha(components[key], `decisionInput.decisionComponents.${key}`),
    ]),
  ) as unknown as StateBenchDecisionManifestInput["decisionComponents"];
  const confirmatoryModel = parseModel(root.confirmatoryModel, "decisionInput.confirmatoryModel");
  const replicationModel = parseModel(root.replicationModel, "decisionInput.replicationModel");
  if (
    confirmatoryModel.modelId === replicationModel.modelId ||
    confirmatoryModel.modelDigest === replicationModel.modelDigest
  ) {
    throw new Error("decision manifest requires a distinct replication model ID and digest");
  }
  const executionLimits = object(
    root.executionLimits,
    "decisionInput.executionLimits",
  );
  exactKeys(
    executionLimits,
    ["maximumTotalCostUsd", "maximumWallClockMs"],
    "decisionInput.executionLimits",
  );
  const positive = (value: unknown, path: string): number => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${path} must be finite and greater than zero`);
    }
    return value;
  };
  return {
    frozenAt: timestamp(root.frozenAt, "decisionInput.frozenAt"),
    harnessRevision: sha(root.harnessRevision, "decisionInput.harnessRevision"),
    substrateRevision: sha(root.substrateRevision, "decisionInput.substrateRevision"),
    selectionSeed: requiredString(root.selectionSeed, "decisionInput.selectionSeed"),
    armRandomizationSeed: requiredString(
      root.armRandomizationSeed,
      "decisionInput.armRandomizationSeed",
    ),
    confirmatoryModel,
    replicationModel,
    decisionComponents: parsedComponents,
    decisionLearningArtifactSealHash: sha(
      root.decisionLearningArtifactSealHash,
      "decisionInput.decisionLearningArtifactSealHash",
    ),
    decisionLearningExtractionProvenanceReceiptHash: sha(
      root.decisionLearningExtractionProvenanceReceiptHash,
      "decisionInput.decisionLearningExtractionProvenanceReceiptHash",
    ),
    arms: root.arms as StateBenchDecisionManifestInput["arms"],
    decisionVerification:
      root.decisionVerification as StateBenchDecisionManifestInput["decisionVerification"],
    bootstrapSeed: requiredString(root.bootstrapSeed, "decisionInput.bootstrapSeed"),
    executionLimits: {
      maximumTotalCostUsd: positive(
        executionLimits.maximumTotalCostUsd,
        "decisionInput.executionLimits.maximumTotalCostUsd",
      ),
      maximumWallClockMs: positive(
        executionLimits.maximumWallClockMs,
        "decisionInput.executionLimits.maximumWallClockMs",
      ),
    },
  };
}

export function createStateBenchDecisionManifestBridge(
  dependencies: StateBenchDecisionManifestDependencies,
) {
  const { loadQualificationPlan, sha256, canonical } = dependencies;

  function qualificationComponents(
    plan: StateBenchQualificationPlan,
  ): PublicEvalAnalysisManifest["execution"]["nonModelComponents"]["qualification"] {
    return {
      systemPromptHash: plan.execution.components.systemPromptHash,
      toolsHash: plan.execution.components.toolsHash,
      simulatorHash: plan.execution.components.simulatorHash,
      judgeHash: plan.execution.components.judgeHash,
      decodingHash: plan.execution.components.decodingHash,
      runnerHash: hashPublicEvalJson({
        schemaVersion: "pm-state-bench-qualification-runner-binding.v1",
        runnerHash: plan.execution.components.runnerHash,
        adapterHash: plan.execution.components.adapterHash,
        executionPolicyHash: plan.execution.executionPolicyHash,
        attemptScheduleHash: plan.execution.attemptScheduleHash,
        split: "train",
      }),
    };
  }

  function createBridge(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    rawInput: StateBenchDecisionManifestInput,
  ): StateBenchDecisionManifestBridge {
    const qualificationPlan = loadQualificationPlan(checkoutPath, qualificationPlanValue);
    const input = JSON.parse(
      canonical(parseDecisionInput(rawInput)),
    ) as StateBenchDecisionManifestInput;
    if (Date.parse(input.frozenAt) <= Date.parse(qualificationPlan.frozenAt)) {
      throw new Error("decision manifest must be frozen after the technical qualification plan");
    }
    const testTasks = DOMAINS.flatMap((domain) =>
      qualificationPlan.domains[domain].testInventory.tasks.map((task) => ({ domain, task })),
    );
    const taskContentHashes = testTasks
      .map(({ task }) => task.taskDefinition.sha256)
      .sort();
    if (new Set(taskContentHashes).size !== 150) {
      throw new Error("STATE-Bench decision task definitions must have 150 unique content hashes");
    }
    const eligibleRoot = hashPublicEvalJson({
      schemaVersion: "pm.public-eval.eligible-universe.v1",
      taskContentHashes,
    });
    const taskByHash = new Map(testTasks.map((entry) => [entry.task.taskDefinition.sha256, entry]));
    const qualificationNonModel = qualificationComponents(qualificationPlan);
    const executionPolicy = {
      schemaVersion: "pm-state-bench-decision-execution-policy.v2",
      split: "test",
      upstreamTaskSelection: upstreamTaskSelectionBinding(),
      maxTaskAttemptsPerCell: 1,
      maxProviderAttemptsPerCall: 1,
      failedPlannedCells: "strict_failure_no_replacement",
      stoppingRule: "complete_fixed_schedule_or_invalidate",
      outcomeInspection: "after_phase_complete",
      workers: 1,
      ...input.executionLimits,
    } as const;
    const executionPolicyHash = hashPublicEvalJson(executionPolicy);
    const decisionNonModel = {
      ...input.decisionComponents,
      runnerHash: hashPublicEvalJson({
        schemaVersion: "pm-state-bench-decision-runner-binding.v1",
        runnerSourceHash: input.decisionComponents.runnerHash,
        executionPolicyHash,
        decisionLearningArtifactSealHash:
          input.decisionLearningArtifactSealHash,
        decisionLearningExtractionProvenanceReceiptHash:
          input.decisionLearningExtractionProvenanceReceiptHash,
      }),
    };
    const expectedRuntimeClosureHash = hashPublicEvalJson({
      schemaVersion: "pm-state-bench-expected-runtime-closure.v1",
      harnessRevision: input.harnessRevision,
      substrateRevision: input.substrateRevision,
      decisionComponents: decisionNonModel,
      decisionLearningArtifactSealHash:
        input.decisionLearningArtifactSealHash,
      decisionLearningExtractionProvenanceReceiptHash:
        input.decisionLearningExtractionProvenanceReceiptHash,
      arms: input.arms,
    });
    const configHash = (components: typeof decisionNonModel) =>
      hashPublicEvalJson({
        schemaVersion: "pm.public-eval.non-model-config.v1",
        ...components,
      });
    const taskPlan: PublicEvalAnalysisManifestInput["taskPlan"] = PHASES.flatMap((phase) =>
      taskContentHashes.map((benchmarkTaskContentHash) => {
        const entry = taskByHash.get(benchmarkTaskContentHash)!;
        const inventoryIndex = taskContentHashes.indexOf(benchmarkTaskContentHash);
        return {
          taskId: `${phase}:${entry.domain}:${entry.task.taskId}`,
          canonicalTaskId: `state:${entry.domain}:${entry.task.taskId}`,
          benchmarkTaskLocator: entry.task.taskDefinition.path,
          benchmarkTaskContentHash,
          taskContentHash: benchmarkTaskContentHash,
          variant: "original" as const,
          mutationHash: null,
          phase,
          predeclaredSeeds: REPEAT_LABELS,
          selectionDigest: publicEvalSelectionDigest(
            input.selectionSeed,
            benchmarkTaskContentHash,
          ),
          eligibleUniverseMembershipProof: {
            inventoryIndex,
            inventoryRootHash: eligibleRoot,
            benchmarkTaskContentHash,
          },
          initialEnvironmentSnapshotHash: entry.task.initialEnvironment.sha256,
          status: "included" as const,
        };
      }),
    );
    const manifestInput: PublicEvalAnalysisManifestInput = {
      experimentId: qualificationPlan.experimentId,
      producerIdentity: qualificationPlan.producerIdentity,
      benchmark: {
        benchmarkId: "microsoft_STATE-Bench_agent_learning",
        repositoryUrl: qualificationPlan.benchmark.repositoryUrl,
        revision: qualificationPlan.benchmark.revision,
        licenseSpdx: "MIT",
        splitId: "train_test:test:complete_150_tasks",
        corpusHash: hashPublicEvalJson({
          schemaVersion: "pm-state-bench-decision-corpus.v1",
          splitVersion: qualificationPlan.benchmark.splitVersion,
          protocolFileSha256: qualificationPlan.benchmark.protocolFileSha256,
          domains: Object.fromEntries(
            DOMAINS.map((domain) => [
              domain,
              {
                splitManifestSha256:
                  qualificationPlan.domains[domain].splitManifest.sha256,
                testInventoryRootHash:
                  qualificationPlan.domains[domain].testInventory.rootHash,
              },
            ]),
          ),
        }),
        eligibleUniverse: {
          rootHash: eligibleRoot,
          taskContentHashes,
          selectionAlgorithm: "sha256-rank-v1",
          selectionSeed: input.selectionSeed,
          selectionCount: 150,
        },
      },
      execution: {
        harnessRevision: input.harnessRevision,
        substrateRevision: input.substrateRevision,
        replicationAxis: "model",
        modelIds: {
          qualification: qualificationPlan.execution.agentModel.modelId,
          confirmatory: input.confirmatoryModel.modelId,
          replication: input.replicationModel.modelId,
        },
        modelDigests: {
          qualification: qualificationPlan.execution.agentModel.modelDigest,
          confirmatory: input.confirmatoryModel.modelDigest,
          replication: input.replicationModel.modelDigest,
        },
        nonModelConfigHashes: {
          qualification: configHash(qualificationNonModel),
          confirmatory: configHash(decisionNonModel),
          replication: configHash(decisionNonModel),
        },
        nonModelComponents: {
          qualification: qualificationNonModel,
          confirmatory: decisionNonModel,
          replication: decisionNonModel,
        },
        arms: input.arms,
        randomization: {
          algorithm: "sha256-arm-order-v1",
          seed: input.armRandomizationSeed,
        },
      },
      decisionVerification: input.decisionVerification,
      frozenAt: input.frozenAt,
      taskPlan,
      guardrails: {
        maxFalseBlockedActionsPerAttempt: 0,
        maxCollateralWritesPerAttempt: 0,
      },
      bootstrap: {
        iterations: 10_000,
        confidenceLevel: 0.95,
        seed: input.bootstrapSeed,
      },
      successCriteria: {
        minimumStrictCompletionLift: 0.1,
        minimumReliableTaskSuccessRate: 0.5,
        requirePositiveCiLowerBound: true,
        maximumCostUsdPerStrictSuccess: 10,
        maximumLatencyMsPerStrictSuccess: 300_000,
        maximumCostPerStrictSuccessRatio: 1.25,
        maximumLatencyPerStrictSuccessRatio: 1.25,
      },
    };
    const analysisManifest = createPublicEvalAnalysisManifest(manifestInput);
    const body = {
      schemaVersion: BRIDGE_SCHEMA,
      evidenceClass: "state_bench_full_test_decision_plan" as const,
      authorityStatus: "requires_external_preregistration_before_execution" as const,
      qualificationPlanHash: qualificationPlan.planHash,
      decisionInput: input,
      protocolBinding: {
        split: "test" as const,
        upstreamTaskSelection: upstreamTaskSelectionBinding(),
        domains: DOMAINS,
        tasksPerDomain: 50 as const,
        repeatLabels: REPEAT_LABELS,
        repeatSemantics: "stochastic_repeat_identity_only_upstream_exposes_no_sampling_seed" as const,
        taskClustersPerPhase: 150 as const,
        armTriplesPerPhase: 750 as const,
        finalTrajectorySlotsPerPhase: 2250 as const,
        inferenceUnit: "task_cluster_stratified_by_domain" as const,
        outcomeInspectionBeforePhaseCompletion: "forbidden" as const,
        failedPlannedCells: "strict_failure_no_replacement" as const,
        maxTaskAttemptsPerCell: 1 as const,
        maxProviderAttemptsPerCall: 1 as const,
        workers: 1 as const,
        executionPolicyHash,
        expectedRuntimeClosureHash,
      },
      oracleAccessBoundary: {
        upstreamRuntimeExposesOracleFieldsToCustomAgents: true as const,
        allowedAdapterRuntimeContextFields: ["task_id", "domain"] as const,
        forbiddenAdapterRuntimeContextFields: [
          "task_summary",
          "state_requirements",
          "task_requirements",
        ] as const,
        exactAdapterAndRuntimeClosureAttestationRequired: true as const,
      },
      analysisManifest,
      unresolvedEligibilityRequirements: [
        "external_preregistration_receipt_and_out_of_band_trust_policy",
        "raw_runner_agent_simulator_and_judge_transport_evidence",
        "actual_provider_model_identity_request_ids_usage_cost_latency_exact_bytes",
        "all_failed_task_and_provider_attempts_retained",
        "initial_final_environment_snapshots_and_independent_tool_replay",
        "independent_oracle_runtime_and_adapter_runtime_closure_attestation",
      ] as const,
    };
    return { ...body, bridgeHash: sha256(canonical(body)) };
  }

  function loadBridge(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    value: unknown,
  ): StateBenchDecisionManifestBridge {
    const root = object(value, "decision manifest bridge");
    if (root.schemaVersion !== BRIDGE_SCHEMA) {
      throw new Error("unsupported STATE-Bench decision manifest bridge schemaVersion");
    }
    const recomputed = createBridge(
      checkoutPath,
      qualificationPlanValue,
      root.decisionInput as StateBenchDecisionManifestInput,
    );
    if (canonical(value) !== canonical(recomputed)) {
      throw new Error("STATE-Bench decision manifest bridge is incomplete, stale, or does not recompute");
    }
    parsePublicEvalAnalysisManifest(recomputed.analysisManifest);
    return recomputed;
  }

  function verifyBridge(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    value: unknown,
  ): StateBenchDecisionManifestVerification {
    try {
      loadBridge(checkoutPath, qualificationPlanValue, value);
      return { valid: true, issues: [] };
    } catch (error) {
      return {
        valid: false,
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  function taskIdsFor(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    bridgeValue: unknown,
    phase: "confirmatory" | "replication",
    domain: StateBenchQualificationDomain,
  ): readonly string[] {
    const bridge = loadBridge(checkoutPath, qualificationPlanValue, bridgeValue);
    return bridge.analysisManifest.taskPlan
      .filter((task) => task.status === "included" && task.phase === phase)
      .filter((task) => task.taskId.startsWith(`${phase}:${domain}:`))
      .map((task) => task.canonicalTaskId.slice(`state:${domain}:`.length))
      .sort();
  }

  return Object.freeze({
    createBridge,
    loadBridge,
    verifyBridge,
    taskIdsFor,
  });
}

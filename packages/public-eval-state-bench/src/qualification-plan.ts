import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export type StateBenchQualificationDomain =
  | "travel"
  | "customer_support"
  | "shopping_assistant";

export type StateBenchQualificationArm = "native" | "sham" | "substrate";

export interface StateBenchQualificationTaskRecord {
  readonly taskId: string;
  readonly canonicalTaskHash: string;
  readonly taskDefinition: {
    readonly path: string;
    readonly sha256: string;
  };
  readonly initialEnvironment: {
    readonly path: string;
    readonly sha256: string;
  };
  readonly trainTrajectory: {
    readonly path: string;
    readonly sha256: string;
  } | null;
}

export interface StateBenchQualificationExecutionInput {
  readonly agentModel: {
    readonly modelId: string;
    readonly modelDigest: string;
    readonly reasoningLevel: "low" | "medium" | "high" | null;
  };
  readonly components: {
    readonly systemPromptHash: string;
    readonly toolsHash: string;
    readonly simulatorHash: string;
    readonly judgeHash: string;
    readonly decodingHash: string;
    readonly runnerHash: string;
    readonly adapterHash: string;
  };
  readonly arms: Readonly<
    Record<
      StateBenchQualificationArm,
      {
        readonly interventionHash: string;
        readonly implementationRevision: string;
        readonly sidecarShapeHash: string;
        readonly expectedToolCalls: number;
        readonly expectedPromptTokens: number;
        readonly expectedAddedLatencyMs: number;
      }
    >
  >;
  readonly repeatLabels: readonly string[];
  readonly armRandomizationSeed: string;
  readonly policy: {
    readonly maxTaskAttemptsPerCell: 1;
    readonly maxProviderAttemptsPerCall: 1;
    readonly failedCellsCountAsStrictFailure: true;
    readonly replacementAttempts: "forbidden";
    readonly stoppingRule: "complete_fixed_schedule_or_invalidate";
    readonly outcomeInspection: "after_phase_complete";
    readonly workers: 1;
    readonly maximumTotalCostUsd: number;
    readonly maximumWallClockMs: number;
  };
}

export interface StateBenchQualificationPlanInput {
  readonly planId: string;
  readonly experimentId: string;
  readonly producerIdentity: string;
  readonly frozenAt: string;
  readonly selectionSeed: string;
  readonly qualificationTasksPerDomain: 20;
  readonly execution: StateBenchQualificationExecutionInput;
}

export interface StateBenchQualificationPlan {
  readonly schemaVersion: "pm-state-bench-qualification-plan.v1";
  readonly evidenceClass: "train_partition_technical_qualification_only";
  readonly authorityStatus: "ineligible_for_efficacy_or_decision";
  readonly claimBoundary:
    "partition_and_schedule_integrity_not_runtime_isolation_provider_identity_or_public_efficacy";
  readonly planId: string;
  readonly experimentId: string;
  readonly producerIdentity: string;
  readonly frozenAt: string;
  readonly benchmark: {
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly packageVersion: string;
    readonly protocolId: string;
    readonly protocolFileSha256: string;
    readonly splitVersion: string;
  };
  readonly selection: {
    readonly algorithm: "sha256-domain-task-rank-v1";
    readonly seed: string;
    readonly qualificationTasksPerDomain: 20;
  };
  readonly sourcePolicy: {
    readonly qualificationSplit: "train";
    readonly qualificationArtifactSources: "train_partition_excluding_qualification_tasks";
    readonly decisionArtifactSources: "complete_train_split_only";
    readonly heldOutTestAccessDuringQualification: "forbidden";
    readonly qualificationDecisionEligible: false;
  };
  readonly runtimeContextPolicy: {
    readonly allowedAgentFields: readonly ["task_id", "domain"];
    readonly forbiddenOracleBearingFields: readonly [
      "task_summary",
      "state_requirements",
      "task_requirements",
    ];
    readonly exactAdapterAndRuntimeClosureRequired: true;
  };
  readonly domains: Readonly<
    Record<
      StateBenchQualificationDomain,
      {
        readonly splitManifest: {
          readonly path: string;
          readonly sha256: string;
        };
        readonly trainInventory: {
          readonly taskCount: 100;
          readonly rootHash: string;
          readonly tasks: readonly StateBenchQualificationTaskRecord[];
        };
        readonly testInventory: {
          readonly taskCount: 50;
          readonly rootHash: string;
          readonly tasks: readonly StateBenchQualificationTaskRecord[];
        };
        readonly qualification: {
          readonly taskCount: 20;
          readonly taskIds: readonly string[];
          readonly taskSetHash: string;
        };
        readonly extraction: {
          readonly taskCount: 80;
          readonly taskIds: readonly string[];
          readonly taskSetHash: string;
          readonly trajectoryCorpusHash: string;
        };
      }
    >
  >;
  readonly execution: StateBenchQualificationExecutionInput & {
    readonly executionPolicyHash: string;
    readonly nonModelConfigHash: string;
    readonly expectedRuntimeClosureHash: string;
    readonly repeatScheduleHash: string;
    readonly attemptScheduleHash: string;
    readonly plannedTaskClusters: 60;
    readonly plannedAttemptCells: number;
  };
  readonly unresolvedEligibilityRequirements: readonly [
    "external_preregistration_and_trust_policy",
    "physical_source_isolation_and_runtime_closure",
    "raw_agent_simulator_judge_provider_receipts",
    "provider_request_ids_actual_models_usage_cost_latency_exact_bytes",
    "independent_tool_and_environment_replay",
  ];
  readonly planHash: string;
}

export interface StateBenchQualificationAttemptCell {
  readonly sequence: number;
  readonly cellId: string;
  readonly domain: StateBenchQualificationDomain;
  readonly taskId: string;
  readonly canonicalTaskHash: string;
  readonly repeatIndex: number;
  readonly repeatLabel: string;
  readonly arm: StateBenchQualificationArm;
  readonly armOrderPosition: number;
}

export interface StateBenchQualificationSourceArtifact {
  readonly entries: readonly {
    readonly domain: StateBenchQualificationDomain;
    readonly sourceTrajectories: readonly string[];
  }[];
}

export interface StateBenchQualificationPlanVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

interface StateBenchQualificationPlanDependencies {
  readonly manifest: {
    readonly upstreamUrl: string;
    readonly upstreamRevision: string;
    readonly packageVersion: string;
    readonly officialProtocolId: string;
    readonly protocolFileSha256: string;
    readonly splitVersion: string;
  };
  readonly domains: readonly StateBenchQualificationDomain[];
  readonly assertVerifiedCheckout: (path: string) => string;
  readonly loadSplitManifest: (
    root: string,
    domain: StateBenchQualificationDomain,
  ) => { readonly train: readonly string[]; readonly test: readonly string[] };
  readonly sha256: (bytes: string | Buffer) => string;
  readonly canonical: (value: unknown) => string;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
const ARMS = ["native", "sham", "substrate"] as const;
const PLAN_SCHEMA = "pm-state-bench-qualification-plan.v1" as const;

function normalize(path: string): string {
  return path.split(sep).join("/");
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function timestamp(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (Number.isNaN(Date.parse(parsed)) || new Date(parsed).toISOString() !== parsed) {
    throw new Error(`${path} must be an exact UTC ISO-8601 timestamp`);
  }
  return parsed;
}

function sha(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be lowercase SHA-256`);
  return parsed;
}

function finitePositive(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${path} must be finite and greater than zero`);
  }
  return value;
}

function finiteNonNegative(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be finite and non-negative`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${path} must be a non-negative integer`);
  }
  return value as number;
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

function object(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function immutableFile(root: string, relativePath: string): Buffer {
  const rootReal = realpathSync(root);
  const path = resolve(root, relativePath);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`qualification evidence must be a regular file: ${relativePath}`);
  }
  const real = realpathSync(path);
  const rel = normalize(relative(rootReal, real));
  if (rel.startsWith("../") || rel === "..") {
    throw new Error(`qualification evidence escapes the checkout: ${relativePath}`);
  }
  return readFileSync(real);
}

function parseExecutionInput(value: unknown): StateBenchQualificationExecutionInput {
  const root = object(value, "execution");
  exactKeys(root, ["agentModel", "components", "arms", "repeatLabels", "armRandomizationSeed", "policy"], "execution");
  const model = object(root.agentModel, "execution.agentModel");
  exactKeys(model, ["modelId", "modelDigest", "reasoningLevel"], "execution.agentModel");
  if (
    model.reasoningLevel !== null &&
    model.reasoningLevel !== "low" &&
    model.reasoningLevel !== "medium" &&
    model.reasoningLevel !== "high"
  ) {
    throw new Error("execution.agentModel.reasoningLevel is invalid");
  }
  const components = object(root.components, "execution.components");
  const componentKeys = [
    "systemPromptHash",
    "toolsHash",
    "simulatorHash",
    "judgeHash",
    "decodingHash",
    "runnerHash",
    "adapterHash",
  ] as const;
  exactKeys(components, componentKeys, "execution.components");
  const parsedComponents = Object.fromEntries(
    componentKeys.map((key) => [key, sha(components[key], `execution.components.${key}`)]),
  ) as StateBenchQualificationExecutionInput["components"];
  const arms = object(root.arms, "execution.arms");
  exactKeys(arms, ARMS, "execution.arms");
  const parsedArms = Object.fromEntries(
    ARMS.map((arm) => {
      const item = object(arms[arm], `execution.arms.${arm}`);
      exactKeys(
        item,
        [
          "interventionHash",
          "implementationRevision",
          "sidecarShapeHash",
          "expectedToolCalls",
          "expectedPromptTokens",
          "expectedAddedLatencyMs",
        ],
        `execution.arms.${arm}`,
      );
      return [
        arm,
        {
          interventionHash: sha(item.interventionHash, `execution.arms.${arm}.interventionHash`),
          implementationRevision: sha(item.implementationRevision, `execution.arms.${arm}.implementationRevision`),
          sidecarShapeHash: sha(item.sidecarShapeHash, `execution.arms.${arm}.sidecarShapeHash`),
          expectedToolCalls: nonNegativeInteger(item.expectedToolCalls, `execution.arms.${arm}.expectedToolCalls`),
          expectedPromptTokens: nonNegativeInteger(item.expectedPromptTokens, `execution.arms.${arm}.expectedPromptTokens`),
          expectedAddedLatencyMs: finiteNonNegative(item.expectedAddedLatencyMs, `execution.arms.${arm}.expectedAddedLatencyMs`),
        },
      ];
    }),
  ) as unknown as StateBenchQualificationExecutionInput["arms"];
  if (new Set(ARMS.map((arm) => parsedArms[arm].interventionHash)).size !== 3) {
    throw new Error("qualification arm intervention hashes must be distinct");
  }
  for (const key of [
    "sidecarShapeHash",
    "expectedToolCalls",
    "expectedPromptTokens",
    "expectedAddedLatencyMs",
  ] as const) {
    if (parsedArms.sham[key] !== parsedArms.substrate[key]) {
      throw new Error(`qualification sham/substrate ${key} must match`);
    }
  }
  if (!Array.isArray(root.repeatLabels) || root.repeatLabels.length === 0) {
    throw new Error("execution.repeatLabels must be a non-empty array");
  }
  const repeatLabels = root.repeatLabels.map((entry, index) =>
    safeId(entry, `execution.repeatLabels/${index}`),
  );
  if (new Set(repeatLabels).size !== repeatLabels.length) {
    throw new Error("execution.repeatLabels must be unique");
  }
  const policy = object(root.policy, "execution.policy");
  exactKeys(
    policy,
    [
      "maxTaskAttemptsPerCell",
      "maxProviderAttemptsPerCall",
      "failedCellsCountAsStrictFailure",
      "replacementAttempts",
      "stoppingRule",
      "outcomeInspection",
      "workers",
      "maximumTotalCostUsd",
      "maximumWallClockMs",
    ],
    "execution.policy",
  );
  if (
    policy.maxTaskAttemptsPerCell !== 1 ||
    policy.maxProviderAttemptsPerCall !== 1 ||
    policy.failedCellsCountAsStrictFailure !== true ||
    policy.replacementAttempts !== "forbidden" ||
    policy.stoppingRule !== "complete_fixed_schedule_or_invalidate" ||
    policy.outcomeInspection !== "after_phase_complete" ||
    policy.workers !== 1
  ) {
    throw new Error("qualification execution policy permits hidden retries, replacement, selective stopping, or parallel schedule drift");
  }
  return {
    agentModel: {
      modelId: safeId(model.modelId, "execution.agentModel.modelId"),
      modelDigest: sha(model.modelDigest, "execution.agentModel.modelDigest"),
      reasoningLevel: model.reasoningLevel,
    },
    components: parsedComponents,
    arms: parsedArms,
    repeatLabels,
    armRandomizationSeed: requiredString(root.armRandomizationSeed, "execution.armRandomizationSeed"),
    policy: {
      maxTaskAttemptsPerCell: 1,
      maxProviderAttemptsPerCall: 1,
      failedCellsCountAsStrictFailure: true,
      replacementAttempts: "forbidden",
      stoppingRule: "complete_fixed_schedule_or_invalidate",
      outcomeInspection: "after_phase_complete",
      workers: 1,
      maximumTotalCostUsd: finitePositive(policy.maximumTotalCostUsd, "execution.policy.maximumTotalCostUsd"),
      maximumWallClockMs: finitePositive(policy.maximumWallClockMs, "execution.policy.maximumWallClockMs"),
    },
  };
}

function parseInput(value: unknown): StateBenchQualificationPlanInput {
  const root = object(value, "qualification plan input");
  exactKeys(
    root,
    ["planId", "experimentId", "producerIdentity", "frozenAt", "selectionSeed", "qualificationTasksPerDomain", "execution"],
    "qualification plan input",
  );
  if (root.qualificationTasksPerDomain !== 20) {
    throw new Error("qualificationTasksPerDomain must equal the fixed 20-task/domain protocol");
  }
  return {
    planId: safeId(root.planId, "planId"),
    experimentId: safeId(root.experimentId, "experimentId"),
    producerIdentity: safeId(root.producerIdentity, "producerIdentity"),
    frozenAt: timestamp(root.frozenAt, "frozenAt"),
    selectionSeed: requiredString(root.selectionSeed, "selectionSeed"),
    qualificationTasksPerDomain: 20,
    execution: parseExecutionInput(root.execution),
  };
}

export function createStateBenchQualificationPlanning(
  dependencies: StateBenchQualificationPlanDependencies,
) {
  const { manifest, domains, assertVerifiedCheckout, loadSplitManifest, sha256, canonical } = dependencies;

  function taskRecord(
    root: string,
    domain: StateBenchQualificationDomain,
    taskId: string,
    split: "train" | "test",
  ): StateBenchQualificationTaskRecord {
    const taskPath = `state_bench/domains/${domain}/tasks/${taskId}.json`;
    const environmentPath = `state_bench/domains/${domain}/task_envs/${taskId}.json`;
    const taskHash = sha256(immutableFile(root, taskPath));
    const environmentHash = sha256(immutableFile(root, environmentPath));
    const trainTrajectory = split === "train"
      ? (() => {
          const path = `datasets/train_task_trajectories/${domain}/${taskId}.json`;
          return { path, sha256: sha256(immutableFile(root, path)) };
        })()
      : null;
    return {
      taskId,
      canonicalTaskHash: sha256(
        canonical({
          schemaVersion: "pm-state-bench-canonical-task.v1",
          domain,
          taskId,
          taskDefinitionSha256: taskHash,
          initialEnvironmentSha256: environmentHash,
        }),
      ),
      taskDefinition: { path: taskPath, sha256: taskHash },
      initialEnvironment: { path: environmentPath, sha256: environmentHash },
      trainTrajectory,
    };
  }

  function inventoryHash(
    domain: StateBenchQualificationDomain,
    split: "train" | "test",
    tasks: readonly StateBenchQualificationTaskRecord[],
  ): string {
    return sha256(
      canonical({
        schemaVersion: "pm-state-bench-task-inventory.v1",
        domain,
        split,
        tasks,
      }),
    );
  }

  function taskSetHash(
    domain: StateBenchQualificationDomain,
    purpose: "qualification" | "extraction",
    tasks: readonly StateBenchQualificationTaskRecord[],
  ): string {
    return sha256(
      canonical({
        schemaVersion: "pm-state-bench-train-task-set.v1",
        domain,
        purpose,
        tasks: tasks.map((task) => ({
          taskId: task.taskId,
          canonicalTaskHash: task.canonicalTaskHash,
          trainTrajectorySha256: task.trainTrajectory?.sha256,
        })),
      }),
    );
  }

  function planInputFrom(value: StateBenchQualificationPlan): StateBenchQualificationPlanInput {
    return {
      planId: value.planId,
      experimentId: value.experimentId,
      producerIdentity: value.producerIdentity,
      frozenAt: value.frozenAt,
      selectionSeed: value.selection.seed,
      qualificationTasksPerDomain: 20,
      execution: {
        agentModel: value.execution.agentModel,
        components: value.execution.components,
        arms: value.execution.arms,
        repeatLabels: value.execution.repeatLabels,
        armRandomizationSeed: value.execution.armRandomizationSeed,
        policy: value.execution.policy,
      },
    };
  }

  function deriveAttemptSchedule(
    plan: Pick<StateBenchQualificationPlan, "experimentId" | "domains" | "execution">,
  ): readonly StateBenchQualificationAttemptCell[] {
    let sequence = 0;
    const cells: StateBenchQualificationAttemptCell[] = [];
    for (const domain of domains) {
      const inventory = new Map(
        plan.domains[domain].trainInventory.tasks.map((task) => [task.taskId, task] as const),
      );
      for (const taskId of plan.domains[domain].qualification.taskIds) {
        const task = inventory.get(taskId);
        if (task === undefined) throw new Error(`qualification task is absent from train inventory: ${domain}/${taskId}`);
        for (let repeatIndex = 0; repeatIndex < plan.execution.repeatLabels.length; repeatIndex += 1) {
          const repeatLabel = plan.execution.repeatLabels[repeatIndex]!;
          const order = [...ARMS].sort((left, right) => {
            const leftHash = sha256(canonical({
              algorithm: "sha256-arm-order-v1",
              seed: plan.execution.armRandomizationSeed,
              canonicalTaskHash: task.canonicalTaskHash,
              repeatLabel,
              arm: left,
            }));
            const rightHash = sha256(canonical({
              algorithm: "sha256-arm-order-v1",
              seed: plan.execution.armRandomizationSeed,
              canonicalTaskHash: task.canonicalTaskHash,
              repeatLabel,
              arm: right,
            }));
            return leftHash < rightHash ? -1 : leftHash > rightHash ? 1 : 0;
          });
          for (let armOrderPosition = 0; armOrderPosition < order.length; armOrderPosition += 1) {
            const arm = order[armOrderPosition]!;
            sequence += 1;
            cells.push({
              sequence,
              cellId: `${plan.experimentId}:qualification:${domain}:${taskId}:${repeatLabel}:${arm}`,
              domain,
              taskId,
              canonicalTaskHash: task.canonicalTaskHash,
              repeatIndex,
              repeatLabel,
              arm,
              armOrderPosition,
            });
          }
        }
      }
    }
    return cells;
  }

  function createQualificationPlan(
    checkoutPath: string,
    rawInput: StateBenchQualificationPlanInput,
  ): StateBenchQualificationPlan {
    const input = parseInput(rawInput);
    const root = assertVerifiedCheckout(checkoutPath);
    const domainPlans = Object.fromEntries(
      domains.map((domain) => {
        const split = loadSplitManifest(root, domain);
        const trainTasks = split.train.map((taskId) => taskRecord(root, domain, taskId, "train"));
        const testTasks = split.test.map((taskId) => taskRecord(root, domain, taskId, "test"));
        const ranked = trainTasks
          .map((task) => ({
            task,
            rank: sha256(canonical({
              schemaVersion: "pm-state-bench-qualification-selection.v1",
              algorithm: "sha256-domain-task-rank-v1",
              seed: input.selectionSeed,
              domain,
              taskId: task.taskId,
              canonicalTaskHash: task.canonicalTaskHash,
            })),
          }))
          .sort((left, right) =>
            left.rank < right.rank
              ? -1
              : left.rank > right.rank
                ? 1
                : codeUnitCompare(left.task.taskId, right.task.taskId),
          );
        const qualificationTasks = ranked
          .slice(0, 20)
          .map((entry) => entry.task)
          .sort((left, right) => codeUnitCompare(left.taskId, right.taskId));
        const qualificationIds = new Set(qualificationTasks.map((task) => task.taskId));
        const extractionTasks = trainTasks.filter((task) => !qualificationIds.has(task.taskId));
        const splitPath = `state_bench/domains/${domain}/splits/${manifest.splitVersion}.json`;
        return [
          domain,
          {
            splitManifest: { path: splitPath, sha256: sha256(immutableFile(root, splitPath)) },
            trainInventory: {
              taskCount: 100 as const,
              rootHash: inventoryHash(domain, "train", trainTasks),
              tasks: trainTasks,
            },
            testInventory: {
              taskCount: 50 as const,
              rootHash: inventoryHash(domain, "test", testTasks),
              tasks: testTasks,
            },
            qualification: {
              taskCount: 20 as const,
              taskIds: qualificationTasks.map((task) => task.taskId),
              taskSetHash: taskSetHash(domain, "qualification", qualificationTasks),
            },
            extraction: {
              taskCount: 80 as const,
              taskIds: extractionTasks.map((task) => task.taskId),
              taskSetHash: taskSetHash(domain, "extraction", extractionTasks),
              trajectoryCorpusHash: sha256(
                extractionTasks
                  .map((task) => `${task.trainTrajectory!.path}\0${task.trainTrajectory!.sha256}\n`)
                  .sort()
                  .join(""),
              ),
            },
          },
        ];
      }),
    ) as unknown as StateBenchQualificationPlan["domains"];
    const executionPolicyHash = sha256(canonical({
      schemaVersion: "pm-state-bench-execution-policy.v1",
      ...input.execution.policy,
    }));
    const nonModelConfigHash = sha256(canonical({
      schemaVersion: "pm-state-bench-qualification-non-model-config.v1",
      components: input.execution.components,
      executionPolicyHash,
    }));
    const expectedRuntimeClosureHash = sha256(canonical({
      schemaVersion: "pm-state-bench-qualification-expected-runtime-closure.v1",
      components: input.execution.components,
      arms: input.execution.arms,
      executionPolicyHash,
    }));
    const repeatScheduleHash = sha256(canonical({
      schemaVersion: "pm-state-bench-repeat-schedule.v1",
      repeatLabels: input.execution.repeatLabels,
    }));
    const baseExecution = {
      ...input.execution,
      executionPolicyHash,
      nonModelConfigHash,
      expectedRuntimeClosureHash,
      repeatScheduleHash,
      attemptScheduleHash: "",
      plannedTaskClusters: 60 as const,
      plannedAttemptCells: 60 * input.execution.repeatLabels.length * ARMS.length,
    };
    const schedule = deriveAttemptSchedule({
      experimentId: input.experimentId,
      domains: domainPlans,
      execution: baseExecution,
    });
    const body = {
      schemaVersion: PLAN_SCHEMA,
      evidenceClass: "train_partition_technical_qualification_only" as const,
      authorityStatus: "ineligible_for_efficacy_or_decision" as const,
      claimBoundary: "partition_and_schedule_integrity_not_runtime_isolation_provider_identity_or_public_efficacy" as const,
      planId: input.planId,
      experimentId: input.experimentId,
      producerIdentity: input.producerIdentity,
      frozenAt: input.frozenAt,
      benchmark: {
        repositoryUrl: manifest.upstreamUrl,
        revision: manifest.upstreamRevision,
        packageVersion: manifest.packageVersion,
        protocolId: manifest.officialProtocolId,
        protocolFileSha256: manifest.protocolFileSha256,
        splitVersion: manifest.splitVersion,
      },
      selection: {
        algorithm: "sha256-domain-task-rank-v1" as const,
        seed: input.selectionSeed,
        qualificationTasksPerDomain: 20 as const,
      },
      sourcePolicy: {
        qualificationSplit: "train" as const,
        qualificationArtifactSources: "train_partition_excluding_qualification_tasks" as const,
        decisionArtifactSources: "complete_train_split_only" as const,
        heldOutTestAccessDuringQualification: "forbidden" as const,
        qualificationDecisionEligible: false as const,
      },
      runtimeContextPolicy: {
        allowedAgentFields: ["task_id", "domain"] as const,
        forbiddenOracleBearingFields: ["task_summary", "state_requirements", "task_requirements"] as const,
        exactAdapterAndRuntimeClosureRequired: true as const,
      },
      domains: domainPlans,
      execution: {
        ...baseExecution,
        attemptScheduleHash: sha256(canonical({
          schemaVersion: "pm-state-bench-attempt-schedule.v1",
          cells: schedule,
        })),
      },
      unresolvedEligibilityRequirements: [
        "external_preregistration_and_trust_policy",
        "physical_source_isolation_and_runtime_closure",
        "raw_agent_simulator_judge_provider_receipts",
        "provider_request_ids_actual_models_usage_cost_latency_exact_bytes",
        "independent_tool_and_environment_replay",
      ] as const,
    };
    return { ...body, planHash: sha256(canonical(body)) };
  }

  function loadQualificationPlan(checkoutPath: string, value: unknown): StateBenchQualificationPlan {
    const root = object(value, "qualification plan");
    if (root.schemaVersion !== PLAN_SCHEMA) throw new Error("unsupported qualification plan schemaVersion");
    const recomputed = createQualificationPlan(
      checkoutPath,
      planInputFrom(value as StateBenchQualificationPlan),
    );
    if (canonical(value) !== canonical(recomputed)) {
      throw new Error("qualification plan is incomplete, stale, or does not recompute from the pinned checkout");
    }
    return recomputed;
  }

  function verifyQualificationPlan(
    checkoutPath: string,
    value: unknown,
  ): StateBenchQualificationPlanVerification {
    try {
      loadQualificationPlan(checkoutPath, value);
      return { valid: true, issues: [] };
    } catch (error) {
      return { valid: false, issues: [error instanceof Error ? error.message : String(error)] };
    }
  }

  function qualificationAttemptSchedule(
    checkoutPath: string,
    value: unknown,
  ): readonly StateBenchQualificationAttemptCell[] {
    const plan = loadQualificationPlan(checkoutPath, value);
    const cells = deriveAttemptSchedule(plan);
    const hash = sha256(canonical({
      schemaVersion: "pm-state-bench-attempt-schedule.v1",
      cells,
    }));
    if (hash !== plan.execution.attemptScheduleHash) {
      throw new Error("qualification attempt schedule does not match the plan");
    }
    return cells;
  }

  function assertQualificationArtifactSources(
    checkoutPath: string,
    planValue: unknown,
    artifact: StateBenchQualificationSourceArtifact,
  ): void {
    const plan = loadQualificationPlan(checkoutPath, planValue);
    for (const [index, entry] of artifact.entries.entries()) {
      const allowed = new Set(plan.domains[entry.domain].extraction.taskIds);
      for (const source of entry.sourceTrajectories) {
        const prefix = `datasets/train_task_trajectories/${entry.domain}/`;
        if (!source.startsWith(prefix) || !source.endsWith(".json")) {
          throw new Error(`qualification artifact entry ${index} cites a non-train or cross-domain source`);
        }
        const taskId = source.slice(prefix.length, -".json".length);
        if (!allowed.has(taskId)) {
          throw new Error(`qualification artifact cites reserved qualification or held-out source: ${source}`);
        }
      }
    }
  }

  return Object.freeze({
    createQualificationPlan,
    loadQualificationPlan,
    verifyQualificationPlan,
    qualificationAttemptSchedule,
    assertQualificationArtifactSources,
  });
}

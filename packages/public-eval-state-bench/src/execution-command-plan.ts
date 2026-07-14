import { existsSync, realpathSync } from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import { publicEvalExpectedArmOrder } from "@pm/public-eval-analysis";

import type { StateBenchDecisionManifestBridge } from "./decision-manifest.js";
import type { StateBenchRunConfig } from "./execution-plan.js";
import type {
  StateBenchQualificationArm,
  StateBenchQualificationAttemptCell,
  StateBenchQualificationDomain,
  StateBenchQualificationPlan,
} from "./qualification-plan.js";

const ARMS = ["native", "sham", "substrate"] as const;
const DOMAINS = [
  "travel",
  "customer_support",
  "shopping_assistant",
] as const;
const COMMAND_PLAN_SCHEMA = "pm-state-bench-execution-command-plan.v1" as const;
const COMMAND_SCHEMA = "pm-state-bench-execution-command.v1" as const;
const DECISION_TASK_SELECTION_BINDING = {
  selectionMode: "exact_verified_test_task_id_per_cell",
  exactTaskOption: "--tasks",
  parserSplitSentinel: ["--split", "all"],
  parserSplitSentinelSemantics:
    "upstream_parser_compatibility_only_not_train_plus_test_dataset_selection",
  directSplitSelection:
    "forbidden_upstream_rejects_tasks_with_split_train_or_test",
  testInventoryAuthority:
    "verified_qualification_plan_test_inventory_exactly_50_tasks_per_domain",
} as const;

export interface StateBenchExecutionCommandPlanInput {
  /** One verified config for every domain/arm coordinate in exactly one phase. */
  readonly runConfigs: readonly unknown[];
  /** Absolute output root outside the verified upstream checkout. */
  readonly outputRoot: string;
  /** Loopback-only endpoint used by both sidecar arms; absent from native. */
  readonly retrievalUrl: string;
}

export type StateBenchExecutionEnvironment = Readonly<
  Record<
    | "PM_STATE_BENCH_EXPERIMENT_ID"
    | "PM_STATE_BENCH_CONFIG_SHA256"
    | "PM_STATE_BENCH_RUN_ID"
    | "PM_STATE_BENCH_MODEL_ID"
    | "PM_STATE_BENCH_RETRIEVAL_URL",
    string
  >
>;

export interface StateBenchExecutionCommand {
  readonly schemaVersion: typeof COMMAND_SCHEMA;
  readonly sequence: number;
  readonly cellId: string;
  readonly phase: StateBenchRunConfig["phase"];
  readonly arm: StateBenchQualificationArm;
  readonly domain: StateBenchQualificationDomain;
  readonly taskId: string;
  readonly repeatIndex: number;
  readonly repeatLabel: string;
  readonly runIndex: number;
  readonly runId: string;
  readonly armOrderPosition: number;
  readonly expectedSplit: "train" | "test";
  readonly runConfigHash: string;
  readonly armInterventionHash: string;
  readonly outputDirectory: string;
  readonly expectedTrajectoryPath: string;
  readonly environmentPolicy:
    | "native_pm_identity_environment_forbidden"
    | "sidecar_exact_non_secret_pm_identity_environment_required";
  readonly environment: StateBenchExecutionEnvironment | Readonly<Record<string, never>>;
  readonly environmentHash: string;
  readonly executable: "uv";
  readonly argv: readonly string[];
  readonly argvHash: string;
  readonly commandHash: string;
}

export interface StateBenchExecutionCommandPlan {
  readonly schemaVersion: typeof COMMAND_PLAN_SCHEMA;
  readonly evidenceClass: "execution_command_plan_not_behavioral_evidence";
  readonly authorityStatus:
    "raw_instrumented_execution_and_independent_attestation_required";
  readonly experimentId: string;
  readonly phase: StateBenchRunConfig["phase"];
  readonly qualificationPlanHash: string;
  readonly decisionManifestHash: string | null;
  readonly preregistrationReceiptHash: string | null;
  readonly upstream: {
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly workingDirectory: string;
    readonly module: "state_bench.scripts.run_batch";
  };
  readonly optionContract: {
    readonly exactTaskOption: "--tasks";
    readonly explicitSplitSentinel: readonly ["--split", "all"];
    readonly splitSentinelSemantics:
      "upstream_parser_compatibility_only_exact_bound_task_id_controls_selection";
    readonly incompatibility:
      "upstream_rejects_tasks_with_split_train_or_test";
    readonly taskMembershipAuthority:
      "verified_bound_run_config_and_phase_plan";
    readonly taskRetryOption: readonly ["--retry-attempts", "1"];
    readonly providerRetryCaveat:
      "retry_attempts_controls_task_worker_only_upstream_provider_clients_may_retry_internally";
    readonly repeatCaveat:
      "run_index_is_a_stochastic_repeat_identity_not_a_sampling_seed";
    readonly modelIdentityCaveat:
      "agent_model_name_is_declarative_actual_provider_model_requires_raw_transport_attestation";
    readonly environmentPolicy:
      "only_five_non_secret_pm_identity_variables_are_bound_sidecar_only";
    readonly secretPolicy:
      "api_keys_tokens_and_credentials_are_forbidden_from_command_plan";
  };
  readonly outputRoot: string;
  readonly runConfigSetHash: string;
  readonly attemptScheduleHash: string;
  readonly commandCount: number;
  readonly commandRootHash: string;
  readonly commands: readonly StateBenchExecutionCommand[];
  readonly unresolvedExecutionRequirements: readonly [
    "instrument_provider_simulator_judge_and_agent_transports",
    "disable_or_retain_every_internal_provider_retry",
    "attest_actual_provider_models_deployments_request_ids_usage_cost_latency",
    "attest_sidecar_treatment_uptake_and_runtime_closure",
    "sanitize_inherited_environment_and_attest_the_exact_non_secret_environment",
    "refuse_existing_or_partially_written_output_cells",
  ];
  readonly planHash: string;
}

export interface StateBenchExecutionCommandPlanVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

interface StateBenchExecutionCommandPlanDependencies {
  readonly sha256: (bytes: string | Buffer) => string;
  readonly canonical: (value: unknown) => string;
  readonly parseRunConfig: (value: unknown) => StateBenchRunConfig;
  readonly verifyBoundRunConfig: (
    checkoutPath: string,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    value: unknown,
  ) => StateBenchExecutionCommandPlanVerification;
  readonly loadQualificationPlan: (
    checkoutPath: string,
    value: unknown,
  ) => StateBenchQualificationPlan;
  readonly qualificationAttemptSchedule: (
    checkoutPath: string,
    value: unknown,
  ) => readonly StateBenchQualificationAttemptCell[];
  readonly loadDecisionManifestBridge: (
    checkoutPath: string,
    qualificationPlanValue: unknown,
    value: unknown,
  ) => StateBenchDecisionManifestBridge;
  readonly officialRunId: (
    config: StateBenchRunConfig,
    runIndex: number,
  ) => string;
}

interface PlannedCell {
  readonly sequence: number;
  readonly cellId: string;
  readonly domain: StateBenchQualificationDomain;
  readonly taskId: string;
  readonly repeatIndex: number;
  readonly repeatLabel: string;
  readonly arm: StateBenchQualificationArm;
  readonly armOrderPosition: number;
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function coordinate(
  arm: StateBenchQualificationArm,
  domain: StateBenchQualificationDomain,
): string {
  return `${domain}/${arm}`;
}

function canonicalOutputRoot(checkoutRoot: string, value: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.includes("\0") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    throw new Error("outputRoot must be a non-empty path without control characters");
  }
  if (!isAbsolute(value)) {
    throw new Error("outputRoot must be an absolute path");
  }
  let existing = resolve(value);
  const missing: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) {
      throw new Error("outputRoot has no resolvable existing ancestor");
    }
    missing.unshift(basename(existing));
    existing = parent;
  }
  const outputRoot = resolve(realpathSync(existing), ...missing);
  const fromCheckout = relative(checkoutRoot, outputRoot);
  if (
    fromCheckout === "" ||
    (fromCheckout !== ".." &&
      !fromCheckout.startsWith(`..${sep}`) &&
      !isAbsolute(fromCheckout))
  ) {
    throw new Error("outputRoot must be outside the verified upstream checkout");
  }
  return outputRoot;
}

function loopbackRetrievalUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("retrievalUrl must be an absolute HTTP URL");
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.port.length === 0 ||
    parsed.pathname !== "/retrieve" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error(
      "retrievalUrl must be http://127.0.0.1:<port>/retrieve without credentials, query, or fragment",
    );
  }
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("retrievalUrl has an invalid loopback port");
  }
  return parsed.href;
}

function decisionDomainAndTask(
  canonicalTaskId: string,
): readonly [StateBenchQualificationDomain, string] {
  for (const domain of DOMAINS) {
    const prefix = `state:${domain}:`;
    if (canonicalTaskId.startsWith(prefix)) {
      const taskId = canonicalTaskId.slice(prefix.length);
      if (taskId.length === 0 || taskId.includes(",")) {
        throw new Error(`decision task has an invalid upstream task ID: ${canonicalTaskId}`);
      }
      return [domain, taskId];
    }
  }
  throw new Error(`decision task has an invalid STATE-Bench identity: ${canonicalTaskId}`);
}

export function createStateBenchExecutionCommandPlanner(
  dependencies: StateBenchExecutionCommandPlanDependencies,
) {
  const {
    sha256,
    canonical,
    parseRunConfig,
    verifyBoundRunConfig,
    loadQualificationPlan,
    qualificationAttemptSchedule,
    loadDecisionManifestBridge,
    officialRunId,
  } = dependencies;

  function assertSharedBindings(configs: readonly StateBenchRunConfig[]): void {
    const first = configs[0]!;
    const shared = (config: StateBenchRunConfig) => ({
      phasePartitionHash: config.phasePartitionHash,
      qualificationPlanHash: config.qualificationPlanHash,
      analysisManifestHash: config.analysisManifestHash,
      preregistrationReceiptHash: config.preregistrationReceiptHash,
      agentModel: config.agentModel,
      split: config.split,
      numRuns: config.numRuns,
      runLabels: config.runLabels,
      repeatScheduleHash: config.repeatScheduleHash,
      attemptScheduleHash: config.attemptScheduleHash,
      nonModelConfigHash: config.nonModelConfigHash,
      executionPolicyHash: config.executionPolicyHash,
      runtimeClosureHash: config.runtimeClosureHash,
      retryPolicy: config.retryPolicy,
    });
    const expected = canonical(shared(first));
    if (configs.some((config) => canonical(shared(config)) !== expected)) {
      throw new Error(
        "run config set mixes phase partition, manifest, preregistration, model, policy, schedule, or runtime bindings",
      );
    }
    const sidecars = configs.filter((config) => config.arm !== "native");
    const artifactBinding = canonical({
      artifactSealHash: sidecars[0]!.artifactSealHash,
      extractionProvenanceHash: sidecars[0]!.extractionProvenanceHash,
    });
    if (
      sidecars.some(
        (config) =>
          canonical({
            artifactSealHash: config.artifactSealHash,
            extractionProvenanceHash: config.extractionProvenanceHash,
          }) !== artifactBinding,
      ) ||
      configs
        .filter((config) => config.arm === "native")
        .some(
          (config) =>
            config.artifactSealHash !== null ||
            config.extractionProvenanceHash !== null,
        )
    ) {
      throw new Error(
        "run config set mixes sidecar artifact/extraction bindings or gives them to native",
      );
    }
    for (const arm of ARMS) {
      const interventions = new Set(
        configs
          .filter((config) => config.arm === arm)
          .map((config) => config.armInterventionHash),
      );
      if (interventions.size !== 1) {
        throw new Error(`run config set mixes ${arm} intervention bindings`);
      }
    }
  }

  function verifiedConfigs(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    values: readonly unknown[],
  ): readonly StateBenchRunConfig[] {
    if (values.length !== DOMAINS.length * ARMS.length) {
      throw new Error(
        "execution command plan requires exactly one bound run config for every domain/arm coordinate",
      );
    }
    const parsed = values.map((value, index) => {
      const verification = verifyBoundRunConfig(
        checkoutPath,
        qualificationPlanValue,
        decisionBridgeValue,
        value,
      );
      if (!verification.valid) {
        throw new Error(
          `runConfigs[${index}] is not a verified bound config: ${verification.issues.join("; ")}`,
        );
      }
      return parseRunConfig(value);
    });
    const phase = parsed[0]!.phase;
    const experimentId = parsed[0]!.experimentId;
    const byCoordinate = new Map<string, StateBenchRunConfig>();
    for (const config of parsed) {
      if (config.phase !== phase || config.experimentId !== experimentId) {
        throw new Error("all run configs must bind one experiment and one phase");
      }
      if (
        config.retryPolicy.maxTaskAttempts !== 1 ||
        config.retryPolicy.maxProviderAttempts !== 1
      ) {
        throw new Error("every command-plan config must bind one task and provider attempt");
      }
      const key = coordinate(config.arm, config.domain);
      if (byCoordinate.has(key)) {
        throw new Error(`duplicate run config coordinate: ${key}`);
      }
      byCoordinate.set(key, config);
    }
    for (const domain of DOMAINS) {
      for (const arm of ARMS) {
        if (!byCoordinate.has(coordinate(arm, domain))) {
          throw new Error(`missing run config coordinate: ${coordinate(arm, domain)}`);
        }
      }
    }
    const ordered = [...byCoordinate.values()].sort((left, right) => {
      const domainOrder = DOMAINS.indexOf(left.domain) - DOMAINS.indexOf(right.domain);
      return domainOrder === 0
        ? ARMS.indexOf(left.arm) - ARMS.indexOf(right.arm)
        : domainOrder;
    });
    assertSharedBindings(ordered);
    return ordered;
  }

  function decisionCells(
    bridge: StateBenchDecisionManifestBridge,
    phase: "confirmatory" | "replication",
  ): readonly PlannedCell[] {
    const tasks = bridge.analysisManifest.taskPlan
      .filter((task) => task.status === "included" && task.phase === phase)
      .sort((left, right) => codeUnitCompare(left.taskId, right.taskId));
    const scheduleForHash = tasks.flatMap((task) =>
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
    return scheduleForHash.map((cell, index) => {
      const task = tasks.find((entry) => entry.taskId === cell.taskId);
      if (task === undefined) throw new Error(`decision schedule task is missing: ${cell.taskId}`);
      const [domain, taskId] = decisionDomainAndTask(task.canonicalTaskId);
      return {
        sequence: index + 1,
        cellId: `${bridge.analysisManifest.experimentId}:${phase}:${domain}:${taskId}:${cell.repeatLabel}:${cell.arm}`,
        domain,
        taskId,
        repeatIndex: cell.repeatIndex,
        repeatLabel: cell.repeatLabel,
        arm: cell.arm,
        armOrderPosition: cell.armOrderPosition,
      };
    });
  }

  function assertDecisionTaskSelectionBinding(
    bridge: StateBenchDecisionManifestBridge,
    phase: "confirmatory" | "replication",
    configs: readonly StateBenchRunConfig[],
  ): void {
    if (
      bridge.protocolBinding.split !== "test" ||
      bridge.protocolBinding.tasksPerDomain !== 50 ||
      canonical(bridge.protocolBinding.upstreamTaskSelection) !==
        canonical(DECISION_TASK_SELECTION_BINDING)
    ) {
      throw new Error(
        "decision manifest bridge must bind exact verified test task IDs per cell and the --split all parser sentinel",
      );
    }
    const tasksByDomain = new Map<StateBenchQualificationDomain, Set<string>>(
      DOMAINS.map((domain) => [domain, new Set<string>()]),
    );
    for (const task of bridge.analysisManifest.taskPlan.filter(
      (entry) => entry.status === "included" && entry.phase === phase,
    )) {
      const [domain, taskId] = decisionDomainAndTask(task.canonicalTaskId);
      const domainTasks = tasksByDomain.get(domain)!;
      if (domainTasks.has(taskId)) {
        throw new Error(`decision manifest bridge repeats a task ID in ${domain}`);
      }
      domainTasks.add(taskId);
    }
    for (const domain of DOMAINS) {
      const expectedTaskIds = [...tasksByDomain.get(domain)!].sort(codeUnitCompare);
      if (expectedTaskIds.length !== bridge.protocolBinding.tasksPerDomain) {
        throw new Error(
          `decision manifest bridge must bind exactly 50 verified test task IDs for ${domain}`,
        );
      }
      for (const config of configs.filter((entry) => entry.domain === domain)) {
        if (
          config.split !== bridge.protocolBinding.split ||
          canonical([...config.taskIds].sort(codeUnitCompare)) !== canonical(expectedTaskIds)
        ) {
          throw new Error(
            `decision run config does not bind the bridge's exact test task inventory for ${domain}`,
          );
        }
      }
    }
  }

  function createPlan(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    input: StateBenchExecutionCommandPlanInput,
  ): StateBenchExecutionCommandPlan {
    const qualificationPlan = loadQualificationPlan(
      checkoutPath,
      qualificationPlanValue,
    );
    const configs = verifiedConfigs(
      checkoutPath,
      qualificationPlan,
      decisionBridgeValue,
      input.runConfigs,
    );
    const first = configs[0]!;
    const checkoutRoot = realpathSync(checkoutPath);
    const outputRoot = canonicalOutputRoot(checkoutRoot, input.outputRoot);
    const retrievalUrl = loopbackRetrievalUrl(input.retrievalUrl);
    if (
      first.phase === "qualification"
        ? decisionBridgeValue !== null
        : decisionBridgeValue === null
    ) {
      throw new Error(
        first.phase === "qualification"
          ? "qualification command plans forbid a decision manifest bridge"
          : "decision command plans require a decision manifest bridge",
      );
    }
    const bridge =
      first.phase === "qualification"
        ? null
        : loadDecisionManifestBridge(
            checkoutRoot,
            qualificationPlan,
            decisionBridgeValue,
          );
    if (bridge !== null && first.phase !== "qualification") {
      assertDecisionTaskSelectionBinding(bridge, first.phase, configs);
    }
    const cells: readonly PlannedCell[] =
      first.phase === "qualification"
        ? qualificationAttemptSchedule(checkoutRoot, qualificationPlan).map(
            (cell) => ({ ...cell }),
          )
        : decisionCells(bridge!, first.phase);
    const configByCoordinate = new Map(
      configs.map((config) => [
        coordinate(config.arm, config.domain),
        config,
      ] as const),
    );
    const commonScheduleHash = first.attemptScheduleHash;
    if (configs.some((config) => config.attemptScheduleHash !== commonScheduleHash)) {
      throw new Error("all run configs must bind the same phase attempt schedule");
    }
    if (bridge !== null) {
      const tasks = bridge.analysisManifest.taskPlan
        .filter((task) => task.status === "included" && task.phase === first.phase)
        .sort((left, right) => codeUnitCompare(left.taskId, right.taskId));
      const scheduleForHash = tasks.flatMap((task) =>
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
      const derived = sha256(canonical({
        schemaVersion: "pm-state-bench-decision-attempt-schedule.v1",
        phase: first.phase,
        cells: scheduleForHash,
      }));
      if (derived !== commonScheduleHash) {
        throw new Error("decision command schedule does not match the bound attemptScheduleHash");
      }
    }
    const expectedCellCount = configs.reduce(
      (sum, config) => sum + config.taskIds.length * config.numRuns,
      0,
    );
    if (cells.length !== expectedCellCount) {
      throw new Error(
        `attempt schedule has ${cells.length} cells; bound configs require ${expectedCellCount}`,
      );
    }
    const seenCells = new Set<string>();
    const commands = cells.map((cell, index): StateBenchExecutionCommand => {
      if (cell.sequence !== index + 1 || seenCells.has(cell.cellId)) {
        throw new Error("attempt schedule must have consecutive unique cells");
      }
      seenCells.add(cell.cellId);
      const config = configByCoordinate.get(coordinate(cell.arm, cell.domain));
      if (config === undefined) throw new Error(`cell has no bound config: ${cell.cellId}`);
      if (!config.taskIds.includes(cell.taskId)) {
        throw new Error(`cell task is absent from its bound config: ${cell.cellId}`);
      }
      if (
        cell.repeatIndex < 0 ||
        cell.repeatIndex >= config.numRuns ||
        config.runLabels[cell.repeatIndex] !== cell.repeatLabel
      ) {
        throw new Error(`cell repeat identity is absent from its bound config: ${cell.cellId}`);
      }
      const runIndex = cell.repeatIndex + 1;
      const runConfigHash = sha256(canonical(config));
      const runId = officialRunId(config, runIndex);
      const outputDirectory = resolve(
        outputRoot,
        config.phase,
        config.arm,
        config.domain,
      );
      const exactTaskOption =
        bridge?.protocolBinding.upstreamTaskSelection.exactTaskOption ?? "--tasks";
      const parserSplitSentinel =
        bridge?.protocolBinding.upstreamTaskSelection.parserSplitSentinel ??
        (["--split", "all"] as const);
      const argv = [
        "run",
        "--frozen",
        "python",
        "-m",
        "state_bench.scripts.run_batch",
        "--domain",
        config.domain,
        exactTaskOption,
        cell.taskId,
        ...parserSplitSentinel,
        "--output-dir",
        outputDirectory,
        "--num-runs",
        "1",
        "--num-runs-idx-start",
        String(runIndex),
        "--num-workers",
        "1",
        "--retry-attempts",
        "1",
        "--agent-model-name",
        config.agentModel.modelId,
        ...(config.agentModel.reasoningLevel === null
          ? []
          : [
              "--agent-model-reasoning-level",
              config.agentModel.reasoningLevel,
            ]),
        "--score-reasoning-effort",
        "high",
        ...(config.agentClass === "PmSubstrateAgent"
          ? [
              "--agent-class",
              "PmSubstrateAgent",
              "--retrieve-learnings-top-k",
              "3",
            ]
          : []),
      ];
      const environment: StateBenchExecutionCommand["environment"] =
        config.arm === "native"
          ? {}
          : {
              PM_STATE_BENCH_EXPERIMENT_ID: config.experimentId,
              PM_STATE_BENCH_CONFIG_SHA256: runConfigHash,
              PM_STATE_BENCH_RUN_ID: runId,
              PM_STATE_BENCH_MODEL_ID: config.agentModel.modelId,
              PM_STATE_BENCH_RETRIEVAL_URL: retrievalUrl,
            };
      const environmentHash = sha256(canonical({
        schemaVersion: "pm-state-bench-command-environment.v1",
        environment,
      }));
      const argvHash = sha256(canonical({
        schemaVersion: "pm-state-bench-upstream-argv.v1",
        workingDirectory: checkoutRoot,
        executable: "uv",
        argv,
        environmentHash,
      }));
      const commandBody = {
        schemaVersion: COMMAND_SCHEMA,
        sequence: cell.sequence,
        cellId: cell.cellId,
        phase: config.phase,
        arm: config.arm,
        domain: config.domain,
        taskId: cell.taskId,
        repeatIndex: cell.repeatIndex,
        repeatLabel: cell.repeatLabel,
        runIndex,
        runId,
        armOrderPosition: cell.armOrderPosition,
        expectedSplit: config.split,
        runConfigHash,
        armInterventionHash: config.armInterventionHash,
        outputDirectory,
        expectedTrajectoryPath: resolve(
          outputDirectory,
          `run${runIndex}`,
          `${cell.taskId}.json`,
        ),
        environmentPolicy:
          config.arm === "native"
            ? "native_pm_identity_environment_forbidden" as const
            : "sidecar_exact_non_secret_pm_identity_environment_required" as const,
        environment,
        environmentHash,
        executable: "uv" as const,
        argv,
        argvHash,
      };
      return {
        ...commandBody,
        commandHash: sha256(canonical(commandBody)),
      };
    });
    const configRecords = configs.map((config) => ({
      phase: config.phase,
      arm: config.arm,
      domain: config.domain,
      runConfigHash: sha256(canonical(config)),
    }));
    const runConfigSetHash = sha256(canonical({
      schemaVersion: "pm-state-bench-bound-run-config-set.v1",
      configs: configRecords,
    }));
    const commandRootHash = sha256(
      commands.map((command) => `${command.sequence}\0${command.commandHash}\n`).join(""),
    );
    const planBody = {
      schemaVersion: COMMAND_PLAN_SCHEMA,
      evidenceClass: "execution_command_plan_not_behavioral_evidence" as const,
      authorityStatus:
        "raw_instrumented_execution_and_independent_attestation_required" as const,
      experimentId: first.experimentId,
      phase: first.phase,
      qualificationPlanHash: qualificationPlan.planHash,
      decisionManifestHash: bridge?.analysisManifest.manifestHash ?? null,
      preregistrationReceiptHash: first.preregistrationReceiptHash,
      upstream: {
        repositoryUrl: qualificationPlan.benchmark.repositoryUrl,
        revision: qualificationPlan.benchmark.revision,
        workingDirectory: checkoutRoot,
        module: "state_bench.scripts.run_batch" as const,
      },
      optionContract: {
        exactTaskOption: "--tasks" as const,
        explicitSplitSentinel: ["--split", "all"] as const,
        splitSentinelSemantics:
          "upstream_parser_compatibility_only_exact_bound_task_id_controls_selection" as const,
        incompatibility:
          "upstream_rejects_tasks_with_split_train_or_test" as const,
        taskMembershipAuthority:
          "verified_bound_run_config_and_phase_plan" as const,
        taskRetryOption: ["--retry-attempts", "1"] as const,
        providerRetryCaveat:
          "retry_attempts_controls_task_worker_only_upstream_provider_clients_may_retry_internally" as const,
        repeatCaveat:
          "run_index_is_a_stochastic_repeat_identity_not_a_sampling_seed" as const,
        modelIdentityCaveat:
          "agent_model_name_is_declarative_actual_provider_model_requires_raw_transport_attestation" as const,
        environmentPolicy:
          "only_five_non_secret_pm_identity_variables_are_bound_sidecar_only" as const,
        secretPolicy:
          "api_keys_tokens_and_credentials_are_forbidden_from_command_plan" as const,
      },
      outputRoot,
      runConfigSetHash,
      attemptScheduleHash: commonScheduleHash,
      commandCount: commands.length,
      commandRootHash,
      commands,
      unresolvedExecutionRequirements: [
        "instrument_provider_simulator_judge_and_agent_transports",
        "disable_or_retain_every_internal_provider_retry",
        "attest_actual_provider_models_deployments_request_ids_usage_cost_latency",
        "attest_sidecar_treatment_uptake_and_runtime_closure",
        "sanitize_inherited_environment_and_attest_the_exact_non_secret_environment",
        "refuse_existing_or_partially_written_output_cells",
      ] as const,
    };
    return { ...planBody, planHash: sha256(canonical(planBody)) };
  }

  function verifyPlan(
    checkoutPath: string,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    input: StateBenchExecutionCommandPlanInput,
    value: unknown,
  ): StateBenchExecutionCommandPlanVerification {
    try {
      const expected = createPlan(
        checkoutPath,
        qualificationPlanValue,
        decisionBridgeValue,
        input,
      );
      if (canonical(value) !== canonical(expected)) {
        throw new Error(
          "execution command plan is incomplete, stale, or not derived from the bound configs",
        );
      }
      return { valid: true, issues: [] };
    } catch (error) {
      return {
        valid: false,
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  return Object.freeze({ createPlan, verifyPlan });
}

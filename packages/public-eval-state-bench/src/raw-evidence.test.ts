import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import { stateBenchRawEvidence } from "./raw-evidence.js";

const ARMS = ["native", "sham", "substrate"] as const;
const ROLES = ["runner", "agent", "simulator", "judge"] as const;
const BENCHMARK_REVISION = "fd980728da482af21f0d33406aea0ac499645125";

type Mutable = Record<string, any>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("fixture value is not JSON");
  return encoded;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function rawBytes(value: string | Buffer): Mutable {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return {
    encoding: "base64",
    bytesBase64: buffer.toString("base64"),
    byteLength: buffer.length,
    sha256: sha256(buffer),
  };
}

function jsonBytes(value: unknown): Mutable {
  return rawBytes(JSON.stringify(value));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeTreatmentIdentity(arm: (typeof ARMS)[number]): Mutable {
  const native = arm === "native";
  const body = {
    mode: native ? "none" : `${arm}_sidecar`,
    sidecarId: native ? null : "pm-substrate-state-sidecar",
    sidecarRevision: native ? null : "f".repeat(40),
    configurationSha256: native
      ? null
      : arm === "sham" ? "5".repeat(64) : "6".repeat(64),
    observationBoundaryId: native ? null : "before-agent-observation",
  };
  return { ...body, treatmentIdentityHash: sha256(canonical(body)) };
}

function makeExecutionCommandPlan(plan: Mutable): Mutable {
  let sequence = 0;
  const commands = (plan["tasks"] as Mutable[]).flatMap((taskSet) =>
    (taskSet["taskIds"] as string[]).flatMap((taskId) =>
      (plan["repeatIndices"] as number[]).flatMap((runIndex) => ARMS.map((arm, armOrderPosition) => {
        sequence += 1;
        const environment = arm === "native" ? {} : {
          PM_STATE_BENCH_EXPERIMENT_ID: plan["experimentId"],
          PM_STATE_BENCH_CONFIG_SHA256: sha256(`${arm}-config`),
          PM_STATE_BENCH_RUN_ID: `${plan["experimentId"]}-${arm}-${taskId}-${runIndex}`,
          PM_STATE_BENCH_MODEL_ID: ((plan["roleRuntimes"] as Mutable)["agent"] as Mutable)["canonicalModelId"],
          PM_STATE_BENCH_RETRIEVAL_URL: "http://127.0.0.1:43123/retrieve",
        };
        const environmentHash = sha256(canonical({
          schemaVersion: "pm-state-bench-command-environment.v1",
          environment,
        }));
        const argv = [
          "run", "--frozen", "python", "-m", "state_bench.scripts.run_batch",
          "--domain", taskSet["domain"], "--tasks", taskId, "--split", "all",
          "--output-dir", `/tmp/state-bench/${arm}/${taskSet["domain"]}`,
          "--num-runs", "1", "--num-runs-idx-start", String(runIndex),
          "--num-workers", "1", "--retry-attempts", "1",
          "--agent-model-name", ((plan["roleRuntimes"] as Mutable)["agent"] as Mutable)["canonicalModelId"],
          "--score-reasoning-effort", "high",
        ];
        const argvHash = sha256(canonical({
          schemaVersion: "pm-state-bench-upstream-argv.v1",
          workingDirectory: "/tmp/state-bench-upstream",
          executable: "uv",
          argv,
          environmentHash,
        }));
        const body = {
          schemaVersion: "pm-state-bench-execution-command.v1",
          sequence,
          cellId: `${plan["experimentId"]}:${plan["phase"]}:${taskSet["domain"]}:${taskId}:run-index-${runIndex}:${arm}`,
          phase: plan["phase"],
          arm,
          domain: taskSet["domain"],
          taskId,
          repeatIndex: runIndex - 1,
          repeatLabel: `run-index-${runIndex}`,
          runIndex,
          runId: `${plan["experimentId"]}-${arm}-${taskId}-${runIndex}`,
          armOrderPosition,
          expectedSplit: plan["split"],
          runConfigHash: sha256(`${arm}-${taskSet["domain"]}-config`),
          armInterventionHash: ((plan["armTreatments"] as Mutable)[arm] as Mutable)["treatmentIdentityHash"],
          outputDirectory: `/tmp/state-bench/${arm}/${taskSet["domain"]}`,
          expectedTrajectoryPath: `/tmp/state-bench/${arm}/${taskSet["domain"]}/run${runIndex}/${taskId}.json`,
          environmentPolicy: arm === "native"
            ? "native_pm_identity_environment_forbidden"
            : "sidecar_exact_non_secret_pm_identity_environment_required",
          environment,
          environmentHash,
          executable: "uv",
          argv,
          argvHash,
        };
        return { ...body, commandHash: sha256(canonical(body)) };
      }))),
  );
  const runConfigSetHash = sha256(canonical({
    schemaVersion: "pm-state-bench-bound-run-config-set.v1",
    configs: ARMS.map((arm) => ({ arm })),
  }));
  const attemptScheduleHash = sha256(canonical(commands.map((command) => ({
    cellId: command["cellId"],
    sequence: command["sequence"],
  }))));
  const commandRootHash = sha256(
    commands.map((command) => `${String(command["sequence"])}\0${String(command["commandHash"])}\n`).join(""),
  );
  const body = {
    schemaVersion: "pm-state-bench-execution-command-plan.v1",
    evidenceClass: "execution_command_plan_not_behavioral_evidence",
    authorityStatus: "raw_instrumented_execution_and_independent_attestation_required",
    experimentId: plan["experimentId"],
    phase: plan["phase"],
    qualificationPlanHash: "7".repeat(64),
    decisionManifestHash: "8".repeat(64),
    preregistrationReceiptHash: "9".repeat(64),
    upstream: {
      repositoryUrl: "https://github.com/microsoft/STATE-Bench.git",
      revision: plan["benchmarkRevision"],
      workingDirectory: "/tmp/state-bench-upstream",
      module: "state_bench.scripts.run_batch",
    },
    optionContract: {
      exactTaskOption: "--tasks",
      explicitSplitSentinel: ["--split", "all"],
      splitSentinelSemantics: "upstream_parser_compatibility_only_exact_bound_task_id_controls_selection",
      incompatibility: "upstream_rejects_tasks_with_split_train_or_test",
      taskMembershipAuthority: "verified_bound_run_config_and_phase_plan",
      taskRetryOption: ["--retry-attempts", "1"],
      providerRetryCaveat: "retry_attempts_controls_task_worker_only_upstream_provider_clients_may_retry_internally",
      repeatCaveat: "run_index_is_a_stochastic_repeat_identity_not_a_sampling_seed",
      modelIdentityCaveat: "agent_model_name_is_declarative_actual_provider_model_requires_raw_transport_attestation",
      environmentPolicy: "only_five_non_secret_pm_identity_variables_are_bound_sidecar_only",
      secretPolicy: "api_keys_tokens_and_credentials_are_forbidden_from_command_plan",
    },
    outputRoot: "/tmp/state-bench",
    runConfigSetHash,
    attemptScheduleHash,
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
    ],
  };
  return { ...body, planHash: sha256(canonical(body)) };
}

function makePlan(): Mutable {
  const body: Mutable = {
    schemaVersion: "pm-state-bench-raw-evidence-plan.v1",
    experimentId: "state-bench-raw-proof",
    declaredAt: "2026-07-13T00:00:00.000Z",
    phase: "confirmatory",
    split: "test",
    benchmarkRevision: BENCHMARK_REVISION,
    protocolId: "state-bench-pinned-test-v1",
    arms: [...ARMS],
    tasks: [{ domain: "travel", taskIds: ["101-known-state-failure"] }],
    repeatIndices: [1],
    roleRuntimes: {
      runner: {
        provider: "local",
        canonicalModelId: "state-bench-runner",
        deploymentId: "local-process",
        configurationSha256: "1".repeat(64),
      },
      agent: {
        provider: "openai",
        canonicalModelId: "gpt-5.1-2026-07-01",
        deploymentId: "state-bench-agent-deployment",
        configurationSha256: "2".repeat(64),
      },
      simulator: {
        provider: "azure-openai",
        canonicalModelId: "gpt-4.1-2026-06-15",
        deploymentId: "state-bench-simulator-deployment",
        configurationSha256: "3".repeat(64),
      },
      judge: {
        provider: "azure-openai",
        canonicalModelId: "gpt-4.1-2026-06-15",
        deploymentId: "state-bench-judge-deployment",
        configurationSha256: "4".repeat(64),
      },
    },
    armTreatments: Object.fromEntries(ARMS.map((arm) => [
      arm,
      makeTreatmentIdentity(arm),
    ])),
    retryPolicy: {
      maxTaskAttempts: 2,
      providerMaxAttempts: 5,
      retainEveryAttempt: true,
      terminalFailureCountsAsStrictFalse: true,
      selectiveReplacementAllowed: false,
      stoppingPolicy: "fixed_cells_no_optional_stopping",
    },
  };
  const commandPlan = makeExecutionCommandPlan(body);
  body["executionCommandPlan"] = {
    schemaVersion: "pm-state-bench-raw-command-plan-binding.v1",
    planHash: commandPlan["planHash"],
    commandRootHash: commandPlan["commandRootHash"],
    runConfigSetHash: commandPlan["runConfigSetHash"],
    attemptScheduleHash: commandPlan["attemptScheduleHash"],
    commandCount: commandPlan["commandCount"],
  };
  return { ...body, planHash: sha256(canonical(body)) };
}

function runtimeFile(path: string, kind: string, contents: string): Mutable {
  return { path, kind, bytes: rawBytes(contents) };
}

function makeClosure(arm: (typeof ARMS)[number]): Mutable {
  const files = [
    ...(arm === "native"
      ? []
      : [runtimeFile("agents/pm_substrate_agent.py", "adapter", `${arm}-adapter-source`)]),
    runtimeFile("package-lock.json", "lockfile", `${arm}-exact-lockfile`),
    runtimeFile("state_bench/runtime.py", "module", `${arm}-runtime-module`),
    runtimeFile("state_bench/scripts/run_task.py", "runner", `${arm}-runner-source`),
  ];
  const treeSha256 = sha256(
    files.map((file) => `${String(file["path"])}\0${String((file["bytes"] as Mutable)["sha256"])}\n`).join(""),
  );
  const body = {
    schemaVersion: "pm-state-bench-runtime-closure.v1",
    arm,
    benchmarkRevision: BENCHMARK_REVISION,
    treatmentIdentityHash: makeTreatmentIdentity(arm)["treatmentIdentityHash"],
    files,
    treeSha256,
  };
  return { ...body, closureHash: sha256(canonical(body)) };
}

function cellId(plan: Mutable, identity: Mutable): string {
  return sha256(canonical({
    experimentId: plan["experimentId"],
    domain: identity["domain"],
    taskId: identity["taskId"],
    repeatIndex: identity["repeatIndex"],
    arm: identity["arm"],
  }));
}

function attemptId(expectedCellId: string, ordinal: number): string {
  return sha256(canonical({ cellId: expectedCellId, attemptOrdinal: ordinal }));
}

function logicalCallId(
  exactAttemptId: string,
  role: (typeof ROLES)[number],
  logicalCallOrdinal: number,
): string {
  return sha256(canonical({ attemptId: exactAttemptId, role, logicalCallOrdinal }));
}

function exchangeId(exactLogicalCallId: string, providerAttemptOrdinal: number): string {
  return sha256(canonical({ logicalCallId: exactLogicalCallId, providerAttemptOrdinal }));
}

function at(milliseconds: number): string {
  return new Date(Date.parse("2026-07-13T01:00:00.000Z") + milliseconds).toISOString();
}

function makeExchange(
  plan: Mutable,
  role: (typeof ROLES)[number],
  globalSequence: number,
  failed: boolean,
  exactAttemptId: string,
  logicalCallOrdinal = 1,
  providerAttemptOrdinal = 1,
  retryOfExchangeId: string | null = null,
  terminal = true,
): Mutable {
  const roleIndex = ROLES.indexOf(role);
  const base = globalSequence * 100 + roleIndex * 2 +
    (logicalCallOrdinal - 1) * 10 + (providerAttemptOrdinal - 1) * 2;
  const runtime = (plan["roleRuntimes"] as Mutable)[role] as Mutable;
  const runner = role === "runner";
  const exactLogicalCallId = logicalCallId(exactAttemptId, role, logicalCallOrdinal);
  return {
    exchangeId: exchangeId(exactLogicalCallId, providerAttemptOrdinal),
    sequence: roleIndex + 1,
    logicalCallId: exactLogicalCallId,
    logicalCallOrdinal,
    providerAttemptOrdinal,
    retryOfExchangeId,
    terminal,
    role,
    provider: runtime["provider"],
    providerRequestId:
      `provider-request-${globalSequence}-${role}-${logicalCallOrdinal}-${providerAttemptOrdinal}`,
    actualModel: runtime["canonicalModelId"],
    deploymentId: runtime["deploymentId"],
    configurationSha256: runtime["configurationSha256"],
    startedAt: at(base),
    endedAt: at(base + 1),
    latencyMs: 1,
    request: rawBytes(JSON.stringify({ role, prompt: `request-${globalSequence}` })),
    response: rawBytes(JSON.stringify({ role, output: `response-${globalSequence}` })),
    outcome: failed ? "failed" : "succeeded",
    error: failed ? rawBytes(`${role}-provider-failure`) : null,
    usage: runner
      ? {
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 0,
        }
      : {
          inputTokens: 10,
          cachedInputTokens: 2,
          outputTokens: 4,
          reasoningOutputTokens: 1,
          totalTokens: 14,
        },
    cost: { currency: "USD", micros: runner ? 0 : 7 },
  };
}

function makeProviderChain(
  plan: Mutable,
  attempt: Mutable,
  role: (typeof ROLES)[number],
  logicalCallOrdinal: number,
  outcomes: readonly { readonly failed: boolean; readonly terminal: boolean }[],
): Mutable[] {
  let retryOfExchangeId: string | null = null;
  return outcomes.map((outcome, index) => {
    const exchange = makeExchange(
      plan,
      role,
      Number(attempt["globalSequence"]),
      outcome.failed,
      attempt["attemptId"] as string,
      logicalCallOrdinal,
      index + 1,
      retryOfExchangeId,
      outcome.terminal,
    );
    retryOfExchangeId = exchange["exchangeId"] as string;
    return exchange;
  });
}

function makeTreatmentUptake(
  plan: Mutable,
  arm: (typeof ARMS)[number],
  globalSequence: number,
  exactAttemptId: string,
  roles: Mutable,
): Mutable {
  const treatment = ((plan["armTreatments"] as Mutable)[arm]) as Mutable;
  const treatmentIdentityHash = treatment["treatmentIdentityHash"] as string;
  if (arm === "native") {
    return {
      schemaVersion: "pm-state-bench-treatment-uptake.v1",
      treatmentIdentityHash,
      retrievals: [],
      observationBoundary: null,
    };
  }
  const agentExchange = (((roles["agent"] as Mutable)["exchanges"] as Mutable[])[0])!;
  const retrievals = [{
    retrievalId: `retrieval-${globalSequence}-1`,
    sequence: 1,
    treatmentIdentityHash,
    sidecarRequestId: `sidecar-request-${globalSequence}-1`,
    startedAt: at(globalSequence * 100 + 1),
    endedAt: at(globalSequence * 100 + 2),
    latencyMs: 1,
    request: rawBytes(JSON.stringify({
      taskId: "101-known-state-failure",
      arm,
      query: "reservation state",
    })),
    response: rawBytes(JSON.stringify({
      arm,
      retrieved: [arm === "sham" ? "control-learning" : "state-learning"],
    })),
  }];
  const observationBoundaryId = treatment["observationBoundaryId"] as string;
  const agentExchangeId = agentExchange["exchangeId"] as string;
  const auditBody = {
    schemaVersion: "pm-state-bench-treatment-audit.v1",
    attemptId: exactAttemptId,
    arm,
    treatmentIdentityHash,
    observationBoundaryId,
    agentExchangeId,
    retrievalCount: retrievals.length,
    retrievals: retrievals.map((retrieval) => ({
      retrievalId: retrieval.retrievalId,
      sidecarRequestId: retrieval.sidecarRequestId,
      requestSha256: retrieval.request["sha256"],
      responseSha256: retrieval.response["sha256"],
    })),
  };
  return {
    schemaVersion: "pm-state-bench-treatment-uptake.v1",
    treatmentIdentityHash,
    retrievals,
    observationBoundary: {
      observationBoundaryId,
      agentExchangeId,
      observedAt: agentExchange["startedAt"],
      audit: jsonBytes(auditBody),
    },
  };
}

function makeEnvironment(globalSequence: number): Mutable {
  const initialSnapshot = jsonBytes({
    records: { reservation: { status: "pending", sequence: globalSequence } },
  });
  const finalSnapshot = jsonBytes({
    records: { reservation: { status: "processed", sequence: globalSequence } },
  });
  const toolCalls = [{
    toolCallId: `tool-call-${globalSequence}`,
    sequence: 1,
    name: "update-reservation",
    startedAt: at(globalSequence * 100 + 20),
    endedAt: at(globalSequence * 100 + 21),
    arguments: jsonBytes({ reservationId: "reservation", status: "processed" }),
    result: jsonBytes({ updated: true }),
    outcome: "succeeded",
    error: null,
  }];
  return {
    initialSnapshot,
    finalSnapshot,
    stateDiff: jsonBytes({
      created: {},
      modified: { reservation: { status: ["pending", "processed"] } },
      deleted: {},
    }),
    replay: {
      authority: "producer_local_replay",
      procedureId: "state-bench-tool-replay-v1",
      procedureSourceSha256: "b".repeat(64),
      toolCalls,
      toolCallCount: 1,
      replayedToolCallCount: 1,
      transcriptSha256: sha256(canonical(toolCalls)),
      recomputedFinalSnapshotSha256: finalSnapshot["sha256"],
      recordedFinalSnapshotSha256: finalSnapshot["sha256"],
      allCallsReplayed: true,
      toolResultsMatchedCapturedBytes: true,
    },
  };
}

interface AttemptSpec {
  readonly globalSequence: number;
  readonly arm: (typeof ARMS)[number];
  readonly attemptOrdinal: number;
  readonly status: "succeeded" | "failed";
  readonly terminal: boolean;
  readonly score: 0 | 1 | null;
}

function makeAttempt(
  plan: Mutable,
  closures: readonly Mutable[],
  spec: AttemptSpec,
  previousAttemptHash: string | null,
  retryOfAttemptId: string | null,
): Mutable {
  const identity = {
    experimentId: plan["experimentId"],
    domain: "travel",
    taskId: "101-known-state-failure",
    repeatIndex: 1,
    arm: spec.arm,
  };
  const expectedCellId = cellId(plan, identity);
  const exactAttemptId = attemptId(expectedCellId, spec.attemptOrdinal);
  const command = (makeExecutionCommandPlan(plan)["commands"] as Mutable[]).find((entry) =>
    entry["domain"] === identity.domain &&
    entry["taskId"] === identity.taskId &&
    entry["runIndex"] === identity.repeatIndex &&
    entry["arm"] === identity.arm,
  )!;
  const failed = spec.status === "failed";
  const startedAt = at(spec.globalSequence * 100);
  const endedAt = at(spec.globalSequence * 100 + 30);
  const roles = Object.fromEntries(ROLES.map((role) => [role, {
    role,
    disposition: "invoked",
    exchanges: [makeExchange(
      plan,
      role,
      spec.globalSequence,
      failed && role === "judge",
      exactAttemptId,
    )],
    nonInvocation: null,
  }]));
  const body = {
    schemaVersion: "pm-state-bench-raw-attempt.v1",
    globalSequence: spec.globalSequence,
    cellId: expectedCellId,
    attemptId: exactAttemptId,
    attemptOrdinal: spec.attemptOrdinal,
    retryOfAttemptId,
    executionCommand: {
      schemaVersion: "pm-state-bench-raw-command-binding.v1",
      sequence: command["sequence"],
      cellId: command["cellId"],
      commandHash: command["commandHash"],
    },
    identity,
    runtimeClosureHash: closures.find((closure) => closure["arm"] === spec.arm)?.["closureHash"],
    startedAt,
    endedAt,
    latencyMs: 30,
    status: spec.status,
    terminal: spec.terminal,
    failure: failed
      ? {
          stage: "judge",
          errorClass: "JudgeProviderFailure",
          error: rawBytes(`judge-attempt-failure-${spec.globalSequence}`),
        }
      : null,
    strictTaskSuccess: spec.score === 1,
    officialScores: spec.score === null
      ? null
      : {
          stateRequirementsMet: 1,
          taskRequirementsMet: spec.score,
          taskCompletionPass: spec.score,
        },
    roles,
    treatmentUptake: makeTreatmentUptake(
      plan,
      spec.arm,
      spec.globalSequence,
      exactAttemptId,
      roles,
    ),
    environment: makeEnvironment(spec.globalSequence),
    previousAttemptHash,
  };
  return { ...body, attemptHash: sha256(canonical(body)) };
}

function makeAttempts(plan: Mutable, closures: readonly Mutable[]): Mutable[] {
  const specs: readonly AttemptSpec[] = [
    { globalSequence: 1, arm: "native", attemptOrdinal: 1, status: "failed", terminal: false, score: null },
    { globalSequence: 2, arm: "sham", attemptOrdinal: 1, status: "succeeded", terminal: true, score: 0 },
    { globalSequence: 3, arm: "substrate", attemptOrdinal: 1, status: "failed", terminal: true, score: null },
    { globalSequence: 4, arm: "native", attemptOrdinal: 2, status: "succeeded", terminal: true, score: 1 },
  ];
  const attempts: Mutable[] = [];
  const lastAttemptByCell = new Map<string, string>();
  for (const spec of specs) {
    const identity = {
      experimentId: plan["experimentId"],
      domain: "travel",
      taskId: "101-known-state-failure",
      repeatIndex: 1,
      arm: spec.arm,
    };
    const key = cellId(plan, identity);
    const attempt = makeAttempt(
      plan,
      closures,
      spec,
      attempts.at(-1)?.["attemptHash"] as string | undefined ?? null,
      lastAttemptByCell.get(key) ?? null,
    );
    attempts.push(attempt);
    lastAttemptByCell.set(key, attempt["attemptId"] as string);
  }
  return attempts;
}

function summary(plan: Mutable, closures: readonly Mutable[], attempts: readonly Mutable[]): Mutable {
  const cellKey = (attempt: Mutable): string => {
    const identity = attempt["identity"] as Mutable;
    return [identity["domain"], identity["taskId"], identity["repeatIndex"], identity["arm"]].join("\0");
  };
  const terminal = attempts.filter((attempt) => attempt["terminal"] === true);
  const exchanges = attempts.flatMap((attempt) => ROLES.flatMap((role) =>
    ((((attempt["roles"] as Mutable)[role] as Mutable)["exchanges"] as Mutable[]))));
  const tasks = plan["tasks"] as Mutable[];
  const repeats = plan["repeatIndices"] as number[];
  const arms = plan["arms"] as string[];
  return {
    plannedCellCount: tasks.reduce(
      (count, taskSet) => count + (taskSet["taskIds"] as string[]).length * repeats.length * arms.length,
      0,
    ),
    observedCellCount: new Set(attempts.map(cellKey)).size,
    totalAttemptCount: attempts.length,
    retryAttemptCount: attempts.filter((attempt) => Number(attempt["attemptOrdinal"]) > 1).length,
    failedAttemptCount: attempts.filter((attempt) => attempt["status"] === "failed").length,
    terminalCompletedCount: terminal.filter((attempt) => attempt["status"] === "succeeded").length,
    terminalFailureCount: terminal.filter((attempt) => attempt["status"] === "failed").length,
    strictSuccessCellCount: terminal.filter((attempt) => attempt["strictTaskSuccess"] === true).length,
    strictFailureCellCount: terminal.filter((attempt) => attempt["strictTaskSuccess"] === false).length,
    totalExchangeCount: exchanges.length,
    totalProviderLatencyMs: exchanges.reduce(
      (total, exchange) => total + Number(exchange["latencyMs"]),
      0,
    ),
    totalCostUsdMicros: exchanges.reduce(
      (total, exchange) => total + Number((exchange["cost"] as Mutable)["micros"]),
      0,
    ),
    captureLedgerFinalHash: attempts.at(-1)?.["attemptHash"] ?? "0".repeat(64),
    runtimeClosureCount: closures.length,
  };
}

function bundleBody(bundle: Mutable): Mutable {
  return {
    schemaVersion: bundle["schemaVersion"],
    evidenceClass: bundle["evidenceClass"],
    captureOrigin: bundle["captureOrigin"],
    plan: bundle["plan"],
    producer: bundle["producer"],
    runtimeClosures: bundle["runtimeClosures"],
    attempts: bundle["attempts"],
    reportedSummary: bundle["reportedSummary"],
  };
}

function makeBundle(): Mutable {
  const plan = makePlan();
  const runtimeClosures = ARMS.map(makeClosure);
  const attempts = makeAttempts(plan, runtimeClosures);
  const body = {
    schemaVersion: "pm-state-bench-raw-evidence.v1",
    evidenceClass: "state_bench_raw_execution_evidence",
    captureOrigin: "producer_local",
    plan,
    producer: {
      producerId: "joat-labs-state-bench-capture",
      producerOwnerId: "joat-labs",
      capturedAt: "2026-07-13T02:00:00.000Z",
      captureImplementationRevision: "a".repeat(40),
      captureImplementationSha256: "c".repeat(64),
      hostRuntimeSha256: "d".repeat(64),
    },
    runtimeClosures,
    attempts,
    reportedSummary: summary(plan, runtimeClosures, attempts),
  };
  return {
    ...body,
    externalTrust: null,
    bundleHash: sha256(canonical(body)),
  };
}

function reseal(
  bundle: Mutable,
  refreshTreatmentAudit = true,
  refreshProviderTopology = true,
  refreshExchangeSequence = true,
): Mutable {
  bundle["externalTrust"] = null;
  const plan = bundle["plan"] as Mutable;
  const attempts = bundle["attempts"] as Mutable[];
  const previousByCell = new Map<string, string>();
  let previousHash: string | null = null;
  for (const [index, attempt] of attempts.entries()) {
    const identity = attempt["identity"] as Mutable;
    const nextCellId = cellId(plan, identity);
    attempt["globalSequence"] = index + 1;
    attempt["cellId"] = nextCellId;
    attempt["attemptId"] = attemptId(nextCellId, Number(attempt["attemptOrdinal"]));
    attempt["retryOfAttemptId"] = previousByCell.get(nextCellId) ?? null;
    attempt["previousAttemptHash"] = previousHash;
    let exchangeSequence = 1;
    for (const role of ROLES) {
      const exchanges = (((attempt["roles"] as Mutable)[role] as Mutable)
        ["exchanges"] as Mutable[]);
      const previousExchangeByCall = new Map<number, string>();
      for (const exchange of exchanges) {
        if (refreshExchangeSequence) exchange["sequence"] = exchangeSequence;
        exchangeSequence += 1;
        if (refreshProviderTopology) {
          const callOrdinal = Number(exchange["logicalCallOrdinal"]);
          const providerOrdinal = Number(exchange["providerAttemptOrdinal"]);
          const nextLogicalCallId = logicalCallId(
            attempt["attemptId"] as string,
            role,
            callOrdinal,
          );
          exchange["logicalCallId"] = nextLogicalCallId;
          exchange["exchangeId"] = exchangeId(nextLogicalCallId, providerOrdinal);
          exchange["retryOfExchangeId"] = previousExchangeByCall.get(callOrdinal) ?? null;
          previousExchangeByCall.set(callOrdinal, exchange["exchangeId"] as string);
        }
      }
    }
    const uptake = attempt["treatmentUptake"] as Mutable;
    const boundary = uptake["observationBoundary"] as Mutable | null;
    if (boundary !== null && refreshTreatmentAudit) {
      const agentExchange = ((((attempt["roles"] as Mutable)["agent"] as Mutable)
        ["exchanges"] as Mutable[])[0])!;
      boundary["agentExchangeId"] = agentExchange["exchangeId"];
      boundary["observedAt"] = agentExchange["startedAt"];
      const retrievals = uptake["retrievals"] as Mutable[];
      boundary["audit"] = jsonBytes({
        schemaVersion: "pm-state-bench-treatment-audit.v1",
        attemptId: attempt["attemptId"],
        arm: identity["arm"],
        treatmentIdentityHash: uptake["treatmentIdentityHash"],
        observationBoundaryId: boundary["observationBoundaryId"],
        agentExchangeId: boundary["agentExchangeId"],
        retrievalCount: retrievals.length,
        retrievals: retrievals.map((retrieval) => ({
          retrievalId: retrieval["retrievalId"],
          sidecarRequestId: retrieval["sidecarRequestId"],
          requestSha256: (retrieval["request"] as Mutable)["sha256"],
          responseSha256: (retrieval["response"] as Mutable)["sha256"],
        })),
      });
    }
    const { attemptHash: _oldHash, ...body } = attempt;
    attempt["attemptHash"] = sha256(canonical(body));
    previousHash = attempt["attemptHash"] as string;
    previousByCell.set(nextCellId, attempt["attemptId"] as string);
  }
  bundle["reportedSummary"] = summary(
    plan,
    bundle["runtimeClosures"] as Mutable[],
    attempts,
  );
  bundle["bundleHash"] = sha256(canonical(bundleBody(bundle)));
  return bundle;
}

function substituteTaskAndRebind(
  bundle: Mutable,
  taskId: string,
): { readonly bundle: Mutable; readonly commandPlan: Mutable } {
  const plan = bundle["plan"] as Mutable;
  ((plan["tasks"] as Mutable[])[0]!)["taskIds"] = [taskId];
  for (const attempt of bundle["attempts"] as Mutable[]) {
    (attempt["identity"] as Mutable)["taskId"] = taskId;
  }
  const commandPlan = makeExecutionCommandPlan(plan);
  plan["executionCommandPlan"] = {
    schemaVersion: "pm-state-bench-raw-command-plan-binding.v1",
    planHash: commandPlan["planHash"],
    commandRootHash: commandPlan["commandRootHash"],
    runConfigSetHash: commandPlan["runConfigSetHash"],
    attemptScheduleHash: commandPlan["attemptScheduleHash"],
    commandCount: commandPlan["commandCount"],
  };
  const { planHash: _oldPlanHash, ...planBody } = plan;
  plan["planHash"] = sha256(canonical(planBody));
  for (const attempt of bundle["attempts"] as Mutable[]) {
    const identity = attempt["identity"] as Mutable;
    const command = (commandPlan["commands"] as Mutable[]).find((entry) =>
      entry["domain"] === identity["domain"] &&
      entry["taskId"] === identity["taskId"] &&
      entry["runIndex"] === identity["repeatIndex"] &&
      entry["arm"] === identity["arm"],
    )!;
    attempt["executionCommand"] = {
      schemaVersion: "pm-state-bench-raw-command-binding.v1",
      sequence: command["sequence"],
      cellId: command["cellId"],
      commandHash: command["commandHash"],
    };
  }
  return { bundle: reseal(bundle), commandPlan };
}

function addExternalTrust(bundle: Mutable): {
  readonly bundle: Mutable;
  readonly policy: Mutable;
} {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const policyBody = {
    schemaVersion: "pm-state-bench-external-trust-policy.v1",
    policyId: "independent-state-bench-verification-v1",
    verifierId: "external-state-bench-verifier",
    verifierOwnerId: "independent-audit-lab",
    producerOwnerId: "joat-labs",
    keyId: "independent-audit-key-2026",
    verifierSourceRevision: "e".repeat(40),
    benchmarkRevision: BENCHMARK_REVISION,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString().trim(),
  };
  const policy = { ...policyBody, policyHash: sha256(canonical(policyBody)) };
  const unsignedEnvelope = {
    schemaVersion: "pm-state-bench-external-trust-envelope.v1",
    policyId: policy["policyId"],
    policyHash: policy["policyHash"],
    verifierId: policy["verifierId"],
    verifierOwnerId: policy["verifierOwnerId"],
    producerOwnerId: policy["producerOwnerId"],
    keyId: policy["keyId"],
    verifierSourceRevision: policy["verifierSourceRevision"],
    verifiedAt: "2026-07-13T03:00:00.000Z",
    signedBundleHash: bundle["bundleHash"],
    algorithm: "ed25519",
  };
  bundle["externalTrust"] = {
    ...unsignedEnvelope,
    signatureBase64: sign(
      null,
      Buffer.from(canonical(unsignedEnvelope), "utf8"),
      privateKey,
    ).toString("base64"),
  };
  return { bundle, policy };
}

describe("STATE-Bench strict raw-evidence contract", () => {
  it("accepts complete producer-local evidence without pretending it is independent", () => {
    const bundle = makeBundle();
    const parsed = stateBenchRawEvidence.parse(bundle);
    const result = stateBenchRawEvidence.verify(bundle);

    expect(parsed.bundleHash).toBe(bundle["bundleHash"]);
    expect(result).toMatchObject({
      valid: true,
      issues: [],
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(result.authorityIssues.join(" ")).toMatch(/no external trust envelope/i);
    expect(result.recomputedSummary).toMatchObject({
      plannedCellCount: 3,
      observedCellCount: 3,
      totalAttemptCount: 4,
      retryAttemptCount: 1,
      failedAttemptCount: 2,
      terminalCompletedCount: 2,
      terminalFailureCount: 1,
      strictSuccessCellCount: 1,
      strictFailureCellCount: 2,
      totalExchangeCount: 16,
      totalProviderLatencyMs: 16,
      totalCostUsdMicros: 84,
      runtimeClosureCount: 3,
    });
  });

  it("is outcome-neutral and retains terminal failures as strict false", () => {
    const bundle = makeBundle();
    const attempts = bundle["attempts"] as Mutable[];
    const sham = attempts.find((attempt) => (attempt["identity"] as Mutable)["arm"] === "sham");
    const substrate = attempts.find((attempt) =>
      (attempt["identity"] as Mutable)["arm"] === "substrate");

    expect(sham).toMatchObject({
      status: "succeeded",
      terminal: true,
      strictTaskSuccess: false,
      officialScores: {
        stateRequirementsMet: 1,
        taskRequirementsMet: 0,
        taskCompletionPass: 0,
      },
    });
    expect(substrate).toMatchObject({
      status: "failed",
      terminal: true,
      strictTaskSuccess: false,
      officialScores: null,
    });
    expect(stateBenchRawEvidence.verify(bundle).valid).toBe(true);
  });

  it("binds each attempt to its planned treatment and proves sidecar uptake", () => {
    const bundle = makeBundle();
    const attempts = bundle["attempts"] as Mutable[];
    for (const attempt of attempts) {
      const arm = (attempt["identity"] as Mutable)["arm"] as string;
      const uptake = attempt["treatmentUptake"] as Mutable;
      const treatment = ((bundle["plan"] as Mutable)["armTreatments"] as Mutable)[arm] as Mutable;
      const closure = (bundle["runtimeClosures"] as Mutable[]).find((entry) =>
        entry["arm"] === arm)!;

      expect(uptake["treatmentIdentityHash"]).toBe(treatment["treatmentIdentityHash"]);
      expect(closure["treatmentIdentityHash"]).toBe(treatment["treatmentIdentityHash"]);
      if (arm === "native") {
        expect(uptake).toMatchObject({ retrievals: [], observationBoundary: null });
      } else {
        const retrievals = uptake["retrievals"] as Mutable[];
        const boundary = uptake["observationBoundary"] as Mutable;
        expect(retrievals).toHaveLength(1);
        expect((retrievals[0]!["request"] as Mutable)["byteLength"]).toBeGreaterThan(0);
        expect((retrievals[0]!["response"] as Mutable)["byteLength"]).toBeGreaterThan(0);
        expect((boundary["audit"] as Mutable)["byteLength"]).toBeGreaterThan(0);
      }
    }
    expect(stateBenchRawEvidence.verify(bundle)).toMatchObject({
      valid: true,
      publicEvalAttemptEligible: false,
    });
  });

  it("rejects re-sealed zero treatment uptake for sham or substrate", () => {
    for (const arm of ["sham", "substrate"] as const) {
      const bundle = makeBundle();
      const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
        (candidate["identity"] as Mutable)["arm"] === arm)!;
      const uptake = attempt["treatmentUptake"] as Mutable;
      uptake["retrievals"] = [];
      uptake["observationBoundary"] = null;
      reseal(bundle);

      const result = stateBenchRawEvidence.verify(bundle);
      expect(result.valid).toBe(false);
      expect(result.issues.join(" ")).toMatch(/require captured retrieval uptake and a boundary audit/i);
      expect(result.publicEvalAttemptEligible).toBe(false);
    }
  });

  it("rejects re-sealed retrieval or sidecar audit evidence on the native arm", () => {
    const bundle = makeBundle();
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "native")!;
    const uptake = attempt["treatmentUptake"] as Mutable;
    const treatmentIdentityHash = uptake["treatmentIdentityHash"] as string;
    uptake["retrievals"] = [{
      retrievalId: "forbidden-native-retrieval",
      sequence: 1,
      treatmentIdentityHash,
      sidecarRequestId: "forbidden-native-sidecar-request",
      startedAt: at(101),
      endedAt: at(102),
      latencyMs: 1,
      request: rawBytes("native-must-not-send-this-request"),
      response: rawBytes("native-must-not-receive-this-response"),
    }];
    uptake["observationBoundary"] = {};
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/native attempts must contain zero retrievals and no sidecar audit/i);
  });

  it("rejects a re-sealed treatment audit that does not match captured retrieval bytes", () => {
    const bundle = makeBundle();
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "sham")!;
    const boundary = (attempt["treatmentUptake"] as Mutable)["observationBoundary"] as Mutable;
    const audit = JSON.parse(
      Buffer.from((boundary["audit"] as Mutable)["bytesBase64"] as string, "base64").toString("utf8"),
    ) as Mutable;
    ((audit["retrievals"] as Mutable[])[0]!)["responseSha256"] = "0".repeat(64);
    boundary["audit"] = jsonBytes(audit);
    reseal(bundle, false);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/audit does not match captured treatment uptake/i);
  });

  it("rejects runtime closure drift from the planned sidecar treatment identity", () => {
    const bundle = makeBundle();
    const treatments = (bundle["plan"] as Mutable)["armTreatments"] as Mutable;
    const substrate = (bundle["runtimeClosures"] as Mutable[]).find((closure) =>
      closure["arm"] === "substrate")!;
    substrate["treatmentIdentityHash"] = (treatments["sham"] as Mutable)["treatmentIdentityHash"];

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/does not match the planned arm treatment/i);
  });

  it("promotes authority only with pinned trust and execution-command plans", () => {
    const trusted = addExternalTrust(makeBundle());
    const commandPlan = makeExecutionCommandPlan(trusted.bundle["plan"] as Mutable);
    const withoutPolicy = stateBenchRawEvidence.verify(trusted.bundle);
    const policyOnly = stateBenchRawEvidence.verify(trusted.bundle, trusted.policy);
    const withoutCommandPlan = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
    );
    const commandPlanWithoutPin = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
      commandPlan,
    );
    const fullyBound = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
      commandPlan,
      commandPlan["planHash"] as string,
    );

    expect(withoutPolicy).toMatchObject({
      valid: true,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(withoutPolicy.authorityIssues.join(" ")).toMatch(/no independently supplied trust policy/i);
    expect(policyOnly).toMatchObject({
      valid: true,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(policyOnly.authorityIssues.join(" ")).toMatch(/out-of-band expected hash/i);
    expect(withoutCommandPlan).toMatchObject({
      valid: true,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(withoutCommandPlan.authorityIssues.join(" ")).toMatch(/no independently supplied execution command plan/i);
    expect(commandPlanWithoutPin).toMatchObject({
      valid: true,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(commandPlanWithoutPin.authorityIssues.join(" ")).toMatch(/command plan.*out-of-band expected hash/i);
    expect(fullyBound).toMatchObject({
      valid: true,
      authorityStatus: "independently_authenticated_raw_evidence",
      authorityIssues: [],
      publicEvalAttemptEligible: false,
    });
  });

  it("keeps a signed bundle ineligible when the supplied command plan or pin is wrong", () => {
    const trusted = addExternalTrust(makeBundle());
    const correctPlan = makeExecutionCommandPlan(trusted.bundle["plan"] as Mutable);
    const substitutedPlanInput = clone(trusted.bundle["plan"] as Mutable);
    ((substitutedPlanInput["tasks"] as Mutable[])[0]!)["taskIds"] = ["wrong-command-plan-task"];
    const wrongPlan = makeExecutionCommandPlan(substitutedPlanInput);

    const wrongPlanResult = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
      wrongPlan,
      wrongPlan["planHash"] as string,
    );
    const wrongPinResult = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
      correctPlan,
      "0".repeat(64),
    );

    expect(wrongPlanResult).toMatchObject({
      valid: true,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(wrongPlanResult.authorityIssues.join(" ")).toMatch(/command-plan .*does not match|cell inventory/i);
    expect(wrongPinResult).toMatchObject({
      valid: true,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(wrongPinResult.authorityIssues.join(" ")).toMatch(/out-of-band expected hash/i);
  });

  it("detects task substitution in an otherwise self-consistent command plan", () => {
    const trusted = addExternalTrust(makeBundle());
    const substitutedInput = clone(trusted.bundle["plan"] as Mutable);
    ((substitutedInput["tasks"] as Mutable[])[0]!)["taskIds"] = ["post-selection-task"];
    const substitutedPlan = makeExecutionCommandPlan(substitutedInput);
    const result = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
      substitutedPlan,
      substitutedPlan["planHash"] as string,
    );

    expect(result.valid).toBe(true);
    expect(result.authorityStatus).toBe("producer_local_capture_ineligible");
    expect(result.authorityIssues.join(" ")).toMatch(/task\/repeat\/arm cell inventory/i);
    expect(result.publicEvalAttemptEligible).toBe(false);
  });

  it("detects a re-sealed raw-attempt command-hash substitution", () => {
    const bundle = makeBundle();
    const commandPlan = makeExecutionCommandPlan(bundle["plan"] as Mutable);
    (((bundle["attempts"] as Mutable[])[1]!)["executionCommand"] as Mutable)["commandHash"] = "a".repeat(64);
    const trusted = addExternalTrust(reseal(bundle));
    const result = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
      commandPlan,
      commandPlan["planHash"] as string,
    );

    expect(result.valid).toBe(true);
    expect(result.authorityStatus).toBe("producer_local_capture_ineligible");
    expect(result.authorityIssues.join(" ")).toMatch(/does not bind its exact planned command hash/i);
    expect(result.publicEvalAttemptEligible).toBe(false);
  });

  it("rejects a signed self-consistent post-hoc raw plan against the out-of-band command-plan pin", () => {
    const bundle = makeBundle();
    const originalPlan = makeExecutionCommandPlan(bundle["plan"] as Mutable);
    const postHoc = substituteTaskAndRebind(bundle, "post-hoc-selected-task");
    const trusted = addExternalTrust(postHoc.bundle);
    const result = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
      postHoc.commandPlan,
      originalPlan["planHash"] as string,
    );

    expect(result).toMatchObject({
      valid: true,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(result.authorityIssues.join(" ")).toMatch(/does not match the out-of-band expected hash/i);
  });

  it("rejects a valid policy when its out-of-band expected hash is different", () => {
    const trusted = addExternalTrust(makeBundle());
    const result = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      "0".repeat(64),
    );

    expect(result).toMatchObject({
      valid: false,
      authorityStatus: "producer_local_capture_ineligible",
      publicEvalAttemptEligible: false,
    });
    expect(result.issues.join(" ")).toMatch(/does not match the out-of-band expected hash/i);
  });

  it("rejects a forged external verifier signature", () => {
    const trusted = addExternalTrust(makeBundle());
    (trusted.bundle["externalTrust"] as Mutable)["signatureBase64"] = Buffer.alloc(64, 7).toString("base64");

    const result = stateBenchRawEvidence.verify(
      trusted.bundle,
      trusted.policy,
      trusted.policy["policyHash"] as string,
    );
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/signature is invalid/i);
    expect(result.authorityStatus).toBe("producer_local_capture_ineligible");
  });

  it("rejects a missing role even if the remaining role captures are intact", () => {
    const bundle = makeBundle();
    delete ((bundle["attempts"] as Mutable[])[0]!["roles"] as Mutable)["judge"];

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/roles.*keys must be exactly/i);
  });

  it("rejects empty or missing exact request and response bytes", () => {
    const emptyRequest = makeBundle();
    const firstAttempt = (emptyRequest["attempts"] as Mutable[])[0]!;
    const agentExchange = ((((firstAttempt["roles"] as Mutable)["agent"] as Mutable)
      ["exchanges"] as Mutable[])[0])!;
    (agentExchange["request"] as Mutable)["bytesBase64"] = "";

    const emptyResult = stateBenchRawEvidence.verify(emptyRequest);
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.issues.join(" ")).toMatch(/request\.bytesBase64.*non-empty/i);

    const missingResponse = makeBundle();
    const runnerExchange = (((((missingResponse["attempts"] as Mutable[])[0]!["roles"] as Mutable)
      ["runner"] as Mutable)["exchanges"] as Mutable[])[0])!;
    delete runnerExchange["response"];
    const missingResult = stateBenchRawEvidence.verify(missingResponse);
    expect(missingResult.valid).toBe(false);
    expect(missingResult.issues.join(" ")).toMatch(/exchanges\[0\] keys must be exactly/i);
  });

  it("retains a failed provider retry and distinguishes a later logical call", () => {
    const bundle = makeBundle();
    const plan = bundle["plan"] as Mutable;
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "sham")!;
    const judge = (attempt["roles"] as Mutable)["judge"] as Mutable;
    judge["exchanges"] = [
      ...makeProviderChain(plan, attempt, "judge", 1, [
        { failed: true, terminal: false },
        { failed: false, terminal: true },
      ]),
      ...makeProviderChain(plan, attempt, "judge", 2, [
        { failed: false, terminal: true },
      ]),
    ];
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result).toMatchObject({
      valid: true,
      publicEvalAttemptEligible: false,
    });
    expect(result.recomputedSummary?.totalExchangeCount).toBe(18);
  });

  it("rejects a hidden provider retry beyond providerMaxAttempts", () => {
    const bundle = makeBundle();
    const plan = bundle["plan"] as Mutable;
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "substrate")!;
    ((attempt["roles"] as Mutable)["judge"] as Mutable)["exchanges"] =
      makeProviderChain(plan, attempt, "judge", 1, Array.from(
        { length: 6 },
        (_, index) => ({ failed: true, terminal: index === 5 }),
      ));
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/exceeds providerMaxAttempts/i);
  });

  it("rejects omission of a failed provider attempt from a re-sealed chain", () => {
    const bundle = makeBundle();
    const plan = bundle["plan"] as Mutable;
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "sham")!;
    const judge = (attempt["roles"] as Mutable)["judge"] as Mutable;
    judge["exchanges"] = makeProviderChain(plan, attempt, "judge", 1, [
      { failed: true, terminal: false },
      { failed: false, terminal: true },
    ]);
    (judge["exchanges"] as Mutable[]).splice(0, 1);
    reseal(bundle, true, false);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/provider attempt ordinals/i);
  });

  it("rejects a broken provider retry link in a re-sealed chain", () => {
    const bundle = makeBundle();
    const plan = bundle["plan"] as Mutable;
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "sham")!;
    const judge = (attempt["roles"] as Mutable)["judge"] as Mutable;
    judge["exchanges"] = makeProviderChain(plan, attempt, "judge", 1, [
      { failed: true, terminal: false },
      { failed: false, terminal: true },
    ]);
    ((judge["exchanges"] as Mutable[])[1]!)["retryOfExchangeId"] = "0".repeat(64);
    reseal(bundle, true, false);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/retry chain is incomplete/i);
  });

  it("rejects a provider retry retained after a terminal exchange", () => {
    const bundle = makeBundle();
    const plan = bundle["plan"] as Mutable;
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "sham")!;
    ((attempt["roles"] as Mutable)["judge"] as Mutable)["exchanges"] =
      makeProviderChain(plan, attempt, "judge", 1, [
        { failed: true, terminal: true },
        { failed: false, terminal: true },
      ]);
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/provider attempt after terminal/i);
  });

  it("rejects successful nonterminal attempts and retry chains with no terminal", () => {
    const nonterminalSuccess = makeBundle();
    const nonterminalPlan = nonterminalSuccess["plan"] as Mutable;
    const nonterminalAttempt = (nonterminalSuccess["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "sham")!;
    ((nonterminalAttempt["roles"] as Mutable)["judge"] as Mutable)["exchanges"] =
      makeProviderChain(nonterminalPlan, nonterminalAttempt, "judge", 1, [
        { failed: false, terminal: false },
        { failed: false, terminal: true },
      ]);
    reseal(nonterminalSuccess);
    expect(stateBenchRawEvidence.verify(nonterminalSuccess).issues.join(" ")).toMatch(
      /nonterminal provider attempts must fail/i,
    );

    const noTerminal = makeBundle();
    const noTerminalPlan = noTerminal["plan"] as Mutable;
    const noTerminalAttempt = (noTerminal["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "substrate")!;
    ((noTerminalAttempt["roles"] as Mutable)["judge"] as Mutable)["exchanges"] =
      makeProviderChain(noTerminalPlan, noTerminalAttempt, "judge", 1, [
        { failed: true, terminal: false },
      ]);
    reseal(noTerminal);
    expect(stateBenchRawEvidence.verify(noTerminal).issues.join(" ")).toMatch(
      /exactly one final terminal exchange/i,
    );
  });

  it("rejects a first logical call mislabeled with ordinal two", () => {
    const bundle = makeBundle();
    const attempt = (bundle["attempts"] as Mutable[])[0]!;
    const exchange = ((((attempt["roles"] as Mutable)["runner"] as Mutable)
      ["exchanges"] as Mutable[])[0])!;
    exchange["logicalCallOrdinal"] = 2;
    reseal(bundle, true, false);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/logical call ordinals must start at one/i);
  });

  it("rejects duplicate provider request IDs across one task attempt", () => {
    const bundle = makeBundle();
    const attempt = (bundle["attempts"] as Mutable[])[0]!;
    const roles = attempt["roles"] as Mutable;
    const agent = (((roles["agent"] as Mutable)["exchanges"] as Mutable[])[0])!;
    const judge = (((roles["judge"] as Mutable)["exchanges"] as Mutable[])[0])!;
    judge["providerRequestId"] = agent["providerRequestId"];
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/providerRequestId values must be unique/i);
  });

  it("rejects role exchanges recorded out of sequence order", () => {
    const bundle = makeBundle();
    const plan = bundle["plan"] as Mutable;
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "sham")!;
    const judge = (attempt["roles"] as Mutable)["judge"] as Mutable;
    judge["exchanges"] = [
      ...makeProviderChain(plan, attempt, "judge", 1, [{ failed: false, terminal: true }]),
      ...makeProviderChain(plan, attempt, "judge", 2, [{ failed: false, terminal: true }]),
    ];
    reseal(bundle);
    const exchanges = judge["exchanges"] as Mutable[];
    [exchanges[0]!["sequence"], exchanges[1]!["sequence"]] =
      [exchanges[1]!["sequence"], exchanges[0]!["sequence"]];
    reseal(bundle, true, false, false);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/strictly ascending sequence order/i);
  });

  it("rejects a re-sealed ledger that dropped a failed retry", () => {
    const bundle = makeBundle();
    (bundle["attempts"] as Mutable[]).splice(0, 1);
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/attempt ordinals/i);
  });

  it("rejects a re-sealed selective replacement of a planned task cell", () => {
    const bundle = makeBundle();
    const sham = (bundle["attempts"] as Mutable[]).find((attempt) =>
      (attempt["identity"] as Mutable)["arm"] === "sham")!;
    (sham["identity"] as Mutable)["taskId"] = "replacement-not-in-plan";
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/selectively replaced, duplicated, or dropped/i);
  });

  it("rejects duplicate deterministic task-attempt identities", () => {
    const bundle = makeBundle();
    const attempts = bundle["attempts"] as Mutable[];
    attempts.push(clone(attempts[1]!));
    reseal(bundle);

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/attempt IDs must be globally unique/i);
  });

  it("rejects caller-authored summary claims that disagree with raw attempts", () => {
    const bundle = makeBundle();
    (bundle["reportedSummary"] as Mutable)["strictSuccessCellCount"] = 3;

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/caller-authored reportedSummary does not recompute/i);
  });

  it("rejects a provider-returned model alias instead of the exact planned model", () => {
    const bundle = makeBundle();
    const attempt = (bundle["attempts"] as Mutable[])[1]!;
    const exchange = (((attempt["roles"] as Mutable)["agent"] as Mutable)["exchanges"] as Mutable[])[0]!;
    exchange["actualModel"] = "gpt-5.1";

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/actual provider\/model\/config does not exactly match/i);
  });

  it("rejects any terminal execution failure represented as strict success", () => {
    const bundle = makeBundle();
    const attempt = (bundle["attempts"] as Mutable[]).find((candidate) =>
      (candidate["identity"] as Mutable)["arm"] === "substrate")!;
    attempt["strictTaskSuccess"] = true;

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/failed attempts require failure evidence, no scores, and strict false/i);
  });

  it("rejects incomplete producer-local tool-call replay facts", () => {
    const bundle = makeBundle();
    const attempt = (bundle["attempts"] as Mutable[])[0]!;
    (((attempt["environment"] as Mutable)["replay"] as Mutable))["allCallsReplayed"] = false;

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/replay must account for and match every tool call/i);
  });

  it("rejects incomplete installed adapter/runtime closure inventory", () => {
    const bundle = makeBundle();
    const substrate = (bundle["runtimeClosures"] as Mutable[]).find((closure) =>
      closure["arm"] === "substrate")!;
    substrate["files"] = (substrate["files"] as Mutable[]).filter((file) => file["kind"] !== "adapter");

    const result = stateBenchRawEvidence.verify(bundle);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/adapter inventory does not match arm substrate/i);
  });
});

import { createHash } from "node:crypto";

export type OracleProcedureCornerId =
  | "memoryagentbench-factconsolidation-6k"
  | "tau2-airline-32"
  | "appworld-22cc237_2"
  | "sentinel-microhub-stars";

export interface OracleManifestSourceIdentity {
  readonly sourceId: string;
  readonly path: string;
  readonly sha256: string;
}

export interface OracleProcedureManifest {
  readonly cornerId: string;
  readonly tasks: readonly { readonly taskId: string }[];
  readonly sources: readonly OracleManifestSourceIdentity[];
}

export interface OracleProcedureBinding {
  readonly schemaVersion: "pm.public-eval-corners.oracle-procedure-binding.v1";
  readonly cornerId: OracleProcedureCornerId;
  readonly taskId: string;
  readonly procedureId: string;
  readonly evaluatorSource: OracleManifestSourceIdentity;
  readonly entrypoint: string;
  readonly requiredRawInputRoles: readonly string[];
  readonly dynamicEntrypoint: {
    readonly rawInputRole: string;
    readonly entrypoint: string;
  } | null;
  readonly outcomeSchemaId:
    | "memoryagentbench-metrics-v1"
    | "tau2-reward-info-primary-v1"
    | "appworld-test-tracker-v1"
    | "sentinel-evaluate-response-v1";
  readonly bindingSha256: string;
}

export interface OracleRawInputIdentity {
  readonly role: string;
  readonly path: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface BoundOracleOutcomeContext {
  /** The harness-selected trial task, never a task identifier read from oracle output. */
  readonly expectedTaskId: string;
  /** Identities computed from harness-retained raw task/runtime bytes. */
  readonly expectedRawInputs: readonly OracleRawInputIdentity[];
}

export interface OracleProcedureValidation {
  readonly schemaVersion: "pm.public-eval-corners.oracle-procedure-validation.v1";
  readonly valid: boolean;
  readonly eligibleForIndependentAnalysis: false;
  readonly bindingSha256: string | null;
  readonly issues: readonly string[];
}

type JsonRecord = Record<string, unknown>;

interface OracleProcedureSpec {
  readonly cornerId: OracleProcedureCornerId;
  readonly taskIds: readonly string[];
  readonly procedureId: string;
  readonly evaluatorSource: OracleManifestSourceIdentity;
  readonly entrypoint: string;
  readonly requiredRawInputRoles: readonly string[];
  readonly dynamicEntrypoint: {
    readonly rawInputRole: string;
    readonly entrypoint: string;
  } | null;
  readonly outcomeSchemaId: OracleProcedureBinding["outcomeSchemaId"];
}

const SHA256 = /^[a-f0-9]{64}$/u;
const PORTABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const MAX_RAW_INPUT_BYTES = 1024 * 1024 * 1024 * 1024;

const PROCEDURE_SPECS: readonly OracleProcedureSpec[] = deepFreeze([
  {
    cornerId: "memoryagentbench-factconsolidation-6k",
    taskIds: ["factconsolidation_sh_6k", "factconsolidation_mh_6k"],
    procedureId: "memoryagentbench.factconsolidation.post-process.v1",
    evaluatorSource: {
      sourceId: "mab-compatible-scorer",
      path: "utils/eval_other_utils.py",
      sha256: "d77976be409298970614d477a9d8003850caddb0510e56a7e821a037d98493a2",
    },
    entrypoint: "utils.eval_other_utils:post_process",
    requiredRawInputRoles: [
      "dataset-config",
      "question",
      "ground-truth-answer",
      "agent-answer",
    ],
    dynamicEntrypoint: null,
    outcomeSchemaId: "memoryagentbench-metrics-v1",
  },
  {
    cornerId: "tau2-airline-32",
    taskIds: ["airline:32"],
    procedureId: "tau2.airline.environment-reward.v1",
    evaluatorSource: {
      sourceId: "tau2-db-evaluator",
      path: "src/tau2/evaluator/evaluator_env.py",
      sha256: "e932ea5f675d7a172557350f30b73d66474659d9b4d976ecd763ca2929017633",
    },
    entrypoint: "tau2.evaluator.evaluator_env:EnvironmentEvaluator.calculate_reward",
    requiredRawInputRoles: [
      "task-definition",
      "initial-environment",
      "full-trajectory",
      "terminal-environment",
    ],
    dynamicEntrypoint: null,
    outcomeSchemaId: "tau2-reward-info-primary-v1",
  },
  {
    cornerId: "appworld-22cc237_2",
    taskIds: ["22cc237_2"],
    procedureId: "appworld.task.evaluate-task.v1",
    evaluatorSource: {
      sourceId: "appworld-public-evaluator-shell",
      path: "src/appworld/evaluator.py",
      sha256: "bde9deb3b1e6ac0fa9819013729c0e817a97c90f579108fa032a90bba0ca51cb",
    },
    entrypoint: "appworld.evaluator:evaluate_task",
    requiredRawInputRoles: [
      "task-definition",
      "protected-task-evaluator",
      "start-database",
      "end-database",
    ],
    dynamicEntrypoint: {
      rawInputRole: "protected-task-evaluator",
      entrypoint: "evaluate",
    },
    outcomeSchemaId: "appworld-test-tracker-v1",
  },
  {
    cornerId: "sentinel-microhub-stars",
    taskIds: [
      "microhub-stars-relative-passive",
      "microhub-stars-noop",
      "microhub-stars-absolute-passive",
    ],
    procedureId: "sentinel.microhub.evaluate.v1",
    evaluatorSource: {
      sourceId: "sentinel-server",
      path: "server/server.py",
      sha256: "30fc6fd2afcab651fb58eb54862c7e6f7b2e82a503e911a6a14df2c3024ed165",
    },
    entrypoint: "server.server:evaluate",
    requiredRawInputRoles: [
      "scenario-definition",
      "initial-session-state",
      "terminal-session-state",
      "contact-events",
    ],
    dynamicEntrypoint: null,
    outcomeSchemaId: "sentinel-evaluate-response-v1",
  },
]);

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
  if (
    Object.keys(value).sort(compareCodeUnits).join(",") !==
    [...expected].sort(compareCodeUnits).join(",")
  ) {
    throw new Error(`${path} must contain exactly ${expected.join(", ")}`);
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot canonicalize a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot canonicalize ${typeof value}`);
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function bindingBody(
  spec: OracleProcedureSpec,
  taskId: string,
): Omit<OracleProcedureBinding, "bindingSha256"> {
  return {
    schemaVersion: "pm.public-eval-corners.oracle-procedure-binding.v1",
    cornerId: spec.cornerId,
    taskId,
    procedureId: spec.procedureId,
    evaluatorSource: spec.evaluatorSource,
    entrypoint: spec.entrypoint,
    requiredRawInputRoles: spec.requiredRawInputRoles,
    dynamicEntrypoint: spec.dynamicEntrypoint,
    outcomeSchemaId: spec.outcomeSchemaId,
  };
}

function bindingFor(cornerId: string, taskId: string): OracleProcedureBinding {
  const spec = PROCEDURE_SPECS.find(
    (candidate) =>
      candidate.cornerId === cornerId && candidate.taskIds.includes(taskId),
  );
  if (!spec) throw new Error(`no registered oracle procedure for ${cornerId}/${taskId}`);
  const body = bindingBody(spec, taskId);
  return deepFreeze({ ...body, bindingSha256: sha256Json(body) });
}

function assertManifestBinding(
  manifest: OracleProcedureManifest,
  binding: OracleProcedureBinding,
): void {
  if (!isRecord(manifest)) throw new Error("manifest must be an object");
  if (manifest.cornerId !== binding.cornerId) {
    throw new Error("manifest cornerId does not match the oracle procedure");
  }
  if (!Array.isArray(manifest.tasks)) throw new Error("manifest.tasks must be an array");
  if (!manifest.tasks.some((task) => isRecord(task) && task.taskId === binding.taskId)) {
    throw new Error("oracle taskId is not pinned by the corner manifest");
  }
  if (!Array.isArray(manifest.sources)) throw new Error("manifest.sources must be an array");
  const matchingSources = manifest.sources.filter(
    (source) => isRecord(source) && source.sourceId === binding.evaluatorSource.sourceId,
  );
  if (matchingSources.length !== 1) {
    throw new Error("manifest must contain the exact registered evaluator source once");
  }
  const [source] = matchingSources;
  if (
    !source ||
    source.path !== binding.evaluatorSource.path ||
    source.sha256 !== binding.evaluatorSource.sha256
  ) {
    throw new Error("manifest evaluator source path or bytes do not match the registered procedure");
  }
}

function assertBinding(value: unknown, expected: OracleProcedureBinding): void {
  if (!isRecord(value)) throw new Error("oracle procedure binding must be an object");
  exactKeys(value, [
    "bindingSha256",
    "cornerId",
    "dynamicEntrypoint",
    "entrypoint",
    "evaluatorSource",
    "outcomeSchemaId",
    "procedureId",
    "requiredRawInputRoles",
    "schemaVersion",
    "taskId",
  ], "oracle procedure binding");
  if (canonical(value) !== canonical(expected)) {
    throw new Error("oracle procedure/source/entrypoint selection is not the registered binding");
  }
}

function requiredSha(value: unknown, path: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error(`${path} must be lowercase SHA-256`);
  }
  return value;
}

function requiredPortablePath(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) {
    throw new Error(`${path} must be a non-empty bounded relative path`);
  }
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${path} must be a canonical relative path`);
  }
  return value;
}

function assertRawInputs(
  value: unknown,
  binding: OracleProcedureBinding,
): readonly OracleRawInputIdentity[] {
  if (!Array.isArray(value)) throw new Error("rawInputs must be an array");
  if (value.length !== binding.requiredRawInputRoles.length) {
    throw new Error("rawInputs do not contain the exact procedure-required roles");
  }
  return value.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`rawInputs[${index}] must be an object`);
    exactKeys(raw, ["byteLength", "path", "role", "sha256"], `rawInputs[${index}]`);
    const expectedRole = binding.requiredRawInputRoles[index];
    if (expectedRole === undefined) {
      throw new Error(`rawInputs[${index}] has no registered procedure role`);
    }
    if (raw.role !== expectedRole) {
      throw new Error(`rawInputs[${index}].role must be ${expectedRole}`);
    }
    if (
      !Number.isSafeInteger(raw.byteLength) ||
      (raw.byteLength as number) <= 0 ||
      (raw.byteLength as number) > MAX_RAW_INPUT_BYTES
    ) {
      throw new Error(`rawInputs[${index}].byteLength must be a positive bounded safe integer`);
    }
    return {
      role: expectedRole,
      path: requiredPortablePath(raw.path, `rawInputs[${index}].path`),
      sha256: requiredSha(raw.sha256, `rawInputs[${index}].sha256`),
      byteLength: raw.byteLength as number,
    };
  });
}

function assertUnitInterval(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be a finite number in [0, 1]`);
  }
}

function assertBoolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") throw new Error(`${path} must be boolean`);
}

function assertFiniteOrNull(value: unknown, path: string): void {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`${path} must be a finite number or null`);
  }
}

function assertMemoryAgentBenchResult(value: unknown): void {
  if (!isRecord(value)) throw new Error("result must be a MemoryAgentBench metrics object");
  exactKeys(value, [
    "exact_match",
    "f1",
    "rougeL_f1",
    "rougeL_recall",
    "rougeLsum_f1",
    "rougeLsum_recall",
    "substring_exact_match",
  ], "result");
  assertBoolean(value.exact_match, "result.exact_match");
  assertBoolean(value.substring_exact_match, "result.substring_exact_match");
  for (const field of ["f1", "rougeL_f1", "rougeL_recall", "rougeLsum_f1", "rougeLsum_recall"] as const) {
    assertUnitInterval(value[field], `result.${field}`);
  }
}

function assertTau2Result(value: unknown): void {
  if (!isRecord(value)) throw new Error("result must be a tau2 reward object");
  exactKeys(value, ["reward_info"], "result");
  if (!isRecord(value.reward_info)) throw new Error("result.reward_info must be an object");
  exactKeys(value.reward_info, ["db_check", "reward"], "result.reward_info");
  assertUnitInterval(value.reward_info.reward, "result.reward_info.reward");
  if (!isRecord(value.reward_info.db_check)) {
    throw new Error("result.reward_info.db_check must be an object");
  }
  exactKeys(value.reward_info.db_check, ["db_match"], "result.reward_info.db_check");
  assertBoolean(value.reward_info.db_check.db_match, "result.reward_info.db_check.db_match");
}

function assertAppWorldCase(value: unknown, path: string, failure: boolean): void {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  exactKeys(
    value,
    failure ? ["label", "requirement", "trace"] : ["label", "requirement"],
    path,
  );
  if (typeof value.requirement !== "string" || value.requirement.length === 0) {
    throw new Error(`${path}.requirement must be a non-empty string`);
  }
  if (value.label !== null && typeof value.label !== "string") {
    throw new Error(`${path}.label must be a string or null`);
  }
  if (failure && typeof value.trace !== "string") {
    throw new Error(`${path}.trace must be a string`);
  }
}

function assertAppWorldResult(value: unknown): void {
  if (!isRecord(value)) throw new Error("result must be an AppWorld TestTracker object");
  exactKeys(value, ["test_tracker"], "result");
  if (!isRecord(value.test_tracker)) throw new Error("result.test_tracker must be an object");
  const tracker = value.test_tracker;
  exactKeys(tracker, ["difficulty", "failures", "num_tests", "passes", "success"], "result.test_tracker");
  assertBoolean(tracker.success, "result.test_tracker.success");
  if (tracker.difficulty !== null && !Number.isSafeInteger(tracker.difficulty)) {
    throw new Error("result.test_tracker.difficulty must be a safe integer or null");
  }
  if (!Number.isSafeInteger(tracker.num_tests) || (tracker.num_tests as number) <= 0) {
    throw new Error("result.test_tracker.num_tests must be a positive safe integer");
  }
  if (!Array.isArray(tracker.passes) || !Array.isArray(tracker.failures)) {
    throw new Error("result.test_tracker passes and failures must be arrays");
  }
  tracker.passes.forEach((entry, index) => assertAppWorldCase(entry, `result.test_tracker.passes[${index}]`, false));
  tracker.failures.forEach((entry, index) => assertAppWorldCase(entry, `result.test_tracker.failures[${index}]`, true));
  if (tracker.passes.length + tracker.failures.length !== tracker.num_tests) {
    throw new Error("result.test_tracker cases do not account for num_tests");
  }
  if (tracker.success !== (tracker.passes.length === tracker.num_tests)) {
    throw new Error("result.test_tracker.success is inconsistent with cases");
  }
}

function assertSentinelResult(value: unknown): void {
  if (!isRecord(value)) throw new Error("result must be a Sentinel EvaluateResponse object");
  exactKeys(value, [
    "condition_at",
    "contact_get_time",
    "contact_message",
    "contact_post_time",
    "detail",
    "evaluation_time",
    "success",
  ], "result");
  assertBoolean(value.success, "result.success");
  if (typeof value.detail !== "string") throw new Error("result.detail must be a string");
  assertFiniteOrNull(value.evaluation_time, "result.evaluation_time");
  assertFiniteOrNull(value.condition_at, "result.condition_at");
  assertFiniteOrNull(value.contact_get_time, "result.contact_get_time");
  assertFiniteOrNull(value.contact_post_time, "result.contact_post_time");
  if (value.contact_message !== null && typeof value.contact_message !== "string") {
    throw new Error("result.contact_message must be a string or null");
  }
  if (value.success === true) {
    if (value.condition_at === null && value.contact_get_time !== null) {
      throw new Error("successful Sentinel no-op outcome cannot contain contact_get_time");
    }
    if (
      typeof value.condition_at === "number" &&
      (typeof value.contact_get_time !== "number" || value.contact_get_time < value.condition_at)
    ) {
      throw new Error("successful Sentinel conditioned outcome must contact at or after condition_at");
    }
  }
}

function assertResult(value: unknown, binding: OracleProcedureBinding): void {
  switch (binding.outcomeSchemaId) {
    case "memoryagentbench-metrics-v1":
      assertMemoryAgentBenchResult(value);
      return;
    case "tau2-reward-info-primary-v1":
      assertTau2Result(value);
      return;
    case "appworld-test-tracker-v1":
      assertAppWorldResult(value);
      return;
    case "sentinel-evaluate-response-v1":
      assertSentinelResult(value);
      return;
  }
}

function assertPrimaryInvocation(
  value: unknown,
  binding: OracleProcedureBinding,
): void {
  if (!isRecord(value)) throw new Error("evaluatorInvocation.primary must be an object");
  exactKeys(value, [
    "entrypoint",
    "invocationCount",
    "sourceId",
    "sourcePath",
    "sourceSha256",
  ], "evaluatorInvocation.primary");
  if (
    value.sourceId !== binding.evaluatorSource.sourceId ||
    value.sourcePath !== binding.evaluatorSource.path ||
    value.sourceSha256 !== binding.evaluatorSource.sha256
  ) {
    throw new Error("evaluatorInvocation.primary did not load the registered evaluator bytes");
  }
  if (value.entrypoint !== binding.entrypoint) {
    throw new Error("evaluatorInvocation.primary used the wrong entrypoint");
  }
  if (value.invocationCount !== 1) {
    throw new Error("evaluatorInvocation.primary must report exactly one evaluator call");
  }
}

function assertDynamicInvocation(
  value: unknown,
  binding: OracleProcedureBinding,
  rawInputs: readonly OracleRawInputIdentity[],
): void {
  const expected = binding.dynamicEntrypoint;
  if (expected === null) {
    if (value !== null) throw new Error("evaluatorInvocation.dynamic must be null for this procedure");
    return;
  }
  if (!isRecord(value)) throw new Error("evaluatorInvocation.dynamic must be an object");
  exactKeys(value, ["entrypoint", "invocationCount", "rawInputRole", "sourceSha256"], "evaluatorInvocation.dynamic");
  const rawInput = rawInputs.find(({ role }) => role === expected.rawInputRole);
  if (!rawInput) throw new Error("dynamic evaluator raw input is missing");
  if (
    value.rawInputRole !== expected.rawInputRole ||
    value.sourceSha256 !== rawInput.sha256 ||
    value.entrypoint !== expected.entrypoint ||
    value.invocationCount !== 1
  ) {
    throw new Error("evaluatorInvocation.dynamic does not bind the protected evaluator call");
  }
}

function assertInvocation(
  value: unknown,
  binding: OracleProcedureBinding,
  rawInputs: readonly OracleRawInputIdentity[],
  rawInputRootSha256: string,
  resultSha256: string,
): void {
  if (!isRecord(value)) throw new Error("evaluatorInvocation must be an object");
  exactKeys(value, [
    "bindingSha256",
    "dynamic",
    "primary",
    "rawInputRootSha256",
    "resultSha256",
    "schemaVersion",
    "status",
  ], "evaluatorInvocation");
  if (value.schemaVersion !== "pm.public-eval-corners.oracle-entrypoint-trace.v1") {
    throw new Error("unsupported evaluatorInvocation schemaVersion");
  }
  if (value.status !== "locally-captured-unverified") {
    throw new Error("evaluatorInvocation may not claim independent verification");
  }
  if (
    value.bindingSha256 !== binding.bindingSha256 ||
    value.rawInputRootSha256 !== rawInputRootSha256 ||
    value.resultSha256 !== resultSha256
  ) {
    throw new Error("evaluatorInvocation does not bind the procedure inputs and result");
  }
  assertPrimaryInvocation(value.primary, binding);
  assertDynamicInvocation(value.dynamic, binding, rawInputs);
}

function validation(
  bindingSha256: string | null,
  issues: readonly string[],
): OracleProcedureValidation {
  return deepFreeze({
    schemaVersion: "pm.public-eval-corners.oracle-procedure-validation.v1",
    valid: issues.length === 0,
    eligibleForIndependentAnalysis: false,
    bindingSha256,
    issues,
  });
}

export function getOracleProcedureBinding(
  cornerId: OracleProcedureCornerId,
  taskId: string,
): OracleProcedureBinding {
  return bindingFor(cornerId, taskId);
}

export function validateOracleProcedureBinding(
  manifest: OracleProcedureManifest,
  taskId: string,
  value: unknown,
): OracleProcedureValidation {
  let binding: OracleProcedureBinding | null = null;
  try {
    binding = bindingFor(manifest.cornerId, taskId);
    assertManifestBinding(manifest, binding);
    assertBinding(value, binding);
    return validation(binding.bindingSha256, []);
  } catch (error) {
    return validation(
      binding?.bindingSha256 ?? null,
      [error instanceof Error ? error.message : String(error)],
    );
  }
}

/**
 * Validates a self-contained, locally captured derivation envelope. Structural
 * validity proves more than merely listing evaluator bytes: it binds one exact
 * evaluator call, raw task/runtime identities, and a strict benchmark-specific
 * result shape. It intentionally never grants independent-analysis eligibility;
 * an external execution authority still has to prove that the trace is genuine.
 */
export function validateBoundOracleOutcome(
  value: unknown,
  manifest: OracleProcedureManifest,
  context: BoundOracleOutcomeContext,
): OracleProcedureValidation {
  let binding: OracleProcedureBinding | null = null;
  try {
    if (!isRecord(context)) throw new Error("bound oracle outcome context must be an object");
    exactKeys(context, ["expectedRawInputs", "expectedTaskId"], "bound oracle outcome context");
    if (typeof context.expectedTaskId !== "string") {
      throw new Error("bound oracle outcome context expectedTaskId must be a string");
    }
    binding = bindingFor(manifest.cornerId, context.expectedTaskId);
    assertManifestBinding(manifest, binding);
    const expectedRawInputs = assertRawInputs(context.expectedRawInputs, binding);
    if (!isRecord(value)) throw new Error("bound oracle outcome must be an object");
    exactKeys(value, [
      "bindingSha256",
      "cornerId",
      "eligibleForIndependentAnalysis",
      "evaluatorInvocation",
      "independentlyVerified",
      "procedureId",
      "rawInputRootSha256",
      "rawInputs",
      "result",
      "resultSha256",
      "schemaVersion",
      "taskId",
    ], "bound oracle outcome");
    if (value.schemaVersion !== "pm.public-eval-corners.bound-oracle-outcome.v1") {
      throw new Error("unsupported bound oracle outcome schemaVersion");
    }
    if (value.cornerId !== binding.cornerId || value.taskId !== binding.taskId) {
      throw new Error("bound oracle outcome does not match the harness-selected corner/task");
    }
    if (
      value.procedureId !== binding.procedureId ||
      value.bindingSha256 !== binding.bindingSha256
    ) {
      throw new Error("bound oracle outcome selected the wrong registered procedure");
    }
    if (value.independentlyVerified !== false || value.eligibleForIndependentAnalysis !== false) {
      throw new Error("local oracle derivation may not claim independent eligibility");
    }
    const rawInputs = assertRawInputs(value.rawInputs, binding);
    if (canonical(rawInputs) !== canonical(expectedRawInputs)) {
      throw new Error("bound oracle outcome rawInputs do not match harness-retained bytes");
    }
    const rawInputRootSha256 = sha256Json(rawInputs);
    if (value.rawInputRootSha256 !== rawInputRootSha256) {
      throw new Error("rawInputRootSha256 does not bind the exact raw input identities");
    }
    assertResult(value.result, binding);
    const resultSha256 = sha256Json(value.result);
    if (value.resultSha256 !== resultSha256) {
      throw new Error("resultSha256 does not bind the strict result payload");
    }
    assertInvocation(
      value.evaluatorInvocation,
      binding,
      rawInputs,
      rawInputRootSha256,
      resultSha256,
    );
    return validation(binding.bindingSha256, []);
  } catch (error) {
    return validation(
      binding?.bindingSha256 ?? null,
      [error instanceof Error ? error.message : String(error)],
    );
  }
}

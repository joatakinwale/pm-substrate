import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { TextDecoder } from "node:util";

type StateBenchArm = "native" | "sham" | "substrate";
type StateBenchRole = "runner" | "agent" | "simulator" | "judge";
type StateBenchDomain = "travel" | "customer_support" | "shopping_assistant";
type JsonRecord = Readonly<Record<string, unknown>>;

const ARMS = ["native", "sham", "substrate"] as const;
const ROLES = ["runner", "agent", "simulator", "judge"] as const;
const DOMAINS = ["travel", "customer_support", "shopping_assistant"] as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const SOURCE_REVISION = /^[a-f0-9]{40,64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const UTF8 = new TextDecoder("utf-8", { fatal: true });

interface ByteEvidence {
  readonly encoding: "base64";
  readonly bytesBase64: string;
  readonly byteLength: number;
  readonly sha256: string;
}

interface RoleRuntimeIdentity {
  readonly provider: string;
  readonly canonicalModelId: string;
  readonly deploymentId: string;
  readonly configurationSha256: string;
}

interface PlannedTaskSet {
  readonly domain: StateBenchDomain;
  readonly taskIds: readonly string[];
}

interface ArmTreatmentIdentity {
  readonly mode: "none" | "sham_sidecar" | "substrate_sidecar";
  readonly sidecarId: string | null;
  readonly sidecarRevision: string | null;
  readonly configurationSha256: string | null;
  readonly observationBoundaryId: string | null;
  readonly treatmentIdentityHash: string;
}

interface ExecutionCommandPlanBinding {
  readonly schemaVersion: "pm-state-bench-raw-command-plan-binding.v1";
  readonly planHash: string;
  readonly commandRootHash: string;
  readonly runConfigSetHash: string;
  readonly attemptScheduleHash: string;
  readonly commandCount: number;
}

interface RawEvidencePlan {
  readonly schemaVersion: "pm-state-bench-raw-evidence-plan.v1";
  readonly experimentId: string;
  readonly declaredAt: string;
  readonly phase: "qualification" | "confirmatory" | "replication";
  readonly split: "train" | "test";
  readonly benchmarkRevision: string;
  readonly protocolId: string;
  readonly arms: readonly StateBenchArm[];
  readonly tasks: readonly PlannedTaskSet[];
  readonly repeatIndices: readonly number[];
  readonly roleRuntimes: Readonly<Record<StateBenchRole, RoleRuntimeIdentity>>;
  readonly armTreatments: Readonly<Record<StateBenchArm, ArmTreatmentIdentity>>;
  readonly executionCommandPlan: ExecutionCommandPlanBinding;
  readonly retryPolicy: {
    readonly maxTaskAttempts: number;
    readonly providerMaxAttempts: number;
    readonly retainEveryAttempt: true;
    readonly terminalFailureCountsAsStrictFalse: true;
    readonly selectiveReplacementAllowed: false;
    readonly stoppingPolicy: "fixed_cells_no_optional_stopping";
  };
  readonly planHash: string;
}

interface RuntimeFile {
  readonly path: string;
  readonly kind: "runner" | "adapter" | "module" | "lockfile";
  readonly bytes: ByteEvidence;
}

interface RuntimeClosure {
  readonly schemaVersion: "pm-state-bench-runtime-closure.v1";
  readonly arm: StateBenchArm;
  readonly benchmarkRevision: string;
  readonly treatmentIdentityHash: string;
  readonly files: readonly RuntimeFile[];
  readonly treeSha256: string;
  readonly closureHash: string;
}

interface ProviderUsage {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningOutputTokens: number;
  readonly totalTokens: number;
}

interface ProviderExchange {
  readonly exchangeId: string;
  readonly sequence: number;
  readonly logicalCallId: string;
  readonly logicalCallOrdinal: number;
  readonly providerAttemptOrdinal: number;
  readonly retryOfExchangeId: string | null;
  readonly terminal: boolean;
  readonly role: StateBenchRole;
  readonly provider: string;
  readonly providerRequestId: string;
  readonly actualModel: string;
  readonly deploymentId: string;
  readonly configurationSha256: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly latencyMs: number;
  readonly request: ByteEvidence;
  readonly response: ByteEvidence;
  readonly outcome: "succeeded" | "failed";
  readonly error: ByteEvidence | null;
  readonly usage: ProviderUsage;
  readonly cost: {
    readonly currency: "USD";
    readonly micros: number;
  };
}

interface RoleCapture {
  readonly role: StateBenchRole;
  readonly disposition: "invoked" | "not_invoked_due_to_attempt_failure";
  readonly exchanges: readonly ProviderExchange[];
  readonly nonInvocation: {
    readonly recordedAt: string;
    readonly blockedByStage: StateBenchFailureStage;
    readonly evidence: ByteEvidence;
  } | null;
}

type StateBenchFailureStage =
  | StateBenchRole
  | "environment"
  | "tool_replay";

interface ToolCallReplayRecord {
  readonly toolCallId: string;
  readonly sequence: number;
  readonly name: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly arguments: ByteEvidence;
  readonly result: ByteEvidence;
  readonly outcome: "succeeded" | "failed";
  readonly error: ByteEvidence | null;
}

interface EnvironmentEvidence {
  readonly initialSnapshot: ByteEvidence;
  readonly finalSnapshot: ByteEvidence;
  readonly stateDiff: ByteEvidence;
  readonly replay: {
    readonly authority: "producer_local_replay";
    readonly procedureId: string;
    readonly procedureSourceSha256: string;
    readonly toolCalls: readonly ToolCallReplayRecord[];
    readonly toolCallCount: number;
    readonly replayedToolCallCount: number;
    readonly transcriptSha256: string;
    readonly recomputedFinalSnapshotSha256: string;
    readonly recordedFinalSnapshotSha256: string;
    readonly allCallsReplayed: true;
    readonly toolResultsMatchedCapturedBytes: true;
  };
}

interface TreatmentRetrievalCapture {
  readonly retrievalId: string;
  readonly sequence: number;
  readonly treatmentIdentityHash: string;
  readonly sidecarRequestId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly latencyMs: number;
  readonly request: ByteEvidence;
  readonly response: ByteEvidence;
}

interface TreatmentUptakeEvidence {
  readonly schemaVersion: "pm-state-bench-treatment-uptake.v1";
  readonly treatmentIdentityHash: string;
  readonly retrievals: readonly TreatmentRetrievalCapture[];
  readonly observationBoundary: {
    readonly observationBoundaryId: string;
    readonly agentExchangeId: string;
    readonly observedAt: string;
    readonly audit: ByteEvidence;
  } | null;
}

interface RawAttempt {
  readonly schemaVersion: "pm-state-bench-raw-attempt.v1";
  readonly globalSequence: number;
  readonly cellId: string;
  readonly attemptId: string;
  readonly attemptOrdinal: number;
  readonly retryOfAttemptId: string | null;
  readonly executionCommand: {
    readonly schemaVersion: "pm-state-bench-raw-command-binding.v1";
    readonly sequence: number;
    readonly cellId: string;
    readonly commandHash: string;
  };
  readonly identity: {
    readonly experimentId: string;
    readonly domain: StateBenchDomain;
    readonly taskId: string;
    readonly repeatIndex: number;
    readonly arm: StateBenchArm;
  };
  readonly runtimeClosureHash: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly latencyMs: number;
  readonly status: "succeeded" | "failed";
  readonly terminal: boolean;
  readonly failure: {
    readonly stage: StateBenchFailureStage;
    readonly errorClass: string;
    readonly error: ByteEvidence;
  } | null;
  readonly strictTaskSuccess: boolean;
  readonly officialScores: {
    readonly stateRequirementsMet: 0 | 1;
    readonly taskRequirementsMet: 0 | 1;
    readonly taskCompletionPass: 0 | 1;
  } | null;
  readonly roles: Readonly<Record<StateBenchRole, RoleCapture>>;
  readonly treatmentUptake: TreatmentUptakeEvidence;
  readonly environment: EnvironmentEvidence;
  readonly previousAttemptHash: string | null;
  readonly attemptHash: string;
}

interface ReportedSummary {
  readonly plannedCellCount: number;
  readonly observedCellCount: number;
  readonly totalAttemptCount: number;
  readonly retryAttemptCount: number;
  readonly failedAttemptCount: number;
  readonly terminalCompletedCount: number;
  readonly terminalFailureCount: number;
  readonly strictSuccessCellCount: number;
  readonly strictFailureCellCount: number;
  readonly totalExchangeCount: number;
  readonly totalProviderLatencyMs: number;
  readonly totalCostUsdMicros: number;
  readonly captureLedgerFinalHash: string;
  readonly runtimeClosureCount: number;
}

interface ExternalTrustEnvelope {
  readonly schemaVersion: "pm-state-bench-external-trust-envelope.v1";
  readonly policyId: string;
  readonly policyHash: string;
  readonly verifierId: string;
  readonly verifierOwnerId: string;
  readonly producerOwnerId: string;
  readonly keyId: string;
  readonly verifierSourceRevision: string;
  readonly verifiedAt: string;
  readonly signedBundleHash: string;
  readonly algorithm: "ed25519";
  readonly signatureBase64: string;
}

interface ExternalTrustPolicy {
  readonly schemaVersion: "pm-state-bench-external-trust-policy.v1";
  readonly policyId: string;
  readonly verifierId: string;
  readonly verifierOwnerId: string;
  readonly producerOwnerId: string;
  readonly keyId: string;
  readonly verifierSourceRevision: string;
  readonly benchmarkRevision: string;
  readonly publicKeyPem: string;
  readonly policyHash: string;
}

export interface RawEvidenceBundle {
  readonly schemaVersion: "pm-state-bench-raw-evidence.v1";
  readonly evidenceClass: "state_bench_raw_execution_evidence";
  readonly captureOrigin: "producer_local";
  readonly plan: RawEvidencePlan;
  readonly producer: {
    readonly producerId: string;
    readonly producerOwnerId: string;
    readonly capturedAt: string;
    readonly captureImplementationRevision: string;
    readonly captureImplementationSha256: string;
    readonly hostRuntimeSha256: string;
  };
  readonly runtimeClosures: readonly RuntimeClosure[];
  readonly attempts: readonly RawAttempt[];
  readonly reportedSummary: ReportedSummary;
  readonly externalTrust: ExternalTrustEnvelope | null;
  readonly bundleHash: string;
}

export interface StateBenchRawEvidenceVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly authorityStatus:
    | "producer_local_capture_ineligible"
    | "independently_authenticated_raw_evidence";
  readonly authorityIssues: readonly string[];
  readonly publicEvalAttemptEligible: false;
  readonly recomputedSummary: ReportedSummary | null;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => lexical(left, right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("canonical value contains undefined");
  return encoded;
}

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function record(value: unknown, path: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort(lexical);
  const wanted = [...expected].sort(lexical);
  if (canonical(actual) !== canonical(wanted)) {
    throw new Error(`${path} keys must be exactly ${wanted.join(", ")}`);
  }
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${path} must be a non-empty exact string`);
  }
  return value;
}

function safeId(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!SAFE_ID.test(parsed) || parsed.includes("..") || parsed.includes("\\")) {
    throw new Error(`${path} must be a safe identifier`);
  }
  return parsed;
}

function shaValue(value: unknown, path: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error(`${path} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function sourceRevision(value: unknown, path: string): string {
  if (typeof value !== "string" || !SOURCE_REVISION.test(value)) {
    throw new Error(`${path} must be a lowercase 40-64 character source revision`);
  }
  return value;
}

function timestamp(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  const milliseconds = Date.parse(parsed);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== parsed) {
    throw new Error(`${path} must be a canonical ISO-8601 timestamp`);
  }
  return parsed;
}

function integer(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path} must be an integer >= ${minimum}`);
  }
  return value as number;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${path} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function exactArray<T>(
  value: readonly T[],
  expected: readonly T[],
  path: string,
): void {
  if (canonical(value) !== canonical(expected)) {
    throw new Error(`${path} must equal ${expected.join(", ")}`);
  }
}

function parseBytes(value: unknown, path: string): ByteEvidence {
  const input = record(value, path);
  exactKeys(input, ["encoding", "bytesBase64", "byteLength", "sha256"], path);
  if (input["encoding"] !== "base64") throw new Error(`${path}.encoding must be base64`);
  const bytesBase64 = requiredString(input["bytesBase64"], `${path}.bytesBase64`);
  const decoded = Buffer.from(bytesBase64, "base64");
  if (decoded.length === 0 || decoded.toString("base64") !== bytesBase64) {
    throw new Error(`${path}.bytesBase64 must be canonical non-empty base64`);
  }
  const byteLength = integer(input["byteLength"], `${path}.byteLength`, 1);
  const digest = shaValue(input["sha256"], `${path}.sha256`);
  if (decoded.length !== byteLength || sha256(decoded) !== digest) {
    throw new Error(`${path} bytes, length, and digest do not match`);
  }
  return { encoding: "base64", bytesBase64, byteLength, sha256: digest };
}

function parseJsonBytes(value: unknown, path: string, objectRequired: boolean): ByteEvidence {
  const parsed = parseBytes(value, path);
  let decoded: unknown;
  try {
    decoded = JSON.parse(UTF8.decode(Buffer.from(parsed.bytesBase64, "base64")));
  } catch {
    throw new Error(`${path} must contain valid UTF-8 JSON bytes`);
  }
  if (objectRequired) record(decoded, `${path}.decoded`);
  return parsed;
}

function relativePath(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (
    parsed.startsWith("/") ||
    parsed.includes("\\") ||
    parsed.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`${path} must be a normalized relative path`);
  }
  return parsed;
}

function assertSortedUnique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${path} contains duplicates`);
  const sorted = [...values].sort(lexical);
  if (canonical(values) !== canonical(sorted)) throw new Error(`${path} must be sorted`);
}

function assertInterval(
  startedAt: string,
  endedAt: string,
  latencyMs: number,
  path: string,
): void {
  const elapsed = Date.parse(endedAt) - Date.parse(startedAt);
  if (elapsed < 0 || elapsed !== latencyMs) {
    throw new Error(`${path} timestamps must exactly match latencyMs`);
  }
}

function parseRuntimeIdentity(value: unknown, path: string): RoleRuntimeIdentity {
  const input = record(value, path);
  exactKeys(
    input,
    ["provider", "canonicalModelId", "deploymentId", "configurationSha256"],
    path,
  );
  return {
    provider: safeId(input["provider"], `${path}.provider`),
    canonicalModelId: safeId(input["canonicalModelId"], `${path}.canonicalModelId`),
    deploymentId: safeId(input["deploymentId"], `${path}.deploymentId`),
    configurationSha256: shaValue(
      input["configurationSha256"],
      `${path}.configurationSha256`,
    ),
  };
}

function parseArmTreatmentIdentity(
  value: unknown,
  arm: StateBenchArm,
  path: string,
): ArmTreatmentIdentity {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "mode", "sidecarId", "sidecarRevision", "configurationSha256",
      "observationBoundaryId", "treatmentIdentityHash",
    ],
    path,
  );
  const expectedMode = arm === "native" ? "none" : `${arm}_sidecar`;
  if (input["mode"] !== expectedMode) {
    throw new Error(`${path}.mode must be ${expectedMode}`);
  }
  const native = arm === "native";
  const nullableSafeId = (entry: unknown, entryPath: string): string | null =>
    entry === null ? null : safeId(entry, entryPath);
  const nullableRevision = (entry: unknown, entryPath: string): string | null =>
    entry === null ? null : sourceRevision(entry, entryPath);
  const nullableSha = (entry: unknown, entryPath: string): string | null =>
    entry === null ? null : shaValue(entry, entryPath);
  const body = {
    mode: expectedMode as ArmTreatmentIdentity["mode"],
    sidecarId: nullableSafeId(input["sidecarId"], `${path}.sidecarId`),
    sidecarRevision: nullableRevision(input["sidecarRevision"], `${path}.sidecarRevision`),
    configurationSha256: nullableSha(
      input["configurationSha256"],
      `${path}.configurationSha256`,
    ),
    observationBoundaryId: nullableSafeId(
      input["observationBoundaryId"],
      `${path}.observationBoundaryId`,
    ),
  };
  const identityFields = [
    body.sidecarId,
    body.sidecarRevision,
    body.configurationSha256,
    body.observationBoundaryId,
  ];
  if (
    (native && identityFields.some((entry) => entry !== null)) ||
    (!native && identityFields.some((entry) => entry === null))
  ) {
    throw new Error(`${path} sidecar identity fields do not match arm ${arm}`);
  }
  const treatmentIdentityHash = shaValue(
    input["treatmentIdentityHash"],
    `${path}.treatmentIdentityHash`,
  );
  if (treatmentIdentityHash !== sha256(canonical(body))) {
    throw new Error(`${path}.treatmentIdentityHash does not recompute`);
  }
  return { ...body, treatmentIdentityHash };
}

function parsePlan(value: unknown): RawEvidencePlan {
  const input = record(value, "plan");
  exactKeys(
    input,
    [
      "schemaVersion", "experimentId", "declaredAt", "phase", "split",
      "benchmarkRevision", "protocolId", "arms", "tasks", "repeatIndices",
      "roleRuntimes", "armTreatments", "executionCommandPlan", "retryPolicy", "planHash",
    ],
    "plan",
  );
  if (input["schemaVersion"] !== "pm-state-bench-raw-evidence-plan.v1") {
    throw new Error("plan.schemaVersion is unsupported");
  }
  const phase = enumValue(
    input["phase"],
    ["qualification", "confirmatory", "replication"] as const,
    "plan.phase",
  );
  const split = enumValue(input["split"], ["train", "test"] as const, "plan.split");
  if ((phase === "qualification") !== (split === "train")) {
    throw new Error("qualification must use train; confirmatory/replication must use test");
  }
  if (!Array.isArray(input["arms"])) throw new Error("plan.arms must be an array");
  const arms = input["arms"].map((entry, index) =>
    enumValue(entry, ARMS, `plan.arms[${index}]`));
  exactArray(arms, ARMS, "plan.arms");

  if (!Array.isArray(input["tasks"]) || input["tasks"].length === 0) {
    throw new Error("plan.tasks must be a non-empty array");
  }
  const tasks = input["tasks"].map((entry, index): PlannedTaskSet => {
    const task = record(entry, `plan.tasks[${index}]`);
    exactKeys(task, ["domain", "taskIds"], `plan.tasks[${index}]`);
    const domain = enumValue(task["domain"], DOMAINS, `plan.tasks[${index}].domain`);
    if (!Array.isArray(task["taskIds"]) || task["taskIds"].length === 0) {
      throw new Error(`plan.tasks[${index}].taskIds must be non-empty`);
    }
    const taskIds = task["taskIds"].map((taskId, taskIndex) =>
      safeId(taskId, `plan.tasks[${index}].taskIds[${taskIndex}]`));
    assertSortedUnique(taskIds, `plan.tasks[${index}].taskIds`);
    return { domain, taskIds };
  });
  assertSortedUnique(tasks.map((task) => task.domain), "plan.tasks domains");

  if (!Array.isArray(input["repeatIndices"]) || input["repeatIndices"].length === 0) {
    throw new Error("plan.repeatIndices must be non-empty");
  }
  const repeatIndices = input["repeatIndices"].map((entry, index) =>
    integer(entry, `plan.repeatIndices[${index}]`, 1));
  exactArray(
    repeatIndices,
    Array.from({ length: repeatIndices.length }, (_, index) => index + 1),
    "plan.repeatIndices",
  );

  const runtimesInput = record(input["roleRuntimes"], "plan.roleRuntimes");
  exactKeys(runtimesInput, ROLES, "plan.roleRuntimes");
  const roleRuntimes = Object.fromEntries(
    ROLES.map((role) => [role, parseRuntimeIdentity(runtimesInput[role], `plan.roleRuntimes.${role}`)]),
  ) as unknown as Readonly<Record<StateBenchRole, RoleRuntimeIdentity>>;

  const treatmentsInput = record(input["armTreatments"], "plan.armTreatments");
  exactKeys(treatmentsInput, ARMS, "plan.armTreatments");
  const armTreatments = Object.fromEntries(ARMS.map((arm) => [
    arm,
    parseArmTreatmentIdentity(
      treatmentsInput[arm],
      arm,
      `plan.armTreatments.${arm}`,
    ),
  ])) as unknown as Readonly<Record<StateBenchArm, ArmTreatmentIdentity>>;
  if (
    new Set(ARMS.map((arm) => armTreatments[arm].treatmentIdentityHash)).size !==
      ARMS.length ||
    armTreatments.sham.configurationSha256 ===
      armTreatments.substrate.configurationSha256
  ) {
    throw new Error("plan arm treatments must have distinct identities and sidecar configurations");
  }

  const commandPlanInput = record(input["executionCommandPlan"], "plan.executionCommandPlan");
  exactKeys(commandPlanInput, [
    "schemaVersion", "planHash", "commandRootHash", "runConfigSetHash",
    "attemptScheduleHash", "commandCount",
  ], "plan.executionCommandPlan");
  if (commandPlanInput["schemaVersion"] !== "pm-state-bench-raw-command-plan-binding.v1") {
    throw new Error("plan.executionCommandPlan.schemaVersion is unsupported");
  }
  const executionCommandPlan = {
    schemaVersion: "pm-state-bench-raw-command-plan-binding.v1" as const,
    planHash: shaValue(commandPlanInput["planHash"], "plan.executionCommandPlan.planHash"),
    commandRootHash: shaValue(commandPlanInput["commandRootHash"], "plan.executionCommandPlan.commandRootHash"),
    runConfigSetHash: shaValue(commandPlanInput["runConfigSetHash"], "plan.executionCommandPlan.runConfigSetHash"),
    attemptScheduleHash: shaValue(commandPlanInput["attemptScheduleHash"], "plan.executionCommandPlan.attemptScheduleHash"),
    commandCount: integer(commandPlanInput["commandCount"], "plan.executionCommandPlan.commandCount", 1),
  };

  const retryInput = record(input["retryPolicy"], "plan.retryPolicy");
  exactKeys(
    retryInput,
    [
      "maxTaskAttempts", "providerMaxAttempts", "retainEveryAttempt",
      "terminalFailureCountsAsStrictFalse", "selectiveReplacementAllowed",
      "stoppingPolicy",
    ],
    "plan.retryPolicy",
  );
  if (
    retryInput["retainEveryAttempt"] !== true ||
    retryInput["terminalFailureCountsAsStrictFalse"] !== true ||
    retryInput["selectiveReplacementAllowed"] !== false ||
    retryInput["stoppingPolicy"] !== "fixed_cells_no_optional_stopping"
  ) {
    throw new Error("plan.retryPolicy must retain all attempts and forbid replacement/stopping");
  }
  const retryPolicy = {
    maxTaskAttempts: integer(retryInput["maxTaskAttempts"], "plan.retryPolicy.maxTaskAttempts", 1),
    providerMaxAttempts: integer(
      retryInput["providerMaxAttempts"],
      "plan.retryPolicy.providerMaxAttempts",
      1,
    ),
    retainEveryAttempt: true as const,
    terminalFailureCountsAsStrictFalse: true as const,
    selectiveReplacementAllowed: false as const,
    stoppingPolicy: "fixed_cells_no_optional_stopping" as const,
  };
  const body = {
    schemaVersion: "pm-state-bench-raw-evidence-plan.v1" as const,
    experimentId: safeId(input["experimentId"], "plan.experimentId"),
    declaredAt: timestamp(input["declaredAt"], "plan.declaredAt"),
    phase,
    split,
    benchmarkRevision: sourceRevision(input["benchmarkRevision"], "plan.benchmarkRevision"),
    protocolId: safeId(input["protocolId"], "plan.protocolId"),
    arms,
    tasks,
    repeatIndices,
    roleRuntimes,
    armTreatments,
    executionCommandPlan,
    retryPolicy,
  };
  const planHash = shaValue(input["planHash"], "plan.planHash");
  if (sha256(canonical(body)) !== planHash) throw new Error("plan.planHash does not recompute");
  return { ...body, planHash };
}

function parseRuntimeClosure(
  value: unknown,
  plan: RawEvidencePlan,
  path: string,
): RuntimeClosure {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "schemaVersion", "arm", "benchmarkRevision", "treatmentIdentityHash",
      "files", "treeSha256", "closureHash",
    ],
    path,
  );
  if (input["schemaVersion"] !== "pm-state-bench-runtime-closure.v1") {
    throw new Error(`${path}.schemaVersion is unsupported`);
  }
  const arm = enumValue(input["arm"], ARMS, `${path}.arm`);
  const benchmarkRevision = sourceRevision(input["benchmarkRevision"], `${path}.benchmarkRevision`);
  if (benchmarkRevision !== plan.benchmarkRevision) throw new Error(`${path} benchmark revision drifted`);
  const treatmentIdentityHash = shaValue(
    input["treatmentIdentityHash"],
    `${path}.treatmentIdentityHash`,
  );
  if (treatmentIdentityHash !== plan.armTreatments[arm].treatmentIdentityHash) {
    throw new Error(`${path}.treatmentIdentityHash does not match the planned arm treatment`);
  }
  if (!Array.isArray(input["files"]) || input["files"].length < 3) {
    throw new Error(`${path}.files must contain runner, lockfile, and runtime modules`);
  }
  const files = input["files"].map((entry, index): RuntimeFile => {
    const file = record(entry, `${path}.files[${index}]`);
    exactKeys(file, ["path", "kind", "bytes"], `${path}.files[${index}]`);
    return {
      path: relativePath(file["path"], `${path}.files[${index}].path`),
      kind: enumValue(
        file["kind"],
        ["runner", "adapter", "module", "lockfile"] as const,
        `${path}.files[${index}].kind`,
      ),
      bytes: parseBytes(file["bytes"], `${path}.files[${index}].bytes`),
    };
  });
  assertSortedUnique(files.map((file) => file.path), `${path}.files paths`);
  const kindCount = (kind: RuntimeFile["kind"]): number =>
    files.filter((file) => file.kind === kind).length;
  if (kindCount("runner") !== 1 || kindCount("lockfile") !== 1 || kindCount("module") < 1) {
    throw new Error(`${path} requires one runner, one lockfile, and at least one module`);
  }
  if ((arm === "native" && kindCount("adapter") !== 0) || (arm !== "native" && kindCount("adapter") !== 1)) {
    throw new Error(`${path} adapter inventory does not match arm ${arm}`);
  }
  const treeSha256 = shaValue(input["treeSha256"], `${path}.treeSha256`);
  const recomputedTree = sha256(files.map((file) => `${file.path}\0${file.bytes.sha256}\n`).join(""));
  if (treeSha256 !== recomputedTree) throw new Error(`${path}.treeSha256 does not recompute`);
  const body = {
    schemaVersion: "pm-state-bench-runtime-closure.v1" as const,
    arm,
    benchmarkRevision,
    treatmentIdentityHash,
    files,
    treeSha256,
  };
  const closureHash = shaValue(input["closureHash"], `${path}.closureHash`);
  if (closureHash !== sha256(canonical(body))) throw new Error(`${path}.closureHash does not recompute`);
  return { ...body, closureHash };
}

function parseUsage(value: unknown, path: string): ProviderUsage {
  const input = record(value, path);
  exactKeys(
    input,
    ["inputTokens", "cachedInputTokens", "outputTokens", "reasoningOutputTokens", "totalTokens"],
    path,
  );
  const parsed = {
    inputTokens: integer(input["inputTokens"], `${path}.inputTokens`),
    cachedInputTokens: integer(input["cachedInputTokens"], `${path}.cachedInputTokens`),
    outputTokens: integer(input["outputTokens"], `${path}.outputTokens`),
    reasoningOutputTokens: integer(input["reasoningOutputTokens"], `${path}.reasoningOutputTokens`),
    totalTokens: integer(input["totalTokens"], `${path}.totalTokens`),
  };
  if (
    parsed.cachedInputTokens > parsed.inputTokens ||
    parsed.reasoningOutputTokens > parsed.outputTokens ||
    parsed.totalTokens !== parsed.inputTokens + parsed.outputTokens
  ) {
    throw new Error(`${path} token buckets are inconsistent`);
  }
  return parsed;
}

function parseExchange(
  value: unknown,
  role: StateBenchRole,
  runtime: RoleRuntimeIdentity,
  path: string,
): ProviderExchange {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "exchangeId", "sequence", "logicalCallId", "logicalCallOrdinal",
      "providerAttemptOrdinal", "retryOfExchangeId", "terminal", "role",
      "provider", "providerRequestId",
      "actualModel", "deploymentId", "configurationSha256", "startedAt", "endedAt",
      "latencyMs", "request", "response", "outcome", "error", "usage", "cost",
    ],
    path,
  );
  if (input["role"] !== role) throw new Error(`${path}.role does not match its role capture`);
  if (typeof input["terminal"] !== "boolean") {
    throw new Error(`${path}.terminal must be a boolean`);
  }
  const provider = safeId(input["provider"], `${path}.provider`);
  const actualModel = safeId(input["actualModel"], `${path}.actualModel`);
  const deploymentId = safeId(input["deploymentId"], `${path}.deploymentId`);
  const configurationSha256 = shaValue(input["configurationSha256"], `${path}.configurationSha256`);
  if (
    provider !== runtime.provider ||
    actualModel !== runtime.canonicalModelId ||
    deploymentId !== runtime.deploymentId ||
    configurationSha256 !== runtime.configurationSha256
  ) {
    throw new Error(`${path} actual provider/model/config does not exactly match the plan`);
  }
  const startedAt = timestamp(input["startedAt"], `${path}.startedAt`);
  const endedAt = timestamp(input["endedAt"], `${path}.endedAt`);
  const latencyMs = integer(input["latencyMs"], `${path}.latencyMs`);
  assertInterval(startedAt, endedAt, latencyMs, path);
  const outcome = enumValue(input["outcome"], ["succeeded", "failed"] as const, `${path}.outcome`);
  const error = input["error"] === null ? null : parseBytes(input["error"], `${path}.error`);
  if ((outcome === "failed") !== (error !== null)) {
    throw new Error(`${path}.error must be present exactly when the exchange failed`);
  }
  const costInput = record(input["cost"], `${path}.cost`);
  exactKeys(costInput, ["currency", "micros"], `${path}.cost`);
  if (costInput["currency"] !== "USD") throw new Error(`${path}.cost.currency must be USD`);
  const usage = parseUsage(input["usage"], `${path}.usage`);
  const cost = { currency: "USD" as const, micros: integer(costInput["micros"], `${path}.cost.micros`) };
  if (
    role === "runner" &&
    (usage.totalTokens !== 0 || usage.cachedInputTokens !== 0 || cost.micros !== 0)
  ) {
    throw new Error(`${path} local runner exchange cannot report provider tokens or cost`);
  }
  return {
    exchangeId: shaValue(input["exchangeId"], `${path}.exchangeId`),
    sequence: integer(input["sequence"], `${path}.sequence`, 1),
    logicalCallId: shaValue(input["logicalCallId"], `${path}.logicalCallId`),
    logicalCallOrdinal: integer(
      input["logicalCallOrdinal"],
      `${path}.logicalCallOrdinal`,
      1,
    ),
    providerAttemptOrdinal: integer(
      input["providerAttemptOrdinal"],
      `${path}.providerAttemptOrdinal`,
      1,
    ),
    retryOfExchangeId: input["retryOfExchangeId"] === null
      ? null
      : shaValue(input["retryOfExchangeId"], `${path}.retryOfExchangeId`),
    terminal: input["terminal"],
    role,
    provider,
    providerRequestId: safeId(input["providerRequestId"], `${path}.providerRequestId`),
    actualModel,
    deploymentId,
    configurationSha256,
    startedAt,
    endedAt,
    latencyMs,
    request: parseBytes(input["request"], `${path}.request`),
    response: parseBytes(input["response"], `${path}.response`),
    outcome,
    error,
    usage,
    cost,
  };
}

function expectedLogicalCallId(
  attemptId: string,
  role: StateBenchRole,
  logicalCallOrdinal: number,
): string {
  return sha256(canonical({ attemptId, role, logicalCallOrdinal }));
}

function expectedExchangeId(
  logicalCallId: string,
  providerAttemptOrdinal: number,
): string {
  return sha256(canonical({ logicalCallId, providerAttemptOrdinal }));
}

function verifyProviderExchangeTopology(
  exchanges: readonly ProviderExchange[],
  attemptId: string,
  role: StateBenchRole,
  providerMaxAttempts: number,
  path: string,
): void {
  for (let index = 1; index < exchanges.length; index += 1) {
    const previous = exchanges[index - 1]!;
    const current = exchanges[index]!;
    if (current.sequence <= previous.sequence) {
      throw new Error(`${path} must retain exchanges in strictly ascending sequence order`);
    }
    if (Date.parse(current.startedAt) < Date.parse(previous.endedAt)) {
      throw new Error(`${path} provider exchanges overlap or are not in chronological order`);
    }
  }
  const chains: ProviderExchange[][] = [];
  for (const exchange of exchanges) {
    const active = chains.at(-1);
    if (active === undefined || exchange.logicalCallOrdinal === chains.length + 1) {
      chains.push([exchange]);
    } else if (exchange.logicalCallOrdinal === chains.length) {
      active.push(exchange);
    } else {
      throw new Error(`${path} logical call ordinals must be contiguous and non-interleaved`);
    }
  }
  for (const [callIndex, chain] of chains.entries()) {
    const logicalCallOrdinal = callIndex + 1;
    const logicalCallId = expectedLogicalCallId(attemptId, role, logicalCallOrdinal);
    if (chain.some((exchange) => exchange.logicalCallOrdinal !== logicalCallOrdinal)) {
      throw new Error(`${path} logical call ordinals must start at one and be contiguous`);
    }
    if (chain.some((exchange) => exchange.logicalCallId !== logicalCallId)) {
      throw new Error(`${path} logicalCallId does not recompute from attempt, role, and call ordinal`);
    }
    if (chain.length > providerMaxAttempts) {
      throw new Error(`${path} logical call ${logicalCallOrdinal} exceeds providerMaxAttempts`);
    }
    exactArray(
      chain.map((exchange) => exchange.providerAttemptOrdinal),
      chain.map((_, index) => index + 1),
      `${path} logical call ${logicalCallOrdinal} provider attempt ordinals`,
    );
    const firstTerminalIndex = chain.findIndex((exchange) => exchange.terminal);
    if (firstTerminalIndex >= 0 && firstTerminalIndex !== chain.length - 1) {
      throw new Error(`${path} logical call ${logicalCallOrdinal} retains a provider attempt after terminal`);
    }
    if (chain.filter((exchange) => exchange.terminal).length !== 1 || firstTerminalIndex < 0) {
      throw new Error(`${path} logical call ${logicalCallOrdinal} must have exactly one final terminal exchange`);
    }
    for (const [providerIndex, exchange] of chain.entries()) {
      const expectedId = expectedExchangeId(logicalCallId, providerIndex + 1);
      if (exchange.exchangeId !== expectedId) {
        throw new Error(`${path} logical call ${logicalCallOrdinal} exchangeId does not recompute`);
      }
      const expectedRetry = providerIndex === 0 ? null : chain[providerIndex - 1]!.exchangeId;
      if (exchange.retryOfExchangeId !== expectedRetry) {
        throw new Error(`${path} logical call ${logicalCallOrdinal} retry chain is incomplete`);
      }
      if (!exchange.terminal && exchange.outcome !== "failed") {
        throw new Error(`${path} logical call ${logicalCallOrdinal} nonterminal provider attempts must fail`);
      }
    }
    if (chain.at(-1)?.outcome === "failed" && callIndex < chains.length - 1) {
      throw new Error(`${path} cannot start a logical call after a terminal provider failure`);
    }
  }
}

function parseFailureStage(value: unknown, path: string): StateBenchFailureStage {
  return enumValue(value, [...ROLES, "environment", "tool_replay"] as const, path);
}

function parseRoleCapture(
  value: unknown,
  role: StateBenchRole,
  runtime: RoleRuntimeIdentity,
  attemptId: string,
  providerMaxAttempts: number,
  path: string,
): RoleCapture {
  const input = record(value, path);
  exactKeys(input, ["role", "disposition", "exchanges", "nonInvocation"], path);
  if (input["role"] !== role) throw new Error(`${path}.role must be ${role}`);
  const disposition = enumValue(
    input["disposition"],
    ["invoked", "not_invoked_due_to_attempt_failure"] as const,
    `${path}.disposition`,
  );
  if (!Array.isArray(input["exchanges"])) throw new Error(`${path}.exchanges must be an array`);
  const exchanges = input["exchanges"].map((entry, index) =>
    parseExchange(entry, role, runtime, `${path}.exchanges[${index}]`));
  if (disposition === "invoked") {
    if (exchanges.length === 0 || input["nonInvocation"] !== null) {
      throw new Error(`${path} invoked role needs exchanges and no nonInvocation record`);
    }
    verifyProviderExchangeTopology(
      exchanges,
      attemptId,
      role,
      providerMaxAttempts,
      `${path}.exchanges`,
    );
    return { role, disposition, exchanges, nonInvocation: null };
  }
  if (exchanges.length !== 0) throw new Error(`${path} non-invoked role cannot contain exchanges`);
  const absent = record(input["nonInvocation"], `${path}.nonInvocation`);
  exactKeys(absent, ["recordedAt", "blockedByStage", "evidence"], `${path}.nonInvocation`);
  return {
    role,
    disposition,
    exchanges,
    nonInvocation: {
      recordedAt: timestamp(absent["recordedAt"], `${path}.nonInvocation.recordedAt`),
      blockedByStage: parseFailureStage(absent["blockedByStage"], `${path}.nonInvocation.blockedByStage`),
      evidence: parseBytes(absent["evidence"], `${path}.nonInvocation.evidence`),
    },
  };
}

function parseToolCall(value: unknown, path: string): ToolCallReplayRecord {
  const input = record(value, path);
  exactKeys(
    input,
    ["toolCallId", "sequence", "name", "startedAt", "endedAt", "arguments", "result", "outcome", "error"],
    path,
  );
  const startedAt = timestamp(input["startedAt"], `${path}.startedAt`);
  const endedAt = timestamp(input["endedAt"], `${path}.endedAt`);
  if (Date.parse(endedAt) < Date.parse(startedAt)) throw new Error(`${path} ended before it started`);
  const outcome = enumValue(input["outcome"], ["succeeded", "failed"] as const, `${path}.outcome`);
  const error = input["error"] === null ? null : parseBytes(input["error"], `${path}.error`);
  if ((outcome === "failed") !== (error !== null)) {
    throw new Error(`${path}.error must be present exactly for failed tool calls`);
  }
  return {
    toolCallId: safeId(input["toolCallId"], `${path}.toolCallId`),
    sequence: integer(input["sequence"], `${path}.sequence`, 1),
    name: safeId(input["name"], `${path}.name`),
    startedAt,
    endedAt,
    arguments: parseJsonBytes(input["arguments"], `${path}.arguments`, true),
    result: parseJsonBytes(input["result"], `${path}.result`, false),
    outcome,
    error,
  };
}

function parseEnvironment(value: unknown, path: string): EnvironmentEvidence {
  const input = record(value, path);
  exactKeys(input, ["initialSnapshot", "finalSnapshot", "stateDiff", "replay"], path);
  const initialSnapshot = parseJsonBytes(input["initialSnapshot"], `${path}.initialSnapshot`, true);
  const finalSnapshot = parseJsonBytes(input["finalSnapshot"], `${path}.finalSnapshot`, true);
  const stateDiff = parseJsonBytes(input["stateDiff"], `${path}.stateDiff`, true);
  const decodedDiff = JSON.parse(UTF8.decode(Buffer.from(stateDiff.bytesBase64, "base64"))) as unknown;
  exactKeys(record(decodedDiff, `${path}.stateDiff.decoded`), ["created", "modified", "deleted"], `${path}.stateDiff.decoded`);

  const replayInput = record(input["replay"], `${path}.replay`);
  exactKeys(
    replayInput,
    [
      "authority", "procedureId", "procedureSourceSha256", "toolCalls", "toolCallCount",
      "replayedToolCallCount", "transcriptSha256", "recomputedFinalSnapshotSha256",
      "recordedFinalSnapshotSha256", "allCallsReplayed", "toolResultsMatchedCapturedBytes",
    ],
    `${path}.replay`,
  );
  if (replayInput["authority"] !== "producer_local_replay") {
    throw new Error(`${path}.replay.authority must remain producer_local_replay`);
  }
  if (!Array.isArray(replayInput["toolCalls"])) throw new Error(`${path}.replay.toolCalls must be an array`);
  const toolCalls = replayInput["toolCalls"].map((entry, index) =>
    parseToolCall(entry, `${path}.replay.toolCalls[${index}]`));
  exactArray(toolCalls.map((call) => call.sequence), toolCalls.map((_, index) => index + 1), `${path}.replay tool sequences`);
  if (new Set(toolCalls.map((call) => call.toolCallId)).size !== toolCalls.length) {
    throw new Error(`${path}.replay toolCallIds must be unique`);
  }
  const toolCallCount = integer(replayInput["toolCallCount"], `${path}.replay.toolCallCount`);
  const replayedToolCallCount = integer(
    replayInput["replayedToolCallCount"],
    `${path}.replay.replayedToolCallCount`,
  );
  if (
    toolCallCount !== toolCalls.length ||
    replayedToolCallCount !== toolCalls.length ||
    replayInput["allCallsReplayed"] !== true ||
    replayInput["toolResultsMatchedCapturedBytes"] !== true
  ) {
    throw new Error(`${path}.replay must account for and match every tool call`);
  }
  const transcriptSha256 = shaValue(replayInput["transcriptSha256"], `${path}.replay.transcriptSha256`);
  if (transcriptSha256 !== sha256(canonical(toolCalls))) {
    throw new Error(`${path}.replay.transcriptSha256 does not recompute`);
  }
  const recomputedFinalSnapshotSha256 = shaValue(
    replayInput["recomputedFinalSnapshotSha256"],
    `${path}.replay.recomputedFinalSnapshotSha256`,
  );
  const recordedFinalSnapshotSha256 = shaValue(
    replayInput["recordedFinalSnapshotSha256"],
    `${path}.replay.recordedFinalSnapshotSha256`,
  );
  if (
    recomputedFinalSnapshotSha256 !== finalSnapshot.sha256 ||
    recordedFinalSnapshotSha256 !== finalSnapshot.sha256
  ) {
    throw new Error(`${path}.replay final snapshot bindings do not match`);
  }
  return {
    initialSnapshot,
    finalSnapshot,
    stateDiff,
    replay: {
      authority: "producer_local_replay",
      procedureId: safeId(replayInput["procedureId"], `${path}.replay.procedureId`),
      procedureSourceSha256: shaValue(
        replayInput["procedureSourceSha256"],
        `${path}.replay.procedureSourceSha256`,
      ),
      toolCalls,
      toolCallCount,
      replayedToolCallCount,
      transcriptSha256,
      recomputedFinalSnapshotSha256,
      recordedFinalSnapshotSha256,
      allCallsReplayed: true,
      toolResultsMatchedCapturedBytes: true,
    },
  };
}

function parseTreatmentRetrieval(
  value: unknown,
  treatment: ArmTreatmentIdentity,
  path: string,
): TreatmentRetrievalCapture {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "retrievalId", "sequence", "treatmentIdentityHash", "sidecarRequestId",
      "startedAt", "endedAt", "latencyMs", "request", "response",
    ],
    path,
  );
  const treatmentIdentityHash = shaValue(
    input["treatmentIdentityHash"],
    `${path}.treatmentIdentityHash`,
  );
  if (treatmentIdentityHash !== treatment.treatmentIdentityHash) {
    throw new Error(`${path}.treatmentIdentityHash does not match the planned treatment`);
  }
  const startedAt = timestamp(input["startedAt"], `${path}.startedAt`);
  const endedAt = timestamp(input["endedAt"], `${path}.endedAt`);
  const latencyMs = integer(input["latencyMs"], `${path}.latencyMs`);
  assertInterval(startedAt, endedAt, latencyMs, path);
  return {
    retrievalId: safeId(input["retrievalId"], `${path}.retrievalId`),
    sequence: integer(input["sequence"], `${path}.sequence`, 1),
    treatmentIdentityHash,
    sidecarRequestId: safeId(input["sidecarRequestId"], `${path}.sidecarRequestId`),
    startedAt,
    endedAt,
    latencyMs,
    request: parseBytes(input["request"], `${path}.request`),
    response: parseBytes(input["response"], `${path}.response`),
  };
}

function parseTreatmentUptake(
  value: unknown,
  treatment: ArmTreatmentIdentity,
  arm: StateBenchArm,
  attemptId: string,
  attemptStartedAt: string,
  attemptEndedAt: string,
  agentExchanges: readonly ProviderExchange[],
  path: string,
): TreatmentUptakeEvidence {
  const input = record(value, path);
  exactKeys(
    input,
    ["schemaVersion", "treatmentIdentityHash", "retrievals", "observationBoundary"],
    path,
  );
  if (input["schemaVersion"] !== "pm-state-bench-treatment-uptake.v1") {
    throw new Error(`${path}.schemaVersion is unsupported`);
  }
  const treatmentIdentityHash = shaValue(
    input["treatmentIdentityHash"],
    `${path}.treatmentIdentityHash`,
  );
  if (treatmentIdentityHash !== treatment.treatmentIdentityHash) {
    throw new Error(`${path}.treatmentIdentityHash does not match the planned arm`);
  }
  if (!Array.isArray(input["retrievals"])) {
    throw new Error(`${path}.retrievals must be an array`);
  }
  const retrievals = input["retrievals"].map((entry, index) =>
    parseTreatmentRetrieval(entry, treatment, `${path}.retrievals[${index}]`));
  exactArray(
    retrievals.map((retrieval) => retrieval.sequence),
    retrievals.map((_, index) => index + 1),
    `${path} retrieval sequences`,
  );
  if (
    new Set(retrievals.map((retrieval) => retrieval.retrievalId)).size !==
      retrievals.length ||
    new Set(retrievals.map((retrieval) => retrieval.sidecarRequestId)).size !==
      retrievals.length
  ) {
    throw new Error(`${path} retrieval and sidecar request IDs must be unique`);
  }
  if (
    retrievals.some((retrieval) =>
      Date.parse(retrieval.startedAt) < Date.parse(attemptStartedAt) ||
      Date.parse(retrieval.endedAt) > Date.parse(attemptEndedAt))
  ) {
    throw new Error(`${path} retrieval timestamps must be inside the attempt interval`);
  }

  if (arm === "native") {
    if (retrievals.length !== 0 || input["observationBoundary"] !== null) {
      throw new Error(`${path} native attempts must contain zero retrievals and no sidecar audit`);
    }
    return {
      schemaVersion: "pm-state-bench-treatment-uptake.v1",
      treatmentIdentityHash,
      retrievals,
      observationBoundary: null,
    };
  }

  if (retrievals.length === 0 || input["observationBoundary"] === null) {
    throw new Error(`${path} ${arm} attempts require captured retrieval uptake and a boundary audit`);
  }
  const boundaryInput = record(input["observationBoundary"], `${path}.observationBoundary`);
  exactKeys(
    boundaryInput,
    ["observationBoundaryId", "agentExchangeId", "observedAt", "audit"],
    `${path}.observationBoundary`,
  );
  const observationBoundaryId = safeId(
    boundaryInput["observationBoundaryId"],
    `${path}.observationBoundary.observationBoundaryId`,
  );
  if (observationBoundaryId !== treatment.observationBoundaryId) {
    throw new Error(`${path}.observationBoundary does not match the planned treatment boundary`);
  }
  const agentExchangeId = safeId(
    boundaryInput["agentExchangeId"],
    `${path}.observationBoundary.agentExchangeId`,
  );
  const agentExchange = agentExchanges.find(
    (exchange) => exchange.exchangeId === agentExchangeId,
  );
  if (agentExchange === undefined) {
    throw new Error(`${path}.observationBoundary does not bind an exact agent exchange`);
  }
  const observedAt = timestamp(
    boundaryInput["observedAt"],
    `${path}.observationBoundary.observedAt`,
  );
  if (
    observedAt !== agentExchange.startedAt ||
    retrievals.some((retrieval) => Date.parse(retrieval.endedAt) > Date.parse(observedAt))
  ) {
    throw new Error(`${path}.observationBoundary is not between retrieval and agent observation`);
  }
  const audit = parseJsonBytes(
    boundaryInput["audit"],
    `${path}.observationBoundary.audit`,
    true,
  );
  const decodedAudit = JSON.parse(
    UTF8.decode(Buffer.from(audit.bytesBase64, "base64")),
  ) as unknown;
  const expectedAudit = {
    schemaVersion: "pm-state-bench-treatment-audit.v1",
    attemptId,
    arm,
    treatmentIdentityHash,
    observationBoundaryId,
    agentExchangeId,
    retrievalCount: retrievals.length,
    retrievals: retrievals.map((retrieval) => ({
      retrievalId: retrieval.retrievalId,
      sidecarRequestId: retrieval.sidecarRequestId,
      requestSha256: retrieval.request.sha256,
      responseSha256: retrieval.response.sha256,
    })),
  };
  if (canonical(decodedAudit) !== canonical(expectedAudit)) {
    throw new Error(`${path}.observationBoundary.audit does not match captured treatment uptake`);
  }
  return {
    schemaVersion: "pm-state-bench-treatment-uptake.v1",
    treatmentIdentityHash,
    retrievals,
    observationBoundary: {
      observationBoundaryId,
      agentExchangeId,
      observedAt,
      audit,
    },
  };
}

function expectedCellId(
  plan: RawEvidencePlan,
  identity: RawAttempt["identity"],
): string {
  return sha256(canonical({
    experimentId: plan.experimentId,
    domain: identity.domain,
    taskId: identity.taskId,
    repeatIndex: identity.repeatIndex,
    arm: identity.arm,
  }));
}

function expectedAttemptId(cellId: string, attemptOrdinal: number): string {
  return sha256(canonical({ cellId, attemptOrdinal }));
}

function parseAttempt(
  value: unknown,
  plan: RawEvidencePlan,
  closureHashes: ReadonlyMap<StateBenchArm, string>,
  path: string,
): RawAttempt {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "schemaVersion", "globalSequence", "cellId", "attemptId", "attemptOrdinal",
      "retryOfAttemptId", "executionCommand", "identity", "runtimeClosureHash", "startedAt", "endedAt",
      "latencyMs", "status", "terminal", "failure", "strictTaskSuccess", "officialScores",
      "roles", "treatmentUptake", "environment", "previousAttemptHash", "attemptHash",
    ],
    path,
  );
  if (input["schemaVersion"] !== "pm-state-bench-raw-attempt.v1") {
    throw new Error(`${path}.schemaVersion is unsupported`);
  }
  const commandInput = record(input["executionCommand"], `${path}.executionCommand`);
  exactKeys(commandInput, ["schemaVersion", "sequence", "cellId", "commandHash"], `${path}.executionCommand`);
  if (commandInput["schemaVersion"] !== "pm-state-bench-raw-command-binding.v1") {
    throw new Error(`${path}.executionCommand.schemaVersion is unsupported`);
  }
  const executionCommand = {
    schemaVersion: "pm-state-bench-raw-command-binding.v1" as const,
    sequence: integer(commandInput["sequence"], `${path}.executionCommand.sequence`, 1),
    cellId: safeId(commandInput["cellId"], `${path}.executionCommand.cellId`),
    commandHash: shaValue(commandInput["commandHash"], `${path}.executionCommand.commandHash`),
  };
  const identityInput = record(input["identity"], `${path}.identity`);
  exactKeys(identityInput, ["experimentId", "domain", "taskId", "repeatIndex", "arm"], `${path}.identity`);
  const identity = {
    experimentId: safeId(identityInput["experimentId"], `${path}.identity.experimentId`),
    domain: enumValue(identityInput["domain"], DOMAINS, `${path}.identity.domain`),
    taskId: safeId(identityInput["taskId"], `${path}.identity.taskId`),
    repeatIndex: integer(identityInput["repeatIndex"], `${path}.identity.repeatIndex`, 1),
    arm: enumValue(identityInput["arm"], ARMS, `${path}.identity.arm`),
  };
  if (identity.experimentId !== plan.experimentId) throw new Error(`${path} experiment identity drifted`);
  const cellId = shaValue(input["cellId"], `${path}.cellId`);
  if (cellId !== expectedCellId(plan, identity)) throw new Error(`${path}.cellId does not recompute`);
  const attemptOrdinal = integer(input["attemptOrdinal"], `${path}.attemptOrdinal`, 1);
  const attemptId = shaValue(input["attemptId"], `${path}.attemptId`);
  if (attemptId !== expectedAttemptId(cellId, attemptOrdinal)) {
    throw new Error(`${path}.attemptId does not recompute`);
  }
  const runtimeClosureHash = shaValue(input["runtimeClosureHash"], `${path}.runtimeClosureHash`);
  if (runtimeClosureHash !== closureHashes.get(identity.arm)) {
    throw new Error(`${path}.runtimeClosureHash does not match arm ${identity.arm}`);
  }
  const startedAt = timestamp(input["startedAt"], `${path}.startedAt`);
  const endedAt = timestamp(input["endedAt"], `${path}.endedAt`);
  const latencyMs = integer(input["latencyMs"], `${path}.latencyMs`);
  assertInterval(startedAt, endedAt, latencyMs, path);
  const status = enumValue(input["status"], ["succeeded", "failed"] as const, `${path}.status`);
  if (typeof input["terminal"] !== "boolean" || typeof input["strictTaskSuccess"] !== "boolean") {
    throw new Error(`${path} terminal and strictTaskSuccess must be booleans`);
  }
  const terminal = input["terminal"];
  const strictTaskSuccess = input["strictTaskSuccess"];
  const failureInput = input["failure"];
  const failure = failureInput === null ? null : (() => {
    const parsed = record(failureInput, `${path}.failure`);
    exactKeys(parsed, ["stage", "errorClass", "error"], `${path}.failure`);
    return {
      stage: parseFailureStage(parsed["stage"], `${path}.failure.stage`),
      errorClass: safeId(parsed["errorClass"], `${path}.failure.errorClass`),
      error: parseBytes(parsed["error"], `${path}.failure.error`),
    };
  })();

  const scoresInput = input["officialScores"];
  const officialScores = scoresInput === null ? null : (() => {
    const scores = record(scoresInput, `${path}.officialScores`);
    exactKeys(scores, ["stateRequirementsMet", "taskRequirementsMet", "taskCompletionPass"], `${path}.officialScores`);
    const binary = (entry: unknown, entryPath: string): 0 | 1 => {
      if (entry !== 0 && entry !== 1) throw new Error(`${entryPath} must be 0 or 1`);
      return entry;
    };
    const parsed = {
      stateRequirementsMet: binary(scores["stateRequirementsMet"], `${path}.officialScores.stateRequirementsMet`),
      taskRequirementsMet: binary(scores["taskRequirementsMet"], `${path}.officialScores.taskRequirementsMet`),
      taskCompletionPass: binary(scores["taskCompletionPass"], `${path}.officialScores.taskCompletionPass`),
    };
    if (parsed.taskCompletionPass !== Number(parsed.stateRequirementsMet === 1 && parsed.taskRequirementsMet === 1)) {
      throw new Error(`${path}.officialScores task completion is not the conjunction of component scores`);
    }
    return parsed;
  })();
  if (status === "failed") {
    if (failure === null || officialScores !== null || strictTaskSuccess) {
      throw new Error(`${path} failed attempts require failure evidence, no scores, and strict false`);
    }
  } else if (
    failure !== null ||
    officialScores === null ||
    strictTaskSuccess !== (officialScores.taskCompletionPass === 1)
  ) {
    throw new Error(`${path} succeeded attempt score/failure fields are inconsistent`);
  }
  if (!terminal && (status !== "failed" || strictTaskSuccess)) {
    throw new Error(`${path} non-terminal attempts must be retained failures`);
  }

  const rolesInput = record(input["roles"], `${path}.roles`);
  exactKeys(rolesInput, ROLES, `${path}.roles`);
  const roles = Object.fromEntries(ROLES.map((role) => [
    role,
    parseRoleCapture(
      rolesInput[role],
      role,
      plan.roleRuntimes[role],
      attemptId,
      plan.retryPolicy.providerMaxAttempts,
      `${path}.roles.${role}`,
    ),
  ])) as unknown as Readonly<Record<StateBenchRole, RoleCapture>>;
  if (roles.runner.disposition !== "invoked") throw new Error(`${path} runner role must be invoked`);
  if (status === "succeeded" && ROLES.some((role) => roles[role].disposition !== "invoked")) {
    throw new Error(`${path} succeeded attempt cannot omit a role invocation`);
  }
  if (failure !== null) {
    for (const role of ROLES) {
      const capture = roles[role];
      if (
        capture.disposition === "not_invoked_due_to_attempt_failure" &&
        capture.nonInvocation?.blockedByStage !== failure.stage
      ) {
        throw new Error(`${path}.roles.${role} non-invocation is not bound to the attempt failure`);
      }
    }
    if (ROLES.includes(failure.stage as StateBenchRole)) {
      const failedRole = roles[failure.stage as StateBenchRole];
      if (
        failedRole.disposition !== "invoked" ||
        !failedRole.exchanges.some((exchange) => exchange.terminal && exchange.outcome === "failed")
      ) {
        throw new Error(`${path} failure stage lacks a terminal failed retained exchange`);
      }
    }
  }
  const exchanges = ROLES.flatMap((role) => roles[role].exchanges).sort((left, right) => left.sequence - right.sequence);
  exactArray(exchanges.map((entry) => entry.sequence), exchanges.map((_, index) => index + 1), `${path} exchange sequences`);
  if (new Set(exchanges.map((entry) => entry.exchangeId)).size !== exchanges.length) {
    throw new Error(`${path} exchange IDs must be unique`);
  }
  if (new Set(exchanges.map((entry) => entry.providerRequestId)).size !== exchanges.length) {
    throw new Error(`${path} providerRequestId values must be unique across the attempt`);
  }
  if (status === "succeeded" && exchanges.some((exchange) => exchange.terminal && exchange.outcome === "failed")) {
    throw new Error(`${path} succeeded attempt retains a terminal failed provider exchange`);
  }

  const treatmentUptake = parseTreatmentUptake(
    input["treatmentUptake"],
    plan.armTreatments[identity.arm],
    identity.arm,
    attemptId,
    startedAt,
    endedAt,
    roles.agent.exchanges,
    `${path}.treatmentUptake`,
  );
  const environment = parseEnvironment(input["environment"], `${path}.environment`);
  const previousAttemptHash = input["previousAttemptHash"] === null
    ? null
    : shaValue(input["previousAttemptHash"], `${path}.previousAttemptHash`);
  const retryOfAttemptId = input["retryOfAttemptId"] === null
    ? null
    : shaValue(input["retryOfAttemptId"], `${path}.retryOfAttemptId`);
  const body = {
    schemaVersion: "pm-state-bench-raw-attempt.v1" as const,
    globalSequence: integer(input["globalSequence"], `${path}.globalSequence`, 1),
    cellId,
    attemptId,
    attemptOrdinal,
    retryOfAttemptId,
    executionCommand,
    identity,
    runtimeClosureHash,
    startedAt,
    endedAt,
    latencyMs,
    status,
    terminal,
    failure,
    strictTaskSuccess,
    officialScores,
    roles,
    treatmentUptake,
    environment,
    previousAttemptHash,
  };
  const attemptHash = shaValue(input["attemptHash"], `${path}.attemptHash`);
  if (attemptHash !== sha256(canonical(body))) throw new Error(`${path}.attemptHash does not recompute`);
  return { ...body, attemptHash };
}

function parseSummary(value: unknown): ReportedSummary {
  const input = record(value, "reportedSummary");
  const keys = [
    "plannedCellCount", "observedCellCount", "totalAttemptCount", "retryAttemptCount",
    "failedAttemptCount", "terminalCompletedCount", "terminalFailureCount",
    "strictSuccessCellCount", "strictFailureCellCount", "totalExchangeCount",
    "totalProviderLatencyMs", "totalCostUsdMicros", "captureLedgerFinalHash",
    "runtimeClosureCount",
  ] as const;
  exactKeys(input, keys, "reportedSummary");
  return {
    plannedCellCount: integer(input["plannedCellCount"], "reportedSummary.plannedCellCount"),
    observedCellCount: integer(input["observedCellCount"], "reportedSummary.observedCellCount"),
    totalAttemptCount: integer(input["totalAttemptCount"], "reportedSummary.totalAttemptCount"),
    retryAttemptCount: integer(input["retryAttemptCount"], "reportedSummary.retryAttemptCount"),
    failedAttemptCount: integer(input["failedAttemptCount"], "reportedSummary.failedAttemptCount"),
    terminalCompletedCount: integer(input["terminalCompletedCount"], "reportedSummary.terminalCompletedCount"),
    terminalFailureCount: integer(input["terminalFailureCount"], "reportedSummary.terminalFailureCount"),
    strictSuccessCellCount: integer(input["strictSuccessCellCount"], "reportedSummary.strictSuccessCellCount"),
    strictFailureCellCount: integer(input["strictFailureCellCount"], "reportedSummary.strictFailureCellCount"),
    totalExchangeCount: integer(input["totalExchangeCount"], "reportedSummary.totalExchangeCount"),
    totalProviderLatencyMs: integer(input["totalProviderLatencyMs"], "reportedSummary.totalProviderLatencyMs"),
    totalCostUsdMicros: integer(input["totalCostUsdMicros"], "reportedSummary.totalCostUsdMicros"),
    captureLedgerFinalHash: shaValue(input["captureLedgerFinalHash"], "reportedSummary.captureLedgerFinalHash"),
    runtimeClosureCount: integer(input["runtimeClosureCount"], "reportedSummary.runtimeClosureCount"),
  };
}

function plannedCellKeys(plan: RawEvidencePlan): readonly string[] {
  return plan.tasks.flatMap((taskSet) => taskSet.taskIds.flatMap((taskId) =>
    plan.repeatIndices.flatMap((repeatIndex) => plan.arms.map((arm) =>
      `${taskSet.domain}\0${taskId}\0${repeatIndex}\0${arm}`))));
}

function attemptCellKey(attempt: RawAttempt): string {
  const { domain, taskId, repeatIndex, arm } = attempt.identity;
  return `${domain}\0${taskId}\0${repeatIndex}\0${arm}`;
}

function recomputeSummary(
  plan: RawEvidencePlan,
  closures: readonly RuntimeClosure[],
  attempts: readonly RawAttempt[],
): ReportedSummary {
  const cells = new Set(attempts.map(attemptCellKey));
  const terminal = attempts.filter((attempt) => attempt.terminal);
  const exchanges = attempts.flatMap((attempt) => ROLES.flatMap((role) => attempt.roles[role].exchanges));
  return {
    plannedCellCount: plannedCellKeys(plan).length,
    observedCellCount: cells.size,
    totalAttemptCount: attempts.length,
    retryAttemptCount: attempts.filter((attempt) => attempt.attemptOrdinal > 1).length,
    failedAttemptCount: attempts.filter((attempt) => attempt.status === "failed").length,
    terminalCompletedCount: terminal.filter((attempt) => attempt.status === "succeeded").length,
    terminalFailureCount: terminal.filter((attempt) => attempt.status === "failed").length,
    strictSuccessCellCount: terminal.filter((attempt) => attempt.strictTaskSuccess).length,
    strictFailureCellCount: terminal.filter((attempt) => !attempt.strictTaskSuccess).length,
    totalExchangeCount: exchanges.length,
    totalProviderLatencyMs: exchanges.reduce((sum, exchange) => sum + exchange.latencyMs, 0),
    totalCostUsdMicros: exchanges.reduce((sum, exchange) => sum + exchange.cost.micros, 0),
    captureLedgerFinalHash: attempts.at(-1)?.attemptHash ?? "0".repeat(64),
    runtimeClosureCount: closures.length,
  };
}

function verifyAttemptTopology(plan: RawEvidencePlan, attempts: readonly RawAttempt[]): void {
  if (attempts.length === 0) throw new Error("attempts must be non-empty");
  exactArray(attempts.map((attempt) => attempt.globalSequence), attempts.map((_, index) => index + 1), "attempt global sequences");
  for (let index = 0; index < attempts.length; index += 1) {
    const expectedPrevious = index === 0 ? null : attempts[index - 1]!.attemptHash;
    if (attempts[index]!.previousAttemptHash !== expectedPrevious) {
      throw new Error(`attempts[${index}].previousAttemptHash breaks the capture ledger`);
    }
  }
  if (new Set(attempts.map((attempt) => attempt.attemptId)).size !== attempts.length) {
    throw new Error("attempt IDs must be globally unique");
  }
  const expectedCells = new Set(plannedCellKeys(plan));
  const observedCells = new Set(attempts.map(attemptCellKey));
  if (canonical([...observedCells].sort(lexical)) !== canonical([...expectedCells].sort(lexical))) {
    throw new Error("attempt inventory selectively replaced, duplicated, or dropped a planned cell");
  }
  for (const cell of expectedCells) {
    const chain = attempts.filter((attempt) => attemptCellKey(attempt) === cell);
    if (chain.length > plan.retryPolicy.maxTaskAttempts) {
      throw new Error(`cell ${cell} exceeds maxTaskAttempts`);
    }
    exactArray(chain.map((attempt) => attempt.attemptOrdinal), chain.map((_, index) => index + 1), `cell ${cell} attempt ordinals`);
    if (chain.filter((attempt) => attempt.terminal).length !== 1 || !chain.at(-1)?.terminal) {
      throw new Error(`cell ${cell} must end with exactly one terminal attempt`);
    }
    for (let index = 0; index < chain.length; index += 1) {
      const expectedRetry = index === 0 ? null : chain[index - 1]!.attemptId;
      if (chain[index]!.retryOfAttemptId !== expectedRetry) {
        throw new Error(`cell ${cell} retry chain is incomplete`);
      }
      if (index < chain.length - 1 && chain[index]!.terminal) {
        throw new Error(`cell ${cell} selectively retained an attempt after a terminal result`);
      }
    }
  }
}

function parseTrustEnvelope(value: unknown): ExternalTrustEnvelope {
  const input = record(value, "externalTrust");
  exactKeys(
    input,
    [
      "schemaVersion", "policyId", "policyHash", "verifierId", "verifierOwnerId",
      "producerOwnerId", "keyId", "verifierSourceRevision", "verifiedAt",
      "signedBundleHash", "algorithm", "signatureBase64",
    ],
    "externalTrust",
  );
  if (input["schemaVersion"] !== "pm-state-bench-external-trust-envelope.v1") {
    throw new Error("externalTrust.schemaVersion is unsupported");
  }
  if (input["algorithm"] !== "ed25519") throw new Error("externalTrust.algorithm must be ed25519");
  const signatureBase64 = requiredString(input["signatureBase64"], "externalTrust.signatureBase64");
  const signature = Buffer.from(signatureBase64, "base64");
  if (signature.length !== 64 || signature.toString("base64") !== signatureBase64) {
    throw new Error("externalTrust.signatureBase64 must be a canonical 64-byte Ed25519 signature");
  }
  const envelope = {
    schemaVersion: "pm-state-bench-external-trust-envelope.v1" as const,
    policyId: safeId(input["policyId"], "externalTrust.policyId"),
    policyHash: shaValue(input["policyHash"], "externalTrust.policyHash"),
    verifierId: safeId(input["verifierId"], "externalTrust.verifierId"),
    verifierOwnerId: safeId(input["verifierOwnerId"], "externalTrust.verifierOwnerId"),
    producerOwnerId: safeId(input["producerOwnerId"], "externalTrust.producerOwnerId"),
    keyId: safeId(input["keyId"], "externalTrust.keyId"),
    verifierSourceRevision: sourceRevision(input["verifierSourceRevision"], "externalTrust.verifierSourceRevision"),
    verifiedAt: timestamp(input["verifiedAt"], "externalTrust.verifiedAt"),
    signedBundleHash: shaValue(input["signedBundleHash"], "externalTrust.signedBundleHash"),
    algorithm: "ed25519" as const,
    signatureBase64,
  };
  if (envelope.verifierOwnerId === envelope.producerOwnerId) {
    throw new Error("externalTrust verifier and producer owners must differ");
  }
  return envelope;
}

function parseTrustPolicy(value: unknown): ExternalTrustPolicy {
  const input = record(value, "externalTrustPolicy");
  exactKeys(
    input,
    [
      "schemaVersion", "policyId", "verifierId", "verifierOwnerId", "producerOwnerId",
      "keyId", "verifierSourceRevision", "benchmarkRevision", "publicKeyPem", "policyHash",
    ],
    "externalTrustPolicy",
  );
  if (input["schemaVersion"] !== "pm-state-bench-external-trust-policy.v1") {
    throw new Error("externalTrustPolicy.schemaVersion is unsupported");
  }
  const body = {
    schemaVersion: "pm-state-bench-external-trust-policy.v1" as const,
    policyId: safeId(input["policyId"], "externalTrustPolicy.policyId"),
    verifierId: safeId(input["verifierId"], "externalTrustPolicy.verifierId"),
    verifierOwnerId: safeId(input["verifierOwnerId"], "externalTrustPolicy.verifierOwnerId"),
    producerOwnerId: safeId(input["producerOwnerId"], "externalTrustPolicy.producerOwnerId"),
    keyId: safeId(input["keyId"], "externalTrustPolicy.keyId"),
    verifierSourceRevision: sourceRevision(input["verifierSourceRevision"], "externalTrustPolicy.verifierSourceRevision"),
    benchmarkRevision: sourceRevision(input["benchmarkRevision"], "externalTrustPolicy.benchmarkRevision"),
    publicKeyPem: requiredString(input["publicKeyPem"], "externalTrustPolicy.publicKeyPem"),
  };
  if (body.verifierOwnerId === body.producerOwnerId) {
    throw new Error("externalTrustPolicy verifier and producer owners must differ");
  }
  const policyHash = shaValue(input["policyHash"], "externalTrustPolicy.policyHash");
  if (policyHash !== sha256(canonical(body))) throw new Error("externalTrustPolicy.policyHash does not recompute");
  const key = createPublicKey(body.publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("externalTrustPolicy public key must be Ed25519");
  return { ...body, policyHash };
}

function unsignedTrustEnvelope(envelope: ExternalTrustEnvelope): Omit<ExternalTrustEnvelope, "signatureBase64"> {
  const { signatureBase64: _signature, ...unsigned } = envelope;
  return unsigned;
}

function verifyExternalTrust(
  bundle: RawEvidenceBundle,
  policyValue: unknown,
  expectedPolicyHash: string | undefined,
): readonly string[] {
  const envelope = bundle.externalTrust;
  if (envelope === null) return ["no external trust envelope was supplied"];
  if (policyValue === undefined) {
    return ["external trust envelope is present but no independently supplied trust policy was provided"];
  }
  const policy = parseTrustPolicy(policyValue);
  if (expectedPolicyHash === undefined || expectedPolicyHash.length === 0) {
    return ["external trust policy is not pinned by an out-of-band expected hash"];
  }
  if (!SHA256.test(expectedPolicyHash) || expectedPolicyHash !== policy.policyHash) {
    throw new Error("external trust policy does not match the out-of-band expected hash");
  }
  const comparisons: readonly [unknown, unknown, string][] = [
    [envelope.policyId, policy.policyId, "policyId"],
    [envelope.policyHash, policy.policyHash, "policyHash"],
    [envelope.verifierId, policy.verifierId, "verifierId"],
    [envelope.verifierOwnerId, policy.verifierOwnerId, "verifierOwnerId"],
    [envelope.producerOwnerId, policy.producerOwnerId, "producerOwnerId"],
    [envelope.keyId, policy.keyId, "keyId"],
    [envelope.verifierSourceRevision, policy.verifierSourceRevision, "verifierSourceRevision"],
    [bundle.plan.benchmarkRevision, policy.benchmarkRevision, "benchmarkRevision"],
    [bundle.producer.producerOwnerId, policy.producerOwnerId, "bundle producerOwnerId"],
    [envelope.signedBundleHash, bundle.bundleHash, "signedBundleHash"],
  ];
  for (const [actual, expected, path] of comparisons) {
    if (actual !== expected) throw new Error(`external trust ${path} does not match the external policy/bundle`);
  }
  if (Date.parse(envelope.verifiedAt) < Date.parse(bundle.producer.capturedAt)) {
    throw new Error("external trust verification predates producer capture completion");
  }
  const key = createPublicKey(policy.publicKeyPem);
  const valid = verifySignature(
    null,
    Buffer.from(canonical(unsignedTrustEnvelope(envelope)), "utf8"),
    key,
    Buffer.from(envelope.signatureBase64, "base64"),
  );
  if (!valid) throw new Error("external trust signature is invalid");
  return [];
}

function parseBundle(value: unknown): RawEvidenceBundle {
  const input = record(value, "bundle");
  exactKeys(
    input,
    [
      "schemaVersion", "evidenceClass", "captureOrigin", "plan", "producer",
      "runtimeClosures", "attempts", "reportedSummary", "externalTrust", "bundleHash",
    ],
    "bundle",
  );
  if (
    input["schemaVersion"] !== "pm-state-bench-raw-evidence.v1" ||
    input["evidenceClass"] !== "state_bench_raw_execution_evidence" ||
    input["captureOrigin"] !== "producer_local"
  ) {
    throw new Error("bundle schema, evidence class, or capture origin is unsupported");
  }
  const plan = parsePlan(input["plan"]);
  const producerInput = record(input["producer"], "producer");
  exactKeys(
    producerInput,
    [
      "producerId", "producerOwnerId", "capturedAt", "captureImplementationRevision",
      "captureImplementationSha256", "hostRuntimeSha256",
    ],
    "producer",
  );
  const producer = {
    producerId: safeId(producerInput["producerId"], "producer.producerId"),
    producerOwnerId: safeId(producerInput["producerOwnerId"], "producer.producerOwnerId"),
    capturedAt: timestamp(producerInput["capturedAt"], "producer.capturedAt"),
    captureImplementationRevision: sourceRevision(
      producerInput["captureImplementationRevision"],
      "producer.captureImplementationRevision",
    ),
    captureImplementationSha256: shaValue(
      producerInput["captureImplementationSha256"],
      "producer.captureImplementationSha256",
    ),
    hostRuntimeSha256: shaValue(producerInput["hostRuntimeSha256"], "producer.hostRuntimeSha256"),
  };
  if (Date.parse(producer.capturedAt) < Date.parse(plan.declaredAt)) {
    throw new Error("producer capture predates the declared plan");
  }

  if (!Array.isArray(input["runtimeClosures"])) throw new Error("runtimeClosures must be an array");
  const runtimeClosures = input["runtimeClosures"].map((entry, index) =>
    parseRuntimeClosure(entry, plan, `runtimeClosures[${index}]`));
  exactArray(runtimeClosures.map((closure) => closure.arm), ARMS, "runtimeClosures arms");
  const closureHashes = new Map(runtimeClosures.map((closure) => [closure.arm, closure.closureHash]));

  if (!Array.isArray(input["attempts"])) throw new Error("attempts must be an array");
  const attempts = input["attempts"].map((entry, index) =>
    parseAttempt(entry, plan, closureHashes, `attempts[${index}]`));
  verifyAttemptTopology(plan, attempts);
  if (attempts.some((attempt) => Date.parse(attempt.startedAt) < Date.parse(plan.declaredAt))) {
    throw new Error("an attempt predates the declared plan");
  }
  if (attempts.some((attempt) => Date.parse(attempt.endedAt) > Date.parse(producer.capturedAt))) {
    throw new Error("producer capturedAt predates an attempt completion");
  }

  const reportedSummary = parseSummary(input["reportedSummary"]);
  const recomputed = recomputeSummary(plan, runtimeClosures, attempts);
  if (canonical(reportedSummary) !== canonical(recomputed)) {
    throw new Error("caller-authored reportedSummary does not recompute from raw attempts");
  }
  const externalTrust = input["externalTrust"] === null ? null : parseTrustEnvelope(input["externalTrust"]);
  if (externalTrust !== null && externalTrust.producerOwnerId !== producer.producerOwnerId) {
    throw new Error("externalTrust producer owner does not match the bundle producer");
  }
  const body = {
    schemaVersion: "pm-state-bench-raw-evidence.v1" as const,
    evidenceClass: "state_bench_raw_execution_evidence" as const,
    captureOrigin: "producer_local" as const,
    plan,
    producer,
    runtimeClosures,
    attempts,
    reportedSummary,
  };
  const bundleHash = shaValue(input["bundleHash"], "bundle.bundleHash");
  if (bundleHash !== sha256(canonical(body))) throw new Error("bundle.bundleHash does not recompute");
  if (externalTrust !== null && externalTrust.signedBundleHash !== bundleHash) {
    throw new Error("externalTrust does not sign this bundle hash");
  }
  return { ...body, externalTrust, bundleHash };
}

function parseExpectedCommandPlan(value: unknown) {
  const input = record(value, "executionCommandPlan");
  exactKeys(input, [
    "schemaVersion", "evidenceClass", "authorityStatus", "experimentId", "phase",
    "qualificationPlanHash", "decisionManifestHash", "preregistrationReceiptHash",
    "upstream", "optionContract", "outputRoot", "runConfigSetHash", "attemptScheduleHash",
    "commandCount", "commandRootHash", "commands", "unresolvedExecutionRequirements", "planHash",
  ], "executionCommandPlan");
  if (input["schemaVersion"] !== "pm-state-bench-execution-command-plan.v1" || input["evidenceClass"] !== "execution_command_plan_not_behavioral_evidence" || input["authorityStatus"] !== "raw_instrumented_execution_and_independent_attestation_required") {
    throw new Error("executionCommandPlan schema or evidence authority is unsupported");
  }
  const planHash = shaValue(input["planHash"], "executionCommandPlan.planHash");
  const { planHash: _planHash, ...planBody } = input;
  if (sha256(canonical(planBody)) !== planHash) {
    throw new Error("executionCommandPlan.planHash does not recompute");
  }
  const phase = enumValue(input["phase"], ["qualification", "confirmatory", "replication"] as const, "executionCommandPlan.phase");
  const upstream = record(input["upstream"], "executionCommandPlan.upstream");
  if (!Array.isArray(input["commands"]) || input["commands"].length === 0) {
    throw new Error("executionCommandPlan.commands must be non-empty");
  }
  const commands = input["commands"].map((entry, index) => {
    const command = record(entry, `executionCommandPlan.commands[${index}]`);
    exactKeys(command, [
      "schemaVersion", "sequence", "cellId", "phase", "arm", "domain", "taskId", "repeatIndex", "repeatLabel", "runIndex", "runId", "armOrderPosition", "expectedSplit", "runConfigHash", "armInterventionHash", "outputDirectory", "expectedTrajectoryPath", "environmentPolicy", "environment", "environmentHash", "executable", "argv", "argvHash", "commandHash",
    ], `executionCommandPlan.commands[${index}]`);
    if (command["schemaVersion"] !== "pm-state-bench-execution-command.v1") throw new Error(`executionCommandPlan.commands[${index}].schemaVersion is unsupported`);
    const commandHash = shaValue(command["commandHash"], `executionCommandPlan.commands[${index}].commandHash`);
    const { commandHash: _commandHash, ...commandBody } = command;
    if (sha256(canonical(commandBody)) !== commandHash) throw new Error(`executionCommandPlan.commands[${index}].commandHash does not recompute`);
    const runIndex = integer(command["runIndex"], `executionCommandPlan.commands[${index}].runIndex`, 1);
    const repeatIndex = integer(command["repeatIndex"], `executionCommandPlan.commands[${index}].repeatIndex`);
    if (runIndex !== repeatIndex + 1 || command["phase"] !== phase) throw new Error(`executionCommandPlan.commands[${index}] repeat or phase drifted`);
    const domain = enumValue(command["domain"], DOMAINS, `executionCommandPlan.commands[${index}].domain`);
    const arm = enumValue(command["arm"], ARMS, `executionCommandPlan.commands[${index}].arm`);
    const taskId = safeId(command["taskId"], `executionCommandPlan.commands[${index}].taskId`);
    return {
      sequence: integer(command["sequence"], `executionCommandPlan.commands[${index}].sequence`, 1),
      cellId: requiredString(command["cellId"], `executionCommandPlan.commands[${index}].cellId`),
      commandHash, domain, taskId, arm, runIndex,
      expectedSplit: enumValue(command["expectedSplit"], ["train", "test"] as const, `executionCommandPlan.commands[${index}].expectedSplit`),
      coordinate: `${domain}\0${taskId}\0${runIndex}\0${arm}`,
    };
  });
  exactArray(commands.map((entry) => entry.sequence), commands.map((_, index) => index + 1), "executionCommandPlan command sequences");
  if (new Set(commands.map((entry) => entry.coordinate)).size !== commands.length || new Set(commands.map((entry) => entry.cellId)).size !== commands.length) throw new Error("executionCommandPlan commands must have unique coordinates and cell IDs");
  const commandRootHash = shaValue(input["commandRootHash"], "executionCommandPlan.commandRootHash");
  if (commandRootHash !== sha256(commands.map((entry) => `${entry.sequence}\0${entry.commandHash}\n`).join(""))) throw new Error("executionCommandPlan.commandRootHash does not recompute");
  if (integer(input["commandCount"], "executionCommandPlan.commandCount", 1) !== commands.length) throw new Error("executionCommandPlan.commandCount does not match commands");
  return {
    planHash, commandRootHash, commands, phase,
    experimentId: safeId(input["experimentId"], "executionCommandPlan.experimentId"),
    benchmarkRevision: sourceRevision(upstream["revision"], "executionCommandPlan.upstream.revision"),
    runConfigSetHash: shaValue(input["runConfigSetHash"], "executionCommandPlan.runConfigSetHash"),
    attemptScheduleHash: shaValue(input["attemptScheduleHash"], "executionCommandPlan.attemptScheduleHash"),
  };
}

function verifyCommandPlanAuthority(bundle: RawEvidenceBundle, value: unknown, expectedHash?: string): readonly string[] {
  const issues: string[] = [];
  if (value === undefined) issues.push("no independently supplied execution command plan was provided");
  if (expectedHash === undefined || expectedHash.length === 0) issues.push("execution command plan is not pinned by an out-of-band expected hash");
  if (value === undefined) return issues;
  try {
    const expected = parseExpectedCommandPlan(value);
    if (expectedHash !== undefined && (!SHA256.test(expectedHash) || expectedHash !== expected.planHash)) issues.push("execution command plan does not match the out-of-band expected hash");
    const binding = bundle.plan.executionCommandPlan;
    for (const [actual, wanted, field] of [
      [binding.planHash, expected.planHash, "planHash"], [binding.commandRootHash, expected.commandRootHash, "commandRootHash"],
      [binding.runConfigSetHash, expected.runConfigSetHash, "runConfigSetHash"], [binding.attemptScheduleHash, expected.attemptScheduleHash, "attemptScheduleHash"],
      [binding.commandCount, expected.commands.length, "commandCount"],
    ] as const) if (actual !== wanted) issues.push(`raw evidence command-plan ${field} does not match the independently supplied plan`);
    if (expected.experimentId !== bundle.plan.experimentId || expected.phase !== bundle.plan.phase || expected.benchmarkRevision !== bundle.plan.benchmarkRevision) issues.push("raw evidence experiment, phase, or benchmark revision does not match the execution command plan");
    const wantedCells = [...plannedCellKeys(bundle.plan)].sort(lexical);
    const commandCells = expected.commands.map((entry) => entry.coordinate).sort(lexical);
    if (canonical(wantedCells) !== canonical(commandCells) || expected.commands.some((entry) => entry.expectedSplit !== bundle.plan.split)) issues.push("raw evidence task/repeat/arm cell inventory or split does not match the execution command plan");
    const byCell = new Map(expected.commands.map((entry) => [entry.coordinate, entry]));
    for (const attempt of bundle.attempts) {
      const command = byCell.get(attemptCellKey(attempt));
      if (command === undefined || command.sequence !== attempt.executionCommand.sequence || command.cellId !== attempt.executionCommand.cellId || command.commandHash !== attempt.executionCommand.commandHash) {
        issues.push(`raw attempt ${attempt.attemptId} does not bind its exact planned command hash and coordinate`);
      }
    }
  } catch (error) {
    issues.push(`independently supplied execution command plan did not verify: ${error instanceof Error ? error.message : String(error)}`);
  }
  return issues;
}

function verifyBundle(
  value: unknown,
  externalTrustPolicy?: unknown,
  expectedPolicyHash?: string,
  executionCommandPlan?: unknown,
  expectedCommandPlanHash?: string,
): StateBenchRawEvidenceVerification {
  try {
    const bundle = parseBundle(value);
    const authorityIssues = [
      ...verifyExternalTrust(bundle, externalTrustPolicy, expectedPolicyHash),
      ...verifyCommandPlanAuthority(bundle, executionCommandPlan, expectedCommandPlanHash),
    ];
    return {
      valid: true,
      issues: [],
      authorityStatus: authorityIssues.length === 0
        ? "independently_authenticated_raw_evidence"
        : "producer_local_capture_ineligible",
      authorityIssues,
      publicEvalAttemptEligible: false,
      recomputedSummary: recomputeSummary(bundle.plan, bundle.runtimeClosures, bundle.attempts),
    };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : String(error)],
      authorityStatus: "producer_local_capture_ineligible",
      authorityIssues: ["raw evidence or external authentication did not verify"],
      publicEvalAttemptEligible: false,
      recomputedSummary: null,
    };
  }
}

/**
 * Runtime contract for exact STATE-Bench capture. It deliberately has no
 * PublicEvalAttempt conversion: authenticated bytes are evidence, not efficacy.
 */
export const stateBenchRawEvidence = Object.freeze({
  parse: parseBundle,
  verify: verifyBundle,
});

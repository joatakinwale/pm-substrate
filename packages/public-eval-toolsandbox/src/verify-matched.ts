import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

import {
  toolSandboxVerticalSlice,
  type ToolSandboxArm,
  type ToolSandboxEvaluationTrack,
  type ToolSandboxFaultEvidence,
} from "./index.js";
import { verifyRawMatchedBatch } from "./raw-matched-verifier.js";

export { verifyRawMatchedBatch };
export type { ToolSandboxRawVerifierDependencies } from "./raw-matched-verifier.js";

const SHA256 = /^[a-f0-9]{64}$/u;
const ARMS = ["native", "sham", "substrate"] as const;
const VERIFIER_ID =
  "@pm/public-eval-toolsandbox:raw-matched-batch-verifier";
const VERIFIER_REVISION = "v2";
const V3_VERIFIER_REVISION = "v3" as const;
const CURRENT_SUBSTRATE_TREATMENT =
  "direct_agent_state_core_peripheral_adapter" as const;
const CURRENT_INVOCATION_PATH =
  "toolsandbox_python_runner_to_package_cli" as const;
const CURRENT_RESTART_SEMANTICS =
  "provider_role_reinstantiation_in_same_python_process" as const;
const V3_SUBSTRATE_TREATMENT =
  "authenticated_http_agent_state_core_peripheral_sidecar" as const;
const V3_INVOCATION_PATH =
  "toolsandbox_python_http_client_to_separate_node_sidecar" as const;
const V3_RESTART_SEMANTICS =
  "provider_agent_os_process_group_sigkill_wait_then_fresh_process" as const;
const PUBLIC_EVAL_MISSING_EVIDENCE = [
  "provider_raw_request_bytes",
  "provider_raw_response_bytes",
  "provider_request_ids",
  "provider_usage_tokens",
  "provider_cost_usd",
  "provider_latency_ms",
  "exact_benchmark_task_bytes",
  "exact_benchmark_oracle_bytes",
  "upstream_oracle_recomputation_from_raw_trajectory",
  "verified_real_http_or_mcp_sidecar_protocol_receipt",
  "independent_verifier_signature_and_external_trust_anchor",
] as const;

export interface ToolSandboxRawMatchedBatchVerificationInput {
  readonly batchPath: string;
  readonly outputRoot: string;
  readonly checkoutPath: string;
  /** Verifier-selected pinned ToolSandbox Python runtime; required for v3. */
  readonly oraclePythonExecutable?: string;
}

export interface ToolSandboxRawMatchedBatchVerificationV2 {
  readonly schemaVersion: "pm.public-eval.toolsandbox-raw-verification.v2";
  readonly verifier: {
    readonly id: typeof VERIFIER_ID;
    readonly revision: typeof VERIFIER_REVISION;
    readonly mode: "independent_recomputation_from_raw_artifacts";
  };
  readonly claimBoundary: {
    readonly artifactIntegrityAndConformanceOnly: true;
    readonly independentSigner: false;
    readonly efficacyFinding: false;
    readonly statement: string;
  };
  readonly executionBoundary: {
    readonly substrateTreatment: typeof CURRENT_SUBSTRATE_TREATMENT;
    readonly invocationPath: typeof CURRENT_INVOCATION_PATH;
    readonly realHttpMcpSidecarProtocolExercised: false;
    readonly verifiedRealSidecarProtocolReceipt: false;
    readonly restartSemantics: typeof CURRENT_RESTART_SEMANTICS;
  };
  readonly manifestHash: string;
  readonly batchId: string;
  readonly batchHash: string;
  readonly batchFileSha256: string;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly checkout: {
    readonly revision: string;
    readonly corpusHash: string;
    readonly fileCount: number;
    readonly clean: true;
  };
  readonly inventory: {
    readonly fileCount: number;
    readonly rawArtifactCount: number;
    readonly rootHash: string;
  };
  readonly attempts: readonly {
    readonly order: number;
    readonly arm: ToolSandboxArm;
    readonly attemptId: string;
    readonly rawArtifactRootHash: string;
    readonly receiptHash: string;
    readonly resultSummaryHash: string;
    /** Value reported by result_summary.json; not independently recomputed. */
    readonly reportedOracleScore: number;
    /** Value reconstructed from result_summary.json; not behavioral proof. */
    readonly reportedStrictTaskSuccess: boolean;
    readonly faultStatus: "not_scheduled" | ToolSandboxFaultEvidence["status"];
    readonly boundaryTraceEntryCount: number;
    readonly trajectoryStructureVerified: true;
    readonly upstreamOracleRecomputedFromRawTrajectory: false;
  }[];
  readonly verificationHash: string;
}

export interface ToolSandboxRawMatchedBatchVerificationV3 {
  readonly schemaVersion: "pm.public-eval.toolsandbox-raw-verification.v3";
  readonly verifier: {
    readonly id: typeof VERIFIER_ID;
    readonly revision: "v3";
    readonly mode: "independent_recomputation_from_raw_artifacts";
  };
  readonly claimBoundary: {
    readonly artifactIntegrityAndConformanceOnly: true;
    readonly independentSigner: false;
    readonly efficacyFinding: false;
    readonly statement: string;
  };
  readonly executionBoundary: {
    readonly substrateTreatment: typeof V3_SUBSTRATE_TREATMENT;
    readonly invocationPath: typeof V3_INVOCATION_PATH;
    readonly realHttpMcpSidecarProtocolExercised: boolean;
    readonly verifiedRealSidecarProtocolReceipt: true;
    readonly providerRoleOutOfProcessEveryArm: true;
    readonly actualOsProcessRestartObserved: boolean;
    readonly restartSemantics: typeof V3_RESTART_SEMANTICS;
  };
  readonly manifestHash: string;
  readonly batchId: string;
  readonly batchHash: string;
  readonly batchFileSha256: string;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly scriptedStdin: readonly string[];
  readonly checkout: ToolSandboxRawMatchedBatchVerificationV2["checkout"];
  readonly inventory: ToolSandboxRawMatchedBatchVerificationV2["inventory"];
  readonly attempts: readonly {
    readonly order: number;
    readonly arm: ToolSandboxArm;
    readonly attemptId: string;
    readonly rawArtifactRootHash: string;
    readonly receiptHash: string;
    readonly resultSummaryHash: string;
    readonly reportedOracleScore: number;
    readonly reportedStrictTaskSuccess: boolean;
    readonly recomputedOracleScore: number;
    readonly recomputedStrictTaskSuccess: boolean;
    readonly oracleReplayVerificationHash: string;
    readonly oracleRuntimeExecutablePath: string;
    readonly oracleRuntimeExecutableSha256: string;
    readonly oracleRuntimeEnvironmentSanitized: true;
    readonly oracleRuntimeExternallyAttested: false;
    readonly faultStatus: "not_scheduled" | ToolSandboxFaultEvidence["status"];
    readonly boundaryTraceEntryCount: number;
    readonly sidecarProtocolRequestCount: number;
    readonly sidecarEvidenceVerified: boolean;
    readonly realSidecarProtocolExercised: boolean;
    readonly providerProcessTraceEntryCount: number;
    readonly providerProcessInstanceCount: number;
    readonly providerAgent: string;
    readonly actualOsProcessRestartVerified: boolean;
    readonly providerFramesBoundToRetainedTrajectory: true;
    readonly sidecarExchangesBoundToRetainedTrajectory: true | "not_applicable";
    readonly postRestartSuccessorResumptionBoundToTrajectory:
      | true
      | "not_applicable";
    readonly trajectoryCrossVerificationHash: string;
    readonly startingContextNormalizedSha256: string;
    readonly startingContextNormalizationPolicyId: "pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1";
    readonly startingContextVolatileTimestampCount: 11;
    readonly startingContextBoundExceptDocumentedVolatileTimestamps: true;
    readonly successfulSendCount: number;
    readonly messagingDeltaCount: number;
    readonly postRestartExactRetryCount: number;
    readonly postRestartRetryDisposition:
      | "not_applicable"
      | "not_observed"
      | "blocked"
      | "executed_succeeded"
      | "executed_failed"
      | "mixed";
    readonly postRestartRetryAllowedCount: number;
    readonly postRestartRetryBlockedCount: number;
    readonly postRestartRetryExecutedCount: number;
    readonly postRestartRetrySuccessfulSendCount: number;
    readonly postRestartRetryDuplicateResponseBlockCount: number;
    readonly duplicateTargetSideEffectCount: number;
    readonly sidecarRuntimeModuleClosureHash: string | null;
    readonly trajectoryStructureVerified: true;
    readonly upstreamOracleRecomputedFromRawTrajectory: true;
  }[];
  readonly verificationHash: string;
}

export type ToolSandboxRawMatchedBatchVerification =
  | ToolSandboxRawMatchedBatchVerificationV2
  | ToolSandboxRawMatchedBatchVerificationV3;

export type ToolSandboxPublicEvalMissingEvidence =
  | (typeof PUBLIC_EVAL_MISSING_EVIDENCE)[number]
  | "actual_os_process_restart_exercised"
  | "real_http_or_mcp_sidecar_protocol_exercised"
  | "trusted_oracle_replay_runtime_and_environment"
  | "provider_frames_bound_to_retained_trajectory"
  | "sidecar_exchanges_bound_to_retained_trajectory"
  | "post_restart_successor_resumption_bound_to_trajectory"
  | "pinned_sidecar_runtime_module_closure"
  | "non_scripted_public_agent_execution";

export interface ToolSandboxPublicEvalAttemptEligibilityV2 {
  readonly schemaVersion: "pm.public-eval.toolsandbox-attempt-eligibility.v1";
  readonly source: {
    readonly rawVerificationSchema: "pm.public-eval.toolsandbox-raw-verification.v2";
    readonly rawVerificationHash: string;
    readonly verifierV2TrajectoryStructureContentResolved: true;
    readonly rawArtifactRootHash: string;
  };
  readonly executionBoundary: {
    readonly substrateTreatment: typeof CURRENT_SUBSTRATE_TREATMENT;
    readonly invocationPath: typeof CURRENT_INVOCATION_PATH;
    readonly realHttpMcpSidecarProtocolExercised: false;
    readonly verifiedRealSidecarProtocolReceipt: false;
    readonly restartSemantics: typeof CURRENT_RESTART_SEMANTICS;
  };
  readonly publicEvalAttemptArtifactEligible: false;
  readonly missingContentResolvedEvidence: readonly ToolSandboxPublicEvalMissingEvidence[];
  readonly statement: string;
  readonly eligibilityHash: string;
}

export interface ToolSandboxPublicEvalAttemptEligibilityV3 {
  readonly schemaVersion: "pm.public-eval.toolsandbox-attempt-eligibility.v2";
  readonly source: {
    readonly rawVerificationSchema: "pm.public-eval.toolsandbox-raw-verification.v3";
    readonly rawVerificationHash: string;
    readonly freshRawReplayPerformed: true;
    readonly verifierV3OracleReplayStructurallyReproduced: true;
    readonly verifierV3SidecarLifecycleReceiptReplayed: true;
    readonly verifierV3ProviderProcessTraceReplayed: true;
    readonly verifierV3TrajectoryCrossBoundaryReplayPerformed: true;
    readonly verifierV3RuntimeModuleClosureReplayed: true;
    readonly rawArtifactRootHash: string;
  };
  readonly executionBoundary: ToolSandboxRawMatchedBatchVerificationV3["executionBoundary"];
  readonly publicEvalAttemptArtifactEligible: false;
  readonly missingContentResolvedEvidence: readonly ToolSandboxPublicEvalMissingEvidence[];
  readonly statement: string;
  readonly eligibilityHash: string;
}

export type ToolSandboxPublicEvalAttemptEligibility =
  | ToolSandboxPublicEvalAttemptEligibilityV2
  | ToolSandboxPublicEvalAttemptEligibilityV3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function nonempty(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function sha(value: unknown, path: string): string {
  const parsed = nonempty(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be a lowercase SHA-256`);
  return parsed;
}

function integer(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${path} must be a non-negative safe integer`);
  }
  return value as number;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be boolean`);
  return value;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalStringify(actual) !== canonicalStringify(wanted)) {
    throw new Error(`${path} has missing or unexpected fields`);
  }
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot hash non-finite JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStringify(entry)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot hash unsupported JSON value ${typeof value}`);
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function absolutePath(value: unknown, path: string): string {
  const parsed = nonempty(value, path);
  if (!isAbsolute(parsed)) throw new Error(`${path} must be absolute`);
  return resolve(parsed);
}

function parseTrack(value: unknown, path: string): ToolSandboxEvaluationTrack {
  if (value !== "official_headline" && value !== "restart_lost_response_derivative") {
    throw new Error(`${path} is not a supported evaluation track`);
  }
  return value;
}

function parseArm(value: unknown, path: string): ToolSandboxArm {
  if (value !== "native" && value !== "sham" && value !== "substrate") {
    throw new Error(`${path} is not a ToolSandbox arm`);
  }
  return value;
}

function assertCurrentRawVerificationForPublicEvalBridge(
  value: unknown,
): ToolSandboxRawMatchedBatchVerificationV2 {
  const root = record(value, "/rawVerification");
  exactKeys(
    root,
    [
      "schemaVersion",
      "verifier",
      "claimBoundary",
      "executionBoundary",
      "manifestHash",
      "batchId",
      "batchHash",
      "batchFileSha256",
      "evaluationTrack",
      "checkout",
      "inventory",
      "attempts",
      "verificationHash",
    ],
    "/rawVerification",
  );
  if (root["schemaVersion"] !== "pm.public-eval.toolsandbox-raw-verification.v2") {
    throw new Error(
      "PublicEvalAttemptArtifact bridge requires raw-verification.v2 replay",
    );
  }
  const verifier = record(root["verifier"], "/rawVerification/verifier");
  exactKeys(
    verifier,
    ["id", "revision", "mode"],
    "/rawVerification/verifier",
  );
  if (
    verifier["id"] !== VERIFIER_ID ||
    verifier["revision"] !== VERIFIER_REVISION ||
    verifier["mode"] !== "independent_recomputation_from_raw_artifacts"
  ) {
    throw new Error("PublicEvalAttemptArtifact bridge requires verifier-v2 replay");
  }
  const boundary = record(
    root["executionBoundary"],
    "/rawVerification/executionBoundary",
  );
  exactKeys(
    boundary,
    [
      "substrateTreatment",
      "invocationPath",
      "realHttpMcpSidecarProtocolExercised",
      "verifiedRealSidecarProtocolReceipt",
      "restartSemantics",
    ],
    "/rawVerification/executionBoundary",
  );
  if (
    boundary["substrateTreatment"] !== CURRENT_SUBSTRATE_TREATMENT ||
    boundary["invocationPath"] !== CURRENT_INVOCATION_PATH ||
    boundary["realHttpMcpSidecarProtocolExercised"] !== false ||
    boundary["verifiedRealSidecarProtocolReceipt"] !== false ||
    boundary["restartSemantics"] !== CURRENT_RESTART_SEMANTICS
  ) {
    throw new Error(
      "current ToolSandbox treatment is the direct core peripheral adapter, not a verified real sidecar protocol run",
    );
  }
  const claimBoundary = record(
    root["claimBoundary"],
    "/rawVerification/claimBoundary",
  );
  exactKeys(
    claimBoundary,
    [
      "artifactIntegrityAndConformanceOnly",
      "independentSigner",
      "efficacyFinding",
      "statement",
    ],
    "/rawVerification/claimBoundary",
  );
  if (
    claimBoundary["artifactIntegrityAndConformanceOnly"] !== true ||
    claimBoundary["independentSigner"] !== false ||
    claimBoundary["efficacyFinding"] !== false
  ) {
    throw new Error(
      "raw verification claim boundary cannot be promoted to efficacy evidence",
    );
  }
  const attempts = root["attempts"];
  if (!Array.isArray(attempts) || attempts.length !== ARMS.length) {
    throw new Error("raw verification must contain one replayed attempt per arm");
  }
  const replayedArms = new Set<ToolSandboxArm>();
  for (const [index, valueAttempt] of attempts.entries()) {
    const attempt = record(
      valueAttempt,
      `/rawVerification/attempts/${index}`,
    );
    exactKeys(
      attempt,
      [
        "order",
        "arm",
        "attemptId",
        "rawArtifactRootHash",
        "receiptHash",
        "resultSummaryHash",
        "reportedOracleScore",
        "reportedStrictTaskSuccess",
        "faultStatus",
        "boundaryTraceEntryCount",
        "trajectoryStructureVerified",
        "upstreamOracleRecomputedFromRawTrajectory",
      ],
      `/rawVerification/attempts/${index}`,
    );
    const arm = attempt["arm"];
    if (!ARMS.includes(arm as ToolSandboxArm)) {
      throw new Error(`/rawVerification/attempts/${index}/arm is invalid`);
    }
    if (attempt["trajectoryStructureVerified"] !== true) {
      throw new Error(
        `/rawVerification/attempts/${index} lacks verifier-v2 trajectory-structure replay`,
      );
    }
    if (attempt["upstreamOracleRecomputedFromRawTrajectory"] !== false) {
      throw new Error(
        `/rawVerification/attempts/${index} cannot claim upstream oracle replay`,
      );
    }
    replayedArms.add(arm as ToolSandboxArm);
  }
  if (replayedArms.size !== ARMS.length) {
    throw new Error("raw verification does not replay native, sham, and substrate");
  }
  const inventory = record(root["inventory"], "/rawVerification/inventory");
  exactKeys(
    inventory,
    ["fileCount", "rawArtifactCount", "rootHash"],
    "/rawVerification/inventory",
  );
  sha(inventory["rootHash"], "/rawVerification/inventory/rootHash");
  const verificationHash = sha(
    root["verificationHash"],
    "/rawVerification/verificationHash",
  );
  const { verificationHash: _ignored, ...body } = root;
  if (verificationHash !== sha256Json(body)) {
    throw new Error("raw verification hash does not recompute");
  }
  return value as ToolSandboxRawMatchedBatchVerificationV2;
}

function assertV3RawVerificationForPublicEvalBridge(
  value: unknown,
): ToolSandboxRawMatchedBatchVerificationV3 {
  const root = record(value, "/rawVerification");
  exactKeys(
    root,
    [
      "schemaVersion",
      "verifier",
      "claimBoundary",
      "executionBoundary",
      "manifestHash",
      "batchId",
      "batchHash",
      "batchFileSha256",
      "evaluationTrack",
      "scriptedStdin",
      "checkout",
      "inventory",
      "attempts",
      "verificationHash",
    ],
    "/rawVerification",
  );
  if (
    root["schemaVersion"] !==
    "pm.public-eval.toolsandbox-raw-verification.v3"
  ) {
    throw new Error("PublicEvalAttemptArtifact bridge requires raw-verification.v3 replay");
  }
  const verifier = record(root["verifier"], "/rawVerification/verifier");
  exactKeys(verifier, ["id", "revision", "mode"], "/rawVerification/verifier");
  if (
    verifier["id"] !== VERIFIER_ID ||
    verifier["revision"] !== V3_VERIFIER_REVISION ||
    verifier["mode"] !== "independent_recomputation_from_raw_artifacts"
  ) {
    throw new Error("PublicEvalAttemptArtifact bridge requires verifier-v3 replay");
  }
  const claim = record(root["claimBoundary"], "/rawVerification/claimBoundary");
  exactKeys(
    claim,
    [
      "artifactIntegrityAndConformanceOnly",
      "independentSigner",
      "efficacyFinding",
      "statement",
    ],
    "/rawVerification/claimBoundary",
  );
  if (
    claim["artifactIntegrityAndConformanceOnly"] !== true ||
    claim["independentSigner"] !== false ||
    claim["efficacyFinding"] !== false
  ) {
    throw new Error("raw verification claim boundary cannot be promoted to efficacy evidence");
  }
  nonempty(claim["statement"], "/rawVerification/claimBoundary/statement");
  if (root["manifestHash"] !== toolSandboxVerticalSlice.manifest.manifestHash) {
    throw new Error("raw verification manifest is not current");
  }
  const verificationBatchId = nonempty(
    root["batchId"],
    "/rawVerification/batchId",
  );
  sha(root["batchHash"], "/rawVerification/batchHash");
  sha(root["batchFileSha256"], "/rawVerification/batchFileSha256");
  const evaluationTrack = parseTrack(
    root["evaluationTrack"],
    "/rawVerification/evaluationTrack",
  );
  if (
    !Array.isArray(root["scriptedStdin"]) ||
    root["scriptedStdin"].length > 64 ||
    root["scriptedStdin"].some(
      (line) =>
        typeof line !== "string" ||
        line.length > 4096 ||
        /[\r\n\0]/u.test(line),
    )
  ) {
    throw new Error("raw verification scripted stdin is invalid");
  }
  const attempts = root["attempts"];
  if (!Array.isArray(attempts) || attempts.length !== ARMS.length) {
    throw new Error("raw verification must contain one replayed attempt per arm");
  }
  const replayedArms = new Set<ToolSandboxArm>();
  const parsedAttempts = attempts.map((attemptValue, index) => {
    const path = `/rawVerification/attempts/${index}`;
    const attempt = record(attemptValue, path);
    exactKeys(
      attempt,
      [
        "order",
        "arm",
        "attemptId",
        "rawArtifactRootHash",
        "receiptHash",
        "resultSummaryHash",
        "reportedOracleScore",
        "reportedStrictTaskSuccess",
        "recomputedOracleScore",
        "recomputedStrictTaskSuccess",
        "oracleReplayVerificationHash",
        "oracleRuntimeExecutablePath",
        "oracleRuntimeExecutableSha256",
        "oracleRuntimeEnvironmentSanitized",
        "oracleRuntimeExternallyAttested",
        "faultStatus",
        "boundaryTraceEntryCount",
        "sidecarProtocolRequestCount",
        "sidecarEvidenceVerified",
        "realSidecarProtocolExercised",
        "providerProcessTraceEntryCount",
        "providerProcessInstanceCount",
        "providerAgent",
        "actualOsProcessRestartVerified",
        "providerFramesBoundToRetainedTrajectory",
        "sidecarExchangesBoundToRetainedTrajectory",
        "postRestartSuccessorResumptionBoundToTrajectory",
        "trajectoryCrossVerificationHash",
        "startingContextNormalizedSha256",
        "startingContextNormalizationPolicyId",
        "startingContextVolatileTimestampCount",
        "startingContextBoundExceptDocumentedVolatileTimestamps",
        "successfulSendCount",
        "messagingDeltaCount",
        "postRestartExactRetryCount",
        "postRestartRetryDisposition",
        "postRestartRetryAllowedCount",
        "postRestartRetryBlockedCount",
        "postRestartRetryExecutedCount",
        "postRestartRetrySuccessfulSendCount",
        "postRestartRetryDuplicateResponseBlockCount",
        "duplicateTargetSideEffectCount",
        "sidecarRuntimeModuleClosureHash",
        "trajectoryStructureVerified",
        "upstreamOracleRecomputedFromRawTrajectory",
      ],
      path,
    );
    if (integer(attempt["order"], `${path}/order`) !== index + 1) {
      throw new Error(`${path}/order is not contiguous`);
    }
    const arm = parseArm(attempt["arm"], `${path}/arm`);
    if (replayedArms.has(arm)) throw new Error("raw verification repeats an arm");
    replayedArms.add(arm);
    if (
      nonempty(attempt["attemptId"], `${path}/attemptId`) !==
      `${verificationBatchId}-${arm}-001`
    ) {
      throw new Error(`${path}/attemptId does not bind batch and arm`);
    }
    for (const field of [
      "rawArtifactRootHash",
      "receiptHash",
      "resultSummaryHash",
      "oracleReplayVerificationHash",
    ] as const) {
      sha(attempt[field], `${path}/${field}`);
    }
    const oracleRuntimePath = absolutePath(
      attempt["oracleRuntimeExecutablePath"],
      `${path}/oracleRuntimeExecutablePath`,
    );
    const oracleRuntimeSha256 = sha(
      attempt["oracleRuntimeExecutableSha256"],
      `${path}/oracleRuntimeExecutableSha256`,
    );
    if (
      attempt["oracleRuntimeEnvironmentSanitized"] !== true ||
      attempt["oracleRuntimeExternallyAttested"] !== false
    ) {
      throw new Error(`${path} overstates oracle-runtime trust`);
    }
    const reportedScore = attempt["reportedOracleScore"];
    const recomputedScore = attempt["recomputedOracleScore"];
    if (
      typeof reportedScore !== "number" ||
      !Number.isFinite(reportedScore) ||
      reportedScore < 0 ||
      reportedScore > 1 ||
      reportedScore !== recomputedScore ||
      boolean(attempt["reportedStrictTaskSuccess"], `${path}/reportedStrictTaskSuccess`) !==
        boolean(attempt["recomputedStrictTaskSuccess"], `${path}/recomputedStrictTaskSuccess`)
    ) {
      throw new Error(`${path} oracle replay result does not match the reported result`);
    }
    const faultStatus = attempt["faultStatus"];
    if (
      faultStatus !== "not_scheduled" &&
      faultStatus !== "trigger_not_reached" &&
      faultStatus !== "applied"
    ) {
      throw new Error(`${path}/faultStatus is invalid`);
    }
    integer(attempt["boundaryTraceEntryCount"], `${path}/boundaryTraceEntryCount`);
    const requestCount = integer(
      attempt["sidecarProtocolRequestCount"],
      `${path}/sidecarProtocolRequestCount`,
    );
    const sidecarEvidenceVerified = boolean(
      attempt["sidecarEvidenceVerified"],
      `${path}/sidecarEvidenceVerified`,
    );
    const sidecarExercised = boolean(
      attempt["realSidecarProtocolExercised"],
      `${path}/realSidecarProtocolExercised`,
    );
    const processTraceCount = integer(
      attempt["providerProcessTraceEntryCount"],
      `${path}/providerProcessTraceEntryCount`,
    );
    const processInstances = integer(
      attempt["providerProcessInstanceCount"],
      `${path}/providerProcessInstanceCount`,
    );
    const providerAgent = nonempty(
      attempt["providerAgent"],
      `${path}/providerAgent`,
    );
    const restarted = boolean(
      attempt["actualOsProcessRestartVerified"],
      `${path}/actualOsProcessRestartVerified`,
    );
    if (attempt["providerFramesBoundToRetainedTrajectory"] !== true) {
      throw new Error(`${path} does not bind provider frames to the trajectory`);
    }
    const sidecarBound = attempt["sidecarExchangesBoundToRetainedTrajectory"];
    const successorBound =
      attempt["postRestartSuccessorResumptionBoundToTrajectory"];
    sha(
      attempt["trajectoryCrossVerificationHash"],
      `${path}/trajectoryCrossVerificationHash`,
    );
    const startingContext =
      toolSandboxVerticalSlice.manifest.localHarness.startingContextBinding;
    if (
      sha(
        attempt["startingContextNormalizedSha256"],
        `${path}/startingContextNormalizedSha256`,
      ) !== startingContext.normalizedContextSha256 ||
      attempt["startingContextNormalizationPolicyId"] !==
        startingContext.normalizationRuleId ||
      integer(
        attempt["startingContextVolatileTimestampCount"],
        `${path}/startingContextVolatileTimestampCount`,
      ) !== startingContext.volatileTimestampValueCount ||
      attempt["startingContextBoundExceptDocumentedVolatileTimestamps"] !== true
    ) {
      throw new Error(`${path} does not bind the pinned clean starting context`);
    }
    const successfulSendCount = integer(
      attempt["successfulSendCount"],
      `${path}/successfulSendCount`,
    );
    const messagingDeltaCount = integer(
      attempt["messagingDeltaCount"],
      `${path}/messagingDeltaCount`,
    );
    const postRestartExactRetryCount = integer(
      attempt["postRestartExactRetryCount"],
      `${path}/postRestartExactRetryCount`,
    );
    const postRestartRetryDisposition =
      attempt["postRestartRetryDisposition"];
    if (
      postRestartRetryDisposition !== "not_applicable" &&
      postRestartRetryDisposition !== "not_observed" &&
      postRestartRetryDisposition !== "blocked" &&
      postRestartRetryDisposition !== "executed_succeeded" &&
      postRestartRetryDisposition !== "executed_failed" &&
      postRestartRetryDisposition !== "mixed"
    ) {
      throw new Error(`${path}/postRestartRetryDisposition is invalid`);
    }
    const postRestartRetryAllowedCount = integer(
      attempt["postRestartRetryAllowedCount"],
      `${path}/postRestartRetryAllowedCount`,
    );
    const postRestartRetryBlockedCount = integer(
      attempt["postRestartRetryBlockedCount"],
      `${path}/postRestartRetryBlockedCount`,
    );
    const postRestartRetryExecutedCount = integer(
      attempt["postRestartRetryExecutedCount"],
      `${path}/postRestartRetryExecutedCount`,
    );
    const postRestartRetrySuccessfulSendCount = integer(
      attempt["postRestartRetrySuccessfulSendCount"],
      `${path}/postRestartRetrySuccessfulSendCount`,
    );
    const postRestartRetryDuplicateResponseBlockCount = integer(
      attempt["postRestartRetryDuplicateResponseBlockCount"],
      `${path}/postRestartRetryDuplicateResponseBlockCount`,
    );
    const duplicateTargetSideEffectCount = integer(
      attempt["duplicateTargetSideEffectCount"],
      `${path}/duplicateTargetSideEffectCount`,
    );
    const recomputedRetryDisposition =
      faultStatus !== "applied"
        ? "not_applicable"
        : postRestartExactRetryCount === 0
          ? "not_observed"
          : postRestartRetryBlockedCount === postRestartExactRetryCount
            ? "blocked"
            : postRestartRetryExecutedCount === postRestartExactRetryCount &&
                postRestartRetrySuccessfulSendCount === postRestartExactRetryCount
              ? "executed_succeeded"
              : postRestartRetryExecutedCount === postRestartExactRetryCount &&
                  postRestartRetrySuccessfulSendCount === 0
                ? "executed_failed"
                : "mixed";
    const sidecarRuntimeModuleClosureHash =
      attempt["sidecarRuntimeModuleClosureHash"] === null
        ? null
        : sha(
            attempt["sidecarRuntimeModuleClosureHash"],
            `${path}/sidecarRuntimeModuleClosureHash`,
          );
    if (
      processTraceCount === 0 ||
      processInstances !== (restarted ? 2 : 1) ||
      restarted !== (faultStatus === "applied") ||
      messagingDeltaCount !== successfulSendCount ||
      postRestartRetryDisposition !== recomputedRetryDisposition ||
      postRestartRetryAllowedCount + postRestartRetryBlockedCount !==
        postRestartExactRetryCount ||
      postRestartRetryExecutedCount > postRestartRetryAllowedCount ||
      postRestartRetrySuccessfulSendCount > postRestartRetryExecutedCount ||
      postRestartRetryDuplicateResponseBlockCount >
        postRestartRetryBlockedCount ||
      duplicateTargetSideEffectCount !==
        postRestartRetrySuccessfulSendCount ||
      sidecarBound !== (arm === "native" ? "not_applicable" : true) ||
      successorBound !==
        (faultStatus === "applied" ? true : "not_applicable") ||
      (arm === "native" && sidecarRuntimeModuleClosureHash !== null) ||
      (arm !== "native" && sidecarRuntimeModuleClosureHash === null) ||
      attempt["trajectoryStructureVerified"] !== true ||
      attempt["upstreamOracleRecomputedFromRawTrajectory"] !== true ||
      (arm === "native" &&
        (requestCount !== 0 || sidecarEvidenceVerified || sidecarExercised)) ||
      (arm !== "native" &&
        (!sidecarEvidenceVerified || sidecarExercised !== (requestCount > 0)))
    ) {
      throw new Error(`${path} process/sidecar replay claims are inconsistent`);
    }
    return {
      arm,
      sidecarExercised,
      restarted,
      faultStatus,
      providerAgent,
      sidecarRuntimeModuleClosureHash,
      oracleRuntimePath,
      oracleRuntimeSha256,
    };
  });
  if (replayedArms.size !== ARMS.length) {
    throw new Error("raw verification does not replay native, sham, and substrate");
  }
  if (
    new Set(parsedAttempts.map((attempt) => attempt.oracleRuntimePath)).size !== 1 ||
    new Set(parsedAttempts.map((attempt) => attempt.oracleRuntimeSha256)).size !== 1 ||
    new Set(parsedAttempts.map((attempt) => attempt.providerAgent)).size !== 1 ||
    new Set(
      parsedAttempts
        .filter((attempt) => attempt.sidecarRuntimeModuleClosureHash !== null)
        .map((attempt) => attempt.sidecarRuntimeModuleClosureHash),
    ).size !== 1
  ) {
    throw new Error(
      "raw verification arms used different oracle, provider, or sidecar runtimes",
    );
  }
  if (
    (evaluationTrack === "official_headline" &&
      parsedAttempts.some(
        (attempt) => attempt.faultStatus !== "not_scheduled" || attempt.restarted,
      )) ||
    (evaluationTrack === "restart_lost_response_derivative" &&
      parsedAttempts.some((attempt) => attempt.faultStatus === "not_scheduled"))
  ) {
    throw new Error("raw verification fault evidence contradicts its evaluation track");
  }
  const boundary = record(root["executionBoundary"], "/rawVerification/executionBoundary");
  exactKeys(
    boundary,
    [
      "substrateTreatment",
      "invocationPath",
      "realHttpMcpSidecarProtocolExercised",
      "verifiedRealSidecarProtocolReceipt",
      "providerRoleOutOfProcessEveryArm",
      "actualOsProcessRestartObserved",
      "restartSemantics",
    ],
    "/rawVerification/executionBoundary",
  );
  const nonNative = parsedAttempts.filter((attempt) => attempt.arm !== "native");
  if (
    boundary["substrateTreatment"] !== V3_SUBSTRATE_TREATMENT ||
    boundary["invocationPath"] !== V3_INVOCATION_PATH ||
    boundary["verifiedRealSidecarProtocolReceipt"] !== true ||
    boundary["providerRoleOutOfProcessEveryArm"] !== true ||
    boundary["restartSemantics"] !== V3_RESTART_SEMANTICS ||
    boundary["realHttpMcpSidecarProtocolExercised"] !==
      nonNative.every((attempt) => attempt.sidecarExercised) ||
    boundary["actualOsProcessRestartObserved"] !==
      parsedAttempts.some((attempt) => attempt.restarted)
  ) {
    throw new Error("raw verification execution boundary does not recompute");
  }
  const checkout = record(root["checkout"], "/rawVerification/checkout");
  exactKeys(
    checkout,
    ["revision", "corpusHash", "fileCount", "clean"],
    "/rawVerification/checkout",
  );
  if (
    checkout["revision"] !== toolSandboxVerticalSlice.manifest.benchmark.revision ||
    checkout["corpusHash"] !== toolSandboxVerticalSlice.manifest.benchmark.corpus.hash ||
    checkout["clean"] !== true
  ) {
    throw new Error("raw verification checkout is not the pinned clean corpus");
  }
  integer(checkout["fileCount"], "/rawVerification/checkout/fileCount");
  const inventory = record(root["inventory"], "/rawVerification/inventory");
  exactKeys(inventory, ["fileCount", "rawArtifactCount", "rootHash"], "/rawVerification/inventory");
  const fileCount = integer(inventory["fileCount"], "/rawVerification/inventory/fileCount");
  const rawArtifactCount = integer(
    inventory["rawArtifactCount"],
    "/rawVerification/inventory/rawArtifactCount",
  );
  if (fileCount !== rawArtifactCount + 1) {
    throw new Error("raw verification inventory counts do not bind one batch file");
  }
  sha(inventory["rootHash"], "/rawVerification/inventory/rootHash");
  const verificationHash = sha(root["verificationHash"], "/rawVerification/verificationHash");
  const { verificationHash: _ignored, ...body } = root;
  if (verificationHash !== sha256Json(body)) {
    throw new Error("raw verification hash does not recompute");
  }
  return value as ToolSandboxRawMatchedBatchVerificationV3;
}

function assessFreshV3Verification(
  verification: ToolSandboxRawMatchedBatchVerificationV3,
): ToolSandboxPublicEvalAttemptEligibilityV3 {
    assertV3RawVerificationForPublicEvalBridge(verification);
    const contentResolvedByV3 = new Set<ToolSandboxPublicEvalMissingEvidence>([
      "provider_raw_request_bytes",
      "provider_raw_response_bytes",
      "provider_request_ids",
      "exact_benchmark_task_bytes",
      "exact_benchmark_oracle_bytes",
      "upstream_oracle_recomputation_from_raw_trajectory",
      "verified_real_http_or_mcp_sidecar_protocol_receipt",
    ]);
    const missing: ToolSandboxPublicEvalMissingEvidence[] =
      PUBLIC_EVAL_MISSING_EVIDENCE.filter(
        (item) => !contentResolvedByV3.has(item),
      );
    missing.push("trusted_oracle_replay_runtime_and_environment");
    if (
      verification.attempts.some(
        (attempt) => attempt.providerAgent === "PmScriptedStateProbe",
      )
    ) {
      missing.push("non_scripted_public_agent_execution");
    }
    if (!verification.executionBoundary.realHttpMcpSidecarProtocolExercised) {
      missing.push("real_http_or_mcp_sidecar_protocol_exercised");
    }
    if (
      verification.evaluationTrack === "restart_lost_response_derivative" &&
      !verification.executionBoundary.actualOsProcessRestartObserved
    ) {
      missing.push("actual_os_process_restart_exercised");
    }
    const body = {
      schemaVersion: "pm.public-eval.toolsandbox-attempt-eligibility.v2" as const,
      source: {
        rawVerificationSchema: verification.schemaVersion,
        rawVerificationHash: verification.verificationHash,
        freshRawReplayPerformed: true as const,
        verifierV3OracleReplayStructurallyReproduced: true as const,
        verifierV3SidecarLifecycleReceiptReplayed: true as const,
        verifierV3ProviderProcessTraceReplayed: true as const,
        verifierV3TrajectoryCrossBoundaryReplayPerformed: true as const,
        verifierV3RuntimeModuleClosureReplayed: true as const,
        rawArtifactRootHash: verification.inventory.rootHash,
      },
      executionBoundary: verification.executionBoundary,
      publicEvalAttemptArtifactEligible: false as const,
      missingContentResolvedEvidence: missing,
      statement:
        "A fresh matched-batch.v3 replay reproduced the pinned oracle calculation, raw provider frames, authenticated sidecar exchanges, runtime module closure, retained trajectory, state deltas, and restart-successor binding. These same-package hashes are not external attestation: eligibility remains closed for missing provider usage/cost/latency evidence, a trusted oracle runtime, a non-scripted public-agent run when this batch uses the deterministic probe, and an independent trust anchor.",
    } as const;
    return { ...body, eligibilityHash: sha256Json(body) };
}

/** Reports the exact ceiling of a legacy detached v2 diagnostic summary. */
export function assessToolSandboxPublicEvalAttemptEligibility(
  value: unknown,
): ToolSandboxPublicEvalAttemptEligibility {
  const candidate = record(value, "/rawVerification");
  if (
    candidate["schemaVersion"] ===
    "pm.public-eval.toolsandbox-raw-verification.v3"
  ) {
    throw new Error(
      "detached raw-verification.v3 summaries are diagnostic only; eligibility requires verifyAndAssessToolSandboxPublicEvalAttemptEligibility over bound raw inputs",
    );
  }
  const verification = assertCurrentRawVerificationForPublicEvalBridge(value);
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-attempt-eligibility.v1" as const,
    source: {
      rawVerificationSchema: verification.schemaVersion,
      rawVerificationHash: verification.verificationHash,
      verifierV2TrajectoryStructureContentResolved: true as const,
      rawArtifactRootHash: verification.inventory.rootHash,
    },
    executionBoundary: verification.executionBoundary,
    publicEvalAttemptArtifactEligible: false as const,
    missingContentResolvedEvidence: PUBLIC_EVAL_MISSING_EVIDENCE,
    statement:
      "matched-batch.v2 proves same-package artifact and trajectory-structure conformance only; its reported oracle result is not recomputed from the retained trajectory, and it cannot become a PublicEvalAttemptArtifact until provider, exact task/oracle replay, independent-verifier, and real HTTP/MCP sidecar evidence is content-resolved and authenticated",
  } as const;
  return { ...body, eligibilityHash: sha256Json(body) };
}

/** Reopens all raw evidence before producing any v3 eligibility diagnosis. */
export function verifyAndAssessToolSandboxPublicEvalAttemptEligibility(
  input: ToolSandboxRawMatchedBatchVerificationInput,
): ToolSandboxPublicEvalAttemptEligibility {
  const verification = verifyRawMatchedBatch(input);
  return verification.schemaVersion ===
    "pm.public-eval.toolsandbox-raw-verification.v3"
    ? assessFreshV3Verification(verification)
    : assessToolSandboxPublicEvalAttemptEligibility(verification);
}

/**
 * Explicit fail-closed bridge. No current ToolSandbox artifact can satisfy the
 * PublicEvalAttemptArtifact contract, and caller-authored supplemental fields
 * are rejected by the exact raw-verification schema above.
 */
export function convertToolSandboxRawVerificationToPublicEvalAttemptArtifacts(
  value: unknown,
): never {
  const eligibility = assessToolSandboxPublicEvalAttemptEligibility(value);
  throw new Error(
    `ToolSandbox evidence is ineligible for PublicEvalAttemptArtifact conversion; missing content-resolved evidence: ${eligibility.missingContentResolvedEvidence.join(
      ", ",
    )}`,
  );
}

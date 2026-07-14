import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  toolSandboxVerticalSlice,
  type ToolSandboxArm,
  type ToolSandboxAttemptReceipt,
  type ToolSandboxEvaluationTrack,
  type ToolSandboxExecutionBinding,
  type ToolSandboxFaultEvidence,
  type ToolSandboxInternalOutcome,
} from "./index.js";
import { runAndVerifyToolSandboxOracleReplay } from "./oracle-replay.js";
import { verifyToolSandboxProviderProcessTrace } from "./provider-process-verifier.js";
import {
  computeToolSandboxSidecarRuntimeClosure,
  verifyToolSandboxSidecarRuntimeClosure,
  type ToolSandboxSidecarRuntimeClosure,
} from "./runtime-closure.js";
import { verifyToolSandboxSidecarEvidence } from "./sidecar-verifier.js";
import { verifyToolSandboxTrajectoryCrossEvidence } from "./trajectory-cross-verifier.js";

import type {
  ToolSandboxRawMatchedBatchVerification,
  ToolSandboxRawMatchedBatchVerificationInput,
  ToolSandboxRawMatchedBatchVerificationV2,
  ToolSandboxRawMatchedBatchVerificationV3,
} from "./verify-matched.js";

const SHA256 = /^[a-f0-9]{64}$/u;
const ARMS = ["native", "sham", "substrate"] as const;
const RUNNER_METADATA_PREFIX = "PM_TOOL_SANDBOX_ARM_METADATA=";
const LOST_RESPONSE =
  "The tool response was lost while the provider agent session restarted. The target-side outcome is unknown to this session.";
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

interface CheckoutVerification {
  readonly revision: string;
  readonly corpusHash: string;
  readonly fileCount: number;
}

export interface ToolSandboxRawVerifierDependencies {
  readonly verifyPinnedCleanCheckout: (
    checkoutPath: string,
  ) => CheckoutVerification;
}

interface InventoryEntry {
  readonly path: string;
  readonly sha256: string;
}

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

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

function parseJson(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

function absolutePath(value: unknown, path: string): string {
  const parsed = nonempty(value, path);
  if (!isAbsolute(parsed)) throw new Error(`${path} must be absolute`);
  return resolve(parsed);
}

function safeRelative(value: unknown, path: string): string {
  const parsed = nonempty(value, path);
  if (
    isAbsolute(parsed) ||
    parsed.includes("\\") ||
    parsed.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${path} must be a normalized relative path without escapes`);
  }
  return parsed;
}

function resolveWithin(root: string, relativePath: string, path: string): string {
  const target = resolve(root, relativePath);
  if (target === root || !target.startsWith(`${root}${sep}`)) {
    throw new Error(`${path} escapes the output root`);
  }
  return target;
}

function assertRegularUnsymlinked(path: string, label: string): void {
  let status;
  try {
    status = lstatSync(path);
  } catch {
    throw new Error(`${label} is missing`);
  }
  if (status.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!status.isFile()) throw new Error(`${label} must be a regular file`);
}

function walkInventory(root: string): readonly InventoryEntry[] {
  const entries: InventoryEntry[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = resolve(directory, entry.name);
      const status = lstatSync(target);
      if (status.isSymbolicLink()) {
        throw new Error(`output inventory contains symlink ${relative(root, target)}`);
      }
      if (status.isDirectory()) visit(target);
      else if (status.isFile()) {
        const relativePath = relative(root, target);
        const real = realpathSync(target);
        if (!real.startsWith(`${realpathSync(root)}${sep}`)) {
          throw new Error(`output inventory path escapes root: ${relativePath}`);
        }
        entries.push({
          path: relativePath,
          sha256: sha256Bytes(readFileSync(target)),
        });
      } else {
        throw new Error(`output inventory contains non-regular entry ${relative(root, target)}`);
      }
    }
  };
  visit(root);
  return entries.sort((left, right) => compareCodeUnits(left.path, right.path));
}

function readBoundFile(
  root: string,
  path: string,
  expectedSha256: string,
): Uint8Array {
  const target = resolveWithin(root, path, path);
  assertRegularUnsymlinked(target, path);
  const bytes = readFileSync(target);
  if (sha256Bytes(bytes) !== expectedSha256) {
    throw new Error(`raw artifact bytes changed: ${path}`);
  }
  return bytes;
}

function gitOutput(checkoutPath: string, args: readonly string[]): string {
  const result = spawnSync("git", ["-C", checkoutPath, ...args], {
    encoding: "utf8",
    shell: false,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`cannot verify pinned checkout with git ${args.join(" ")}`);
  }
  return result.stdout.trim();
}

function assertNoCorpusSymlinks(checkoutPath: string): void {
  for (const entry of toolSandboxVerticalSlice.manifest.benchmark.corpus.files) {
    let cursor = checkoutPath;
    for (const part of entry.path.split("/")) {
      cursor = resolve(cursor, part);
      const status = lstatSync(cursor);
      if (status.isSymbolicLink()) {
        throw new Error(`pinned corpus path must not contain symlinks: ${entry.path}`);
      }
    }
    const real = realpathSync(cursor);
    const realRoot = realpathSync(checkoutPath);
    if (!real.startsWith(`${realRoot}${sep}`)) {
      throw new Error(`pinned corpus path escapes checkout: ${entry.path}`);
    }
  }
}

function verifyPinnedCleanCheckout(checkoutPath: string): CheckoutVerification {
  if (!statSync(checkoutPath).isDirectory()) {
    throw new Error("checkoutPath must name a directory");
  }
  assertNoCorpusSymlinks(checkoutPath);
  const corpus = toolSandboxVerticalSlice.verifyCorpusRoot(checkoutPath);
  const head = gitOutput(checkoutPath, ["rev-parse", "HEAD"]);
  if (head !== toolSandboxVerticalSlice.manifest.benchmark.revision) {
    throw new Error("ToolSandbox checkout is not at the pinned revision");
  }
  const status = gitOutput(checkoutPath, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status !== "") throw new Error("ToolSandbox checkout is not clean");
  return corpus;
}

const defaultDependencies: ToolSandboxRawVerifierDependencies = {
  verifyPinnedCleanCheckout,
};

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

function parseExecution(value: unknown, path: string): ToolSandboxExecutionBinding {
  const root = record(value, path);
  exactKeys(
    root,
    ["agentModel", "userSimulatorModel", "toolBackend", "seed", "maxTurns"],
    path,
  );
  return {
    agentModel: nonempty(root["agentModel"], `${path}/agentModel`),
    userSimulatorModel: nonempty(
      root["userSimulatorModel"],
      `${path}/userSimulatorModel`,
    ),
    toolBackend: nonempty(root["toolBackend"], `${path}/toolBackend`),
    seed: nonempty(root["seed"], `${path}/seed`),
    maxTurns: integer(root["maxTurns"], `${path}/maxTurns`),
  };
}

function parseInternalOutcome(
  value: unknown,
  path: string,
): ToolSandboxInternalOutcome {
  const root = record(value, path);
  exactKeys(
    root,
    [
      "admittedActionCount",
      "blockedActionCount",
      "haltedByInternalBlock",
      "blockReasonCodes",
    ],
    path,
  );
  if (!Array.isArray(root["blockReasonCodes"])) {
    throw new Error(`${path}/blockReasonCodes must be an array`);
  }
  const blockReasonCodes = root["blockReasonCodes"].map((entry, index) =>
    nonempty(entry, `${path}/blockReasonCodes/${index}`),
  );
  if (new Set(blockReasonCodes).size !== blockReasonCodes.length) {
    throw new Error(`${path}/blockReasonCodes contains duplicates`);
  }
  return {
    admittedActionCount: integer(
      root["admittedActionCount"],
      `${path}/admittedActionCount`,
    ),
    blockedActionCount: integer(
      root["blockedActionCount"],
      `${path}/blockedActionCount`,
    ),
    haltedByInternalBlock: boolean(
      root["haltedByInternalBlock"],
      `${path}/haltedByInternalBlock`,
    ),
    blockReasonCodes,
  };
}

function parseFaultEvidence(value: unknown, path: string): ToolSandboxFaultEvidence {
  const root = record(value, path);
  if (root["status"] === "trigger_not_reached") {
    exactKeys(root, ["status", "reason"], path);
    return {
      status: "trigger_not_reached",
      reason: nonempty(root["reason"], `${path}/reason`),
    };
  }
  if (root["status"] === "applied") {
    exactKeys(
      root,
      [
        "status",
        "targetCallId",
        "targetSideEffectReceiptHash",
        "restartedAgentSessionId",
        "appliedAtTurn",
      ],
      path,
    );
    return {
      status: "applied",
      targetCallId: nonempty(root["targetCallId"], `${path}/targetCallId`),
      targetSideEffectReceiptHash: sha(
        root["targetSideEffectReceiptHash"],
        `${path}/targetSideEffectReceiptHash`,
      ),
      restartedAgentSessionId: nonempty(
        root["restartedAgentSessionId"],
        `${path}/restartedAgentSessionId`,
      ),
      appliedAtTurn: integer(root["appliedAtTurn"], `${path}/appliedAtTurn`),
    };
  }
  throw new Error(`${path}/status must be applied or trigger_not_reached`);
}

function parseRunnerMetadata(stdout: string, path: string): unknown {
  const records = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(RUNNER_METADATA_PREFIX));
  if (records.length !== 1) {
    throw new Error(`${path} must contain exactly one runner metadata record`);
  }
  const line = records[0];
  if (line === undefined) throw new Error(`${path} has no metadata record`);
  try {
    return JSON.parse(line.slice(RUNNER_METADATA_PREFIX.length)) as unknown;
  } catch {
    throw new Error(`${path} runner metadata is not valid JSON`);
  }
}

function validateTrajectory(
  executionContext: unknown,
  prettyPrint: string,
  faultEvidence: ToolSandboxFaultEvidence | undefined,
  path: string,
  providerRoleRunsOutOfProcess: boolean,
): void {
  if (prettyPrint.length === 0) throw new Error(`${path} pretty trajectory is empty`);
  const context = record(executionContext, `${path}/execution_context.json`);
  const databases = record(context["_dbs"], `${path}/execution_context.json/_dbs`);
  const sandbox = databases["SANDBOX"];
  if (!Array.isArray(sandbox) || sandbox.length === 0) {
    throw new Error(`${path} trajectory has no SANDBOX rows`);
  }
  const sandboxRows = sandbox.map((entry, index) =>
    record(entry, `${path}/execution_context.json/_dbs/SANDBOX/${index}`),
  );
  const hasLostResponse = sandboxRows.some(
    (row) => row["sender"] === "EXECUTION_ENVIRONMENT" && row["content"] === LOST_RESPONSE,
  );
  if (faultEvidence === undefined || faultEvidence.status === "trigger_not_reached") {
    if (hasLostResponse) {
      throw new Error(`${path} trajectory contains an unclaimed lost-response fault`);
    }
    return;
  }

  const matchingCall = sandboxRows.find((row) => {
    if (row["sender"] !== "AGENT" || row["recipient"] !== "EXECUTION_ENVIRONMENT") {
      return false;
    }
    const content = typeof row["content"] === "string" ? row["content"] : "";
    const callId =
      typeof row["openai_tool_call_id"] === "string"
        ? row["openai_tool_call_id"]
        : `call-${createHash("sha256").update(content).digest("hex").slice(0, 24)}`;
    const toolName =
      typeof row["openai_function_name"] === "string"
        ? row["openai_function_name"]
        : content.includes("send_message_with_phone_number")
          ? "send_message_with_phone_number"
          : null;
    return (
      callId === faultEvidence.targetCallId &&
      toolName === "send_message_with_phone_number"
    );
  });
  if (matchingCall === undefined || !hasLostResponse) {
    throw new Error(`${path} raw trajectory does not prove the claimed fault trigger`);
  }
  const messaging = databases["MESSAGING"];
  if (
    !Array.isArray(messaging) ||
    !messaging.some(
      (entry) =>
        isRecord(entry) && entry["sandbox_message_index"] === faultEvidence.appliedAtTurn,
    )
  ) {
    throw new Error(`${path} raw trajectory does not show a target-side write at the fault turn`);
  }
  if (
    (!providerRoleRunsOutOfProcess &&
      faultEvidence.restartedAgentSessionId !== "session-002") ||
    (providerRoleRunsOutOfProcess &&
      !/^provider-process-002-[a-f0-9]{12}$/u.test(
        faultEvidence.restartedAgentSessionId,
      ))
  ) {
    throw new Error(`${path} first scheduled restart has an invalid successor identity`);
  }
}

interface TraceValidation {
  readonly entryCount: number;
  readonly outcomeCount: number;
  readonly targetFaultReceiptObserved: boolean;
  readonly finalState: ReplayBoundaryState;
}

interface ReplayBoundaryDecision {
  readonly proposalId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly fingerprint: string;
  readonly decision: "allow" | "block";
  readonly decisionHash: string;
}

interface ReplayBoundaryOutcome {
  readonly proposalId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly fingerprint: string;
  readonly succeeded: boolean;
  readonly responseHash: string;
  readonly observedAt: string;
  readonly outcomeHash: string;
}

interface ReplayBoundaryState {
  readonly schemaVersion: "pm.public-eval.toolsandbox-boundary-state.v1";
  readonly arm: "sham" | "substrate";
  readonly attemptId: string;
  readonly sequence: number;
  readonly irrelevantState: {
    readonly paddingRef: string;
    readonly paddingValue: string;
  };
  readonly delivered: Readonly<
    Record<
      string,
      { readonly proposalId: string; readonly outcomeHash: string; readonly observedAt: string }
    >
  >;
  readonly decisions: readonly ReplayBoundaryDecision[];
  readonly outcomes: readonly ReplayBoundaryOutcome[];
  readonly stateHash: string;
}

function replayStateBody(
  state: Omit<ReplayBoundaryState, "stateHash">,
): Omit<ReplayBoundaryState, "stateHash"> {
  return state;
}

function initialReplayState(
  arm: "sham" | "substrate",
  attemptId: string,
): ReplayBoundaryState {
  const body = replayStateBody({
    schemaVersion: "pm.public-eval.toolsandbox-boundary-state.v1",
    arm,
    attemptId,
    sequence: 0,
    irrelevantState: {
      paddingRef: `sham-padding:${attemptId}`,
      paddingValue: "state intentionally unrelated to the proposed tool action",
    },
    delivered: {},
    decisions: [],
    outcomes: [],
  });
  return { ...body, stateHash: sha256Json(body) };
}

function validateBoundaryTrace(
  text: string,
  expected: {
    readonly arm: Exclude<ToolSandboxArm, "native">;
    readonly attemptId: string;
    readonly evaluationTrack: ToolSandboxEvaluationTrack;
    readonly statePath: string;
    readonly internalOutcome: ToolSandboxInternalOutcome;
    readonly faultEvidence?: ToolSandboxFaultEvidence;
  },
): TraceValidation {
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== "");
  let replay = initialReplayState(expected.arm, expected.attemptId);
  let allowed = 0;
  let blocked = 0;
  let outcomeCount = 0;
  let targetFaultReceiptObserved = false;
  const observedBlockReasonCodes = new Set<string>();
  for (const [index, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`boundary trace line ${index + 1} is not valid JSON`);
    }
    const entry = record(parsed, `/boundaryTrace/${index}`);
    if (
      entry["schemaVersion"] ===
      "pm.public-eval.toolsandbox-boundary-http-client.v1"
    ) {
      exactKeys(
        entry,
        [
          "schemaVersion",
          "sequence",
          "previousEntryHash",
          "command",
          "request",
          "response",
          "http",
          "entryHash",
        ],
        `/boundaryTrace/${index}`,
      );
    } else {
      exactKeys(entry, ["command", "request", "response"], `/boundaryTrace/${index}`);
    }
    const request = record(entry["request"], `/boundaryTrace/${index}/request`);
    const response = record(entry["response"], `/boundaryTrace/${index}/response`);
    if (
      request["arm"] !== expected.arm ||
      request["attemptId"] !== expected.attemptId ||
      resolve(nonempty(request["statePath"], `/boundaryTrace/${index}/statePath`)) !==
        expected.statePath
    ) {
      throw new Error(`boundary trace line ${index + 1} has an arm/config mismatch`);
    }
    if (entry["command"] === "admit-tool") {
      if (request["evaluationTrack"] !== expected.evaluationTrack) {
        throw new Error(`boundary trace line ${index + 1} has a track mismatch`);
      }
      const toolCallId = nonempty(
        request["toolCallId"],
        `/boundaryTrace/${index}/request/toolCallId`,
      );
      const toolName = nonempty(
        request["toolName"],
        `/boundaryTrace/${index}/request/toolName`,
      );
      const arguments_ = record(
        request["arguments"],
        `/boundaryTrace/${index}/request/arguments`,
      );
      const fingerprint = sha256Json({ toolName, arguments: arguments_ });
      const proposalId = `${expected.attemptId}:proposal:${replay.sequence + 1}`;
      const decision = response["decision"];
      if (decision !== "allow" && decision !== "block") {
        throw new Error(`boundary trace line ${index + 1} has an invalid decision`);
      }
      if (
        response["proposalId"] !== proposalId ||
        response["fingerprint"] !== fingerprint ||
        response["stateHashBefore"] !== replay.stateHash ||
        (decision === "allow" && response["responseForAgent"] !== null) ||
        (decision === "block" &&
          response["responseForAgent"] !== null &&
          typeof response["responseForAgent"] !== "string")
      ) {
        throw new Error(
          `boundary decision does not replay from prior state at line ${index + 1}`,
        );
      }
      const review = record(response["review"], `/boundaryTrace/${index}/response/review`);
      const execution = record(
        review["execution"],
        `/boundaryTrace/${index}/response/review/execution`,
      );
      if (
        review["valid"] !== (decision === "allow") ||
        execution["allowed"] !== (decision === "allow") ||
        execution["blocking"] !== (decision === "block")
      ) {
        throw new Error(`boundary review contradicts replayed decision at line ${index + 1}`);
      }
      if (!Array.isArray(review["warnings"])) {
        throw new Error(`boundary review warnings are invalid at line ${index + 1}`);
      }
      for (const warning of review["warnings"]) {
        const warningRecord = record(
          warning,
          `/boundaryTrace/${index}/response/review/warnings`,
        );
        if (typeof warningRecord["code"] === "string") {
          observedBlockReasonCodes.add(warningRecord["code"]);
        }
      }
      if (decision === "allow") allowed += 1;
      else blocked += 1;
      const { decisionHash, ...decisionBody } = response;
      if (sha(decisionHash, `/boundaryTrace/${index}/decisionHash`) !== sha256Json(decisionBody)) {
        throw new Error(`boundary decision hash does not recompute at line ${index + 1}`);
      }
      const nextBody = replayStateBody({
        schemaVersion: replay.schemaVersion,
        arm: replay.arm,
        attemptId: replay.attemptId,
        sequence: replay.sequence + 1,
        irrelevantState: replay.irrelevantState,
        delivered: replay.delivered,
        decisions: [
          ...replay.decisions,
          {
            proposalId,
            toolCallId,
            toolName,
            fingerprint,
            decision,
            decisionHash: decisionHash as string,
          },
        ],
        outcomes: replay.outcomes,
      });
      replay = { ...nextBody, stateHash: sha256Json(nextBody) };
    } else if (entry["command"] === "record-tool-outcome") {
      outcomeCount += 1;
      const proposalId = nonempty(
        request["proposalId"],
        `/boundaryTrace/${index}/request/proposalId`,
      );
      const toolCallId = nonempty(
        request["toolCallId"],
        `/boundaryTrace/${index}/request/toolCallId`,
      );
      const toolName = nonempty(
        request["toolName"],
        `/boundaryTrace/${index}/request/toolName`,
      );
      const arguments_ = record(
        request["arguments"],
        `/boundaryTrace/${index}/request/arguments`,
      );
      const fingerprint = sha256Json({
        toolName,
        arguments: arguments_,
      });
      if (response["fingerprint"] !== fingerprint) {
        throw new Error(`boundary outcome fingerprint does not recompute at line ${index + 1}`);
      }
      const matchingDecision = replay.decisions.find(
        (candidate) => candidate.proposalId === proposalId,
      );
      if (
        matchingDecision === undefined ||
        matchingDecision.decision !== "allow" ||
        matchingDecision.toolCallId !== toolCallId ||
        matchingDecision.toolName !== toolName ||
        matchingDecision.fingerprint !== fingerprint ||
        replay.outcomes.some((candidate) => candidate.proposalId === proposalId)
      ) {
        throw new Error(`boundary outcome does not follow one allowed proposal at line ${index + 1}`);
      }
      const succeeded = boolean(
        request["succeeded"],
        `/boundaryTrace/${index}/request/succeeded`,
      );
      const responseHash = sha(
        request["responseHash"],
        `/boundaryTrace/${index}/request/responseHash`,
      );
      const observedAt = nonempty(
        request["observedAt"],
        `/boundaryTrace/${index}/request/observedAt`,
      );
      const outcomeBody = {
        proposalId,
        toolCallId,
        toolName,
        fingerprint,
        succeeded,
        responseHash,
        observedAt,
      };
      const targetReceipt = sha(
        response["targetSideEffectReceiptHash"],
        `/boundaryTrace/${index}/targetSideEffectReceiptHash`,
      );
      if (targetReceipt !== sha256Json(outcomeBody)) {
        throw new Error(`boundary outcome hash does not recompute at line ${index + 1}`);
      }
      const outcome = { ...outcomeBody, outcomeHash: targetReceipt };
      const delivered =
        succeeded && toolName === "send_message_with_phone_number"
          ? {
              ...replay.delivered,
              [fingerprint]: { proposalId, outcomeHash: targetReceipt, observedAt },
            }
          : replay.delivered;
      const nextBody = replayStateBody({
        schemaVersion: replay.schemaVersion,
        arm: replay.arm,
        attemptId: replay.attemptId,
        sequence: replay.sequence + 1,
        irrelevantState: replay.irrelevantState,
        delivered,
        decisions: replay.decisions,
        outcomes: [...replay.outcomes, outcome],
      });
      const nextState = { ...nextBody, stateHash: sha256Json(nextBody) };
      if (response["stateHash"] !== nextState.stateHash) {
        throw new Error(`boundary outcome state hash does not replay at line ${index + 1}`);
      }
      replay = nextState;
      if (
        expected.faultEvidence?.status === "applied" &&
        request["toolCallId"] === expected.faultEvidence.targetCallId &&
        request["toolName"] === "send_message_with_phone_number" &&
        request["succeeded"] === true &&
        targetReceipt === expected.faultEvidence.targetSideEffectReceiptHash
      ) {
        targetFaultReceiptObserved = true;
      }
    } else {
      throw new Error(`boundary trace line ${index + 1} has an unknown command`);
    }
  }
  if (
    allowed !== expected.internalOutcome.admittedActionCount ||
    blocked !== expected.internalOutcome.blockedActionCount
  ) {
    throw new Error("boundary trace counts do not match raw internal-outcome metadata");
  }
  if (
    !jsonEqual(
      [...observedBlockReasonCodes].sort(compareCodeUnits),
      [...expected.internalOutcome.blockReasonCodes].sort(compareCodeUnits),
    )
  ) {
    throw new Error("boundary trace warning codes do not match raw internal-outcome metadata");
  }
  if (expected.faultEvidence?.status === "applied" && !targetFaultReceiptObserved) {
    throw new Error("boundary trace does not prove the claimed target-side fault receipt");
  }
  return {
    entryCount: lines.length,
    outcomeCount,
    targetFaultReceiptObserved,
    finalState: replay,
  };
}

function validateBoundaryState(
  value: unknown,
  expected: {
    readonly arm: Exclude<ToolSandboxArm, "native">;
    readonly attemptId: string;
    readonly replayed: ReplayBoundaryState;
  },
): void {
  const root = record(value, "/boundaryState");
  if (
    root["schemaVersion"] !== "pm.public-eval.toolsandbox-boundary-state.v1" ||
    root["arm"] !== expected.arm ||
    root["attemptId"] !== expected.attemptId
  ) {
    throw new Error("boundary state identity does not match its arm");
  }
  const { stateHash, ...body } = root;
  if (sha(stateHash, "/boundaryState/stateHash") !== sha256Json(body)) {
    throw new Error("boundary state hash does not recompute");
  }
  if (!jsonEqual(root, expected.replayed)) {
    throw new Error("boundary final state does not equal the replayed trace state");
  }
}

function recomputeArmOrder(seed: string): readonly ToolSandboxArm[] {
  return ARMS.map((arm) => ({
    arm,
    key: sha256Json({
      domain: "pm.public-eval.toolsandbox-arm-order.v1",
      seed,
      arm,
    }),
  }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.key, right.key) ||
        compareCodeUnits(left.arm, right.arm),
    )
    .map(({ arm }) => arm);
}

function inventoryMap(entries: readonly InventoryEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (map.has(entry.path)) throw new Error(`duplicate inventory path ${entry.path}`);
    map.set(entry.path, entry.sha256);
  }
  return map;
}

function validateCorpusBinding(
  value: unknown,
  expected: CheckoutVerification,
): void {
  const root = record(value, "/batch/corpusVerification");
  exactKeys(root, ["revision", "corpusHash", "fileCount"], "/batch/corpusVerification");
  if (!jsonEqual(root, expected)) {
    throw new Error("batch corpus binding does not match the clean pinned checkout");
  }
}

/**
 * Reopens a versioned matched batch and reconstructs every receipt from raw bytes.
 * This is deterministic artifact-integrity/conformance verification by the
 * producer package; it is deliberately not a signature or an efficacy claim.
 */
export function verifyRawMatchedBatch(
  input: ToolSandboxRawMatchedBatchVerificationInput,
  dependencies: ToolSandboxRawVerifierDependencies = defaultDependencies,
): ToolSandboxRawMatchedBatchVerification {
  const inputRoot = absolutePath(input.outputRoot, "/outputRoot");
  if (!statSync(inputRoot).isDirectory()) throw new Error("/outputRoot must be a directory");
  const outputRoot = realpathSync(inputRoot);
  const batchPath = absolutePath(input.batchPath, "/batchPath");
  assertRegularUnsymlinked(batchPath, "/batchPath");
  const batchRelative = relative(outputRoot, realpathSync(batchPath));
  if (batchRelative.includes("..") || batchRelative.includes(sep) || batchRelative === "") {
    throw new Error("batch artifact must be a top-level file inside outputRoot");
  }
  const batchBytes = readFileSync(batchPath);
  const batchFileSha256 = sha256Bytes(batchBytes);
  const batch = record(parseJson(batchBytes, "/batchPath"), "/batch");
  const isV3 = batch["schemaVersion"] === "pm.public-eval.toolsandbox-matched-batch.v3";
  exactKeys(
    batch,
    [
      "schemaVersion",
      "manifestHash",
      "batchId",
      "evaluationTrack",
      "headlineEligible",
      "checkoutPath",
      "corpusVerification",
      "randomization",
      "execution",
      ...(isV3 ? ["scriptedStdin"] : []),
      "attempts",
      "summary",
      "batchHash",
    ],
    "/batch",
  );
  if (!isV3 && batch["schemaVersion"] !== "pm.public-eval.toolsandbox-matched-batch.v2") {
    throw new Error("raw verification requires matched-batch.v2 or matched-batch.v3 artifacts");
  }
  if (isV3 && input.oraclePythonExecutable === undefined) {
    throw new Error("matched-batch.v3 verification requires verifier-selected oraclePythonExecutable");
  }
  if (isV3 && dependencies !== defaultDependencies) {
    throw new Error(
      "matched-batch.v3 eligibility verification forbids injected checkout dependencies",
    );
  }
  if (batch["manifestHash"] !== toolSandboxVerticalSlice.manifest.manifestHash) {
    throw new Error("batch manifest does not match this verifier");
  }
  const { batchHash: claimedBatchHash, ...batchBody } = batch;
  const batchHash = sha(claimedBatchHash, "/batch/batchHash");
  if (batchHash !== sha256Json(batchBody)) {
    throw new Error("batch content hash does not recompute");
  }
  if (batchRelative !== `pm-matched-batch-${batchHash}.json`) {
    throw new Error("batch artifact filename is not content-addressed by batchHash");
  }

  const checkoutPath = realpathSync(
    absolutePath(input.checkoutPath, "/checkoutPath"),
  );
  const embeddedCheckout = realpathSync(
    absolutePath(batch["checkoutPath"], "/batch/checkoutPath"),
  );
  if (embeddedCheckout !== checkoutPath) {
    throw new Error("explicit checkoutPath does not match the batch checkout binding");
  }
  const checkout = dependencies.verifyPinnedCleanCheckout(checkoutPath);
  validateCorpusBinding(batch["corpusVerification"], checkout);

  const batchId = nonempty(batch["batchId"], "/batch/batchId");
  const evaluationTrack = parseTrack(
    batch["evaluationTrack"],
    "/batch/evaluationTrack",
  );
  if (boolean(batch["headlineEligible"], "/batch/headlineEligible") !==
      (evaluationTrack === "official_headline")) {
    throw new Error("batch headline eligibility does not match its track");
  }
  const execution = parseExecution(batch["execution"], "/batch/execution");
  if (
    execution.toolBackend !== "DEFAULT" ||
    execution.seed !== "42" ||
    execution.maxTurns !== 30
  ) {
    throw new Error("batch execution does not bind DEFAULT, seed 42, and 30 turns");
  }
  const scriptedStdin: string[] = [];
  if (isV3) {
    const value = batch["scriptedStdin"];
    if (!Array.isArray(value) || value.length > 64) {
      throw new Error("/batch/scriptedStdin must be an array of at most 64 lines");
    }
    for (const [index, line] of value.entries()) {
      if (
        typeof line !== "string" ||
        line.length > 4096 ||
        /[\r\n\0]/u.test(line)
      ) {
        throw new Error(`/batch/scriptedStdin/${index} is not a bounded input line`);
      }
      scriptedStdin.push(line);
    }
    if (scriptedStdin.length > 0 && execution.userSimulatorModel !== "Cli") {
      throw new Error("scripted stdin requires the upstream Cli user role");
    }
  }
  const randomization = record(batch["randomization"], "/batch/randomization");
  exactKeys(randomization, ["seed", "armOrder"], "/batch/randomization");
  const randomizationSeed = nonempty(
    randomization["seed"],
    "/batch/randomization/seed",
  );
  if (!Array.isArray(randomization["armOrder"])) {
    throw new Error("/batch/randomization/armOrder must be an array");
  }
  const claimedOrder = randomization["armOrder"].map((arm, index) =>
    parseArm(arm, `/batch/randomization/armOrder/${index}`),
  );
  const armOrder = recomputeArmOrder(randomizationSeed);
  if (!jsonEqual(claimedOrder, armOrder)) {
    throw new Error("randomized arm order does not recompute from its seed");
  }

  if (!Array.isArray(batch["attempts"]) || batch["attempts"].length !== ARMS.length) {
    throw new Error("batch must contain exactly three arm attempts");
  }
  const observedInventory = walkInventory(outputRoot);
  const observed = inventoryMap(observedInventory);
  const expectedPaths = new Set<string>([batchRelative]);
  const receipts: ToolSandboxAttemptReceipt[] = [];
  const verifiedAttemptsV2: Array<
    ToolSandboxRawMatchedBatchVerificationV2["attempts"][number]
  > = [];
  const verifiedAttemptsV3: Array<
    ToolSandboxRawMatchedBatchVerificationV3["attempts"][number]
  > = [];

  for (const [index, attemptValue] of batch["attempts"].entries()) {
    const path = `/batch/attempts/${index}`;
    const attempt = record(attemptValue, path);
    const commonAttemptKeys = [
        "order",
        "arm",
        "attemptId",
        "invocation",
        "resultSummaryPath",
        "metadataPath",
        "boundaryTracePath",
        "boundaryTraceSha256",
        ...(isV3
          ? [
              "boundarySidecar",
              "providerProcessTracePath",
              "providerProcessTraceSha256",
            ]
          : []),
        "providerSessionRestartCount",
        "receiptPath",
        "receipt",
        "rawArtifacts",
      ];
    exactKeys(attempt, commonAttemptKeys, path);
    const order = integer(attempt["order"], `${path}/order`);
    const arm = parseArm(attempt["arm"], `${path}/arm`);
    if (order !== index + 1 || arm !== armOrder[index]) {
      throw new Error(`${path} arm/order does not match randomized configuration`);
    }
    const attemptId = nonempty(attempt["attemptId"], `${path}/attemptId`);
    if (attemptId !== `${batchId}-${arm}-001`) {
      throw new Error(`${path}/attemptId does not match batch and arm configuration`);
    }
    const armRoot = `${String(order).padStart(2, "0")}-${arm}`;

    if (!Array.isArray(attempt["rawArtifacts"])) {
      throw new Error(`${path}/rawArtifacts must be an array`);
    }
    const rawArtifacts = attempt["rawArtifacts"].map((entryValue, rawIndex) => {
      const entryPath = `${path}/rawArtifacts/${rawIndex}`;
      const entry = record(entryValue, entryPath);
      exactKeys(entry, ["path", "sha256"], entryPath);
      const artifactPath = safeRelative(entry["path"], `${entryPath}/path`);
      if (!artifactPath.startsWith(`${armRoot}/`)) {
        throw new Error(`${entryPath}/path escapes its matched arm directory`);
      }
      return { path: artifactPath, sha256: sha(entry["sha256"], `${entryPath}/sha256`) };
    });
    const sortedRaw = [...rawArtifacts].sort((left, right) =>
      compareCodeUnits(left.path, right.path),
    );
    if (!jsonEqual(rawArtifacts, sortedRaw)) {
      throw new Error(`${path}/rawArtifacts must be sorted by path`);
    }
    if (new Set(rawArtifacts.map((entry) => entry.path)).size !== rawArtifacts.length) {
      throw new Error(`${path}/rawArtifacts contains duplicate paths`);
    }
    for (const entry of rawArtifacts) {
      if (expectedPaths.has(entry.path)) throw new Error(`duplicate batch inventory path ${entry.path}`);
      expectedPaths.add(entry.path);
      if (observed.get(entry.path) !== entry.sha256) {
        throw new Error(`raw inventory hash does not match bytes: ${entry.path}`);
      }
    }
    const rawMap = inventoryMap(rawArtifacts);
    const requiredPath = (field: string, expectedSuffix: string): string => {
      const parsed = safeRelative(attempt[field], `${path}/${field}`);
      if (parsed !== `${armRoot}/${expectedSuffix}` || !rawMap.has(parsed)) {
        throw new Error(`${path}/${field} is missing or does not match ${expectedSuffix}`);
      }
      return parsed;
    };
    const resultSummaryPath = requiredPath("resultSummaryPath", "result_summary.json");
    const metadataPath = requiredPath("metadataPath", "arm-run-metadata.json");
    const providerProcessTracePath = isV3
      ? requiredPath("providerProcessTracePath", "provider-process.jsonl")
      : undefined;
    let sidecarBinding:
      | {
          readonly readyPath: string;
          readonly finalReceiptPath: string;
          readonly auditPath: string;
          readonly operationLedgerPath: string;
          readonly stdoutPath: string;
          readonly stderrPath: string;
          readonly pid: number;
          readonly ppid: number;
          readonly tokenSha256: string;
          readonly nodePath: string;
          readonly nodeSha256: string;
          readonly entryPath: string;
          readonly entrySha256: string;
          readonly runtimeModuleClosure: ToolSandboxSidecarRuntimeClosure;
        }
      | undefined;
    if (isV3) {
      if (arm === "native") {
        if (attempt["boundarySidecar"] !== null) {
          throw new Error(`${path} native arm must not claim a boundary sidecar`);
        }
      } else {
        const sidecar = record(
          attempt["boundarySidecar"],
          `${path}/boundarySidecar`,
        );
        exactKeys(
          sidecar,
          [
            "readyPath",
            "finalReceiptPath",
            "auditPath",
            "operationLedgerPath",
            "stdoutPath",
            "stderrPath",
            "launch",
          ],
          `${path}/boundarySidecar`,
        );
        const sidecarPath = (field: string, suffix: string): string => {
          const parsed = safeRelative(
            sidecar[field],
            `${path}/boundarySidecar/${field}`,
          );
          if (parsed !== `${armRoot}/${suffix}` || !rawMap.has(parsed)) {
            throw new Error(
              `${path}/boundarySidecar/${field} is missing or does not match ${suffix}`,
            );
          }
          return parsed;
        };
        const launch = record(
          sidecar["launch"],
          `${path}/boundarySidecar/launch`,
        );
        exactKeys(
          launch,
          [
            "pid",
            "ppid",
            "tokenSha256",
            "nodePath",
            "nodeSha256",
            "entryPath",
            "entrySha256",
            "runtimeModuleClosure",
          ],
          `${path}/boundarySidecar/launch`,
        );
        const pid = integer(
          launch["pid"],
          `${path}/boundarySidecar/launch/pid`,
        );
        const ppid = integer(
          launch["ppid"],
          `${path}/boundarySidecar/launch/ppid`,
        );
        if (pid < 1 || ppid < 1 || pid === ppid) {
          throw new Error(`${path} sidecar launch has an invalid process identity`);
        }
        const nodePath = realpathSync(
          absolutePath(
            launch["nodePath"],
            `${path}/boundarySidecar/launch/nodePath`,
          ),
        );
        const entryPath = realpathSync(
          absolutePath(
            launch["entryPath"],
            `${path}/boundarySidecar/launch/entryPath`,
          ),
        );
        const verifierEntryPath = realpathSync(
          fileURLToPath(new URL("./sidecar-entry.js", import.meta.url)),
        );
        const nodeSha256 = sha(
          launch["nodeSha256"],
          `${path}/boundarySidecar/launch/nodeSha256`,
        );
        const entrySha256 = sha(
          launch["entrySha256"],
          `${path}/boundarySidecar/launch/entrySha256`,
        );
        const runtimeModuleClosure = verifyToolSandboxSidecarRuntimeClosure(
          launch["runtimeModuleClosure"],
        );
        const trustedRuntimeModuleClosure =
          computeToolSandboxSidecarRuntimeClosure(entryPath);
        assertRegularUnsymlinked(nodePath, `${path}/boundarySidecar/launch/nodePath`);
        assertRegularUnsymlinked(entryPath, `${path}/boundarySidecar/launch/entryPath`);
        if (
          launch["nodePath"] !== nodePath ||
          launch["entryPath"] !== entryPath ||
          entryPath !== verifierEntryPath ||
          nodeSha256 !== sha256Bytes(readFileSync(nodePath)) ||
          entrySha256 !== sha256Bytes(readFileSync(entryPath))
          || !jsonEqual(runtimeModuleClosure, trustedRuntimeModuleClosure)
        ) {
          throw new Error(`${path} sidecar launch runtime bytes do not verify`);
        }
        sidecarBinding = {
          readyPath: sidecarPath("readyPath", "sidecar-ready.json"),
          finalReceiptPath: sidecarPath("finalReceiptPath", "sidecar-final.json"),
          auditPath: sidecarPath("auditPath", "sidecar-audit.jsonl"),
          operationLedgerPath: sidecarPath(
            "operationLedgerPath",
            "boundary-state.json.sidecar-operations.jsonl",
          ),
          stdoutPath: sidecarPath("stdoutPath", "sidecar.stdout.log"),
          stderrPath: sidecarPath("stderrPath", "sidecar.stderr.log"),
          pid,
          ppid,
          tokenSha256: sha(
            launch["tokenSha256"],
            `${path}/boundarySidecar/launch/tokenSha256`,
          ),
          nodePath,
          nodeSha256,
          entryPath,
          entrySha256,
          runtimeModuleClosure: trustedRuntimeModuleClosure,
        };
      }
    }
    const receiptPath = safeRelative(attempt["receiptPath"], `${path}/receiptPath`);
    if (!receiptPath.startsWith(`${armRoot}/pm-receipt-`) || !rawMap.has(receiptPath)) {
      throw new Error(`${path}/receiptPath is missing or outside its arm inventory`);
    }
    const stdoutPath = `${armRoot}/runner.stdout.log`;
    const stderrPath = `${armRoot}/runner.stderr.log`;
    const trajectoryRoot =
      `${armRoot}/trajectories/${toolSandboxVerticalSlice.manifest.benchmark.scenario}`;
    const executionContextPath = `${trajectoryRoot}/execution_context.json`;
    const prettyPrintPath = `${trajectoryRoot}/pretty_print.txt`;
    for (const required of [stdoutPath, stderrPath, executionContextPath, prettyPrintPath]) {
      if (!rawMap.has(required)) throw new Error(`${path} inventory is missing ${required}`);
    }

    const invocation = record(attempt["invocation"], `${path}/invocation`);
    exactKeys(
      invocation,
      [
        "executable",
        "arguments",
        "cwd",
        "exitCode",
        "runnerSha256",
        "stdoutPath",
        "stdoutSha256",
        "stderrPath",
        "stderrSha256",
      ],
      `${path}/invocation`,
    );
    const invokedPythonExecutable = absolutePath(
      invocation["executable"],
      `${path}/invocation/executable`,
    );
    if (isV3) {
      assertRegularUnsymlinked(
        realpathSync(invokedPythonExecutable),
        `${path}/invocation/executable`,
      );
      if (resolve(input.oraclePythonExecutable!) !== invokedPythonExecutable) {
        throw new Error(
          `${path} oracle replay runtime must be the exact matched-run Python launcher`,
        );
      }
    }
    if (!Array.isArray(invocation["arguments"]) || invocation["arguments"].length !== 1) {
      throw new Error(`${path}/invocation/arguments must contain exactly the matched runner`);
    }
    const invokedRunner = absolutePath(
      invocation["arguments"][0],
      `${path}/invocation/arguments/0`,
    );
    assertRegularUnsymlinked(invokedRunner, `${path}/invocation/arguments/0`);
    const runnerHash = sha256Bytes(readFileSync(invokedRunner));
    if (
      runnerHash !== toolSandboxVerticalSlice.manifest.localHarness.runnerSha256 ||
      sha(invocation["runnerSha256"], `${path}/invocation/runnerSha256`) !== runnerHash
    ) {
      throw new Error(`${path} invoked runner does not match the manifest-pinned harness`);
    }
    if (realpathSync(absolutePath(invocation["cwd"], `${path}/invocation/cwd`)) !== checkoutPath) {
      throw new Error(`${path}/invocation/cwd does not match the pinned checkout`);
    }
    if (invocation["exitCode"] !== 0) throw new Error(`${path}/invocation did not exit cleanly`);
    if (
      invocation["stdoutPath"] !== stdoutPath ||
      invocation["stderrPath"] !== stderrPath ||
      sha(invocation["stdoutSha256"], `${path}/invocation/stdoutSha256`) !== rawMap.get(stdoutPath) ||
      sha(invocation["stderrSha256"], `${path}/invocation/stderrSha256`) !== rawMap.get(stderrPath)
    ) {
      throw new Error(`${path} stdout/stderr bindings do not match raw bytes`);
    }

    const stdout = Buffer.from(
      readBoundFile(outputRoot, stdoutPath, rawMap.get(stdoutPath)!),
    ).toString("utf8");
    readBoundFile(outputRoot, stderrPath, rawMap.get(stderrPath)!);
    const metadataFile = parseJson(
      readBoundFile(outputRoot, metadataPath, rawMap.get(metadataPath)!),
      metadataPath,
    );
    const metadataStdout = parseRunnerMetadata(stdout, stdoutPath);
    if (!jsonEqual(metadataFile, metadataStdout)) {
      throw new Error(`${path} stdout metadata does not match arm-run-metadata.json`);
    }
    const metadata = record(metadataFile, `${path}/metadata`);
    exactKeys(
      metadata,
      [
        "schemaVersion",
        "arm",
        "evaluationTrack",
        "attemptId",
        "execution",
        "completedAt",
        "resultSummaryPath",
        "boundaryTracePath",
        ...(isV3 ? ["providerProcessTracePath", "providerProcess"] : []),
        "internalOutcome",
        "faultEvidence",
        "providerSessionRestartCount",
      ],
      `${path}/metadata`,
    );
    if (
      metadata["schemaVersion"] !==
        (isV3
          ? "pm.public-eval.toolsandbox-arm-run.v3"
          : "pm.public-eval.toolsandbox-arm-run.v2") ||
      metadata["arm"] !== arm ||
      metadata["evaluationTrack"] !== evaluationTrack ||
      metadata["attemptId"] !== attemptId ||
      !jsonEqual(parseExecution(metadata["execution"], `${path}/metadata/execution`), execution)
    ) {
      throw new Error(`${path} raw metadata has an arm/config mismatch`);
    }
    const expectedResultAbsolute = resolve(inputRoot, resultSummaryPath);
    const expectedBoundaryAbsolute = resolve(inputRoot, `${armRoot}/boundary.jsonl`);
    if (
      resolve(nonempty(metadata["resultSummaryPath"], `${path}/metadata/resultSummaryPath`)) !==
        expectedResultAbsolute ||
      resolve(nonempty(metadata["boundaryTracePath"], `${path}/metadata/boundaryTracePath`)) !==
        expectedBoundaryAbsolute
    ) {
      throw new Error(`${path} raw metadata paths do not match the output root`);
    }
    const internalOutcome = parseInternalOutcome(
      metadata["internalOutcome"],
      `${path}/metadata/internalOutcome`,
    );
    const restartCount = integer(
      metadata["providerSessionRestartCount"],
      `${path}/metadata/providerSessionRestartCount`,
    );
    if (restartCount !== integer(attempt["providerSessionRestartCount"], `${path}/providerSessionRestartCount`)) {
      throw new Error(`${path} restart count differs between raw metadata and batch`);
    }
    let faultEvidence: ToolSandboxFaultEvidence | undefined;
    if (evaluationTrack === "official_headline") {
      if (metadata["faultEvidence"] !== null || restartCount !== 0) {
        throw new Error(`${path} official headline contains fault/restart metadata`);
      }
    } else {
      faultEvidence = parseFaultEvidence(metadata["faultEvidence"], `${path}/metadata/faultEvidence`);
      if (restartCount !== (faultEvidence.status === "applied" ? 1 : 0)) {
        throw new Error(`${path} restart count does not match raw fault status`);
      }
    }

    let providerProcessVerification:
      | ReturnType<typeof verifyToolSandboxProviderProcessTrace>
      | undefined;
    let providerProcessInput:
      | Parameters<typeof verifyToolSandboxProviderProcessTrace>[0]
      | undefined;
    if (isV3) {
      if (providerProcessTracePath === undefined) {
        throw new Error(`${path} is missing provider process evidence`);
      }
      const providerSummary = record(
        metadata["providerProcess"],
        `${path}/metadata/providerProcess`,
      );
      const providerTraceAbsolute = resolve(inputRoot, providerProcessTracePath);
      if (
        resolve(
          nonempty(
            metadata["providerProcessTracePath"],
            `${path}/metadata/providerProcessTracePath`,
          ),
        ) !== providerTraceAbsolute ||
        resolve(
          nonempty(
            providerSummary["tracePath"],
            `${path}/metadata/providerProcess/tracePath`,
          ),
        ) !== providerTraceAbsolute ||
        sha(
          attempt["providerProcessTraceSha256"],
          `${path}/providerProcessTraceSha256`,
        ) !== rawMap.get(providerProcessTracePath)
      ) {
        throw new Error(`${path} provider process paths/hashes do not bind raw evidence`);
      }
      const providerTraceBytes = readBoundFile(
        outputRoot,
        providerProcessTracePath,
        rawMap.get(providerProcessTracePath)!,
      );
      providerProcessInput = {
        tracePath: providerTraceAbsolute,
        traceBytes: providerTraceBytes,
        summary: providerSummary,
        attemptId,
        arm,
        evaluationTrack,
        ...(faultEvidence === undefined ? {} : { faultEvidence }),
        runnerSha256: runnerHash,
        workerSha256:
          toolSandboxVerticalSlice.manifest.localHarness.providerProcessSha256,
        pythonExecutableSha256: sha256Bytes(
          readFileSync(invokedPythonExecutable),
        ),
      };
      providerProcessVerification =
        verifyToolSandboxProviderProcessTrace(providerProcessInput);
      if (
        providerProcessVerification.restartCount !== restartCount ||
        providerProcessVerification.providerAgent !== execution.agentModel ||
        providerSummary["restartSemantics"] !== V3_RESTART_SEMANTICS
      ) {
        throw new Error(`${path} provider process replay disagrees with runner metadata`);
      }
    }

    const resultSummary = parseJson(
      readBoundFile(outputRoot, resultSummaryPath, rawMap.get(resultSummaryPath)!),
      resultSummaryPath,
    );
    const rebuiltReceipt = toolSandboxVerticalSlice.createReceipt({
      batchId,
      attemptId,
      arm,
      evaluationTrack,
      completedAt: nonempty(metadata["completedAt"], `${path}/metadata/completedAt`),
      execution,
      ...(faultEvidence === undefined ? {} : { faultEvidence }),
      internalOutcome,
      upstreamResultSummary: resultSummary,
    });
    const embeddedReceipt = record(attempt["receipt"], `${path}/receipt`);
    const embeddedIntervention = record(
      embeddedReceipt["intervention"],
      `${path}/receipt/intervention`,
    );
    if (
      evaluationTrack === "restart_lost_response_derivative" &&
      isRecord(embeddedIntervention["evidence"]) &&
      embeddedIntervention["evidence"]["status"] !== faultEvidence?.status
    ) {
      throw new Error(`${path} embedded receipt claims a fault not supported by raw metadata`);
    }
    if (!jsonEqual(embeddedReceipt, rebuiltReceipt)) {
      throw new Error(`${path} arbitrary embedded receipt does not reconstruct from raw artifacts`);
    }
    const expectedReceiptPath = `${armRoot}/pm-receipt-${rebuiltReceipt.receiptHash}.json`;
    if (receiptPath !== expectedReceiptPath) {
      throw new Error(`${path}/receiptPath is not addressed by the reconstructed receipt`);
    }
    const receiptFile = parseJson(
      readBoundFile(outputRoot, receiptPath, rawMap.get(receiptPath)!),
      receiptPath,
    );
    if (!jsonEqual(receiptFile, rebuiltReceipt)) {
      throw new Error(`${path} receipt file does not match the reconstructed receipt`);
    }

    const executionContextBytes = readBoundFile(
      outputRoot,
      executionContextPath,
      rawMap.get(executionContextPath)!,
    );
    const executionContext = parseJson(executionContextBytes, executionContextPath);
    const prettyPrint = Buffer.from(
      readBoundFile(outputRoot, prettyPrintPath, rawMap.get(prettyPrintPath)!),
    ).toString("utf8");
    validateTrajectory(executionContext, prettyPrint, faultEvidence, path, isV3);

    let oracleReplay:
      | ReturnType<typeof runAndVerifyToolSandboxOracleReplay>
      | undefined;
    if (isV3) {
      oracleReplay = runAndVerifyToolSandboxOracleReplay({
        pythonExecutable: input.oraclePythonExecutable!,
        checkoutPath,
        executionContextPath: resolve(inputRoot, executionContextPath),
        resultSummaryPath: resolve(inputRoot, resultSummaryPath),
      });
      if (!oracleReplay.verified) {
        throw new Error(
          `${path} reported ToolSandbox result does not match clean oracle replay: ${oracleReplay.mismatchReasons.join(",")}`,
        );
      }
      if (
        oracleReplay.reportedResult.traceback !== null ||
        oracleReplay.reportedResult.exceptionType !== null
      ) {
        throw new Error(
          `${path} ToolSandbox harness/provider exception is not a completed benchmark attempt`,
        );
      }
      if (
        oracleReplay.receipt.oracle.metrics.similarity !==
          rebuiltReceipt.oracleOutcome.score ||
        oracleReplay.receipt.oracle.metrics.milestoneSimilarity !==
          rebuiltReceipt.oracleOutcome.milestoneSimilarity ||
        oracleReplay.receipt.oracle.metrics.minefieldSimilarity !==
          rebuiltReceipt.oracleOutcome.minefieldSimilarity ||
        oracleReplay.receipt.oracle.strictTaskSuccessRule.result !==
          rebuiltReceipt.oracleOutcome.strictTaskSuccess
      ) {
        throw new Error(`${path} receipt oracle fields disagree with clean replay`);
      }
    }

    const boundaryTracePathValue = attempt["boundaryTracePath"];
    const boundaryTraceHashValue = attempt["boundaryTraceSha256"];
    const actualBoundaryPath = `${armRoot}/boundary.jsonl`;
    const boundaryStatePath = `${armRoot}/boundary-state.json`;
    let boundaryTraceEntryCount = 0;
    if (arm === "native") {
      if (
        boundaryTracePathValue !== null ||
        boundaryTraceHashValue !== null ||
        rawMap.has(actualBoundaryPath) ||
        rawMap.has(boundaryStatePath) ||
        internalOutcome.admittedActionCount !== 0 ||
        internalOutcome.blockedActionCount !== 0
      ) {
        throw new Error(`${path} native arm must not contain boundary state or telemetry`);
      }
    } else if (rawMap.has(actualBoundaryPath)) {
      if (
        boundaryTracePathValue !== actualBoundaryPath ||
        sha(boundaryTraceHashValue, `${path}/boundaryTraceSha256`) !== rawMap.get(actualBoundaryPath)
      ) {
        throw new Error(`${path} boundary trace path/hash does not match raw inventory`);
      }
      if (!rawMap.has(boundaryStatePath)) {
        throw new Error(`${path} boundary trace is missing its durable boundary state`);
      }
      const boundaryText = Buffer.from(
        readBoundFile(outputRoot, actualBoundaryPath, rawMap.get(actualBoundaryPath)!),
      ).toString("utf8");
      const trace = validateBoundaryTrace(boundaryText, {
        arm,
        attemptId,
        evaluationTrack,
        statePath: resolve(inputRoot, boundaryStatePath),
        internalOutcome,
        ...(faultEvidence === undefined ? {} : { faultEvidence }),
      });
      boundaryTraceEntryCount = trace.entryCount;
      const state = parseJson(
        readBoundFile(outputRoot, boundaryStatePath, rawMap.get(boundaryStatePath)!),
        boundaryStatePath,
      );
      validateBoundaryState(state, {
        arm,
        attemptId,
        replayed: trace.finalState,
      });
    } else {
      if (
        boundaryTracePathValue !== null ||
        boundaryTraceHashValue !== null ||
        rawMap.has(boundaryStatePath) ||
        internalOutcome.admittedActionCount !== 0 ||
        internalOutcome.blockedActionCount !== 0 ||
        faultEvidence?.status === "applied"
      ) {
        throw new Error(`${path} missing boundary trace cannot support its claimed telemetry/fault`);
      }
    }

    let sidecarVerification:
      | ReturnType<typeof verifyToolSandboxSidecarEvidence>
      | undefined;
    let sidecarVerificationInput:
      | Parameters<typeof verifyToolSandboxSidecarEvidence>[0]
      | undefined;
    if (isV3 && arm !== "native") {
      if (sidecarBinding === undefined) {
        throw new Error(`${path} is missing its sidecar launch/evidence binding`);
      }
      const statePath = resolve(inputRoot, boundaryStatePath);
      const readyPath = resolve(inputRoot, sidecarBinding.readyPath);
      const finalReceiptPath = resolve(
        inputRoot,
        sidecarBinding.finalReceiptPath,
      );
      const auditPath = resolve(inputRoot, sidecarBinding.auditPath);
      const operationLedgerPath = resolve(
        inputRoot,
        sidecarBinding.operationLedgerPath,
      );
      sidecarVerificationInput = {
        arm,
        evaluationTrack,
        attemptId,
        statePath,
        auditPath,
        readyPath,
        finalReceiptPath,
        operationLedgerPath,
        stateLockPath: `${statePath}.sidecar.lock`,
        expectedPid: sidecarBinding.pid,
        expectedPpid: sidecarBinding.ppid,
        expectedNodePath: sidecarBinding.nodePath,
        expectedNodeSha256: sidecarBinding.nodeSha256,
        expectedEntryPath: sidecarBinding.entryPath,
        expectedEntrySha256: sidecarBinding.entrySha256,
        expectedRuntimeModuleClosure: sidecarBinding.runtimeModuleClosure,
        expectedTokenSha256: sidecarBinding.tokenSha256,
        readyBytes: readBoundFile(
          outputRoot,
          sidecarBinding.readyPath,
          rawMap.get(sidecarBinding.readyPath)!,
        ),
        finalReceiptBytes: readBoundFile(
          outputRoot,
          sidecarBinding.finalReceiptPath,
          rawMap.get(sidecarBinding.finalReceiptPath)!,
        ),
        auditBytes: readBoundFile(
          outputRoot,
          sidecarBinding.auditPath,
          rawMap.get(sidecarBinding.auditPath)!,
        ),
        operationLedgerBytes: readBoundFile(
          outputRoot,
          sidecarBinding.operationLedgerPath,
          rawMap.get(sidecarBinding.operationLedgerPath)!,
        ),
        clientTraceBytes: rawMap.has(actualBoundaryPath)
          ? readBoundFile(
              outputRoot,
              actualBoundaryPath,
              rawMap.get(actualBoundaryPath)!,
            )
          : Buffer.alloc(0),
      };
      sidecarVerification = verifyToolSandboxSidecarEvidence(
        sidecarVerificationInput,
      );
    }

    const trajectoryCrossVerification = isV3
      ? (() => {
          if (providerProcessInput === undefined) {
            throw new Error(`${path} lacks raw provider input for trajectory binding`);
          }
          if (oracleReplay === undefined) {
            throw new Error(`${path} lacks verifier-selected starting-context evidence`);
          }
          const verification = verifyToolSandboxTrajectoryCrossEvidence({
            executionContextBytes,
            providerProcess: providerProcessInput,
            oracleStartingContext: oracleReplay.receipt.startingContext,
            ...(sidecarVerificationInput === undefined
              ? {}
              : { sidecar: sidecarVerificationInput }),
          });
          if (
            providerProcessVerification === undefined ||
            verification.providerTraceSha256 !==
              providerProcessVerification.traceSha256 ||
            verification.providerContextExchangeCount !==
              providerProcessVerification.contextExchangeCount ||
            verification.restartCount !==
              providerProcessVerification.restartCount ||
            verification.successorContextResponseCount !==
              providerProcessVerification.successorContextResponseCount ||
            verification.messagingDeltaCount !==
              verification.successfulSendCount ||
            (sidecarVerification !== undefined &&
              (verification.sidecarClientTraceSha256 !==
                sidecarVerification.clientTraceSha256 ||
                verification.sidecarAdmitCount +
                  verification.sidecarOutcomeCount !==
                  sidecarVerification.clientTraceRecordCount)) ||
            (sidecarVerification === undefined &&
              (verification.sidecarClientTraceSha256 !== null ||
                verification.sidecarAdmitCount !== 0 ||
                verification.sidecarOutcomeCount !== 0)) ||
            (faultEvidence?.status === "applied" &&
              verification.lostResponseRestartBindingCount !== 1) ||
            (faultEvidence?.status !== "applied" &&
              verification.lostResponseRestartBindingCount !== 0)
          ) {
            throw new Error(
              `${path} cross-boundary trajectory replay disagrees with raw provider/sidecar evidence`,
            );
          }
          return verification;
        })()
      : undefined;

    receipts.push(rebuiltReceipt);
    const faultStatus: "not_scheduled" | ToolSandboxFaultEvidence["status"] =
      faultEvidence?.status ?? "not_scheduled";
    const commonVerifiedAttempt = {
      order,
      arm,
      attemptId,
      rawArtifactRootHash: sha256Json(rawArtifacts),
      receiptHash: rebuiltReceipt.receiptHash,
      resultSummaryHash: rebuiltReceipt.upstream.resultSummaryHash,
      reportedOracleScore: rebuiltReceipt.oracleOutcome.score,
      reportedStrictTaskSuccess: rebuiltReceipt.oracleOutcome.strictTaskSuccess,
      faultStatus,
      boundaryTraceEntryCount,
      trajectoryStructureVerified: true as const,
    };
    if (isV3) {
      if (
        oracleReplay === undefined ||
        providerProcessVerification === undefined ||
        trajectoryCrossVerification === undefined
      ) {
        throw new Error(`${path} lacks mandatory v3 replay results`);
      }
      const sidecarRequestCount =
        sidecarVerification?.clientTraceRecordCount ?? 0;
      verifiedAttemptsV3.push({
        ...commonVerifiedAttempt,
        recomputedOracleScore: oracleReplay.receipt.oracle.metrics.similarity,
        recomputedStrictTaskSuccess:
          oracleReplay.receipt.oracle.strictTaskSuccessRule.result,
        oracleReplayVerificationHash: oracleReplay.verificationHash,
        oracleRuntimeExecutablePath:
          oracleReplay.bindings.pythonRuntime.launcherPath,
        oracleRuntimeExecutableSha256:
          oracleReplay.bindings.pythonRuntime.sha256,
        oracleRuntimeEnvironmentSanitized: true,
        oracleRuntimeExternallyAttested: false,
        sidecarProtocolRequestCount: sidecarRequestCount,
        sidecarEvidenceVerified: sidecarVerification !== undefined,
        realSidecarProtocolExercised: sidecarRequestCount > 0,
        providerProcessTraceEntryCount:
          providerProcessVerification.traceEntryCount,
        providerProcessInstanceCount:
          providerProcessVerification.processInstanceCount,
        providerAgent: providerProcessVerification.providerAgent,
        actualOsProcessRestartVerified:
          providerProcessVerification.actualOsProcessRestartVerified,
        providerFramesBoundToRetainedTrajectory: true,
        sidecarExchangesBoundToRetainedTrajectory:
          arm === "native" ? "not_applicable" : true,
        postRestartSuccessorResumptionBoundToTrajectory:
          faultEvidence?.status === "applied" ? true : "not_applicable",
        trajectoryCrossVerificationHash:
          trajectoryCrossVerification.crossVerificationHash,
        startingContextNormalizedSha256:
          trajectoryCrossVerification.startingContextNormalizedSha256,
        startingContextNormalizationPolicyId:
          trajectoryCrossVerification.startingContextNormalizationPolicyId,
        startingContextVolatileTimestampCount:
          trajectoryCrossVerification.startingContextVolatileTimestampCount,
        startingContextBoundExceptDocumentedVolatileTimestamps:
          trajectoryCrossVerification.startingContextBoundExceptDocumentedVolatileTimestamps,
        successfulSendCount: trajectoryCrossVerification.successfulSendCount,
        messagingDeltaCount: trajectoryCrossVerification.messagingDeltaCount,
        postRestartExactRetryCount:
          trajectoryCrossVerification.postRestartExactRetryCount,
        postRestartRetryDisposition:
          trajectoryCrossVerification.postRestartRetryDisposition,
        postRestartRetryAllowedCount:
          trajectoryCrossVerification.postRestartRetryAllowedCount,
        postRestartRetryBlockedCount:
          trajectoryCrossVerification.postRestartRetryBlockedCount,
        postRestartRetryExecutedCount:
          trajectoryCrossVerification.postRestartRetryExecutedCount,
        postRestartRetrySuccessfulSendCount:
          trajectoryCrossVerification.postRestartRetrySuccessfulSendCount,
        postRestartRetryDuplicateResponseBlockCount:
          trajectoryCrossVerification.postRestartRetryDuplicateResponseBlockCount,
        duplicateTargetSideEffectCount:
          trajectoryCrossVerification.duplicateTargetSideEffectCount,
        sidecarRuntimeModuleClosureHash:
          sidecarVerification?.runtimeModuleClosureHash ?? null,
        upstreamOracleRecomputedFromRawTrajectory: true,
      });
    } else {
      verifiedAttemptsV2.push({
        ...commonVerifiedAttempt,
        upstreamOracleRecomputedFromRawTrajectory: false,
      });
    }
  }

  if (
    expectedPaths.size !== observed.size ||
    [...observed.keys()].some((path) => !expectedPaths.has(path))
  ) {
    const missing = [...expectedPaths].filter((path) => !observed.has(path));
    const extra = [...observed.keys()].filter((path) => !expectedPaths.has(path));
    throw new Error(
      `output-root inventory mismatch (missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"})`,
    );
  }
  const rebuiltSummary = toolSandboxVerticalSlice.verifyReceiptSet(receipts);
  if (!jsonEqual(batch["summary"], rebuiltSummary)) {
    throw new Error("batch summary does not recompute from raw reconstructed receipts");
  }
  const finalInventory = walkInventory(outputRoot);
  if (!jsonEqual(observedInventory, finalInventory)) {
    throw new Error("output-root bytes changed during verification");
  }
  const commonBody = {
    manifestHash: toolSandboxVerticalSlice.manifest.manifestHash,
    batchId,
    batchHash,
    batchFileSha256,
    evaluationTrack,
    checkout: { ...checkout, clean: true as const },
    inventory: {
      fileCount: observedInventory.length,
      rawArtifactCount: observedInventory.length - 1,
      rootHash: sha256Json(observedInventory),
    },
  } as const;
  if (isV3) {
    const nonNativeAttempts = verifiedAttemptsV3.filter(
      (attempt) => attempt.arm !== "native",
    );
    if (
      verifiedAttemptsV3.length !== ARMS.length ||
      nonNativeAttempts.length !== 2 ||
      nonNativeAttempts.some((attempt) => !attempt.sidecarEvidenceVerified)
    ) {
      throw new Error("v3 verification did not replay all provider/sidecar evidence");
    }
    const body = {
      schemaVersion: "pm.public-eval.toolsandbox-raw-verification.v3" as const,
      verifier: {
        id: VERIFIER_ID,
        revision: V3_VERIFIER_REVISION,
        mode: "independent_recomputation_from_raw_artifacts" as const,
      },
      claimBoundary: {
        artifactIntegrityAndConformanceOnly: true as const,
        independentSigner: false as const,
        efficacyFinding: false as const,
        statement:
          "This same-package verifier replayed the clean pinned upstream oracle from every retained trajectory, both authenticated HTTP-sidecar ledgers against exact client/server bytes, every provider-worker process lifecycle, and all raw artifact and receipt bindings. It is not an independent signature and does not establish pm-substrate efficacy.",
      },
      executionBoundary: {
        substrateTreatment: V3_SUBSTRATE_TREATMENT,
        invocationPath: V3_INVOCATION_PATH,
        realHttpMcpSidecarProtocolExercised: nonNativeAttempts.every(
          (attempt) => attempt.realSidecarProtocolExercised,
        ),
        verifiedRealSidecarProtocolReceipt: true as const,
        providerRoleOutOfProcessEveryArm: true as const,
        actualOsProcessRestartObserved: verifiedAttemptsV3.some(
          (attempt) => attempt.actualOsProcessRestartVerified,
        ),
        restartSemantics: V3_RESTART_SEMANTICS,
      },
      ...commonBody,
      scriptedStdin,
      attempts: verifiedAttemptsV3,
    } as const;
    return { ...body, verificationHash: sha256Json(body) };
  }
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-raw-verification.v2" as const,
    verifier: {
      id: VERIFIER_ID,
      revision: VERIFIER_REVISION,
      mode: "independent_recomputation_from_raw_artifacts" as const,
    },
    claimBoundary: {
      artifactIntegrityAndConformanceOnly: true as const,
      independentSigner: false as const,
      efficacyFinding: false as const,
      statement:
        "This same-package verifier recomputed raw artifact, checkout, harness, receipt, and reported-result bindings plus limited trajectory structure. It did not rerun the upstream oracle from the retained trajectory, is not an independent signature, and does not establish pm-substrate efficacy.",
    },
    executionBoundary: {
      substrateTreatment: CURRENT_SUBSTRATE_TREATMENT,
      invocationPath: CURRENT_INVOCATION_PATH,
      realHttpMcpSidecarProtocolExercised: false as const,
      verifiedRealSidecarProtocolReceipt: false as const,
      restartSemantics: CURRENT_RESTART_SEMANTICS,
    },
    ...commonBody,
    attempts: verifiedAttemptsV2,
  } as const;
  return { ...body, verificationHash: sha256Json(body) };
}

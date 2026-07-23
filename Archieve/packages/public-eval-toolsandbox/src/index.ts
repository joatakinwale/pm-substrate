import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildActionOutcomeEnvelope,
  buildActionOutcomeTerminalIndex,
  buildReadSetFromCurrentStateView,
  reviewExternalStateEvidence,
  reviewProposedActionAgainstCurrentState,
  stateRef,
  type ActionOutcomeTerminalIndex,
  type CurrentStateView,
  type EvidenceAuthorityStatus,
  type ExternalStateEvidence,
} from "@pm/agent-state-core";
import { tenantId, timestamp } from "@pm/types";

import { startToolSandboxSidecarProcess } from "./sidecar-supervisor.js";
import type {
  ToolSandboxArm,
  ToolSandboxAttemptInput,
  ToolSandboxAttemptReceipt,
  ToolSandboxBoundaryArm,
  ToolSandboxEvaluationTrack,
  ToolSandboxExecutionBinding,
  ToolSandboxFaultEvidence,
  ToolSandboxHeadlineQualificationInput,
  ToolSandboxInternalOutcome,
  ToolSandboxMatchedBatchArtifact,
  ToolSandboxMatchedBatchInput,
  ToolSandboxQualificationArtifact,
  ToolSandboxReceiptSetSummary,
  ToolSandboxToolOutcomeInput,
  ToolSandboxToolProposalDecision,
  ToolSandboxToolProposalInput,
} from "./types.js";

export type {
  ToolSandboxArm,
  ToolSandboxAttemptInput,
  ToolSandboxAttemptReceipt,
  ToolSandboxBoundaryArm,
  ToolSandboxEvaluationTrack,
  ToolSandboxExecutionBinding,
  ToolSandboxFaultEvidence,
  ToolSandboxHeadlineQualificationInput,
  ToolSandboxInternalOutcome,
  ToolSandboxMatchedBatchArtifact,
  ToolSandboxMatchedBatchInput,
  ToolSandboxQualificationArtifact,
  ToolSandboxReceiptSetSummary,
  ToolSandboxToolOutcomeInput,
  ToolSandboxToolProposalDecision,
  ToolSandboxToolProposalInput,
} from "./types.js";

const REPOSITORY_URL = "https://github.com/apple/ToolSandbox";
const REVISION = "165848b9a78cead7ca7fe7c89c688b58e6501219";
const SCENARIO =
  "send_message_with_contact_content_cellular_off_multiple_user_turn";
const RECEIPT_SCHEMA = "pm.public-eval.toolsandbox-receipt.v2" as const;
const SUMMARY_SCHEMA = "pm.public-eval.toolsandbox-batch-summary.v2" as const;
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ARMS: readonly ToolSandboxArm[] = ["native", "sham", "substrate"];
const EVAL_TENANT = tenantId("tenant_public_eval");
const DURABLE_SIDE_EFFECT_TOOLS = ["send_message_with_phone_number"] as const;
const STARTING_CONTEXT_NORMALIZATION_POLICY =
  "pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1" as const;
const NORMALIZED_STARTING_CONTEXT_SHA256 =
  "62717eafc44807b3b6729f8c5b5f0f47fbeffba30093c421d90689ac30da2d04" as const;

const CORPUS_FILES = [
  {
    path: "tool_sandbox/scenarios/multiple_user_turn_scenarios.py",
    sha256: "784c636140afbb452e94df301191f466f6d06929d3eebec13ba1a66992a74baf",
  },
  {
    path: "tool_sandbox/scenarios/base_scenarios.py",
    sha256: "226bc95508de98b9abda46d209e8a7d6232b9afeae9c949021198916c4401f9d",
  },
  {
    path: "tool_sandbox/scenarios/user_simulator_few_shot_examples.py",
    sha256: "3ae184a73c6f6bed0d00d7c14f644331ab97a6189f32adc8184698fb1b8d3731",
  },
  {
    path: "tool_sandbox/common/scenario.py",
    sha256: "95ca3ec161a8a66d98bfb1e00516a99c9f849f91bf10933e2d08aeb601543eb9",
  },
  {
    path: "tool_sandbox/common/evaluation.py",
    sha256: "0425cff032bd1ca2ebe8cc1c875cdf2ea86463af24b2940734007d938e516ab3",
  },
  {
    path: "tool_sandbox/common/execution_context.py",
    sha256: "a18f54e157b92fa011e84780bc33941ea0635ad70ab4b38e7408beedc6221437",
  },
  {
    path: "tool_sandbox/tools/contact.py",
    sha256: "af2b97be6b03d1acf44cd2e34465942622a3453d9e052099a1028e0d17361a49",
  },
  {
    path: "tool_sandbox/tools/messaging.py",
    sha256: "d992831c735c44167b46f67ff45b11ad37fa70df951ebe9eac283c4b44e5607c",
  },
  {
    path: "tool_sandbox/tools/setting.py",
    sha256: "01cd0c5f45cc6ceadcd5935369f1260585bbc99852562ca30f81771b56a18e97",
  },
  {
    path: "tool_sandbox/cli/__init__.py",
    sha256: "2c659ec124f7ec7cb64e1a133e6fc935d96bc39831199f976b839d3f461f895c",
  },
  {
    path: "tool_sandbox/cli/utils.py",
    sha256: "43ebded7eac3fb3af5ae72f34bc87528aae544bd7b0f421688addc6a4be09897",
  },
] as const;

const CORPUS_HASH =
  "0166e8e4f0e6b955a84401e3ba45304b876409d8fcea2cc286a5a607e40546ef";

const MATCHED_RUNNER_PATH = fileURLToPath(
  new URL("../upstream/matched_runner.py", import.meta.url),
);
const PROVIDER_PROCESS_PATH = fileURLToPath(
  new URL("../upstream/provider_process.py", import.meta.url),
);
const ORACLE_REPLAY_PATH = fileURLToPath(
  new URL("../upstream/replay_oracle.py", import.meta.url),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot hash a non-finite number");
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

const MATCHED_RUNNER_SHA256 = sha256Bytes(readFileSync(MATCHED_RUNNER_PATH));
const PROVIDER_PROCESS_SHA256 = sha256Bytes(readFileSync(PROVIDER_PROCESS_PATH));
const ORACLE_REPLAY_SHA256 = sha256Bytes(readFileSync(ORACLE_REPLAY_PATH));

function jsonSnapshot(value: unknown): unknown {
  return JSON.parse(canonicalStringify(value)) as unknown;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requiredRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function requiredId(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!ID.test(parsed)) throw new Error(`${path} is not a portable identifier`);
  return parsed;
}

function requiredInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${path} must be a non-negative safe integer`);
  }
  return value as number;
}

function unitNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be a finite number in [0, 1]`);
  }
  return value;
}

function exactIsoTimestamp(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  const epoch = Date.parse(parsed);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== parsed) {
    throw new Error(`${path} must be a normalized ISO-8601 timestamp`);
  }
  return parsed;
}

function stringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  const result = value.map((entry, index) =>
    requiredString(entry, `${path}/${index}`),
  );
  if (new Set(result).size !== result.length) {
    throw new Error(`${path} must not contain duplicates`);
  }
  return result;
}

function parseMapping(
  value: unknown,
  path: string,
  nodeCount: number,
): Readonly<Record<string, readonly [number, number]>> {
  const record = requiredRecord(value, path);
  const result: Record<string, readonly [number, number]> = {};
  for (const [key, entry] of Object.entries(record)) {
    const nodeIndex = Number(key);
    if (!Number.isSafeInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= nodeCount) {
      throw new Error(`${path}/${key} is outside the benchmark-owned node set`);
    }
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error(`${path}/${key} must be [turn, similarity]`);
    }
    result[key] = [
      requiredInteger(entry[0], `${path}/${key}/0`),
      unitNumber(entry[1], `${path}/${key}/1`),
    ];
  }
  return result;
}

const manifestBody = {
  schemaVersion: "pm.public-eval.toolsandbox-manifest.v4",
  benchmark: {
    owner: "apple/ToolSandbox",
    repositoryUrl: REPOSITORY_URL,
    revision: REVISION,
    scenario: SCENARIO,
    scenarioSourceUrl: `${REPOSITORY_URL}/blob/${REVISION}/tool_sandbox/scenarios/multiple_user_turn_scenarios.py#L815-L910`,
    corpus: {
      algorithm: "sha256-canonical-file-list-v1",
      files: CORPUS_FILES,
      hash: CORPUS_HASH,
    },
  },
  arms: [
    { id: "native", stateTreatment: "benchmark-native agent only" },
    {
      id: "sham",
      stateTreatment:
        "equal authenticated HTTP-sidecar interface with unrelated durable state",
    },
    {
      id: "substrate",
      stateTreatment:
        "authenticated HTTP sidecar over the @pm/agent-state-core peripheral adapter",
    },
  ],
  evaluationTracks: [
    {
      id: "official_headline",
      upstreamScenarioUnmodified: true,
      headlineEligible: true,
      intervention: null,
    },
    {
      id: "restart_lost_response_derivative",
      upstreamScenarioUnmodified: false,
      headlineEligible: false,
      intervention: {
        id: "restart_after_first_send_response_lost",
        targetTool: "send_message_with_phone_number",
        trigger:
          "after target side effect, before first successful tool response is observed",
        effect:
          "persist the target outcome, replace the response, SIGKILL and reap the provider process group, then start a distinct provider process",
      },
    },
  ],
  oracle: {
    owner: "apple/ToolSandbox",
    artifact: "result_summary.json",
    resultPath: `per_scenario_results[name=${SCENARIO}]`,
    milestoneCount: 4,
    milestoneEdges: [
      [0, 2],
      [1, 2],
      [2, 3],
    ],
    minefieldCount: 0,
    minefieldEdges: [],
    strictTaskSuccessRule:
      "upstream similarity=1, milestone_similarity=1, minefield_similarity=0, and all four upstream milestones match exactly",
    internalBlocksAffectTaskSuccess: false,
  },
  localHarness: {
    runnerSchemaVersion: "pm.public-eval.toolsandbox-arm-run.v3",
    runnerSha256: MATCHED_RUNNER_SHA256,
    providerProcessSha256: PROVIDER_PROCESS_SHA256,
    oracleReplaySha256: ORACLE_REPLAY_SHA256,
    startingContextBinding: {
      normalizationRuleId: STARTING_CONTEXT_NORMALIZATION_POLICY,
      normalizedContextSha256: NORMALIZED_STARTING_CONTEXT_SHA256,
      volatileTimestampValueCount: 11,
    },
    boundaryProtocol: "authenticated_loopback_http_json_v1",
    stateMechanism:
      "@pm/agent-state-core ActionOutcomeEnvelope terminal index over adapter-mapped side effects",
    durableSideEffectTools: DURABLE_SIDE_EFFECT_TOOLS,
  },
} as const;

const manifest = deepFreeze({
  ...manifestBody,
  manifestHash: sha256Json(manifestBody),
});

interface BoundaryDecisionRecord {
  readonly proposalId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly fingerprint: string;
  readonly decision: "allow" | "block";
  readonly decisionHash: string;
}

interface BoundaryOutcomeRecord {
  readonly proposalId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly fingerprint: string;
  readonly succeeded: boolean;
  readonly responseHash: string;
  readonly observedAt: string;
  readonly outcomeHash: string;
}

interface BoundaryState {
  readonly schemaVersion: "pm.public-eval.toolsandbox-boundary-state.v1";
  readonly arm: ToolSandboxBoundaryArm;
  readonly attemptId: string;
  readonly sequence: number;
  readonly irrelevantState: {
    readonly paddingRef: string;
    readonly paddingValue: string;
  };
  readonly delivered: Readonly<
    Record<
      string,
      {
        readonly proposalId: string;
        readonly outcomeHash: string;
        readonly observedAt: string;
      }
    >
  >;
  readonly decisions: readonly BoundaryDecisionRecord[];
  readonly outcomes: readonly BoundaryOutcomeRecord[];
  readonly stateHash: string;
}

function boundaryStateBody(
  state: Omit<BoundaryState, "stateHash">,
): Omit<BoundaryState, "stateHash"> {
  return state;
}

function initialBoundaryState(
  arm: ToolSandboxBoundaryArm,
  attemptId: string,
): BoundaryState {
  const body = boundaryStateBody({
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

function readBoundaryState(
  path: string,
  arm: ToolSandboxBoundaryArm,
  attemptId: string,
): BoundaryState {
  if (!existsSync(path)) return initialBoundaryState(arm, attemptId);
  const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const record = requiredRecord(value, "/boundaryState");
  if (
    record["schemaVersion"] !==
      "pm.public-eval.toolsandbox-boundary-state.v1" ||
    record["arm"] !== arm ||
    record["attemptId"] !== attemptId
  ) {
    throw new Error("boundary state identity does not match this attempt");
  }
  const { stateHash, ...body } = record;
  if (typeof stateHash !== "string" || stateHash !== sha256Json(body)) {
    throw new Error("boundary state content hash does not recompute");
  }
  return value as BoundaryState;
}

function writeBoundaryState(path: string, state: BoundaryState): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let temporaryDescriptor: number | undefined;
  try {
    temporaryDescriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(temporaryDescriptor, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
    });
    fsyncSync(temporaryDescriptor);
    closeSync(temporaryDescriptor);
    temporaryDescriptor = undefined;
    renameSync(temporary, path);

    // Atomic rename protects readers from partial bytes; syncing the directory
    // makes the new name durable before a sidecar can acknowledge the write.
    const directoryDescriptor = openSync(directory, "r");
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
  } catch (error) {
    if (temporaryDescriptor !== undefined) closeSync(temporaryDescriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

function parseBoundaryArm(value: unknown): ToolSandboxBoundaryArm {
  if (value !== "sham" && value !== "substrate") {
    throw new Error("/arm must be sham or substrate at the state boundary");
  }
  return value;
}

function jsonRecord(value: unknown, path: string): Readonly<Record<string, unknown>> {
  const record = requiredRecord(value, path);
  jsonSnapshot(record);
  return record;
}

function toolFingerprint(
  toolName: string,
  arguments_: Readonly<Record<string, unknown>>,
): string {
  return sha256Json({ toolName, arguments: arguments_ });
}

function boundaryTerminalIndex(state: BoundaryState): ActionOutcomeTerminalIndex {
  const envelopes = state.outcomes.flatMap((outcome) => {
    if (
      !outcome.succeeded ||
      !DURABLE_SIDE_EFFECT_TOOLS.includes(
        outcome.toolName as (typeof DURABLE_SIDE_EFFECT_TOOLS)[number],
      )
    ) {
      return [];
    }
    const decision = state.decisions.find(
      (candidate) => candidate.proposalId === outcome.proposalId,
    );
    if (decision === undefined || decision.decision !== "allow") {
      throw new Error("durable side effect has no admitted proposal");
    }
    return [
      buildActionOutcomeEnvelope({
        tenantId: EVAL_TENANT,
        actionId: `toolsandbox-effect:${outcome.fingerprint}`,
        subject: stateRef("source_record", `toolsandbox:${state.attemptId}`),
        proposalReviewId: outcome.proposalId,
        stateReviewArtifactHash: decision.decisionHash,
        requestedTerminalOutcome: "accepted",
        decidedAt: timestamp(outcome.observedAt),
        decidedBy: "toolsandbox:target-side-effect",
        evidenceRefs: [
          stateRef("source_record", `tool-response:${outcome.responseHash}`),
        ],
        substrateRefs: [
          stateRef("action_outcome_envelope", outcome.fingerprint),
        ],
      }),
    ];
  });
  const index = buildActionOutcomeTerminalIndex(envelopes);
  if (!index.valid) {
    throw new Error("durable side-effect outcome index is invalid");
  }
  return index;
}

function admitToolProposal(
  input: ToolSandboxToolProposalInput,
): ToolSandboxToolProposalDecision {
  if (input.schemaVersion !== "pm.public-eval.toolsandbox-tool-proposal.v1") {
    throw new Error("invalid ToolSandbox tool proposal schemaVersion");
  }
  const arm = parseBoundaryArm(input.arm);
  const evaluationTrack = parseEvaluationTrack(input.evaluationTrack);
  const attemptId = requiredId(input.attemptId, "/attemptId");
  const sessionId = requiredId(input.sessionId, "/sessionId");
  const toolCallId = requiredId(input.toolCallId, "/toolCallId");
  const toolName = requiredId(input.toolName, "/toolName");
  const arguments_ = jsonRecord(input.arguments, "/arguments");
  const proposedAt = timestamp(exactIsoTimestamp(input.proposedAt, "/proposedAt"));
  const statePath = resolve(requiredString(input.statePath, "/statePath"));
  const state = readBoundaryState(statePath, arm, attemptId);
  const fingerprint = toolFingerprint(toolName, arguments_);
  const terminal = boundaryTerminalIndex(state).entries.find(
    (entry) => entry.actionId === `toolsandbox-effect:${fingerprint}`,
  );
  const duplicateTargetWrite =
    arm === "substrate" &&
    DURABLE_SIDE_EFFECT_TOOLS.includes(
      toolName as (typeof DURABLE_SIDE_EFFECT_TOOLS)[number],
    ) &&
    terminal !== undefined;
  const subject = stateRef("source_record", `toolsandbox:${attemptId}`);
  const evidenceRef = duplicateTargetWrite
    ? stateRef("source_record", `target-receipt:${terminal.envelope.outcomeHash}`)
    : stateRef(
        "source_record",
        arm === "sham"
          ? state.irrelevantState.paddingRef
          : `scenario-state:${SCENARIO}`,
      );
  const actionType = `toolsandbox.tool.${toolName}`;
  const allowedActions = duplicateTargetWrite
    ? []
    : [
        {
          actionType,
          label: `Execute ToolSandbox tool ${toolName}`,
          requiredRefs: [evidenceRef],
        },
      ];
  const view: CurrentStateView = {
    tenantId: EVAL_TENANT,
    viewId: `${attemptId}:${evaluationTrack}:${sessionId}:${state.sequence + 1}`,
    subject,
    observedAt: proposedAt,
    authorityRule:
      arm === "substrate"
        ? "durable target receipts govern duplicate writes"
        : "sham state is non-authoritative padding",
    sourceRefs: [evidenceRef],
    missingSources: [],
    conflicts: [],
    allowedActions,
  };
  const action = {
    tenantId: EVAL_TENANT,
    actionType,
    subject,
    payload: arguments_,
    readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
    proposedBy: `toolsandbox-agent:${sessionId}`,
    proposedAt,
  } as const;
  const fullReview = reviewProposedActionAgainstCurrentState(action, view, {
    evaluatedAt: proposedAt,
    enforcementMode: "blocking",
  });
  const decision = fullReview.execution.allowed ? "allow" : "block";
  const proposalId = `${attemptId}:proposal:${state.sequence + 1}`;
  const review = {
    valid: fullReview.valid,
    execution: fullReview.execution,
    warnings: fullReview.warnings,
  };
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-tool-decision.v1",
    proposalId,
    arm,
    decision,
    responseForAgent:
      decision === "block"
        ? "Durable target receipt confirms this exact message was already applied before the session restart. Do not send it again; report the original operation as completed."
        : null,
    fingerprint,
    review,
    stateHashBefore: state.stateHash,
  } as const;
  const result = deepFreeze({ ...body, decisionHash: sha256Json(body) });
  const nextBody = boundaryStateBody({
    schemaVersion: state.schemaVersion,
    arm,
    attemptId,
    sequence: state.sequence + 1,
    irrelevantState: state.irrelevantState,
    delivered: state.delivered,
    decisions: [
      ...state.decisions,
      {
        proposalId,
        toolCallId,
        toolName,
        fingerprint,
        decision,
        decisionHash: result.decisionHash,
      },
    ],
    outcomes: state.outcomes,
  });
  writeBoundaryState(statePath, {
    ...nextBody,
    stateHash: sha256Json(nextBody),
  });
  return result;
}

function recordToolOutcome(input: ToolSandboxToolOutcomeInput): {
  readonly schemaVersion: "pm.public-eval.toolsandbox-tool-outcome-receipt.v1";
  readonly proposalId: string;
  readonly fingerprint: string;
  readonly targetSideEffectReceiptHash: string;
  readonly stateHash: string;
} {
  if (input.schemaVersion !== "pm.public-eval.toolsandbox-tool-outcome.v1") {
    throw new Error("invalid ToolSandbox tool outcome schemaVersion");
  }
  const arm = parseBoundaryArm(input.arm);
  const attemptId = requiredId(input.attemptId, "/attemptId");
  const proposalId = requiredId(input.proposalId, "/proposalId");
  const toolCallId = requiredId(input.toolCallId, "/toolCallId");
  const toolName = requiredId(input.toolName, "/toolName");
  const arguments_ = jsonRecord(input.arguments, "/arguments");
  if (typeof input.succeeded !== "boolean") {
    throw new Error("/succeeded must be boolean");
  }
  if (!SHA256.test(input.responseHash)) {
    throw new Error("/responseHash must be a lowercase SHA-256");
  }
  const observedAt = exactIsoTimestamp(input.observedAt, "/observedAt");
  const statePath = resolve(requiredString(input.statePath, "/statePath"));
  const state = readBoundaryState(statePath, arm, attemptId);
  const decision = state.decisions.find(
    (candidate) => candidate.proposalId === proposalId,
  );
  if (
    decision === undefined ||
    decision.toolCallId !== toolCallId ||
    decision.toolName !== toolName ||
    decision.decision !== "allow"
  ) {
    throw new Error("tool outcome does not match an allowed proposal");
  }
  const fingerprint = toolFingerprint(toolName, arguments_);
  if (fingerprint !== decision.fingerprint) {
    throw new Error("tool outcome arguments do not match the admitted proposal");
  }
  const outcomeBody = {
    proposalId,
    toolCallId,
    toolName,
    fingerprint,
    succeeded: input.succeeded,
    responseHash: input.responseHash,
    observedAt,
  } as const;
  const outcomeHash = sha256Json(outcomeBody);
  const outcome: BoundaryOutcomeRecord = { ...outcomeBody, outcomeHash };
  const delivered =
    input.succeeded && toolName === "send_message_with_phone_number"
      ? {
          ...state.delivered,
          [fingerprint]: { proposalId, outcomeHash, observedAt },
        }
      : state.delivered;
  const nextBody = boundaryStateBody({
    schemaVersion: state.schemaVersion,
    arm,
    attemptId,
    sequence: state.sequence + 1,
    irrelevantState: state.irrelevantState,
    delivered,
    decisions: state.decisions,
    outcomes: [...state.outcomes, outcome],
  });
  const nextState = { ...nextBody, stateHash: sha256Json(nextBody) };
  writeBoundaryState(statePath, nextState);
  return deepFreeze({
    schemaVersion: "pm.public-eval.toolsandbox-tool-outcome-receipt.v1",
    proposalId,
    fingerprint,
    targetSideEffectReceiptHash: outcomeHash,
    stateHash: nextState.stateHash,
  });
}

function parseExecution(value: unknown): ToolSandboxExecutionBinding {
  const record = requiredRecord(value, "/execution");
  return {
    agentModel: requiredString(record["agentModel"], "/execution/agentModel"),
    userSimulatorModel: requiredString(
      record["userSimulatorModel"],
      "/execution/userSimulatorModel",
    ),
    toolBackend: requiredString(record["toolBackend"], "/execution/toolBackend"),
    seed: requiredString(record["seed"], "/execution/seed"),
    maxTurns: requiredInteger(record["maxTurns"], "/execution/maxTurns"),
  };
}

function parseFaultEvidence(value: unknown): ToolSandboxFaultEvidence {
  const record = requiredRecord(value, "/faultEvidence");
  if (record["status"] === "applied") {
    const receiptHash = requiredString(
      record["targetSideEffectReceiptHash"],
      "/faultEvidence/targetSideEffectReceiptHash",
    );
    if (!SHA256.test(receiptHash)) {
      throw new Error("/faultEvidence/targetSideEffectReceiptHash must be a lowercase SHA-256");
    }
    return {
      status: "applied",
      targetCallId: requiredId(record["targetCallId"], "/faultEvidence/targetCallId"),
      targetSideEffectReceiptHash: receiptHash,
      restartedAgentSessionId: requiredId(
        record["restartedAgentSessionId"],
        "/faultEvidence/restartedAgentSessionId",
      ),
      appliedAtTurn: requiredInteger(
        record["appliedAtTurn"],
        "/faultEvidence/appliedAtTurn",
      ),
    };
  }
  if (record["status"] === "trigger_not_reached") {
    return {
      status: "trigger_not_reached",
      reason: requiredString(record["reason"], "/faultEvidence/reason"),
    };
  }
  throw new Error("/faultEvidence/status must be applied or trigger_not_reached");
}

function parseInternalOutcome(value: unknown): ToolSandboxInternalOutcome {
  const record = requiredRecord(value, "/internalOutcome");
  if (typeof record["haltedByInternalBlock"] !== "boolean") {
    throw new Error("/internalOutcome/haltedByInternalBlock must be boolean");
  }
  return {
    admittedActionCount: requiredInteger(
      record["admittedActionCount"],
      "/internalOutcome/admittedActionCount",
    ),
    blockedActionCount: requiredInteger(
      record["blockedActionCount"],
      "/internalOutcome/blockedActionCount",
    ),
    haltedByInternalBlock: record["haltedByInternalBlock"],
    blockReasonCodes: stringArray(
      record["blockReasonCodes"],
      "/internalOutcome/blockReasonCodes",
    ),
  };
}

function parseEvaluationTrack(value: unknown): ToolSandboxEvaluationTrack {
  if (
    value !== "official_headline" &&
    value !== "restart_lost_response_derivative"
  ) {
    throw new Error(
      "/evaluationTrack must be official_headline or restart_lost_response_derivative",
    );
  }
  return value;
}

interface ParsedUpstreamResult {
  readonly snapshot: unknown;
  readonly score: number;
  readonly milestoneSimilarity: number;
  readonly minefieldSimilarity: number;
  readonly milestoneMapping: Readonly<Record<string, readonly [number, number]>>;
  readonly minefieldMapping: Readonly<Record<string, readonly [number, number]>>;
  readonly strictTaskSuccess: boolean;
}

function parseUpstreamResult(value: unknown): ParsedUpstreamResult {
  requiredRecord(value, "/upstreamResultSummary");
  const snapshot = jsonSnapshot(value);
  const root = requiredRecord(snapshot, "/upstreamResultSummary");
  if (root["git_sha"] !== REVISION) {
    throw new Error(
      `/upstreamResultSummary/git_sha must equal clean pinned revision ${REVISION}`,
    );
  }
  const rawResults = root["per_scenario_results"];
  if (!Array.isArray(rawResults) || rawResults.length !== 1) {
    throw new Error("/upstreamResultSummary/per_scenario_results must contain exactly one result");
  }
  const result = requiredRecord(rawResults[0], "/upstreamResultSummary/per_scenario_results/0");
  if (result["name"] !== SCENARIO) {
    throw new Error(`upstream result must be for pinned scenario ${SCENARIO}`);
  }
  const categories = stringArray(
    result["categories"],
    "/upstreamResultSummary/per_scenario_results/0/categories",
  );
  if (!categories.includes("STATE_DEPENDENCY")) {
    throw new Error("upstream result is missing benchmark category STATE_DEPENDENCY");
  }

  const milestoneSimilarity = unitNumber(
    result["milestone_similarity"],
    "/upstreamResultSummary/per_scenario_results/0/milestone_similarity",
  );
  const minefieldSimilarity = unitNumber(
    result["minefield_similarity"],
    "/upstreamResultSummary/per_scenario_results/0/minefield_similarity",
  );
  const score = unitNumber(
    result["similarity"],
    "/upstreamResultSummary/per_scenario_results/0/similarity",
  );
  const expectedScore = minefieldSimilarity === 0 ? milestoneSimilarity : 0;
  if (Math.abs(score - expectedScore) > Number.EPSILON) {
    throw new Error("upstream combined similarity does not recompute from milestone/minefield scores");
  }

  const milestoneMapping = parseMapping(
    result["milestone_mapping"],
    "/upstreamResultSummary/per_scenario_results/0/milestone_mapping",
    manifest.oracle.milestoneCount,
  );
  const minefieldMapping = parseMapping(
    result["minefield_mapping"],
    "/upstreamResultSummary/per_scenario_results/0/minefield_mapping",
    manifest.oracle.minefieldCount,
  );
  if (minefieldSimilarity !== 0 || Object.keys(minefieldMapping).length !== 0) {
    throw new Error("pinned ToolSandbox scenario owns zero minefields");
  }

  const traceback = result["traceback"];
  const exceptionType = result["exception_type"];
  if (traceback !== null && typeof traceback !== "string") {
    throw new Error("upstream traceback must be null or a string");
  }
  if (exceptionType !== null && typeof exceptionType !== "string") {
    throw new Error("upstream exception_type must be null or a string");
  }
  if ((traceback === null) !== (exceptionType === null)) {
    throw new Error("upstream traceback and exception_type must be present together");
  }
  requiredInteger(
    result["turn_count"],
    "/upstreamResultSummary/per_scenario_results/0/turn_count",
  );

  const allMilestonesExact = Array.from(
    { length: manifest.oracle.milestoneCount },
    (_, index) => milestoneMapping[String(index)]?.[1] === 1,
  ).every(Boolean);
  const strictTaskSuccess =
    traceback === null &&
    score === 1 &&
    milestoneSimilarity === 1 &&
    minefieldSimilarity === 0 &&
    allMilestonesExact;

  return {
    snapshot,
    score,
    milestoneSimilarity,
    minefieldSimilarity,
    milestoneMapping,
    minefieldMapping,
    strictTaskSuccess,
  };
}

function createReceipt(input: ToolSandboxAttemptInput): ToolSandboxAttemptReceipt {
  const batchId = requiredId(input.batchId, "/batchId");
  const attemptId = requiredId(input.attemptId, "/attemptId");
  if (!ARMS.includes(input.arm)) throw new Error(`/arm is not one of ${ARMS.join(", ")}`);
  const evaluationTrack = parseEvaluationTrack(input.evaluationTrack);
  const completedAt = exactIsoTimestamp(input.completedAt, "/completedAt");
  const execution = parseExecution(input.execution);
  const internalOutcome = parseInternalOutcome(input.internalOutcome);
  const upstream = parseUpstreamResult(input.upstreamResultSummary);

  let intervention: ToolSandboxAttemptReceipt["intervention"];
  if (evaluationTrack === "official_headline") {
    if (input.faultEvidence !== undefined) {
      throw new Error(
        "official_headline must execute the unchanged upstream scenario without fault evidence",
      );
    }
    intervention = { kind: "none" };
  } else {
    if (input.faultEvidence === undefined) {
      throw new Error(
        "restart_lost_response_derivative requires scheduled fault evidence",
      );
    }
    const fault = manifest.evaluationTracks[1].intervention;
    intervention = {
      kind: "scheduled_fault",
      faultId: fault.id,
      targetTool: fault.targetTool,
      trigger: fault.trigger,
      effect: fault.effect,
      evidence: parseFaultEvidence(input.faultEvidence),
    };
  }

  const headlineEligible = evaluationTrack === "official_headline";

  const body = {
    schemaVersion: RECEIPT_SCHEMA,
    manifestHash: manifest.manifestHash,
    batchId,
    attemptId,
    arm: input.arm,
    evaluationTrack,
    headlineEligible,
    completedAt,
    execution,
    intervention,
    internalOutcome,
    upstream: {
      repositoryUrl: REPOSITORY_URL,
      revision: REVISION,
      scenario: SCENARIO,
      corpusHash: CORPUS_HASH,
      resultSummaryHash: sha256Json(upstream.snapshot),
      resultSummary: upstream.snapshot,
    },
    oracleOutcome: {
      owner: manifest.oracle.owner,
      score: upstream.score,
      milestoneSimilarity: upstream.milestoneSimilarity,
      minefieldSimilarity: upstream.minefieldSimilarity,
      strictTaskSuccess: upstream.strictTaskSuccess,
      milestoneMapping: upstream.milestoneMapping,
      minefieldMapping: upstream.minefieldMapping,
      internalBlocksAffectTaskSuccess: false as const,
      resultScope: headlineEligible
        ? ("official_unchanged_scenario" as const)
        : ("official_oracle_on_derived_trajectory" as const),
    },
  } as const;

  return deepFreeze({ ...body, receiptHash: sha256Json(body) });
}

function verifyReceipt(value: unknown): ToolSandboxAttemptReceipt {
  const record = requiredRecord(value, "/receipt");
  if (record["schemaVersion"] !== RECEIPT_SCHEMA) {
    throw new Error(`/receipt/schemaVersion must be ${RECEIPT_SCHEMA}`);
  }
  const evaluationTrack = parseEvaluationTrack(record["evaluationTrack"]);
  const intervention = requiredRecord(record["intervention"], "/receipt/intervention");
  const upstream = requiredRecord(record["upstream"], "/receipt/upstream");
  const faultEvidence =
    evaluationTrack === "restart_lost_response_derivative"
      ? parseFaultEvidence(intervention["evidence"])
      : undefined;
  const rebuilt = createReceipt({
    batchId: requiredString(record["batchId"], "/receipt/batchId"),
    attemptId: requiredString(record["attemptId"], "/receipt/attemptId"),
    arm: record["arm"] as ToolSandboxArm,
    evaluationTrack,
    completedAt: requiredString(record["completedAt"], "/receipt/completedAt"),
    execution: parseExecution(record["execution"]),
    ...(faultEvidence === undefined ? {} : { faultEvidence }),
    internalOutcome: parseInternalOutcome(record["internalOutcome"]),
    upstreamResultSummary: upstream["resultSummary"],
  });
  if (canonicalStringify(value) !== canonicalStringify(rebuilt)) {
    throw new Error("ToolSandbox receipt is missing fields, tampered, or does not recompute");
  }
  return rebuilt;
}

function evidenceAuthority(receipt: ToolSandboxAttemptReceipt): EvidenceAuthorityStatus {
  const observedAt = timestamp(receipt.completedAt);
  const evidence: ExternalStateEvidence = {
    tenantId: EVAL_TENANT,
    evidenceId: `toolsandbox:${receipt.attemptId}`,
    kind: "eval_result",
    source: `${REPOSITORY_URL}/blob/${REVISION}/tool_sandbox/cli/utils.py`,
    claimsAuthority: false,
    refs: [],
    observedAt,
    collectedBy: "@pm/public-eval-toolsandbox",
    collectedAt: observedAt,
    payload: {
      manifestHash: receipt.manifestHash,
      receiptHash: receipt.receiptHash,
      arm: receipt.arm,
      evaluationTrack: receipt.evaluationTrack,
      headlineEligible: receipt.headlineEligible,
      score: receipt.oracleOutcome.score,
      strictTaskSuccess: receipt.oracleOutcome.strictTaskSuccess,
    },
    payloadHash: receipt.upstream.resultSummaryHash,
    validation: {
      validationType: `${manifest.benchmark.owner}:${SCENARIO}`,
      outcome: receipt.oracleOutcome.strictTaskSuccess ? "passed" : "failed",
    },
  };
  const review = reviewExternalStateEvidence(evidence, {
    tenantId: EVAL_TENANT,
    evaluatedAt: observedAt,
  });
  if (review.decision === "rejected") {
    throw new Error("validated ToolSandbox result could not be admitted as external evidence");
  }
  return review.authorityStatus;
}

function verifyReceiptSet(values: readonly unknown[]): ToolSandboxReceiptSetSummary {
  if (!Array.isArray(values) || values.length !== ARMS.length) {
    throw new Error("receipt set must contain exactly one native, sham, and substrate attempt");
  }
  const receipts = values.map(verifyReceipt);
  if (new Set(receipts.map((receipt) => receipt.attemptId)).size !== receipts.length) {
    throw new Error("attemptId values must be unique within a receipt set");
  }
  for (const arm of ARMS) {
    if (receipts.filter((receipt) => receipt.arm === arm).length !== 1) {
      throw new Error(`receipt set must contain exactly one ${arm} attempt`);
    }
  }
  const batchIds = new Set(receipts.map((receipt) => receipt.batchId));
  if (batchIds.size !== 1) throw new Error("all receipts must share one batchId");
  const evaluationTracks = new Set(
    receipts.map((receipt) => receipt.evaluationTrack),
  );
  if (evaluationTracks.size !== 1) {
    throw new Error(
      "official headline and restart/lost-response derivative receipts cannot share a batch",
    );
  }
  const executionBindings = new Set(
    receipts.map((receipt) => canonicalStringify(receipt.execution)),
  );
  if (executionBindings.size !== 1) {
    throw new Error("all arms must use the same model, simulator, backend, seed, and turn budget");
  }
  const authorityStatuses = new Set(receipts.map(evidenceAuthority));
  if (authorityStatuses.size !== 1 || !authorityStatuses.has("evidence_only")) {
    throw new Error("public benchmark outcomes must remain evidence_only");
  }

  const batchId = receipts[0]?.batchId;
  const evaluationTrack = receipts[0]?.evaluationTrack;
  if (batchId === undefined || evaluationTrack === undefined) {
    throw new Error("receipt set is unexpectedly empty");
  }
  const headlineEligible = evaluationTrack === "official_headline";
  return deepFreeze({
    schemaVersion: SUMMARY_SCHEMA,
    manifestHash: manifest.manifestHash,
    batchId,
    evaluationTrack,
    headlineEligible,
    authorityStatus: "evidence_only",
    attempts: receipts
      .slice()
      .sort((left, right) => ARMS.indexOf(left.arm) - ARMS.indexOf(right.arm))
      .map((receipt) => ({
        attemptId: receipt.attemptId,
        arm: receipt.arm,
        faultApplied:
          receipt.intervention.kind === "scheduled_fault" &&
          receipt.intervention.evidence.status === "applied",
        oracleScore: receipt.oracleOutcome.score,
        strictTaskSuccess: receipt.oracleOutcome.strictTaskSuccess,
        blockedActionCount: receipt.internalOutcome.blockedActionCount,
        haltedByInternalBlock: receipt.internalOutcome.haltedByInternalBlock,
      })),
  });
}

function verifyCorpusRoot(root: string): {
  readonly revision: string;
  readonly corpusHash: string;
  readonly fileCount: number;
} {
  const normalizedRoot = resolve(requiredString(root, "/corpusRoot"));
  const observedFiles = CORPUS_FILES.map((expected) => {
    const file = resolve(normalizedRoot, expected.path);
    if (file !== normalizedRoot && !file.startsWith(`${normalizedRoot}${sep}`)) {
      throw new Error(`pinned corpus path escapes root: ${expected.path}`);
    }
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(file);
    } catch {
      throw new Error(`pinned corpus file is missing: ${expected.path}`);
    }
    const sha256 = sha256Bytes(bytes);
    if (sha256 !== expected.sha256) {
      throw new Error(`pinned corpus file is tampered: ${expected.path}`);
    }
    return { path: expected.path, sha256 };
  });
  const corpusHash = sha256Json(observedFiles);
  if (corpusHash !== CORPUS_HASH) {
    throw new Error("ToolSandbox corpus aggregate hash does not match the manifest");
  }
  return deepFreeze({ revision: REVISION, corpusHash, fileCount: observedFiles.length });
}

function checkedGitOutput(
  checkoutPath: string,
  arguments_: readonly string[],
): string {
  const result = spawnSync("git", ["-C", checkoutPath, ...arguments_], {
    encoding: "utf8",
    shell: false,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      `cannot qualify ToolSandbox checkout with git ${arguments_.join(" ")}`,
    );
  }
  return result.stdout.trim();
}

function ensureCleanPinnedCheckout(checkoutPath: string): void {
  const head = checkedGitOutput(checkoutPath, ["rev-parse", "HEAD"]);
  if (head !== REVISION) {
    throw new Error(`ToolSandbox checkout HEAD must equal pinned revision ${REVISION}`);
  }
  const status = spawnSync(
    "git",
    ["-C", checkoutPath, "diff", "HEAD", "--quiet"],
    {
    encoding: "utf8",
    shell: false,
    },
  );
  if (status.error !== undefined || status.status !== 0) {
    throw new Error("ToolSandbox checkout has tracked local changes");
  }
}

function prepareEmptyOutputRoot(value: string): string {
  const outputRoot = resolve(requiredString(value, "/outputRoot"));
  try {
    if (!statSync(outputRoot).isDirectory()) {
      throw new Error("/outputRoot must be a directory");
    }
    if (readdirSync(outputRoot).length !== 0) {
      throw new Error("/outputRoot must be empty to prevent stale-result selection");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("/outputRoot")) {
      throw error;
    }
    mkdirSync(outputRoot, { recursive: true });
  }
  return outputRoot;
}

function sanitizedPythonEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of [
    "PYTHONPATH",
    "PYTHONHOME",
    "PYTHONSTARTUP",
    "PYTHONINSPECT",
    "LD_PRELOAD",
    "DYLD_INSERT_LIBRARIES",
    "DYLD_LIBRARY_PATH",
  ]) {
    delete environment[key];
  }
  environment["PYTHONNOUSERSITE"] = "1";
  environment["PYTHONDONTWRITEBYTECODE"] = "1";
  environment["PYTHONUTF8"] = "1";
  return environment;
}

function findResultSummaries(root: string): readonly string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === "result_summary.json") found.push(path);
    }
  };
  visit(root);
  return found.sort();
}

function runOfficialHeadlineQualification(
  input: ToolSandboxHeadlineQualificationInput,
): ToolSandboxQualificationArtifact {
  const checkoutPath = resolve(
    requiredString(input.checkoutPath, "/checkoutPath"),
  );
  if (!statSync(checkoutPath).isDirectory()) {
    throw new Error("/checkoutPath must be a directory");
  }
  const pythonExecutable = resolve(
    requiredString(input.pythonExecutable, "/pythonExecutable"),
  );
  const agent = requiredString(input.agent, "/agent");
  const user = requiredString(input.user, "/user");
  if (input.preferredToolBackend !== "DEFAULT") {
    throw new Error("/preferredToolBackend must be DEFAULT for the pinned corpus");
  }
  const execution = parseExecution(input.attempt.execution);
  if (
    execution.agentModel !== agent ||
    execution.userSimulatorModel !== user ||
    execution.toolBackend !== input.preferredToolBackend ||
    execution.seed !== "42" ||
    execution.maxTurns !== 30
  ) {
    throw new Error(
      "qualification execution must bind the CLI agent/user, DEFAULT backend, seed 42, and upstream maxTurns 30",
    );
  }
  const timeoutMs = input.timeoutMs ?? 600_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("/timeoutMs must be a positive safe integer");
  }
  const scriptedStdin =
    input.scriptedStdin === undefined
      ? undefined
      : `${input.scriptedStdin
          .map((line, index) => requiredString(line, `/scriptedStdin/${index}`))
          .join("\n")}\n`;

  const corpusVerification = verifyCorpusRoot(checkoutPath);
  ensureCleanPinnedCheckout(checkoutPath);
  const outputRoot = prepareEmptyOutputRoot(input.outputRoot);
  const arguments_ = [
    "-c",
    "from tool_sandbox.cli import main; main()",
    "--agent",
    agent,
    "--user",
    user,
    "--preferred_tool_backend",
    input.preferredToolBackend,
    "--scenarios",
    SCENARIO,
    "--parallel",
    "1",
    "--output_dir",
    outputRoot,
  ] as const;
  const run = spawnSync(pythonExecutable, arguments_, {
    cwd: checkoutPath,
    encoding: "utf8",
    env: sanitizedPythonEnvironment(),
    input: scriptedStdin,
    maxBuffer: 50 * 1024 * 1024,
    shell: false,
    timeout: timeoutMs,
  });
  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  if (run.error !== undefined || run.status !== 0) {
    throw new Error(
      `official ToolSandbox CLI failed (status=${String(run.status)}, stdoutSha256=${sha256Bytes(Buffer.from(stdout))}, stderrSha256=${sha256Bytes(Buffer.from(stderr))})`,
    );
  }

  const resultSummaries = findResultSummaries(outputRoot);
  if (resultSummaries.length !== 1) {
    throw new Error(
      `official run must produce exactly one result_summary.json; found ${resultSummaries.length}`,
    );
  }
  const resultSummaryPath = resultSummaries[0];
  if (resultSummaryPath === undefined) {
    throw new Error("official result_summary.json disappeared after discovery");
  }
  const upstreamResultSummary = JSON.parse(
    readFileSync(resultSummaryPath, "utf8"),
  ) as unknown;
  const receipt = createReceipt({
    ...input.attempt,
    evaluationTrack: "official_headline",
    completedAt: new Date().toISOString(),
    upstreamResultSummary,
  });
  const artifactBody = {
    schemaVersion: "pm.public-eval.toolsandbox-qualification.v1",
    evaluationTrack: "official_headline",
    headlineEligible: true,
    checkoutPath,
    corpusVerification,
    invocation: {
      executable: pythonExecutable,
      arguments: arguments_,
      cwd: checkoutPath,
      exitCode: 0,
      stdoutSha256: sha256Bytes(Buffer.from(stdout)),
      stderrSha256: sha256Bytes(Buffer.from(stderr)),
    },
    resultSummaryPath: relative(outputRoot, resultSummaryPath),
    receipt,
  } as const;
  const artifact = deepFreeze({
    ...artifactBody,
    qualificationHash: sha256Json(artifactBody),
  });
  writeFileSync(
    resolve(outputRoot, `pm-qualification-${artifact.qualificationHash}.json`),
    `${JSON.stringify(artifact, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  return artifact;
}

interface ParsedArmRunMetadata {
  readonly completedAt: string;
  readonly internalOutcome: ToolSandboxInternalOutcome;
  readonly faultEvidence?: ToolSandboxFaultEvidence;
  readonly providerSessionRestartCount: number;
  readonly providerProcessTracePath: string;
  readonly providerProcess: {
    readonly tracePath: string;
    readonly traceSha256: string;
    readonly traceHeadHash: string;
    readonly traceEntryCount: number;
    readonly processInstanceCount: number;
    readonly restartCount: number;
    readonly restartSemantics: string;
    readonly runnerSha256: string;
    readonly workerSha256: string;
    readonly pythonExecutableSha256: string;
  };
}

function absoluteFile(value: unknown, path: string): string {
  const input = requiredString(value, path);
  if (!isAbsolute(input)) throw new Error(`${path} must be an absolute path`);
  const file = resolve(input);
  try {
    if (!statSync(file).isFile()) throw new Error(`${path} must be a file`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(path)) throw error;
    throw new Error(`${path} must name an existing file`);
  }
  return file;
}

function relativeFileWithin(root: string, value: unknown, path: string): string {
  const file = resolve(requiredString(value, path));
  if (file === root || !file.startsWith(`${root}${sep}`)) {
    throw new Error(`${path} must remain inside its matched-arm output directory`);
  }
  return relative(root, file);
}

function parseArmRunMetadata(
  value: unknown,
  expected: {
    readonly arm: ToolSandboxArm;
    readonly evaluationTrack: ToolSandboxEvaluationTrack;
    readonly attemptId: string;
    readonly armDirectory: string;
    readonly boundaryTracePath: string;
    readonly execution: ToolSandboxExecutionBinding;
  },
): ParsedArmRunMetadata & {
  readonly resultSummaryPath: string;
  readonly boundaryTracePath: string;
} {
  const record = requiredRecord(value, "/armRunMetadata");
  if (record["schemaVersion"] !== "pm.public-eval.toolsandbox-arm-run.v3") {
    throw new Error("matched runner returned an unknown metadata schema");
  }
  if (
    record["arm"] !== expected.arm ||
    record["evaluationTrack"] !== expected.evaluationTrack ||
    record["attemptId"] !== expected.attemptId
  ) {
    throw new Error("matched runner metadata identity does not match its arm request");
  }
  const metadataExecution = parseExecution(record["execution"]);
  if (canonicalStringify(metadataExecution) !== canonicalStringify(expected.execution)) {
    throw new Error("matched runner metadata execution does not match its arm request");
  }
  const completedAt = exactIsoTimestamp(record["completedAt"], "/completedAt");
  const internalOutcome = parseInternalOutcome(record["internalOutcome"]);
  const providerSessionRestartCount = requiredInteger(
    record["providerSessionRestartCount"],
    "/providerSessionRestartCount",
  );
  const providerProcessTraceRelative = relativeFileWithin(
    expected.armDirectory,
    record["providerProcessTracePath"],
    "/providerProcessTracePath",
  );
  if (providerProcessTraceRelative !== "provider-process.jsonl") {
    throw new Error("provider process trace must use provider-process.jsonl");
  }
  const providerProcessRecord = requiredRecord(
    record["providerProcess"],
    "/providerProcess",
  );
  const providerProcess = {
    tracePath: requiredString(providerProcessRecord["tracePath"], "/providerProcess/tracePath"),
    traceSha256: requiredString(providerProcessRecord["traceSha256"], "/providerProcess/traceSha256"),
    traceHeadHash: requiredString(providerProcessRecord["traceHeadHash"], "/providerProcess/traceHeadHash"),
    traceEntryCount: requiredInteger(providerProcessRecord["traceEntryCount"], "/providerProcess/traceEntryCount"),
    processInstanceCount: requiredInteger(providerProcessRecord["processInstanceCount"], "/providerProcess/processInstanceCount"),
    restartCount: requiredInteger(providerProcessRecord["restartCount"], "/providerProcess/restartCount"),
    restartSemantics: requiredString(providerProcessRecord["restartSemantics"], "/providerProcess/restartSemantics"),
    runnerSha256: requiredString(providerProcessRecord["runnerSha256"], "/providerProcess/runnerSha256"),
    workerSha256: requiredString(providerProcessRecord["workerSha256"], "/providerProcess/workerSha256"),
    pythonExecutableSha256: requiredString(
      providerProcessRecord["pythonExecutableSha256"],
      "/providerProcess/pythonExecutableSha256",
    ),
  } as const;
  if (
    resolve(providerProcess.tracePath) !==
      resolve(expected.armDirectory, providerProcessTraceRelative) ||
    providerProcess.restartCount !== providerSessionRestartCount ||
    providerProcess.runnerSha256 !== MATCHED_RUNNER_SHA256 ||
    providerProcess.workerSha256 !== PROVIDER_PROCESS_SHA256
  ) {
    throw new Error("provider process metadata does not bind its matched runner/trace");
  }
  const resultSummaryRelative = relativeFileWithin(
    expected.armDirectory,
    record["resultSummaryPath"],
    "/resultSummaryPath",
  );
  if (resultSummaryRelative !== "result_summary.json") {
    throw new Error("matched runner must write the official summary at result_summary.json");
  }
  const boundaryTrace = resolve(
    requiredString(record["boundaryTracePath"], "/boundaryTracePath"),
  );
  if (boundaryTrace !== expected.boundaryTracePath) {
    throw new Error("matched runner returned an unexpected boundary trace path");
  }

  let faultEvidence: ToolSandboxFaultEvidence | undefined;
  if (expected.evaluationTrack === "official_headline") {
    if (record["faultEvidence"] !== null) {
      throw new Error("official headline arm must not report scheduled fault evidence");
    }
    if (providerSessionRestartCount !== 0) {
      throw new Error("official headline arm must not restart the provider session");
    }
  } else {
    faultEvidence = parseFaultEvidence(record["faultEvidence"]);
    const expectedRestarts = faultEvidence.status === "applied" ? 1 : 0;
    if (providerSessionRestartCount !== expectedRestarts) {
      throw new Error("provider-session restart count does not match fault evidence");
    }
  }

  return {
    completedAt,
    internalOutcome,
    ...(faultEvidence === undefined ? {} : { faultEvidence }),
    providerSessionRestartCount,
    providerProcessTracePath: resolve(
      expected.armDirectory,
      providerProcessTraceRelative,
    ),
    providerProcess,
    resultSummaryPath: resolve(expected.armDirectory, resultSummaryRelative),
    boundaryTracePath: boundaryTrace,
  };
}

const RUNNER_METADATA_PREFIX = "PM_TOOL_SANDBOX_ARM_METADATA=";

function parseRunnerMetadata(stdout: string): unknown {
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(RUNNER_METADATA_PREFIX));
  if (lines.length !== 1) {
    throw new Error(
      `matched runner must emit exactly one metadata record; found ${lines.length}`,
    );
  }
  const record = lines[0];
  if (record === undefined) throw new Error("matched runner emitted no metadata");
  try {
    return JSON.parse(record.slice(RUNNER_METADATA_PREFIX.length)) as unknown;
  } catch {
    throw new Error("matched runner metadata record is not valid JSON");
  }
}

function writeJsonExclusive(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

function fileInventory(root: string, base: string): readonly {
  readonly path: string;
  readonly sha256: string;
}[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(root);
  return files
    .sort()
    .map((path) => ({ path: relative(base, path), sha256: sha256Bytes(readFileSync(path)) }));
}

function runMatchedEfficacyBatch(
  input: ToolSandboxMatchedBatchInput,
): ToolSandboxMatchedBatchArtifact {
  const checkoutPath = resolve(
    requiredString(input.checkoutPath, "/checkoutPath"),
  );
  if (!statSync(checkoutPath).isDirectory()) {
    throw new Error("/checkoutPath must be a directory");
  }
  const pythonExecutable = absoluteFile(
    input.pythonExecutable,
    "/pythonExecutable",
  );
  const nodeExecutable = absoluteFile(input.nodeExecutable, "/nodeExecutable");
  const batchId = requiredId(input.batchId, "/batchId");
  const evaluationTrack = parseEvaluationTrack(input.evaluationTrack);
  const agent = requiredString(input.agent, "/agent");
  const user = requiredString(input.user, "/user");
  const scriptedStdin = input.scriptedStdin ?? [];
  if (
    !Array.isArray(scriptedStdin) ||
    scriptedStdin.length > 64 ||
    scriptedStdin.some(
      (line) =>
        typeof line !== "string" ||
        line.length > 4096 ||
        /[\r\n\0]/u.test(line),
    )
  ) {
    throw new Error(
      "/scriptedStdin must contain at most 64 newline-free strings of at most 4096 characters",
    );
  }
  if (scriptedStdin.length > 0 && user !== "Cli") {
    throw new Error("/scriptedStdin is only valid for the upstream Cli user role");
  }
  if (input.preferredToolBackend !== "DEFAULT") {
    throw new Error("/preferredToolBackend must be DEFAULT for the pinned corpus");
  }
  const randomizationSeed = requiredString(
    input.randomizationSeed,
    "/randomizationSeed",
  );
  const timeoutMs = input.timeoutMs ?? 900_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("/timeoutMs must be a positive safe integer");
  }

  const corpusVerification = verifyCorpusRoot(checkoutPath);
  ensureCleanPinnedCheckout(checkoutPath);
  const runnerPath = absoluteFile(MATCHED_RUNNER_PATH, "/packageRunnerPath");
  if (sha256Bytes(readFileSync(runnerPath)) !== MATCHED_RUNNER_SHA256) {
    throw new Error("matched runner bytes do not match the manifest");
  }
  const sidecarEntryPath = absoluteFile(
    fileURLToPath(new URL("./sidecar-entry.js", import.meta.url)),
    "/compiledSidecarEntryPath",
  );
  const outputRoot = prepareEmptyOutputRoot(input.outputRoot);
  const armOrder = ARMS.map((arm) => ({
    arm,
    key: sha256Json({
      domain: "pm.public-eval.toolsandbox-arm-order.v1",
      seed: randomizationSeed,
      arm,
    }),
  }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.key, right.key) ||
        compareCodeUnits(left.arm, right.arm),
    )
    .map(({ arm }) => arm);
  const execution: ToolSandboxExecutionBinding = {
    agentModel: agent,
    userSimulatorModel: user,
    toolBackend: "DEFAULT",
    seed: "42",
    maxTurns: 30,
  };
  const attempts: Array<ToolSandboxMatchedBatchArtifact["attempts"][number]> = [];
  const receipts: ToolSandboxAttemptReceipt[] = [];

  for (const [index, arm] of armOrder.entries()) {
    const order = index + 1;
    const attemptId = requiredId(
      `${batchId}-${arm}-001`,
      `/generatedAttemptId/${arm}`,
    );
    const armDirectory = resolve(
      outputRoot,
      `${String(order).padStart(2, "0")}-${arm}`,
    );
    mkdirSync(armDirectory, { recursive: false });
    const boundaryTracePath = resolve(armDirectory, "boundary.jsonl");
    const boundaryStatePath = resolve(armDirectory, "boundary-state.json");
    const sidecarPaths = {
      auditPath: resolve(armDirectory, "sidecar-audit.jsonl"),
      readyPath: resolve(armDirectory, "sidecar-ready.json"),
      finalReceiptPath: resolve(armDirectory, "sidecar-final.json"),
      stdoutPath: resolve(armDirectory, "sidecar.stdout.log"),
      stderrPath: resolve(armDirectory, "sidecar.stderr.log"),
      operationLedgerPath: `${boundaryStatePath}.sidecar-operations.jsonl`,
    } as const;
    const sidecar =
      arm === "native"
        ? undefined
        : startToolSandboxSidecarProcess({
            nodeExecutable,
            entryPath: sidecarEntryPath,
            arm,
            evaluationTrack,
            attemptId,
            statePath: boundaryStatePath,
            auditPath: sidecarPaths.auditPath,
            readyPath: sidecarPaths.readyPath,
            finalReceiptPath: sidecarPaths.finalReceiptPath,
            stdoutPath: sidecarPaths.stdoutPath,
            stderrPath: sidecarPaths.stderrPath,
          });
    const configuration = {
      arm,
      evaluationTrack,
      attemptId,
      agent,
      user,
      statePath: boundaryStatePath,
      boundaryTracePath,
      outputRoot: armDirectory,
      ...(sidecar === undefined
        ? {}
        : {
            boundaryOrigin: sidecar.origin,
            boundaryBearerToken: sidecar.bearerToken,
          }),
    } as const;
    const arguments_ = [runnerPath] as const;
    let sidecarFinalReceipt: Readonly<Record<string, unknown>> | undefined;
    const run = (() => {
      try {
        return spawnSync(pythonExecutable, arguments_, {
          cwd: checkoutPath,
          encoding: "utf8",
          env: sanitizedPythonEnvironment(),
          input: `${JSON.stringify(configuration)}\n${scriptedStdin
            .map((line) => `${line}\n`)
            .join("")}`,
          maxBuffer: 100 * 1024 * 1024,
          shell: false,
          timeout: timeoutMs,
        });
      } finally {
        sidecarFinalReceipt = sidecar?.stop();
      }
    })();
    const stdout = run.stdout ?? "";
    const stderr = run.stderr ?? "";
    const stdoutPath = resolve(armDirectory, "runner.stdout.log");
    const stderrPath = resolve(armDirectory, "runner.stderr.log");
    writeFileSync(stdoutPath, stdout, { encoding: "utf8", flag: "wx" });
    writeFileSync(stderrPath, stderr, { encoding: "utf8", flag: "wx" });
    const invocation = {
      executable: pythonExecutable,
      arguments: arguments_,
      cwd: checkoutPath,
      exitCode: 0 as const,
      runnerSha256: MATCHED_RUNNER_SHA256,
      stdoutPath: relative(outputRoot, stdoutPath),
      stdoutSha256: sha256Bytes(Buffer.from(stdout)),
      stderrPath: relative(outputRoot, stderrPath),
      stderrSha256: sha256Bytes(Buffer.from(stderr)),
    };
    if (run.error !== undefined || run.status !== 0) {
      const failureBody = {
        schemaVersion: "pm.public-eval.toolsandbox-arm-failure.v1",
        manifestHash: manifest.manifestHash,
        batchId,
        evaluationTrack,
        arm,
        attemptId,
        invocation: {
          ...invocation,
          exitCode: run.status,
          signal: run.signal,
          spawnError: run.error?.message ?? null,
        },
      } as const;
      const failureHash = sha256Json(failureBody);
      writeJsonExclusive(
        resolve(armDirectory, `pm-arm-failure-${failureHash}.json`),
        { ...failureBody, failureHash },
      );
      throw new Error(
        `matched ToolSandbox ${arm} runner failed (status=${String(run.status)}, stdoutSha256=${invocation.stdoutSha256}, stderrSha256=${invocation.stderrSha256}, failureHash=${failureHash})`,
      );
    }

    const metadata = parseArmRunMetadata(parseRunnerMetadata(stdout), {
      arm,
      evaluationTrack,
      attemptId,
      armDirectory,
      boundaryTracePath,
      execution,
    });
    if (
      sidecar !== undefined &&
      (sidecarFinalReceipt === undefined ||
        !existsSync(sidecarPaths.readyPath) ||
        !existsSync(sidecarPaths.finalReceiptPath) ||
        !existsSync(sidecarPaths.auditPath) ||
        !existsSync(sidecarPaths.operationLedgerPath))
    ) {
      throw new Error("matched ToolSandbox sidecar did not retain complete evidence");
    }
    const upstreamResultSummary = JSON.parse(
      readFileSync(metadata.resultSummaryPath, "utf8"),
    ) as unknown;
    const receipt = createReceipt({
      batchId,
      attemptId,
      arm,
      evaluationTrack,
      completedAt: metadata.completedAt,
      execution,
      ...(metadata.faultEvidence === undefined
        ? {}
        : { faultEvidence: metadata.faultEvidence }),
      internalOutcome: metadata.internalOutcome,
      upstreamResultSummary,
    });
    const receiptPath = resolve(
      armDirectory,
      `pm-receipt-${receipt.receiptHash}.json`,
    );
    writeJsonExclusive(receiptPath, receipt);
    const traceExists = existsSync(metadata.boundaryTracePath);
    receipts.push(receipt);
    attempts.push({
      order,
      arm,
      attemptId,
      invocation,
      resultSummaryPath: relative(outputRoot, metadata.resultSummaryPath),
      metadataPath: relative(
        outputRoot,
        resolve(armDirectory, "arm-run-metadata.json"),
      ),
      boundaryTracePath: traceExists
        ? relative(outputRoot, metadata.boundaryTracePath)
        : null,
      boundaryTraceSha256: traceExists
        ? sha256Bytes(readFileSync(metadata.boundaryTracePath))
        : null,
      boundarySidecar:
        sidecar === undefined
          ? null
          : {
              readyPath: relative(outputRoot, sidecarPaths.readyPath),
              finalReceiptPath: relative(outputRoot, sidecarPaths.finalReceiptPath),
              auditPath: relative(outputRoot, sidecarPaths.auditPath),
              operationLedgerPath: relative(
                outputRoot,
                sidecarPaths.operationLedgerPath,
              ),
              stdoutPath: relative(outputRoot, sidecarPaths.stdoutPath),
              stderrPath: relative(outputRoot, sidecarPaths.stderrPath),
              launch: {
                pid: sidecar.pid,
                ppid: process.pid,
                tokenSha256: sha256Bytes(Buffer.from(sidecar.bearerToken, "utf8")),
                nodePath: realpathSync(nodeExecutable),
                nodeSha256: sha256Bytes(readFileSync(nodeExecutable)),
                entryPath: realpathSync(sidecarEntryPath),
                entrySha256: sha256Bytes(readFileSync(sidecarEntryPath)),
                runtimeModuleClosure: sidecar.runtimeModuleClosure,
              },
            },
      providerProcessTracePath: relative(
        outputRoot,
        metadata.providerProcessTracePath,
      ),
      providerProcessTraceSha256: sha256Bytes(
        readFileSync(metadata.providerProcessTracePath),
      ),
      providerSessionRestartCount: metadata.providerSessionRestartCount,
      receiptPath: relative(outputRoot, receiptPath),
      receipt,
      rawArtifacts: fileInventory(armDirectory, outputRoot),
    });
  }

  const summary = verifyReceiptSet(receipts);
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-matched-batch.v3",
    manifestHash: manifest.manifestHash,
    batchId,
    evaluationTrack,
    headlineEligible: evaluationTrack === "official_headline",
    checkoutPath,
    corpusVerification,
    randomization: { seed: randomizationSeed, armOrder },
    execution,
    scriptedStdin,
    attempts,
    summary,
  } as const;
  const artifact = deepFreeze({ ...body, batchHash: sha256Json(body) });
  writeJsonExclusive(
    resolve(outputRoot, `pm-matched-batch-${artifact.batchHash}.json`),
    artifact,
  );
  return artifact;
}

/**
 * Primary runtime facade. The CLI consumes this facade and the named raw-batch
 * verifier re-export below; public types above are erased at runtime.
 */
export const toolSandboxVerticalSlice = deepFreeze({
  manifest,
  createReceipt,
  verifyReceiptSet,
  verifyCorpusRoot,
  runOfficialHeadlineQualification,
  runMatchedEfficacyBatch,
  admitToolProposal,
  recordToolOutcome,
});

export {
  assessToolSandboxPublicEvalAttemptEligibility,
  convertToolSandboxRawVerificationToPublicEvalAttemptArtifacts,
  verifyAndAssessToolSandboxPublicEvalAttemptEligibility,
  verifyRawMatchedBatch,
  type ToolSandboxPublicEvalAttemptEligibility,
  type ToolSandboxPublicEvalAttemptEligibilityV2,
  type ToolSandboxPublicEvalAttemptEligibilityV3,
  type ToolSandboxPublicEvalMissingEvidence,
  type ToolSandboxRawMatchedBatchVerification,
  type ToolSandboxRawMatchedBatchVerificationInput,
  type ToolSandboxRawVerifierDependencies,
} from "./verify-matched.js";

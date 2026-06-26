import type { TenantId, Timestamp } from "@pm/types";

export const EVAL_AXES = ["finance", "marketing", "local_lab"] as const;

export type EvalAxis = (typeof EVAL_AXES)[number];

export const FAILURE_CLASSES = [
  "partial_observation",
  "stale_observation",
  "representation_loss",
  "memory_drift",
  "source_authority_conflict",
  "workflow_invalidation",
  "capability_contract_violation",
  "parallel_write_conflict",
  "feedback_disconnection",
  "continuity_break",
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

export const EVAL_RESULTS = ["pass", "fail", "blocked"] as const;

export type EvalResult = (typeof EVAL_RESULTS)[number];

export const EVAL_OPERATIONAL_TERMINAL_OUTCOMES = [
  "accepted",
  "blocked",
  "rejected",
  "held",
  "superseded",
  "escalated",
] as const;

export type EvalOperationalTerminalOutcome =
  (typeof EVAL_OPERATIONAL_TERMINAL_OUTCOMES)[number];

export const EVAL_EVIDENCE_STAGES = [
  "scaffolded_scenario",
  "detected_warning",
  "blocked_mutation",
  "paired_behavioral_improvement",
  "live_run",
] as const;

export type EvalEvidenceStage = (typeof EVAL_EVIDENCE_STAGES)[number];

export const RUN_ARMS = ["baseline", "substrate"] as const;

export type RunArm = (typeof RUN_ARMS)[number];

export const STATE_BENCH_CATEGORIES = [
  "stateful",
  "procedural_execution",
  "user_experience",
] as const;

export type StateBenchCategory = (typeof STATE_BENCH_CATEGORIES)[number];

export const MEMORY_BENCHMARK_BRIDGES = [
  "knowledge_update",
  "abstention",
  "workflow_rebase",
] as const;

export type MemoryBenchmarkBridge = (typeof MEMORY_BENCHMARK_BRIDGES)[number];

export const MAST_CATEGORIES = [
  "system_design",
  "inter_agent_misalignment",
  "task_verification",
] as const;

export type MastCategory = (typeof MAST_CATEGORIES)[number];

export const COORDINATION_CLASSES = [
  "append_only_observation",
  "convergent_update",
  "authority_gated_transition",
  "derived_projection",
] as const;

export type CoordinationClass = (typeof COORDINATION_CLASSES)[number];

export const CONFIDENCE_BAND_METHODS = [
  "paired_t",
  "wilcoxon",
  "binomial_exact",
  "bootstrap",
  "none",
] as const;

export type ConfidenceBandMethod = (typeof CONFIDENCE_BAND_METHODS)[number];

export interface ConfidenceBand {
  readonly low: number;
  readonly high: number;
  readonly method: ConfidenceBandMethod;
}

export const EVAL_REF_KINDS = [
  "event",
  "graph_node",
  "graph_edge",
  "workflow_run",
  "continuity_checkpoint",
  "capability_invocation",
  "projection",
  "source_record",
  "state_review_artifact",
  "action_outcome_envelope",
  "external_fixture",
  "document",
] as const;

export type EvalRefKind = (typeof EVAL_REF_KINDS)[number];

export interface EvalEvidenceRef {
  readonly kind: EvalRefKind;
  readonly id: string;
  readonly label?: string;
}

export interface EvalEvent {
  readonly tenantId: TenantId;
  readonly axis: EvalAxis;
  readonly runId: string;
  readonly agentId: string;
  readonly scenarioId: string;
  readonly failureClass: FailureClass;
  readonly observedAt: Timestamp;
  readonly source: string;
  readonly evidenceRefs: readonly EvalEvidenceRef[];
  readonly substrateRefs: readonly EvalEvidenceRef[];
  readonly runArm?: RunArm;
  readonly pairedRunGroup?: string;
  readonly stateBenchCategory?: StateBenchCategory;
  readonly memoryBenchmarkBridge?: MemoryBenchmarkBridge;
  readonly mastCategory?: MastCategory;
  readonly coordinationClass?: CoordinationClass;
  readonly evidenceStage?: EvalEvidenceStage;
  readonly confidenceBand?: ConfidenceBand;
  readonly scenarioResult?: EvalResult;
  readonly operationalTerminalOutcome?: EvalOperationalTerminalOutcome;
  readonly result: EvalResult;
  readonly notes: string;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export class EvalEventValidationError extends Error {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super(`invalid eval event: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`);
    this.name = "EvalEventValidationError";
  }
}

const AXES = new Set<string>(EVAL_AXES);
const FAILURE_CLASS_SET = new Set<string>(FAILURE_CLASSES);
const RESULT_SET = new Set<string>(EVAL_RESULTS);
const OPERATIONAL_TERMINAL_OUTCOME_SET = new Set<string>(
  EVAL_OPERATIONAL_TERMINAL_OUTCOMES,
);
const EVIDENCE_STAGE_SET = new Set<string>(EVAL_EVIDENCE_STAGES);
const RUN_ARM_SET = new Set<string>(RUN_ARMS);
const STATE_BENCH_CATEGORY_SET = new Set<string>(STATE_BENCH_CATEGORIES);
const MEMORY_BENCHMARK_BRIDGE_SET = new Set<string>(MEMORY_BENCHMARK_BRIDGES);
const MAST_CATEGORY_SET = new Set<string>(MAST_CATEGORIES);
const COORDINATION_CLASS_SET = new Set<string>(COORDINATION_CLASSES);
const CONFIDENCE_BAND_METHOD_SET = new Set<string>(CONFIDENCE_BAND_METHODS);
const REF_KIND_SET = new Set<string>(EVAL_REF_KINDS);

const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const push = (
  issues: ValidationIssue[],
  path: string,
  message: string,
): void => {
  issues.push({ path, message });
};

export function evalEvidenceRef(
  kind: EvalRefKind,
  id: string,
  label?: string,
): EvalEvidenceRef {
  return label === undefined ? { kind, id } : { kind, id, label };
}

export function validateEvalEvent(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isObj(input)) {
    return {
      valid: false,
      issues: [{ path: "", message: "expected an object" }],
    };
  }

  validateRequiredString(input, "tenantId", issues);
  validateEnum(input, "axis", AXES, EVAL_AXES, issues);
  validateRequiredString(input, "runId", issues);
  validateRequiredString(input, "agentId", issues);
  validateRequiredString(input, "scenarioId", issues);
  validateEnum(input, "failureClass", FAILURE_CLASS_SET, FAILURE_CLASSES, issues);
  validateTimestamp(input["observedAt"], "/observedAt", issues);
  validateRequiredString(input, "source", issues);
  validateRefs(input["evidenceRefs"], "/evidenceRefs", issues);
  validateRefs(input["substrateRefs"], "/substrateRefs", issues);
  validateOptionalRunArm(input["runArm"], "/runArm", issues);
  validateOptionalPairedRunGroup(
    input["pairedRunGroup"],
    "/pairedRunGroup",
    issues,
  );
  validateOptionalEnum(
    input["stateBenchCategory"],
    "/stateBenchCategory",
    STATE_BENCH_CATEGORY_SET,
    STATE_BENCH_CATEGORIES,
    issues,
  );
  validateOptionalEnum(
    input["memoryBenchmarkBridge"],
    "/memoryBenchmarkBridge",
    MEMORY_BENCHMARK_BRIDGE_SET,
    MEMORY_BENCHMARK_BRIDGES,
    issues,
  );
  validateOptionalEnum(
    input["mastCategory"],
    "/mastCategory",
    MAST_CATEGORY_SET,
    MAST_CATEGORIES,
    issues,
  );
  validateOptionalEnum(
    input["coordinationClass"],
    "/coordinationClass",
    COORDINATION_CLASS_SET,
    COORDINATION_CLASSES,
    issues,
  );
  validateOptionalEnum(
    input["evidenceStage"],
    "/evidenceStage",
    EVIDENCE_STAGE_SET,
    EVAL_EVIDENCE_STAGES,
    issues,
  );
  validateOptionalConfidenceBand(input["confidenceBand"], issues);
  validateOptionalEnum(
    input["scenarioResult"],
    "/scenarioResult",
    RESULT_SET,
    EVAL_RESULTS,
    issues,
  );
  validateOptionalEnum(
    input["operationalTerminalOutcome"],
    "/operationalTerminalOutcome",
    OPERATIONAL_TERMINAL_OUTCOME_SET,
    EVAL_OPERATIONAL_TERMINAL_OUTCOMES,
    issues,
  );
  validateEnum(input, "result", RESULT_SET, EVAL_RESULTS, issues);
  validateRequiredString(input, "notes", issues);

  if (input["axis"] === "finance") {
    if (typeof input["runArm"] !== "string" || !RUN_ARM_SET.has(input["runArm"])) {
      push(issues, "/runArm", "finance eval events require runArm baseline|substrate");
    }
    if (!isNonEmptyString(input["pairedRunGroup"])) {
      push(
        issues,
        "/pairedRunGroup",
        "finance eval events require non-empty pairedRunGroup",
      );
    }
  }

  const result = input["result"];
  const scenarioResult =
    typeof input["scenarioResult"] === "string" &&
    RESULT_SET.has(input["scenarioResult"])
      ? input["scenarioResult"]
      : result;
  if (scenarioResult === "pass" || scenarioResult === "fail") {
    if (Array.isArray(input["evidenceRefs"]) && input["evidenceRefs"].length === 0) {
      push(
        issues,
        "/evidenceRefs",
        "pass/fail scenario results require at least one evidence reference",
      );
    }
    if (Array.isArray(input["substrateRefs"]) && input["substrateRefs"].length === 0) {
      push(
        issues,
        "/substrateRefs",
        "pass/fail scenario results require at least one substrate reference",
      );
    }
  }

  if (input["operationalTerminalOutcome"] !== undefined) {
    const substrateRefs = input["substrateRefs"];
    const hasOutcomeRef =
      Array.isArray(substrateRefs) &&
      substrateRefs.some(
        (ref) =>
          isObj(ref) &&
          ref["kind"] === "action_outcome_envelope" &&
          isNonEmptyString(ref["id"]),
      );
    if (!hasOutcomeRef) {
      push(
        issues,
        "/substrateRefs",
        "operationalTerminalOutcome requires an action_outcome_envelope substrate ref",
      );
    }
  }

  if (
    result === "blocked" &&
    scenarioResult === "pass" &&
    input["operationalTerminalOutcome"] === undefined
  ) {
    push(
      issues,
      "/operationalTerminalOutcome",
      "blocked operational result with scenario pass requires operationalTerminalOutcome",
    );
  }

  return { valid: issues.length === 0, issues };
}

function validateOptionalRunArm(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string" || !RUN_ARM_SET.has(value)) {
    push(issues, path, `expected one of ${JSON.stringify([...RUN_ARMS])}`);
  }
}

function validateOptionalPairedRunGroup(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (!isNonEmptyString(value)) {
    push(issues, path, "expected non-empty string when present");
  }
}

function validateOptionalEnum<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: ReadonlySet<string>,
  labels: T,
  issues: ValidationIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string" || !allowed.has(value)) {
    push(
      issues,
      path,
      `expected one of ${JSON.stringify([...labels])}; got ${JSON.stringify(value)}`,
    );
  }
}

function validateOptionalConfidenceBand(
  value: unknown,
  issues: ValidationIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (!isObj(value)) {
    push(issues, "/confidenceBand", "expected object when present");
    return;
  }

  if (typeof value["low"] !== "number" || !Number.isFinite(value["low"])) {
    push(issues, "/confidenceBand/low", "expected finite number");
  }
  if (typeof value["high"] !== "number" || !Number.isFinite(value["high"])) {
    push(issues, "/confidenceBand/high", "expected finite number");
  }
  if (
    typeof value["method"] !== "string" ||
    !CONFIDENCE_BAND_METHOD_SET.has(value["method"])
  ) {
    push(
      issues,
      "/confidenceBand/method",
      `expected one of ${JSON.stringify([...CONFIDENCE_BAND_METHODS])}`,
    );
  }
  if (
    typeof value["low"] === "number" &&
    typeof value["high"] === "number" &&
    Number.isFinite(value["low"]) &&
    Number.isFinite(value["high"]) &&
    value["low"] > value["high"]
  ) {
    push(issues, "/confidenceBand", "low must be less than or equal to high");
  }
}

export function isEvalEvent(input: unknown): input is EvalEvent {
  return validateEvalEvent(input).valid;
}

export function assertEvalEvent(input: unknown): EvalEvent {
  const result = validateEvalEvent(input);
  if (!result.valid) {
    throw new EvalEventValidationError(result.issues);
  }
  return input as EvalEvent;
}

export function evalEvent(input: EvalEvent): EvalEvent {
  return assertEvalEvent(input);
}

function validateRequiredString(
  obj: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
): void {
  if (!isNonEmptyString(obj[key])) {
    push(issues, `/${key}`, "expected non-empty string");
  }
}

function validateEnum<T extends readonly string[]>(
  obj: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<string>,
  labels: T,
  issues: ValidationIssue[],
): void {
  const value = obj[key];
  if (typeof value !== "string" || !allowed.has(value)) {
    push(
      issues,
      `/${key}`,
      `expected one of ${JSON.stringify([...labels])}; got ${JSON.stringify(value)}`,
    );
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (
    typeof value !== "string" ||
    !ISO_TIMESTAMP_RE.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    push(issues, path, "expected ISO-8601 UTC timestamp string");
  }
}

function validateRefs(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    push(issues, path, "expected array");
    return;
  }

  for (const [idx, raw] of value.entries()) {
    const at = `${path}/${idx}`;
    if (!isObj(raw)) {
      push(issues, at, "expected object");
      continue;
    }
    const kind = raw["kind"];
    if (typeof kind !== "string" || !REF_KIND_SET.has(kind)) {
      push(
        issues,
        `${at}/kind`,
        `expected one of ${JSON.stringify([...EVAL_REF_KINDS])}; got ${JSON.stringify(kind)}`,
      );
    }
    if (!isNonEmptyString(raw["id"])) {
      push(issues, `${at}/id`, "expected non-empty string");
    }
    if (
      "label" in raw &&
      raw["label"] !== undefined &&
      typeof raw["label"] !== "string"
    ) {
      push(issues, `${at}/label`, "expected string when present");
    }
  }
}

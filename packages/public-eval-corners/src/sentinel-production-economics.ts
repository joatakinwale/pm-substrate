import { createHash } from "node:crypto";

export const SENTINEL_ECONOMICS_ARMS = [
  "native",
  "sham",
  "plain-kv",
  "substrate",
] as const;

export type SentinelEconomicsArm = typeof SENTINEL_ECONOMICS_ARMS[number];

export const SENTINEL_ECONOMICS_PINNED_MODEL = "claude-sonnet-4-5-20250929" as const;
export const SENTINEL_ECONOMICS_API_SURFACE =
  "anthropic-first-party-messages-standard" as const;
export const SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS = 250 as const;
export const SENTINEL_ECONOMICS_CELL_COST_CAP_MICRO_USD = 10_000_000 as const;
export const SENTINEL_ECONOMICS_ATTEMPT_CAP_MS = 720_000 as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export interface SentinelProductionPriceSchedule {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-price-schedule.v1";
  readonly provider: "Anthropic";
  readonly apiSurface: typeof SENTINEL_ECONOMICS_API_SURFACE;
  readonly model: typeof SENTINEL_ECONOMICS_PINNED_MODEL;
  readonly billingMode: "first-party-standard-direct-not-batch";
  readonly currency: "USD";
  readonly accountingUnit: "integer-micro-USD";
  readonly inputMicroUsdPerToken: 3;
  readonly outputMicroUsdPerToken: 15;
  readonly promptCaching: "disallowed-and-observed-usage-must-be-zero";
  readonly source: {
    readonly authority: "Anthropic official Claude Platform documentation";
    readonly title: "Pricing - Claude Platform Docs";
    readonly url: "https://platform.claude.com/docs/en/about-claude/pricing";
    readonly locator: "Model pricing table; Claude Sonnet 4.5 row; Base Input Tokens and Output Tokens";
    readonly observedOn: "2026-07-14";
    readonly attributedRates: "$3 / MTok base input; $15 / MTok output";
  };
  readonly scheduleSha256: string;
}

export interface SentinelEconomicsProviderOperationInput {
  readonly operationId: string;
  readonly apiSurface: typeof SENTINEL_ECONOMICS_API_SURFACE;
  readonly model: typeof SENTINEL_ECONOMICS_PINNED_MODEL;
  readonly promptCachingRequested: false;
  readonly batchRequested: false;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly serverToolUseRequests: number;
  /** Direct Messages API attempt-terminal client round-trip duration. */
  readonly latencyMs: number;
}

export interface SentinelEconomicsStateOperationInput {
  readonly operationId: string;
  readonly requestKind: "read" | "write";
  /** Sidecar receive to backend completion on the sidecar monotonic clock. */
  readonly backendWorkMs: number;
  /** Sidecar receive to response release on the same sidecar monotonic clock. */
  readonly controlledApiWindowMs: number;
  readonly responseDeadlineMs: typeof SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS;
  readonly deadlineMissed: boolean;
}

export interface SentinelProductionEconomicsCellInput {
  readonly cellId: string;
  readonly arm: SentinelEconomicsArm;
  readonly providerOperations: readonly SentinelEconomicsProviderOperationInput[];
  readonly stateOperations: readonly SentinelEconomicsStateOperationInput[];
  /** Supervisor wall-clock boundary from attempt start through attempt finish. */
  readonly attemptDurationMs: number;
}

export interface SentinelProductionEconomicsInput {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-economics-input.v1";
  readonly cells: readonly SentinelProductionEconomicsCellInput[];
}

export interface SentinelProductionCellEconomics {
  readonly cellId: string;
  readonly matchedCellKey: string | null;
  readonly arm: SentinelEconomicsArm;
  readonly providerOperationCount: number;
  readonly stateOperationCount: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly serverToolUseRequests: number | null;
  readonly inputCostMicroUsd: number | null;
  readonly outputCostMicroUsd: number | null;
  readonly totalCostMicroUsd: number | null;
  readonly providerLatencyMs: number | null;
  readonly stateBackendWorkMs: number | null;
  readonly stateControlledApiWindowMs: number | null;
  readonly attemptDurationMs: number | null;
  readonly directPinnedSchedule: boolean;
  readonly providerUsageComplete: boolean;
  readonly promptCachingDisabledAndZero: boolean;
  readonly stateTimingComplete: boolean;
  readonly costAtOrBelowAbsoluteCap: boolean;
  readonly attemptAtOrBelowAbsoluteCap: boolean;
  readonly allCellGuardrailsPassed: boolean;
  readonly issues: readonly string[];
}

export interface SentinelProductionArmEconomics {
  readonly arm: SentinelEconomicsArm;
  readonly cellCount: number;
  readonly providerOperationCount: number;
  readonly stateOperationCount: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalCostMicroUsd: number | null;
  readonly providerLatencyMs: number | null;
  readonly stateBackendWorkMs: number | null;
  readonly stateControlledApiWindowMs: number | null;
  readonly attemptDurationMs: number | null;
  readonly allCellsPassed: boolean;
}

export interface SentinelProductionCostRatioGuardrail {
  readonly control: "native" | "sham";
  readonly substrateCostMicroUsd: number | null;
  readonly controlCostMicroUsd: number | null;
  readonly exactConstraint: "substrate-cost * 4 <= control-cost * 5";
  readonly controlCostStrictlyPositive: boolean;
  readonly passed: boolean;
}

export interface SentinelProductionEconomicsReport {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-economics-report.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly inputSha256: string;
  readonly priceSchedule: SentinelProductionPriceSchedule;
  readonly thresholds: {
    readonly perCellCostCapMicroUsd: typeof SENTINEL_ECONOMICS_CELL_COST_CAP_MICRO_USD;
    readonly perCellAttemptCapMs: typeof SENTINEL_ECONOMICS_ATTEMPT_CAP_MS;
    readonly substrateMaximumCostRatioNumerator: 5;
    readonly substrateMaximumCostRatioDenominator: 4;
    readonly stateResponseDeadlineMs: typeof SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS;
  };
  readonly latencyBoundaries: {
    readonly providerLatency: "sum of direct Messages API attempt-terminal client round trips";
    readonly stateBackendWork: "sum of sidecar receive-to-backend-complete monotonic durations";
    readonly stateControlledApiWindow: "sum of sidecar receive-to-response-release monotonic durations";
    readonly attemptDuration: "supervisor attempt-start to attempt-finish wall duration; end-to-end cap boundary";
    readonly stateClientRoundTripCaptured: false;
    readonly componentDurationsMayNotBeSubtractedFromAttemptDuration: true;
    readonly relativeProviderLatencyThresholdPreregistered: false;
    readonly relativeStateOverheadThresholdPreregistered: false;
    readonly relativeLatencyClaimSupported: false;
    readonly reason: "no preregistered relative latency threshold and no state client-round-trip capture";
  };
  readonly cells: readonly SentinelProductionCellEconomics[];
  readonly byArm: readonly SentinelProductionArmEconomics[];
  readonly costRatios: readonly [
    SentinelProductionCostRatioGuardrail,
    SentinelProductionCostRatioGuardrail,
  ];
  readonly guardrails: {
    readonly inputShapeValid: boolean;
    readonly everyCellHasDirectPinnedProviderUsage: boolean;
    readonly everyCellDisablesPromptCaching: boolean;
    readonly everyCellHasStateTiming: boolean;
    readonly everyCellWithinCostCap: boolean;
    readonly everyCellWithinAttemptCap: boolean;
    readonly matchedFourArmCellsComplete: boolean;
    readonly nativeControlCostStrictlyPositive: boolean;
    readonly shamControlCostStrictlyPositive: boolean;
    readonly substrateCostAtMost125PercentOfNative: boolean;
    readonly substrateCostAtMost125PercentOfSham: boolean;
    readonly allGuardrailsPassed: boolean;
  };
  readonly limitations: readonly [
    "provider cost excludes non-provider infrastructure cost",
    "state metrics are server-observed backend/release durations, not client round-trip latency",
    "no relative latency or state-overhead pass threshold is claimed",
  ];
  readonly issues: readonly string[];
  readonly economicsReportSha256: string;
}

export interface SentinelProductionEconomicsReportVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("economics artifact contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error("economics artifact is not canonical JSON");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) &&
    Object.keys(value).sort(compareCodeUnits).join("\0") ===
      [...keys].sort(compareCodeUnits).join("\0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function safeNumber(value: bigint): number | null {
  return value <= MAX_SAFE_BIGINT ? Number(value) : null;
}

function sumSafeIntegers(values: readonly number[]): number | null {
  return safeNumber(values.reduce((sum, value) => sum + BigInt(value), 0n));
}

function sumFinite(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isFinite(total) || total < 0) return null;
  }
  return total;
}

const PRICE_SCHEDULE_BODY = {
  schemaVersion: "pm.public-eval-corners.sentinel-production-price-schedule.v1" as const,
  provider: "Anthropic" as const,
  apiSurface: SENTINEL_ECONOMICS_API_SURFACE,
  model: SENTINEL_ECONOMICS_PINNED_MODEL,
  billingMode: "first-party-standard-direct-not-batch" as const,
  currency: "USD" as const,
  accountingUnit: "integer-micro-USD" as const,
  inputMicroUsdPerToken: 3 as const,
  outputMicroUsdPerToken: 15 as const,
  promptCaching: "disallowed-and-observed-usage-must-be-zero" as const,
  source: {
    authority: "Anthropic official Claude Platform documentation" as const,
    title: "Pricing - Claude Platform Docs" as const,
    url: "https://platform.claude.com/docs/en/about-claude/pricing" as const,
    locator: "Model pricing table; Claude Sonnet 4.5 row; Base Input Tokens and Output Tokens" as const,
    observedOn: "2026-07-14" as const,
    attributedRates: "$3 / MTok base input; $15 / MTok output" as const,
  },
};

export const SENTINEL_PRODUCTION_PRICE_SCHEDULE: SentinelProductionPriceSchedule = deepFreeze({
  ...PRICE_SCHEDULE_BODY,
  scheduleSha256: sha256(canonical(PRICE_SCHEDULE_BODY)),
});

interface ParsedProviderOperation {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly serverToolUseRequests: number;
  readonly latencyMs: number;
  readonly directPinnedSchedule: boolean;
  readonly cachingDisabledAndZero: boolean;
  readonly valid: boolean;
}

function parseProviderOperation(
  value: unknown,
  cellId: string,
  index: number,
  operationIds: Set<string>,
  issues: string[],
): ParsedProviderOperation | null {
  const label = `cell ${cellId} provider operation ${index + 1}`;
  if (!exactKeys(value, [
    "apiSurface", "batchRequested", "cacheCreationInputTokens", "cacheReadInputTokens",
    "inputTokens", "latencyMs", "model", "operationId", "outputTokens",
    "promptCachingRequested", "serverToolUseRequests",
  ])) {
    issues.push(`${label} shape is not exact`);
    return null;
  }
  const operationId = value.operationId;
  if (typeof operationId !== "string" || operationId.length === 0 || operationId.length > 256) {
    issues.push(`${label} operationId is invalid`);
  } else if (operationIds.has(operationId)) {
    issues.push(`${label} operationId is duplicated`);
  } else {
    operationIds.add(operationId);
  }
  const usageValid = [
    value.inputTokens,
    value.outputTokens,
    value.cacheCreationInputTokens,
    value.cacheReadInputTokens,
    value.serverToolUseRequests,
  ].every(safeNonnegativeInteger);
  const latencyValid = finiteNonnegative(value.latencyMs) && value.latencyMs > 0;
  if (!usageValid) issues.push(`${label} usage is not exact nonnegative integer data`);
  if (!latencyValid) issues.push(`${label} provider latency is missing, zero, or invalid`);
  const positiveBaseUsage = usageValid &&
    Number(value.inputTokens) > 0 && Number(value.outputTokens) > 0;
  if (!positiveBaseUsage) issues.push(`${label} has missing or zero base token usage`);
  const directPinnedSchedule =
    value.apiSurface === SENTINEL_ECONOMICS_API_SURFACE &&
    value.model === SENTINEL_ECONOMICS_PINNED_MODEL &&
    value.batchRequested === false;
  if (!directPinnedSchedule) issues.push(`${label} is outside the pinned direct standard schedule`);
  const cachingDisabledAndZero =
    value.promptCachingRequested === false && usageValid &&
    Number(value.cacheCreationInputTokens) === 0 && Number(value.cacheReadInputTokens) === 0;
  if (!cachingDisabledAndZero) issues.push(`${label} requested or observed prompt caching`);
  if (usageValid && Number(value.serverToolUseRequests) !== 0) {
    issues.push(`${label} observed separately priced server-tool use`);
  }
  if (!usageValid || !finiteNonnegative(value.latencyMs)) return null;
  return {
    inputTokens: Number(value.inputTokens),
    outputTokens: Number(value.outputTokens),
    cacheCreationInputTokens: Number(value.cacheCreationInputTokens),
    cacheReadInputTokens: Number(value.cacheReadInputTokens),
    serverToolUseRequests: Number(value.serverToolUseRequests),
    latencyMs: Number(value.latencyMs),
    directPinnedSchedule,
    cachingDisabledAndZero,
    valid: positiveBaseUsage && latencyValid && directPinnedSchedule &&
      cachingDisabledAndZero && Number(value.serverToolUseRequests) === 0,
  };
}

interface ParsedStateOperation {
  readonly requestKind: "read" | "write";
  readonly backendWorkMs: number;
  readonly controlledApiWindowMs: number;
  readonly valid: boolean;
}

function parseStateOperation(
  value: unknown,
  cellId: string,
  index: number,
  operationIds: Set<string>,
  issues: string[],
): ParsedStateOperation | null {
  const label = `cell ${cellId} state operation ${index + 1}`;
  if (!exactKeys(value, [
    "backendWorkMs", "controlledApiWindowMs", "deadlineMissed", "operationId",
    "requestKind", "responseDeadlineMs",
  ])) {
    issues.push(`${label} shape is not exact`);
    return null;
  }
  const operationId = value.operationId;
  if (typeof operationId !== "string" || operationId.length === 0 || operationId.length > 256) {
    issues.push(`${label} operationId is invalid`);
  } else if (operationIds.has(operationId)) {
    issues.push(`${label} operationId is duplicated`);
  } else {
    operationIds.add(operationId);
  }
  const durationsValid = finiteNonnegative(value.backendWorkMs) &&
    finiteNonnegative(value.controlledApiWindowMs);
  if (!durationsValid) issues.push(`${label} state timing is missing or invalid`);
  const kindValid = value.requestKind === "read" || value.requestKind === "write";
  if (!kindValid) issues.push(`${label} request kind is invalid`);
  const boundaryValid =
    value.responseDeadlineMs === SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS &&
    value.deadlineMissed === false && durationsValid &&
    Number(value.backendWorkMs) <= Number(value.controlledApiWindowMs) + 1e-9 &&
    Number(value.controlledApiWindowMs) + 1 >= SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS;
  if (!boundaryValid) issues.push(`${label} missed or changed the matched state response boundary`);
  if (!durationsValid) return null;
  return {
    requestKind: value.requestKind as "read" | "write",
    backendWorkMs: Number(value.backendWorkMs),
    controlledApiWindowMs: Number(value.controlledApiWindowMs),
    valid: kindValid && boundaryValid,
  };
}

function cellEconomics(value: unknown, globalIssues: string[]): SentinelProductionCellEconomics | null {
  if (!exactKeys(value, [
    "arm", "attemptDurationMs", "cellId", "providerOperations", "stateOperations",
  ])) {
    globalIssues.push("economics cell shape is not exact");
    return null;
  }
  if (typeof value.cellId !== "string" || value.cellId.length === 0 || value.cellId.length > 1_024) {
    globalIssues.push("economics cellId is invalid");
    return null;
  }
  if (!SENTINEL_ECONOMICS_ARMS.includes(value.arm as SentinelEconomicsArm)) {
    globalIssues.push(`cell ${value.cellId} arm is invalid`);
    return null;
  }
  const cellId = value.cellId;
  const arm = value.arm as SentinelEconomicsArm;
  const issues: string[] = [];
  const suffix = `:${arm}`;
  const matchedCellKey = cellId.endsWith(suffix) && cellId.length > suffix.length
    ? cellId.slice(0, -suffix.length)
    : null;
  if (matchedCellKey === null) issues.push(`cell ${cellId} does not end with its signed arm suffix`);
  if (!Array.isArray(value.providerOperations)) {
    issues.push(`cell ${cellId} provider operations are absent`);
  }
  if (!Array.isArray(value.stateOperations)) {
    issues.push(`cell ${cellId} state operations are absent`);
  }
  const providerIds = new Set<string>();
  const stateIds = new Set<string>();
  const providerOperations = Array.isArray(value.providerOperations)
    ? value.providerOperations.map((operation, index) =>
      parseProviderOperation(operation, cellId, index, providerIds, issues))
    : [];
  const stateOperations = Array.isArray(value.stateOperations)
    ? value.stateOperations.map((operation, index) =>
      parseStateOperation(operation, cellId, index, stateIds, issues))
    : [];
  if (providerOperations.length === 0) issues.push(`cell ${cellId} has no provider usage operations`);
  if (stateOperations.length === 0) issues.push(`cell ${cellId} has no state timing operations`);
  const parsedProvider = providerOperations.filter((entry): entry is ParsedProviderOperation => entry !== null);
  const parsedState = stateOperations.filter((entry): entry is ParsedStateOperation => entry !== null);
  const inputTokens = parsedProvider.length === providerOperations.length
    ? sumSafeIntegers(parsedProvider.map(({ inputTokens: tokens }) => tokens)) : null;
  const outputTokens = parsedProvider.length === providerOperations.length
    ? sumSafeIntegers(parsedProvider.map(({ outputTokens: tokens }) => tokens)) : null;
  const cacheCreationInputTokens = parsedProvider.length === providerOperations.length
    ? sumSafeIntegers(parsedProvider.map(({ cacheCreationInputTokens: tokens }) => tokens)) : null;
  const cacheReadInputTokens = parsedProvider.length === providerOperations.length
    ? sumSafeIntegers(parsedProvider.map(({ cacheReadInputTokens: tokens }) => tokens)) : null;
  const serverToolUseRequests = parsedProvider.length === providerOperations.length
    ? sumSafeIntegers(parsedProvider.map(({ serverToolUseRequests: count }) => count)) : null;
  if ([inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens, serverToolUseRequests]
    .some((entry) => entry === null)) issues.push(`cell ${cellId} usage totals exceed exact safe-integer reporting`);
  const directPinnedSchedule = providerOperations.length > 0 &&
    parsedProvider.length === providerOperations.length &&
    parsedProvider.every(({ directPinnedSchedule: valid }) => valid);
  const promptCachingDisabledAndZero = providerOperations.length > 0 &&
    parsedProvider.length === providerOperations.length &&
    parsedProvider.every(({ cachingDisabledAndZero }) => cachingDisabledAndZero) &&
    cacheCreationInputTokens === 0 && cacheReadInputTokens === 0;
  const providerUsageComplete = providerOperations.length > 0 &&
    parsedProvider.length === providerOperations.length && parsedProvider.every(({ valid }) => valid);
  const inputCostMicroUsd = inputTokens === null ? null :
    safeNumber(BigInt(inputTokens) * BigInt(SENTINEL_PRODUCTION_PRICE_SCHEDULE.inputMicroUsdPerToken));
  const outputCostMicroUsd = outputTokens === null ? null :
    safeNumber(BigInt(outputTokens) * BigInt(SENTINEL_PRODUCTION_PRICE_SCHEDULE.outputMicroUsdPerToken));
  const totalCostMicroUsd =
    !directPinnedSchedule || !promptCachingDisabledAndZero || serverToolUseRequests !== 0 ||
    inputCostMicroUsd === null || outputCostMicroUsd === null
      ? null
      : safeNumber(BigInt(inputCostMicroUsd) + BigInt(outputCostMicroUsd));
  if (totalCostMicroUsd === null) issues.push(`cell ${cellId} cost cannot be priced by the pinned schedule`);
  const providerLatencyMs = parsedProvider.length === providerOperations.length
    ? sumFinite(parsedProvider.map(({ latencyMs }) => latencyMs)) : null;
  const stateBackendWorkMs = parsedState.length === stateOperations.length
    ? sumFinite(parsedState.map(({ backendWorkMs }) => backendWorkMs)) : null;
  const stateControlledApiWindowMs = parsedState.length === stateOperations.length
    ? sumFinite(parsedState.map(({ controlledApiWindowMs }) => controlledApiWindowMs)) : null;
  const statePairsComplete = stateOperations.length === providerOperations.length * 2 &&
    parsedState.length === stateOperations.length &&
    parsedState.every(({ requestKind }, index) => requestKind === (index % 2 === 0 ? "read" : "write"));
  if (!statePairsComplete) {
    issues.push(`cell ${cellId} does not have one ordered state read/write pair per provider operation`);
  }
  const stateTimingComplete = stateOperations.length > 0 &&
    statePairsComplete && parsedState.every(({ valid }) => valid);
  const attemptDurationMs = finiteNonnegative(value.attemptDurationMs) && value.attemptDurationMs > 0
    ? Number(value.attemptDurationMs) : null;
  if (attemptDurationMs === null) issues.push(`cell ${cellId} attempt duration is missing, zero, or invalid`);
  const costAtOrBelowAbsoluteCap = totalCostMicroUsd !== null &&
    totalCostMicroUsd <= SENTINEL_ECONOMICS_CELL_COST_CAP_MICRO_USD;
  if (!costAtOrBelowAbsoluteCap) issues.push(`cell ${cellId} exceeds or cannot prove the $10 provider-cost cap`);
  const attemptAtOrBelowAbsoluteCap = attemptDurationMs !== null &&
    attemptDurationMs <= SENTINEL_ECONOMICS_ATTEMPT_CAP_MS;
  if (!attemptAtOrBelowAbsoluteCap) issues.push(`cell ${cellId} exceeds or cannot prove the 720-second attempt cap`);
  const allCellGuardrailsPassed = matchedCellKey !== null && providerUsageComplete &&
    directPinnedSchedule && promptCachingDisabledAndZero && stateTimingComplete &&
    costAtOrBelowAbsoluteCap && attemptAtOrBelowAbsoluteCap && issues.length === 0;
  return {
    cellId,
    matchedCellKey,
    arm,
    providerOperationCount: providerOperations.length,
    stateOperationCount: stateOperations.length,
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    serverToolUseRequests,
    inputCostMicroUsd,
    outputCostMicroUsd,
    totalCostMicroUsd,
    providerLatencyMs,
    stateBackendWorkMs,
    stateControlledApiWindowMs,
    attemptDurationMs,
    directPinnedSchedule,
    providerUsageComplete,
    promptCachingDisabledAndZero,
    stateTimingComplete,
    costAtOrBelowAbsoluteCap,
    attemptAtOrBelowAbsoluteCap,
    allCellGuardrailsPassed,
    issues,
  };
}

function aggregateArm(
  arm: SentinelEconomicsArm,
  cells: readonly SentinelProductionCellEconomics[],
): SentinelProductionArmEconomics {
  const selected = cells.filter((cell) => cell.arm === arm);
  const aggregateSafe = (select: (cell: SentinelProductionCellEconomics) => number | null): number | null => {
    const values = selected.map(select);
    return values.every((value): value is number => value !== null)
      ? sumSafeIntegers(values) : null;
  };
  const aggregateFinite = (select: (cell: SentinelProductionCellEconomics) => number | null): number | null => {
    const values = selected.map(select);
    return values.every((value): value is number => value !== null)
      ? sumFinite(values) : null;
  };
  return {
    arm,
    cellCount: selected.length,
    providerOperationCount: selected.reduce((sum, cell) => sum + cell.providerOperationCount, 0),
    stateOperationCount: selected.reduce((sum, cell) => sum + cell.stateOperationCount, 0),
    inputTokens: aggregateSafe(({ inputTokens }) => inputTokens),
    outputTokens: aggregateSafe(({ outputTokens }) => outputTokens),
    totalCostMicroUsd: aggregateSafe(({ totalCostMicroUsd }) => totalCostMicroUsd),
    providerLatencyMs: aggregateFinite(({ providerLatencyMs }) => providerLatencyMs),
    stateBackendWorkMs: aggregateFinite(({ stateBackendWorkMs }) => stateBackendWorkMs),
    stateControlledApiWindowMs: aggregateFinite(({ stateControlledApiWindowMs }) => stateControlledApiWindowMs),
    attemptDurationMs: aggregateFinite(({ attemptDurationMs }) => attemptDurationMs),
    allCellsPassed: selected.length > 0 && selected.every(({ allCellGuardrailsPassed }) => allCellGuardrailsPassed),
  };
}

function costRatio(
  control: "native" | "sham",
  byArm: readonly SentinelProductionArmEconomics[],
): SentinelProductionCostRatioGuardrail {
  const substrateCostMicroUsd = byArm.find(({ arm }) => arm === "substrate")?.totalCostMicroUsd ?? null;
  const controlCostMicroUsd = byArm.find(({ arm }) => arm === control)?.totalCostMicroUsd ?? null;
  const controlCostStrictlyPositive = controlCostMicroUsd !== null && controlCostMicroUsd > 0;
  const passed = substrateCostMicroUsd !== null && controlCostStrictlyPositive &&
    BigInt(substrateCostMicroUsd) * 4n <= BigInt(controlCostMicroUsd as number) * 5n;
  return {
    control,
    substrateCostMicroUsd,
    controlCostMicroUsd,
    exactConstraint: "substrate-cost * 4 <= control-cost * 5",
    controlCostStrictlyPositive,
    passed,
  };
}

function matchedCellsComplete(cells: readonly SentinelProductionCellEconomics[]): boolean {
  if (cells.length === 0 || cells.some(({ matchedCellKey }) => matchedCellKey === null)) return false;
  const groups = new Map<string, SentinelEconomicsArm[]>();
  for (const cell of cells) {
    const key = cell.matchedCellKey as string;
    groups.set(key, [...(groups.get(key) ?? []), cell.arm]);
  }
  return groups.size > 0 && [...groups.values()].every((arms) =>
    arms.length === SENTINEL_ECONOMICS_ARMS.length &&
    SENTINEL_ECONOMICS_ARMS.every((arm) => arms.filter((entry) => entry === arm).length === 1));
}

/**
 * Prices and gates only raw-derived operation measurements. It does not decide
 * benchmark efficacy and intentionally keeps all result eligibility fields false.
 */
export function auditSentinelProductionEconomics(input: unknown): SentinelProductionEconomicsReport {
  const inputSha256 = sha256(canonical(input));
  const issues: string[] = [];
  const inputRecord = exactKeys(input, ["cells", "schemaVersion"]) ? input : null;
  const inputShapeValid = inputRecord !== null &&
    inputRecord.schemaVersion === "pm.public-eval-corners.sentinel-production-economics-input.v1" &&
    Array.isArray(inputRecord.cells);
  if (!inputShapeValid) issues.push("economics input root shape or schema is invalid");
  const rawCells: readonly unknown[] = inputShapeValid && Array.isArray(inputRecord?.cells)
    ? inputRecord.cells : [];
  const cells: readonly SentinelProductionCellEconomics[] = inputShapeValid
    ? rawCells.map((cell) => cellEconomics(cell, issues))
      .filter((cell): cell is SentinelProductionCellEconomics => cell !== null)
    : [];
  const cellIds = new Set<string>();
  for (const cell of cells) {
    if (cellIds.has(cell.cellId)) issues.push(`economics cellId ${cell.cellId} is duplicated`);
    cellIds.add(cell.cellId);
    issues.push(...cell.issues);
  }
  const byArm = SENTINEL_ECONOMICS_ARMS.map((arm) => aggregateArm(arm, cells));
  const nativeRatio = costRatio("native", byArm);
  const shamRatio = costRatio("sham", byArm);
  const matchedFourArmCellsComplete = matchedCellsComplete(cells);
  if (!matchedFourArmCellsComplete) issues.push("matched native/sham/plain-kv/substrate cell sets are incomplete");
  if (!nativeRatio.controlCostStrictlyPositive) issues.push("native control cost is missing or zero");
  if (!shamRatio.controlCostStrictlyPositive) issues.push("sham control cost is missing or zero");
  if (!nativeRatio.passed) issues.push("substrate aggregate provider cost exceeds or cannot prove the native 1.25x guardrail");
  if (!shamRatio.passed) issues.push("substrate aggregate provider cost exceeds or cannot prove the sham 1.25x guardrail");
  const everyCellHasDirectPinnedProviderUsage = cells.length > 0 &&
    cells.every(({ directPinnedSchedule, providerUsageComplete }) => directPinnedSchedule && providerUsageComplete);
  const everyCellDisablesPromptCaching = cells.length > 0 &&
    cells.every(({ promptCachingDisabledAndZero }) => promptCachingDisabledAndZero);
  const everyCellHasStateTiming = cells.length > 0 && cells.every(({ stateTimingComplete }) => stateTimingComplete);
  const everyCellWithinCostCap = cells.length > 0 && cells.every(({ costAtOrBelowAbsoluteCap }) => costAtOrBelowAbsoluteCap);
  const everyCellWithinAttemptCap = cells.length > 0 &&
    cells.every(({ attemptAtOrBelowAbsoluteCap }) => attemptAtOrBelowAbsoluteCap);
  const allGuardrailsPassed = inputShapeValid && cells.length > 0 && issues.length === 0 &&
    everyCellHasDirectPinnedProviderUsage && everyCellDisablesPromptCaching &&
    everyCellHasStateTiming && everyCellWithinCostCap && everyCellWithinAttemptCap &&
    matchedFourArmCellsComplete && nativeRatio.passed && shamRatio.passed;
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-economics-report.v1" as const,
    evidenceEligible: false as const,
    materialBenefit: false as const,
    inputSha256,
    priceSchedule: SENTINEL_PRODUCTION_PRICE_SCHEDULE,
    thresholds: {
      perCellCostCapMicroUsd: SENTINEL_ECONOMICS_CELL_COST_CAP_MICRO_USD,
      perCellAttemptCapMs: SENTINEL_ECONOMICS_ATTEMPT_CAP_MS,
      substrateMaximumCostRatioNumerator: 5 as const,
      substrateMaximumCostRatioDenominator: 4 as const,
      stateResponseDeadlineMs: SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS,
    },
    latencyBoundaries: {
      providerLatency: "sum of direct Messages API attempt-terminal client round trips" as const,
      stateBackendWork: "sum of sidecar receive-to-backend-complete monotonic durations" as const,
      stateControlledApiWindow: "sum of sidecar receive-to-response-release monotonic durations" as const,
      attemptDuration: "supervisor attempt-start to attempt-finish wall duration; end-to-end cap boundary" as const,
      stateClientRoundTripCaptured: false as const,
      componentDurationsMayNotBeSubtractedFromAttemptDuration: true as const,
      relativeProviderLatencyThresholdPreregistered: false as const,
      relativeStateOverheadThresholdPreregistered: false as const,
      relativeLatencyClaimSupported: false as const,
      reason: "no preregistered relative latency threshold and no state client-round-trip capture" as const,
    },
    cells,
    byArm,
    costRatios: [nativeRatio, shamRatio] as const,
    guardrails: {
      inputShapeValid,
      everyCellHasDirectPinnedProviderUsage,
      everyCellDisablesPromptCaching,
      everyCellHasStateTiming,
      everyCellWithinCostCap,
      everyCellWithinAttemptCap,
      matchedFourArmCellsComplete,
      nativeControlCostStrictlyPositive: nativeRatio.controlCostStrictlyPositive,
      shamControlCostStrictlyPositive: shamRatio.controlCostStrictlyPositive,
      substrateCostAtMost125PercentOfNative: nativeRatio.passed,
      substrateCostAtMost125PercentOfSham: shamRatio.passed,
      allGuardrailsPassed,
    },
    limitations: [
      "provider cost excludes non-provider infrastructure cost",
      "state metrics are server-observed backend/release durations, not client round-trip latency",
      "no relative latency or state-overhead pass threshold is claimed",
    ] as const,
    issues,
  };
  return deepFreeze({ ...body, economicsReportSha256: sha256(canonical(body)) });
}

/** Structural/hash verification for a retained economics report. Raw binding remains the caller's job. */
export function verifySentinelProductionEconomicsReport(
  value: unknown,
): SentinelProductionEconomicsReportVerification {
  const issues: string[] = [];
  if (!exactKeys(value, [
    "byArm", "cells", "costRatios", "economicsReportSha256", "evidenceEligible", "guardrails",
    "inputSha256", "issues", "latencyBoundaries", "limitations", "materialBenefit",
    "priceSchedule", "schemaVersion", "thresholds",
  ])) return { valid: false, issues: ["economics report root shape is not exact"] };
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-economics-report.v1" ||
    value.evidenceEligible !== false || value.materialBenefit !== false
  ) issues.push("economics report schema or non-eligibility fields changed");
  if (typeof value.inputSha256 !== "string" || !SHA256.test(value.inputSha256)) {
    issues.push("economics report input hash is invalid");
  }
  try {
    if (canonical(value.priceSchedule) !== canonical(SENTINEL_PRODUCTION_PRICE_SCHEDULE)) {
      issues.push("economics report price schedule differs from the source-attributed frozen schedule");
    }
  } catch {
    issues.push("economics report price schedule is not canonical JSON");
  }
  const { economicsReportSha256, ...body } = value;
  try {
    if (
      typeof economicsReportSha256 !== "string" || !SHA256.test(economicsReportSha256) ||
      economicsReportSha256 !== sha256(canonical(body))
    ) issues.push("economics report hash is invalid");
  } catch {
    issues.push("economics report body is not canonical JSON");
  }
  return { valid: issues.length === 0, issues };
}

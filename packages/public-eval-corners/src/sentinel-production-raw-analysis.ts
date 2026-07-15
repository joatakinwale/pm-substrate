import { createHash } from "node:crypto";

import type {
  SentinelProductionArm,
  SentinelProductionPhase,
  SentinelProductionTaskRole,
} from "./sentinel-production-plan.js";

const ARMS = ["native", "sham", "plain-kv", "substrate"] as const;
const PRIMARY_TASK_COUNT = 19;
const REPEATS_PER_TASK = 3;
const BOOTSTRAP_DRAWS = 10_000;
const BOOTSTRAP_LOWER_INDEX = 499;
const U64_RANGE = 1n << 64n;
const BOOTSTRAP_ACCEPT_LIMIT = (U64_RANGE / BigInt(PRIMARY_TASK_COUNT)) * BigInt(PRIMARY_TASK_COUNT);

export interface SentinelRawCellMeasurement {
  readonly cellId: string;
  readonly taskId: string;
  readonly taskRole: SentinelProductionTaskRole;
  readonly arm: SentinelProductionArm;
  readonly repeatId: string;
  readonly rawComplete: boolean;
  readonly behavioralSuccess: boolean | null;
  readonly providerInputTokens: number | null;
  readonly providerOutputTokens: number | null;
  readonly providerLatencyMs: number | null;
  readonly attemptDurationMs: number | null;
}

export interface SentinelArmEconomics {
  readonly arm: SentinelProductionArm;
  readonly cellCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly providerLatencyMs: number;
  readonly attemptDurationMs: number;
  readonly meanProviderLatencyMs: number;
  readonly meanAttemptDurationMs: number;
}

export interface SentinelArmRoleResult {
  readonly arm: SentinelProductionArm;
  readonly role: SentinelProductionTaskRole;
  readonly successes: number;
  readonly cells: number;
  readonly rate: number | null;
}

export interface SentinelPrimaryContrast {
  readonly control: "native" | "sham";
  readonly substrateRate: number;
  readonly controlRate: number;
  readonly pointLift: number;
  readonly exactSignFlipPValue: number;
  readonly holmRejected: boolean;
}

export interface SentinelPlainKvComparison {
  readonly reported: true;
  readonly substrateRate: number | null;
  readonly plainKvRate: number | null;
  readonly substrateMinusPlainKv: number | null;
  readonly supportsSubstrateSpecificClaim: false;
  readonly reason: "separate-preregistered-contrast-not-authorized";
}

export interface SentinelPoweredAnalysis {
  readonly analysisEligible: boolean;
  readonly rawComplete: boolean;
  readonly expectedIndependentTaskCount: 19;
  readonly observedIndependentTaskCount: number;
  readonly expectedRepeatsPerTask: 3;
  readonly primary: {
    readonly substrateRate: number | null;
    readonly nativeRate: number | null;
    readonly shamRate: number | null;
    readonly substrateMinusMaxControl: number | null;
    readonly bootstrapLowerBound95: number | null;
    readonly contrasts: readonly SentinelPrimaryContrast[];
  };
  readonly guardrails: {
    readonly absoluteCellCount: number;
    readonly absoluteSuccessRate: number | null;
    readonly absoluteAllClean: boolean;
    readonly noopCellCount: number;
    readonly noopSuccessRate: number | null;
    readonly noopAllClean: boolean;
    readonly economicsComplete: boolean;
    readonly economicsGuardrailsPassed: boolean;
    readonly economicsArtifactExternallyVerified: boolean;
  };
  readonly materialBenefit: boolean;
  readonly plainKv: SentinelPlainKvComparison;
  readonly byArmAndRole: readonly SentinelArmRoleResult[];
  readonly economics: readonly SentinelArmEconomics[];
  readonly issues: readonly string[];
}

export interface SentinelRawAnalysisResult {
  readonly phase: SentinelProductionPhase;
  readonly analysisEligible: boolean;
  readonly materialBenefit: boolean;
  readonly powered: SentinelPoweredAnalysis | null;
  readonly plainKv: SentinelPlainKvComparison;
  readonly byArmAndRole: readonly SentinelArmRoleResult[];
  readonly economics: readonly SentinelArmEconomics[];
  readonly issues: readonly string[];
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function finiteNonnegative(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function rate(cells: readonly SentinelRawCellMeasurement[]): number | null {
  if (cells.length === 0 || cells.some(({ behavioralSuccess }) => behavioralSuccess === null)) return null;
  return cells.filter(({ behavioralSuccess }) => behavioralSuccess === true).length / cells.length;
}

function roleSummary(cells: readonly SentinelRawCellMeasurement[]): readonly SentinelArmRoleResult[] {
  const roles: readonly SentinelProductionTaskRole[] = [
    "state-retention-relative",
    "expected-allow-absolute",
    "anti-degenerate-noop",
  ];
  return ARMS.flatMap((arm) => roles.map((role) => {
    const selected = cells.filter((cell) => cell.arm === arm && cell.taskRole === role);
    return {
      arm,
      role,
      successes: selected.filter(({ behavioralSuccess }) => behavioralSuccess === true).length,
      cells: selected.length,
      rate: rate(selected),
    };
  }));
}

function economics(cells: readonly SentinelRawCellMeasurement[]): readonly SentinelArmEconomics[] {
  return ARMS.map((arm) => {
    const selected = cells.filter((cell) => cell.arm === arm);
    const inputTokens = selected.reduce((sum, cell) => sum + (cell.providerInputTokens ?? 0), 0);
    const outputTokens = selected.reduce((sum, cell) => sum + (cell.providerOutputTokens ?? 0), 0);
    const providerLatencyMs = selected.reduce((sum, cell) => sum + (cell.providerLatencyMs ?? 0), 0);
    const attemptDurationMs = selected.reduce((sum, cell) => sum + (cell.attemptDurationMs ?? 0), 0);
    return {
      arm,
      cellCount: selected.length,
      inputTokens,
      outputTokens,
      providerLatencyMs,
      attemptDurationMs,
      meanProviderLatencyMs: selected.length === 0 ? 0 : providerLatencyMs / selected.length,
      meanAttemptDurationMs: selected.length === 0 ? 0 : attemptDurationMs / selected.length,
    };
  });
}

function plainKv(cells: readonly SentinelRawCellMeasurement[]): SentinelPlainKvComparison {
  const relative = cells.filter(({ taskRole }) => taskRole === "state-retention-relative");
  const substrateRate = rate(relative.filter(({ arm }) => arm === "substrate"));
  const plainKvRate = rate(relative.filter(({ arm }) => arm === "plain-kv"));
  return {
    reported: true,
    substrateRate,
    plainKvRate,
    substrateMinusPlainKv:
      substrateRate === null || plainKvRate === null ? null : substrateRate - plainKvRate,
    supportsSubstrateSpecificClaim: false,
    reason: "separate-preregistered-contrast-not-authorized",
  };
}

interface TaskRates {
  readonly taskId: string;
  readonly native: number;
  readonly sham: number;
  readonly "plain-kv": number;
  readonly substrate: number;
  readonly successCounts: Readonly<Record<SentinelProductionArm, number>>;
}

function buildTaskRates(cells: readonly SentinelRawCellMeasurement[], issues: string[]): readonly TaskRates[] {
  const relative = cells.filter(({ taskRole }) => taskRole === "state-retention-relative");
  const taskIds = [...new Set(relative.map(({ taskId }) => taskId))].sort(compare);
  const output: TaskRates[] = [];
  for (const taskId of taskIds) {
    const successCounts = Object.fromEntries(ARMS.map((arm) => {
      const selected = relative.filter((cell) => cell.taskId === taskId && cell.arm === arm);
      const repeats = new Set(selected.map(({ repeatId }) => repeatId));
      if (
        selected.length !== REPEATS_PER_TASK ||
        repeats.size !== REPEATS_PER_TASK ||
        selected.some(({ behavioralSuccess, rawComplete }) => !rawComplete || behavioralSuccess === null)
      ) issues.push(`primary task ${taskId} does not have exactly three raw-complete unique repeats for ${arm}`);
      return [arm, selected.filter(({ behavioralSuccess }) => behavioralSuccess === true).length];
    })) as unknown as Record<SentinelProductionArm, number>;
    output.push({
      taskId,
      native: successCounts.native / REPEATS_PER_TASK,
      sham: successCounts.sham / REPEATS_PER_TASK,
      "plain-kv": successCounts["plain-kv"] / REPEATS_PER_TASK,
      substrate: successCounts.substrate / REPEATS_PER_TASK,
      successCounts,
    });
  }
  if (taskIds.length !== PRIMARY_TASK_COUNT) {
    issues.push(`powered primary stratum has ${taskIds.length} independent tasks, expected 19`);
  }
  return output;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? Number.NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function exactSignFlipPValue(differences: readonly number[]): number {
  const nonzero = differences.filter((value) => value !== 0);
  if (nonzero.length === 0) return 1;
  const observed = nonzero.reduce((sum, value) => sum + value, 0);
  const assignments = 2 ** nonzero.length;
  let atLeastObserved = 0;
  for (let mask = 0; mask < assignments; mask += 1) {
    let statistic = 0;
    for (let index = 0; index < nonzero.length; index += 1) {
      const magnitude = Math.abs(nonzero[index] as number);
      statistic += (mask & (2 ** index)) === 0 ? -magnitude : magnitude;
    }
    if (statistic >= observed) atLeastObserved += 1;
  }
  return atLeastObserved / assignments;
}

function holmDecisions(values: readonly { readonly control: "native" | "sham"; readonly p: number }[]): ReadonlyMap<string, boolean> {
  const ordered = [...values].sort((left, right) => left.p - right.p || compare(left.control, right.control));
  const decisions = new Map<string, boolean>();
  let stopped = false;
  for (const [index, value] of ordered.entries()) {
    const rejected = !stopped && value.p <= 0.05 / (ordered.length - index);
    decisions.set(value.control, rejected);
    if (!rejected) stopped = true;
  }
  return decisions;
}

function sampleIndex(seed: string, counter: bigint): number | null {
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);
  const bytes = createHash("sha256")
    .update(Buffer.from(seed, "utf8"))
    .update(Buffer.from([0]))
    .update(counterBytes)
    .digest();
  const candidate = bytes.readBigUInt64BE(0);
  return candidate >= BOOTSTRAP_ACCEPT_LIMIT ? null : Number(candidate % BigInt(PRIMARY_TASK_COUNT));
}

export function sentinelPoweredBootstrapLowerBound(
  taskRates: readonly TaskRates[],
  seed: string,
): number {
  if (taskRates.length !== PRIMARY_TASK_COUNT || seed.length === 0) {
    throw new Error("powered bootstrap requires exactly 19 tasks and a nonempty signed seed");
  }
  const contrasts: number[] = [];
  let counter = 0n;
  for (let draw = 0; draw < BOOTSTRAP_DRAWS; draw += 1) {
    const selected: TaskRates[] = [];
    while (selected.length < PRIMARY_TASK_COUNT) {
      const index = sampleIndex(seed, counter);
      counter += 1n;
      if (index !== null) selected.push(taskRates[index] as TaskRates);
    }
    contrasts.push(
      mean(selected.map(({ substrate }) => substrate)) -
      Math.max(mean(selected.map(({ native }) => native)), mean(selected.map(({ sham }) => sham))),
    );
  }
  contrasts.sort((left, right) => left - right);
  return contrasts[BOOTSTRAP_LOWER_INDEX] as number;
}

export function analyzeSentinelRawMeasurements(input: {
  readonly phase: SentinelProductionPhase;
  readonly bootstrapSeed: string;
  /** Derived only by raw verification of the frozen external power artifact. */
  readonly powerArtifactExternallyVerified: boolean;
  /** Derived only from the independent raw economics audit, never caller outcome data. */
  readonly economicsGuardrailsPassed: boolean;
  /** The pinned price/threshold artifact must itself be retained and externally verified. */
  readonly economicsArtifactExternallyVerified: boolean;
  readonly cells: readonly SentinelRawCellMeasurement[];
}): SentinelRawAnalysisResult {
  const issues: string[] = [];
  const byArmAndRole = roleSummary(input.cells);
  const armEconomics = economics(input.cells);
  const plain = plainKv(input.cells);
  const allRawComplete = input.cells.length > 0 && input.cells.every(({ rawComplete }) => rawComplete);
  const economicsComplete = input.cells.every((cell) =>
    finiteNonnegative(cell.providerInputTokens) &&
    finiteNonnegative(cell.providerOutputTokens) &&
    finiteNonnegative(cell.providerLatencyMs) &&
    finiteNonnegative(cell.attemptDurationMs));
  if (!allRawComplete) issues.push("not every declared cell is raw complete");
  if (!economicsComplete) issues.push("economics or latency evidence is incomplete");

  if (input.phase !== "powered-confirmatory") {
    return {
      phase: input.phase,
      analysisEligible: false,
      materialBenefit: false,
      powered: null,
      plainKv: plain,
      byArmAndRole,
      economics: armEconomics,
      issues: [...issues, `${input.phase} is permanently ineligible for a material-benefit claim`],
    };
  }

  if (!input.powerArtifactExternallyVerified) {
    issues.push("the separate frozen power artifact lacks independent raw external verification");
  }
  if (!input.economicsGuardrailsPassed) {
    issues.push("raw-derived cost and latency economics guardrails did not all pass");
  }
  if (!input.economicsArtifactExternallyVerified) {
    issues.push("the pinned price and economics-threshold artifact lacks independent raw external verification");
  }

  const taskRates = buildTaskRates(input.cells, issues);
  const observedTaskCount = taskRates.length;
  const structurallyEligible =
    allRawComplete &&
    economicsComplete &&
    input.powerArtifactExternallyVerified &&
    input.economicsGuardrailsPassed &&
    input.economicsArtifactExternallyVerified &&
    issues.length === 0;
  const substrateRate = taskRates.length === 0 ? null : mean(taskRates.map(({ substrate }) => substrate));
  const nativeRate = taskRates.length === 0 ? null : mean(taskRates.map(({ native }) => native));
  const shamRate = taskRates.length === 0 ? null : mean(taskRates.map(({ sham }) => sham));
  const rawPValues = (["native", "sham"] as const).map((control) => ({
    control,
    p: taskRates.length === PRIMARY_TASK_COUNT
      ? exactSignFlipPValue(taskRates.map(({ successCounts }) =>
        successCounts.substrate - successCounts[control]))
      : 1,
  }));
  const holm = holmDecisions(rawPValues);
  const contrasts: SentinelPrimaryContrast[] = rawPValues.map(({ control, p }) => ({
    control,
    substrateRate: substrateRate ?? 0,
    controlRate: control === "native" ? (nativeRate ?? 0) : (shamRate ?? 0),
    pointLift: (substrateRate ?? 0) - (control === "native" ? (nativeRate ?? 0) : (shamRate ?? 0)),
    exactSignFlipPValue: p,
    holmRejected: holm.get(control) === true,
  }));
  let bootstrapLowerBound95: number | null = null;
  if (taskRates.length === PRIMARY_TASK_COUNT && input.bootstrapSeed.length > 0) {
    bootstrapLowerBound95 = sentinelPoweredBootstrapLowerBound(taskRates, input.bootstrapSeed);
  } else {
    issues.push("bootstrap could not run against the exact 19-task signed primary stratum");
  }
  const absolute = input.cells.filter(({ taskRole }) => taskRole === "expected-allow-absolute");
  const noop = input.cells.filter(({ taskRole }) => taskRole === "anti-degenerate-noop");
  const absoluteSuccessRate = rate(absolute);
  const noopSuccessRate = rate(noop);
  const absoluteAllClean = absolute.length > 0 && absoluteSuccessRate === 1;
  const noopAllClean = noop.length > 0 && noopSuccessRate === 1;
  if (!absoluteAllClean) issues.push("expected-allow absolute guardrail is not 100% clean");
  if (!noopAllClean) issues.push("anti-degenerate no-op guardrail is not 100% clean");
  const materialBenefit =
    structurallyEligible &&
    absoluteAllClean &&
    noopAllClean &&
    contrasts.every(({ pointLift, holmRejected }) => pointLift >= 0.1 && holmRejected) &&
    bootstrapLowerBound95 !== null &&
    bootstrapLowerBound95 > 0;
  const powered: SentinelPoweredAnalysis = {
    analysisEligible: structurallyEligible,
    rawComplete: allRawComplete,
    expectedIndependentTaskCount: 19,
    observedIndependentTaskCount: observedTaskCount,
    expectedRepeatsPerTask: 3,
    primary: {
      substrateRate,
      nativeRate,
      shamRate,
      substrateMinusMaxControl:
        substrateRate === null || nativeRate === null || shamRate === null
          ? null
          : substrateRate - Math.max(nativeRate, shamRate),
      bootstrapLowerBound95,
      contrasts,
    },
    guardrails: {
      absoluteCellCount: absolute.length,
      absoluteSuccessRate,
      absoluteAllClean,
      noopCellCount: noop.length,
      noopSuccessRate,
      noopAllClean,
      economicsComplete,
      economicsGuardrailsPassed: input.economicsGuardrailsPassed,
      economicsArtifactExternallyVerified: input.economicsArtifactExternallyVerified,
    },
    materialBenefit,
    plainKv: plain,
    byArmAndRole,
    economics: armEconomics,
    issues,
  };
  return {
    phase: input.phase,
    analysisEligible: powered.analysisEligible,
    materialBenefit,
    powered,
    plainKv: plain,
    byArmAndRole,
    economics: armEconomics,
    issues,
  };
}

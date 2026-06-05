import {
  COORDINATION_CLASSES,
  FAILURE_CLASSES,
  MAST_CATEGORIES,
  MEMORY_BENCHMARK_BRIDGES,
  RUN_ARMS,
  STATE_BENCH_CATEGORIES,
  assertEvalEvent,
  type CoordinationClass,
  type EvalEvent,
  type EvalResult,
  type FailureClass,
  type MastCategory,
  type MemoryBenchmarkBridge,
  type RunArm,
  type StateBenchCategory,
} from "./schema.js";

export interface IncompletePairedGroup {
  readonly pairedRunGroup: string;
  readonly missingArms: readonly RunArm[];
}

export interface CoordinationClassMetrics {
  readonly events: number;
  readonly pairedGroups: number;
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly substratePasses: number;
  readonly substrateBlocked: number;
}

export interface FailureClassMetrics {
  readonly events: number;
  readonly pairedGroups: number;
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly substratePasses: number;
  readonly substrateBlocked: number;
}

export interface EvalEventMetrics {
  readonly totalEvents: number;
  readonly pairedGroups: number;
  readonly completePairedGroups: number;
  readonly incompletePairedGroups: readonly IncompletePairedGroup[];
  readonly baselineFailures: number;
  readonly substrateFailures: number;
  readonly failureReduction: number;
  readonly stateBenchCategories: readonly StateBenchCategory[];
  readonly memoryBenchmarkBridges: readonly MemoryBenchmarkBridge[];
  readonly mastCategories: readonly MastCategory[];
  readonly coordinationClasses: readonly CoordinationClass[];
  readonly byCoordinationClass: Readonly<Record<CoordinationClass, CoordinationClassMetrics>>;
  readonly byFailureClass: Readonly<Record<FailureClass, FailureClassMetrics>>;
  readonly authorityGatePassRate: number | null;
  readonly convergentUpdateAutoResolutionRate: number | null;
}

export interface AdapterOperationalSample {
  readonly adapterStartedAt: string;
  readonly firstValidEventAt?: string;
  readonly mappingAttempts: number;
  readonly mappingRejections: number;
  readonly stateComparisons: number;
  readonly stateDisagreements: number;
}

export interface AdapterOperationalMetrics {
  readonly adapterTimeToFirstValidEventMs: number | null;
  readonly mappingRejectionRate: number | null;
  readonly stateDisagreementRate: number | null;
  readonly authorityGatePassRate: number | null;
  readonly authorityGatePasses: number;
  readonly authorityGateFailures: number;
}

export interface StateAssertionSample {
  readonly code: string;
  readonly passed: boolean;
  readonly severity: string;
}

export interface StateAssertionMetrics {
  readonly totalAssertions: number;
  readonly passedAssertions: number;
  readonly failedAssertions: number;
  readonly passRate: number | null;
  readonly failedByCode: Readonly<Record<string, number>>;
  readonly failedBySeverity: Readonly<Record<string, number>>;
}

interface MutableCoordinationClassMetrics {
  events: number;
  pairedGroups: Set<string>;
  baselineFailures: number;
  substrateFailures: number;
  substratePasses: number;
  substrateBlocked: number;
}

interface MutableFailureClassMetrics {
  events: number;
  pairedGroups: Set<string>;
  baselineFailures: number;
  substrateFailures: number;
  substratePasses: number;
  substrateBlocked: number;
}

export function analyzeEvalEvents(events: readonly EvalEvent[]): EvalEventMetrics {
  const validEvents = events.map((event) => assertEvalEvent(event));
  const pairedGroups = new Map<string, EvalEvent[]>();
  const byCoordinationClass = makeCoordinationMetrics();
  const byFailureClass = makeFailureClassMetrics();

  for (const event of validEvents) {
    if (event.pairedRunGroup) {
      const group = pairedGroups.get(event.pairedRunGroup) ?? [];
      group.push(event);
      pairedGroups.set(event.pairedRunGroup, group);
    }

    const failureBucket = byFailureClass[event.failureClass];
    failureBucket.events += 1;
    if (event.pairedRunGroup) {
      failureBucket.pairedGroups.add(event.pairedRunGroup);
    }
    if (event.runArm === "baseline" && event.result === "fail") {
      failureBucket.baselineFailures += 1;
    }
    if (event.runArm === "substrate") {
      if (event.result === "fail") failureBucket.substrateFailures += 1;
      if (event.result === "pass") failureBucket.substratePasses += 1;
      if (event.result === "blocked") failureBucket.substrateBlocked += 1;
    }

    if (event.coordinationClass) {
      const bucket = byCoordinationClass[event.coordinationClass];
      bucket.events += 1;
      if (event.pairedRunGroup) {
        bucket.pairedGroups.add(event.pairedRunGroup);
      }
      if (event.runArm === "baseline" && event.result === "fail") {
        bucket.baselineFailures += 1;
      }
      if (event.runArm === "substrate") {
        if (event.result === "fail") bucket.substrateFailures += 1;
        if (event.result === "pass") bucket.substratePasses += 1;
        if (event.result === "blocked") bucket.substrateBlocked += 1;
      }
    }
  }

  const incompletePairedGroups: IncompletePairedGroup[] = [];
  let completePairedGroups = 0;
  let convergentPairs = 0;
  let convergentResolvedPairs = 0;

  for (const [pairedRunGroup, group] of pairedGroups) {
    const arms = new Set(group.map((event) => event.runArm).filter(isRunArm));
    const missingArms = RUN_ARMS.filter((arm) => !arms.has(arm));
    if (missingArms.length > 0) {
      incompletePairedGroups.push({ pairedRunGroup, missingArms });
      continue;
    }

    completePairedGroups += 1;
    if (group.some((event) => event.coordinationClass === "convergent_update")) {
      convergentPairs += 1;
      if (
        group.some((event) => event.runArm === "baseline" && event.result === "fail") &&
        group.some((event) => event.runArm === "substrate" && event.result === "pass")
      ) {
        convergentResolvedPairs += 1;
      }
    }
  }

  const baselineFailures = countResult(validEvents, "baseline", "fail");
  const substrateFailures = countResult(validEvents, "substrate", "fail");
  const authorityGate = byCoordinationClass["authority_gated_transition"];
  const authorityGateDecisions =
    authorityGate.substratePasses + authorityGate.substrateFailures;

  return {
    totalEvents: validEvents.length,
    pairedGroups: pairedGroups.size,
    completePairedGroups,
    incompletePairedGroups: incompletePairedGroups.sort((a, b) =>
      a.pairedRunGroup.localeCompare(b.pairedRunGroup),
    ),
    baselineFailures,
    substrateFailures,
    failureReduction: baselineFailures - substrateFailures,
    stateBenchCategories: uniqueByCanonicalOrder(
      validEvents,
      STATE_BENCH_CATEGORIES,
      (event) => event.stateBenchCategory,
    ),
    memoryBenchmarkBridges: uniqueByCanonicalOrder(
      validEvents,
      MEMORY_BENCHMARK_BRIDGES,
      (event) => event.memoryBenchmarkBridge,
    ),
    mastCategories: uniqueByCanonicalOrder(
      validEvents,
      MAST_CATEGORIES,
      (event) => event.mastCategory,
    ),
    coordinationClasses: uniqueByCanonicalOrder(
      validEvents,
      COORDINATION_CLASSES,
      (event) => event.coordinationClass,
    ),
    byCoordinationClass: freezeCoordinationMetrics(byCoordinationClass),
    byFailureClass: freezeFailureClassMetrics(byFailureClass),
    authorityGatePassRate:
      authorityGateDecisions === 0
        ? null
        : authorityGate.substratePasses / authorityGateDecisions,
    convergentUpdateAutoResolutionRate:
      convergentPairs === 0 ? null : convergentResolvedPairs / convergentPairs,
  };
}

export function analyzeAdapterOperationalMetrics(
  events: readonly EvalEvent[],
  samples: readonly AdapterOperationalSample[],
): AdapterOperationalMetrics {
  const evalMetrics = analyzeEvalEvents(events);
  const attempts = sum(samples, (sample) => sample.mappingAttempts);
  const rejections = sum(samples, (sample) => sample.mappingRejections);
  const comparisons = sum(samples, (sample) => sample.stateComparisons);
  const disagreements = sum(samples, (sample) => sample.stateDisagreements);
  const authority = evalMetrics.byCoordinationClass["authority_gated_transition"];

  return {
    adapterTimeToFirstValidEventMs: firstValidEventLatency(samples),
    mappingRejectionRate: attempts === 0 ? null : rejections / attempts,
    stateDisagreementRate: comparisons === 0 ? null : disagreements / comparisons,
    authorityGatePassRate: evalMetrics.authorityGatePassRate,
    authorityGatePasses: authority.substratePasses,
    authorityGateFailures: authority.substrateFailures,
  };
}

export function analyzeStateAssertions(
  samples: readonly StateAssertionSample[],
): StateAssertionMetrics {
  const failed = samples.filter((sample) => !sample.passed);
  const passed = samples.length - failed.length;

  return {
    totalAssertions: samples.length,
    passedAssertions: passed,
    failedAssertions: failed.length,
    passRate: samples.length === 0 ? null : passed / samples.length,
    failedByCode: countBy(failed, (sample) => sample.code),
    failedBySeverity: countBy(failed, (sample) => sample.severity),
  };
}

function makeCoordinationMetrics(): Record<CoordinationClass, MutableCoordinationClassMetrics> {
  return Object.fromEntries(
    COORDINATION_CLASSES.map((coordinationClass) => [
      coordinationClass,
      {
        events: 0,
        pairedGroups: new Set<string>(),
        baselineFailures: 0,
        substrateFailures: 0,
        substratePasses: 0,
        substrateBlocked: 0,
      },
    ]),
  ) as Record<CoordinationClass, MutableCoordinationClassMetrics>;
}

function makeFailureClassMetrics(): Record<FailureClass, MutableFailureClassMetrics> {
  return Object.fromEntries(
    FAILURE_CLASSES.map((failureClass) => [
      failureClass,
      {
        events: 0,
        pairedGroups: new Set<string>(),
        baselineFailures: 0,
        substrateFailures: 0,
        substratePasses: 0,
        substrateBlocked: 0,
      },
    ]),
  ) as Record<FailureClass, MutableFailureClassMetrics>;
}

function freezeCoordinationMetrics(
  input: Record<CoordinationClass, MutableCoordinationClassMetrics>,
): Record<CoordinationClass, CoordinationClassMetrics> {
  return Object.fromEntries(
    COORDINATION_CLASSES.map((coordinationClass) => {
      const metrics = input[coordinationClass];
      return [
        coordinationClass,
        {
          events: metrics.events,
          pairedGroups: metrics.pairedGroups.size,
          baselineFailures: metrics.baselineFailures,
          substrateFailures: metrics.substrateFailures,
          failureReduction: metrics.baselineFailures - metrics.substrateFailures,
          substratePasses: metrics.substratePasses,
          substrateBlocked: metrics.substrateBlocked,
        },
      ];
    }),
  ) as Record<CoordinationClass, CoordinationClassMetrics>;
}

function freezeFailureClassMetrics(
  input: Record<FailureClass, MutableFailureClassMetrics>,
): Record<FailureClass, FailureClassMetrics> {
  return Object.fromEntries(
    FAILURE_CLASSES.map((failureClass) => {
      const metrics = input[failureClass];
      return [
        failureClass,
        {
          events: metrics.events,
          pairedGroups: metrics.pairedGroups.size,
          baselineFailures: metrics.baselineFailures,
          substrateFailures: metrics.substrateFailures,
          failureReduction: metrics.baselineFailures - metrics.substrateFailures,
          substratePasses: metrics.substratePasses,
          substrateBlocked: metrics.substrateBlocked,
        },
      ];
    }),
  ) as Record<FailureClass, FailureClassMetrics>;
}

function countResult(
  events: readonly EvalEvent[],
  runArm: RunArm,
  result: EvalResult,
): number {
  return events.filter((event) => event.runArm === runArm && event.result === result).length;
}

function firstValidEventLatency(
  samples: readonly AdapterOperationalSample[],
): number | null {
  const durations = samples
    .flatMap((sample) => {
      if (!sample.firstValidEventAt) return [];
      const start = Date.parse(sample.adapterStartedAt);
      const first = Date.parse(sample.firstValidEventAt);
      if (!Number.isFinite(start) || !Number.isFinite(first)) return [];
      return [first - start];
    })
    .filter((duration) => duration >= 0);
  if (durations.length === 0) return null;
  return Math.min(...durations);
}

function sum<T>(
  values: readonly T[],
  getValue: (value: T) => number,
): number {
  return values.reduce((acc, value) => acc + getValue(value), 0);
}

function countBy<T>(
  values: readonly T[],
  getValue: (value: T) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) {
    const key = getValue(value);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function uniqueByCanonicalOrder<T extends string>(
  events: readonly EvalEvent[],
  canonical: readonly T[],
  getValue: (event: EvalEvent) => T | undefined,
): readonly T[] {
  const seen = new Set(events.map(getValue).filter(isPresent));
  return canonical.filter((value) => seen.has(value));
}

function isRunArm(value: RunArm | undefined): value is RunArm {
  return value !== undefined;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

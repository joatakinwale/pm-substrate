import { createHash } from "node:crypto";

const U32_RANGE = 2 ** 32;
const U64_RANGE = 1n << 64n;
const RATE_DENOMINATOR_PPM = 1_000_000;
const TASK_COUNT = 19;
const REPEATS_PER_TASK = 3;
const MATERIAL_LIFT_PPM = 100_000;
const PLANNING_ALTERNATIVE_LIFT_PPM = 350_000;
const TARGET_POWER = 0.8;
const FAMILYWISE_CONFIDENCE = 0.99;
const AUTHORITATIVE_TRIALS_PER_CELL = 2_048;
const BOOTSTRAP_DRAWS = 10_000;
const BOOTSTRAP_LOWER_INDEX = 499;
const AUTHORITATIVE_BASELINE_GRID_PPM = Object.freeze([
  0, 50_000, 100_000, 150_000, 200_000, 250_000, 300_000,
  350_000, 400_000, 450_000, 500_000, 550_000, 600_000, 650_000,
] as const);
const AUTHORITATIVE_REPEAT_ICC_SUITE_PPM = Object.freeze([
  0, 100_000, 250_000, 1_000_000,
] as const);
const SIMULATION_SEED =
  "sentinel-power-simulation-v2-c834011c79c134ed14c17ecbca312934de22054c77dd5fbb000ad5ae0560c132";
const BOOTSTRAP_SEED =
  "sentinel-power-bootstrap-v2-c834011c79c134ed14c17ecbca312934de22054c77dd5fbb000ad5ae0560c132";

export interface SentinelProductionPowerAudit {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-power-audit.v1";
  readonly status: "falsified-before-outcomes";
  readonly model: "independent-binomial-equal-native-and-sham-rates-v1";
  readonly scope: "necessary-two-control-point-lift-gate-only";
  readonly taskCount: 19;
  readonly repeatsPerTask: 3;
  readonly observationsPerArm: 57;
  readonly planningTrueLift: 0.1;
  readonly minimumObservedLiftOverEachControl: 0.1;
  readonly minimumSuccessCountDifference: 6;
  readonly targetFullProcedurePower: 0.8;
  readonly baselineGrid: {
    readonly start: 0;
    readonly endInclusive: 0.9;
    readonly step: 0.0001;
    readonly points: 9001;
  };
  readonly maximumNecessaryGateProbabilityOnGrid: number;
  readonly maximizingControlRateOnGrid: number;
  readonly fullProcedurePowerCannotExceedNecessaryGateProbability: true;
  readonly omittedFullProcedureGates: readonly [
    "both-Holm-corrected-paired-sign-flip-rejections",
    "positive-task-bootstrap-lower-bound",
    "raw-complete-absolute-noop-and-economics-guardrails",
  ];
  readonly targetMetAtAnyDeclaredBaseline: false;
  readonly conclusion: "19x3-cannot-be-declared-80-percent-powered-for-true-ten-point-lift-under-model";
  readonly auditSha256: string;
}

export interface SentinelPowerSimulationCell {
  readonly cellId: string;
  readonly baselineRatePpm: number;
  readonly substrateRatePpm: number;
  readonly repeatIntraclassCorrelationPpm: number;
  readonly trials: number;
  readonly pointLiftGatePasses: number;
  readonly bothHolmRejectionsPasses: number;
  readonly bootstrapPositiveLowerBoundPasses: number;
  readonly fullDeclaredRulePasses: number;
  readonly estimatedPower: number;
  readonly simultaneousClopperPearsonLowerBound: number;
  readonly targetMetByConservativeLowerBound: boolean;
}

export interface SentinelProductionPowerRedesignAudit {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-power-redesign.v2";
  readonly generatedWithoutBenchmarkOutcomes: true;
  readonly authoritativeConfiguration: boolean;
  readonly status:
    | "conditional-power-only-redesign-not-yet-eligible"
    | "planning-alternative-not-powered";
  readonly currentTenPointDesignFalsification: SentinelProductionPowerAudit;
  readonly estimandBoundary: {
    readonly minimumObservedMaterialLiftOverEachControl: 0.1;
    readonly planningAlternativeTrueLift: 0.35;
    readonly planningAlternativeIsNotClaimThreshold: true;
    readonly targetPower: 0.8;
    readonly familywiseAlpha: 0.05;
  };
  readonly design: {
    readonly independentTaskCount: 19;
    readonly repeatsPerTask: 3;
    readonly observationsPerArm: 57;
    readonly nativeAndShamMarginalRatesEqual: true;
    readonly armsIndependentConditionalOnTaskRate: true;
    readonly tasksIndependent: true;
    readonly baselineGridPpm: readonly number[];
    readonly repeatIntraclassCorrelationSuitePpm: readonly number[];
  };
  readonly stochasticModel: {
    readonly id: "exchangeable-repeat-mixture-equal-controls-v1";
    readonly taskArmGeneration: "with-probability-rho-one-bernoulli-is-shared-by-all-repeats-otherwise-repeats-are-independent";
    readonly marginalRatePreserved: true;
    readonly withinTaskArmRepeatIccEqualsRho: true;
    readonly taskRatesHomogeneousWithinEachBaselineCell: true;
    readonly limitation: "power-is-conditional-on-the-listed-data-generating-assumptions-not-a-property-of-the-benchmark-alone";
  };
  readonly fullDeclaredRule: {
    readonly bothPointLiftsAtLeast: 0.1;
    readonly pairedTaskSignFlipTests: "both-one-sided-exact-with-Holm-FWER-0.05";
    readonly bootstrap: "exact-signed-10000-draw-task-bootstrap-index-499-strictly-positive";
    readonly guardrails: "raw-complete-infrastructure-complete-economics-complete-absolute-clean-noop-clean-all-required";
  };
  readonly guardrailAssumptionAndStress: {
    readonly planningAssumption: "all-guardrails-pass-with-probability-one";
    readonly interpretation: "optimistic-upper-condition-any-guardrail-failure-forces-the-full-rule-to-false";
    readonly forcedFailureChecks: readonly [
      "raw-incomplete-fails",
      "infrastructure-incomplete-fails",
      "economics-incomplete-fails",
      "absolute-dirty-fails",
      "noop-dirty-fails",
    ];
  };
  readonly simulation: {
    readonly trialsPerCell: number;
    readonly seed: string;
    readonly prng: "sha256-trial-seed-xoshiro128starstar-u32-threshold-v1";
    readonly probabilityEncoding: "integer-parts-per-million-to-floor-p-times-2^32";
    readonly bootstrapSeed: string;
    readonly bootstrapDraws: 10_000;
    readonly bootstrapLowerIndex: 499;
    readonly exactIntegerSignFlipEnumeration: true;
    readonly monteCarloUncertainty: "one-sided-Clopper-Pearson-with-Bonferroni-family-confidence";
    readonly simultaneousFamilyConfidence: 0.99;
    readonly cellsInConfidenceFamily: number;
    readonly perCellTailAlpha: number;
  };
  readonly results: readonly SentinelPowerSimulationCell[];
  readonly conclusions: {
    readonly minimumIndependentRepeatLowerBound: number;
    readonly independentRepeatTargetMetAcrossBaselineGrid: boolean;
    readonly minimumListedZeroAndPointOneIccLowerBound: number;
    readonly listedZeroAndPointOneIccTargetMetAcrossBaselineGrid: boolean;
    readonly minimumAllSensitivityLowerBound: number;
    readonly targetMetAcrossAllDependenceSensitivityCells: boolean;
    readonly planningAlternativeCanPowerConditional19x3Design: boolean;
    readonly repeatDependenceBoundEstablishedByEvidence: false;
    readonly poweredExecutionEligibleFromThisArtifactAlone: false;
    readonly smallestHonestRedesign: "separate-0.10-materiality-from-0.35-planning-alternative-and-retain-19x3-only-after-independent-evidence-bounds-repeat-dependence-and-the-calculation-covers-the-accepted-range-otherwise-add-independent-relative-tasks-and-repower";
  };
  readonly procedure: typeof SENTINEL_POWER_CALCULATION_PROCEDURE;
  readonly procedureSha256: string;
  readonly auditSha256: string;
}

export interface SentinelPowerRedesignInput {
  readonly trialsPerCell?: number;
  readonly baselineGridPpm?: readonly number[];
  readonly repeatIntraclassCorrelationSuitePpm?: readonly number[];
  readonly simulationSeed?: string;
  readonly bootstrapSeed?: string;
}

export const SENTINEL_POWER_CALCULATION_PROCEDURE = Object.freeze({
  schemaVersion: "pm.public-eval-corners.sentinel-power-calculation-procedure.v2",
  sourceOutcomeAccess: "none",
  arms: Object.freeze(["native", "sham", "substrate"] as const),
  trialSeedBytes: "sha256(utf8-simulation-seed || 0x00 || utf8-cell-id || 0x00 || u64be-trial-index)",
  prng: "xoshiro128**-uint32-reference-transition-v1",
  successComparison: "next-u32-strictly-less-than-floor(rate-ppm-times-2^32-over-1000000)",
  repeatMixture: "draw-shared-mode-per-task-arm-then-one-or-three-bernoulli-draws",
  pointGate: "integer-success-difference-at-least-ceil(0.10-times-57)-for-both-controls",
  signFlip: "integer-dynamic-program-over-all-sign-assignments-of-nonzero-task-differences",
  holm: "smaller-p-at-most-1-over-40-and-larger-p-at-most-1-over-20",
  bootstrapIndexPrng: "sha256(utf8-bootstrap-seed || 0x00 || u64be-counter)-first-u64be-rejection-mod-19",
  bootstrapDecision: "at-most-499-of-10000-resamples-have-substrate-minus-max-control-at-most-zero",
  guardrails: "logical-conjunction-of-five-required-clean-flags",
  uncertainty: "one-sided-exact-binomial-Clopper-Pearson-lower-bound-with-Bonferroni-across-all-cells",
} as const);

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("power audit rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error("power audit value is not canonical JSON");
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sentinelPowerCanonicalJson(value: unknown): string {
  return canonical(value);
}

export function sentinelPowerJsonSha256(value: unknown): string {
  return sha256(canonical(value));
}

function probability(value: number): number {
  if (!Number.isFinite(value) || value < -1e-12 || value > 1 + 1e-12) {
    throw new Error("computed value is not a probability");
  }
  return Number(Math.min(1, Math.max(0, value)).toPrecision(15));
}

function binomialMasses(trials: number, successProbability: number): readonly number[] {
  if (!Number.isSafeInteger(trials) || trials < 1) throw new Error("trials must be positive");
  if (!Number.isFinite(successProbability) || successProbability < 0 || successProbability > 1) {
    throw new Error("success probability must be between zero and one");
  }
  if (successProbability === 0) return [1, ...Array<number>(trials).fill(0)];
  if (successProbability === 1) return [...Array<number>(trials).fill(0), 1];
  const masses = Array<number>(trials + 1).fill(0);
  masses[0] = (1 - successProbability) ** trials;
  for (let successes = 0; successes < trials; successes += 1) {
    masses[successes + 1] = (masses[successes] as number) *
      ((trials - successes) / (successes + 1)) *
      (successProbability / (1 - successProbability));
  }
  return masses;
}

/** Exact necessary-gate audit retained so the invalid 0.10=true=claim design cannot regress. */
export function exactTwoControlPointGateProbability(input: {
  readonly observationsPerArm: number;
  readonly controlRate: number;
  readonly trueLift: number;
  readonly minimumObservedLift: number;
}): number {
  const observations = input.observationsPerArm;
  if (!Number.isSafeInteger(observations) || observations < 1) {
    throw new Error("observationsPerArm must be positive");
  }
  const treatmentRate = input.controlRate + input.trueLift;
  if (
    !Number.isFinite(input.controlRate) || input.controlRate < 0 || input.controlRate > 1 ||
    !Number.isFinite(input.trueLift) || input.trueLift < 0 || treatmentRate > 1 ||
    !Number.isFinite(input.minimumObservedLift) ||
    input.minimumObservedLift < 0 || input.minimumObservedLift > 1
  ) throw new Error("point-gate planning rates are invalid");
  const minimumDifference = Math.ceil(input.minimumObservedLift * observations - 1e-12);
  const treatmentMasses = binomialMasses(observations, treatmentRate);
  const controlMasses = binomialMasses(observations, input.controlRate);
  const controlCdf: number[] = [];
  let cumulative = 0;
  for (let count = 0; count <= observations; count += 1) {
    cumulative += controlMasses[count] as number;
    controlCdf.push(cumulative);
  }
  let result = 0;
  for (let treatmentCount = 0; treatmentCount <= observations; treatmentCount += 1) {
    const largestPassingControlCount = treatmentCount - minimumDifference;
    const oneControlProbability = largestPassingControlCount < 0
      ? 0
      : largestPassingControlCount >= observations
        ? 1
        : controlCdf[largestPassingControlCount] as number;
    result += (treatmentMasses[treatmentCount] as number) * oneControlProbability ** 2;
  }
  return probability(result);
}

export function auditCurrentSentinelProductionPower(): SentinelProductionPowerAudit {
  const observationsPerArm = TASK_COUNT * REPEATS_PER_TASK;
  const step = 0.0001;
  const gridPoints = Math.round(0.9 / step) + 1;
  let maximum = -1;
  let maximizingControlRate = -1;
  for (let index = 0; index < gridPoints; index += 1) {
    const controlRate = Number((index * step).toFixed(4));
    const candidate = exactTwoControlPointGateProbability({
      observationsPerArm,
      controlRate,
      trueLift: 0.1,
      minimumObservedLift: 0.1,
    });
    if (candidate > maximum) {
      maximum = candidate;
      maximizingControlRate = controlRate;
    }
  }
  if (maximum >= TARGET_POWER) {
    throw new Error("the current power design was not falsified on its declared baseline grid");
  }
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-power-audit.v1" as const,
    status: "falsified-before-outcomes" as const,
    model: "independent-binomial-equal-native-and-sham-rates-v1" as const,
    scope: "necessary-two-control-point-lift-gate-only" as const,
    taskCount: 19 as const,
    repeatsPerTask: 3 as const,
    observationsPerArm: 57 as const,
    planningTrueLift: 0.1 as const,
    minimumObservedLiftOverEachControl: 0.1 as const,
    minimumSuccessCountDifference: 6 as const,
    targetFullProcedurePower: 0.8 as const,
    baselineGrid: { start: 0 as const, endInclusive: 0.9 as const, step: 0.0001 as const, points: 9001 as const },
    maximumNecessaryGateProbabilityOnGrid: maximum,
    maximizingControlRateOnGrid: maximizingControlRate,
    fullProcedurePowerCannotExceedNecessaryGateProbability: true as const,
    omittedFullProcedureGates: [
      "both-Holm-corrected-paired-sign-flip-rejections",
      "positive-task-bootstrap-lower-bound",
      "raw-complete-absolute-noop-and-economics-guardrails",
    ] as const,
    targetMetAtAnyDeclaredBaseline: false as const,
    conclusion: "19x3-cannot-be-declared-80-percent-powered-for-true-ten-point-lift-under-model" as const,
  };
  return { ...body, auditSha256: sha256(canonical(body)) };
}

function validatePpm(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > RATE_DENOMINATOR_PPM) {
    throw new Error(`${name} must be an integer rate in parts per million`);
  }
}

function rateThreshold(ratePpm: number): number {
  validatePpm(ratePpm, "rate");
  return Number((BigInt(ratePpm) * (1n << 32n)) / BigInt(RATE_DENOMINATOR_PPM));
}

function rotateLeft32(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

class Xoshiro128StarStar {
  private readonly state: Uint32Array;

  constructor(seed: Uint8Array) {
    if (seed.byteLength !== 32) throw new Error("xoshiro seed must contain exactly 32 bytes");
    const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
    this.state = new Uint32Array(4);
    for (let index = 0; index < 4; index += 1) {
      this.state[index] = view.getUint32(index * 4, false);
    }
    if (this.state.every((value) => value === 0)) this.state[0] = 0x9e3779b9;
  }

  nextUint32(): number {
    const state = this.state;
    const s0 = state[0] as number;
    const s1 = state[1] as number;
    const s2 = state[2] as number;
    const s3 = state[3] as number;
    const result = Math.imul(rotateLeft32(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const temporary = (s1 << 9) >>> 0;
    state[2] = (s2 ^ s0) >>> 0;
    state[3] = (s3 ^ s1) >>> 0;
    state[1] = (s1 ^ (state[2] as number)) >>> 0;
    state[0] = (s0 ^ (state[3] as number)) >>> 0;
    state[2] = ((state[2] as number) ^ temporary) >>> 0;
    state[3] = rotateLeft32(state[3] as number, 11);
    return result;
  }
}

function trialPrng(seed: string, cellId: string, trialIndex: number): Xoshiro128StarStar {
  if (!Number.isSafeInteger(trialIndex) || trialIndex < 0) throw new Error("trial index is invalid");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(trialIndex));
  return new Xoshiro128StarStar(createHash("sha256")
    .update(Buffer.from(seed, "utf8"))
    .update(Buffer.from([0]))
    .update(Buffer.from(cellId, "utf8"))
    .update(Buffer.from([0]))
    .update(counter)
    .digest());
}

function armTaskCounts(
  prng: Xoshiro128StarStar,
  ratePpm: number,
  repeatIccPpm: number,
): Uint8Array {
  const rate = rateThreshold(ratePpm);
  const shared = rateThreshold(repeatIccPpm);
  const output = new Uint8Array(TASK_COUNT);
  for (let task = 0; task < TASK_COUNT; task += 1) {
    if (prng.nextUint32() < shared) {
      output[task] = prng.nextUint32() < rate ? REPEATS_PER_TASK : 0;
    } else {
      let successes = 0;
      for (let repeat = 0; repeat < REPEATS_PER_TASK; repeat += 1) {
        if (prng.nextUint32() < rate) successes += 1;
      }
      output[task] = successes;
    }
  }
  return output;
}

interface ExactPValue {
  readonly numerator: number;
  readonly denominator: number;
}

function exactSignFlipPValue(differences: Int8Array): ExactPValue {
  let distribution = [1];
  let offset = 0;
  let nonzero = 0;
  let observed = 0;
  for (const signedDifference of differences) {
    observed += signedDifference;
    const magnitude = Math.abs(signedDifference);
    if (magnitude === 0) continue;
    const next = Array<number>(distribution.length + 2 * magnitude).fill(0);
    for (let index = 0; index < distribution.length; index += 1) {
      next[index] = (next[index] as number) + (distribution[index] as number);
      next[index + 2 * magnitude] =
        (next[index + 2 * magnitude] as number) + (distribution[index] as number);
    }
    distribution = next;
    offset += magnitude;
    nonzero += 1;
  }
  let numerator = 0;
  for (let index = 0; index < distribution.length; index += 1) {
    if (index - offset >= observed) numerator += distribution[index] as number;
  }
  return { numerator, denominator: 2 ** nonzero };
}

function rationalLessOrEqual(
  left: ExactPValue,
  right: ExactPValue,
): boolean {
  return left.numerator * right.denominator <= right.numerator * left.denominator;
}

function bothHolmRejected(native: ExactPValue, sham: ExactPValue): boolean {
  const ordered = rationalLessOrEqual(native, sham) ? [native, sham] : [sham, native];
  return (ordered[0] as ExactPValue).numerator * 40 <= (ordered[0] as ExactPValue).denominator &&
    (ordered[1] as ExactPValue).numerator * 20 <= (ordered[1] as ExactPValue).denominator;
}

const bootstrapIndexCache = new Map<string, Uint8Array>();

function bootstrapIndices(seed: string): Uint8Array {
  const cached = bootstrapIndexCache.get(seed);
  if (cached !== undefined) return cached;
  const acceptedLimit = (U64_RANGE / BigInt(TASK_COUNT)) * BigInt(TASK_COUNT);
  const output = new Uint8Array(BOOTSTRAP_DRAWS * TASK_COUNT);
  let outputIndex = 0;
  let counter = 0n;
  while (outputIndex < output.length) {
    const counterBytes = Buffer.alloc(8);
    counterBytes.writeBigUInt64BE(counter);
    counter += 1n;
    const candidate = createHash("sha256")
      .update(Buffer.from(seed, "utf8"))
      .update(Buffer.from([0]))
      .update(counterBytes)
      .digest()
      .readBigUInt64BE(0);
    if (candidate < acceptedLimit) {
      output[outputIndex] = Number(candidate % BigInt(TASK_COUNT));
      outputIndex += 1;
    }
  }
  bootstrapIndexCache.set(seed, output);
  return output;
}

function bootstrapLowerBoundStrictlyPositive(
  substrate: Uint8Array,
  native: Uint8Array,
  sham: Uint8Array,
  indices: Uint8Array,
): boolean {
  let nonpositive = 0;
  let offset = 0;
  for (let draw = 0; draw < BOOTSTRAP_DRAWS; draw += 1) {
    let substrateMinusNative = 0;
    let substrateMinusSham = 0;
    for (let selection = 0; selection < TASK_COUNT; selection += 1) {
      const task = indices[offset] as number;
      offset += 1;
      substrateMinusNative += (substrate[task] as number) - (native[task] as number);
      substrateMinusSham += (substrate[task] as number) - (sham[task] as number);
    }
    if (substrateMinusNative <= 0 || substrateMinusSham <= 0) {
      nonpositive += 1;
      if (nonpositive > BOOTSTRAP_LOWER_INDEX) return false;
    }
  }
  return true;
}

export interface SentinelPowerGuardrails {
  readonly rawComplete: boolean;
  readonly infrastructureComplete: boolean;
  readonly economicsComplete: boolean;
  readonly absoluteClean: boolean;
  readonly noopClean: boolean;
}

export function sentinelPowerGuardrailsPass(guardrails: SentinelPowerGuardrails): boolean {
  return guardrails.rawComplete && guardrails.infrastructureComplete &&
    guardrails.economicsComplete && guardrails.absoluteClean && guardrails.noopClean;
}

interface TrialDecision {
  readonly pointLift: boolean;
  readonly holm: boolean;
  readonly bootstrap: boolean;
  readonly full: boolean;
}

function evaluateTrial(input: {
  readonly substrate: Uint8Array;
  readonly native: Uint8Array;
  readonly sham: Uint8Array;
  readonly indices: Uint8Array;
  readonly guardrails: SentinelPowerGuardrails;
}): TrialDecision {
  let substrateTotal = 0;
  let nativeTotal = 0;
  let shamTotal = 0;
  const nativeDifferences = new Int8Array(TASK_COUNT);
  const shamDifferences = new Int8Array(TASK_COUNT);
  for (let task = 0; task < TASK_COUNT; task += 1) {
    const substrate = input.substrate[task] as number;
    const native = input.native[task] as number;
    const sham = input.sham[task] as number;
    substrateTotal += substrate;
    nativeTotal += native;
    shamTotal += sham;
    nativeDifferences[task] = substrate - native;
    shamDifferences[task] = substrate - sham;
  }
  const minimumDifference = Math.ceil(
    MATERIAL_LIFT_PPM * TASK_COUNT * REPEATS_PER_TASK / RATE_DENOMINATOR_PPM,
  );
  const pointLift = substrateTotal - nativeTotal >= minimumDifference &&
    substrateTotal - shamTotal >= minimumDifference;
  const holm = bothHolmRejected(
    exactSignFlipPValue(nativeDifferences),
    exactSignFlipPValue(shamDifferences),
  );
  const bootstrap = bootstrapLowerBoundStrictlyPositive(
    input.substrate, input.native, input.sham, input.indices,
  );
  return {
    pointLift,
    holm,
    bootstrap,
    full: pointLift && holm && bootstrap && sentinelPowerGuardrailsPass(input.guardrails),
  };
}

function logChoose(n: number, k: number): number {
  const smaller = Math.min(k, n - k);
  let output = 0;
  for (let index = 1; index <= smaller; index += 1) {
    output += Math.log(n - smaller + index) - Math.log(index);
  }
  return output;
}

function binomialUpperTail(n: number, k: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n || p === 0) return 0;
  if (p === 1) return 1;
  let term = Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
  let sum = term;
  for (let successes = k; successes < n; successes += 1) {
    term *= ((n - successes) / (successes + 1)) * (p / (1 - p));
    sum += term;
  }
  return Math.min(1, sum);
}

/** One-sided exact-binomial lower limit, rounded downward after bisection. */
export function clopperPearsonLowerBound(
  successes: number,
  trials: number,
  tailAlpha: number,
): number {
  if (!Number.isSafeInteger(trials) || trials < 1 ||
    !Number.isSafeInteger(successes) || successes < 0 || successes > trials ||
    !Number.isFinite(tailAlpha) || tailAlpha <= 0 || tailAlpha >= 1) {
    throw new Error("Clopper-Pearson inputs are invalid");
  }
  if (successes === 0) return 0;
  let low = 0;
  let high = successes / trials;
  for (let iteration = 0; iteration < 120; iteration += 1) {
    const middle = (low + high) / 2;
    if (binomialUpperTail(trials, successes, middle) >= tailAlpha) high = middle;
    else low = middle;
  }
  return Number(Math.max(0, low - 1e-12).toPrecision(15));
}

function sortedUniquePpm(values: readonly number[], name: string): readonly number[] {
  if (values.length === 0) throw new Error(`${name} cannot be empty`);
  for (const value of values) validatePpm(value, name);
  const output = [...new Set(values)].sort((left, right) => left - right);
  if (output.length !== values.length) throw new Error(`${name} cannot contain duplicates`);
  return output;
}

function cellId(baselineRatePpm: number, repeatIccPpm: number): string {
  return `baseline-${baselineRatePpm.toString().padStart(7, "0")}-rho-${repeatIccPpm.toString().padStart(7, "0")}`;
}

const CLEAN_GUARDRAILS: SentinelPowerGuardrails = Object.freeze({
  rawComplete: true,
  infrastructureComplete: true,
  economicsComplete: true,
  absoluteClean: true,
  noopClean: true,
});

function simulateCell(input: {
  readonly baselineRatePpm: number;
  readonly repeatIccPpm: number;
  readonly trials: number;
  readonly simulationSeed: string;
  readonly bootstrapSeed: string;
  readonly perCellTailAlpha: number;
}): SentinelPowerSimulationCell {
  const substrateRatePpm = input.baselineRatePpm + PLANNING_ALTERNATIVE_LIFT_PPM;
  validatePpm(substrateRatePpm, "substrate planning rate");
  const id = cellId(input.baselineRatePpm, input.repeatIccPpm);
  const indices = bootstrapIndices(input.bootstrapSeed);
  let pointPasses = 0;
  let holmPasses = 0;
  let bootstrapPasses = 0;
  let fullPasses = 0;
  for (let trial = 0; trial < input.trials; trial += 1) {
    const prng = trialPrng(input.simulationSeed, id, trial);
    const native = armTaskCounts(prng, input.baselineRatePpm, input.repeatIccPpm);
    const sham = armTaskCounts(prng, input.baselineRatePpm, input.repeatIccPpm);
    const substrate = armTaskCounts(prng, substrateRatePpm, input.repeatIccPpm);
    const decision = evaluateTrial({ substrate, native, sham, indices, guardrails: CLEAN_GUARDRAILS });
    if (decision.pointLift) pointPasses += 1;
    if (decision.holm) holmPasses += 1;
    if (decision.bootstrap) bootstrapPasses += 1;
    if (decision.full) fullPasses += 1;
  }
  const lower = clopperPearsonLowerBound(fullPasses, input.trials, input.perCellTailAlpha);
  return {
    cellId: id,
    baselineRatePpm: input.baselineRatePpm,
    substrateRatePpm,
    repeatIntraclassCorrelationPpm: input.repeatIccPpm,
    trials: input.trials,
    pointLiftGatePasses: pointPasses,
    bothHolmRejectionsPasses: holmPasses,
    bootstrapPositiveLowerBoundPasses: bootstrapPasses,
    fullDeclaredRulePasses: fullPasses,
    estimatedPower: probability(fullPasses / input.trials),
    simultaneousClopperPearsonLowerBound: lower,
    targetMetByConservativeLowerBound: lower >= TARGET_POWER,
  };
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Deterministically replays the complete claim rule without reading benchmark
 * outcomes. The default configuration is the only authoritative artifact;
 * smaller caller configurations exist solely for verification and tests.
 */
export function createSentinelProductionPowerRedesignAudit(
  input: SentinelPowerRedesignInput = {},
): SentinelProductionPowerRedesignAudit {
  const trials = input.trialsPerCell ?? AUTHORITATIVE_TRIALS_PER_CELL;
  if (!Number.isSafeInteger(trials) || trials < 32 || trials > 100_000) {
    throw new Error("trialsPerCell must be an integer from 32 through 100000");
  }
  const baselines = sortedUniquePpm(
    input.baselineGridPpm ?? AUTHORITATIVE_BASELINE_GRID_PPM,
    "baselineGridPpm",
  );
  if ((baselines.at(-1) as number) + PLANNING_ALTERNATIVE_LIFT_PPM > RATE_DENOMINATOR_PPM) {
    throw new Error("baseline grid is incompatible with the planning alternative");
  }
  const correlations = sortedUniquePpm(
    input.repeatIntraclassCorrelationSuitePpm ?? AUTHORITATIVE_REPEAT_ICC_SUITE_PPM,
    "repeatIntraclassCorrelationSuitePpm",
  );
  if (!correlations.includes(0) || !correlations.includes(1_000_000)) {
    throw new Error("repeat-dependence suite must include zero and perfect dependence");
  }
  const simulationSeed = input.simulationSeed ?? SIMULATION_SEED;
  const bootstrapSeed = input.bootstrapSeed ?? BOOTSTRAP_SEED;
  if (simulationSeed.length < 16 || bootstrapSeed.length < 16) {
    throw new Error("power seeds must contain at least sixteen characters");
  }
  const cellCount = baselines.length * correlations.length;
  const perCellTailAlpha = (1 - FAMILYWISE_CONFIDENCE) / cellCount;
  const results = correlations.flatMap((repeatIccPpm) => baselines.map((baselineRatePpm) =>
    simulateCell({
      baselineRatePpm,
      repeatIccPpm,
      trials,
      simulationSeed,
      bootstrapSeed,
      perCellTailAlpha,
    })));
  const minimum = (selected: readonly SentinelPowerSimulationCell[]): number =>
    Math.min(...selected.map(({ simultaneousClopperPearsonLowerBound }) =>
      simultaneousClopperPearsonLowerBound));
  const independent = results.filter(({ repeatIntraclassCorrelationPpm }) =>
    repeatIntraclassCorrelationPpm === 0);
  const listedZeroAndPointOne = results.filter(({ repeatIntraclassCorrelationPpm }) =>
    repeatIntraclassCorrelationPpm === 0 || repeatIntraclassCorrelationPpm === 100_000);
  const minIndependent = minimum(independent);
  const minListedZeroAndPointOne = minimum(listedZeroAndPointOne);
  const minAll = minimum(results);
  const independentMet = minIndependent >= TARGET_POWER;
  const listedZeroAndPointOneMet = minListedZeroAndPointOne >= TARGET_POWER;
  const allMet = minAll >= TARGET_POWER;
  const authoritativeConfiguration =
    trials === AUTHORITATIVE_TRIALS_PER_CELL &&
    sameNumbers(baselines, AUTHORITATIVE_BASELINE_GRID_PPM) &&
    sameNumbers(correlations, AUTHORITATIVE_REPEAT_ICC_SUITE_PPM) &&
    simulationSeed === SIMULATION_SEED &&
    bootstrapSeed === BOOTSTRAP_SEED;
  const procedureSha256 = sentinelPowerJsonSha256(SENTINEL_POWER_CALCULATION_PROCEDURE);
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-power-redesign.v2" as const,
    generatedWithoutBenchmarkOutcomes: true as const,
    authoritativeConfiguration,
    status: independentMet
      ? "conditional-power-only-redesign-not-yet-eligible" as const
      : "planning-alternative-not-powered" as const,
    currentTenPointDesignFalsification: auditCurrentSentinelProductionPower(),
    estimandBoundary: {
      minimumObservedMaterialLiftOverEachControl: 0.1 as const,
      planningAlternativeTrueLift: 0.35 as const,
      planningAlternativeIsNotClaimThreshold: true as const,
      targetPower: 0.8 as const,
      familywiseAlpha: 0.05 as const,
    },
    design: {
      independentTaskCount: 19 as const,
      repeatsPerTask: 3 as const,
      observationsPerArm: 57 as const,
      nativeAndShamMarginalRatesEqual: true as const,
      armsIndependentConditionalOnTaskRate: true as const,
      tasksIndependent: true as const,
      baselineGridPpm: baselines,
      repeatIntraclassCorrelationSuitePpm: correlations,
    },
    stochasticModel: {
      id: "exchangeable-repeat-mixture-equal-controls-v1" as const,
      taskArmGeneration: "with-probability-rho-one-bernoulli-is-shared-by-all-repeats-otherwise-repeats-are-independent" as const,
      marginalRatePreserved: true as const,
      withinTaskArmRepeatIccEqualsRho: true as const,
      taskRatesHomogeneousWithinEachBaselineCell: true as const,
      limitation: "power-is-conditional-on-the-listed-data-generating-assumptions-not-a-property-of-the-benchmark-alone" as const,
    },
    fullDeclaredRule: {
      bothPointLiftsAtLeast: 0.1 as const,
      pairedTaskSignFlipTests: "both-one-sided-exact-with-Holm-FWER-0.05" as const,
      bootstrap: "exact-signed-10000-draw-task-bootstrap-index-499-strictly-positive" as const,
      guardrails: "raw-complete-infrastructure-complete-economics-complete-absolute-clean-noop-clean-all-required" as const,
    },
    guardrailAssumptionAndStress: {
      planningAssumption: "all-guardrails-pass-with-probability-one" as const,
      interpretation: "optimistic-upper-condition-any-guardrail-failure-forces-the-full-rule-to-false" as const,
      forcedFailureChecks: [
        "raw-incomplete-fails",
        "infrastructure-incomplete-fails",
        "economics-incomplete-fails",
        "absolute-dirty-fails",
        "noop-dirty-fails",
      ] as const,
    },
    simulation: {
      trialsPerCell: trials,
      seed: simulationSeed,
      prng: "sha256-trial-seed-xoshiro128starstar-u32-threshold-v1" as const,
      probabilityEncoding: "integer-parts-per-million-to-floor-p-times-2^32" as const,
      bootstrapSeed,
      bootstrapDraws: 10_000 as const,
      bootstrapLowerIndex: 499 as const,
      exactIntegerSignFlipEnumeration: true as const,
      monteCarloUncertainty: "one-sided-Clopper-Pearson-with-Bonferroni-family-confidence" as const,
      simultaneousFamilyConfidence: 0.99 as const,
      cellsInConfidenceFamily: cellCount,
      perCellTailAlpha,
    },
    results,
    conclusions: {
      minimumIndependentRepeatLowerBound: minIndependent,
      independentRepeatTargetMetAcrossBaselineGrid: independentMet,
      minimumListedZeroAndPointOneIccLowerBound: minListedZeroAndPointOne,
      listedZeroAndPointOneIccTargetMetAcrossBaselineGrid: listedZeroAndPointOneMet,
      minimumAllSensitivityLowerBound: minAll,
      targetMetAcrossAllDependenceSensitivityCells: allMet,
      planningAlternativeCanPowerConditional19x3Design: independentMet,
      repeatDependenceBoundEstablishedByEvidence: false as const,
      poweredExecutionEligibleFromThisArtifactAlone: false as const,
      smallestHonestRedesign: "separate-0.10-materiality-from-0.35-planning-alternative-and-retain-19x3-only-after-independent-evidence-bounds-repeat-dependence-and-the-calculation-covers-the-accepted-range-otherwise-add-independent-relative-tasks-and-repower" as const,
    },
    procedure: SENTINEL_POWER_CALCULATION_PROCEDURE,
    procedureSha256,
  };
  return { ...body, auditSha256: sentinelPowerJsonSha256(body) };
}

/** Structural verification; independent Python replay verifies every simulation count. */
export function verifySentinelProductionPowerRedesignAudit(
  artifact: SentinelProductionPowerRedesignAudit,
): readonly string[] {
  const issues: string[] = [];
  const { auditSha256, ...body } = artifact;
  if (sentinelPowerJsonSha256(body) !== auditSha256) issues.push("audit hash does not match canonical bytes");
  if (artifact.procedureSha256 !== sentinelPowerJsonSha256(artifact.procedure)) {
    issues.push("calculation procedure hash does not match procedure bytes");
  }
  if (canonical(artifact.procedure) !== canonical(SENTINEL_POWER_CALCULATION_PROCEDURE)) {
    issues.push("calculation procedure is not the implemented frozen procedure");
  }
  const expectedCells = artifact.design.baselineGridPpm.length *
    artifact.design.repeatIntraclassCorrelationSuitePpm.length;
  if (artifact.results.length !== expectedCells ||
    artifact.simulation.cellsInConfidenceFamily !== expectedCells) {
    issues.push("simulation cells do not cover the declared Cartesian assumption grid");
  }
  const ids = new Set<string>();
  const expectedIds = new Set(artifact.design.repeatIntraclassCorrelationSuitePpm.flatMap((rho) =>
    artifact.design.baselineGridPpm.map((baseline) => cellId(baseline, rho))));
  for (const result of artifact.results) {
    if (ids.has(result.cellId)) issues.push(`duplicate simulation cell ${result.cellId}`);
    ids.add(result.cellId);
    if (!expectedIds.has(result.cellId) ||
      result.cellId !== cellId(result.baselineRatePpm, result.repeatIntraclassCorrelationPpm)) {
      issues.push(`simulation cell is outside the declared grid: ${result.cellId}`);
    }
    if (result.substrateRatePpm !== result.baselineRatePpm + PLANNING_ALTERNATIVE_LIFT_PPM ||
      result.trials !== artifact.simulation.trialsPerCell) {
      issues.push(`simulation cell rates or trial count are false in ${result.cellId}`);
    }
    const gateCounts = [
      result.pointLiftGatePasses,
      result.bothHolmRejectionsPasses,
      result.bootstrapPositiveLowerBoundPasses,
      result.fullDeclaredRulePasses,
    ];
    if (gateCounts.some((count) =>
      !Number.isSafeInteger(count) || count < 0 || count > result.trials)) {
      issues.push(`simulation gate count is invalid in ${result.cellId}`);
    }
    if (result.fullDeclaredRulePasses > result.pointLiftGatePasses ||
      result.fullDeclaredRulePasses > result.bothHolmRejectionsPasses ||
      result.fullDeclaredRulePasses > result.bootstrapPositiveLowerBoundPasses) {
      issues.push(`full rule count exceeds a necessary gate in ${result.cellId}`);
    }
    const expectedEstimate = probability(result.fullDeclaredRulePasses / result.trials);
    if (result.estimatedPower !== expectedEstimate) issues.push(`power estimate is false in ${result.cellId}`);
    const expectedLower = clopperPearsonLowerBound(
      result.fullDeclaredRulePasses,
      result.trials,
      artifact.simulation.perCellTailAlpha,
    );
    if (result.simultaneousClopperPearsonLowerBound !== expectedLower) {
      issues.push(`confidence bound is false in ${result.cellId}`);
    }
    if (result.targetMetByConservativeLowerBound !== (expectedLower >= TARGET_POWER)) {
      issues.push(`power-target decision is false in ${result.cellId}`);
    }
  }
  if ([...expectedIds].some((id) => !ids.has(id))) issues.push("a declared simulation cell is missing");
  const expectedCurrentAudit = auditCurrentSentinelProductionPower();
  if (canonical(artifact.currentTenPointDesignFalsification) !== canonical(expectedCurrentAudit)) {
    issues.push("current-design falsification was changed");
  }
  const expectedTailAlpha = (1 - FAMILYWISE_CONFIDENCE) / expectedCells;
  if (artifact.simulation.perCellTailAlpha !== expectedTailAlpha ||
    artifact.simulation.simultaneousFamilyConfidence !== FAMILYWISE_CONFIDENCE ||
    artifact.simulation.bootstrapDraws !== BOOTSTRAP_DRAWS ||
    artifact.simulation.bootstrapLowerIndex !== BOOTSTRAP_LOWER_INDEX) {
    issues.push("simulation confidence family or exact bootstrap constants are false");
  }
  const minimum = (cells: readonly SentinelPowerSimulationCell[]): number =>
    cells.length === 0 ? Number.NaN : Math.min(...cells.map(
      ({ simultaneousClopperPearsonLowerBound }) => simultaneousClopperPearsonLowerBound,
    ));
  const independent = artifact.results.filter(({ repeatIntraclassCorrelationPpm }) =>
    repeatIntraclassCorrelationPpm === 0);
  const listedZeroAndPointOne = artifact.results.filter(({ repeatIntraclassCorrelationPpm }) =>
    repeatIntraclassCorrelationPpm === 0 || repeatIntraclassCorrelationPpm === 100_000);
  const minimumIndependent = minimum(independent);
  const minimumListedZeroAndPointOne = minimum(listedZeroAndPointOne);
  const minimumAll = minimum(artifact.results);
  const independentMet = minimumIndependent >= TARGET_POWER;
  const listedZeroAndPointOneMet = minimumListedZeroAndPointOne >= TARGET_POWER;
  const allMet = minimumAll >= TARGET_POWER;
  if (
    artifact.conclusions.minimumIndependentRepeatLowerBound !== minimumIndependent ||
    artifact.conclusions.independentRepeatTargetMetAcrossBaselineGrid !== independentMet ||
    artifact.conclusions.minimumListedZeroAndPointOneIccLowerBound !== minimumListedZeroAndPointOne ||
    artifact.conclusions.listedZeroAndPointOneIccTargetMetAcrossBaselineGrid !== listedZeroAndPointOneMet ||
    artifact.conclusions.minimumAllSensitivityLowerBound !== minimumAll ||
    artifact.conclusions.targetMetAcrossAllDependenceSensitivityCells !== allMet ||
    artifact.conclusions.planningAlternativeCanPowerConditional19x3Design !== independentMet ||
    artifact.status !== (independentMet
      ? "conditional-power-only-redesign-not-yet-eligible"
      : "planning-alternative-not-powered")
  ) issues.push("derived power conclusions do not match cell-level conservative bounds");
  const expectedAuthoritative =
    artifact.simulation.trialsPerCell === AUTHORITATIVE_TRIALS_PER_CELL &&
    sameNumbers(artifact.design.baselineGridPpm, AUTHORITATIVE_BASELINE_GRID_PPM) &&
    sameNumbers(artifact.design.repeatIntraclassCorrelationSuitePpm, AUTHORITATIVE_REPEAT_ICC_SUITE_PPM) &&
    artifact.simulation.seed === SIMULATION_SEED &&
    artifact.simulation.bootstrapSeed === BOOTSTRAP_SEED;
  if (artifact.authoritativeConfiguration !== expectedAuthoritative) {
    issues.push("authoritative-configuration claim is false");
  }
  if (
    artifact.estimandBoundary.minimumObservedMaterialLiftOverEachControl !== 0.1 ||
    artifact.estimandBoundary.planningAlternativeTrueLift !== 0.35 ||
    artifact.estimandBoundary.targetPower !== TARGET_POWER ||
    artifact.design.independentTaskCount !== TASK_COUNT ||
    artifact.design.repeatsPerTask !== REPEATS_PER_TASK ||
    artifact.design.observationsPerArm !== TASK_COUNT * REPEATS_PER_TASK
  ) issues.push("estimand or design constants were changed");
  if (artifact.conclusions.poweredExecutionEligibleFromThisArtifactAlone !== false ||
    artifact.conclusions.repeatDependenceBoundEstablishedByEvidence !== false ||
    artifact.conclusions.smallestHonestRedesign !==
      "separate-0.10-materiality-from-0.35-planning-alternative-and-retain-19x3-only-after-independent-evidence-bounds-repeat-dependence-and-the-calculation-covers-the-accepted-range-otherwise-add-independent-relative-tasks-and-repower") {
    issues.push("planning simulation cannot self-authorize powered execution");
  }
  return issues;
}

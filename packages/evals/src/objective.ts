export const OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION =
  "pm.objective.lab-measured.v2" as const;

export const BUSINESS_OPERABILITY_DIMENSIONS = [
  "technical_baseline",
  "adoption",
  "operational_outcomes",
  "governance_quality",
  "economic_value",
  "external_validity",
] as const;

export type BusinessOperabilityDimension =
  (typeof BUSINESS_OPERABILITY_DIMENSIONS)[number];

export type ObjectiveVerdictCeiling =
  | "kill_or_repair"
  | "keep_with_scope_cut"
  | "keep";

export type ObjectiveFinalVerdict = "kill" | "keep-with-scope-cut" | "keep";

export interface BusinessOperabilityThresholds {
  readonly minPairedRunsPerLab: number;
  readonly minCorrectOutcomeRate: number;
  readonly minMappingCoverage: number;
  readonly maxTimeToFirstValueMs: number;
  readonly minGovernedWriteCoverage: number;
  readonly maxFalsePositiveRate: number;
  readonly maxFalseNegativeRate: number;
  readonly maxCostPerCorrectOutcomeRatio: number;
  readonly maxOperatorMinutesPerCorrectOutcomeRatio: number;
  readonly minHoldoutRunsPerLab: number;
  readonly minProductionLikeRunsPerLab: number;
}

/**
 * Initial owner-as-customer falsification thresholds. They are deliberately
 * small enough for a D6 pilot, but strict enough that one happy-path demo
 * cannot become a business-viability claim.
 */
export const DEFAULT_BUSINESS_OPERABILITY_THRESHOLDS = {
  minPairedRunsPerLab: 5,
  minCorrectOutcomeRate: 0.8,
  minMappingCoverage: 0.9,
  maxTimeToFirstValueMs: 8 * 60 * 60 * 1000,
  minGovernedWriteCoverage: 1,
  maxFalsePositiveRate: 0,
  maxFalseNegativeRate: 0,
  maxCostPerCorrectOutcomeRatio: 1.25,
  maxOperatorMinutesPerCorrectOutcomeRatio: 1,
  minHoldoutRunsPerLab: 1,
  minProductionLikeRunsPerLab: 1,
} as const satisfies BusinessOperabilityThresholds;

export interface ObjectiveLabMeasurement {
  readonly schemaVersion: typeof OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION;
  readonly labId: string;
  readonly observedAt: string;
  readonly sourceRefs: readonly string[];
  readonly runProvenance: ObjectiveRunProvenance;
  readonly adoption: {
    readonly substratePackageEdits: number | null;
    readonly appRewriteRequired: boolean | null;
    readonly timeToFirstValueMs: number | null;
    readonly mappingCoverage: number | null;
  };
  readonly operations: {
    readonly pairedRuns: number | null;
    readonly baselineAttempts: number | null;
    readonly baselineCorrectOutcomes: number | null;
    readonly substrateAttempts: number | null;
    readonly substrateCorrectOutcomes: number | null;
    readonly holdoutRuns: number | null;
  };
  readonly governance: {
    readonly totalWritePaths: number | null;
    readonly governedWritePaths: number | null;
    readonly expectedAllows: number | null;
    readonly falsePositiveBlocks: number | null;
    readonly expectedBlocks: number | null;
    readonly falseNegativeAllows: number | null;
  };
  readonly economics: {
    readonly baselineCostUsd: number | null;
    readonly substrateCostUsd: number | null;
    readonly baselineOperatorMinutes: number | null;
    readonly substrateOperatorMinutes: number | null;
  };
  readonly externalValidity: {
    readonly productionLikeRuns: number | null;
    readonly ownerAccepted: boolean | null;
  };
}

export interface ObjectiveRunProvenance {
  readonly runManifestRef: string;
  readonly boundaryConformanceRef: string;
  readonly appRevision: string;
  readonly substrateRevision: string;
}

export interface ObjectiveLabEvidence {
  readonly labId: string;
  /** Derived from an exact-provenance admitted pm.sync.* event. */
  readonly readAttached: boolean;
  /** Derived from an exact-provenance pm.executor.dispatched event. */
  readonly governedActionDispatched: boolean;
  readonly measurement: ObjectiveLabMeasurement | null;
}

export interface ObjectiveIntegrationEvidenceEvent {
  readonly type: "pm.sync.upserted" | "pm.executor.dispatched";
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ObjectiveDerivedIntegrationEvidence {
  readonly readAttached: boolean;
  readonly governedActionDispatched: boolean;
}

export interface ObjectiveTechnicalEvidence {
  readonly chainValid: boolean;
  readonly liveMcpActions: number;
  readonly genericSyncUpserts: number;
  readonly executorDispatches: number;
  readonly livePairedScenarios: number;
}

export interface BusinessOperabilityObjectiveInput {
  readonly requiredLabIds: readonly string[];
  readonly thresholds: BusinessOperabilityThresholds;
  readonly technical: ObjectiveTechnicalEvidence;
  readonly labs: readonly ObjectiveLabEvidence[];
  readonly invalidMeasurementEvents?: number;
}

export interface BusinessOperabilityDimensionAssessment {
  readonly dimension: BusinessOperabilityDimension;
  readonly met: boolean;
  readonly gaps: readonly string[];
}

export interface BusinessOperabilityObjectiveAssessment {
  readonly objectiveReady: boolean;
  readonly technicalBaselineReady: boolean;
  readonly verdictCeiling: ObjectiveVerdictCeiling;
  readonly dimensions: readonly BusinessOperabilityDimensionAssessment[];
  readonly gaps: readonly string[];
  readonly warnings: readonly string[];
}

export class ObjectiveLabMeasurementValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`invalid objective lab measurement: ${issues.join("; ")}`);
    this.name = "ObjectiveLabMeasurementValidationError";
    this.issues = issues;
  }
}

export interface ObjectiveLabMeasurementFold {
  readonly latest: readonly ObjectiveLabMeasurement[];
  readonly invalid: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isConcreteString = (value: unknown): value is string =>
  isNonEmptyString(value) &&
  value === value.trim() &&
  !value.startsWith("replace-with:");

const isIsoTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value) && Number.isFinite(Date.parse(value));

const isNullableBoolean = (value: unknown): value is boolean | null =>
  value === null || typeof value === "boolean";

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));

const isNullableCount = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0);

const isNullableRate = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1);

function requireRecord(
  value: unknown,
  path: string,
  issues: string[],
): Record<string, unknown> {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return {};
  }
  return value;
}

function requireNullable(
  object: Record<string, unknown>,
  key: string,
  path: string,
  predicate: (value: unknown) => boolean,
  issues: string[],
): void {
  if (!predicate(object[key])) {
    issues.push(`${path}.${key} has an invalid value`);
  }
}

/** Validate evidence before it is admitted to the event log. */
export function parseObjectiveLabMeasurement(
  value: unknown,
): ObjectiveLabMeasurement {
  const issues: string[] = [];
  const root = requireRecord(value, "$", issues);
  if (root["schemaVersion"] !== OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION) {
    issues.push(
      `$.schemaVersion must equal ${OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION}`,
    );
  }
  if (!isNonEmptyString(root["labId"])) {
    issues.push("$.labId must be a non-empty string");
  }
  if (!isIsoTimestamp(root["observedAt"])) {
    issues.push("$.observedAt must be an ISO timestamp");
  }
  if (
    !Array.isArray(root["sourceRefs"]) ||
    root["sourceRefs"].length === 0 ||
    !root["sourceRefs"].every(
      (ref) =>
        isConcreteString(ref),
    )
  ) {
    issues.push(
      "$.sourceRefs must contain at least one concrete, non-placeholder evidence ref",
    );
  }

  const runProvenance = requireRecord(
    root["runProvenance"],
    "$.runProvenance",
    issues,
  );
  for (const key of [
    "runManifestRef",
    "boundaryConformanceRef",
    "appRevision",
    "substrateRevision",
  ]) {
    if (!isConcreteString(runProvenance[key])) {
      issues.push(
        `$.runProvenance.${key} must be a concrete, non-placeholder string`,
      );
    }
  }

  const adoption = requireRecord(root["adoption"], "$.adoption", issues);
  requireNullable(
    adoption,
    "substratePackageEdits",
    "$.adoption",
    isNullableCount,
    issues,
  );
  requireNullable(
    adoption,
    "appRewriteRequired",
    "$.adoption",
    isNullableBoolean,
    issues,
  );
  requireNullable(
    adoption,
    "timeToFirstValueMs",
    "$.adoption",
    isNullableCount,
    issues,
  );
  requireNullable(
    adoption,
    "mappingCoverage",
    "$.adoption",
    isNullableRate,
    issues,
  );

  const operations = requireRecord(root["operations"], "$.operations", issues);
  for (const key of [
    "pairedRuns",
    "baselineAttempts",
    "baselineCorrectOutcomes",
    "substrateAttempts",
    "substrateCorrectOutcomes",
    "holdoutRuns",
  ]) {
    requireNullable(operations, key, "$.operations", isNullableCount, issues);
  }
  const baselineAttempts = operations["baselineAttempts"];
  const baselineCorrectOutcomes = operations["baselineCorrectOutcomes"];
  if (
    typeof baselineAttempts === "number" &&
    typeof baselineCorrectOutcomes === "number" &&
    baselineCorrectOutcomes > baselineAttempts
  ) {
    issues.push(
      "$.operations.baselineCorrectOutcomes cannot exceed baselineAttempts",
    );
  }
  const substrateAttempts = operations["substrateAttempts"];
  const substrateCorrectOutcomes = operations["substrateCorrectOutcomes"];
  if (
    typeof substrateAttempts === "number" &&
    typeof substrateCorrectOutcomes === "number" &&
    substrateCorrectOutcomes > substrateAttempts
  ) {
    issues.push(
      "$.operations.substrateCorrectOutcomes cannot exceed substrateAttempts",
    );
  }

  const governance = requireRecord(root["governance"], "$.governance", issues);
  for (const key of [
    "totalWritePaths",
    "governedWritePaths",
    "expectedAllows",
    "falsePositiveBlocks",
    "expectedBlocks",
    "falseNegativeAllows",
  ]) {
    requireNullable(governance, key, "$.governance", isNullableCount, issues);
  }
  const totalWritePaths = governance["totalWritePaths"];
  const governedWritePaths = governance["governedWritePaths"];
  if (
    typeof totalWritePaths === "number" &&
    typeof governedWritePaths === "number" &&
    governedWritePaths > totalWritePaths
  ) {
    issues.push(
      "$.governance.governedWritePaths cannot exceed totalWritePaths",
    );
  }
  const expectedAllows = governance["expectedAllows"];
  const falsePositiveBlocks = governance["falsePositiveBlocks"];
  if (
    typeof expectedAllows === "number" &&
    typeof falsePositiveBlocks === "number" &&
    falsePositiveBlocks > expectedAllows
  ) {
    issues.push(
      "$.governance.falsePositiveBlocks cannot exceed expectedAllows",
    );
  }
  const expectedBlocks = governance["expectedBlocks"];
  const falseNegativeAllows = governance["falseNegativeAllows"];
  if (
    typeof expectedBlocks === "number" &&
    typeof falseNegativeAllows === "number" &&
    falseNegativeAllows > expectedBlocks
  ) {
    issues.push(
      "$.governance.falseNegativeAllows cannot exceed expectedBlocks",
    );
  }

  const economics = requireRecord(root["economics"], "$.economics", issues);
  for (const key of [
    "baselineCostUsd",
    "substrateCostUsd",
    "baselineOperatorMinutes",
    "substrateOperatorMinutes",
  ]) {
    requireNullable(economics, key, "$.economics", isNullableNumber, issues);
    const number = economics[key];
    if (typeof number === "number" && number < 0) {
      issues.push(`$.economics.${key} must be non-negative`);
    }
  }

  const externalValidity = requireRecord(
    root["externalValidity"],
    "$.externalValidity",
    issues,
  );
  requireNullable(
    externalValidity,
    "productionLikeRuns",
    "$.externalValidity",
    isNullableCount,
    issues,
  );
  requireNullable(
    externalValidity,
    "ownerAccepted",
    "$.externalValidity",
    isNullableBoolean,
    issues,
  );

  if (issues.length > 0) {
    throw new ObjectiveLabMeasurementValidationError(issues);
  }
  return value as ObjectiveLabMeasurement;
}

/**
 * Historical integration events are not evidence for a later app revision.
 * The D6 fold accepts a sync/dispatch only when every run coordinate matches.
 */
export function objectiveEventContextMatchesMeasurement(
  value: unknown,
  measurement: ObjectiveLabMeasurement,
): boolean {
  if (!isRecord(value)) return false;
  const expected = measurement.runProvenance;
  return (
    isConcreteString(value["runManifestRef"]) &&
    value["runManifestRef"] === expected.runManifestRef &&
    isConcreteString(value["boundaryConformanceRef"]) &&
    value["boundaryConformanceRef"] === expected.boundaryConformanceRef &&
    isConcreteString(value["appRevision"]) &&
    value["appRevision"] === expected.appRevision &&
    isConcreteString(value["substrateRevision"]) &&
    value["substrateRevision"] === expected.substrateRevision
  );
}

/**
 * Derive the two integration facts from admitted receipts. Name fragments are
 * supplied by the app profile; the evaluator remains app-agnostic. An event
 * only counts when both its app/target name and all four provenance
 * coordinates match the measurement under evaluation.
 */
export function deriveObjectiveIntegrationEvidence(
  measurement: ObjectiveLabMeasurement | null,
  appNameFragments: readonly string[],
  events: readonly ObjectiveIntegrationEvidenceEvent[],
): ObjectiveDerivedIntegrationEvidence {
  if (measurement === null) {
    return { readAttached: false, governedActionDispatched: false };
  }

  const normalizedFragments = appNameFragments
    .map((fragment) => fragment.trim().toLowerCase())
    .filter((fragment) => fragment.length > 0);
  const matchesName = (value: unknown): boolean =>
    typeof value === "string" &&
    normalizedFragments.some((fragment) =>
      value.toLowerCase().includes(fragment),
    );
  const matchesRun = (event: ObjectiveIntegrationEvidenceEvent): boolean =>
    objectiveEventContextMatchesMeasurement(
      event.payload["evidenceContext"],
      measurement,
    );

  return {
    readAttached: events.some(
      (event) =>
        event.type === "pm.sync.upserted" &&
        matchesName(event.payload["appName"]) &&
        matchesRun(event),
    ),
    governedActionDispatched: events.some(
      (event) =>
        event.type === "pm.executor.dispatched" &&
        matchesName(event.payload["target"]) &&
        matchesRun(event),
    ),
  };
}

/** Latest valid measurement per lab; invalid evidence is counted, never trusted. */
export function foldObjectiveLabMeasurements(
  payloads: readonly unknown[],
): ObjectiveLabMeasurementFold {
  const latest = new Map<string, ObjectiveLabMeasurement>();
  let invalid = 0;
  for (const payload of payloads) {
    try {
      const parsed = parseObjectiveLabMeasurement(payload);
      const prior = latest.get(parsed.labId);
      if (
        !prior ||
        Date.parse(parsed.observedAt) > Date.parse(prior.observedAt)
      ) {
        latest.set(parsed.labId, parsed);
      }
    } catch (error) {
      if (error instanceof ObjectiveLabMeasurementValidationError) {
        invalid += 1;
        continue;
      }
      throw error;
    }
  }
  return {
    latest: [...latest.values()].sort((a, b) =>
      a.labId.localeCompare(b.labId),
    ),
    invalid,
  };
}

const rate = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null;

const perCorrectOutcome = (
  total: number | null,
  correct: number | null,
): number | null =>
  total !== null && correct !== null && correct > 0 ? total / correct : null;

const ratio = (subject: number | null, baseline: number | null): number | null =>
  subject !== null && baseline !== null && baseline > 0
    ? subject / baseline
    : null;

const assessment = (
  dimension: BusinessOperabilityDimension,
  gaps: readonly string[],
): BusinessOperabilityDimensionAssessment => ({
  dimension,
  met: gaps.length === 0,
  gaps,
});

/**
 * A full `keep` means the stated business objective is evidenced. Green
 * infrastructure with missing lab outcomes is capped at keep-with-scope-cut.
 */
export function evaluateBusinessOperabilityObjective(
  input: BusinessOperabilityObjectiveInput,
): BusinessOperabilityObjectiveAssessment {
  const labs = new Map(input.labs.map((lab) => [lab.labId, lab]));
  const technicalGaps: string[] = [];
  if (!input.technical.chainValid) {
    technicalGaps.push("continuity hash chain is invalid");
  }
  if (input.technical.liveMcpActions <= 0) {
    technicalGaps.push("no live MCP action has been admitted or blocked");
  }
  if (input.technical.genericSyncUpserts <= 0) {
    technicalGaps.push("no generic integration sync has reached the admitted log");
  }
  if (input.technical.executorDispatches <= 0) {
    technicalGaps.push("no executor action has been dispatched");
  }
  if (input.technical.livePairedScenarios <= 0) {
    technicalGaps.push("no live paired agent scenario has been recorded");
  }
  const warnings =
    (input.invalidMeasurementEvents ?? 0) > 0
      ? [
          `${input.invalidMeasurementEvents} invalid objective measurement event(s) were ignored`,
        ]
      : [];

  const adoptionGaps: string[] = [];
  const operationalGaps: string[] = [];
  const governanceGaps: string[] = [];
  const economicGaps: string[] = [];
  const externalValidityGaps: string[] = [];

  for (const labId of input.requiredLabIds) {
    const lab = labs.get(labId);
    if (!lab) {
      const gap = `${labId}: no objective evidence record exists`;
      adoptionGaps.push(gap);
      operationalGaps.push(gap);
      governanceGaps.push(gap);
      economicGaps.push(gap);
      externalValidityGaps.push(gap);
      continue;
    }
    if (!lab.readAttached) {
      adoptionGaps.push(`${labId}: no revision-bound admitted read attachment`);
    }
    if (!lab.governedActionDispatched) {
      governanceGaps.push(
        `${labId}: no revision-bound governed action was dispatched`,
      );
    }

    const measurement = lab.measurement;
    if (!measurement) {
      const gap = `${labId}: no validated lab measurement was admitted`;
      adoptionGaps.push(gap);
      operationalGaps.push(gap);
      governanceGaps.push(gap);
      economicGaps.push(gap);
      externalValidityGaps.push(gap);
      continue;
    }

    const { adoption, operations, governance, economics, externalValidity } =
      measurement;
    if (adoption.substratePackageEdits === null) {
      adoptionGaps.push(`${labId}: substrate edit count is unmeasured`);
    } else if (adoption.substratePackageEdits !== 0) {
      adoptionGaps.push(
        `${labId}: onboarding required ${adoption.substratePackageEdits} substrate package edit(s)`,
      );
    }
    if (adoption.appRewriteRequired === null) {
      adoptionGaps.push(`${labId}: app rewrite requirement is unmeasured`);
    } else if (adoption.appRewriteRequired) {
      adoptionGaps.push(`${labId}: onboarding required an app rewrite`);
    }
    if (adoption.timeToFirstValueMs === null) {
      adoptionGaps.push(`${labId}: time-to-first-value is unmeasured`);
    } else if (
      adoption.timeToFirstValueMs > input.thresholds.maxTimeToFirstValueMs
    ) {
      adoptionGaps.push(`${labId}: time-to-first-value exceeded the threshold`);
    }
    if (adoption.mappingCoverage === null) {
      adoptionGaps.push(`${labId}: mapping coverage is unmeasured`);
    } else if (
      adoption.mappingCoverage < input.thresholds.minMappingCoverage
    ) {
      adoptionGaps.push(`${labId}: mapping coverage is below the threshold`);
    }

    if (
      operations.pairedRuns === null ||
      operations.pairedRuns < input.thresholds.minPairedRunsPerLab
    ) {
      operationalGaps.push(`${labId}: insufficient paired end-to-end runs`);
    }
    if (
      operations.baselineAttempts === null ||
      operations.baselineAttempts < input.thresholds.minPairedRunsPerLab ||
      operations.substrateAttempts === null ||
      operations.substrateAttempts < input.thresholds.minPairedRunsPerLab
    ) {
      operationalGaps.push(
        `${labId}: insufficient baseline/substrate outcome attempts`,
      );
    }
    if (
      operations.holdoutRuns === null ||
      operations.holdoutRuns < input.thresholds.minHoldoutRunsPerLab
    ) {
      operationalGaps.push(`${labId}: no qualifying holdout/dynamic-state run`);
    }
    const baselineOutcomeRate =
      operations.baselineAttempts !== null &&
      operations.baselineCorrectOutcomes !== null
        ? rate(
            operations.baselineCorrectOutcomes,
            operations.baselineAttempts,
          )
        : null;
    const substrateOutcomeRate =
      operations.substrateAttempts !== null &&
      operations.substrateCorrectOutcomes !== null
        ? rate(
            operations.substrateCorrectOutcomes,
            operations.substrateAttempts,
          )
        : null;
    if (baselineOutcomeRate === null) {
      operationalGaps.push(`${labId}: baseline correct-outcome rate is unmeasured`);
    }
    if (substrateOutcomeRate === null) {
      operationalGaps.push(`${labId}: substrate correct-outcome rate is unmeasured`);
    } else {
      if (substrateOutcomeRate < input.thresholds.minCorrectOutcomeRate) {
        operationalGaps.push(
          `${labId}: substrate correct-outcome rate is below the threshold`,
        );
      }
      if (
        baselineOutcomeRate !== null &&
        substrateOutcomeRate < baselineOutcomeRate
      ) {
        operationalGaps.push(
          `${labId}: substrate correct-outcome rate regressed versus baseline`,
        );
      }
    }

    const writeCoverage =
      governance.totalWritePaths !== null &&
      governance.governedWritePaths !== null
        ? rate(governance.governedWritePaths, governance.totalWritePaths)
        : null;
    if (writeCoverage === null) {
      governanceGaps.push(`${labId}: governed write-path coverage is unmeasured`);
    } else if (
      writeCoverage < input.thresholds.minGovernedWriteCoverage
    ) {
      governanceGaps.push(`${labId}: governed write-path coverage is too low`);
    }
    const falsePositiveRate =
      governance.expectedAllows !== null &&
      governance.falsePositiveBlocks !== null
        ? rate(governance.falsePositiveBlocks, governance.expectedAllows)
        : null;
    if (falsePositiveRate === null) {
      governanceGaps.push(`${labId}: false-positive controls are unmeasured`);
    } else if (falsePositiveRate > input.thresholds.maxFalsePositiveRate) {
      governanceGaps.push(`${labId}: false-positive block rate is too high`);
    }
    const falseNegativeRate =
      governance.expectedBlocks !== null &&
      governance.falseNegativeAllows !== null
        ? rate(governance.falseNegativeAllows, governance.expectedBlocks)
        : null;
    if (falseNegativeRate === null) {
      governanceGaps.push(`${labId}: false-negative controls are unmeasured`);
    } else if (falseNegativeRate > input.thresholds.maxFalseNegativeRate) {
      governanceGaps.push(`${labId}: false-negative allow rate is too high`);
    }

    const baselineCostPerCorrect = perCorrectOutcome(
      economics.baselineCostUsd,
      operations.baselineCorrectOutcomes,
    );
    const substrateCostPerCorrect = perCorrectOutcome(
      economics.substrateCostUsd,
      operations.substrateCorrectOutcomes,
    );
    const costRatio = ratio(substrateCostPerCorrect, baselineCostPerCorrect);
    if (costRatio === null) {
      economicGaps.push(`${labId}: cost per correct outcome is unmeasured`);
    } else if (
      costRatio > input.thresholds.maxCostPerCorrectOutcomeRatio
    ) {
      economicGaps.push(`${labId}: cost per correct outcome is too high`);
    }

    const baselineMinutesPerCorrect = perCorrectOutcome(
      economics.baselineOperatorMinutes,
      operations.baselineCorrectOutcomes,
    );
    const substrateMinutesPerCorrect = perCorrectOutcome(
      economics.substrateOperatorMinutes,
      operations.substrateCorrectOutcomes,
    );
    const operatorRatio = ratio(
      substrateMinutesPerCorrect,
      baselineMinutesPerCorrect,
    );
    if (operatorRatio === null) {
      economicGaps.push(`${labId}: operator time per correct outcome is unmeasured`);
    } else if (
      operatorRatio >
      input.thresholds.maxOperatorMinutesPerCorrectOutcomeRatio
    ) {
      economicGaps.push(`${labId}: operator time per correct outcome regressed`);
    }

    if (
      externalValidity.productionLikeRuns === null ||
      externalValidity.productionLikeRuns <
        input.thresholds.minProductionLikeRunsPerLab
    ) {
      externalValidityGaps.push(`${labId}: no production-like shadow run`);
    }
    if (externalValidity.ownerAccepted !== true) {
      externalValidityGaps.push(`${labId}: owner acceptance is missing`);
    }
  }

  const dimensions = [
    assessment("technical_baseline", technicalGaps),
    assessment("adoption", adoptionGaps),
    assessment("operational_outcomes", operationalGaps),
    assessment("governance_quality", governanceGaps),
    assessment("economic_value", economicGaps),
    assessment("external_validity", externalValidityGaps),
  ];
  const gaps = dimensions.flatMap((item) => item.gaps);
  const technicalBaselineReady = technicalGaps.length === 0;
  const objectiveReady = gaps.length === 0;
  return {
    objectiveReady,
    technicalBaselineReady,
    verdictCeiling: !technicalBaselineReady
      ? "kill_or_repair"
      : objectiveReady
        ? "keep"
        : "keep_with_scope_cut",
    dimensions,
    gaps,
    warnings,
  };
}

/** A human may choose a stricter outcome than the evidence, never a looser one. */
export function isObjectiveFinalVerdictPermitted(
  verdict: ObjectiveFinalVerdict,
  ceiling: ObjectiveVerdictCeiling,
): boolean {
  if (verdict === "kill") return true;
  if (ceiling === "keep") return true;
  return (
    ceiling === "keep_with_scope_cut" && verdict === "keep-with-scope-cut"
  );
}

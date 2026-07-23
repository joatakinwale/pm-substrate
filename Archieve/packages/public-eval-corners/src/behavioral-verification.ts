import { Buffer } from "node:buffer";

type JsonRecord = Record<string, unknown>;

const RECEIPT_KEYS = [
  "batchId",
  "cornerId",
  "decisionGating",
  "efficacyClaimed",
  "eligibleForIndependentAnalysis",
  "evidenceClass",
  "manifestSha256",
  "oracleInvocationVerification",
  "outputRoot",
  "plan",
  "planFileSha256",
  "planHash",
  "planPath",
  "protectedArtifactPolicy",
  "receiptHash",
  "schemaVersion",
  "sourceVerification",
  "trials",
  "upstreamOutcomesInterpreted",
] as const;

const FORBIDDEN_SCORING_KEYS = new Set([
  "agentStateTreatment",
  "arm",
  "boundaryProvider",
  "configPath",
  "outputRoot",
  "planPath",
  "treatment",
  "treatmentPath",
]);

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertExactBehavioralReceiptKeys(
  value: unknown,
): asserts value is JsonRecord {
  if (!isRecord(value)) throw new Error("behavioral receipt must be an object");
  if (
    Object.keys(value).sort(compareCodeUnits).join(",") !==
    [...RECEIPT_KEYS].sort(compareCodeUnits).join(",")
  ) {
    throw new Error("behavioral receipt contains undeclared top-level fields");
  }
}

export function assertJsonDocument(bytes: Buffer, path: string): void {
  try {
    JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${path} must be valid JSON`);
  }
}

export function assertArmBlindScoringInput(bytes: Buffer, path: string): void {
  assertJsonDocument(bytes, path);
  const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  if (!isRecord(parsed)) throw new Error(`${path} must be an object`);
  const keys = Object.keys(parsed).sort(compareCodeUnits);
  if (
    keys.join(",") !== "schemaVersion,taskOutput" ||
    parsed.schemaVersion !== "pm.public-eval-corners.scoring-input.v1"
  ) {
    throw new Error(
      `${path} must contain only schemaVersion and arm-blind taskOutput`,
    );
  }
  const visit = (value: unknown, location: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${location}[${index}]`));
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_SCORING_KEYS.has(key)) {
        throw new Error(`${path} exposes treatment control key ${location}.${key}`);
      }
      visit(child, `${location}.${key}`);
    }
  };
  visit(parsed.taskOutput, "taskOutput");
}

export function appendArtifactValidationIssue(
  issues: string[],
  bytes: Buffer | null,
  path: string,
  validate: (value: Buffer, artifactPath: string) => void,
): void {
  if (bytes === null) return;
  try {
    validate(bytes, path);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
}

export interface BehavioralPlanCellView {
  readonly trialId: string;
  readonly taskId: string;
  readonly seed: string;
}

export interface BehavioralPlanLinkageInput {
  readonly receiptManifestSha256: string;
  readonly planManifestSha256: string;
  readonly trials: readonly BehavioralPlanCellView[];
  readonly manifestTaskIds: readonly string[];
}

export function behavioralPlanLinkageIssues(
  input: BehavioralPlanLinkageInput,
): readonly string[] {
  const issues: string[] = [];
  if (input.planManifestSha256 !== input.receiptManifestSha256) {
    issues.push("embedded plan manifest hash does not match receipt manifest hash");
  }
  const manifestTaskIds = new Set(input.manifestTaskIds);
  const seenTrialIds = new Set<string>();
  const seenTaskSeeds = new Set<string>();
  for (const trial of input.trials) {
    if (seenTrialIds.has(trial.trialId)) {
      issues.push(`embedded plan contains duplicate trialId ${trial.trialId}`);
    }
    seenTrialIds.add(trial.trialId);
    const taskSeed = `${trial.taskId}\0${trial.seed}`;
    if (seenTaskSeeds.has(taskSeed)) {
      issues.push(
        `embedded plan contains duplicate taskId/seed pair ${trial.taskId}/${trial.seed}`,
      );
    }
    seenTaskSeeds.add(taskSeed);
    if (!manifestTaskIds.has(trial.taskId)) {
      issues.push(`${trial.trialId}: taskId is not pinned by the corner manifest`);
    }
  }
  return issues;
}

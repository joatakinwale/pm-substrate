import { createHash, verify as verifySignature } from "node:crypto";

export type SentinelLiveArm = "native" | "sham" | "substrate";
export type SentinelLiveTaskId =
  | "microhub-stars-relative-passive"
  | "microhub-stars-noop"
  | "microhub-stars-absolute-passive";

export interface SentinelLiveTaskRegistration {
  readonly taskId: SentinelLiveTaskId;
  readonly role:
    | "headline-relative-state-failure"
    | "anti-degenerate-noop"
    | "expected-allow-absolute";
  readonly scenarioSha256: string;
}

export interface SentinelLivePreregistration {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-preregistration.v1";
  readonly registrationId: string;
  readonly registeredAt: string;
  readonly objective: string;
  readonly implementation: {
    readonly substrateRevision: string;
    readonly sourceTreeHash: string;
    readonly workingTreeClean: true;
    readonly runtimeClosureSha256: string;
    readonly runnerScriptSha256: string;
    readonly supervisorScriptSha256: string;
    readonly verifierScriptSha256: string;
    readonly packageLockSha256: string;
    readonly nodeVersion: string;
    readonly pythonVersion: string;
    readonly playwrightVersion: "1.56.1";
  };
  readonly benchmark: {
    readonly repositoryUrl: "https://github.com/microsoft/sentinel_environments";
    readonly revision: "0faca33cc58ea62e97a928b67cd3beec7176b408";
    readonly manifestSha256: string;
    readonly speedFactor: 1;
    readonly publishedDefaultSpeedFactor: 1;
    readonly qualificationOnly: true;
  };
  readonly tasks: readonly SentinelLiveTaskRegistration[];
  readonly arms: readonly SentinelLiveArm[];
  readonly repeatIds: readonly string[];
  readonly randomizationSeed: string;
  readonly model: {
    readonly provider: "anthropic";
    readonly endpoint: "https://api.anthropic.com/v1/messages";
    readonly apiVersion: "2023-06-01";
    readonly model: "claude-sonnet-4-5-20250929";
    readonly temperature: 0;
    readonly maxCompletionTokens: number;
    readonly automaticRetries: 0;
    readonly pricing: {
      readonly sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing";
      readonly accessedAt: string;
      readonly baseInputUsdPerMillionTokens: 3;
      readonly outputUsdPerMillionTokens: 15;
      readonly promptCachingEnabled: false;
    };
  };
  readonly agent: {
    readonly statelessAcrossPolls: true;
    readonly pollIntervalMs: number;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly screenshotMediaType: "image/png";
    readonly scriptSha256: string;
  };
  readonly treatment: {
    readonly agentReceivesArmIdentity: false;
    readonly interfaceShapeIdentical: true;
    readonly fixedWidthStateContext: true;
    readonly nativePersistence: "discard";
    readonly shamPersistence: "persist-write-return-irrelevant";
    readonly substratePersistence: "admit-first-browser-observation";
    readonly sidecarScriptSha256: string;
  };
  readonly evidence: {
    readonly providerProxyScriptSha256: string;
    readonly exactUpstreamTaskInvocation: true;
    readonly retainEveryProviderExchange: true;
    readonly retainEveryTerminalFailure: true;
    readonly noReruns: true;
    readonly executeEveryDeclaredCell: true;
    readonly rawOutcomesRemainUninterpretedDuringExecution: true;
  };
  readonly analysis: {
    readonly primaryOutcome: "unchanged-upstream-success";
    readonly headlineContrast: "substrate-vs-native-and-sham-on-relative";
    readonly requiredCleanControls: readonly [
      "microhub-stars-noop",
      "microhub-stars-absolute-passive",
    ];
    readonly noTaskOrRepeatShopping: true;
    readonly reportAllCellsIncludingFailures: true;
    readonly minimumMaterialLift: typeof SENTINEL_MATERIAL_LIFT_RULE;
  };
  readonly stoppingRule: {
    readonly retriesPerCell: 0;
    readonly stopAfterDeclaredUniverse: true;
    readonly infrastructureFailureDisposition: "retain-and-mark-incomplete";
    readonly behavioralFailureDisposition: "retain-and-include";
  };
  readonly eligibility: {
    readonly independentAuthorityRequired: true;
    readonly localProducerMayNotSelfPromote: true;
    readonly publicEfficacyEligibleBeforeExternalVerification: false;
  };
}

export interface SentinelPreregistrationSignature {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-preregistration-signature.v1";
  readonly preregistrationSha256: string;
  readonly algorithm: "Ed25519";
  readonly publicKeyPem: string;
  readonly publicKeySha256: string;
  readonly signatureBase64: string;
}

export interface SentinelLiveCell {
  readonly sequence: number;
  readonly cellId: string;
  readonly taskId: SentinelLiveTaskId;
  readonly taskRole: SentinelLiveTaskRegistration["role"];
  readonly arm: SentinelLiveArm;
  readonly repeatId: string;
}

export interface SentinelLivePlanVerification {
  readonly valid: boolean;
  readonly preregistrationSha256: string;
  readonly signatureValid: boolean;
  readonly cells: readonly SentinelLiveCell[];
  readonly issues: readonly string[];
}

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_OBJECT_ID = /^[a-f0-9]{40}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const SENTINEL_MANIFEST_SHA256 =
  "9da3305715740840299a1acc8b47bacf9a706eb293ad0cde3aee5d7e3adf1989";
export const SENTINEL_MATERIAL_LIFT_RULE =
  "With three declared repeats, substrate must pass at least 2/3 relative cells while native and sham each pass at most 1/3; every arm must pass at least 2/3 no-op and at least 2/3 absolute cells; any infrastructure-incomplete cell prevents a material-benefit conclusion." as const;
const OBJECTIVE =
  "Stress-test pm-substrate hard against real, publicly documented agent-state failure scenarios; demonstrate the failures under matched native and sham controls; test whether pm-substrate materially improves the benchmark’s real outcome; identify observed gaps; use Arrowsmith to research the smallest general repair; then rerun the exact failure and clean controls while aggressively excluding false positives.";
const REQUIRED_TASKS: Readonly<Record<SentinelLiveTaskId, {
  readonly role: SentinelLiveTaskRegistration["role"];
  readonly scenarioSha256: string;
}>> = {
  "microhub-stars-relative-passive": {
    role: "headline-relative-state-failure",
    scenarioSha256: "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
  },
  "microhub-stars-noop": {
    role: "anti-degenerate-noop",
    scenarioSha256: "e689d9d99d97bf1cca71f96b96e72cbbd882a2848be26ba9d9d3ba78dd99649d",
  },
  "microhub-stars-absolute-passive": {
    role: "expected-allow-absolute",
    scenarioSha256: "2fe141ded7e4afc06d77db16f07ccaa0e62ccda805cb7d3c4318eed9d61fb08e",
  },
};
const ARMS: readonly SentinelLiveArm[] = ["native", "sham", "substrate"];

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function canonical(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(",")}]`;
  const record = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key] as JsonValue)}`)
    .join(",")}}`;
}

export function sentinelSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sentinelJsonSha256(value: unknown): string {
  return sentinelSha256(canonical(value as JsonValue));
}

function sameSet<T>(actual: readonly T[], expected: readonly T[]): boolean {
  return actual.length === expected.length && expected.every((entry) => actual.includes(entry));
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasExactKeys(value: unknown, expected: readonly string[]): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    Object.keys(value).sort(compareCodeUnits).join("\0") ===
    [...expected].sort(compareCodeUnits).join("\0")
  );
}

function validateExactPreregistrationShape(
  preregistration: SentinelLivePreregistration,
  signature: SentinelPreregistrationSignature,
): readonly string[] {
  const issues: string[] = [];
  const check = (value: unknown, keys: readonly string[], path: string): void => {
    if (!hasExactKeys(value, keys)) issues.push(`${path} keys are not exact`);
  };
  check(preregistration, [
    "agent", "analysis", "arms", "benchmark", "eligibility", "evidence", "model",
    "implementation", "objective", "randomizationSeed", "registeredAt", "registrationId", "repeatIds",
    "schemaVersion", "stoppingRule", "tasks", "treatment",
  ], "preregistration");
  check(preregistration.implementation, [
    "nodeVersion", "packageLockSha256", "playwrightVersion", "pythonVersion",
    "runnerScriptSha256", "runtimeClosureSha256", "sourceTreeHash", "substrateRevision",
    "supervisorScriptSha256", "verifierScriptSha256", "workingTreeClean",
  ], "preregistration.implementation");
  check(preregistration.benchmark, [
    "manifestSha256", "publishedDefaultSpeedFactor", "qualificationOnly", "repositoryUrl",
    "revision", "speedFactor",
  ], "preregistration.benchmark");
  check(preregistration.model, [
    "apiVersion", "automaticRetries", "endpoint", "maxCompletionTokens", "model", "pricing", "provider", "temperature",
  ], "preregistration.model");
  check(preregistration.model.pricing, [
    "accessedAt", "baseInputUsdPerMillionTokens", "outputUsdPerMillionTokens",
    "promptCachingEnabled", "sourceUrl",
  ], "preregistration.model.pricing");
  check(preregistration.agent, [
    "pollIntervalMs", "screenshotMediaType", "scriptSha256", "statelessAcrossPolls", "viewport",
  ], "preregistration.agent");
  check(preregistration.agent.viewport, ["height", "width"], "preregistration.agent.viewport");
  check(preregistration.treatment, [
    "agentReceivesArmIdentity", "fixedWidthStateContext", "interfaceShapeIdentical",
    "nativePersistence", "shamPersistence", "sidecarScriptSha256", "substratePersistence",
  ], "preregistration.treatment");
  check(preregistration.evidence, [
    "exactUpstreamTaskInvocation", "executeEveryDeclaredCell", "noReruns",
    "providerProxyScriptSha256", "rawOutcomesRemainUninterpretedDuringExecution",
    "retainEveryProviderExchange", "retainEveryTerminalFailure",
  ], "preregistration.evidence");
  check(preregistration.analysis, [
    "headlineContrast", "minimumMaterialLift", "noTaskOrRepeatShopping", "primaryOutcome",
    "reportAllCellsIncludingFailures", "requiredCleanControls",
  ], "preregistration.analysis");
  check(preregistration.stoppingRule, [
    "behavioralFailureDisposition", "infrastructureFailureDisposition", "retriesPerCell",
    "stopAfterDeclaredUniverse",
  ], "preregistration.stoppingRule");
  check(preregistration.eligibility, [
    "independentAuthorityRequired", "localProducerMayNotSelfPromote",
    "publicEfficacyEligibleBeforeExternalVerification",
  ], "preregistration.eligibility");
  if (!Array.isArray(preregistration.tasks)) {
    issues.push("preregistration.tasks must be an array");
  } else {
    preregistration.tasks.forEach((task, index) =>
      check(task, ["role", "scenarioSha256", "taskId"], `preregistration.tasks[${index}]`),
    );
  }
  check(signature, [
    "algorithm", "preregistrationSha256", "publicKeyPem", "publicKeySha256",
    "schemaVersion", "signatureBase64",
  ], "signature");
  return issues;
}

export function buildSentinelLiveSchedule(
  preregistration: SentinelLivePreregistration,
): readonly SentinelLiveCell[] {
  const blocks = preregistration.repeatIds.flatMap((repeatId) =>
    preregistration.tasks.map((task) => ({
      blockId: `${repeatId}:${task.taskId}`,
      cells: preregistration.arms.map((arm) => ({
        cellId: `${preregistration.registrationId}:${repeatId}:${task.taskId}:${arm}`,
        taskId: task.taskId,
        taskRole: task.role,
        arm,
        repeatId,
      })),
    })),
  );
  const cells = blocks
    .map((block) => ({
      ...block,
      orderHash: sentinelSha256(`${preregistration.randomizationSeed}\0block\0${block.blockId}`),
    }))
    .sort((left, right) =>
      compareCodeUnits(left.orderHash, right.orderHash) ||
      compareCodeUnits(left.blockId, right.blockId),
    )
    .flatMap(({ cells: blockCells }) => blockCells
      .map((cell) => ({
        cell,
        orderHash: sentinelSha256(`${preregistration.randomizationSeed}\0arm\0${cell.cellId}`),
      }))
      .sort((left, right) =>
        compareCodeUnits(left.orderHash, right.orderHash) ||
        compareCodeUnits(left.cell.cellId, right.cell.cellId),
      )
      .map(({ cell }) => cell));
  return cells.map((cell, index) => ({ ...cell, sequence: index + 1 }));
}

export function verifySentinelPreregistration(
  preregistration: SentinelLivePreregistration,
  signature: SentinelPreregistrationSignature,
  expectedPreregistrationSha256: string,
): SentinelLivePlanVerification {
  const issues: string[] = [...validateExactPreregistrationShape(preregistration, signature)];
  const preregistrationSha256 = sentinelJsonSha256(preregistration);
  if (!SHA256.test(expectedPreregistrationSha256)) {
    issues.push("out-of-band preregistration hash is invalid");
  } else if (preregistrationSha256 !== expectedPreregistrationSha256) {
    issues.push("preregistration does not match the out-of-band hash");
  }
  if (preregistration.schemaVersion !== "pm.public-eval-corners.sentinel-preregistration.v1") {
    issues.push("unsupported preregistration schemaVersion");
  }
  if (!ID.test(preregistration.registrationId)) issues.push("registrationId is invalid");
  if (!Number.isFinite(Date.parse(preregistration.registeredAt))) {
    issues.push("registeredAt is invalid");
  }
  if (preregistration.objective !== OBJECTIVE) issues.push("owner objective changed");
  if (
    !GIT_OBJECT_ID.test(preregistration.implementation.substrateRevision) ||
    !GIT_OBJECT_ID.test(preregistration.implementation.sourceTreeHash) ||
    preregistration.implementation.workingTreeClean !== true ||
    !SHA256.test(preregistration.implementation.runtimeClosureSha256) ||
    !SHA256.test(preregistration.implementation.runnerScriptSha256) ||
    !SHA256.test(preregistration.implementation.supervisorScriptSha256) ||
    !SHA256.test(preregistration.implementation.verifierScriptSha256) ||
    !SHA256.test(preregistration.implementation.packageLockSha256) ||
    !/^v[0-9]+\.[0-9]+\.[0-9]+$/u.test(preregistration.implementation.nodeVersion) ||
    !/^Python [0-9]+\.[0-9]+\.[0-9]+$/u.test(preregistration.implementation.pythonVersion) ||
    preregistration.implementation.playwrightVersion !== "1.56.1"
  ) {
    issues.push("implementation/runtime closure is invalid");
  }
  if (
    preregistration.benchmark.repositoryUrl !==
      "https://github.com/microsoft/sentinel_environments" ||
    preregistration.benchmark.revision !== "0faca33cc58ea62e97a928b67cd3beec7176b408" ||
    preregistration.benchmark.manifestSha256 !== SENTINEL_MANIFEST_SHA256 ||
    preregistration.benchmark.speedFactor !== 1 ||
    preregistration.benchmark.publishedDefaultSpeedFactor !== 1 ||
    preregistration.benchmark.qualificationOnly !== true
  ) {
    issues.push("benchmark pin or qualification boundary changed");
  }
  const taskIds = preregistration.tasks.map(({ taskId }) => taskId);
  if (!sameSet(taskIds, Object.keys(REQUIRED_TASKS) as SentinelLiveTaskId[])) {
    issues.push("preregistration must contain the exact relative/no-op/absolute task matrix");
  }
  if (new Set(taskIds).size !== taskIds.length) issues.push("task IDs are duplicated");
  for (const task of preregistration.tasks) {
    const expected = REQUIRED_TASKS[task.taskId];
    if (
      expected === undefined ||
      task.role !== expected.role ||
      task.scenarioSha256 !== expected.scenarioSha256
    ) {
      issues.push(`task registration changed for ${task.taskId}`);
    }
  }
  if (!sameSet(preregistration.arms, ARMS) || new Set(preregistration.arms).size !== 3) {
    issues.push("arms must be exactly native, sham, substrate");
  }
  if (
    preregistration.repeatIds.length !== 3 ||
    new Set(preregistration.repeatIds).size !== preregistration.repeatIds.length ||
    preregistration.repeatIds.some((repeatId) => !ID.test(repeatId))
  ) {
    issues.push("repeatIds must be non-empty and unique");
  }
  if (!ID.test(preregistration.randomizationSeed)) issues.push("randomizationSeed is invalid");
  if (
    preregistration.model.provider !== "anthropic" ||
    preregistration.model.endpoint !== "https://api.anthropic.com/v1/messages" ||
    preregistration.model.apiVersion !== "2023-06-01" ||
    preregistration.model.model !== "claude-sonnet-4-5-20250929" ||
    preregistration.model.temperature !== 0 ||
    preregistration.model.automaticRetries !== 0 ||
    preregistration.model.maxCompletionTokens !== 256 ||
    preregistration.model.pricing.sourceUrl !==
      "https://platform.claude.com/docs/en/about-claude/pricing" ||
    !Number.isFinite(Date.parse(preregistration.model.pricing.accessedAt)) ||
    preregistration.model.pricing.baseInputUsdPerMillionTokens !== 3 ||
    preregistration.model.pricing.outputUsdPerMillionTokens !== 15 ||
    preregistration.model.pricing.promptCachingEnabled !== false
  ) {
    issues.push("provider configuration changed");
  }
  if (
    preregistration.agent.statelessAcrossPolls !== true ||
    preregistration.agent.pollIntervalMs < 5_000 ||
    preregistration.agent.pollIntervalMs > 60_000 ||
    preregistration.agent.viewport.width !== 1280 ||
    preregistration.agent.viewport.height !== 720 ||
    preregistration.agent.screenshotMediaType !== "image/png" ||
    !SHA256.test(preregistration.agent.scriptSha256)
  ) {
    issues.push("agent runtime configuration changed");
  }
  if (
    preregistration.treatment.agentReceivesArmIdentity !== false ||
    preregistration.treatment.interfaceShapeIdentical !== true ||
    preregistration.treatment.fixedWidthStateContext !== true ||
    preregistration.treatment.nativePersistence !== "discard" ||
    preregistration.treatment.shamPersistence !== "persist-write-return-irrelevant" ||
    preregistration.treatment.substratePersistence !== "admit-first-browser-observation" ||
    !SHA256.test(preregistration.treatment.sidecarScriptSha256)
  ) {
    issues.push("treatment isolation configuration changed");
  }
  if (
    !SHA256.test(preregistration.evidence.providerProxyScriptSha256) ||
    preregistration.evidence.exactUpstreamTaskInvocation !== true ||
    preregistration.evidence.retainEveryProviderExchange !== true ||
    preregistration.evidence.retainEveryTerminalFailure !== true ||
    preregistration.evidence.noReruns !== true ||
    preregistration.evidence.executeEveryDeclaredCell !== true ||
    preregistration.evidence.rawOutcomesRemainUninterpretedDuringExecution !== true
  ) {
    issues.push("evidence retention policy changed");
  }
  if (
    preregistration.analysis.primaryOutcome !== "unchanged-upstream-success" ||
    preregistration.analysis.headlineContrast !==
      "substrate-vs-native-and-sham-on-relative" ||
    !sameSet(preregistration.analysis.requiredCleanControls, [
      "microhub-stars-noop",
      "microhub-stars-absolute-passive",
    ]) ||
    preregistration.analysis.noTaskOrRepeatShopping !== true ||
    preregistration.analysis.reportAllCellsIncludingFailures !== true ||
    preregistration.analysis.minimumMaterialLift !== SENTINEL_MATERIAL_LIFT_RULE
  ) {
    issues.push("analysis plan changed");
  }
  if (
    preregistration.stoppingRule.retriesPerCell !== 0 ||
    preregistration.stoppingRule.stopAfterDeclaredUniverse !== true ||
    preregistration.stoppingRule.infrastructureFailureDisposition !==
      "retain-and-mark-incomplete" ||
    preregistration.stoppingRule.behavioralFailureDisposition !== "retain-and-include"
  ) {
    issues.push("stopping rule changed");
  }
  if (
    preregistration.eligibility.independentAuthorityRequired !== true ||
    preregistration.eligibility.localProducerMayNotSelfPromote !== true ||
    preregistration.eligibility.publicEfficacyEligibleBeforeExternalVerification !== false
  ) {
    issues.push("eligibility ceiling changed");
  }

  let signatureValid = false;
  try {
    signatureValid =
      signature.schemaVersion ===
        "pm.public-eval-corners.sentinel-preregistration-signature.v1" &&
      signature.preregistrationSha256 === preregistrationSha256 &&
      signature.algorithm === "Ed25519" &&
      signature.publicKeySha256 === sentinelSha256(signature.publicKeyPem) &&
      verifySignature(
        null,
        Buffer.from(preregistrationSha256, "hex"),
        signature.publicKeyPem,
        Buffer.from(signature.signatureBase64, "base64"),
      );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) issues.push("preregistration signature is invalid");

  let cells: readonly SentinelLiveCell[] = [];
  try {
    cells = buildSentinelLiveSchedule(preregistration);
    const expectedCount = preregistration.tasks.length * 3 * preregistration.repeatIds.length;
    if (cells.length !== expectedCount || new Set(cells.map(({ cellId }) => cellId)).size !== cells.length) {
      issues.push("execution schedule does not cover a unique exact cell universe");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return {
    valid: issues.length === 0,
    preregistrationSha256,
    signatureValid,
    cells,
    issues,
  };
}

export const sentinelLiveRequiredTasks = REQUIRED_TASKS;
export const sentinelLiveOwnerObjective = OBJECTIVE;

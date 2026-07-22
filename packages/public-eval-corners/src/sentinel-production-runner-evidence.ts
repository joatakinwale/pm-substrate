import {
  chmodSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";

import {
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import type {
  SentinelRuntimeClosureArtifacts,
  SentinelRuntimeClosurePaths,
} from "./sentinel-runtime-closure.js";

const SHA256 = /^[a-f0-9]{64}$/u;
const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_EXTERNAL_COMMITMENT_BYTES = 64 * 1024;

export interface SentinelProductionExternalCommitmentRecord {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-external-commitment.v1";
  readonly medium: "independent-append-only-external-record";
  readonly commitmentId: string;
  readonly committedAt: string;
  readonly custodianId: string;
  readonly custodianOwnerId: string;
  readonly independent: true;
  readonly locator: string;
  readonly expectedPreregistrationSha256: string;
  readonly expectedAuthorityId: string;
  readonly expectedAuthorityPublicKeySha256: string;
  readonly receiptSha256: string;
}
export interface SentinelProductionExternalCommitmentVerification {
  readonly valid: boolean;
  readonly locator: string;
  readonly responseUrl: string | null;
  readonly redirected: boolean | null;
  readonly httpStatus: number | null;
  readonly contentType: string | null;
  readonly observedAt: string;
  readonly responseByteLength: number | null;
  readonly responseSha256: string | null;
  readonly responseBodyBase64: string | null;
  readonly issues: readonly string[];
}

export interface SentinelProductionRuntimeExecutionLeaseIdentity {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease-identity.v1";
  readonly closureSha256: string;
  readonly boundPathsManifestSha256: string;
  readonly acquiredDerivationSha256: string;
  readonly exactSupervisorPaths: {
    readonly nodeExecutablePath: string;
    readonly npmCliPath: string;
    readonly pythonExecutablePath: string;
    readonly agentScriptPath: string;
  };
  readonly identitySha256: string;
}

export interface SentinelProductionRuntimeInspection {
  readonly valid: boolean;
  readonly closure: SentinelRuntimeClosure;
  readonly closureSha256: string;
  readonly executableIdentitySha256: string;
  readonly artifacts: SentinelRuntimeClosureArtifacts | null;
  readonly executionLeaseIdentity: SentinelProductionRuntimeExecutionLeaseIdentity | null;
  readonly issues: readonly string[];
}

export interface SentinelProductionRetainedEvidenceReference {
  readonly path: string;
  readonly sha256: string;
}

export interface SentinelProductionRuntimeInspectionReference {
  readonly inspectionReceiptPath: string;
  readonly inspectionReceiptSha256: string;
  readonly artifactPath: string | null;
  readonly artifactSha256: string | null;
  readonly derivationSha256: string | null;
  readonly closureSha256: string;
  readonly executableIdentitySha256: string;
  readonly executionLeaseIdentitySha256: string | null;
  readonly inspectedAt: string;
  readonly valid: boolean;
}

export interface SentinelProductionPreparedExternalObservation {
  readonly bytes: Uint8Array;
  readonly receiptBody: {
    readonly schemaVersion: "pm.public-eval-corners.sentinel-production-external-commitment-observation.v1";
    readonly evidenceEligible: false;
    readonly materialBenefit: false;
    readonly valid: true;
    readonly issues: readonly [];
    readonly locator: string;
    readonly responseUrl: string;
    readonly redirected: false;
    readonly httpStatus: 200;
    readonly contentType: string;
    readonly observedAt: string;
    readonly locallyValidatedAt: string;
    readonly bodyPath: "inputs/external-commitment-observation.body.json";
    readonly bodyByteLength: number;
    readonly bodySha256: string;
    readonly commitmentReceiptSha256: string;
  };
}

function canonicalTimestamp(value: string, label: string): string {
  if (!CANONICAL_TIMESTAMP.test(value) || new Date(value).toISOString() !== value) {
    throw new Error(`${label} is not a canonical timestamp`);
  }
  return value;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function writeExclusive(path: string, bytes: string | Uint8Array): void {
  writeFileSync(path, bytes, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
}

function writeContentAddressed(
  directory: string,
  prefix: string,
  body: Record<string, unknown>,
  hashField: "artifactSha256" | "receiptSha256",
): SentinelProductionRetainedEvidenceReference {
  const sha256 = sentinelProductionJsonSha256(body);
  const path = resolve(directory, `${prefix}-${sha256}.json`);
  const retained = { ...body, [hashField]: sha256 };
  if (existsSync(path)) {
    const existing = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (sentinelProductionCanonicalJson(existing) !== sentinelProductionCanonicalJson(retained)) {
      throw new Error("content-addressed runtime evidence path collision");
    }
  } else {
    writeExclusive(path, `${JSON.stringify(retained, null, 2)}\n`);
  }
  return { path, sha256 };
}

function decodeCanonicalBase64(value: string): Buffer {
  if (value.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error("external commitment response body is not canonical base64");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error("external commitment response body is not canonical base64");
  }
  return bytes;
}

export async function verifySentinelProductionExternalCommitmentRecord(
  commitment: SentinelProductionExternalCommitmentRecord,
): Promise<SentinelProductionExternalCommitmentVerification> {
  const issues: string[] = [];
  let responseUrl: string | null = null;
  let redirected: boolean | null = null;
  let httpStatus: number | null = null;
  let contentType: string | null = null;
  let responseByteLength: number | null = null;
  let responseSha256: string | null = null;
  let responseBodyBase64: string | null = null;
  try {
    const response = await fetch(commitment.locator, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: { accept: "application/json", "cache-control": "no-cache" },
    });
    responseUrl = response.url;
    redirected = response.redirected;
    httpStatus = response.status;
    contentType = response.headers.get("content-type");
    const declaredLength = response.headers.get("content-length");
    const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
    if (
      response.status !== 200 ||
      response.url !== commitment.locator ||
      response.redirected ||
      mediaType !== "application/json" ||
      (declaredLength !== null &&
        (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_EXTERNAL_COMMITMENT_BYTES))
    ) throw new Error(`external commitment fetch failed with HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    responseByteLength = bytes.byteLength;
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_EXTERNAL_COMMITMENT_BYTES) {
      throw new Error("external commitment response size is invalid");
    }
    if (declaredLength !== null && Number(declaredLength) !== bytes.byteLength) {
      throw new Error("external commitment content-length differs from retained bytes");
    }
    responseSha256 = sentinelProductionSha256(bytes);
    responseBodyBase64 = bytes.toString("base64");
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    if (sentinelProductionCanonicalJson(parsed) !== sentinelProductionCanonicalJson(commitment)) {
      throw new Error("external locator did not return the exact commitment receipt");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return {
    valid: issues.length === 0,
    locator: commitment.locator,
    responseUrl,
    redirected,
    httpStatus,
    contentType,
    observedAt: new Date().toISOString(),
    responseByteLength,
    responseSha256,
    responseBodyBase64,
    issues,
  };
}

export function prepareSentinelProductionExternalObservation(
  commitment: SentinelProductionExternalCommitmentRecord,
  observation: SentinelProductionExternalCommitmentVerification,
  runStartedAt: string,
  locallyValidatedAt: string,
): SentinelProductionPreparedExternalObservation {
  exactKeys(observation, [
    "contentType", "httpStatus", "issues", "locator", "observedAt", "redirected",
    "responseBodyBase64", "responseByteLength", "responseSha256", "responseUrl", "valid",
  ], "external commitment observation");
  const observedAt = canonicalTimestamp(observation.observedAt, "external commitment observedAt");
  const mediaType = observation.contentType?.split(";", 1)[0]?.trim().toLowerCase();
  if (
    !observation.valid ||
    observation.issues.length !== 0 ||
    observation.locator !== commitment.locator ||
    observation.responseUrl !== commitment.locator ||
    observation.redirected !== false ||
    observation.httpStatus !== 200 ||
    mediaType !== "application/json" ||
    observation.contentType === null ||
    observation.responseBodyBase64 === null ||
    observation.responseByteLength === null ||
    observation.responseSha256 === null ||
    !SHA256.test(observation.responseSha256)
  ) {
    throw new Error(
      `external commitment record was not independently retrieved: ${observation.issues.join("; ")}`,
    );
  }
  if (Date.parse(observedAt) < Date.parse(canonicalTimestamp(runStartedAt, "runStartedAt"))) {
    throw new Error("external commitment observation predates local run-start preflight");
  }
  const validatedAt = canonicalTimestamp(locallyValidatedAt, "external commitment locallyValidatedAt");
  if (Date.parse(observedAt) > Date.parse(validatedAt)) {
    throw new Error("external commitment observation postdates local retrieval validation");
  }
  const bytes = decodeCanonicalBase64(observation.responseBodyBase64);
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_EXTERNAL_COMMITMENT_BYTES ||
    bytes.byteLength !== observation.responseByteLength ||
    sentinelProductionSha256(bytes) !== observation.responseSha256
  ) throw new Error("external commitment observation body identity is invalid");
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")) as unknown; }
  catch { throw new Error("external commitment observation body is not JSON"); }
  if (sentinelProductionCanonicalJson(parsed) !== sentinelProductionCanonicalJson(commitment)) {
    throw new Error("external commitment observation body differs from the committed receipt");
  }
  return {
    bytes,
    receiptBody: {
      schemaVersion: "pm.public-eval-corners.sentinel-production-external-commitment-observation.v1",
      evidenceEligible: false,
      materialBenefit: false,
      valid: true,
      issues: [],
      locator: observation.locator,
      responseUrl: observation.responseUrl,
      redirected: false,
      httpStatus: 200,
      contentType: observation.contentType,
      observedAt,
      locallyValidatedAt: validatedAt,
      bodyPath: "inputs/external-commitment-observation.body.json",
      bodyByteLength: bytes.byteLength,
      bodySha256: observation.responseSha256,
      commitmentReceiptSha256: commitment.receiptSha256,
    },
  };
}

export function retainSentinelProductionExternalObservation(
  batchRoot: string,
  prepared: SentinelProductionPreparedExternalObservation,
): SentinelProductionRetainedEvidenceReference {
  const inputsRoot = resolve(batchRoot, "inputs");
  writeExclusive(resolve(inputsRoot, "external-commitment-observation.body.json"), prepared.bytes);
  return writeContentAddressed(
    inputsRoot,
    "external-commitment-observation",
    prepared.receiptBody as unknown as Record<string, unknown>,
    "receiptSha256",
  );
}

export function createSentinelProductionRuntimeLeaseIdentity(
  paths: SentinelRuntimeClosurePaths,
  closure: SentinelRuntimeClosure,
  artifacts: SentinelRuntimeClosureArtifacts,
): SentinelProductionRuntimeExecutionLeaseIdentity {
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease-identity.v1" as const,
    closureSha256: closure.closureSha256,
    boundPathsManifestSha256: closure.executionLease.boundPathsManifestSha256,
    acquiredDerivationSha256: artifacts.derivationSha256,
    exactSupervisorPaths: {
      nodeExecutablePath: paths.nodeRequestedPath,
      npmCliPath: paths.npmRequestedCliPath,
      pythonExecutablePath: paths.pythonRequestedVenvPath,
      agentScriptPath: paths.agentScriptPath,
    },
  };
  return { ...body, identitySha256: sentinelProductionJsonSha256(body) };
}

export function assertSentinelProductionRuntimeInspectionEvidence(
  inspection: SentinelProductionRuntimeInspection,
): void {
  if (!SHA256.test(inspection.closureSha256) || !SHA256.test(inspection.executableIdentitySha256)) {
    throw new Error("runtime inspection contains an invalid identity hash");
  }
  if (!inspection.valid) return;
  if (inspection.issues.length !== 0 || inspection.artifacts === null || inspection.executionLeaseIdentity === null) {
    throw new Error("valid runtime inspection omitted retained derivation or lease identity");
  }
  const { derivationSha256, ...artifactBody } = inspection.artifacts;
  if (
    inspection.artifacts.schemaVersion !== "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v4" ||
    !SHA256.test(derivationSha256) ||
    sentinelProductionJsonSha256(artifactBody) !== derivationSha256
  ) throw new Error("runtime derivation artifact identity is invalid");
  const { identitySha256, ...leaseBody } = inspection.executionLeaseIdentity;
  if (
    inspection.executionLeaseIdentity.schemaVersion !==
      "pm.public-eval-corners.sentinel-runtime-execution-lease-identity.v1" ||
    sentinelProductionJsonSha256(leaseBody) !== identitySha256 ||
    leaseBody.closureSha256 !== inspection.closureSha256 ||
    leaseBody.boundPathsManifestSha256 !== inspection.closure.executionLease.boundPathsManifestSha256 ||
    leaseBody.acquiredDerivationSha256 !== derivationSha256
  ) throw new Error("runtime execution lease identity is invalid");
}

export function retainSentinelProductionRuntimeInspection(input: {
  readonly batchRoot: string;
  readonly inspection: SentinelProductionRuntimeInspection;
  readonly boundary: "initial" | "before" | "after";
  readonly blockSequence: number | null;
  readonly inspectedAt: string;
  readonly preregistrationClosureSha256: string;
  readonly previousInspectionReceiptSha256: string;
}): SentinelProductionRuntimeInspectionReference {
  const runtimeRoot = resolve(input.batchRoot, "manifests", "runtime");
  const inspectedAt = canonicalTimestamp(input.inspectedAt, "runtime inspectedAt");
  assertSentinelProductionRuntimeInspectionEvidence(input.inspection);
  let artifact: SentinelProductionRetainedEvidenceReference | null = null;
  if (input.inspection.artifacts !== null) {
    artifact = writeContentAddressed(
      runtimeRoot,
      "runtime-artifacts",
      input.inspection.artifacts as unknown as Record<string, unknown>,
      "artifactSha256",
    );
  }
  const receiptBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-runtime-inspection.v1",
    evidenceEligible: false,
    materialBenefit: false,
    boundary: input.boundary,
    blockSequence: input.blockSequence,
    inspectedAt,
    preregistrationClosureSha256: input.preregistrationClosureSha256,
    previousInspectionReceiptSha256: input.previousInspectionReceiptSha256,
    valid: input.inspection.valid,
    issues: input.inspection.issues,
    closure: input.inspection.closure,
    closureSha256: input.inspection.closureSha256,
    executableIdentitySha256: input.inspection.executableIdentitySha256,
    artifact: artifact === null ? null : {
      path: relative(resolve(input.batchRoot), artifact.path),
      sha256: artifact.sha256,
      derivationSha256: input.inspection.artifacts?.derivationSha256 ?? null,
    },
    executionLeaseIdentity: input.inspection.executionLeaseIdentity,
  };
  const prefix = input.boundary === "initial"
    ? "runtime-initial"
    : `runtime-block-${String(input.blockSequence).padStart(6, "0")}-${input.boundary}`;
  const receipt = writeContentAddressed(
    runtimeRoot,
    prefix,
    receiptBody,
    "receiptSha256",
  );
  return {
    inspectionReceiptPath: relative(resolve(input.batchRoot), receipt.path),
    inspectionReceiptSha256: receipt.sha256,
    artifactPath: artifact === null ? null : relative(resolve(input.batchRoot), artifact.path),
    artifactSha256: artifact?.sha256 ?? null,
    derivationSha256: input.inspection.artifacts?.derivationSha256 ?? null,
    closureSha256: input.inspection.closureSha256,
    executableIdentitySha256: input.inspection.executableIdentitySha256,
    executionLeaseIdentitySha256: input.inspection.executionLeaseIdentity?.identitySha256 ?? null,
    inspectedAt,
    valid: input.inspection.valid,
  };
}

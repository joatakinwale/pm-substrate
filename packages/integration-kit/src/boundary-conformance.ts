import { createHash } from "node:crypto";

import { canonicalStringify } from "@pm/agent-state-core";

export const BOUNDARY_CONFORMANCE_SCHEMA_VERSION =
  "pm.boundary-conformance.v1" as const;

export interface BoundaryConformanceCheckObservation {
  readonly name: string;
  readonly command: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly durationMs: number;
  readonly stdoutBytes: number;
  readonly stdoutSha256: string;
  readonly stderrBytes: number;
  readonly stderrSha256: string;
}

export interface BoundaryConformanceArtifactInput {
  readonly appId: string;
  readonly observedAt: string;
  readonly appRevision: string;
  readonly substrateRevision: string;
  readonly checks: readonly BoundaryConformanceCheckObservation[];
}

export interface BoundaryConformanceArtifact
  extends BoundaryConformanceArtifactInput {
  readonly schemaVersion: typeof BOUNDARY_CONFORMANCE_SCHEMA_VERSION;
  readonly ready: boolean;
  readonly blockers: readonly string[];
  /** SHA-256 of every preceding field, excluding this self-reference. */
  readonly contentHash: string;
}

const SHA256 = /^[a-f0-9]{64}$/;

const isConcrete = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  !value.startsWith("replace-with:");

const assertConcrete = (label: string, value: unknown): void => {
  if (!isConcrete(value)) {
    throw new Error(`${label} must be a concrete, non-placeholder string`);
  }
};

const assertNonNegativeInteger = (label: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
};

/**
 * Build the durable D6 boundary receipt. This does not run commands; the CLI
 * is the runtime consumer and supplies observations from the external app.
 */
export function buildBoundaryConformanceArtifact(
  input: BoundaryConformanceArtifactInput,
): BoundaryConformanceArtifact {
  assertConcrete("appId", input.appId);
  assertConcrete("appRevision", input.appRevision);
  assertConcrete("substrateRevision", input.substrateRevision);
  if (!Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error("observedAt must be an ISO-compatible timestamp");
  }
  if (input.checks.length === 0) {
    throw new Error("at least one boundary-conformance check is required");
  }

  const seenNames = new Set<string>();
  for (const [index, check] of input.checks.entries()) {
    const path = `checks[${index}]`;
    assertConcrete(`${path}.name`, check.name);
    assertConcrete(`${path}.command`, check.command);
    if (seenNames.has(check.name)) {
      throw new Error(`duplicate boundary-conformance check name: ${check.name}`);
    }
    seenNames.add(check.name);
    if (
      check.exitCode !== null &&
      (!Number.isSafeInteger(check.exitCode) || check.exitCode < 0)
    ) {
      throw new Error(`${path}.exitCode must be null or a non-negative integer`);
    }
    if (check.signal !== null) assertConcrete(`${path}.signal`, check.signal);
    assertNonNegativeInteger(`${path}.durationMs`, check.durationMs);
    assertNonNegativeInteger(`${path}.stdoutBytes`, check.stdoutBytes);
    assertNonNegativeInteger(`${path}.stderrBytes`, check.stderrBytes);
    if (!SHA256.test(check.stdoutSha256)) {
      throw new Error(`${path}.stdoutSha256 must be a lowercase SHA-256`);
    }
    if (!SHA256.test(check.stderrSha256)) {
      throw new Error(`${path}.stderrSha256 must be a lowercase SHA-256`);
    }
  }

  const blockers = input.checks
    .filter((check) => check.exitCode !== 0 || check.signal !== null)
    .map((check) =>
      check.signal === null
        ? `${check.name}: exit ${check.exitCode ?? "unknown"}`
        : `${check.name}: signal ${check.signal}`,
    );
  const body = {
    schemaVersion: BOUNDARY_CONFORMANCE_SCHEMA_VERSION,
    appId: input.appId,
    observedAt: input.observedAt,
    appRevision: input.appRevision,
    substrateRevision: input.substrateRevision,
    ready: blockers.length === 0,
    blockers,
    checks: input.checks,
  } as const;
  const contentHash = createHash("sha256")
    .update(canonicalStringify(body))
    .digest("hex");

  return { ...body, contentHash };
}

/**
 * Binds an integration event to the exact app/substrate revisions and the
 * predeclared run/boundary artifacts it is evidence for. Optional for generic
 * D5 traffic; required by the D6 objective fold.
 */
export interface IntegrationEvidenceContext {
  readonly appRevision: string;
  readonly substrateRevision: string;
  readonly runManifestRef: string;
  readonly boundaryConformanceRef: string;
}

const FIELDS = [
  "appRevision",
  "substrateRevision",
  "runManifestRef",
  "boundaryConformanceRef",
] as const satisfies readonly (keyof IntegrationEvidenceContext)[];

/** Refuse partially filled or placeholder provenance before publishing it. */
export function parseIntegrationEvidenceContext(
  value: unknown,
): IntegrationEvidenceContext {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("integration evidence context must be an object");
  }
  const record = value as Record<string, unknown>;
  for (const field of FIELDS) {
    const item = record[field];
    if (
      typeof item !== "string" ||
      item.trim().length === 0 ||
      item !== item.trim() ||
      item.startsWith("replace-with:")
    ) {
      throw new Error(
        `integration evidence context ${field} must be a concrete, non-placeholder string`,
      );
    }
  }
  return {
    appRevision: record["appRevision"] as string,
    substrateRevision: record["substrateRevision"] as string,
    runManifestRef: record["runManifestRef"] as string,
    boundaryConformanceRef: record["boundaryConformanceRef"] as string,
  };
}

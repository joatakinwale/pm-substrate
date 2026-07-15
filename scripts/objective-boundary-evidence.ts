import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import type { ObjectiveLabMeasurement } from "../packages/evals/src/index.js";
import {
  requireBoundaryConformanceBinding,
  type BoundaryConformanceArtifact,
} from "../packages/integration-kit/src/index.js";

const ROOT = resolve(import.meta.dirname, "..");

/** Reopen and verify the boundary receipt instead of trusting its event ref. */
export function verifyObjectiveMeasurementBoundaryArtifact(
  measurement: ObjectiveLabMeasurement,
): BoundaryConformanceArtifact {
  const ref = measurement.runProvenance.boundaryConformanceRef;
  const match = /^artifact:(.+)#sha256:([a-f0-9]{64})$/.exec(ref);
  if (match === null) {
    throw new Error(
      "runProvenance.boundaryConformanceRef must be artifact:<path>#sha256:<hash>",
    );
  }
  const path = match[1]!;
  const expectedHash = match[2]!;
  const absolutePath = isAbsolute(path) ? path : resolve(ROOT, path);
  let raw: unknown;
  try {
    const realRoot = realpathSync(ROOT);
    const realArtifact = realpathSync(absolutePath);
    const relativeArtifact = relative(realRoot, realArtifact);
    if (
      relativeArtifact.startsWith("..") ||
      isAbsolute(relativeArtifact)
    ) {
      throw new Error("artifact must be stored inside the pm-substrate checkout");
    }
    raw = JSON.parse(readFileSync(realArtifact, "utf8"));
  } catch (error) {
    throw new Error(
      `cannot read boundary-conformance artifact ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return requireBoundaryConformanceBinding(raw, {
    appId: measurement.labId,
    appRevision: measurement.runProvenance.appRevision,
    substrateRevision: measurement.runProvenance.substrateRevision,
    contentHash: expectedHash,
  });
}

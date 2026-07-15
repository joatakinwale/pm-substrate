import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { verifySentinelProductionRawBatch } from "./sentinel-production-raw-batch.js";

const roots: string[] = [];
const anchor = {
  expectedPreregistrationSha256: "1".repeat(64),
  expectedAuthorityId: "independent-authority",
  expectedAuthorityPublicKeySha256: "2".repeat(64),
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(): string {
  const value = mkdtempSync(resolve(realpathSync(tmpdir()), "sentinel-raw-batch-"));
  roots.push(value);
  return value;
}

describe("Sentinel production raw batch verifier", () => {
  it("fails closed without a complete signed raw batch", () => {
    const result = verifySentinelProductionRawBatch({ batchRoot: root(), trustAnchor: anchor });
    expect(result.valid).toBe(false);
    expect(result.rawComplete).toBe(false);
    expect(result.attemptTimeRawRootExternallyAnchored).toBe(false);
    expect(result.evidenceEligible).toBe(false);
    expect(result.analysis).toBeNull();
    expect(result.materialBenefit).toBe(false);
    expect(result.issues).not.toEqual([]);
  });

  it("cannot be promoted by caller-supplied outcome or materiality booleans", () => {
    const batchRoot = root();
    mkdirSync(resolve(batchRoot, "cells", "forged"), { recursive: true });
    writeFileSync(resolve(batchRoot, "cells", "forged", "results.json"), JSON.stringify({ success: true }));
    const result = verifySentinelProductionRawBatch({
      batchRoot,
      trustAnchor: anchor,
      success: true,
      rawComplete: true,
      materialBenefit: true,
    } as unknown as Parameters<typeof verifySentinelProductionRawBatch>[0]);
    expect(result.valid).toBe(false);
    expect(result.verifiedCellCount).toBe(0);
    expect(result.measurements).toEqual([]);
    expect(result.materialBenefit).toBe(false);
  });

  it("rejects symlink substitution at the retained input boundary", () => {
    const batchRoot = root();
    const outside = resolve(root(), "preregistration.json");
    writeFileSync(outside, "{}\n");
    mkdirSync(resolve(batchRoot, "inputs"), { recursive: true });
    symlinkSync(outside, resolve(batchRoot, "inputs", "preregistration.json"));
    const result = verifySentinelProductionRawBatch({ batchRoot, trustAnchor: anchor });
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/regular file/iu);
  });
});

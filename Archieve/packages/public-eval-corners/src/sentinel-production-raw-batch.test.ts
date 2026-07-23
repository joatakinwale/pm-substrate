import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SENTINEL_PRODUCTION_REPOSITORY,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
  type SentinelProductionPreregistration,
} from "./sentinel-production-plan.js";
import {
  verifySentinelProductionRawBatch,
  verifySentinelRawCheckoutPreflight,
} from "./sentinel-production-raw-batch.js";

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
  it("rejects a coherent all-arm rewrite that omits the signed ignored directory", () => {
    const ignoredListing = "frontend/node_modules/\0";
    const ignoredPathListingSha256 = sentinelProductionSha256(ignoredListing);
    const frontendInstalledTreeSha256 = "3".repeat(64);
    const plan = {
      benchmark: {
        repositoryUrl: SENTINEL_PRODUCTION_REPOSITORY,
        revision: SENTINEL_PRODUCTION_REVISION,
        sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
      },
      runtime: {
        upstream: {
          ignoredPathListingSha256,
          frontendInstalledTreeSha256,
          frontendPackageLockSha256: "4".repeat(64),
          serverRequirementsSha256: "5".repeat(64),
        },
      },
    } as SentinelProductionPreregistration;
    const arms = ["native", "sham", "plain-kv", "substrate"] as const;
    const preflights = Object.fromEntries(arms.map((arm) => {
      const body = {
        schemaVersion: "pm.public-eval-corners.sentinel-production-checkout-preflight.v2" as const,
        checkoutPath: `/checkouts/${arm}`,
        repositoryUrl: SENTINEL_PRODUCTION_REPOSITORY,
        revision: SENTINEL_PRODUCTION_REVISION,
        sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
        cleanTrackedAndUntracked: true,
        ignoredArtifactRootSha256: sentinelProductionJsonSha256({
          ignoredListingSha256: ignoredPathListingSha256,
          frontendInstalledTreeSha256,
        }),
        ignoredPathListingBase64: Buffer.from(ignoredListing, "utf8").toString("base64"),
        ignoredPathListingSha256,
        databaseRootSha256: "6".repeat(64),
        selectedScenarioRootSha256: "7".repeat(64),
        frontendInstalledTreeSha256,
        frontendPackageLockSha256: plan.runtime.upstream.frontendPackageLockSha256,
        serverRequirementsSha256: plan.runtime.upstream.serverRequirementsSha256,
        valid: true,
        issues: [] as readonly string[],
      };
      return [arm, { ...body, preflightSha256: sentinelProductionJsonSha256(body) }];
    }));
    for (const arm of arms) {
      expect(() => verifySentinelRawCheckoutPreflight(preflights[arm], plan, `${arm} preflight`))
        .not.toThrow();
    }
    for (const arm of arms) {
      const original = preflights[arm];
      const forgedIgnoredHash = sentinelProductionSha256("");
      const forgedBody = {
        ...original,
        ignoredPathListingBase64: "",
        ignoredPathListingSha256: forgedIgnoredHash,
        ignoredArtifactRootSha256: sentinelProductionJsonSha256({
          ignoredListingSha256: forgedIgnoredHash,
          frontendInstalledTreeSha256,
        }),
      };
      delete (forgedBody as { preflightSha256?: string }).preflightSha256;
      const forged = { ...forgedBody, preflightSha256: sentinelProductionJsonSha256(forgedBody) };
      expect(() => verifySentinelRawCheckoutPreflight(forged, plan, `${arm} preflight`))
        .toThrow(/signed runtime/iu);
    }
  });

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

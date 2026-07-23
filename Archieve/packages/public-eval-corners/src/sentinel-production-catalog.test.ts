import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
  SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  sentinelProductionFullTaskCatalogSha256,
  sentinelProductionTaskManifestSha256,
  type SentinelProductionTask,
} from "./sentinel-production-plan.js";
import {
  SENTINEL_POWERED_ENVIRONMENTS,
  assertSentinelCatalogReceipt,
  loadSentinelPoweredCatalog,
} from "./sentinel-production-catalog.js";

interface FrozenTask extends SentinelProductionTask {
  readonly scenarioRelativePath: string;
}

interface FrozenFixture {
  readonly schemaVersion: string;
  readonly revision: string;
  readonly sourceTreeHash: string;
  readonly manifestSha256: string;
  readonly fullCatalogSha256: string;
  readonly tasks: readonly FrozenTask[];
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(
  readFileSync(resolve(root, "fixtures", "sentinel-powered-catalog.json"), "utf8"),
) as FrozenFixture;
const tasks = fixture.tasks.map(({ scenarioRelativePath: _path, ...task }) => task);

describe("frozen Sentinel powered catalog", () => {
  it("binds the exact untouched five-environment 50-task public universe", () => {
    expect(fixture).toMatchObject({
      schemaVersion: "pm.public-eval-corners.sentinel-powered-catalog-fixture.v1",
      revision: SENTINEL_PRODUCTION_REVISION,
      sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
      manifestSha256: SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256,
      fullCatalogSha256: SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
    });
    expect(tasks).toHaveLength(50);
    expect(new Set(tasks.map(({ taskId }) => taskId))).toHaveLength(50);
    expect(sentinelProductionTaskManifestSha256(tasks)).toBe(fixture.manifestSha256);
    expect(sentinelProductionFullTaskCatalogSha256(tasks)).toBe(fixture.fullCatalogSha256);
    expect(new Set(tasks.map(({ environment }) => environment))).toEqual(
      new Set(SENTINEL_POWERED_ENVIRONMENTS),
    );
    for (const environment of SENTINEL_POWERED_ENVIRONMENTS) {
      expect(tasks.filter((task) => task.environment === environment)).toHaveLength(10);
    }
    expect(tasks.filter(({ role }) => role === "state-retention-relative")).toHaveLength(19);
    expect(tasks.filter(({ role }) => role === "expected-allow-absolute")).toHaveLength(21);
    expect(tasks.filter(({ role }) => role === "anti-degenerate-noop")).toHaveLength(10);
  });

  it("makes role, timing, taxonomy, and scenario-path tampering observable", () => {
    const first = tasks[0];
    if (first === undefined) throw new Error("fixture unexpectedly empty");
    const changedRole = first.role === "expected-allow-absolute"
      ? "state-retention-relative" as const
      : "expected-allow-absolute" as const;
    const relabeled = [{ ...first, role: changedRole }, ...tasks.slice(1)];
    expect(sentinelProductionTaskManifestSha256(relabeled)).toBe(fixture.manifestSha256);
    expect(sentinelProductionFullTaskCatalogSha256(relabeled)).not.toBe(fixture.fullCatalogSha256);
    expect(fixture.tasks.every(({ taskId, environment, scenarioRelativePath, scenarioSha256 }) =>
      scenarioRelativePath === `scenarios/${environment}/${taskId.slice(environment.length + 1)}.json` &&
      /^[a-f0-9]{64}$/u.test(scenarioSha256))).toBe(true);
  });

  it("contains no benchmark prompt, action recipe, condition SQL, or outcome", () => {
    const bytes = readFileSync(
      resolve(root, "fixtures", "sentinel-powered-catalog.json"),
      "utf8",
    );
    expect(bytes).not.toMatch(/"prompt"|"events"|"eval_sql"|"success"|"contact_message"/u);
  });
});

const pinnedCheckout = process.env["PM_SENTINEL_PINNED_CHECKOUT"];
const itWithPinnedCheckout = pinnedCheckout === undefined ? it.skip : it;

describe("Sentinel powered catalog source reconstruction", () => {
  itWithPinnedCheckout("reconstructs the frozen hashes from the exact clean upstream checkout", () => {
    const receipt = loadSentinelPoweredCatalog(pinnedCheckout!);
    expect(receipt.registrations.map(({ task }) => task)).toEqual(tasks);
    expect(() => assertSentinelCatalogReceipt(receipt)).not.toThrow();
  });
});

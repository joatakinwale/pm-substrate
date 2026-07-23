import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SENTINEL_POWER_CALCULATION_PROCEDURE,
  auditCurrentSentinelProductionPower,
  clopperPearsonLowerBound,
  createSentinelProductionPowerRedesignAudit,
  exactTwoControlPointGateProbability,
  sentinelPowerGuardrailsPass,
  sentinelPowerJsonSha256,
  verifySentinelProductionPowerRedesignAudit,
  type SentinelPowerGuardrails,
  type SentinelProductionPowerRedesignAudit,
} from "./sentinel-production-power-audit.js";

const MINI_CONFIGURATION = Object.freeze({
  trialsPerCell: 32,
  baselineGridPpm: Object.freeze([0, 350_000]),
  repeatIntraclassCorrelationSuitePpm: Object.freeze([0, 1_000_000]),
  simulationSeed: "sentinel-power-test-simulation-seed-v1",
  bootstrapSeed: "sentinel-power-test-bootstrap-seed-v1",
});

function miniArtifact(): SentinelProductionPowerRedesignAudit {
  return createSentinelProductionPowerRedesignAudit(MINI_CONFIGURATION);
}

describe("Sentinel production pre-outcome power audit", () => {
  it("retains the exact falsification of true lift equal to the ten-point claim threshold", () => {
    const audit = auditCurrentSentinelProductionPower();
    expect(audit).toMatchObject({
      status: "falsified-before-outcomes",
      observationsPerArm: 57,
      minimumSuccessCountDifference: 6,
      maximizingControlRateOnGrid: 0,
      maximumNecessaryGateProbabilityOnGrid: 0.511210781855188,
      targetFullProcedurePower: 0.8,
      targetMetAtAnyDeclaredBaseline: false,
    });
    expect(audit.auditSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("uses exact binomial necessary-gate probabilities and rejects invalid rates", () => {
    expect(exactTwoControlPointGateProbability({
      observationsPerArm: 1,
      controlRate: 0,
      trueLift: 1,
      minimumObservedLift: 1,
    })).toBe(1);
    expect(exactTwoControlPointGateProbability({
      observationsPerArm: 1,
      controlRate: 1,
      trueLift: 0,
      minimumObservedLift: 1,
    })).toBe(0);
    expect(() => exactTwoControlPointGateProbability({
      observationsPerArm: 57,
      controlRate: 0.95,
      trueLift: 0.1,
      minimumObservedLift: 0.1,
    })).toThrow(/invalid/u);
  });

  it("replays the full rule deterministically and keeps materiality separate from planning", () => {
    const first = miniArtifact();
    const second = miniArtifact();
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      authoritativeConfiguration: false,
      generatedWithoutBenchmarkOutcomes: true,
      estimandBoundary: {
        minimumObservedMaterialLiftOverEachControl: 0.1,
        planningAlternativeTrueLift: 0.35,
        planningAlternativeIsNotClaimThreshold: true,
      },
      simulation: {
        trialsPerCell: 32,
        cellsInConfidenceFamily: 4,
      },
      conclusions: {
        repeatDependenceBoundEstablishedByEvidence: false,
        poweredExecutionEligibleFromThisArtifactAlone: false,
      },
    });
    expect(first.results).toHaveLength(4);
    expect(first.results.map((cell) => ({
      id: cell.cellId,
      point: cell.pointLiftGatePasses,
      holm: cell.bothHolmRejectionsPasses,
      bootstrap: cell.bootstrapPositiveLowerBoundPasses,
      full: cell.fullDeclaredRulePasses,
    }))).toMatchInlineSnapshot(`
      [
        {
          "bootstrap": 32,
          "full": 32,
          "holm": 32,
          "id": "baseline-0000000-rho-0000000",
          "point": 32,
        },
        {
          "bootstrap": 32,
          "full": 32,
          "holm": 32,
          "id": "baseline-0350000-rho-0000000",
          "point": 32,
        },
        {
          "bootstrap": 32,
          "full": 21,
          "holm": 21,
          "id": "baseline-0000000-rho-1000000",
          "point": 32,
        },
        {
          "bootstrap": 15,
          "full": 9,
          "holm": 9,
          "id": "baseline-0350000-rho-1000000",
          "point": 30,
        },
      ]
    `);
    expect(verifySentinelProductionPowerRedesignAudit(first)).toEqual([]);
  });

  it("uses an exact-binomial lower bound rather than treating Monte Carlo frequency as truth", () => {
    const lower = clopperPearsonLowerBound(10, 10, 0.05);
    expect(lower).toBeLessThan(1);
    expect(lower).toBeCloseTo(0.05 ** (1 / 10), 10);
    expect(clopperPearsonLowerBound(0, 10, 0.05)).toBe(0);
    expect(() => clopperPearsonLowerBound(11, 10, 0.05)).toThrow(/invalid/u);
  });

  it("fails closed for every clean-control and evidence guardrail", () => {
    const clean: SentinelPowerGuardrails = {
      rawComplete: true,
      infrastructureComplete: true,
      economicsComplete: true,
      absoluteClean: true,
      noopClean: true,
    };
    expect(sentinelPowerGuardrailsPass(clean)).toBe(true);
    for (const key of Object.keys(clean) as (keyof SentinelPowerGuardrails)[]) {
      expect(sentinelPowerGuardrailsPass({ ...clean, [key]: false })).toBe(false);
    }
  });

  it("rejects assumption-grid omissions, duplicate rates, and outcome-incompatible baselines", () => {
    expect(() => createSentinelProductionPowerRedesignAudit({
      ...MINI_CONFIGURATION,
      repeatIntraclassCorrelationSuitePpm: [0, 250_000],
    })).toThrow(/perfect dependence/u);
    expect(() => createSentinelProductionPowerRedesignAudit({
      ...MINI_CONFIGURATION,
      baselineGridPpm: [0, 0],
    })).toThrow(/duplicates/u);
    expect(() => createSentinelProductionPowerRedesignAudit({
      ...MINI_CONFIGURATION,
      baselineGridPpm: [700_000],
    })).toThrow(/incompatible/u);
    expect(() => createSentinelProductionPowerRedesignAudit({
      ...MINI_CONFIGURATION,
      trialsPerCell: 31,
    })).toThrow(/32/u);
  });

  it("binds every claim to canonical artifact and procedure bytes", () => {
    const artifact = miniArtifact();
    const clone = structuredClone(artifact) as unknown as {
      auditSha256: string;
      procedureSha256: string;
      results: { fullDeclaredRulePasses: number }[];
    };
    clone.results[0]!.fullDeclaredRulePasses -= 1;
    expect(verifySentinelProductionPowerRedesignAudit(
      clone as unknown as SentinelProductionPowerRedesignAudit,
    )).toContain("audit hash does not match canonical bytes");
    expect(artifact.procedureSha256).toBe(sentinelPowerJsonSha256(SENTINEL_POWER_CALCULATION_PROCEDURE));

    const rehashed = structuredClone(artifact) as unknown as {
      auditSha256: string;
      conclusions: { minimumIndependentRepeatLowerBound: number };
    };
    rehashed.conclusions.minimumIndependentRepeatLowerBound = 1;
    const { auditSha256: _oldHash, ...rehashedBody } = rehashed;
    rehashed.auditSha256 = sentinelPowerJsonSha256(rehashedBody);
    expect(verifySentinelProductionPowerRedesignAudit(
      rehashed as unknown as SentinelProductionPowerRedesignAudit,
    )).toContain("derived power conclusions do not match cell-level conservative bounds");
  });

  it("is independently replayed by a Python-stdlib implementation", () => {
    const directory = mkdtempSync(join(tmpdir(), "sentinel-power-replay-"));
    try {
      const artifactPath = join(directory, "artifact.json");
      writeFileSync(artifactPath, `${JSON.stringify(miniArtifact())}\n`, "utf8");
      const verifier = fileURLToPath(new URL(
        "../scripts/sentinel-production-power-independent-verifier.py",
        import.meta.url,
      ));
      const result = spawnSync("python3", [verifier, artifactPath], {
        encoding: "utf8",
        timeout: 30_000,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        schemaVersion: "pm.public-eval-corners.sentinel-power-independent-verification.v1",
        implementation: "python-stdlib-independent-replay-v1",
        cellsReplayed: 4,
        valid: true,
        issues: [],
      });

      const tampered = structuredClone(miniArtifact()) as unknown as {
        auditSha256: string;
        conclusions: { minimumIndependentRepeatLowerBound: number };
      };
      tampered.conclusions.minimumIndependentRepeatLowerBound = 1;
      const { auditSha256: _oldHash, ...body } = tampered;
      tampered.auditSha256 = sentinelPowerJsonSha256(body);
      writeFileSync(artifactPath, `${JSON.stringify(tampered)}\n`, "utf8");
      const rejected = spawnSync("python3", [verifier, artifactPath], {
        encoding: "utf8",
        timeout: 30_000,
      });
      expect(rejected.status).toBe(1);
      expect(JSON.parse(rejected.stdout)).toMatchObject({
        valid: false,
        issues: ["derived conclusion is false: minimumIndependentRepeatLowerBound"],
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 35_000);

  it("retains the authoritative no-outcome artifact with exact file and claim hashes", () => {
    const fixture = fileURLToPath(new URL(
      "../fixtures/sentinel-production-power-redesign-v2.json",
      import.meta.url,
    ));
    const bytes = readFileSync(fixture);
    const artifact = JSON.parse(bytes.toString("utf8")) as SentinelProductionPowerRedesignAudit;
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "53c15428eb4a4dfe7f188f040ae9f36766960fa9d1085e543bbdecc69e82950e",
    );
    expect(artifact).toMatchObject({
      authoritativeConfiguration: true,
      auditSha256: "9c5a9bc60bd17c4e49609eaac35fbe38803dee7941362f14cc036a508e206521",
      procedureSha256: "c8938b9a73cd2ea7a04f45df54692cba3266605c33486b06eb387b9f77fbc6a7",
      conclusions: {
        minimumIndependentRepeatLowerBound: 0.919009775703305,
        minimumListedZeroAndPointOneIccLowerBound: 0.870488731978417,
        minimumAllSensitivityLowerBound: 0.326704619074728,
        poweredExecutionEligibleFromThisArtifactAlone: false,
      },
    });
    expect(verifySentinelProductionPowerRedesignAudit(artifact)).toEqual([]);

    const receiptPath = fileURLToPath(new URL(
      "../fixtures/sentinel-production-power-independent-verification-v1.json",
      import.meta.url,
    ));
    const receiptBytes = readFileSync(receiptPath);
    expect(createHash("sha256").update(receiptBytes).digest("hex")).toBe(
      "bea82b260c0ac04b6c99ee14cb77c924c1e31c887fb62c45845b312b7cb26bfd",
    );
    expect(JSON.parse(receiptBytes.toString("utf8"))).toMatchObject({
      artifactAuditSha256: artifact.auditSha256,
      artifactFileSha256: "53c15428eb4a4dfe7f188f040ae9f36766960fa9d1085e543bbdecc69e82950e",
      cellsReplayed: 56,
      issues: [],
      procedureSha256: artifact.procedureSha256,
      valid: true,
      verifierSourceSha256: "71ac01acfa81668e73393b492e30b8011fa9c220fb2e5d3bafa111a591d5d7ff",
    });
  });
});

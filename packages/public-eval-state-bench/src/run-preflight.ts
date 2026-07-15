import { verifyPublicEvalPreregistrationForExecution } from "@pm/public-eval-analysis";

import type { StateBenchDecisionManifestBridge } from "./decision-manifest.js";
import type { StateBenchRunConfig } from "./execution-plan.js";
import type { StateBenchQualificationPlan } from "./qualification-plan.js";
import type { StateBenchRunBindingVerification } from "./run-binding.js";

export interface StateBenchExecutionPreflightResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly phase: StateBenchRunConfig["phase"] | null;
  readonly authorityStatus:
    | "technical_qualification_ineligible"
    | "externally_preregistered_execution_ready"
    | "not_ready";
  readonly qualificationPlanHash: string | null;
  readonly analysisManifestHash: string | null;
  readonly preregistrationReceiptHash: string | null;
  readonly trustPolicyHash: string | null;
}

interface StateBenchExecutionPreflightDependencies {
  readonly parseRunConfig: (value: unknown) => StateBenchRunConfig;
  readonly loadQualificationPlan: (
    checkoutPath: string,
    value: unknown,
  ) => StateBenchQualificationPlan;
  readonly loadDecisionManifestBridge: (
    checkoutPath: string,
    qualificationPlanValue: unknown,
    value: unknown,
  ) => StateBenchDecisionManifestBridge;
  readonly verifyBoundRunConfig: (
    checkoutPath: string,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    value: unknown,
  ) => StateBenchRunBindingVerification;
}

export function createStateBenchExecutionPreflight(
  dependencies: StateBenchExecutionPreflightDependencies,
) {
  const {
    parseRunConfig,
    loadQualificationPlan,
    loadDecisionManifestBridge,
    verifyBoundRunConfig,
  } = dependencies;

  function preflight(
    checkoutPath: string,
    runConfigValue: unknown,
    qualificationPlanValue: unknown,
    decisionBridgeValue: unknown | null,
    preregistrationReceiptValue: unknown | null,
    trustPolicyValue: unknown | null,
    expectedTrustPolicyHash: string | null,
  ): StateBenchExecutionPreflightResult {
    try {
      const config = parseRunConfig(runConfigValue);
      const qualification = loadQualificationPlan(
        checkoutPath,
        qualificationPlanValue,
      );
      const binding = verifyBoundRunConfig(
        checkoutPath,
        qualification,
        decisionBridgeValue,
        config,
      );
      if (!binding.valid) throw new Error(binding.issues.join("; "));
      if (config.phase === "qualification") {
        if (
          decisionBridgeValue !== null ||
          preregistrationReceiptValue !== null ||
          trustPolicyValue !== null ||
          expectedTrustPolicyHash !== null
        ) {
          throw new Error("qualification preflight forbids decision authority inputs");
        }
        return {
          valid: true,
          issues: [],
          phase: config.phase,
          authorityStatus: "technical_qualification_ineligible",
          qualificationPlanHash: qualification.planHash,
          analysisManifestHash: null,
          preregistrationReceiptHash: null,
          trustPolicyHash: null,
        };
      }
      if (
        decisionBridgeValue === null ||
        preregistrationReceiptValue === null ||
        trustPolicyValue === null ||
        expectedTrustPolicyHash === null
      ) {
        throw new Error(
          "decision preflight requires manifest bridge, preregistration receipt, trust policy, and out-of-band expected policy hash",
        );
      }
      const bridge = loadDecisionManifestBridge(
        checkoutPath,
        qualification,
        decisionBridgeValue,
      );
      const preregistration = verifyPublicEvalPreregistrationForExecution(
        bridge.analysisManifest,
        preregistrationReceiptValue,
        trustPolicyValue,
        expectedTrustPolicyHash,
      );
      if (!preregistration.valid) {
        throw new Error(preregistration.issues.join("; "));
      }
      if (config.preregistrationReceiptHash !== preregistration.receiptHash) {
        throw new Error("run config does not bind the verified preregistration receipt");
      }
      return {
        valid: true,
        issues: [],
        phase: config.phase,
        authorityStatus: "externally_preregistered_execution_ready",
        qualificationPlanHash: qualification.planHash,
        analysisManifestHash: bridge.analysisManifest.manifestHash,
        preregistrationReceiptHash: preregistration.receiptHash,
        trustPolicyHash: preregistration.policyHash,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [error instanceof Error ? error.message : String(error)],
        phase: null,
        authorityStatus: "not_ready",
        qualificationPlanHash: null,
        analysisManifestHash: null,
        preregistrationReceiptHash: null,
        trustPolicyHash: null,
      };
    }
  }

  return Object.freeze({ preflight });
}

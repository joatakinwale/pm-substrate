import {
  buildMarketingAxisBCorePairedScenarios,
  buildMarketingAxisBLiveIntegrationSuite,
  buildThreeAxisProofPacket,
  type EvalEvent,
  type FailureClass,
  type ThreeAxisProofPacket,
  type ThreeAxisProofPacketSource,
} from "@pm/evals";
import type { StateRef } from "@pm/agent-state";
import type { TenantId, Timestamp } from "@pm/types";

import {
  buildPluggedInSocialAxisBNextActionAdapterResult,
  type PluggedInSocialAxisBNextActionAdapterResult,
  type PluggedInSocialClientReportSnapshot,
} from "./plugged-in-social-axis-b-adapter.js";
import {
  PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES,
  readPluggedInSocialSourceManifest,
  type PluggedInSocialClosedLoopStage,
  type PluggedInSocialGovernanceGate,
  type PluggedInSocialSourceManifest,
} from "./plugged-in-social-manifest.js";

export type { PluggedInSocialClientReportSnapshot };

export interface PluggedInSocialIntegrationAuditInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly report: PluggedInSocialClientReportSnapshot;
  readonly stateReviewArtifactHash: string;
  readonly workspaceRoot?: string;
  readonly sourcePath?: string;
  readonly manifest?: PluggedInSocialSourceManifest;
  readonly maxEvidenceAgeMs?: number;
}

export interface PluggedInSocialIntegrationAuditArm {
  readonly governed: boolean;
  readonly evidenceModel: string;
  readonly terminalPolicy: string;
  readonly failureClassesCovered: readonly FailureClass[];
}

export interface PluggedInSocialSubstrateAuditArm
  extends PluggedInSocialIntegrationAuditArm {
  readonly requiredGovernanceGates: readonly PluggedInSocialGovernanceGate[];
  readonly verifiedFailureClasses: readonly FailureClass[];
  readonly evidenceRefs: readonly string[];
  readonly substrateRefs: readonly string[];
}

export interface PluggedInSocialAxisBAuditSummary {
  readonly source: ThreeAxisProofPacketSource;
  readonly events: readonly EvalEvent[];
  readonly proofPacket: ThreeAxisProofPacket;
}

export interface PluggedInSocialIntegrationAudit {
  readonly sourceId: "plugged_in_social";
  readonly sourcePath: string;
  readonly ready: boolean;
  readonly blockers: readonly string[];
  readonly manifest: PluggedInSocialSourceManifest;
  readonly closedLoopStages: readonly PluggedInSocialClosedLoopStage[];
  readonly nextActionAdapter: PluggedInSocialAxisBNextActionAdapterResult;
  readonly axisB: PluggedInSocialAxisBAuditSummary;
  readonly withoutSubstrate: PluggedInSocialIntegrationAuditArm;
  readonly withSubstrate: PluggedInSocialSubstrateAuditArm;
}

export function buildPluggedInSocialIntegrationAudit(
  input: PluggedInSocialIntegrationAuditInput,
): PluggedInSocialIntegrationAudit {
  const manifest =
    input.manifest ??
    readPluggedInSocialSourceManifest({
      ...(input.workspaceRoot === undefined
        ? {}
        : { workspaceRoot: input.workspaceRoot }),
      ...(input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath }),
    });
  const nextActionAdapter = buildPluggedInSocialAxisBNextActionAdapterResult({
    tenantId: input.tenantId,
    report: input.report,
    decidedAt: input.observedAt,
    stateReviewArtifactHash: input.stateReviewArtifactHash,
    manifest,
    ...(input.workspaceRoot === undefined
      ? {}
      : { workspaceRoot: input.workspaceRoot }),
    ...(input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath }),
    ...(input.maxEvidenceAgeMs === undefined
      ? {}
      : { maxEvidenceAgeMs: input.maxEvidenceAgeMs }),
  });
  const pairedScenarios = buildMarketingAxisBCorePairedScenarios({
    tenantId: input.tenantId,
    observedAt: input.observedAt,
    evidenceRefs: nextActionAdapter.evidenceRefs,
    substrateRefs: nextActionAdapter.substrateRefs,
  });
  const suite = buildMarketingAxisBLiveIntegrationSuite({
    tenantId: input.tenantId,
    observedAt: input.observedAt,
    manifest,
    nextActionAdapterResult: nextActionAdapter,
    pairedScenarios,
  });
  const proofPacket = buildThreeAxisProofPacket({
    generatedAt: input.observedAt,
    events: suite.events,
    sources: [suite.source],
  });
  const marketingCoverage = proofPacket.report.byAxis.marketing;
  const blockers = auditBlockers({
    manifest,
    nextActionAdapter,
    proofPacket,
  });

  return {
    sourceId: "plugged_in_social",
    sourcePath: manifest.sourcePath,
    ready: blockers.length === 0,
    blockers,
    manifest,
    closedLoopStages: manifest.closedLoopStages,
    nextActionAdapter,
    axisB: {
      source: suite.source,
      events: suite.events,
      proofPacket,
    },
    withoutSubstrate: {
      governed: false,
      evidenceModel: "prompt_or_local_application_state",
      terminalPolicy: "ungoverned_marketing_operations",
      failureClassesCovered: [],
    },
    withSubstrate: {
      governed: true,
      evidenceModel: "durable_source_manifest_and_action_outcome_envelopes",
      terminalPolicy:
        "tenant_capability_approval_content_hash_and_freshness_gated",
      failureClassesCovered: marketingCoverage.coveredFailureClasses,
      requiredGovernanceGates: PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES,
      verifiedFailureClasses: marketingCoverage.verifiedFailureClasses,
      evidenceRefs: uniqueIds([
        ...nextActionAdapter.evidenceRefs,
        ...manifest.evidenceRefs,
      ]),
      substrateRefs: uniqueIds([
        ...nextActionAdapter.substrateRefs,
        ...manifest.substrateRefs,
      ]),
    },
  };
}

function auditBlockers(input: {
  readonly manifest: PluggedInSocialSourceManifest;
  readonly nextActionAdapter: PluggedInSocialAxisBNextActionAdapterResult;
  readonly proofPacket: ThreeAxisProofPacket;
}): readonly string[] {
  const blockers = new Set<string>();

  for (const missing of input.manifest.readiness.missing) {
    blockers.add(missing);
  }
  for (const stage of input.manifest.closedLoopStages) {
    if (!stage.present) {
      blockers.add(`closed-loop stage incomplete: ${stage.stage}`);
    }
  }
  for (const issue of input.nextActionAdapter.issues) {
    blockers.add(issue);
  }
  const marketingCoverage = input.proofPacket.report.byAxis.marketing;
  if (!marketingCoverage.verified) {
    blockers.add(
      `marketing Axis B coverage incomplete: ${marketingCoverage.unverifiedFailureClasses.join(", ")}`,
    );
  }

  return [...blockers].sort();
}

function uniqueIds(refs: readonly Pick<StateRef, "id">[]): readonly string[] {
  return [...new Set(refs.map((ref) => ref.id))].sort();
}

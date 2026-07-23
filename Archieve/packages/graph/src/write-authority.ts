import type { Timestamp } from "@pm/types";

export interface GraphWriteProviderCertificateStatusRef {
  readonly certificateId: string;
  readonly certificateDigest: string;
  readonly status: "valid" | "revoked" | "superseded";
  readonly statusSequence: number;
  readonly statusEventHash: string;
  readonly statusUpdatedAt: Timestamp | string;
  readonly checkedAt: Timestamp | string;
}

export interface GraphWriteProjectionReplayRef {
  readonly certificateId: string;
  readonly certificateHash: string;
  readonly projectionName: string;
  readonly projectionVersion: number;
  readonly authorityScope: string;
  readonly replayedToPosition: number;
  readonly transitionHistoryHash: string;
  readonly projectionHash: string;
  readonly certificateStoreSequence?: number;
  readonly certificateStoreEntryHash?: string;
  readonly certificateStoreRootHash?: string;
  readonly checkedAt: Timestamp | string;
}

export interface GraphWriteProjectionReplayRootSettlementRef {
  readonly rootSequence: number;
  readonly rootHash: string;
  readonly settlementSequence: number;
  readonly settlementStatus: "settled";
  readonly settlementHash: string;
  readonly settlementRecordHash: string;
  readonly authorityTopologyHash?: string;
  readonly checkedAt: Timestamp | string;
}

export interface GraphWriteAuthorityRef {
  readonly authorityKind: "workflow_action_outcome_envelope";
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: "accepted";
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: GraphWriteProviderCertificateStatusRef;
  readonly projectionReplayRef?: GraphWriteProjectionReplayRef;
  readonly projectionReplayRootSettlementRef?: GraphWriteProjectionReplayRootSettlementRef;
}

export interface GraphWriteAuthoritySubstrateRecord {
  readonly authorityKind: "workflow_action_outcome_envelope";
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: "accepted" | "blocked" | "rejected" | "held";
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: GraphWriteProviderCertificateStatusRef;
  readonly projectionReplayRef?: GraphWriteProjectionReplayRef;
  readonly projectionReplayRootSettlementRef?: GraphWriteProjectionReplayRootSettlementRef;
}

export interface GraphWriteAuthorityPolicy {
  readonly requireAuthorityRef?: boolean;
  readonly requireProviderCertificateStatusRef?: boolean;
  readonly requireSubstrateRecord?: boolean;
  readonly requireProjectionReplayRef?: boolean;
  readonly requireProjectionReplayRootSettlementRef?: boolean;
  readonly expectedProjectionName?: string;
  readonly expectedProjectionVersion?: number;
  readonly expectedProjectionReplayAuthorityScope?: string;
  readonly minimumProjectionReplayPosition?: number;
}

export type GraphWriteAuthorityIssueCode =
  | "graph_write_authority_missing"
  | "graph_write_authority_not_accepted"
  | "graph_write_authority_envelope_missing"
  | "graph_write_provider_certificate_status_ref_missing"
  | "graph_write_provider_certificate_status_ref_mismatch"
  | "graph_write_projection_replay_ref_missing"
  | "graph_write_projection_replay_ref_invalid"
  | "graph_write_projection_replay_ref_mismatch"
  | "graph_write_projection_replay_ref_stale"
  | "graph_write_projection_replay_root_settlement_ref_missing"
  | "graph_write_projection_replay_root_settlement_ref_invalid"
  | "graph_write_projection_replay_root_settlement_ref_mismatch"
  | "graph_write_authority_substrate_record_missing"
  | "graph_write_authority_substrate_record_mismatch";

export interface GraphWriteAuthorityIssue {
  readonly code: GraphWriteAuthorityIssueCode;
  readonly path: string;
  readonly message: string;
}

export class GraphWriteAuthorityError extends Error {
  readonly issues: readonly GraphWriteAuthorityIssue[];

  constructor(issues: readonly GraphWriteAuthorityIssue[]) {
    super(
      `graph write authority rejected: ${issues
        .map((issue) => issue.code)
        .join(", ")}`,
    );
    this.name = "GraphWriteAuthorityError";
    this.issues = issues;
  }
}

export const validateGraphWriteAuthority = (input: {
  readonly authorityRef?: GraphWriteAuthorityRef;
  readonly substrateRecord?: GraphWriteAuthoritySubstrateRecord;
  readonly policy?: GraphWriteAuthorityPolicy;
}): readonly GraphWriteAuthorityIssue[] => {
  const policy = input.policy ?? {};
  if (
    !policy.requireAuthorityRef &&
    !policy.requireProviderCertificateStatusRef &&
    !policy.requireSubstrateRecord &&
    !policy.requireProjectionReplayRef &&
    !policy.requireProjectionReplayRootSettlementRef
  ) {
    return [];
  }

  const authority = input.authorityRef;
  const issues: GraphWriteAuthorityIssue[] = [];
  if (authority === undefined) {
    issues.push({
      code: "graph_write_authority_missing",
      path: "/writeAuthorityRef",
      message: "graph write requires an accepted action outcome authority ref",
    });
    return issues;
  }

  if (authority.terminalOutcome !== "accepted") {
    issues.push({
      code: "graph_write_authority_not_accepted",
      path: "/writeAuthorityRef/terminalOutcome",
      message: "graph write authority ref must cite an accepted terminal outcome",
    });
  }
  if (authority.envelopeId.trim() === "" || authority.actionId.trim() === "") {
    issues.push({
      code: "graph_write_authority_envelope_missing",
      path: "/writeAuthorityRef",
      message: "graph write authority ref requires envelopeId and actionId",
    });
  }

  if (policy.requireProviderCertificateStatusRef) {
    const statusRef = authority.providerCertificateStatusRef;
    if (statusRef === undefined) {
      issues.push({
        code: "graph_write_provider_certificate_status_ref_missing",
        path: "/writeAuthorityRef/providerCertificateStatusRef",
        message:
          "graph write authority ref requires the provider certificate status event used at dispatch",
      });
      return issues;
    }

    if (
      authority.providerCertificateId !== undefined &&
      authority.providerCertificateId !== statusRef.certificateId
    ) {
      issues.push({
        code: "graph_write_provider_certificate_status_ref_mismatch",
        path: "/writeAuthorityRef/providerCertificateStatusRef/certificateId",
        message:
          "graph write provider certificate status ref does not match providerCertificateId",
      });
    }
    if (
      authority.providerCertificateDigest !== undefined &&
      authority.providerCertificateDigest !== statusRef.certificateDigest
    ) {
      issues.push({
        code: "graph_write_provider_certificate_status_ref_mismatch",
        path: "/writeAuthorityRef/providerCertificateStatusRef/certificateDigest",
        message:
          "graph write provider certificate status ref does not match providerCertificateDigest",
      });
    }
    if (statusRef.status !== "valid") {
      issues.push({
        code: "graph_write_provider_certificate_status_ref_mismatch",
        path: "/writeAuthorityRef/providerCertificateStatusRef/status",
        message: "graph write provider certificate status ref must be valid",
      });
    }
    if (
      !Number.isInteger(statusRef.statusSequence) ||
      statusRef.statusSequence <= 0 ||
      statusRef.statusEventHash.trim() === "" ||
      statusRef.statusUpdatedAt.trim() === "" ||
      statusRef.checkedAt.trim() === ""
    ) {
      issues.push({
        code: "graph_write_provider_certificate_status_ref_mismatch",
        path: "/writeAuthorityRef/providerCertificateStatusRef",
        message:
          "graph write provider certificate status ref requires sequence, event hash, statusUpdatedAt, and checkedAt",
      });
    }
  }

  if (policy.requireProjectionReplayRef) {
    const replayRef = authority.projectionReplayRef;
    if (replayRef === undefined) {
      issues.push({
        code: "graph_write_projection_replay_ref_missing",
        path: "/writeAuthorityRef/projectionReplayRef",
        message:
          "graph write authority requires a projection replay certificate ref",
      });
      return issues;
    }

    if (
      replayRef.certificateId.trim() === "" ||
      replayRef.certificateHash.trim() === "" ||
      replayRef.transitionHistoryHash.trim() === "" ||
      replayRef.projectionHash.trim() === "" ||
      (replayRef.certificateStoreEntryHash !== undefined &&
        replayRef.certificateStoreEntryHash.trim() === "") ||
      (replayRef.certificateStoreRootHash !== undefined &&
        replayRef.certificateStoreRootHash.trim() === "") ||
      (replayRef.certificateStoreSequence !== undefined &&
        (!Number.isInteger(replayRef.certificateStoreSequence) ||
          replayRef.certificateStoreSequence <= 0)) ||
      replayRef.checkedAt.trim() === ""
    ) {
      issues.push({
        code: "graph_write_projection_replay_ref_invalid",
        path: "/writeAuthorityRef/projectionReplayRef",
        message:
          "graph write projection replay ref requires certificate id/hash, transition history hash, projection hash, and checkedAt",
      });
    }
    if (
      replayRef.projectionName.trim() === "" ||
      replayRef.authorityScope.trim() === "" ||
      !Number.isInteger(replayRef.projectionVersion) ||
      replayRef.projectionVersion < 0 ||
      !Number.isInteger(replayRef.replayedToPosition) ||
      replayRef.replayedToPosition < 0
    ) {
      issues.push({
        code: "graph_write_projection_replay_ref_invalid",
        path: "/writeAuthorityRef/projectionReplayRef",
        message:
          "graph write projection replay ref requires projection name, version, authority scope, and non-negative replay position",
      });
    }
    if (
      policy.expectedProjectionName !== undefined &&
      replayRef.projectionName !== policy.expectedProjectionName
    ) {
      issues.push({
        code: "graph_write_projection_replay_ref_mismatch",
        path: "/writeAuthorityRef/projectionReplayRef/projectionName",
        message:
          "graph write projection replay ref does not match expected projection name",
      });
    }
    if (
      policy.expectedProjectionVersion !== undefined &&
      replayRef.projectionVersion !== policy.expectedProjectionVersion
    ) {
      issues.push({
        code: "graph_write_projection_replay_ref_mismatch",
        path: "/writeAuthorityRef/projectionReplayRef/projectionVersion",
        message:
          "graph write projection replay ref does not match expected projection version",
      });
    }
    if (
      policy.expectedProjectionReplayAuthorityScope !== undefined &&
      replayRef.authorityScope !== policy.expectedProjectionReplayAuthorityScope
    ) {
      issues.push({
        code: "graph_write_projection_replay_ref_mismatch",
        path: "/writeAuthorityRef/projectionReplayRef/authorityScope",
        message:
          "graph write projection replay ref does not match expected authority scope",
      });
    }
    if (
      policy.minimumProjectionReplayPosition !== undefined &&
      replayRef.replayedToPosition < policy.minimumProjectionReplayPosition
    ) {
      issues.push({
        code: "graph_write_projection_replay_ref_stale",
        path: "/writeAuthorityRef/projectionReplayRef/replayedToPosition",
        message:
          "graph write projection replay ref is behind the required replay position",
      });
    }
  }

  if (policy.requireProjectionReplayRootSettlementRef) {
    const replayRef = authority.projectionReplayRef;
    const settlementRef = authority.projectionReplayRootSettlementRef;
    if (replayRef === undefined) {
      issues.push({
        code: "graph_write_projection_replay_ref_missing",
        path: "/writeAuthorityRef/projectionReplayRef",
        message:
          "graph write authority requires a projection replay certificate ref before a settled-root ref can authorize mutation",
      });
    }
    if (settlementRef === undefined) {
      issues.push({
        code: "graph_write_projection_replay_root_settlement_ref_missing",
        path: "/writeAuthorityRef/projectionReplayRootSettlementRef",
        message:
          "graph write authority requires a durable settled-root certificate ref",
      });
      return issues;
    }

    if (
      !Number.isInteger(settlementRef.rootSequence) ||
      settlementRef.rootSequence <= 0 ||
      settlementRef.rootHash.trim() === "" ||
      !Number.isInteger(settlementRef.settlementSequence) ||
      settlementRef.settlementSequence <= 0 ||
      settlementRef.settlementStatus !== "settled" ||
      settlementRef.settlementHash.trim() === "" ||
      settlementRef.settlementRecordHash.trim() === "" ||
      (settlementRef.authorityTopologyHash !== undefined &&
        settlementRef.authorityTopologyHash.trim() === "") ||
      settlementRef.checkedAt.trim() === ""
    ) {
      issues.push({
        code: "graph_write_projection_replay_root_settlement_ref_invalid",
        path: "/writeAuthorityRef/projectionReplayRootSettlementRef",
        message:
          "graph write settled-root ref requires settled status, root sequence/hash, settlement sequence/hash, record hash, and checkedAt",
      });
    }
    if (
      replayRef !== undefined &&
      (replayRef.certificateStoreSequence !== settlementRef.rootSequence ||
        replayRef.certificateStoreRootHash !== settlementRef.rootHash)
    ) {
      issues.push({
        code: "graph_write_projection_replay_root_settlement_ref_mismatch",
        path: "/writeAuthorityRef/projectionReplayRootSettlementRef/root",
        message:
          "graph write settled-root ref must match the projection replay certificate-store root commitment",
      });
    }
  }

  if (!policy.requireSubstrateRecord) return issues;

  const substrateRecord = input.substrateRecord;
  if (substrateRecord === undefined) {
    issues.push({
      code: "graph_write_authority_substrate_record_missing",
      path: "/writeAuthoritySubstrateRecord",
      message:
        "graph write authority requires a substrate record for the cited action outcome envelope",
    });
    return issues;
  }

  if (
    substrateRecord.authorityKind !== authority.authorityKind ||
    substrateRecord.envelopeId !== authority.envelopeId ||
    substrateRecord.actionId !== authority.actionId ||
    substrateRecord.terminalOutcome !== "accepted"
  ) {
    issues.push({
      code: "graph_write_authority_substrate_record_mismatch",
      path: "/writeAuthoritySubstrateRecord",
      message:
        "graph write authority substrate record must match the cited accepted envelope/action",
    });
  }
  if (
    authority.providerCertificateId !== undefined &&
    substrateRecord.providerCertificateId !== authority.providerCertificateId
  ) {
    issues.push({
      code: "graph_write_authority_substrate_record_mismatch",
      path: "/writeAuthoritySubstrateRecord/providerCertificateId",
      message:
        "graph write authority substrate record does not match providerCertificateId",
    });
  }
  if (
    authority.providerCertificateDigest !== undefined &&
    substrateRecord.providerCertificateDigest !== authority.providerCertificateDigest
  ) {
    issues.push({
      code: "graph_write_authority_substrate_record_mismatch",
      path: "/writeAuthoritySubstrateRecord/providerCertificateDigest",
      message:
        "graph write authority substrate record does not match providerCertificateDigest",
    });
  }
  if (
    policy.requireProviderCertificateStatusRef &&
    !sameProviderStatusRef(
      substrateRecord.providerCertificateStatusRef,
      authority.providerCertificateStatusRef,
    )
  ) {
    issues.push({
      code: "graph_write_authority_substrate_record_mismatch",
      path: "/writeAuthoritySubstrateRecord/providerCertificateStatusRef",
      message:
        "graph write authority substrate record does not match providerCertificateStatusRef",
    });
  }
  if (
    policy.requireProjectionReplayRef &&
    !sameProjectionReplayRef(
      substrateRecord.projectionReplayRef,
      authority.projectionReplayRef,
    )
  ) {
    issues.push({
      code: "graph_write_authority_substrate_record_mismatch",
      path: "/writeAuthoritySubstrateRecord/projectionReplayRef",
      message:
        "graph write authority substrate record does not match projectionReplayRef",
    });
  }
  if (
    policy.requireProjectionReplayRootSettlementRef &&
    !sameProjectionReplayRootSettlementRef(
      substrateRecord.projectionReplayRootSettlementRef,
      authority.projectionReplayRootSettlementRef,
    )
  ) {
    issues.push({
      code: "graph_write_authority_substrate_record_mismatch",
      path: "/writeAuthoritySubstrateRecord/projectionReplayRootSettlementRef",
      message:
        "graph write authority substrate record does not match projectionReplayRootSettlementRef",
    });
  }

  return issues;
};

export const assertGraphWriteAuthority = (input: {
  readonly authorityRef?: GraphWriteAuthorityRef;
  readonly substrateRecord?: GraphWriteAuthoritySubstrateRecord;
  readonly policy?: GraphWriteAuthorityPolicy;
}): void => {
  const issues = validateGraphWriteAuthority(input);
  if (issues.length > 0) throw new GraphWriteAuthorityError(issues);
};

const sameProviderStatusRef = (
  a: GraphWriteProviderCertificateStatusRef | undefined,
  b: GraphWriteProviderCertificateStatusRef | undefined,
): boolean =>
  a !== undefined &&
  b !== undefined &&
  a.certificateId === b.certificateId &&
  a.certificateDigest === b.certificateDigest &&
  a.status === b.status &&
  a.statusSequence === b.statusSequence &&
  a.statusEventHash === b.statusEventHash &&
  a.statusUpdatedAt === b.statusUpdatedAt &&
  a.checkedAt === b.checkedAt;

const sameProjectionReplayRef = (
  a: GraphWriteProjectionReplayRef | undefined,
  b: GraphWriteProjectionReplayRef | undefined,
): boolean =>
  a !== undefined &&
  b !== undefined &&
  a.certificateId === b.certificateId &&
  a.certificateHash === b.certificateHash &&
  a.projectionName === b.projectionName &&
  a.projectionVersion === b.projectionVersion &&
  a.authorityScope === b.authorityScope &&
  a.replayedToPosition === b.replayedToPosition &&
  a.transitionHistoryHash === b.transitionHistoryHash &&
  a.projectionHash === b.projectionHash &&
  a.certificateStoreSequence === b.certificateStoreSequence &&
  a.certificateStoreEntryHash === b.certificateStoreEntryHash &&
  a.certificateStoreRootHash === b.certificateStoreRootHash &&
  a.checkedAt === b.checkedAt;

const sameProjectionReplayRootSettlementRef = (
  a: GraphWriteProjectionReplayRootSettlementRef | undefined,
  b: GraphWriteProjectionReplayRootSettlementRef | undefined,
): boolean =>
  a !== undefined &&
  b !== undefined &&
  a.rootSequence === b.rootSequence &&
  a.rootHash === b.rootHash &&
  a.settlementSequence === b.settlementSequence &&
  a.settlementStatus === b.settlementStatus &&
  a.settlementHash === b.settlementHash &&
  a.settlementRecordHash === b.settlementRecordHash &&
  a.authorityTopologyHash === b.authorityTopologyHash &&
  a.checkedAt === b.checkedAt;

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

export interface GraphWriteAuthorityRef {
  readonly authorityKind: "workflow_action_outcome_envelope";
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: "accepted";
  readonly providerCertificateId?: string;
  readonly providerCertificateDigest?: string;
  readonly providerCertificateStatusRef?: GraphWriteProviderCertificateStatusRef;
}

export interface GraphWriteAuthorityPolicy {
  readonly requireAuthorityRef?: boolean;
  readonly requireProviderCertificateStatusRef?: boolean;
}

export type GraphWriteAuthorityIssueCode =
  | "graph_write_authority_missing"
  | "graph_write_authority_not_accepted"
  | "graph_write_authority_envelope_missing"
  | "graph_write_provider_certificate_status_ref_missing"
  | "graph_write_provider_certificate_status_ref_mismatch";

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
  readonly policy?: GraphWriteAuthorityPolicy;
}): readonly GraphWriteAuthorityIssue[] => {
  const policy = input.policy ?? {};
  if (!policy.requireAuthorityRef && !policy.requireProviderCertificateStatusRef) {
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

  if (!policy.requireProviderCertificateStatusRef) return issues;

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

  return issues;
};

export const assertGraphWriteAuthority = (input: {
  readonly authorityRef?: GraphWriteAuthorityRef;
  readonly policy?: GraphWriteAuthorityPolicy;
}): void => {
  const issues = validateGraphWriteAuthority(input);
  if (issues.length > 0) throw new GraphWriteAuthorityError(issues);
};

import { createHash } from "node:crypto";

import type {
  CapabilityId,
  EmitDecl,
  EmitContract,
  ReadDecl,
  ReadContract,
  SubscribeDecl,
  SubscribeContract,
  TenantId,
  TerminalAdmissionProviderCertificate,
  TerminalAdmissionProviderCertificateStatus,
  TerminalAdmissionProviderManifest,
  TerminalAdmissionProviderRef,
  Timestamp,
  WriteDecl,
  WriteContract,
} from "@pm/types";
import {
  isEmitContract,
  isSubscribeContract,
  isReadContract,
  isWriteContract,
} from "@pm/types";

/**
 * A registered capability. Tools register declaratively at install time;
 * the substrate uses these declarations to (a) validate workflows reference
 * existing capabilities and (b) wire SubscriptionRouter automatically.
 *
 * G6 / ADR-0013 migration window:
 *   `emits`, `subscribesTo`, `readsInterfaces`, `writesInterfaces` accept
 *   both legacy (string) and typed (contract object) entries. The registry
 *   stores them verbatim in JSONB. The workflow installer normalizes via
 *   `normalizeCapability()` before validating compatibility.
 *
 *   After ADR-0013 sequencing step 4, the V1 string forms are removed.
 */
export interface Capability {
  readonly id: CapabilityId;

  /** Stable name, globally unique. Convention: "<profile>/<role>" or "common/<role>". */
  readonly name: string;
  readonly version: number;

  /**
   * Tier-1 interface shapes the capability reads/writes.
   * V1: array of interface-name strings.
   * V2: array of {ReadContract, WriteContract} with field-level granularity.
   */
  readonly readsInterfaces: readonly ReadDecl[];
  readonly writesInterfaces: readonly WriteDecl[];

  /** Edge types this capability uses. (Not yet typed; see ADR-0013 — G7+G8.) */
  readonly readsEdges: readonly string[];
  readonly writesEdges: readonly string[];

  /**
   * Event types this capability emits.
   * V1: array of type strings.
   * V2: array of EmitContract with versioned schema refs.
   */
  readonly emits: readonly EmitDecl[];

  /**
   * Event-type patterns the capability subscribes to.
   * V1: array of pattern strings.
   * V2: array of SubscribeContract with version-range acceptance.
   */
  readonly subscribesTo: readonly SubscribeDecl[];

  /** Permission strings (grammar in G7 / ADR-0014). */
  readonly requiredPermissions: readonly string[];

  /**
   * Optional JSON-Schema-shaped input contract (G12 / ADR-0026). When
   * declared, the workflow runtime calls the installed `InputValidator`
   * before dispatch. Validation failure produces a non-retryable
   * `input_invalid` dead-letter (same class as `permission_denied`).
   * Capabilities that omit this field keep legacy behavior.
   */
  readonly inputSchema?: Readonly<Record<string, unknown>>;

  readonly description: string;
}

/**
 * Normalized capability — every declaration is in its V2/typed form. Used
 * internally by the workflow installer's compatibility checker.
 *
 * V1 entries are converted with conservative defaults:
 *   - emits "x.y.z" -> { schema: { type: "x.y.z", version: {1,0,0}, schemaPath: "" } }
 *   - subscribesTo "x.y.*" -> { pattern: "x.y.*", accepts: { minMajor: 1, maxMajor: 1 } }
 *   - readsInterfaces "Foo" -> { interface: "Foo", fields: [], cardinality: "many", required: false }
 *   - writesInterfaces "Foo" -> { interface: "Foo", fields: [], ownership: "contributor" }
 *
 * The `untyped` flag on the result tells the installer that this capability
 * was migrated from V1; --strict mode rejects when `untyped` is true.
 */
export interface NormalizedCapability {
  readonly id: CapabilityId;
  readonly name: string;
  readonly version: number;
  readonly emits: readonly EmitContract[];
  readonly subscribesTo: readonly SubscribeContract[];
  readonly reads: readonly ReadContract[];
  readonly writes: readonly WriteContract[];
  readonly readsEdges: readonly string[];
  readonly writesEdges: readonly string[];
  readonly requiredPermissions: readonly string[];
  /** Mirror of `Capability.inputSchema` (G12 / ADR-0026). */
  readonly inputSchema?: Readonly<Record<string, unknown>>;
  readonly description: string;
  /** True if any field was V1 (string) at normalization time. */
  readonly untyped: boolean;
}

export interface TerminalAdmissionProviderBinding {
  readonly capabilityId: CapabilityId;
  readonly capabilityName: string;
  readonly capabilityVersion: number;
  readonly writeInterface: string;
  readonly writeFields: readonly string[];
  readonly writeOwnership: WriteContract["ownership"];
  readonly provider: TerminalAdmissionProviderRef;
}

export type TerminalAdmissionProviderVerificationIssueCode =
  | "provider_missing"
  | "provider_unavailable"
  | "provider_deprecated"
  | "provider_kind_mismatch"
  | "provider_package_mismatch"
  | "provider_export_mismatch"
  | "provider_version_incompatible"
  | "provider_action_types_empty"
  | "provider_action_type_missing"
  | "provider_profile_missing"
  | "provider_evidence_ref_kind_missing"
  | "provider_substrate_ref_kind_missing";

export interface TerminalAdmissionProviderVerificationIssue {
  readonly code: TerminalAdmissionProviderVerificationIssueCode;
  readonly providerId: string;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface TerminalAdmissionProviderRefVerification {
  readonly provider: TerminalAdmissionProviderRef;
  readonly manifest?: TerminalAdmissionProviderManifest;
  readonly verified: boolean;
  readonly issues: readonly TerminalAdmissionProviderVerificationIssue[];
}

export interface TerminalAdmissionProviderBindingVerification
  extends TerminalAdmissionProviderRefVerification {
  readonly binding: TerminalAdmissionProviderBinding;
}

export interface TerminalAdmissionProviderVerificationReport {
  readonly totalBindings: number;
  readonly verifiedBindings: number;
  readonly failedBindings: number;
  readonly missingProviderIds: readonly string[];
  readonly issues: readonly TerminalAdmissionProviderVerificationIssue[];
  readonly bindings: readonly TerminalAdmissionProviderBindingVerification[];
}

export interface TerminalAdmissionProviderCertificateIssuanceInput {
  readonly issuer: string;
  readonly issuedAt: Timestamp;
  readonly validUntil: Timestamp;
}

export interface TerminalAdmissionProviderCertificateRejection {
  readonly binding: TerminalAdmissionProviderBinding;
  readonly provider: TerminalAdmissionProviderRef;
  readonly issues: readonly TerminalAdmissionProviderVerificationIssue[];
}

export interface TerminalAdmissionProviderCertificateIssuanceReport {
  readonly issuedCertificates: readonly TerminalAdmissionProviderCertificate[];
  readonly rejectedBindings: readonly TerminalAdmissionProviderCertificateRejection[];
}

export type TerminalAdmissionProviderCertificateValidationIssueCode =
  | "certificate_digest_invalid"
  | "certificate_manifest_digest_invalid"
  | "certificate_not_yet_valid"
  | "certificate_expired"
  | "certificate_revoked"
  | "certificate_superseded"
  | "certificate_capability_mismatch"
  | "certificate_provider_mismatch";

export interface TerminalAdmissionProviderCertificateValidationIssue {
  readonly code: TerminalAdmissionProviderCertificateValidationIssueCode;
  readonly certificateId: string;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface TerminalAdmissionProviderCertificateValidationInput {
  readonly certificate: TerminalAdmissionProviderCertificate;
  readonly checkedAt: Timestamp;
  readonly capabilityName?: string;
  readonly providerId?: string;
}

export interface TerminalAdmissionProviderCertificateValidationDecision {
  readonly valid: boolean;
  readonly issues: readonly TerminalAdmissionProviderCertificateValidationIssue[];
}

export interface TerminalAdmissionProviderCertificateStatusRecord {
  readonly tenantId: TenantId;
  readonly certificate: TerminalAdmissionProviderCertificate;
  readonly currentStatus: TerminalAdmissionProviderCertificateStatus;
  readonly statusUpdatedAt: Timestamp;
  readonly recordedAt?: Timestamp;
  readonly statusReason?: string;
  readonly supersededByCertificateId?: string;
}

export interface TerminalAdmissionProviderCertificateStatusEvent {
  readonly tenantId: TenantId;
  readonly certificateId: string;
  readonly sequence: number;
  readonly fromStatus?: TerminalAdmissionProviderCertificateStatus;
  readonly toStatus: TerminalAdmissionProviderCertificateStatus;
  readonly statusUpdatedAt: Timestamp;
  readonly recordedAt: Timestamp;
  readonly statusReason?: string;
  readonly supersededByCertificateId?: string;
  readonly previousEventHash?: string;
  readonly eventHash: string;
}

export type TerminalAdmissionProviderCertificateStatusEventReplayIssueCode =
  | "status_event_certificate_mismatch"
  | "status_event_sequence_gap"
  | "status_event_previous_hash_mismatch"
  | "status_event_hash_invalid"
  | "status_event_time_regression"
  | "status_event_from_status_mismatch"
  | "status_event_missing_at_checked_time";

export interface TerminalAdmissionProviderCertificateStatusEventReplayIssue {
  readonly code: TerminalAdmissionProviderCertificateStatusEventReplayIssueCode;
  readonly certificateId: string;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface TerminalAdmissionProviderCertificateStatusEventReplayInput {
  readonly record: TerminalAdmissionProviderCertificateStatusRecord;
  readonly events: readonly TerminalAdmissionProviderCertificateStatusEvent[];
  readonly checkedAt: Timestamp;
}

export interface TerminalAdmissionProviderCertificateStatusEventReplayDecision {
  readonly valid: boolean;
  readonly issues: readonly TerminalAdmissionProviderCertificateStatusEventReplayIssue[];
  readonly record?: TerminalAdmissionProviderCertificateStatusRecord;
}

export interface TerminalAdmissionProviderCertificateRecordInput {
  readonly tenantId: TenantId;
  readonly certificate: TerminalAdmissionProviderCertificate;
  readonly currentStatus?: TerminalAdmissionProviderCertificateStatus;
  readonly statusUpdatedAt: Timestamp;
  readonly statusReason?: string;
  readonly supersededByCertificateId?: string;
}

export interface TerminalAdmissionProviderCertificateStatusUpdateInput {
  readonly tenantId: TenantId;
  readonly certificateId: string;
  readonly status: TerminalAdmissionProviderCertificateStatus;
  readonly statusUpdatedAt: Timestamp;
  readonly statusReason?: string;
  readonly supersededByCertificateId?: string;
}

export interface TerminalAdmissionProviderCertificateLookupInput {
  readonly tenantId: TenantId;
  readonly certificateId: string;
}

export interface TerminalAdmissionProviderCertificateRecordAtInput
  extends TerminalAdmissionProviderCertificateLookupInput {
  readonly checkedAt: Timestamp;
}

export interface TerminalAdmissionProviderCertificateFindCurrentInput {
  readonly tenantId: TenantId;
  readonly capabilityName: string;
  readonly providerId?: string;
  readonly checkedAt?: Timestamp;
}

export interface TerminalAdmissionProviderCertificateStatusEventListInput {
  readonly tenantId: TenantId;
  readonly certificateId: string;
}

export interface TerminalAdmissionProviderCertificateStatusRecordValidationInput {
  readonly record: TerminalAdmissionProviderCertificateStatusRecord;
  readonly checkedAt: Timestamp;
  readonly capabilityName?: string;
  readonly providerId?: string;
}

export interface TerminalAdmissionProviderCertificateStatusStore {
  recordCertificate(
    input: TerminalAdmissionProviderCertificateRecordInput,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord>;

  getCertificateRecord(
    input: TerminalAdmissionProviderCertificateLookupInput,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord | null>;

  getCertificateRecordAt(
    input: TerminalAdmissionProviderCertificateRecordAtInput,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord | null>;

  setCertificateStatus(
    input: TerminalAdmissionProviderCertificateStatusUpdateInput,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord | null>;

  listCertificateStatusEvents(
    input: TerminalAdmissionProviderCertificateStatusEventListInput,
  ): Promise<readonly TerminalAdmissionProviderCertificateStatusEvent[]>;

  findCurrentCertificate(
    input: TerminalAdmissionProviderCertificateFindCurrentInput,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord | null>;
}

const normalizeEmit = (d: EmitDecl): { contract: EmitContract; untyped: boolean } => {
  if (isEmitContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      schema: {
        type: d,
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "",
      },
    },
    untyped: true,
  };
};

const normalizeSubscribe = (
  d: SubscribeDecl,
): { contract: SubscribeContract; untyped: boolean } => {
  if (isSubscribeContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      pattern: d,
      accepts: { minMajor: 1, maxMajor: 1 },
    },
    untyped: true,
  };
};

const normalizeRead = (d: ReadDecl): { contract: ReadContract; untyped: boolean } => {
  if (isReadContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      interface: d,
      fields: [],
      cardinality: "many",
      required: false,
    },
    untyped: true,
  };
};

const normalizeWrite = (d: WriteDecl): { contract: WriteContract; untyped: boolean } => {
  if (isWriteContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      interface: d,
      fields: [],
      ownership: "contributor",
    },
    untyped: true,
  };
};

/**
 * Convert a capability with mixed V1/V2 declarations into fully-V2 form.
 * Sets `untyped: true` if any V1 entries were normalized.
 */
export const normalizeCapability = (cap: Capability): NormalizedCapability => {
  let untyped = false;

  const emits = cap.emits.map(normalizeEmit);
  const subscribesTo = cap.subscribesTo.map(normalizeSubscribe);
  const reads = cap.readsInterfaces.map(normalizeRead);
  const writes = cap.writesInterfaces.map(normalizeWrite);

  for (const e of emits) untyped = untyped || e.untyped;
  for (const s of subscribesTo) untyped = untyped || s.untyped;
  for (const r of reads) untyped = untyped || r.untyped;
  for (const w of writes) untyped = untyped || w.untyped;

  return {
    id: cap.id,
    name: cap.name,
    version: cap.version,
    emits: emits.map((x) => x.contract),
    subscribesTo: subscribesTo.map((x) => x.contract),
    reads: reads.map((x) => x.contract),
    writes: writes.map((x) => x.contract),
    readsEdges: cap.readsEdges,
    writesEdges: cap.writesEdges,
    requiredPermissions: cap.requiredPermissions,
    ...(cap.inputSchema ? { inputSchema: cap.inputSchema } : {}),
    description: cap.description,
    untyped,
  };
};

/**
 * Discover terminal-admission providers declared on a capability's write
 * contracts. The result is registry metadata only; write runtimes must still
 * call the provider and validate its terminal proof before mutating state.
 */
export const listTerminalAdmissionProviderBindings = (
  cap: Capability,
): readonly TerminalAdmissionProviderBinding[] => {
  const normalized = normalizeCapability(cap);
  return normalized.writes.flatMap((write) =>
    (write.terminalAdmissionProviders ?? []).map((provider) => ({
      capabilityId: normalized.id,
      capabilityName: normalized.name,
      capabilityVersion: normalized.version,
      writeInterface: write.interface,
      writeFields: write.fields,
      writeOwnership: write.ownership,
      provider,
    })),
  );
};

export const verifyTerminalAdmissionProviderRef = (
  provider: TerminalAdmissionProviderRef,
  manifests: readonly TerminalAdmissionProviderManifest[],
): TerminalAdmissionProviderRefVerification => {
  const manifest = manifests.find((candidate) =>
    candidate.providerId === provider.providerId
  );
  const issues: TerminalAdmissionProviderVerificationIssue[] = [];

  if (manifest === undefined) {
    issues.push({
      code: "provider_missing",
      providerId: provider.providerId,
      message: `No terminal-admission provider manifest is available for ${provider.providerId}.`,
      expected: provider.providerId,
    });
    return { provider, verified: false, issues };
  }

  if (manifest.availability === "unavailable") {
    issues.push({
      code: "provider_unavailable",
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} is unavailable.`,
      actual: manifest.availability,
    });
  } else if (manifest.availability === "deprecated") {
    issues.push({
      code: "provider_deprecated",
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} is deprecated and cannot prove fresh coverage.`,
      actual: manifest.availability,
    });
  }

  if (manifest.kind !== provider.kind) {
    issues.push({
      code: "provider_kind_mismatch",
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} kind does not match the declared ref.`,
      expected: provider.kind,
      actual: manifest.kind,
    });
  }
  if (manifest.packageName !== provider.packageName) {
    issues.push({
      code: "provider_package_mismatch",
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} package does not match the declared ref.`,
      expected: provider.packageName,
      actual: manifest.packageName,
    });
  }
  if (manifest.exportName !== provider.exportName) {
    issues.push({
      code: "provider_export_mismatch",
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} export does not match the declared ref.`,
      expected: provider.exportName,
      actual: manifest.exportName,
    });
  }
  if (!providerVersionCompatible(provider, manifest)) {
    issues.push({
      code: "provider_version_incompatible",
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} contract version is not compatible with the declared ref.`,
      expected: versionLabel(provider.contractVersion),
      actual: versionLabel(manifest.contractVersion),
    });
  }
  if (provider.actionTypes.length === 0) {
    issues.push({
      code: "provider_action_types_empty",
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} declares no covered action types.`,
    });
  }
  for (const actionType of provider.actionTypes) {
    if (!manifest.actionTypes.includes(actionType)) {
      issues.push({
        code: "provider_action_type_missing",
        providerId: provider.providerId,
        message: `Terminal-admission provider ${provider.providerId} manifest does not cover action type ${actionType}.`,
        expected: actionType,
      });
    }
  }
  addMissingRefKindIssues(
    issues,
    provider,
    manifest,
    "profiles",
    "provider_profile_missing",
  );
  addMissingRefKindIssues(
    issues,
    provider,
    manifest,
    "evidenceRefKinds",
    "provider_evidence_ref_kind_missing",
  );
  addMissingRefKindIssues(
    issues,
    provider,
    manifest,
    "substrateRefKinds",
    "provider_substrate_ref_kind_missing",
  );

  return {
    provider,
    manifest,
    verified: issues.length === 0,
    issues,
  };
};

export const verifyTerminalAdmissionProviderBindings = (
  capabilities: readonly Capability[],
  manifests: readonly TerminalAdmissionProviderManifest[],
): TerminalAdmissionProviderVerificationReport => {
  const bindings = capabilities.flatMap((cap) =>
    listTerminalAdmissionProviderBindings(cap)
  );
  const verifiedBindings = bindings.map((binding) => {
    const verification = verifyTerminalAdmissionProviderRef(
      binding.provider,
      manifests,
    );
    return {
      binding,
      provider: verification.provider,
      ...(verification.manifest ? { manifest: verification.manifest } : {}),
      verified: verification.verified,
      issues: verification.issues,
    };
  });
  const issues = verifiedBindings.flatMap((binding) => binding.issues);

  return {
    totalBindings: verifiedBindings.length,
    verifiedBindings: verifiedBindings.filter((binding) => binding.verified)
      .length,
    failedBindings: verifiedBindings.filter((binding) => !binding.verified)
      .length,
    missingProviderIds: uniqueStrings(
      issues
        .filter((issue) => issue.code === "provider_missing")
        .map((issue) => issue.providerId),
    ),
    issues,
    bindings: verifiedBindings,
  };
};

export const terminalAdmissionProviderManifestDigest = (
  manifest: TerminalAdmissionProviderManifest,
): string => sha256(stableJson(manifest));

export const terminalAdmissionProviderCertificateDigest = (
  certificate: TerminalAdmissionProviderCertificate,
): string => {
  const { certificateDigest: _certificateDigest, ...digestible } = certificate;
  return sha256(stableJson(digestible));
};

export const terminalAdmissionProviderCertificateStatusEventHash = (
  event: Omit<TerminalAdmissionProviderCertificateStatusEvent, "eventHash">,
): string => sha256(stableJson(event));

export const replayTerminalAdmissionProviderCertificateStatusAt = (
  input: TerminalAdmissionProviderCertificateStatusEventReplayInput,
): TerminalAdmissionProviderCertificateStatusEventReplayDecision => {
  const certificateId = input.record.certificate.certificateId;
  const events = [...input.events].sort((a, b) => a.sequence - b.sequence);
  const issues: TerminalAdmissionProviderCertificateStatusEventReplayIssue[] = [];
  let previousHash: string | undefined;
  let previousStatus: TerminalAdmissionProviderCertificateStatus | undefined;
  let previousStatusUpdatedAt: Timestamp | undefined;
  let eventAtCheckedTime:
    | TerminalAdmissionProviderCertificateStatusEvent
    | undefined;

  events.forEach((event, index) => {
    if (
      event.tenantId !== input.record.tenantId ||
      event.certificateId !== certificateId
    ) {
      issues.push({
        code: "status_event_certificate_mismatch",
        certificateId,
        message: `Terminal-admission provider certificate status event ${event.eventHash} is not bound to the replayed certificate.`,
        expected: `${input.record.tenantId}/${certificateId}`,
        actual: `${event.tenantId}/${event.certificateId}`,
      });
    }

    const expectedSequence = index + 1;
    if (event.sequence !== expectedSequence) {
      issues.push({
        code: "status_event_sequence_gap",
        certificateId,
        message: `Terminal-admission provider certificate status event sequence ${event.sequence} is not contiguous.`,
        expected: String(expectedSequence),
        actual: String(event.sequence),
      });
    }

    if (event.previousEventHash !== previousHash) {
      issues.push({
        code: "status_event_previous_hash_mismatch",
        certificateId,
        message: `Terminal-admission provider certificate status event ${event.sequence} does not link to the previous event hash.`,
        ...(previousHash !== undefined ? { expected: previousHash } : {}),
        ...(event.previousEventHash !== undefined
          ? { actual: event.previousEventHash }
          : {}),
      });
    }

    const { eventHash: _eventHash, ...eventBody } = event;
    const actualHash =
      terminalAdmissionProviderCertificateStatusEventHash(eventBody);
    if (actualHash !== event.eventHash) {
      issues.push({
        code: "status_event_hash_invalid",
        certificateId,
        message: `Terminal-admission provider certificate status event ${event.sequence} hash is invalid.`,
        expected: event.eventHash,
        actual: actualHash,
      });
    }

    if (
      previousStatusUpdatedAt !== undefined &&
      Date.parse(event.statusUpdatedAt) <
        Date.parse(previousStatusUpdatedAt)
    ) {
      issues.push({
        code: "status_event_time_regression",
        certificateId,
        message: `Terminal-admission provider certificate status event ${event.sequence} moves status time backward.`,
        expected: previousStatusUpdatedAt,
        actual: event.statusUpdatedAt,
      });
    }

    if (event.sequence > 1 && event.fromStatus !== previousStatus) {
      issues.push({
        code: "status_event_from_status_mismatch",
        certificateId,
        message: `Terminal-admission provider certificate status event ${event.sequence} does not transition from the previous status.`,
        ...(previousStatus !== undefined ? { expected: previousStatus } : {}),
        ...(event.fromStatus !== undefined ? { actual: event.fromStatus } : {}),
      });
    }

    if (Date.parse(event.statusUpdatedAt) <= Date.parse(input.checkedAt)) {
      eventAtCheckedTime = event;
    }

    previousHash = event.eventHash;
    previousStatus = event.toStatus;
    previousStatusUpdatedAt = event.statusUpdatedAt;
  });

  if (eventAtCheckedTime === undefined) {
    issues.push({
      code: "status_event_missing_at_checked_time",
      certificateId,
      message: `No terminal-admission provider certificate status event was current at ${input.checkedAt}.`,
      actual: input.checkedAt,
    });
  }

  const replayedRecord =
    eventAtCheckedTime === undefined
      ? undefined
      : {
          tenantId: input.record.tenantId,
          certificate: input.record.certificate,
          currentStatus: eventAtCheckedTime.toStatus,
          statusUpdatedAt: eventAtCheckedTime.statusUpdatedAt,
          recordedAt: eventAtCheckedTime.recordedAt,
          ...(eventAtCheckedTime.statusReason !== undefined
            ? { statusReason: eventAtCheckedTime.statusReason }
            : {}),
          ...(eventAtCheckedTime.supersededByCertificateId !== undefined
            ? {
                supersededByCertificateId:
                  eventAtCheckedTime.supersededByCertificateId,
              }
            : {}),
        };

  return {
    valid: issues.length === 0,
    issues,
    ...(replayedRecord !== undefined ? { record: replayedRecord } : {}),
  };
};

export const issueTerminalAdmissionProviderCertificates = (
  capabilities: readonly Capability[],
  manifests: readonly TerminalAdmissionProviderManifest[],
  input: TerminalAdmissionProviderCertificateIssuanceInput,
): TerminalAdmissionProviderCertificateIssuanceReport => {
  const verification = verifyTerminalAdmissionProviderBindings(
    capabilities,
    manifests,
  );
  const issuedCertificates: TerminalAdmissionProviderCertificate[] = [];
  const rejectedBindings: TerminalAdmissionProviderCertificateRejection[] = [];

  for (const bindingVerification of verification.bindings) {
    if (!bindingVerification.verified || bindingVerification.manifest === undefined) {
      rejectedBindings.push({
        binding: bindingVerification.binding,
        provider: bindingVerification.provider,
        issues: bindingVerification.issues,
      });
      continue;
    }

    const manifestDigest = terminalAdmissionProviderManifestDigest(
      bindingVerification.manifest,
    );
    const subject = {
      capabilityId: bindingVerification.binding.capabilityId,
      capabilityName: bindingVerification.binding.capabilityName,
      capabilityVersion: bindingVerification.binding.capabilityVersion,
      writeInterface: bindingVerification.binding.writeInterface,
      writeFields: bindingVerification.binding.writeFields,
      writeOwnership: bindingVerification.binding.writeOwnership,
      providerId: bindingVerification.provider.providerId,
    };
    const certificateId = `tapc_${sha256(
      stableJson({
        issuer: input.issuer,
        issuedAt: input.issuedAt,
        validUntil: input.validUntil,
        subject,
        manifestDigest,
      }),
    ).slice(0, 32)}`;
    const unsigned = {
      schemaVersion: "pm.terminal_admission_provider_certificate.v1",
      certificateId,
      certificateDigest: "",
      issuer: input.issuer,
      issuedAt: input.issuedAt,
      validUntil: input.validUntil,
      status: "valid",
      subject,
      provider: bindingVerification.provider,
      manifest: bindingVerification.manifest,
      manifestDigest,
    } as const satisfies TerminalAdmissionProviderCertificate;

    issuedCertificates.push({
      ...unsigned,
      certificateDigest: terminalAdmissionProviderCertificateDigest(unsigned),
    });
  }

  return {
    issuedCertificates,
    rejectedBindings,
  };
};

export const verifyTerminalAdmissionProviderCertificateIntegrity = (
  certificate: TerminalAdmissionProviderCertificate,
): TerminalAdmissionProviderCertificateValidationDecision => {
  const issues: TerminalAdmissionProviderCertificateValidationIssue[] = [];
  const actualManifestDigest = terminalAdmissionProviderManifestDigest(
    certificate.manifest,
  );
  if (actualManifestDigest !== certificate.manifestDigest) {
    issues.push({
      code: "certificate_manifest_digest_invalid",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} has an invalid manifest digest.`,
      expected: certificate.manifestDigest,
      actual: actualManifestDigest,
    });
  }

  const actualCertificateDigest =
    terminalAdmissionProviderCertificateDigest(certificate);
  if (actualCertificateDigest !== certificate.certificateDigest) {
    issues.push({
      code: "certificate_digest_invalid",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} has an invalid certificate digest.`,
      expected: certificate.certificateDigest,
      actual: actualCertificateDigest,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const verifyTerminalAdmissionProviderCertificate = (
  input: TerminalAdmissionProviderCertificateValidationInput,
): TerminalAdmissionProviderCertificateValidationDecision => {
  const { certificate } = input;
  const issues = [
    ...verifyTerminalAdmissionProviderCertificateIntegrity(certificate).issues,
  ];

  const checkedAt = Date.parse(input.checkedAt);
  if (checkedAt < Date.parse(certificate.issuedAt)) {
    issues.push({
      code: "certificate_not_yet_valid",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} is not valid until ${certificate.issuedAt}.`,
      expected: certificate.issuedAt,
      actual: input.checkedAt,
    });
  }
  if (Date.parse(certificate.validUntil) < checkedAt) {
    issues.push({
      code: "certificate_expired",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} expired at ${certificate.validUntil}.`,
      expected: certificate.validUntil,
      actual: input.checkedAt,
    });
  }

  if (certificate.status === "revoked") {
    issues.push({
      code: "certificate_revoked",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} is revoked.`,
      actual: certificate.status,
    });
  } else if (certificate.status === "superseded") {
    issues.push({
      code: "certificate_superseded",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} has been superseded.`,
      actual: certificate.status,
    });
  }

  if (
    input.capabilityName !== undefined &&
    certificate.subject.capabilityName !== input.capabilityName
  ) {
    issues.push({
      code: "certificate_capability_mismatch",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} is bound to capability ${certificate.subject.capabilityName}, not ${input.capabilityName}.`,
      expected: input.capabilityName,
      actual: certificate.subject.capabilityName,
    });
  }
  if (
    input.providerId !== undefined &&
    certificate.subject.providerId !== input.providerId
  ) {
    issues.push({
      code: "certificate_provider_mismatch",
      certificateId: certificate.certificateId,
      message: `Terminal-admission provider certificate ${certificate.certificateId} is bound to provider ${certificate.subject.providerId}, not ${input.providerId}.`,
      expected: input.providerId,
      actual: certificate.subject.providerId,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const verifyTerminalAdmissionProviderCertificateStatusRecord = (
  input: TerminalAdmissionProviderCertificateStatusRecordValidationInput,
): TerminalAdmissionProviderCertificateValidationDecision => {
  const issues = [
    ...verifyTerminalAdmissionProviderCertificate({
      certificate: input.record.certificate,
      checkedAt: input.checkedAt,
      ...(input.capabilityName !== undefined
        ? { capabilityName: input.capabilityName }
        : {}),
      ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
    }).issues,
  ];

  if (
    input.record.currentStatus === "revoked" &&
    !issues.some((issue) => issue.code === "certificate_revoked")
  ) {
    issues.push({
      code: "certificate_revoked",
      certificateId: input.record.certificate.certificateId,
      message: `Terminal-admission provider certificate ${input.record.certificate.certificateId} is revoked by the status store.`,
      actual: input.record.currentStatus,
    });
  } else if (
    input.record.currentStatus === "superseded" &&
    !issues.some((issue) => issue.code === "certificate_superseded")
  ) {
    issues.push({
      code: "certificate_superseded",
      certificateId: input.record.certificate.certificateId,
      message: `Terminal-admission provider certificate ${input.record.certificate.certificateId} has been superseded by the status store.`,
      ...(input.record.supersededByCertificateId !== undefined
        ? { expected: input.record.supersededByCertificateId }
        : {}),
      actual: input.record.currentStatus,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

function providerVersionCompatible(
  provider: TerminalAdmissionProviderRef,
  manifest: TerminalAdmissionProviderManifest,
): boolean {
  const required = provider.contractVersion;
  const actual = manifest.contractVersion;
  if (required.major !== actual.major) return false;
  if (actual.minor > required.minor) return true;
  if (actual.minor < required.minor) return false;
  return actual.patch >= required.patch;
}

function versionLabel(version: {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function addMissingRefKindIssues(
  issues: TerminalAdmissionProviderVerificationIssue[],
  provider: TerminalAdmissionProviderRef,
  manifest: TerminalAdmissionProviderManifest,
  field: "profiles" | "evidenceRefKinds" | "substrateRefKinds",
  code: TerminalAdmissionProviderVerificationIssueCode,
): void {
  const expected = provider[field] ?? [];
  const actual = manifest[field] ?? [];
  for (const value of expected) {
    if (actual.includes(value)) continue;
    issues.push({
      code,
      providerId: provider.providerId,
      message: `Terminal-admission provider ${provider.providerId} manifest does not cover ${field} value ${value}.`,
      expected: value,
    });
  }
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortJsonValue(record[key]);
      return acc;
    }, {});
}

export interface Registry {
  /**
   * Register or upgrade a capability. Idempotent on (tenantId, name, version):
   * re-registering the same triple updates the descriptor in place.
   * Registering a new version of an existing name leaves prior versions in
   * place (multiple versions can coexist; the workflow layer pins to one).
   */
  register(tenantId: TenantId, capability: Capability): Promise<void>;

  /** Unregister a capability by name (all versions). */
  unregister(tenantId: TenantId, name: string): Promise<void>;

  /**
   * Look up a capability by name. If multiple versions are registered,
   * returns the highest. (Workflows should pin a specific version explicitly.)
   */
  get(tenantId: TenantId, name: string): Promise<Capability | null>;

  /** Look up a specific (name, version). */
  getVersion(
    tenantId: TenantId,
    name: string,
    version: number,
  ): Promise<Capability | null>;

  /** Enumerate all capabilities for a tenant (latest version of each name). */
  list(tenantId: TenantId): Promise<readonly Capability[]>;

  /**
   * Reverse index: capabilities whose subscribesTo patterns match the given
   * concrete event type. Used by the workflow runtime + SubscriptionRouter
   * to fan out events to interested capabilities at install time.
   */
  subscribersOf(
    tenantId: TenantId,
    eventType: string,
  ): Promise<readonly Capability[]>;
}

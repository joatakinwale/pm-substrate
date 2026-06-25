import { describe, expect, it } from "vitest";
import { timestamp, type CapabilityId, type TenantId } from "@pm/types";
import {
  issueTerminalAdmissionProviderCertificates,
  listTerminalAdmissionProviderBindings,
  normalizeCapability,
  verifyTerminalAdmissionProviderCertificate,
  verifyTerminalAdmissionProviderCertificateStatusRecord,
  verifyTerminalAdmissionProviderBindings,
  verifyTerminalAdmissionProviderRef,
  type Capability,
} from "./interfaces.js";

const cap = (overrides: Partial<Capability> = {}): Capability => ({
  id: "cap_terminal_admission_test_v1" as CapabilityId,
  name: "test.terminal-admission",
  version: 1,
  readsInterfaces: [],
  writesInterfaces: [],
  readsEdges: [],
  writesEdges: [],
  emits: [],
  subscribesTo: [],
  requiredPermissions: [],
  description: "test capability",
  ...overrides,
});

describe("terminal-admission provider metadata", () => {
  it("preserves provider refs through capability normalization", () => {
    const capability = cap({
      writesInterfaces: [
        {
          interface: "Event",
          fields: ["kind", "occurredAt"],
          ownership: "contributor",
          terminalAdmissionProviders: [
            {
              providerId: "test.action-outcome-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 0 },
              packageName: "@pm/test-capability",
              exportName: "buildTestActionOutcomeEnvelope",
              profiles: ["test"],
              actionTypes: ["test.accept", "test.block"],
              evidenceRefKinds: ["source_record"],
              substrateRefKinds: ["action_outcome_envelope"],
            },
          ],
        },
      ],
    });

    const normalized = normalizeCapability(capability);

    expect(normalized.untyped).toBe(false);
    expect(normalized.writes[0]?.terminalAdmissionProviders).toEqual([
      expect.objectContaining({
        providerId: "test.action-outcome-envelope.v1",
        packageName: "@pm/test-capability",
        exportName: "buildTestActionOutcomeEnvelope",
      }),
    ]);
  });

  it("lists provider bindings by write contract without granting authority", () => {
    const capability = cap({
      writesInterfaces: [
        {
          interface: "Document",
          fields: ["sha256"],
          ownership: "contributor",
        },
        {
          interface: "Event",
          fields: ["kind"],
          ownership: "contributor",
          terminalAdmissionProviders: [
            {
              providerId: "test.event-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 0 },
              packageName: "@pm/test-capability",
              exportName: "buildEventEnvelope",
              actionTypes: ["event.accept"],
            },
          ],
        },
      ],
    });

    expect(listTerminalAdmissionProviderBindings(capability)).toEqual([
      {
        capabilityId: "cap_terminal_admission_test_v1",
        capabilityName: "test.terminal-admission",
        capabilityVersion: 1,
        writeInterface: "Event",
        writeFields: ["kind"],
        writeOwnership: "contributor",
        provider: expect.objectContaining({
          providerId: "test.event-envelope.v1",
          exportName: "buildEventEnvelope",
        }),
      },
    ]);
  });

  it("verifies provider refs against live manifests before treating coverage as proven", () => {
    const provider = {
      providerId: "test.verified-envelope.v1",
      kind: "action_outcome_envelope",
      contractVersion: { major: 1, minor: 0, patch: 0 },
      packageName: "@pm/test-capability",
      exportName: "buildVerifiedEnvelope",
      profiles: ["test"],
      actionTypes: ["event.accept", "event.block"],
      evidenceRefKinds: ["source_record"],
      substrateRefKinds: ["action_outcome_envelope"],
    } as const;

    const verification = verifyTerminalAdmissionProviderRef(provider, [
      {
        ...provider,
        contractVersion: { major: 1, minor: 1, patch: 0 },
        availability: "available",
      },
    ]);

    expect(verification.verified).toBe(true);
    expect(verification.issues).toEqual([]);
  });

  it("rejects missing, unavailable, incompatible, and narrower provider manifests", () => {
    const provider = {
      providerId: "test.stale-envelope.v1",
      kind: "action_outcome_envelope",
      contractVersion: { major: 1, minor: 2, patch: 0 },
      packageName: "@pm/test-capability",
      exportName: "buildStaleEnvelope",
      profiles: ["test"],
      actionTypes: ["event.accept", "event.block"],
      evidenceRefKinds: ["source_record"],
      substrateRefKinds: ["action_outcome_envelope"],
    } as const;

    expect(
      verifyTerminalAdmissionProviderRef(provider, []).issues.map(
        (issue) => issue.code,
      ),
    ).toEqual(["provider_missing"]);

    const report = verifyTerminalAdmissionProviderRef(provider, [
      {
        ...provider,
        availability: "deprecated",
        contractVersion: { major: 2, minor: 0, patch: 0 },
        exportName: "buildDifferentEnvelope",
        actionTypes: ["event.accept"],
        evidenceRefKinds: [],
      },
    ]);

    expect(report.verified).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "provider_deprecated",
      "provider_export_mismatch",
      "provider_version_incompatible",
      "provider_action_type_missing",
      "provider_evidence_ref_kind_missing",
    ]);
  });

  it("reports provider verification by capability write binding", () => {
    const capability = cap({
      writesInterfaces: [
        {
          interface: "Event",
          fields: ["kind"],
          ownership: "contributor",
          terminalAdmissionProviders: [
            {
              providerId: "test.bound-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 0 },
              packageName: "@pm/test-capability",
              exportName: "buildBoundEnvelope",
              actionTypes: ["event.accept"],
            },
          ],
        },
      ],
    });

    const report = verifyTerminalAdmissionProviderBindings([capability], [
      {
        providerId: "test.bound-envelope.v1",
        kind: "action_outcome_envelope",
        contractVersion: { major: 1, minor: 0, patch: 1 },
        packageName: "@pm/test-capability",
        exportName: "buildBoundEnvelope",
        actionTypes: ["event.accept", "event.block"],
        availability: "available",
      },
    ]);

    expect(report).toMatchObject({
      totalBindings: 1,
      verifiedBindings: 1,
      failedBindings: 0,
      missingProviderIds: [],
      issues: [],
    });
    expect(report.bindings[0]).toMatchObject({
      verified: true,
      binding: expect.objectContaining({
        writeInterface: "Event",
        writeFields: ["kind"],
      }),
    });
  });

  it("issues durable certificates only for verified provider bindings", () => {
    const capability = cap({
      writesInterfaces: [
        {
          interface: "Event",
          fields: ["kind"],
          ownership: "contributor",
          terminalAdmissionProviders: [
            {
              providerId: "test.cert-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 0 },
              packageName: "@pm/test-capability",
              exportName: "buildCertEnvelope",
              actionTypes: ["event.accept"],
            },
          ],
        },
      ],
    });

    const report = issueTerminalAdmissionProviderCertificates(
      [capability],
      [
        {
          providerId: "test.cert-envelope.v1",
          kind: "action_outcome_envelope",
          contractVersion: { major: 1, minor: 0, patch: 1 },
          packageName: "@pm/test-capability",
          exportName: "buildCertEnvelope",
          actionTypes: ["event.accept"],
          availability: "available",
        },
      ],
      {
        issuer: "registry.install",
        issuedAt: timestamp("2026-06-25T10:00:00.000Z"),
        validUntil: timestamp("2026-06-25T11:00:00.000Z"),
      },
    );

    expect(report.rejectedBindings).toEqual([]);
    expect(report.issuedCertificates).toHaveLength(1);
    expect(report.issuedCertificates[0]).toMatchObject({
      schemaVersion: "pm.terminal_admission_provider_certificate.v1",
      issuer: "registry.install",
      status: "valid",
      subject: {
        capabilityName: "test.terminal-admission",
        writeInterface: "Event",
        providerId: "test.cert-envelope.v1",
      },
      provider: expect.objectContaining({
        providerId: "test.cert-envelope.v1",
      }),
      manifest: expect.objectContaining({
        availability: "available",
      }),
    });

    expect(
      verifyTerminalAdmissionProviderCertificate({
        certificate: report.issuedCertificates[0]!,
        checkedAt: timestamp("2026-06-25T10:30:00.000Z"),
        capabilityName: "test.terminal-admission",
        providerId: "test.cert-envelope.v1",
      }),
    ).toEqual({ valid: true, issues: [] });
  });

  it("rejects expired, revoked, tampered, and mismatched provider certificates", () => {
    const capability = cap({
      writesInterfaces: [
        {
          interface: "Event",
          fields: ["kind"],
          ownership: "contributor",
          terminalAdmissionProviders: [
            {
              providerId: "test.invalid-cert-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 0 },
              packageName: "@pm/test-capability",
              exportName: "buildInvalidCertEnvelope",
              actionTypes: ["event.accept"],
            },
          ],
        },
      ],
    });
    const [certificate] = issueTerminalAdmissionProviderCertificates(
      [capability],
      [
        {
          providerId: "test.invalid-cert-envelope.v1",
          kind: "action_outcome_envelope",
          contractVersion: { major: 1, minor: 0, patch: 0 },
          packageName: "@pm/test-capability",
          exportName: "buildInvalidCertEnvelope",
          actionTypes: ["event.accept"],
          availability: "available",
        },
      ],
      {
        issuer: "registry.install",
        issuedAt: timestamp("2026-06-25T10:00:00.000Z"),
        validUntil: timestamp("2026-06-25T11:00:00.000Z"),
      },
    ).issuedCertificates;

    const tampered = {
      ...certificate!,
      status: "revoked",
      subject: {
        ...certificate!.subject,
        capabilityName: "other.capability",
      },
    } as const;

    expect(
      verifyTerminalAdmissionProviderCertificate({
        certificate: tampered,
        checkedAt: timestamp("2026-06-25T11:30:00.000Z"),
        capabilityName: "test.terminal-admission",
        providerId: "other.provider",
      }).issues.map((issue) => issue.code),
    ).toEqual([
      "certificate_digest_invalid",
      "certificate_expired",
      "certificate_revoked",
      "certificate_capability_mismatch",
      "certificate_provider_mismatch",
    ]);
  });

  it("applies status-store revocation without mutating the certificate digest", () => {
    const capability = cap({
      writesInterfaces: [
        {
          interface: "Event",
          fields: ["kind"],
          ownership: "contributor",
          terminalAdmissionProviders: [
            {
              providerId: "test.status-store-envelope.v1",
              kind: "action_outcome_envelope",
              contractVersion: { major: 1, minor: 0, patch: 0 },
              packageName: "@pm/test-capability",
              exportName: "buildStatusStoreEnvelope",
              actionTypes: ["event.accept"],
            },
          ],
        },
      ],
    });
    const [certificate] = issueTerminalAdmissionProviderCertificates(
      [capability],
      [
        {
          providerId: "test.status-store-envelope.v1",
          kind: "action_outcome_envelope",
          contractVersion: { major: 1, minor: 0, patch: 0 },
          packageName: "@pm/test-capability",
          exportName: "buildStatusStoreEnvelope",
          actionTypes: ["event.accept"],
          availability: "available",
        },
      ],
      {
        issuer: "registry.install",
        issuedAt: timestamp("2026-06-25T10:00:00.000Z"),
        validUntil: timestamp("2026-06-25T11:00:00.000Z"),
      },
    ).issuedCertificates;

    const decision = verifyTerminalAdmissionProviderCertificateStatusRecord({
      record: {
        tenantId: "tnt_terminal_cert_status" as TenantId,
        certificate: certificate!,
        currentStatus: "revoked",
        statusUpdatedAt: timestamp("2026-06-25T10:15:00.000Z"),
        statusReason: "provider implementation key rotated",
      },
      checkedAt: timestamp("2026-06-25T10:30:00.000Z"),
      capabilityName: "test.terminal-admission",
      providerId: "test.status-store-envelope.v1",
    });

    expect(decision.valid).toBe(false);
    expect(decision.issues.map((issue) => issue.code)).toEqual([
      "certificate_revoked",
    ]);
  });
});

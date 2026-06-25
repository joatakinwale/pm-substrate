import { describe, expect, it } from "vitest";
import type { EntityId, EdgeId, TenantId, Timestamp } from "@pm/types";
import { PostgresGraph } from "./postgres.js";
import {
  assertGraphWriteAuthority,
  GraphWriteAuthorityError,
  validateGraphWriteAuthority,
  type GraphWriteAuthorityRef,
  type GraphWriteAuthoritySubstrateRecord,
} from "./write-authority.js";

const tenantId = "tnt_graph_authority" as TenantId;
const entityId = "ent_graph_authority" as EntityId;
const edgeId = "edg_graph_authority" as EdgeId;
const checkedAt = "2026-06-25T00:00:00.000Z" as Timestamp;

const validAuthority = (): GraphWriteAuthorityRef => ({
  authorityKind: "workflow_action_outcome_envelope",
  envelopeId: "env_graph_authority",
  actionId: "act_graph_authority",
  terminalOutcome: "accepted",
  providerCertificateId: "cert_graph_authority",
  providerCertificateDigest: "sha256:graph_authority",
  providerCertificateStatusRef: {
    certificateId: "cert_graph_authority",
    certificateDigest: "sha256:graph_authority",
    status: "valid",
    statusSequence: 1,
    statusEventHash: "sha256:status_event",
    statusUpdatedAt: checkedAt,
    checkedAt,
  },
});

const validSubstrateRecord = (): GraphWriteAuthoritySubstrateRecord => ({
  authorityKind: "workflow_action_outcome_envelope",
  envelopeId: "env_graph_authority",
  actionId: "act_graph_authority",
  terminalOutcome: "accepted",
  providerCertificateId: "cert_graph_authority",
  providerCertificateDigest: "sha256:graph_authority",
  providerCertificateStatusRef: {
    certificateId: "cert_graph_authority",
    certificateDigest: "sha256:graph_authority",
    status: "valid",
    statusSequence: 1,
    statusEventHash: "sha256:status_event",
    statusUpdatedAt: checkedAt,
    checkedAt,
  },
});

describe("validateGraphWriteAuthority", () => {
  it("is disabled unless a write authority policy is configured", () => {
    expect(validateGraphWriteAuthority({})).toEqual([]);
  });

  it("requires an accepted envelope authority ref when configured", () => {
    const issues = validateGraphWriteAuthority({
      policy: { requireAuthorityRef: true },
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      "graph_write_authority_missing",
    ]);
  });

  it("accepts a valid provider certificate status ref", () => {
    expect(
      validateGraphWriteAuthority({
        authorityRef: validAuthority(),
        policy: {
          requireAuthorityRef: true,
          requireProviderCertificateStatusRef: true,
        },
      }),
    ).toEqual([]);
  });

  it("does not let role projection hide a missing provider status ref", () => {
    const { providerCertificateStatusRef: _statusRef, ...authorityRef } =
      validAuthority();
    const issues = validateGraphWriteAuthority({
      authorityRef,
      policy: {
        requireAuthorityRef: true,
        requireProviderCertificateStatusRef: true,
      },
    });
    expect(issues.map((issue) => issue.code)).toContain(
      "graph_write_provider_certificate_status_ref_missing",
    );
  });

  it("rejects revoked or mismatched provider certificate status refs", () => {
    const authorityRef: GraphWriteAuthorityRef = {
      ...validAuthority(),
      providerCertificateDigest: "sha256:expected",
      providerCertificateStatusRef: {
        ...validAuthority().providerCertificateStatusRef!,
        certificateDigest: "sha256:actual",
        status: "revoked",
      },
    };

    const issues = validateGraphWriteAuthority({
      authorityRef,
      policy: {
        requireAuthorityRef: true,
        requireProviderCertificateStatusRef: true,
      },
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      "graph_write_provider_certificate_status_ref_mismatch",
      "graph_write_provider_certificate_status_ref_mismatch",
    ]);
  });

  it("throws a structured error for rejected graph writes", () => {
    expect(() =>
      assertGraphWriteAuthority({
        policy: { requireAuthorityRef: true },
      }),
    ).toThrow(GraphWriteAuthorityError);
  });

  it("requires a matching substrate record when configured", () => {
    expect(
      validateGraphWriteAuthority({
        authorityRef: validAuthority(),
        substrateRecord: validSubstrateRecord(),
        policy: {
          requireAuthorityRef: true,
          requireProviderCertificateStatusRef: true,
          requireSubstrateRecord: true,
        },
      }),
    ).toEqual([]);

    expect(
      validateGraphWriteAuthority({
        authorityRef: validAuthority(),
        policy: {
          requireAuthorityRef: true,
          requireProviderCertificateStatusRef: true,
          requireSubstrateRecord: true,
        },
      }).map((issue) => issue.code),
    ).toContain("graph_write_authority_substrate_record_missing");
  });

  it("rejects a substrate record that does not match the cited envelope", () => {
    const issues = validateGraphWriteAuthority({
      authorityRef: validAuthority(),
      substrateRecord: {
        ...validSubstrateRecord(),
        actionId: "act_other",
      },
      policy: {
        requireAuthorityRef: true,
        requireProviderCertificateStatusRef: true,
        requireSubstrateRecord: true,
      },
    });

    expect(issues.map((issue) => issue.code)).toContain(
      "graph_write_authority_substrate_record_mismatch",
    );
  });
});

describe("PostgresGraph write authority policy", () => {
  const strictGraph = () =>
    new PostgresGraph(
      {
        query: () => {
          throw new Error("authority guard should run before SQL");
        },
      } as never,
      {
        writeAuthorityPolicy: {
          requireAuthorityRef: true,
          requireProviderCertificateStatusRef: true,
        },
      },
    );

  const strictStoreGraph = () =>
    new PostgresGraph(
      {
        query: () => {
          throw new Error("authority guard should run before SQL");
        },
      } as never,
      {
        writeAuthorityPolicy: {
          requireAuthorityRef: true,
          requireProviderCertificateStatusRef: true,
          requireSubstrateRecord: true,
        },
      },
    );

  it("rejects createNode before SQL when authority is missing", async () => {
    await expect(
      strictGraph().createNode({
        tenantId,
        profile: { tier1: "Engagement", profile: null, concrete: "Engagement" },
        identity: {},
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(GraphWriteAuthorityError);
  });

  it("rejects updateNode before SQL when provider status ref is missing", async () => {
    const { providerCertificateStatusRef: _statusRef, ...writeAuthorityRef } =
      validAuthority();

    await expect(
      strictGraph().updateNode({
        tenantId,
        id: entityId,
        identity: {},
        expectedSchemaVersion: 1,
        writeAuthorityRef,
      }),
    ).rejects.toBeInstanceOf(GraphWriteAuthorityError);
  });

  it("rejects createEdge before SQL when provider status ref is revoked", async () => {
    const writeAuthorityRef: GraphWriteAuthorityRef = {
      ...validAuthority(),
      providerCertificateStatusRef: {
        ...validAuthority().providerCertificateStatusRef!,
        status: "revoked",
      },
    };

    await expect(
      strictGraph().createEdge({
        tenantId,
        type: "involves",
        fromId: entityId,
        toId: entityId,
        attrs: {},
        writeAuthorityRef,
      }),
    ).rejects.toBeInstanceOf(GraphWriteAuthorityError);
  });

  it("rejects deleteEdge before SQL when authority is missing", async () => {
    await expect(strictGraph().deleteEdge(tenantId, edgeId)).rejects.toBeInstanceOf(
      GraphWriteAuthorityError,
    );
  });

  it("rejects createNode before SQL when the substrate record is missing", async () => {
    await expect(
      strictStoreGraph().createNode({
        tenantId,
        profile: { tier1: "Engagement", profile: null, concrete: "Engagement" },
        identity: {},
        schemaVersion: 1,
        writeAuthorityRef: validAuthority(),
      }),
    ).rejects.toBeInstanceOf(GraphWriteAuthorityError);
  });
});

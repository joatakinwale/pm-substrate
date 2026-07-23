import { describe, expect, it } from "vitest";
import type { EntityId, EdgeId, TenantId, Timestamp } from "@pm/types";
import { PostgresGraph } from "./postgres.js";
import {
  assertGraphWriteAuthority,
  GraphWriteAuthorityError,
  validateGraphWriteAuthority,
  type GraphWriteAuthorityRef,
  type GraphWriteAuthoritySubstrateRecord,
  type GraphWriteProjectionReplayRef,
  type GraphWriteProjectionReplayRootSettlementRef,
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

const validProjectionReplayRef = (): GraphWriteProjectionReplayRef => ({
  certificateId: "projection_replay_graph_authority",
  certificateHash: "sha256:projection_replay_certificate",
  projectionName: "graph/current-state",
  projectionVersion: 3,
  authorityScope: "graph.write.strict",
  replayedToPosition: 42,
  transitionHistoryHash: "sha256:projection_transition_history",
  projectionHash: "sha256:projection_hash",
  checkedAt,
});

const validProjectionReplayRootSettlementRef =
  (): GraphWriteProjectionReplayRootSettlementRef => ({
    rootSequence: 7,
    rootHash: "sha256:projection_replay_root",
    settlementSequence: 3,
    settlementStatus: "settled",
    settlementHash: "sha256:projection_replay_root_settlement",
    settlementRecordHash: "sha256:projection_replay_root_settlement_record",
    authorityTopologyHash: "sha256:projection_replay_authority_topology",
    checkedAt,
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

const validReplayAuthority = (): GraphWriteAuthorityRef => ({
  ...validAuthority(),
  projectionReplayRef: validProjectionReplayRef(),
});

const validSettledReplayAuthority = (): GraphWriteAuthorityRef => ({
  ...validAuthority(),
  projectionReplayRef: {
    ...validProjectionReplayRef(),
    certificateStoreSequence: validProjectionReplayRootSettlementRef().rootSequence,
    certificateStoreRootHash: validProjectionReplayRootSettlementRef().rootHash,
  },
  projectionReplayRootSettlementRef: validProjectionReplayRootSettlementRef(),
});

const validReplaySubstrateRecord = (): GraphWriteAuthoritySubstrateRecord => ({
  ...validSubstrateRecord(),
  projectionReplayRef: validProjectionReplayRef(),
});

const validSettledReplaySubstrateRecord = (): GraphWriteAuthoritySubstrateRecord => ({
  ...validSubstrateRecord(),
  projectionReplayRef: validSettledReplayAuthority().projectionReplayRef,
  projectionReplayRootSettlementRef:
    validProjectionReplayRootSettlementRef(),
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

  it("requires projection replay proof when configured", () => {
    const issues = validateGraphWriteAuthority({
      authorityRef: validAuthority(),
      policy: {
        requireAuthorityRef: true,
        requireProjectionReplayRef: true,
      },
    });

    expect(issues.map((issue) => issue.code)).toContain(
      "graph_write_projection_replay_ref_missing",
    );
  });

  it("accepts projection replay proof when it matches policy", () => {
    expect(
      validateGraphWriteAuthority({
        authorityRef: validReplayAuthority(),
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          expectedProjectionName: "graph/current-state",
          expectedProjectionVersion: 3,
          expectedProjectionReplayAuthorityScope: "graph.write.strict",
          minimumProjectionReplayPosition: 40,
        },
      }),
    ).toEqual([]);
  });

  it("rejects stale or mismatched projection replay proof", () => {
    const authorityRef: GraphWriteAuthorityRef = {
      ...validReplayAuthority(),
      projectionReplayRef: {
        ...validProjectionReplayRef(),
        projectionName: "other/current-state",
        replayedToPosition: 39,
      },
    };

    const issues = validateGraphWriteAuthority({
      authorityRef,
      policy: {
        requireAuthorityRef: true,
        requireProjectionReplayRef: true,
        expectedProjectionName: "graph/current-state",
        minimumProjectionReplayPosition: 40,
      },
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      "graph_write_projection_replay_ref_mismatch",
      "graph_write_projection_replay_ref_stale",
    ]);
  });

  it("requires the substrate record to preserve projection replay proof", () => {
    expect(
      validateGraphWriteAuthority({
        authorityRef: validReplayAuthority(),
        substrateRecord: validReplaySubstrateRecord(),
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          requireSubstrateRecord: true,
        },
      }),
    ).toEqual([]);

    expect(
      validateGraphWriteAuthority({
        authorityRef: validReplayAuthority(),
        substrateRecord: {
          ...validReplaySubstrateRecord(),
          projectionReplayRef: {
            ...validProjectionReplayRef(),
            certificateHash: "sha256:different",
          },
        },
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          requireSubstrateRecord: true,
        },
      }).map((issue) => issue.code),
    ).toContain("graph_write_authority_substrate_record_mismatch");
  });

  it("requires a settled replay root when configured", () => {
    expect(
      validateGraphWriteAuthority({
        authorityRef: validReplayAuthority(),
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRootSettlementRef: true,
        },
      }).map((issue) => issue.code),
    ).toContain("graph_write_projection_replay_root_settlement_ref_missing");
  });

  it("accepts a settled replay root only when it matches the replay store root", () => {
    expect(
      validateGraphWriteAuthority({
        authorityRef: validSettledReplayAuthority(),
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          requireProjectionReplayRootSettlementRef: true,
        },
      }),
    ).toEqual([]);

    expect(
      validateGraphWriteAuthority({
        authorityRef: {
          ...validSettledReplayAuthority(),
          projectionReplayRootSettlementRef: {
            ...validProjectionReplayRootSettlementRef(),
            rootHash: "sha256:other_root",
          },
        },
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          requireProjectionReplayRootSettlementRef: true,
        },
      }).map((issue) => issue.code),
    ).toContain("graph_write_projection_replay_root_settlement_ref_mismatch");
  });

  it("requires the substrate record to preserve settled-root proof", () => {
    expect(
      validateGraphWriteAuthority({
        authorityRef: validSettledReplayAuthority(),
        substrateRecord: validSettledReplaySubstrateRecord(),
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          requireProjectionReplayRootSettlementRef: true,
          requireSubstrateRecord: true,
        },
      }),
    ).toEqual([]);

    expect(
      validateGraphWriteAuthority({
        authorityRef: validSettledReplayAuthority(),
        substrateRecord: {
          ...validSettledReplaySubstrateRecord(),
          projectionReplayRootSettlementRef: {
            ...validProjectionReplayRootSettlementRef(),
            settlementRecordHash: "sha256:different_record",
          },
        },
        policy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          requireProjectionReplayRootSettlementRef: true,
          requireSubstrateRecord: true,
        },
      }).map((issue) => issue.code),
    ).toContain("graph_write_authority_substrate_record_mismatch");
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

  const strictReplayGraph = () =>
    new PostgresGraph(
      {
        query: () => {
          throw new Error("authority guard should run before SQL");
        },
      } as never,
      {
        writeAuthorityPolicy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
        },
      },
    );

  const strictSettledReplayGraph = () =>
    new PostgresGraph(
      {
        query: () => {
          throw new Error("authority guard should run before SQL");
        },
      } as never,
      {
        writeAuthorityPolicy: {
          requireAuthorityRef: true,
          requireProjectionReplayRef: true,
          requireProjectionReplayRootSettlementRef: true,
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

  it("rejects updateNode before SQL when projection replay proof is missing", async () => {
    await expect(
      strictReplayGraph().updateNode({
        tenantId,
        id: entityId,
        identity: {},
        expectedSchemaVersion: 1,
        writeAuthorityRef: validAuthority(),
      }),
    ).rejects.toBeInstanceOf(GraphWriteAuthorityError);
  });

  it("rejects createNode before SQL when settled-root proof is missing", async () => {
    await expect(
      strictSettledReplayGraph().createNode({
        tenantId,
        profile: { tier1: "Engagement", profile: null, concrete: "Engagement" },
        identity: {},
        schemaVersion: 1,
        writeAuthorityRef: validReplayAuthority(),
      }),
    ).rejects.toBeInstanceOf(GraphWriteAuthorityError);
  });
});

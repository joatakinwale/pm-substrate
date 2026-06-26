import { describe, expect, it } from "vitest";
import {
  GraphWriteAuthorityError,
  type GraphWriteAuthorityPolicy,
  type GraphWriteAuthorityRef,
  type GraphWriteProjectionReplayRef,
  type GraphWriteAuthoritySubstrateRecord,
} from "@pm/graph";
import type { EntityId, TenantId, Timestamp } from "@pm/types";
import {
  defineCapability,
  type CapabilityRuntimeDeps,
  type CapabilitySpec,
} from "./define.js";
import {
  graphWriteAuthorityResolverFromWorkflowEnvelopeStore,
  GraphWriteAuthorityResolutionError,
} from "./workflow-authority.js";

interface Payload {
  readonly key: string;
}

interface FakeClient {
  readonly calls: string[];
  query(sql: string, params?: readonly unknown[]): Promise<{
    readonly rowCount?: number;
    readonly rows: readonly unknown[];
  }>;
  release(): void;
}

const tenantId = "tnt_capability_authority" as TenantId;
const targetId = "ent_capability_authority" as EntityId;
const checkedAt = "2026-06-25T00:00:00.000Z" as Timestamp;

const validAuthority = (): GraphWriteAuthorityRef => ({
  authorityKind: "workflow_action_outcome_envelope",
  envelopeId: "env_capability_authority",
  actionId: "act_capability_authority",
  terminalOutcome: "accepted",
  providerCertificateId: "cert_capability_authority",
  providerCertificateDigest: "sha256:capability_authority",
  providerCertificateStatusRef: {
    certificateId: "cert_capability_authority",
    certificateDigest: "sha256:capability_authority",
    status: "valid",
    statusSequence: 1,
    statusEventHash: "sha256:status_event",
    statusUpdatedAt: checkedAt,
    checkedAt,
  },
});

const validProjectionReplayRef = (): GraphWriteProjectionReplayRef => ({
  certificateId: "projection_replay_capability_authority",
  certificateHash: "sha256:projection_replay_certificate",
  projectionName: "capability/current-state",
  projectionVersion: 1,
  authorityScope: "capability.graph-write",
  replayedToPosition: 9,
  transitionHistoryHash: "sha256:projection_transition_history",
  projectionHash: "sha256:projection_hash",
  checkedAt,
});

const validSubstrateRecord = (): GraphWriteAuthoritySubstrateRecord => ({
  authorityKind: "workflow_action_outcome_envelope",
  envelopeId: "env_capability_authority",
  actionId: "act_capability_authority",
  terminalOutcome: "accepted",
  providerCertificateId: "cert_capability_authority",
  providerCertificateDigest: "sha256:capability_authority",
  providerCertificateStatusRef: {
    certificateId: "cert_capability_authority",
    certificateDigest: "sha256:capability_authority",
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

const strictPolicy: GraphWriteAuthorityPolicy = {
  requireAuthorityRef: true,
  requireProviderCertificateStatusRef: true,
};

const strictStorePolicy: GraphWriteAuthorityPolicy = {
  ...strictPolicy,
  requireSubstrateRecord: true,
};

const strictReplayPolicy: GraphWriteAuthorityPolicy = {
  ...strictPolicy,
  requireProjectionReplayRef: true,
  expectedProjectionName: "capability/current-state",
  expectedProjectionVersion: 1,
  expectedProjectionReplayAuthorityScope: "capability.graph-write",
  minimumProjectionReplayPosition: 9,
};

const makeClient = (): FakeClient => {
  const calls: string[] = [];
  return {
    calls,
    async query(sql: string): Promise<{ rowCount?: number; rows: readonly unknown[] }> {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        calls.push(sql);
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO public.kit_applied_authority")) {
        calls.push("INSERT_IDEMPOTENCY");
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("SELECT id, identity, schema_version")) {
        calls.push("SELECT_FOR_UPDATE");
        return {
          rowCount: 1,
          rows: [
            {
              id: targetId,
              identity: { targetScore: 0 },
              schema_version: 1,
            },
          ],
        };
      }
      if (sql.includes("UPDATE graph.nodes")) {
        calls.push("UPDATE_GRAPH_NODES");
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`unexpected SQL in capability-kit authority test: ${sql}`);
    },
    release(): void {
      calls.push("RELEASE");
    },
  };
};

const makeDeps = (
  client: FakeClient,
  policy?: GraphWriteAuthorityPolicy,
): CapabilityRuntimeDeps =>
  ({
    pool: { connect: async () => client },
    graph: {},
    events: { publishWith: async () => undefined },
    ...(policy !== undefined ? { graphWriteAuthorityPolicy: policy } : {}),
  }) as unknown as CapabilityRuntimeDeps;

const makeSpec = (
  overrides: Partial<CapabilitySpec<Payload, { newScore: number }>> = {},
): CapabilitySpec<Payload, { newScore: number }> => ({
  name: "kit-test.authority",
  idempotency: {
    table: "public.kit_applied_authority",
    keyColumn: "payload_key",
  },
  extractIdempotencyKey: (payload) => payload.key,
  walk: async () => targetId,
  apply: async ({ currentIdentity }) => {
    const current = (currentIdentity["targetScore"] as number | undefined) ?? 0;
    return {
      nextIdentity: { ...currentIdentity, targetScore: current + 1 },
      applyResult: { newScore: current + 1 },
    };
  },
  ...overrides,
});

describe("defineCapability graph write authority", () => {
  it("preserves existing behavior when no graph write authority policy is configured", async () => {
    const client = makeClient();
    const handler = defineCapability(makeSpec(), makeDeps(client));

    await handler.handle(tenantId, { key: "payload-1" });

    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "UPDATE_GRAPH_NODES",
      "COMMIT",
      "RELEASE",
    ]);
  });

  it("rejects a raw graph update before apply when strict authority is missing", async () => {
    const client = makeClient();
    let applyCalled = false;
    const handler = defineCapability(
      makeSpec({
        apply: async () => {
          applyCalled = true;
          return {
            nextIdentity: { targetScore: 1 },
            applyResult: { newScore: 1 },
          };
        },
      }),
      makeDeps(client, strictPolicy),
    );

    await expect(handler.handle(tenantId, { key: "payload-2" })).rejects.toThrow(
      GraphWriteAuthorityError,
    );

    expect(applyCalled).toBe(false);
    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "ROLLBACK",
      "RELEASE",
    ]);
  });

  it("accepts a valid authority ref and passes it through apply before update", async () => {
    const client = makeClient();
    const authorityRef = validAuthority();
    const order: string[] = [];
    let applyAuthorityRef: GraphWriteAuthorityRef | undefined;

    const handler = defineCapability(
      makeSpec({
        graphWriteAuthority: async ({ currentSchemaVersion }) => {
          order.push("authority");
          expect(currentSchemaVersion).toBe(1);
          return authorityRef;
        },
        apply: async ({ writeAuthorityRef }) => {
          order.push("apply");
          applyAuthorityRef = writeAuthorityRef;
          return {
            nextIdentity: { targetScore: 1 },
            applyResult: { newScore: 1 },
          };
        },
      }),
      makeDeps(client, strictPolicy),
    );

    await handler.handle(tenantId, { key: "payload-3" });

    expect(applyAuthorityRef).toBe(authorityRef);
    expect(order).toEqual(["authority", "apply"]);
    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "UPDATE_GRAPH_NODES",
      "COMMIT",
      "RELEASE",
    ]);
  });

  it("rejects before apply when strict policy requires projection replay proof", async () => {
    const client = makeClient();
    let applyCalled = false;

    const handler = defineCapability(
      makeSpec({
        graphWriteAuthority: async () => validAuthority(),
        apply: async () => {
          applyCalled = true;
          return {
            nextIdentity: { targetScore: 1 },
            applyResult: { newScore: 1 },
          };
        },
      }),
      makeDeps(client, strictReplayPolicy),
    );

    await expect(handler.handle(tenantId, { key: "payload-replay-1" })).rejects.toThrow(
      GraphWriteAuthorityError,
    );

    expect(applyCalled).toBe(false);
    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "ROLLBACK",
      "RELEASE",
    ]);
  });

  it("accepts replay-certified authority before graph update", async () => {
    const client = makeClient();
    const authorityRef = validReplayAuthority();
    let applyAuthorityRef: GraphWriteAuthorityRef | undefined;

    const handler = defineCapability(
      makeSpec({
        graphWriteAuthority: async () => authorityRef,
        apply: async ({ writeAuthorityRef }) => {
          applyAuthorityRef = writeAuthorityRef;
          return {
            nextIdentity: { targetScore: 1 },
            applyResult: { newScore: 1 },
          };
        },
      }),
      makeDeps(client, strictReplayPolicy),
    );

    await handler.handle(tenantId, { key: "payload-replay-2" });

    expect(applyAuthorityRef).toBe(authorityRef);
    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "UPDATE_GRAPH_NODES",
      "COMMIT",
      "RELEASE",
    ]);
  });

  it("rejects before apply when the replay certificate store rejects the ref", async () => {
    const client = makeClient();
    const authorityRef = validReplayAuthority();
    let applyCalled = false;

    const handler = defineCapability(
      makeSpec({
        graphWriteAuthority: graphWriteAuthorityResolverFromWorkflowEnvelopeStore({
          store: {
            async getWorkflowActionOutcomeEnvelope() {
              return {
                envelopeId: authorityRef.envelopeId,
                actionId: authorityRef.actionId,
                terminalOutcome: "accepted",
                providerCertificateId: authorityRef.providerCertificateId,
                providerCertificateDigest: authorityRef.providerCertificateDigest,
                providerCertificateStatusRef:
                  authorityRef.providerCertificateStatusRef,
                projectionReplayRef: authorityRef.projectionReplayRef,
              };
            },
          },
          projectionReplayCertificateStore: {
            async verifyProjectionReplayCertificateRef(input) {
              return {
                valid: false,
                certificateId: input.ref.certificateId,
                issues: [
                  {
                    code: "projection_replay_certificate_record_missing",
                    message: "missing durable certificate record",
                  },
                ],
              };
            },
          },
          envelopeId: () => authorityRef.envelopeId,
          expectedActionId: () => authorityRef.actionId,
        }),
        apply: async () => {
          applyCalled = true;
          return {
            nextIdentity: { targetScore: 1 },
            applyResult: { newScore: 1 },
          };
        },
      }),
      makeDeps(client, strictReplayPolicy),
    );

    await expect(
      handler.handle(tenantId, { key: "payload-replay-store-1" }),
    ).rejects.toThrow(GraphWriteAuthorityResolutionError);

    expect(applyCalled).toBe(false);
    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "ROLLBACK",
      "RELEASE",
    ]);
  });

  it("rejects before apply when strict policy requires a substrate record", async () => {
    const client = makeClient();
    let applyCalled = false;

    const handler = defineCapability(
      makeSpec({
        graphWriteAuthority: async () => validAuthority(),
        apply: async () => {
          applyCalled = true;
          return {
            nextIdentity: { targetScore: 1 },
            applyResult: { newScore: 1 },
          };
        },
      }),
      makeDeps(client, strictStorePolicy),
    );

    await expect(handler.handle(tenantId, { key: "payload-4" })).rejects.toThrow(
      GraphWriteAuthorityError,
    );

    expect(applyCalled).toBe(false);
    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "ROLLBACK",
      "RELEASE",
    ]);
  });

  it("accepts a matched substrate record and passes it through apply", async () => {
    const client = makeClient();
    const authorityRef = validAuthority();
    const substrateRecord = validSubstrateRecord();
    let applySubstrateRecord: GraphWriteAuthoritySubstrateRecord | undefined;

    const handler = defineCapability(
      makeSpec({
        graphWriteAuthority: async () => ({
          authorityRef,
          substrateRecord,
        }),
        apply: async ({ writeAuthoritySubstrateRecord }) => {
          applySubstrateRecord = writeAuthoritySubstrateRecord;
          return {
            nextIdentity: { targetScore: 1 },
            applyResult: { newScore: 1 },
          };
        },
      }),
      makeDeps(client, strictStorePolicy),
    );

    await handler.handle(tenantId, { key: "payload-5" });

    expect(applySubstrateRecord).toBe(substrateRecord);
    expect(client.calls).toEqual([
      "BEGIN",
      "INSERT_IDEMPOTENCY",
      "SELECT_FOR_UPDATE",
      "UPDATE_GRAPH_NODES",
      "COMMIT",
      "RELEASE",
    ]);
  });
});

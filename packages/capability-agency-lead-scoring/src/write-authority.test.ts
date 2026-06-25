import { describe, expect, it } from "vitest";
import type {
  Edge,
  EntityId,
  TenantId,
} from "@pm/types";
import type {
  Graph,
  GraphWriteAuthorityPolicy,
  GraphWriteAuthorityRef,
  GraphWriteAuthoritySubstrateRecord,
} from "@pm/graph";
import { LeadScoringHandler } from "./handler.js";

const tenantId = "tnt_lead_scoring_authority" as TenantId;
const leadId = "ent_lead_authority" as EntityId;
const targetId = "ent_scoring_config_authority" as EntityId;

const strictStorePolicy: GraphWriteAuthorityPolicy = {
  requireAuthorityRef: true,
  requireProviderCertificateStatusRef: true,
  requireSubstrateRecord: true,
};

const authorityRef: GraphWriteAuthorityRef = {
  authorityKind: "workflow_action_outcome_envelope",
  envelopeId: "env_lead_scoring_authority",
  actionId: "act_lead_scoring_authority",
  terminalOutcome: "accepted",
  providerCertificateId: "cert_lead_scoring_authority",
  providerCertificateDigest: "sha256:lead_scoring_authority",
  providerCertificateStatusRef: {
    certificateId: "cert_lead_scoring_authority",
    certificateDigest: "sha256:lead_scoring_authority",
    status: "valid",
    statusSequence: 1,
    statusEventHash: "sha256:status_event",
    statusUpdatedAt: "2026-06-25T00:00:00.000Z",
    checkedAt: "2026-06-25T00:00:01.000Z",
  },
};

const substrateRecord: GraphWriteAuthoritySubstrateRecord = {
  authorityKind: "workflow_action_outcome_envelope",
  envelopeId: authorityRef.envelopeId,
  actionId: authorityRef.actionId,
  terminalOutcome: "accepted",
  providerCertificateId: "cert_lead_scoring_authority",
  providerCertificateDigest: "sha256:lead_scoring_authority",
  providerCertificateStatusRef: {
    certificateId: "cert_lead_scoring_authority",
    certificateDigest: "sha256:lead_scoring_authority",
    status: "valid",
    statusSequence: 1,
    statusEventHash: "sha256:status_event",
    statusUpdatedAt: "2026-06-25T00:00:00.000Z",
    checkedAt: "2026-06-25T00:00:01.000Z",
  },
};

interface FakeClient {
  readonly calls: string[];
  query(sql: string): Promise<{ readonly rowCount?: number; readonly rows: readonly unknown[] }>;
  release(): void;
}

const makeClient = (): FakeClient => {
  const calls: string[] = [];
  return {
    calls,
    async query(sql: string) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        calls.push(sql);
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO lead_scoring.applied_scoring_events")) {
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
              identity: { currentTotalLeadsScored: 4 },
              schema_version: 3,
            },
          ],
        };
      }
      if (sql.includes("UPDATE graph.nodes")) {
        calls.push("UPDATE_GRAPH_NODES");
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`unexpected SQL in lead-scoring authority test: ${sql}`);
    },
    release() {
      calls.push("RELEASE");
    },
  };
};

const graph = {
  async outgoingEdges(
    _tenantId: TenantId,
    _fromId: EntityId,
    edgeType: string,
  ): Promise<readonly Edge[]> {
    if (edgeType !== "agency/lead_scored_by") return [];
    return [
      {
        id: "edg_lead_scoring_authority" as never,
        tenantId,
        type: edgeType,
        fromId: leadId,
        toId: targetId,
        attrs: {},
        createdAt: "2026-06-25T00:00:00.000Z" as never,
        updatedAt: "2026-06-25T00:00:00.000Z" as never,
      },
    ];
  },
} as Graph;

describe("LeadScoringHandler graph write authority", () => {
  it("accepts a workflow-injected store-backed authority resolution", async () => {
    const client = makeClient();
    let resolverCalled = false;
    const handler = new LeadScoringHandler({
      pool: { connect: async () => client } as never,
      graph,
      events: { publishWith: async () => undefined } as never,
      graphWriteAuthorityPolicy: strictStorePolicy,
      graphWriteAuthority: async ({ targetId: resolvedTargetId }) => {
        resolverCalled = true;
        expect(resolvedTargetId).toBe(targetId);
        return { authorityRef, substrateRecord };
      },
    });

    await handler.handle(tenantId, {
      leadId,
      scoreDelta: 10,
      recordedAt: "2026-06-25T00:00:02.000Z",
      scoringEventId: "score_authority_1",
    });

    expect(resolverCalled).toBe(true);
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

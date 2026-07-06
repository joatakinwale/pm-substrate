import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  buildObservationContractFromCurrentStateView,
  buildStateReviewArtifact,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifact,
  stateRef,
  type CurrentStateView,
  type ReadSetEntry,
} from "@pm/agent-state-core";
import type { EntityMapping } from "@pm/entity-mapping";
import { PostgresEventStore } from "@pm/events";
import type { EntityId, TenantId, Timestamp } from "@pm/types";

import { proposeEntityMapping } from "./mapping-approval.js";
import { buildShadowReport } from "./shadow-report.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const now = (): Timestamp => new Date().toISOString() as Timestamp;

/** A governed view whose basis is the given head ref. */
function view(tenantId: TenantId, headRef: string): CurrentStateView {
  return {
    tenantId,
    viewId: `view_${randomUUID()}`,
    subject: stateRef("projection", "shadow_scope", "shadow scope"),
    observedAt: now(),
    authorityRule: "shadow-test-head",
    sourceRefs: [stateRef("continuity_checkpoint", headRef, "head")],
    missingSources: [],
    conflicts: [],
    allowedActions: [
      { actionType: "record_checkpoint", label: "record", requiredRefs: [] },
    ],
  };
}

const readSetOf = (v: CurrentStateView): readonly ReadSetEntry[] =>
  v.sourceRefs.map((ref) => ({
    ref,
    observedAt: v.observedAt,
    authority: v.authorityRule,
  }));

describeIfDb("shadow report — what would have been blocked (hard req 5)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_shdw_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    events = new PostgresEventStore(pool);

    const publish = (type: string, payload: Record<string, unknown>) =>
      events.publish({
        tenantId,
        type,
        entityId: `shadow:${type}:${randomUUID().slice(0, 6)}` as unknown as EntityId,
        emittedBy: "shadow-test",
        payloadSchema: `${type}.v1`,
        payload,
      });

    // --- Proposal 1: STALE basis (contract cites head:A, reviewed at head:B)
    // → advisory warnings → the shadow "would have been blocked" signal.
    const viewA = view(tenantId, "head:AAAA");
    const viewB = view(tenantId, "head:BBBB");
    const contractA = buildObservationContractFromCurrentStateView(viewA);
    const staleReview = reviewProposedActionAgainstCurrentState(
      {
        tenantId,
        actionType: "record_checkpoint",
        subject: viewA.subject,
        payload: {},
        readSet: readSetOf(viewA),
        observationContract: contractA,
        proposedBy: "shadow-test",
        proposedAt: now(),
      },
      viewB,
      { observationContract: contractA, enforcementMode: "advisory" },
    );
    expect(staleReview.warnings.length).toBeGreaterThan(0); // sanity of the seed
    await publish("pm.mcp.proposal", {
      proposalId: staleReview.reviewId,
      scope: "shadow_scope",
      artifact: serializeStateReviewArtifact(
        buildStateReviewArtifact(staleReview, { source: "shadow-test" }),
      ),
    });

    // --- Proposal 2: FRESH basis → no warnings.
    const freshReview = reviewProposedActionAgainstCurrentState(
      {
        tenantId,
        actionType: "record_checkpoint",
        subject: viewB.subject,
        payload: {},
        readSet: readSetOf(viewB),
        proposedBy: "shadow-test",
        proposedAt: now(),
      },
      viewB,
      { enforcementMode: "advisory" },
    );
    expect(freshReview.warnings).toHaveLength(0);
    await publish("pm.mcp.proposal", {
      proposalId: freshReview.reviewId,
      scope: "shadow_scope",
      artifact: serializeStateReviewArtifact(
        buildStateReviewArtifact(freshReview, { source: "shadow-test" }),
      ),
    });

    // --- Proposal 3: garbage artifact → counted unverifiable, never trusted.
    await publish("pm.mcp.proposal", {
      proposalId: "prop_garbage",
      scope: "shadow_scope",
      artifact: '{"not":"an artifact"}',
    });

    // --- Enforced lanes.
    await publish("pm.mcp.action", {
      proposalId: "p1",
      terminalOutcome: "blocked",
      blockingCauseCodes: ["required_source_refs_present"],
      executed: false,
    });
    await publish("pm.mcp.action", {
      proposalId: "p2",
      terminalOutcome: "accepted",
      executed: true,
    });
    await publish("pm.executor.refused", {
      outcomeHash: "oh1",
      actionId: "a1",
      target: "t",
      terminalOutcome: "blocked",
      blockingCauseCodes: ["stale_basis"],
    });
    await publish("pm.executor.dispatched", {
      outcomeHash: "oh2",
      actionId: "a2",
      target: "t",
      endpoint: "http://x",
      httpStatus: 200,
    });
    await publish("pm.executor.failed", {
      outcomeHash: "oh3",
      actionId: "a3",
      target: "t",
      endpoint: "http://x",
      reason: "endpoint returned 500",
    });
    await publish("pm.sync.upserted", {
      appName: "app_x",
      sourceName: "Customer",
      externalId: "c1",
      nodeId: randomUUID(),
      op: "created",
      identityHash: "h",
    });
    await publish("pm.sync.rejected", {
      appName: "app_x",
      sourceName: "Ghost",
      externalId: "g1",
      reason: 'entity "Ghost" is not declared in mapping',
    });

    // --- A pending mapping proposal (drift awaiting the owner).
    const mapping: EntityMapping = {
      profile: null,
      mappingVersion: 1,
      entities: {
        Customer: {
          tier1: "Counterparty",
          concrete: "Counterparty",
          identityFields: ["name"],
          schemaVersion: 1,
        },
      },
    };
    await proposeEntityMapping(events, {
      tenantId,
      appName: "app_x",
      mapping,
      proposedBy: "liquid-sidecar",
      origin: "liquid_repair",
      reason: "upstream drifted",
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("folds every lane into the shadow verdict", async () => {
    const report = await buildShadowReport(events, { tenantId });

    expect(report.mcp).toMatchObject({
      proposalsReviewed: 3,
      proposalsWithWarnings: 1,
      unverifiableArtifacts: 1,
      actionsAdmitted: 1,
      actionsBlocked: 1,
    });
    expect(Object.keys(report.mcp.warningCodes).length).toBeGreaterThan(0);
    expect(report.mcp.blockingCauseCodes).toEqual({
      required_source_refs_present: 1,
    });

    expect(report.executor).toEqual({ dispatched: 1, refused: 1, failed: 1 });
    expect(report.sync).toMatchObject({ upserted: 1, rejected: 1 });
    expect(report.sync.rejectionReasons[0]).toMatch(/not declared in mapping/);

    expect(report.mappings.appsSeen).toEqual(["app_x"]);
    expect(report.mappings.pendingProposals).toHaveLength(1);
    expect(report.mappings.pendingProposals[0]).toMatchObject({
      appName: "app_x",
      origin: "liquid_repair",
    });

    expect(report.totals).toEqual({
      advisoryWouldHaveBlocked: 1,
      enforcedBlocks: 2, // 1 blocked action + 1 refused envelope
      dataRejections: 1,
      pendingMappingObstructions: 1,
    });
  });

  it("windows narrow the fold (future window sees nothing)", async () => {
    const report = await buildShadowReport(events, {
      tenantId,
      since: new Date(Date.now() + 60_000).toISOString() as Timestamp,
    });
    expect(report.mcp.proposalsReviewed).toBe(0);
    expect(report.totals.enforcedBlocks).toBe(0);
    expect(report.mappings.pendingProposals).toHaveLength(0);
  });
});
